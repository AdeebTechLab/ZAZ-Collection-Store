/* Renders the product grid (.isotope-grid) on index.html / product.html from
   /api/products instead of hardcoded HTML, so the admin panel's edits show
   up on the live site without touching any page markup. Falls back to
   whatever static markup is already in the page if the fetch fails. */
(function () {
  'use strict';

  function imageSrc(image) {
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  function money(n) {
    return 'Rs. ' + Math.round(Number(n)).toLocaleString('en-US');
  }

  function buildCard(product) {
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-md-4 col-lg-3 p-b-35 isotope-item ' + (product.category || '');

    const outOfStock = product.inStock === false;
    const priceHtml = product.oldPrice != null
      ? `<span class="stext-105 cl3">${money(product.price)}</span> ` +
        `<span class="stext-105" style="color:#999;text-decoration:line-through;margin-left:6px;">${money(product.oldPrice)}</span>`
      : `<span class="stext-105 cl3">${money(product.price)}</span>`;

    col.innerHTML = `
      <div class="block2">
        <div class="block2-pic hov-img0">
          <img src="${imageSrc(product.image)}" alt="IMG-PRODUCT">
          ${outOfStock ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
          <a href="#" class="block2-btn flex-c-m stext-103 cl2 size-102 bg0 bor2 hov-btn1 p-lr-15 trans-04 js-show-modal1">
            Quick View
          </a>
        </div>

        <div class="block2-txt flex-w flex-t p-t-14">
          <div class="block2-txt-child1 flex-col-l ">
            <a href="product-detail.html?id=${product.id}" class="stext-104 cl4 hov-cl1 trans-04 js-name-b2 p-b-6">
              ${escapeHtml(product.name)}
            </a>
            ${priceHtml}
          </div>

          <div class="block2-txt-child2 flex-r p-t-3">
            <a href="#" class="btn-addwish-b2 dis-block pos-relative js-addwish-b2">
              <img class="icon-heart1 dis-block trans-04" src="images/icons/icon-heart-01.png" alt="ICON">
              <img class="icon-heart2 dis-block trans-04 ab-t-l" src="images/icons/icon-heart-02.png" alt="ICON">
            </a>
          </div>
        </div>
      </div>
    `;

    // "Add to Cart" now lives inside Quick View (and the full product page)
    // instead of sitting under every card, so wire the Quick View trigger to
    // open the shared modal pre-filled with this exact product's data.
    const quickViewLink = col.querySelector('.js-show-modal1');
    quickViewLink.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickView(product);
    });

    return col;
  }

  // --- Quick View modal (shared markup already in the page; we just
  // populate it per-product and show/hide it ourselves, since the theme's
  // own main.js only binds .js-show-modal1 clicks on whatever was in the
  // DOM at page load — not the cards we render here afterwards). ---
  let quickViewProduct = null;

  // The theme's Quick View gallery is built for 3 photos (slick carousel +
  // thumbnail dots + prev/next arrows), but our product data only ever has
  // one photo per product. Slick renders its dots once, at page load, from
  // whatever demo images were in the static markup - just overwriting the
  // <img> tags afterwards doesn't update those dots, and cycling the arrows
  // between 3 copies of the same photo looks like "the arrows don't work".
  // So instead: collapse the gallery down to the single real photo and hide
  // the dots/arrows, since there's nothing to actually navigate between.
  function setSingleGalleryImage(wrap, src) {
    if (!wrap) return;
    const slidesTrack = wrap.querySelector('.slick3');
    const slides = wrap.querySelectorAll('.item-slick3');
    if (slides.length > 1) {
      if (window.jQuery && slidesTrack && window.jQuery(slidesTrack).hasClass('slick-initialized')) {
        window.jQuery(slidesTrack).slick('unslick');
      }
      for (let i = 1; i < slides.length; i++) slides[i].remove();
      const dots = wrap.querySelector('.wrap-slick3-dots');
      const arrows = wrap.querySelector('.wrap-slick3-arrows');
      if (dots) dots.style.display = 'none';
      if (arrows) arrows.style.display = 'none';
      // .slick3 is normally 83.33% wide to leave room for the (now hidden)
      // dots column - reclaim that space so the single photo fills the row.
      if (slidesTrack) slidesTrack.style.width = '100%';
    }
    const slide = wrap.querySelector('.item-slick3');
    if (!slide) return;
    slide.setAttribute('data-thumb', src);
    const img = slide.querySelector('img');
    if (img) img.src = src;
    const lightboxLink = slide.querySelector('a[href]');
    if (lightboxLink) lightboxLink.setAttribute('href', src);
  }

  // Rebuilds a Size/Color <select>'s <option> list from the product's own
  // admin-managed sizes/colors array. If the product has none defined for
  // that variant type, the whole field (label + select) is hidden instead
  // of showing an empty/meaningless dropdown, and it's no longer required
  // before adding to cart.
  function populateVariantSelect(container, kind, values) {
    const select = container.querySelector(`.js-variant-select[data-variant="${kind}"]`);
    if (!select) return;
    const row = select.closest('.flex-w.flex-r-m') || select.closest('.js-variant-wrap');
    const list = Array.isArray(values) ? values.filter((v) => v && String(v).trim()) : [];

    if (!list.length) {
      if (row) row.style.display = 'none';
      select.innerHTML = '<option value="">Choose an option</option>';
      if (window.jQuery && window.jQuery(select).data('select2')) {
        window.jQuery(select).val('').trigger('change');
      }
      return;
    }

    if (row) row.style.display = '';
    select.innerHTML = '<option value="">Choose an option</option>' +
      list.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (window.jQuery && window.jQuery(select).data('select2')) {
      window.jQuery(select).val('').trigger('change');
    }
  }

  // Reads the current Size/Color selection out of a Quick View (or product
  // detail) container and validates both are actually picked — not left on
  // the "Choose an option" placeholder. A variant is only required if the
  // product actually has options for it (its select is visible). Shows/hides
  // the inline error message and highlights whichever select(s) are still
  // empty.
  function readAndValidateVariant(container) {
    const sizeSelect = container.querySelector('.js-variant-select[data-variant="size"]');
    const colorSelect = container.querySelector('.js-variant-select[data-variant="color"]');
    const errorBox = container.querySelector('.js-variant-error');

    function isRequired(sel) {
      if (!sel) return false;
      const row = sel.closest('.flex-w.flex-r-m') || sel.closest('.js-variant-wrap');
      return !row || row.style.display !== 'none';
    }

    const sizeNeeded = isRequired(sizeSelect);
    const colorNeeded = isRequired(colorSelect);
    const size = sizeSelect ? sizeSelect.value : '';
    const color = colorSelect ? colorSelect.value : '';

    [sizeSelect, colorSelect].forEach((sel) => {
      if (!sel) return;
      const wrap = sel.closest('.js-variant-wrap');
      if (wrap) wrap.classList.remove('is-invalid');
    });

    if ((sizeNeeded && !size) || (colorNeeded && !color)) {
      if (sizeNeeded && !size) {
        const wrap = sizeSelect.closest('.js-variant-wrap');
        if (wrap) wrap.classList.add('is-invalid');
      }
      if (colorNeeded && !color) {
        const wrap = colorSelect.closest('.js-variant-wrap');
        if (wrap) wrap.classList.add('is-invalid');
      }
      if (errorBox) errorBox.style.display = 'block';
      return null;
    }

    if (errorBox) errorBox.style.display = 'none';
    return { size, color };
  }

  function getQuickViewModal() {
    return document.querySelector('.js-modal1');
  }

  // Resets the Size/Color <select>s back to "Choose an option" and hides
  // any leftover validation message from a previous product. Select2 draws
  // its own fake dropdown over the real <select>, so setting .value alone
  // doesn't update what the person sees — it has to go through jQuery/
  // select2's API (when available) to refresh that display too.
  function resetVariantSelects(modal) {
    const selects = modal.querySelectorAll('.js-variant-select');
    selects.forEach((sel) => {
      sel.value = '';
      if (window.jQuery) {
        const $sel = window.jQuery(sel);
        if ($sel.data('select2')) {
          $sel.val('').trigger('change');
        }
      }
      const wrap = sel.closest('.js-variant-wrap');
      if (wrap) wrap.classList.remove('is-invalid');
    });
    const errorBox = modal.querySelector('.js-variant-error');
    if (errorBox) errorBox.style.display = 'none';
  }

  function openQuickView(product) {
    const modal = getQuickViewModal();
    if (!modal) return;
    quickViewProduct = product;

    const nameEl = modal.querySelector('.js-name-detail');
    const priceEl = modal.querySelector('.js-price-detail');
    const qtyInput = modal.querySelector('.num-product');
    const addBtn = modal.querySelector('.js-addcart-detail');

    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = money(product.price);
    if (qtyInput) qtyInput.value = 1;
    resetVariantSelects(modal);
    populateVariantSelect(modal, 'size', product.sizes);
    populateVariantSelect(modal, 'color', product.colors);

    const src = imageSrc(product.image);
    setSingleGalleryImage(modal.querySelector('.wrap-slick3'), src);

    const outOfStock = product.inStock === false;
    if (addBtn) {
      addBtn.disabled = outOfStock;
      addBtn.classList.toggle('is-disabled', outOfStock);
      addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to cart';
    }

    modal.classList.add('show-modal1');
  }

  // Exposed so other renderers on the same page (e.g. the Flash Sales
  // carousel) can open the same shared Quick View modal for their own
  // product cards, instead of duplicating the modal-population logic.
  window.ZazQuickView = { open: openQuickView };

  // Add-to-cart button inside Quick View is wired once; it always acts on
  // whichever product is currently loaded into the modal.
  function bindQuickViewAddToCart() {
    const modal = getQuickViewModal();
    if (!modal) return;
    const addBtn = modal.querySelector('.js-addcart-detail');
    const qtyInput = modal.querySelector('.num-product');
    if (!addBtn) return;

    // Clear a select's own invalid state as soon as the person picks
    // something, rather than waiting for the next Add to Cart click.
    modal.querySelectorAll('.js-variant-select').forEach((sel) => {
      const clear = () => {
        if (!sel.value) return;
        const wrap = sel.closest('.js-variant-wrap');
        if (wrap) wrap.classList.remove('is-invalid');
      };
      sel.addEventListener('change', clear);
      if (window.jQuery) window.jQuery(sel).on('change', clear);
    });

    addBtn.addEventListener('click', () => {
      if (!quickViewProduct || !window.ZazCart) return;
      if (quickViewProduct.inStock === false) return;

      const variant = readAndValidateVariant(modal);
      if (!variant) return; // error message is now visible; don't add or close

      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      window.ZazCart.add(quickViewProduct, qty, variant);
      const original = addBtn.textContent;
      addBtn.textContent = 'Added ✓';
      setTimeout(() => {
        if (!addBtn.disabled) addBtn.textContent = original;
      }, 1200);
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function initIsotope() {
    if (typeof jQuery === 'undefined' || !jQuery.fn.isotope) return;
    jQuery('.isotope-grid').each(function () {
      const $grid = jQuery(this);
      if ($grid.data('isotope')) {
        $grid.isotope('reloadItems').isotope('layout');
      } else {
        $grid.isotope({
          itemSelector: '.isotope-item',
          layoutMode: 'fitRows',
          percentPosition: true,
          masonry: { columnWidth: '.isotope-item' },
        });
      }
    });
  }

  // Isotope measures each item's height to lay out the grid. If we call it
  // before the freshly-injected <img> elements have actually finished
  // loading, it measures them at ~0px and stacks/overlaps everything. So we
  // wait for every image in the grid to load (or fail) first.
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  }

  async function renderGrids() {
    const grids = document.querySelectorAll('.isotope-grid[data-dynamic-products]');
    if (!grids.length) return;

    let products;
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      products = await res.json();
    } catch {
      // Leave whatever static fallback markup is already in the page.
      return;
    }

    for (const grid of grids) {
      let list = grid.hasAttribute('data-sale-only')
        ? products.filter((p) => p.oldPrice != null && Number(p.oldPrice) > Number(p.price))
        : products;

      const limit = grid.getAttribute('data-limit');
      if (limit) list = list.slice(0, Number(limit));

      grid.innerHTML = '';

      if (!list.length && grid.hasAttribute('data-sale-only')) {
        grid.innerHTML = '<div class="col-md-12 txt-center stext-107 cl6 p-tb-40">' +
          'No items on sale right now — check back soon!</div>';
        continue;
      }

      list.forEach((product) => grid.appendChild(buildCard(product)));
      await waitForImages(grid);
    }

    initIsotope();
    document.dispatchEvent(new CustomEvent('zaz:products-rendered'));
  }

  function init() {
    bindQuickViewAddToCart();
    renderGrids();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
