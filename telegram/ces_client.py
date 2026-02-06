"""
CX Agent Studio (CES) API Client.

Provides a wrapper for interacting with the CX Agent Studio API,
supporting both runSession and BidiRunSession methods.
"""

import logging
import threading
import time
import uuid
from typing import Optional, Callable, List

import google.auth
import google.auth.transport.requests
import websocket
from google.cloud import ces_v1
from google.protobuf import json_format

from config import Config

logger = logging.getLogger(__name__)


class CESClient:
    """Client for CX Agent Studio API interactions."""

    def __init__(self, config: Config):
        """
        Initialize the CES client.

        Args:
            config: Application configuration
        """
        self.config = config
        self._session_client: Optional[ces_v1.SessionServiceClient] = None

    @property
    def session_client(self) -> ces_v1.SessionServiceClient:
        """Get or create a SessionServiceClient instance."""
        if self._session_client is None:
            self._session_client = ces_v1.SessionServiceClient()
        return self._session_client

    def run_session(
        self,
        session_id: str,
        user_message: str,
        timeout: float = 30.0,
    ) -> str:
        """
        Send a message to the agent and get a response using runSession.

        This is a synchronous request-response interaction.

        Args:
            session_id: Unique session identifier
            user_message: The user's message text
            timeout: Request timeout in seconds

        Returns:
            str: The agent's response text

        Raises:
            Exception: If the API call fails
        """
        session_name = self.config.get_session_name(session_id)
        logger.debug(f"Running session: {session_name}")

        # Create session configuration
        config = ces_v1.SessionConfig(session=session_name)

        # Create input with user message
        session_input = ces_v1.SessionInput(text=user_message)
        inputs = [session_input]

        # Create and send request
        request = ces_v1.RunSessionRequest(config=config, inputs=inputs)

        try:
            response = self.session_client.run_session(
                request=request,
                timeout=timeout,
            )
            logger.debug(f"Session response: {response}")

            # Extract text from response
            return self._extract_response_text(response)

        except Exception as e:
            logger.error(f"Error running session: {e}")
            raise

    def _extract_response_text(self, response: ces_v1.RunSessionResponse) -> str:
        """
        Extract text content from a RunSessionResponse.

        Args:
            response: The API response

        Returns:
            str: Extracted text content
        """
        texts = []

        # Check for outputs in the response
        if hasattr(response, "outputs") and response.outputs:
            for output in response.outputs:
                if hasattr(output, "text") and output.text:
                    texts.append(output.text)

        # Check for response content
        if hasattr(response, "response") and response.response:
            resp = response.response
            if hasattr(resp, "content") and resp.content:
                for content in resp.content:
                    if hasattr(content, "text") and content.text:
                        texts.append(content.text)

        if texts:
            return "\n".join(texts)

        # Fallback: return string representation if no text found
        logger.warning("No text found in response, returning raw response")
        return str(response)


class BidiSessionClient:
    """Client for bidirectional streaming sessions with CX Agent Studio."""

    # WebSocket endpoint for BidiRunSession
    WS_ENDPOINT_TEMPLATE = (
        "wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/"
        "BidiRunSession/locations/{region}"
    )

    def __init__(self, config: Config):
        """
        Initialize the BidiSession client.

        Args:
            config: Application configuration
        """
        self.config = config
        self._ws: Optional[websocket.WebSocketApp] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._responses: List[str] = []
        self._response_event = threading.Event()
        self._connected = False
        self._error: Optional[str] = None

    def _get_auth_token(self) -> str:
        """
        Get Google Cloud authentication token.

        Returns:
            str: OAuth2 access token

        Raises:
            Exception: If authentication fails
        """
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        return credentials.token

    def _get_ws_uri(self) -> str:
        """Get the WebSocket URI for the configured region."""
        return self.WS_ENDPOINT_TEMPLATE.format(region=self.config.gcp_region)

    def send_message(
        self,
        session_id: str,
        user_message: str,
        timeout: float = 30.0,
        on_response: Optional[Callable[[str], None]] = None,
    ) -> str:
        """
        Send a message using bidirectional streaming.

        Args:
            session_id: Unique session identifier
            user_message: The user's message text
            timeout: Response timeout in seconds
            on_response: Optional callback for streaming responses

        Returns:
            str: The agent's response text

        Raises:
            Exception: If connection or communication fails
        """
        session_name = self.config.get_session_name(session_id)
        uri = self._get_ws_uri()

        # Reset state
        self._responses = []
        self._response_event.clear()
        self._connected = False
        self._error = None

        try:
            token = self._get_auth_token()
            headers = {"Authorization": f"Bearer {token}"}
        except Exception as e:
            logger.error(f"Failed to get authentication token: {e}")
            raise

        def on_open(ws):
            logger.debug("WebSocket connection opened")
            self._connected = True

            try:
                # Send config message
                config_message = ces_v1.BidiSessionClientMessage(
                    config=ces_v1.SessionConfig(session=session_name)
                )
                config_json = json_format.MessageToJson(
                    config_message._pb,
                    preserving_proto_field_name=False,
                    indent=0,
                ).replace("\n", "")
                logger.debug(f"Sending config: {config_json}")
                ws.send(config_json)

                # Send query message
                query_message = ces_v1.BidiSessionClientMessage(
                    realtime_input=ces_v1.SessionInput(text=user_message)
                )
                query_json = json_format.MessageToJson(
                    query_message._pb,
                    preserving_proto_field_name=False,
                    indent=0,
                ).replace("\n", "")
                logger.debug(f"Sending query: {query_json}")
                ws.send(query_json)

            except Exception as e:
                logger.error(f"Error during WebSocket open: {e}")
                self._error = str(e)
                ws.close()

        def on_message(ws, message):
            logger.debug(f"Received message: {message}")
            try:
                response_pb = ces_v1.BidiSessionServerMessage()._pb
                json_format.Parse(
                    message,
                    response_pb,
                    ignore_unknown_fields=True,
                )
                response = ces_v1.BidiSessionServerMessage(response_pb)
                logger.debug(f"Parsed response: {response}")

                # Extract text from response
                text = self._extract_bidi_response_text(response)
                if text:
                    self._responses.append(text)
                    if on_response:
                        on_response(text)

                # Check if this is the final response
                if self._is_final_response(response):
                    self._response_event.set()

            except Exception as e:
                logger.error(f"Failed to parse message: {e}")

        def on_error(ws, error):
            logger.error(f"WebSocket error: {error}")
            self._error = str(error)
            self._response_event.set()

        def on_close(ws, close_status_code, close_msg):
            logger.debug(
                f"WebSocket closed with code {close_status_code}: {close_msg}"
            )
            self._connected = False
            self._response_event.set()

        # Create and run WebSocket connection
        logger.debug(f"Connecting to WebSocket: {uri}")
        ws_app = websocket.WebSocketApp(
            uri,
            header=headers,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
        )

        self._ws = ws_app
        self._ws_thread = threading.Thread(target=ws_app.run_forever)
        self._ws_thread.daemon = True
        self._ws_thread.start()

        # Wait for response with timeout
        if not self._response_event.wait(timeout=timeout):
            logger.warning("Timeout waiting for response")
            ws_app.close()

        # Clean up
        if self._ws_thread.is_alive():
            ws_app.close()
            self._ws_thread.join(timeout=2.0)

        if self._error:
            raise Exception(f"WebSocket error: {self._error}")

        return "\n".join(self._responses) if self._responses else ""

    def _extract_bidi_response_text(
        self, response: ces_v1.BidiSessionServerMessage
    ) -> Optional[str]:
        """
        Extract text from a BidiSessionServerMessage.

        Args:
            response: The server message

        Returns:
            Optional[str]: Extracted text or None
        """
        texts = []

        # Check for text in various response fields
        if hasattr(response, "server_output") and response.server_output:
            output = response.server_output
            if hasattr(output, "text") and output.text:
                texts.append(output.text)

        if hasattr(response, "response") and response.response:
            resp = response.response
            if hasattr(resp, "content") and resp.content:
                for content in resp.content:
                    if hasattr(content, "text") and content.text:
                        texts.append(content.text)

        return "\n".join(texts) if texts else None

    def _is_final_response(self, response: ces_v1.BidiSessionServerMessage) -> bool:
        """
        Check if this is the final response in the stream.

        Args:
            response: The server message

        Returns:
            bool: True if this is the final response
        """
        # Check for turn_complete flag or similar indicators
        if hasattr(response, "turn_complete") and response.turn_complete:
            return True

        if hasattr(response, "server_output") and response.server_output:
            output = response.server_output
            if hasattr(output, "turn_complete") and output.turn_complete:
                return True

        return False


def create_client(config: Config) -> CESClient:
    """
    Create a CES client based on configuration.

    Args:
        config: Application configuration

    Returns:
        CESClient: Configured client instance
    """
    return CESClient(config)


def create_bidi_client(config: Config) -> BidiSessionClient:
    """
    Create a BidiSession client based on configuration.

    Args:
        config: Application configuration

    Returns:
        BidiSessionClient: Configured client instance
    """
    return BidiSessionClient(config)
