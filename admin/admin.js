(function () {
  'use strict';

  let productsData = [];
  let nextId = 1;

  // Categories used to be a fixed set of 5 keys. They're now fully dynamic —
  // an admin can rename, add, or delete them via the Manage Categories modal
  // — so instead of a hardcoded list we track whatever keys are currently
  // loaded, in display order. categoryLabels below is just the built-in
  // fallback used until /api/categories responds.
  let categoryLabels = { women: 'Summer Wear', men: 'Winter Wear', bag: 'Ethnic Wear', shoes: 'Casual Wear', watches: 'Party Wear' };
  let categoryOrder = Object.keys(categoryLabels);

  const authGate = document.getElementById('auth-gate');
  const app = document.getElementById('app');
  const usernameLabel = document.getElementById('username-label');
  const container = document.getElementById('products-container');
  const categorySectionTemplate = document.getElementById('category-section-template');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const banner = document.getElementById('banner');
  const productTemplate = document.getElementById('product-template');
  const editCategoriesBtn = document.getElementById('edit-categories-btn');
  const categoriesModal = document.getElementById('categories-modal');
  const categoriesFieldsContainer = document.getElementById('categories-fields');
  const categoriesAddBtn = document.getElementById('categories-add-btn');
  const categoriesCloseX = document.getElementById('categories-close-x');
  const categoriesCancelBtn = document.getElementById('categories-cancel-btn');
  const categoriesSaveBtn = document.getElementById('categories-save-btn');

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

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Turns a typed-in category label like "Kids Wear" into a URL/CSS-safe key
  // ("kids-wear"), matching the pattern the storefront and API expect.
  // Falls back to a generic key, and de-dupes against existing/other-new
  // keys so two categories never collide.
  function slugifyCategoryKey(label, takenKeys) {
    let base = String(label || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!base) base = 'category';
    let key = base;
    let n = 2;
    while (takenKeys.has(key)) {
      key = `${base}-${n}`;
      n++;
    }
    return key;
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
      await loadCategories();
      await loadProducts();
    } catch (err) {
      authGate.textContent = 'Could not check your session. Please refresh.';
    }
  }

  // --- Load & apply category labels ---
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load categories (status ' + res.status + ')');
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length) {
        categoryLabels = data;
        categoryOrder = Object.keys(data);
      }
    } catch (err) {
      // Non-fatal — keep the built-in default labels (Women/Men/Bag/Shoes/Watches)
      // so the admin panel still works even if this fetch fails.
    }
    applyCategoryLabels();
  }

  // Builds the <option> list for a category <select>, in the current
  // display order — used for the product-card template and for every
  // already-rendered card, so a freshly added/renamed/deleted category
  // shows up everywhere immediately.
  function categoryOptionsHtml() {
    return categoryOrder
      .map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(categoryLabels[key])}</option>`)
      .join('');
  }

  // Pushes the current categoryLabels/categoryOrder into every place a
  // category is shown in the admin UI: the card template (so newly added
  // products get the right dropdown), every already-rendered product card's
  // category dropdown (preserving its current selection), and each category
  // section's heading.
  function applyCategoryLabels() {
    const optionsHtml = categoryOptionsHtml();
    const templateSelect = productTemplate.content.querySelector('.p-category-input');
    if (templateSelect) templateSelect.innerHTML = optionsHtml;

    container.querySelectorAll('.p-category-input').forEach((select) => {
      const current = select.value;
      select.innerHTML = optionsHtml;
      if (categoryOrder.includes(current)) select.value = current;
    });

    container.querySelectorAll('.category-section').forEach((section) => {
      const key = section.dataset.categoryKey;
      const title = section.querySelector('.category-section-title');
      if (key && title) title.textContent = categoryLabels[key];
    });
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
  // Products are grouped into one section per fixed category (in
  // VALID_CATEGORY_KEYS order), mirroring how they're organized on the
  // live storefront. Empty categories still render with a friendly
  // placeholder so a manager can immediately add the first item to them.
  function renderAll() {
    container.innerHTML = '';
    categoryOrder.forEach((key) => {
      container.appendChild(renderCategorySection(key));
    });
  }

  function renderCategorySection(categoryKey) {
    const node = categorySectionTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.categoryKey = categoryKey;
    const title = node.querySelector('.category-section-title');
    const count = node.querySelector('.category-section-count');
    const grid = node.querySelector('.category-products-grid');

    title.textContent = categoryLabels[categoryKey];

    const items = productsData.filter((p) => p.category === categoryKey);
    count.textContent = items.length === 1 ? '1 item' : `${items.length} items`;

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'category-empty-hint';
      empty.textContent = 'No products in this category yet.';
      grid.appendChild(empty);
    } else {
      items.forEach((product, idx) => grid.appendChild(renderProduct(product, idx === 0, idx === items.length - 1)));
    }
    return node;
  }

  // Swaps `product` with its neighbor (within the same category, direction
  // -1 = up, +1 = down) by swapping their positions in the underlying
  // productsData array. Category grouping only filters/displays that array,
  // so swapping the two real array slots is enough to change both the
  // on-screen order and the order that gets saved/published.
  function moveProduct(product, direction) {
    const sameCategory = productsData.filter((p) => p.category === product.category);
    const posInCategory = sameCategory.indexOf(product);
    const swapWith = sameCategory[posInCategory + direction];
    if (!swapWith) return;
    const idxA = productsData.indexOf(product);
    const idxB = productsData.indexOf(swapWith);
    productsData[idxA] = swapWith;
    productsData[idxB] = product;
    renderAll();
  }

  function renderProduct(product, isFirst, isLast) {
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
    const moveUpBtn = node.querySelector('.move-up-btn');
    const moveDownBtn = node.querySelector('.move-down-btn');

    moveUpBtn.disabled = !!isFirst;
    moveDownBtn.disabled = !!isLast;
    moveUpBtn.addEventListener('click', () => moveProduct(product, -1));
    moveDownBtn.addEventListener('click', () => moveProduct(product, 1));

    img.src = imageSrc(product.image);
    img.alt = product.name || '';
    nameInput.value = product.name || '';
    categoryInput.value = product.category || categoryOrder[0];
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
    categoryInput.addEventListener('change', () => {
      product.category = categoryInput.value;
      renderAll();
    });
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
      renderAll();
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

  // --- Manage Categories modal ---
  // Each row in the list is either an existing category (data-original-key
  // set to its real, unchangeable key — only its label can be edited) or a
  // brand-new one added this session (data-original-key="" — a key is
  // slugified from its label only once Save Categories is clicked).

  function buildCategoryRow(originalKey, label) {
    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.originalKey = originalKey || '';

    const reorder = document.createElement('div');
    reorder.className = 'category-row-reorder';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-icon-light category-move-up-btn';
    upBtn.title = 'Move up';
    upBtn.setAttribute('aria-label', 'Move category up');
    upBtn.innerHTML = '&#9650;';
    upBtn.addEventListener('click', () => moveCategoryRow(row, -1));
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-icon-light category-move-down-btn';
    downBtn.title = 'Move down';
    downBtn.setAttribute('aria-label', 'Move category down');
    downBtn.innerHTML = '&#9660;';
    downBtn.addEventListener('click', () => moveCategoryRow(row, 1));
    reorder.appendChild(upBtn);
    reorder.appendChild(downBtn);

    const field = document.createElement('label');
    field.className = 'crop-field';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'category-label-input';
    input.placeholder = 'e.g. Kids Wear';
    input.value = label || '';
    field.appendChild(input);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm category-row-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => startDeleteConfirm(row));

    row.appendChild(reorder);
    row.appendChild(field);
    row.appendChild(deleteBtn);
    return row;
  }

  // Moves a category row up/down in the DOM (direction -1 = up, +1 = down).
  // The Save Categories handler reads rows in their current DOM order, so
  // reordering here is all that's needed to change the saved/published order.
  function moveCategoryRow(row, direction) {
    if (direction === -1) {
      const prev = row.previousElementSibling;
      if (prev) categoriesFieldsContainer.insertBefore(row, prev);
    } else {
      const next = row.nextElementSibling;
      if (next) categoriesFieldsContainer.insertBefore(next, row);
    }
    refreshCategoryRowStates();
  }

  // Disables the up arrow on the first row and the down arrow on the last
  // row. Call after anything that adds, removes, or reorders rows.
  function refreshCategoryRowStates() {
    const rows = Array.from(categoriesFieldsContainer.querySelectorAll('.category-row'));
    rows.forEach((row, idx) => {
      const upBtn = row.querySelector('.category-move-up-btn');
      const downBtn = row.querySelector('.category-move-down-btn');
      if (upBtn) upBtn.disabled = idx === 0;
      if (downBtn) downBtn.disabled = idx === rows.length - 1;
    });
  }

  function startDeleteConfirm(row) {
    if (categoriesFieldsContainer.querySelectorAll('.category-row').length <= 1) {
      showBanner('You need at least one category — add another before deleting this one.', 'error');
      return;
    }

    const savedReorder = row.querySelector('.category-row-reorder');
    const savedField = row.querySelector('.crop-field');
    const savedDeleteBtn = row.querySelector('.category-row-delete-btn');
    row.innerHTML = '';

    const confirmWrap = document.createElement('div');
    confirmWrap.className = 'category-delete-confirm';

    const span = document.createElement('span');
    span.textContent = 'Type DELETE to confirm:';

    const confirmInput = document.createElement('input');
    confirmInput.type = 'text';
    confirmInput.placeholder = 'DELETE';
    confirmInput.autocomplete = 'off';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-danger btn-sm';
    confirmBtn.textContent = 'Confirm Delete';
    confirmBtn.disabled = true;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost btn-sm';
    cancelBtn.textContent = 'Cancel';

    confirmInput.addEventListener('input', () => {
      confirmBtn.disabled = confirmInput.value.trim().toUpperCase() !== 'DELETE';
    });
    confirmBtn.addEventListener('click', () => {
      if (confirmInput.value.trim().toUpperCase() !== 'DELETE') return;
      row.remove();
      refreshCategoryRowStates();
    });
    cancelBtn.addEventListener('click', () => {
      row.innerHTML = '';
      row.appendChild(savedReorder);
      row.appendChild(savedField);
      row.appendChild(savedDeleteBtn);
    });

    confirmWrap.appendChild(span);
    confirmWrap.appendChild(confirmInput);
    confirmWrap.appendChild(confirmBtn);
    confirmWrap.appendChild(cancelBtn);
    row.appendChild(confirmWrap);
    confirmInput.focus();
  }

  function addCategoryRow() {
    const row = buildCategoryRow('', '');
    categoriesFieldsContainer.appendChild(row);
    refreshCategoryRowStates();
    const input = row.querySelector('.category-label-input');
    if (input) input.focus();
  }

  function openCategoriesModal() {
    categoriesFieldsContainer.innerHTML = '';
    categoryOrder.forEach((key) => {
      categoriesFieldsContainer.appendChild(buildCategoryRow(key, categoryLabels[key]));
    });
    refreshCategoryRowStates();
    categoriesModal.classList.remove('hidden');
  }

  function closeCategoriesModal() {
    categoriesModal.classList.add('hidden');
  }

  categoriesAddBtn.addEventListener('click', addCategoryRow);
  editCategoriesBtn.addEventListener('click', openCategoriesModal);
  categoriesCloseX.addEventListener('click', closeCategoriesModal);
  categoriesCancelBtn.addEventListener('click', closeCategoriesModal);
  categoriesModal.addEventListener('click', (e) => {
    if (e.target === categoriesModal) closeCategoriesModal();
  });

  categoriesSaveBtn.addEventListener('click', async () => {
    const rows = Array.from(categoriesFieldsContainer.querySelectorAll('.category-row'));
    if (!rows.length) {
      showBanner('At least one category is required.', 'error');
      return;
    }

    const updated = {};
    const keptOriginalKeys = new Set();
    const takenKeys = new Set();
    let hasError = false;

    // First pass: keep every existing category's key stable and reserve it,
    // so a new category's generated slug can never collide with one.
    rows.forEach((row) => {
      const originalKey = row.dataset.originalKey;
      if (originalKey) takenKeys.add(originalKey);
    });

    rows.forEach((row) => {
      const input = row.querySelector('.category-label-input');
      const label = input ? input.value.trim() : '';
      if (!label) { hasError = true; return; }

      const originalKey = row.dataset.originalKey;
      if (originalKey) {
        updated[originalKey] = label;
        keptOriginalKeys.add(originalKey);
      } else {
        const key = slugifyCategoryKey(label, takenKeys);
        takenKeys.add(key);
        updated[key] = label;
      }
    });

    if (hasError) {
      showBanner('Every category needs a label.', 'error');
      return;
    }

    const removedKeys = categoryOrder.filter((key) => !keptOriginalKeys.has(key));
    const fallbackKey = Object.keys(updated)[0];

    categoriesSaveBtn.disabled = true;
    categoriesSaveBtn.textContent = 'Saving…';
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save categories');

      categoryLabels = updated;
      categoryOrder = Object.keys(updated);

      // Any products that were sitting in a now-deleted category get moved
      // into the first remaining category instead of silently disappearing.
      let reassignedCount = 0;
      if (removedKeys.length) {
        productsData.forEach((product) => {
          if (removedKeys.includes(product.category)) {
            product.category = fallbackKey;
            reassignedCount++;
          }
        });
        if (reassignedCount) {
          const prodRes = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productsData),
          });
          if (!prodRes.ok) {
            const prodData = await prodRes.json().catch(() => ({}));
            throw new Error(
              'Categories saved, but moving ' + reassignedCount +
              ' product(s) out of the deleted categor' + (reassignedCount === 1 ? 'y' : 'ies') +
              ' failed: ' + (prodData.error || 'unknown error')
            );
          }
        }
      }

      applyCategoryLabels();
      renderAll();
      closeCategoriesModal();
      showBanner(
        reassignedCount
          ? `Categories updated — ${reassignedCount} product(s) moved into "${categoryLabels[fallbackKey]}". Changes are live now.`
          : 'Categories updated — changes are live on the site now.',
        'success'
      );
    } catch (err) {
      showBanner('Could not save categories: ' + err.message, 'error');
    } finally {
      categoriesSaveBtn.disabled = false;
      categoriesSaveBtn.textContent = 'Save Categories';
    }
  });

  // --- Add product ---
  document.getElementById('add-product-btn').addEventListener('click', () => {
    const defaultCategory = categoryOrder[0];
    const newProduct = {
      id: nextId++,
      name: '',
      category: defaultCategory,
      price: 0,
      oldPrice: null,
      saleTag: null,
      stock: 0,
      image: '',
    };
    productsData.push(newProduct);
    renderAll();
    const section = container.querySelector(`.category-section[data-category-key="${defaultCategory}"]`);
    const lastCard = section && section.querySelector('.product-card:last-of-type');
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
