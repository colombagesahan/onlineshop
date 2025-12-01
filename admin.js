import { auth, db, storage, getSiteSettings } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadSettings();
        loadProducts();
        loadOrders();
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    }
});

// Login
window.adminLogin = () => {
    const e = document.getElementById('admin-email').value;
    const p = document.getElementById('admin-pass').value;
    signInWithEmailAndPassword(auth, e, p)
        .then(() => {
            console.log("Logged in");
        })
        .catch(err => {
            alert("Login Failed: " + err.message);
        });
};

window.logout = () => signOut(auth);

// --- SETTINGS LOGIC ---
async function loadSettings() {
    const data = await getSiteSettings();
    document.getElementById('set-bizName').value = data.bizName || "";
    document.getElementById('set-color').value = data.primaryColor || "#000000";
    document.getElementById('set-phone').value = data.ownerPhone || "";
    document.getElementById('set-logo-url').value = data.logoUrl || "";
    document.getElementById('set-hero').value = data.heroText || "";
    document.getElementById('set-vision').value = data.vision || "";
    document.getElementById('set-contact').value = data.contact || "";
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
    const file = document.getElementById(inputId).files[0];
    if (!file) return null;
    
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    if(hiddenInputId) document.getElementById(hiddenInputId).value = url;
    return url;
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
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const list = document.getElementById('admin-product-list');
    list.innerHTML = '';
    
    snap.forEach(doc => {
        const p = doc.data();
        list.innerHTML += `
            <div style="border-bottom:1px solid #ccc; padding:10px;">
                <b>${p.title}</b> - Stock: ${p.stock}
                <button onclick="deleteProduct('${doc.id}')" style="background:red; float:right; color:white;">Delete</button>
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

// --- ORDER LOGIC (Updated with Status) ---
async function loadOrders() {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const list = document.getElementById('order-list');
    list.innerHTML = '';

    snap.forEach(docSnap => {
        const o = docSnap.data();
        const docId = docSnap.id;
        
        // Color logic for status
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

// Function to update order status in Firebase
window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        // Refresh orders to see the color change
        loadOrders(); 
    } catch(e) {
        alert("Error updating status: " + e.message);
    }
};
