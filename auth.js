// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

function enterDigit(digit) {
    if (enteredPin.length < 4) {
        enteredPin += digit;
        updatePinDisplay();
    }
}

function clearPin() {
    enteredPin = '';
    updatePinDisplay();
    document.getElementById('errorMsg').textContent = '';
}

function updatePinDisplay() {
    const display = enteredPin.length > 0 ? '•'.repeat(enteredPin.length) : '••••';
    document.getElementById('pinDisplay').textContent = display;
}

function checkPin() {
    const user = users.find(u => u.pin === enteredPin);
    if (user) {
        currentUser = user;
        localStorage.setItem('ward_currentUser', JSON.stringify(user));
        showMainApp();
    } else {
        document.getElementById('errorMsg').textContent = 'Invalid PIN. Try 1234 (Doctor) or 5678 (Nurse)';
        enteredPin = '';
        updatePinDisplay();
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('ward_currentUser');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    clearPin();
}

function checkAutoLogin() {
    const savedUser = localStorage.getItem('ward_currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
}
