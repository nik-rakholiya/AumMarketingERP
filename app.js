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
    generateTr: function (cols) {
        let tds = '';
        for (let i = 0; i < cols; i++) {
            tds += `<td><div class="skeleton-box" style="width: ${Math.floor(Math.random() * 40 + 60)}%;"></div></td>`;
        }
        return `<tr class="skeleton-row">${tds}</tr>`;
    },
    generateTable: function (rows, cols) {
        let html = '';
        for (let i = 0; i < rows; i++) html += this.generateTr(cols);
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

    if (tbodyProd) tbodyProd.innerHTML = SkeletonBuilder.generateTable(3, 4);
    if (tbodyMat) tbodyMat.innerHTML = SkeletonBuilder.generateTable(3, 3);

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
window.triggerAddProduct = function () {
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
   (Smart Auto-Pause, GPS Tracking, Role-Hiding)
========================================================================= */
let clockInterval = null;
let geoWatchId = null;

// Mathematical formula to calculate distance between two lat/long points (in meters)
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    var R = 6371e3; // Radius of the earth in m
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.init_attendance = function () {
    if (!currentUser) return;
    const currentState = localStorage.getItem('att_shiftState') || 'not_started';
    
    // 1. Initial UI Updates
    updateAttendanceButtons(currentState);
    
    // 2. Set default month/year for overview based on current date
    const now = new Date();
    const ovMonth = document.getElementById('ov-month');
    const ovYear = document.getElementById('ov-year');
    if (ovMonth) ovMonth.value = now.getMonth() + 1;
    if (ovYear) ovYear.value = now.getFullYear();

    // 3. Populate inline reports (The new "Worker-wise" overview)
    loadAttendanceOverview(); 
    
    // 4. Role based layout adjustments
    if (currentUser.role === 'Worker') {
        const adminWidgets = document.getElementById('admin-attendance-widgets');
        if (adminWidgets) adminWidgets.style.display = 'none';
        
        // Change grid to 1 column for worker
        const dashboardGrid = adminWidgets ? adminWidgets.parentElement : null;
        if (dashboardGrid) {
            dashboardGrid.style.gridTemplateColumns = '1fr';
        }
    }

    // 5. Start Geo-Tracking if already active
    if (currentState === 'active') startSilentGeoTracking();

    // 6. Start Digital Clock Tick
    if (clockInterval) clearInterval(clockInterval);
    const updateClock = () => {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;
        
        const tickNow = new Date();
        const tickState = localStorage.getItem('att_shiftState') || 'not_started';
        dateEl.innerText = tickNow.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        if (tickState !== 'not_started') {
            timeEl.innerText = calculateCurrentDurationString();
        } else {
            timeEl.innerText = "00:00:00";
        }
    };
    clockInterval = setInterval(updateClock, 1000);
    updateClock();

    // 7. Initial Table Populate (State message)
    loadAttendanceUI(currentState);
};

// Unified button handler from UI click
window.handleAttendanceAction = function (actionType) {
    if (!currentUser) return;
    let requireGps = (window.AppConfig && window.AppConfig['GeoLocationRequired'] === 'true');
    
    // Format UI early for user feedback (Check in/out needs loaders)
    if (actionType === 'in' || actionType === 'out') {
        Loader.show();
    }

    if (actionType === 'in' || actionType === 'out') {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    processAttendanceAPI(actionType, position.coords.latitude, position.coords.longitude);
                },
                function (error) {
                    let errMsg = error.message || "Unknown error";
                    if (requireGps) {
                        Loader.hide();
                        Toast.show("Location blocked: " + errMsg, "error");
                    } else {
                        // User denied or error, but not required, so proceed without GPS
                        Toast.show("GPS disabled (" + errMsg + "), logging without location.", "warning");
                        processAttendanceAPI(actionType, "", "");
                    }
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            if (requireGps) {
                Loader.hide();
                Toast.show("Geolocation is not supported by this browser.", "error");
            } else {
                Toast.show("GPS not supported, logging without location.", "warning");
                processAttendanceAPI(actionType, "", "");
            }
        }
    } else {
        processAttendanceAPI(actionType, "", ""); // Internal transitions or non-GPS required
    }
};

function processAttendanceAPI(actionType, lat, lng) {
    // Process Local State purely
    if (actionType === 'pause') {
        localStorage.setItem('att_shiftState', 'paused');
        localStorage.setItem('att_lastPauseTimestamp', new Date().getTime());
        localStorage.setItem('att_outOfRangeCount', parseInt(localStorage.getItem('att_outOfRangeCount') || 0) + 1);
        updateAttendanceButtons('paused');
        loadAttendanceUI('paused');
        Toast.show("Shift Paused.", "warning");
        return;
    }
    
    if (actionType === 'resume') {
        let pauseStamp = localStorage.getItem('att_lastPauseTimestamp');
        if (pauseStamp) {
            let pausedMs = new Date().getTime() - parseInt(pauseStamp);
            let totalPaused = parseInt(localStorage.getItem('att_totalPausedTime') || 0);
            localStorage.setItem('att_totalPausedTime', totalPaused + Math.floor(pausedMs/1000));
        }
        localStorage.setItem('att_shiftState', 'active');
        localStorage.removeItem('att_lastPauseTimestamp');
        updateAttendanceButtons('active');
        loadAttendanceUI('active');
        Toast.show("Shift Resumed.", "info");
        return;
    }

    // Call Backend for Check-In / Check-Out
    let payload = { workerId: currentUser.id, lat: lat, lng: lng };
    
    if (actionType === 'in') {
        apiCall('checkIn', payload, function (res) {
            Toast.show("Checked In Successfully", 'success');
            localStorage.setItem('att_shiftState', 'active');
            localStorage.setItem('att_recordId', res.recordId);
            localStorage.setItem('att_checkInTime', new Date().getTime());
            localStorage.setItem('att_totalPausedTime', 0);
            localStorage.setItem('att_outOfRangeCount', 0);
            updateAttendanceButtons('active');
            loadAttendanceUI('active');
            startSilentGeoTracking();
        });
    } else if (actionType === 'out') {
        payload.recordId = localStorage.getItem('att_recordId');
        if (!payload.recordId) {
            Loader.hide();
            Toast.show("No active check-in found.", "error");
            return;
        }
        
        // Finalize pause calculations if checking out while paused
        if (localStorage.getItem('att_shiftState') === 'paused') {
            let pauseStamp = localStorage.getItem('att_lastPauseTimestamp');
            if (pauseStamp) {
                let pausedMs = new Date().getTime() - parseInt(pauseStamp);
                let totalPaused = parseInt(localStorage.getItem('att_totalPausedTime') || 0);
                localStorage.setItem('att_totalPausedTime', totalPaused + Math.floor(pausedMs/1000));
            }
        }
        
        // TotalHours should be accurate to what user saw.
        payload.calculatedDuration = calculateCurrentDurationString();
        payload.outOfRangeCount = localStorage.getItem('att_outOfRangeCount') || 0;

        apiCall('checkOut', payload, function (res) {
            Toast.show("Checked Out Successfully", 'success');
            localStorage.setItem('att_shiftState', 'not_started');
            localStorage.removeItem('att_recordId');
            if(geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
            updateAttendanceButtons('not_started');
            loadAttendanceUI('not_started');
        });
    }
}

// Silently watch location and trigger auto-pause without Distracting Loader
function startSilentGeoTracking() {
    if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
    let requireGps = (window.AppConfig && window.AppConfig['GeoLocationRequired'] === 'true');
    if (!requireGps || !navigator.geolocation) return;
    
    let officeLat = parseFloat(window.AppConfig.OfficeLat);
    let officeLng = parseFloat(window.AppConfig.OfficeLng);
    let allowedRadius = parseInt(window.AppConfig.GeoFenceRadius || 200); // meters
    
    if (isNaN(officeLat) || isNaN(officeLng)) return;

    geoWatchId = navigator.geolocation.watchPosition(
        function (pos) {
            let dist = getDistanceFromLatLonInM(pos.coords.latitude, pos.coords.longitude, officeLat, officeLng);
            let currentState = localStorage.getItem('att_shiftState');
            
            if (dist > allowedRadius && currentState === 'active') {
                processAttendanceAPI('pause', pos.coords.latitude, pos.coords.longitude);
                Toast.show(`Auto-Paused: You are ${Math.round(dist)}m away from office.`, 'warning');
            } else if (dist <= allowedRadius && currentState === 'paused') {
                 // Auto-Resume
                 processAttendanceAPI('resume', pos.coords.latitude, pos.coords.longitude);
                 Toast.show(`Auto-Resumed: Back in range.`, 'success');
            }
        },
        function(err) { console.warn("Watch position err", err); },
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
    );
}

function updateAttendanceButtons(state) {
    const btnIn = document.getElementById('btn-checkin');
    const btnOut = document.getElementById('btn-checkout');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    
    if(!btnIn) return;

    btnIn.style.display = 'none';
    btnOut.style.display = 'none';
    btnPause.style.display = 'none';
    btnResume.style.display = 'none';

    if (state === 'not_started') {
        btnIn.style.display = 'block';
    } else if (state === 'active') {
        btnPause.style.display = 'block';
        btnOut.style.display = 'block';
    } else if (state === 'paused') {
        btnResume.style.display = 'block';
        btnOut.style.display = 'block';
    }
}

function calculateCurrentDurationString() {
    let startMs = parseInt(localStorage.getItem('att_checkInTime'));
    if (!startMs) return "00:00:00";
    
    let now = new Date().getTime();
    let totalElapsedMs = now - startMs;
    
    let totalPausedSec = parseInt(localStorage.getItem('att_totalPausedTime') || 0);
    let currentState = localStorage.getItem('att_shiftState');
    
    // Add current pause session to total if currently paused
    if (currentState === 'paused') {
        let pauseStamp = parseInt(localStorage.getItem('att_lastPauseTimestamp') || now);
        totalPausedSec += Math.floor((now - pauseStamp)/1000);
    }
    
    let activeSec = Math.floor(totalElapsedMs / 1000) - totalPausedSec;
    if (activeSec < 0) activeSec = 0;
    
    let h = Math.floor(activeSec / 3600).toString().padStart(2, '0');
    let m = Math.floor((activeSec % 3600) / 60).toString().padStart(2, '0');
    let s = (activeSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function refreshActiveTableRow() {
    const durEl = document.getElementById('dyn-duration');
    const countEl = document.getElementById('dyn-oor');
    const badgeEl = document.getElementById('dyn-badge');
    const state = localStorage.getItem('att_shiftState');
    
    if (durEl) durEl.innerText = calculateCurrentDurationString();
    if (countEl) countEl.innerText = localStorage.getItem('att_outOfRangeCount') || "0";
    if (badgeEl) {
        if (state === 'active') {
            badgeEl.className = 'badge active';
            badgeEl.innerHTML = `<i class="material-icons-outlined" style="font-size:14px;">check</i> In Range`;
        } else {
            badgeEl.className = 'badge pending';
            badgeEl.innerHTML = `<i class="material-icons-outlined" style="font-size:14px;">pause</i> Paused / Out`;
        }
    }
}

function loadAttendanceUI(state) {
    const statusEl = document.getElementById('shift-status');
    const tbody = document.getElementById('attendance-tbody');
    if(!statusEl || !tbody) return;

    if (state === 'active') {
        statusEl.innerText = "Checked In — Active"; statusEl.style.color = "var(--status-success)";
    } else if (state === 'paused') {
        statusEl.innerText = "Shift Paused"; statusEl.style.color = "var(--status-warning)";
    } else {
        statusEl.innerText = "Ready for Shift"; statusEl.style.color = "var(--text-secondary)";
    }

    // Fetch Today's Logs from Server to populate table
    const today = new Date().toLocaleDateString();
    let logPayload = { date: today };
    if (currentUser.role === 'Worker') logPayload.workerId = currentUser.id;

    apiCall('getAttendanceLogs', logPayload, function(logs) {
        let html = '';
        if (!logs || logs.length === 0) {
            if (state === 'not_started') {
                 html = `<tr><td colspan="7" style="padding:48px; text-align:center; color:var(--text-secondary);">Your daily shift has ended or not started.</td></tr>`;
            } else {
                 html = `<tr><td colspan="7" style="padding:48px; text-align:center; color:var(--text-secondary);">No logs yet today.</td></tr>`;
            }
        } else {
            logs.forEach((log, index) => {
                let dur = log.TotalHours;
                let oor = log.OutOfRangeCount || 0;
                let statusBadge = log.CheckOutTime ? '<div class="badge neutral">Completed</div>' : '<div class="badge active" id="dyn-badge"><i class="material-icons-outlined" style="font-size:14px;">check</i> In Range</div>';
                
                // If it's the current running record, give it IDs for live ticking
                let isLive = (log.ID === localStorage.getItem('att_recordId'));
                let durId = isLive ? 'id="dyn-duration"' : '';
                let oorId = isLive ? 'id="dyn-oor"' : '';
                let badgeId = isLive ? 'id="dyn-badge"' : '';

                html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 16px;">${index + 1}</td>
                    <td style="padding: 16px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:32px; height:32px; border-radius:50%; background:var(--accent-gradient); display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold;">${currentUser.name.charAt(0).toUpperCase()}</div>
                            <span style="font-weight:600;">${currentUser.name}</span>
                        </div>
                    </td>
                    <td style="padding: 16px;">${log.CheckInTime}</td>
                    <td style="padding: 16px; color:var(--text-secondary);">${log.CheckOutTime || '—'}</td>
                    <td style="padding: 16px; font-family:monospace; font-size:16px;" ${durId}>${dur === '-' ? '00:00:00' : dur}</td>
                    <td style="padding: 16px;">
                         <span style="color:var(--status-error); font-weight:600; font-size:12px; display:flex; align-items:center; gap:4px;"><i class="material-icons-outlined" style="font-size:14px;">warning</i> <span ${oorId}>${oor}</span> times out</span>
                    </td>
                    <td style="padding: 16px;">
                        ${statusBadge}
                    </td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
        if (state !== 'not_started') refreshActiveTableRow();
    }, null, true); // Silent load because it's refreshing UI
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
            let workerName = (currentUser.role === 'Worker') ? "You" : `Worker ID: ${job.JobWorkerID.substring(0, 4)}`;
            let materialName = `Material ID: ${job.RawMaterialID.substring(0, 4)}`;

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
window.triggerIssueJob = function () {
    // We need list of Workers and Materials.
    Modal.open("Issue Job", "<div style='text-align:center; padding: 20px;'><div class='spinner' style='width:30px;height:30px;margin: 0 auto 10px;'></div><p>Fetching resources...</p></div>");

    Promise.all([
        fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getWorkers', data: {} }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }).then(res => res.json()),
        fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getRawMaterials', data: {} }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }).then(res => res.json())
    ]).then(responses => {
        let workers = responses[0].data || [];
        let materials = responses[1].data || [];

        let wOptions = workers.filter(w => w.Status === 'Active').map(w => `<option value="${w.ID}">${w.Name}</option>`).join('');
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

window.app_submitIssueJob = function (e) {
    e.preventDefault();
    let payload = {
        workerId: document.getElementById('iss-worker').value,
        materialId: document.getElementById('iss-material').value,
        qty: document.getElementById('iss-qty').value
    };
    apiCall('issueJob', payload, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

Modal.openReceiveJob = function (jobId) {
    Modal.open("Receive Job", "<div style='text-align:center; padding: 20px;'><div class='spinner' style='width:30px;height:30px;margin: 0 auto 10px;'></div><p>Fetching Products...</p></div>");

    // Fetch products to bind as the Finished Good
    apiCall('getProducts', {}, function (data) {
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

window.app_submitReceiveJob = function (e, jobId) {
    e.preventDefault();
    let payload = {
        jobId: jobId,
        productId: document.getElementById('rec-product').value,
        readyQty: document.getElementById('rec-qty').value,
        missingQty: document.getElementById('rec-dmg').value
    };
    apiCall('receiveJob', payload, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

Modal.openSettleJob = function (jobId, maxQtyToSettle, lockedPrice) {
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

window.app_submitSettleJob = function (e, jobId, price, maxQty) {
    e.preventDefault();
    let qty = document.getElementById('set-qty').value;
    if (qty > maxQty) { Toast.show("Cannot settle more than limit!", "error"); return; }

    apiCall('settlePayment', { jobId: jobId, settleQty: qty }, function (res) {
        Toast.show(res.message, 'success');
        Modal.close();
        loadJobWork();
    });
};

/* =========================================================================
   SETTINGS MODULE LOGIC
========================================================================= */
window.init_settings = function () {
    // Determine the active inputs inside view-container
    const vc = document.getElementById('view-container');
    if (!vc) return;

    const setGps = vc.querySelector('#set-gps-req');
    const setLat = vc.querySelector('#set-lat');
    const setLng = vc.querySelector('#set-lng');
    const setRadius = vc.querySelector('#set-radius');

    const applyConfig = (configs) => {
        if (!configs) return;
        let isReq = configs['GeoLocationRequired'] === 'true' || configs['GeoLocationRequired'] === true;
        if (setGps) setGps.checked = isReq;
        if (setLat && configs['OfficeLat']) setLat.value = configs['OfficeLat'];
        if (setLng && configs['OfficeLng']) setLng.value = configs['OfficeLng'];
        if (setRadius && configs['GeoFenceRadius']) setRadius.value = configs['GeoFenceRadius'];
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

window.app_saveSettings = function (e) {
    e.preventDefault();
    const vc = document.getElementById('view-container');
    let payload = {
        GeoLocationRequired: vc.querySelector('#set-gps-req').checked ? "true" : "false",
        OfficeLat: vc.querySelector('#set-lat').value,
        OfficeLng: vc.querySelector('#set-lng').value,
        GeoFenceRadius: vc.querySelector('#set-radius').value
    };

    apiCall('saveGlobalConfig', payload, function (res) {
        Toast.show("Settings properly uploaded to database.", "success");
        // Update local cache and force reflect on template as backup
        window.AppConfig = payload;
    });
};

/* =========================================================================
   WORKER-WISE ATTENDANCE OVERVIEW (Main Dashboard)
========================================================================= */
window.loadAttendanceOverview = async function() {
    const container = document.getElementById('attendance-reports-container');
    if (!container) return;

    const month = document.getElementById('ov-month').value;
    const year = document.getElementById('ov-year').value;

    container.innerHTML = `<div style="text-align:center; padding:40px;"><div class="spinner" style="margin:0 auto;"></div><p style="color:var(--text-secondary); margin-top:12px;">Loading worker-wise overview...</p></div>`;

    try {
        const workersRes = await fetch(APPS_SCRIPT_WEB_APP_URL, { 
            method: 'POST', body: JSON.stringify({ action: 'getWorkers', data: {} }), headers: { 'Content-Type': 'text/plain' } 
        }).then(r => r.json());
        
        const logsRes = await fetch(APPS_SCRIPT_WEB_APP_URL, { 
            method: 'POST', body: JSON.stringify({ action: 'getAttendanceLogs', data: { month: month.padStart(2,'0'), year: year } }), headers: { 'Content-Type': 'text/plain' } 
        }).then(r => r.json());

        const workers = (workersRes.data || []).filter(w => w.Status === 'Active');
        const logs = logsRes.data || [];
        
        let displayWorkers = (currentUser.role === 'Worker') ? workers.filter(w => w.ID === currentUser.id) : workers;

        if (displayWorkers.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding:40px;">No records found for this selection.</p>`;
            return;
        }

        let html = '';
        const daysInMonth = new Date(year, month, 0).getDate();

        displayWorkers.forEach(worker => {
            const workerLogs = logs.filter(l => l.WorkerID === worker.ID);
            
            let presentDates = [...new Set(workerLogs.map(l => l.Date))];
            let presentCount = presentDates.length;
            
            let dayShifts = 0, nightShifts = 0;
            workerLogs.forEach(l => {
                if (!l.CheckInTime) return;
                let isNight = l.CheckInTime.includes('PM') || (l.CheckInTime.includes('AM') && parseInt(l.CheckInTime.split(':')[0]) < 6);
                if (isNight) nightShifts++; else dayShifts++;
            });

            let absentCount = daysInMonth - presentCount;
            if (parseInt(year) === new Date().getFullYear() && parseInt(month) === (new Date().getMonth()+1)) {
                absentCount = new Date().getDate() - presentCount;
                if (absentCount < 0) absentCount = 0;
            }

            html += `
            <div class="report-card" style="margin-bottom:12px;">
                <div class="report-card-header" onclick="this.nextElementSibling.classList.toggle('hidden')" style="padding:16px 20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:36px; height:36px; border-radius:50%; background:var(--accent-gradient); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">${worker.Name.charAt(0).toUpperCase()}</div>
                        <div>
                            <span style="font-weight:600; display:block;">${worker.Name}</span>
                            <span style="font-size:11px; color:var(--text-secondary);">${worker.Role}</span>
                        </div>
                    </div>
                    <div class="summary-stats" style="margin-bottom:0; gap:20px;">
                        <div class="stat-item"><span class="val val-p">${presentCount}</span><span class="lbl">P</span></div>
                        <div class="stat-item"><span class="val val-a">${absentCount}</span><span class="lbl">A</span></div>
                        <div class="stat-item"><span class="val val-d">${dayShifts}</span><span class="lbl">D</span></div>
                        <div class="stat-item"><span class="val val-n">${nightShifts}</span><span class="lbl">N</span></div>
                    </div>
                    <i class="material-icons-outlined" style="color:var(--text-secondary);">expand_more</i>
                </div>
                <div class="report-card-body hidden" style="padding:20px; background:rgba(255,255,255,0.01);">
                    <div class="calendar-grid" style="margin-bottom:24px;">
                        ${Array.from({length: daysInMonth}, (_, i) => {
                            let d = (i + 1).toString().padStart(2, '0');
                            let dateStr = `${d}/${month.toString().padStart(2,'0')}/${year}`;
                            let isPresent = presentDates.includes(dateStr);
                            let cls = isPresent ? 'present' : ( (new Date(year, month-1, i+1) <= new Date()) ? 'absent' : '' );
                            return `<div class="day-bubble ${cls}">${i+1}</div>`;
                        }).join('')}
                    </div>
                    <div class="table-responsive" style="border:none;">
                        <table class="data-table" style="font-size:12px;">
                            <thead>
                                <tr style="background:transparent;"><th style="border:none;">DATE</th><th style="border:none;">IN</th><th style="border:none;">OUT</th><th style="border:none;">SHIFT</th><th style="border:none;">DUR</th></tr>
                            </thead>
                            <tbody>
                                ${workerLogs.map(l => {
                                    let isNight = l.CheckInTime && (l.CheckInTime.includes('PM') || (l.CheckInTime.includes('AM') && parseInt(l.CheckInTime.split(':')[0]) < 6));
                                    return `<tr>
                                        <td><b>${l.Date}</b></td>
                                        <td>${l.CheckInTime}</td>
                                        <td>${l.CheckOutTime || '—'}</td>
                                        <td><i class="material-icons-outlined" style="font-size:16px; color:${isNight?'var(--accent-primary)':'var(--status-warning)'}">${isNight?'dark_mode':'light_mode'}</i></td>
                                        <td style="color:var(--status-success); font-weight:600;">${l.TotalHours || '—'}</td>
                                    </tr>`;
                                }).join('') || '<tr><td colspan="5" style="text-align:center;">No entries yet.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html || `<p style="text-align:center; padding:40px;">No workers found.</p>`;

    } catch (e) {
        container.innerHTML = `<p style="text-align:center; color:var(--status-error); padding:40px;">Error: ${e.message}</p>`;
    }
};



