// frontend/themes.js
// ================= THEMES & STYLES =================
function setThemeMode() {
    const sel = document.getElementById('settings-theme-sel');
    if (!sel) return;
    const mode = sel.value;
    document.body.className = mode;
    localStorage.setItem('anya-theme-mode', mode);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        if (document.body.classList.contains('light-mode')) toggle.checked = true;
        else toggle.checked = false;
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('anya-theme-mode');
    if (savedTheme) {
        document.body.className = savedTheme;
    }
}

function initResizeSidebars() {
    let isResizingLeft = false;
    let isResizingRight = false;

    const leftSidebar = document.getElementById('left-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');

    // Add handles dynamically
    if (leftSidebar && !document.querySelector('.left-resize-handle')) {
        const handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle left-resize-handle';
        leftSidebar.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            document.body.style.cursor = 'col-resize';
            handle.classList.add('active');
            e.preventDefault();
        });
    }

    if (rightSidebar && !document.querySelector('.right-resize-handle')) {
        const handle = document.createElement('div');
        handle.className = 'sidebar-resize-handle right-resize-handle';
        rightSidebar.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            document.body.style.cursor = 'col-resize';
            handle.classList.add('active');
            e.preventDefault();
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!isResizingLeft && !isResizingRight) return;

        if (isResizingLeft) {
            let maxW = 405; // 150%
            let minW = 135; // 50%
            let newW = Math.max(minW, Math.min(e.clientX, maxW));
            document.documentElement.style.setProperty('--sidebar-width', newW + 'px');
        }

        if (isResizingRight) {
            let maxW = 480; // 150%
            let minW = 160; // 50%
            let newW = Math.max(minW, Math.min(window.innerWidth - e.clientX, maxW));
            document.documentElement.style.setProperty('--right-sidebar-width', newW + 'px');
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingLeft || isResizingRight) {
            isResizingLeft = false;
            isResizingRight = false;
            document.body.style.cursor = 'default';
            document.querySelectorAll('.sidebar-resize-handle').forEach(h => h.classList.remove('active'));
        }
    });
}

// Intercept toggleRightSidebar to hide profile button
const originalToggleRightSidebar = toggleRightSidebar;
window.toggleRightSidebar = function (forceOpen) {
    originalToggleRightSidebar(forceOpen);

    // Logic to hide/show profile btn
    const rsb = document.getElementById('right-sidebar');
    const pbtn = document.getElementById('user-profile-btn');
    if (rsb && pbtn) {
        if (rsb.classList.contains('collapsed')) {
            pbtn.style.display = 'none';
        } else {
            pbtn.style.display = 'flex';
        }
    }
};

const originalWindowOnload = window.onload;
window.onload = async () => {
    if (originalWindowOnload) await originalWindowOnload();
    loadSavedTheme();
    initResizeSidebars();
    initCanvasMode();
};
