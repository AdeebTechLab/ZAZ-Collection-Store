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

    const outOfStock = Number(product.stock) <= 0;
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

  function getQuickViewModal() {
    return document.querySelector('.js-modal1');
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

    const src = imageSrc(product.image);
    setSingleGalleryImage(modal.querySelector('.wrap-slick3'), src);

    const outOfStock = Number(product.stock) <= 0;
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

    addBtn.addEventListener('click', () => {
      if (!quickViewProduct || !window.ZazCart) return;
      if (Number(quickViewProduct.stock) <= 0) return;
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      window.ZazCart.add(quickViewProduct, qty);
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
