import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- GLOBAL VARIABLES ---
const params = new URLSearchParams(window.location.search);
const refAgency = params.get('ref') || "super_admin"; // Default ref
let currentUser = null;

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // Load Landing Page Data based on ?ref=AGENCY_ID
    if(refAgency !== "super_admin") {
        try {
            const snap = await getDoc(doc(db, "agencies", refAgency));
            if(snap.exists()) {
                const d = snap.data();
                if(document.getElementById('lp-title')) document.getElementById('lp-title').innerText = d.lpTitle || "Build Your Business";
                if(document.getElementById('lp-desc')) document.getElementById('lp-desc').innerText = d.lpDesc || "Join us today.";
                if(document.getElementById('lp-logo')) document.getElementById('lp-logo').innerText = d.name;
                if(document.getElementById('lp-agency-name')) document.getElementById('lp-agency-name').innerText = d.name;
                document.documentElement.style.setProperty('--primary', d.primaryColor || '#2563eb');
            }
        } catch(e) { console.log("Agency Load Error", e); }
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Hide Public Landing, Show Dashboard
        const lp = document.getElementById('public-landing');
        const am = document.getElementById('auth-modal');
        const dbPanel = document.getElementById('dashboard');
        
        if(lp) lp.classList.add('hidden');
        if(am) am.classList.add('hidden');
        if(dbPanel) dbPanel.classList.remove('hidden');
        
        // Fetch Role
        const snap = await getDoc(doc(db, "users", user.uid));
        if(snap.exists()){
            const data = snap.data();
            const role = data.role;
            const myAgencyId = data.agencyId || "super_admin";

            document.getElementById('dash-brand').innerText = role.toUpperCase().replace('_', ' ');

            // ROUTER
            if(role === 'super_admin') loadSuperAdmin();
            else if(role === 'agency') loadAgency(user.uid);
            else if(role === 'merchant') loadMerchant(user.uid, myAgencyId);
            else if(role === 'supplier') loadSupplier(user.uid, myAgencyId);
        }
    }
});

// --- 2. AUTH HANDLER ---
window.handleAuth = async () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pass').value;
    
    // Check if we are in Register mode (hidden fields visible)
    const isRegister = !document.getElementById('reg-fields').classList.contains('hidden');
    const regName = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role-select').value;

    try {
        if(!isRegister) {
            // LOGIN
            await signInWithEmailAndPassword(auth, e, p);
        } else {
            // REGISTER
            if(!regName) return alert("Enter Name");
            const cred = await createUserWithEmailAndPassword(auth, e, p);
            
            // Save User Profile
            let userData = { email: e, role: role, name: regName, createdAt: Date.now() };
            
            if(role === 'merchant' || role === 'supplier') {
                userData.agencyId = refAgency; // Link to the agency who owns the landing page
            }

            if(role === 'agency') {
                // Initialize Agency Website Data
                await setDoc(doc(db, "agencies", cred.user.uid), {
                    name: regName,
                    primaryColor: "#2563eb",
                    lpTitle: "Start Your Business",
                    lpDesc: "The best platform for merchants.",
                    merchantCount: 0,
                    createdAt: Date.now()
                });
            }
            
            // If Merchant, init empty shop settings
            if(role === 'merchant') {
                await setDoc(doc(db, "shops", cred.user.uid), {
                    storeName: regName + "'s Shop",
                    phone: "",
                    products: []
                });
            }

            await setDoc(doc(db, "users", cred.user.uid), userData);
            location.reload();
        }
    } catch(err) { alert(err.message); }
};
window.logout = () => signOut(auth).then(()=>location.reload());

// ===========================================
// ROLE 1: SUPER ADMIN (YOU)
// ===========================================
async function loadSuperAdmin() {
    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = `
        <div onclick="sa_Overview()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">Overview</div>
    `;
    
    window.sa_Overview = async () => {
        const agSnap = await getDocs(collection(db, "agencies"));
        document.getElementById('main-view').innerHTML = `
            <h1>Super Admin</h1>
            <div class="grid">
                <div class="card"><h3>Total Agencies</h3><h1>${agSnap.size}</h1></div>
                <div class="card"><h3>Revenue</h3><h1>$${agSnap.size * 10}</h1><small>Est. Subscription</small></div>
            </div>
            <div class="guide-box">
                <h3>💰 How You Make Money</h3>
                <div class="guide-step"><span class="step-num">1</span> <p><strong>Sell Subscriptions:</strong> Charge agencies $10/mo to use this platform.</p></div>
                <div class="guide-step"><span class="step-num">2</span> <p><strong>White Label:</strong> Agencies pay you to put their own logo on it.</p></div>
            </div>
        `;
    };
    window.sa_Overview();
}

// ===========================================
// ROLE 2: AGENCY (YOUR CLIENTS)
// ===========================================
async function loadAgency(uid) {
    const agSnap = await getDoc(doc(db, "agencies", uid));
    const data = agSnap.data();

    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = `
        <div onclick="ag_Website()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">Website Builder</div>
        <div onclick="ag_Merchants()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">My Merchants</div>
    `;

    // 1. Website Builder
    window.ag_Website = () => {
        document.getElementById('main-view').innerHTML = `
            <h1>Agency Website Builder</h1>
            <div class="guide-box">
                <h3>💰 How You Make Money</h3>
                <div class="guide-step"><span class="step-num">1</span> <p><strong>Recruit Merchants:</strong> Send the link below to shop owners.</p></div>
                <div class="guide-step"><span class="step-num">2</span> <p><strong>Charge Fees:</strong> Ask them to pay you monthly for the service.</p></div>
            </div>
            
            <div class="card">
                <h3>Your Recruitment Link</h3>
                <input type="text" readonly value="${window.location.origin + window.location.pathname}?ref=${uid}">
                <button class="btn" onclick="navigator.clipboard.writeText('${window.location.origin + window.location.pathname}?ref=${uid}')">Copy Link</button>
            </div>

            <div class="card">
                <h3>Customize Landing Page</h3>
                <label>Agency Name</label> <input id="ag-name" value="${data.name}">
                <label>Headline</label> <input id="ag-title" value="${data.lpTitle}">
                <label>Description</label> <textarea id="ag-desc">${data.lpDesc}</textarea>
                <label>Brand Color</label> <input type="color" id="ag-color" value="${data.primaryColor}" style="height:50px;">
                <button onclick="saveAgencySettings('${uid}')" class="btn">Save Website</button>
            </div>
        `;
    };

    window.saveAgencySettings = async (id) => {
        await updateDoc(doc(db, "agencies", id), {
            name: document.getElementById('ag-name').value,
            lpTitle: document.getElementById('ag-title').value,
            lpDesc: document.getElementById('ag-desc').value,
            primaryColor: document.getElementById('ag-color').value
        });
        alert("Website Updated!");
    };

    // 2. Merchants List
    window.ag_Merchants = async () => {
        const q = query(collection(db, "users"), where("agencyId", "==", uid), where("role", "==", "merchant"));
        const snap = await getDocs(q);
        let html = `<h1>My Merchants (${snap.size})</h1><div class="grid">`;
        snap.forEach(d => {
            const m = d.data();
            html += `<div class="card"><h4>${m.name}</h4><p>${m.email}</p></div>`;
        });
        html += `</div>`;
        document.getElementById('main-view').innerHTML = html;
    };
    
    window.ag_Website(); // Default View
}

// ===========================================
// ROLE 3: MERCHANT (SELLERS)
// ===========================================
async function loadMerchant(uid, agencyId) {
    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = `
        <div onclick="mer_Store()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">Store Builder</div>
        <div onclick="mer_Products()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">My Products</div>
        <div onclick="mer_Sourcing()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">Sourcing</div>
        <a href="shop.html?store=${uid}" target="_blank" class="btn" style="text-align:center; margin-top:20px;">Open My Shop</a>
    `;

    // 1. Store Builder
    window.mer_Store = async () => {
        const shopSnap = await getDoc(doc(db, "shops", uid));
        const shop = shopSnap.data() || {};
        
        document.getElementById('main-view').innerHTML = `
            <h1>Store Builder</h1>
            <div class="guide-box">
                <h3>💰 How You Make Money</h3>
                <div class="guide-step"><span class="step-num">1</span> <p><strong>Create Store:</strong> Setup your name and WhatsApp number.</p></div>
                <div class="guide-step"><span class="step-num">2</span> <p><strong>Share Link:</strong> Send your shop link to customers.</p></div>
                <div class="guide-step"><span class="step-num">3</span> <p><strong>Get Paid:</strong> Orders come to your WhatsApp. You collect cash.</p></div>
            </div>

            <div class="card">
                <h3>Store Settings</h3>
                <label>Store Name</label> <input id="st-name" value="${shop.storeName || ''}">
                <label>WhatsApp Number (With Country Code)</label> <input id="st-phone" value="${shop.phone || ''}" placeholder="9477.......">
                <button onclick="saveStoreSettings('${uid}')" class="btn">Save Settings</button>
            </div>
        `;
    };

    window.saveStoreSettings = async (id) => {
        await updateDoc(doc(db, "shops", id), {
            storeName: document.getElementById('st-name').value,
            phone: document.getElementById('st-phone').value
        });
        alert("Store Updated!");
    };

    // 2. Products
    window.mer_Products = async () => {
        const snap = await getDocs(collection(db, "shops", uid, "products"));
        let html = `
            <h1>My Products</h1>
            <div class="card">
                <h3>Add New Product</h3>
                <div class="grid">
                    <input id="p-title" placeholder="Product Name">
                    <input id="p-price" type="number" placeholder="Price">
                    <input id="p-img" placeholder="Image URL">
                </div>
                <button onclick="addMerchantProduct('${uid}')" class="btn">Add Product</button>
            </div>
            <div class="grid">`;
            
        snap.forEach(d => {
            const p = d.data();
            html += `<div class="card">
                <img src="${p.image}" style="height:100px; object-fit:contain; display:block; margin-bottom:10px;">
                <h4>${p.title}</h4>
                <p style="color:green; font-weight:bold;">${p.price}</p>
                ${p.isDropship ? '<small style="color:orange;">Dropship Item</small>' : '<small>Own Item</small>'}
            </div>`;
        });
        html += `</div>`;
        document.getElementById('main-view').innerHTML = html;
    };

    window.addMerchantProduct = async (id) => {
        await addDoc(collection(db, "shops", id, "products"), {
            title: document.getElementById('p-title').value,
            price: document.getElementById('p-price').value,
            image: document.getElementById('p-img').value || "https://via.placeholder.com/150",
            isDropship: false,
            createdAt: Date.now()
        });
        mer_Products(); // Refresh
    };

    // 3. Sourcing (From Suppliers in the same Agency)
    window.mer_Sourcing = async () => {
        // Query products from Suppliers linked to this Agency
        const q = query(collection(db, "supplier_products"), where("agencyId", "==", agencyId));
        const snap = await getDocs(q);

        let html = `
            <h1>Sourcing Center</h1>
            <p>Import products published by suppliers in your agency network.</p>
            <div class="grid">`;
        
        if(snap.empty) html += `<p>No supplier products found. Contact your Agency.</p>`;

        snap.forEach(d => {
            const p = d.data();
            html += `
                <div class="card" style="border-left:4px solid orange;">
                    <h4>${p.title}</h4>
                    <p>Wholesale Cost: <strong>${p.cost}</strong></p>
                    <button onclick="importToShop('${uid}', '${p.title}', '${p.image}', ${p.cost})" class="btn">Import & Sell</button>
                </div>
            `;
        });
        html += `</div>`;
        document.getElementById('main-view').innerHTML = html;
    };

    window.importToShop = async (uid, title, img, cost) => {
        const sellPrice = prompt(`Wholesale Cost is ${cost}. Enter Selling Price:`);
        if(!sellPrice) return;
        
        await addDoc(collection(db, "shops", uid, "products"), {
            title: title,
            image: img,
            price: sellPrice,
            wholesaleCost: cost,
            isDropship: true,
            createdAt: Date.now()
        });
        alert("Imported! Go to 'My Products' to see it.");
    };

    window.mer_Store(); // Default View
}

// ===========================================
// ROLE 4: SUPPLIER (PRODUCT SOURCE)
// ===========================================
async function loadSupplier(uid, agencyId) {
    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = `
        <div onclick="sup_Catalog()" class="btn-outline" style="padding:10px; margin-bottom:5px; cursor:pointer;">My Catalog</div>
    `;

    window.sup_Catalog = async () => {
        const q = query(collection(db, "supplier_products"), where("supplierId", "==", uid));
        const snap = await getDocs(q);
        
        let html = `
            <h1>Supplier Catalog</h1>
            <div class="guide-box">
                <h3>💰 How You Make Money</h3>
                <div class="guide-step"><span class="step-num">1</span> <p><strong>Publish Products:</strong> Add items you have in stock.</p></div>
                <div class="guide-step"><span class="step-num">2</span> <p><strong>Merchants Sell:</strong> Merchants in this agency will see and sell them.</p></div>
            </div>

            <div class="card">
                <h3>Publish Product</h3>
                <div class="grid">
                    <input id="s-title" placeholder="Item Name">
                    <input id="s-cost" type="number" placeholder="Wholesale Cost">
                    <input id="s-img" placeholder="Image URL">
                </div>
                <button onclick="publishSupplierItem('${uid}', '${agencyId}')" class="btn">Publish</button>
            </div>
            <div class="grid">`;
            
        snap.forEach(d => {
            const p = d.data();
            html += `<div class="card"><h4>${p.title}</h4><p>Cost: ${p.cost}</p></div>`;
        });
        html += `</div>`;
        document.getElementById('main-view').innerHTML = html;
    };

    window.publishSupplierItem = async (uid, agId) => {
        await addDoc(collection(db, "supplier_products"), {
            title: document.getElementById('s-title').value,
            cost: document.getElementById('s-cost').value,
            image: document.getElementById('s-img').value || "https://via.placeholder.com/150",
            supplierId: uid,
            agencyId: agId, // CRITICAL: Only merchants in this agency can see
            createdAt: Date.now()
        });
        alert("Published!");
        sup_Catalog();
    };

    window.sup_Catalog();
}
