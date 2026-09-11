const express = require('express');
const cors = require("cors");
const healthRouter = require('./routes/health.routes');
const draftOrderRouter = require('./routes/draftOrder.routes');
const webhookRouter = require('./routes/webhook.routes');
const practitionerDashboardRouter = require('./routes/practitionerDashboard.routes');
const { errorHandler } = require('./middleware/errorHandler');



const DASHBOARD_ORIGINS = [
  'https://dispensaryandco.com.au',
  'https://www.dispensaryandco.com.au',
];

function createApp() {
  const app = express();

  // Browser calls from the Shopify storefront hit this API via ngrok.
  // Custom headers (X-Shopify-Customer-Id, ngrok-skip-browser-warning) trigger
  // a CORS preflight — those headers must be allowlisted or the browser blocks.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || DASHBOARD_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Shopify-Customer-Id',
        'X-Shopify-Customer-Signature',
        'ngrok-skip-browser-warning',
      ],
      exposedHeaders: ['Content-Disposition'],
      credentials: true,
      optionsSuccessStatus: 204,
    })
  );

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
  app.use('/api/practitioner/dashboard', practitionerDashboardRouter);

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
