/**
 * CX Agent Studio (CES) API Client for Node.js.
 * Provides a wrapper for interacting with the CX Agent Studio API,
 * supporting both runSession and BidiRunSession methods.
 */

const { SessionServiceClient } = require('@google-cloud/ces').v1;
const { GoogleAuth } = require('google-auth-library');
const WebSocket = require('ws');
const { getSessionName, logger } = require('./config');

/**
 * CES Client for synchronous runSession interactions.
 */
class CESClient {
  /**
   * Initialize the CES client.
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this._sessionClient = null;
  }

  /**
   * Get or create a SessionServiceClient instance.
   * @returns {SessionServiceClient} Session service client
   */
  get sessionClient() {
    if (!this._sessionClient) {
      this._sessionClient = new SessionServiceClient();
    }
    return this._sessionClient;
  }

  /**
   * Send a message to the agent and get a response using runSession.
   * @param {string} sessionId - Unique session identifier
   * @param {string} userMessage - The user's message text
   * @param {number} timeout - Request timeout in milliseconds
   * @returns {Promise<string>} The agent's response text
   */
  async runSession(sessionId, userMessage, timeout = 30000) {
    const sessionName = getSessionName(this.config, sessionId);
    logger.debug(`Running session: ${sessionName}`);

    const request = {
      config: { session: sessionName },
      inputs: [{ text: userMessage }],
    };

    try {
      const [response] = await this.sessionClient.runSession(request, {
        timeout,
      });
      logger.debug('Session response received');

      return this._extractResponseText(response);
    } catch (error) {
      logger.error('Error running session:', error.message);
      throw error;
    }
  }

  /**
   * Extract text content from a RunSessionResponse.
   * @param {Object} response - The API response
   * @returns {string} Extracted text content
   */
  _extractResponseText(response) {
    const texts = [];

    // Check for outputs in the response
    if (response.outputs && response.outputs.length > 0) {
      for (const output of response.outputs) {
        if (output.text) {
          texts.push(output.text);
        }
      }
    }

    // Check for response content
    if (response.response && response.response.content) {
      for (const content of response.response.content) {
        if (content.text) {
          texts.push(content.text);
        }
      }
    }

    if (texts.length > 0) {
      return texts.join('\n');
    }

    // Fallback: return string representation if no text found
    logger.warn('No text found in response');
    return JSON.stringify(response);
  }

  /**
   * Close the client connection.
   */
  async close() {
    if (this._sessionClient) {
      await this._sessionClient.close();
      this._sessionClient = null;
    }
  }
}

/**
 * BidiSession Client for bidirectional streaming with CX Agent Studio.
 */
class BidiSessionClient {
  /**
   * WebSocket endpoint template for BidiRunSession.
   */
  static WS_ENDPOINT_TEMPLATE =
    'wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{region}';

  /**
   * Initialize the BidiSession client.
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  /**
   * Get Google Cloud authentication token.
   * @returns {Promise<string>} OAuth2 access token
   */
  async _getAuthToken() {
    const token = await this.auth.getAccessToken();
    return token;
  }

  /**
   * Get the WebSocket URI for the configured region.
   * @returns {string} WebSocket URI
   */
  _getWsUri() {
    return BidiSessionClient.WS_ENDPOINT_TEMPLATE.replace(
      '{region}',
      this.config.gcp.region
    );
  }

  /**
   * Send a message using bidirectional streaming.
   * @param {string} sessionId - Unique session identifier
   * @param {string} userMessage - The user's message text
   * @param {number} timeout - Response timeout in milliseconds
   * @returns {Promise<string>} The agent's response text
   */
  async sendMessage(sessionId, userMessage, timeout = 30000) {
    const sessionName = getSessionName(this.config, sessionId);
    const uri = this._getWsUri();

    return new Promise(async (resolve, reject) => {
      let responses = [];
      let timeoutId;
      let ws;

      try {
        const token = await this._getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };

        ws = new WebSocket(uri, { headers });

        // Set timeout
        timeoutId = setTimeout(() => {
          logger.warn('WebSocket timeout');
          ws.close();
          resolve(responses.join('\n') || 'Request timed out');
        }, timeout);

        ws.on('open', () => {
          logger.debug('WebSocket connection opened');

          try {
            // Send config message
            const configMessage = { config: { session: sessionName } };
            logger.debug('Sending config:', JSON.stringify(configMessage));
            ws.send(JSON.stringify(configMessage));

            // Send query message
            const queryMessage = { realtimeInput: { text: userMessage } };
            logger.debug('Sending query:', JSON.stringify(queryMessage));
            ws.send(JSON.stringify(queryMessage));
          } catch (error) {
            logger.error('Error during WebSocket open:', error);
            clearTimeout(timeoutId);
            ws.close();
            reject(error);
          }
        });

        ws.on('message', (data) => {
          logger.debug('Received message:', data.toString());

          try {
            const response = JSON.parse(data.toString());
            const text = this._extractBidiResponseText(response);

            if (text) {
              responses.push(text);
            }

            // Check if this is the final response
            if (this._isFinalResponse(response)) {
              clearTimeout(timeoutId);
              ws.close();
              resolve(responses.join('\n'));
            }
          } catch (error) {
            logger.error('Failed to parse message:', error);
          }
        });

        ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          clearTimeout(timeoutId);
          reject(error);
        });

        ws.on('close', (code, reason) => {
          logger.debug(`WebSocket closed with code ${code}: ${reason}`);
          clearTimeout(timeoutId);
          resolve(responses.join('\n') || '');
        });
      } catch (error) {
        logger.error('Failed to establish WebSocket connection:', error);
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Extract text from a BidiSessionServerMessage.
   * @param {Object} response - The server message
   * @returns {string|null} Extracted text or null
   */
  _extractBidiResponseText(response) {
    const texts = [];

    // Check for text in various response fields
    if (response.serverOutput && response.serverOutput.text) {
      texts.push(response.serverOutput.text);
    }

    if (response.response && response.response.content) {
      for (const content of response.response.content) {
        if (content.text) {
          texts.push(content.text);
        }
      }
    }

    return texts.length > 0 ? texts.join('\n') : null;
  }

  /**
   * Check if this is the final response in the stream.
   * @param {Object} response - The server message
   * @returns {boolean} True if this is the final response
   */
  _isFinalResponse(response) {
    if (response.turnComplete) {
      return true;
    }

    if (response.serverOutput && response.serverOutput.turnComplete) {
      return true;
    }

    return false;
  }
}

/**
 * Create a CES client based on configuration.
 * @param {Object} config - Application configuration
 * @returns {CESClient} Configured client instance
 */
function createClient(config) {
  return new CESClient(config);
}

/**
 * Create a BidiSession client based on configuration.
 * @param {Object} config - Application configuration
 * @returns {BidiSessionClient} Configured client instance
 */
function createBidiClient(config) {
  return new BidiSessionClient(config);
}

module.exports = {
  CESClient,
  BidiSessionClient,
  createClient,
  createBidiClient,
};
