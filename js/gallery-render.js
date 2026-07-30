/* Renders gallery.html's photo slider from /api/gallery — a standalone,
   admin-editable site gallery (lookbook style, managed via the Manage
   Gallery modal in the admin panel), separate from the per-product photo
   galleries on product-detail.html. Photos stay fully admin-managed; this
   file only controls how they're displayed: a single-photo-at-a-time Slick
   carousel that slides left on Next and right on Prev (a real slide
   transition, fade: false) into the markup gallery.html/shop-additions.css
   already have ready (.gallery-slick, .gallery-slide-pic, .gallery-slick-
   arrow/-prev/-next, .gallery-slick-dots). Falls back to a friendly empty/
   error message if the fetch fails or no photos have been added yet. */
(function () {
  'use strict';

  const grid = document.getElementById('gallery-grid');
  if (!grid) return; // not on gallery.html

  function imageSrc(image) {
    if (!image) return '';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Builds one Slick slide (photo + expand-to-lightbox icon + optional
  // caption). Built with DOM APIs rather than innerHTML so an image URL or
  // admin-entered caption can never be interpreted as markup.
  function buildSlide(photo) {
    const item = document.createElement('div');
    item.className = 'gallery-slide-item';

    const src = imageSrc(photo.image);
    const caption = photo.caption || '';

    const link = document.createElement('a');
    link.className = 'gallery-slide-pic';
    link.href = src;
    if (caption) link.title = caption;

    const img = document.createElement('img');
    img.src = src;
    img.alt = caption || 'ZAZ Collection gallery photo';
    link.appendChild(img);

    const expand = document.createElement('span');
    expand.className = 'gallery-slide-expand';
    const icon = document.createElement('i');
    icon.className = 'fa fa-expand';
    icon.setAttribute('aria-hidden', 'true');
    expand.appendChild(icon);
    link.appendChild(expand);

    item.appendChild(link);

    if (caption) {
      const cap = document.createElement('p');
      cap.className = 'gallery-slide-caption stext-107 cl6 txt-center p-t-12';
      cap.textContent = caption;
      item.appendChild(cap);
    }

    return item;
  }

  function showMessage(text) {
    grid.innerHTML = `<div class="txt-center stext-107 cl6 p-tb-40">${escapeHtml(text)}</div>`;
  }

  async function render() {
    let photos;
    try {
      const res = await fetch('/api/gallery', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      photos = await res.json();
      if (!Array.isArray(photos)) throw new Error('bad payload');
    } catch {
      showMessage('Sorry, the gallery couldn\u2019t be loaded right now. Please try again shortly.');
      return;
    }

    if (!photos.length) {
      showMessage('No gallery photos yet — check back soon.');
      return;
    }

    if (window.jQuery && window.jQuery(grid).hasClass('slick-initialized')) {
      window.jQuery(grid).slick('unslick');
    }

    grid.innerHTML = '';
    photos.forEach((photo) => grid.appendChild(buildSlide(photo)));

    const multi = photos.length > 1;

    if (window.jQuery && window.jQuery.fn.slick) {
      // 3-up "coverflow" view: the current photo shows front and center,
      // with the previous/next photos peeking in on either side (blurred
      // and dimmed via CSS .slick-slide vs .slick-center) so it's clear
      // which photo is coming up in each direction.
      window.jQuery(grid).slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        centerMode: true,
        centerPadding: '0px',
        fade: false,
        infinite: multi,
        autoplay: false,

        arrows: multi,
        prevArrow:
          '<button type="button" class="gallery-slick-arrow gallery-slick-prev" aria-label="Previous photo"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
        nextArrow:
          '<button type="button" class="gallery-slick-arrow gallery-slick-next" aria-label="Next photo"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',

        dots: multi,
        dotsClass: 'gallery-slick-dots',
        customPaging: function () {
          return '<span></span>';
        },

        responsive: [
          {
            breakpoint: 767,
            settings: {
              slidesToShow: 1,
              centerMode: false,
            },
          },
        ],
      });
    }

    // Wire up the lightbox now that the real slides are in the DOM (the
    // theme's own MagnificPopup init in the page runs once on load, before
    // this fetch resolves, so we bind it ourselves here instead).
    if (window.jQuery && typeof window.jQuery.fn.magnificPopup === 'function') {
      window.jQuery(grid).magnificPopup({
        delegate: 'a.gallery-slide-pic',
        type: 'image',
        gallery: { enabled: true },
        mainClass: 'mfp-fade',
      });
    }
  }

  render();
})();
