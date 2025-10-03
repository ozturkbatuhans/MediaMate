function truncateTitle(title, maxLength = 58) {
  if (!title) return '';

  if (title.length <= maxLength) {
    return title;
  }

  return title.substring(0, maxLength).trim() + '...';
}

module.exports = { truncateTitle };