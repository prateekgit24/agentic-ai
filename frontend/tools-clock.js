// frontend/tools-clock.js
async function startTimerUIUpdater(displayElement, toggleBtn) {

    const sessionId = currentSessionId;

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`http://localhost:5000/timer/status/${sessionId}`);
            const data = await res.json();

            // Always show the latest remaining time
            displayElement.innerText = formatSeconds(data.remaining || 0);

            // Keep the pause/play button in sync with actual state
            if (toggleBtn) {
                if (data.paused) {
                    toggleBtn.innerText = "▶";
                } else if (data.running) {
                    toggleBtn.innerText = "⏸";
                }
            }

            // Only fire the done notification when actually finished
            if (data.finished) {
                displayElement.innerText = "00:00:00";
                clearInterval(interval);
                showTimerPopup();
                playBeep();
                return;
            }

        } catch (err) {
            displayElement.innerText = "Service Offline";
            clearInterval(interval);
        }
    }, 1000);
}

// File tool helpers
function downloadFile(name) {
    window.open(`http://localhost:5000/file/download/${name}`);
}

function renameFile(name) {
    const newName = prompt("New file name:");
    if (!newName) return;

    sendMessageDirectTool("file_tool", {
        action: "rename",
        fileName: name,
        newName
    });
}

function formatFile(name) {
    sendMessageDirectTool("file_tool", {
        action: "format",
        fileName: name
    });
}

// Weather search helper
function searchWeather(city) {
    if (!city.trim()) return;

    document.getElementById("message").value =
        `What's the weather in ${city}?`;

    sendMessage();
}

function getWeatherBackground(condition = "", isNight = false) {
    if (!condition) return null;

    if (condition.includes("Rain")) return "rain-bg";
    if (condition.includes("Cloud")) return "cloudy-bg";
    if (condition.includes("Clear") && isNight) return "night-bg";
    if (condition.includes("Clear")) return "sunny-bg";

    return null;
}

function getAQIText(aqi) {
    const levels = {
        1: "Good 🟢",
        2: "Fair 🟡",
        3: "Moderate 🟠",
        4: "Poor 🔴",
        5: "Very Poor 🟣"
    };
    return levels[aqi] || "Unknown";
}

// Timer helpers
function showTimerPopup() {

    const popup = document.createElement("div");
    popup.className = "timer-popup";
    popup.innerText = "⏰ Timer Finished!";

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.classList.add("show");
    }, 50);

    setTimeout(() => {
        popup.classList.remove("show");
        setTimeout(() => popup.remove(), 500);
    }, 4000);
}

async function sendTimerAction(action, duration) {
    if (!currentSessionId) return;

    const body = { sessionId: currentSessionId };
    if (duration !== undefined) body.duration = duration;   // only include when starting

    await fetch(`http://localhost:5000/timer/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

function playBeep() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
}

// ================= UTILS =================
function escapeHTML(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
}

// ===============================================================
// ALARM TOOL
// ===============================================================

const alarmManager = {
    alarms: JSON.parse(localStorage.getItem("anya-alarms") || "[]"),
    intervalId: null,

    save() {
        localStorage.setItem("anya-alarms", JSON.stringify(this.alarms));
    },

    add(timeStr, label) {
        const id = Date.now();
        this.alarms.push({ id, time: timeStr, label: label || "Alarm", fired: false });
        this.save();
        return id;
    },

    remove(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        this.save();
    },

    startChecking() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, "0");
            const mm = String(now.getMinutes()).padStart(2, "0");
            const currentTime = `${hh}:${mm}`;

            this.alarms.forEach(alarm => {
                if (!alarm.fired && alarm.time === currentTime) {
                    alarm.fired = true;
                    this.save();
                    triggerAlarm(alarm.label);
                    // Re-render all alarm widgets on the page
                    document.querySelectorAll(".alarm-widget").forEach(w => refreshAlarmList(w));
                }
            });
        }, 10000); // check every 10s
    }
};

// Play alarm chime via Web Audio
function playAlarmChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.25);
            osc.stop(ctx.currentTime + i * 0.25 + 0.6);
        });
    } catch (e) { /* audio blocked */ }
}

function triggerAlarm(label) {
    playAlarmChime();
    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Alarm — " + label, {
            body: "Your alarm is ringing!",
            icon: "favicon.ico"
        });
    } else if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then(p => {
            if (p === "granted") new Notification("⏰ Alarm — " + label);
        });
    }
    // Visual popup
    showAlarmPopup(label);
}

function showAlarmPopup(label) {
    let popup = document.getElementById("alarm-popup");
    if (!popup) {
        popup = document.createElement("div");
        popup.id = "alarm-popup";
        popup.className = "alarm-popup";
        document.body.appendChild(popup);
    }
    popup.innerHTML = `<span class="alarm-popup-icon">⏰</span><div><strong>${label}</strong><br><small>Alarm ringing!</small></div>
        <button onclick="this.parentElement.classList.remove('show')" style="margin-left:12px;background:rgba(255,255,255,0.2);border:none;border-radius:6px;padding:4px 10px;color:#fff;cursor:pointer;">Dismiss</button>`;
    popup.classList.add("show");
    setTimeout(() => popup.classList.remove("show"), 8000);
}

// ---- Build the alarm widget UI ----
function renderAlarmList(container) {
    container.innerHTML = "";
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;

    if (alarmManager.alarms.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-tertiary);font-size:0.8rem;padding:10px 0;">No alarms set</div>`;
        return;
    }

    alarmManager.alarms.forEach(alarm => {
        const row = document.createElement("div");
        row.className = "alarm-row" + (alarm.fired ? " fired" : "");
        row.innerHTML = `
            <div class="alarm-row-left">
                <span class="alarm-time">${alarm.time}</span>
                <span class="alarm-label">${alarm.label}</span>
            </div>
            <div class="alarm-row-right">
                ${alarm.fired ? '<span class="alarm-status-badge">Done</span>' : ''}
                <button class="alarm-delete-btn" title="Delete alarm" data-id="${alarm.id}">✕</button>
            </div>
        `;
        container.appendChild(row);
    });

    container.querySelectorAll(".alarm-delete-btn").forEach(btn => {
        btn.onclick = () => {
            alarmManager.remove(Number(btn.dataset.id));
            renderAlarmList(container);
        };
    });
}

function openAlarmTool(prefillTime, prefillLabel) {
    // Only open one alarm widget at a time
    if (document.getElementById("alarm-tool-widget")) {
        openRightSidebar();
        // If prefill provided, fill in the form
        if (prefillTime) {
            const t = document.getElementById("alarm-time-input");
            const l = document.getElementById("alarm-label-input");
            if (t) t.value = prefillTime;
            if (l && prefillLabel) l.value = prefillLabel;
            addAlarmFromWidget();
        }
        return;
    }

    openRightSidebar();
    alarmManager.startChecking();

    const toolContainer = document.getElementById("tool-container");
    const win = document.createElement("div");
    win.className = "tool-window alarm-widget";
    win.id = "alarm-tool-widget";

    win.innerHTML = `
        <div class="tool-window-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">alarm</span>
                <span class="tool-window-title">Alarm</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn tool-header-btn" title="Minimize" onclick="minimizeTool('alarm-tool-widget','⏰','Alarm')">
                    <span class="material-icons-round" style="font-size:16px;">remove</span>
                </button>
                <button class="icon-btn tool-header-btn" title="Close" onclick="closeTool('alarm-tool-widget')">
                    <span class="material-icons-round" style="font-size:16px;">close</span>
                </button>
            </div>
        </div>

        <!-- Set alarm form -->
        <div class="alarm-form">
            <div class="alarm-form-row">
                <input type="time" id="alarm-time-input" class="alarm-time-picker"
                    value="${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}">
                <input type="text" id="alarm-label-input" class="alarm-label-input" placeholder="Label (optional)" maxlength="30">
            </div>
            <button class="alarm-set-btn" onclick="addAlarmFromWidget()">
                <span class="material-icons-round" style="font-size:16px;">add_alarm</span> Set Alarm
            </button>
        </div>

        <!-- Alarm list -->
        <div class="alarm-list" id="alarm-list-container"></div>
    `;

    toolContainer.appendChild(win);
    renderAlarmList(win.querySelector("#alarm-list-container"));

    // If prefill provided on fresh widget, set time + label then save
    if (prefillTime) {
        const t = win.querySelector("#alarm-time-input");
        const l = win.querySelector("#alarm-label-input");
        if (t) t.value = prefillTime;
        if (l && prefillLabel) l.value = prefillLabel;
        // Small defer to ensure DOM references are settled
        setTimeout(() => addAlarmFromWidget(), 50);
    }
}

function addAlarmFromWidget() {
    const timeInput = document.getElementById("alarm-time-input");
    const labelInput = document.getElementById("alarm-label-input");
    if (!timeInput || !timeInput.value) return;

    alarmManager.add(timeInput.value, labelInput?.value?.trim() || "Alarm");
    if (labelInput) labelInput.value = "";

    const listEl = document.getElementById("alarm-list-container");
    if (listEl) renderAlarmList(listEl);
}

function refreshAlarmList(widget) {
    const listEl = widget.querySelector("#alarm-list-container");
    if (listEl) renderAlarmList(listEl);
}

// Helper: open right sidebar if collapsed
function openRightSidebar() {
    const rs = document.getElementById("right-sidebar");
    if (rs) rs.classList.remove("collapsed");
}

// Helper: close/minimize tool
function closeTool(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}



// Start alarm checker on page load (restore saved alarms)
alarmManager.startChecking();
// Request notification permission early
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}

// ===============================================================
// SEND DIRECT TOOL (for file rename/format etc. — bypasses AI)
// ===============================================================
async function sendMessageDirectTool(toolName, parameters) {
    if (!currentSessionId) {
        await createSession();
    }

    showTypingIndicator(true);

    try {
        const res = await fetch("http://localhost:5000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: `[direct tool: ${toolName}]`,
                sessionId: currentSessionId,
                _directTool: { tool: toolName, parameters }
            })
        });

        const data = await res.json();
        showTypingIndicator(false);

        if (data && data.type === "tool_result") {
            const aiMessage = appendChatMessage("ai", "", new Date());
            const aiContent = aiMessage.querySelector(".content");
            const aiTime = aiMessage.querySelector(".timestamp");
            handleJSONResponse(data, aiContent, aiTime);
        }
    } catch (err) {
        showTypingIndicator(false);
        console.error("Direct tool error:", err);
    }
}

// ===============================================================
// CLOCK TOOL — AI inline response card (local or world city)
// ===============================================================
function renderClockCard(d, container) {
    const isLocal = d.isLocal !== false && (!d.city || d.city === "Local");
    const cityLabel = isLocal ? "Local Time" : d.city;

    container.innerHTML = `
        <div class="clock-card-inline">
            <div class="cci-header">
                <span class="cci-icon">${isLocal ? "🕐" : "🌍"}</span>
                <span class="cci-city">${cityLabel}</span>
            </div>
            <div class="cci-time" id="cci-time-${d.timezone?.replace(/\//g, '-') || 'local'}">${d.time}</div>
            <div class="cci-date">${d.date}</div>
            <div class="cci-tz">${d.offset || ""} · ${d.tzName || d.timezone || ""}</div>
            ${d.note ? `<div class="cci-note">${d.note}</div>` : ""}
        </div>
    `;

    // Live-tick the seconds if local time
    if (isLocal) {
        const timeEl = container.querySelector(".cci-time");
        if (timeEl) {
            const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setInterval(() => {
                timeEl.textContent = new Intl.DateTimeFormat("en-GB", {
                    timeZone: localTz,
                    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
                }).format(new Date());
            }, 1000);
        }
    }
}

// ===============================================================
// CLOCK WIDGET — standalone live clock in tools panel
// Accepts optional cityData from AI show_clock tool result.
// openClockTool()          → local time
// openClockTool(cityData)  → city/world time
// ===============================================================
function openClockTool(cityData) {
    const existing = document.getElementById("clock-tool-widget");

    // If called from sidebar button (no cityData) and already open → just show
    if (!cityData && existing) { openRightSidebar(); return; }

    // If cityData provided, always replace/refresh the widget (even if already open)
    if (existing) existing.remove();

    openRightSidebar();
    const win = document.createElement("div");
    win.className = "tool-window clock-widget";
    win.id = "clock-tool-widget";

    const isLocal = !cityData || !cityData.city || cityData.city === "Local";
    const tz = isLocal
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : (cityData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    const title = isLocal ? "Clock" : (cityData.city || "Clock");

    function getNow(fmt) {
        return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...fmt }).format(new Date());
    }

    const getTime = () => getNow({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const getDate = () => getNow({ weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Compute UTC offset
    const utcDate = new Date(new Date().toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const diffMs = tzDate - utcDate;
    const diffH = Math.floor(Math.abs(diffMs) / 3600000);
    const diffM = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
    const sign = diffMs >= 0 ? "+" : "-";
    const offset = `GMT${sign}${String(diffH).padStart(2, "0")}:${String(diffM).padStart(2, "0")}`;

    win.innerHTML = `
        <div class="tool-window-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">${isLocal ? "schedule" : "public"}</span>
                <span class="tool-window-title">${title}</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn tool-header-btn" title="Minimize"
                    onclick="minimizeTool('clock-tool-widget','🕐','${title}')">
                    <span class="material-icons-round" style="font-size:16px;">remove</span>
                </button>
                <button class="icon-btn tool-header-btn" title="Close"
                    onclick="closeTool('clock-tool-widget')">
                    <span class="material-icons-round" style="font-size:16px;">close</span>
                </button>
            </div>
        </div>
        <div class="clock-body">
            <div class="clock-display clock-time-el">${getTime()}</div>
            <div class="clock-date clock-date-el">${getDate()}</div>
            <div class="clock-tz">${offset} · ${tz}</div>
        </div>
    `;

    document.getElementById("tool-container").appendChild(win);

    // Use widget-scoped selectors so multiple clocks don't clobber each other
    const timeEl = win.querySelector(".clock-time-el");
    const dateEl = win.querySelector(".clock-date-el");

    const interval = setInterval(() => {
        if (!document.getElementById("clock-tool-widget")) { clearInterval(interval); return; }
        timeEl.textContent = getTime();
        dateEl.textContent = getDate();
    }, 1000);
}


// ===============================================================
// STOPWATCH WIDGET
// ===============================================================
function openStopwatchTool(autoStart) {
    const existing = document.getElementById("stopwatch-tool-widget");
    if (existing) { openRightSidebar(); return; }

    openRightSidebar();
    const win = document.createElement("div");
    win.className = "tool-window stopwatch-widget";
    win.id = "stopwatch-tool-widget";

    win.innerHTML = `
        <div class="tool-window-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">timer</span>
                <span class="tool-window-title">Stopwatch</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn tool-header-btn" title="Minimize"
                    onclick="minimizeTool('stopwatch-tool-widget','⏱','Stopwatch')">
                    <span class="material-icons-round" style="font-size:16px;">remove</span>
                </button>
                <button class="icon-btn tool-header-btn" title="Close"
                    onclick="closeTool('stopwatch-tool-widget')">
                    <span class="material-icons-round" style="font-size:16px;">close</span>
                </button>
            </div>
        </div>
        <div class="stopwatch-body">
            <div class="stopwatch-display" id="sw-display">00:00:00<span class="sw-cs">.00</span></div>
            <div class="stopwatch-controls">
                <button class="sw-btn sw-start" id="sw-start-btn">▶ Start</button>
                <button class="sw-btn sw-lap" id="sw-lap-btn" disabled>⚑ Lap</button>
                <button class="sw-btn sw-reset" id="sw-reset-btn" disabled>↺ Reset</button>
            </div>
            <div class="lap-list" id="sw-lap-list"></div>
        </div>
    `;

    document.getElementById("tool-container").appendChild(win);

    // Stopwatch state
    let elapsed = 0;
    let startTime = null;
    let running = false;
    let interval = null;
    let lapCount = 0;
    let lapStart = 0;

    const display = win.querySelector("#sw-display");
    const startBtn = win.querySelector("#sw-start-btn");
    const lapBtn = win.querySelector("#sw-lap-btn");
    const resetBtn = win.querySelector("#sw-reset-btn");
    const lapList = win.querySelector("#sw-lap-list");

    function formatSW(ms) {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}<span class="sw-cs">.${String(cs).padStart(2, "0")}</span>`;
    }

    function tick() {
        elapsed = Date.now() - startTime;
        display.innerHTML = formatSW(elapsed);
    }

    startBtn.onclick = startOrPause;

    // Auto-start when triggered by AI
    if (autoStart) {
        setTimeout(startOrPause, 80);
    }

    function startOrPause() {
        if (!running) {
            startTime = Date.now() - elapsed;
            interval = setInterval(tick, 30);
            running = true;
            startBtn.textContent = "⏸ Pause";
            lapBtn.disabled = false;
            resetBtn.disabled = false;
            lapStart = elapsed;
        } else {
            clearInterval(interval);
            running = false;
            startBtn.textContent = "▶ Resume";
        }
    }

    lapBtn.onclick = () => {
        if (!running) return;
        lapCount++;
        const lapTime = elapsed - lapStart;
        lapStart = elapsed;

        const row = document.createElement("div");
        row.className = "lap-item";
        row.innerHTML = `
            <span class="lap-num">Lap ${lapCount}</span>
            <span class="lap-split">${formatSW(lapTime).replace(/<[^>]+>/g, "")}</span>
            <span class="lap-total">${formatSW(elapsed).replace(/<[^>]+>/g, "")}</span>
        `;
        lapList.prepend(row);
    };

    resetBtn.onclick = () => {
        clearInterval(interval);
        running = false;
        elapsed = 0;
        lapCount = 0;
        lapStart = 0;
        startTime = null;
        display.innerHTML = `00:00:00<span class="sw-cs">.00</span>`;
        startBtn.textContent = "▶ Start";
        lapBtn.disabled = true;
        resetBtn.disabled = true;
        lapList.innerHTML = "";
    };
}

// ===============================================================
// NET SPEED WIDGET
// ===============================================================
const _nsHistory = [];

function openNetSpeedTool() {
    openRightSidebar();
    if (document.getElementById("netspeed-tool-widget")) return;

    const win = document.createElement("div");
    win.className = "tool-window netspeed-widget";
    win.id = "netspeed-tool-widget";
    win.innerHTML = `
        <div class="tool-window-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">speed</span>
                <span class="tool-window-title">Net Speed</span>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn tool-header-btn" title="Minimize" onclick="minimizeTool('netspeed-tool-widget','\ud83d\udce1','Net Speed')">
                    <span class="material-icons-round" style="font-size:16px;">remove</span>
                </button>
                <button class="icon-btn tool-header-btn" title="Close" onclick="closeTool('netspeed-tool-widget')">
                    <span class="material-icons-round" style="font-size:16px;">close</span>
                </button>
            </div>
        </div>
        <div class="netspeed-body">
            <div class="ns-status" id="ns-status">Testing…</div>
            <div class="ns-speed" id="ns-speed">—</div>
            <div class="ns-unit">Mbps download</div>
            <div class="ns-meta" id="ns-meta"></div>
            <div class="ns-history" id="ns-history"></div>
            <button class="ns-test-btn" id="ns-test-btn" onclick="runSpeedTest()">\u27f3 Test Again</button>
        </div>
    `;
    document.getElementById("tool-container").appendChild(win);

    // Connection info from browser API
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        win.querySelector("#ns-meta").textContent = `Type: ${conn.effectiveType?.toUpperCase() || "?"} · Est. ${conn.downlink || "?"}Mbps`;
    }
    runSpeedTest();
}

async function runSpeedTest() {
    const statusEl = document.getElementById("ns-status");
    const speedEl = document.getElementById("ns-speed");
    const testBtn = document.getElementById("ns-test-btn");
    if (!statusEl) return;

    statusEl.textContent = "Testing…";
    speedEl.textContent = "—";
    if (testBtn) testBtn.disabled = true;

    // Try probes in order — first that works wins
    const probes = [
        // Cloudflare speed test — best CORS support, adjustable size
        "https://speed.cloudflare.com/__down?bytes=2000000",
        // Fallback: httpbin
        "https://httpbin.org/bytes/2000000",
        // Fallback: Wikimedia large image
        "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg"
    ];

    let succeeded = false;

    for (const probe of probes) {
        try {
            const t0 = performance.now();
            const resp = await fetch(probe + (probe.includes("?") ? "&" : "?") + "nc=" + Date.now(), { cache: "no-store" });
            if (!resp.ok) continue;

            // Download the full body — THIS is what measures actual bandwidth
            const buffer = await resp.arrayBuffer();
            const elapsed = (performance.now() - t0) / 1000;   // seconds
            const bytes = buffer.byteLength;

            if (bytes < 100_000 || elapsed < 0.01) continue;   // sanity check

            const mbps = ((bytes * 8) / elapsed / 1_000_000).toFixed(2);
            speedEl.textContent = mbps;
            statusEl.textContent = "Download speed";

            _nsHistory.unshift({ mbps: +mbps, time: new Date().toLocaleTimeString() });
            if (_nsHistory.length > 5) _nsHistory.pop();

            const histEl = document.getElementById("ns-history");
            if (histEl) {
                histEl.innerHTML = _nsHistory.map((r, i) =>
                    `<div class="ns-hist-row${i === 0 ? " ns-hist-latest" : ""}">
                        <span>${r.time}</span><span>${r.mbps} Mbps</span>
                    </div>`).join("");
            }

            succeeded = true;
            break;

        } catch (_) {
            continue;
        }
    }

    if (!succeeded) {
        statusEl.textContent = "Test failed";
        speedEl.textContent = "✗";
    }

    if (testBtn) testBtn.disabled = false;
}
