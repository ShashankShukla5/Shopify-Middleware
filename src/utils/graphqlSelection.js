function extractUnsupportedFields(errors = []) {
  const fields = new Set();

  for (const error of errors) {
    const message = error.message || '';
    const fieldMatch =
      message.match(/Field ['`]([^'`]+)['`]/i) ||
      message.match(/Access denied for ([A-Za-z0-9_]+) field/i) ||
      message.match(/Cannot query field ['`]([^'`]+)['`]/i);

    if (fieldMatch) {
      fields.add(fieldMatch[1]);
    }

    if (Array.isArray(error.path) && error.path.length > 1) {
      fields.add(String(error.path[error.path.length - 1]));
    }
  }

  return [...fields];
}

function stripFieldFromSelection(selectionSet, fieldName) {
  const blockPattern = new RegExp(
    `(^|\\n)\\s*${fieldName}\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}`,
    'g'
  );
  let next = selectionSet.replace(blockPattern, '\n');

  const scalarPattern = new RegExp(
    `(^|\\n)\\s*${fieldName}(\\s*\\([^)]*\\))?\\s*(?!\\{)`,
    'g'
  );

  return next.replace(scalarPattern, '\n');
}

module.exports = {
  extractUnsupportedFields,
  stripFieldFromSelection,
};
