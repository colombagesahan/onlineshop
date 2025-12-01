import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, getDoc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- HELPERS ---
const showToast = (msg) => {
    const t = document.getElementById("toast");
    if(t) {
        t.innerText = msg;
        t.className = "show";
        setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
    } else {
        console.log("Toast:", msg);
    }
};

const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
};

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(dashboard) dashboard.classList.remove('hidden');
        if(document.getElementById('user-email-display')) document.getElementById('user-email-display').innerText = user.email;
        
        const btn = document.getElementById('live-shop-btn');
        if(btn) btn.href = `shop.html?store=${user.uid}`;

        loadSettings(user.uid);
        loadProducts(user.uid);
        loadOrders(user.uid);
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(dashboard) dashboard.classList.add('hidden');
    }
});

// --- LOGIN ---
window.adminLogin = () => {
    const e = getVal('admin-email');
    const p = getVal('admin-pass');
    
    if(!e || !p) return alert("Enter email and password");

    signInWithEmailAndPassword(auth, e, p)
        .then(() => showToast("Login Successful"))
        .catch(() => {
            createUserWithEmailAndPassword(auth, e, p)
                .then(() => showToast("Account Created"))
                .catch(err => alert(err.message));
        });
};

window.logout = () => signOut(auth).then(() => location.reload());

// --- SETTINGS ---
async function loadSettings(uid) {
    try {
        const snap = await getDoc(doc(db, "shops", uid, "settings", "general"));
        if (snap.exists()) {
            const d = snap.data();
            if(document.getElementById('set-bizName')) document.getElementById('set-bizName').value = d.bizName || "";
            if(document.getElementById('set-color')) document.getElementById('set-color').value = d.primaryColor || "#2563eb";
            if(document.getElementById('set-phone')) document.getElementById('set-phone').value = d.ownerPhone || "";
            if(document.getElementById('set-logo-url')) document.getElementById('set-logo-url').value = d.logoUrl || "";
            if(document.getElementById('set-hero')) document.getElementById('set-hero').value = d.heroText || "";
        }
    } catch(e) { console.log("Settings empty"); }
}

window.saveSettings = async () => {
    const user = auth.currentUser;
    if(!user) return;
    try {
        await setDoc(doc(db, "shops", user.uid, "settings", "general"), {
            bizName: getVal('set-bizName'),
            primaryColor: getVal('set-color'),
            ownerPhone: getVal('set-phone'),
            logoUrl: getVal('set-logo-url'),
            heroText: getVal('set-hero')
        });
        showToast("Settings Saved!");
    } catch(e) { alert(e.message); }
};

// --- SAFE IMAGE UPLOAD ---
window.uploadImage = async (inputId, hiddenId) => {
    const el = document.getElementById(inputId);
    if(!el || !el.files[0]) return null; // Returns NULL if no file
    
    const file = el.files[0];
    const sRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    
    try {
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);
        
        // If hidden input exists, set it (useful for logo upload)
        const hiddenEl = document.getElementById(hiddenId);
        if(hiddenEl) hiddenEl.value = url;
        
        return url; // Return the string URL
    } catch(e) { 
        console.error("Upload Error:", e);
        return null; // Return NULL on error
    }
};

// --- PRODUCTS ---
window.addProduct = async () => {
    const user = auth.currentUser;
    if(!user) return alert("Please login");

    const title = getVal('prod-title');
    const priceStr = getVal('prod-price');
    
    if(!title || !priceStr) return alert("Title and Price required");

    showToast("Uploading...");

    // 1. Upload Images
    let images = [];
    // Check all 3 inputs
    for(let i=1; i<=3; i++) {
        const url = await window.uploadImage(`prod-img-${i}`);
        if(url !== null) {
            images.push(url); // Only add if URL is valid string
        }
    }

    // 2. Prepare Data (Ensure NO undefined values)
    const productData = {
        title: title,
        price: parseFloat(priceStr) || 0,
        stock: parseInt(getVal('prod-stock')) || 0,
        category: getVal('prod-cat') || "General",
        description: getVal('prod-desc') || "",
        youtubeLink: getVal('prod-video') || "",
        images: images, // Array of strings (or empty array)
        createdAt: Date.now()
    };

    // 3. Save
    try {
        await addDoc(collection(db, "shops", user.uid, "products"), productData);
        showToast("Product Created!");
        
        // Reset Form
        if(document.getElementById('prod-title')) document.getElementById('prod-title').value = "";
        if(document.getElementById('prod-price')) document.getElementById('prod-price').value = "";
        if(document.getElementById('prod-img-1')) document.getElementById('prod-img-1').value = "";
        
        loadProducts(user.uid);
    } catch(e) {
        console.error(e);
        alert("Database Error: " + e.message);
    }
};

async function loadProducts(uid) {
    const list = document.getElementById('admin-product-list');
    if(!list) return;

    const q = query(collection(db, "shops", uid, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    
    snap.forEach(d => {
        const p = d.data();
        const img = (p.images && p.images.length > 0) ? p.images[0] : '';
        const imgHTML = img ? `<div class="product-img" style="background-image:url('${img}')"></div>` : `<div class="product-img" style="background:#eee"></div>`;
        
        list.innerHTML += `
            <div class="product-card">
                ${imgHTML}
                <div class="product-info">
                    <strong>${p.title}</strong>
                    <span style="color:green; font-weight:bold">${p.price}</span>
                    <small>Stock: ${p.stock}</small>
                    <button onclick="deleteProduct('${d.id}')" class="btn btn-outline" style="color:red; margin-top:auto; font-size:0.8rem">Delete</button>
                </div>
            </div>`;
    });
}

window.deleteProduct = async (id) => {
    if(confirm("Delete?")) {
        await deleteDoc(doc(db, "shops", auth.currentUser.uid, "products", id));
        loadProducts(auth.currentUser.uid);
    }
};

// --- ORDERS ---
async function loadOrders(uid) {
    const list = document.getElementById('order-list');
    if(!list) return;

    const q = query(collection(db, "shops", uid, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    
    snap.forEach(d => {
        const o = d.data();
        const colors = { New: 'blue', Shipped: 'orange', Completed: 'green', Cancelled: 'red' };
        
        list.innerHTML += `
            <div class="order-item">
                <div>
                    <strong>${o.customer.name}</strong> (${o.customer.phone})<br>
                    <small>${o.total}</small>
                </div>
                <div>
                   <select onchange="updateStatus('${d.id}', this.value)" style="padding:5px; border-color:${colors[o.status] || '#333'}">
                        ${['New','Shipped','Completed','Cancelled'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
                   </select>
                </div>
            </div>`;
    });
}

window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "shops", auth.currentUser.uid, "orders", id), { status });
    showToast("Status Updated");
};
