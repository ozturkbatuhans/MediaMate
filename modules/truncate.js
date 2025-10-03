function truncateDescription(description, maxLength = 100) {
  if (description && description.length > maxLength) {
    return description.substring(0, maxLength) + '...';
  }
  return description || '';
}

module.exports = { truncateDescription };