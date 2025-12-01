import { auth, db, storage } from './firebase-config.js'; // Note: getSiteSettings is no longer needed here as we load dynamic settings
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, getDoc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- AUTH LISTENER & DASHBOARD SETUP ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    if (!loginScreen || !dashboard) return;

    if (user) {
        // 1. Show Dashboard
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';

        // 2. Generate "My Live Shop" Link
        // We check if it exists first to avoid adding it multiple times
        if(!document.getElementById('live-shop-btn')) {
            const header = document.querySelector('.admin-header');
            const btn = document.createElement('a');
            btn.id = 'live-shop-btn';
            btn.href = `shop.html?store=${user.uid}`; // THE MAGIC LINK
            btn.target = '_blank';
            btn.innerHTML = `<i class="fa-solid fa-external-link"></i> Open My Live Shop`;
            btn.style.cssText = "background:white; color:#333; padding:5px 10px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:12px; margin-right:10px;";
            
            // Insert before the Logout button
            const logoutBtn = header.querySelector('button');
            header.insertBefore(btn, logoutBtn);
        }

        // 3. Load Data for THIS User
        loadSettings(user.uid);
        loadProducts(user.uid);
        loadOrders(user.uid);
    } else {
        // Show Login
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

// --- SETTINGS (Saved to shops/{uid}/settings/general) ---
async function loadSettings(uid) {
    try {
        const docRef = doc(db, "shops", uid, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(document.getElementById('set-bizName')) document.getElementById('set-bizName').value = data.bizName || "";
            if(document.getElementById('set-color')) document.getElementById('set-color').value = data.primaryColor || "#000000";
            if(document.getElementById('set-phone')) document.getElementById('set-phone').value = data.ownerPhone || "";
            if(document.getElementById('set-logo-url')) document.getElementById('set-logo-url').value = data.logoUrl || "";
            if(document.getElementById('set-hero')) document.getElementById('set-hero').value = data.heroText || "";
            if(document.getElementById('set-vision')) document.getElementById('set-vision').value = data.vision || "";
            if(document.getElementById('set-contact')) document.getElementById('set-contact').value = data.contact || "";
        }
    } catch(e) {
        console.log("No settings found yet.");
    }
}

window.saveSettings = async () => {
    const user = auth.currentUser;
    if(!user) return alert("Please login first");

    try {
        const config = {
            bizName: document.getElementById('set-bizName').value,
            primaryColor: document.getElementById('set-color').value,
            ownerPhone: document.getElementById('set-phone').value,
            logoUrl: document.getElementById('set-logo-url').value,
            heroText: document.getElementById('set-hero').value,
            vision: document.getElementById('set-vision').value,
            contact: document.getElementById('set-contact').value
        };
        // SAVE TO USER FOLDER
        await setDoc(doc(db, "shops", user.uid, "settings", "general"), config);
        alert("Settings Saved!");
    } catch(e) {
        alert("Error saving: " + e.message);
    }
};

// --- IMAGE UPLOAD ---
window.uploadImage = async (inputId, hiddenInputId = null) => {
    const file = document.getElementById(inputId).files[0];
    if (!file) return alert("No file selected");
    
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        if(hiddenInputId) document.getElementById(hiddenInputId).value = url;
        alert("Upload Complete");
        return url;
    } catch(e) {
        alert("Upload Error: " + e.message);
        return null;
    }
};

// --- PRODUCTS (Saved to shops/{uid}/products) ---
window.addProduct = async () => {
    const user = auth.currentUser;
    if(!user) return alert("Please login first");

    const title = document.getElementById('prod-title').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    
    if(!title || !price) return alert("Title and Price required");

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

    // SAVE TO USER FOLDER
    await addDoc(collection(db, "shops", user.uid, "products"), newProd);
    alert("Product Added");
    loadProducts(user.uid);
};

async function loadProducts(uid) {
    const list = document.getElementById('admin-product-list');
    if(!list) return;

    // LOAD FROM USER FOLDER
    const q = query(collection(db, "shops", uid, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    snap.forEach(doc => {
        const p = doc.data();
        list.innerHTML += `<div style="border-bottom:1px solid #ddd; padding:10px;"><b>${p.title}</b> <button onclick="deleteProduct('${doc.id}')" style="color:red; float:right;">Delete</button></div>`;
    });
}

window.deleteProduct = async (id) => {
    const user = auth.currentUser;
    if(user && confirm("Delete?")) {
        // DELETE FROM USER FOLDER
        await deleteDoc(doc(db, "shops", user.uid, "products", id));
        loadProducts(user.uid);
    }
};

// --- ORDERS (Saved to shops/{uid}/orders) ---
async function loadOrders(uid) {
    const list = document.getElementById('order-list');
    if(!list) return;

    // LOAD FROM USER FOLDER
    const q = query(collection(db, "shops", uid, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';
    
    snap.forEach(d => {
        const o = d.data();
        const docId = d.id;
        
        // Status logic
        let statusColor = '#333';
        if(o.status === 'New') statusColor = 'blue';
        if(o.status === 'Shipped') statusColor = 'orange';
        if(o.status === 'Completed') statusColor = 'green';
        if(o.status === 'Cancelled') statusColor = 'red';

        let itemsHtml = o.items ? o.items.map(i => `<li>${i.title} x ${i.qty}</li>`).join('') : 'No items';

        list.innerHTML += `
            <div class="order-card">
                <div style="display:flex; justify-content:space-between;">
                    <b>${o.customer.name}</b>
                    <select class="status-select" style="color:${statusColor}" onchange="updateOrderStatus('${docId}', this.value)">
                        <option value="New" ${o.status === 'New' ? 'selected' : ''}>New</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <small>${o.customer.phone}</small>
                <ul>${itemsHtml}</ul>
                <b>Total: ${o.total}</b>
            </div>`;
    });
}

window.updateOrderStatus = async (orderId, newStatus) => {
    const user = auth.currentUser;
    if(user) {
        // UPDATE USER FOLDER
        await updateDoc(doc(db, "shops", user.uid, "orders", orderId), { status: newStatus });
        loadOrders(user.uid);
    }
};
