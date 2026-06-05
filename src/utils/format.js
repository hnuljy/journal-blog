function formatDate(value) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

module.exports = {
  formatDate
};
