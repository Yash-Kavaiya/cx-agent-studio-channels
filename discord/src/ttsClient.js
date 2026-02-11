/**
 * Text-to-Speech Client for Discord Voice.
 * Converts text responses to audio for playback in voice channels.
 */

const textToSpeech = require('@google-cloud/text-to-speech');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { logger } = require('./config');

/**
 * TTS Client for converting text to speech audio.
 */
class TTSClient {
  /**
   * Initialize the TTS client.
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.client = new textToSpeech.TextToSpeechClient();
    this.tempDir = path.join(os.tmpdir(), 'discord-tts');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Convert text to speech audio.
   * @param {string} text - Text to convert to speech
   * @param {string} languageCode - Language code (e.g., 'en-US')
   * @param {string} voiceName - Voice name (e.g., 'en-US-Neural2-F')
   * @returns {Promise<Buffer>} Audio buffer in OGG format
   */
  async synthesize(text, languageCode = 'en-US', voiceName = 'en-US-Neural2-F') {
    logger.debug(`Synthesizing speech for text: ${text.substring(0, 50)}...`);

    // Truncate text if too long (Google TTS has a limit)
    const maxLength = 5000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
      logger.warn(`Text truncated to ${maxLength} characters for TTS`);
    }

    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'OGG_OPUS',
        speakingRate: this.config.voice?.ttsSpeed || 1.0,
      },
    };

    try {
      const [response] = await this.client.synthesizeSpeech(request);
      logger.debug('Speech synthesis completed');
      return response.audioContent;
    } catch (error) {
      logger.error('Error synthesizing speech:', error.message);
      throw error;
    }
  }

  /**
   * Convert text to speech and save to a temporary file.
   * @param {string} text - Text to convert
   * @param {string} sessionId - Session ID for unique filename
   * @returns {Promise<string>} Path to the temporary audio file
   */
  async synthesizeToFile(text, sessionId = 'default') {
    const audioContent = await this.synthesize(text);
    const filename = `tts-${sessionId}-${Date.now()}.ogg`;
    const filepath = path.join(this.tempDir, filename);

    fs.writeFileSync(filepath, audioContent);
    logger.debug(`Audio saved to: ${filepath}`);

    return filepath;
  }

  /**
   * Create a readable stream from audio content.
   * @param {Buffer} audioContent - Audio buffer
   * @returns {Readable} Readable stream
   */
  createStream(audioContent) {
    const stream = new Readable();
    stream.push(audioContent);
    stream.push(null);
    return stream;
  }

  /**
   * Clean up old temporary files.
   * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupTempFiles(maxAge = 3600000) {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        const stat = fs.statSync(filepath);

        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filepath);
          logger.debug(`Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp files:', error.message);
    }
  }

  /**
   * Close the client.
   */
  async close() {
    await this.client.close();
  }
}

/**
 * Create a TTS client.
 * @param {Object} config - Application configuration
 * @returns {TTSClient} TTS client instance
 */
function createTTSClient(config) {
  return new TTSClient(config);
}

module.exports = {
  TTSClient,
  createTTSClient,
};
