"""
CX Agent Studio (CES) API Client.

Provides a wrapper for interacting with the CX Agent Studio API
using REST endpoints (matching the official API documentation).
"""

import json
import logging
from typing import Optional, List, Dict, Any

import google.auth
import google.auth.transport.requests
import requests

from config import Config

logger = logging.getLogger(__name__)


class CESClient:
    """Client for CX Agent Studio API interactions using REST."""

    # API endpoint for runSession
    API_ENDPOINT_TEMPLATE = (
        "https://ces.googleapis.com/v1beta/projects/{project_id}/"
        "locations/{region}/apps/{app_id}/sessions/{session_id}:runSession"
    )

    def __init__(self, config: Config):
        """
        Initialize the CES client.

        Args:
            config: Application configuration
        """
        self.config = config
        self._credentials = None

    def _get_auth_token(self) -> str:
        """
        Get Google Cloud authentication token.

        Returns:
            str: OAuth2 access token

        Raises:
            Exception: If authentication fails
        """
        credentials, project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        return credentials.token

    def _get_endpoint_url(self, session_id: str) -> str:
        """
        Build the API endpoint URL for a session.

        Args:
            session_id: The session identifier

        Returns:
            str: Full API endpoint URL
        """
        return self.API_ENDPOINT_TEMPLATE.format(
            project_id=self.config.gcp_project_id,
            region=self.config.gcp_region,
            app_id=self.config.ces_app_id,
            session_id=session_id,
        )

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
        endpoint_url = self._get_endpoint_url(session_id)

        logger.debug(f"Running session: {session_name}")
        logger.debug(f"Endpoint URL: {endpoint_url}")

        # Build request payload matching the API spec
        payload: Dict[str, Any] = {
            "config": {
                "session": session_name,
            },
            "inputs": [
                {"text": user_message}
            ]
        }

        # Add deployment if configured
        if self.config.deployment_resource_name:
            payload["config"]["deployment"] = self.config.deployment_resource_name
            logger.debug(f"Using deployment: {self.config.deployment_resource_name}")

        try:
            # Get authentication token
            token = self._get_auth_token()

            # Make the API request
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }

            logger.debug(f"Request payload: {json.dumps(payload, indent=2)}")

            response = requests.post(
                endpoint_url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

            logger.debug(f"Response status: {response.status_code}")
            logger.debug(f"Response body: {response.text}")

            # Check for errors
            response.raise_for_status()

            # Parse response
            response_data = response.json()
            return self._extract_response_text(response_data)

        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error running session: {e}")
            logger.error(f"Response: {e.response.text if e.response else 'No response'}")
            raise
        except Exception as e:
            logger.error(f"Error running session: {e}")
            raise

    def _extract_response_text(self, response_data: Dict[str, Any]) -> str:
        """
        Extract text content from a runSession response.

        Args:
            response_data: The API response JSON

        Returns:
            str: Extracted text content
        """
        texts: List[str] = []

        # Check for outputs in the response
        outputs = response_data.get("outputs", [])
        for output in outputs:
            if "text" in output and output["text"]:
                texts.append(output["text"])

        if texts:
            return "\n".join(texts)

        # Fallback: return string representation if no text found
        logger.warning("No text found in response, returning raw response")
        return json.dumps(response_data, indent=2)


def create_client(config: Config) -> CESClient:
    """
    Create a CES client based on configuration.

    Args:
        config: Application configuration

    Returns:
        CESClient: Configured client instance
    """
    return CESClient(config)


def create_bidi_client(config: Config):
    """
    Create a BidiSession client (placeholder for future implementation).

    Args:
        config: Application configuration

    Returns:
        None: BidiSession not yet implemented in REST mode
    """
    logger.warning("BidiSession client not implemented for REST mode. Using runSession instead.")
    return None
