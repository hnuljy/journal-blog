const sanitizeHtml = require("sanitize-html");

function sanitizeText(value) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

function slugify(value) {
  const normalized = sanitizeText(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return normalized;
  }

  return `post-${Date.now()}`;
}

function makeExcerpt(value, maxLength = 180) {
  const plain = sanitizeText(value).replace(/\s+/g, " ");

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trim()}...`;
}

module.exports = {
  makeExcerpt,
  sanitizeText,
  slugify
};
