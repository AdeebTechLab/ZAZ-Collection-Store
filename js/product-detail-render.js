/* Makes product-detail.html show the actual product that was clicked
   (via a ?id= query param) instead of always showing the same static
   "Lightweight Jacket" demo content, and wires its "Add to cart" button
   to the real cart instead of just a cosmetic toast. */
(function () {
  'use strict';

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function imageSrc(image) {
    if (!image) return 'images/product-detail-01.jpg';
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

    document.querySelectorAll('.js-addcart-detail').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!window.ZazCart) return;
        const wrap = btn.closest('.flex-w');
        const qtyInput = wrap ? wrap.querySelector('.num-product') : null;
        const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
        window.ZazCart.add(product, qty);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
