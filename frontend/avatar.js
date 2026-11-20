/**
 * avatar.js — CSS/SVG animated character for Anya AI
 * States: idle | talk | think | happy | worried
 * No external deps. Self-contained IIFE.
 */
(function () {

    // ── SVG face definition ─────────────────────────────────────────────────
    // Hair colour matches --accent-primary (#a76bff / #7c4de0 at base).
    // Eyelid rects positioned to cover each eye from top;
    // CSS will scaleY(1) them to blink.
    const AVATAR_SVG = `
<svg id="avatar-face" viewBox="0 0 200 235"
     xmlns="http://www.w3.org/2000/svg"
     class="avatar-svg avatar-state-idle">

  <!-- ── 1. CLOTHES / BODY ── -->
  <g class="av-body">
    <path d="M55,225 Q100,212 145,225 L152,240 L48,240 Z" fill="#1b2040"/>
    <path d="M84,175 L84,205 Q100,212 116,205 L116,175 Z"
          rx="10" fill="#ffd0ba" style="border-radius:10px"/>
    <path d="M80,196 Q100,210 120,196" stroke="#252c54" stroke-width="1.8"
          fill="none" stroke-linecap="round"/>
  </g>

  <!-- ── 2. HAIR (back) ── -->
  <g class="av-hair-back">
    <ellipse cx="100" cy="92" rx="70" ry="72" fill="#6b30d4"/>
    <path d="M40,95 Q28,168 44,228 Q60,242 72,222 Q66,172 62,118 Z"
          fill="#6b30d4"/>
    <path d="M160,95 Q172,168 156,228 Q140,242 128,222 Q134,172 138,118 Z"
          fill="#6b30d4"/>
  </g>

  <!-- ── 3. HEAD FILL ── -->
  <ellipse cx="100" cy="114" rx="63" ry="67" fill="#ffd0ba"/>

  <!-- ── 4. HAIR (front/fringe) ── -->
  <g class="av-hair-front">
    <path d="M37,98 Q33,48 100,32 Q167,48 163,98
             Q155,58 100,53 Q45,58 37,98 Z" fill="#6b30d4"/>
    <!-- side flows -->
    <path d="M37,98 Q29,122 34,143 Q46,124 44,103 Z" fill="#6b30d4"/>
    <path d="M163,98 Q171,122 166,143 Q154,124 156,103 Z" fill="#6b30d4"/>
    <!-- inner bangs -->
    <path d="M60,74 Q53,93 58,112 Q70,89 67,70 Z" fill="#6b30d4"/>
    <path d="M140,74 Q147,93 142,112 Q130,89 133,70 Z" fill="#6b30d4"/>
    <!-- highlight sheen -->
    <path d="M72,42 Q94,36 99,53 Q83,39 72,42 Z"
          fill="#c4a0ff" opacity="0.55"/>
  </g>

  <!-- ── 5. EARS ── -->
  <ellipse cx="37" cy="116" rx="10" ry="14" fill="#ffd0ba"/>
  <ellipse cx="163" cy="116" rx="10" ry="14" fill="#ffd0ba"/>
  <ellipse cx="37"  cy="116" rx="6"  ry="9"  fill="#f5b090" opacity="0.5"/>
  <ellipse cx="163" cy="116" rx="6"  ry="9"  fill="#f5b090" opacity="0.5"/>

  <!-- ── 6. LEFT EYE ── -->
  <g id="av-eye-L">
    <!-- socket / lash base -->
    <ellipse cx="75" cy="111" rx="17" ry="19" fill="#1c1228"/>
    <!-- iris -->
    <circle cx="75" cy="111" r="13" fill="#7c4de0"/>
    <circle cx="75" cy="109" r="10" fill="#9d6efc"/>
    <!-- pupil -->
    <circle cx="75" cy="111" r="6"  fill="#1c1228"/>
    <!-- shine -->
    <circle cx="82" cy="103" r="4.5" fill="white"/>
    <circle cx="70" cy="117" r="2.5" fill="white" opacity="0.4"/>
    <!-- upper lash -->
    <path d="M57,106 Q75,96 93,106" stroke="#1c1228" stroke-width="2.5"
          fill="none" stroke-linecap="round"/>
    <!-- EYELID — scaleY(0) normally; CSS blinking transitions to scaleY(1) -->
    <rect class="av-eyelid" x="57" y="91" width="36" height="40"
          rx="3" fill="#ffd0ba"/>
  </g>

  <!-- ── 7. RIGHT EYE ── -->
  <g id="av-eye-R">
    <ellipse cx="125" cy="111" rx="17" ry="19" fill="#1c1228"/>
    <circle cx="125" cy="111" r="13" fill="#7c4de0"/>
    <circle cx="125" cy="109" r="10" fill="#9d6efc"/>
    <circle cx="125" cy="111" r="6"  fill="#1c1228"/>
    <circle cx="132" cy="103" r="4.5" fill="white"/>
    <circle cx="120" cy="117" r="2.5" fill="white" opacity="0.4"/>
    <path d="M107,106 Q125,96 143,106" stroke="#1c1228" stroke-width="2.5"
          fill="none" stroke-linecap="round"/>
    <rect class="av-eyelid" x="107" y="91" width="36" height="40"
          rx="3" fill="#ffd0ba"/>
  </g>

  <!-- ── 8. EYEBROWS ── -->
  <g id="av-brows">
    <path id="brow-L" d="M59,90 Q75,83 91,87"
          stroke="#4a2e18" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path id="brow-R" d="M109,87 Q125,83 141,90"
          stroke="#4a2e18" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>

  <!-- ── 9. NOSE ── -->
  <path d="M97,133 Q100,139 103,133"
        stroke="#e8a070" stroke-width="1.5" fill="none" stroke-linecap="round"/>

  <!-- ── 10. BLUSH ── -->
  <ellipse cx="56"  cy="132" rx="15" ry="8" fill="#ff85a5" opacity="0.22"/>
  <ellipse cx="144" cy="132" rx="15" ry="8" fill="#ff85a5" opacity="0.22"/>

  <!-- ── 11. MOUTH ── -->
  <g id="av-mouth">
    <!-- idle smile shown by default -->
    <path id="av-smile"
          d="M86,152 Q100,165 114,152"
          stroke="#e06078" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <!-- open mouth shown while talking — scaleY driven by CSS -->
    <g id="av-mouth-open" class="av-mouth-open-group">
      <ellipse cx="100" cy="156" rx="10" ry="7" fill="#1a0c18"/>
      <rect x="93" y="152" width="14" height="5" rx="2.5" fill="white" opacity="0.85"/>
    </g>
  </g>

  <!-- ── 12. HAIR ORNAMENT (bow) ── -->
  <g transform="translate(150,51) rotate(-10)">
    <path d="M-12,0 Q-5,-11 0,-2 Q5,-11 12,0 Q5,11 0,2 Q-5,11 -12,0 Z"
          fill="#c084fc"/>
    <circle cx="0" cy="0" r="3.8" fill="#9a40e8"/>
  </g>

</svg>`;

    // ── State management ────────────────────────────────────────────────────
    const ALL_STATES = ["idle", "talk", "think", "happy", "worried"];
    let _currentState = "idle";
    let _blinkTimer   = null;
    let _worryTimer   = null;    // auto-revert from worried → idle

    function setState(state) {
        if (!ALL_STATES.includes(state)) return;
        _currentState = state;

        const face = document.getElementById("avatar-face");
        if (!face) return;

        ALL_STATES.forEach(s => face.classList.remove("avatar-state-" + s));
        face.classList.add("avatar-state-" + state);

        // Auto-revert from worried to idle after 4 s
        if (state === "worried") {
            clearTimeout(_worryTimer);
            _worryTimer = setTimeout(() => setState("idle"), 4000);
        }
    }

    // ── Blink loop ──────────────────────────────────────────────────────────
    function scheduleBlink() {
        const delay = 2500 + Math.random() * 4000;   // 2.5 – 6.5 s
        _blinkTimer = setTimeout(() => {
            triggerBlink();
            scheduleBlink();
        }, delay);
    }

    function triggerBlink() {
        // Occasionally do a double-blink
        const face = document.getElementById("avatar-face");
        if (!face) return;
        face.classList.add("av-blinking");
        setTimeout(() => {
            const f = document.getElementById("avatar-face");
            if (f) f.classList.remove("av-blinking");
        }, 220);
    }

    // ── Initialise ──────────────────────────────────────────────────────────
    function init() {
        const canvas = document.getElementById("avatar-canvas");
        if (!canvas) return;
        canvas.innerHTML = AVATAR_SVG;
        scheduleBlink();
        setState("idle");
    }

    function toggleAvatar() {
        const panel = document.getElementById("avatar-panel");
        if (!panel) return;
        const isCollapsed = panel.classList.toggle("avatar-collapsed");
        const chevron = panel.querySelector(".av-chevron");
        if (chevron) chevron.style.transform = isCollapsed ? "rotate(180deg)" : "";
    }

    // ── Public API ──────────────────────────────────────────────────────────
    window.avatarSetState = setState;
    window.toggleAvatar   = toggleAvatar;

    // Auto-init after DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
