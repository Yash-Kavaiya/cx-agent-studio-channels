"""
Telegram Bot Integration for CX Agent Studio.

This module implements a Telegram bot that connects to CX Agent Studio
using the API access deployment option.
"""

import asyncio
import logging
import re
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from config import Config, load_config, setup_logging
from ces_client import CESClient, create_client, create_bidi_client

# Initialize configuration and logging
config: Config = None
logger: logging.Logger = None
ces_client: CESClient = None
bidi_client = None

# Session tracking for user sessions
user_sessions: Dict[int, str] = {}


def sanitize_session_id(chat_id: int) -> str:
    """
    Generate a valid session ID from a Telegram chat ID.

    Session ID must match: [a-zA-Z0-9][a-zA-Z0-9-_]{4,62}

    Args:
        chat_id: Telegram chat ID

    Returns:
        str: Valid session ID
    """
    # Create a session ID that meets the requirements
    session_id = f"telegram-{abs(chat_id)}"

    # Ensure it meets length requirements (5-63 characters)
    if len(session_id) < 5:
        session_id = session_id + "-sess"

    # Ensure first character is alphanumeric
    if not session_id[0].isalnum():
        session_id = "t" + session_id

    return session_id[:63]  # Max 63 characters


def get_session_id(chat_id: int) -> str:
    """
    Get or create a session ID for a chat.

    Args:
        chat_id: Telegram chat ID

    Returns:
        str: Session ID for this chat
    """
    if chat_id not in user_sessions:
        user_sessions[chat_id] = sanitize_session_id(chat_id)
    return user_sessions[chat_id]


def reset_session(chat_id: int) -> str:
    """
    Reset the session for a chat by generating a new session ID.

    Args:
        chat_id: Telegram chat ID

    Returns:
        str: New session ID
    """
    import time
    # Append timestamp to create a new unique session
    new_session_id = f"telegram-{abs(chat_id)}-{int(time.time())}"
    if len(new_session_id) > 63:
        new_session_id = new_session_id[:63]
    user_sessions[chat_id] = new_session_id
    return new_session_id


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /start command.

    Args:
        update: Telegram update object
        context: Callback context
    """
    user = update.effective_user
    welcome_message = (
        f"Hello {user.first_name}! I'm connected to CX Agent Studio.\n\n"
        "You can start chatting with me, and I'll respond using the AI agent.\n\n"
        "Commands:\n"
        "/start - Show this welcome message\n"
        "/help - Get help information\n"
        "/reset - Reset conversation session"
    )
    await update.message.reply_text(welcome_message)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /help command.

    Args:
        update: Telegram update object
        context: Callback context
    """
    help_message = (
        "How to use this bot:\n\n"
        "Simply send me a message and I'll respond using the CX Agent Studio AI.\n\n"
        "Available commands:\n"
        "/start - Show welcome message\n"
        "/help - Show this help message\n"
        "/reset - Reset your conversation session\n\n"
        "Your conversation history is maintained within a session. "
        "Use /reset to start a fresh conversation."
    )
    await update.message.reply_text(help_message)


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /reset command to reset the conversation session.

    Args:
        update: Telegram update object
        context: Callback context
    """
    chat_id = update.effective_chat.id
    reset_session(chat_id)
    await update.message.reply_text(
        "Your conversation session has been reset. "
        "You can now start a fresh conversation!"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle incoming text messages.

    Args:
        update: Telegram update object
        context: Callback context
    """
    if not update.message or not update.message.text:
        return

    chat_id = update.effective_chat.id
    user_message = update.message.text
    session_id = get_session_id(chat_id)

    logger.info(f"Received message from chat {chat_id}: {user_message[:50]}...")

    # Send typing indicator
    await context.bot.send_chat_action(chat_id=chat_id, action="typing")

    try:
        # Call CX Agent Studio API
        if config.use_bidi_session and bidi_client:
            response_text = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: bidi_client.send_message(session_id, user_message),
            )
        else:
            response_text = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: ces_client.run_session(session_id, user_message),
            )

        if response_text:
            # Split long messages (Telegram limit is 4096 characters)
            await send_long_message(update, response_text)
        else:
            await update.message.reply_text(
                "I received your message but didn't get a response. Please try again."
            )

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        await update.message.reply_text(
            "Sorry, I encountered an error processing your message. "
            "Please try again later."
        )


async def send_long_message(update: Update, text: str, max_length: int = 4096) -> None:
    """
    Send a message, splitting if it exceeds Telegram's character limit.

    Args:
        update: Telegram update object
        text: Message text to send
        max_length: Maximum message length (default: 4096)
    """
    if len(text) <= max_length:
        await update.message.reply_text(text)
        return

    # Split message at natural breakpoints
    chunks = []
    current_chunk = ""

    for line in text.split("\n"):
        if len(current_chunk) + len(line) + 1 <= max_length:
            current_chunk += line + "\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # Handle lines longer than max_length
            while len(line) > max_length:
                chunks.append(line[:max_length])
                line = line[max_length:]
            current_chunk = line + "\n"

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    for chunk in chunks:
        await update.message.reply_text(chunk)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle errors in the telegram bot.

    Args:
        update: Telegram update object
        context: Callback context
    """
    logger.error(f"Update {update} caused error: {context.error}", exc_info=context.error)


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
    """Main entry point for the Telegram bot."""
    global config, logger, ces_client, bidi_client

    # Load configuration
    try:
        config = load_config()
    except ValueError as e:
        print(f"Configuration error: {e}")
        return

    # Setup logging
    logger = setup_logging(config.log_level)
    logger.info("Starting Telegram CX Agent Studio Bot")
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

    # Create Telegram application
    application = Application.builder().token(config.telegram_bot_token).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("reset", reset_command))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    # Add error handler
    application.add_error_handler(error_handler)

    # Start the bot
    logger.info("Bot is starting...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
