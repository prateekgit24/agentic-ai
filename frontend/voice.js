// ============================================================
//  VOICE FEATURES — Phase 3
//  3.1 STT  via Web Speech API
//  3.2 TTS  via Web Speech Synthesis
//  3.3 Wake Word via Picovoice Porcupine (opt-in)
// ============================================================

// ===== SHARED STATE =====
let recognition = null;
let isRecording = false;
let ttsEnabled = false;
let ttsVoice = null;
let ttsRate = 1.0;
let wakeWordActive = false;
let porcupineHandle = null;
let currentSpeakingBubble = null;


// =========================================================
//  INIT — restore saved settings on page load
// =========================================================
function voiceInit() {
    const savedTTS = localStorage.getItem("anya-tts") === "true";
    const savedRate = parseFloat(localStorage.getItem("anya-tts-rate") || "1");
    const savedVoice = localStorage.getItem("anya-tts-voice") || "";

    ttsEnabled = savedTTS;
    ttsRate = savedRate;

    const toggle = document.getElementById("tts-toggle");
    const speed = document.getElementById("tts-speed");
    const speedV = document.getElementById("speed-val");

    if (toggle) toggle.checked = ttsEnabled;
    if (speed) speed.value = ttsRate;
    if (speedV) speedV.innerText = ttsRate + "x";

    if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.onvoiceschanged = () => loadVoices(savedVoice);
        loadVoices(savedVoice);
    }
    // Picovoice key is fetched from the backend at runtime — NOT stored in localStorage
    // Update custom wake word badge after DOM is stable
    setTimeout(updateWakeModelStatusBadge, 300);
}


// =========================================================
//  3.2 TTS
// =========================================================
function loadVoices(preferredName) {
    if (typeof speechSynthesis === "undefined") return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;

    const picker = document.getElementById("voice-picker");
    if (!picker) return;

    picker.innerHTML = "";
    voices.forEach((v, i) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = v.name + " (" + v.lang + ")";
        if (preferredName ? v.name === preferredName : i === 0) {
            opt.selected = true;
            ttsVoice = v;
        }
        picker.appendChild(opt);
    });

    if (!ttsVoice) ttsVoice = voices[0];
}

function saveTTSSettings() {
    const toggle = document.getElementById("tts-toggle");
    const picker = document.getElementById("voice-picker");
    const speed = document.getElementById("tts-speed");

    ttsEnabled = toggle ? toggle.checked : ttsEnabled;
    ttsRate = speed ? parseFloat(speed.value) : ttsRate;

    const voices = speechSynthesis.getVoices();
    const chosen = picker ? voices.find(v => v.name === picker.value) : null;
    if (chosen) ttsVoice = chosen;

    localStorage.setItem("anya-tts", ttsEnabled);
    localStorage.setItem("anya-tts-rate", ttsRate);
    localStorage.setItem("anya-tts-voice", ttsVoice ? ttsVoice.name : "");
}

function stripForSpeech(text) {
    return text
        .replace(/```[\s\S]*?```/g, "code block omitted")
        .replace(/`[^`]+`/g, "")
        .replace(/[*_~#>\[\]]/g, "")
        .replace(/https?:\/\/\S+/g, "link")
        .trim();
}

function speakResponse(text, bubbleEl) {
    if (!ttsEnabled || typeof speechSynthesis === "undefined") return;

    stopSpeaking();

    const clean = stripForSpeech(text);
    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = ttsRate;
    if (ttsVoice) utter.voice = ttsVoice;

    if (bubbleEl) {
        bubbleEl.classList.add("speaking");
        currentSpeakingBubble = bubbleEl;
    }

    utter.onend = () => {
        if (currentSpeakingBubble) {
            currentSpeakingBubble.classList.remove("speaking");
            currentSpeakingBubble = null;
        }
    };

    utter.onerror = () => {
        if (currentSpeakingBubble) {
            currentSpeakingBubble.classList.remove("speaking");
            currentSpeakingBubble = null;
        }
    };

    speechSynthesis.speak(utter);
}

function stopSpeaking() {
    if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.cancel();
    }
    if (currentSpeakingBubble) {
        currentSpeakingBubble.classList.remove("speaking");
        currentSpeakingBubble = null;
    }
}


// =========================================================
//  3.1 STT — Speech-to-Text
// =========================================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
        return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    const textarea = document.getElementById("message");

    rec.onstart = () => {
        isRecording = true;
        const btn = document.getElementById("mic-btn");
        const icon = document.getElementById("mic-icon");
        if (btn) btn.classList.add("recording");
        if (icon) icon.innerText = "mic_off";
        if (textarea) textarea.placeholder = "Listening\u2026";
        stopSpeaking();
    };

    rec.onresult = (event) => {
        let interim = "";
        let final_ = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final_ += t;
            } else {
                interim += t;
            }
        }

        if (textarea) {
            textarea.value = final_ || interim;
            if (typeof autoResizeTextarea === "function") autoResizeTextarea(textarea);
        }

        if (final_.trim()) {
            if (typeof sendMessage === "function") sendMessage();
        }
    };

    rec.onerror = (event) => {
        console.warn("STT error:", event.error);
        resetMicButton();
        if (event.error === "not-allowed") {
            alert("Microphone access denied. Please allow mic access in your browser settings.");
        }
    };

    rec.onend = () => {
        resetMicButton();
    };

    return rec;
}

function resetMicButton() {
    isRecording = false;
    const btn = document.getElementById("mic-btn");
    const icon = document.getElementById("mic-icon");
    const ta = document.getElementById("message");
    if (btn) btn.classList.remove("recording");
    if (icon) icon.innerText = "mic";
    if (ta) ta.placeholder = "Message Anya...";
}

function toggleMic() {
    if (isRecording) {
        if (recognition) recognition.stop();
        return;
    }

    if (!recognition) {
        recognition = initSpeechRecognition();
        if (!recognition) return;
    }

    try {
        recognition.start();
    } catch (e) {
        recognition.stop();
        setTimeout(() => recognition.start(), 200);
    }
}


// =========================================================
//  3.3 WAKE WORD — Picovoice Porcupine v4 (opt-in)
//  Key: node-server/.env  PICOVOICE_ACCESS_KEY
//  Model: frontend/hey-Anya_en_wasm_v4_0_0.ppn
//
//  FALLBACK: Web Speech API continuous listener (no key needed)
//  Used automatically when Porcupine key is missing/expired.
// =========================================================

// No-op: key is managed server-side via .env
function savePicovoiceKey() { }

// Fallback: Web Speech API wake word recognition
let _speechWakeRecog = null;
let _wakeWordMode = null; // "porcupine" | "speech"

function startSpeechWakeWord() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    const badge = document.getElementById("wake-word-indicator");

    _speechWakeRecog = new SpeechRecognition();
    _speechWakeRecog.continuous = true;
    _speechWakeRecog.interimResults = false;
    _speechWakeRecog.lang = "en-US";
    _speechWakeRecog.maxAlternatives = 1;

    _speechWakeRecog.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        if (transcript.includes("hey anya") || transcript.includes("hey anna") || transcript.includes("hanya")) {
            if (badge) {
                badge.style.background = "rgba(99,130,255,0.25)";
                setTimeout(() => { if (badge) badge.style.background = ""; }, 600);
            }
            toggleMic();
        }
    };

    _speechWakeRecog.onerror = (e) => {
        // network errors on continuous recognition are common; silently restart
        if (e.error !== "no-speech") console.warn("Speech wake word error:", e.error);
    };

    _speechWakeRecog.onend = () => {
        // Auto-restart if wake word is still supposed to be active
        if (wakeWordActive && _wakeWordMode === "speech") {
            try { _speechWakeRecog.start(); } catch (_) { }
        }
    };

    try {
        _speechWakeRecog.start();
        _wakeWordMode = "speech";
        wakeWordActive = true;
        if (badge) badge.style.display = "inline-flex";
        // Show subtle tooltip that fallback mode is active
        if (badge) badge.title = "Wake word active (browser fallback)";
        console.log('Wake word fallback active — listening for "Hey Anya" via Web Speech API.');
        return true;
    } catch (e) {
        console.error("Speech wake word failed to start:", e);
        return false;
    }
}

function stopSpeechWakeWord() {
    if (_speechWakeRecog) {
        try { _speechWakeRecog.stop(); } catch (_) { }
        _speechWakeRecog = null;
    }
    _wakeWordMode = null;
}

async function toggleWakeWord() {
    const wakeToggle = document.getElementById("wake-toggle");
    const keyRow = document.getElementById("wake-key-row");
    const badge = document.getElementById("wake-word-indicator");

    if (!wakeToggle.checked) {
        // Stop custom TF.js wake word if running
        await stopCustomWakeWord();
        // Stop Porcupine if running
        if (window.WebVoiceProcessor && window.WebVoiceProcessor.WebVoiceProcessor && porcupineHandle) {
            try { await window.WebVoiceProcessor.WebVoiceProcessor.unsubscribe(porcupineHandle); } catch (_) { }
        }
        if (porcupineHandle) {
            try { await porcupineHandle.release(); } catch (_) { }
            porcupineHandle = null;
        }
        // Stop speech fallback if running
        stopSpeechWakeWord();
        wakeWordActive = false;
        if (badge) badge.style.display = "none";
        if (keyRow) keyRow.style.display = "none";
        return;
    }

    // Priority 1: Custom TF.js trained model
    if (customModelExists()) {
        const ok = await startCustomWakeWord();
        if (ok) return;
        console.warn("Custom wake model failed to load — falling back to Porcupine.");
    }

    // 1) Fetch key from backend — never stored client-side
    let accessKey = "";
    try {
        const cfgRes = await fetch("http://localhost:5000/config/voice");
        const cfg = await cfgRes.json();
        accessKey = cfg.picovoiceKey || "";
    } catch (e) {
        console.error("Could not fetch voice config:", e);
    }

    if (!accessKey) {
        // No key — try Speech API fallback
        const ok = startSpeechWakeWord();
        if (!ok) {
            alert("Picovoice key not configured and browser Speech API unavailable.\n\nTo use Porcupine: add PICOVOICE_ACCESS_KEY to node-server/.env\nGet a free key at: https://console.picovoice.ai");
            wakeToggle.checked = false;
        }
        return;
    }

    // 2) Load Porcupine v4 IIFE + WebVoiceProcessor
    if (!window.PorcupineWeb) {
        await loadVoiceScript("/porcupine.min.js");
        await loadVoiceScript("/web-voice-processor.min.js");
        await new Promise(r => setTimeout(r, 400));
    }

    // 3) Verify SDK loaded correctly
    if (!window.PorcupineWeb || !window.PorcupineWeb.PorcupineWorker) {
        console.warn("Porcupine SDK failed to load — using Speech API fallback.");
        startSpeechWakeWord();
        return;
    }

    // 4) Init with custom "Hey Anya" .ppn model + base model file
    try {
        const keyword = {
            label: "Hey Anya",
            publicPath: "/hey-Anya_en_wasm_v4_0_0.ppn",
            sensitivity: 0.6,
            customWritePath: "hey_anya_kw",
            forceWrite: true,
            version: 1
        };

        const model = {
            publicPath: "/porcupine_params.pv",
            customWritePath: "porcupine_model",
            forceWrite: true,
            version: 1
        };

        porcupineHandle = await window.PorcupineWeb.PorcupineWorker.create(
            accessKey,
            [keyword],
            onWakeWord,
            model
        );

        await window.WebVoiceProcessor.WebVoiceProcessor.subscribe(porcupineHandle);

        _wakeWordMode = "porcupine";
        wakeWordActive = true;
        if (badge) badge.style.display = "inline-flex";
        if (badge) badge.title = "Wake word active (Porcupine)";
        console.log('Wake word "Hey Anya" active via Porcupine.');

    } catch (err) {
        console.error("Porcupine init failed:", err);

        // Specific guidance for activation errors (expired/invalid key)
        const isKeyError = err.name === "PorcupineActivationRefusedError"
            || err.name === "PorcupineActivationLimitReachedError"
            || err.name === "PorcupineActivationThrottledError"
            || (err.message && err.message.includes("Activation"));

        if (isKeyError) {
            console.warn("Picovoice key is expired or invalid. Falling back to Speech API wake word.");
            const ok = startSpeechWakeWord();
            if (ok) {
                // Show a non-blocking notice below the toggle
                const hint = document.getElementById("wake-key-hint");
                if (hint) {
                    hint.textContent = "Porcupine key expired — using browser fallback. Get a new key at console.picovoice.ai";
                    hint.style.display = "block";
                }
            } else {
                alert("Wake word failed: Porcupine key is expired/invalid and Speech API is unavailable.\n\nGet a new free key at: https://console.picovoice.ai\nThen update PICOVOICE_ACCESS_KEY in node-server/.env");
                wakeToggle.checked = false;
            }
        } else {
            alert("Wake word init failed: " + err.message + "\n\nSee console for details.");
            wakeToggle.checked = false;
            if (keyRow) keyRow.style.display = "none";
        }
    }
}

function onWakeWord(detection) {
    console.log("Wake word detected! Payload:", detection);
    const badge = document.getElementById("wake-word-indicator");
    if (badge) {
        badge.style.background = "rgba(99,130,255,0.25)";
        setTimeout(() => { if (badge) badge.style.background = ""; }, 600);
    }
    toggleMic();
}

function loadVoiceScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}


// =========================================================
//  CUSTOM WAKE WORD — TF.js Transfer Learning (in-browser)
//  Uses @tensorflow-models/speech-commands TransferRecognizer
//  Model stored in IndexedDB, survives page reloads.
// =========================================================

const CUSTOM_WAKE_MODEL_KEY  = "anya-wake-model-trained";
const CUSTOM_WAKE_IDBNAME    = "indexeddb://hey-anya-v1";
const CUSTOM_WAKE_LABEL_POS  = "hey_anya";
const CUSTOM_WAKE_LABEL_NEG  = "_background_noise_";
const CUSTOM_WAKE_THRESHOLD  = 0.85;
const SAMPLES_REQUIRED       = 20;

let _wakeBaseRecognizer   = null;   // base BROWSER_FFT recognizer
let _wakeTransfer         = null;   // transfer recognizer (training)
let _customWakeRecognizer = null;   // loaded transfer model (inference)
let _wakePhase            = "idle"; // idle | pos | neg | training | testing | ready
let _wakePosCount         = 0;
let _wakeNegCount         = 0;
let _wakeCountdownTimer   = null;

// ---- Utilities ----

function customModelExists() {
    return localStorage.getItem(CUSTOM_WAKE_MODEL_KEY) === "true";
}

function _setWakeMsg(text, cls) {
    const el = document.getElementById("wake-trainer-msg");
    if (!el) return;
    el.textContent = text;
    el.className = "wake-trainer-msg" + (cls ? " " + cls : "");
}

function _setStepActive(n) {
    [1,2,3,4].forEach(i => {
        const el = document.getElementById("wake-step-" + i);
        if (!el) return;
        el.classList.remove("step-active", "step-done");
        if (i < n) el.classList.add("step-done");
        if (i === n) el.classList.add("step-active");
    });
}

function updateWakeModelStatusBadge() {
    const badge = document.getElementById("wake-model-status-badge");
    const btnStart   = document.getElementById("wake-btn-start");
    const btnTest    = document.getElementById("wake-btn-test");
    const btnRetrain = document.getElementById("wake-btn-retrain");
    if (!badge) return;
    if (customModelExists()) {
        badge.textContent = "Ready";
        badge.className = "wake-model-badge ready";
        if (btnStart)   btnStart.style.display = "none";
        if (btnTest)    btnTest.style.display = "";
        if (btnRetrain) btnRetrain.style.display = "";
        _setStepActive(4);
        _setWakeMsg("Custom model loaded. Enable wake word in the header to use it.", "success");
    } else {
        badge.textContent = "Untrained";
        badge.className = "wake-model-badge untrained";
        if (btnStart)   btnStart.style.display = "";
        if (btnTest)    btnTest.style.display = "none";
        if (btnRetrain) btnRetrain.style.display = "none";
        _setStepActive(1);
        _setWakeMsg("");
    }
}

// ---- TF.js loader ----

async function loadTFJSIfNeeded() {
    if (window.speechCommands) return true;
    // The CDN scripts are deferred — they should already be loaded by now
    // but give a generous wait just in case
    let waited = 0;
    while (!window.speechCommands && waited < 10000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    if (!window.speechCommands) {
        _setWakeMsg("TF.js speech-commands library not loaded. Check internet connection.", "error");
        return false;
    }
    return true;
}

async function ensureBaseRecognizer() {
    if (_wakeBaseRecognizer) return _wakeBaseRecognizer;
    _setWakeMsg("Loading base audio model (~15 MB, one-time download)…");
    const sc = window.speechCommands;
    _wakeBaseRecognizer = sc.create("BROWSER_FFT");
    await _wakeBaseRecognizer.ensureModelLoaded();
    _setWakeMsg("Base model ready.");
    return _wakeBaseRecognizer;
}

// ---- Training phase ----

async function wakeTrainerStart() {
    if (wakeWordActive) {
        _setWakeMsg("Please disable the wake word toggle first before training.", "error");
        return;
    }
    const ok = await loadTFJSIfNeeded();
    if (!ok) return;

    const btnStart  = document.getElementById("wake-btn-start");
    const btnRecord = document.getElementById("wake-btn-record");
    if (btnStart)  btnStart.style.display = "none";
    if (btnRecord) btnRecord.style.display = "";

    // Set badge to training
    const badge = document.getElementById("wake-model-status-badge");
    if (badge) { badge.textContent = "Training…"; badge.className = "wake-model-badge training"; }

    try {
        await ensureBaseRecognizer();
        _wakeTransfer = _wakeBaseRecognizer.createTransfer("hey_anya_transfer");
        _wakePosCount = 0; _wakeNegCount = 0;
        _wakePhase = "pos";
        _setStepActive(1);
        _showRecordArea("pos");
        _setWakeMsg("Step 1: Record your wake word samples.");
    } catch (e) {
        _setWakeMsg("Error loading model: " + e.message, "error");
        updateWakeModelStatusBadge();
    }
}

function _showRecordArea(phase) {
    const area  = document.getElementById("wake-record-area");
    const instr = document.getElementById("wake-record-instruction");
    const phrase = document.getElementById("wake-record-phrase");
    const counter = document.getElementById("wake-sample-count");
    const needed  = document.getElementById("wake-sample-needed");
    if (!area) return;
    area.classList.add("active");

    if (phase === "pos") {
        if (instr) instr.innerHTML = 'Say <strong>"Hey Anya"</strong> clearly at normal volume, like you\'re calling someone. Click Record for each sample.';
        if (phrase) phrase.textContent = '"Hey Anya"';
        if (counter) counter.textContent = _wakePosCount;
        if (needed)  needed.textContent  = SAMPLES_REQUIRED;
    } else {
        if (instr) instr.innerHTML = 'Now record <strong>background noise</strong> — just ambient sound, no speech. Click Record each time.';
        if (phrase) phrase.textContent  = "🔇  Silence / noise";
        if (counter) counter.textContent = _wakeNegCount;
        if (needed)  needed.textContent  = SAMPLES_REQUIRED;
    }
}

async function wakeRecordSample() {
    if (!_wakeTransfer || (_wakePhase !== "pos" && _wakePhase !== "neg")) return;

    const btnRecord   = document.getElementById("wake-btn-record");
    const pulse       = document.getElementById("wake-record-pulse");
    const countdown   = document.getElementById("wake-countdown");
    const counter     = document.getElementById("wake-sample-count");
    if (btnRecord) btnRecord.disabled = true;

    // Visual count-in: 3…2…1
    if (countdown) { countdown.textContent = "3"; }
    await new Promise(r => setTimeout(r, 700));
    if (countdown) { countdown.textContent = "2"; }
    await new Promise(r => setTimeout(r, 700));
    if (countdown) { countdown.textContent = "1"; }
    await new Promise(r => setTimeout(r, 700));
    if (countdown) { countdown.textContent = "🎙"; }
    if (pulse) pulse.classList.add("pulsing");

    try {
        const label = _wakePhase === "pos" ? CUSTOM_WAKE_LABEL_POS : CUSTOM_WAKE_LABEL_NEG;
        await _wakeTransfer.collectExample(label);

        if (_wakePhase === "pos") {
            _wakePosCount++;
            if (counter) counter.textContent = _wakePosCount;
        } else {
            _wakeNegCount++;
            if (counter) counter.textContent = _wakeNegCount;
        }

        // Auto-advance phases
        if (_wakePhase === "pos" && _wakePosCount >= SAMPLES_REQUIRED) {
            _wakePhase = "neg";
            _setStepActive(2);
            _showRecordArea("neg");
            _setWakeMsg(`✓ ${_wakePosCount} wake word samples. Now record background noise.`);
        } else if (_wakePhase === "neg" && _wakeNegCount >= SAMPLES_REQUIRED) {
            // Enough samples — auto-train
            _wakePhase = "training";
            await _doTrain();
            return;
        }
        if (countdown) countdown.textContent = "";
    } catch (e) {
        _setWakeMsg("Recording error: " + e.message, "error");
    }

    if (pulse) pulse.classList.remove("pulsing");
    if (countdown) countdown.textContent = "";
    if (btnRecord) btnRecord.disabled = false;
}

async function _doTrain() {
    const btnRecord = document.getElementById("wake-btn-record");
    const btnTest   = document.getElementById("wake-btn-test");
    const btnRetrain = document.getElementById("wake-btn-retrain");
    const area       = document.getElementById("wake-record-area");
    const progress   = document.getElementById("wake-progress-wrap");
    const fill       = document.getElementById("wake-progress-fill");
    const epochLabel = document.getElementById("wake-epoch-label");
    const badge      = document.getElementById("wake-model-status-badge");

    if (btnRecord) btnRecord.style.display = "none";
    if (area)     area.classList.remove("active");
    if (progress) progress.classList.add("visible");
    _setStepActive(3);
    _setWakeMsg("Training in progress…");

    const totalEpochs = 40;
    try {
        await _wakeTransfer.train({
            epochs: totalEpochs,
            validationSplit: 0.25,
            callback: {
                onEpochEnd: (epoch) => {
                    const pct = Math.round(((epoch + 1) / totalEpochs) * 100);
                    if (fill) fill.style.width = pct + "%";
                    if (epochLabel) epochLabel.textContent = `Training… epoch ${epoch + 1} / ${totalEpochs}`;
                }
            }
        });

        // Save to IndexedDB
        await _wakeTransfer.save(CUSTOM_WAKE_IDBNAME);
        localStorage.setItem(CUSTOM_WAKE_MODEL_KEY, "true");

        if (progress) progress.classList.remove("visible");
        _setStepActive(4);
        if (badge) { badge.textContent = "Ready"; badge.className = "wake-model-badge ready"; }
        if (btnTest)    btnTest.style.display = "";
        if (btnRetrain) btnRetrain.style.display = "";
        _wakePhase = "ready";
        _setWakeMsg("Training complete! Enable wake word in the header to use your custom model.", "success");
    } catch (e) {
        _setWakeMsg("Training failed: " + e.message, "error");
        if (progress) progress.classList.remove("visible");
        updateWakeModelStatusBadge();
    }
}

// Manual train trigger (in case auto-advance didn't fire)
async function wakeTrainerTrain() {
    if (_wakePhase !== "neg" && _wakePhase !== "pos") return;
    _wakePhase = "training";
    await _doTrain();
}

// ---- Testing ----

async function wakeTrainerTest() {
    if (!customModelExists()) return;
    const ok = await loadTFJSIfNeeded();
    if (!ok) return;

    _setWakeMsg("Loading model for test… say \"Hey Anya\" within 10 seconds.");
    try {
        const recognizer = await _getLoadedTransferRecognizer();
        if (!recognizer) return;

        let detected = false;
        await recognizer.listen(result => {
            const words = recognizer.wordLabels();
            const idx = words.indexOf(CUSTOM_WAKE_LABEL_POS);
            const score = idx >= 0 ? result.scores[idx] : 0;
            if (score > CUSTOM_WAKE_THRESHOLD && !detected) {
                detected = true;
                recognizer.stopListening();
                _setWakeMsg(`Wake word detected! (confidence: ${(score * 100).toFixed(0)}%)`, "success");
            }
        }, { probabilityThreshold: CUSTOM_WAKE_THRESHOLD, overlapFactor: 0.75 });

        // Auto-stop after 10s
        setTimeout(async () => {
            try { await recognizer.stopListening(); } catch (_) {}
            if (!detected) _setWakeMsg("Timeout — wake word not detected. Try retraining with more samples.", "error");
        }, 10000);
    } catch (e) {
        _setWakeMsg("Test error: " + e.message, "error");
    }
}

// ---- Reset ----

function wakeTrainerReset() {
    localStorage.removeItem(CUSTOM_WAKE_MODEL_KEY);
    _wakeBaseRecognizer = null;
    _wakeTransfer = null;
    _customWakeRecognizer = null;
    _wakePhase = "idle";
    _wakePosCount = 0; _wakeNegCount = 0;

    // Reset UI
    const area     = document.getElementById("wake-record-area");
    const progress = document.getElementById("wake-progress-wrap");
    if (area)     area.classList.remove("active");
    if (progress) progress.classList.remove("visible");

    updateWakeModelStatusBadge();
    _setWakeMsg("Training reset. You can train a new model.");
}

// ---- Load saved model from IndexedDB ----

async function _getLoadedTransferRecognizer() {
    try {
        const ok = await loadTFJSIfNeeded();
        if (!ok) return null;
        const base = window.speechCommands.create("BROWSER_FFT");
        await base.ensureModelLoaded();
        const transfer = base.createTransfer("hey_anya_transfer");
        await transfer.load(CUSTOM_WAKE_IDBNAME);
        return transfer;
    } catch (e) {
        console.warn("Custom wake model failed to load from IndexedDB:", e);
        // Desync: flag says trained but model is gone — clear flag
        localStorage.removeItem(CUSTOM_WAKE_MODEL_KEY);
        updateWakeModelStatusBadge();
        return null;
    }
}

// ---- Inference (for actual wake word detection) ----

async function startCustomWakeWord() {
    const recognizer = await _getLoadedTransferRecognizer();
    if (!recognizer) return false;

    const badge = document.getElementById("wake-word-indicator");

    try {
        await recognizer.listen(result => {
            const words = recognizer.wordLabels();
            const idx = words.indexOf(CUSTOM_WAKE_LABEL_POS);
            const score = idx >= 0 ? result.scores[idx] : 0;
            if (score > CUSTOM_WAKE_THRESHOLD) {
                if (badge) {
                    badge.style.background = "rgba(99,130,255,0.25)";
                    setTimeout(() => { if (badge) badge.style.background = ""; }, 600);
                }
                toggleMic();
            }
        }, { probabilityThreshold: CUSTOM_WAKE_THRESHOLD, overlapFactor: 0.75 });

        _customWakeRecognizer = recognizer;
        _wakeWordMode = "tfjs";
        wakeWordActive = true;
        if (badge) { badge.style.display = "inline-flex"; badge.title = "Wake word active (custom TF.js model)"; }
        console.log('Wake word "Hey Anya" active via custom TF.js model.');
        return true;
    } catch (e) {
        console.error("Custom wake word start failed:", e);
        return false;
    }
}

async function stopCustomWakeWord() {
    if (_customWakeRecognizer) {
        try { await _customWakeRecognizer.stopListening(); } catch (_) {}
        _customWakeRecognizer = null;
    }
    if (_wakeWordMode === "tfjs") _wakeWordMode = null;
}
