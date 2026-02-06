/**
 * CX Agent Studio (CES) API Client for Node.js.
 * Provides a wrapper for interacting with the CX Agent Studio API.
 */

const { SessionServiceClient } = require('@google-cloud/ces').v1;
const { GoogleAuth } = require('google-auth-library');
const WebSocket = require('ws');
const { getSessionName, logger } = require('./config');

/**
 * CES Client for synchronous runSession interactions.
 */
class CESClient {
  constructor(config) {
    this.config = config;
    this._sessionClient = null;
  }

  get sessionClient() {
    if (!this._sessionClient) {
      this._sessionClient = new SessionServiceClient();
    }
    return this._sessionClient;
  }

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

  _extractResponseText(response) {
    const texts = [];

    if (response.outputs && response.outputs.length > 0) {
      for (const output of response.outputs) {
        if (output.text) {
          texts.push(output.text);
        }
      }
    }

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

    logger.warn('No text found in response');
    return JSON.stringify(response);
  }

  async close() {
    if (this._sessionClient) {
      await this._sessionClient.close();
      this._sessionClient = null;
    }
  }
}

/**
 * BidiSession Client for bidirectional streaming.
 */
class BidiSessionClient {
  static WS_ENDPOINT_TEMPLATE =
    'wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{region}';

  constructor(config) {
    this.config = config;
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  async _getAuthToken() {
    return await this.auth.getAccessToken();
  }

  _getWsUri() {
    return BidiSessionClient.WS_ENDPOINT_TEMPLATE.replace(
      '{region}',
      this.config.gcp.region
    );
  }

  async sendMessage(sessionId, userMessage, timeout = 30000) {
    const sessionName = getSessionName(this.config, sessionId);
    const uri = this._getWsUri();

    return new Promise(async (resolve, reject) => {
      let responses = [];
      let timeoutId;
      let ws;

      try {
        const token = await this._getAuthToken();
        ws = new WebSocket(uri, { headers: { Authorization: `Bearer ${token}` } });

        timeoutId = setTimeout(() => {
          ws.close();
          resolve(responses.join('\n') || 'Request timed out');
        }, timeout);

        ws.on('open', () => {
          try {
            ws.send(JSON.stringify({ config: { session: sessionName } }));
            ws.send(JSON.stringify({ realtimeInput: { text: userMessage } }));
          } catch (error) {
            clearTimeout(timeoutId);
            ws.close();
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const response = JSON.parse(data.toString());
            const text = this._extractBidiResponseText(response);
            if (text) responses.push(text);
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
          clearTimeout(timeoutId);
          reject(error);
        });

        ws.on('close', () => {
          clearTimeout(timeoutId);
          resolve(responses.join('\n') || '');
        });
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  _extractBidiResponseText(response) {
    const texts = [];
    if (response.serverOutput?.text) texts.push(response.serverOutput.text);
    if (response.response?.content) {
      for (const content of response.response.content) {
        if (content.text) texts.push(content.text);
      }
    }
    return texts.length > 0 ? texts.join('\n') : null;
  }

  _isFinalResponse(response) {
    return response.turnComplete || response.serverOutput?.turnComplete;
  }
}

function createClient(config) {
  return new CESClient(config);
}

function createBidiClient(config) {
  return new BidiSessionClient(config);
}

module.exports = {
  CESClient,
  BidiSessionClient,
  createClient,
  createBidiClient,
};
