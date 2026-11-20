// ============================================
//  ANYA AI — UI Extras
//  Toast · Theme System · Mode Selector
//  Profile Extensions · Cursor Glow
// ============================================

// ============================================
//  TOAST NOTIFICATION SYSTEM
// ============================================
function showToast(type, title, msg, duration = 3800) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
        </div>
        <button class="toast-close" onclick="dismissToast(this.parentElement)">✕</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    // Auto dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;
}

function dismissToast(toast) {
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
}

// ============================================
//  PATCH finishLogin / handleEmailSignup
//  to show toast — hooks into existing script.js
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Patch finishLogin (defined in script.js)
    const origFinishLogin = window.finishLogin;
    if (origFinishLogin) {
        window.finishLogin = function (token, user) {
            origFinishLogin(token, user);
            showToast('success', `Welcome back, ${user.name || 'there'}! 👋`, 'You are now signed in.');
            loadProfileExtended();
        };
    }

    // Patch handleLogout
    const origHandleLogout = window.handleLogout;
    if (origHandleLogout) {
        window.handleLogout = function (manual = true) {
            origHandleLogout(manual);
            if (manual) showToast('info', 'Signed out', 'You have been logged out successfully.');
            hideProfileExtended();
        };
    }

    loadSavedStyleTheme();
    loadSavedAccent();
    loadSavedMode();
    initCursorGlow();
    initResizeSidebars();
    loadProfileExtended();
});

// ============================================
//  STYLE THEME (2nd category)
// ============================================
const STYLES = ['default', 'minimalist', 'modern', 'ancient'];

function setStyle(style) {
    // Remove all style classes
    STYLES.forEach(s => document.body.classList.remove('style-' + s));

    if (style !== 'default') {
        document.body.classList.add('style-' + style);
    }

    localStorage.setItem('anya-style', style);

    // Update active card
    STYLES.forEach(s => {
        const card = document.getElementById('style-card-' + s);
        if (card) card.classList.toggle('active', s === style);
    });

    // Cursor glow only in modern
    initCursorGlow();
}

function loadSavedStyleTheme() {
    const saved = localStorage.getItem('anya-style') || 'default';
    setStyle(saved);
}

// ============================================
//  ACCENT COLOR (3rd category)
// ============================================
const ACCENTS = ['default', 'green', 'red', 'blue', 'mono', 'rainbow', 'yellow'];

function setAccent(accent) {
    ACCENTS.forEach(a => document.body.classList.remove('accent-' + a));
    document.body.classList.add('accent-' + accent);
    localStorage.setItem('anya-accent', accent);

    // Update active swatch
    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.accent === accent);
    });
}

function loadSavedAccent() {
    const saved = localStorage.getItem('anya-accent') || 'default';
    setAccent(saved);
}

// ============================================
//  THEME HELPERS (ensure style cards sync)
// ============================================
// Extend the existing setTheme to also sync style cards
const _origSetTheme = window.setTheme;
window.setTheme = function (mode) {
    if (_origSetTheme) _origSetTheme(mode);
    // Sync brightness cards
    const darkCard = document.getElementById('theme-card-dark');
    const lightCard = document.getElementById('theme-card-light');
    if (darkCard) darkCard.classList.toggle('active', mode === 'dark');
    if (lightCard) lightCard.classList.toggle('active', mode === 'light');
};

// ============================================
//  MODE SELECTOR
// ============================================
// Mode keys — actual prompts live in backend/prompts.js
const MODES = ['default', 'chat', 'tools', 'professional', 'emotional', 'funny'];

let currentMode = localStorage.getItem('anya-mode') || 'default';

function setMode(mode, btnEl) {
    currentMode = mode;
    localStorage.setItem('anya-mode', mode);

    // Update active mode card in profile panel
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const card = document.querySelector(`.mode-card[data-mode="${mode}"]`);
        if (card) card.classList.add('active');
    }

    // Sync mode to backend (backend looks up the actual prompt)
    const headers = getAuthHeaders();
    if (headers) {
        fetch('http://localhost:5000/api/profile', {
            method: 'PUT', headers,
            body: JSON.stringify({ mode })
        }).catch(() => { });
    }
}

function loadSavedMode() {
    const saved = localStorage.getItem('anya-mode') || 'default';
    currentMode = saved;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.mode-card[data-mode="${saved}"]`);
    if (card) card.classList.add('active');
}

// ============================================
//  CURSOR GLOW (modern style only)
// ============================================
function initCursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;

    const isModern = document.body.classList.contains('style-modern');
    glow.style.display = isModern ? 'block' : 'none';

    if (!isModern) return;

    document.addEventListener('mousemove', (e) => {
        if (!document.body.classList.contains('style-modern')) { glow.style.display = 'none'; return; }
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
    });
}

// ============================================
//  SIDEBAR RESIZE (drag-to-resize, 50–150%)
// ============================================
function initResizeSidebars() {
    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');

    const LEFT_DEFAULT = 270;
    const RIGHT_DEFAULT = 320;
    const LEFT_MIN = Math.round(LEFT_DEFAULT * 0.5);  // 135px
    const LEFT_MAX = Math.round(LEFT_DEFAULT * 1.5);  // 405px
    const RIGHT_MIN = Math.round(RIGHT_DEFAULT * 0.5); // 160px
    const RIGHT_MAX = Math.round(RIGHT_DEFAULT * 1.5); // 480px

    // Restore saved widths
    const savedLeft = localStorage.getItem('anya-sidebar-left');
    const savedRight = localStorage.getItem('anya-sidebar-right');
    if (savedLeft) document.documentElement.style.setProperty('--sidebar-width', savedLeft + 'px');
    if (savedRight) document.documentElement.style.setProperty('--right-sidebar-width', savedRight + 'px');

    // Create handles if they don't exist
    if (leftSidebar && !leftSidebar.querySelector('.left-resize-handle')) {
        const handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle left-resize-handle';
        handle.title = 'Drag to resize';
        leftSidebar.appendChild(handle);
        addResizeDrag(handle, 'left', LEFT_MIN, LEFT_MAX);
    }

    if (rightSidebar && !rightSidebar.querySelector('.right-resize-handle')) {
        const handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle right-resize-handle';
        handle.title = 'Drag to resize';
        rightSidebar.appendChild(handle);
        addResizeDrag(handle, 'right', RIGHT_MIN, RIGHT_MAX);
    }
}

function addResizeDrag(handle, side, minW, maxW) {
    let dragging = false;
    let startX = 0;
    let startW = 0;

    const varName = side === 'left' ? '--sidebar-width' : '--right-sidebar-width';
    const sidebarId = side === 'left' ? 'left-sidebar' : 'right-sidebar';

    handle.addEventListener('mousedown', (e) => {
        const sidebar = document.getElementById(sidebarId);
        if (!sidebar || sidebar.classList.contains('collapsed')) return;

        dragging = true;
        startX = e.clientX;
        startW = sidebar.offsetWidth;
        handle.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
        const newW = Math.max(minW, Math.min(startW + delta, maxW));
        document.documentElement.style.setProperty(varName, newW + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Save width
        const sidebar = document.getElementById(sidebarId);
        if (sidebar) {
            const key = side === 'left' ? 'anya-sidebar-left' : 'anya-sidebar-right';
            localStorage.setItem(key, sidebar.offsetWidth);
        }
    });
}

// ============================================
//  PROFILE EXTENDED — Avatar, Nickname, etc.
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('anya_auth_token');
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : null;
}

async function loadProfileExtended() {
    const token = localStorage.getItem('anya_auth_token');
    const section = document.getElementById('profile-extended-section');
    const loginBtn = document.getElementById('profile-login-btn');

    if (!token) {
        if (section) section.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'block';
        return;
    }

    if (section) section.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';

    // Fetch full profile from backend
    try {
        const res = await fetch('http://localhost:5000/api/profile', { headers: getAuthHeaders() });
        if (res.ok) {
            const profile = await res.json();
            // Update anya_user in localStorage with full profile
            localStorage.setItem('anya_user', JSON.stringify(profile));
            populateProfileFields(profile);
            loadTokenStats(profile);
            loadPointsBalance(profile);
            updateAdminNavLink(profile.role);
        } else {
            // Token invalid — fallback to localStorage
            const user = JSON.parse(localStorage.getItem('anya_user') || 'null');
            if (user) {
                populateProfileFields(user);
                loadTokenStats(user);
                loadPointsBalance(user);
                updateAdminNavLink(user.role);
            }
        }
    } catch {
        const user = JSON.parse(localStorage.getItem('anya_user') || 'null');
        if (user) {
            populateProfileFields(user);
            loadTokenStats(user);
            loadPointsBalance(user);
            updateAdminNavLink(user.role);
        }
    }
}

function hideProfileExtended() {
    const section = document.getElementById('profile-extended-section');
    const loginBtn = document.getElementById('profile-login-btn');
    if (section) section.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'block';

    // Reset points section visibility
    const pSection = document.getElementById('points-balance-section');
    const pHeader  = document.getElementById('points-section-header');
    if (pSection) pSection.style.display = 'none';
    if (pHeader)  pHeader.style.display  = 'none';
    updateAdminNavLink(null);

    // Reset avatar
    const avatarText = document.getElementById('profile-avatar-text');
    const avatarImg = document.getElementById('profile-avatar-img');
    if (avatarText) avatarText.textContent = '?';
    if (avatarImg) { avatarImg.src = ''; avatarImg.style.display = 'none'; }

    const nameEl = document.getElementById('profile-name-display');
    const emailEl = document.getElementById('profile-email-display');
    if (nameEl) nameEl.textContent = 'Guest User';
    if (emailEl) emailEl.textContent = 'Not logged in';
}

function populateProfileFields(user) {
    const nameInput = document.getElementById('profile-name');
    const nicknameInput = document.getElementById('profile-nickname');
    const addressInput = document.getElementById('profile-address');
    const userTypeInput = document.getElementById('profile-user-type');
    const statusInput = document.getElementById('profile-status');
    const nameDisplay = document.getElementById('profile-name-display');
    const emailDisplay = document.getElementById('profile-email-display');
    const avatarText = document.getElementById('profile-avatar-text');
    const avatarImg = document.getElementById('profile-avatar-img');

    if (nameInput) nameInput.value = user.name || '';
    if (nameDisplay) nameDisplay.textContent = user.name || 'User';
    if (emailDisplay) emailDisplay.textContent = user.email || '';

    // Populate from profile object (from backend)
    if (nicknameInput) nicknameInput.value = user.nickname || '';
    if (addressInput) addressInput.value = user.address || '';
    if (userTypeInput) userTypeInput.value = user.userType || 'personal';
    if (statusInput) statusInput.value = user.status || 'online';

    // Sync mode card
    if (user.mode && user.mode !== 'default') {
        currentMode = user.mode;
        localStorage.setItem('anya-mode', user.mode);
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        const card = document.querySelector(`.mode-card[data-mode="${user.mode}"]`);
        if (card) card.classList.add('active');
    }

    // Avatar — prefer backend, fallback to localStorage
    const avatarSrc = user.avatar || localStorage.getItem('anya-profile-avatar');
    if (avatarSrc && avatarImg) {
        avatarImg.src = avatarSrc;
        avatarImg.style.display = 'block';
        if (avatarText) avatarText.style.display = 'none';
    } else if (avatarText) {
        avatarText.textContent = (user.name || '?').charAt(0).toUpperCase();
        avatarText.style.display = '';
    }

    // Sync header avatar
    const headerAvatar = document.getElementById('header-avatar-icon');
    if (headerAvatar) {
        if (avatarSrc) {
            headerAvatar.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            headerAvatar.textContent = (user.name || '?').charAt(0).toUpperCase();
        }
    }

    // Account created date
    const createdEl = document.getElementById('stat-account-created');
    if (createdEl) {
        if (user.createdAt) {
            createdEl.textContent = new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        } else {
            createdEl.textContent = 'N/A';
        }
    }
}

function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        localStorage.setItem('anya-profile-avatar', dataUrl);
        const avatarImg = document.getElementById('profile-avatar-img');
        const avatarText = document.getElementById('profile-avatar-text');
        if (avatarImg) { avatarImg.src = dataUrl; avatarImg.style.display = 'block'; }
        if (avatarText) avatarText.style.display = 'none';
        // Update header
        const headerAvatar = document.getElementById('header-avatar-icon');
        if (headerAvatar) headerAvatar.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        showToast('success', 'Avatar updated', 'Your profile picture has been changed.');
    };
    reader.readAsDataURL(file);
}

async function saveProfileExtended() {
    const nickname = document.getElementById('profile-nickname')?.value?.trim() || '';
    const address = document.getElementById('profile-address')?.value?.trim() || '';
    const userType = document.getElementById('profile-user-type')?.value || 'personal';
    const status = document.getElementById('profile-status')?.value || 'online';
    const displayName = document.getElementById('profile-name')?.value?.trim() || '';

    const headers = getAuthHeaders();
    if (headers) {
        try {
            const res = await fetch('http://localhost:5000/api/profile', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ name: displayName, nickname, address, userType, status })
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('anya_user', JSON.stringify(data.user));
                // Update UI
                const nameDisplay = document.getElementById('profile-name-display');
                if (nameDisplay) nameDisplay.textContent = displayName;
                const headerName = document.getElementById('header-name-display');
                if (headerName) headerName.textContent = displayName;
                showToast('success', 'Profile saved', 'Your profile has been updated.');
                return;
            } else {
                const err = await res.json();
                showToast('error', 'Save failed', err.error || 'Could not save profile.');
                return;
            }
        } catch { /* fallback below */ }
    }

    // Fallback: save to localStorage only
    const ext = { nickname, address, userType, status };
    localStorage.setItem('anya-profile-ext', JSON.stringify(ext));
    const user = JSON.parse(localStorage.getItem('anya_user') || 'null');
    if (user && displayName) {
        user.name = displayName;
        localStorage.setItem('anya_user', JSON.stringify(user));
        const nameDisplay = document.getElementById('profile-name-display');
        if (nameDisplay) nameDisplay.textContent = displayName;
        const headerName = document.getElementById('header-name-display');
        if (headerName) headerName.textContent = displayName;
    }
    showToast('success', 'Profile saved', 'Saved locally (not logged in).');
}

function loadTokenStats(profile) {
    const usedEl = document.getElementById('stat-tokens-used');
    const leftEl = document.getElementById('stat-tokens-left');
    if (profile && profile.tokensUsed !== undefined) {
        if (usedEl) usedEl.textContent = profile.tokensUsed.toLocaleString();
        if (leftEl) leftEl.textContent = (profile.tokensLeft !== undefined ? profile.tokensLeft : Math.max(0, (profile.tokenLimit || 100000) - profile.tokensUsed)).toLocaleString();
    } else {
        if (usedEl) usedEl.textContent = '—';
        if (leftEl) leftEl.textContent = '—';
    }
}

function loadPointsBalance(profile) {
    const pSection = document.getElementById('points-balance-section');
    const pHeader  = document.getElementById('points-section-header');

    // Admin users and guests: hide the section
    if (!profile || profile.role === 'admin') {
        if (pSection) pSection.style.display = 'none';
        if (pHeader)  pHeader.style.display  = 'none';
        return;
    }

    if (pSection) pSection.style.display = 'block';
    if (pHeader)  pHeader.style.display  = '';

    // Points currency balance
    const pts   = profile.points ?? 500;
    const ptsEl = document.getElementById('points-display');
    if (ptsEl) ptsEl.textContent = pts.toLocaleString() + ' pts';

    // Daily token usage
    const used    = profile.tokensUsed  ?? 0;
    const limit   = profile.tokenLimit  ?? 100000;
    const left    = Math.max(0, limit - used);
    const pct     = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    const todayEl = document.getElementById('tokens-today-display');
    const barEl   = document.getElementById('points-bar');
    const subEl   = document.getElementById('points-sublabel');

    if (todayEl) todayEl.textContent = used.toLocaleString() + ' / ' + limit.toLocaleString();
    if (barEl)   barEl.style.width   = pct + '%';
    if (subEl)   subEl.textContent   = left.toLocaleString() + ' tokens left today · resets tomorrow';
}

function updateAdminNavLink(role) {
    const btn = document.getElementById('admin-nav-btn');
    if (btn) btn.style.display = role === 'admin' ? '' : 'none';
}

// ============================================
//  CHANGE PASSWORD (reauth flow)
// ============================================
let _reauthVerified = false;

async function verifyCurrentPassword() {
    const pwd = document.getElementById('current-password')?.value?.trim();
    const msgEl = document.getElementById('reauth-msg');

    if (!pwd) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Please enter your current password.'; msgEl.style.display = 'block'; }
        return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Not logged in.'; msgEl.style.display = 'block'; }
        return;
    }

    try {
        const res = await fetch('http://localhost:5000/api/auth/verify-password', {
            method: 'POST', headers,
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            const step1 = document.getElementById('reauth-step-1');
            const step2 = document.getElementById('reauth-step-2');
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';
            if (msgEl) { msgEl.style.color = '#34d399'; msgEl.textContent = '✓ Identity confirmed. Enter your new password below.'; msgEl.style.display = 'block'; }
            _reauthVerified = true;
        } else {
            if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = data.error || 'Verification failed.'; msgEl.style.display = 'block'; }
        }
    } catch {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Server error. Try again.'; msgEl.style.display = 'block'; }
    }
}

async function submitPasswordChange() {
    if (!_reauthVerified) return;
    const currentPwd = document.getElementById('current-password')?.value || '';
    const newPwd = document.getElementById('new-password')?.value || '';
    const confirmPwd = document.getElementById('confirm-password')?.value || '';
    const msgEl = document.getElementById('reauth-msg');

    if (!newPwd || newPwd.length < 6) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Password must be at least 6 characters.'; msgEl.style.display = 'block'; }
        return;
    }
    if (newPwd !== confirmPwd) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Passwords do not match.'; msgEl.style.display = 'block'; }
        return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const res = await fetch('http://localhost:5000/api/auth/change-password', {
            method: 'POST', headers,
            body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('success', 'Password changed', 'Your password has been updated successfully.');
            if (msgEl) { msgEl.style.display = 'none'; }
            // Reset form
            const step1 = document.getElementById('reauth-step-1');
            const step2 = document.getElementById('reauth-step-2');
            if (step1) step1.style.display = 'block';
            if (step2) step2.style.display = 'none';
            if (document.getElementById('current-password')) document.getElementById('current-password').value = '';
            if (document.getElementById('new-password')) document.getElementById('new-password').value = '';
            if (document.getElementById('confirm-password')) document.getElementById('confirm-password').value = '';
            _reauthVerified = false;
        } else {
            if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = data.error || 'Password change failed.'; msgEl.style.display = 'block'; }
        }
    } catch {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Server error. Try again.'; msgEl.style.display = 'block'; }
    }
}

// ============================================
//  SYNC THEME CARDS ON SETTINGS OPEN
// ============================================
const _origOpenSettings = window.openSettings;
window.openSettings = function (section) {
    if (_origOpenSettings) _origOpenSettings(section);

    // Sync brightness cards
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('theme-card-dark')?.classList.toggle('active', !isLight);
    document.getElementById('theme-card-light')?.classList.toggle('active', isLight);

    // Sync style cards
    const savedStyle = localStorage.getItem('anya-style') || 'default';
    ['default', 'minimalist', 'modern', 'ancient'].forEach(s => {
        document.getElementById('style-card-' + s)?.classList.toggle('active', s === savedStyle);
    });

    // Sync accent swatches
    const savedAccent = localStorage.getItem('anya-accent') || 'default';
    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.accent === savedAccent);
    });

    // Sync mode cards
    const savedMode = localStorage.getItem('anya-mode') || 'default';
    document.querySelectorAll('.mode-card').forEach(c => {
        c.classList.toggle('active', c.dataset.mode === savedMode);
    });

    // Refresh profile section
    loadProfileExtended();
};

// ============================================
//  EXPOSE GLOBALS
// ============================================
window.showToast = showToast;
window.setStyle = setStyle;
window.setAccent = setAccent;
window.setMode = setMode;
window.handleAvatarUpload = handleAvatarUpload;
window.saveProfileExtended = saveProfileExtended;
window.verifyCurrentPassword = verifyCurrentPassword;
window.submitPasswordChange = submitPasswordChange;