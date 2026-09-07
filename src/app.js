const express = require('express');
const healthRouter = require('./routes/health.routes');
const draftOrderRouter = require('./routes/draftOrder.routes');
const webhookRouter = require('./routes/webhook.routes');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(healthRouter);

  /**
   * Shopify HMAC verification requires the exact raw request body.
   * Mount webhooks with express.raw BEFORE express.json().
   */
  app.use(
    '/webhooks',
    express.raw({ type: 'application/json' }),
    webhookRouter
  );

  app.use(express.json());
  app.use('/api/shopify', draftOrderRouter);

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
