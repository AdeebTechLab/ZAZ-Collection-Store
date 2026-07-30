/* Renders a small "From Our Gallery" preview inside the Quick View modal
   (.wrap-modal1, present on index.html / product.html / product-detail.html),
   just under the Add to Cart row. Pulls the same admin-managed photos as
   the full gallery.html page (via /api/gallery) and shows them in the same
   3-up "coverflow" style — center photo sharp and slightly bigger, the two
   side photos dimmed/blurred — with left/right arrows, plus a "View Full
   Gallery" link/button to gallery.html. Purely a preview: it never needs to
   save anything, so there's no auth here, just a GET + Slick carousel. */
(function () {
  'use strict';

  const grids = document.querySelectorAll('.js-modal-gallery-preview');
  if (!grids.length) return;

  function imageSrc(image) {
    if (!image) return '';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  // Built with DOM APIs rather than innerHTML so an admin-entered image URL
  // or caption can never be interpreted as markup.
  function buildSlide(photo) {
    const item = document.createElement('div');
    item.className = 'modal-gallery-preview-slide';

    const link = document.createElement('a');
    link.className = 'modal-gallery-preview-pic';
    link.href = 'gallery.html';

    const img = document.createElement('img');
    img.src = imageSrc(photo.image);
    img.alt = photo.caption || 'ZAZ Collection gallery photo';
    link.appendChild(img);

    item.appendChild(link);
    return item;
  }

  // Hides the whole block rather than showing an empty/broken slider when
  // there's nothing to preview yet (API down, or no photos added).
  function hide(grid) {
    const wrap = grid.closest('.modal-gallery-preview');
    if (wrap) wrap.style.display = 'none';
  }

  async function renderGrid(grid) {
    let photos;
    try {
      const res = await fetch('/api/gallery', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      photos = await res.json();
      if (!Array.isArray(photos)) throw new Error('bad payload');
    } catch {
      hide(grid);
      return;
    }

    if (!photos.length) {
      hide(grid);
      return;
    }

    // A single photo has nothing to coverflow between - keep it simple.
    const preview = photos.slice(0, 6);

    grid.innerHTML = '';
    preview.forEach((photo) => grid.appendChild(buildSlide(photo)));

    const multi = preview.length > 1;

    if (window.jQuery && window.jQuery.fn.slick) {
      window.jQuery(grid).slick({
        slidesToShow: Math.min(3, preview.length),
        slidesToScroll: 1,
        centerMode: multi,
        centerPadding: '0px',
        fade: false,
        infinite: multi,
        autoplay: false,

        arrows: multi,
        prevArrow:
          '<button type="button" class="modal-gallery-preview-arrow modal-gallery-preview-prev" aria-label="Previous photo"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
        nextArrow:
          '<button type="button" class="modal-gallery-preview-arrow modal-gallery-preview-next" aria-label="Next photo"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',

        dots: false,

        responsive: [
          {
            breakpoint: 480,
            settings: {
              slidesToShow: 1,
              centerMode: false,
            },
          },
        ],
      });
    }
  }

  grids.forEach((grid) => renderGrid(grid));
})();
