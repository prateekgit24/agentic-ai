// frontend/tools-notes.js

// ===============================================================
// NOTES STORE — localStorage-backed note manager
// ===============================================================
const notesStore = (() => {
    const KEY = "anya-notes";
    function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
    function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }
    return {
        all() { return load(); },
        add(text, type = "note", _id = null) {
            const arr = load();
            arr.unshift({ id: _id || Date.now(), text, type, done: false, ts: new Date().toISOString() });
            save(arr);
        },
        toggle(id) { const a = load(); const n = a.find(x => x.id === id); if (n) n.done = !n.done; save(a); },
        remove(id) { save(load().filter(x => x.id !== id)); }
    };
})();

// ===============================================================
// NOTES / TODO WIDGET
// ===============================================================
function openNotesTool() {
    openRightSidebar();
    const existing = document.getElementById("notes-tool-widget");
    if (existing) { renderNotesList(existing.querySelector("#notes-list")); return; }

    const win = document.createElement("div");
    win.className = "tool-window notes-widget";
    win.id = "notes-tool-widget";
    win.innerHTML = `
        <div class="tool-window-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">edit_note</span>
                <span class="tool-window-title">Notes & Tasks</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn tool-header-btn" title="Minimize" onclick="minimizeTool('notes-tool-widget','\ud83d\udcdd','Notes')">
                    <span class="material-icons-round" style="font-size:16px;">remove</span>
                </button>
                <button class="icon-btn tool-header-btn" title="Close" onclick="closeTool('notes-tool-widget')">
                    <span class="material-icons-round" style="font-size:16px;">close</span>
                </button>
            </div>
        </div>
        <div class="notes-input-row">
            <select class="notes-type-sel" id="notes-type-sel">
                <option value="note">\ud83d\udcdd Note</option>
                <option value="todo">\u2705 Todo</option>
                <option value="reminder">\ud83d\udd14 Reminder</option>
                <option value="phone">\ud83d\udcde Phone</option>
            </select>
            <input type="text" id="notes-text-input" class="notes-text-input" placeholder="Type and press Enter…" maxlength="200">
            <button class="notes-add-btn" onclick="notesAddFromWidget()">\uff0b</button>
        </div>
        <div class="notes-filter-bar" id="notes-filter-bar">
            <button class="notes-filter-chip active" data-filter="all">All</button>
            <button class="notes-filter-chip" data-filter="todo">\u2705 Todo</button>
            <button class="notes-filter-chip" data-filter="reminder">\ud83d\udd14 Remind</button>
            <button class="notes-filter-chip" data-filter="note">\ud83d\udcdd Notes</button>
            <button class="notes-filter-chip" data-filter="phone">\ud83d\udcde Contacts</button>
        </div>
        <div class="notes-list" id="notes-list"></div>
    `;

    document.getElementById("tool-container").appendChild(win);

    win.querySelector("#notes-text-input").addEventListener("keydown", e => {
        if (e.key === "Enter") notesAddFromWidget();
    });

    win.querySelector("#notes-filter-bar").addEventListener("click", e => {
        const chip = e.target.closest(".notes-filter-chip");
        if (!chip) return;
        win.querySelectorAll(".notes-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        renderNotesList(win.querySelector("#notes-list"), chip.dataset.filter);
    });

    renderNotesList(win.querySelector("#notes-list"));
}

function notesAddFromWidget() {
    const textEl = document.getElementById("notes-text-input");
    const typeEl = document.getElementById("notes-type-sel");
    const text = textEl?.value?.trim();
    if (!text) return;
    notesStore.add(text, typeEl?.value || "note");
    textEl.value = "";
    const listEl = document.getElementById("notes-list");
    if (listEl) renderNotesList(listEl);
}

function renderNotesList(container, filter = "all") {
    if (!container) return;
    const notes = notesStore.all().filter(n => filter === "all" || n.type === filter);
    container.innerHTML = "";
    if (!notes.length) {
        container.innerHTML = `<div class="notes-empty">Nothing here yet — type above or ask me to remember something!</div>`;
        return;
    }
    const emoji = { todo: "✅", reminder: "🔔", phone: "📞", note: "📝" };
    notes.forEach(note => {
        const row = document.createElement("div");
        row.className = `notes-row${note.done ? " notes-done" : ""}`;
        row.innerHTML = `
            <span class="notes-type-icon">${emoji[note.type] || "📝"}</span>
            ${note.type === "todo" ? `<input type="checkbox" class="notes-check"${note.done ? " checked" : ""}>` : ""}
            <span class="notes-text">${note.text}</span>
            <span class="notes-date">${_noteDate(note.ts)}</span>
            <button class="notes-del-btn" title="Delete">✕</button>
        `;
        if (note.type === "todo") {
            row.querySelector(".notes-check").onclick = () => { notesStore.toggle(note.id); renderNotesList(container, filter); };
        }
        row.querySelector(".notes-del-btn").onclick = () => { notesStore.remove(note.id); renderNotesList(container, filter); };
        container.appendChild(row);
    });
}

function _noteDate(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso);
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
