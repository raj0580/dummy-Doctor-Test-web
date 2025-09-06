import { db } from '../firebase-config.js';
import {
    collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- IMPORTANT ---
const IMG_BB_API_KEY = 'YOUR_IMGBB_API_KEY'; // REPLACE WITH YOUR IMGBB API KEY

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = link.dataset.target;

            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            // Load data for the clicked page
            switch(targetId) {
                case 'dashboard': loadDashboardStats(); break;
                case 'products': loadProducts(); break;
                case 'orders': loadOrders(); break;
                case 'coupons': loadCoupons(); break;
                case 'banners': loadBannerForm(); break;
            }
        });
    });
    
    // Initial Load
    loadDashboardStats();

    // Modal Handling
    const modal = document.getElementById('form-modal');
    const closeBtn = document.querySelector('.close-btn');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = e => {
        if (e.target == modal) modal.style.display = 'none';
    };
});

// --- Dashboard ---
async function loadDashboardStats() {
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const couponsSnapshot = await getDocs(collection(db, 'coupons'));

    let totalStock = 0;
    productsSnapshot.forEach(doc => { totalStock += doc.data().stock; });
    
    let activeCoupons = 0;
    const now = new Date();
    couponsSnapshot.forEach(doc => {
        const coupon = doc.data();
        if(coupon.active && coupon.expiryDate.toDate() > now) {
            activeCoupons++;
        }
    });

    document.getElementById('total-orders').textContent = ordersSnapshot.size;
    document.getElementById('products-in-stock').textContent = totalStock;
    document.getElementById('active-coupons').textContent = activeCoupons;
}

// --- Product Management ---
document.getElementById('add-product-btn').addEventListener('click', () => openProductForm());

async function loadProducts() {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    const querySnapshot = await getDocs(collection(db, 'products'));
    tbody.innerHTML = '';
    querySnapshot.forEach(doc => {
        const product = { id: doc.id, ...doc.data() };
        const row = `
            <tr>
                <td><img src="${product.imageUrl}" alt="${product.name}"></td>
                <td>${product.name}</td>
                <td>${product.stock}</td>
                <td>₹${product.sellingPrice}</td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" class="visibility-toggle" data-id="${product.id}" ${product.visible ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="actions">
                    <button class="btn-edit" data-id="${product.id}">Edit</button>
                    <button class="btn-delete" data-id="${product.id}">Delete</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    // Add event listeners
    document.querySelectorAll('.visibility-toggle').forEach(toggle => toggle.addEventListener('change', toggleProductVisibility));
    document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => openProductForm(e.target.dataset.id)));
    document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', deleteProduct));
}

async function openProductForm(productId = null) {
    const modalBody = document.getElementById('modal-body');
    let product = {};
    if (productId) {
        const docSnap = await getDoc(doc(db, 'products', productId));
        if (docSnap.exists()) product = docSnap.data();
    }
    
    modalBody.innerHTML = `
        <h3>${productId ? 'Edit' : 'Add'} Product</h3>
        <form id="product-form" data-id="${productId || ''}">
            <input type="text" id="name" placeholder="Name" value="${product.name || ''}" required>
            <textarea id="description" placeholder="Description">${product.description || ''}</textarea>
            <input type="number" id="price" placeholder="MRP" value="${product.price || ''}" required>
            <input type="number" id="sellingPrice" placeholder="Selling Price" value="${product.sellingPrice || ''}" required>
            <input type="number" id="stock" placeholder="Stock" value="${product.stock || ''}" required>
            <label>Image ${productId ? '(leave blank to keep existing)' : ''}</label>
            <input type="file" id="image" accept="image/*" ${productId ? '' : 'required'}>
            <button type="submit" class="btn">Save</button>
        </form>
    `;
    document.getElementById('form-modal').style.display = 'block';
    document.getElementById('product-form').addEventListener('submit', saveProduct);
}

async function saveProduct(e) {
    e.preventDefault();
    const form = e.target;
    const productId = form.dataset.id;
    const imageFile = form.image.files[0];
    let imageUrl = '';

    if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_API_KEY}`, {
            method: 'POST', body: formData
        });
        const result = await response.json();
        if (result.success) {
            imageUrl = result.data.url;
        } else {
            alert('Image upload failed.'); return;
        }
    }

    const productData = {
        name: form.name.value,
        description: form.description.value,
        price: parseFloat(form.price.value),
        sellingPrice: parseFloat(form.sellingPrice.value),
        stock: parseInt(form.stock.value),
    };

    if (imageUrl) productData.imageUrl = imageUrl;
    
    if (productId) {
        await updateDoc(doc(db, 'products', productId), productData);
    } else {
        productData.visible = true; // Default for new products
        await addDoc(collection(db, 'products'), productData);
    }
    document.getElementById('form-modal').style.display = 'none';
    loadProducts();
}

async function toggleProductVisibility(e) {
    const productId = e.target.dataset.id;
    const isVisible = e.target.checked;
    await updateDoc(doc(db, 'products', productId), { visible: isVisible });
}

async function deleteProduct(e) {
    if (confirm('Are you sure you want to delete this product?')) {
        const productId = e.target.dataset.id;
        await deleteDoc(doc(db, 'products', productId));
        loadProducts();
    }
}


// --- Order Management ---
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = 'Loading orders...';
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    container.innerHTML = '';
    querySnapshot.forEach(doc => {
        const order = { id: doc.id, ...doc.data() };
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        orderCard.innerHTML = `
            <div class="order-header">
                <div>
                    <strong>Order ID:</strong> ${order.id}<br>
                    <strong>Date:</strong> ${order.createdAt.toDate().toLocaleString()}
                </div>
                <div>
                    <strong>Status:</strong>
                    <select class="order-status-select" data-id="${order.id}">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
            <div class="order-body">
                <p><strong>Customer:</strong> ${order.customer.name} (${order.customer.email})</p>
                <p><strong>Total:</strong> ₹${order.total.toFixed(2)} (${order.paymentStatus})</p>
                <p><strong>Items:</strong></p>
                <ul>
                    ${order.items.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('')}
                </ul>
            </div>
        `;
        container.appendChild(orderCard);
    });

    document.querySelectorAll('.order-status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.value;
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
            alert('Order status updated!');
        });
    });
}

// --- Coupon Management ---
document.getElementById('add-coupon-btn').addEventListener('click', () => openCouponForm());

async function loadCoupons() {
     const tbody = document.querySelector('#coupons-table tbody');
    tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
    const querySnapshot = await getDocs(collection(db, 'coupons'));
    tbody.innerHTML = '';
    querySnapshot.forEach(doc => {
        const coupon = { id: doc.id, ...doc.data() };
        const expiry = coupon.expiryDate.toDate().toLocaleDateString();
        const row = `
            <tr>
                <td>${coupon.id}</td>
                <td>${coupon.type}</td>
                <td>${coupon.type === 'percentage' ? coupon.value + '%' : '₹' + coupon.value}</td>
                <td>₹${coupon.minCartValue}</td>
                <td>${expiry}</td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" class="active-toggle" data-id="${coupon.id}" ${coupon.active ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="actions">
                    <button class="btn-edit-coupon" data-id="${coupon.id}">Edit</button>
                    <button class="btn-delete-coupon" data-id="${coupon.id}">Delete</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    document.querySelectorAll('.active-toggle').forEach(toggle => toggle.addEventListener('change', toggleCouponActive));
    document.querySelectorAll('.btn-edit-coupon').forEach(btn => btn.addEventListener('click', e => openCouponForm(e.target.dataset.id)));
    document.querySelectorAll('.btn-delete-coupon').forEach(btn => btn.addEventListener('click', deleteCoupon));
}

async function openCouponForm(couponId = null) {
    const modalBody = document.getElementById('modal-body');
    let coupon = {};
    if (couponId) {
        const docSnap = await getDoc(doc(db, 'coupons', couponId));
        if (docSnap.exists()) coupon = {id: docSnap.id, ...docSnap.data()};
    }

    const expiryDate = coupon.expiryDate ? coupon.expiryDate.toDate().toISOString().split('T')[0] : '';
    
    modalBody.innerHTML = `
        <h3>${couponId ? 'Edit' : 'Add'} Coupon</h3>
        <form id="coupon-form" data-id="${coupon.id || ''}">
            <input type="text" id="code" placeholder="Coupon Code (e.g., SAVE10)" value="${coupon.id || ''}" ${couponId ? 'disabled' : 'required'}>
            <select id="type" required>
                <option value="percentage" ${coupon.type === 'percentage' ? 'selected' : ''}>Percentage</option>
                <option value="fixed" ${coupon.type === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
            </select>
            <input type="number" id="value" placeholder="Discount Value" value="${coupon.value || ''}" required>
            <input type="number" id="minCartValue" placeholder="Minimum Cart Value" value="${coupon.minCartValue || ''}" required>
            <input type="date" id="expiryDate" value="${expiryDate}" required>
            <button type="submit" class="btn">Save</button>
        </form>
    `;
    document.getElementById('form-modal').style.display = 'block';
    document.getElementById('coupon-form').addEventListener('submit', saveCoupon);
}

async function saveCoupon(e) {
    e.preventDefault();
    const form = e.target;
    const couponId = form.dataset.id;
    const code = form.code.value.toUpperCase();

    const couponData = {
        type: form.type.value,
        value: parseFloat(form.value.value),
        minCartValue: parseFloat(form.minCartValue.value),
        expiryDate: new Date(form.expiryDate.value),
    };

    if (couponId) {
        await updateDoc(doc(db, 'coupons', couponId), couponData);
    } else {
        couponData.active = true; // Default for new coupons
        // You cannot create a doc with a specific ID using addDoc.
        // This requires `setDoc`. For simplicity, we'll let Firestore generate the ID,
        // but for coupons, it's better to use the code as the ID.
        // Let's adjust this for `setDoc` which is more appropriate here.
        await setDoc(doc(db, 'coupons', code), couponData);
    }
    document.getElementById('form-modal').style.display = 'none';
    loadCoupons();
}

async function toggleCouponActive(e) {
    await updateDoc(doc(db, 'coupons', e.target.dataset.id), { active: e.target.checked });
}

async function deleteCoupon(e) {
    if (confirm('Are you sure you want to delete this coupon?')) {
        await deleteDoc(doc(db, 'coupons', e.target.dataset.id));
        loadCoupons();
    }
}

// --- Banner Management ---
async function loadBannerForm() {
    const container = document.getElementById('banner-form-container');
    container.innerHTML = 'Loading banner...';
    
    const q = query(collection(db, "banners"), where("active", "==", true));
    const querySnapshot = await getDocs(q);
    let banner = {};
    let bannerId = null;

    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        bannerId = doc.id;
        banner = doc.data();
    }
    
    container.innerHTML = `
        <h3>Current Active Banner</h3>
        <form id="banner-form" data-id="${bannerId || ''}">
            <input type="text" id="title" placeholder="Banner Title" value="${banner.title || ''}" required>
            <input type="text" id="subtitle" placeholder="Banner Subtitle" value="${banner.subtitle || ''}">
            <label>Banner Image ${bannerId ? '(leave blank to keep existing)' : ''}</label>
            <input type="file" id="image" accept="image/*" ${bannerId ? '' : 'required'}>
            ${banner.imageUrl ? `<img src="${banner.imageUrl}" style="max-width: 200px; margin-top: 10px;">` : ''}
            <button type="submit" class="btn">Update Banner</button>
        </form>
    `;

    document.getElementById('banner-form').addEventListener('submit', saveBanner);
}

async function saveBanner(e) {
    e.preventDefault();
    const form = e.target;
    const bannerId = form.dataset.id;
    const imageFile = form.image.files[0];
    let imageUrl = '';

    if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_API_KEY}`, {
            method: 'POST', body: formData
        });
        const result = await response.json();
        if (result.success) {
            imageUrl = result.data.url;
        } else {
            alert('Image upload failed.'); return;
        }
    }

    const bannerData = {
        title: form.title.value,
        subtitle: form.subtitle.value,
        active: true,
    };
    if (imageUrl) bannerData.imageUrl = imageUrl;
    
    // Deactivate all other banners first
    const bannersSnapshot = await getDocs(collection(db, 'banners'));
    for (const doc of bannersSnapshot.docs) {
        await updateDoc(doc.ref, { active: false });
    }

    // Update or create the new active banner
    if (bannerId) {
        await updateDoc(doc(db, 'banners', bannerId), bannerData);
    } else {
        await addDoc(collection(db, 'banners'), bannerData);
    }

    alert('Banner updated successfully!');
    loadBannerForm();
}
