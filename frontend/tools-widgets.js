// frontend/tools-widgets.js

// ================= HANDLE JSON RESPONSE =================
function handleJSONResponse(data, aiContent, aiTime) {

    if (!data) {
        if (aiContent) aiContent.textContent = "Error processing response.";
        if (aiTime) aiTime.textContent = formatTime(new Date());
        return;
    }

    // Helpers — safe even when aiContent/aiTime is null (tool_message already filled bubble)
    const setText = (msg) => { if (aiContent) aiContent.textContent = msg; };
    const setTime = () => { if (aiTime) aiTime.textContent = formatTime(new Date()); };

    // TOOL EXECUTION
    if (data.type === "tool_result") {

        // If the LLM included a conversational message, it was already injected by caller.
        // Only set the fallback summary when no tool_message was provided.
        const hasMsg = !!data.tool_message;

        // Alarm card
        if (data.ui === "alarm-card" && data.data) {
            if (!hasMsg) setText(`⏰ Alarm set for ${data.data.time} — ${data.data.label}`);
            setTime();
            openAlarmTool(data.data.time, data.data.label);
            return;
        }

        // Clock card
        if (data.ui === "clock-card" && data.data) {
            const d = data.data;
            const cityLabel = (!d.city || d.city === "Local") ? "Local Time" : d.city;
            if (!hasMsg) setText(`🕐 ${cityLabel}: ${d.time}  (${d.offset || ""})`);
            setTime();
            openClockTool(d);
            return;
        }

        // Stopwatch card
        if (data.ui === "stopwatch-card") {
            if (!hasMsg) setText("⏱ Stopwatch started in the tools panel.");
            setTime();
            openStopwatchTool(true);
            return;
        }

        // Net speed card
        if (data.ui === "netspeed-card") {
            if (!hasMsg) setText("📡 Opening Net Speed test…");
            setTime();
            openNetSpeedTool();
            return;
        }

        // Notes card
        if (data.ui === "notes-card" && data.data) {
            const n = data.data;
            if (!n.error) {
                notesStore.add(n.text, n.type, n.id);
                const typeEmoji = { todo: "✅", reminder: "🔔", phone: "📞", note: "📝" }[n.type] || "📝";
                if (!hasMsg) setText(`${typeEmoji} Saved: "${n.text}"`);
                openNotesTool();
            } else {
                if (!hasMsg) setText("❌ Couldn't save note.");
            }
            setTime();
            return;
        }

        // Search card
        if (data.ui === "search-card" && data.data) {
            const d = data.data;
            if (!hasMsg) {
                if (d.results && d.results.length > 0) {
                    setText(`🔍 Found ${d.results.length} results for "${d.query}"`);
                } else {
                    setText(`🔍 No instant results — opening Google for "${d.query}"`);
                }
            }
            setTime();
            openSearchResults(d);
            return;
        }

        // Code result card
        if (data.ui === "code-result-card" && data.data) {
            const d = data.data;
            const status = d.exit_code === 0 ? "✅ Ran successfully" : "❌ Error";
            if (!hasMsg) setText(`💻 ${status} (${d.duration_ms}ms)`);
            setTime();
            openCodeResult(d);
            return;
        }

        // Unit converter card
        if (data.ui === "unit-converter-card" && data.data) {
            const d = data.data;
            if (!hasMsg) setText(`📐 ${d.value} ${d.from} = ${d.result} ${d.to}`);
            setTime();
            openUnitConverter(d);
            return;
        }

        // News feed card
        if (data.ui === "news-card" && data.data) {
            const d = data.data;
            if (!hasMsg) setText(`📰 ${d.articles.length} articles — ${d.categoryLabel}`);
            setTime();
            openNewsFeed(d);
            return;
        }

        // File manager card
        if (data.ui === "file-manager-card" && data.data) {
            const d = data.data;
            if (!hasMsg) setText(`📁 ${d.total} files in workspace`);
            setTime();
            openFileManager(d);
            return;
        }

        if (!hasMsg) setText(`🔧 Used ${data.tool}`);
        setTime();
        renderToolUI(data);
        return;
    }


    // NORMAL CHAT
    if (data.type === "chat") {
        const text = data.message || "";

        // Handle <think>…</think> blocks from reasoning models (DeepSeek-R1 etc.)
        if (text.includes('<think>') && aiContent) {
            const aiBubble = aiContent.closest('.ai') || aiContent.parentElement;
            renderWithThinking(text, aiBubble, aiContent);
        } else {
            if (aiContent) aiContent.textContent = text;
        }

        setTime();

        // Canvas mode: attach preview button if response is HTML
        if (aiContent) maybeAttachPreviewButton(text, aiContent.closest('.ai') || aiContent.parentElement);

        // TTS — speak cleaned text
        if (aiContent) {
            const cleanForSpeech = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            speakResponse(cleanForSpeech, aiContent.closest(".ai"));
        }

        // Sync usage stats if returned
        if (data.usage) {
            const u = data.usage;
            const usedEl = document.getElementById('stat-tokens-used');
            const leftEl = document.getElementById('stat-tokens-left');
            if (usedEl) usedEl.textContent = u.tokensUsed ? u.tokensUsed.toLocaleString() : '—';
            if (leftEl) leftEl.textContent = u.tokensLeft !== undefined ? u.tokensLeft.toLocaleString() : '—';
        }

        // Render performance stats bar if enabled
        if (data.stats && aiContent && localStorage.getItem("anya-show-stats") !== "false") {
            const s = data.stats;
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
            const aiBubble = aiContent.closest(".ai");
            if (aiBubble) aiBubble.appendChild(statsBar);
        }
        return;
    }


    setText("Unknown response.");
    setTime();
}

// ================= THINKING BLOCK HELPERS =================

function createThinkingBlock() {
    const details = document.createElement("details");
    details.className = "thinking-block";
    const summary = document.createElement("summary");
    summary.className = "thinking-summary";
    summary.innerHTML = `<span class="thinking-spinner"></span>Thinking\u2026`;
    const pre = document.createElement("pre");
    pre.className = "thinking-content";
    details.appendChild(summary);
    details.appendChild(pre);
    return details;
}

// Renders `text` into `aiMessage`/`aiContent`, extracting <think>…</think> into a collapsible box.
function renderWithThinking(text, aiMessage, aiContent) {
    const thStart = text.indexOf('<think>');
    const thEnd   = text.indexOf('</think>');

    if (thStart === -1) {
        aiContent.textContent = text;
        return;
    }

    // Get or create thinking block element (inserted before content div)
    let thinkEl = aiMessage.querySelector('.thinking-block');
    if (!thinkEl) {
        thinkEl = createThinkingBlock();
        aiMessage.insertBefore(thinkEl, aiContent);
    }

    const beforeThink = text.slice(0, thStart).trim();

    if (thEnd === -1) {
        // Still streaming inside <think> — show live thinking text
        thinkEl.querySelector('.thinking-content').textContent = text.slice(thStart + 7);
        aiContent.textContent = beforeThink;
        return;
    }

    // <think>…</think> complete — finalize block
    const thinkContent = text.slice(thStart + 7, thEnd).trim();
    const afterThink   = text.slice(thEnd + 8).trim();
    const wordCount    = thinkContent.split(/\s+/).filter(Boolean).length;

    thinkEl.querySelector('.thinking-summary').innerHTML =
        `💭 <span>Reasoning</span><span class="thinking-wc">${wordCount} words</span>`;
    thinkEl.querySelector('.thinking-content').textContent = thinkContent;

    aiContent.textContent = beforeThink ? beforeThink + '\n' + afterThink : afterThink;
}

// ================= CANVAS MODE / HTML PREVIEW =================

function toggleCanvasMode(enabled) {
    localStorage.setItem("anya-canvas-mode", enabled ? "true" : "false");
    const toggle = document.getElementById("canvas-mode-toggle");
    if (toggle) toggle.checked = enabled;
}

function initCanvasMode() {
    const enabled = localStorage.getItem("anya-canvas-mode") === "true";
    const toggle = document.getElementById("canvas-mode-toggle");
    if (toggle) toggle.checked = enabled;
}

const HTML_DETECT = /<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i;

function maybeAttachPreviewButton(text, bubbleEl) {
    if (localStorage.getItem("anya-canvas-mode") !== "true") return;
    if (!text || !bubbleEl) return;
    if (!HTML_DETECT.test(text)) return;
    if (bubbleEl.querySelector('.preview-html-btn')) return; // already added

    const btn = document.createElement("button");
    btn.className = "preview-html-btn";
    btn.innerHTML = `<span class="material-icons-round" style="font-size:15px;vertical-align:middle;">open_in_new</span> Preview`;
    btn.onclick = () => openHTMLPreview(text);
    bubbleEl.appendChild(btn);
}

function openHTMLPreview(html, title) {
    const existing = document.querySelector('[data-tool="html_preview"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "html_preview";
    toolWindow.style.cssText = "width:100%;max-width:100%;";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const titleEl = document.createElement("span");
    titleEl.innerText = "🖥 " + (title || "HTML Preview");
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const fullBtn = document.createElement("button");
    fullBtn.title = "Open in new tab";
    fullBtn.innerHTML = `<span class="material-icons-round" style="font-size:14px;">open_in_new</span>`;
    fullBtn.style.cssText = "background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:2px 6px;";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(fullBtn);
    controls.appendChild(closeBtn);
    header.appendChild(titleEl);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    // Sandboxed iframe
    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts";
    iframe.srcdoc = html;
    iframe.style.cssText = "width:100%;height:420px;border:none;border-radius:0 0 8px 8px;background:#fff;display:block;";
    toolWindow.appendChild(iframe);

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "🖥", "html_preview");
    closeBtn.onclick = () => toolWindow.remove();
    fullBtn.onclick = () => {
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
    };

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}

// ================= TOOL RENDERING =================
function renderToolUI(toolData) {

    const container = document.getElementById("tool-container");

    // Remove existing same tool
    const existing = document.querySelector(`[data-tool="${toolData.tool}"]`);
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = toolData.tool;

    // ================= HEADER =================
    const header = document.createElement("div");
    header.className = "tool-window-header";

    const title = document.createElement("span");
    title.innerText = getToolLabel(toolData.tool);

    const controls = document.createElement("div");

    // MINIMIZE BUTTON
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";

    // CLOSE BUTTON
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";

    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);

    toolWindow.appendChild(header);

    // ================= TIMER =================
    if (toolData.tool === "start_timer" && toolData.data) {

        const d = toolData.data;
        const hasAIDuration = !!d.duration;

        // Parse initial HH MM SS from AI duration (seconds) or default 0
        let totalSecs = hasAIDuration ? parseInt(d.duration) : 0;
        let hh = Math.floor(totalSecs / 3600);
        let mm = Math.floor((totalSecs % 3600) / 60);
        let ss = totalSecs % 60;

        const pad = v => String(v).padStart(2, "0");

        // Arrow spinner row (shown only when idle / setting manually)
        const setterRow = document.createElement("div");
        setterRow.className = "timer-setter-row";
        setterRow.innerHTML = `
            <div class="timer-unit">
                <button class="timer-arrow-btn" data-unit="h" data-dir="1">▲</button>
                <span class="timer-unit-val" id="td-h">${pad(hh)}</span>
                <button class="timer-arrow-btn" data-unit="h" data-dir="-1">▼</button>
                <div class="timer-unit-lbl">HH</div>
            </div>
            <div class="timer-sep">:</div>
            <div class="timer-unit">
                <button class="timer-arrow-btn" data-unit="m" data-dir="1">▲</button>
                <span class="timer-unit-val" id="td-m">${pad(mm)}</span>
                <button class="timer-arrow-btn" data-unit="m" data-dir="-1">▼</button>
                <div class="timer-unit-lbl">MM</div>
            </div>
            <div class="timer-sep">:</div>
            <div class="timer-unit">
                <button class="timer-arrow-btn" data-unit="s" data-dir="1">▲</button>
                <span class="timer-unit-val" id="td-s">${pad(ss)}</span>
                <button class="timer-arrow-btn" data-unit="s" data-dir="-1">▼</button>
                <div class="timer-unit-lbl">SS</div>
            </div>
        `;

        // Countdown display (shown while running)
        const display = document.createElement("div");
        display.className = "timer-display";
        display.style.display = "none";
        display.innerText = formatSeconds(totalSecs);

        // Arrow interactions
        setterRow.addEventListener("click", e => {
            const btn = e.target.closest(".timer-arrow-btn");
            if (!btn) return;
            const unit = btn.dataset.unit;
            const dir = parseInt(btn.dataset.dir);
            if (unit === "h") hh = (hh + dir + 100) % 100;
            if (unit === "m") mm = (mm + dir + 60) % 60;
            if (unit === "s") ss = (ss + dir + 60) % 60;
            toolWindow.querySelector("#td-h").textContent = pad(hh);
            toolWindow.querySelector("#td-m").textContent = pad(mm);
            toolWindow.querySelector("#td-s").textContent = pad(ss);
        });

        // Controls
        const timerControls = document.createElement("div");
        timerControls.style.cssText = "margin-top:10px;display:flex;gap:8px;";

        const startBtn = document.createElement("button");
        startBtn.innerText = "▶ Start";
        startBtn.style.cssText = "font-size:13px;padding:6px 14px;";

        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = "⏸";
        toggleBtn.style.cssText = "font-size:14px;padding:6px 12px;display:none;";

        const resetBtn = document.createElement("button");
        resetBtn.innerText = "🔁";
        resetBtn.style.cssText = "font-size:14px;padding:6px 12px;";

        timerControls.appendChild(startBtn);
        timerControls.appendChild(toggleBtn);
        timerControls.appendChild(resetBtn);

        toolWindow.appendChild(setterRow);
        toolWindow.appendChild(display);
        toolWindow.appendChild(timerControls);

        let paused = false;
        let isRunning = false;

        async function beginTimer() {
            const userSecs = hh * 3600 + mm * 60 + ss;
            if (userSecs === 0) return;          // nothing set
            // Switch view
            setterRow.style.display = "none";
            display.style.display = "";
            display.innerText = formatSeconds(userSecs);
            startBtn.style.display = "none";
            toggleBtn.style.display = "";
            isRunning = true;
            // Tell the server to start with user-set duration
            await sendTimerAction("start", userSecs);
            startTimerUIUpdater(display, toggleBtn);
        }

        // If AI gave a duration, start immediately
        if (hasAIDuration) {
            beginTimer();
        }

        startBtn.onclick = beginTimer;

        toggleBtn.onclick = async () => {
            if (!paused) {
                await sendTimerAction("pause");
                toggleBtn.innerText = "▶";
                paused = true;
            } else {
                await sendTimerAction("resume");
                toggleBtn.innerText = "⏸";
                paused = false;
            }
        };

        resetBtn.onclick = async () => {
            await sendTimerAction("reset");
            display.style.display = "none";
            setterRow.style.display = "";
            startBtn.style.display = "";
            toggleBtn.style.display = "none";
            paused = false;
            isRunning = false;
            hh = mm = ss = 0;
            toolWindow.querySelector("#td-h").textContent = "00";
            toolWindow.querySelector("#td-m").textContent = "00";
            toolWindow.querySelector("#td-s").textContent = "00";
        };
    }

    // ================= WEATHER =================
    if (toolData.tool === "get_weather" && toolData.data) {

        const d = toolData.data;

        const bg = getWeatherBackground(d.condition || "", d.isNight || false);
        if (bg) toolWindow.classList.add(bg);

        const content = document.createElement("div");

        content.innerHTML = `
            <h2 style="margin-bottom:6px;">${d.location || ""}</h2>
            <div class="weather-main">
                <img src="https://openweathermap.org/img/wn/${d.icon || "01d"}@2x.png"
                     class="weather-icon"/>
                <div>
                    <div class="weather-temp">${d.temperature ?? ""}°C</div>
                    <div class="weather-desc">${d.description || ""}</div>
                </div>
            </div>
            <div class="weather-extra">
                <div>Min: ${d.minTemp ?? ""}°C</div>
                <div>Max: ${d.maxTemp ?? ""}°C</div>
                <div>Humidity: ${d.humidity ?? ""}%</div>
                <div>Pressure: ${d.pressure ?? ""} hPa</div>
                <div>Wind: ${d.wind ?? ""} m/s</div>
                <div>AQI: ${getAQIText(d.aqi)}</div>
            </div>
            <div class="weather-search">
                <input type="text" placeholder="Search city..."
                 onkeydown="if(event.key==='Enter'){ searchWeather(this.value) }">
            </div>
        `;

        toolWindow.appendChild(content);
    }

    // ================= MUSIC PLAYER =================
    if (toolData.tool === "play_music") {

        const d = toolData.data;

        const player = document.createElement("div");
        player.innerHTML = `
            <h3 style="margin-bottom:4px;">🎵 ${d.title}</h3>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:10px;">${d.channel}</p>
            <iframe
                width="100%"
                height="200"
                src="https://www.youtube-nocookie.com/embed/${d.videoId}?autoplay=1&rel=0"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen
                style="border-radius:8px;">
            </iframe>
        `;

        toolWindow.appendChild(player);
    }

    // ================= FILE TOOL =================
    if (toolData.tool === "file_tool") {

        const d = toolData.data;
        const content = document.createElement("div");

        // File name header with icon and action badge
        const fileHeader = document.createElement("div");
        fileHeader.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:10px;";

        const fileIcon = document.createElement("div");
        fileIcon.style.cssText = "width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--bg-surface-hover);border-radius:8px;font-size:18px;flex-shrink:0;";
        fileIcon.innerText = getFileIcon(d.fileName || "");

        const fileInfo = document.createElement("div");
        fileInfo.style.cssText = "flex:1;min-width:0;";

        const fileName = document.createElement("div");
        fileName.style.cssText = "font-weight:600;font-size:0.95rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        fileName.innerText = d.fileName || "Untitled";

        const actionBadge = document.createElement("span");
        actionBadge.style.cssText = "display:inline-block;font-size:0.72rem;padding:2px 8px;border-radius:99px;margin-top:2px;font-weight:500;";

        const actionColors = {
            created: "background:rgba(52,211,153,0.15);color:#34d399",
            edited: "background:rgba(99,130,255,0.15);color:#6382ff",
            read: "background:rgba(167,107,255,0.15);color:#a76bff",
            deleted: "background:rgba(248,113,113,0.15);color:#f87171",
            formatted: "background:rgba(61,214,200,0.15);color:#3dd6c8",
            renamed: "background:rgba(250,204,21,0.15);color:#facc15"
        };
        actionBadge.style.cssText += actionColors[d.action] || "background:var(--bg-surface);color:var(--text-secondary)";
        actionBadge.innerText = (d.action || "file").toUpperCase();

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(actionBadge);
        fileHeader.appendChild(fileIcon);
        fileHeader.appendChild(fileInfo);
        content.appendChild(fileHeader);

        // Content preview with syntax highlighting
        if (d.content) {
            const lang = getFileLang(d.fileName || "");
            const previewWrapper = document.createElement("div");
            previewWrapper.style.cssText = "position:relative;margin:8px 0;";

            const pre = document.createElement("pre");
            pre.style.cssText = "max-height:132px;overflow:auto;border-radius:8px;font-size:0.82rem;margin:0;padding:12px;background:rgba(0,0,0,0.3);line-height:1.5;";

            const codeEl = document.createElement("code");
            codeEl.className = `language-${lang}`;
            codeEl.textContent = d.content;
            codeEl.style.cssText = "white-space:pre;tab-size:4;";

            pre.appendChild(codeEl);
            previewWrapper.appendChild(pre);
            content.appendChild(previewWrapper);

            // Highlight this specific element after DOM insertion
            setTimeout(() => {
                if (Prism && Prism.highlightElement) {
                    Prism.highlightElement(codeEl);
                }
            }, 100);
        }

        // Action buttons
        if (d.fileName) {
            const fileControls = document.createElement("div");
            fileControls.style.cssText = "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;";
            fileControls.innerHTML = `
                <button onclick="downloadFile('${d.fileName}')">⬇ Download</button>
                <button onclick="renameFile('${d.fileName}')">✏ Rename</button>
                <button onclick="formatFile('${d.fileName}')">🧹 Format</button>
            `;
            content.appendChild(fileControls);
        }

        toolWindow.appendChild(content);
    }

    // ================= FILE TREE =================
    if (toolData.ui === "file-tree" && toolData.data && toolData.data.files) {

        const fileList = document.createElement("div");
        fileList.style.cssText = "margin-top:8px;display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto;";

        toolData.data.files.forEach(file => {
            const item = document.createElement("div");
            item.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background 0.15s;border:1px solid var(--border-subtle);";
            item.onmouseenter = () => item.style.background = "var(--bg-surface-hover)";
            item.onmouseleave = () => item.style.background = "transparent";

            const icon = document.createElement("span");
            icon.style.cssText = "font-size:16px;flex-shrink:0;";
            icon.innerText = getFileIcon(file);

            const name = document.createElement("span");
            name.style.cssText = "font-size:0.85rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            name.innerText = file;

            const readBtn = document.createElement("span");
            readBtn.style.cssText = "margin-left:auto;font-size:0.72rem;color:var(--accent-blue);flex-shrink:0;";
            readBtn.innerText = "Open →";

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(readBtn);

            item.onclick = () => {
                const input = document.getElementById("message");
                input.value = `Read file ${file}`;
                sendMessage();
            };

            fileList.appendChild(item);
        });

        toolWindow.appendChild(fileList);

        // Also update the sidebar file tree
        const sidebarTree = document.getElementById("file-tree");
        sidebarTree.innerHTML = "";
        toolData.data.files.forEach(file => {
            const sItem = document.createElement("div");
            sItem.innerText = `${getFileIcon(file)} ${file}`;
            sItem.onclick = () => {
                const input = document.getElementById("message");
                input.value = `Read file ${file}`;
                sendMessage();
            };
            sidebarTree.appendChild(sItem);
        });
    }

    container.appendChild(toolWindow);

    // ================= BUTTON LOGIC =================
    minimizeBtn.onclick = () => minimizeTool(toolWindow, toolData.tool);

    closeBtn.onclick = () => {
        toolWindow.remove();
    };

    // Ensure the right sidebar is visible
    const rightSidebar = document.getElementById("right-sidebar");
    if (rightSidebar.classList.contains("collapsed")) {
        rightSidebar.classList.remove("collapsed");
    }
}

// ================= WEB SEARCH WIDGET =================
function openSearchResults(data) {
    const existing = document.querySelector('[data-tool="web_search"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "web_search";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const title = document.createElement("span");
    title.innerText = "🔍 " + (data.query || "Search");
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "padding:4px 0;";

    if (data.results && data.results.length > 0) {
        data.results.forEach(r => {
            const item = document.createElement("div");
            item.className = "search-result-item";
            item.innerHTML = `
                <div class="sr-title">${r.title}</div>
                <div class="sr-snippet">${r.snippet}</div>
                <a class="sr-url" href="${r.url}" target="_blank" rel="noopener">${r.url}</a>
            `;
            body.appendChild(item);
        });
    } else {
        const msg = document.createElement("div");
        msg.style.cssText = "padding:10px 4px;color:var(--text-secondary);font-size:0.85rem;";
        msg.innerText = "No instant results found.";
        body.appendChild(msg);
    }

    // Google fallback button
    const googleBtn = document.createElement("a");
    googleBtn.href = data.fallback || `https://www.google.com/search?q=${encodeURIComponent(data.query || "")}`;
    googleBtn.target = "_blank";
    googleBtn.rel = "noopener";
    googleBtn.className = "sr-google-btn";
    googleBtn.innerText = "Open in Google →";
    body.appendChild(googleBtn);

    toolWindow.appendChild(body);

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "🔍", "web_search");
    closeBtn.onclick = () => toolWindow.remove();

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}

// ================= CODE RUNNER WIDGET =================
function openCodeResult(data) {
    const existing = document.querySelector('[data-tool="run_code"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "run_code";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const title = document.createElement("span");
    title.innerText = data.exit_code === 0 ? "💻 Code Result" : "💻 Code Error";
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    // Stats bar
    const stats = document.createElement("div");
    stats.className = "cr-stats";
    stats.innerHTML = `
        <span class="cr-badge ${data.exit_code === 0 ? "cr-ok" : "cr-err"}">${data.exit_code === 0 ? "✓ Success" : "✗ Error"}</span>
        <span class="cr-time">⏱ ${data.duration_ms}ms</span>
        <span class="cr-lang">Python</span>
    `;
    toolWindow.appendChild(stats);

    // Code block
    if (data.code) {
        const pre = document.createElement("pre");
        pre.className = "cr-code";
        pre.style.cssText = "margin:8px 0; max-height:150px; overflow-y:auto; border-radius:6px; background:rgba(0,0,0,0.3); padding:8px; font-size:0.8rem;";
        const code = document.createElement("code");
        code.className = "language-python";
        code.textContent = data.code;
        pre.appendChild(code);
        toolWindow.appendChild(pre);
        setTimeout(() => { if (Prism) Prism.highlightElement(code); }, 80);
    }

    // stdout
    if (data.stdout) {
        const out = document.createElement("pre");
        out.className = "cr-output cr-stdout";
        out.style.cssText = "color:#4ade80; background:#000; padding:8px; border-radius:6px; font-size:0.8rem; margin:4px 0; overflow-x:auto;";
        out.textContent = data.stdout;
        toolWindow.appendChild(out);
    }

    // stderr / blocked
    if (data.stderr) {
        const err = document.createElement("pre");
        err.className = "cr-output cr-stderr";
        err.style.cssText = "color:#f87171; background:#3f0000; padding:8px; border-radius:6px; font-size:0.8rem; margin:4px 0; overflow-x:auto;";
        err.textContent = data.stderr;
        toolWindow.appendChild(err);
    }

    if (!data.stdout && !data.stderr) {
        const empty = document.createElement("div");
        empty.style.cssText = "color:var(--text-secondary);font-size:0.82rem;padding:6px 0;";
        empty.innerText = "(No output)";
        toolWindow.appendChild(empty);
    }

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "💻", "run_code");
    closeBtn.onclick = () => toolWindow.remove();

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}

// ================= UNIT CONVERTER WIDGET =================
function openUnitConverter(data) {
    const existing = document.querySelector('[data-tool="convert_units"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "convert_units";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const title = document.createElement("span");
    title.innerText = "📐 Unit Converter";
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    // Big result display
    const result = document.createElement("div");
    result.className = "uc-result";
    result.innerHTML = `<span class="uc-from">${data.value} ${data.from}</span><span class="uc-eq">=</span><span class="uc-to">${data.result} ${data.to}</span>`;
    toolWindow.appendChild(result);

    // Category label
    if (data.category) {
        const cat = document.createElement("div");
        cat.className = "uc-category";
        cat.innerText = data.category.charAt(0).toUpperCase() + data.category.slice(1);
        toolWindow.appendChild(cat);
    }

    // All conversions grid
    if (data.allConversions && data.allConversions.length > 0) {
        const grid = document.createElement("div");
        grid.className = "uc-grid";
        data.allConversions.forEach(conv => {
            const row = document.createElement("div");
            row.className = "uc-row" + (conv.unit === data.to ? " uc-row-highlight" : "");
            row.innerHTML = `<span class="uc-unit-name">${conv.unit}</span><span class="uc-unit-val">${typeof conv.value === 'number' ? (conv.value < 0.01 && conv.value > 0 ? conv.value.toExponential(3) : parseFloat(conv.value.toPrecision(6))) : conv.value} <em>${conv.symbol || ''}</em></span>`;
            grid.appendChild(row);
        });
        toolWindow.appendChild(grid);
    }

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "📐", "convert_units");
    closeBtn.onclick = () => toolWindow.remove();

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}

// ================= NEWS FEED WIDGET =================
function openNewsFeed(data) {
    const existing = document.querySelector('[data-tool="get_news"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "get_news";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const title = document.createElement("span");
    title.innerText = "📰 " + (data.categoryLabel || "News");
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    // Meta bar
    const meta = document.createElement("div");
    meta.className = "news-meta-bar";
    const fetchedDate = data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : "";
    meta.innerHTML = `<span>${data.source || "BBC News"}</span><span>${fetchedDate}</span>`;
    toolWindow.appendChild(meta);

    // Article list
    const list = document.createElement("div");
    list.className = "news-list";
    if (data.articles && data.articles.length > 0) {
        data.articles.forEach(a => {
            const item = document.createElement("div");
            item.className = "news-article-item";
            const titleEl = document.createElement("a");
            titleEl.className = "news-title";
            titleEl.href = a.link || "#";
            titleEl.target = "_blank";
            titleEl.rel = "noopener";
            titleEl.textContent = a.title;
            item.appendChild(titleEl);
            if (a.description) {
                const desc = document.createElement("div");
                desc.className = "news-desc";
                desc.textContent = a.description;
                item.appendChild(desc);
            }
            if (a.pubDate) {
                const dateEl = document.createElement("div");
                dateEl.className = "news-meta";
                dateEl.textContent = a.pubDate;
                item.appendChild(dateEl);
            }
            list.appendChild(item);
        });
    } else {
        const empty = document.createElement("div");
        empty.style.cssText = "color:var(--text-secondary);font-size:0.82rem;padding:8px 0;";
        empty.innerText = "No articles found.";
        list.appendChild(empty);
    }
    toolWindow.appendChild(list);

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "📰", "get_news");
    closeBtn.onclick = () => toolWindow.remove();

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}

// ================= FILE MANAGER WIDGET =================
function openFileManager(data) {
    const existing = document.querySelector('[data-tool="file_manager"]');
    if (existing) existing.remove();

    const toolWindow = document.createElement("div");
    toolWindow.className = "tool-window";
    toolWindow.dataset.tool = "file_manager";

    const header = document.createElement("div");
    header.className = "tool-window-header";
    const title = document.createElement("span");
    title.innerText = "📁 File Manager";
    const controls = document.createElement("div");
    const minimizeBtn = document.createElement("button");
    minimizeBtn.innerText = "–";
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.className = "close-btn";
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    toolWindow.appendChild(header);

    // Show success/action message if applicable
    if (data.action === "create" || data.action === "write") {
        const successMsg = document.createElement("div");
        successMsg.className = "fm-success";
        successMsg.innerText = `✅ File "${data.fileName}" saved.`;
        toolWindow.appendChild(successMsg);
    }

    // Show file content if read action
    if (data.content) {
        const pre = document.createElement("pre");
        pre.className = "fm-content";
        pre.textContent = data.content;
        toolWindow.appendChild(pre);
    }

    // File list
    const fileList = document.createElement("div");
    fileList.className = "fm-file-list";

    function renderFileList(files) {
        fileList.innerHTML = "";
        if (!files || files.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "color:var(--text-secondary);font-size:0.82rem;padding:8px 0;";
            empty.innerText = "Workspace is empty.";
            fileList.appendChild(empty);
            return;
        }
        files.forEach(f => {
            const row = document.createElement("div");
            row.className = "fm-file-row";
            row.innerHTML = `
                <span class="fm-icon">${f.icon || "📄"}</span>
                <span class="fm-name">${f.name}</span>
                <span class="fm-meta">${f.sizeHuman || ""}</span>
            `;
            const actions = document.createElement("div");
            actions.className = "fm-actions";

            // View button
            const viewBtn = document.createElement("button");
            viewBtn.className = "fm-btn";
            viewBtn.innerText = "View";
            viewBtn.onclick = () => {
                fetch(`/workspace/file/${encodeURIComponent(f.name)}`, {
                    headers: anyaAuthToken ? { Authorization: "Bearer " + anyaAuthToken } : {}
                })
                .then(r => r.text())
                .then(content => {
                    const modal = document.createElement("div");
                    modal.className = "fm-modal-overlay";
                    modal.innerHTML = `
                        <div class="fm-modal">
                            <div class="fm-modal-header">
                                <span>${f.icon || "📄"} ${f.name}</span>
                                <button onclick="this.closest('.fm-modal-overlay').remove()">✖</button>
                            </div>
                            <pre class="fm-modal-content">${content.replace(/</g,"&lt;")}</pre>
                        </div>
                    `;
                    document.body.appendChild(modal);
                })
                .catch(() => alert("Could not load file."));
            };
            actions.appendChild(viewBtn);

            // Delete button
            const delBtn = document.createElement("button");
            delBtn.className = "fm-btn fm-btn-del";
            delBtn.innerText = "Delete";
            delBtn.onclick = () => {
                if (!confirm(`Delete "${f.name}"?`)) return;
                fetch(`/workspace/file/${encodeURIComponent(f.name)}`, {
                    method: "DELETE",
                    headers: anyaAuthToken ? { Authorization: "Bearer " + anyaAuthToken } : {}
                })
                .then(r => r.json())
                .then(res => {
                    if (res.ok) {
                        // Refresh file list
                        fetch("/workspace/files", {
                            headers: anyaAuthToken ? { Authorization: "Bearer " + anyaAuthToken } : {}
                        })
                        .then(r => r.json())
                        .then(d => renderFileList(d.files || []));
                    } else {
                        alert("Delete failed.");
                    }
                })
                .catch(() => alert("Delete request failed."));
            };
            actions.appendChild(delBtn);

            row.appendChild(actions);
            fileList.appendChild(row);
        });
    }

    renderFileList(data.files || []);
    toolWindow.appendChild(fileList);

    minimizeBtn.onclick = () => minimizeTool(toolWindow, "📁", "file_manager");
    closeBtn.onclick = () => toolWindow.remove();

    document.getElementById("tool-container").appendChild(toolWindow);
    toggleRightSidebar(true);
}
