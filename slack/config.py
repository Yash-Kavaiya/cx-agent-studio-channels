"""
Configuration management for Slack CX Agent Studio Bot.

Loads configuration from environment variables with validation.
"""

import os
import logging
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


@dataclass
class Config:
    """Configuration settings for the Slack bot."""

    # Slack settings
    slack_bot_token: str
    slack_app_token: Optional[str]
    slack_signing_secret: str

    # Google Cloud settings
    gcp_project_id: str
    gcp_region: str

    # CX Agent Studio settings
    ces_app_id: str
    ces_deployment_id: Optional[str]

    # Bot behavior settings
    use_socket_mode: bool
    respond_to_mentions_only: bool

    # Optional settings
    use_bidi_session: bool
    log_level: str
    health_check_port: int

    @property
    def app_resource_name(self) -> str:
        """Get the full CX Agent Studio app resource name."""
        return f"projects/{self.gcp_project_id}/locations/{self.gcp_region}/apps/{self.ces_app_id}"

    @property
    def deployment_resource_name(self) -> Optional[str]:
        """Get the full deployment resource name if deployment ID is set."""
        if self.ces_deployment_id:
            return f"{self.app_resource_name}/deployments/{self.ces_deployment_id}"
        return None

    def get_session_name(self, session_id: str) -> str:
        """Generate a full session resource name."""
        return f"{self.app_resource_name}/sessions/{session_id}"


def load_config() -> Config:
    """
    Load and validate configuration from environment variables.

    Returns:
        Config: Validated configuration object

    Raises:
        ValueError: If required configuration is missing
    """
    # Slack settings (required)
    slack_bot_token = os.getenv("SLACK_BOT_TOKEN")
    if not slack_bot_token:
        raise ValueError("SLACK_BOT_TOKEN environment variable is required")

    slack_signing_secret = os.getenv("SLACK_SIGNING_SECRET")
    if not slack_signing_secret:
        raise ValueError("SLACK_SIGNING_SECRET environment variable is required")

    # Socket mode token (required for socket mode)
    use_socket_mode = os.getenv("USE_SOCKET_MODE", "true").lower() == "true"
    slack_app_token = os.getenv("SLACK_APP_TOKEN")

    if use_socket_mode and not slack_app_token:
        raise ValueError(
            "SLACK_APP_TOKEN environment variable is required for Socket Mode. "
            "Set USE_SOCKET_MODE=false to use Events API instead."
        )

    # Google Cloud settings (required)
    gcp_project_id = os.getenv("GCP_PROJECT_ID")
    if not gcp_project_id:
        raise ValueError("GCP_PROJECT_ID environment variable is required")

    gcp_region = os.getenv("GCP_REGION", "us")

    ces_app_id = os.getenv("CES_APP_ID")
    if not ces_app_id:
        raise ValueError("CES_APP_ID environment variable is required")

    # Optional settings
    ces_deployment_id = os.getenv("CES_DEPLOYMENT_ID")
    respond_to_mentions_only = os.getenv("RESPOND_TO_MENTIONS_ONLY", "false").lower() == "true"
    use_bidi_session = os.getenv("USE_BIDI_SESSION", "false").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    health_check_port = int(os.getenv("HEALTH_CHECK_PORT", "8080"))

    return Config(
        slack_bot_token=slack_bot_token,
        slack_app_token=slack_app_token,
        slack_signing_secret=slack_signing_secret,
        gcp_project_id=gcp_project_id,
        gcp_region=gcp_region,
        ces_app_id=ces_app_id,
        ces_deployment_id=ces_deployment_id,
        use_socket_mode=use_socket_mode,
        respond_to_mentions_only=respond_to_mentions_only,
        use_bidi_session=use_bidi_session,
        log_level=log_level,
        health_check_port=health_check_port,
    )


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """
    Configure logging for the application.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        Logger: Configured logger instance
    """
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=getattr(logging, log_level, logging.INFO),
    )
    return logging.getLogger(__name__)
