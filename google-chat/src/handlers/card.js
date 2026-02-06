/**
 * Google Chat Card Action Handler.
 * Handles CARD_CLICKED events for interactive cards.
 */

const { logger } = require('../config');
const { getSessionId } = require('./message');

/**
 * Handle CARD_CLICKED event.
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Promise<Object>} Response object
 */
async function handleCardClicked(event, services) {
  const { cesClient, bidiClient, config } = services;

  const action = event.action;
  const space = event.space;
  const user = event.user;
  const message = event.message;

  logger.info(`Card action from ${user.displayName}: ${action.actionMethodName}`);

  // Extract action parameters
  const parameters = {};
  if (action.parameters) {
    for (const param of action.parameters) {
      parameters[param.key] = param.value;
    }
  }

  const isDM = space.type === 'DM';
  const spaceId = space.name.split('/')[1];
  const threadId = message?.thread?.name?.split('/').pop() || null;

  // Handle different actions
  switch (action.actionMethodName) {
    case 'handleButton':
    case 'submitAction':
      // Process button value as a message
      const buttonValue = parameters.value || parameters.action || '';

      if (!buttonValue) {
        return { text: 'Action received but no value provided.' };
      }

      const sessionId = getSessionId(
        isDM ? 'dm' : 'space',
        isDM ? user.name.split('/')[1] : spaceId,
        threadId
      );

      try {
        let responseText;
        if (config.bot.useBidiSession && bidiClient) {
          responseText = await bidiClient.sendMessage(sessionId, buttonValue);
        } else {
          responseText = await cesClient.runSession(sessionId, buttonValue);
        }

        return { text: responseText || 'Action processed.' };
      } catch (error) {
        logger.error('Error processing card action:', error);
        return { text: 'Sorry, I encountered an error processing your action.' };
      }

    case 'showHelp':
      return {
        actionResponse: {
          type: 'DIALOG',
          dialogAction: {
            dialog: {
              body: {
                sections: [
                  {
                    header: 'Help',
                    widgets: [
                      {
                        textParagraph: {
                          text: 'Available commands:\n• /ask - Ask a question\n• /reset - Reset conversation\n• /help - Show help',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

    case 'confirmReset':
      // Reset the session
      const { resetSession } = require('./message');
      resetSession(isDM ? 'dm' : 'space', isDM ? user.name : spaceId, threadId);
      return { text: 'Your conversation has been reset!' };

    case 'cancelAction':
      return { text: 'Action cancelled.' };

    default:
      logger.debug(`Unknown action: ${action.actionMethodName}`);
      return { text: 'Unknown action received.' };
  }
}

/**
 * Handle form submissions from dialogs.
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Promise<Object>} Response object
 */
async function handleFormSubmission(event, services) {
  const { cesClient, bidiClient, config } = services;

  const formInputs = event.common?.formInputs || {};
  const space = event.space;
  const user = event.user;

  logger.info(`Form submission from ${user.displayName}`);

  // Extract form values
  const formData = {};
  for (const [key, value] of Object.entries(formInputs)) {
    formData[key] = value.stringInputs?.value?.[0] || value;
  }

  // Process form data as needed
  const message = formData.question || formData.message || JSON.stringify(formData);

  const isDM = space.type === 'DM';
  const spaceId = space.name.split('/')[1];

  const sessionId = getSessionId(
    isDM ? 'dm' : 'space',
    isDM ? user.name.split('/')[1] : spaceId
  );

  try {
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, message);
    } else {
      responseText = await cesClient.runSession(sessionId, message);
    }

    return {
      actionResponse: {
        type: 'DIALOG',
        dialogAction: {
          actionStatus: {
            statusCode: 'OK',
            userFacingMessage: responseText || 'Form submitted successfully.',
          },
        },
      },
    };
  } catch (error) {
    logger.error('Error processing form submission:', error);
    return {
      actionResponse: {
        type: 'DIALOG',
        dialogAction: {
          actionStatus: {
            statusCode: 'INTERNAL',
            userFacingMessage: 'An error occurred processing your submission.',
          },
        },
      },
    };
  }
}

module.exports = {
  handleCardClicked,
  handleFormSubmission,
};
