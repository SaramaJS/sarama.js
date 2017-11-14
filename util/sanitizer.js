module.exports = function sanitizer(ast, depth) {
  depth = depth || 0;
  for (const p in ast) {
    if (!ast.hasOwnProperty(p)) continue;
    const value = ast[p];
    if (p === 'raw') {
      delete ast[p];
    }
    if (p === 'leadingComments') {
      delete ast[p];
    }
    if (p === 'innerComments') {
      delete ast[p];
    }
    if ((p === 'start' || p === 'end') && (!isNaN(value))) {
      delete ast[p];
      continue;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        sanitizer(value[i], depth + 1);
      }
      continue;
    }
    if (value && typeof value === 'object') {
      sanitizer(value, depth + 1);
    }
  }
  if (depth === 0) {
    return JSON.parse(JSON.stringify(ast));
  }
  return ast;
};