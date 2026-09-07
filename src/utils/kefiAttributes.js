const INTERNAL_PROPERTY_KEYS = new Set([
  '_builder_subproducts',
  '__KF',
  '__bundle_builder',
  '__bundle_builder_fields',
  '_practitioner_markup',
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
 * Draft Order line attributes shown in Admin.
 * Readable cart properties are kept; raw Kefi/internal JSON is not.
 */
function buildReadableLineAttributes(cartItem) {
  const attributes = [];
  const seen = new Set();
  const properties = cartItem?.properties || {};

  for (const field of parseBundleBuilderFields(properties.__bundle_builder_fields)) {
    attributes.push(field);
    seen.add(field.key.toLowerCase());
  }

  for (const [key, value] of Object.entries(properties)) {
    if (isInternalKefiPropertyKey(key)) {
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
  isInternalKefiPropertyKey,
  parseBundleBuilderFields,
  buildReadableLineAttributes,
};
