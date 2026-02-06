"""
Slack Bot Integration for CX Agent Studio.

This module implements a Slack bot that connects to CX Agent Studio
using the API access deployment option.
"""

import logging
import re
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Optional

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from config import Config, load_config, setup_logging
from ces_client import CESClient, BidiSessionClient, create_client, create_bidi_client

# Initialize configuration and logging
config: Config = None
logger: logging.Logger = None
ces_client: CESClient = None
bidi_client: BidiSessionClient = None

# Session tracking
user_sessions: Dict[str, str] = {}

# Slack app instance
app: App = None

# Bot user ID (populated at startup)
bot_user_id: Optional[str] = None


def sanitize_session_id(channel_id: str, thread_ts: Optional[str] = None) -> str:
    """
    Generate a valid session ID from Slack channel/thread info.

    Session ID must match: [a-zA-Z0-9][a-zA-Z0-9-_]{4,62}

    Args:
        channel_id: Slack channel ID
        thread_ts: Thread timestamp (optional)

    Returns:
        str: Valid session ID
    """
    # Create base session ID
    thread_part = thread_ts.replace(".", "-") if thread_ts else "main"
    session_id = f"slack-{channel_id}-{thread_part}"

    # Ensure it meets length requirements (5-63 characters)
    if len(session_id) < 5:
        session_id = session_id + "-sess"

    # Ensure first character is alphanumeric
    if not session_id[0].isalnum():
        session_id = "s" + session_id

    # Remove any invalid characters
    session_id = re.sub(r"[^a-zA-Z0-9\-_]", "-", session_id)

    return session_id[:63]  # Max 63 characters


def get_session_id(channel_id: str, thread_ts: Optional[str] = None) -> str:
    """
    Get or create a session ID for a channel/thread.

    Args:
        channel_id: Slack channel ID
        thread_ts: Thread timestamp (optional)

    Returns:
        str: Session ID
    """
    key = f"{channel_id}:{thread_ts or 'main'}"
    if key not in user_sessions:
        user_sessions[key] = sanitize_session_id(channel_id, thread_ts)
    return user_sessions[key]


def reset_session(channel_id: str, thread_ts: Optional[str] = None) -> str:
    """
    Reset the session for a channel/thread.

    Args:
        channel_id: Slack channel ID
        thread_ts: Thread timestamp (optional)

    Returns:
        str: New session ID
    """
    key = f"{channel_id}:{thread_ts or 'main'}"
    # Create new session with timestamp
    new_session = f"slack-{channel_id}-{int(time.time())}"
    if len(new_session) > 63:
        new_session = new_session[:63]
    user_sessions[key] = new_session
    return new_session


def extract_message_text(text: str) -> str:
    """
    Extract clean message text, removing bot mentions.

    Args:
        text: Raw message text

    Returns:
        str: Cleaned message text
    """
    if not text:
        return ""

    # Remove bot mentions (e.g., <@U123ABC>)
    cleaned = re.sub(r"<@[A-Z0-9]+>", "", text)

    # Remove extra whitespace
    cleaned = " ".join(cleaned.split())

    return cleaned.strip()


def should_respond(event: dict) -> bool:
    """
    Determine if the bot should respond to a message event.

    Args:
        event: Slack message event

    Returns:
        bool: True if bot should respond
    """
    # Don't respond to bot messages
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return False

    # Check if it's a DM
    channel_type = event.get("channel_type", "")
    if channel_type == "im":
        return True

    # Check for mentions
    text = event.get("text", "")
    if bot_user_id and f"<@{bot_user_id}>" in text:
        return True

    # If configured to only respond to mentions, don't respond otherwise
    if config.respond_to_mentions_only:
        return False

    return True


def process_message(channel_id: str, thread_ts: Optional[str], user_message: str) -> str:
    """
    Process a user message and get response from CX Agent Studio.

    Args:
        channel_id: Slack channel ID
        thread_ts: Thread timestamp
        user_message: User's message text

    Returns:
        str: Agent response text
    """
    session_id = get_session_id(channel_id, thread_ts)
    logger.info(f"Processing message for session {session_id}")

    try:
        if config.use_bidi_session:
            response_text = bidi_client.send_message(session_id, user_message)
        else:
            response_text = ces_client.run_session(session_id, user_message)

        return response_text if response_text else "I received your message but couldn't generate a response."

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        return "Sorry, I encountered an error processing your message. Please try again later."


def create_slack_app() -> App:
    """
    Create and configure the Slack Bolt app.

    Returns:
        App: Configured Slack app
    """
    slack_app = App(
        token=config.slack_bot_token,
        signing_secret=config.slack_signing_secret,
    )

    # Get bot user ID
    global bot_user_id
    try:
        auth_response = slack_app.client.auth_test()
        bot_user_id = auth_response["user_id"]
        logger.info(f"Bot user ID: {bot_user_id}")
    except SlackApiError as e:
        logger.error(f"Failed to get bot user ID: {e}")

    # Handle app_mention events
    @slack_app.event("app_mention")
    def handle_app_mention(event, say, client):
        """Handle @mention events."""
        logger.debug(f"Received app_mention event: {event}")

        channel_id = event.get("channel")
        thread_ts = event.get("thread_ts") or event.get("ts")
        user_message = extract_message_text(event.get("text", ""))

        if not user_message:
            say("How can I help you?", thread_ts=thread_ts)
            return

        # Show typing indicator
        try:
            client.chat_postMessage(
                channel=channel_id,
                text="...",
                thread_ts=thread_ts,
            )
        except Exception:
            pass

        # Process message and respond
        response = process_message(channel_id, thread_ts, user_message)
        say(response, thread_ts=thread_ts)

    # Handle direct messages
    @slack_app.event("message")
    def handle_message(event, say, client):
        """Handle message events."""
        logger.debug(f"Received message event: {event}")

        # Skip if we shouldn't respond
        if not should_respond(event):
            return

        channel_id = event.get("channel")
        thread_ts = event.get("thread_ts") or event.get("ts")
        user_message = extract_message_text(event.get("text", ""))

        if not user_message:
            return

        # Process message and respond
        response = process_message(channel_id, thread_ts, user_message)
        say(response, thread_ts=thread_ts)

    # Handle /ask slash command
    @slack_app.command("/ask")
    def handle_ask_command(ack, respond, command):
        """Handle /ask slash command."""
        ack()

        logger.debug(f"Received /ask command: {command}")

        channel_id = command.get("channel_id")
        user_message = command.get("text", "").strip()

        if not user_message:
            respond("Please provide a question. Usage: `/ask [your question]`")
            return

        respond("Processing your question...")

        # Process message and respond
        response = process_message(channel_id, None, user_message)
        respond(response)

    # Handle /reset slash command
    @slack_app.command("/reset")
    def handle_reset_command(ack, respond, command):
        """Handle /reset slash command to reset session."""
        ack()

        channel_id = command.get("channel_id")
        reset_session(channel_id)

        respond("Your conversation session has been reset. You can now start a fresh conversation!")

    # Handle errors
    @slack_app.error
    def handle_error(error, body, logger):
        """Handle errors in the Slack app."""
        logger.error(f"Error: {error}")
        logger.debug(f"Request body: {body}")

    return slack_app


class HealthCheckHandler(BaseHTTPRequestHandler):
    """HTTP handler for health check endpoint."""

    def do_GET(self):
        """Handle GET requests for health check."""
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "healthy"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default HTTP logging."""
        pass


def start_health_check_server(port: int) -> None:
    """
    Start HTTP health check server in a background thread.

    Args:
        port: Port to listen on
    """
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Health check server started on port {port}")


def main() -> None:
    """Main entry point for the Slack bot."""
    global config, logger, ces_client, bidi_client, app

    # Load configuration
    try:
        config = load_config()
    except ValueError as e:
        print(f"Configuration error: {e}")
        return

    # Setup logging
    logger = setup_logging(config.log_level)
    logger.info("Starting Slack CX Agent Studio Bot")
    logger.info(f"Using app: {config.app_resource_name}")

    # Initialize CES clients
    ces_client = create_client(config)
    if config.use_bidi_session:
        bidi_client = create_bidi_client(config)
        logger.info("Using BidiRunSession for streaming responses")
    else:
        logger.info("Using runSession for synchronous responses")

    # Start health check server
    start_health_check_server(config.health_check_port)

    # Create Slack app
    app = create_slack_app()

    # Start the bot
    if config.use_socket_mode:
        logger.info("Starting bot in Socket Mode...")
        handler = SocketModeHandler(app, config.slack_app_token)
        handler.start()
    else:
        logger.info("Starting bot in Events API mode...")
        # For Events API mode, you would typically use a web framework
        # This is a simplified version using the built-in server
        app.start(port=3000)


if __name__ == "__main__":
    main()
