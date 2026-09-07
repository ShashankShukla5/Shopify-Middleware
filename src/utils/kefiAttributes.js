const INTERNAL_PROPERTY_KEYS = new Set([
  '_builder_subproducts',
  '__KF',
  '__bundle_builder',
  '__bundle_builder_fields',
]);

function isInternalKefiPropertyKey(key) {
  const name = String(key);
  return (
    INTERNAL_PROPERTY_KEYS.has(name) ||
    name.startsWith('_') ||
    name.startsWith('__')
  );
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
 * Draft Order line attributes shown in Admin. Internal Kefi JSON stays on the
 * cart item for pricing, but is never copied onto the Draft Order.
 */
function buildReadableLineAttributes(cartItem) {
  return parseBundleBuilderFields(cartItem?.properties?.__bundle_builder_fields);
}

module.exports = {
  INTERNAL_PROPERTY_KEYS,
  isInternalKefiPropertyKey,
  parseBundleBuilderFields,
  buildReadableLineAttributes,
};
