/* AUM ERP APP LOGIC (External JS) */

/* =========================================================================
   CONFIG
========================================================================= */
// Replace this with the URL you get after deploying your Google Apps Script Web App
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxjjfWCQbENMnqCL1FzDKa3Irp6pCHqiwcIMYIzs1E/dev";

/* =========================================================================
   CORE STATE & INITIALIZATION
========================================================================= */
let currentUser = null;
let currentToken = null;
let activeView = '';

document.addEventListener("DOMContentLoaded", function() {
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
    setTheme: function(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const btn = document.getElementById('themeBtn');
        if (btn) {
            btn.innerHTML = theme === 'dark' 
                ? '<i class="material-icons-outlined">light_mode</i>' 
                : '<i class="material-icons-outlined">dark_mode</i>';
        }
    },
    toggle: function() {
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
    show: function(message, type = 'info') {
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
    show: function() { document.getElementById('global-loader').classList.remove('hidden'); },
    hide: function() { document.getElementById('global-loader').classList.add('hidden'); }
};

/* =========================================================================
   AUTHENTICATION MANAGER
========================================================================= */
const AuthManager = {
    checkSession: function() {
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
    showAuthScreen: function() {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },
    handleLoginSuccess: function() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-name').innerText = currentUser.name;
        document.getElementById('user-role').innerText = currentUser.role;
        document.getElementById('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();
        
        // Show/Hide Admin Modules
        if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
            document.getElementById('admin-menu').classList.remove('hidden');
        }
        
        // Load default view
        navigate('dashboard');
    },
    logout: function() {
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
    
    apiCall('workerLogin', {phone: phone, password: pass}, function(res) {
        btn.innerHTML = '<span class="btn-text">Sign In</span>';
        localStorage.setItem('sessionToken', res.token);
        localStorage.setItem('userData', JSON.stringify(res.user));
        AuthManager.checkSession();
        Toast.show('Welcome back!', 'success');
    }, function(errText) {
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
    
    apiCall('workerSignup', {name: name, phone: phone, password: pass}, function(res) {
        btn.innerHTML = '<span class="btn-text">Register Attempt</span>';
        Toast.show(res.message, 'success');
        toggleAuthForm('login');
    }, function() {
        btn.innerHTML = '<span class="btn-text">Register Attempt</span>';
    });
}

function logout() { AuthManager.logout(); }

/* =========================================================================
   ROUTER / VIEW MANAGER
========================================================================= */
const ViewManager = {
    loadView: function(viewId) {
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
            if(window['init_' + viewId]) window['init_' + viewId]();
        } else {
            container.innerHTML = `<div class="surface-card">
                 <h3>Module Under Construction</h3>
                 <p>The ${viewId} module is being developed.</p>
            </div>`;
        }
        
        activeView = viewId;
        if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); }
    }
};

function navigate(viewId) { ViewManager.loadView(viewId); }

/* =========================================================================
   GENERIC API WRAPPER (Universal Fetch JSON)
========================================================================= */
async function apiCall(action, payload, onSuccess, onError) {
    if (APPS_SCRIPT_WEB_APP_URL === "https://script.google.com/macros/s/AKfycbxjjfWCQbENMnqCL1FzDKa3Irp6pCHqiwcIMYIzs1E/dev") {
        Toast.show("Please configure your GAS Web App URL in app.js", "error");
        if (onError) onError();
        return;
    }

    Loader.show();
    
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
            if(onSuccess) onSuccess(result.data);
        } else {
            Toast.show(result.message || "An error occurred", "error");
            if(onError) onError(result.message);
        }
    } catch (error) {
        Toast.show('Network error: Could not reach server.', 'error');
        console.error("API Error:", error);
        if(onError) onError(error);
    } finally {
        Loader.hide();
    }
}
