/* Real shopping cart, backed by localStorage so it persists per-browser.
   Runs on every page: keeps the header mini-cart badge/dropdown in sync
   everywhere, and additionally renders the full table on shoping-cart.html
   when that page is open. No backend involved — this is intentionally
   client-side only, matching how this static theme works. */
(function () {
  'use strict';

  const STORAGE_KEY = 'zaz_cart_v1';
  const COUPON_STORAGE_KEY = 'zaz_coupon_v1';

  function readCoupon() {
    try {
      const raw = localStorage.getItem(COUPON_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCoupon(coupon) {
    try {
      if (coupon) localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
      else localStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {
      // Storage unavailable — coupon just won't persist across reloads.
    }
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      // Carts saved before size/color existed won't have a `key` — backfill
      // one so old localStorage data still renders/removes correctly.
      data.forEach((item) => {
        if (!item.key) item.key = variantKey(item.id, item.size || '', item.color || '');
        if (item.size == null) item.size = '';
        if (item.color == null) item.color = '';
      });
      return data;
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable (private browsing quota, etc.) — cart just
      // won't persist this session; rendering still works in-memory.
    }
  }

  function money(n) {
    return 'Rs. ' + Math.round(Number(n || 0)).toLocaleString('en-US');
  }

  function imageSrc(image) {
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  // Size + color are mandatory (enforced in Quick View / product-detail before
  // Cart.add is ever called), so every cart line item always has both. Two
  // lines with the same product id but a different size/color are different
  // variants and must stay separate rows, not merge quantities together —
  // hence keying items on id+size+color rather than id alone.
  function variantKey(id, size, color) {
    return `${id}::${size}::${color}`;
  }

  const Cart = {
    getItems() {
      return readCart();
    },
    getCount() {
      return readCart().reduce((sum, item) => sum + item.qty, 0);
    },
    getSubtotal() {
      return readCart().reduce((sum, item) => sum + item.qty * item.price, 0);
    },
    getCoupon() {
      return readCoupon();
    },
    getDiscount() {
      const coupon = readCoupon();
      if (!coupon) return 0;
      return Math.round(this.getSubtotal() * coupon.percent / 100);
    },
    getTotal() {
      return Math.max(0, this.getSubtotal() - this.getDiscount());
    },
    applyCoupon(coupon) {
      writeCoupon(coupon);
      renderAll();
    },
    removeCoupon() {
      writeCoupon(null);
      renderAll();
    },
    // `options.size` and `options.color` are required — callers (Quick View,
    // product detail) must validate the person picked both before calling
    // this, so every line item in the cart always carries a real variant.
    add(product, qty, options) {
      qty = Math.max(1, parseInt(qty, 10) || 1);
      const size = (options && options.size) || '';
      const color = (options && options.color) || '';
      const key = variantKey(product.id, size, color);
      const items = readCart();
      const existing = items.find((i) => i.key === key);
      if (existing) {
        existing.qty += qty;
      } else {
        items.push({
          key,
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          image: product.image || '',
          size,
          color,
          qty,
        });
      }
      writeCart(items);
      renderAll();
    },
    setQty(key, qty) {
      qty = parseInt(qty, 10);
      let items = readCart();
      if (!qty || qty < 1) {
        items = items.filter((i) => i.key !== key);
      } else {
        const item = items.find((i) => i.key === key);
        if (item) item.qty = qty;
      }
      writeCart(items);
      renderAll();
    },
    remove(key) {
      const items = readCart().filter((i) => i.key !== key);
      writeCart(items);
      renderAll();
    },
    clear() {
      writeCart([]);
      renderAll();
    },
  };

  window.ZazCart = Cart;

  // --- Header mini-cart (badge + dropdown), present on every page ---
  function renderHeaderCart() {
    const items = readCart();
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);

    document.querySelectorAll('.js-show-cart.icon-header-noti').forEach((el) => {
      el.setAttribute('data-notify', String(count));
    });

    document.querySelectorAll('.header-cart-wrapitem').forEach((list) => {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML =
          '<li class="header-cart-item flex-w flex-t m-b-12"><span class="stext-107 cl6">Your cart is empty.</span></li>';
        return;
      }
      items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'header-cart-item flex-w flex-t m-b-12';
        const variantLine = (item.size || item.color)
          ? `<span class="header-cart-item-variant" style="display:block; font-size:12px; color:#888;">${escapeHtml([item.size, item.color].filter(Boolean).join(' / '))}</span>`
          : '';
        li.innerHTML = `
          <div class="header-cart-item-img">
            <img src="${imageSrc(item.image)}" alt="IMG">
          </div>
          <div class="header-cart-item-txt p-t-8">
            <span class="header-cart-item-name m-b-18">${escapeHtml(item.name)}</span>
            ${variantLine}
            <span class="header-cart-item-info">${item.qty} x ${money(item.price)}</span>
          </div>
        `;
        list.appendChild(li);
      });
    });

    document.querySelectorAll('.header-cart-total').forEach((el) => {
      el.textContent = 'Total: ' + money(Cart.getTotal());
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // --- Full cart page (shoping-cart.html) ---
  function renderCartPage() {
    // shoping-cart.html is the only page with a static <tbody id="cart-rows">
    // in its markup. wishlist.html reuses the same `.table-shopping-cart`
    // class purely for its table's CSS styling, so matching on that class
    // alone would (and used to) make this function run there too and inject
    // a second, unwanted tbody of cart rows onto the wishlist page.
    const tbody = document.getElementById('cart-rows');
    if (!tbody) return; // not on the real cart page
    const table = tbody.closest('.table-shopping-cart');
    if (!table) return;

    const items = readCart();
    tbody.innerHTML = '';

    if (!items.length) {
      const tr = document.createElement('tr');
      tr.className = 'cart-empty-row';
      tr.innerHTML = '<td colspan="5" class="p-tb-30 stext-107 cl6">Your cart is empty. <a href="product.html" class="cl1 hov-cl1">Continue shopping →</a></td>';
      tbody.appendChild(tr);
    } else {
      items.forEach((item) => {
        const tr = document.createElement('tr');
        tr.className = 'table_row';
        tr.dataset.key = item.key;
        tr.dataset.id = item.id;
        const variantLine = (item.size || item.color)
          ? `<div class="cart-item-variant" style="font-size:12.5px; color:#666; margin-top:3px;">
               ${item.size ? `<span><strong>Size:</strong> ${escapeHtml(item.size)}</span>` : ''}
               ${item.size && item.color ? ' &nbsp;|&nbsp; ' : ''}
               ${item.color ? `<span><strong>Color:</strong> ${escapeHtml(item.color)}</span>` : ''}
             </div>`
          : '';
        tr.innerHTML = `
          <td class="column-1">
            <div class="how-itemcart1 pos-relative">
              <img src="${imageSrc(item.image)}" alt="IMG">
              <span class="js-cart-remove pos-absolute" title="Remove" style="top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:#fff; border:1px solid #e6e6e6; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; color:#888;">&times;</span>
            </div>
          </td>
          <td class="column-2">${escapeHtml(item.name)}${variantLine}<span class="cart-item-oos-badge" style="display:none;">Out of Stock</span></td>
          <td class="column-3">${money(item.price)}</td>
          <td class="column-4">
            <div class="wrap-num-product flex-w m-l-auto m-r-0">
              <div class="btn-num-product-down cl8 hov-btn3 trans-04 flex-c-m js-cart-down">
                <i class="fs-16 zmdi zmdi-minus"></i>
              </div>
              <input class="mtext-104 cl3 txt-center num-product js-cart-qty" type="number" min="1" value="${item.qty}">
              <div class="btn-num-product-up cl8 hov-btn3 trans-04 flex-c-m js-cart-up">
                <i class="fs-16 zmdi zmdi-plus"></i>
              </div>
            </div>
          </td>
          <td class="column-5">${money(item.qty * item.price)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const coupon = Cart.getCoupon();
    const discount = Cart.getDiscount();
    document.querySelectorAll('.js-cart-subtotal').forEach((el) => { el.textContent = money(subtotal); });
    document.querySelectorAll('.js-cart-total').forEach((el) => { el.textContent = money(Cart.getTotal()); });
    document.querySelectorAll('.js-discount-row').forEach((row) => {
      if (coupon && discount > 0) {
        row.style.display = '';
        const amountEl = row.querySelector('.js-cart-discount');
        if (amountEl) amountEl.textContent = `- ${money(discount)} (${coupon.code})`;
      } else {
        row.style.display = 'none';
      }
    });

    // Wire row controls (delegated once per render since we rebuild rows each time)
    tbody.querySelectorAll('.js-cart-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = e.target.closest('tr').dataset.key;
        Cart.remove(key);
      });
    });
    tbody.querySelectorAll('.js-cart-up').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const key = tr.dataset.key;
        const input = tr.querySelector('.js-cart-qty');
        Cart.setQty(key, Number(input.value) + 1);
      });
    });
    tbody.querySelectorAll('.js-cart-down').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const key = tr.dataset.key;
        const input = tr.querySelector('.js-cart-qty');
        Cart.setQty(key, Number(input.value) - 1);
      });
    });
    tbody.querySelectorAll('.js-cart-qty').forEach((input) => {
      input.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        const key = tr.dataset.key;
        Cart.setQty(key, Number(input.value));
      });
    });

    markOutOfStockRows(tbody);
  }

  function renderAll() {
    renderHeaderCart();
    renderCartPage();
  }

  // --- Checkout via WhatsApp ---
  // This theme has no payment backend, so "checkout" here means: build a
  // readable order summary and hand it off to WhatsApp's click-to-chat
  // link, pre-filled and ready for the customer to send.
  const WHATSAPP_NUMBER = '923076321109'; // +92 307 6321109, digits only, no leading 0/+

  function buildOrderMessage(items, details) {
    const lines = ['Hi! I would like to place an order:', ''];
    items.forEach((item) => {
      const variant = [item.size ? `Size: ${item.size}` : '', item.color ? `Color: ${item.color}` : '']
        .filter(Boolean)
        .join(', ');
      lines.push(`• ${item.name}${variant ? ` [${variant}]` : ''} — Qty: ${item.qty} — ${money(item.price)} each — ${money(item.qty * item.price)}`);
    });
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const coupon = Cart.getCoupon();
    const discount = Cart.getDiscount();
    lines.push('', `Subtotal: ${money(subtotal)}`);
    if (coupon && discount > 0) {
      lines.push(`Discount (${coupon.code} — ${coupon.percent}% off): -${money(discount)}`);
    }
    lines.push(`Total: ${money(Cart.getTotal())}`);

    lines.push('', 'Deliver to:', `Name: ${details.name}`, `Phone: ${details.phone}`, `Address: ${details.address}`, `City: ${details.city}`);
    if (details.zip) lines.push(`Postal Code: ${details.zip}`);
    if (details.notes) lines.push('', `Notes: ${details.notes}`);

    return lines.join('\n');
  }

  function sendOrderToWhatsapp(items, details) {
    const message = buildOrderMessage(items, details);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
  }

  // --- Live stock lookup ---
  // A cart item only ever stores a name/price/image snapshot from when it
  // was added — not whether it's still orderable. Since an admin can mark
  // something Out of Stock at any time (even after it's already sitting in
  // someone's cart), we re-check the *current* /api/products list rather
  // than trusting whatever was true when the item was added. Cached per
  // page load; bindCheckoutButton() forces a fresh fetch right before
  // checkout so a stale cache can't let an out-of-stock order through.
  let productsStockCache = null;

  async function fetchProductsStockMap(forceFresh) {
    if (productsStockCache && !forceFresh) return productsStockCache;
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      const products = await res.json();
      const map = new Map();
      products.forEach((p) => map.set(p.id, p.inStock !== false));
      productsStockCache = map;
    } catch {
      productsStockCache = new Map(); // unknown — treat as "can't confirm", not a hard block
    }
    return productsStockCache;
  }

  // Tags each already-rendered cart row as out-of-stock (red badge, dimmed,
  // qty controls disabled) if its product is currently marked Out of Stock
  // in the live catalogue. Runs after every cart-page render.
  async function markOutOfStockRows(tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr.table_row[data-id]'));
    if (!rows.length) return;
    const stockMap = await fetchProductsStockMap();
    rows.forEach((tr) => {
      const id = Number(tr.dataset.id);
      const inStock = stockMap.has(id) ? stockMap.get(id) : true;
      tr.classList.toggle('cart-row-oos', !inStock);
      const badge = tr.querySelector('.cart-item-oos-badge');
      if (badge) badge.style.display = inStock ? 'none' : 'inline-block';
      const qtyInput = tr.querySelector('.js-cart-qty');
      const upBtn = tr.querySelector('.js-cart-up');
      const downBtn = tr.querySelector('.js-cart-down');
      if (qtyInput) qtyInput.disabled = !inStock;
      if (upBtn) upBtn.style.pointerEvents = inStock ? '' : 'none';
      if (downBtn) downBtn.style.pointerEvents = inStock ? '' : 'none';
    });
  }

  // --- Checkout details modal: collects delivery info before we build the
  // WhatsApp message, since there's no payment/shipping backend here. ---
  function bindCheckoutButton() {
    const modal = document.querySelector('.js-checkout-modal');
    const form = document.getElementById('checkout-details-form');
    const errorBox = modal ? modal.querySelector('.js-checkout-modal-error') : null;

    function showModalError(msg) {
      if (!errorBox) return;
      errorBox.textContent = msg;
      errorBox.classList.add('show');
    }
    function hideModalError() {
      if (!errorBox) return;
      errorBox.classList.remove('show');
      errorBox.textContent = '';
    }
    function openModal() {
      if (!modal) return;
      hideModalError();
      modal.classList.add('show-checkout-modal');
      modal.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
      if (!modal) return;
      modal.classList.remove('show-checkout-modal');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.querySelectorAll('.js-checkout-whatsapp').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const items = readCart();
        if (!items.length) {
          alert('Your cart is empty. Add something before checking out.');
          return;
        }

        // Re-check live stock right before checkout (not just whatever the
        // cart page happened to show a moment ago) — an admin may have
        // marked something Out of Stock in the meantime. If anything in
        // the cart is no longer orderable, stop here instead of letting
        // the order through; the cart page's own Out of Stock badges/
        // disabled controls guide the person to remove it.
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Checking stock…';
        const stockMap = await fetchProductsStockMap(true);
        btn.disabled = false;
        btn.textContent = original;

        const outOfStockItems = items.filter((item) => stockMap.has(item.id) && stockMap.get(item.id) === false);
        if (outOfStockItems.length) {
          const names = outOfStockItems.map((i) => i.name).join(', ');
          alert(`Sorry, the following item(s) in your cart are now Out of Stock and can't be ordered: ${names}. Please remove them from your cart to continue.`);
          renderAll();
          return;
        }

        if (!modal || !form) {
          // Modal markup isn't on this page for some reason — fall back to
          // sending the order without delivery details rather than doing
          // nothing.
          sendOrderToWhatsapp(items, {});
          return;
        }
        openModal();
      });
    });

    if (!modal || !form) return;

    modal.querySelectorAll('.js-checkout-modal-close').forEach((el) => {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      hideModalError();

      const details = {
        name: form.querySelector('#checkout-name').value.trim(),
        phone: form.querySelector('#checkout-phone').value.trim(),
        address: form.querySelector('#checkout-address').value.trim(),
        city: form.querySelector('#checkout-city').value.trim(),
        zip: form.querySelector('#checkout-zip').value.trim(),
        notes: form.querySelector('#checkout-notes').value.trim(),
      };

      if (!details.name || !details.phone || !details.address || !details.city) {
        showModalError('Please fill in your name, phone, address, and city so we can deliver your order.');
        return;
      }

      const items = readCart();
      if (!items.length) {
        showModalError('Your cart is empty.');
        return;
      }

      sendOrderToWhatsapp(items, details);
      closeModal();
      form.reset();
    });
  }

  // --- Update Cart button ---
  // Quantity +/- and the qty input's `change` event already update the cart
  // live, but if someone types a new number directly into the box and never
  // blurs the field (no tab/click away), that edit hasn't been committed
  // yet. "Update Cart" commits whatever's currently in every qty box.
  function bindUpdateCartButton() {
    document.querySelectorAll('.js-update-cart').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rows = document.querySelectorAll('#cart-rows tr.table_row');
        rows.forEach((tr) => {
          const key = tr.dataset.key;
          const input = tr.querySelector('.js-cart-qty');
          if (input) Cart.setQty(key, input.value);
        });
        const original = btn.textContent;
        btn.textContent = 'Updated ✓';
        setTimeout(() => { btn.textContent = original; }, 1200);
      });
    });
  }

  // --- Coupons ---
  // Real discount codes, managed by the admin in the Manage Coupons panel
  // and stored via /api/coupons. Cached per page load since the list rarely
  // changes and Apply Coupon may be clicked more than once.
  let couponsCache = null;

  async function fetchCoupons() {
    if (couponsCache) return couponsCache;
    try {
      const res = await fetch('/api/coupons', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad response');
      couponsCache = await res.json();
    } catch {
      couponsCache = [];
    }
    return couponsCache;
  }

  // Codes match case-insensitively, and only currently-active coupons count.
  function findCoupon(list, code) {
    const target = String(code || '').trim().toUpperCase();
    if (!target) return null;
    return list.find((c) => c && c.code && c.code.toUpperCase() === target && c.active !== false) || null;
  }

  function bindCouponButton() {
    document.querySelectorAll('.js-apply-coupon').forEach((btn) => {
      const innerRow = btn.closest('.flex-w');
      const wrap = innerRow ? innerRow.parentElement : document;
      const input = wrap.querySelector('.js-coupon-input');
      const msg = wrap.querySelector('.js-coupon-msg');

      btn.addEventListener('click', async () => {
        if (!msg) return;
        const codeRaw = input ? input.value.trim() : '';
        if (!codeRaw) {
          msg.style.color = '#e04141';
          msg.textContent = 'Please enter a coupon code.';
          msg.style.display = 'block';
          return;
        }

        const original = btn.textContent;
        btn.textContent = 'Checking…';
        const list = await fetchCoupons();
        btn.textContent = original;

        const match = findCoupon(list, codeRaw);
        if (!match) {
          msg.style.color = '#e04141';
          msg.textContent = `"${codeRaw}" is not a valid coupon code.`;
          msg.style.display = 'block';
          return;
        }

        Cart.applyCoupon({ code: match.code, percent: match.percent });
        msg.style.color = '#2e7d32';
        msg.textContent = `Coupon "${match.code}" applied — ${match.percent}% off!`;
        msg.style.display = 'block';
        if (input) input.value = '';
      });
    });
  }

  function bindRemoveCouponLink() {
    document.querySelectorAll('.js-remove-coupon').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        Cart.removeCoupon();
      });
    });
  }

  // If a coupon was applied on a previous visit, re-check it against the
  // live list on load — an admin may have since deleted it, disabled it,
  // or changed its percentage — so the applied discount never goes stale.
  async function revalidateStoredCoupon() {
    const stored = readCoupon();
    if (!stored) return;
    const list = await fetchCoupons();
    const match = findCoupon(list, stored.code);
    if (!match) {
      writeCoupon(null);
      renderAll();
    } else if (match.percent !== stored.percent || match.code !== stored.code) {
      writeCoupon({ code: match.code, percent: match.percent });
      renderAll();
    }
  }

  function init() {
    renderAll();
    bindCheckoutButton();
    bindUpdateCartButton();
    bindCouponButton();
    bindRemoveCouponLink();
    revalidateStoredCoupon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
