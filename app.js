// ==========================================
// APPLICATION INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    // Initialize theme
    initializeTheme();

    // Initialize sample data
    initializeSampleData();

    // Set up network listeners
    initializeNetworkListeners();

    // Check for auto-login
    checkAutoLogin();
});
