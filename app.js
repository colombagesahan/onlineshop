import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- GLOBAL VARIABLES ---
let currentUser = null;
const params = new URLSearchParams(window.location.search);
const inviteRef = params.get('ref'); // Handles White Label Invites

// --- 1. INITIALIZATION & AUTH LISTENER ---
document.addEventListener('DOMContentLoaded', async () => {
    // If URL has ?ref=AGENCY_ID, load that agency's branding on login screen
    if(inviteRef) await loadWhiteLabelLogin(inviteRef);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Fetch User Role & Data
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('dashboard-container').classList.remove('hidden');

            if (userData.role === 'agency') loadAgencyDashboard(user.uid);
            else if (userData.role === 'merchant') loadMerchantDashboard(user.uid, userData.parentAgencyId);
            else if (userData.role === 'super_admin') loadSuperAdmin();
        }
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('dashboard-container').classList.add('hidden');
    }
});

// --- 2. AUTHENTICATION LOGIC ---
window.handleAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const role = document.getElementById('reg-role').value;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        // If user doesn't exist, try to register
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                
                // DATA TO SAVE
                let userData = { email, role, createdAt: Date.now() };
                
                if (role === 'agency') {
                    // Create Agency Profile
                    await setDoc(doc(db, "agencies", cred.user.uid), {
                        name: "My New Agency",
                        primaryColor: "#2563eb",
                        logoUrl: "https://via.placeholder.com/150",
                        merchantCount: 0,
                        affiliateId: "",
                        trialStart: Date.now()
                    });
                } else if (role === 'merchant') {
                    // Link to Agency (or Super Admin if no ref)
                    userData.parentAgencyId = inviteRef || "super_admin";
                    
                    // Update Agency Count
                    if(inviteRef) {
                        const agRef = doc(db, "agencies", inviteRef);
                        const agSnap = await getDoc(agRef);
                        if(agSnap.exists()) await updateDoc(agRef, { merchantCount: agSnap.data().merchantCount + 1 });
                    }
                }

                await setDoc(doc(db, "users", cred.user.uid), userData);
                window.location.reload();
            } catch (e) { alert("Registration Error: " + e.message); }
        } else {
            alert(error.message);
        }
    }
};

window.logout = () => signOut(auth).then(() => window.location.href = window.location.pathname);

// --- 3. WHITE LABEL LOGIN LOGIC ---
async function loadWhiteLabelLogin(agencyId) {
    const snap = await getDoc(doc(db, "agencies", agencyId));
    if(snap.exists()) {
        const d = snap.data();
        // Brand the Login Screen
        document.getElementById('auth-logo').src = d.logoUrl;
        document.getElementById('auth-title').innerText = `Join ${d.name}`;
        document.documentElement.style.setProperty('--primary', d.primaryColor);
        
        // Force Role to Merchant (Hide selection)
        document.getElementById('reg-role').value = 'merchant';
        document.getElementById('role-select-wrapper').style.display = 'none';
        document.getElementById('auth-subtitle').innerText = "Create your store account";
    }
}

// ======================================================
// 4. AGENCY DASHBOARD (Your Clients)
// ======================================================
async function loadAgencyDashboard(uid) {
    const snap = await getDoc(doc(db, "agencies", uid));
    const data = snap.data();

    // Calculate Bill (14 Days Free, then $10 up to 50 merchants)
    const daysActive = Math.floor((Date.now() - data.trialStart) / (86400000));
    const trialLeft = 14 - daysActive;
    let bill = 0;
    if (trialLeft <= 0) {
        bill = 10 + (Math.max(0, data.merchantCount - 50) * 1);
    }

    // Apply Branding
    document.getElementById('dash-logo').src = data.logoUrl;
    document.documentElement.style.setProperty('--primary', data.primaryColor);

    const menu = document.getElementById('sidebar-menu');
    menu.innerHTML = `
        <div class="nav-item" onclick="renderAgencyHome()">Overview</div>
        <div class="nav-item" onclick="renderAgencySettings()">White Label Settings</div>
        <div class="nav-item" onclick="renderAgencyMerchants()">My Merchants</div>
    `;

    // --- Agency Functions attached to window ---
    window.renderAgencyHome = () => {
        document.getElementById('main-content').innerHTML = `
            <h2>Agency Overview</h2>
            <div class="grid">
                <div class="card">
                    <h3>Revenue/Bill</h3>
                    <h1 style="${trialLeft > 0 ? 'color:green' : 'color:red'}">$${bill}</h1>
                    <p>${trialLeft > 0 ? trialLeft + ' Days Free Trial' : 'Current Monthly Bill'}</p>
                </div>
                <div class="card">
                    <h3>Merchants</h3>
                    <h1>${data.merchantCount}</h1>
                    <p>Active Stores</p>
                </div>
                <div class="card" style="border-color:var(--primary); background:#eff6ff;">
                    <h3>Invite Link</h3>
                    <p>Send this to clients to sign up:</p>
                    <input readonly value="${window.location.href.split('?')[0]}?ref=${uid}">
                    <button class="btn" onclick="navigator.clipboard.writeText('${window.location.href.split('?')[0]}?ref=${uid}'); window.showToast('Copied!')">Copy Link</button>
                </div>
            </div>
        `;
    };

    window.renderAgencySettings = () => {
        document.getElementById('main-content').innerHTML = `
            <div class="card">
                <h3>Branding Settings</h3>
                <label>Agency Name</label> <input id="ag-name" value="${data.name}">
                <label>Primary Color</label> <input type="color" id="ag-color" value="${data.primaryColor}" style="height:50px">
                <label>Logo</label> <input type="file" id="ag-file">
                <label>AliExpress Affiliate ID</label> <input id="ag-aff" value="${data.affiliateId || ''}" placeholder="Your Affiliate ID">
                <button class="btn" onclick="saveAgencyConfig('${uid}')">Save Changes</button>
            </div>
        `;
    };

    window.saveAgencyConfig = async (id) => {
        const name = document.getElementById('ag-name').value;
        const color = document.getElementById('ag-color').value;
        const aff = document.getElementById('ag-aff').value;
        const file = document.getElementById('ag-file').files[0];
        
        let url = data.logoUrl;
        if(file) {
            const sRef = ref(storage, `logos/${id}`);
            await uploadBytes(sRef, file);
            url = await getDownloadURL(sRef);
        }

        await updateDoc(doc(db, "agencies", id), { name, primaryColor: color, affiliateId: aff, logoUrl: url });
        window.showToast("Settings Saved!");
        setTimeout(() => location.reload(), 1000);
    };

    window.renderAgencyHome(); // Default View
}

// ======================================================
// 5. MERCHANT DASHBOARD (Store Owners)
// ======================================================
async function loadMerchantDashboard(uid, agencyId) {
    // Fetch Agency branding to show on dashboard
    let branding = { primaryColor: '#2563eb', logoUrl: '', affiliateId: '' };
    if(agencyId) {
        const agSnap = await getDoc(doc(db, "agencies", agencyId));
        if(agSnap.exists()) branding = agSnap.data();
    }

    // Apply Branding
    document.documentElement.style.setProperty('--primary', branding.primaryColor);
    if(branding.logoUrl) document.getElementById('dash-logo').src = branding.logoUrl;
    
    // Set Navigation
    document.getElementById('sidebar-menu').innerHTML = `
        <div class="nav-item" onclick="renderMerchantProducts('${uid}')">My Products</div>
        <div class="nav-item" onclick="renderSourcing('${uid}', '${branding.affiliateId}')">Sourcing (Dropship)</div>
        <a href="shop.html?store=${uid}" target="_blank" class="nav-item" style="text-decoration:none;">View My Shop <i class="fa-solid fa-external-link-alt"></i></a>
    `;

    // --- Merchant Functions ---
    window.renderMerchantProducts = async (uid) => {
        const snap = await getDocs(collection(db, "shops", uid, "products"));
        let html = `
            <div class="card">
                <h3>Add New Product</h3>
                <div class="grid" style="grid-template-columns: 2fr 1fr auto;">
                    <input id="p-title" placeholder="Product Name">
                    <input id="p-price" type="number" placeholder="Price">
                    <button class="btn" onclick="addProduct('${uid}')">Add</button>
                </div>
            </div>
            <div class="grid">`;
        
        snap.forEach(d => {
            const p = d.data();
            html += `
                <div class="product-card">
                    <div class="product-img" style="background-image:url('${p.image || ''}')"></div>
                    <div class="product-info">
                        <h4>${p.title}</h4>
                        <p style="color:green; font-weight:bold;">${p.price}</p>
                        ${p.isDropship ? '<small style="color:orange">Dropship Item</small>' : '<small>Own Stock</small>'}
                    </div>
                </div>`;
        });
        html += `</div>`;
        document.getElementById('main-content').innerHTML = html;
    };

    window.addProduct = async (uid) => {
        const t = document.getElementById('p-title').value;
        const p = document.getElementById('p-price').value;
        await addDoc(collection(db, "shops", uid, "products"), {
            title: t, price: p, isDropship: false, createdAt: Date.now()
        });
        renderMerchantProducts(uid);
    };

    window.renderSourcing = (uid, agencyAffId) => {
        // Here you would normally fetch from "global_catalog"
        // For this demo, we mock an AliExpress product
        document.getElementById('main-content').innerHTML = `
            <div class="card">
                <h3>Global Sourcing</h3>
                <p>Import best-sellers. Commission ID used: <strong>${agencyAffId || 'System Default'}</strong></p>
                <div class="grid">
                    <div class="product-card">
                        <div class="product-img" style="background-image:url('https://via.placeholder.com/300?text=Watch')"></div>
                        <div class="product-info">
                            <h4>Luxury Watch</h4>
                            <p>Cost: $10</p>
                            <button class="btn" onclick="importItem('${uid}', 'Luxury Watch', 10, 'https://aliexpress.com/item/123')">Import to Store</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    window.importItem = async (uid, title, cost, url) => {
        const selling = prompt(`Cost is $${cost}. Enter Selling Price:`);
        if(!selling) return;
        
        await addDoc(collection(db, "shops", uid, "products"), {
            title: title, price: selling, isDropship: true, sourceUrl: url, createdAt: Date.now()
        });
        window.showToast("Imported Successfully!");
    };
    
    window.renderMerchantProducts(uid); // Default
}
