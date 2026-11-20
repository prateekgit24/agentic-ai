// ============================================
//  ANYA AI — Frontend Script
// ============================================

// ================= GLOBAL STATE =================
let currentSessionId = null;

// ================= CREATE SESSION =================
async function createSession() {
    const res = await fetch("http://localhost:5000/session", {
        method: "POST"
    });

    const session = await res.json();
    currentSessionId = session._id;

    await loadSessions();
    document.getElementById("chat-box").innerHTML = "";
    clearTools();
    showWelcome(false);
}

// ================= LOAD SESSIONS =================
async function loadSessions() {
    try {
        const res = await fetch("http://localhost:5000/sessions");
        if (!res.ok) throw new Error("Server disconnected");
        const sessions = await res.json();

        const list = document.getElementById("session-list");
        list.innerHTML = "";

        sessions.forEach(session => {
            const div = document.createElement("div");
            div.className = "session-item";
            div.dataset.id = session._id;

            const title = document.createElement("span");
            title.innerText = session.title;

            const del = document.createElement("span");
            del.innerText = "🗑";
            del.className = "delete-btn";
            del.onclick = async (e) => {
                e.stopPropagation();
                await deleteSession(session._id);
            };

            div.appendChild(title);
            div.appendChild(del);

            div.onclick = () => {
                currentSessionId = session._id;
                loadMessages(session._id);
                highlightActive(session._id);
            };

            list.appendChild(div);
        });

        // Update Status indicator
        document.getElementById("status-text").innerText = "Online";
        document.querySelector(".status-dot").classList.remove("disconnected");

    } catch (err) {
        document.getElementById("status-text").innerText = "Disconnected";
        document.querySelector(".status-dot").classList.add("disconnected");
        console.error("Failed to load sessions:", err);
    }
}

// ================= SERVER HEALTH CHECK =================
setInterval(async () => {
    try {
        const res = await fetch("http://localhost:5000/sessions", { method: "HEAD" });
        if (res.ok) {
            document.getElementById("status-text").innerText = "Online";
            document.querySelector(".status-dot").classList.remove("disconnected");
        } else {
            throw new Error("Bad response");
        }
    } catch (err) {
        document.getElementById("status-text").innerText = "Disconnected";
        document.querySelector(".status-dot").classList.add("disconnected");
    }
}, 5000);

// ================= DELETE SESSION =================
async function deleteSession(id) {
    await fetch(`http://localhost:5000/session/${id}`, {
        method: "DELETE"
    });

    if (currentSessionId === id) {
        currentSessionId = null;
        document.getElementById("chat-box").innerHTML = "";
        clearTools();
        showWelcome(true);
    }

    loadSessions();
}

// ================= LOAD MESSAGES =================
async function loadMessages(sessionId) {
    const res = await fetch(`http://localhost:5000/session/${sessionId}/messages`);
    const messages = await res.json();

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";

    clearTools();

    if (messages.length === 0) {
        showWelcome(true);
    } else {
        showWelcome(false);
        messages.forEach(msg => {
            appendChatMessage(msg.role, msg.content, msg.timestamp);
        });
    }

    scrollToBottom();
}

// ================= ATTACH (IMAGE + DOCUMENT) =================
let attachedImage = null;       // { dataUrl, name }
let attachedFileContext = null; // { filename, text }

function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function handleImageAttach(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = "";
    const reader = new FileReader();
    reader.onload = (e) => {
        attachedImage = { dataUrl: e.target.result, name: file.name };
        showAttachPreview("image", e.target.result, file.name);
    };
    reader.readAsDataURL(file);
}

async function handleDocAttach(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = "";
    const ext = file.name.split(".").pop().toLowerCase();
    showAttachPreview("doc-loading", null, file.name);

    try {
        if (ext === "txt") {
            const text = await file.text();
            attachedFileContext = { filename: file.name, text };
            showAttachPreview("doc", null, file.name);
        } else {
            const buf = await file.arrayBuffer();
            const b64 = arrayBufferToBase64(buf);
            const res = await fetch("http://localhost:5000/extract-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, data: b64 })
            });
            const data = await res.json();
            if (data.text) {
                attachedFileContext = { filename: file.name, text: data.text };
                showAttachPreview("doc", null, file.name);
            } else {
                showAttachPreview("doc-error", null, file.name);
            }
        }
    } catch {
        showAttachPreview("doc-error", null, file.name);
    }
}

function showAttachPreview(type, src, name) {
    const preview = document.getElementById("attach-preview");
    if (!preview) return;
    if (type === "image") {
        preview.style.display = "flex";
        preview.innerHTML = `<img src="${src}" class="attach-thumb" alt="attached image"><span class="attach-name">${name}</span><button class="attach-clear-btn" onclick="clearAttach()" title="Remove">&times;</button>`;
    } else if (type === "doc") {
        preview.style.display = "flex";
        preview.innerHTML = `<span class="material-icons-round attach-doc-icon">description</span><span class="attach-name">${name}</span><button class="attach-clear-btn" onclick="clearAttach()" title="Remove">&times;</button>`;
    } else if (type === "doc-loading") {
        preview.style.display = "flex";
        preview.innerHTML = `<span class="material-icons-round attach-doc-icon" style="opacity:0.5;">hourglass_empty</span><span class="attach-name" style="opacity:0.7;">Reading ${name}…</span>`;
    } else if (type === "doc-error") {
        preview.style.display = "flex";
        preview.innerHTML = `<span class="material-icons-round" style="color:#f87171;font-size:18px;">error</span><span class="attach-name" style="color:#f87171;">Failed to read ${name}</span><button class="attach-clear-btn" onclick="clearAttach()" title="Remove">&times;</button>`;
    }
}

function clearAttach() {
    attachedImage = null;
    attachedFileContext = null;
    const preview = document.getElementById("attach-preview");
    if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
    // Also reset the active-state on attach buttons
    document.getElementById("attach-img-btn")?.classList.remove("active");
    document.getElementById("attach-doc-btn")?.classList.remove("active");
}

// ================= SEND MESSAGE =================
async function sendMessage() {

    if (!currentSessionId) {
        await createSession();
    }

    const input = document.getElementById("message");
    const message = input.value.trim();
    if (!message && !attachedImage && !attachedFileContext) return;

    // /imagine command → image generation (skip normal chat flow)
    if (message.startsWith('/imagine ') || message === '/imagine') {
        const prompt = message.slice(9).trim();
        input.value = '';
        autoResizeTextarea(input);
        if (prompt) handleImageGen(prompt);
        return;
    }

    showWelcome(false);

    const userBubble = appendChatMessage("user", message || "(attachment)", new Date());
    // Show image or doc badge in user bubble
    if (attachedImage) {
        const img = document.createElement("img");
        img.src = attachedImage.dataUrl;
        img.className = "chat-img-preview";
        img.alt = attachedImage.name || "image";
        userBubble.querySelector(".content").before(img);
    }
    if (attachedFileContext) {
        const badge = document.createElement("div");
        badge.className = "chat-doc-badge";
        badge.innerHTML = `<span class="material-icons-round">description</span> ${attachedFileContext.filename}`;
        userBubble.querySelector(".content").before(badge);
    }

    // Capture attach state for request, then clear
    const pendingImage = attachedImage;
    const pendingFileContext = attachedFileContext;
    clearAttach();

    input.value = "";
    autoResizeTextarea(input);

    showTypingIndicator(true);
    if (window.avatarSetState) avatarSetState("talk");

    try {
        const savedNotes = notesStore.all();
        const notesContext = savedNotes.length
            ? savedNotes.map(n => `[${n.type.toUpperCase()}] ${n.text}`).join("\n")
            : null;

        const authToken = localStorage.getItem('anya_auth_token');
        const chatHeaders = { "Content-Type": "application/json" };
        if (authToken) chatHeaders["Authorization"] = "Bearer " + authToken;

        // Check if streaming is enabled (default: ON)
        const useStreaming = localStorage.getItem('anya-streaming') !== 'false';
        const chatEndpoint = useStreaming
            ? "http://localhost:5000/chat/stream"
            : "http://localhost:5000/chat";

        const response = await fetch(chatEndpoint, {
            method: "POST",
            headers: chatHeaders,
            body: JSON.stringify({
                message: message || "(see attachment)",
                sessionId: currentSessionId,
                model_id: currentModelId,
                notes: notesContext,
                autoRouting: localStorage.getItem("anya-auto-routing") !== "false",
                lastManualSelect: lastManualSelectTime,
                ...(pendingImage ? { images: [pendingImage.dataUrl] } : {}),
                ...(pendingFileContext ? { fileContext: { filename: pendingFileContext.filename, text: pendingFileContext.text } } : {})
            })
        });

        const contentType = response.headers.get("content-type") || "";

        // ---- SSE STREAMING RESPONSE ----
        if (useStreaming && contentType.includes("text/event-stream") && response.body) {

            // Lazy bubble — created only when FIRST token arrives (no blank box flash)
            let aiMessage = null;
            let aiContent = null;
            let aiTime = null;
            let accumulated = "";
            let streamStats = null;
            let bubbleCreated = false;
            let toolResultReceived = false;
            let pendingRoutingStatus = null;
            let routingBarInserted = false;

            function ensureBubble() {
                if (bubbleCreated) return;
                bubbleCreated = true;
                showTypingIndicator(false);
                aiMessage = appendChatMessage("ai", "", new Date());
                aiMessage.classList.add("streaming");
                aiContent = aiMessage.querySelector(".content");
                aiTime = aiMessage.querySelector(".timestamp");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const payload = line.slice(6).trim();
                    if (payload === "[DONE]") continue;

                    try {
                        const evt = JSON.parse(payload);

                        // Live token — create bubble on first NON-tool token
                        // Suppress JSON tool calls while they stream (wait for tool_result event)
                        if (evt.token) {
                            accumulated += evt.token;
                            const mightBeTool = accumulated.trimStart().startsWith('{');
                            if (!mightBeTool) {
                                ensureBubble();
                                // Insert routing bar before content on first token (once)
                                if (pendingRoutingStatus && !routingBarInserted) {
                                    routingBarInserted = true;
                                    const bar = _buildRoutingBar(pendingRoutingStatus);
                                    if (bar && aiContent) aiContent.parentNode.insertBefore(bar, aiContent);
                                }
                                // Clear step indicator on first real token
                                const stepInd = aiMessage && aiMessage.querySelector(".routing-step-indicator");
                                if (stepInd) stepInd.remove();
                                renderWithThinking(accumulated, aiMessage, aiContent);
                                scrollToBottom();
                            }
                        }

                        // Smart routing metadata (model selection / vision pipeline)
                        if (evt.routing_status) {
                            pendingRoutingStatus = evt.routing_status;
                        }

                        // Routing step indicator (shown during extraction wait)
                        if (evt.routing_step) {
                            ensureBubble();
                            let stepEl = aiMessage.querySelector(".routing-step-indicator");
                            if (!stepEl) {
                                stepEl = document.createElement("div");
                                stepEl.className = "routing-step-indicator";
                                if (aiContent) aiContent.parentNode.insertBefore(stepEl, aiContent);
                            }
                            stepEl.innerHTML = `<span class="material-icons-round routing-spin">autorenew</span>${evt.routing_step.label}`;
                        }

                        // Tool result from server
                        if (evt.tool_result) {
                            toolResultReceived = true;
                            ensureBubble();
                            aiMessage.classList.remove("streaming");
                            // Show tool_message in the bubble if AI included one
                            if (evt.tool_result.tool_message) {
                                aiContent.textContent = evt.tool_result.tool_message;
                                handleJSONResponse(evt.tool_result, null, aiTime);
                            } else {
                                handleJSONResponse(evt.tool_result, aiContent, aiTime);
                            }
                        }

                        // Stream done with stats
                        if (evt.done && evt.stats) {
                            streamStats = evt.stats;
                        }

                        // Error
                        if (evt.error) {
                            ensureBubble();
                            aiContent.textContent = "⚠ " + evt.error;
                        }
                    } catch (e) { }
                }
            }

            // Finalize
            showTypingIndicator(false);
            if (window.avatarSetState) avatarSetState("idle");
            if (aiMessage) {
                aiMessage.classList.remove("streaming");
                if (aiTime) aiTime.textContent = formatTime(new Date());
                if (accumulated && !accumulated.trim().startsWith("{")) {
                    const cleanForSpeech = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                    speakResponse(cleanForSpeech, aiMessage);
                }

                // Attach preview button if canvas mode is on
                maybeAttachPreviewButton(accumulated, aiMessage);

                // Render stats bar
                if (streamStats && localStorage.getItem("anya-show-stats") !== "false") {
                    const s = streamStats;
                    const statsBar = document.createElement("div");
                    statsBar.className = "ai-stats-bar";
                    const verdict = s.verdict === "done"
                        ? `<span class="stat-verdict done">✓ Done</span>`
                        : `<span class="stat-verdict error">✗ Error</span>`;
                    statsBar.innerHTML = `
                        <span class="stat-item" title="Output tokens per second"><span class="stat-icon">⚡</span>${s.tok_per_sec} tok/s</span>
                        <span class="stat-sep">·</span>
                        <span class="stat-item" title="Output / Input / Total tokens"><span class="stat-icon">🔢</span>${s.output_tokens}↑ ${s.input_tokens}↓ ${s.total_tokens}T</span>
                        <span class="stat-sep">·</span>
                        <span class="stat-item" title="Wall clock time"><span class="stat-icon">🕐</span>${s.wall_time_s}s</span>
                        ${verdict}
                    `;
                    aiMessage.appendChild(statsBar);
                }
            }
        }

        // ---- JSON RESPONSE (non-streaming mode or fallback) ----
        else if (contentType.includes("application/json") || (!useStreaming && response.ok)) {
            const data = await response.json();
            showTypingIndicator(false);
            if (window.avatarSetState) avatarSetState("idle");

            if (data.error) {
                const aiMessage = appendChatMessage("ai", "", new Date());
                aiMessage.querySelector(".content").textContent = "⚠ " + data.error;
            } else {
                const aiMessage = appendChatMessage("ai", "", new Date());
                const aiContent = aiMessage.querySelector(".content");
                const aiTime = aiMessage.querySelector(".timestamp");
                handleJSONResponse(data, aiContent, aiTime);
            }
        }

        else {
            showTypingIndicator(false);
        }
    } catch (err) {
        showTypingIndicator(false);
        if (window.avatarSetState) avatarSetState("worried");

        const aiMessage = appendChatMessage("ai", "", new Date());
        const aiContent = aiMessage.querySelector(".content");
        aiContent.textContent = "⚠ Connection error. Is the server running?";
    }

    await loadSessions();
    highlightActive(currentSessionId);
}

// ================= QUICK SEND (welcome screen) =================
function quickSend(text) {
    const input = document.getElementById("message");
    input.value = text;
    sendMessage();
}
function appendChatMessage(role, text, time) {

    const chatBox = document.getElementById("chat-box");

    const wrapper = document.createElement("div");
    wrapper.className = role;

    const content = document.createElement("div");
    content.className = "content";
    content.innerText = text;

    const timestamp = document.createElement("div");
    timestamp.className = "timestamp";
    timestamp.innerText = formatTime(time);

    wrapper.appendChild(content);
    wrapper.appendChild(timestamp);

    chatBox.appendChild(wrapper);
    scrollToBottom();

    return wrapper;
}

// ================= TOOL LABELS =================
function getToolLabel(name) {
    const labels = {
        start_timer: "⏳ Timer",
        get_weather: "🌦 Weather",
        play_music: "🎵 Music",
        file_tool: "📁 Files",
        set_alarm: "⏰ Alarm",
        show_clock: "🕐 Clock",
        add_note: "📝 Notes",
        open_netspeed: "📡 Net Speed"
    };
    return labels[name] || `🛠 ${name}`;
}

// ================= SIDEBAR TOGGLES =================
function toggleSidebar() {
    const sidebar = document.getElementById("left-sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
}

function toggleRightSidebar(forceOpen) {
    const sidebar = document.getElementById("right-sidebar");
    if (!sidebar) return;

    if (typeof forceOpen === "boolean") {
        if (forceOpen) {
            sidebar.classList.remove("collapsed");
        } else {
            sidebar.classList.add("collapsed");
        }
    } else {
        sidebar.classList.toggle("collapsed");
    }
}

// ================= THEME TOGGLE (Day/Night) =================
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById("theme-icon");

    body.classList.toggle("light-mode");

    const isLight = body.classList.contains("light-mode");

    if (icon) {
        icon.innerText = isLight ? "light_mode" : "dark_mode";
    }

    // Persist preference
    localStorage.setItem("anya-theme", isLight ? "light" : "dark");
}

// ================= STREAMING TOGGLE =================
function toggleStreaming(val) {
    let enabled;
    if (typeof val === 'boolean') {
        enabled = val;  // called from settings panel with explicit value
    } else {
        const cb = document.getElementById("stream-toggle");
        enabled = cb ? cb.checked : true;
    }
    localStorage.setItem("anya-streaming", enabled ? "true" : "false");
    // Sync both toggles (header + settings panel)
    const cb1 = document.getElementById("stream-toggle");
    const cb2 = document.getElementById("streaming-toggle");
    if (cb1) cb1.checked = enabled;
    if (cb2) cb2.checked = enabled;
}

function initStreamingToggle() {
    const saved = localStorage.getItem("anya-streaming");
    const enabled = saved !== "false"; // default: ON
    const cb1 = document.getElementById("stream-toggle");
    const cb2 = document.getElementById("streaming-toggle");
    if (cb1) cb1.checked = enabled;
    if (cb2) cb2.checked = enabled;
}

function loadSavedTheme() {
    const saved = localStorage.getItem("anya-theme");
    if (saved === "light") {
        document.body.classList.add("light-mode");
        const icon = document.getElementById("theme-icon");
        if (icon) icon.innerText = "light_mode";
    }
}

// ================= SIDEBAR FOOTER BUTTONS =================
function openPermissions() {
    openSettings();
    showSettingsSection('permissions');
    loadPermissions();
}

async function loadPermissions() {
    const headers = getAuthHeaders();
    const controlsEl = document.getElementById('perm-controls');
    const loggedOutEl = document.getElementById('perm-logged-out');

    if (!headers) {
        if (controlsEl) controlsEl.style.display = 'none';
        if (loggedOutEl) loggedOutEl.style.display = 'block';
        return;
    }

    if (controlsEl) controlsEl.style.display = 'block';
    if (loggedOutEl) loggedOutEl.style.display = 'none';

    try {
        const res = await fetch('http://localhost:5000/api/profile', { headers });
        if (!res.ok) return;
        const profile = await res.json();
        const perms = profile.permissions || {};
        const defaults = {
            canWebSearch: true, canRunCode: true, canCreateFiles: true,
            canSetAlarms: true, canPlayMusic: true, canGetNews: true
        };
        Object.keys(defaults).forEach(key => {
            const el = document.getElementById('perm-' + key);
            if (el) el.checked = perms[key] !== undefined ? perms[key] : defaults[key];
        });
    } catch { }
}

async function savePermission(key, value) {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
        await fetch('http://localhost:5000/api/profile/permissions', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ [key]: value })
        });
    } catch { }
}

// Legacy stub kept for safety
function openSystemPrompt() { openSettings(); showSettingsSection("system-prompt"); }

// ================= MODELS MODAL =================
let currentModelId = localStorage.getItem("anya-active-model") || "llama3:8b";
let lastManualSelectTime = parseInt(localStorage.getItem("anya-last-model-select") || "0") || null;

const MODEL_DATA = {
    "llama3:8b": {
        emoji: "🦙", name: "Llama 3 8B", maker: "Ollama · Local",
        stats: [{ val: "8B", label: "Parameters" }, { val: "128K", label: "Context" }, { val: "Fast", label: "Speed" }],
        caps: ["💬 Chat", "💻 Code", "🔧 Tool use"],
        note: "Best for: general chat, coding help, structured tool responses."
    },
    "llama3.2:3b": {
        emoji: "🦙", name: "Llama 3.2 3B", maker: "Ollama · Local",
        stats: [{ val: "3B", label: "Parameters" }, { val: "128K", label: "Context" }, { val: "Lightning", label: "Speed" }],
        caps: ["💬 Chat", "⚡ Fast", "🔧 Tool use"],
        note: "Extremely fast and lightweight model used for rapid responses."
    },
    "gemini-2.5-flash": {
        emoji: "✨", name: "Gemini 2.5 Flash", maker: "Google · Cloud API",
        stats: [{ val: "N/A", label: "Parameters" }, { val: "1M+", label: "Context" }, { val: "Instant", label: "Speed" }],
        caps: ["💬 Chat", "💻 Code", "🔍 Search", "🧠 Smart"],
        note: "Requires GEMINI_API_KEY in .env. Extremely fast and incredibly intelligent."
    },
    "deepseek/deepseek-r1-0528-qwen3-8b": {
        emoji: "🔬", name: "DeepSeek R1", maker: "LM Studio · Local",
        stats: [{ val: "8B", label: "Parameters" }, { val: "Any", label: "Context" }, { val: "Variable", label: "Speed" }],
        caps: ["💬 Chat", "🧠 Heavy Reasoning", "🔌 Custom"],
        note: "You must manually load DeepSeek R1 and start the Local Server in LM Studio first before chatting."
    },
    "phi-4": {
        emoji: "🔬", name: "Phi-4", maker: "LM Studio · Local",
        stats: [{ val: "14B", label: "Parameters" }, { val: "Any", label: "Context" }, { val: "Variable", label: "Speed" }],
        caps: ["💬 Chat", "🧠 Heavy Reasoning", "🔌 Custom"],
        note: "You must manually load Phi-4 and start the Local Server in LM Studio first before chatting."
    }
};

// Models that support image/file input (vision capability)
const VISION_MODELS = new Set(['llama3:8b', 'llama3.2:3b', 'gemini-2.5-flash']);

function updateAttachForModel(modelId) {
    const hasVision = VISION_MODELS.has(modelId);
    ['attach-img-btn', 'attach-doc-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled        = !hasVision;
        btn.style.opacity   = hasVision ? '' : '0.35';
        btn.style.cursor    = hasVision ? '' : 'not-allowed';
        btn.style.pointerEvents = hasVision ? '' : 'none';
    });
    const imgBtn = document.getElementById('attach-img-btn');
    if (imgBtn) imgBtn.title = hasVision
        ? 'Attach image (vision models: llama3, gemini)'
        : 'This model does not support image/file input';
}

function setActiveModel(id) {
    currentModelId = id;
    localStorage.setItem("anya-active-model", id);
    // Record manual selection time for smart-routing override window (5 min)
    lastManualSelectTime = Date.now();
    localStorage.setItem("anya-last-model-select", lastManualSelectTime);

    // Update active badges in DOM
    document.querySelectorAll(".model-list-active-badge").forEach(b => b.style.display = "none");
    const badge = document.getElementById(`badge-${id.replace(/[:.]/g, '-')}`);
    if (badge) badge.style.display = "inline-block";

    // Refresh detail view if open
    showModelDetail(id);
    // Update file/image upload button state based on vision support
    updateAttachForModel(id);
}

function openModels() {
    const modal = document.getElementById("models-modal");
    if (!modal) return;
    modal.style.display = "flex";
    renderModelsList();
    showModelsListView(); // always start at list
}

function renderModelsList() {
    const container = document.querySelector(".models-list");
    if (!container) return;

    let html = "";
    Object.keys(MODEL_DATA).forEach(id => {
        const m = MODEL_DATA[id];
        const badgeId = `badge-${id.replace(/[:.]/g, '-')}`;
        const isActive = currentModelId === id;

        html += `
            <button class="model-list-item" onclick="showModelDetail('${id}')">
                <div class="model-list-icon">${m.emoji}</div>
                <div class="model-list-info">
                    <div class="model-list-name">${m.name} <span class="model-list-active-badge" id="${badgeId}" style="display:${isActive ? 'inline-block' : 'none'}">● Active</span></div>
                    <div class="model-list-meta">${m.maker}</div>
                </div>
                <span class="material-icons-round" style="color:var(--text-tertiary);font-size:18px;">chevron_right</span>
            </button>
        `;
    });

    container.innerHTML = html;
}

function closeModelsModal(event) {
    if (event && event.target !== document.getElementById("models-modal")) return;
    const modal = document.getElementById("models-modal");
    if (modal) modal.style.display = "none";
}

function showModelsListView() {
    document.getElementById("models-list-view").style.display = "block";
    document.getElementById("models-detail-view").style.display = "none";
}

function showModelDetail(id) {
    const m = MODEL_DATA[id];
    if (!m) return;

    document.getElementById("models-list-view").style.display = "none";
    document.getElementById("models-detail-view").style.display = "block";
    document.getElementById("model-detail-title").textContent = m.name;

    const statsHTML = m.stats.map(s =>
        `<div class="model-stat"><div class="model-stat-val">${s.val}</div><div class="model-stat-label">${s.label}</div></div>`
    ).join("");

    const capsHTML = m.caps.map(c =>
        `<span class="model-cap">${c}</span>`
    ).join("");

    document.getElementById("model-detail-content").innerHTML = `
        <div class="model-card active-model" style="margin-top:0;">
            <div class="model-card-header">
                <div class="model-badge-row">
                    ${currentModelId === id ? '<span class="model-badge active">● Active</span>' : ""}
                    <span class="model-badge local">${m.maker}</span>
                </div>
                <div class="model-name">${m.emoji} ${m.name}</div>
                <div class="model-subtitle">${m.maker}</div>
            </div>
            <div class="model-stats-grid">${statsHTML}</div>
            <div class="model-capabilities">${capsHTML}</div>
            <p class="settings-hint" style="padding:12px 16px;margin:0;">${m.note}</p>
            ${currentModelId !== id ? `<button class="primary-btn" style="width:100%; margin-top:15px; border-radius:8px;" onclick="setActiveModel('${id}')">Use ${m.name}</button>` : ""}
        </div>
    `;
}


function openSettings(section) {
    const modal = document.getElementById("settings-modal");
    if (!modal) return;
    modal.style.display = "flex";

    // Restore voice settings
    if (typeof loadVoices === "function") {
        const savedVoice = localStorage.getItem("anya-tts-voice") || "";
        loadVoices(savedVoice);
    }
    const speed = document.getElementById("tts-speed");
    const speedVal = document.getElementById("speed-val");
    if (speed && speedVal) speedVal.innerText = speed.value + "x";

    // Restore system prompt
    const sysTa = document.getElementById("system-prompt-input");
    if (sysTa) sysTa.value = localStorage.getItem("anya-system-prompt") || "";

    // Sync theme cards
    const isDark = !document.body.classList.contains("light-mode");
    document.getElementById("theme-card-dark")?.classList.toggle("active", isDark);
    document.getElementById("theme-card-light")?.classList.toggle("active", !isDark);

    // Navigate to section if provided
    if (section) showSettingsSection(section);
}

function closeSettings(event) {
    if (event && event.target !== document.getElementById("settings-modal")) return;
    const modal = document.getElementById("settings-modal");
    if (modal) modal.style.display = "none";
}

function showSettingsSection(id, btn) {
    // Hide all panels
    document.querySelectorAll(".settings-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".settings-nav-item").forEach(b => b.classList.remove("active"));
    // Show selected
    const panel = document.getElementById("panel-" + id);
    if (panel) panel.classList.add("active");
    if (btn) btn.classList.add("active");
    else {
        // Find and activate the matching nav button
        document.querySelectorAll(".settings-nav-item").forEach(b => {
            if (b.getAttribute("onclick")?.includes("'" + id + "'")) b.classList.add("active");
        });
    }
}

function saveSystemPrompt() {
    const ta = document.getElementById("system-prompt-input");
    if (!ta) return;
    localStorage.setItem("anya-system-prompt", ta.value.trim());
    const btn = document.querySelector(".settings-btn-primary");
    if (btn) { btn.textContent = "Saved ✓"; setTimeout(() => btn.textContent = "Save Prompt", 1500); }
}

function resetSystemPrompt() {
    const defaultPrompt = "You are Anya, a helpful, witty, and knowledgeable AI assistant. Be concise, friendly, and direct.";
    const ta = document.getElementById("system-prompt-input");
    if (ta) ta.value = defaultPrompt;
    localStorage.setItem("anya-system-prompt", defaultPrompt);
}

function setTheme(mode) {
    if (mode === "light") {
        document.body.classList.add("light-mode");
        localStorage.setItem("anya-theme", "light");
        const icon = document.getElementById("theme-icon");
        if (icon) icon.innerText = "light_mode";
    } else {
        document.body.classList.remove("light-mode");
        localStorage.setItem("anya-theme", "dark");
        const icon = document.getElementById("theme-icon");
        if (icon) icon.innerText = "dark_mode";
    }
    document.getElementById("theme-card-dark")?.classList.toggle("active", mode === "dark");
    document.getElementById("theme-card-light")?.classList.toggle("active", mode === "light");
}

function toggleAIStats(enabled) {
    localStorage.setItem("anya-show-stats", enabled ? "true" : "false");
    // Show/hide existing stats bars immediately
    document.querySelectorAll(".ai-stats-bar").forEach(bar => {
        bar.style.display = enabled ? "flex" : "none";
    });
}


// ================= FILE TOOL HELPERS =================
function getFileIcon(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const icons = {
        py: "🐍", js: "📜", html: "🌐", css: "🎨",
        json: "📋", java: "☕", txt: "📄", md: "📝",
        ts: "📘", cpp: "⚙️", c: "⚙️", xml: "📰",
        sql: "🗃️", sh: "🖥️", yml: "📐", yaml: "📐"
    };
    return icons[ext] || "📁";
}

function getFileLang(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    const langs = {
        py: "python", js: "javascript", html: "html", css: "css",
        json: "json", java: "java", ts: "typescript", md: "markdown",
        cpp: "cpp", c: "c", xml: "xml", sql: "sql",
        sh: "bash", yml: "yaml", yaml: "yaml"
    };
    return langs[ext] || "plaintext";
}
// ================= WELCOME SCREEN =================
function showWelcome(visible) {
    const welcome = document.getElementById("welcome-screen");
    const chatBox = document.getElementById("chat-box");
    if (!welcome) return;

    if (visible) {
        welcome.style.display = "flex";
        chatBox.style.display = "none";
    } else {
        welcome.style.display = "none";
        chatBox.style.display = "flex";
    }
}

// ================= TYPING INDICATOR =================
function showTypingIndicator(visible) {
    const indicator = document.getElementById("typing-indicator");
    if (!indicator) return;
    indicator.style.display = visible ? "flex" : "none";
    if (visible) scrollToBottom();
}

// ================= MINIMIZE =================
// Accepts two calling styles:
//   minimizeTool(toolWindowElement, toolName)   — old tools (timer, weather, etc.)
//   minimizeTool(idString, icon, label)          — new tools (clock, alarm, stopwatch)
function minimizeTool(windowOrId, toolNameOrIcon, label) {
    let el, icon;

    if (typeof windowOrId === "string") {
        // New style: minimizeTool('clock-tool-widget', '🕐', 'Clock')
        el = document.getElementById(windowOrId);
        icon = toolNameOrIcon;   // already an emoji
    } else {
        // Old style: minimizeTool(toolWindowElement, 'start_timer')
        el = windowOrId;
        icon = getToolIcon(toolNameOrIcon);
    }

    if (!el) return;
    el.remove();

    // Icon-only chip (no text) — matches original UI
    const chip = document.createElement("div");
    chip.className = "minimized-icon";
    chip.innerText = icon;
    chip.title = label || toolNameOrIcon || "";

    const toolContainer = document.getElementById("tool-container");
    chip.onclick = () => {
        chip.remove();
        toolContainer.appendChild(el);
    };

    document.getElementById("minimized-tools").appendChild(chip);
}

function getToolIcon(name) {
    if (name === "start_timer") return "⏳";
    if (name === "get_weather") return "🌦";
    if (name === "play_music") return "🎵";
    if (name === "file_tool") return "📁";
    if (name === "set_alarm") return "⏰";
    if (name === "show_clock") return "🕐";
    if (name === "add_note") return "📝";
    if (name === "open_netspeed") return "📡";
    return "🛠";
}

// ================= TOOL HELPERS =================
function clearTools() {
    document.getElementById("tool-container").innerHTML = "";
    document.getElementById("minimized-tools").innerHTML = "";
}

function highlightActive(id) {
    document.querySelectorAll(".session-item").forEach(el => {
        el.classList.remove("active");
        if (el.dataset.id === id) {
            el.classList.add("active");
        }
    });
}

function scrollToBottom() {
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeconds(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h.toString().padStart(2, '0')}:` +
        `${m.toString().padStart(2, '0')}:` +
        `${s.toString().padStart(2, '0')}`;
}

// ================= AUTO-RESIZE TEXTAREA =================
function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

// ================= IMAGE GENERATION =================
function insertImagineCommand() {
    const input = document.getElementById('message');
    if (!input) return;
    if (!input.value.startsWith('/imagine ')) {
        input.value = '/imagine ' + input.value;
    }
    input.focus();
    autoResizeTextarea(input);
}

async function generateImage(prompt) {
    const provider = localStorage.getItem('anya-imggen-provider') || 'pollinations';
    const customUrl = localStorage.getItem('anya-imggen-endpoint') || '';
    if (provider === 'custom' && customUrl) {
        const resp = await fetch(customUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const data = await resp.json();
        return data.url || data.image_url || data.images?.[0];
    }
    // Pollinations AI — direct image URL, no API key needed
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&nologo=true&seed=${Date.now()}`;
}

async function handleImageGen(prompt) {
    showWelcome(false);
    appendChatMessage('user', '/imagine ' + prompt, new Date());
    const chatBox = document.getElementById('chat-box');

    const loadingEl = document.createElement('div');
    loadingEl.className = 'ai';
    loadingEl.innerHTML = `<div class="content" style="display:flex;align-items:center;gap:8px;">
        <span class="material-icons-round" style="font-size:18px;opacity:0.7;animation:spin 1s linear infinite;">autorenew</span>
        Generating image…</div>`;
    chatBox.appendChild(loadingEl);
    scrollToBottom();

    try {
        const imgUrl = await generateImage(prompt);
        loadingEl.innerHTML = `<div class="content" style="padding:4px 0;">
            <img src="${imgUrl}" alt="${prompt}"
                style="max-width:100%;border-radius:10px;display:block;margin-bottom:6px;"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <div style="display:none;color:var(--text-tertiary);font-size:0.8rem;">Image failed to load.</div>
            <div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px;">${prompt}</div>
        </div>`;
    } catch (e) {
        loadingEl.innerHTML = `<div class="content">Image generation failed: ${e.message}</div>`;
    }
    scrollToBottom();
}

// ================= AVATAR PANEL TOGGLE =================
function toggleAvatarPanel(show) {
    const panel = document.getElementById('avatar-panel');
    if (panel) panel.style.display = show ? '' : 'none';
    localStorage.setItem('anya-avatar-visible', show ? 'true' : 'false');
}

// ================= SMART MODEL ROUTING =================
function _buildRoutingBar(routingStatus) {
    if (!routingStatus) return null;
    const bar = document.createElement("div");
    bar.className = "ai-routing-bar";

    if (routingStatus.pipeline && routingStatus.pipeline.length > 1) {
        // Vision pipeline: show multiple model pills
        routingStatus.pipeline.forEach((modelId, idx) => {
            if (idx > 0) {
                const arrow = document.createElement("span");
                arrow.className = "routing-arrow";
                arrow.textContent = "→";
                bar.appendChild(arrow);
            }
            const pill = document.createElement("span");
            pill.className = "routing-pill";
            pill.textContent = _shortModelName(modelId);
            bar.appendChild(pill);
        });
    } else {
        // Single model swap
        const pill = document.createElement("span");
        pill.className = "routing-pill";
        pill.textContent = _shortModelName(routingStatus.model);
        bar.appendChild(pill);
    }

    if (routingStatus.reasonLabel) {
        const reason = document.createElement("span");
        reason.className = "routing-reason";
        reason.textContent = routingStatus.reasonLabel;
        bar.appendChild(reason);
    }
    return bar;
}

function _shortModelName(modelId) {
    if (!modelId) return "?";
    const map = {
        "llama3:8b":    "Llama 3 8B",
        "llama3.2:3b":  "Llama 3.2 3B",
        "gemini-2.5-flash": "Gemini Flash",
        "deepseek/deepseek-r1-0528-qwen3-8b": "DeepSeek R1",
        "phi-4":        "Phi-4"
    };
    return map[modelId] || modelId.split("/").pop();
}

function toggleAutoRouting(enabled) {
    localStorage.setItem("anya-auto-routing", enabled ? "true" : "false");
}

function initGeneralSettings() {
    const smartRouting = document.getElementById("smart-routing-toggle");
    if (smartRouting) smartRouting.checked = localStorage.getItem("anya-auto-routing") !== "false";

    const streaming = document.getElementById("streaming-toggle");
    if (streaming) streaming.checked = localStorage.getItem("anya-streaming") !== "false";

    const avatar = document.getElementById("avatar-toggle");
    if (avatar) avatar.checked = localStorage.getItem("anya-avatar-visible") === "true";

    const showStats = document.getElementById("show-stats-toggle");
    if (showStats) showStats.checked = localStorage.getItem("anya-show-stats") !== "false";

    const canvasMode = document.getElementById("canvas-mode-toggle");
    if (canvasMode) canvasMode.checked = localStorage.getItem("anya-canvas-mode") === "true";
}

// ================= IMAGE GEN SETTINGS =================
function initImgGenSettings() {
    const provider = localStorage.getItem('anya-imggen-provider') || 'pollinations';
    const endpoint = localStorage.getItem('anya-imggen-endpoint') || '';
    const sel = document.getElementById('imggen-provider');
    const inp = document.getElementById('imggen-endpoint');
    const row = document.getElementById('imggen-custom-row');
    if (sel) sel.value = provider;
    if (inp) inp.value = endpoint;
    if (row) row.style.display = provider === 'custom' ? 'flex' : 'none';
}

function saveImgGenSettings() {
    const sel = document.getElementById('imggen-provider');
    const inp = document.getElementById('imggen-endpoint');
    const row = document.getElementById('imggen-custom-row');
    const provider = sel ? sel.value : 'pollinations';
    localStorage.setItem('anya-imggen-provider', provider);
    if (inp) localStorage.setItem('anya-imggen-endpoint', inp.value);
    if (row) row.style.display = provider === 'custom' ? 'flex' : 'none';
}

// ================= REQUEST POINTS MODAL =================
function openRequestPointsModal() {
    const modal = document.getElementById('request-points-modal');
    if (modal) {
        document.getElementById('req-points-amount').value = '';
        document.getElementById('req-points-reason').value = '';
        const msg = document.getElementById('req-points-msg');
        if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
        modal.style.display = 'flex';
    }
}

function closeRequestPointsModal(event) {
    const modal = document.getElementById('request-points-modal');
    if (!modal) return;
    if (event && event.target !== modal) return;
    modal.style.display = 'none';
}

async function submitPointsRequest() {
    const amount = parseInt(document.getElementById('req-points-amount')?.value, 10);
    const reason = document.getElementById('req-points-reason')?.value?.trim() || '';
    const msgEl  = document.getElementById('req-points-msg');

    if (!amount || amount <= 0) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Please enter a valid amount.'; msgEl.style.display = 'block'; }
        return;
    }

    const token = localStorage.getItem('anya_auth_token');
    if (!token) {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'You must be logged in.'; msgEl.style.display = 'block'; }
        return;
    }

    try {
        const res = await fetch('http://localhost:5000/api/user/request-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount, reason })
        });
        const data = await res.json();
        if (!res.ok) {
            if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = data.error || 'Request failed.'; msgEl.style.display = 'block'; }
            return;
        }
        if (msgEl) { msgEl.style.color = '#86efac'; msgEl.textContent = 'Request sent! The admin will review it soon.'; msgEl.style.display = 'block'; }
        setTimeout(() => { document.getElementById('request-points-modal').style.display = 'none'; }, 1800);
    } catch {
        if (msgEl) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Network error. Please try again.'; msgEl.style.display = 'block'; }
    }
}

// ================= REDEEM POINTS =================
async function submitRedeemPoints() {
    const input = document.getElementById('redeem-pts-input');
    const pts   = parseInt(input?.value, 10);

    if (!pts || pts <= 0) {
        if (typeof showToast === 'function') showToast('error', 'Invalid amount', 'Enter how many points to spend.');
        return;
    }

    const token = localStorage.getItem('anya_auth_token');
    if (!token) {
        if (typeof showToast === 'function') showToast('error', 'Not logged in', 'Please log in to redeem points.');
        return;
    }

    try {
        const res  = await fetch('http://localhost:5000/api/user/redeem-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ points: pts })
        });
        const data = await res.json();
        if (!res.ok) {
            if (typeof showToast === 'function') showToast('error', 'Redeem failed', data.error || 'Could not redeem points.');
            return;
        }
        if (input) input.value = '';
        if (typeof showToast === 'function')
            showToast('success', 'Tokens added!', `+${data.tokensGained.toLocaleString()} tokens · ${data.newPoints.toLocaleString()} pts remaining`);
        // Refresh points display
        if (typeof loadProfileExtended === 'function') loadProfileExtended();
    } catch {
        if (typeof showToast === 'function') showToast('error', 'Network error', 'Please try again.');
    }
}

// ================= INIT =================
window.onload = async function () {
    loadSavedTheme();
    initStreamingToggle();
    await loadSessions();
    showWelcome(true);
    voiceInit();
    loadConfig();
    // Init upload buttons based on current model's vision support
    updateAttachForModel(currentModelId);
    // Init General settings panel (smart routing toggle)
    initGeneralSettings();
    // Restore avatar visibility from settings — default OFF
    const avatarVisible = localStorage.getItem('anya-avatar-visible') === 'true';
    const avatarToggle = document.getElementById('avatar-toggle');
    if (avatarToggle) avatarToggle.checked = avatarVisible;
    if (!avatarVisible) {
        const panel = document.getElementById('avatar-panel');
        if (panel) panel.style.display = 'none';
    }
};

// ================= CONFIG LOADER =================
// Fetches runtime config from server (Google Client ID, etc.)
async function loadConfig() {
    try {
        const res = await fetch("http://localhost:5000/config/google");
        const cfg = await res.json();
        if (cfg.clientId) {
            window._googleClientId = cfg.clientId;
            // Initialize Google Identity Services immediately
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.initialize({
                    client_id: cfg.clientId,
                    callback: handleGoogleCredentialResponse
                });
                console.log("[Auth] Google GIS initialized with server-provided Client ID");
            }
        }
    } catch (err) {
        console.warn("[Auth] Could not load config from server:", err.message);
    }
}

// ================= KEYBOARD SHORTCUTS =================
window.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("message");

    textarea.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    textarea.addEventListener("input", function () {
        autoResizeTextarea(this);
    });

    // Escape to clear input
    textarea.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            this.value = "";
            autoResizeTextarea(this);
            this.blur();
        }
    });
});




