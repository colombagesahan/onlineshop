import { db, getSiteSettings } from './firebase-config.js';
import { collection, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let products = [];
let cart = JSON.parse(localStorage.getItem('shopCart')) || [];
let siteConfig = {};

// Initialize Shop
async function initShop() {
    // 1. Load Settings
    siteConfig = await getSiteSettings();
    document.documentElement.style.setProperty('--primary-color', siteConfig.primaryColor || '#333');
    
    const brandArea = document.getElementById('brand-area');
    if(siteConfig.logoUrl) {
        brandArea.innerHTML = `<img src="${siteConfig.logoUrl}" class="logo-img">`;
    } else {
        document.getElementById('biz-name').innerText = siteConfig.bizName;
    }
    
    document.getElementById('hero-text').innerText = siteConfig.heroText || "Welcome to our shop";
    document.getElementById('vision-mission').innerText = siteConfig.vision || "No info yet.";
    document.getElementById('contact-details').innerText = siteConfig.contact || "No info yet.";

    // 2. Load Products
    const querySnapshot = await getDocs(collection(db, "products"));
    products = [];
    querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() });
    });
    
    renderProducts(products);
    updateCartUI();
}

// Render Products
function renderProducts(list) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';
    
    list.forEach(p => {
        // Only show if stock > 0
        if(p.stock > 0) {
            const badgeHTML = p.badge ? `<div class="badge">${p.badge}</div>` : '';
            const img = p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/150';
            
            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                ${badgeHTML}
                <img src="${img}" class="product-img">
                <h3>${p.title}</h3>
                <p>Price: ${p.price}</p>
                <button class="view-btn" data-id="${p.id}">View Details</button>
                <button class="add-btn" data-id="${p.id}">Add to Cart</button>
            `;
            container.appendChild(div);
        }
    });

    // Event Listeners for buttons
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', (e) => openProductModal(e.target.dataset.id)));
    document.querySelectorAll('.add-btn').forEach(b => b.addEventListener('click', (e) => addToCart(e.target.dataset.id)));
}

// Open Product Modal
window.openProductModal = (id) => {
    const p = products.find(x => x.id === id);
    const modal = document.getElementById('product-modal');
    const body = document.getElementById('modal-body');
    
    // Generate YouTube Embed
    let videoHTML = '';
    if(p.youtubeLink) {
        const videoId = p.youtubeLink.split('v=')[1];
        if(videoId) {
            videoHTML = `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
        }
    }

    // Images
    const imagesHTML = p.images ? p.images.map(img => `<img src="${img}" style="width:80px; margin:5px;">`).join('') : '';

    body.innerHTML = `
        <h2>${p.title}</h2>
        <div style="display:flex; overflow-x:auto">${imagesHTML}</div>
        ${videoHTML}
        <p>${p.description}</p>
        <h3>Price: ${p.price}</h3>
        <button onclick="document.querySelector('.add-btn[data-id=\\'${p.id}\\']').click()">Add to Cart</button>
    `;
    modal.style.display = 'flex';
};

// Cart Logic
window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if(existing) {
        existing.qty++;
    } else {
        cart.push({ ...p, qty: 1 });
    }
    updateCartUI();
    document.getElementById('cart-modal').style.display = 'flex';
};

function updateCartUI() {
    localStorage.setItem('shopCart', JSON.stringify(cart));
    document.getElementById('cart-count').innerText = cart.reduce((a, b) => a + b.qty, 0);
    
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span>${item.title} (x${item.qty})</span>
                <span>${item.price * item.qty}</span>
                <button onclick="removeFromCart('${item.id}')" style="background:red; padding:2px 5px;">X</button>
            </div>
        `;
    });
    document.getElementById('cart-total').innerText = total;
}

window.removeFromCart = (id) => {
    cart = cart.filter(x => x.id !== id);
    updateCartUI();
};

window.openCart = () => {
    document.getElementById('cart-modal').style.display = 'flex';
};

// WhatsApp Checkout
window.checkoutWhatsApp = async () => {
    const name = document.getElementById('cust-name').value;
    const address = document.getElementById('cust-address').value;
    const phone = document.getElementById('cust-phone').value;
    const wa = document.getElementById('cust-whatsapp').value;

    if(!name || !address || !phone) return alert("Please fill details");

    // 1. Save to DB for Admin
    try {
        await addDoc(collection(db, "orders"), {
            customer: { name, address, phone, wa },
            items: cart,
            total: document.getElementById('cart-total').innerText,
            status: "New",
            timestamp: Timestamp.now()
        });
    } catch (e) { console.error(e); }

    // 2. Generate WhatsApp Link
    let msg = `*New Order from ${name}*\n\n`;
    cart.forEach(i => msg += `${i.title} x ${i.qty} = ${i.price * i.qty}\n`);
    msg += `\n*Total: ${document.getElementById('cart-total').innerText}*\nAddress: ${address}\nPhone: ${phone}`;

    const ownerPhone = siteConfig.ownerPhone || "0000000000"; // Fallback
    const url = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(msg)}`;
    
    // Clear cart and redirect
    cart = [];
    updateCartUI();
    window.open(url, '_blank');
};

// Search
window.filterProducts = () => {
    const term = document.getElementById('search-bar').value.toLowerCase();
    const filtered = products.filter(p => p.title.toLowerCase().includes(term));
    renderProducts(filtered);
};

initShop();
