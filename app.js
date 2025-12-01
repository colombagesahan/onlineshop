import { db, getSiteSettings } from './firebase-config.js';
import { collection, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let products = [];
let cart = JSON.parse(localStorage.getItem('shopCart')) || [];
let siteConfig = {};

async function initShop() {
    // 1. Load Settings
    siteConfig = await getSiteSettings();
    document.documentElement.style.setProperty('--primary', siteConfig.primaryColor || '#2563eb');
    
    // Setup Logo/Name
    const brandArea = document.getElementById('brand-area');
    if(siteConfig.logoUrl) {
        brandArea.innerHTML = `<img src="${siteConfig.logoUrl}" class="logo-img">`;
    } else {
        document.getElementById('biz-name').innerText = siteConfig.bizName;
    }
    
    document.getElementById('hero-text').innerText = siteConfig.heroText || "Welcome";
    document.getElementById('vision-mission').innerText = siteConfig.vision || "Details coming soon.";
    document.getElementById('contact-details').innerText = siteConfig.contact || "Contact us for details.";

    // 2. Load Products
    const querySnapshot = await getDocs(collection(db, "products"));
    products = [];
    let categories = new Set(); // Store unique categories

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({ id: doc.id, ...data });
        if(data.category) categories.add(data.category);
    });
    
    // Auto-populate Category Filter
    const catSelect = document.getElementById('category-filter');
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        catSelect.appendChild(opt);
    });

    renderProducts(products);
    updateCartUI();
}

function renderProducts(list) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';
    
    if(list.length === 0) {
        container.innerHTML = '<p>No products found.</p>';
        return;
    }

    list.forEach(p => {
        if(p.stock > 0) {
            const badgeHTML = p.badge ? `<div class="badge">${p.badge}</div>` : '';
            const img = p.images && p.images.length > 0 ? p.images[0] : 'https://placehold.co/400x300?text=No+Image';
            
            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                ${badgeHTML}
                <img src="${img}" class="product-img">
                <div class="card-body">
                    <h3 class="card-title">${p.title}</h3>
                    <div class="card-price">Rs. ${p.price}</div>
                    <div class="btn-group">
                        <button class="view-btn" data-id="${p.id}">View</button>
                        <button class="add-btn" data-id="${p.id}">Add to Cart</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        }
    });

    // Re-attach listeners
    document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', (e) => openProductModal(e.target.dataset.id)));
    document.querySelectorAll('.add-btn').forEach(b => b.addEventListener('click', (e) => addToCart(e.target.dataset.id)));
}

window.openProductModal = (id) => {
    const p = products.find(x => x.id === id);
    const modal = document.getElementById('product-modal');
    const body = document.getElementById('modal-body');
    
    let videoHTML = '';
    if(p.youtubeLink && p.youtubeLink.includes('v=')) {
        const videoId = p.youtubeLink.split('v=')[1].split('&')[0];
        videoHTML = `<iframe width="100%" height="250" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="margin:10px 0; border-radius:8px;"></iframe>`;
    }

    const imagesHTML = p.images ? p.images.map(img => `<img src="${img}" style="width:60px; height:60px; object-fit:cover; margin:5px; border-radius:4px; border:1px solid #ddd;">`).join('') : '';

    body.innerHTML = `
        <h2>${p.title}</h2>
        <div style="display:flex; overflow-x:auto; margin-bottom:10px;">${imagesHTML}</div>
        <p>${p.description || 'No description available.'}</p>
        ${videoHTML}
        <h3 style="color:var(--primary)">Price: Rs. ${p.price}</h3>
        <button onclick="addToCart('${p.id}'); closeModal('product-modal')" style="background:var(--primary); color:white; width:100%">Add to Cart</button>
    `;
    modal.style.display = 'flex';
};

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if(existing) {
        existing.qty++;
    } else {
        cart.push({ ...p, qty: 1 });
    }
    updateCartUI();
    // Simple visual feedback
    const btn = document.querySelector(`.add-btn[data-id="${id}"]`);
    if(btn) {
        const oldText = btn.innerText;
        btn.innerText = "Added!";
        btn.style.background = "var(--success)";
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = "";
        }, 1000);
    }
};

function updateCartUI() {
    localStorage.setItem('shopCart', JSON.stringify(cart));
    document.getElementById('cart-count').innerText = cart.reduce((a, b) => a + b.qty, 0);
    
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        container.innerHTML += `
            <div class="cart-item">
                <div>
                    <b>${item.title}</b><br>
                    <small>Rs. ${item.price} x ${item.qty}</small>
                </div>
                <div style="text-align:right">
                    <b>${itemTotal}</b><br>
                    <button onclick="removeFromCart('${item.id}')" style="background:var(--danger); padding:4px 8px; font-size:12px;">Remove</button>
                </div>
            </div>
        `;
    });
    document.getElementById('cart-total').innerText = "Rs. " + total;
}

window.removeFromCart = (id) => {
    cart = cart.filter(x => x.id !== id);
    updateCartUI();
};

window.openCart = () => {
    document.getElementById('cart-modal').style.display = 'flex';
};

window.checkoutWhatsApp = async () => {
    const name = document.getElementById('cust-name').value;
    const address = document.getElementById('cust-address').value;
    const phone = document.getElementById('cust-phone').value;
    
    if(!name || !address || !phone) return alert("Please fill in Name, Address, and Phone.");

    // Save Order
    try {
        await addDoc(collection(db, "orders"), {
            customer: { name, address, phone },
            items: cart,
            total: document.getElementById('cart-total').innerText,
            status: "New",
            timestamp: Timestamp.now()
        });
    } catch (e) { console.error("Order Save Error", e); }

    // Send WhatsApp
    let msg = `*New Order from ${name}*\n\n`;
    cart.forEach(i => msg += `- ${i.title} (${i.qty}) = ${i.price * i.qty}\n`);
    msg += `\n*${document.getElementById('cart-total').innerText}*\n\nAddress: ${address}\nPhone: ${phone}`;

    const ownerPhone = siteConfig.ownerPhone || ""; 
    const url = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(msg)}`;
    
    cart = [];
    updateCartUI();
    window.open(url, '_blank');
    closeModal('cart-modal');
};

window.filterProducts = () => {
    const term = document.getElementById('search-bar').value.toLowerCase();
    const cat = document.getElementById('category-filter').value;
    
    const filtered = products.filter(p => {
        const matchesTerm = p.title.toLowerCase().includes(term);
        const matchesCat = cat === 'all' || p.category === cat;
        return matchesTerm && matchesCat;
    });
    renderProducts(filtered);
};

initShop();
