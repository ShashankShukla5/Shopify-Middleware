const express = require('express');
const { config } = require('../config');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'shopify-kefi-backend',
    apiVersion: config.shopify.apiVersion,
    shopDomainConfigured: Boolean(config.shopify.shopDomain),
  });
});

module.exports = router;
