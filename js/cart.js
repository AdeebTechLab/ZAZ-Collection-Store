/* Real shopping cart, backed by localStorage so it persists per-browser.
   Runs on every page: keeps the header mini-cart badge/dropdown in sync
   everywhere, and additionally renders the full table on shoping-cart.html
   when that page is open. No backend involved — this is intentionally
   client-side only, matching how this static theme works. */
(function () {
  'use strict';

  const STORAGE_KEY = 'zaz_cart_v1';

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
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
    return '$' + Number(n || 0).toFixed(2);
  }

  function imageSrc(image) {
    if (!image) return 'images/product-01.jpg';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
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
    add(product, qty) {
      qty = Math.max(1, parseInt(qty, 10) || 1);
      const items = readCart();
      const existing = items.find((i) => i.id === product.id);
      if (existing) {
        existing.qty += qty;
      } else {
        items.push({
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          image: product.image || '',
          qty,
        });
      }
      writeCart(items);
      renderAll();
    },
    setQty(id, qty) {
      qty = parseInt(qty, 10);
      let items = readCart();
      if (!qty || qty < 1) {
        items = items.filter((i) => i.id !== id);
      } else {
        const item = items.find((i) => i.id === id);
        if (item) item.qty = qty;
      }
      writeCart(items);
      renderAll();
    },
    remove(id) {
      const items = readCart().filter((i) => i.id !== id);
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
        li.innerHTML = `
          <div class="header-cart-item-img">
            <img src="${imageSrc(item.image)}" alt="IMG">
          </div>
          <div class="header-cart-item-txt p-t-8">
            <span class="header-cart-item-name m-b-18">${escapeHtml(item.name)}</span>
            <span class="header-cart-item-info">${item.qty} x ${money(item.price)}</span>
          </div>
        `;
        list.appendChild(li);
      });
    });

    document.querySelectorAll('.header-cart-total').forEach((el) => {
      el.textContent = 'Total: ' + money(subtotal);
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // --- Full cart page (shoping-cart.html) ---
  function renderCartPage() {
    const table = document.querySelector('.table-shopping-cart');
    if (!table) return; // not on the cart page

    let tbody = table.querySelector('tbody#cart-rows');
    if (!tbody) {
      tbody = document.createElement('tbody');
      tbody.id = 'cart-rows';
      table.appendChild(tbody);
    }

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
        tr.dataset.id = item.id;
        tr.innerHTML = `
          <td class="column-1">
            <div class="how-itemcart1 pos-relative">
              <img src="${imageSrc(item.image)}" alt="IMG">
              <span class="js-cart-remove pos-absolute" title="Remove" style="top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:#fff; border:1px solid #e6e6e6; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; color:#888;">&times;</span>
            </div>
          </td>
          <td class="column-2">${escapeHtml(item.name)}</td>
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
    document.querySelectorAll('.js-cart-subtotal').forEach((el) => { el.textContent = money(subtotal); });
    document.querySelectorAll('.js-cart-total').forEach((el) => { el.textContent = money(subtotal); });

    // Wire row controls (delegated once per render since we rebuild rows each time)
    tbody.querySelectorAll('.js-cart-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.target.closest('tr').dataset.id);
        Cart.remove(id);
      });
    });
    tbody.querySelectorAll('.js-cart-up').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const id = Number(tr.dataset.id);
        const input = tr.querySelector('.js-cart-qty');
        Cart.setQty(id, Number(input.value) + 1);
      });
    });
    tbody.querySelectorAll('.js-cart-down').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const id = Number(tr.dataset.id);
        const input = tr.querySelector('.js-cart-qty');
        Cart.setQty(id, Number(input.value) - 1);
      });
    });
    tbody.querySelectorAll('.js-cart-qty').forEach((input) => {
      input.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        const id = Number(tr.dataset.id);
        Cart.setQty(id, Number(input.value));
      });
    });
  }

  function renderAll() {
    renderHeaderCart();
    renderCartPage();
  }

  // --- Checkout via WhatsApp ---
  // This theme has no payment backend, so "checkout" here means: build a
  // readable order summary and hand it off to WhatsApp's click-to-chat
  // link, pre-filled and ready for the customer to send.
  const WHATSAPP_NUMBER = '923092333121'; // +92 309 2333121, digits only, no leading 0/+

  function buildOrderMessage(items, details) {
    const lines = ['Hi! I would like to place an order:', ''];
    items.forEach((item) => {
      lines.push(`• ${item.name} — Qty: ${item.qty} — ${money(item.price)} each — ${money(item.qty * item.price)}`);
    });
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    lines.push('', `Total: ${money(subtotal)}`);

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
      btn.addEventListener('click', () => {
        const items = readCart();
        if (!items.length) {
          alert('Your cart is empty. Add something before checking out.');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { renderAll(); bindCheckoutButton(); });
  } else {
    renderAll();
    bindCheckoutButton();
  }
})();
