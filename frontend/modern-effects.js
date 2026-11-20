// // ============================================
// //  ANYA AI — Modern Theme Effects v3
// //  Canvas BG: static stars + network + waves
// //  Welcome icon click → bounce → burst stars
// //  Cursor trail, click ripples
// //  Selective futuristic text accents
// //  Fixed multicolour swatch (not rainbow)
// // ============================================

(function () {
    'use strict';

    function isModern() {
        return document.body.classList.contains('style-modern');
    }

    // ==========================================
    //  CANVAS — stars, network, waves, scan
    //  NO random balls drifting everywhere —
    //  balls only burst from the ✦ icon on click
    // ==========================================
    let canvas, ctx, animFrame;
    let W = 0, H = 0;

    const bgStars = [];   // background blinking stars (static positions)
    const nodes = [];   // network nodes
    const bursts = [];   // particle bursts from ✦ click

    function initCanvas() {
        canvas = document.getElementById('modern-bg-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'modern-bg-canvas';
            document.body.prepend(canvas);
        }
        ctx = canvas.getContext('2d');
        resizeCanvas();
        populateScene();
    }

    function resizeCanvas() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function populateScene() {
        bgStars.length = 0;
        nodes.length = 0;

        // 160 blinking background stars
        const starPalette = ['#00f5ff', '#a76bff', '#ffffff', '#c8d8ff', '#ffd700', '#6382ff'];
        for (let i = 0; i < 160; i++) {
            bgStars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.6 + 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.01 + 0.003,
                color: starPalette[Math.floor(Math.random() * starPalette.length)],
                sparkle: Math.random() > 0.7   // 30% get cross-sparkle
            });
        }

        // 28 network nodes
        for (let i = 0; i < 28; i++) {
            nodes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.38,
                vy: (Math.random() - 0.5) * 0.38,
                r: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.25
            });
        }
    }

    // ---- Draw background stars ----
    function drawBgStars(ts) {
        for (const s of bgStars) {
            const a = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(ts * s.speed + s.phase));
            ctx.save();
            ctx.globalAlpha = a * 0.65;
            ctx.fillStyle = s.color;
            ctx.shadowBlur = 7;
            ctx.shadowColor = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();

            if (s.sparkle && Math.sin(ts * s.speed * 0.6 + s.phase) > 0.65) {
                ctx.strokeStyle = s.color;
                ctx.lineWidth = 0.5;
                ctx.globalAlpha = a * 0.3;
                ctx.beginPath();
                ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y);
                ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ---- Draw network ----
    function drawNetwork() {
        const maxD = 145;
        for (const n of nodes) {
            n.x += n.vx; n.y += n.vy;
            if (n.x < 0 || n.x > W) n.vx *= -1;
            if (n.y < 0 || n.y > H) n.vy *= -1;
        }
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < maxD) {
                    ctx.save();
                    ctx.globalAlpha = (1 - d / maxD) * 0.2;
                    ctx.strokeStyle = '#6382ff';
                    ctx.lineWidth = 0.8;
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = '#a76bff';
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        for (const n of nodes) {
            ctx.save();
            ctx.globalAlpha = n.alpha * 0.7;
            ctx.fillStyle = '#a76bff';
            ctx.shadowBlur = 6; ctx.shadowColor = '#a76bff';
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // ---- Draw waves ----
    function drawWaves(ts) {
        const cfgs = [
            { yR: 0.18, amp: 28, freq: 0.005, sp: 0.0008, c: 'rgba(99,130,255,', a: 0.09 },
            { yR: 0.44, amp: 20, freq: 0.007, sp: 0.0006, c: 'rgba(0,245,255,', a: 0.07 },
            { yR: 0.68, amp: 32, freq: 0.004, sp: 0.0011, c: 'rgba(167,107,255,', a: 0.08 },
            { yR: 0.86, amp: 16, freq: 0.009, sp: 0.0007, c: 'rgba(99,130,255,', a: 0.06 },
        ];
        for (const c of cfgs) {
            ctx.save();
            ctx.globalAlpha = c.a;
            ctx.strokeStyle = c.c + '1)';
            ctx.lineWidth = 1.4;
            ctx.shadowBlur = 9; ctx.shadowColor = c.c + '0.55)';
            ctx.beginPath();
            const yB = H * c.yR;
            for (let x = 0; x <= W; x += 3) {
                const y = yB + c.amp * Math.sin(x * c.freq + ts * c.sp);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    // ---- Draw scan line ----
    function drawScanLine(ts) {
        const period = 6000;
        const prog = (ts % period) / period;
        const y = prog * H;
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(0,245,255,0)');
        grad.addColorStop(0.25, 'rgba(0,245,255,0.8)');
        grad.addColorStop(0.5, 'rgba(167,107,255,1)');
        grad.addColorStop(0.75, 'rgba(0,245,255,0.8)');
        grad.addColorStop(1, 'rgba(0,245,255,0)');
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,245,255,0.5)';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
    }

    // ---- Burst particles from ✦ icon click ----
    // bursts[] entries: { x, y, particles[], age, maxAge }
    function drawBursts(ts) {
        for (let b = bursts.length - 1; b >= 0; b--) {
            const burst = bursts[b];
            burst.age++;
            if (burst.age > burst.maxAge) { bursts.splice(b, 1); continue; }

            const lifeRatio = burst.age / burst.maxAge;

            for (const p of burst.particles) {
                // Phase 1 (0-0.3): orb rises & brightens at icon
                // Phase 2 (0.3-1): explodes outward into mini stars
                if (lifeRatio < 0.3) {
                    // Rising phase: draw single bright orb at icon
                    const riseRatio = lifeRatio / 0.3;
                    const oy = burst.y - riseRatio * 30;  // moves up 30px
                    const brightness = 0.5 + riseRatio * 0.5;
                    ctx.save();
                    ctx.globalAlpha = brightness * 0.9;
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 20 + riseRatio * 30;
                    ctx.shadowColor = p.color;
                    ctx.beginPath();
                    ctx.arc(burst.x + p.ox * 0.1, oy, p.r * (1 + riseRatio), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                } else {
                    // Burst phase: fly outward, fade
                    const burstRatio = (lifeRatio - 0.3) / 0.7;
                    const px = burst.x + p.vx * burstRatio * burst.maxAge * 1.2;
                    const py = burst.y + p.vy * burstRatio * burst.maxAge * 1.2;
                    const alpha = (1 - burstRatio) * 0.9;
                    const radius = p.r * (1 - burstRatio * 0.5);

                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = p.color;
                    ctx.beginPath();
                    ctx.arc(px, py, Math.max(0.5, radius), 0, Math.PI * 2);
                    ctx.fill();

                    // Tiny cross-sparkle on some particles
                    if (p.sparkle && burstRatio < 0.5) {
                        ctx.strokeStyle = p.color;
                        ctx.lineWidth = 0.6;
                        ctx.globalAlpha = alpha * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(px - radius * 3, py); ctx.lineTo(px + radius * 3, py);
                        ctx.moveTo(px, py - radius * 3); ctx.lineTo(px, py + radius * 3);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        }
    }

    function spawnBurst(iconEl) {
        const rect = iconEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const colors = ['#00f5ff', '#a76bff', '#ffd700', '#ff6be8', '#ffffff', '#6382ff', '#39ff14'];
        const count = 42;
        const particles = [];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
            const speed = 1.2 + Math.random() * 2.2;
            particles.push({
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5, // slight upward bias
                ox: (Math.random() - 0.5) * 8,
                r: Math.random() * 3 + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                sparkle: Math.random() > 0.6
            });
        }

        bursts.push({ x: cx, y: cy, particles, age: 0, maxAge: 90 });
    }

    // ---- Main render loop ----
    function renderLoop(ts) {
        if (!isModern()) {
            cancelAnimationFrame(animFrame);
            if (ctx) ctx.clearRect(0, 0, W, H);
            return;
        }
        ctx.clearRect(0, 0, W, H);
        drawWaves(ts);
        drawBgStars(ts);
        drawNetwork();
        drawBursts(ts);
        drawScanLine(ts);
        animFrame = requestAnimationFrame(renderLoop);
    }

    function startBG() {
        cancelAnimationFrame(animFrame);
        initCanvas();
        animFrame = requestAnimationFrame(renderLoop);
    }

    function stopBG() {
        cancelAnimationFrame(animFrame);
        if (ctx) ctx.clearRect(0, 0, W, H);
    }

    // ==========================================
    //  WELCOME ICON CLICK — bounce + burst
    // ==========================================
    function hookWelcomeIcon() {
        const icon = document.querySelector('.welcome-icon');
        if (!icon || icon.dataset.burstHooked) return;
        icon.dataset.burstHooked = '1';

        icon.style.cursor = 'pointer';

        icon.addEventListener('click', function (e) {
            if (!isModern()) return;
            e.stopPropagation();

            // CSS bounce + brighten animation
            icon.style.transition = 'transform 0.15s ease, filter 0.15s ease';
            // Step 1: move up & brighten
            icon.style.transform = 'translateY(-28px) scale(1.35)';
            icon.style.filter = 'drop-shadow(0 0 32px rgba(0,245,255,1)) brightness(2)';

            setTimeout(() => {
                // Step 2: burst
                spawnBurst(icon);

                // Step 3: icon snaps back
                icon.style.transform = 'translateY(0) scale(1)';
                icon.style.filter = 'drop-shadow(0 0 18px rgba(0,245,255,0.65))';
            }, 220);
        });
    }

    // ==========================================
    //  CURSOR TRAIL
    // ==========================================
    const TRAIL_LEN = 20;
    const trailDots = [];
    let mx = -999, my = -999;

    function buildTrail() {
        document.querySelectorAll('.cursor-trail-dot').forEach(d => d.remove());
        trailDots.length = 0;
        for (let i = 0; i < TRAIL_LEN; i++) {
            const el = document.createElement('div');
            el.className = 'cursor-trail-dot';
            const sz = Math.max(2, (1 - i / TRAIL_LEN) * 12);
            // gradient from cyan at head to violet at tail
            const hue = 185 + (i / TRAIL_LEN) * 95;
            el.style.cssText = `width:${sz}px;height:${sz}px;
                background:radial-gradient(circle,hsl(${hue},100%,68%) 0%,transparent 70%);
                opacity:0;`;
            document.body.appendChild(el);
            trailDots.push({ el, x: -999, y: -999 });
        }
    }

    function tickTrail() {
        if (isModern()) {
            trailDots[0].x += (mx - trailDots[0].x) * 0.38;
            trailDots[0].y += (my - trailDots[0].y) * 0.38;
            for (let i = 1; i < TRAIL_LEN; i++) {
                trailDots[i].x += (trailDots[i - 1].x - trailDots[i].x) * 0.38;
                trailDots[i].y += (trailDots[i - 1].y - trailDots[i].y) * 0.38;
            }
            for (let i = 0; i < TRAIL_LEN; i++) {
                const d = trailDots[i];
                d.el.style.left = d.x + 'px';
                d.el.style.top = d.y + 'px';
                d.el.style.opacity = ((1 - i / TRAIL_LEN) * 0.75).toString();
            }
        } else {
            trailDots.forEach(d => { d.el.style.opacity = '0'; });
        }
        requestAnimationFrame(tickTrail);
    }

    // ==========================================
    //  CLICK RIPPLES (for regular clicks, not icon)
    // ==========================================
    function spawnRipple(x, y) {
        if (!isModern()) return;
        const colors = ['rgba(0,245,255,0.65)', 'rgba(167,107,255,0.5)', 'rgba(255,215,0,0.35)'];
        colors.forEach((c, i) => {
            const el = document.createElement('div');
            el.className = 'click-ripple';
            el.style.cssText = `left:${x}px;top:${y}px;border:2px solid ${c};animation-delay:${i * 65}ms;`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 780 + i * 65);
        });
    }

    // ==========================================
    //  SELECTIVE FUTURISTIC TEXT ACCENTS
    //  Only applied to a few key words/phrases.
    //  NOT every word — subtle, powerful.
    // ==========================================

    // Words that get gradient animation treatment
    const POWER_WORDS = ['anya', 'ai', 'assistant', 'intelligent', 'online', 'tools', 'hello'];

    let _textDone = false;

    function applyTextAccents() {
        if (_textDone) return;
        _textDone = true;

        // 1. Welcome paragraph — accent just "AI" and key power nouns
        _accentPowerWords('.welcome-content p');

        // 2. Input hint — leave mostly plain but accent kbd-like words
        // (no change — already styled by CSS Exo2)

        // 3. Status text — make "Online" glow cyan
        _accentPowerWords('.status-text');

        // 4. Tool card names — accent first word only with Orbitron weight
        document.querySelectorAll('.tool-card-name').forEach(el => {
            if (el.dataset.ta) return;
            el.dataset.ta = '1';
            el.style.fontFamily = "'Exo 2', sans-serif";
            el.style.fontWeight = '700';
            el.style.letterSpacing = '0.5px';
            el.style.color = 'rgba(210,225,255,0.95)';
        });

        // 5. Mode card labels — Orbitron, single accent colour
        document.querySelectorAll('.mode-card-label').forEach((el, i) => {
            if (el.dataset.ta) return;
            el.dataset.ta = '1';
            el.style.fontFamily = "'Orbitron', sans-serif";
            el.style.fontWeight = '700';
            el.style.fontSize = '0.72rem';
            el.style.letterSpacing = '1px';
            el.style.color = i % 2 === 0 ? '#00f5ff' : '#a76bff';
        });
    }

    function _accentPowerWords(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.ta) return;
            el.dataset.ta = '1';

            // Walk text nodes
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const tns = [];
            let n;
            while ((n = walker.nextNode())) if (n.nodeValue.trim()) tns.push(n);

            tns.forEach(tn => {
                const words = tn.nodeValue.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                words.forEach(w => {
                    if (/\s+/.test(w)) {
                        frag.appendChild(document.createTextNode(w));
                    } else if (POWER_WORDS.includes(w.toLowerCase().replace(/[^a-z]/g, ''))) {
                        // This is a key word — give it gradient animation
                        const span = document.createElement('span');
                        span.className = 'mw-flow';
                        span.textContent = w;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(w));
                    }
                });
                tn.parentNode.replaceChild(frag, tn);
            });
        });
    }

    function resetTextAccents() {
        document.querySelectorAll('[data-ta]').forEach(el => {
            delete el.dataset.ta;
            el.style.fontFamily = '';
            el.style.fontWeight = '';
            el.style.letterSpacing = '';
            el.style.color = '';
        });
        _textDone = false;
    }

    // ==========================================
    //  MULTICOLOUR SWATCH PATCH
    //  Replace rainbow swatch with true multicolour
    //  (distinct solid colour blobs, not a stripe)
    // ==========================================
    function patchMulticolourSwatch() {
        const container = document.getElementById('color-swatches');
        if (!container) return;

        // Replace rainbow div
        const rainbow = container.querySelector('[data-accent="rainbow"]');
        if (rainbow) {
            rainbow.dataset.accent = 'multicolour';
            // Remove all swatch-* classes, add correct one
            rainbow.className = rainbow.className
                .split(' ')
                .filter(c => !c.startsWith('swatch-'))
                .join(' ') + ' swatch-multicolour';
            rainbow.title = 'Multicolour (distinct colour pops)';
            rainbow.setAttribute('onclick', "setAccent('multicolour')");
        }

        // Patch label text
        const labelSpan = document.querySelector('#swatch-labels span');
        if (labelSpan && labelSpan.innerHTML.includes('Rainbow')) {
            labelSpan.innerHTML = labelSpan.innerHTML.replace('Rainbow', 'Multicolour');
        }

        // If accent-rainbow is currently active, remap to multicolour
        if (document.body.classList.contains('accent-rainbow')) {
            document.body.classList.remove('accent-rainbow');
            document.body.classList.add('accent-multicolour');
            localStorage.setItem('anya-accent', 'multicolour');
        }

        // Patch setAccent to handle 'multicolour'
        const origSetAccent = window.setAccent;
        if (origSetAccent && !window._setAccentPatched) {
            window._setAccentPatched = true;
            window.setAccent = function (accent) {
                // Map rainbow → multicolour silently
                if (accent === 'rainbow') accent = 'multicolour';
                origSetAccent(accent);
                // Ensure multicolour body class is set
                if (accent === 'multicolour') {
                    document.body.classList.remove('accent-rainbow');
                    document.body.classList.add('accent-multicolour');
                }
            };
        }
    }

    // ==========================================
    //  CHAT AREA — FALLING LINES CANVAS
    //  A separate low-opacity canvas inside #chat-box
    //  draws short horizontal lines drifting downward,
    //  giving a data-stream / matrix feel.
    // ==========================================
    let chatCanvas = null, chatCtx = null, chatAnimFrame = null;
    const chatLines = [];

    function initChatCanvas() {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;

        // Ensure positioning context
        if (getComputedStyle(chatBox).position === 'static') {
            chatBox.style.position = 'relative';
        }

        // Remove any pre-existing chat canvas
        if (chatCanvas) { chatCanvas.remove(); chatCanvas = null; chatCtx = null; }

        chatCanvas = document.createElement('canvas');
        chatCanvas.id = 'chat-lines-canvas';
        chatCanvas.style.cssText = [
            'position:absolute', 'top:0', 'left:0',
            'width:100%', 'height:100%',
            'pointer-events:none', 'opacity:0.07', 'z-index:0'
        ].join(';');
        chatBox.appendChild(chatCanvas);
        chatCtx = chatCanvas.getContext('2d');

        resizeChatCanvas();

        // Populate lines across full canvas height so they start at varied Y
        chatLines.length = 0;
        const lineColors = ['#00f5ff', '#a76bff', '#6382ff', '#00f5ff'];
        for (let i = 0; i < 18; i++) {
            chatLines.push({
                x:     Math.random() * chatCanvas.width,
                y:     Math.random() * chatCanvas.height,
                w:     40 + Math.random() * 80,
                speed: 0.3 + Math.random() * 0.7,
                color: lineColors[Math.floor(Math.random() * lineColors.length)],
                alpha: 0.45 + Math.random() * 0.55
            });
        }
    }

    function resizeChatCanvas() {
        if (!chatCanvas) return;
        const chatBox = chatCanvas.parentElement;
        if (!chatBox) return;
        chatCanvas.width  = chatBox.offsetWidth;
        chatCanvas.height = chatBox.offsetHeight;
    }

    function tickChatCanvas() {
        if (!isModern() || !chatCtx || !chatCanvas) {
            chatAnimFrame = null;
            return;
        }
        const w = chatCanvas.width;
        const h = chatCanvas.height;
        chatCtx.clearRect(0, 0, w, h);

        for (const line of chatLines) {
            line.y += line.speed;
            if (line.y > h) {
                line.y = -2;
                line.x = Math.random() * w;
                line.w = 40 + Math.random() * 80;
            }
            chatCtx.save();
            chatCtx.globalAlpha = line.alpha;
            chatCtx.strokeStyle = line.color;
            chatCtx.lineWidth = 1;
            chatCtx.shadowBlur = 5;
            chatCtx.shadowColor = line.color;
            chatCtx.beginPath();
            chatCtx.moveTo(line.x, line.y);
            chatCtx.lineTo(line.x + line.w, line.y);
            chatCtx.stroke();
            chatCtx.restore();
        }

        chatAnimFrame = requestAnimationFrame(tickChatCanvas);
    }

    function startChatCanvas() {
        if (!chatCanvas) initChatCanvas();
        if (chatCanvas && !chatAnimFrame) tickChatCanvas();
    }

    function stopChatCanvas() {
        if (chatAnimFrame) { cancelAnimationFrame(chatAnimFrame); chatAnimFrame = null; }
        if (chatCtx && chatCanvas) chatCtx.clearRect(0, 0, chatCanvas.width, chatCanvas.height);
    }

    // ==========================================
    //  STYLE OBSERVER
    // ==========================================
    function watchBody() {
        new MutationObserver(() => {
            if (isModern()) {
                startBG();
                startChatCanvas();
                // Re-hook icon in case welcome screen changed
                setTimeout(hookWelcomeIcon, 300);
                applyTextAccents();
            } else {
                stopBG();
                stopChatCanvas();
                resetTextAccents();
            }
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // ==========================================
    //  BOOT
    // ==========================================
    function boot() {
        if (!document.getElementById('modern-bg-canvas')) {
            const c = document.createElement('canvas');
            c.id = 'modern-bg-canvas';
            document.body.prepend(c);
        }

        buildTrail();
        requestAnimationFrame(tickTrail);

        document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
        document.addEventListener('click', e => {
            // Don't spawn ripple if clicking the welcome icon (that has its own burst)
            if (!e.target.closest('.welcome-icon')) {
                spawnRipple(e.clientX, e.clientY);
            }
        });
        window.addEventListener('resize', () => {
            if (canvas) resizeCanvas();
            populateScene();
            resizeChatCanvas();
        });

        watchBody();
        patchMulticolourSwatch();

        if (isModern()) {
            startBG();
            startChatCanvas();
            setTimeout(hookWelcomeIcon, 400);
            applyTextAccents();
        }

        // Re-run swatch patch when settings modal opens (modal renders lazily)
        const origOpen = window.openSettings;
        if (origOpen && !window._settingsPatchedME) {
            window._settingsPatchedME = true;
            window.openSettings = function (section) {
                origOpen(section);
                setTimeout(patchMulticolourSwatch, 80);
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window._modernPatchSwatch = patchMulticolourSwatch;
    window._modernHookIcon = hookWelcomeIcon;

})();