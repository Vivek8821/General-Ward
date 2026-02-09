// ==========================================
// UI HELPER FUNCTIONS
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ==========================================
// THEME FUNCTIONS
// ==========================================

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ward_theme', next);
    updateThemeToggle();
    showToast(`Switched to ${next} mode`, 'info');
}

function updateThemeToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('themeText').textContent = isDark ? 'Light' : 'Dark';
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('ward_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle();
}

// ==========================================
// CONNECTION STATUS
// ==========================================

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    const textEl = document.getElementById('connectionText');

    if (isOnline && API_CONFIG.enabled) {
        statusEl.className = 'connection-status connection-online';
        textEl.textContent = 'Online';
    } else {
        statusEl.className = 'connection-status connection-offline';
        textEl.textContent = API_CONFIG.enabled ? 'Offline' : 'Local Only';
    }
}

function initializeNetworkListeners() {
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        showToast('Connection restored', 'success');
        if (API_CONFIG.enabled && pendingSync.length > 0) {
            syncAllData();
        }
    });

    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        showToast('Working offline', 'warning');
    });
}
