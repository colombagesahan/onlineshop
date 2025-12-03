import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const shopId = params.get('store');

let products = [], cart = [];
let ownerPhone = "";

if(!shopId) document.body.innerHTML = "<h1 style='text-align:center; padding:50px;'>Store Not Found</h1>";
else init();

async function init() {
    // 1. Settings
    const setSnap = await getDoc(doc(db, "shops", shopId, "settings", "general"));
    if(setSnap.exists()) {
        const d = setSnap.data();
        ownerPhone = d.ownerPhone;
        
        // Dynamic CSS Variables
        document.documentElement.style.setProperty('--primary', d.primaryColor || '#004aad');
        document.documentElement.style.setProperty('--secondary', '#00bcd4'); // Can add setting for this too

        // Header
        const brandArea = document.getElementById('brand-area');
        if(d.logoUrl) brandArea.innerHTML = `<img src="${d.logoUrl}"> <span>${d.bizName}</span>`;
        else brandArea.innerText = d.bizName || "Online Store";
        document.title = d.bizName || "Shop";
        document.getElementById('footer-brand').innerText = d.bizName || "Shop";

        // Hero
        document.getElementById('hero-title').innerText = d.heroText || "Welcome";
        document.getElementById('hero-sub').innerText = d.heroSub || "Best Quality Products";
        if(d.heroImg) document.getElementById('hero-bg-img').src = d.heroImg;
        else document.getElementById('hero-section').style.background = "linear-gradient(135deg, var(--primary), var(--dark))";

        // About & Contact
        if(d.aboutTitle) document.getElementById('about-title').innerText = d.aboutTitle;
        if(d.aboutDesc) document.getElementById('about-desc').innerText = d.aboutDesc;
        if(d.address) document.getElementById('store-address').innerText = d.address;
        if(d.aboutImg) document.getElementById('about-img').src = d.aboutImg;
    }

    // 2. Products
    const snap = await getDocs(collection(db, "shops", shopId, "products"));
    const cats = new Set();
    
    snap.forEach(d => {
        const p = d.data();
        products.push({id: d.id, ...p});
        if(p.category) cats.add(p.category);
    });

    // Filters
    const sel = document.getElementById('category-filter');
    cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);

    // Cart
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
                    <small style="color:#999; text-transform:uppercase;">${p.category || 'General'}</small>
                    <h3>${p.title}</h3>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
                        <span class="price-tag">Rs. ${p.price}</span>
                        <div style="display:flex; gap:10px;">
                            <button onclick="window.viewProd('${p.id}')" class="btn btn-outline" style="padding:8px 15px;"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="window.addCart('${p.id}')" class="btn btn-primary" style="padding:8px 15px;"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// ... Rest of the cart logic (viewProd, addCart, updateCart, checkout) remains exactly the same as your original file ...
// Just ensure the IDs used in render match the HTML
window.viewProd = (id) => {
    const p = products.find(x => x.id === id);
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    
    let media = p.images?.map(i => `<img src="${i}" style="width:100%; border-radius:10px; margin-bottom:10px;">`).join('') || '';

    content.innerHTML = `
        <h2 style="color:var(--primary)">${p.title}</h2>
        <div style="margin:15px 0;">${media}</div>
        <p>${p.description || 'No description'}</p>
        <h3 style="margin-top:20px;">Rs. ${p.price}</h3>
        <button onclick="window.addCart('${p.id}'); document.getElementById('product-modal').style.display='none'" class="btn btn-primary" style="width:100%; margin-top:15px;">Add to Cart</button>
    `;
    modal.style.display = 'flex';
};

// ... Include addCart, updateCart, remCart, openCart, checkout, filterProducts from your original file ...
window.addCart = (id) => {
    const p = products.find(x => x.id === id);
    const has = cart.find(x => x.id === id);
    if(has) has.qty++; else cart.push({...p, qty:1});
    updateCart();
    // Optional: Show a small toast or animation
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
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:10px 0;">
                <div>
                    <strong>${i.title}</strong><br>
                    <small>${i.qty} x ${i.price}</small>
                </div>
                <div>
                    <span onclick="window.remCart('${i.id}')" style="color:red; cursor:pointer;">&times;</span>
                </div>
            </div>`;
    });
    document.getElementById('cart-total').innerText = "Rs. " + tot;
}

window.remCart = (id) => { cart = cart.filter(x => x.id !== id); updateCart(); };
window.openCart = () => document.getElementById('cart-modal').style.display = 'flex';

window.checkout = async () => {
    const name = document.getElementById('c-name').value;
    const phone = document.getElementById('c-phone').value;
    const address = document.getElementById('c-address').value;

    if(!name || !phone) return alert("Please fill details");

    // Logic to save order to Firebase & WhatsApp redirect (Same as original)
    // ...
    let txt = `*New Order - ${document.title}*\nName: ${name}\nAddress: ${address}\n`;
    cart.forEach(i => txt += `- ${i.title} (x${i.qty})\n`);
    txt += `Total: ${document.getElementById('cart-total').innerText}`;
    
    // Save to DB
    await addDoc(collection(db, "shops", shopId, "orders"), {
        customer: { name, phone, address },
        items: cart,
        total: document.getElementById('cart-total').innerText,
        status: "New",
        timestamp: Timestamp.now()
    });

    cart = []; updateCart();
    window.open(`https://wa.me/${ownerPhone}?text=${encodeURIComponent(txt)}`, '_blank');
};

window.filterProducts = () => {
    const c = document.getElementById('category-filter').value;
    render(products.filter(p => c === 'all' || p.category === c));
};
