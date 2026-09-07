const { config, assertShopifyAdminConfigured } = require('../config');

async function shopifyGraphQL(query, variables = {}, options = {}) {
  const { throwOnErrors = true } = options;
  assertShopifyAdminConfigured();

  const response = await fetch(config.shopify.graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Access-Token': config.shopify.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Shopify GraphQL returned non-JSON (HTTP ${response.status}): ${text.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    const safe = {
      status: response.status,
      statusText: response.statusText,
      errors: json.errors || json,
    };
    throw new Error(`Shopify GraphQL HTTP error: ${JSON.stringify(safe)}`);
  }

  if (throwOnErrors && json.errors?.length) {
    console.error('Shopify GraphQL errors:', json.errors);
    throw new Error(json.errors[0]?.message || 'Shopify GraphQL request failed');
  }

  return json;
}

async function shopifyGraphQLData(query, variables = {}) {
  const json = await shopifyGraphQL(query, variables, { throwOnErrors: true });
  return json.data;
}

module.exports = {
  shopifyGraphQL,
  shopifyGraphQLData,
};
