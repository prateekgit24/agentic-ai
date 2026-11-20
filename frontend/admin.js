// frontend/admin.js
// Anya Admin Dashboard

const API = "http://localhost:5000";

let _allUsers    = [];
let _allRequests = [];
let _editUserId  = null;
let _reqFilter   = "pending";

// ─── JWT decode (no verify, display only) ───────────────────────
function decodeJwt(token) {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function getHeaders() {
    const token = localStorage.getItem("anya_auth_token");
    if (!token) return null;
    return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// ─── Toast ───────────────────────────────────────────────────────
function toast(msg, type = "ok") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className   = `show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = ""; }, 3000);
}

// ─── Auth guard ──────────────────────────────────────────────────
function guardAuth() {
    const token = localStorage.getItem("anya_auth_token");
    if (!token) { window.location.replace("index.html"); return false; }
    const payload = decodeJwt(token);
    if (!payload || payload.role !== "admin") {
        alert("Admin access required.");
        window.location.replace("index.html");
        return false;
    }
    return true;
}

// ─── Load stats ──────────────────────────────────────────────────
async function loadStats() {
    const headers = getHeaders();
    if (!headers) return;
    try {
        const res  = await fetch(`${API}/api/admin/stats`, { headers });
        const data = await res.json();
        document.getElementById("stat-users").textContent    = (data.totalUsers    ?? "–").toLocaleString();
        document.getElementById("stat-messages").textContent = (data.totalMessages ?? "–").toLocaleString();
        document.getElementById("stat-weighted").textContent = (data.totalWeightedTokens ?? "–").toLocaleString();
    } catch { toast("Failed to load stats", "err"); }
}

// ─── Load users ──────────────────────────────────────────────────
async function loadUsers() {
    const headers = getHeaders();
    if (!headers) return;
    document.getElementById("users-tbody").innerHTML =
        `<tr class="empty-row"><td colspan="9"><span class="spinner"></span></td></tr>`;
    try {
        const res  = await fetch(`${API}/api/admin/users`, { headers });
        _allUsers  = await res.json();
        document.getElementById("users-count").textContent = _allUsers.length;
        renderUsers(_allUsers);
    } catch { toast("Failed to load users", "err"); }
}

function renderUsers(users) {
    const tbody = document.getElementById("users-tbody");
    if (!users.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No users found.</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(u.email)}">${esc(u.email)}</td>
          <td>${esc(u.name || "—")}</td>
          <td><span class="role-pill ${u.role || "user"}">${u.role || "user"}</span></td>
          <td>${u.role === "admin" ? '<span style="color:var(--text-dim)">∞</span>' : (u.points ?? 500)}</td>
          <td>${u.role === "admin" ? '<span style="color:var(--text-dim)">∞</span>' : ((u.tokenLimit ?? 100000)).toLocaleString()}</td>
          <td>${u.role === "admin" ? "—" : (u.tokensUsed ?? 0).toLocaleString()}</td>
          <td>${(u.weightedTokensUsed ?? 0).toLocaleString()}</td>
          <td>${(u.messagesCount ?? 0).toLocaleString()}</td>
          <td>
            ${u.role !== "admin"
                ? `<button class="action-btn edit" onclick="openEditModal('${u._id}','${esc(u.email)}',${u.points ?? 500},${u.tokenLimit ?? 100000})">
                    <span class="material-icons-round" style="font-size:13px;">edit</span> Edit
                   </button>`
                : '<span style="color:var(--text-dim);font-size:0.75rem;">admin</span>'}
          </td>
        </tr>`).join("");
}

function filterUsers() {
    const q = document.getElementById("user-search").value.toLowerCase();
    const filtered = _allUsers.filter(u =>
        u.email.toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q)
    );
    renderUsers(filtered);
}

// ─── Load requests ───────────────────────────────────────────────
async function loadRequests(status = "pending") {
    const headers = getHeaders();
    if (!headers) return;
    document.getElementById("req-tbody").innerHTML =
        `<tr class="empty-row"><td colspan="7"><span class="spinner"></span></td></tr>`;
    try {
        const qs   = status ? `?status=${status}` : "";
        const res  = await fetch(`${API}/api/admin/points-requests${qs}`, { headers });
        _allRequests = await res.json();
        document.getElementById("req-count").textContent = _allRequests.length;
        renderRequests(_allRequests);
    } catch { toast("Failed to load requests", "err"); }
}

function renderRequests(requests) {
    const tbody = document.getElementById("req-tbody");
    if (!requests.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No requests.</td></tr>`;
        return;
    }
    tbody.innerHTML = requests.map(r => `
        <tr id="req-row-${r._id}">
          <td>${esc(r.name || "—")}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.email)}</td>
          <td><strong>+${r.amount} pts</strong></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(r.reason)}">${esc(r.reason || "—")}</td>
          <td><span class="status-pill ${r.status}">${r.status}</span></td>
          <td style="white-space:nowrap;">${new Date(r.requestedAt).toLocaleDateString()}</td>
          <td style="display:flex;gap:6px;">
            ${r.status === "pending" ? `
              <button class="action-btn approve" onclick="resolveRequest('${r._id}','approve')">
                <span class="material-icons-round" style="font-size:13px;">check</span> Approve
              </button>
              <button class="action-btn reject" onclick="resolveRequest('${r._id}','reject')">
                <span class="material-icons-round" style="font-size:13px;">close</span> Reject
              </button>` : '<span style="color:var(--text-dim);font-size:0.75rem;">resolved</span>'}
          </td>
        </tr>`).join("");
}

async function resolveRequest(id, action) {
    const headers = getHeaders();
    try {
        const note = action === "reject"
            ? (prompt("Optional rejection note (or leave blank):") ?? "") : "";
        const res  = await fetch(`${API}/api/admin/points-requests/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ action, adminNote: note })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Failed", "err"); return; }
        toast(action === "approve" ? "Approved — points credited!" : "Request rejected.", "ok");
        const row = document.getElementById(`req-row-${id}`);
        if (row) {
            const statusCell = row.querySelector(".status-pill");
            if (statusCell) { statusCell.textContent = action === "approve" ? "approved" : "rejected"; statusCell.className = `status-pill ${action === "approve" ? "approved" : "rejected"}`; }
            const actionsCell = row.querySelector("td:last-child");
            if (actionsCell) actionsCell.innerHTML = '<span style="color:var(--text-dim);font-size:0.75rem;">resolved</span>';
        }
        loadStats();
    } catch { toast("Network error", "err"); }
}

// ─── Tab filter ──────────────────────────────────────────────────
function setReqTab(status, btn) {
    _reqFilter = status;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadRequests(status);
}

// ─── Edit modal ──────────────────────────────────────────────────
function openEditModal(userId, email, points, tokenLimit) {
    _editUserId = userId;
    document.getElementById("edit-user-info").textContent = email;
    document.getElementById("edit-points").value     = points;
    document.getElementById("edit-tlimit").value     = tokenLimit;
    document.getElementById("edit-reset-tokens").checked = false;
    document.getElementById("edit-modal").style.display = "flex";
}

function closeEditModal(e) {
    if (e && e.target !== document.getElementById("edit-modal")) return;
    document.getElementById("edit-modal").style.display = "none";
    _editUserId = null;
}

async function saveEditPoints() {
    if (!_editUserId) return;
    const headers    = getHeaders();
    const points     = parseInt(document.getElementById("edit-points").value, 10);
    const tokenLimit = parseInt(document.getElementById("edit-tlimit").value, 10);
    const resetTokens = document.getElementById("edit-reset-tokens").checked;

    if (isNaN(points) || isNaN(tokenLimit) || points < 0 || tokenLimit < 0) {
        toast("Values must be non-negative numbers.", "err"); return;
    }

    try {
        const res  = await fetch(`${API}/api/admin/users/${_editUserId}/points`, {
            method: "PATCH", headers,
            body: JSON.stringify({ points, tokenLimit, resetTokens })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Failed", "err"); return; }
        toast("User updated!", "ok");
        document.getElementById("edit-modal").style.display = "none";
        _editUserId = null;
        loadUsers();
    } catch { toast("Network error", "err"); }
}

// ─── Helpers ─────────────────────────────────────────────────────
function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function loadAll() {
    await Promise.all([loadStats(), loadUsers(), loadRequests(_reqFilter)]);
}

// ─── Init ────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    if (!guardAuth()) return;
    loadAll();
});
