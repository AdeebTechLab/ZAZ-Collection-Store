// Applies admin-edited category display names to this page's category
// filter buttons (data-filter=".women", ".men", etc.). The underlying
// data-filter values stay fixed — only the visible label text changes —
// so isotope filtering and each product's stored `category` keep working
// no matter what a manager renames the label to.
(function () {
  async function applyLabels() {
    const buttons = document.querySelectorAll('[data-filter]');
    if (!buttons.length) return;

    let labels;
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      labels = await res.json();
    } catch {
      // API unavailable (e.g. opened as a local file, or the site hasn't
      // been deployed with its backend) — leave the default labels already
      // baked into the page.
      return;
    }

    buttons.forEach((btn) => {
      const filter = btn.getAttribute('data-filter');
      if (!filter || filter === '*') return; // "All Products" tab, not a category
      const key = filter.replace(/^\./, '');
      if (labels[key]) btn.textContent = labels[key];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLabels);
  } else {
    applyLabels();
  }
})();
