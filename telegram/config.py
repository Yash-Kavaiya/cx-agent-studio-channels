"""
Configuration management for Telegram CX Agent Studio Bot.

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
    """Configuration settings for the Telegram bot."""

    # Telegram settings
    telegram_bot_token: str

    # Google Cloud settings
    gcp_project_id: str
    gcp_region: str

    # CX Agent Studio settings
    ces_app_id: str
    ces_deployment_id: Optional[str]

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
    # Required settings
    telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not telegram_bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable is required")

    gcp_project_id = os.getenv("GCP_PROJECT_ID")
    if not gcp_project_id:
        raise ValueError("GCP_PROJECT_ID environment variable is required")

    gcp_region = os.getenv("GCP_REGION", "us")

    ces_app_id = os.getenv("CES_APP_ID")
    if not ces_app_id:
        raise ValueError("CES_APP_ID environment variable is required")

    # Optional settings
    ces_deployment_id = os.getenv("CES_DEPLOYMENT_ID")
    use_bidi_session = os.getenv("USE_BIDI_SESSION", "false").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    health_check_port = int(os.getenv("HEALTH_CHECK_PORT", "8080"))

    return Config(
        telegram_bot_token=telegram_bot_token,
        gcp_project_id=gcp_project_id,
        gcp_region=gcp_region,
        ces_app_id=ces_app_id,
        ces_deployment_id=ces_deployment_id,
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
