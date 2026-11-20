/**
 * avatar-live2d.js — Live2D Cubism 4 avatar via PixiJS + pixi-live2d-display
 *
 * Requires: live2dcubismcore.min.js  (loaded in <head>)
 * Lazy-loads: pixi.js v7 and pixi-live2d-display from CDN on first switch
 *
 * Public API (added to window):
 *   switchAvatarMode('svg' | 'live2d')
 *   avatarSetState(state)   — overrides the one from avatar.js; routes by mode
 */
(function () {

    const MODEL_PATH = 'hiyori_free_en/runtime/hiyori_free_t08.model3.json';
    const PIXI_CDN   = 'pixi.min.js';
    const STUB_CDN   = 'live2d-stub.min.js';   // satisfies Cubism-2 check in pixi-live2d-display
    const L2D_CDN    = 'pixi-live2d-display.min.js';

    let app         = null;
    let model       = null;
    let talkTickFn  = null;   // frame-sync mouth — added to app.ticker each talk
    let motionTimer = null;   // setTimeout handle for post-burst idle transition
    let _state      = 'idle';
    let _loaded     = false;
    let _loading    = false;
    let _mode       = 'svg';

    // ── Helper: load a <script> from URL once ───────────────────────────────
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src     = src;
            s.onload  = resolve;
            s.onerror = () => reject(new Error('Script load failed: ' + src));
            document.head.appendChild(s);
        });
    }

    // ── Initialise Live2D canvas (lazy — called on first mode switch) ────────
    async function init() {
        if (_loaded || _loading) return;
        _loading = true;

        const container = document.getElementById('avatar-live2d-canvas');
        if (!container) { _loading = false; return; }

        container.innerHTML = '<div class="av-l2d-status">Loading Live2D…</div>';

        // Load PixiJS, then Cubism-2 stub, then pixi-live2d-display (order matters)
        try {
            await loadScript(PIXI_CDN);
            await loadScript(STUB_CDN);
            await loadScript(L2D_CDN);
        } catch (e) {
            container.innerHTML =
                '<div class="av-l2d-status av-l2d-error">CDN load failed.<br>Check your connection.</div>';
            _loading = false;
            return;
        }

        // Verify the cubism4 bundle attached correctly
        if (!window.PIXI || !PIXI.live2d || !PIXI.live2d.Live2DModel) {
            container.innerHTML =
                '<div class="av-l2d-status av-l2d-error">Live2D init failed.<br>' +
                '<small>PIXI.live2d not found. Ensure live2dcubismcore.min.js loaded.</small></div>';
            _loading = false;
            return;
        }

        // Suppress Cubism 2 "runtime not found" warning (we only use Cubism 4)
        try { PIXI.live2d.config.logLevel = PIXI.live2d.config.LOG_LEVEL_ERROR; } catch (_) {}

        // pixi-live2d-display requires ticker registration
        try {
            PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
        } catch (_) { /* may already be registered */ }

        // Create PixiJS app with transparent background
        app = new PIXI.Application({
            width:           175,
            height:          300,
            backgroundAlpha: 0,
            antialias:       true,
            resolution:      window.devicePixelRatio || 1,
            autoDensity:     true,
        });
        container.innerHTML = '';
        container.appendChild(app.view);
        app.view.style.cssText = 'width:100%;height:auto;display:block;background:transparent;';

        // Load the Hiyori model
        try {
            model = await PIXI.live2d.Live2DModel.from(MODEL_PATH);
        } catch (e) {
            container.innerHTML =
                `<div class="av-l2d-status av-l2d-error">Model failed to load.<br><small>${e.message}</small></div>`;
            _loading = false;
            return;
        }

        app.stage.addChild(model);

        // Scale up to show waist-to-face region (crop below waist)
        const s = (app.renderer.width / model.width) * 2.0;
        model.scale.set(s);
        model.anchor.set(0.5, 1.0);            // pivot at model bottom
        model.x = app.renderer.width  / 2;
        // Push model down so bottom ~42% (legs/feet) is off-screen
        model.y = app.renderer.height + model.height * 0.42;

        // Interactive: click model → play reaction motion
        model.on('hit', (hitAreas) => {
            if (!model) return;
            const group = hitAreas.includes('Body') ? 'Tap@Body' : 'Tap';
            model.motion(group);
        });

        // Start in idle pose (static — motions only play during active states)
        try { model.internalModel.motionManager.stopAllMotions(); } catch(_) {}

        _loaded  = true;
        _loading = false;

        // Re-apply any state that was requested while loading
        if (_state !== 'idle') setState(_state);
    }

    // ── State machine ────────────────────────────────────────────────────────
    // MotionPriority: NONE=0, IDLE=1, NORMAL=2, FORCE=3
    const MPRIORITY_FORCE = 3;
    const MPRIORITY_IDLE  = 1;

    let _gestureIdx = 0;

    // Tear down everything started by the talk state
    function clearTalkState() {
        if (talkTickFn) {
            try { if (app) app.ticker.remove(talkTickFn); } catch(_) {}
            talkTickFn = null;
        }
        if (motionTimer) { clearTimeout(motionTimer); motionTimer = null; }
        if (model) {
            try { model.internalModel.coreModel
                      .setParameterValueById('ParamMouthOpenY', 0); } catch(_) {}
        }
    }

    function setState(state) {
        _state = state;
        clearTalkState();
        if (!model) return;

        switch (state) {

            case 'talk': {
                model.tint = 0xd0ecff;   // immediate blue tint — AI is speaking

                // 1. Energetic burst: body/hand reaction fires instantly
                try {
                    const burst = ['Tap@Body', 'Flick@Body'][_gestureIdx++ % 2];
                    model.motion(burst, 0, MPRIORITY_FORCE);
                } catch(_) {}

                // 2. After burst (~1.8 s), fall back to looping Idle sway so body
                //    keeps moving for the entire response duration naturally
                motionTimer = setTimeout(() => {
                    if (model && _state === 'talk')
                        try { model.motion('Idle', 0, MPRIORITY_IDLE); } catch(_) {}
                }, 1800);

                // 3. Frame-perfect mouth via PixiJS Ticker.
                //    Runs AFTER Live2D's own tick so our value wins every render frame.
                let phase = 0;
                talkTickFn = () => {
                    phase += 0.06;  // ~1 full open/close cycle per second
                    const v = Math.max(0, Math.sin(phase));
                    try {
                        model.internalModel.coreModel
                             .setParameterValueById('ParamMouthOpenY', v);
                    } catch(_) {}
                };
                app.ticker.add(talkTickFn);
                break;
            }

            case 'happy':
                model.tint = 0xfff4c0;
                try { model.motion('Tap',       0, MPRIORITY_FORCE); } catch(_) {}
                setTimeout(() => {
                    if (model && _state === 'happy')
                        try { model.motion('FlickDown', 0, MPRIORITY_FORCE); } catch(_) {}
                }, 1100);
                break;

            case 'worried':
                model.tint = 0xffe0e0;
                try { model.motion('Flick', 0, MPRIORITY_FORCE); } catch(_) {}
                setTimeout(() => {
                    if (model && _state === 'worried')
                        try { model.motion('Flick', 0, MPRIORITY_FORCE); } catch(_) {}
                }, 1500);
                break;

            case 'idle':
            default:
                model.tint = 0xffffff;
                // Stop all motions — model holds pose with only physics-driven hair/cloth
                try { model.internalModel.motionManager.stopAllMotions(); } catch(_) {}
                break;
        }
    }

    // ── Override global avatarSetState to route by active mode ───────────────
    // avatar.js must have already run and set window.avatarSetState.
    const _svgSetState = window.avatarSetState;

    window.avatarSetState = function (state) {
        if (_mode === 'live2d') setState(state);
        else if (_svgSetState) _svgSetState(state);
    };

    // ── Mode switcher ────────────────────────────────────────────────────────
    window.switchAvatarMode = function (mode) {
        _mode = mode;

        const svgCanvas = document.getElementById('avatar-canvas');
        const l2dCanvas = document.getElementById('avatar-live2d-canvas');
        if (!svgCanvas || !l2dCanvas) return;

        if (mode === 'live2d') {
            svgCanvas.style.display = 'none';
            l2dCanvas.style.display = 'block';
            init();   // no-op if already loaded
        } else {
            svgCanvas.style.display = '';
            l2dCanvas.style.display = 'none';
        }

        // Highlight active button
        document.querySelectorAll('.av-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    };

    window.avatarLive2DSetState = setState;

})();
