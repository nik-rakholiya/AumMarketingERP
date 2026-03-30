/* AUM ERP APP LOGIC (External JS) */

/* =========================================================================
   CONFIG
========================================================================= */
// Replace this with the URL you get after deploying your Google Apps Script Web App
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzSrhyBy4Kla9SLNwVGfPgnbvmkgYYJGCsWGanfS3ushzIP3zTwBkqlkrVL6ucF-NCd/exec";

/* =========================================================================
   CORE STATE & INITIALIZATION
========================================================================= */
let currentUser = null;
let currentToken = null;
let activeView = '';

document.addEventListener("DOMContentLoaded", function () {
    // Load preferred theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    ThemeManager.setTheme(savedTheme);

    // Check Session Auth
    AuthManager.checkSession();
});

/* =========================================================================
   UI & THEME MANAGER
========================================================================= */
const ThemeManager = {
    setTheme: function (theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const btn = document.getElementById('themeBtn');
        if (btn) {
            btn.innerHTML = theme === 'dark'
                ? '<i class="material-icons-outlined">light_mode</i>'
                : '<i class="material-icons-outlined">dark_mode</i>';
        }
    },
    toggle: function () {
        const current = document.body.getAttribute('data-theme');
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
};

function toggleTheme() { ThemeManager.toggle(); }

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    } else {
        sidebar.classList.add('open');
    }
}

// Toast Notifications
const Toast = {
    show: function (message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';

        let icon = 'info';
        if (type === 'success') toast.style.borderLeftColor = 'var(--status-success)';
        if (type === 'error') toast.style.borderLeftColor = 'var(--status-error)';
        if (type === 'warning') toast.style.borderLeftColor = 'var(--status-warning)';

        toast.innerHTML = `<i class="material-icons-outlined" style="color:${toast.style.borderLeftColor}">${icon}</i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Loader toggle
const Loader = {
    show: function () { document.getElementById('global-loader').classList.remove('hidden'); },
    hide: function () { document.getElementById('global-loader').classList.add('hidden'); }
};

/* =========================================================================
   AUTHENTICATION MANAGER
========================================================================= */
const AuthManager = {
    checkSession: function () {
        const sessionToken = localStorage.getItem('sessionToken');
        const userData = localStorage.getItem('userData');

        if (sessionToken && userData) {
            currentToken = sessionToken;
            currentUser = JSON.parse(userData);
            this.handleLoginSuccess();
        } else {
            this.showAuthScreen();
        }
        Loader.hide();
    },
    showAuthScreen: function () {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },
    handleLoginSuccess: function () {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-name').innerText = currentUser.name;
        document.getElementById('user-role').innerText = currentUser.role;
        document.getElementById('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

        // Fetch Global Configs on login
        apiCall('getGlobalConfig', {}, function (configs) {
            window.AppConfig = configs;
        }, null, true);

        // Show/Hide Admin Modules
        if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
            document.getElementById('admin-menu').classList.remove('hidden');
        }

        // Load default view
        navigate('dashboard');
    },
    logout: function () {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('userData');
        currentUser = null;
        currentToken = null;
        this.showAuthScreen();
    }
};

function toggleAuthForm(target) {
    if (target === 'signup') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    } else {
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>';

    apiCall('workerLogin', { phone: phone, password: pass }, function (res) {
        btn.innerHTML = '<span class="btn-text">Sign In</span>';
        localStorage.setItem('sessionToken', res.token);
        localStorage.setItem('userData', JSON.stringify(res.user));
        AuthManager.checkSession();
        Toast.show('Welcome back!', 'success');
    }, function (errText) {
        btn.innerHTML = '<span class="btn-text">Sign In</span>';
    });
}

function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const pass = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>';

    apiCall('workerSignup', { name: name, phone: phone, password: pass }, function (res) {
        btn.innerHTML = '<span class="btn-text">Register Attempt</span>';
        Toast.show(res.message, 'success');
        toggleAuthForm('login');
    }, function () {
        btn.innerHTML = '<span class="btn-text">Register Attempt</span>';
    });
}

function logout() { AuthManager.logout(); }

/* =========================================================================
   ROUTER / VIEW MANAGER
========================================================================= */
const ViewManager = {
    loadView: function (viewId) {
        const container = document.getElementById('view-container');

        // Update Title and Active Nav States
        document.getElementById('page-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);

        document.querySelectorAll('.nav-item, .b-nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll(`.nav-item[data-view="${viewId}"], .b-nav-item[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));

        // Fetch Template from DOM (since we packed everything in index.html)
        const templateEl = document.getElementById('template_' + viewId);
        if (templateEl) {
            container.innerHTML = templateEl.innerHTML;
            // Execute view specific JS if needed
            if (window['init_' + viewId]) window['init_' + viewId]();
        } else {
            container.innerHTML = `<div class="surface-card">
                 <h3>Module Under Construction</h3>
                 <p>The ${viewId} module is being developed.</p>
            </div>`;
        }

        activeView = viewId;
        if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); }
    }
};

function navigate(viewId) { ViewManager.loadView(viewId); }

/* =========================================================================
   GENERIC API WRAPPER (Universal Fetch JSON)
========================================================================= */
async function apiCall(action, payload, onSuccess, onError, silentLoad = false) {
    if (APPS_SCRIPT_WEB_APP_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
        Toast.show("Please configure your GAS Web App URL in app.js", "error");
        if (onError) onError();
        return;
    }

    if (!silentLoad) Loader.show();

    try {
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, data: payload }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Bypass CORS preflight in GAS
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            if (onSuccess) onSuccess(result.data);
        } else {
            Toast.show(result.message || "An error occurred", "error");
            if (onError) onError(result.message);
        }
    } catch (error) {
        Toast.show('Network error: Could not reach server.', 'error');
        console.error("API Error:", error);
        if (onError) onError(error);
    } finally {
        if (!silentLoad) Loader.hide();
    }
}

/* =========================================================================
   UI HELPERS & ANIMATIONS
========================================================================= */
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

const SkeletonBuilder = {
    generateTr: function(cols) {
        let tds = '';
        for(let i=0; i<cols; i++) {
            tds += `<td><div class="skeleton-box" style="width: ${Math.floor(Math.random() * 40 + 60)}%;"></div></td>`;
        }
        return `<tr class="skeleton-row">${tds}</tr>`;
    },
    generateTable: function(rows, cols) {
        let html = '';
        for(let i=0; i<rows; i++) html += this.generateTr(cols);
        return html;
    }
};

/* =========================================================================
   MODAL MANAGER
========================================================================= */
window.Modal = {
    open: function (title, bodyHTML) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('global-modal').classList.add('open');
    },
    close: function () {
        document.getElementById('global-modal').classList.remove('open');
    },

    // Specific Modal Triggers
    openAddProduct: function (parentListHTML) {
        const html = `
            <form onsubmit="app_saveProduct(event)">
                <div class="form-group">
                    <label class="form-label">Product Name</label>
                    <input type="text" id="p-name" class="form-input" required>
                </div>
                <div class="form-group" style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label class="form-label">Category</label>
                        <select id="p-cat" class="form-input">
                            <option>General</option>
                            <option>Flash Cards</option>
                            <option>Books</option>
                            <option>Games</option>
                        </select>
                    </div>
                    <div style="flex:1;">
                        <label class="form-label">Parent Product (Optional)</label>
                        <select id="p-parent" class="form-input">
                            <option value="">None (Standalone)</option>
                            ${parentListHTML || ''}
                        </select>
                    </div>
                </div>
                <div class="form-group" style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label class="form-label">Brand</label>
                        <input type="text" id="p-brand" class="form-input">
                    </div>
                    <div style="flex:1;">
                        <label class="form-label">Job Work Price (₹)</label>
                        <input type="number" step="0.01" id="p-price" class="form-input" placeholder="Per Unit Output" required>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                    <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn-primary" style="width:auto;">Save Product</button>
                </div>
            </form>
        `;
        this.open("Add New Product", html);
    },

    openAddMaterial: function () {
        const html = `
            <form onsubmit="app_saveMaterial(event)">
                <div class="form-group">
                    <label class="form-label">Material Name</label>
                    <input type="text" id="m-name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit (e.g. Kg, Mtr)</label>
                    <input type="text" id="m-unit" class="form-input" value="Kg" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Minimum Alert Stock</label>
                    <input type="number" id="m-min" class="form-input" value="10">
                </div>
                <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                    <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn-primary" style="width:auto;">Save Material</button>
                </div>
            </form>
        `;
        this.open("Add Raw Material", html);
    },

    openWorkerRole: function (id, name, currentRole, currentStatus) {
        const html = `
            <form onsubmit="app_saveWorker(event, '${id}')">
                <p style="margin-bottom:16px; color:var(--text-secondary);">Editing permissions for <b>${name}</b></p>
                <div class="form-group">
                    <label class="form-label">System Role</label>
                    <select id="w-role" class="form-input">
                        <option value="Worker" ${currentRole === 'Worker' ? 'selected' : ''}>Worker</option>
                        <option value="Admin" ${currentRole === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Manager" ${currentRole === 'Manager' ? 'selected' : ''}>Manager</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Account Status</label>
                    <select id="w-status" class="form-input">
                        <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Active" ${currentStatus === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
                <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                    <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn-primary" style="width:auto;">Update Worker</button>
                </div>
            </form>
        `;
        this.open("Manage Worker", html);
    }
};

/* =========================================================================
   WORKERS MODULE LOGIC
========================================================================= */
window.loadWorkers = function () {
    const tbody = document.getElementById('workers-tbody');
    if (!tbody) return;
    
    // Inject smooth skeleton loading instead of blocking everything
    tbody.innerHTML = SkeletonBuilder.generateTable(4, 5);

    apiCall('getWorkers', {}, function (data) {
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No workers found.</td></tr>';
            return;
        }

        let html = '';
        data.forEach(w => {
            let statusBadge = w.Status === 'Active' ? 'active' : (w.Status === 'Pending' ? 'pending' : 'neutral');
            html += `
            <tr style="animation: fadeIn 0.4s ease-out;">
                <td style="font-weight:600;">${w.Name}</td>
                <td>${w.Phone}</td>
                <td>${w.Role || 'Worker'}</td>
                <td><span class="badge ${statusBadge}">${w.Status}</span></td>
                <td>
                    <button class="icon-btn" onclick="Modal.openWorkerRole('${w.ID}', '${w.Name}', '${w.Role}', '${w.Status}')">
                        <i class="material-icons-outlined">edit</i>
                    </button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }, null, true); // <--- Note: true enables silentLoad (no global splash)
};

window.app_saveWorker = function (e, workerId) {
    e.preventDefault();
    const role = document.getElementById('w-role').value;
    const status = document.getElementById('w-status').value;

    apiCall('updateWorker', { workerId: workerId, role: role, status: status }, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadWorkers(); // refresh
    });
};

/* =========================================================================
   MASTER DATA (PRODUCTS & MATERIALS) LOGIC
========================================================================= */
window.loadMasterData = function () {
    const tbodyProd = document.getElementById('products-tbody');
    const tbodyMat = document.getElementById('materials-tbody');
    
    if(tbodyProd) tbodyProd.innerHTML = SkeletonBuilder.generateTable(3, 4);
    if(tbodyMat) tbodyMat.innerHTML = SkeletonBuilder.generateTable(3, 3);

    // Load Products
    apiCall('getProducts', {}, function (data) {
        if (!tbodyProd) return;
        window.cachedProducts = data || []; // Cache for parent dropdowns
        
        if (!data || data.length === 0) {
            tbodyProd.innerHTML = '<tr><td colspan="5" style="text-align:center;">No products found.</td></tr>';
        } else {
            let html = '';
            data.forEach(p => {
                let badge = p.ParentProductID ? `<span class="badge neutral" style="font-size:10px; margin-left:8px;">Sub</span>` : '';
                html += `<tr style="animation: fadeIn 0.4s ease-out;">
                            <td><b>${p.Name}</b> ${badge}</td>
                            <td>${p.Category}</td>
                            <td>₹${p.JobWorkPrice || '0.00'}</td>
                            <td>${p.Brand}</td>
                            <td>
                                <button class="icon-btn"><i class="material-icons-outlined" style="font-size:18px;">edit</i></button>
                            </td>
                        </tr>`;
            });
            tbodyProd.innerHTML = html;
        }
    }, null, true);
    
    // Load Materials
    apiCall('getRawMaterials', {}, function (data) {
        if (!tbodyMat) return;
        if (!data || data.length === 0) {
            tbodyMat.innerHTML = '<tr><td colspan="3" style="text-align:center;">No materials found.</td></tr>';
        } else {
            let html = '';
            data.forEach(m => {
                html += `<tr style="animation: fadeIn 0.4s ease-out;"><td><b>${m.Name}</b></td><td>${m.MinStock}</td><td>${m.Unit}</td></tr>`;
            });
            tbodyMat.innerHTML = html;
        }
    }, null, true);
};

window.app_saveProduct = function (e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('p-name').value,
        brand: document.getElementById('p-brand').value,
        category: document.getElementById('p-cat').value,
        price: parseFloat(document.getElementById('p-price').value),
        parentID: document.getElementById('p-parent').value,
        unit: 'Pcs'
    };
    apiCall('addProduct', payload, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadMasterData();
    });
};

// Expose advanced Modal Triggers mapped in index.html
window.triggerAddProduct = function() {
    let parentOpts = (window.cachedProducts || [])
        .filter(p => !p.ParentProductID) // Only mains
        .map(p => `<option value="${p.ID}">${p.Name}</option>`).join('');
    Modal.openAddProduct(parentOpts);
};

window.app_saveMaterial = function (e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('m-name').value,
        unit: document.getElementById('m-unit').value,
        minStock: parseInt(document.getElementById('m-min').value) || 0
    };
    apiCall('addRawMaterial', payload, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadMasterData();
    });
};

/* =========================================================================
   ATTENDANCE MODULE LOGIC
========================================================================= */
window.handleAttendanceAction = function (actionType) {
    if (!currentUser) return;
    
    // Check if GPS is required
    let requireGps = (window.AppConfig && window.AppConfig['GeoLocationRequired'] === 'true');
    
    if (requireGps) {
        if (navigator.geolocation) {
            Loader.show();
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    executeAttendanceAPI(actionType, position.coords.latitude, position.coords.longitude);
                },
                function(error) {
                    Loader.hide();
                    Toast.show("Location access required for Attendance.", "error");
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
            );
        } else {
            Toast.show("Geolocation is not supported by this browser.", "error");
        }
    } else {
        executeAttendanceAPI(actionType, "", "");
    }
};

function executeAttendanceAPI(actionType, lat, lng) {
    let payload = { workerId: currentUser.id, lat: lat, lng: lng };
    
    // We store the RecordID locally for checkout mapping
    if (actionType === 'in') {
        apiCall('checkIn', payload, function(res) {
            Toast.show(res.message, 'success');
            localStorage.setItem('activeAttendanceRecordId', res.recordId);
            // Optionally update UI buttons
            loadAttendanceUI('active', res.time);
        });
    } else {
        payload.recordId = localStorage.getItem('activeAttendanceRecordId');
        if (!payload.recordId) {
            Toast.show("No active check-in found.", "error");
            return;
        }
        apiCall('checkOut', payload, function(res) {
            Toast.show(res.message, 'success');
            localStorage.removeItem('activeAttendanceRecordId');
            loadAttendanceUI('inactive', null);
        });
    }
}

/* =========================================================================
   JOB WORK MODULE LOGIC
========================================================================= */
let currentJobTab = 'active'; // 'active' or 'settled'

window.loadJobWork = function () {
    const tbody = document.getElementById('jobwork-tbody');
    if (!tbody) return;
    tbody.innerHTML = SkeletonBuilder.generateTable(4, 5);

    // Tab UI Update
    document.getElementById('tab-active-jobs').style.borderBottom = currentJobTab === 'active' ? '2px solid var(--accent-primary)' : 'none';
    document.getElementById('tab-active-jobs').style.color = currentJobTab === 'active' ? 'var(--accent-primary)' : 'var(--text-secondary)';
    
    document.getElementById('tab-settled-jobs').style.borderBottom = currentJobTab === 'settled' ? '2px solid var(--accent-primary)' : 'none';
    document.getElementById('tab-settled-jobs').style.color = currentJobTab === 'settled' ? 'var(--accent-primary)' : 'var(--text-secondary)';

    let payload = {};
    if (currentUser.role === 'Worker') payload.workerId = currentUser.id;

    apiCall('getJobs', payload, function (data) {
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No jobs found.</td></tr>';
            return;
        }

        let html = '';
        data.forEach(job => {
            // Filter logic
            let isActive = job.Status === 'Pending' || job.Status === 'Received' || job.Status === 'Partially Settled';
            if (currentJobTab === 'active' && !isActive) return;
            if (currentJobTab === 'settled' && isActive) return;

            let statusBadge = 'neutral';
            if (job.Status === 'Received') statusBadge = 'active';
            if (job.Status === 'Pending') statusBadge = 'warning';
            
            // Reconstruct Worker and Material Name (Ideally from backend ID join, but we will show IDs for demo if we don't have lookup maps. Wait, we lack a quick lookup map on frontend. Let's just create a generic view.)
            let workerName = (currentUser.role === 'Worker') ? "You" : `Worker ID: ${job.JobWorkerID.substring(0,4)}`;
            let materialName = `Material ID: ${job.RawMaterialID.substring(0,4)}`;

            // Actions mapping
            let actionsHTML = '';
            if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
                if (job.Status === 'Pending') {
                    actionsHTML = `<button class="btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="Modal.openReceiveJob('${job.ID}')">Receive</button>`;
                } else if (job.Status === 'Received' || job.Status === 'Partially Settled') {
                    let totalVal = parseFloat(job.JobWorkPrice || 0) * (job.ReadyQty || 0);
                    let remQty = parseInt(job.ReadyQty || 0) - parseInt(job.SettledQty || 0);
                    actionsHTML = `<button class="btn-primary" style="padding:4px 8px; font-size:12px; width:auto;" onclick="Modal.openSettleJob('${job.ID}', ${remQty}, ${job.JobWorkPrice})">Settle (${remQty} left)</button>`;
                } else {
                    actionsHTML = `<span style="font-size:12px; color:var(--status-success);">Fully Settled</span>`;
                }
            } else {
                 actionsHTML = `<span style="font-size:12px; color:var(--text-secondary);">View Only</span>`;
            }

            html += `<tr style="animation: fadeIn 0.4s ease-out;">
                        <td>${job.SentDate}</td>
                        <td><b>${workerName}</b></td>
                        <td>${job.RawQty} units of ${materialName}</td>
                        <td><span class="badge ${statusBadge}">${job.Status}</span></td>
                        <td>${actionsHTML}</td>
                    </tr>`;
        });
        
        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No jobs match this filter.</td></tr>';
        
    }, null, true);
};

// Expose tab listeners
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const tabActive = document.getElementById('tab-active-jobs');
        const tabSettled = document.getElementById('tab-settled-jobs');
        if (tabActive) tabActive.addEventListener('click', () => { currentJobTab = 'active'; loadJobWork(); });
        if (tabSettled) tabSettled.addEventListener('click', () => { currentJobTab = 'settled'; loadJobWork(); });
    }, 500);
});

// Modals Setup
window.triggerIssueJob = function() {
    // We need list of Workers and Materials.
    Modal.open("Issue Job", "<div style='text-align:center; padding: 20px;'><div class='spinner' style='width:30px;height:30px;margin: 0 auto 10px;'></div><p>Fetching resources...</p></div>");
    
    Promise.all([
        fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getWorkers', data: {} }), headers: {'Content-Type': 'text/plain;charset=utf-8'} }).then(res => res.json()),
        fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getRawMaterials', data: {} }), headers: {'Content-Type': 'text/plain;charset=utf-8'} }).then(res => res.json())
    ]).then(responses => {
        let workers = responses[0].data || [];
        let materials = responses[1].data || [];
        
        let wOptions = workers.filter(w=>w.Status === 'Active').map(w => `<option value="${w.ID}">${w.Name}</option>`).join('');
        let mOptions = materials.map(m => `<option value="${m.ID}">${m.Name} (${m.Unit})</option>`).join('');
        
        let html = `
            <form onsubmit="app_submitIssueJob(event)">
                <div class="form-group">
                    <label class="form-label">Select Worker</label>
                    <select id="iss-worker" class="form-input" required>${wOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Raw Material to Send</label>
                    <select id="iss-material" class="form-input" required>${mOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Quantity Sent</label>
                    <input type="number" id="iss-qty" class="form-input" required placeholder="e.g. 1000">
                </div>
                <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                    <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn-primary" style="width:auto;">Assign Job</button>
                </div>
            </form>
        `;
        Modal.open("Issue Job to Worker", html);
    });
};

window.app_submitIssueJob = function(e) {
    e.preventDefault();
    let payload = {
        workerId: document.getElementById('iss-worker').value,
        materialId: document.getElementById('iss-material').value,
        qty: document.getElementById('iss-qty').value
    };
    apiCall('issueJob', payload, function(res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

Modal.openReceiveJob = function(jobId) {
    Modal.open("Receive Job", "<div style='text-align:center; padding: 20px;'><div class='spinner' style='width:30px;height:30px;margin: 0 auto 10px;'></div><p>Fetching Products...</p></div>");
    
    // Fetch products to bind as the Finished Good
    apiCall('getProducts', {}, function(data) {
        let products = data || [];
        let pOptions = products.map(p => {
             let priceText = p.JobWorkPrice ? `(₹${p.JobWorkPrice})` : "";
             return `<option value="${p.ID}">${p.Name} ${priceText}</option>`;
        }).join('');
        
        let html = `
            <form onsubmit="app_submitReceiveJob(event, '${jobId}')">
                <div class="form-group">
                    <label class="form-label">Finished Product Received</label>
                    <select id="rec-product" class="form-input" required>${pOptions}</select>
                    <small style="color:var(--text-secondary);">&nbsp; This will lock the piece-rate price for future settlement.</small>
                </div>
                <div class="form-group" style="display:flex; gap:12px;">
                    <div style="flex:1;">
                        <label class="form-label">Good Qty Made</label>
                        <input type="number" id="rec-qty" class="form-input" required>
                    </div>
                    <div style="flex:1;">
                        <label class="form-label">Damage/Missing Qty</label>
                        <input type="number" id="rec-dmg" class="form-input" value="0">
                    </div>
                </div>
                <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                    <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                    <button type="submit" class="btn-primary" style="width:auto;">Verify & Receive</button>
                </div>
            </form>
        `;
        Modal.open("Receive Finished Goods", html);
    }, null, true);
};

window.app_submitReceiveJob = function(e, jobId) {
    e.preventDefault();
    let payload = {
        jobId: jobId,
        productId: document.getElementById('rec-product').value,
        readyQty: document.getElementById('rec-qty').value,
        missingQty: document.getElementById('rec-dmg').value
    };
    apiCall('receiveJob', payload, function(res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

Modal.openSettleJob = function(jobId, maxQtyToSettle, lockedPrice) {
    let html = `
        <form onsubmit="app_submitSettleJob(event, '${jobId}', ${lockedPrice}, ${maxQtyToSettle})">
            <div class="surface-card" style="background:var(--bg-main); margin-bottom:16px;">
                <p style="margin-bottom:8px;">Locked Piece-Rate: <b>₹${lockedPrice}</b></p>
                <p>Max Unpaid Quantity: <b>${maxQtyToSettle} units</b></p>
            </div>
            <div class="form-group">
                <label class="form-label">Quantity to Settle Right Now</label>
                <input type="number" id="set-qty" class="form-input" max="${maxQtyToSettle}" value="${maxQtyToSettle}" required oninput="document.getElementById('set-amount').innerText = '₹' + (this.value * ${lockedPrice}).toFixed(2)">
            </div>
            <div class="form-group">
                <p>Transfer to Worker Salary Ledger: <b id="set-amount" style="font-size:20px; color:var(--status-success);">₹${(maxQtyToSettle * lockedPrice).toFixed(2)}</b></p>
            </div>
            <div class="modal-footer" style="padding: 16px 0 0 0; border: none;">
                <button type="button" class="btn-secondary" onclick="Modal.close()">Cancel</button>
                <button type="submit" class="btn-primary" style="width:auto; background:var(--status-success);">Confirm & Pay</button>
            </div>
        </form>
    `;
    Modal.open("Settle Job Payment", html);
};

window.app_submitSettleJob = function(e, jobId, price, maxQty) {
    e.preventDefault();
    let qty = document.getElementById('set-qty').value;
    if (qty > maxQty) { Toast.show("Cannot settle more than limit!", "error"); return; }
    
    apiCall('settlePayment', { jobId: jobId, settleQty: qty }, function(res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

/* =========================================================================
   SETTINGS MODULE LOGIC
========================================================================= */
window.init_settings = function() {
    // Determine the active inputs inside view-container
    const vc = document.getElementById('view-container');
    if (!vc) return;
    
    const setGps = vc.querySelector('#set-gps-req');
    const setLat = vc.querySelector('#set-lat');
    const setLng = vc.querySelector('#set-lng');

    const applyConfig = (configs) => {
        if (!configs) return;
        let isReq = configs['GeoLocationRequired'] === 'true' || configs['GeoLocationRequired'] === true;
        if (setGps) setGps.checked = isReq;
        if (setLat && configs['OfficeLat']) setLat.value = configs['OfficeLat'];
        if (setLng && configs['OfficeLng']) setLng.value = configs['OfficeLng'];
    };

    if (window.AppConfig && Object.keys(window.AppConfig).length > 0) {
        applyConfig(window.AppConfig);
    } else {
        // Fetch from server if not cached yet
        let btn = vc.querySelector('button[type="submit"]');
        if (btn) btn.innerText = "Loading...";
        apiCall('getGlobalConfig', {}, function (configs) {
            window.AppConfig = configs || {};
            applyConfig(window.AppConfig);
            if (btn) btn.innerHTML = '<i class="material-icons-outlined" style="vertical-align:middle; font-size:18px;">save</i> Save Config';
        }, null, true);
    }
};

window.app_saveSettings = function(e) {
    e.preventDefault();
    const vc = document.getElementById('view-container');
    let payload = {
        GeoLocationRequired: vc.querySelector('#set-gps-req').checked ? "true" : "false",
        OfficeLat: vc.querySelector('#set-lat').value,
        OfficeLng: vc.querySelector('#set-lng').value
    };
    
    apiCall('saveGlobalConfig', payload, function(res) {
        Toast.show("Settings properly uploaded to database.", "success");
        // Update local cache and force reflect on template as backup
        window.AppConfig = payload;
    });
};

function loadAttendanceUI(state, timeText) {
    const statusText = document.getElementById('att-status-text');
    if (state === 'active') {
        if(statusText) statusText.innerHTML = `Checked In at <b>${timeText}</b>. Working...`;
    } else {
        if(statusText) statusText.innerHTML = `Not Checked In`;
    }
}

