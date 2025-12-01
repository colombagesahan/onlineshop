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
        alert(msg);
    }
};

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(dashboard) dashboard.classList.remove('hidden');
        if(document.getElementById('user-email-display')) document.getElementById('user-email-display').innerText = user.email;
        
        // Setup Shop Link
        const btn = document.getElementById('live-shop-btn');
        if(btn) btn.href = `shop.html?store=${user.uid}`;

        // Load Data
        loadSettings(user.uid);
        loadProducts(user.uid);
        loadOrders(user.uid);
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(dashboard) dashboard.classList.add('hidden');
    }
});

// --- LOGIN / REGISTER ---
window.adminLogin = () => {
    const e = document.getElementById('admin-email').value;
    const p = document.getElementById('admin-pass').value;
    
    if(!e || !p) return alert("Please enter email and password");

    signInWithEmailAndPassword(auth, e, p)
        .then(() => showToast("Welcome back!"))
        .catch(() => {
            // If login fails, try to create account
            createUserWithEmailAndPassword(auth, e, p)
                .then(() => showToast("Account Created!"))
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
    } catch(e) { console.log("Settings not loaded yet"); }
}

window.saveSettings = async () => {
    const user = auth.currentUser;
    if(!user) return;
    try {
        const config = {
            bizName: document.getElementById('set-bizName').value || "",
            primaryColor: document.getElementById('set-color').value || "#2563eb",
            ownerPhone: document.getElementById('set-phone').value || "",
            logoUrl: document.getElementById('set-logo-url').value || "",
            heroText: document.getElementById('set-hero').value || ""
        };
        await setDoc(doc(db, "shops", user.uid, "settings", "general"), config);
        showToast("Settings Saved!");
    } catch(e) { alert(e.message); }
};

// --- FIX: UPDATED IMAGE UPLOAD FUNCTION ---
window.uploadImage = async (inputId, hiddenId = null) => {
    const fileInput = document.getElementById(inputId);
    if(!fileInput || !fileInput.files[0]) return null;
    
    const file = fileInput.files[0];
    const sRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    
    try {
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        
        // Only try to set value if the hidden input actually exists
        if(hiddenId && document.getElementById(hiddenId)) {
            document.getElementById(hiddenId).value = url;
        }
        
        return url;
    } catch(e) { 
        console.error(e);
        return null; 
    }
};

// --- PRODUCTS ---
window.addProduct = async () => {
    const user = auth.currentUser;
    if(!user) return alert("Please login");

    const title = document.getElementById('prod-title').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    
    if(!title || !price) return alert("Title and Price needed");
    showToast("Uploading & Saving...");

    // 1. Upload Images Safely
    let images = [];
    for(let i=1; i<=3; i++) {
        // We do not pass a hiddenId here, just get the URL
        const url = await window.uploadImage(`prod-img-${i}`);
        if(url) images.push(url);
    }

    // 2. Save to Firestore
    try {
        await addDoc(collection(db, "shops", user.uid, "products"), {
            title: title, 
            price: price,
            stock: parseInt(document.getElementById('prod-stock').value) || 0,
            category: document.getElementById('prod-cat').value || "General",
            description: document.getElementById('prod-desc').value || "",
            youtubeLink: document.getElementById('prod-video').value || "",
            images: images, // This is now a clean array of strings
            createdAt: Date.now()
        });
        
        showToast("Product Created!");
        
        // Clear inputs
        document.getElementById('prod-title').value = "";
        document.getElementById('prod-price').value = "";
        document.getElementById('prod-img-1').value = "";
        
        loadProducts(user.uid);
    } catch(e) {
        console.error(e);
        alert("Error saving product: " + e.message);
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
        const img = p.images && p.images[0] ? p.images[0] : '';
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
    if(confirm("Delete this product?")) {
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
