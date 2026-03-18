let authToken = null;
let role = null;
let user = null;
let customerCartId = null;
let currentBooks = [];
let currentBookForCart = null;
let staffEditingBookId = null;
let purchasedReviewBooks = [];
let myReviewMapByBookId = new Map();
let staffReviewCache = [];
let staffReviewBookNameById = new Map();
let staffSelectedReviewBookId = null;
const SESSION_STORAGE_KEY = 'bookstore_session_v1';
const BOOK_CATEGORIES = [
  { value: '', label: '📚 All Categories' },
  { value: 'fiction', label: 'Fiction' },
  { value: 'non_fiction', label: 'Non-Fiction' },
  { value: 'technology', label: 'Technology' },
  { value: 'business', label: 'Business' },
  { value: 'science', label: 'Science' },
  { value: 'children', label: 'Children' },
  { value: 'other', label: 'Other' },
];

function categoryLabel(value) {
  const match = BOOK_CATEGORIES.find(c => c.value === value);
  return match ? match.label : 'Other';
}

function resolveBookImageUrl(rawUrl, fallback = 'https://via.placeholder.com/400x260?text=Book+Cover') {
  const url = String(rawUrl || '').trim();
  if (!url) return fallback;
  if (url.includes('drive.google.com')) {
    let fileId = '';
    const filePathMatch = url.match(/\/file\/d\/([^/]+)/i);
    const queryIdMatch = url.match(/[?&]id=([^&]+)/i);
    if (filePathMatch && filePathMatch[1]) fileId = filePathMatch[1];
    if (!fileId && queryIdMatch && queryIdMatch[1]) fileId = queryIdMatch[1];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }
  return url;
}

function renderCategorySelects() {
  const customerSelect = document.getElementById('bookCategory');
  const staffSelect = document.getElementById('sCategory');
  if (customerSelect) {
    customerSelect.innerHTML = BOOK_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
  }
  if (staffSelect) {
    staffSelect.innerHTML = BOOK_CATEGORIES
      .filter(c => c.value)
      .map(c => `<option value="${c.value}">${c.label}</option>`)
      .join('');
  }
}

function renderPaymentFields() {
  const payMethodEl = document.getElementById('payMethod');
  const container = document.getElementById('paymentFields');
  if (!payMethodEl || !container) return;
  const method = payMethodEl.value;
  if (method === 'Card') {
    container.innerHTML = `
      <input id="cardName" placeholder="Name on card" />
      <input id="cardNumber" placeholder="Card number" />
      <input id="cardExpiry" placeholder="MM/YY" />
      <input id="cardCvv" placeholder="CVV" />
    `;
  } else if (method === 'PayPal') {
    container.innerHTML = `
      <input id="paypalEmail" type="email" placeholder="PayPal email" />
    `;
  } else if (method === 'COD') {
    container.innerHTML = `
      <div class="muted" style="padding: 10px 2px;">Payment will be collected when the order is delivered.</div>
    `;
  } else {
    container.innerHTML = `
      <input id="bankName" placeholder="Bank name" />
      <input id="bankAccount" placeholder="Account number" />
      <input id="bankOwner" placeholder="Account holder" />
    `;
  }
}

function collectPaymentDetails() {
  const method = document.getElementById('payMethod').value;
  if (method === 'Card') {
    return {
      holder: (document.getElementById('cardName')?.value || '').trim(),
      number_last4: (document.getElementById('cardNumber')?.value || '').replace(/\s+/g, '').slice(-4),
      expiry: (document.getElementById('cardExpiry')?.value || '').trim(),
    };
  }
  if (method === 'PayPal') {
    return { paypal_email: (document.getElementById('paypalEmail')?.value || '').trim() };
  }
  if (method === 'COD') {
    return { mode: 'COD', note: 'Pay on delivery' };
  }
  return {
    bank_name: (document.getElementById('bankName')?.value || '').trim(),
    account_last4: (document.getElementById('bankAccount')?.value || '').replace(/\s+/g, '').slice(-4),
    holder: (document.getElementById('bankOwner')?.value || '').trim(),
  };
}

function validatePaymentDetails() {
  const method = document.getElementById('payMethod').value;
  if (method === 'Card') {
    if (!(document.getElementById('cardName')?.value || '').trim()) return 'Card holder name is required';
    if ((document.getElementById('cardNumber')?.value || '').replace(/\s+/g, '').length < 12) return 'Card number is invalid';
    if (!(document.getElementById('cardExpiry')?.value || '').trim()) return 'Card expiry is required';
    if ((document.getElementById('cardCvv')?.value || '').replace(/\s+/g, '').length < 3) return 'CVV is invalid';
  }
  if (method === 'PayPal') {
    if (!(document.getElementById('paypalEmail')?.value || '').trim()) return 'PayPal email is required';
  }
  if (method === 'Bank') {
    if (!(document.getElementById('bankName')?.value || '').trim()) return 'Bank name is required';
    if ((document.getElementById('bankAccount')?.value || '').replace(/\s+/g, '').length < 6) return 'Bank account number is invalid';
    if (!(document.getElementById('bankOwner')?.value || '').trim()) return 'Account holder is required';
  }
  if (method === 'COD') {
    return '';
  }
  return '';
}

function setUserBadge() {
  const badge = document.getElementById('userBadge');
  if (!badge) return;
  if (!user || !role) {
    badge.innerHTML = '👤 Guest';
    return;
  }
  const roleEmoji = { customer: '👤', staff: '👔', manager: '🎯' };
  badge.innerHTML = `${roleEmoji[role] || '👤'} ${user.name || user.email || 'User'}`;
}

function saveSession() {
  if (!authToken || !role || !user) return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ authToken, role, user }));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.authToken || !parsed?.role || !parsed?.user) return false;
    authToken = parsed.authToken;
    role = parsed.role;
    user = parsed.user;
    setUserBadge();
    return true;
  } catch {
    clearSession();
    return false;
  }
}

async function api(url, opts = {}) {
  const headers = opts.headers || {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (!(opts.body instanceof FormData) && !headers['Content-Type'] && opts.method && opts.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && authToken) {
      authToken = null;
      role = null;
      user = null;
      customerCartId = null;
      clearSession();
      setUserBadge();
      show('authView');
    }
    throw new Error(data.error || JSON.stringify(data));
  }
  return data;
}

function show(viewId) {
  ['authView','customerView','staffView','managerView'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
  });
}

function switchTab(e, tabName) {
  document.querySelectorAll('#browse, #cart, #orders, #reviews').forEach(el => el.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  document.querySelectorAll('#customerView .tab-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
}

function switchTabStaff(e, tabName) {
  document.querySelectorAll('#inventory, #staff-orders, #staff-reviews').forEach(el => el.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  document.querySelectorAll('#staffView .tab-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
}

function switchTabManager(e, tabName) {
  document.querySelectorAll('#staff, #revenue').forEach(el => el.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  document.querySelectorAll('#managerView .tab-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
}

async function login() {
  try {
    const payload = {
      role: document.getElementById('loginRole').value,
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value,
    };
    const result = await api('/auth/login/', { method: 'POST', body: JSON.stringify(payload) });
    authToken = result.token;
    role = result.role;
    user = result.user;
    saveSession();
    setUserBadge();
    document.getElementById('loginMsg').innerHTML = '✓ Login successful!';
    await openDashboard();
  } catch (e) {
    document.getElementById('loginMsg').innerHTML = `✗ Login failed: ${e.message}`;
  }
}

async function registerCustomer() {
  try {
    const payload = {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
    };
    const result = await api('/auth/register/', { method: 'POST', body: JSON.stringify(payload) });
    authToken = result.token;
    role = result.role;
    user = result.user;
    saveSession();
    setUserBadge();
    document.getElementById('regMsg').innerHTML = '✓ Registered and logged in!';
    await openDashboard();
  } catch (e) {
    document.getElementById('regMsg').innerHTML = `✗ Registration failed: ${e.message}`;
  }
}

function logout() {
  authToken = null;
  role = null;
  user = null;
  customerCartId = null;
  clearSession();
  window.location.href = 'index.html';
}

async function openDashboard() {
  if (role === 'customer') {
    window.location.href = 'customer.html';
  } else if (role === 'staff') {
    window.location.href = 'staff.html';
  } else if (role === 'manager') {
    window.location.href = 'manager.html';
  }
}

async function loadCustomerData() {
  try {
    renderCategorySelects();
    renderPaymentFields();
    await Promise.allSettled([loadBooks(), loadRecommendations(), loadCart(), loadOrders(), loadReviewBooks()]);
  } catch (e) {
    console.error('Error loading customer data:', e);
  }
}

async function loadBooks() {
  try {
    const q = encodeURIComponent(document.getElementById('bookQ').value || '');
    const author = encodeURIComponent(document.getElementById('bookAuthor').value || '');
    const category = encodeURIComponent(document.getElementById('bookCategory').value || '');
    currentBooks = await api(`/api/book/books/?q=${q}&author=${author}&category=${category}`);
    
    document.getElementById('bookList').innerHTML = currentBooks.map(b => `
      <div class="book-card" onclick="showBookReviews(${b.id})">
        <img class="book-cover" src="${resolveBookImageUrl(b.image_url)}" alt="${b.title}" onerror="this.onerror=null;this.src='https://via.placeholder.com/400x260?text=Book+Cover';" />
        <div class="book-title">${b.title}</div>
        <div class="book-author">by ${b.author}</div>
        <div class="muted" style="margin-bottom:8px;">${categoryLabel(b.category)}</div>
        <div class="book-price">$${Number(b.price).toFixed(2)}</div>
        <div class="book-stock">${b.stock > 0 ? `✓ ${b.stock} in stock` : '✗ Out of stock'}</div>
        <div class="book-actions">
          <button class="primary" onclick="event.stopPropagation(); addToCart(${b.id})" ${b.stock > 0 ? '' : 'disabled'}>Add to Cart</button>
          <button onclick="event.stopPropagation(); showBookReviews(${b.id})">View Details</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No books found</p>';

    const reviewBook = document.getElementById('reviewBook');
    if (reviewBook) {
      reviewBook.innerHTML = currentBooks.map(b => `<option value="${b.id}">${b.title}</option>`).join('');
    }
  } catch (e) {
    console.error('Error loading books:', e);
    document.getElementById('bookList').innerHTML = `<div class="alert error">✗ Error loading books: ${e.message}</div>`;
  }
}

async function loadRecommendations() {
  try {
    const recs = await api(`/api/ai/recommendations/?customer_id=${user.id}`);
    if (recs && recs.length > 0) {
      document.getElementById('recList').innerHTML = '<strong>🤖 AI Recommendations for you:</strong><div style="margin-top: 8px;">' + 
        recs.slice(0, 5).map(r => `<div class="muted" style="font-size: 0.87rem; padding: 6px 0;">📖 Book #${r.book_id} (Match score: ${(r.score * 100).toFixed(0)}%)</div>`).join('') + '</div>';
    } else {
      document.getElementById('recList').innerHTML = '<p class="muted">No recommendations yet - check back soon!</p>';
    }
  } catch (e) {
    console.error('Error loading recommendations:', e);
  }
}

function showBookReviews(bookId) {
  const book = currentBooks.find(b => b.id === bookId);
  if (!book) return;
  
  currentBookForCart = bookId;
  const modalImage = document.getElementById('modalBookImage');
  document.getElementById('modalBookTitle').innerText = book.title;
  document.getElementById('modalBookAuthor').innerText = `by ${book.author}`;
  document.getElementById('modalBookDescription').innerText = book.description || 'No description available for this book yet.';
  document.getElementById('modalBookPrice').innerText = `$${Number(book.price).toFixed(2)}`;
  document.getElementById('modalBookStock').innerText = book.stock > 0 ? `✓ ${book.stock} copies available` : '✗ Out of stock';
  modalImage.src = resolveBookImageUrl(book.image_url, 'https://via.placeholder.com/900x520?text=Book+Cover');
  modalImage.onerror = () => { modalImage.src = 'https://via.placeholder.com/900x520?text=Book+Cover'; };
  modalImage.style.display = 'block';
  
  api(`/api/rate/reviews/?book_id=${bookId}`).then(reviews => {
    document.getElementById('modalReviewList').innerHTML = reviews.length > 0 ? reviews.map(r => `
      <div class="review-item">
        <div class="review-rating">⭐ ${r.rating}/5 stars</div>
        <div class="review-text">${r.comment}</div>
        ${r.reply ? `<div class="review-reply">📝 Staff Response: ${r.reply}</div>` : ''}
      </div>
    `).join('') : '<p class="muted">No reviews yet. Be the first!</p>';
  }).catch(e => {
    document.getElementById('modalReviewList').innerHTML = `<div class="alert error">Error loading reviews</div>`;
  });
  
  document.getElementById('bookModal').classList.add('active');
}

function closeBookModal() {
  document.getElementById('bookModal').classList.remove('active');
  currentBookForCart = null;
}

async function addToCartFromModal() {
  if (!currentBookForCart) return;
  try {
    await addToCart(currentBookForCart);
    closeBookModal();
  } catch (e) {
    alert(`Failed to add to cart: ${e.message}`);
  }
}

async function ensureCustomerCart() {
  if (customerCartId) return customerCartId;
  try {
    const existing = await api(`/api/cart/carts/customer/${user.id}/`);
    customerCartId = existing.id;
    return customerCartId;
  } catch (e) {
    if (String(e.message || '').includes('Cart not found') || String(e.message || '').includes('404')) {
      try {
        const created = await api('/api/cart/carts/', {
          method: 'POST',
          body: JSON.stringify({ customer_id: user.id }),
        });
        customerCartId = created.id;
        return customerCartId;
      } catch (_) {
        const retried = await api(`/api/cart/carts/customer/${user.id}/`);
        customerCartId = retried.id;
        return customerCartId;
      }
    }
    throw e;
  }
}

async function addToCart(bookId) {
  try {
    const cartId = await ensureCustomerCart();
    await api('/api/cart/carts/items/', {
      method: 'POST',
      body: JSON.stringify({ cart: cartId, book_id: bookId, quantity: 1 }),
    });
    await loadCart();
  } catch (e) {
    console.error('Error adding to cart:', e);
    throw e;
  }
}

async function updateCartItemQuantity(itemId, quantity) {
  if (quantity <= 0) {
    await removeCartItem(itemId);
    return;
  }
  await api(`/api/cart/carts/items/${itemId}/`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
  await loadCart();
}

async function removeCartItem(itemId) {
  await api(`/api/cart/carts/items/${itemId}/`, { method: 'DELETE' });
  await loadCart();
}

async function loadCart() {
  try {
    const cartId = await ensureCustomerCart();
    const cart = await api(`/api/cart/carts/customer/${user.id}/`);
    customerCartId = cartId || cart.id;
    if (!cart.items || cart.items.length === 0) {
      document.getElementById('cartList').innerHTML = '<p class="muted">Your cart is empty. Start shopping! 🛍️</p>';
      return;
    }
    let total = 0;
    const rows = [];
    for (const item of cart.items) {
      const book = await api(`/api/book/books/${item.book_id}/`);
      const line = Number(book.price) * item.quantity;
      total += line;
      rows.push(`
        <tr>
          <td>${book.title}</td>
          <td style="text-align: center;">$${Number(book.price).toFixed(2)}</td>
          <td style="text-align: center;">
            <button onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})" style="padding:4px 10px; margin-right:6px;">-</button>
            <strong>${item.quantity}</strong>
            <button onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})" style="padding:4px 10px; margin-left:6px;">+</button>
          </td>
          <td style="text-align: right;">$${line.toFixed(2)}</td>
          <td style="text-align: right;">
            <button class="danger" onclick="removeCartItem(${item.id})">Remove</button>
          </td>
        </tr>
      `);
    }
    document.getElementById('cartList').innerHTML = `
      <table>
        <thead><tr><th>Book</th><th>Unit Price</th><th>Quantity</th><th>Subtotal</th><th>Action</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div style="margin-top: 18px; padding-top: 18px; border-top: 2px solid var(--line);">
        <div style="font-size: 1.1rem; font-weight: 700;">Total: <span style="background: linear-gradient(135deg, #6366f1 0%, #f59e0b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">$${total.toFixed(2)}</span></div>
      </div>
    `;
  } catch (e) {
    console.error('Error loading cart:', e);
    document.getElementById('cartList').innerHTML = `<div class="alert error">Error loading cart</div>`;
  }
}

async function checkout() {
  try {
    const validationError = validatePaymentDetails();
    if (validationError) {
      document.getElementById('checkoutMsg').innerHTML = `<div class="alert error">✗ ${validationError}</div>`;
      return;
    }

    const payload = {
      customer_id: user.id,
      address: document.getElementById('shipAddress').value || 'N/A',
      pay_method: document.getElementById('payMethod').value,
      ship_method: document.getElementById('shipMethod').value,
      payment_details: collectPaymentDetails(),
    };
    const order = await api('/api/order/orders/', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('checkoutMsg').innerHTML = `<div class="alert success">✓ Order #${order.id} placed successfully! Status: ${order.status}</div>`;
    document.getElementById('shipAddress').value = '';
    await Promise.all([loadCart(), loadOrders()]);
  } catch (e) {
    document.getElementById('checkoutMsg').innerHTML = `<div class="alert error">✗ Checkout failed: ${e.message}</div>`;
  }
}

async function loadOrders() {
  try {
    const orders = await api(`/api/order/orders/?customer_id=${user.id}`);
    if (!orders.length) {
      document.getElementById('orderList').innerHTML = '<p class="muted">No orders yet. Start shopping! 🛍️</p>';
      return;
    }

    const orderCards = await Promise.all(orders.map(async (o) => {
      const status = String(o.status || '').toLowerCase();
      const canReview = status === 'confirm';
      const enrichedItems = await Promise.all((o.items || []).map(async (i) => {
        try {
          const b = await api(`/api/book/books/${i.book_id}/`);
          return {
            id: i.book_id,
            title: b.title || `Book #${i.book_id}`,
            image: b.image_url || '',
            quantity: i.quantity,
            price: Number(i.price || 0),
          };
        } catch {
          return {
            id: i.book_id,
            title: `Book #${i.book_id}`,
            image: '',
            quantity: i.quantity,
            price: Number(i.price || 0),
          };
        }
      }));

      const itemsHtml = enrichedItems.length
        ? enrichedItems.map((item) => `
          <div style="display:flex; gap:10px; align-items:center; margin:8px 0; padding:8px; background:#fff; border:1px solid var(--line); border-radius:8px;">
            <img src="${resolveBookImageUrl(item.image, 'https://via.placeholder.com/64x84?text=Book')}" alt="${item.title}" style="width:64px; height:84px; object-fit:cover; border-radius:6px; flex-shrink:0;" onerror="this.onerror=null;this.src='https://via.placeholder.com/64x84?text=Book';" />
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; color:var(--ink);">${item.title}</div>
              <div class="muted">Qty: ${item.quantity} | Unit: $${item.price.toFixed(2)}</div>
              ${canReview ? `<button onclick="openCustomerReviewModal(${item.id})" style="margin-top:6px;">⭐ Review</button>` : '<div class="muted" style="margin-top:6px; font-size:0.85rem;">Review available after staff approves this order</div>'}
            </div>
          </div>
        `).join('')
        : '<p class="muted" style="margin: 6px 0 0;">No items</p>';

      return `
      <div style="padding: 14px; background: linear-gradient(135deg, #f0f4f8 0%, #e0e7ff 100%); border-left: 5px solid var(--primary); margin-bottom: 12px; border-radius: 8px;">
        <div style="font-weight: 700; margin-bottom: 6px;">📦 Order #${o.id}</div>
        <div class="muted">Amount: <strong style="color: var(--primary);">$${Number(o.total_amount || 0).toFixed(2)}</strong></div>
        <div style="margin-top: 4px;"><span class="status-${String(o.status).toLowerCase()}">${o.status}</span></div>
        <div class="muted">Shipping Method: ${o.ship_method || 'N/A'}</div>
        <div class="muted">Shipping Address: ${o.shipping_address || 'N/A'}</div>
        <div class="muted" style="margin-top: 8px;">Items:</div>
        ${itemsHtml}
      </div>
    `;
    }));

    document.getElementById('orderList').innerHTML = orderCards.join('');
  } catch (e) {
    console.error('Error loading orders:', e);
  }
}

async function loadReviewBooks() {
  try {
    const orders = await api(`/api/order/orders/?customer_id=${user.id}`);
    const validOrders = orders.filter(o => String(o.status || '').toLowerCase() === 'confirm');
    const purchasedIds = new Set();
    validOrders.forEach(o => (o.items || []).forEach(i => purchasedIds.add(Number(i.book_id))));

    const allBooks = await api('/api/book/books/');
    const bookMap = new Map((allBooks || []).map(b => [Number(b.id), b]));
    purchasedReviewBooks = [...purchasedIds].map(id => {
      const b = bookMap.get(id) || { id, title: `Book #${id}`, image_url: '' };
      return { id: Number(b.id), title: b.title, image_url: b.image_url || '' };
    });

    const purchasedEl = document.getElementById('customerPurchasedReviewList');
    if (purchasedEl) {
      purchasedEl.innerHTML = purchasedReviewBooks.length > 0
        ? `<div class="grid">${purchasedReviewBooks.map(b => `
            <div class="card" style="margin:0;">
              <div style="display:flex; gap:10px; align-items:center;">
                <img src="${resolveBookImageUrl(b.image_url, 'https://via.placeholder.com/60x80?text=Book')}" alt="${b.title}" style="width:60px; height:80px; object-fit:cover; border-radius:8px;" onerror="this.onerror=null;this.src='https://via.placeholder.com/60x80?text=Book';" />
                <div style="flex:1;">
                  <div style="font-weight:700;">${b.title}</div>
                  <button class="primary" onclick="openCustomerReviewModal(${b.id})" style="margin-top:8px;">Write Review</button>
                </div>
              </div>
            </div>
          `).join('')}</div>`
        : '<p class="muted">No purchased books available for review yet.</p>';
    }

    await loadMyReviews();
  } catch (e) {
    console.error('Error loading review books:', e);
  }
}

async function loadReviews() {
  // Legacy wrapper kept for compatibility.
  await loadMyReviews();
}

async function loadMyReviews() {
  try {
    const reviews = await api('/api/rate/reviews/');
    const mine = (reviews || []).filter(r => Number(r.customer_id) === Number(user.id));
    myReviewMapByBookId = new Map(mine.map(r => [Number(r.book_id), r]));

    const allBooks = await api('/api/book/books/');
    const bookNameById = new Map((allBooks || []).map(b => [Number(b.id), b.title || `Book #${b.id}`]));
    document.getElementById('myReviewList').innerHTML = mine.length > 0 ? mine.map(r => `
      <div class="review-item">
        <div style="font-weight: 700; margin-bottom: 6px;">📖 ${bookNameById.get(Number(r.book_id)) || `Book #${r.book_id}`}</div>
        <div class="review-rating">⭐ ${r.rating}/5</div>
        <div class="review-text">${r.comment}</div>
        <button onclick="openCustomerReviewModal(${r.book_id})" style="margin-top:8px;">Edit Review</button>
        ${r.reply ? `<div class="review-reply">📝 Staff Response: ${r.reply}</div>` : '<div class="muted" style="font-size: 0.85rem; margin-top: 8px;">⏳ Waiting for staff response...</div>'}
      </div>
    `).join('') : '<p class="muted">You have not reviewed any purchased books yet.</p>';
  } catch (e) {
    console.error('Error loading reviews:', e);
  }
}

function ensureCustomerReviewModal() {
  if (document.getElementById('customerReviewModal')) return;

  const modal = document.createElement('div');
  modal.id = 'customerReviewModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 680px;">
      <button class="modal-close" onclick="closeCustomerReviewModal()">&times;</button>
      <h3 style="margin-top:0;">⭐ Review Purchased Book</h3>
      <div id="customerReviewBookInfo" class="muted" style="margin-bottom: 10px;"></div>
      <select id="customerReviewRating" style="margin-bottom: 10px;">
        <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
        <option value="4">⭐⭐⭐⭐ 4 Stars</option>
        <option value="3">⭐⭐⭐ 3 Stars</option>
        <option value="2">⭐⭐ 2 Stars</option>
        <option value="1">⭐ 1 Star</option>
      </select>
      <textarea id="customerReviewText" rows="4" placeholder="Share your experience with this book..."></textarea>
      <p id="customerReviewMsg" class="muted" style="margin-top: 10px;"></p>
      <div class="row" style="margin-top: 12px; justify-content: flex-end;">
        <button onclick="closeCustomerReviewModal()">Cancel</button>
        <button class="primary" onclick="submitCustomerReview()">Submit Review</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeCustomerReviewModal();
  });
  document.body.appendChild(modal);
}

function openCustomerReviewModal(bookId) {
  ensureCustomerReviewModal();
  const modal = document.getElementById('customerReviewModal');
  const book = purchasedReviewBooks.find(b => Number(b.id) === Number(bookId));
  const existing = myReviewMapByBookId.get(Number(bookId));

  modal.dataset.bookId = String(bookId);
  document.getElementById('customerReviewBookInfo').innerHTML = book
    ? `<strong>${book.title}</strong> (Book #${book.id})`
    : `<strong>Book #${bookId}</strong>`;
  document.getElementById('customerReviewRating').value = String(existing?.rating || 5);
  document.getElementById('customerReviewText').value = String(existing?.comment || '');
  document.getElementById('customerReviewMsg').innerText = existing ? 'Updating your existing review.' : '';
  modal.classList.add('active');
}

function closeCustomerReviewModal() {
  const modal = document.getElementById('customerReviewModal');
  if (!modal) return;
  modal.classList.remove('active');
}

async function postReview() {
  // Legacy wrapper kept for compatibility.
  await submitCustomerReview();
}

async function submitCustomerReview() {
  try {
    const modal = document.getElementById('customerReviewModal');
    if (!modal) return;
    const bookId = Number(modal.dataset.bookId || 0);
    if (!bookId) return;

    const isPurchased = purchasedReviewBooks.some(b => Number(b.id) === Number(bookId));
    if (!isPurchased) {
      document.getElementById('customerReviewMsg').innerText = 'You can only review books that you have purchased.';
      return;
    }

    const rating = Number(document.getElementById('customerReviewRating').value);
    const comment = String(document.getElementById('customerReviewText').value || '').trim();
    if (!comment) {
      document.getElementById('customerReviewMsg').innerText = 'Please write your review comment.';
      return;
    }

    const existing = myReviewMapByBookId.get(Number(bookId));
    const payload = {
      customer_id: user.id,
      book_id: bookId,
      rating,
      comment,
    };

    if (existing) {
      await api(`/api/rate/reviews/${existing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ rating, comment }),
      });
    } else {
      await api('/api/rate/reviews/', { method: 'POST', body: JSON.stringify(payload) });
    }

    closeCustomerReviewModal();
    await Promise.all([loadReviewBooks(), loadOrders()]);
  } catch (e) {
    const msgEl = document.getElementById('customerReviewMsg');
    if (msgEl) msgEl.innerText = `Failed to submit review: ${e.message}`;
    else alert(`Failed to post review: ${e.message}`);
  }
}

async function loadStaffData() {
  try {
    renderCategorySelects();
    ensureStaffBookEditModal();
    await Promise.all([loadStaffBooks(), loadStaffOrders(), loadStaffReviews()]);
  } catch (e) {
    console.error('Error loading staff data:', e);
  }
}

async function loadStaffBooks() {
  try {
    const books = await api('/api/book/books/');
    const keyword = String(document.getElementById('sInventorySearch')?.value || '').trim().toLowerCase();
    const filtered = !keyword
      ? books
      : books.filter(b => {
        const searchable = [
          String(b.id || ''),
          String(b.title || ''),
          String(b.author || ''),
          String(b.category || ''),
        ].join(' ').toLowerCase();
        return searchable.includes(keyword);
      });

    const rows = filtered.map(b => `
      <tr>
        <td>${b.id}</td>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${categoryLabel(b.category)}</td>
        <td>$${Number(b.price).toFixed(2)}</td>
        <td style="text-align: center;">${b.stock}</td>
        <td>${b.image_url ? `<a href="${b.image_url}" target="_blank" rel="noopener noreferrer">View</a>` : '<span class="muted">N/A</span>'}</td>
        <td>
          <button onclick="openStaffBookEditModal(${b.id})" style="margin-right:8px;">Update</button>
          <button class="danger" onclick="staffDeleteBook(${b.id})">Delete</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('staffBookTable').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Title</th><th>Author</th><th>Category</th><th>Price</th><th>Stock</th><th>Image</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8" class="muted">No books</td></tr>'}</tbody>
      </table>
    `;
  } catch (e) {
    console.error('Error loading staff books:', e);
  }
}

async function staffAddBook() {
  try {
    const payload = {
      title: document.getElementById('sTitle').value,
      author: document.getElementById('sAuthor').value,
      category: document.getElementById('sCategory').value,
      price: Number(document.getElementById('sPrice').value),
      stock: Number(document.getElementById('sStock').value),
      image_url: document.getElementById('sImageUrl').value,
    };
    await api('/api/book/books/', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('sTitle').value = document.getElementById('sAuthor').value = document.getElementById('sPrice').value = document.getElementById('sStock').value = document.getElementById('sImageUrl').value = '';
    await loadStaffBooks();
  } catch (e) {
    alert(`Failed to add book: ${e.message}`);
  }
}

function ensureStaffBookEditModal() {
  if (document.getElementById('staffBookEditModal')) return;

  const categoryOptions = BOOK_CATEGORIES
    .filter(c => c.value)
    .map(c => `<option value="${c.value}">${c.label}</option>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'staffBookEditModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 720px;">
      <button class="modal-close" onclick="closeStaffBookEditModal()">&times;</button>
      <h3 style="margin-top: 0;">🛠️ Update Book</h3>
      <p class="muted" style="margin-top: 0;">Edit each field below and save changes.</p>
      <div class="row" style="margin-bottom: 10px;">
        <input id="editBookTitle" placeholder="Title" />
        <input id="editBookAuthor" placeholder="Author" />
      </div>
      <div class="row" style="margin-bottom: 10px;">
        <select id="editBookCategory">${categoryOptions}</select>
        <input id="editBookPrice" type="number" step="0.01" min="0" placeholder="Price" />
      </div>
      <div class="row" style="margin-bottom: 10px;">
        <input id="editBookStock" type="number" min="0" placeholder="Stock" />
        <input id="editBookImageUrl" placeholder="Image URL" />
      </div>
      <p id="editBookMsg" class="muted" style="margin: 6px 0 0;"></p>
      <div class="row" style="margin-top: 14px; justify-content: flex-end;">
        <button onclick="closeStaffBookEditModal()">Cancel</button>
        <button class="primary" onclick="saveStaffBookUpdate()">Save Changes</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeStaffBookEditModal();
  });

  document.body.appendChild(modal);
}

async function openStaffBookEditModal(id) {
  try {
    ensureStaffBookEditModal();
    const book = await api(`/api/book/books/${id}/`);
    staffEditingBookId = id;

    document.getElementById('editBookTitle').value = String(book.title || '');
    document.getElementById('editBookAuthor').value = String(book.author || '');
    document.getElementById('editBookCategory').value = String(book.category || 'other');
    document.getElementById('editBookPrice').value = String(book.price ?? '0');
    document.getElementById('editBookStock').value = String(book.stock ?? '0');
    document.getElementById('editBookImageUrl').value = String(book.image_url || '');
    document.getElementById('editBookMsg').innerText = '';

    document.getElementById('staffBookEditModal').classList.add('active');
  } catch (e) {
    alert(`Failed to open update modal: ${e.message}`);
  }
}

function closeStaffBookEditModal() {
  const modal = document.getElementById('staffBookEditModal');
  if (!modal) return;
  modal.classList.remove('active');
  staffEditingBookId = null;
}

async function saveStaffBookUpdate() {
  if (!staffEditingBookId) return;

  const payload = {
    title: String(document.getElementById('editBookTitle').value || '').trim(),
    author: String(document.getElementById('editBookAuthor').value || '').trim(),
    category: String(document.getElementById('editBookCategory').value || '').trim(),
    price: Number(document.getElementById('editBookPrice').value),
    stock: Number(document.getElementById('editBookStock').value),
    image_url: String(document.getElementById('editBookImageUrl').value || '').trim(),
  };

  if (!payload.title || !payload.author || !payload.category) {
    document.getElementById('editBookMsg').innerText = 'Please fill title, author and category.';
    return;
  }
  if (Number.isNaN(payload.price) || payload.price < 0) {
    document.getElementById('editBookMsg').innerText = 'Price must be a valid number >= 0.';
    return;
  }
  if (Number.isNaN(payload.stock) || payload.stock < 0) {
    document.getElementById('editBookMsg').innerText = 'Stock must be a valid number >= 0.';
    return;
  }

  try {
    await api(`/api/book/books/${staffEditingBookId}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    closeStaffBookEditModal();
    await loadStaffBooks();
  } catch (e) {
    document.getElementById('editBookMsg').innerText = `Failed to update: ${e.message}`;
  }
}

async function staffUpdateBook(id) {
  await openStaffBookEditModal(id);
}

async function staffDeleteBook(id) {
  if(!confirm('Delete this book?')) return;
  try {
    await api(`/api/book/books/${id}/`, { method: 'DELETE' });
    await loadStaffBooks();
  } catch (e) {
    alert(`Failed to delete: ${e.message}`);
  }
}

async function loadStaffOrders() {
  try {
    const [orders, books] = await Promise.all([
      api('/api/order/orders/'),
      api('/api/book/books/'),
    ]);
    const bookNameById = new Map((books || []).map(b => [Number(b.id), b.title || `Book #${b.id}`]));

    document.getElementById('staffOrderList').innerHTML = orders.length > 0 ? orders.map(o => {
      const isPendingApproval = String(o.status).toLowerCase() === 'pendingapproval';
      const itemsHtml = (o.items || []).length > 0
        ? (o.items || []).map(item => {
          const title = bookNameById.get(Number(item.book_id)) || `Book #${item.book_id}`;
          return `<div class="muted">• ${title} | Qty: ${item.quantity}</div>`;
        }).join('')
        : '<div class="muted">No items</div>';

      return `
      <div style="padding: 12px; margin-bottom: 10px; background: linear-gradient(135deg, #f0f4f8 0%, #e0e7ff 100%); border-radius: 8px;">
        <div><strong>#${o.id}</strong> - Customer ${o.customer_id} - <span class="status-${String(o.status).toLowerCase()}">${o.status}</span></div>
        <div class="muted" style="margin-top: 6px;">Amount: $${Number(o.total_amount || 0).toFixed(2)}</div>
        <div class="muted">Shipping address: ${o.shipping_address || 'N/A'}</div>
        <div class="muted">Shipping method: ${o.ship_method || 'N/A'}</div>
        <div class="muted">Payment method: ${o.pay_method || 'N/A'}</div>
        <div class="muted" style="margin-top: 6px;">Items:</div>
        ${itemsHtml}
        ${o.rejection_reason ? `<div style="margin-top: 6px; color: var(--danger);"><strong>Reason:</strong> ${o.rejection_reason}</div>` : ''}
        ${isPendingApproval ? `
          <div class="row" style="margin-top: 10px;">
            <button class="primary" onclick="staffApproveOrder(${o.id})">Accept</button>
            <button class="danger" onclick="staffRejectOrder(${o.id})">Reject</button>
          </div>
          <textarea id="rejectReason-${o.id}" rows="2" placeholder="Reason for rejection (required if reject)" style="margin-top: 8px;"></textarea>
        ` : ''}
      </div>
    `;
    }).join('') : '<p class="muted">No orders</p>';

    const [payments, shipments] = await Promise.all([api('/api/pay/payments/'), api('/api/ship/shipments/')]);
    document.getElementById('staffOpsStatus').innerHTML = `
      <div><strong>💳 ${payments.length}</strong> Payment records</div>
      <div style="margin-top: 12px;"><strong>📦 ${shipments.length}</strong> Shipment records</div>
    `;
  } catch (e) {
    console.error('Error loading staff orders:', e);
  }
}

async function staffApproveOrder(orderId) {
  try {
    await api(`/api/order/orders/${orderId}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Confirm', rejection_reason: '' }),
    });
    await loadStaffOrders();
  } catch (e) {
    alert(`Failed to accept order: ${e.message}`);
  }
}

async function staffRejectOrder(orderId) {
  try {
    const reason = String(document.getElementById(`rejectReason-${orderId}`)?.value || '').trim();
    if (!reason) {
      alert('Please provide rejection reason.');
      return;
    }

    await api(`/api/order/orders/${orderId}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Rejected', rejection_reason: reason }),
    });
    await loadStaffOrders();
  } catch (e) {
    alert(`Failed to reject order: ${e.message}`);
  }
}

async function loadStaffReviews() {
  try {
    const [reviews, books] = await Promise.all([api('/api/rate/reviews/'), api('/api/book/books/')]);
    staffReviewCache = reviews || [];
    staffReviewBookNameById = new Map((books || []).map(b => [Number(b.id), b.title || `Book #${b.id}`]));

    const grouped = new Map();
    staffReviewCache.forEach(r => {
      const key = Number(r.book_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(r);
    });

    const bookListEl = document.getElementById('staffReviewBookList');
    const detailEl = document.getElementById('staffReviewDetail');
    if (!bookListEl || !detailEl) return;

    if (grouped.size === 0) {
      bookListEl.innerHTML = '<p class="muted">No customer reviews yet.</p>';
      detailEl.innerHTML = '<p class="muted">Select a book to view review details.</p>';
      staffSelectedReviewBookId = null;
      return;
    }

    const entries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
    bookListEl.innerHTML = entries.map(([bookId, reviewsByBook]) => {
      const avg = reviewsByBook.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewsByBook.length;
      const title = staffReviewBookNameById.get(Number(bookId)) || `Book #${bookId}`;
      return `
        <div class="card" style="margin:0 0 10px; cursor:pointer;" onclick="staffSelectReviewBook(${bookId})">
          <div style="font-weight:700;">${title}</div>
          <div class="muted">${reviewsByBook.length} review(s) | Avg ⭐ ${avg.toFixed(1)}</div>
        </div>
      `;
    }).join('');

    const defaultBookId = entries.some(([id]) => Number(id) === Number(staffSelectedReviewBookId))
      ? Number(staffSelectedReviewBookId)
      : Number(entries[0][0]);
    staffSelectReviewBook(defaultBookId);
  } catch (e) {
    console.error('Error loading staff reviews:', e);
  }
}

function staffSelectReviewBook(bookId) {
  staffSelectedReviewBookId = Number(bookId);
  const detailEl = document.getElementById('staffReviewDetail');
  if (!detailEl) return;

  const title = staffReviewBookNameById.get(Number(bookId)) || `Book #${bookId}`;
  const reviews = staffReviewCache.filter(r => Number(r.book_id) === Number(bookId));
  detailEl.innerHTML = reviews.length > 0 ? reviews.map(r => `
    <div class="card" style="margin:0 0 12px;">
      <div style="margin-bottom: 8px;"><strong>${title}</strong> - ⭐ ${r.rating}/5</div>
      <div class="muted" style="margin-bottom:6px;">Customer #${r.customer_id}</div>
      <p style="margin: 0 0 10px; color: var(--ink);">"${r.comment}"</p>
      <textarea id="reply-${r.id}" placeholder="✍️ Reply to this review..." rows="2" style="margin-bottom: 8px;">${r.reply || ''}</textarea>
      <button class="primary" onclick="replyReview(${r.id})" style="width: 100%;">Post Reply</button>
    </div>
  `).join('') : '<p class="muted">No reviews for this book.</p>';
}

async function replyReview(reviewId) {
  try {
    const reply = document.getElementById(`reply-${reviewId}`).value;
    await api(`/api/rate/reviews/${reviewId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ reply, replied_by_staff_id: user.id }),
    });
    await loadStaffReviews();
    if (staffSelectedReviewBookId) {
      staffSelectReviewBook(staffSelectedReviewBookId);
    }
  } catch (e) {
    alert(`Failed to post reply: ${e.message}`);
  }
}

async function loadManagerData() {
  try {
    const [orders, staff] = await Promise.all([api('/api/order/orders/'), api('/api/staff/staff/')]);
    const confirmed = orders.filter(o => String(o.status).toLowerCase() === 'confirm');
    const revenue = confirmed.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    document.getElementById('kpiRevenue').innerText = `$${revenue.toFixed(2)}`;
    document.getElementById('kpiOrders').innerText = String(confirmed.length);
    document.getElementById('kpiStaff').innerText = String(staff.length);

    document.getElementById('managerStaffTable').innerHTML = `<table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${staff.map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.email || ''}</td><td>${s.role}</td><td><button class="danger" onclick="managerDeleteStaff(${s.id})">Remove</button></td></tr>`).join('')}</tbody></table>`;
    document.getElementById('managerRevenueTable').innerHTML = `<table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>${orders.map(o => `<tr><td>#${o.id}</td><td>${o.customer_id}</td><td>$${Number(o.total_amount || 0).toFixed(2)}</td><td class="status-${String(o.status).toLowerCase()}">${o.status}</td></tr>`).join('')}</tbody></table>`;
  } catch (e) {
    console.error('Error loading manager data:', e);
  }
}

async function managerCreateStaff() {
  try {
    const payload = {
      name: document.getElementById('mStaffName').value,
      email: document.getElementById('mStaffEmail').value,
      role: document.getElementById('mStaffRole').value,
      password: document.getElementById('mStaffPass').value,
    };
    await api('/api/staff/staff/', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('mStaffMsg').innerText = '✓ Staff account created successfully!';
    document.getElementById('mStaffName').value = document.getElementById('mStaffEmail').value = document.getElementById('mStaffRole').value = document.getElementById('mStaffPass').value = '';
    await loadManagerData();
  } catch (e) {
    document.getElementById('mStaffMsg').innerText = `✗ Failed: ${e.message}`;
  }
}

async function managerDeleteStaff(id) {
  if(!confirm('Remove this staff member?')) return;
  try {
    await api(`/api/staff/staff/${id}/`, { method: 'DELETE' });
    await loadManagerData();
  } catch (e) {
    alert(`Failed to delete: ${e.message}`);
  }
}

(async function bootstrapSession() {
  if (restoreSession()) {
    try {
      // Load appropriate data based on current page
      const currentPage = window.location.pathname;
      if (currentPage.includes('customer.html')) {
              if (role !== 'customer') {
                  window.location.href = 'index.html';
                  return;
                }
        setUserBadge();
        await loadCustomerData();
      } else if (currentPage.includes('staff.html')) {
              if (role !== 'staff') {
                  window.location.href = 'index.html';
                  return;
                }
        setUserBadge();
        await loadStaffData();
      } else if (currentPage.includes('manager.html')) {
              if (role !== 'manager') {
                  window.location.href = 'index.html';
                  return;
                }
        setUserBadge();
        await loadManagerData();
      } else {
        // On index.html, redirect to appropriate dashboard
        if (currentPage.includes('index.html')) {
          window.location.href = role === 'customer' ? 'customer.html' : (role === 'staff' ? 'staff.html' : 'manager.html');
        }
        show('authView');
        return;
      }
      return;
    } catch (e) {
      console.error('Session restore failed:', e);
      logout();
      return;
    }
  } else {
    // No session - check if we're on a dashboard page and redirect to login
    const currentPage = window.location.pathname;
    if (currentPage.includes('customer.html') || currentPage.includes('staff.html') || currentPage.includes('manager.html')) {
      window.location.href = 'index.html';
      return;
    }
  }
})();
