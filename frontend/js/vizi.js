/**
 * VIZITOR — Vizi Helper Robot Module
 * SIH 2026 / S157 — The ODRISCOLLS
 * Additive interactive accessibility companion
 */

(function () {
    "use strict";

    // Guard against duplicate initialization
    if (window.__VIZI_INITIALIZED__) return;
    window.__VIZI_INITIALIZED__ = true;

    // Storage Keys (Single Source of Truth)
    const STORAGE_KEY_ENABLED = "vizitor_vizi_enabled";
    const STORAGE_KEY_SOUND = "vizitor_vizi_sound";
    const STORAGE_KEY_LAST_PAGE = "vizitor_vizi_last_page";
    const STORAGE_KEY_ONBOARDED = "vizitor_vizi_onboarded";

    // Timing constants
    const COOLDOWN_MIN_SEC = 9;
    const COOLDOWN_MAX_SEC = 18;

    // Page Hierarchy for Navigation Cues
    const PAGE_LEVELS = {
        "index.html": 0,
        "signup.html": 0,
        "verify-otp.html": 0,
        "forgot-password.html": 0,
        "reset-password.html": 0,
        "dashboard.html": 1,
        "appointments.html": 2,
        "queue.html": 2,
        "crowd.html": 3,
        "crowd-forecast.html": 3,
        "hospital-map.html": 3,
        "healthcare.html": 4,
        "reports.html": 4,
        "analytics.html": 4,
        "arcade.html": 5,
        "notifications.html": 6,
        "profile.html": 6,
        "help.html": 6
    };

    // State Variables
    let isEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) === "true";
    let isSoundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) === "true";
    let currentState = "idle";
    let autonomousTimer = null;
    let speechTimer = null;
    let audioCtx = null;
    let containerEl = null;
    let robotEl = null;
    let bubbleEl = null;
    let bubbleTextEl = null;
    let parachuteEl = null;
    let elevatorEl = null;
    let posX = 0;
    let posY = 0;
    let walkDirection = -1; // -1 = moving left, 1 = moving right

    // ============================================================
    // SOUND EFFECTS ENGINE (Web Audio API Synthesizer)
    // Zero dependencies, ultra-lightweight, 100% reliable
    // ============================================================
    function initAudioContext() {
        if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioClass();
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    function playSound(type) {
        if (!isSoundEnabled) return;
        try {
            initAudioContext();
            if (!audioCtx) return;

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            // Master volume limit: soft and gentle (0.06 max)
            const vol = 0.06;

            switch (type) {
                case "pop":
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(550, now);
                    osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);
                    gain.gain.setValueAtTime(vol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    osc.start(now);
                    osc.stop(now + 0.06);
                    break;

                case "step":
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(140, now);
                    gain.gain.setValueAtTime(vol * 0.4, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
                    osc.start(now);
                    osc.stop(now + 0.03);
                    break;

                case "jump":
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(320, now);
                    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
                    gain.gain.setValueAtTime(vol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;

                case "elevator":
                    // Two-tone chime (C5 -> E5)
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.14);
                    gain.gain.setValueAtTime(vol * 0.8, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;

                case "wave":
                case "chirp":
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(587.33, now);
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
                    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.16);
                    gain.gain.setValueAtTime(vol, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    osc.start(now);
                    osc.stop(now + 0.18);
                    break;

                case "celebration":
                    // 4-note ascending fanfare
                    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                        const noteOsc = audioCtx.createOscillator();
                        const noteGain = audioCtx.createGain();
                        noteOsc.connect(noteGain);
                        noteGain.connect(audioCtx.destination);
                        noteOsc.type = "sine";
                        noteOsc.frequency.setValueAtTime(freq, now + i * 0.08);
                        noteGain.gain.setValueAtTime(vol * 0.8, now + i * 0.08);
                        noteGain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.08 + 0.1);
                        noteOsc.start(now + i * 0.08);
                        noteOsc.stop(now + (i + 1) * 0.08 + 0.1);
                    });
                    break;

                case "jetpack":
                    osc.type = "sawtooth";
                    osc.frequency.setValueAtTime(120, now);
                    osc.frequency.linearRampToValueAtTime(260, now + 0.25);
                    gain.gain.setValueAtTime(vol * 0.4, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;

                default:
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(700, now);
                    gain.gain.setValueAtTime(vol * 0.5, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
            }
        } catch (e) {
            // Audio context safely suppressed if browser policy limits it
        }
    }

    // ============================================================
    // DOM GENERATION & SVG ROBOT
    // ============================================================
    function createViziDOM() {
        if (document.getElementById("vizi-container")) return;

        containerEl = document.createElement("div");
        containerEl.id = "vizi-container";
        if (!isEnabled) {
            containerEl.classList.add("vizi-hidden");
        }

        // SVG markup for crisp high-definition rendering at any scale
        containerEl.innerHTML = `
            <!-- Elevator Gag Overlay -->
            <div class="vizi-elevator-cage" id="vizi-elevator">
                <div class="vizi-elevator-door left"></div>
                <div class="vizi-elevator-door right"></div>
            </div>

            <!-- Parachute Accessory -->
            <svg class="vizi-parachute-canopy" viewBox="0 0 70 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 38C4 18 18 4 35 4C52 4 66 18 66 38" fill="#38BDF8" fill-opacity="0.35" stroke="#0284C7" stroke-width="2.5"/>
                <path d="M4 38L35 4L66 38" stroke="#0284C7" stroke-width="1.2" stroke-dasharray="2 2"/>
                <line x1="4" y1="38" x2="35" y2="40" stroke="#0284C7" stroke-width="1.5"/>
                <line x1="66" y1="38" x2="35" y2="40" stroke="#0284C7" stroke-width="1.5"/>
                <line x1="22" y1="18" x2="35" y2="40" stroke="#0284C7" stroke-width="1.2"/>
                <line x1="48" y1="18" x2="35" y2="40" stroke="#0284C7" stroke-width="1.2"/>
            </svg>

            <!-- Speech Bubble -->
            <div class="vizi-speech-bubble" id="vizi-speech" role="status" aria-live="polite">
                <p class="vizi-bubble-text" id="vizi-bubble-text"></p>
                <div class="vizi-speech-tail"></div>
            </div>

            <!-- Robot Body Wrapper -->
            <div class="vizi-robot-wrapper vizi-state-idle" id="vizi-robot" tabindex="0" role="button" aria-label="Vizi Assistant">
                <svg class="vizi-svg" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <!-- Jetpack Flames -->
                    <ellipse class="vizi-jetpack-flame" cx="13" cy="51" rx="3.5" ry="6" fill="#F59E0B"/>
                    <ellipse class="vizi-jetpack-flame" cx="35" cy="51" rx="3.5" ry="6" fill="#F59E0B"/>

                    <g class="vizi-svg-body">
                        <!-- Jetpack Cannisters -->
                        <rect x="9" y="32" width="7" height="14" rx="3" fill="#64748B"/>
                        <rect x="32" y="32" width="7" height="14" rx="3" fill="#64748B"/>

                        <!-- Left Arm -->
                        <g class="vizi-arm-left">
                            <rect x="5" y="27" width="5" height="13" rx="2.5" fill="#3B82F6"/>
                            <circle cx="7.5" cy="39" r="2.5" fill="#1D4ED8"/>
                        </g>

                        <!-- Right Arm (Waving/Pointing) -->
                        <g class="vizi-arm-right">
                            <rect x="38" y="27" width="5" height="13" rx="2.5" fill="#3B82F6"/>
                            <circle cx="40.5" cy="39" r="2.5" fill="#1D4ED8"/>
                        </g>

                        <!-- Torso -->
                        <rect x="12" y="24" width="24" height="22" rx="7" fill="#2563EB"/>
                        <!-- Torso Screen / VIZITOR Cross -->
                        <rect x="16" y="28" width="16" height="14" rx="4" fill="#1E293B"/>
                        <path d="M24 31V39M20 35H28" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>

                        <!-- Antenna -->
                        <line x1="24" y1="12" x2="24" y2="4" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
                        <circle class="vizi-antenna-tip" cx="24" cy="3" r="3" fill="#38BDF8"/>

                        <!-- Head Dome -->
                        <g class="vizi-head">
                            <rect x="10" y="10" width="28" height="17" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
                            <!-- Face Visor Screen -->
                            <rect x="13" y="13" width="22" height="11" rx="5" fill="#0F172A"/>
                            <!-- Expressive Digital Eyes -->
                            <ellipse class="vizi-eye" cx="19" cy="18.5" rx="2.5" ry="3" fill="#38BDF8"/>
                            <ellipse class="vizi-eye" cx="29" cy="18.5" rx="2.5" ry="3" fill="#38BDF8"/>
                            <!-- Pupil glint -->
                            <circle cx="20" cy="17.5" r="0.8" fill="#FFFFFF"/>
                            <circle cx="30" cy="17.5" r="0.8" fill="#FFFFFF"/>
                        </g>

                        <!-- Hover Base / Thruster -->
                        <ellipse cx="24" cy="46" rx="9" ry="3.5" fill="#1E293B"/>
                        <ellipse cx="24" cy="47" rx="6" ry="1.5" fill="#38BDF8" fill-opacity="0.8"/>
                    </g>
                </svg>
            </div>
        `;

        document.body.appendChild(containerEl);

        robotEl = document.getElementById("vizi-robot");
        bubbleEl = document.getElementById("vizi-speech");
        bubbleTextEl = document.getElementById("vizi-bubble-text");
        parachuteEl = containerEl.querySelector(".vizi-parachute-canopy");
        elevatorEl = document.getElementById("vizi-elevator");

        // Event Listeners
        robotEl.addEventListener("click", (e) => {
            e.stopPropagation();
            initAudioContext();
            onViziClick();
        });

        robotEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                initAudioContext();
                onViziClick();
            }
        });

        bubbleEl.addEventListener("click", (e) => {
            e.stopPropagation();
            hideSpeech();
        });

        // Watch for active modals to prevent blocking
        setupModalWatcher();

        // Check onboarding or navigation reaction
        checkNavigationReaction();
    }

    // ============================================================
    // MODAL & COLLISION AVOIDANCE
    // ============================================================
    function setupModalWatcher() {
        let isParked = false;

        function updateModalState() {
            if (!containerEl) return;
            const modalOpen = Boolean(document.querySelector(".modal.active, .modal.show, .booking-modal:not(.hidden), [role='dialog'].active, .vizitor-ui-overlay, #qrPassBackdrop, #cancelSuccessModal:not(.hidden)"));
            if (modalOpen !== isParked) {
                isParked = modalOpen;
                containerEl.classList.toggle("vizi-modal-parked", isParked);
            }
        }

        document.addEventListener("click", () => {
            setTimeout(updateModalState, 120);
        });

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                setTimeout(updateModalState, 120);
            }
        });
    }

    function isSafePosition(x, y, width = 52, height = 60) {
        // Query potential collision candidates
        const blockers = document.querySelectorAll("header, nav, .top-header, .sidebar, .modal, .booking-modal, .card-panel button, form, input, select, textarea, canvas, #interactive-map");
        const pad = 16;
        const rectA = { left: x - pad, top: y - pad, right: x + width + pad, bottom: y + height + pad };

        for (const el of blockers) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Check intersection
            const intersects = !(rectA.right < r.left || rectA.left > r.right || rectA.bottom < r.top || rectA.top > r.bottom);
            if (intersects) return false;
        }
        return true;
    }

    // ============================================================
    // STATE MACHINE & ANIMATIONS
    // ============================================================
    function setState(newState) {
        if (!robotEl) return;
        robotEl.className = `vizi-robot-wrapper vizi-state-${newState}`;
        currentState = newState;
    }

    function hideSpeech() {
        if (bubbleEl) {
            bubbleEl.classList.remove("active");
        }
        if (speechTimer) {
            clearTimeout(speechTimer);
            speechTimer = null;
        }
    }

    function say(textKeyOrRaw, durationMs = 4500) {
        if (!bubbleEl || !bubbleTextEl) return;

        let msg = textKeyOrRaw;
        if (window.VIZITOR_I18N && typeof window.VIZITOR_I18N.t === "function") {
            msg = window.VIZITOR_I18N.t(textKeyOrRaw) || textKeyOrRaw;
        }

        bubbleTextEl.textContent = msg;
        bubbleEl.classList.add("active");
        playSound("pop");

        if (speechTimer) clearTimeout(speechTimer);
        speechTimer = setTimeout(() => {
            hideSpeech();
        }, durationMs);
    }

    function celebrate() {
        setState("celebrating");
        playSound("celebration");
        say("viziMsgBookedSuccess", 5000);
        setTimeout(() => {
            setState("idle");
        }, 3200);
    }

    // ============================================================
    // PAGE NAVIGATION REACTIONS (TINY & FAST)
    // ============================================================
    function getCurrentPage() {
        const path = window.location.pathname.split("/").pop() || "index.html";
        return path.toLowerCase();
    }

    function checkNavigationReaction() {
        if (!isEnabled) return;

        const currentPage = getCurrentPage();
        const lastPage = localStorage.getItem(STORAGE_KEY_LAST_PAGE) || currentPage;
        localStorage.setItem(STORAGE_KEY_LAST_PAGE, currentPage);

        // Check if fresh onboarding needed
        const hasOnboarded = localStorage.getItem(STORAGE_KEY_ONBOARDED) === "true";
        if (!hasOnboarded) {
            // First time ever enable onboarding sequence
            localStorage.setItem(STORAGE_KEY_ONBOARDED, "true");
            setTimeout(() => {
                setState("waving");
                playSound("chirp");
                say("viziFollowMe", 5000);
                setTimeout(() => setState("idle"), 2500);
            }, 800);
            return;
        }

        if (currentPage === lastPage) {
            scheduleAutonomousAction();
            return;
        }

        const currLevel = PAGE_LEVELS[currentPage] ?? 2;
        const lastLevel = PAGE_LEVELS[lastPage] ?? 2;

        // Random chance (55%) to play a quick elevator, jetpack or parachute cue
        if (Math.random() < 0.55) {
            if (currLevel > lastLevel) {
                // Moving to deeper / lower section: parachute or jump
                playDescentCue();
            } else if (currLevel < lastLevel) {
                // Moving back / higher section: jetpack or elevator
                playAscentCue();
            } else {
                // Same level: quick wave
                setState("waving");
                playSound("wave");
                setTimeout(() => setState("idle"), 1400);
            }
        }

        scheduleAutonomousAction();
    }

    function playDescentCue() {
        if (Math.random() < 0.5) {
            // Parachute
            setState("parachuting");
            playSound("jump");
            setTimeout(() => {
                playSound("step");
                setState("idle");
            }, 1800);
        } else {
            // Jump down
            setState("jumping");
            playSound("jump");
            setTimeout(() => {
                playSound("step");
                setState("idle");
            }, 1000);
        }
    }

    function playAscentCue() {
        if (Math.random() < 0.5) {
            // Jetpack
            setState("jetpack");
            playSound("jetpack");
            setTimeout(() => {
                playSound("step");
                setState("idle");
            }, 1600);
        } else {
            // Elevator Gag
            if (!elevatorEl) return;
            elevatorEl.classList.remove("open");
            elevatorEl.classList.add("active", "closed");
            playSound("elevator");
            setTimeout(() => {
                elevatorEl.classList.remove("closed");
                elevatorEl.classList.add("open");
                setState("waving");
                playSound("chirp");
                setTimeout(() => {
                    elevatorEl.classList.remove("active", "open");
                    setState("idle");
                }, 1000);
            }, 1100);
        }
    }

    // ============================================================
    // AUTONOMOUS BEHAVIOR & GENTLE ROAMING
    // ============================================================
    function scheduleAutonomousAction() {
        if (autonomousTimer) clearTimeout(autonomousTimer);
        if (!isEnabled || document.hidden) return;

        const delay = (COOLDOWN_MIN_SEC + Math.random() * (COOLDOWN_MAX_SEC - COOLDOWN_MIN_SEC)) * 1000;
        autonomousTimer = setTimeout(() => {
            performAutonomousAction();
        }, delay);
    }

    function performAutonomousAction() {
        if (!isEnabled || document.hidden) return;

        const actions = ["walk", "look", "wave", "think", "suggestBooking"];
        const choice = actions[Math.floor(Math.random() * actions.length)];

        switch (choice) {
            case "walk":
                tinyAutonomousWalk();
                break;
            case "look":
                setState("thinking");
                setTimeout(() => setState("idle"), 2400);
                break;
            case "wave":
                setState("waving");
                playSound("wave");
                setTimeout(() => setState("idle"), 2000);
                break;
            case "suggestBooking":
                // If on dashboard, queue, or arcade and not currently in appointment flow
                const page = getCurrentPage();
                if (page === "dashboard.html" || page === "queue.html") {
                    setState("pointing");
                    say("viziMsgSuggestBooking", 4000);
                    setTimeout(() => setState("idle"), 2500);
                } else {
                    setState("thinking");
                    setTimeout(() => setState("idle"), 2000);
                }
                break;
            default:
                setState("idle");
        }

        scheduleAutonomousAction();
    }

    function tinyAutonomousWalk() {
        if (!containerEl || !isEnabled || document.hidden) return;

        // If a modal or QR pass is open, park and don't roam
        const modalOpen = Boolean(document.querySelector(".modal.active, .modal.show, .booking-modal:not(.hidden), [role='dialog'].active, .vizitor-ui-overlay, #qrPassBackdrop"));
        if (modalOpen) {
            setState("idle");
            return;
        }

        setState("walking");
        playSound("step");

        const screenW = window.innerWidth || 1200;
        const screenH = window.innerHeight || 800;
        const isMobile = screenW < 768;

        // Viewport patrol boundaries
        // containerEl starts at right: 24px, bottom: 24px (width: 52px, height: 60px)
        const leftLimit = isMobile ? -(screenW - 90) : -(screenW - 280);
        const rightLimit = 10;

        // Step distance: between 45px and 90px
        const stepDist = (45 + Math.random() * 45) * walkDirection;
        let candidateX = posX + stepDist;
        let candidateY = (Math.random() - 0.5) * 16;

        // Turn around if near boundary
        if (candidateX < leftLimit) {
            candidateX = leftLimit + 15;
            walkDirection = 1;
        } else if (candidateX > rightLimit) {
            candidateX = rightLimit - 5;
            walkDirection = -1;
        }

        // Collision safety check in viewport coordinates
        const absX = screenW - 76 + candidateX;
        const absY = screenH - 84 + candidateY;

        if (!isSafePosition(absX, absY)) {
            // Reverse direction if collision detected
            walkDirection = -walkDirection;
            candidateX = posX + (40 * walkDirection);
        }

        posX = candidateX;
        posY = candidateY;

        // Flip robot visually to face moving direction (facing left when walking left, right when walking right)
        if (robotEl) {
            robotEl.style.transform = walkDirection < 0 ? "scaleX(-1)" : "scaleX(1)";
        }

        containerEl.style.transform = `translate(${posX}px, ${posY}px)`;

        setTimeout(() => {
            setState("idle");
        }, 1400);
    }

    // ============================================================
    // CLICK INTERACTION & CONTEXT MESSAGES
    // ============================================================
    function onViziClick() {
        const page = getCurrentPage();
        const pageMessages = {
            "dashboard.html": "viziMsgDashboard",
            "appointments.html": "viziMsgAppointments",
            "queue.html": "viziMsgQueue",
            "crowd.html": "viziMsgCrowd",
            "crowd-forecast.html": "viziMsgForecast",
            "healthcare.html": "viziMsgHealthcare",
            "hospital-map.html": "viziMsgHospitalMap",
            "arcade.html": "viziMsgArcade",
            "profile.html": "viziMsgProfile",
            "reports.html": "viziMsgReports",
            "analytics.html": "viziMsgReports",
            "notifications.html": "viziMsgNotifications",
            "help.html": "viziMsgHelp"
        };

        const contextKey = pageMessages[page] || "viziMsgClick1";
        const generalKeys = ["viziMsgClick1", "viziMsgClick2", "viziMsgClick3", contextKey, contextKey];
        const chosenKey = generalKeys[Math.floor(Math.random() * generalKeys.length)];

        setState("waving");
        playSound("chirp");
        say(chosenKey, 4500);

        setTimeout(() => {
            if (currentState === "waving") setState("idle");
        }, 1800);
    }

    // ============================================================
    // ENABLE / DISABLE & SOUND CONTROLS (GLOBAL STATE API)
    // ============================================================
    function enable() {
        isEnabled = true;
        localStorage.setItem(STORAGE_KEY_ENABLED, "true");
        if (containerEl) {
            containerEl.classList.remove("vizi-hidden");
        } else {
            createViziDOM();
        }

        // Animated side entrance
        if (containerEl) {
            containerEl.style.transform = "translateX(80px)";
            containerEl.style.opacity = "0";
            setTimeout(() => {
                containerEl.style.transform = "translateX(0)";
                containerEl.style.opacity = "1";
                setState("waving");
                playSound("chirp");
                say("viziFollowMe", 4000);
                setTimeout(() => setState("idle"), 2200);
            }, 50);
        }

        scheduleAutonomousAction();
        dispatchPreferenceUpdate();
    }

    function disable() {
        isEnabled = false;
        localStorage.setItem(STORAGE_KEY_ENABLED, "false");
        if (containerEl) {
            containerEl.classList.add("vizi-hidden");
            hideSpeech();
        }
        if (autonomousTimer) {
            clearTimeout(autonomousTimer);
            autonomousTimer = null;
        }
        dispatchPreferenceUpdate();
    }

    function toggleSound(enabled) {
        if (typeof enabled === "boolean") {
            isSoundEnabled = enabled;
        } else {
            isSoundEnabled = !isSoundEnabled;
        }
        localStorage.setItem(STORAGE_KEY_SOUND, isSoundEnabled ? "true" : "false");
        if (isSoundEnabled) {
            initAudioContext();
            playSound("chirp");
        }
        dispatchPreferenceUpdate();
    }

    function dispatchPreferenceUpdate() {
        window.dispatchEvent(new CustomEvent("viziPreferenceChanged", {
            detail: {
                enabled: isEnabled,
                sound: isSoundEnabled
            }
        }));
    }

    // ============================================================
    // BOOKING SUCCESS REACTION LISTENER
    // ============================================================
    window.addEventListener("vizitorAppointmentBooked", () => {
        if (isEnabled) {
            celebrate();
        }
    });

    // Language switch listener
    window.addEventListener("vizitorLanguageChanged", () => {
        if (bubbleEl && bubbleEl.classList.contains("active")) {
            // Refresh bubble language
            hideSpeech();
        }
    });

    // Visibility listener
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (autonomousTimer) clearTimeout(autonomousTimer);
        } else if (isEnabled) {
            scheduleAutonomousAction();
        }
    });

    // ============================================================
    // PUBLIC API
    // ============================================================
    window.VIZI = {
        enable,
        disable,
        toggleSound,
        isEnabled: () => isEnabled,
        isSoundEnabled: () => isSoundEnabled,
        say,
        celebrate,
        setState
    };

    // Auto-bootstrap on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createViziDOM);
    } else {
        createViziDOM();
    }
})();
