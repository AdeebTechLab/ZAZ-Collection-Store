// Rebuilds each page's category filter tabs (".filter-tope-group") from the
// live, admin-editable category list at /api/categories, instead of just
// relabeling a fixed set of buttons. Categories can now be renamed, added,
// or deleted from the admin panel, so the storefront's filter tabs need to
// reflect whatever the current set is — not a hardcoded women/men/bag/
// shoes/watches list baked into each page's HTML.
(function () {
  async function fetchCategories() {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length) return data;
      return null;
    } catch {
      return null;
    }
  }

  function buildButton(filterValue, label, active) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stext-106 cl6 hov1 bor3 trans-04 m-r-32 m-tb-5' + (active ? ' how-active1' : '');
    btn.setAttribute('data-filter', filterValue);
    btn.textContent = label;
    return btn;
  }

  // Handles both the isotope filtering and the active-tab highlighting
  // itself (instead of leaning on main.js's binding), since these buttons
  // are rebuilt fresh here and main.js binds to whatever buttons existed at
  // page load — which, by the time this async fetch resolves, are gone.
  function wireGroup(group) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('button').forEach((b) => b.classList.remove('how-active1'));
      btn.classList.add('how-active1');
      const filterValue = btn.getAttribute('data-filter');
      if (window.jQuery && window.jQuery.fn.isotope) {
        window.jQuery('.isotope-grid').isotope({ filter: filterValue });
      }
    });
  }

  async function applyDynamicFilters() {
    const groups = document.querySelectorAll('.filter-tope-group');
    if (!groups.length) return;

    const labels = await fetchCategories();
    if (!labels) return; // API unavailable — leave the page's static fallback tabs as-is.

    groups.forEach((group) => {
      group.innerHTML = '';
      group.appendChild(buildButton('*', 'All Products', true));
      Object.keys(labels).forEach((key) => {
        group.appendChild(buildButton('.' + key, labels[key], false));
      });
      wireGroup(group);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDynamicFilters);
  } else {
    applyDynamicFilters();
  }
})();
