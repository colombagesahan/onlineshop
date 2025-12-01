
import { auth, db, storage, getSiteSettings } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    // Safety Check
    if (!loginScreen || !dashboard) {
        console.warn("HTML elements missing. Waiting for page to load...");
        return;
    }

    if (user) {
        // Logged In
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';
        loadSettings();
        loadProducts();
        loadOrders();
    } else {
        // Not Logged In
        loginScreen.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

// --- LOGIN ---
window.adminLogin = () => {
    const e = document.getElementById('admin-email').value;
    const p = document.getElementById('admin-pass').value;

    signInWithEmailAndPassword(auth, e, p)
        .then(() => console.log("Logged in"))
        .catch(err => alert("Login Failed: " + err.message));
};

// --- LOGOUT ---
window.logout = () => {
    signOut(auth).then(() => location.reload());
};

// --- SETTINGS ---
async function loadSettings() {
    const data = await getSiteSettings();
    if(document.getElementById('set-bizName')) document.getElementById('set-bizName').value = data.bizName || "";
    if(document.getElementById('set-color')) document.getElementById('set-color').value = data.primaryColor || "#000000";
    if(document.getElementById('set-phone')) document.getElementById('set-phone').value = data.ownerPhone || "";
    if(document.getElementById('set-logo-url')) document.getElementById('set-logo-url').value = data.logoUrl || "";
    if(document.getElementById('set-hero')) document.getElementById('set-hero').value = data.heroText || "";
    if(document.getElementById('set-vision')) document.getElementById('set-vision').value = data.vision || "";
    if(document.getElementById('set-contact')) document.getElementById('set-contact').value = data.contact || "";
}

window.saveSettings = async () => {
    const config = {
        bizName: document.getElementById('set-bizName').value,
        primaryColor: document.getElementById('set-color').value,
        ownerPhone: document.getElementById('set-phone').value,
        logoUrl: document.getElementById('set-logo-url').value,
        heroText: document.getElementById('set-hero').value,
        vision: document.getElementById('set-vision').value,
        contact: document.getElementById('set-contact').value
    };
    await setDoc(doc(db, "settings", "general"), config);
    alert("Settings Saved!");
    location.reload(); 
};

// --- IMAGE UPLOAD ---
window.uploadImage = async (inputId, hiddenInputId = null) => {
    const file = document.getElementById(inputId).files[0];
    if (!file) return alert("No file selected");
    
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    if(hiddenInputId) document.getElementById(hiddenInputId).value = url;
    alert("Upload Complete");
    return url;
};

// --- PRODUCTS ---
window.addProduct = async () => {
    const title = document.getElementById('prod-title').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    
    if(!title || !price) return alert("Title and Price required");

    // Upload Images
    let images = [];
    if(document.getElementById('prod-img-1').files[0]) images.push(await window.uploadImage('prod-img-1'));
    if(document.getElementById('prod-img-2').files[0]) images.push(await window.uploadImage('prod-img-2'));
    if(document.getElementById('prod-img-3').files[0]) images.push(await window.uploadImage('prod-img-3'));

    const newProd = {
        title, price, stock,
        description: document.getElementById('prod-desc').value,
        category: document.getElementById('prod-cat').value,
        badge: document.getElementById('prod-badge').value,
        youtubeLink: document.getElementById('prod-video').value,
        images: images,
        createdAt: Date.now()
    };

    await addDoc(collection(db, "products"), newProd);
    alert("Product Added");
    loadProducts();
};

async function loadProducts() {
    const list = document.getElementById('admin-product-list');
    if(!list) return;
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    snap.forEach(doc => {
        const p = doc.data();
        list.innerHTML += `<div style="border-bottom:1px solid #ddd; padding:10px;"><b>${p.title}</b> <button onclick="deleteProduct('${doc.id}')" style="color:red; float:right;">Delete</button></div>`;
    });
}

window.deleteProduct = async (id) => {
    if(confirm("Delete?")) {
        await deleteDoc(doc(db, "products", id));
        loadProducts();
    }
};

// --- ORDERS ---
async function loadOrders() {
    const list = document.getElementById('order-list');
    if(!list) return;
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    snap.forEach(d => {
        const o = d.data();
        list.innerHTML += `<div class="order-card"><b>${o.customer.name}</b> - Total: ${o.total}<br>Status: ${o.status}</div>`;
    });
}
