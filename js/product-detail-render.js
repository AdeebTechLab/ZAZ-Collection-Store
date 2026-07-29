/* Makes product-detail.html show the actual product that was clicked
   (via a ?id= query param) instead of always showing the same static
   "Lightweight Jacket" demo content, and wires its "Add to cart" button
   to the real cart instead of just a cosmetic toast. */
(function () {
  'use strict';

  function money(n) {
    return 'Rs. ' + Math.round(Number(n)).toLocaleString('en-US');
  }

  function imageSrc(image) {
    if (!image) return 'images/product-detail-01.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  // The theme's gallery is built for 3 photos (slick carousel + thumbnail
  // dots + prev/next arrows), but our product data only ever has one photo
  // per product. Slick renders its dots once, at page load, from whatever
  // demo images were in the static markup - just overwriting the <img> tags
  // afterwards doesn't update those dots, and cycling the arrows between 3
  // copies of the same photo looks like "the arrows don't work". So instead:
  // collapse the gallery down to the single real photo and hide the
  // dots/arrows, since there's nothing to actually navigate between.
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

  async function init() {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('id'));
    if (!id) return; // no id in the link — leave the theme's default demo content as-is

    let products;
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      products = await res.json();
    } catch {
      return; // API unavailable — leave default content rather than break the page
    }

    const product = products.find((p) => p.id === id);
    if (!product) return;

    document.title = product.name + ' — ZAZ Collection';

    document.querySelectorAll('.js-name-detail').forEach((el) => {
      el.textContent = product.name;
    });
    document.querySelectorAll('.js-price-detail').forEach((el) => {
      el.textContent = money(product.price);
    });

    const src = imageSrc(product.image);
    document.querySelectorAll('.wrap-slick3').forEach((wrap) => {
      setSingleGalleryImage(wrap, src);
    });

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    }

    // Rebuilds a Size/Color <select>'s <option> list from the product's own
    // admin-managed sizes/colors array. If the product has none defined for
    // that variant type, the whole field is hidden instead of showing an
    // empty/meaningless dropdown, and it's no longer required before adding
    // to cart. Mirrors the same helper in js/products-render.js since this
    // file has no shared module to import it from.
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

    // Both the main product section and the Quick View modal on this page
    // wrap their Size/Color selects in a ".p-t-33" block — populate each
    // one from this product's own admin-managed sizes/colors.
    document.querySelectorAll('.p-t-33').forEach((container) => {
      if (!container.querySelector('.js-variant-select')) return;
      populateVariantSelect(container, 'size', product.sizes);
      populateVariantSelect(container, 'color', product.colors);
    });

    // Reads the current Size/Color selection out of an Add to Cart button's
    // own container and validates both are actually picked — not left on
    // the "Choose an option" placeholder. A variant is only required if the
    // product actually has options for it (its select is visible). Shows/
    // hides the inline error message and highlights whichever select(s) are
    // still empty.
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

    const outOfStock = product.inStock === false;
    document.querySelectorAll('.js-addcart-detail').forEach((btn) => {
      btn.disabled = outOfStock;
      btn.classList.toggle('is-disabled', outOfStock);
      if (outOfStock) btn.textContent = 'Out of Stock';
    });

    document.querySelectorAll('.js-addcart-detail').forEach((btn) => {
      if (outOfStock) return; // leave disabled, no click handler needed
      // Each Add to Cart button lives inside its own ".p-t-33" block, which
      // also contains that same block's Size/Color selects and error
      // message — this is true both for the main product section and for
      // the page's (separate) Quick View modal, so this works for both.
      const container = btn.closest('.p-t-33') || btn.closest('.flex-w') || document;

      // Clear a select's own invalid state as soon as the person picks
      // something, rather than waiting for the next Add to Cart click.
      container.querySelectorAll('.js-variant-select').forEach((sel) => {
        const clear = () => {
          if (!sel.value) return;
          const wrap = sel.closest('.js-variant-wrap');
          if (wrap) wrap.classList.remove('is-invalid');
        };
        sel.addEventListener('change', clear);
        if (window.jQuery) window.jQuery(sel).on('change', clear);
      });

      btn.addEventListener('click', () => {
        if (!window.ZazCart) return;

        const variant = readAndValidateVariant(container);
        if (!variant) return; // error message is now visible; don't add to cart

        const wrap = btn.closest('.flex-w');
        const qtyInput = wrap ? wrap.querySelector('.num-product') : null;
        const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
        window.ZazCart.add(product, qty, variant);

        const original = btn.textContent;
        btn.textContent = 'Added ✓';
        setTimeout(() => { btn.textContent = original; }, 1200);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
