import { db } from '../firebase-config.js';
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- GLOBAL STATE & UTILITIES ---
const cart = JSON.parse(localStorage.getItem('cart')) || [];
const coupon = JSON.parse(localStorage.getItem('coupon')) || null;
const RAZORPAY_KEY_ID = 'rzp_test_YOUR_KEY_ID'; // IMPORTANT: Replace with your Razorpay Key ID

const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
};

const updateCartCount = () => {
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountEl.textContent = totalItems;
    }
};

const saveCart = () => {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
};

// --- PAGE-SPECIFIC LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    updateCartCount();

    if (path.endsWith('index.html') || path === '/') {
        initHomePage();
    } else if (path.endsWith('cart.html')) {
        initCartPage();
    } else if (path.endsWith('checkout.html')) {
        initCheckoutPage();
    }
});


// --- HOME PAGE ---
async function initHomePage() {
    await loadBanner();
    await loadProducts();
}

async function loadBanner() {
    const bannerRef = collection(db, "banners");
    const querySnapshot = await getDocs(bannerRef);
    const heroBanner = document.getElementById('hero-banner');
    let activeBanner = null;

    querySnapshot.forEach((doc) => {
        const banner = doc.data();
        if (banner.active) activeBanner = banner;
    });

    if (activeBanner) {
        heroBanner.innerHTML = `
            <img src="${activeBanner.imageUrl}" alt="${activeBanner.title}">
            <h2>${activeBanner.title}</h2>
            <p>${activeBanner.subtitle}</p>
        `;
    } else {
        heroBanner.innerHTML = '<h2>Welcome to Pharma Express</h2>';
    }
}

async function loadProducts() {
    const productsRef = collection(db, "products");
    const querySnapshot = await getDocs(productsRef);
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';

    querySnapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        if (product.visible && product.stock > 0) {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <img src="${product.imageUrl}" alt="${product.name}">
                <h3>${product.name}</h3>
                <div class="price-container">
                    <span class="product-price">₹${product.sellingPrice}</span>
                    <span class="mrp">₹${product.price}</span>
                </div>
                <button class="btn-primary add-to-cart-btn">Add to Cart</button>
            `;
            productCard.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(product));
            productGrid.appendChild(productCard);
        }
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
            showToast(`${product.name} quantity updated.`);
        } else {
            showToast(`Maximum stock limit reached for ${product.name}.`);
        }
    } else {
        cart.push({ ...product, quantity: 1 });
        showToast(`${product.name} added to cart.`);
    }
    saveCart();
}

// --- CART PAGE ---
function initCartPage() {
    renderCartItems();
    document.getElementById('apply-coupon-btn').addEventListener('click', applyCoupon);
}

function renderCartItems() {
    const cartItemsEl = document.getElementById('cart-items');
    const checkoutBtn = document.getElementById('checkout-btn');
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p>Your cart is empty.</p>';
        checkoutBtn.disabled = true;
    } else {
        cartItemsEl.innerHTML = cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.imageUrl}" alt="${item.name}">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>₹${item.sellingPrice}</p>
                </div>
                <div class="quantity-selector">
                    <button class="quantity-decrease">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-increase">+</button>
                </div>
                <button class="remove-item-btn">Remove</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
    addCartEventListeners();
    updateCartSummary();
}

function addCartEventListeners() {
    document.querySelectorAll('.cart-item').forEach(el => {
        const id = el.dataset.id;
        el.querySelector('.quantity-increase').addEventListener('click', () => updateQuantity(id, 1));
        el.querySelector('.quantity-decrease').addEventListener('click', () => updateQuantity(id, -1));
        el.querySelector('.remove-item-btn').addEventListener('click', () => removeFromCart(id));
    });
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        const newQuantity = item.quantity + change;
        if (newQuantity > 0 && newQuantity <= item.stock) {
            item.quantity = newQuantity;
        } else if (newQuantity > item.stock) {
            showToast(`Only ${item.stock} units available.`);
        }
        saveCart();
        renderCartItems();
    }
}

function removeFromCart(productId) {
    const itemIndex = cart.findIndex(i => i.id === productId);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1);
        saveCart();
        renderCartItems();
    }
}

function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    let discount = 0;
    const couponMsgEl = document.getElementById('coupon-message');

    if (coupon) {
        if (subtotal >= coupon.minCartValue) {
            discount = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
            couponMsgEl.textContent = `Coupon "${coupon.code}" applied!`;
            couponMsgEl.style.color = 'green';
        } else {
            couponMsgEl.textContent = `Coupon requires a minimum cart value of ₹${coupon.minCartValue}.`;
            couponMsgEl.style.color = 'red';
            localStorage.removeItem('coupon'); // Invalidate coupon
        }
    } else {
        couponMsgEl.textContent = '';
    }

    const total = subtotal - discount;

    document.getElementById('summary-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('summary-discount').textContent = `- ₹${discount.toFixed(2)}`;
    document.getElementById('summary-total').textContent = `₹${total.toFixed(2)}`;
    document.getElementById('checkout-btn').addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });
}

async function applyCoupon() {
    const codeInput = document.getElementById('coupon-code');
    const code = codeInput.value.toUpperCase().trim();
    if (!code) return;

    const couponRef = doc(db, "coupons", code);
    const couponSnap = await getDoc(couponRef);

    if (couponSnap.exists()) {
        const couponData = couponSnap.data();
        const now = new Date();
        const expiry = couponData.expiryDate.toDate();

        if (couponData.active && now < expiry) {
            localStorage.setItem('coupon', JSON.stringify({ code, ...couponData }));
            window.coupon = { code, ...couponData }; // Update global state
            showToast('Coupon applied successfully!');
        } else {
            showToast('This coupon is inactive or has expired.');
        }
    } else {
        showToast('Invalid coupon code.');
    }
    updateCartSummary();
}

// --- CHECKOUT PAGE ---
function initCheckoutPage() {
    if (cart.length === 0) {
        window.location.href = 'index.html';
        return;
    }
    renderCheckoutSummary();
    document.getElementById('checkout-form').addEventListener('submit', handleOrderPlacement);
}

function renderCheckoutSummary() {
    const summaryItemsEl = document.getElementById('summary-items');
    const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    let discount = 0;

    if (coupon && subtotal >= coupon.minCartValue) {
        discount = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
    }
    const total = subtotal - discount;

    summaryItemsEl.innerHTML = cart.map(item => `<p>${item.name} (x${item.quantity})</p>`).join('');
    document.getElementById('summary-total-pay').textContent = `₹${total.toFixed(2)}`;
}

async function handleOrderPlacement(e) {
    e.preventDefault();
    const payBtn = document.getElementById('pay-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';

    const customerDetails = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
    };

    const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    let discount = 0;
    if (coupon && subtotal >= coupon.minCartValue) {
        discount = coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
    }
    const totalAmount = subtotal - discount;

    const orderData = {
        customer: customerDetails,
        items: cart,
        subtotal,
        discount,
        total: totalAmount,
        couponUsed: coupon ? coupon.code : null,
        status: 'Pending',
        paymentStatus: 'Pending',
        createdAt: serverTimestamp(),
    };
    
    // Create a preliminary order document in Firestore to get an Order ID
    const orderRef = await addDoc(collection(db, "orders"), orderData);

    // Proceed with Razorpay payment
    const options = {
        key: RAZORPAY_KEY_ID,
        amount: Math.round(totalAmount * 100), // Amount in paise
        currency: "INR",
        name: "Pharma Express",
        description: `Order ID: ${orderRef.id}`,
        order_id: orderRef.id, // Using Firestore doc ID as order ID
        handler: async function (response) {
            // Payment successful
            await updateDoc(doc(db, "orders", orderRef.id), {
                paymentStatus: 'Paid',
                paymentId: response.razorpay_payment_id
            });
            // Decrease stock
            for (const item of cart) {
                const productRef = doc(db, "products", item.id);
                const newStock = item.stock - item.quantity;
                await updateDoc(productRef, { stock: newStock });
            }
            window.location.href = `success.html?orderId=${orderRef.id}&amount=${totalAmount.toFixed(2)}`;
        },
        prefill: {
            name: customerDetails.name,
            email: customerDetails.email,
            contact: customerDetails.phone,
        },
        theme: {
            color: "#007bff",
        },
        modal: {
            ondismiss: async function() {
                // Payment modal closed without payment
                await updateDoc(doc(db, "orders", orderRef.id), {
                    status: 'Cancelled',
                    paymentStatus: 'Failed'
                });
                showToast('Payment was cancelled.');
                payBtn.disabled = false;
                payBtn.textContent = 'Place Order & Pay';
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.open();
}
