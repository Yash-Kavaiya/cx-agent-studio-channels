/**
 * Zoom Virtual Agent Service.
 * Handles integration with Zoom Virtual Agent for AI-powered conversations.
 */

const axios = require('axios');
const { logger } = require('../config');

/**
 * Zoom Virtual Agent Service.
 */
class ZoomVAService {
  /**
   * Initialize the Virtual Agent service.
   * @param {Object} config - Application configuration
   * @param {ZoomAuth} auth - Zoom auth service
   */
  constructor(config, auth) {
    this.config = config;
    this.auth = auth;
    this.baseUrl = 'https://api.zoom.us/v2';
  }

  /**
   * Handle Virtual Agent webhook event.
   * @param {Object} payload - Webhook payload from Virtual Agent
   * @returns {Object} Processed event data
   */
  processWebhookEvent(payload) {
    const event = {
      type: payload.event || 'unknown',
      sessionId: payload.session_id || payload.payload?.session_id,
      userId: payload.user_id || payload.payload?.user_id,
      message: null,
      context: {},
    };

    // Extract message content
    if (payload.payload) {
      const p = payload.payload;
      event.message = p.user_message || p.message || p.text;
      event.context = {
        intent: p.intent,
        entities: p.entities,
        confidence: p.confidence,
        turnCount: p.turn_count,
      };
    }

    return event;
  }

  /**
   * Format response for Virtual Agent.
   * @param {string} responseText - Response text from CX Agent Studio
   * @param {Object} options - Additional response options
   * @returns {Object} Formatted VA response
   */
  formatResponse(responseText, options = {}) {
    const response = {
      response_type: 'text',
      text: responseText,
    };

    // Add suggested actions if provided
    if (options.suggestions && options.suggestions.length > 0) {
      response.response_type = 'quick_replies';
      response.quick_replies = options.suggestions.map((s) => ({
        content_type: 'text',
        title: typeof s === 'string' ? s : s.title,
        payload: typeof s === 'string' ? s : s.payload,
      }));
    }

    // Add handoff to agent if requested
    if (options.handoffToAgent) {
      response.handoff = {
        type: 'agent',
        reason: options.handoffReason || 'Customer requested agent',
        context: options.handoffContext || {},
      };
    }

    // Add custom data for context passing
    if (options.customData) {
      response.custom_data = options.customData;
    }

    return response;
  }

  /**
   * Create a handoff response to transfer to human agent.
   * @param {string} reason - Reason for handoff
   * @param {Object} context - Context to pass to agent
   * @returns {Object} Handoff response
   */
  createHandoffResponse(reason, context = {}) {
    return {
      response_type: 'handoff',
      handoff: {
        type: 'agent',
        reason: reason,
        context: context,
      },
    };
  }

  /**
   * Create an end conversation response.
   * @param {string} message - Final message
   * @returns {Object} End conversation response
   */
  createEndResponse(message) {
    return {
      response_type: 'end',
      text: message,
    };
  }

  /**
   * Extract session context from VA payload.
   * @param {Object} payload - VA webhook payload
   * @returns {Object} Extracted context
   */
  extractContext(payload) {
    const context = {
      sessionId: null,
      userId: null,
      channel: 'virtual_agent',
      variables: {},
      history: [],
    };

    if (payload.payload) {
      const p = payload.payload;
      context.sessionId = p.session_id;
      context.userId = p.user_id;
      context.variables = p.variables || {};
      context.history = p.conversation_history || [];
    }

    return context;
  }
}

module.exports = ZoomVAService;
