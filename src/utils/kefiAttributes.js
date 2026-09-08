const INTERNAL_PROPERTY_KEYS = new Set([
  '_builder_subproducts',
  '__KF',
  '__bundle_builder',
  '__bundle_builder_fields',
  '_practitioner_markup',
]);

/** Labels that must never appear on client-facing checkout/invoice properties. */
const CLIENT_HIDDEN_PROPERTY_LABELS = new Set([
  'practitioner markup',
  'original unit price',
  'original price',
  'wholesale price',
  'wholesale unit price',
  'base unit price',
  'base price',
  'base cart total',
  'final customer price',
  'final customer total',
  'profit',
  'commission',
  'price source',
  'practitioner customer id',
  'practitioner id',
  'practitioner email',
  'shopify catalog unit price',
  'kefi cart token',
]);

function isInternalKefiPropertyKey(key) {
  const name = String(key);
  return (
    INTERNAL_PROPERTY_KEYS.has(name) ||
    name.startsWith('_') ||
    name.startsWith('__')
  );
}

function isClientHiddenPropertyLabel(key) {
  return CLIENT_HIDDEN_PROPERTY_LABELS.has(String(key).trim().toLowerCase());
}

function parseBundleBuilderFields(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((field) => {
        const key = String(field?.label || '').trim();
        const value = field?.value == null ? '' : String(field.value).trim();
        return { key, value };
      })
      .filter((field) => field.key && field.value);
  } catch {
    return [];
  }
}

/**
 * Customer-visible Draft Order line properties.
 * Keep only Kefi/fulfillment fields (e.g. client name, instructions).
 * Pricing/commission data is stored in PostgreSQL, not Shopify properties.
 */
function buildReadableLineAttributes(cartItem) {
  const attributes = [];
  const seen = new Set();
  const properties = cartItem?.properties || {};

  for (const field of parseBundleBuilderFields(properties.__bundle_builder_fields)) {
    if (isClientHiddenPropertyLabel(field.key)) {
      continue;
    }

    attributes.push(field);
    seen.add(field.key.toLowerCase());
  }

  for (const [key, value] of Object.entries(properties)) {
    if (isInternalKefiPropertyKey(key) || isClientHiddenPropertyLabel(key)) {
      continue;
    }

    if (value === null || value === undefined || value === '') {
      continue;
    }

    const label = String(key).trim();
    if (!label || seen.has(label.toLowerCase())) {
      continue;
    }

    attributes.push({
      key: label,
      value: String(value),
    });
    seen.add(label.toLowerCase());
  }

  return attributes;
}

module.exports = {
  INTERNAL_PROPERTY_KEYS,
  CLIENT_HIDDEN_PROPERTY_LABELS,
  isInternalKefiPropertyKey,
  isClientHiddenPropertyLabel,
  parseBundleBuilderFields,
  buildReadableLineAttributes,
};
