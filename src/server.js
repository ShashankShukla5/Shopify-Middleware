const { config, warnMissingEnv } = require('./config');
const { createApp } = require('./app');

warnMissingEnv();

const app = createApp();

app.listen(config.port, () => {
  console.log('Shopify Kefi Backend');
  console.log('--------------------');
  console.log(`Listening on http://localhost:${config.port}`);
  console.log('Health:            GET  /health');
  console.log('Orders webhook:    POST /webhooks/orders-create');
  console.log('Draft order:       POST /api/shopify/create-draft-order');
  console.log('Dashboard summary: GET  /api/practitioner/dashboard/summary');
  console.log('Dashboard orders:  GET  /api/practitioner/dashboard/orders');
  console.log('Dashboard export:  GET  /api/practitioner/dashboard/export');
  console.log(`API version:       ${config.shopify.apiVersion}`);
  console.log(`Shop domain:       ${config.shopify.shopDomain || '(not set)'}`);
  console.log('Access token / webhook secret: (never logged)');
});
