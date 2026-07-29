/* Real wishlist, backed by localStorage so it persists per-browser —
   mirrors js/cart.js. Runs on every page: keeps the header heart badge
   (.js-wishlist-icon) in sync everywhere, and toggles the filled-heart
   state on every "Add to Wishlist" button (grid cards, Quick View modal,
   and the standalone product-detail page).

   Products here don't always come with a reliable numeric id in the DOM
   (the static fallback markup used when /api/products can't be reached —
   e.g. opening the file directly instead of via a server — has none), so
   items are keyed by a slug of their name instead. That's enough to tell
   two different products apart and to recognise "the same product" no
   matter which card/page it was wishlisted from. */
(function () {
  'use strict';

  const STORAGE_KEY = 'zaz_wishlist_v1';

  function readWishlist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeWishlist(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable (private browsing quota, etc.) — wishlist
      // just won't persist this session.
    }
  }

  function slugify(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  // Unlike js/cart.js — which stores the bare filename straight from the
  // product API (e.g. "embroidered-lawn-kurti.webp") — wishlist items are
  // built from extractFromCard()/extractFromDetail() below, which read the
  // *already-rendered* <img src> straight out of the DOM. That src is
  // already a full, resolved path (e.g. "images/embroidered-lawn-kurti.webp",
  // or a full https:// URL for an admin-uploaded photo), so re-prepending
  // "images/" here — like cart.js's version does — would double it up into
  // a broken "images/images/..." path. Only add the prefix for a bare
  // filename that doesn't have one yet.
  function imageSrc(image) {
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:') || image.startsWith('images/')) {
      return image;
    }
    return 'images/' + image;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const Wishlist = {
    getItems() {
      return readWishlist();
    },
    getCount() {
      return readWishlist().length;
    },
    has(key) {
      return readWishlist().some((i) => i.key === key);
    },
    add(item) {
      if (!item || !item.key) return;
      const items = readWishlist();
      if (!items.some((i) => i.key === item.key)) {
        items.push(item);
        writeWishlist(items);
      }
      renderHeaderWishlist();
      renderWishlistPage();
    },
    remove(key) {
      const items = readWishlist().filter((i) => i.key !== key);
      writeWishlist(items);
      renderHeaderWishlist();
      renderWishlistPage();
    },
    // Returns true if the item ended up wishlisted, false if it was removed.
    toggle(item) {
      if (!item || !item.key) return false;
      if (this.has(item.key)) {
        this.remove(item.key);
        return false;
      }
      this.add(item);
      return true;
    },
  };

  window.ZazWishlist = Wishlist;

  // --- Header heart badge, present on every page ---
  function renderHeaderWishlist() {
    const count = Wishlist.getCount();
    document.querySelectorAll('.js-wishlist-icon').forEach((el) => {
      el.setAttribute('data-notify', String(count));
    });
  }

  // --- Full wishlist page (wishlist.html) ---
  function renderWishlistPage() {
    const tbody = document.getElementById('wishlist-rows');
    if (!tbody) return; // not on the wishlist page

    const items = readWishlist();
    tbody.innerHTML = '';

    if (!items.length) {
      const tr = document.createElement('tr');
      tr.className = 'wishlist-empty-row';
      tr.innerHTML = '<td colspan="4" class="p-tb-30 stext-107 cl6">Your wishlist is empty. <a href="product.html" class="cl1 hov-cl1">Continue shopping →</a></td>';
      tbody.appendChild(tr);
      return;
    }

    items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.className = 'table_row';
      tr.dataset.key = item.key;
      tr.innerHTML = `
        <td class="column-1">
          <div class="how-itemcart1 pos-relative">
            <img src="${imageSrc(item.image)}" alt="IMG">
          </div>
        </td>
        <td class="column-2">${escapeHtml(item.name)}</td>
        <td class="column-3">${escapeHtml(item.price) || '&mdash;'}</td>
        <td class="column-5">
          <div class="flex-w flex-r-m">
            <div class="flex-c-m stext-101 cl2 size-118 bg8 bor13 hov-btn3 p-lr-15 trans-04 pointer js-wishlist-remove">
              Remove
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.js-wishlist-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = e.target.closest('tr').dataset.key;
        Wishlist.remove(key);
        renderWishlistPage();
      });
    });
  }

  // --- Grid / carousel product cards (.block2) ---
  function extractFromCard(anchor) {
    const card = anchor.closest('.block2');
    if (!card) return null;
    const nameEl = card.querySelector('.js-name-b2');
    const priceEl = card.querySelector('.block2-txt-child1 .stext-105');
    const imgEl = card.querySelector('.block2-pic img');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return null;
    return {
      key: slugify(name),
      name,
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.getAttribute('src') || '' : '',
    };
  }

  function syncButtonState(anchor, key) {
    anchor.classList.toggle('js-addedwish-b2', Wishlist.has(key));
  }

  // Every card for the same product (it can appear in more than one
  // carousel/grid on a page) should flip together, not just the one clicked.
  function syncAllCardsForKey(key) {
    document.querySelectorAll('.js-addwish-b2').forEach((anchor) => {
      const item = extractFromCard(anchor);
      if (item && item.key === key) syncButtonState(anchor, key);
    });
  }

  function markInitialCardStates() {
    document.querySelectorAll('.js-addwish-b2').forEach((anchor) => {
      const item = extractFromCard(anchor);
      if (item) syncButtonState(anchor, item.key);
    });
  }

  // --- Quick View modal + standalone product-detail page ---
  function extractFromDetail(anchor) {
    const scope = anchor.closest('.js-modal1') || document;
    const nameEl = scope.querySelector('.js-name-detail');
    const priceEl = scope.querySelector('.js-price-detail');
    const imgEl = scope.querySelector('.item-slick3 img, .item-slick2 img');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return null;
    return {
      key: slugify(name),
      name,
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.getAttribute('src') || '' : '',
    };
  }

  function syncDetailButtonState(anchor, key) {
    anchor.classList.toggle('is-added-wish', Wishlist.has(key));
  }

  function bindClicks() {
    document.addEventListener('click', (e) => {
      const gridAnchor = e.target.closest('.js-addwish-b2');
      if (gridAnchor) {
        e.preventDefault();
        const item = extractFromCard(gridAnchor);
        if (!item) return;
        Wishlist.toggle(item);
        syncAllCardsForKey(item.key);
        return;
      }

      const detailAnchor = e.target.closest('.js-addwish-detail');
      if (detailAnchor) {
        e.preventDefault();
        const item = extractFromDetail(detailAnchor);
        if (!item) return;
        Wishlist.toggle(item);
        syncDetailButtonState(detailAnchor, item.key);
        syncAllCardsForKey(item.key);
      }
    });
  }

  function init() {
    renderHeaderWishlist();
    renderWishlistPage();
    bindClicks();
    markInitialCardStates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-sync heart states whenever the grid re-renders (async product
  // fetch, or "Load More" appending fresh cards).
  document.addEventListener('zaz:products-rendered', markInitialCardStates);
})();
