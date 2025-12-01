import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const shopId = params.get('store');

let products = [], cart = [];
let ownerPhone = "";

if(!shopId) document.body.innerHTML = "<h1 style='text-align:center; margin-top:50px;'>Store Not Found</h1>";
else init();

async function init() {
    // 1. Settings
    const setSnap = await getDoc(doc(db, "shops", shopId, "settings", "general"));
    if(setSnap.exists()) {
        const d = setSnap.data();
        ownerPhone = d.ownerPhone;
        document.documentElement.style.setProperty('--primary', d.primaryColor || '#2563eb');
        
        if(d.logoUrl) document.getElementById('brand-area').innerHTML = `<img src="${d.logoUrl}" style="height:40px">`;
        else document.getElementById('brand-area').innerText = d.bizName || "Store";
        
        document.getElementById('hero-text').innerText = d.heroText || "Welcome";
        document.title = d.bizName || "Online Shop";
    }

    // 2. Products
    const snap = await getDocs(collection(db, "shops", shopId, "products"));
    const cats = new Set();
    
    snap.forEach(d => {
        const p = d.data();
        products.push({id: d.id, ...p});
        if(p.category) cats.add(p.category);
    });

    // 3. Filters
    const sel = document.getElementById('category-filter');
    cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);

    // 4. Cart
    cart = JSON.parse(localStorage.getItem(`cart_${shopId}`)) || [];
    render(products);
    updateCart();
}

function render(list) {
    const el = document.getElementById('product-list');
    el.innerHTML = '';
    list.forEach(p => {
        const img = p.images?.[0] || 'https://via.placeholder.com/300';
        el.innerHTML += `
            <div class="product-card">
                <div class="product-img" style="background-image:url('${img}')"></div>
                <div class="product-info">
                    <h3>${p.title}</h3>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                        <span style="font-weight:bold; color:var(--primary)">Rs. ${p.price}</span>
                        <div style="display:flex; gap:5px;">
                            <button onclick="window.viewProd('${p.id}')" class="btn btn-outline" style="padding:5px 10px;">View</button>
                            <button onclick="window.addCart('${p.id}')" class="btn btn-primary" style="padding:5px 10px;">Add</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// Global functions for HTML access
window.viewProd = (id) => {
    const p = products.find(x => x.id === id);
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    
    let media = p.images?.map(i => `<img src="${i}" style="height:80px; margin:5px; border-radius:4px;">`).join('') || '';
    if(p.youtubeLink) media += `<br><iframe src="${p.youtubeLink.replace('watch?v=', 'embed/')}" style="width:100%; height:200px; border:none; margin-top:10px;"></iframe>`;

    content.innerHTML = `
        <h2>${p.title}</h2>
        <div>${media}</div>
        <p>${p.description || ''}</p>
        <h3>Rs. ${p.price}</h3>
        <button onclick="window.addCart('${p.id}'); document.getElementById('product-modal').style.display='none'" class="btn btn-primary" style="width:100%">Add to Cart</button>
    `;
    modal.style.display = 'flex';
};

window.addCart = (id) => {
    const p = products.find(x => x.id === id);
    const has = cart.find(x => x.id === id);
    if(has) has.qty++; else cart.push({...p, qty:1});
    updateCart();
};

function updateCart() {
    localStorage.setItem(`cart_${shopId}`, JSON.stringify(cart));
    document.getElementById('cart-count').innerText = cart.reduce((a,b)=>a+b.qty,0);
    
    const div = document.getElementById('cart-items');
    div.innerHTML = '';
    let tot = 0;
    cart.forEach(i => {
        tot += i.price * i.qty;
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px 0;">
                <span>${i.title} (x${i.qty})</span>
                <span>${i.price * i.qty} <span onclick="window.remCart('${i.id}')" style="color:red; cursor:pointer; margin-left:5px;">&times;</span></span>
            </div>`;
    });
    document.getElementById('cart-total').innerText = "Rs. " + tot;
}

window.remCart = (id) => {
    cart = cart.filter(x => x.id !== id);
    updateCart();
};

window.openCart = () => document.getElementById('cart-modal').style.display = 'flex';

window.checkout = async () => {
    const name = document.getElementById('c-name').value;
    const phone = document.getElementById('c-phone').value;
    const address = document.getElementById('c-address').value;
    
    if(!name || !phone) return alert("Name and Phone required");

    // Save Order
    await addDoc(collection(db, "shops", shopId, "orders"), {
        customer: { name, phone, address },
        items: cart,
        total: document.getElementById('cart-total').innerText,
        status: "New",
        timestamp: Timestamp.now()
    });

    // WhatsApp
    let txt = `*New Order*\nName: ${name}\n`;
    cart.forEach(i => txt += `- ${i.title} (${i.qty})\n`);
    txt += `Total: ${document.getElementById('cart-total').innerText}`;
    
    cart = []; updateCart();
    window.open(`https://wa.me/${ownerPhone}?text=${encodeURIComponent(txt)}`, '_blank');
};

window.filterProducts = () => {
    const t = document.getElementById('search-bar').value.toLowerCase();
    const c = document.getElementById('category-filter').value;
    render(products.filter(p => 
        (p.title.toLowerCase().includes(t)) && 
        (c === 'all' || p.category === c)
    ));
};
