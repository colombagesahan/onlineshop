// --- UPDATED ORDER LOGIC FOR admin.js ---

async function loadOrders() {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const list = document.getElementById('order-list');
    list.innerHTML = '';

    snap.forEach(docSnap => {
        const o = docSnap.data();
        const docId = docSnap.id;
        
        // Status Color logic
        let statusColor = '#333';
        if(o.status === 'New') statusColor = 'blue';
        if(o.status === 'Shipped') statusColor = 'orange';
        if(o.status === 'Completed') statusColor = 'green';

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
                    <select class="status-select" style="border-color:${statusColor}; color:${statusColor}" onchange="updateOrderStatus('${docId}', this.value)">
                        <option value="New" ${o.status === 'New' ? 'selected' : ''}>New</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
            </div>
            <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
            <ul style="padding-left:20px; margin:0;">${itemsHtml}</ul>
            <small style="color:#888; margin-top:5px; display:block;">${new Date(o.timestamp.toDate()).toLocaleString()}</small>
        `;
        list.appendChild(div);
    });
}

// Add this function to window so HTML can see it
window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        // Optional: Show a small toast notification or just refresh
        loadOrders(); 
    } catch(e) {
        alert("Error updating status: " + e.message);
    }
};
