// frontend/auth.js

// ===========================================
//          PHASE 4: AUTHENTICATION
// ===========================================

let anyaAuthToken = localStorage.getItem("anya_auth_token") || null;
let anyaUser = JSON.parse(localStorage.getItem("anya_user") || "null");

function updateAuthUI() {
    const loginHeaderBtn = document.getElementById("header-login-btn");
    const profileLoginBtn = document.getElementById("profile-login-btn");
    const profileLogoutBtn = document.getElementById("profile-logout-btn");
    const avatarIcon = document.getElementById("profile-avatar-icon");
    const nameDisplay = document.getElementById("profile-name-display");
    const emailDisplay = document.getElementById("profile-email-display");
    const nameRow = document.getElementById("profile-name-row");

    if (anyaAuthToken && anyaUser) {
        if (loginHeaderBtn) loginHeaderBtn.style.display = "none";
        if (profileLoginBtn) profileLoginBtn.style.display = "none";
        if (profileLogoutBtn) profileLogoutBtn.style.display = "block";
        if (nameRow) nameRow.style.display = "flex";

        if (avatarIcon) avatarIcon.innerText = anyaUser.name.charAt(0).toUpperCase();
        if (nameDisplay) nameDisplay.innerText = anyaUser.name;
        if (emailDisplay) emailDisplay.innerText = anyaUser.email;

        const headerProfileView = document.getElementById("header-profile-view");
        const headerAvatar = document.getElementById("header-avatar-icon");
        const headerName = document.getElementById("header-name-display");
        if (headerProfileView) headerProfileView.style.display = "flex";
        if (headerAvatar) headerAvatar.innerText = anyaUser.name.charAt(0).toUpperCase();
        if (headerName) headerName.innerText = anyaUser.name;

    } else {
        if (loginHeaderBtn) loginHeaderBtn.style.display = "block";
        const headerProfileView = document.getElementById("header-profile-view");
        if (headerProfileView) headerProfileView.style.display = "none";

        if (profileLoginBtn) profileLoginBtn.style.display = "block";
        if (profileLogoutBtn) profileLogoutBtn.style.display = "none";
        if (nameRow) nameRow.style.display = "none";

        if (avatarIcon) avatarIcon.innerText = "?";
        if (nameDisplay) nameDisplay.innerText = "Guest User";
        if (emailDisplay) emailDisplay.innerText = "Not logged in";
    }
}

// Intercept fetch calls
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    if (typeof resource === "string" && resource.startsWith("http://localhost:5000") && anyaAuthToken) {
        config = config || {};
        config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${anyaAuthToken}`
        };
    }
    const response = await originalFetch(resource, config);
    if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        handleLogout(false);
        openAuthModal();
    }
    return response;
};

function openAuthModal() {
    document.getElementById("auth-modal").style.display = "flex";
    // Always start at step 1
    showAuthStep("auth-step-1");

    // Render Google Sign-In buttons now that the modal is visible
    if (window.google && window.google.accounts && window.google.accounts.id && window._googleClientId) {
        const loginBtn = document.getElementById("google-signin-btn-login");
        if (loginBtn) {
            loginBtn.innerHTML = "";
            window.google.accounts.id.renderButton(loginBtn, { theme: "outline", size: "large", width: 250 });
        }
        const signupBtn = document.getElementById("google-signin-btn-signup");
        if (signupBtn) {
            signupBtn.innerHTML = "";
            window.google.accounts.id.renderButton(signupBtn, { theme: "outline", size: "large", width: 250 });
        }
    }
}

function showAuthStep(stepId) {
    // Hide all steps
    const steps = ["auth-step-1", "auth-step-signup", "auth-step-otp-request", "auth-step-otp-verify"];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // Clear all errors
    const errors = ["auth-error-msg", "signup-error-msg", "otp-request-error", "otp-verify-error"];
    errors.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    // Show target
    const target = document.getElementById(stepId);
    if (target) target.style.display = "block";
}

function closeAuthModal(e) {
    if (e && e.target.id !== "auth-modal" && !e.target.closest('.settings-close')) return;
    document.getElementById("auth-modal").style.display = "none";
}

async function handleEmailSignup() {
    const name = document.getElementById("signup-name").value;
    const age = document.getElementById("signup-age").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const errorMsg = document.getElementById("signup-error-msg");

    if (!email || !password || !name || !age) {
        errorMsg.innerText = "All fields (Name, Age, Email, Password) are required";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name, age })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        finishLogin(data.token, data.user);
    } catch (err) {
        errorMsg.innerText = err.message;
        errorMsg.style.display = "block";
    }
}

async function handleEmailLogin() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const errorMsg = document.getElementById("auth-error-msg");

    if (!email || !password) {
        errorMsg.innerText = "Email and password required";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error);
        }

        finishLogin(data.token, data.user);
    } catch (err) {
        errorMsg.innerText = err.message;
        errorMsg.style.display = "block";
    }
}

async function handleSendOTP() {
    const email = document.getElementById("otp-request-email").value;
    const errorMsg = document.getElementById("otp-request-error");
    errorMsg.style.display = "none";

    if (!email) {
        errorMsg.innerText = "Email is required";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Move to OTP Verify Step
        document.getElementById("otp-verify-email-display").innerText = email;
        showAuthStep("auth-step-otp-verify");
    } catch (err) {
        errorMsg.innerText = err.message;
        errorMsg.style.display = "block";
    }
}

async function handleVerifyOTPLogin() {
    const email = document.getElementById("otp-verify-email-display").innerText;
    const otp = document.getElementById("auth-otp-input").value;
    const errorMsg = document.getElementById("otp-verify-error");
    errorMsg.style.display = "none";

    if (!otp) {
        errorMsg.innerText = "OTP is required";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/auth/login-with-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        finishLogin(data.token, data.user);
    } catch (err) {
        errorMsg.innerText = err.message;
        errorMsg.style.display = "block";
    }
}

async function handleGoogleCredentialResponse(response) {
    try {
        const res = await fetch("http://localhost:5000/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        finishLogin(data.token, data.user);
    } catch (err) {
        document.getElementById("auth-error-msg").innerText = err.message;
        document.getElementById("auth-error-msg").style.display = "block";
        const signupErr = document.getElementById("signup-error-msg");
        if (signupErr) {
            signupErr.innerText = err.message;
            signupErr.style.display = "block";
        }
    }
}

function finishLogin(token, user) {
    anyaAuthToken = token;
    anyaUser = user;
    localStorage.setItem("anya_auth_token", token);
    localStorage.setItem("anya_user", JSON.stringify(user));
    closeAuthModal();
    updateAuthUI();
    loadSessions(); // Reload sessions for this user
}

function handleLogout(manual = true) {
    anyaAuthToken = null;
    anyaUser = null;
    localStorage.removeItem("anya_auth_token");
    localStorage.removeItem("anya_user");
    updateAuthUI();
    if (manual) {
        document.getElementById("session-list").innerHTML = "";
        document.getElementById("chat-box").innerHTML = "";
        document.getElementById("welcome-screen").style.display = "flex";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
});
