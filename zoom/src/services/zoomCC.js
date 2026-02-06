/**
 * Zoom Contact Center Service.
 * Handles integration with Zoom Contact Center for agent assist and workflows.
 */

const axios = require('axios');
const { logger } = require('../config');

/**
 * Zoom Contact Center Service.
 */
class ZoomCCService {
  /**
   * Initialize the Contact Center service.
   * @param {Object} config - Application configuration
   * @param {ZoomAuth} auth - Zoom auth service
   */
  constructor(config, auth) {
    this.config = config;
    this.auth = auth;
    this.baseUrl = 'https://api.zoom.us/v2/contact_center';
  }

  /**
   * Get Contact Center variables.
   * @returns {Promise<Array>} List of variables
   */
  async getVariables() {
    const headers = await this.auth.getAuthHeaders();

    try {
      const response = await axios.get(`${this.baseUrl}/variables`, {
        headers,
      });

      return response.data.variables || [];
    } catch (error) {
      logger.error('Failed to get CC variables:', error.message);
      throw error;
    }
  }

  /**
   * Create a Contact Center variable.
   * @param {Object} variable - Variable definition
   * @returns {Promise<Object>} Created variable
   */
  async createVariable(variable) {
    const headers = await this.auth.getAuthHeaders();

    try {
      const response = await axios.post(`${this.baseUrl}/variables`, variable, {
        headers,
      });

      logger.info('Created CC variable:', variable.name);
      return response.data;
    } catch (error) {
      logger.error('Failed to create CC variable:', error.message);
      throw error;
    }
  }

  /**
   * Update a Contact Center variable.
   * @param {string} variableId - Variable ID
   * @param {Object} updates - Variable updates
   * @returns {Promise<Object>} Updated variable
   */
  async updateVariable(variableId, updates) {
    const headers = await this.auth.getAuthHeaders();

    try {
      const response = await axios.patch(
        `${this.baseUrl}/variables/${variableId}`,
        updates,
        { headers }
      );

      logger.info('Updated CC variable:', variableId);
      return response.data;
    } catch (error) {
      logger.error('Failed to update CC variable:', error.message);
      throw error;
    }
  }

  /**
   * Handle Contact Center webhook event.
   * @param {Object} payload - Webhook payload
   * @returns {Object} Processed event data
   */
  processWebhookEvent(payload) {
    const event = {
      type: payload.event || 'unknown',
      engagementId: null,
      customerId: null,
      agentId: null,
      message: null,
      channel: null,
      variables: {},
    };

    if (payload.payload) {
      const p = payload.payload;
      event.engagementId = p.engagement_id;
      event.customerId = p.customer_id;
      event.agentId = p.agent_id;
      event.message = p.message || p.text;
      event.channel = p.channel || 'voice';
      event.variables = p.variables || {};
    }

    return event;
  }

  /**
   * Format agent assist response.
   * @param {string} suggestion - AI suggestion for agent
   * @param {Object} options - Additional options
   * @returns {Object} Formatted agent assist response
   */
  formatAgentAssistResponse(suggestion, options = {}) {
    return {
      type: 'agent_assist',
      suggestion: suggestion,
      confidence: options.confidence || 0.9,
      sources: options.sources || [],
      actions: options.actions || [],
    };
  }

  /**
   * Create customer context from engagement.
   * @param {Object} engagement - Engagement data
   * @returns {Object} Customer context for CX Agent Studio
   */
  createCustomerContext(engagement) {
    return {
      customerId: engagement.customer_id,
      channel: engagement.channel,
      queue: engagement.queue_name,
      waitTime: engagement.wait_time,
      previousInteractions: engagement.previous_interactions || 0,
      variables: engagement.variables || {},
    };
  }

  /**
   * Update engagement with AI response.
   * @param {string} engagementId - Engagement ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Update result
   */
  async updateEngagement(engagementId, data) {
    const headers = await this.auth.getAuthHeaders();

    try {
      const response = await axios.patch(
        `${this.baseUrl}/engagements/${engagementId}`,
        data,
        { headers }
      );

      logger.info('Updated engagement:', engagementId);
      return response.data;
    } catch (error) {
      logger.error('Failed to update engagement:', error.message);
      throw error;
    }
  }
}

module.exports = ZoomCCService;
