console.log("Script loaded");

function addQueryToFilter() {
  const queryInput = document.querySelector('input[name="query"]');
  const filterForm = document.getElementById('genreFilterForm');
  if (queryInput && filterForm) {
    const hiddenQuery = document.createElement('input');
    hiddenQuery.type = 'hidden';
    hiddenQuery.name = 'query';
    hiddenQuery.value = queryInput.value.trim();
    filterForm.appendChild(hiddenQuery);
  }
}