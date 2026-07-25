(function () {
  'use strict';

  let productsData = [];
  let nextId = 1;
  let activeCategoryFilter = '';

  const authGate = document.getElementById('auth-gate');
  const app = document.getElementById('app');
  const usernameLabel = document.getElementById('username-label');
  const container = document.getElementById('products-container');
  const categoryFilterSelect = document.getElementById('category-filter');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const banner = document.getElementById('banner');
  const productTemplate = document.getElementById('product-template');

  function showBanner(message, type) {
    banner.textContent = message;
    banner.className = 'banner ' + type;
    banner.classList.remove('hidden');
  }

  function hideBanner() {
    banner.classList.add('hidden');
  }

  function imageSrc(image) {
    if (!image) return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return '/images/' + image;
  }

  // --- Auth gate ---
  async function checkSession() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.authenticated) {
        window.location.href = '/admin/login.html';
        return;
      }
      usernameLabel.textContent = data.username || '';
      authGate.classList.add('hidden');
      app.classList.remove('hidden');
      await loadProducts();
    } catch (err) {
      authGate.textContent = 'Could not check your session. Please refresh.';
    }
  }

  // --- Load product data ---
  async function loadProducts() {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load products (status ' + res.status + ')');
      productsData = await res.json();
      computeNextId();
      renderAll();
    } catch (err) {
      showBanner('Could not load the products: ' + err.message, 'error');
    }
  }

  function computeNextId() {
    let max = 0;
    productsData.forEach((p) => {
      if (typeof p.id === 'number' && p.id > max) max = p.id;
    });
    nextId = max + 1;
  }

  // --- Rendering ---
  function renderAll() {
    container.innerHTML = '';
    productsData.forEach((product) => {
      if (activeCategoryFilter && product.category !== activeCategoryFilter) return;
      container.appendChild(renderProduct(product));
    });
  }

  categoryFilterSelect.addEventListener('change', () => {
    activeCategoryFilter = categoryFilterSelect.value;
    renderAll();
  });

  function renderProduct(product) {
    const node = productTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector('.product-photo-img');
    const photoInput = node.querySelector('.photo-input');
    const nameInput = node.querySelector('.p-name-input');
    const categoryInput = node.querySelector('.p-category-input');
    const priceInput = node.querySelector('.p-price-input');
    const stockInput = node.querySelector('.p-stock-input');
    const discountInput = node.querySelector('.p-discount-input');
    const discountRow = node.querySelector('.discount-row');
    const oldPriceInput = node.querySelector('.p-oldprice-input');
    const saleTagInput = node.querySelector('.p-saletag-input');
    const deleteBtn = node.querySelector('.delete-product-btn');

    img.src = imageSrc(product.image);
    img.alt = product.name || '';
    nameInput.value = product.name || '';
    categoryInput.value = product.category || 'women';
    priceInput.value = product.price != null ? product.price : '';
    stockInput.value = product.stock != null ? product.stock : 0;
    discountInput.checked = product.oldPrice != null;
    oldPriceInput.value = product.oldPrice != null ? product.oldPrice : '';
    saleTagInput.value = product.saleTag || '';
    discountRow.classList.toggle('hidden', !discountInput.checked);

    // Shows a live "Auto: X% Off" placeholder in the Badge Text field,
    // computed from Old Price vs Price, so a manager can see exactly what
    // badge will appear on the storefront without typing anything. Typing
    // a value into the field still overrides it with custom wording.
    function updateAutoBadgePlaceholder() {
      const oldP = parseFloat(oldPriceInput.value);
      const newP = parseFloat(priceInput.value);
      if (!Number.isNaN(oldP) && !Number.isNaN(newP) && oldP > newP && newP >= 0) {
        const pct = Math.round((1 - newP / oldP) * 100);
        saleTagInput.placeholder = `Auto: ${pct}% Off`;
      } else {
        saleTagInput.placeholder = 'e.g. 10% Off';
      }
    }
    updateAutoBadgePlaceholder();

    nameInput.addEventListener('input', () => { product.name = nameInput.value; });
    categoryInput.addEventListener('change', () => { product.category = categoryInput.value; });
    priceInput.addEventListener('input', () => {
      const v = parseFloat(priceInput.value);
      product.price = Number.isNaN(v) ? 0 : v;
      updateAutoBadgePlaceholder();
    });
    stockInput.addEventListener('input', () => {
      const v = parseInt(stockInput.value, 10);
      product.stock = Number.isNaN(v) ? 0 : v;
    });
    discountInput.addEventListener('change', () => {
      discountRow.classList.toggle('hidden', !discountInput.checked);
      if (discountInput.checked) {
        if (product.oldPrice == null) product.oldPrice = product.price || 0;
        oldPriceInput.value = product.oldPrice;
      } else {
        delete product.oldPrice;
        oldPriceInput.value = '';
        delete product.saleTag;
        saleTagInput.value = '';
      }
      updateAutoBadgePlaceholder();
    });
    oldPriceInput.addEventListener('input', () => {
      const v = parseFloat(oldPriceInput.value);
      product.oldPrice = Number.isNaN(v) ? 0 : v;
      updateAutoBadgePlaceholder();
    });
    // Left blank, the storefront falls back to an auto-computed "X% Off"
    // badge (see js/flash-sales-render.js) — this field just lets a manager
    // override that with custom wording (e.g. "Deal Of The Week", "BOGO").
    saleTagInput.addEventListener('input', () => {
      product.saleTag = saleTagInput.value.trim() || null;
    });

    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      // Open the crop tool so the manager can adjust the framing/width/height
      // before it's uploaded. Resolves to null if they cancel.
      const dataUrl = await openCropper(file);
      photoInput.value = ''; // allow re-selecting the same file later
      if (!dataUrl) return;
      try {
        img.style.opacity = '0.5';
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        product.image = data.url;
        img.src = data.url;
      } catch (err) {
        showBanner('Photo upload failed: ' + err.message, 'error');
      } finally {
        img.style.opacity = '1';
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${product.name || 'this product'}"?`)) return;
      const idx = productsData.indexOf(product);
      if (idx !== -1) productsData.splice(idx, 1);
      node.remove();
    });

    return node;
  }

  // Resizes/re-encodes an image client-side so uploads stay well under
  // Vercel's request body limit, before sending it to /api/upload.
  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not read the image'));
        image.onload = () => {
          let { width, height } = image;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height / width) * maxDimension);
              width = maxDimension;
            } else {
              width = Math.round((width / height) * maxDimension);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Photo cropper ---
  // A small dependency-free crop tool: shows the picked photo in a modal
  // with a draggable/resizable crop box (default 3:4, matching the product
  // card aspect ratio). The manager can drag the box, drag a corner to
  // resize, or type exact width/height in pixels. Resolves to a cropped +
  // compressed JPEG data URL, or null if the manager cancels.
  const cropModal = document.getElementById('crop-modal');
  const cropStage = document.getElementById('crop-stage');
  const cropImageEl = document.getElementById('crop-image');
  const cropBoxEl = document.getElementById('crop-box');
  const cropHandles = Array.from(cropBoxEl.querySelectorAll('.crop-handle'));
  const cropWidthInput = document.getElementById('crop-width-input');
  const cropHeightInput = document.getElementById('crop-height-input');
  const cropLockAspect = document.getElementById('crop-lock-aspect');
  const cropApplyBtn = document.getElementById('crop-apply-btn');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');
  const cropCloseX = document.getElementById('crop-close-x');

  const ASPECT_RATIO = 3 / 4; // width / height, matches .product-photo's aspect-ratio
  const MIN_BOX = 20; // minimum crop box size in *display* px
  const MAX_OUTPUT = 1000; // cap the longer output side, same limit the old compressor used

  let cropResolveFn = null;
  let cropView = null; // { scale, dispW, dispH }
  let cropBox = null; // { left, top, width, height } in display px
  let dragMode = null; // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  let dragStart = null; // { x, y, box }

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function openCropper(file) {
    return new Promise((resolve) => {
      cropResolveFn = resolve;
      const reader = new FileReader();
      reader.onerror = () => { cropResolveFn = null; resolve(null); };
      reader.onload = () => {
        cropImageEl.onload = () => {
          cropModal.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
          initCropStage();
        };
        cropImageEl.onerror = () => { cropResolveFn = null; resolve(null); };
        cropImageEl.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function initCropStage() {
    const stageWrap = cropStage.parentElement;
    const maxW = Math.max(stageWrap.clientWidth - 24, 200);
    const maxH = window.innerWidth <= 480 ? window.innerHeight * 0.42 : 420;
    const nw = cropImageEl.naturalWidth;
    const nh = cropImageEl.naturalHeight;

    let scale = Math.min(maxW / nw, maxH / nh);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    if (scale > 2) scale = 2; // don't blow up tiny images too much

    const dispW = Math.round(nw * scale);
    const dispH = Math.round(nh * scale);
    cropView = { scale, dispW, dispH };

    cropStage.style.width = dispW + 'px';
    cropStage.style.height = dispH + 'px';
    cropImageEl.style.width = dispW + 'px';
    cropImageEl.style.height = dispH + 'px';

    // Default crop box: as large as possible at the target ratio, centered.
    let boxH = dispH * 0.9;
    let boxW = boxH * ASPECT_RATIO;
    if (boxW > dispW * 0.9) {
      boxW = dispW * 0.9;
      boxH = boxW / ASPECT_RATIO;
    }
    cropBox = { left: (dispW - boxW) / 2, top: (dispH - boxH) / 2, width: boxW, height: boxH };
    cropLockAspect.checked = true;
    renderCropBox();
  }

  function renderCropBox() {
    cropBoxEl.style.left = cropBox.left + 'px';
    cropBoxEl.style.top = cropBox.top + 'px';
    cropBoxEl.style.width = cropBox.width + 'px';
    cropBoxEl.style.height = cropBox.height + 'px';
    cropWidthInput.value = Math.round(cropBox.width / cropView.scale);
    cropHeightInput.value = Math.round(cropBox.height / cropView.scale);
  }

  // Corner drag: keep the opposite corner fixed as an anchor and move the
  // dragged corner, clamped to the image bounds and (optionally) the ratio.
  const ANCHOR_OF = {
    nw: (b) => ({ x: b.left + b.width, y: b.top + b.height }),
    ne: (b) => ({ x: b.left, y: b.top + b.height }),
    sw: (b) => ({ x: b.left + b.width, y: b.top }),
    se: (b) => ({ x: b.left, y: b.top }),
  };
  const MOVING_OF = {
    nw: (b) => ({ x: b.left, y: b.top }),
    ne: (b) => ({ x: b.left + b.width, y: b.top }),
    sw: (b) => ({ x: b.left, y: b.top + b.height }),
    se: (b) => ({ x: b.left + b.width, y: b.top + b.height }),
  };

  function resizeFromCorner(corner, dx, dy) {
    const anchor = ANCHOR_OF[corner](dragStart.box);
    const moving0 = MOVING_OF[corner](dragStart.box);
    const lock = cropLockAspect.checked;

    let movingX = clamp(moving0.x + dx, 0, cropView.dispW);
    let movingY = clamp(moving0.y + dy, 0, cropView.dispH);

    const signX = movingX >= anchor.x ? 1 : -1;
    const signY = movingY >= anchor.y ? 1 : -1;
    const maxRawW = signX > 0 ? cropView.dispW - anchor.x : anchor.x;
    const maxRawH = signY > 0 ? cropView.dispH - anchor.y : anchor.y;

    let rawW = clamp(Math.abs(movingX - anchor.x), MIN_BOX, maxRawW);
    let rawH;
    if (lock) {
      rawH = rawW / ASPECT_RATIO;
      if (rawH > maxRawH) {
        rawH = maxRawH;
        rawW = rawH * ASPECT_RATIO;
      }
      if (rawW > maxRawW) { rawW = maxRawW; rawH = rawW / ASPECT_RATIO; }
    } else {
      rawH = clamp(Math.abs(movingY - anchor.y), MIN_BOX, maxRawH);
    }

    const finalX = anchor.x + signX * rawW;
    const finalY = anchor.y + signY * rawH;

    cropBox = {
      left: Math.min(anchor.x, finalX),
      top: Math.min(anchor.y, finalY),
      width: rawW,
      height: rawH,
    };
  }

  cropBoxEl.addEventListener('pointerdown', (e) => {
    if (e.target !== cropBoxEl) return; // let handles handle their own drags
    dragMode = 'move';
    dragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
    cropBoxEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  cropHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      dragMode = handle.dataset.corner;
      dragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    });
  });

  cropStage.addEventListener('pointermove', (e) => {
    if (!dragMode || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (dragMode === 'move') {
      const left = clamp(dragStart.box.left + dx, 0, cropView.dispW - dragStart.box.width);
      const top = clamp(dragStart.box.top + dy, 0, cropView.dispH - dragStart.box.height);
      cropBox = { ...dragStart.box, left, top };
    } else {
      resizeFromCorner(dragMode, dx, dy);
    }
    renderCropBox();
  });

  window.addEventListener('pointerup', () => { dragMode = null; dragStart = null; });

  // Typing exact width/height keeps the top-left corner anchored.
  cropWidthInput.addEventListener('input', () => {
    if (!cropView || !cropBox) return;
    let natW = parseInt(cropWidthInput.value, 10);
    if (Number.isNaN(natW)) return;
    let width = clamp(natW * cropView.scale, MIN_BOX, cropView.dispW - cropBox.left);
    let height = cropLockAspect.checked ? width / ASPECT_RATIO : cropBox.height;
    if (cropLockAspect.checked && height > cropView.dispH - cropBox.top) {
      height = cropView.dispH - cropBox.top;
      width = height * ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  cropHeightInput.addEventListener('input', () => {
    if (!cropView || !cropBox) return;
    let natH = parseInt(cropHeightInput.value, 10);
    if (Number.isNaN(natH)) return;
    let height = clamp(natH * cropView.scale, MIN_BOX, cropView.dispH - cropBox.top);
    let width = cropLockAspect.checked ? height * ASPECT_RATIO : cropBox.width;
    if (cropLockAspect.checked && width > cropView.dispW - cropBox.left) {
      width = cropView.dispW - cropBox.left;
      height = width / ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  cropLockAspect.addEventListener('change', () => {
    if (!cropLockAspect.checked || !cropView || !cropBox) return;
    // Snap the current box back to the target ratio, anchored top-left.
    let width = cropBox.width;
    let height = width / ASPECT_RATIO;
    if (cropBox.top + height > cropView.dispH) {
      height = cropView.dispH - cropBox.top;
      width = height * ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  function closeCropper() {
    cropModal.classList.add('hidden');
    document.body.style.overflow = '';
    cropImageEl.src = '';
    dragMode = null;
    dragStart = null;
  }

  function applyCrop() {
    if (!cropView || !cropBox) return;
    const sx = Math.round(cropBox.left / cropView.scale);
    const sy = Math.round(cropBox.top / cropView.scale);
    const sw = Math.round(cropBox.width / cropView.scale);
    const sh = Math.round(cropBox.height / cropView.scale);

    let outW = sw;
    let outH = sh;
    if (Math.max(outW, outH) > MAX_OUTPUT) {
      const s = MAX_OUTPUT / Math.max(outW, outH);
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropImageEl, sx, sy, sw, sh, 0, 0, outW, outH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const resolve = cropResolveFn;
    cropResolveFn = null;
    closeCropper();
    if (resolve) resolve(dataUrl);
  }

  function cancelCropper() {
    const resolve = cropResolveFn;
    cropResolveFn = null;
    closeCropper();
    if (resolve) resolve(null);
  }

  cropApplyBtn.addEventListener('click', applyCrop);
  cropCancelBtn.addEventListener('click', cancelCropper);
  cropCloseX.addEventListener('click', cancelCropper);
  cropModal.addEventListener('click', (e) => { if (e.target === cropModal) cancelCropper(); });

  // --- Add product ---
  document.getElementById('add-product-btn').addEventListener('click', () => {
    const newProduct = {
      id: nextId++,
      name: '',
      category: activeCategoryFilter || 'women',
      price: 0,
      oldPrice: null,
      saleTag: null,
      stock: 0,
      image: '',
    };
    productsData.push(newProduct);
    renderAll();
    const cards = container.querySelectorAll('.product-card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) {
      lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const nameField = lastCard.querySelector('.p-name-input');
      if (nameField) nameField.focus();
    }
  });

  // --- Save ---
  saveBtn.addEventListener('click', async () => {
    hideBanner();
    const validationError = validate();
    if (validationError) {
      showBanner(validationError, 'error');
      return;
    }
    saveBtn.disabled = true;
    saveStatus.textContent = 'Saving…';
    saveStatus.className = 'save-status';
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productsData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      saveStatus.textContent = 'Saved ✓';
      saveStatus.className = 'save-status ok';
      showBanner('Products saved. Changes are live on the site now.', 'success');
    } catch (err) {
      saveStatus.textContent = 'Save failed';
      saveStatus.className = 'save-status err';
      showBanner('Could not save: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      setTimeout(() => { saveStatus.textContent = ''; }, 4000);
    }
  });

  function validate() {
    const seenIds = new Set();
    for (const product of productsData) {
      if (!product.name || !product.name.trim()) {
        return 'Every product needs a name.';
      }
      if (!product.image) {
        return `"${product.name}" needs a photo.`;
      }
      if (product.price == null || Number.isNaN(product.price) || product.price < 0) {
        return `"${product.name}" needs a valid price.`;
      }
      if (product.stock == null || Number.isNaN(product.stock) || product.stock < 0) {
        return `"${product.name}" needs a valid stock quantity.`;
      }
      if (product.oldPrice != null) {
        if (Number.isNaN(product.oldPrice) || product.oldPrice < 0) {
          return `"${product.name}" needs a valid old price for its discount.`;
        }
        if (product.oldPrice <= product.price) {
          return `"${product.name}"'s old price must be higher than its current price for the discount to show.`;
        }
      }
      if (product.saleTag != null && typeof product.saleTag !== 'string') {
        return `"${product.name}" has an invalid badge text.`;
      }
      if (seenIds.has(product.id)) {
        return `Duplicate product id detected for "${product.name}". Please refresh and try again.`;
      }
      seenIds.add(product.id);
    }
    return null;
  }

  // --- Logout ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  checkSession();
})();
