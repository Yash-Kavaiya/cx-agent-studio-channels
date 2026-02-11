/**
 * Speech-to-Text Client for Discord Voice.
 * Transcribes audio from Discord voice channels.
 */

const speech = require('@google-cloud/speech');
const { logger } = require('./config');

/**
 * STT Client for converting speech to text.
 */
class STTClient {
  /**
   * Initialize the STT client.
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.client = new speech.SpeechClient();
    this.languageCode = config.voice?.speechLanguage || 'en-US';
  }

  /**
   * Transcribe audio buffer to text.
   * @param {Buffer} audioBuffer - Audio buffer (PCM 16-bit, 48kHz, stereo)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribe(audioBuffer) {
    logger.debug(`Transcribing audio buffer of ${audioBuffer.length} bytes`);

    // Convert stereo to mono by averaging channels
    const monoBuffer = this._stereoToMono(audioBuffer);

    // Downsample from 48kHz to 16kHz for better recognition
    const downsampledBuffer = this._downsample(monoBuffer, 48000, 16000);

    const audio = {
      content: downsampledBuffer.toString('base64'),
    };

    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: this.languageCode,
      model: 'latest_short',
      enableAutomaticPunctuation: true,
    };

    const request = {
      audio,
      config,
    };

    try {
      const [response] = await this.client.recognize(request);
      const transcription = response.results
        .map((result) => result.alternatives[0]?.transcript || '')
        .join(' ')
        .trim();

      logger.debug(`Transcription result: "${transcription}"`);
      return transcription;
    } catch (error) {
      logger.error('Error transcribing audio:', error.message);
      throw error;
    }
  }

  /**
   * Convert stereo PCM to mono by averaging channels.
   * @param {Buffer} stereoBuffer - Stereo PCM buffer (16-bit)
   * @returns {Buffer} Mono PCM buffer
   */
  _stereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4; // 2 bytes per sample * 2 channels
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
      const left = stereoBuffer.readInt16LE(i * 4);
      const right = stereoBuffer.readInt16LE(i * 4 + 2);
      const mono = Math.round((left + right) / 2);
      monoBuffer.writeInt16LE(mono, i * 2);
    }

    return monoBuffer;
  }

  /**
   * Downsample audio buffer.
   * @param {Buffer} buffer - Input PCM buffer (16-bit)
   * @param {number} fromRate - Source sample rate
   * @param {number} toRate - Target sample rate
   * @returns {Buffer} Downsampled buffer
   */
  _downsample(buffer, fromRate, toRate) {
    if (fromRate === toRate) {
      return buffer;
    }

    const ratio = fromRate / toRate;
    const inputSamples = buffer.length / 2;
    const outputSamples = Math.floor(inputSamples / ratio);
    const outputBuffer = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
      const srcIndex = Math.floor(i * ratio);
      const sample = buffer.readInt16LE(srcIndex * 2);
      outputBuffer.writeInt16LE(sample, i * 2);
    }

    return outputBuffer;
  }

  /**
   * Close the client.
   */
  async close() {
    await this.client.close();
  }
}

/**
 * Create an STT client.
 * @param {Object} config - Application configuration
 * @returns {STTClient} STT client instance
 */
function createSTTClient(config) {
  return new STTClient(config);
}

module.exports = {
  STTClient,
  createSTTClient,
};
