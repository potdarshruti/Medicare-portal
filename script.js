// Global error catcher: display errors in footer and send to server for logging
window.addEventListener('error', function (event) {
    try {
        const msg = event.message + ' at ' + event.filename + ':' + event.lineno + ':' + event.colno;
        document.getElementById('footer-message').innerText = 'JS Error: ' + msg;
        // best-effort send to server for inspection
        fetch('http://localhost:5000/api/debug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'error', message: msg, stack: event.error ? (event.error.stack || '') : '' })
        }).catch(()=>{});
    } catch (e) { /* ignore */ }
});
window.addEventListener('unhandledrejection', function (ev) {
    try {
        const msg = (ev.reason && ev.reason.message) ? ev.reason.message : String(ev.reason);
        document.getElementById('footer-message').innerText = 'UnhandledRejection: ' + msg;
        fetch('http://localhost:5000/api/debug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'unhandledrejection', message: msg, reason: ev.reason })
        }).catch(()=>{});
    } catch (e) {}
});

let loggedIn = false;    
let medicines = [];
let history = [];
    // stockIn variable removed
// Fixed admin credentials
const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "admin123";

// Load initial data from SQL Server through our API
async function loadData() {
    try {
        console.log("Loading data from server...");
        // Load medicines
        const medResponse = await fetch('http://localhost:5000/api/medicines');
        if (!medResponse.ok) {
            throw new Error(`Failed to load medicines: ${medResponse.status} ${medResponse.statusText}`);
        }
        medicines = await medResponse.json();
        console.log("Loaded medicines:", medicines);
        
        // Load history
        const histResponse = await fetch('http://localhost:5000/api/history');
        if (!histResponse.ok) {
            throw new Error(`Failed to load history: ${histResponse.status} ${histResponse.statusText}`);
        }
        history = await histResponse.json();
        console.log("Loaded history:", history);

            // Stock-in data loading removed
        
        // Update the UI
        if (document.getElementById('stock-section').style.display === 'block') {
            showStock();
        }
        if (document.getElementById('details-container') && document.getElementById('details-container').style.display === 'block') {
            showDetails();
        }

        document.getElementById('footer-message').innerHTML = '✅ Data loaded successfully';
    } catch(e) { 
        console.error('Load error:', e);
        document.getElementById('footer-message').innerHTML = `⚠️ Error: ${e.message}`;
    }
}

// Load data and show stock section by default
window.onload = async () => {
    try {
        hideAllSections();
        document.getElementById('stock-section').style.display = 'block';
        await loadData();
        showStock();
        document.getElementById('footer-message').innerHTML = 'Ready';
    } catch (error) {
        console.error('Error during initialization:', error);
        document.getElementById('footer-message').innerHTML = '⚠️ Error loading initial data';
    }
};

// Initialize button handlers
document.getElementById('login-btn').onclick = () => {
showLogin();
};
document.getElementById('logout-btn').onclick = () => {
loggedIn = false;
document.getElementById('logout-btn').style.display = 'none';
document.getElementById('login-btn').style.display = 'inline';
alert("🚪 Logged out");
};
function showLogin(){ document.getElementById('login-modal').style.display='block'; document.getElementById('login-modal-backdrop').style.display='block'; }
function hideLogin(){ document.getElementById('login-modal').style.display='none'; document.getElementById('login-modal-backdrop').style.display='none'; }
function loginUser(){
const id = document.getElementById('login-id').value.trim();
const pass = document.getElementById('login-pass').value;
if(id !== ADMIN_ID || pass !== ADMIN_PASSWORD){ 
    alert('Invalid password'); 
    return; 
}
loggedIn = true;
document.getElementById('logout-btn').style.display = 'inline';
document.getElementById('login-btn').style.display = 'none';
hideLogin();
document.getElementById('footer-message').innerText = `Logged in as ${id}`;
}   

document.getElementById('add-medicine-btn').onclick = async () => {
if (!loggedIn) {
    alert('⚠ Please login first');
    return;
}
hideAllSections();
showMedicineForm();
};

// Tab button handlers
document.getElementById('stock-btn').onclick = async () => {
try {
    hideAllSections();
    document.getElementById('stock-section').style.display = 'block';
    document.getElementById('footer-message').innerText = 'Loading stock data...';
    await loadData();
    showStock();
    document.getElementById('footer-message').innerText = 'Viewing current stock';
} catch (error) {
    console.error('Error loading stock:', error);
    document.getElementById('footer-message').innerHTML = '⚠️ Error: ' + error.message;
}
};

document.getElementById('dispense-btn').onclick = async () => {
if (!loggedIn) { 
    alert('⚠ Please login first'); 
    return; 
}
// Refresh data before showing dispense form
try {
    await loadData();
    hideAllSections();
    if (medicines.length === 0) {
        alert('⚠ No medicines available to dispense');
        document.getElementById('stock-section').style.display = 'block';
        return;
    }
    showDispenseForm();
    document.getElementById('footer-message').innerText = 'Dispensing medicine';
} catch (error) {
    console.error('Error loading medicines:', error);
    alert('⚠ Error loading medicines');
}
};

function checkNotifications() {
const notifications = [];
const today = new Date();

// Check expiry dates
medicines.forEach(med => {
    const expiryDate = new Date(med.expiry);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 10 && daysUntilExpiry > 0) {
        notifications.push(`⚠️ Medicine "${med.name}" (Batch: ${med.batch}) will expire in ${daysUntilExpiry} days`);
    } else if (daysUntilExpiry <= 0) {
        notifications.push(`🚫 Medicine "${med.name}" (Batch: ${med.batch}) has EXPIRED!`);
    }
    
    // Check stock levels
    if (med.quantity <= 10) {
        notifications.push(`📉 Low stock alert: "${med.name}" has only ${med.quantity} units remaining`);
    }
});

return notifications;
}

document.getElementById('notification-btn').onclick = async () => {
if (!loggedIn) { 
    alert('⚠ Please login first'); 
    return; 
}
hideAllSections();
await loadData(); // Refresh data before checking notifications

// Create or get notification container
let notificationContainer = document.getElementById('notification-container');
if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.margin = '20px';
    document.body.appendChild(notificationContainer);
}

const today = new Date();
const notifications = [];

// Check each medicine for expiry and stock alerts
medicines.forEach(med => {
    const expiryDate = new Date(med.expiry);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    // Check expiry date (10 days warning)
    if (daysUntilExpiry <= 10 && daysUntilExpiry > 0) {
        notifications.push({
            type: 'warning',
            icon: '⚠️',
            message: `Medicine "${med.name}" (Batch: ${med.batch}) will expire in ${daysUntilExpiry} days`
        });
    }
    
    // Check stock level (10 units warning)
    if (med.quantity <= 10) {
        notifications.push({
            type: 'danger',
            icon: '📉',
            message: `Low stock alert: Only ${med.quantity} units of "${med.name}" remaining`
        });
    }
});

// Display notifications with a nice UI
notificationContainer.style.display = 'block';
notificationContainer.innerHTML = `
    <div class="card shadow">
        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h4 class="mb-0">📬 Notifications</h4>
            <span class="badge bg-light text-dark">${notifications.length} Alert(s)</span>
        </div>
        <div class="card-body">
            ${notifications.length === 0 
                ? '<div class="alert alert-success">✅ No alerts at this time</div>'
                : notifications.map(notif => `
                    <div class="alert alert-${notif.type === 'warning' ? 'warning' : 'danger'} mb-2 d-flex align-items-center">
                        <div class="me-2">${notif.icon}</div>
                        <div>${notif.message}</div>
                    </div>
                `).join('')}
        </div>
        <div class="card-footer text-muted small">
            Last checked: ${new Date().toLocaleString()}
        </div>
    </div>
`;

document.getElementById('footer-message').innerText = `${notifications.length} notification(s) found`;
};

document.getElementById('report-btn').onclick = async () => {
try {
    await loadData();
    hideAllSections();
    // Show stock and the embedded details/report container
    document.getElementById('stock-section').style.display = 'block';
    const dc = document.getElementById('details-container');
    if (dc) dc.style.display = 'block';
    showDetails();
    document.getElementById('footer-message').innerText = 'Viewing activity report';
} catch (error) {
    console.error('Error loading report:', error);
    document.getElementById('footer-message').innerHTML = '⚠️ Error loading report data';
}
};


function hideAllSections() {
// Hide all content sections
document.getElementById('stock-section').style.display = 'none';
const dc = document.getElementById('details-container');
if (dc) dc.style.display = 'none';
// Hide notifications section if it exists
const notifyDiv = document.getElementById('notifications-section');
if (notifyDiv) notifyDiv.style.display = 'none';
// Hide all modals/forms
hideMedicineForm();
hideDispenseForm();
document.getElementById('dispense-form').style.display = 'none';
}

function clearScreen() {
document.getElementById('footer-message').innerHTML = 'Ready';
hideAllSections();
// Show stock section by default
document.getElementById('stock-section').style.display = 'block';
showStock();
}
async function addMedicine() {
const newMedicineName = document.getElementById('medicine-name').value;
const newBatchNumber = document.getElementById('batch-number').value;
const newExpiryDate = document.getElementById('expiry-date').value;
const newBrand = document.getElementById('brand').value;
const newSupplier = document.getElementById('supplier').value;
const newQuantity = parseInt(document.getElementById('quantity').value, 10);

if (!newMedicineName || !newBatchNumber || !newExpiryDate || !newBrand || !newSupplier) {
    alert("⚠ Please fill all fields");
    return;
}
if (!newQuantity || newQuantity < 1) {
    alert('⚠ Quantity must be a number greater than 0');
    return;
}

try {
    console.log("Sending medicine data:", {
        name: newMedicineName,
        batch: newBatchNumber,
        expiry: newExpiryDate,
        brand: newBrand,
        supplier: newSupplier,
        quantity: newQuantity
    });
    
    const response = await fetch('http://localhost:5000/api/medicines', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: newMedicineName,
            batch: newBatchNumber,
            expiry: newExpiryDate,
            brand: newBrand,
            supplier: newSupplier,
            quantity: newQuantity
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add medicine');
    }

    const output = `✅ Added Medicine: <b>${newMedicineName}</b>, Batch: ${newBatchNumber}, Expiry: ${newExpiryDate}, Brand: ${newBrand}, Supplier: ${newSupplier}, Quantity: ${newQuantity}`;
    document.getElementById('footer-message').innerHTML = output;
    
    // Clear form first
    document.getElementById('medicine-name').value = "";
    document.getElementById('batch-number').value = "";
    document.getElementById('expiry-date').value = "";
    document.getElementById('brand').value = "";
    document.getElementById('supplier').value = "";
    document.getElementById('quantity').value = "1";
    
    // Reload data and close form
    await loadData();
    
    hideMedicineForm();
    hideAllSections();
    document.getElementById('stock-section').style.display = 'block';
    showStock();
} catch (error) {
    console.error('Error adding medicine:', error);
    alert('Failed to add medicine: ' + error.message);
}
}


function showStock() {
console.log("Showing stock. Available medicines:", medicines);
const tbody = document.getElementById('stock-body');
tbody.innerHTML = '';
if (!medicines || medicines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">⚠ No medicines added yet</td></tr>`;
    return;
}

medicines.forEach((med) => {
    tbody.innerHTML += `
    <tr>
        <td>${med.id}</td>
        <td>${med.name}</td>
        <td>${med.batch}</td>
        <td>${med.expiry}</td>
        <td>${med.brand}</td>
        <td>${med.supplier}</td>
        <td>${med.quantity ?? 0}</td>
        <td class="text-nowrap">
        <button class="btn btn-sm btn-danger" onclick="deleteMedicine(${med.id})">❌ Delete</button>
        </td>
    </tr>
    `;
});
}

async function deleteMedicine(id) {
if (confirm("Are you sure you want to delete this medicine?")) {
    try {
        const response = await fetch(`http://localhost:5000/api/medicines/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete medicine');
        }
        
        // Reload data from server
        await loadData();
        showStock();
    } catch (error) {
        alert('Failed to delete medicine: ' + error.message);
    }
}
}
function showDispenseForm() {
// Get fresh data first
const select = document.getElementById('dispense-select');
select.innerHTML = '<option value="">-- choose medicine --</option>';
medicines.forEach(m => {
    if (m.quantity > 0) {  // Only show medicines with stock
        select.innerHTML += `<option value="${m.id}">${m.name} (Batch: ${m.batch}) — Available: ${m.quantity}</option>`;
    }
});

// Reset form
document.getElementById('patient-name').value = '';
document.getElementById('dispense-quantity').value = '1';

// Show form
document.getElementById('dispense-backdrop').style.display = 'block';
document.getElementById('dispense-form').style.display = 'block';
}

function hideDispenseForm() {
document.getElementById('dispense-backdrop').style.display = 'none';
document.getElementById('dispense-form').style.display = 'none';
}

async function dispenseMedicine() {
if (!loggedIn) {
    alert('⚠ Please login first');
    return;
}

// Get form values
const medicineId = document.getElementById('dispense-select').value;
const patient = document.getElementById('patient-name').value.trim();
const qty = document.getElementById('dispense-quantity').value;

console.log('Dispense form values:', { medicineId, patient, qty });

// Validate form values
if (!medicineId) { 
    alert('⚠ Please select a medicine'); 
    return; 
}
if (!patient) { 
    alert('⚠ Please enter patient name'); 
    return; 
}
if (!qty || parseInt(qty) < 1) { 
    alert('⚠ Quantity must be 1 or more'); 
    return; 
}

try {
    // Find medicine details first to check quantity
    const med = medicines.find(m => m.id === parseInt(medicineId));
    if (!med) {
        alert('⚠ Medicine not found');
        return;
    }
    if (med.quantity < parseInt(qty)) {
        alert(`⚠ Not enough stock. Available: ${med.quantity}`);
        return;
    }
    
    const response = await fetch('http://localhost:5000/api/dispense', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            medicine_id: medicineId,
            quantity: qty,
            patient: patient
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to dispense medicine');
    }
    
    const out = `🩺 Dispensed ${qty} x ${med.name} to ${patient}. Operation successful.`;
    document.getElementById('footer-message').innerHTML = out;
    
    // Clear form
    document.getElementById('dispense-select').value = "";
    document.getElementById('patient-name').value = "";
    document.getElementById('dispense-quantity').value = "1";
    
    // Reload data from server
    await loadData();
    
    hideDispenseForm();
    hideAllSections();
    document.getElementById('stock-section').style.display = 'block';
    showStock();
} catch (error) {
    console.error('Error dispensing medicine:', error);
    alert('Failed to dispense medicine: ' + error.message);
}
}

// Since we're using a database, we don't need these functions anymore
function saveData() {
// Data is saved through API calls now
}
function recordHistory(entry) {
// History is recorded through API calls now
loadData(); // Reload to get updated history
}
function showDetails(){
const tbody = document.getElementById('history-body');
tbody.innerHTML = '';
// Ensure details container is visible
const detailsContainer = document.getElementById('details-container');
if (detailsContainer) detailsContainer.style.display = 'block';

// summary for report
const summaryElId = 'report-summary';
let summaryEl = document.getElementById(summaryElId);
if (!summaryEl) {
    summaryEl = document.createElement('div');
    summaryEl.id = summaryElId;
    summaryEl.className = 'mb-3';
    // insert summary at the top of details container
    if (detailsContainer && detailsContainer.firstChild) {
        detailsContainer.insertBefore(summaryEl, detailsContainer.firstChild.nextSibling);
    }
}

const totalItems = medicines.length;
const totalQuantity = medicines.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
summaryEl.innerHTML = `<strong>Stock summary:</strong> ${totalItems} item(s), ${totalQuantity} total units`;
if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No history yet</td></tr>';
    return;
}
history.forEach((h, i) => {
    tbody.innerHTML += `
    <tr>
        <td>${i+1}</td>
        <td>${h.type}</td>
        <td>${h.medicine_name || ''}</td>
        <td>${h.batch || ''}</td>
        <td>${h.quantity || ''}</td>
        <td>${h.person || ''}</td>
        <td>${new Date(h.timestamp).toLocaleString()}</td>
    </tr>
    `;
});
}

document.getElementById('clear-history-btn').onclick = async () => {
if (!confirm('Clear all history?')) return;
try {
    const response = await fetch('http://localhost:5000/api/history/clear', {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error('Failed to clear history');
    }
    
    await loadData(); // Reload data from server
    showDetails();
    document.getElementById('footer-message').innerText = 'History cleared';
} catch (error) {
    alert('Failed to clear history: ' + error.message);
}
};
function showMedicineForm() {
const form = document.getElementById('medicine-form');
const backdrop = document.getElementById('medicine-form-backdrop');
form.style.display = 'block';
backdrop.style.display = 'block';
}
function hideMedicineForm() {
const form = document.getElementById('medicine-form');
const backdrop = document.getElementById('medicine-form-backdrop');
form.style.display = 'none';
backdrop.style.display = 'none';
}
