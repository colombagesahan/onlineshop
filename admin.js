import { auth, db, storage, getSiteSettings } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- AUTH STATE LISTENER (With Safety Checks) ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    // Safety Check: Stop crash if HTML is missing
    if (!loginScreen || !dashboard) {
        console.warn("HTML elements missing. Waiting for page to load...");
        return;
    }

    if (user) {
        // User is logged in
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';
        
        // Load Data
        loadSettings();
        loadProducts();
        loadOrders();
    } else {
        // User is NOT logged in
        loginScreen.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

// --- LOGIN FUNCTION ---
window.adminLogin = () => {
    const emailField = document.getElementById('admin-email');
    const passField = document.getElementById('admin-pass');
    
    if(!emailField || !passField) return alert("Error: Login inputs missing in HTML");

    const e = emailField.value;
    const p = passField.value;

    signInWithEmailAndPassword(auth, e, p)
        .then(() => {
            console.log("Logged in successfully");
        })
        .catch(err => {
            alert("Login Failed: " + err.message);
            console.error(err);
        });
};

// --- LOGOUT FUNCTION ---
window.logout = () => {
    signOut(auth).then(() => {
        alert("Logged out");
        location.reload();
    });
};

// --- SETTINGS LOGIC ---
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

// --- IMAGE UPLOAD HELPER ---
window.uploadImage = async (inputId, hiddenInputId = null) => {
    const fileInput = document.getElementById(inputId);
    if (!fileInput || !fileInput.files[0]) return alert("No file selected");
    
    const file = fileInput.files[0];
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    
    try {
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        if(hiddenInputId) document.getElementById(hiddenInputId).value = url;
        alert("Image Uploaded!");
        return url;
    } catch (err) {
        console.error("Upload failed", err);
        alert("Upload failed: " + err.message);
        return null;
    }
};

// --- PRODUCT LOGIC ---
window.addProduct = async () => {
    const title = document.getElementById('prod-title').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    
    if(!title || !price) return alert("Title and Price are required");

    // Upload Images
    const img1 = await window.uploadImage('prod-img-1');
    const img2 = await window.uploadImage('prod-img-2');
    const img3 = await window.uploadImage('prod-img-3');
    const images = [img1, img2, img3].filter(i => i !== null);

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
        list.innerHTML += `
            <div style="border-bottom:1px solid #ccc; padding:10px; background:white; margin-bottom:5px;">
                <b>${p.title}</b> - Stock: ${p.stock}
                <button onclick="deleteProduct('${doc.id}')" style="background:var(--danger); float:right; color:white; padding:5px 10px;">Delete</button>
            </div>
        `;
    });
}

window.deleteProduct = async (id) => {
    if(confirm("Delete this product?")) {
        await deleteDoc(doc(db, "products", id));
        loadProducts();
    }
};

// --- ORDER LOGIC ---
async function loadOrders() {
    const list = document.getElementById('order-list');
    if(!list) return;

    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    list.innerHTML = '';

    snap.forEach(docSnap => {
        const o = docSnap.data();
        const docId = docSnap.id;
        
        // Status Color logic
        let statusColor = '#333';
        if(o.status === 'New') statusColor = 'blue';
        if(o.status === 'Shipped') statusColor = 'orange';
        if(o.status === 'Completed') statusColor = 'green';
        if(o.status === 'Cancelled') statusColor = 'red';

        let itemsHtml = o.items ? o.items.map(i => `<li>${i.title} x ${i.qty}</li>`).join('') : 'No items';
        
        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <h4>${o.customer.name}</h4>
                    <small>${o.customer.phone} | ${o.customer.address}</small>
                </div>
                <div style="text-align:right">
                    <h3>${o.total}</h3>
                    <select class="status-select" style="border-color:${statusColor}; color:${statusColor}; font-weight:bold;" onchange="updateOrderStatus('${docId}', this.value)">
                        <option value="New" ${o.status === 'New' ? 'selected' : ''}>New</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
            <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
            <ul style="padding-left:20px; margin:0;">${itemsHtml}</ul>
            <small style="color:#888; margin-top:5px; display:block;">${o.timestamp ? new Date(o.timestamp.toDate()).toLocaleString() : ''}</small>
        `;
        list.appendChild(div);
    });
}

window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        loadOrders(); 
    } catch(e) {
        alert("Error updating status: " + e.message);
    }
};
