/*
 * ============================================================
 * VIZITOR ARCADE
 * ============================================================
 *
 * Arcade is an interactive waiting-room experience.
 *
 * CORE RULES
 * ----------
 * 1. Queue information always comes from VIZITOR shared.js.
 * 2. Token + estimated wait stay visible while activities run.
 * 3. Games use a common scoring philosophy.
 * 4. No game is allowed to generate absurd/unbounded scores.
 * 5. Activities are short-session friendly.
 * 6. Visible product name remains "Arcade".
 *
 * CURRENT ARCADE MODULES
 * ----------------------
 * Articles
 * Wellness
 * Challenges
 * Mini Games
 *
 * MINI GAMES
 * ----------
 * Reaction Rush
 * Memory Flash
 * Quick Math
 * Color Match
 * Word Scramble
 * Odd One Out
 * Pattern Master
 * Target Tap
 * Signal Sort
 * Token Catch
 * Tetris
 *
 * ============================================================
 */

(function () {

    "use strict";

    const vizitor = window.VIZITOR;

    if (!vizitor) {
        console.error(
            "VIZITOR shared.js must load before arcade.js."
        );
        return;
    }


    /* ========================================================
       CONFIG
    ======================================================== */

    const ARCADE_API_BASE_URL =
        window.VIZITOR_API_URL ||
        window.API_BASE_URL ||
        "https://vizitor.onrender.com";


    const GAME_DURATION = 30;

    const SCORE_LIMIT = 1000;

    const GAME_COOLDOWN = 800;


    /* ========================================================
       STATE
    ======================================================== */

    let latestQueueStatus = null;

    let latestWaitMinutes = 0;

    let articlePanelOpen = false;

    let articleExplorer = null;

    let articleReader = null;

    let articleGrid = null;

    let articleSearch = null;

    let articleCategory = null;

    let articleRequestTimer = null;

    let articleReaderBox = null;

    let wellnessModal = null;

    let challengeModal = null;

    let gamesModal = null;

    let gameState = null;

    let queueRefreshTimer = null;


    /* ========================================================
       BASIC HELPERS
    ======================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    function getElement(id) {
        return $(id);
    }


    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.max(
            min,
            Math.min(max, value)
        );
    }


    function formatWait(minutes) {

        const value =
            Number(minutes);

        if (!Number.isFinite(value)) {
            return "—";
        }

        if (value <= 0) {
            return "Now";
        }

        if (value < 1) {
            return "<1 min";
        }

        return `${Math.ceil(value)} min`;
    }


    function randomInt(
        min,
        max
    ) {

        return Math.floor(
            Math.random() *
            (max - min + 1)
        ) + min;
    }


    function shuffle(array) {

        const result =
            [...array];

        for (
            let i = result.length - 1;
            i > 0;
            i--
        ) {

            const j =
                Math.floor(
                    Math.random() *
                    (i + 1)
                );

            [
                result[i],
                result[j]
            ] = [
                result[j],
                result[i]
            ];
        }

        return result;
    }


    function safeScore(value) {

        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.round(
            clamp(
                number,
                0,
                SCORE_LIMIT
            )
        );
    }


    /* ========================================================
       DYNAMIC ARCADE STYLES
    ======================================================== */

    function injectStyles() {

        if (
            $("vizitorArcadeDynamicStyles")
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "vizitorArcadeDynamicStyles";

        style.textContent = `

        /* ====================================================
           GLOBAL ARCADE
        ==================================================== */

        .vizitor-arcade-popup {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, .68);
            backdrop-filter: blur(10px);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition:
                opacity .25s ease,
                visibility .25s ease;
        }

        .vizitor-arcade-popup.open {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }

        .vizitor-arcade-dialog {
            width: min(1120px, 100%);
            max-height: 92vh;
            overflow: auto;
            border-radius: 28px;
            background:
                linear-gradient(
                    145deg,
                    #ffffff,
                    #f8f6ff
                );
            box-shadow:
                0 35px 100px rgba(15,23,42,.28);
            transform:
                translateY(25px)
                scale(.97);
            transition:
                transform .3s ease;
        }

        .vizitor-arcade-popup.open
        .vizitor-arcade-dialog {
            transform:
                translateY(0)
                scale(1);
        }


        /* ====================================================
           HEADER
        ==================================================== */

        .vizitor-popup-head {
            position: sticky;
            top: 0;
            z-index: 4;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 22px;
            background:
                rgba(255,255,255,.94);
            backdrop-filter: blur(15px);
            border-bottom:
                1px solid #ece7f7;
        }

        .vizitor-popup-title {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
        }

        .vizitor-popup-title-icon {
            width: 44px;
            height: 44px;
            display: grid;
            place-items: center;
            border-radius: 14px;
            background:
                linear-gradient(
                    135deg,
                    #7c3aed,
                    #4f46e5
                );
            color: white;
            font-size: 22px;
            box-shadow:
                0 10px 25px
                rgba(99,102,241,.25);
        }

        .vizitor-popup-title h2 {
            margin: 0;
            font-size: 19px;
            color: #182033;
        }

        .vizitor-popup-title p {
            margin: 3px 0 0;
            color: #7b8497;
            font-size: 12px;
        }

        .vizitor-popup-close {
            border: 0;
            width: 38px;
            height: 38px;
            border-radius: 12px;
            cursor: pointer;
            background: #f1eff8;
            color: #566074;
            font-size: 20px;
            transition:
                transform .2s ease,
                background .2s ease;
        }

        .vizitor-popup-close:hover {
            transform: rotate(8deg);
            background: #e8e3f4;
        }


        /* ====================================================
           LIVE QUEUE STRIP
        ==================================================== */

        .vizitor-live-strip {
            display: grid;
            grid-template-columns:
                repeat(3, minmax(0, 1fr));
            gap: 10px;
            padding: 14px 18px;
            background:
                linear-gradient(
                    90deg,
                    #f7f3ff,
                    #f3f7ff
                );
            border-bottom:
                1px solid #ece7f7;
        }

        .vizitor-live-item {
            min-width: 0;
            padding: 11px 13px;
            border-radius: 14px;
            background: rgba(255,255,255,.8);
            border: 1px solid #eceaf4;
        }

        .vizitor-live-label {
            display: block;
            margin-bottom: 3px;
            color: #8a91a2;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: .08em;
            font-weight: 700;
        }

        .vizitor-live-value {
            display: block;
            color: #20283b;
            font-size: 16px;
            font-weight: 800;
        }


        /* ====================================================
           GAME SELECTOR
        ==================================================== */

        .vizitor-game-list {
            padding: 22px;
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(210px, 1fr));
            gap: 14px;
        }

        .vizitor-game-card {
            position: relative;
            overflow: hidden;
            padding: 19px;
            min-height: 170px;
            text-align: left;
            border: 1px solid #ebe8f5;
            border-radius: 22px;
            background: #ffffff;
            cursor: pointer;
            transition:
                transform .22s ease,
                box-shadow .22s ease,
                border-color .22s ease;
        }

        .vizitor-game-card::before {
            content: "";
            position: absolute;
            width: 130px;
            height: 130px;
            top: -65px;
            right: -45px;
            border-radius: 50%;
            background:
                rgba(124,58,237,.08);
            transition:
                transform .35s ease;
        }

        .vizitor-game-card:hover {
            transform:
                translateY(-6px);
            border-color:
                rgba(124,58,237,.25);
            box-shadow:
                0 18px 38px
                rgba(50,45,90,.12);
        }

        .vizitor-game-card:hover::before {
            transform: scale(1.4);
        }

        .vizitor-game-icon {
            position: relative;
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            margin-bottom: 13px;
            border-radius: 15px;
            background:
                linear-gradient(
                    135deg,
                    #f0eaff,
                    #eaf0ff
                );
            font-size: 24px;
        }

        .vizitor-game-card h3 {
            position: relative;
            margin: 0 0 7px;
            color: #20283b;
            font-size: 16px;
        }

        .vizitor-game-card p {
            position: relative;
            margin: 0;
            color: #7b8497;
            line-height: 1.5;
            font-size: 12px;
        }

        .vizitor-game-duration {
            position: relative;
            display: inline-flex;
            margin-top: 14px;
            padding: 5px 8px;
            border-radius: 8px;
            background: #f5f3fa;
            color: #6d7486;
            font-size: 10px;
            font-weight: 700;
        }


        /* ====================================================
           GAME AREA
        ==================================================== */

        .vizitor-game-shell {
            padding: 20px;
        }

        .vizitor-game-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 15px;
        }

        .vizitor-game-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .vizitor-game-stat {
            padding: 8px 12px;
            border-radius: 11px;
            background: #f4f2f9;
            color: #5d6577;
            font-size: 11px;
            font-weight: 700;
        }

        .vizitor-game-stat strong {
            color: #20283b;
        }

        .vizitor-game-actions {
            display: flex;
            gap: 8px;
        }

        .vizitor-game-btn {
            border: 0;
            padding: 9px 13px;
            border-radius: 11px;
            cursor: pointer;
            background:
                linear-gradient(
                    135deg,
                    #6d5ce7,
                    #4f46e5
                );
            color: white;
            font-weight: 800;
            font-size: 11px;
            transition:
                transform .18s ease,
                box-shadow .18s ease;
        }

        .vizitor-game-btn:hover {
            transform: translateY(-2px);
            box-shadow:
                0 10px 20px
                rgba(79,70,229,.2);
        }

        .vizitor-game-btn.secondary {
            background: #efedf5;
            color: #596174;
        }

        .vizitor-game-stage {
            position: relative;
            width: 100%;
            min-height: 390px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 24px;
            background:
                radial-gradient(
                    circle at 20% 20%,
                    rgba(124,58,237,.12),
                    transparent 30%
                ),
                radial-gradient(
                    circle at 80% 80%,
                    rgba(59,130,246,.10),
                    transparent 30%
                ),
                #f8f7fc;
            border: 1px solid #e9e6f2;
        }

        .vizitor-game-result {
            text-align: center;
            padding: 30px;
        }

        .vizitor-game-result-score {
            margin: 10px 0;
            font-size: 54px;
            line-height: 1;
            font-weight: 900;
            color: #4f46e5;
        }

        .vizitor-game-result p {
            margin: 0;
            color: #737b8d;
            font-size: 13px;
        }


        /* ====================================================
           REACTION
        ==================================================== */

        .reaction-zone {
            width: min(440px, 90%);
            height: 260px;
            display: grid;
            place-items: center;
            border-radius: 28px;
            background: #dfe3eb;
            cursor: pointer;
            user-select: none;
            transition:
                background .15s ease,
                transform .15s ease;
        }

        .reaction-zone.ready {
            background: #38a169;
        }

        .reaction-zone.too-soon {
            background: #ef4444;
        }

        .reaction-zone span {
            color: white;
            font-size: 24px;
            font-weight: 900;
            text-align: center;
            padding: 20px;
        }


        /* ====================================================
           MEMORY
        ==================================================== */

        .memory-board {
            width: min(430px, 95%);
            display: grid;
            grid-template-columns:
                repeat(4, 1fr);
            gap: 9px;
        }

        .memory-card {
            aspect-ratio: 1;
            border: 0;
            border-radius: 15px;
            cursor: pointer;
            background:
                linear-gradient(
                    135deg,
                    #6657df,
                    #4f46e5
                );
            color: transparent;
            font-size: 25px;
            transition:
                transform .2s ease;
        }

        .memory-card:hover {
            transform: scale(1.04);
        }

        .memory-card.flipped,
        .memory-card.matched {
            background: white;
            color: #30384a;
            box-shadow:
                inset 0 0 0 2px #e6e2f2;
        }


        /* ====================================================
           MULTIPLE CHOICE
        ==================================================== */

        .quiz-box {
            width: min(580px, 95%);
        }

        .quiz-question {
            margin-bottom: 20px;
            color: #20283b;
            font-size: 22px;
            font-weight: 900;
            text-align: center;
        }

        .quiz-options {
            display: grid;
            grid-template-columns:
                repeat(2, minmax(0,1fr));
            gap: 10px;
        }

        .quiz-option {
            min-height: 55px;
            border: 1px solid #e6e2f0;
            border-radius: 14px;
            background: white;
            cursor: pointer;
            color: #4f5769;
            font-weight: 800;
            transition:
                transform .18s ease,
                background .18s ease;
        }

        .quiz-option:hover {
            transform: translateY(-2px);
            background: #f8f6ff;
        }


        /* ====================================================
           TARGET GAMES
        ==================================================== */

        .target-zone {
            position: absolute;
            inset: 18px;
            overflow: hidden;
            border-radius: 20px;
        }

        .target {
            position: absolute;
            width: 58px;
            height: 58px;
            display: grid;
            place-items: center;
            border: 0;
            border-radius: 50%;
            cursor: pointer;
            background:
                radial-gradient(
                    circle,
                    #fff 0 18%,
                    #ef4444 19% 36%,
                    #fff 37% 52%,
                    #ef4444 53%
                );
            box-shadow:
                0 8px 22px
                rgba(239,68,68,.24);
            transition:
                transform .12s ease;
        }

        .target:hover {
            transform: scale(1.08);
        }


        /* ====================================================
           TETRIS
        ==================================================== */

        .tetris-wrap {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: flex-start;
            gap: 20px;
            width: 100%;
            padding: 10px;
        }

        .tetris-board {
            display: grid;
            grid-template-columns:
                repeat(10, 25px);
            grid-template-rows:
                repeat(20, 25px);
            gap: 2px;
            padding: 7px;
            border-radius: 16px;
            background: #1e2230;
            box-shadow:
                0 20px 45px
                rgba(15,23,42,.2);
        }

        .tetris-cell {
            width: 25px;
            height: 25px;
            border-radius: 5px;
            background: #2b3040;
        }

        .tetris-cell.filled {
            background:
                linear-gradient(
                    135deg,
                    #7c3aed,
                    #4f46e5
                );
            box-shadow:
                inset 0 0 0 2px
                rgba(255,255,255,.16);
        }

        .tetris-side {
            width: 190px;
            padding: 17px;
            border-radius: 18px;
            background: white;
            border: 1px solid #ebe8f3;
        }

        .tetris-side h3 {
            margin: 0 0 10px;
            color: #22293a;
        }

        .tetris-side p {
            margin: 7px 0;
            color: #7c8495;
            font-size: 12px;
            line-height: 1.5;
        }

        .tetris-controls {
            display: grid;
            grid-template-columns:
                repeat(3, 1fr);
            gap: 7px;
            margin-top: 14px;
        }

        .tetris-control {
            border: 0;
            min-height: 38px;
            border-radius: 10px;
            background: #f0edf7;
            cursor: pointer;
            font-weight: 900;
            color: #4e5668;
        }

        .tetris-control:hover {
            background: #e6e0f5;
        }


        /* ====================================================
           ARTICLE / WELLNESS / CHALLENGE
        ==================================================== */

        .vizitor-arcade-section {
            padding: 22px;
        }

        .vizitor-article-grid {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
        }

        .vizitor-article-item {
            padding: 16px;
            border: 1px solid #ebe8f4;
            border-radius: 18px;
            background: white;
            cursor: pointer;
        }

        .vizitor-article-item:hover {
            border-color: #d8d0f4;
        }

        .vizitor-article-item h3 {
            margin: 0 0 7px;
            color: #22293a;
            font-size: 15px;
        }

        .vizitor-article-item p {
            margin: 0;
            color: #7a8294;
            font-size: 12px;
            line-height: 1.5;
        }

        .vizitor-wellness-grid,
        .vizitor-challenge-grid {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(210px,1fr));
            gap: 12px;
        }

        .vizitor-choice-card {
            padding: 18px;
            border-radius: 18px;
            background: white;
            border: 1px solid #ebe8f4;
            cursor: pointer;
        }

        .vizitor-choice-card:hover {
            transform: translateY(-2px);
            box-shadow:
                0 12px 28px
                rgba(50,45,90,.08);
        }

        .vizitor-choice-card h3 {
            margin: 0 0 7px;
            color: #22293a;
        }

        .vizitor-choice-card p {
            margin: 0;
            color: #7a8294;
            font-size: 12px;
            line-height: 1.5;
        }


        .wellness-active-card {
            max-width: 560px;
            margin: 0 auto;
            padding: 28px 22px;
            text-align: center;
            border: 1px solid #e9e3f5;
            border-radius: 24px;
            background: linear-gradient(145deg, #ffffff, #faf8ff);
            box-shadow: 0 18px 45px rgba(50,45,90,.08);
            animation: wellnessEnter .35s ease both;
        }
        .wellness-active-icon { font-size: 38px; margin-bottom: 8px; }
        .wellness-active-title { color:#20283b; font-size:21px; font-weight:900; }
        .wellness-active-description { max-width:430px; margin:7px auto 20px; color:#7b8497; font-size:12px; line-height:1.55; }
        .wellness-orb { width:180px; height:180px; margin:0 auto 18px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle,#fff 0 35%,#eee8ff 36% 100%); box-shadow:0 18px 45px rgba(99,102,241,.16); transition:transform .9s cubic-bezier(.22,1,.36,1); }
        .wellness-orb strong { color:#4f46e5; font-size:17px; padding:0 18px; }
        .wellness-orb span { margin-top:6px; color:#8a91a2; font-size:13px; font-weight:800; }
        .wellness-progress { height:7px; margin:0 auto 18px; overflow:hidden; border-radius:999px; background:#ece9f5; }
        .wellness-progress span { display:block; width:0; height:100%; border-radius:inherit; background:linear-gradient(90deg,#7c3aed,#4f46e5); transition:width .8s linear; }
        @keyframes wellnessEnter { from {opacity:0; transform:translateY(10px) scale(.98)} to {opacity:1; transform:translateY(0) scale(1)} }

        /* ====================================================
           MOBILE
        ==================================================== */

        @media (max-width: 700px) {

            .vizitor-live-strip {
                grid-template-columns:
                    1fr;
            }

            .vizitor-game-stage {
                min-height: 330px;
            }

            .quiz-options {
                grid-template-columns: 1fr;
            }

            .tetris-board {
                transform: scale(.82);
                transform-origin: top center;
                margin-bottom: -65px;
            }

            .tetris-side {
                width: 100%;
            }

        }



            /* ================================================
               EXPANDED ARTICLES
            ================================================= */

            #arcadeArticles {
                transition:
                    grid-column 0.25s ease,
                    min-height 0.25s ease,
                    transform 0.2s ease,
                    box-shadow 0.2s ease;
            }

            #arcadeArticles.vizitor-articles-expanded {
                grid-column: 1 / -1;
                cursor: default;
            }


            .vizitor-article-explorer {
                display: none;
                margin-top: 24px;
                padding-top: 22px;
                border-top: 1px solid #eadcff;
            }


            .vizitor-article-explorer.open {
                display: block;
                animation:
                    vizitorArticleOpen 0.25s ease;
            }


            @keyframes vizitorArticleOpen {
                from {
                    opacity: 0;
                    transform: translateY(-6px);
                }

                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }


            .vizitor-article-toolbar {
                display: grid;
                grid-template-columns:
                    minmax(0, 1fr) 200px;
                gap: 12px;
                margin-bottom: 18px;
            }


            .vizitor-article-search,
            .vizitor-article-category {
                width: 100%;
                height: 44px;
                box-sizing: border-box;
                padding: 0 13px;
                border: 1px solid #d8ddea;
                border-radius: 10px;
                background: #fff;
                color: #25334a;
                font-size: 14px;
                outline: none;
            }


            .vizitor-article-search:focus,
            .vizitor-article-category:focus {
                border-color: #7c3aed;
                box-shadow:
                    0 0 0 3px
                    rgba(124, 58, 237, 0.08);
            }


            .vizitor-article-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }


            .vizitor-article-heading h4 {
                margin: 0;
                color: #17233a;
                font-size: 16px;
            }


            .vizitor-article-heading span {
                color: #7c3aed;
                font-size: 12px;
                font-weight: 700;
            }


            .vizitor-article-grid {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 12px;
            }


            .vizitor-article-item {
                border: 1px solid #e3e7ef;
                border-radius: 12px;
                padding: 15px;
                background: #fff;
                transition:
                    transform 0.18s ease,
                    border-color 0.18s ease,
                    box-shadow 0.18s ease;
            }


            .vizitor-article-item:hover {
                transform: translateY(-2px);
                border-color: #d6bfff;
                box-shadow:
                    0 8px 22px
                    rgba(77, 45, 120, 0.08);
            }


            .vizitor-article-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 9px;
            }


            .vizitor-article-tag {
                display: inline-flex;
                padding: 4px 8px;
                border-radius: 999px;
                background: #f2eaff;
                color: #7135d6;
                font-size: 11px;
                font-weight: 700;
            }


            .vizitor-article-tag.best {
                background: #e8f8f1;
                color: #138a68;
            }


            .vizitor-article-item h5 {
                margin: 0 0 7px;
                color: #17233a;
                font-size: 15px;
                line-height: 1.35;
            }


            .vizitor-article-item p {
                margin: 0 0 13px;
                color: #697b96;
                font-size: 13px;
                line-height: 1.5;
            }


            .vizitor-article-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }


            .vizitor-reading-time {
                color: #8b9ab2;
                font-size: 12px;
                font-weight: 600;
            }


            .vizitor-read-button {
                border: 0;
                border-radius: 8px;
                padding: 8px 12px;
                background: #7c3aed;
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            }


            .vizitor-read-button:hover {
                background: #6d28d9;
            }


            .vizitor-article-empty,
            .vizitor-article-loading {
                grid-column: 1 / -1;
                padding: 24px 12px;
                text-align: center;
                font-size: 13px;
            }


            .vizitor-article-empty {
                color: #7c8ba3;
            }


            .vizitor-article-loading {
                color: #7c3aed;
                font-weight: 600;
            }


            .vizitor-article-close {
                display: inline-flex;
                margin-top: 15px;
                padding: 4px 0;
                border: 0;
                background: transparent;
                color: #7c3aed;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            }


            .vizitor-article-close:hover {
                text-decoration: underline;
            }


            /* ================================================
               ARTICLE READER
            ================================================= */

            .vizitor-article-reader {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
                background:
                    rgba(22, 16, 35, 0.48);
                backdrop-filter: blur(4px);
            }


            .vizitor-article-reader.open {
                display: flex;
            }


            .vizitor-article-reader-box {
                width: min(760px, 100%);
                max-height: 84vh;
                overflow-y: auto;
                padding: 28px;
                box-sizing: border-box;
                background: #fff;
                border-radius: 18px;
                box-shadow:
                    0 24px 80px
                    rgba(32, 20, 60, 0.22);
            }


            .vizitor-reader-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 20px;
            }


            .vizitor-reader-category {
                display: inline-flex;
                padding: 5px 9px;
                margin-bottom: 10px;
                border-radius: 999px;
                background: #f2eaff;
                color: #7135d6;
                font-size: 11px;
                font-weight: 700;
            }


            .vizitor-reader-title {
                margin: 0;
                color: #17233a;
                font-size: 25px;
                line-height: 1.25;
            }


            .vizitor-reader-close {
                width: 34px;
                height: 34px;
                flex-shrink: 0;
                border: 0;
                border-radius: 50%;
                background: #f3f4f8;
                color: #52617a;
                font-size: 20px;
                cursor: pointer;
            }


            .vizitor-reader-meta {
                margin: 12px 0 22px;
                color: #8491a6;
                font-size: 12px;
                font-weight: 600;
            }


            .vizitor-reader-summary {
                padding: 14px 16px;
                margin-bottom: 22px;
                border-left: 3px solid #7c3aed;
                border-radius: 8px;
                background: #faf8ff;
                color: #56657d;
                font-size: 14px;
                line-height: 1.6;
            }


            .vizitor-reader-content {
                color: #40516c;
                font-size: 15px;
                line-height: 1.8;
            }


            .vizitor-reader-content p {
                margin: 0 0 16px;
            }


            @media (max-width: 700px) {

                #arcadeArticles.vizitor-articles-expanded {
                    grid-column: auto;
                }

                .vizitor-article-toolbar {
                    grid-template-columns: 1fr;
                }

                .vizitor-article-grid {
                    grid-template-columns: 1fr;
                }

                .vizitor-article-heading {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .vizitor-article-reader {
                    padding: 12px;
                }

                .vizitor-article-reader-box {
                    padding: 20px;
                    max-height: 90vh;
                }

                .vizitor-reader-title {
                    font-size: 21px;
                }
            }
        `;

        document.head.appendChild(style);
    }


    // ========================================================
    // QUEUE
    // ========================================================

    function extractUserToken(queue) {

        if (!queue) {
            return "—";
        }

        if (queue.user_simulated_token) {
            return queue.user_simulated_token;
        }

        if (
            queue.you &&
            queue.you.token_display
        ) {
            return queue.you.token_display;
        }

        if (queue.user_token) {
            return queue.user_token;
        }

        if (queue.token_display) {
            return queue.token_display;
        }

        return "—";
    }


    function extractServingToken(queue) {

        if (!queue) {
            return "—";
        }

        if (queue.currently_serving_token) {
            return queue.currently_serving_token;
        }

        if (queue.current_serving_token) {
            return queue.current_serving_token;
        }

        if (queue.serving_token) {
            return queue.serving_token;
        }

        if (
            queue.currently_serving &&
            typeof queue.currently_serving === "object"
        ) {
            return (
                queue.currently_serving.token_display ||
                queue.currently_serving.token ||
                "—"
            );
        }

        return "—";
    }


    function extractWaitMinutes(queue) {

        if (!queue) {
            return 0;
        }

        const values = [
            queue.estimated_wait_minutes,
            queue.wait_minutes,
            queue.user_wait_minutes,

            queue.you &&
                queue.you.estimated_wait_minutes,

            queue.you &&
                queue.you.wait_minutes
        ];

        for (const value of values) {

            const number = Number(value);

            if (Number.isFinite(number)) {
                return Math.max(0, number);
            }
        }

        return 0;
    }


    function updateQueueUI(queue) {

        latestQueueStatus = queue;

        latestWaitMinutes =
            extractWaitMinutes(queue);


        const tokenElement =
            getElement(
                "arcadeUserToken"
            );

        const waitElement =
            getElement(
                "arcadeWaitTime"
            );

        const servingElement =
            getElement(
                "arcadeServingToken"
            );

        const messageElement =
            getElement(
                "arcadeQueueMessage"
            );


        if (tokenElement) {
            tokenElement.textContent =
                queue?.queue_unavailable
                    ? "Unavailable"
                    : extractUserToken(queue);
        }


        if (waitElement) {
            waitElement.textContent =
                queue?.queue_unavailable
                    ? "—"
                    : formatWait(
                        latestWaitMinutes
                    );
        }


        if (servingElement) {
            servingElement.textContent =
                queue?.queue_unavailable
                    ? "—"
                    : extractServingToken(queue);
        }


        if (messageElement) {

            if (queue?.queue_unavailable) {

                messageElement.textContent = queue?.auth_missing
                    ? "🔐 Sign in to view your live queue."
                    : "⚠️ Live queue is temporarily unavailable. Retrying…";

                updateCardRecommendations();
                updateRecommendation();
                return;
            }

            const called =
                Boolean(
                    queue &&
                    (
                        queue.simulation_called === true ||
                        queue.called === true ||
                        queue.status === "CALLED"
                    )
                );


            if (called) {

                messageElement.textContent =
                    "🎉 Your turn is being called. Please proceed.";

            }
            else if (
                latestWaitMinutes <= 5
            ) {

                messageElement.textContent =
                    "⏳ Your turn is approaching. Stay nearby.";

            }
            else if (
                latestWaitMinutes <= 15
            ) {

                messageElement.textContent =
                    "You have some time. Explore a quick activity.";

            }
            else {

                messageElement.textContent =
                    "You have time to read, relax, or play.";
            }
        }


        updateCardRecommendations();
        updateRecommendation();
    }


    async function refreshQueue() {

        try {

            let queue = null;

            if (
                typeof vizitor.getQueueStatus ===
                "function"
            ) {
                queue = await vizitor.getQueueStatus();
            }

            if (!queue) {

                const token =
                    localStorage.getItem("access_token");

                if (token) {

                    const response =
                        await fetch(
                            `${ARCADE_API_BASE_URL}/appointments/queue/status`,
                            {
                                method: "GET",
                                headers: {
                                    "Authorization":
                                        `Bearer ${token}`,
                                    "Content-Type":
                                        "application/json"
                                },
                                cache: "no-store"
                            }
                        );

                    if (response.ok) {
                        queue = await response.json();
                    }
                }
            }

            if (!queue) {
                const hasToken = Boolean(localStorage.getItem("access_token"));
                updateQueueUI({
                    estimated_wait_minutes: 0,
                    currently_serving_token: null,
                    you: null,
                    queue_unavailable: true,
                    auth_missing: !hasToken
                });
                return;
            }

            updateQueueUI(queue);

        }
        catch (error) {

            console.error(
                "Arcade queue refresh failed:",
                error
            );

            updateQueueUI({
                estimated_wait_minutes: 0,
                currently_serving_token: null,
                you: null,
                queue_unavailable: true
            });
        }
    }



    /* ========================================================
       CARD RECOMMENDATION
    ======================================================== */

    function getActivityScores() {

        const wait =
            Number.isFinite(
                latestWaitMinutes
            )
                ? latestWaitMinutes
                : 10;


        if (wait <= 5) {

            return {
                articles: 60,
                wellness: 95,
                challenges: 82,
                games: 100
            };
        }


        if (wait <= 15) {

            return {
                articles: 88,
                wellness: 94,
                challenges: 98,
                games: 96
            };
        }


        return {
            articles: 100,
            wellness: 91,
            challenges: 97,
            games: 92
        };
    }


    function updateCardRecommendations() {

        const scores =
            getActivityScores();


        const cards = [
            {
                id: "arcadeArticles",
                rank: "arcadeArticlesRank",
                fit: "arcadeArticlesFit",
                key: "articles"
            },
            {
                id: "arcadeWellness",
                rank: "arcadeWellnessRank",
                fit: "arcadeWellnessFit",
                key: "wellness"
            },
            {
                id: "arcadeChallenges",
                rank: "arcadeChallengesRank",
                fit: "arcadeChallengesFit",
                key: "challenges"
            },
            {
                id: "arcadeGames",
                rank: "arcadeGamesRank",
                fit: "arcadeGamesFit",
                key: "games"
            }
        ];


        cards.sort(
            (a, b) =>
                scores[b.key] -
                scores[a.key]
        );


        cards.forEach(
            function (item, index) {

                const card =
                    $(item.id);

                const rank =
                    $(item.rank);

                const fit =
                    $(item.fit);


                if (!card) {
                    return;
                }


                card.style.order =
                    String(index + 1);


                card.classList.remove(
                    "arcade-card-recommended"
                );


                if (
                    index === 0
                ) {

                    card.classList.add(
                        "arcade-card-recommended"
                    );
                }


                if (rank) {

                    rank.textContent =
                        index === 0
                            ? "★ Best fit"
                            : index === 1
                                ? "Great fit"
                                : index === 2
                                    ? "Good fit"
                                    : "Available";
                }


                if (fit) {

                    fit.textContent =
                        scores[item.key] >= 95
                            ? "Excellent fit for your current wait."
                            : scores[item.key] >= 85
                                ? "Great fit for your waiting window."
                                : "Better suited to a longer wait.";
                }
            }
        );
    }


    function updateRecommendation() {

        const title =
            $("arcadeRecommendationTitle");

        const text =
            $("arcadeRecommendationText");


        if (!title || !text) {
            return;
        }


        const wait =
            Number(latestWaitMinutes);


        if (!Number.isFinite(wait)) {

            title.textContent =
                "Your Arcade is ready.";

            text.textContent =
                "Choose an activity while your queue information loads.";

            return;
        }


        if (wait <= 5) {

            title.textContent =
                "⚡ Quick wait? Go for a quick game.";

            text.textContent =
                `You have about ${Math.ceil(wait)} minutes. Reaction, Target Tap and Token Catch are designed for fast sessions.`;

        }

        else if (wait <= 15) {

            title.textContent =
                "🎮 Perfect Arcade window.";

            text.textContent =
                `With roughly ${Math.ceil(wait)} minutes available, you can play a full mini-game or try a challenge.`;

        }

        else {

            title.textContent =
                "✨ You have time to explore.";

            text.textContent =
                `Your estimated wait is ${Math.ceil(wait)} minutes. Explore Articles, Wellness, Challenges or settle into Tetris.`;
        }
    }


    /* ========================================================
       GENERIC POPUP
    ======================================================== */

    function createPopup(
        id,
        title,
        subtitle,
        icon
    ) {

        if ($(id)) {

            return $(id);
        }


        const popup =
            document.createElement("div");

        popup.id =
            id;

        popup.className =
            "vizitor-arcade-popup";


        popup.innerHTML = `

            <div
                class="vizitor-arcade-dialog"
            >

                <div
                    class="vizitor-popup-head"
                >

                    <div
                        class="vizitor-popup-title"
                    >

                        <div
                            class="vizitor-popup-title-icon"
                        >
                            ${icon}
                        </div>

                        <div>

                            <h2>
                                ${escapeHtml(title)}
                            </h2>

                            <p>
                                ${escapeHtml(subtitle)}
                            </p>

                        </div>

                    </div>

                    <button
                        class="vizitor-popup-close"
                        type="button"
                        data-close-popup
                    >
                        ×
                    </button>

                </div>

                <div
                    data-popup-content
                ></div>

            </div>
        `;


        document.body.appendChild(
            popup
        );


        popup.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === popup ||
                    event.target.closest(
                        "[data-close-popup]"
                    )
                ) {

                    closePopup(
                        popup
                    );
                }
            }
        );


        return popup;
    }


    function openPopup(
        popup
    ) {

        if (!popup) {
            return;
        }

        popup.classList.add(
            "open"
        );

        document.body.style.overflow =
            "hidden";

        const dialog =
            popup.querySelector(
                ".vizitor-arcade-dialog"
            );

        if (
            dialog &&
            window.Motion &&
            typeof window.Motion.animate ===
            "function"
        ) {
            window.Motion.animate(
                dialog,
                {
                    opacity: [0, 1],
                    y: [18, 0],
                    scale: [.97, 1]
                },
                {
                    duration: .32,
                    easing: "ease-out"
                }
            );
        }
    }


    function closePopup(
        popup
    ) {

        if (!popup) {
            return;
        }

        popup.classList.remove(
            "open"
        );

        document.body.style.overflow =
            "";

        cleanupGame();
    }


    // ========================================================
    // ARTICLE CARD
    // ========================================================

    function findArticlesCard() {
        return getElement(
            "arcadeArticles"
        );
    }


    function buildArticleExplorer() {

        const card =
            findArticlesCard();


        if (!card) {
            console.error(
                "Articles card not found."
            );
            return;
        }


        if (
            getElement(
                "vizitorArticleExplorer"
            )
        ) {

            articleExplorer =
                getElement(
                    "vizitorArticleExplorer"
                );

            articleGrid =
                getElement(
                    "vizitorArticleGrid"
                );

            articleSearch =
                getElement(
                    "vizitorArticleSearch"
                );

            articleCategory =
                getElement(
                    "vizitorArticleCategory"
                );

            return;
        }


        articleExplorer =
            document.createElement(
                "div"
            );


        articleExplorer.id =
            "vizitorArticleExplorer";


        articleExplorer.className =
            "vizitor-article-explorer";


        articleExplorer.innerHTML = `

            <div class="vizitor-article-toolbar">

                <input
                    id="vizitorArticleSearch"
                    class="vizitor-article-search"
                    type="search"
                    placeholder="Search health articles..."
                    autocomplete="off"
                >


                <select
                    id="vizitorArticleCategory"
                    class="vizitor-article-category"
                >

                    <option value="">
                        All categories
                    </option>

                </select>

            </div>


            <div class="vizitor-article-heading">

                <h4>
                    📰 Articles for your wait
                </h4>


                <span
                    id="vizitorArticleWaitFit"
                >
                    Matching your current wait
                </span>

            </div>


            <div
                id="vizitorArticleGrid"
                class="vizitor-article-grid"
            >

                <div class="vizitor-article-loading">
                    Loading articles...
                </div>

            </div>


            <button
                id="vizitorArticleClose"
                class="vizitor-article-close"
                type="button"
            >
                ← Back to Arcade
            </button>
        `;


        /*
         * IMPORTANT:
         * The explorer is appended directly
         * inside #arcadeArticles.
         */
        card.appendChild(
            articleExplorer
        );


        articleGrid =
            getElement(
                "vizitorArticleGrid"
            );

        articleSearch =
            getElement(
                "vizitorArticleSearch"
            );

        articleCategory =
            getElement(
                "vizitorArticleCategory"
            );


        articleSearch.addEventListener(
            "input",
            function () {

                clearTimeout(
                    articleRequestTimer
                );


                articleRequestTimer =
                    setTimeout(
                        loadArticles,
                        250
                    );
            }
        );


        articleCategory.addEventListener(
            "change",
            loadArticles
        );


        getElement(
            "vizitorArticleClose"
        ).addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                closeArticleExplorer();
            }
        );
    }


    function openArticleExplorer() {

        buildArticleExplorer();


        if (!articleExplorer) {
            return;
        }


        articlePanelOpen = true;


        const card =
            findArticlesCard();


        if (card) {

            card.classList.add(
                "vizitor-articles-expanded"
            );
        }


        articleExplorer.classList.add(
            "open"
        );


        loadArticles();


        setTimeout(
            function () {

                articleExplorer.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });

            },
            100
        );
    }


    function closeArticleExplorer() {

        if (!articleExplorer) {
            return;
        }


        articlePanelOpen = false;

        if (articleRequestTimer) {
            clearTimeout(articleRequestTimer);
            articleRequestTimer = null;
        }


        articleExplorer.classList.remove(
            "open"
        );


        const card =
            findArticlesCard();


        if (card) {

            card.classList.remove(
                "vizitor-articles-expanded"
            );
        }
    }


    function setupArticleCardClick() {

        const card =
            findArticlesCard();


        if (!card) {
            return;
        }


        if (
            card.dataset.vizitorArticleBound ===
            "true"
        ) {
            return;
        }


        card.dataset.vizitorArticleBound =
            "true";


        /*
         * The entire Articles card is clickable.
         * arcade.html uses a div + span, not a button.
         */
        card.addEventListener(
            "click",
            function (event) {

                /*
                 * Don't reopen when clicking
                 * inside the expanded article browser.
                 */
                if (
                    articlePanelOpen &&
                    event.target.closest(
                        ".vizitor-article-explorer"
                    )
                ) {
                    return;
                }


                openArticleExplorer();
            }
        );
    }


    // ========================================================
    // ARTICLES API
    // ========================================================

    async function fetchArticles() {

        const params =
            new URLSearchParams();

        const search =
            articleSearch
                ? articleSearch.value.trim()
                : "";

        const category =
            articleCategory
                ? articleCategory.value
                : "";

                if (search) {
            params.set("search", search);
        }

        if (category) {
            params.set("category", category);
        }

        const query =
            params.toString();

        const url =
            `${ARCADE_API_BASE_URL}/articles` +
            (query ? `?${query}` : "");

        let lastError = null;

        for (let attempt = 0; attempt < 2; attempt++) {

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    10000
                );

            try {

                const response =
                    await fetch(
                        url,
                        {
                            method: "GET",
                            cache: "no-store",
                            signal: controller.signal
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `Articles API error: ${response.status}`
                    );
                }

                const data =
                    await response.json();

                return data;

            }
            catch (error) {

                lastError = error;

                if (attempt === 0) {
                    await new Promise(
                        resolve => setTimeout(resolve, 700)
                    );
                }

            }
            finally {
                clearTimeout(timeout);
            }
        }

        throw lastError ||
            new Error("Articles request failed.");
    }


    function populateCategories(
        articles
    ) {

        if (!articleCategory) {
            return;
        }


        const current =
            articleCategory.value;


        const categories =
            [
                ...new Set(
                    (articles || [])
                        .map(
                            article =>
                                article.category
                        )
                        .filter(Boolean)
                )
            ]
            .sort(
                (a, b) =>
                    a.localeCompare(b)
            );


        articleCategory.innerHTML =
            `
                <option value="">
                    All categories
                </option>
            `;


        categories.forEach(
            function (category) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    category;


                option.textContent =
                    category;


                articleCategory.appendChild(
                    option
                );
            }
        );


        if (
            categories.includes(current)
        ) {

            articleCategory.value =
                current;
        }
    }


    function renderArticles(
        articles
    ) {

        if (!articleGrid) {
            return;
        }


        if (
            !Array.isArray(articles) ||
            articles.length === 0
        ) {

            articleGrid.innerHTML =
                `
                    <div
                        class="vizitor-article-empty"
                    >
                        No articles match your search.
                    </div>
                `;

            return;
        }


        articleGrid.innerHTML =
            articles
                .map(
                    function (article) {

                        const recommended =
                            article.recommended === true;


                        return `
                            <article
                                class="vizitor-article-item"
                            >

                                <div
                                    class="vizitor-article-tags"
                                >

                                    <span
                                        class="vizitor-article-tag"
                                    >
                                        ${escapeHtml(
                                            article.category
                                        )}
                                    </span>

                                    ${
                                        recommended
                                            ? `
                                                <span
                                                    class="vizitor-article-tag best"
                                                >
                                                    Best for your wait
                                                </span>
                                            `
                                            : ""
                                    }

                                </div>


                                <h5>
                                    ${escapeHtml(
                                        article.title
                                    )}
                                </h5>


                                <p>
                                    ${escapeHtml(
                                        article.summary
                                    )}
                                </p>


                                <div
                                    class="vizitor-article-footer"
                                >

                                    <span
                                        class="vizitor-reading-time"
                                    >
                                        ${escapeHtml(
                                            article.reading_time_minutes
                                        )} min read
                                    </span>


                                    <button
                                        class="vizitor-read-button"
                                        type="button"
                                        data-article-id="${escapeHtml(
                                            article.article_id
                                        )}"
                                    >
                                        Read article
                                    </button>

                                </div>

                            </article>
                        `;
                    }
                )
                .join("");


        articleGrid
            .querySelectorAll(
                ".vizitor-read-button"
            )
            .forEach(
                function (button) {

                    button.addEventListener(
                        "click",
                        function (event) {

                            event.stopPropagation();

                            openArticleReader(
                                button.dataset.articleId
                            );
                        }
                    );
                }
            );
    }


    async function loadArticles() {

        if (
            !articlePanelOpen ||
            !articleGrid
        ) {
            return;
        }


        articleGrid.innerHTML =
            `
                <div
                    class="vizitor-article-loading"
                >
                    Finding articles that fit your wait...
                </div>
            `;


        try {

            const data =
                await fetchArticles();


            const articles =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data?.articles)
                        ? data.articles
                        : Array.isArray(data?.items)
                            ? data.items
                            : Array.isArray(data?.data)
                                ? data.data
                                : [];


            populateCategories(
                articles
            );


            const waitLabel =
                getElement(
                    "vizitorArticleWaitFit"
                );


            if (waitLabel) {

                waitLabel.textContent =
                    latestWaitMinutes > 0
                        ? `Best matched to your ${formatWait(
                            latestWaitMinutes
                        )} wait`
                        : "Matching your current wait";
            }


            renderArticles(
                articles
            );

        }
        catch (error) {

            console.error(
                "Articles loading failed:",
                error
            );


            articleGrid.innerHTML =
                `
                    <div
                        class="vizitor-article-empty"
                    >
                        Articles are temporarily unavailable.
                        Please try again.
                    </div>
                `;
        }
    }


    // ========================================================
    // ARTICLE READER
    // ========================================================

    function createArticleReader() {

        if (
            getElement(
                "vizitorArticleReader"
            )
        ) {

            articleReader =
                getElement(
                    "vizitorArticleReader"
                );

            articleReaderBox =
                getElement(
                    "vizitorArticleReaderBox"
                );

            return;
        }


        articleReader =
            document.createElement(
                "div"
            );


        articleReader.id =
            "vizitorArticleReader";


        articleReader.className =
            "vizitor-article-reader";


        articleReader.innerHTML =
            `
                <div
                    id="vizitorArticleReaderBox"
                    class="vizitor-article-reader-box"
                >

                    <div
                        class="vizitor-article-loading"
                    >
                        Loading article...
                    </div>

                </div>
            `;


        document.body.appendChild(
            articleReader
        );


        articleReaderBox =
            getElement(
                "vizitorArticleReaderBox"
            );


        articleReader.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    articleReader
                ) {

                    closeArticleReader();
                }
            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    articleReader.classList.contains(
                        "open"
                    )
                ) {

                    closeArticleReader();
                }
            }
        );
    }


    function formatArticleContent(
        content
    ) {

        if (!content) {

            return `
                <p>
                    No article content available.
                </p>
            `;
        }


        return String(content)
            .split(/\n\s*\n/)
            .map(
                function (paragraph) {

                    return `
                        <p>
                            ${escapeHtml(
                                paragraph.trim()
                            ).replace(
                                /\n/g,
                                "<br>"
                            )}
                        </p>
                    `;
                }
            )
            .join("");
    }


    async function openArticleReader(
        articleId
    ) {

        createArticleReader();


        articleReader.classList.add(
            "open"
        );


        articleReaderBox.innerHTML =
            `
                <div
                    class="vizitor-article-loading"
                >
                    Loading article...
                </div>
            `;


        try {

            const response =
                await fetch(
                    `${ARCADE_API_BASE_URL}/articles/${encodeURIComponent(
                        articleId
                    )}`,
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Article API error: ${response.status}`
                );
            }


            const article =
                await response.json();


            articleReaderBox.innerHTML =
                `
                    <div
                        class="vizitor-reader-top"
                    >

                        <div>

                            <div
                                class="vizitor-reader-category"
                            >
                                ${escapeHtml(
                                    article.category
                                )}
                            </div>


                            <h2
                                class="vizitor-reader-title"
                            >
                                ${escapeHtml(
                                    article.title
                                )}
                            </h2>

                        </div>


                        <button
                            class="vizitor-reader-close"
                            type="button"
                            aria-label="Close article"
                        >
                            ×
                        </button>

                    </div>


                    <div
                        class="vizitor-reader-meta"
                    >
                        ${escapeHtml(
                            article.reading_time_minutes
                        )} min read
                    </div>


                    <div
                        class="vizitor-reader-summary"
                    >
                        ${escapeHtml(
                            article.summary
                        )}
                    </div>


                    <div
                        class="vizitor-reader-content"
                    >
                        ${formatArticleContent(
                            article.content
                        )}
                    </div>
                `;


            articleReaderBox
                .querySelector(
                    ".vizitor-reader-close"
                )
                ?.addEventListener(
                    "click",
                    closeArticleReader
                );

        }
        catch (error) {

            console.error(
                "Article reader failed:",
                error
            );


            articleReaderBox.innerHTML =
                `
                    <div
                        class="vizitor-article-empty"
                    >

                        Unable to open this article.
                        Please try again.

                        <br><br>

                        <button
                            class="vizitor-read-button"
                            type="button"
                            id="vizitorReaderCloseError"
                        >
                            Close
                        </button>

                    </div>
                `;


            getElement(
                "vizitorReaderCloseError"
            )?.addEventListener(
                "click",
                closeArticleReader
            );
        }
    }


    function closeArticleReader() {

        articleReader?.classList.remove(
            "open"
        );
    }




    /* ========================================================
       WELLNESS
    ======================================================== */

    function setupWellnessCard() {

        const card =
            $("arcadeWellness");


        if (!card) {
            return;
        }


        if (card.dataset.vizitorWellnessBound === "true") {
            return;
        }

        card.dataset.vizitorWellnessBound = "true";

        card.addEventListener(
            "click",
            openWellness
        );
    }


    function openWellness() {

        if (!wellnessModal) {

            wellnessModal =
                createPopup(
                    "vizitorWellnessModal",
                    "Wellness",
                    "Reset your mind while you wait",
                    "🧘"
                );
        }


        const content =
            wellnessModal.querySelector(
                "[data-popup-content]"
            );


        content.innerHTML = `

            <div class="vizitor-arcade-section">

                <div
                    class="vizitor-wellness-grid"
                >

                    <div
                        class="vizitor-choice-card"
                        data-wellness="breathing"
                    >
                        <h3>
                            🌬️ Box Breathing
                        </h3>
                        <p>
                            Four slow phases to settle your
                            breathing and reduce waiting-room stress.
                        </p>
                    </div>

                    <div
                        class="vizitor-choice-card"
                        data-wellness="grounding"
                    >
                        <h3>
                            🌿 Grounding
                        </h3>
                        <p>
                            A short sensory exercise to bring
                            your attention back to the present.
                        </p>
                    </div>

                    <div
                        class="vizitor-choice-card"
                        data-wellness="stretch"
                    >
                        <h3>
                            🙆 Gentle Reset
                        </h3>
                        <p>
                            Simple seated movement suitable for
                            a waiting-room environment.
                        </p>
                    </div>

                    <div
                        class="vizitor-choice-card"
                        data-wellness="focus"
                    >
                        <h3>
                            🎯 60-Second Focus
                        </h3>
                        <p>
                            A tiny posture and attention reset you can pause anytime.
                        </p>
                    </div>

                </div>

                <div
                    id="wellnessExercise"
                    style="
                        margin-top:18px;
                        text-align:center;
                    "
                >
                    Choose an exercise above.
                </div>

            </div>
        `;


        content
            .querySelectorAll(
                "[data-wellness]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            startWellness(
                                button.dataset.wellness
                            )
                    );
                }
            );


        openPopup(
            wellnessModal
        );
    }


    let wellnessInterval =
        null;


    function startWellness(type) {

        if (wellnessInterval) {
            clearInterval(wellnessInterval);
            wellnessInterval = null;
        }

        const area = $("wellnessExercise");
        if (!area) return;

        const activities = {
            breathing: {
                title: "Box Breathing",
                icon: "🌬️",
                seconds: 60,
                phases: [
                    ["Breathe in", 4, 1.16],
                    ["Hold", 4, 1.16],
                    ["Breathe out", 4, 0.88],
                    ["Hold", 4, 0.88]
                ],
                description: "A calm 4–4–4–4 rhythm for a quieter waiting period."
            },
            grounding: {
                title: "5–4–3–2–1 Grounding",
                icon: "🌿",
                seconds: 50,
                phases: [
                    ["Notice 5 things you can see", 10, 1.08],
                    ["Notice 4 things you can feel", 10, 1.02],
                    ["Notice 3 things you can hear", 10, 0.98],
                    ["Notice 2 things you can smell", 10, 1.02],
                    ["Take 1 slow breath", 10, 1.08]
                ],
                description: "A simple sensory reset to bring attention back to the present."
            },
            stretch: {
                title: "Seated Gentle Reset",
                icon: "🙆",
                seconds: 60,
                phases: [
                    ["Roll your shoulders gently", 15, 1.04],
                    ["Relax your jaw and hands", 15, 1.00],
                    ["Sit tall and breathe slowly", 15, 1.04],
                    ["Release and relax", 15, 0.98]
                ],
                description: "Small seated movements suitable for a waiting-room environment."
            },
            focus: {
                title: "60-Second Focus",
                icon: "🎯",
                seconds: 60,
                phases: [
                    ["Notice your posture", 15, 1.03],
                    ["Relax your shoulders", 15, 1.00],
                    ["Take one slow breath", 15, 1.05],
                    ["Return attention to your surroundings", 15, 1.00]
                ],
                description: "A tiny reset you can pause when your token approaches."
            }
        };

        const activity = activities[type] || activities.breathing;
        let remaining = activity.seconds;
        let phaseIndex = 0;
        let phaseRemaining = activity.phases[0][1];

        area.innerHTML = `
            <div class="wellness-active-card">
                <div class="wellness-active-icon">${activity.icon}</div>
                <div class="wellness-active-title">${escapeHtml(activity.title)}</div>
                <div class="wellness-active-description">${escapeHtml(activity.description)}</div>
                <div class="wellness-orb" id="wellnessOrb">
                    <strong id="wellnessPhase">${escapeHtml(activity.phases[0][0])}</strong>
                    <span id="wellnessSeconds">${remaining}s</span>
                </div>
                <div class="wellness-progress"><span id="wellnessProgress"></span></div>
                <button class="vizitor-game-btn secondary" id="wellnessStop" type="button">Pause / Stop</button>
            </div>
        `;

        const orb = $("wellnessOrb");
        const phaseElement = $("wellnessPhase");
        const secondsElement = $("wellnessSeconds");
        const progress = $("wellnessProgress");

        function updateVisuals() {
            const phase = activity.phases[phaseIndex];
            if (phaseElement) phaseElement.textContent = phase[0];
            if (secondsElement) secondsElement.textContent = `${remaining}s`;
            if (orb) orb.style.transform = `scale(${phase[2]})`;
            if (progress) progress.style.width = `${((activity.seconds - remaining) / activity.seconds) * 100}%`;
        }

        function stopWellness() {
            if (wellnessInterval) clearInterval(wellnessInterval);
            wellnessInterval = null;
            if (secondsElement) secondsElement.textContent = "Paused";
            if (phaseElement) phaseElement.textContent = "Take it at your pace.";
        }

        $("wellnessStop")?.addEventListener("click", stopWellness);

        wellnessInterval = setInterval(() => {
            remaining -= 1;
            phaseRemaining -= 1;

            if (phaseRemaining <= 0) {
                phaseIndex = (phaseIndex + 1) % activity.phases.length;
                phaseRemaining = activity.phases[phaseIndex][1];
            }

            if (remaining <= 0) {
                clearInterval(wellnessInterval);
                wellnessInterval = null;
                if (phaseElement) phaseElement.textContent = "Nice reset. ✨";
                if (secondsElement) secondsElement.textContent = "Done";
                if (orb) orb.style.transform = "scale(1)";
                if (progress) progress.style.width = "100%";
                return;
            }

            updateVisuals();
        }, 1000);

        updateVisuals();
    }


    /* ========================================================
       CHALLENGES
    ======================================================== */

    function setupChallengeCard() {

        const card =
            $("arcadeChallenges");


        if (!card) {
            return;
        }


        if (card.dataset.vizitorChallengeBound === "true") {
            return;
        }

        card.dataset.vizitorChallengeBound = "true";

        card.addEventListener(
            "click",
            openChallenges
        );
    }


    const CHALLENGES = [

        {
            id: "infection",
            title: "Infection Shield",
            icon: "🦠",
            description: "Everyday infection-prevention decisions.",
            questions: [
                {
                    question: "Which action best helps prevent the spread of infection?",
                    options: [
                        "Regular hand hygiene",
                        "Sharing personal items",
                        "Ignoring symptoms",
                        "Skipping meals"
                    ],
                    answer: 0
                },
                {
                    question: "When should you clean your hands in a healthcare setting?",
                    options: [
                        "Only at home",
                        "After shared facilities and before eating",
                        "Only once a week",
                        "Never"
                    ],
                    answer: 1
                },
                {
                    question: "What is a good practice when coughing or sneezing?",
                    options: [
                        "Cover your mouth and nose",
                        "Face other people",
                        "Touch shared surfaces immediately",
                        "Ignore it"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "queue",
            title: "Queue Master",
            icon: "🎫",
            description: "Test your VIZITOR queue awareness.",
            questions: [
                {
                    question: "What should you do when your queue token is called?",
                    options: [
                        "Proceed as instructed",
                        "Ignore the announcement",
                        "Give your token away",
                        "Leave without checking"
                    ],
                    answer: 0
                },
                {
                    question: "Why should you keep an eye on queue updates?",
                    options: [
                        "So you can respond when your turn approaches",
                        "To change your token",
                        "To skip everyone",
                        "To cancel automatically"
                    ],
                    answer: 0
                },
                {
                    question: "What is the safest way to use waiting time?",
                    options: [
                        "Stay available for announcements",
                        "Block an entrance",
                        "Turn off all notifications",
                        "Leave the waiting area without notice"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "appointment",
            title: "Appointment Ace",
            icon: "📋",
            description: "Prepare smarter for your consultation.",
            questions: [
                {
                    question: "What can help make a consultation more effective?",
                    options: [
                        "Preparing key questions",
                        "Forgetting your appointment details",
                        "Hiding relevant reports",
                        "Arriving with no information"
                    ],
                    answer: 0
                },
                {
                    question: "Which information can be useful to organize before a visit?",
                    options: [
                        "Relevant medicines and allergies",
                        "Random passwords",
                        "Unrelated advertisements",
                        "Nothing"
                    ],
                    answer: 0
                },
                {
                    question: "If an instruction is unclear, what is reasonable?",
                    options: [
                        "Ask the healthcare professional to clarify",
                        "Guess",
                        "Ignore it",
                        "Change it yourself"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "emergency",
            title: "Emergency Ready",
            icon: "🚨",
            description: "Know when normal waiting should stop.",
            questions: [
                {
                    question: "What should happen if someone develops severe chest pain while waiting?",
                    options: [
                        "Seek immediate help from staff",
                        "Wait silently for the token",
                        "Go to sleep",
                        "Ignore it"
                    ],
                    answer: 0
                },
                {
                    question: "Which situation may require urgent attention?",
                    options: [
                        "Severe difficulty breathing",
                        "Being mildly bored",
                        "Wanting a game",
                        "Reading an article"
                    ],
                    answer: 0
                },
                {
                    question: "A routine queue should delay emergency care.",
                    options: [
                        "Never",
                        "Always",
                        "Only on weekends",
                        "Only for new patients"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "records",
            title: "Health Records",
            icon: "🗂️",
            description: "Keep important health information organized.",
            questions: [
                {
                    question: "What can make future healthcare visits smoother?",
                    options: [
                        "Organized health information",
                        "Deleting all reports",
                        "Forgetting allergies",
                        "Hiding prescriptions"
                    ],
                    answer: 0
                },
                {
                    question: "Which can be useful to keep organized?",
                    options: [
                        "Prescriptions and laboratory reports",
                        "Only old advertisements",
                        "Unrelated receipts",
                        "Nothing"
                    ],
                    answer: 0
                },
                {
                    question: "How should digital health information be handled?",
                    options: [
                        "Protect it with appropriate security",
                        "Share it publicly",
                        "Post it everywhere",
                        "Ignore privacy"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "wellbeing",
            title: "Wellbeing Boost",
            icon: "🌿",
            description: "Quick questions about healthy waiting habits.",
            questions: [
                {
                    question: "What is a simple way to make waiting more comfortable?",
                    options: [
                        "Use short periods for relaxation",
                        "Skip all breaks",
                        "Block walkways",
                        "Ignore your needs"
                    ],
                    answer: 0
                },
                {
                    question: "What can support general wellbeing?",
                    options: [
                        "Consistent sleep habits",
                        "Constant sleep deprivation",
                        "Skipping all meals",
                        "Ignoring persistent problems"
                    ],
                    answer: 0
                },
                {
                    question: "What should you do if you feel seriously unwell while waiting?",
                    options: [
                        "Inform hospital staff",
                        "Hide the symptoms",
                        "Keep waiting silently",
                        "Leave without telling anyone"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "smartpatient",
            title: "Smart Patient",
            icon: "🧠",
            description: "Think fast about practical healthcare choices.",
            questions: [
                {
                    question: "What is useful to prepare before seeing a doctor?",
                    options: [
                        "Symptoms and questions",
                        "Nothing",
                        "Only entertainment",
                        "A random list"
                    ],
                    answer: 0
                },
                {
                    question: "What can help you understand instructions?",
                    options: [
                        "Ask questions and clarify",
                        "Pretend you understood",
                        "Ignore them",
                        "Change them"
                    ],
                    answer: 0
                },
                {
                    question: "What should you do with a routine appointment during an emergency?",
                    options: [
                        "Seek urgent help instead",
                        "Wait for the routine token",
                        "Keep playing",
                        "Ignore the emergency"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "crowd",
            title: "Crowd Guardian",
            icon: "👥",
            description: "Make safer choices in busy healthcare spaces.",
            questions: [
                {
                    question: "Which behaviour helps keep a healthcare entrance accessible?",
                    options: [
                        "Keep entrances and walkways clear",
                        "Stand across doorways",
                        "Block corridors",
                        "Leave bags everywhere"
                    ],
                    answer: 0
                },
                {
                    question: "What is a good response to crowd announcements?",
                    options: [
                        "Follow staff instructions",
                        "Ignore them",
                        "Create another queue",
                        "Block the display"
                    ],
                    answer: 0
                },
                {
                    question: "Why is orderly queue behaviour useful?",
                    options: [
                        "It helps staff manage people safely",
                        "It makes everyone wait longer",
                        "It removes all appointments",
                        "It changes medical priorities"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "hydration",
            title: "Hydration Hero",
            icon: "💧",
            description: "Simple hydration and comfort knowledge.",
            questions: [
                {
                    question: "What is a simple hydration habit?",
                    options: [
                        "Take regular small sips when appropriate",
                        "Wait until extreme thirst",
                        "Never drink water",
                        "Drink only during appointments"
                    ],
                    answer: 0
                },
                {
                    question: "If a healthcare professional has restricted your fluids, what should you do?",
                    options: [
                        "Follow their instructions",
                        "Ignore them",
                        "Double your intake",
                        "Ask a stranger instead"
                    ],
                    answer: 0
                },
                {
                    question: "Who may need extra attention to regular hydration?",
                    options: [
                        "People who may have difficulty recognizing thirst",
                        "Only athletes",
                        "Only doctors",
                        "Nobody"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "communication",
            title: "Doctor Dialogue",
            icon: "💬",
            description: "Build better patient–professional communication.",
            questions: [
                {
                    question: "Which is a reasonable question during a consultation?",
                    options: [
                        "What does this result mean?",
                        "Can I hide my symptoms?",
                        "Should I ignore instructions?",
                        "Can I skip all follow-up?"
                    ],
                    answer: 0
                },
                {
                    question: "Why can repeating instructions in your own words help?",
                    options: [
                        "It can confirm that you understood them",
                        "It changes the diagnosis",
                        "It replaces treatment",
                        "It cancels the appointment"
                    ],
                    answer: 0
                },
                {
                    question: "What can you ask about after a consultation?",
                    options: [
                        "Next steps and warning signs",
                        "How to skip the queue",
                        "How to change someone else's token",
                        "Nothing"
                    ],
                    answer: 0
                }
            ]
        },

        {
            id: "firstaid",
            title: "First-Aid Focus",
            icon: "🩹",
            description: "Recognise sensible first-response actions.",
            questions: [
                { question: "For a serious emergency, what is the safest first step?", options: ["Alert trained staff or emergency services", "Wait silently", "Treat without training", "Move the person unnecessarily"], answer: 0 },
                { question: "If you suddenly feel faint while waiting, what should you do?", options: ["Tell nearby healthcare staff", "Hide it", "Run outside alone", "Keep playing"], answer: 0 },
                { question: "Why should untrained people avoid complex medical treatment?", options: ["It can cause harm", "It always takes too long", "It changes queue order", "It affects appointment dates"], answer: 0 }
            ]
        },

        {
            id: "privacy",
            title: "Privacy Protector",
            icon: "🔐",
            description: "Make smart choices with personal health information.",
            questions: [
                { question: "What should you do with your health documents?", options: ["Keep them secure and share them only when appropriate", "Post them publicly", "Leave them unattended", "Give them to strangers"], answer: 0 },
                { question: "What is safer for a healthcare account password?", options: ["Keep it private", "Share it in a group chat", "Write it publicly", "Use one password everywhere"], answer: 0 },
                { question: "Why check who is receiving a medical message?", options: ["Health information is sensitive", "It speeds up the queue", "It changes your token", "It improves Wi-Fi"], answer: 0 }
            ]
        },

        {
            id: "navigation",
            title: "Hospital Navigator",
            icon: "🧭",
            description: "Handle signs, counters and directions intelligently.",
            questions: [
                { question: "If you are unsure where to go, what is best?", options: ["Ask reception or an appropriate staff member", "Enter a restricted area", "Follow a random person", "Ignore the appointment"], answer: 0 },
                { question: "What helps people move safely through busy corridors?", options: ["Keep walkways clear", "Stand in doorways", "Leave bags in corridors", "Use restricted areas as shortcuts"], answer: 0 },
                { question: "What should you check before going to another counter?", options: ["The sign, token display or staff direction", "Only the nearest door", "A random queue", "Nothing"], answer: 0 }
            ]
        },

        {
            id: "records_ranger",
            title: "Records Ranger",
            icon: "📁",
            description: "Understand continuity and organised health records.",
            questions: [
                { question: "Why can an organised medication list be useful?", options: ["It helps clinicians understand current medicines", "It guarantees a diagnosis", "It replaces a consultation", "It shortens every queue"], answer: 0 },
                { question: "What is useful when moving between healthcare facilities?", options: ["Relevant records and referral information", "Only your queue number", "No information", "A random note"], answer: 0 },
                { question: "If you notice an error in a medical record, what is sensible?", options: ["Ask appropriate healthcare staff to review it", "Edit it yourself", "Delete the record", "Ignore it forever"], answer: 0 }
            ]
        },

        {
            id: "digitalhealth",
            title: "Digital Health Detective",
            icon: "📱",
            description: "Spot sensible digital-health habits.",
            questions: [
                { question: "Before trusting a health message online, what should you do?", options: ["Check the source and confirm when needed", "Forward it immediately", "Assume every post is correct", "Use it instead of medical advice"], answer: 0 },
                { question: "Why keep a patient portal secure?", options: ["It protects sensitive health information", "It changes your appointment time", "It increases Wi-Fi speed", "It removes waiting"], answer: 0 },
                { question: "If an online symptom checker suggests an emergency, what should you do?", options: ["Seek appropriate urgent medical help", "Ignore it automatically", "Keep playing games", "Change the result"], answer: 0 }
            ]
        },

        {
            id: "productivity",
            title: "Wait-Time Wizard",
            icon: "⏱️",
            description: "Turn spare minutes into useful minutes.",
            questions: [
                {
                    question: "Which task is suitable for a waiting period?",
                    options: [
                        "Review appointment details",
                        "Block the reception desk",
                        "Start an unpausable task",
                        "Ignore your queue"
                    ],
                    answer: 0
                },
                {
                    question: "What should you keep available while doing an activity?",
                    options: [
                        "Queue updates and announcements",
                        "Only headphones",
                        "A locked phone",
                        "Nothing"
                    ],
                    answer: 0
                },
                {
                    question: "Why are short activities useful in a queue?",
                    options: [
                        "They can be paused when your turn approaches",
                        "They guarantee a shorter queue",
                        "They change your token",
                        "They replace medical care"
                    ],
                    answer: 0
                }
            ]
        }

    ];


    let selectedChallenge =
        null;

    let challengeIndex =
        0;

    let challengeScore =
        0;


    function openChallenges() {

        if (!challengeModal) {

            challengeModal =
                createPopup(
                    "vizitorChallengeModal",
                    "Challenges",
                    "Choose a quick brain + health challenge",
                    "🏆"
                );
        }

        challengeIndex = 0;
        challengeScore = 0;
        selectedChallenge = null;

        renderChallengeSelection();

        openPopup(
            challengeModal
        );
    }


    function renderChallengeSelection() {

        const content =
            challengeModal.querySelector(
                "[data-popup-content]"
            );

        content.innerHTML = `

            <div class="vizitor-arcade-section">

                <div
                    style="
                        margin-bottom:16px;
                        color:#6f7789;
                        font-size:13px;
                        line-height:1.6;
                    "
                >
                    Pick one challenge. Each challenge has
                    3 quick questions and a fair 300-point maximum.
                </div>

                <div class="vizitor-challenge-grid">

                    ${CHALLENGES.map(
                        challenge => `
                            <button
                                type="button"
                                class="vizitor-choice-card"
                                data-challenge-id="${challenge.id}"
                                style="
                                    text-align:left;
                                    border:1px solid #ebe8f4;
                                    color:inherit;
                                "
                            >
                                <div
                                    style="
                                        font-size:30px;
                                        margin-bottom:10px;
                                    "
                                >
                                    ${challenge.icon}
                                </div>

                                <h3>
                                    ${escapeHtml(challenge.title)}
                                </h3>

                                <p>
                                    ${escapeHtml(challenge.description)}
                                </p>

                                <div
                                    style="
                                        margin-top:12px;
                                        color:#7c3aed;
                                        font-size:11px;
                                        font-weight:800;
                                    "
                                >
                                    3 questions · 300 pts
                                </div>
                            </button>
                        `
                    ).join("")}

                </div>

            </div>
        `;

        const cards =
            content.querySelectorAll(
                "[data-challenge-id]"
            );

        cards.forEach(
            card => {

                card.addEventListener(
                    "click",
                    function () {

                        selectedChallenge =
                            CHALLENGES.find(
                                challenge =>
                                    challenge.id ===
                                    card.dataset.challengeId
                            );

                        challengeIndex = 0;
                        challengeScore = 0;

                        renderChallenge();
                    }
                );

                if (
                    window.Motion &&
                    typeof window.Motion.animate ===
                    "function"
                ) {
                    window.Motion.animate(
                        card,
                        {
                            opacity: [0, 1],
                            y: [14, 0],
                            scale: [.97, 1]
                        },
                        {
                            duration: .35,
                            delay:
                                Array.from(cards).indexOf(card) * .035
                        }
                    );
                }
            }
        );
    }


    function renderChallenge() {

        const content =
            challengeModal.querySelector(
                "[data-popup-content]"
            );

        const challenge =
            selectedChallenge;

        if (!challenge) {
            renderChallengeSelection();
            return;
        }

        const question =
            challenge.questions[
                challengeIndex
            ];

        content.innerHTML = `

            <div class="vizitor-arcade-section">

                <div
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:12px;
                        margin-bottom:14px;
                    "
                >
                    <button
                        type="button"
                        class="vizitor-game-btn secondary"
                        id="challengeBack"
                    >
                        ← Challenges
                    </button>

                    <div
                        style="
                            color:#7b8497;
                            font-size:11px;
                            font-weight:800;
                        "
                    >
                        ${escapeHtml(challenge.title)}
                        · ${challengeIndex + 1}/3
                        · ${challengeScore}/300
                    </div>
                </div>

                <div class="quiz-box">

                    <div class="quiz-question">
                        ${escapeHtml(question.question)}
                    </div>

                    <div
                        class="quiz-options"
                        id="challengeOptions"
                    >
                        ${question.options.map(
                            (option, index) => `
                                <button
                                    type="button"
                                    class="quiz-option"
                                    data-answer="${index}"
                                >
                                    ${escapeHtml(option)}
                                </button>
                            `
                        ).join("")}
                    </div>

                </div>

            </div>
        `;

        $("challengeBack")
            ?.addEventListener(
                "click",
                renderChallengeSelection
            );

        const options =
            content.querySelectorAll(
                "[data-answer]"
            );

        options.forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const answer =
                            Number(
                                button.dataset.answer
                            );

                        options.forEach(
                            option => {
                                option.disabled = true;
                            }
                        );

                        const correct =
                            answer === question.answer;

                        if (correct) {
                            challengeScore += 100;
                        }

                        if (
                            window.Motion &&
                            typeof window.Motion.animate ===
                            "function"
                        ) {
                            window.Motion.animate(
                                button,
                                correct
                                    ? {
                                        scale: [1, 1.04, 1],
                                        y: [0, -4, 0]
                                    }
                                    : {
                                        x: [0, -5, 5, 0]
                                    },
                                {
                                    duration: .25
                                }
                            );
                        }

                        setTimeout(
                            function () {

                                challengeIndex++;

                                if (
                                    challengeIndex >=
                                    challenge.questions.length
                                ) {
                                    finishChallenge();
                                } else {
                                    renderChallenge();
                                }

                            },
                            300
                        );
                    }
                );
            }
        );
    }


    function finishChallenge() {

        const score =
            safeScore(
                challengeScore
            );

        const content =
            challengeModal.querySelector(
                "[data-popup-content]"
            );

        content.innerHTML = `

            <div class="vizitor-arcade-section">

                <div
                    class="vizitor-game-result"
                >

                    <div
                        style="font-size:48px;"
                    >
                        🏆
                    </div>

                    <div
                        style="
                            color:#7b8497;
                            font-size:12px;
                            font-weight:800;
                        "
                    >
                        ${escapeHtml(
                            selectedChallenge?.title ||
                            "Challenge"
                        )}
                    </div>

                    <div
                        class="vizitor-game-result-score"
                    >
                        ${score}
                    </div>

                    <p>
                        ${score === 300
                            ? "Perfect run. 🎯"
                            : score >= 200
                                ? "Great job. Keep going. ✨"
                                : "Nice try. Give it another shot. 💪"
                        }
                    </p>

                    <div
                        style="
                            display:flex;
                            justify-content:center;
                            gap:8px;
                            flex-wrap:wrap;
                            margin-top:18px;
                        "
                    >
                        <button
                            class="vizitor-game-btn"
                            id="challengeAgain"
                        >
                            Replay
                        </button>

                        <button
                            class="vizitor-game-btn secondary"
                            id="challengeChoose"
                        >
                            Choose another
                        </button>
                    </div>

                </div>

            </div>
        `;

        $("challengeAgain")
            ?.addEventListener(
                "click",
                function () {

                    challengeIndex = 0;
                    challengeScore = 0;
                    renderChallenge();
                }
            );

        $("challengeChoose")
            ?.addEventListener(
                "click",
                renderChallengeSelection
            );

        if (
            window.Motion &&
            typeof window.Motion.animate ===
            "function"
        ) {
            window.Motion.animate(
                content.querySelector(".vizitor-game-result"),
                {
                    opacity: [0, 1],
                    y: [18, 0],
                    scale: [.96, 1]
                },
                {
                    duration: .4
                }
            );
        }
    }


    /* ========================================================
       GAMES
    ======================================================== */

    const GAMES = [

        {
            id: "reaction",
            icon: "⚡",
            title: "Reaction Rush",
            description:
                "Wait for green and react as quickly as possible."
        },

        {
            id: "memory",
            icon: "🧠",
            title: "Memory Flash",
            description:
                "Match the hidden pairs."
        },

        {
            id: "math",
            icon: "🔢",
            title: "Quick Math",
            description:
                "Solve as many quick equations as you can."
        },

        {
            id: "color",
            icon: "🎨",
            title: "Color Match",
            description:
                "Match the correct colour before the clock."
        },

        {
            id: "scramble",
            icon: "🔤",
            title: "Word Scramble",
            description:
                "Unscramble healthcare-related words."
        },

        {
            id: "odd",
            icon: "🔍",
            title: "Odd One Out",
            description:
                "Find the item that breaks the pattern."
        },

        {
            id: "pattern",
            icon: "🧩",
            title: "Pattern Master",
            description:
                "Predict the next number in the sequence."
        },

        {
            id: "target",
            icon: "🎯",
            title: "Target Tap",
            description:
                "Hit moving targets with precision."
        },

        {
            id: "signal",
            icon: "🚦",
            title: "Signal Sort",
            description:
                "React only to the correct signal."
        },

        {
            id: "token",
            icon: "🎫",
            title: "Token Catch",
            description:
                "Catch the moving queue token."
        },

        {
            id: "tetris",
            icon: "🧱",
            title: "Tetris",
            description:
                "Classic falling blocks with line-clear scoring."
        }

    ];


    function setupGamesCard() {

        const card =
            $("arcadeGames");


        if (!card) {
            return;
        }


        if (card.dataset.vizitorGamesBound === "true") {
            return;
        }

        card.dataset.vizitorGamesBound = "true";

        card.addEventListener(
            "click",
            openGames
        );
    }


    function createGamesModal() {

        gamesModal =
            createPopup(
                "vizitorGamesModal",
                "Mini Games",
                "Fair short-session Arcade games",
                "🎮"
            );
    }


    function openGames() {

        createGamesModal();

        renderGameList();

        openPopup(
            gamesModal
        );
    }


    function renderGameList() {

        const content =
            gamesModal.querySelector(
                "[data-popup-content]"
            );


        content.innerHTML = `

            <div
                class="vizitor-game-list"
            >

                ${GAMES
                    .map(
                        game => `

                        <button
                            type="button"
                            class="vizitor-game-card"
                            data-game="${game.id}"
                        >

                            <div
                                class="vizitor-game-icon"
                            >
                                ${game.icon}
                            </div>

                            <h3>
                                ${escapeHtml(
                                    game.title
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    game.description
                                )}
                            </p>

                            <span
                                class="vizitor-game-duration"
                            >
                                ${game.id === "tetris"
                                    ? "∞ practice"
                                    : "30 sec session"
                                }
                            </span>

                        </button>
                    `
                    )
                    .join("")
                }

            </div>
        `;


        content
            .querySelectorAll(
                "[data-game]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            startGame(
                                button.dataset.game
                            );
                        }
                    );
                }
            );
    }


    function gameShell(
        title,
        subtitle
    ) {

        const content =
            gamesModal.querySelector(
                "[data-popup-content]"
            );


        content.innerHTML = `

            <div class="vizitor-game-shell">

                <div
                    class="vizitor-game-toolbar"
                >

                    <div
                        class="vizitor-game-stats"
                    >

                        <div
                            class="vizitor-game-stat"
                        >
                            Score:
                            <strong
                                id="gameScore"
                            >
                                0
                            </strong>
                        </div>

                        <div
                            class="vizitor-game-stat"
                        >
                            Time:
                            <strong
                                id="gameTime"
                            >
                                ${GAME_DURATION}
                            </strong>
                        </div>

                        <div
                            class="vizitor-game-stat"
                        >
                            ${escapeHtml(
                                title
                            )}
                        </div>

                    </div>

                    <div
                        class="vizitor-game-actions"
                    >

                        <button
                            class="vizitor-game-btn secondary"
                            id="backToGames"
                        >
                            All games
                        </button>

                        <button
                            class="vizitor-game-btn"
                            id="restartGame"
                        >
                            Restart
                        </button>

                    </div>

                </div>

                <div
                    class="vizitor-game-stage"
                    id="gameStage"
                ></div>

                <div
                    style="
                        padding-top:10px;
                        color:#858c9c;
                        font-size:10px;
                        text-align:center;
                    "
                >
                    ${escapeHtml(
                        subtitle
                    )}
                </div>

            </div>
        `;


        $("backToGames")
            ?.addEventListener(
                "click",
                function () {

                    cleanupGame();

                    renderGameList();
                }
            );
    }


    function setGameScore(
        score
    ) {

        if (!gameState) {
            return;
        }

        gameState.score =
            safeScore(score);


        const element =
            $("gameScore");


        if (element) {

            element.textContent =
                String(
                    gameState.score
                );
        }
    }


    function setGameTime(
        seconds
    ) {

        const element =
            $("gameTime");


        if (element) {

            element.textContent =
                String(
                    Math.max(
                        0,
                        Math.ceil(seconds)
                    )
                );
        }
    }


    function startGame(
        id
    ) {

        cleanupGame();


        const game =
            GAMES.find(
                item =>
                    item.id === id
            );


        if (!game) {
            return;
        }


        gameState = {

            id,

            score: 0,

            startedAt:
                performance.now(),

            timer: null,

            timeout: null,

            ended: false

        };


        gameShell(
            game.title,
            game.description
        );


        const runners = {

            reaction:
                gameReaction,

            memory:
                gameMemory,

            math:
                gameMath,

            color:
                gameColor,

            scramble:
                gameScramble,

            odd:
                gameOdd,

            pattern:
                gamePattern,

            target:
                gameTarget,

            signal:
                gameSignal,

            token:
                gameToken,

            tetris:
                gameTetris

        };


        if (
            typeof runners[id] ===
            "function"
        ) {

            runners[id]();
        }
    }


    function startTimedGame(
        duration,
        onTick,
        onFinish
    ) {

        if (!gameState) {
            return;
        }


        let remaining =
            duration;


        setGameTime(
            remaining
        );


        gameState.timer =
            setInterval(
                function () {

                    if (
                        !gameState ||
                        gameState.ended
                    ) {
                        return;
                    }


                    remaining -= .1;


                    setGameTime(
                        remaining
                    );


                    if (
                        remaining <= 0
                    ) {

                        finishGame();

                        if (
                            typeof onFinish ===
                            "function"
                        ) {
                            onFinish();
                        }

                        return;
                    }


                    if (
                        typeof onTick ===
                        "function"
                    ) {

                        onTick(
                            remaining
                        );
                    }

                },
                100
            );
    }


    function finishGame() {

        if (
            !gameState ||
            gameState.ended
        ) {
            return;
        }


        gameState.ended =
            true;


        if (
            gameState.timer
        ) {

            clearInterval(
                gameState.timer
            );

            gameState.timer =
                null;
        }


        const score =
            safeScore(
                gameState.score
            );


        const stage =
            $("gameStage");


        if (!stage) {
            return;
        }


        stage.innerHTML = `

            <div
                class="vizitor-game-result"
            >

                <div
                    style="
                        font-size:48px;
                    "
                >
                    🏆
                </div>

                <div
                    style="
                        color:#7a8294;
                        font-size:12px;
                    "
                >
                    FINAL SCORE
                </div>

                <div
                    class="vizitor-game-result-score"
                >
                    ${score}
                </div>

                <p>
                    Fair score • 30-second session
                </p>

                <button
                    class="vizitor-game-btn"
                    id="playAgainGame"
                    style="
                        margin-top:18px;
                    "
                >
                    Play again
                </button>

            </div>
        `;


        $("playAgainGame")
            ?.addEventListener(
                "click",
                function () {

                    startGame(
                        gameState.id
                    );
                }
            );


        /*
         * IMPORTANT:
         *
         * We intentionally dispatch a custom event here.
         * The next backend integration step will listen to this
         * event / submit the verified result to the server.
         *
         */

        document.dispatchEvent(
            new CustomEvent(
                "vizitor:arcade-score",
                {
                    detail: {

                        game:
                            gameState.id,

                        score,

                        token:
                            extractUserToken(
                                latestQueueStatus
                            ),

                        timestamp:
                            new Date().toISOString()
                    }
                }
            )
        );
    }


    function cleanupGame() {

        if (
            !gameState
        ) {
            return;
        }


        if (
            gameState.timer
        ) {

            clearInterval(
                gameState.timer
            );
        }


        if (
            gameState.timeout
        ) {

            clearTimeout(
                gameState.timeout
            );
        }


        gameState.timer =
            null;

        gameState.timeout =
            null;
    }


    /* ========================================================
       GAME 1 — REACTION
    ======================================================== */

    function gameReaction() {

        const stage =
            $("gameStage");


        stage.innerHTML = `

            <div
                class="reaction-zone"
                id="reactionZone"
            >
                <span id="reactionText">
                    WAIT...
                </span>
            </div>
        `;


        const zone =
            $("reactionZone");

        const text =
            $("reactionText");


        let ready =
            false;

        let startTime =
            0;


        const delay =
            randomInt(
                1200,
                3500
            );


        gameState.timeout =
            setTimeout(
                function () {

                    ready =
                        true;

                    startTime =
                        performance.now();

                    zone.classList.add(
                        "ready"
                    );

                    text.textContent =
                        "TAP!";
                },
                delay
            );


        zone.addEventListener(
            "click",
            function () {

                if (
                    gameState.ended
                ) {
                    return;
                }


                if (!ready) {

                    if (
                        gameState.timeout
                    ) {

                        clearTimeout(
                            gameState.timeout
                        );
                    }

                    zone.classList.add(
                        "too-soon"
                    );

                    text.textContent =
                        "TOO SOON";

                    gameState.score =
                        0;

                    setGameScore(0);

                    gameState.timeout =
                        setTimeout(
                            function () {

                                finishGame();

                            },
                            700
                        );

                    return;
                }


                const reaction =
                    performance.now() -
                    startTime;


                const score =
                    clamp(
                        1000 -
                        Math.round(
                            reaction * 2
                        ),
                        100,
                        1000
                    );


                setGameScore(
                    score
                );


                zone.classList.remove(
                    "ready"
                );

                text.textContent =
                    `${Math.round(
                        reaction
                    )} ms`;


                gameState.timeout =
                    setTimeout(
                        finishGame,
                        700
                    );
            }
        );
    }


    /* ========================================================
       GAME 2 — MEMORY
    ======================================================== */

    function gameMemory() {

        const stage =
            $("gameStage");


        const symbols =
            shuffle([
                "🌿","🌿",
                "💧","💧",
                "❤️","❤️",
                "⭐","⭐",
                "🧠","🧠",
                "☀️","☀️",
                "🍀","🍀",
                "🎯","🎯"
            ]);


        let flipped =
            [];

        let matched =
            0;

        let moves =
            0;


        stage.innerHTML = `

            <div
                class="memory-board"
                id="memoryBoard"
            >

                ${symbols
                    .map(
                        (symbol, index) =>
                            `
                            <button
                                class="memory-card"
                                data-index="${index}"
                                data-symbol="${symbol}"
                            >
                                ?
                            </button>
                            `
                    )
                    .join("")
                }

            </div>
        `;


        stage
            .querySelectorAll(
                ".memory-card"
            )
            .forEach(
                card => {

                    card.addEventListener(
                        "click",
                        function () {

                            if (
                                gameState.ended ||
                                flipped.length >= 2 ||
                                card.classList.contains(
                                    "matched"
                                ) ||
                                card.classList.contains(
                                    "flipped"
                                )
                            ) {
                                return;
                            }


                            card.classList.add(
                                "flipped"
                            );

                            card.textContent =
                                card.dataset.symbol;


                            flipped.push(
                                card
                            );


                            if (
                                flipped.length !==
                                2
                            ) {
                                return;
                            }


                            moves++;


                            const [
                                first,
                                second
                            ] = flipped;


                            if (
                                first.dataset.symbol ===
                                second.dataset.symbol
                            ) {

                                first.classList.add(
                                    "matched"
                                );

                                second.classList.add(
                                    "matched"
                                );

                                matched++;

                                flipped = [];


                                setGameScore(
                                    matched * 110
                                );


                                if (
                                    matched === 8
                                ) {

                                    finishGame();
                                }

                            } else {

                                gameState.timeout =
                                    setTimeout(
                                        function () {

                                            first.classList.remove(
                                                "flipped"
                                            );

                                            second.classList.remove(
                                                "flipped"
                                            );

                                            first.textContent =
                                                "?";

                                            second.textContent =
                                                "?";

                                            flipped = [];

                                        },
                                        550
                                    );
                            }

                        }
                    );
                }
            );


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 3 — MATH
    ======================================================== */

    function gameMath() {

        const stage =
            $("gameStage");


        let correct =
            0;


        function nextQuestion() {

            const a =
                randomInt(2, 18);

            const b =
                randomInt(2, 15);

            const operations =
                [
                    "+",
                    "-",
                    "×"
                ];

            const op =
                operations[
                    randomInt(
                        0,
                        operations.length - 1
                    )
                ];


            let answer;


            if (
                op === "+"
            ) {
                answer =
                    a + b;
            }

            else if (
                op === "-"
            ) {
                answer =
                    a - b;
            }

            else {
                answer =
                    a * b;
            }


            const options =
                shuffle([
                    answer,
                    answer + randomInt(1, 5),
                    answer - randomInt(1, 5),
                    answer + randomInt(6, 10)
                ]);


            stage.innerHTML = `

                <div class="quiz-box">

                    <div
                        class="quiz-question"
                    >
                        ${a} ${op} ${b} = ?
                    </div>

                    <div
                        class="quiz-options"
                    >

                        ${options
                            .map(
                                option =>
                                    `
                                    <button
                                        class="quiz-option"
                                        data-value="${option}"
                                    >
                                        ${option}
                                    </button>
                                    `
                            )
                            .join("")
                        }

                    </div>

                </div>
            `;


            stage
                .querySelectorAll(
                    "[data-value]"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    Number(
                                        button.dataset.value
                                    ) === answer
                                ) {

                                    correct++;

                                    setGameScore(
                                        correct * 100
                                    );
                                }


                                nextQuestion();
                            }
                        );
                    }
                );
        }


        nextQuestion();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 4 — COLOR
    ======================================================== */

    function gameColor() {

        const stage =
            $("gameStage");


        const colors = [
            "RED",
            "BLUE",
            "GREEN",
            "YELLOW"
        ];


        let correct =
            0;


        function next() {

            const target =
                colors[
                    randomInt(
                        0,
                        colors.length - 1
                    )
                ];


            const options =
                shuffle(colors);


            stage.innerHTML = `

                <div
                    style="
                        text-align:center;
                        width:min(500px,95%);
                    "
                >

                    <div
                        style="
                            color:#8a91a2;
                            font-size:11px;
                            text-transform:uppercase;
                            letter-spacing:.08em;
                            font-weight:800;
                        "
                    >
                        MATCH THIS
                    </div>

                    <div
                        style="
                            margin:15px 0 25px;
                            font-size:40px;
                            font-weight:900;
                            color:#242b3d;
                        "
                    >
                        ${target}
                    </div>

                    <div
                        class="quiz-options"
                    >

                        ${options
                            .map(
                                color =>
                                    `
                                    <button
                                        class="quiz-option"
                                        data-color="${color}"
                                    >
                                        ${color}
                                    </button>
                                    `
                            )
                            .join("")
                        }

                    </div>

                </div>
            `;


            stage
                .querySelectorAll(
                    "[data-color]"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    button.dataset.color ===
                                    target
                                ) {

                                    correct++;

                                    setGameScore(
                                        correct * 100
                                    );
                                }


                                next();
                            }
                        );
                    }
                );
        }


        next();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 5 — SCRAMBLE
    ======================================================== */

    function gameScramble() {

        const stage =
            $("gameStage");


        const words = [
            "HOSPITAL",
            "DOCTOR",
            "PATIENT",
            "HEALTH",
            "CLINIC",
            "QUEUE",
            "VACCINE",
            "MEDICINE"
        ];


        let correct =
            0;


        function next() {

            const word =
                words[
                    randomInt(
                        0,
                        words.length - 1
                    )
                ];


            const scrambled =
                shuffle(
                    word.split("")
                ).join("");


            stage.innerHTML = `

                <div
                    class="quiz-box"
                >

                    <div
                        style="
                            text-align:center;
                            color:#8a91a2;
                            font-size:11px;
                            font-weight:800;
                        "
                    >
                        UNSCRAMBLE
                    </div>

                    <div
                        class="quiz-question"
                        style="
                            letter-spacing:.15em;
                        "
                    >
                        ${scrambled}
                    </div>

                    <input
                        id="scrambleInput"
                        autocomplete="off"
                        style="
                            width:100%;
                            box-sizing:border-box;
                            padding:14px;
                            border-radius:14px;
                            border:1px solid #e4e0ee;
                            text-align:center;
                            font-size:18px;
                            font-weight:800;
                            outline:none;
                        "
                        placeholder="Type the word"
                    >

                    <button
                        class="vizitor-game-btn"
                        id="scrambleSubmit"
                        style="
                            margin-top:12px;
                            width:100%;
                        "
                    >
                        Check
                    </button>

                </div>
            `;


            const input =
                $("scrambleInput");


            input?.focus();


            $("scrambleSubmit")
                ?.addEventListener(
                    "click",
                    function () {

                        if (
                            input.value
                                .trim()
                                .toUpperCase() ===
                            word
                        ) {

                            correct++;

                            setGameScore(
                                correct * 120
                            );
                        }


                        next();
                    }
                );
        }


        next();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 6 — ODD ONE OUT
    ======================================================== */

    function gameOdd() {

        const stage =
            $("gameStage");


        let correct =
            0;


        function next() {

            const base =
                randomInt(
                    1,
                    9
                );


            const odd =
                randomInt(
                    0,
                    8
                );


            const values =
                Array.from(
                    {
                        length: 9
                    },
                    (_, index) =>
                        index === odd
                            ? base + 1
                            : base
                );


            stage.innerHTML = `

                <div
                    style="
                        width:min(500px,95%);
                        text-align:center;
                    "
                >

                    <div
                        style="
                            color:#81899a;
                            font-size:11px;
                            font-weight:800;
                            margin-bottom:15px;
                        "
                    >
                        FIND THE ODD NUMBER
                    </div>

                    <div
                        style="
                            display:grid;
                            grid-template-columns:
                                repeat(3,1fr);
                            gap:12px;
                        "
                    >

                        ${values
                            .map(
                                (value, index) =>
                                    `
                                    <button
                                        class="quiz-option"
                                        data-index="${index}"
                                        style="
                                            font-size:22px;
                                        "
                                    >
                                        ${value}
                                    </button>
                                    `
                            )
                            .join("")
                        }

                    </div>

                </div>
            `;


            stage
                .querySelectorAll(
                    "[data-index]"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    Number(
                                        button.dataset.index
                                    ) === odd
                                ) {

                                    correct++;

                                    setGameScore(
                                        correct * 100
                                    );
                                }


                                next();
                            }
                        );
                    }
                );
        }


        next();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 7 — PATTERN
    ======================================================== */

    function gamePattern() {

        const stage =
            $("gameStage");


        let correct =
            0;


        function next() {

            const start =
                randomInt(
                    1,
                    8
                );

            const step =
                randomInt(
                    2,
                    6
                );


            const sequence =
                [
                    start,
                    start + step,
                    start + step * 2,
                    start + step * 3
                ];


            const answer =
                start +
                step * 4;


            const options =
                shuffle([
                    answer,
                    answer + 1,
                    answer - 2,
                    answer + 4
                ]);


            stage.innerHTML = `

                <div
                    class="quiz-box"
                >

                    <div
                        class="quiz-question"
                    >
                        ${sequence.join(
                            " → "
                        )} → ?
                    </div>

                    <div
                        class="quiz-options"
                    >

                        ${options
                            .map(
                                option =>
                                    `
                                    <button
                                        class="quiz-option"
                                        data-value="${option}"
                                    >
                                        ${option}
                                    </button>
                                    `
                            )
                            .join("")
                        }

                    </div>

                </div>
            `;


            stage
                .querySelectorAll(
                    "[data-value]"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            function () {

                                if (
                                    Number(
                                        button.dataset.value
                                    ) === answer
                                ) {

                                    correct++;

                                    setGameScore(
                                        correct * 125
                                    );
                                }


                                next();
                            }
                        );
                    }
                );
        }


        next();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 8 — TARGET
    ======================================================== */

    function gameTarget() {

        const stage =
            $("gameStage");


        stage.innerHTML = `

            <div
                class="target-zone"
                id="targetZone"
            >

                <button
                    class="target"
                    id="targetButton"
                >
                </button>

            </div>
        `;


        const zone =
            $("targetZone");

        const target =
            $("targetButton");


        let hits =
            0;


        function move() {

            const rect =
                zone.getBoundingClientRect();


            const x =
                Math.random() *
                Math.max(
                    1,
                    rect.width - 65
                );


            const y =
                Math.random() *
                Math.max(
                    1,
                    rect.height - 65
                );


            target.style.left =
                `${x}px`;

            target.style.top =
                `${y}px`;
        }


        target.addEventListener(
            "click",
            function () {

                if (
                    gameState.ended
                ) {
                    return;
                }


                hits++;

                setGameScore(
                    hits * 100
                );

                move();
            }
        );


        move();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 9 — SIGNAL
    ======================================================== */

    function gameSignal() {

        const stage =
            $("gameStage");


        const signals = [
            {
                icon: "🟢",
                correct: true
            },
            {
                icon: "🔴",
                correct: false
            },
            {
                icon: "🟡",
                correct: false
            },
            {
                icon: "🔵",
                correct: false
            }
        ];


        let score =
            0;


        function next() {

            const signal =
                signals[
                    randomInt(
                        0,
                        signals.length - 1
                    )
                ];


            stage.innerHTML = `

                <div
                    style="
                        text-align:center;
                    "
                >

                    <div
                        style="
                            font-size:75px;
                            margin-bottom:20px;
                        "
                    >
                        ${signal.icon}
                    </div>

                    <div
                        style="
                            color:#7b8497;
                            font-size:12px;
                            font-weight:700;
                        "
                    >
                        TAP ONLY IF IT IS GREEN
                    </div>

                    <button
                        class="vizitor-game-btn"
                        id="signalButton"
                        style="
                            margin-top:18px;
                            min-width:180px;
                        "
                    >
                        RESPOND
                    </button>

                </div>
            `;


            $("signalButton")
                ?.addEventListener(
                    "click",
                    function () {

                        if (
                            signal.correct
                        ) {

                            score++;

                            setGameScore(
                                score * 100
                            );
                        }

                        next();
                    }
                );


            /*
             * A missed green signal is penalized by simply
             * not awarding points. This avoids unfair negative
             * scoring.
             */
        }


        next();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 10 — TOKEN CATCH
    ======================================================== */

    function gameToken() {

        const stage =
            $("gameStage");


        stage.innerHTML = `

            <div
                class="target-zone"
                id="tokenZone"
            >

                <button
                    class="target"
                    id="tokenButton"
                    style="
                        background:
                            linear-gradient(
                                135deg,
                                #7c3aed,
                                #4f46e5
                            );
                        color:white;
                        font-size:25px;
                    "
                >
                    🎫
                </button>

            </div>
        `;


        const zone =
            $("tokenZone");

        const token =
            $("tokenButton");


        let hits =
            0;


        function move() {

            const rect =
                zone.getBoundingClientRect();


            token.style.left =
                `${Math.random() *
                Math.max(
                    1,
                    rect.width - 65
                )}px`;


            token.style.top =
                `${Math.random() *
                Math.max(
                    1,
                    rect.height - 65
                )}px`;
        }


        token.addEventListener(
            "click",
            function () {

                if (
                    gameState.ended
                ) {
                    return;
                }


                hits++;


                setGameScore(
                    hits * 90
                );


                move();
            }
        );


        move();


        startTimedGame(
            GAME_DURATION
        );
    }


    /* ========================================================
       GAME 11 — TETRIS
    ======================================================== */

    const TETRIS_ROWS =
        20;

    const TETRIS_COLS =
        10;


    const TETROMINOES = {

        I: [
            [
                [1,1,1,1]
            ],
            [
                [1],
                [1],
                [1],
                [1]
            ]
        ],

        O: [
            [
                [1,1],
                [1,1]
            ]
        ],

        T: [
            [
                [0,1,0],
                [1,1,1]
            ],
            [
                [1,0],
                [1,1],
                [1,0]
            ],
            [
                [1,1,1],
                [0,1,0]
            ],
            [
                [0,1],
                [1,1],
                [0,1]
            ]
        ],

        L: [
            [
                [1,0],
                [1,0],
                [1,1]
            ],
            [
                [1,1,1],
                [1,0,0]
            ],
            [
                [1,1],
                [0,1],
                [0,1]
            ],
            [
                [0,0,1],
                [1,1,1]
            ]
        ],

        J: [
            [
                [0,1],
                [0,1],
                [1,1]
            ],
            [
                [1,0,0],
                [1,1,1]
            ],
            [
                [1,1],
                [1,0],
                [1,0]
            ],
            [
                [1,1,1],
                [0,0,1]
            ]
        ],

        S: [
            [
                [0,1,1],
                [1,1,0]
            ],
            [
                [1,0],
                [1,1],
                [0,1]
            ]
        ],

        Z: [
            [
                [1,1,0],
                [0,1,1]
            ],
            [
                [0,1],
                [1,1],
                [1,0]
            ]
        ]

    };


    function rotateMatrix(
        matrix
    ) {

        const rows =
            matrix.length;

        const cols =
            matrix[0].length;


        const result =
            Array.from(
                {
                    length: cols
                },
                () =>
                    Array(rows).fill(0)
            );


        for (
            let row = 0;
            row < rows;
            row++
        ) {

            for (
                let col = 0;
                col < cols;
                col++
            ) {

                result[col][
                    rows - 1 - row
                ] =
                    matrix[row][col];
            }
        }


        return result;
    }


    function cloneMatrix(
        matrix
    ) {

        return matrix.map(
            row => [...row]
        );
    }


    function gameTetris() {

        const stage =
            $("gameStage");


        const board =
            Array.from(
                {
                    length:
                        TETRIS_ROWS
                },
                () =>
                    Array(
                        TETRIS_COLS
                    ).fill(0)
            );


        let current =
            null;


        let lines =
            0;


        let level =
            1;


        let dropTimer =
            null;


        const colors =
            [
                1,
                2,
                3,
                4,
                5,
                6,
                7
            ];


        function randomPiece() {

            const keys =
                Object.keys(
                    TETROMINOES
                );


            const key =
                keys[
                    randomInt(
                        0,
                        keys.length - 1
                    )
                ];


            return {

                type: key,

                rotation: 0,

                matrix:
                    cloneMatrix(
                        TETROMINOES[key][0]
                    ),

                row: 0,

                col:
                    Math.floor(
                        (
                            TETRIS_COLS -
                            TETROMINOES[key][0][0].length
                        ) / 2
                    ),

                value:
                    colors[
                        randomInt(
                            0,
                            colors.length - 1
                        )
                    ]

            };
        }


        function collision(
            piece,
            testRow,
            testCol,
            testMatrix
        ) {

            for (
                let row = 0;
                row < testMatrix.length;
                row++
            ) {

                for (
                    let col = 0;
                    col < testMatrix[row].length;
                    col++
                ) {

                    if (
                        !testMatrix[row][col]
                    ) {
                        continue;
                    }


                    const boardRow =
                        testRow + row;

                    const boardCol =
                        testCol + col;


                    if (
                        boardCol < 0 ||
                        boardCol >= TETRIS_COLS ||
                        boardRow >= TETRIS_ROWS
                    ) {

                        return true;
                    }


                    if (
                        boardRow >= 0 &&
                        board[
                            boardRow
                        ][
                            boardCol
                        ]
                    ) {

                        return true;
                    }
                }
            }


            return false;
        }


        function spawn() {

            current =
                randomPiece();


            if (
                collision(
                    current,
                    current.row,
                    current.col,
                    current.matrix
                )
            ) {

                finishGame();
            }
        }


        function merge() {

            for (
                let row = 0;
                row < current.matrix.length;
                row++
            ) {

                for (
                    let col = 0;
                    col < current.matrix[row].length;
                    col++
                ) {

                    if (
                        !current.matrix[row][col]
                    ) {
                        continue;
                    }


                    const boardRow =
                        current.row + row;

                    const boardCol =
                        current.col + col;


                    if (
                        boardRow >= 0 &&
                        boardRow < TETRIS_ROWS &&
                        boardCol >= 0 &&
                        boardCol < TETRIS_COLS
                    ) {

                        board[
                            boardRow
                        ][
                            boardCol
                        ] =
                            current.value;
                    }
                }
            }
        }


        function clearLines() {

            let cleared =
                0;


            for (
                let row =
                    TETRIS_ROWS - 1;
                row >= 0;
                row--
            ) {

                if (
                    board[row].every(
                        cell => cell
                    )
                ) {

                    board.splice(
                        row,
                        1
                    );

                    board.unshift(
                        Array(
                            TETRIS_COLS
                        ).fill(0)
                    );


                    cleared++;

                    row++;
                }
            }


            if (
                cleared > 0
            ) {

                lines +=
                    cleared;


                level =
                    1 +
                    Math.floor(
                        lines / 5
                    );


                const lineScores = {
                    1: 100,
                    2: 250,
                    3: 450,
                    4: 700
                };


                setGameScore(
                    (
                        gameState.score +
                        (
                            lineScores[
                                cleared
                            ] || 100
                        )
                    )
                );
            }
        }


        function lock() {

            merge();

            clearLines();

            spawn();
        }


        function drop() {

            if (
                !current ||
                gameState.ended
            ) {
                return;
            }


            if (
                !collision(
                    current,
                    current.row + 1,
                    current.col,
                    current.matrix
                )
            ) {

                current.row++;

            } else {

                lock();
            }


            render();
        }


        function move(
            direction
        ) {

            if (
                !current ||
                gameState.ended
            ) {
                return;
            }


            const nextCol =
                current.col +
                direction;


            if (
                !collision(
                    current,
                    current.row,
                    nextCol,
                    current.matrix
                )
            ) {

                current.col =
                    nextCol;
            }


            render();
        }


        function rotate() {

            if (
                !current ||
                gameState.ended
            ) {
                return;
            }


            const rotated =
                rotateMatrix(
                    current.matrix
                );


            if (
                !collision(
                    current,
                    current.row,
                    current.col,
                    rotated
                )
            ) {

                current.matrix =
                    rotated;
            }


            render();
        }


        function hardDrop() {

            if (
                !current ||
                gameState.ended
            ) {
                return;
            }


            while (
                !collision(
                    current,
                    current.row + 1,
                    current.col,
                    current.matrix
                )
            ) {

                current.row++;
            }


            lock();

            render();
        }


        function render() {

            const boardElement =
                $("tetrisBoard");


            if (!boardElement) {
                return;
            }


            const cells =
                boardElement.children;


            for (
                let index = 0;
                index < cells.length;
                index++
            ) {

                const row =
                    Math.floor(
                        index /
                        TETRIS_COLS
                    );

                const col =
                    index %
                    TETRIS_COLS;


                cells[index].className =
                    "tetris-cell";


                if (
                    board[row][col]
                ) {

                    cells[index].classList.add(
                        "filled"
                    );
                }
            }


            if (current) {

                for (
                    let row = 0;
                    row < current.matrix.length;
                    row++
                ) {

                    for (
                        let col = 0;
                        col < current.matrix[row].length;
                        col++
                    ) {

                        if (
                            !current.matrix[row][col]
                        ) {
                            continue;
                        }


                        const boardRow =
                            current.row + row;

                        const boardCol =
                            current.col + col;


                        if (
                            boardRow >= 0 &&
                            boardRow < TETRIS_ROWS &&
                            boardCol >= 0 &&
                            boardCol < TETRIS_COLS
                        ) {

                            const index =
                                boardRow *
                                TETRIS_COLS +
                                boardCol;


                            if (
                                cells[index]
                            ) {

                                cells[index].classList.add(
                                    "filled"
                                );
                            }
                        }
                    }
                }
            }


            const lineElement =
                $("tetrisLines");


            if (lineElement) {

                lineElement.textContent =
                    String(lines);
            }


            const levelElement =
                $("tetrisLevel");


            if (levelElement) {

                levelElement.textContent =
                    String(level);
            }
        }


        stage.innerHTML = `

            <div
                class="tetris-wrap"
            >

                <div
                    id="tetrisBoard"
                    class="tetris-board"
                >

                    ${Array.from(
                        {
                            length:
                                TETRIS_ROWS *
                                TETRIS_COLS
                        },
                        () =>
                            `
                            <div
                                class="tetris-cell"
                            ></div>
                            `
                    ).join("")}

                </div>

                <div
                    class="tetris-side"
                >

                    <h3>
                        🧱 Tetris
                    </h3>

                    <p>
                        Clear complete rows to score.
                        More lines in one move = more points.
                    </p>

                    <p>
                        Lines:
                        <strong id="tetrisLines">
                            0
                        </strong>
                    </p>

                    <p>
                        Level:
                        <strong id="tetrisLevel">
                            1
                        </strong>
                    </p>

                    <div
                        class="tetris-controls"
                    >

                        <button
                            class="tetris-control"
                            id="tetrisLeft"
                        >
                            ←
                        </button>

                        <button
                            class="tetris-control"
                            id="tetrisRotate"
                        >
                            ↻
                        </button>

                        <button
                            class="tetris-control"
                            id="tetrisRight"
                        >
                            →
                        </button>

                        <button
                            class="tetris-control"
                            id="tetrisDrop"
                            style="
                                grid-column:1 / -1;
                            "
                        >
                            DROP
                        </button>

                    </div>

                </div>

            </div>
        `;


        $("tetrisLeft")
            ?.addEventListener(
                "click",
                () => move(-1)
            );


        $("tetrisRight")
            ?.addEventListener(
                "click",
                () => move(1)
            );


        $("tetrisRotate")
            ?.addEventListener(
                "click",
                rotate
            );


        $("tetrisDrop")
            ?.addEventListener(
                "click",
                hardDrop
            );


        function keyboard(
            event
        ) {

            if (
                !gamesModal?.classList.contains(
                    "open"
                ) ||
                gameState?.id !==
                "tetris"
            ) {
                return;
            }


            if (
                event.key ===
                "ArrowLeft"
            ) {

                event.preventDefault();

                move(-1);
            }

            else if (
                event.key ===
                "ArrowRight"
            ) {

                event.preventDefault();

                move(1);
            }

            else if (
                event.key ===
                "ArrowUp"
            ) {

                event.preventDefault();

                rotate();
            }

            else if (
                event.key ===
                "ArrowDown"
            ) {

                event.preventDefault();

                drop();
            }

            else if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

                hardDrop();
            }
        }


        document.addEventListener(
            "keydown",
            keyboard
        );


        gameState.timeout =
            setTimeout(
                function () {

                    document.removeEventListener(
                        "keydown",
                        keyboard
                    );

                },
                10 * 60 * 1000
            );


        spawn();

        render();


        /*
         * Tetris is skill/practice based, so instead of a
         * forced 30-second termination we give it a generous
         * session window. The score still has the same 0–1000
         * Arcade ceiling.
         */

        gameState.timer =
            setInterval(
                function () {

                    if (
                        !gameState ||
                        gameState.ended
                    ) {
                        return;
                    }


                    drop();


                    const speed =
                        Math.max(
                            120,
                            850 -
                            (
                                level *
                                70
                            )
                        );


                    clearInterval(
                        dropTimer
                    );


                    dropTimer =
                        setInterval(
                            drop,
                            speed
                        );

                },
                850
            );


        dropTimer =
            setInterval(
                drop,
                850
            );


        /*
         * Stop Tetris after a generous 3-minute session.
         */

        gameState.timeout =
            setTimeout(
                function () {

                    finishGame();

                },
                180000
            );
    }


    /* ========================================================
       CLEANUP PATCH FOR TETRIS
    ======================================================== */

    const originalCleanupGame =
        cleanupGame;


    cleanupGame =
        function () {

            if (
                typeof dropTimer !==
                "undefined" &&
                dropTimer
            ) {

                clearInterval(
                    dropTimer
                );

                dropTimer =
                    null;
            }


            originalCleanupGame();
        };


    /* ========================================================
       INITIALIZATION
    ======================================================== */

    function initialize() {

        injectStyles();

        buildArticleExplorer();
        setupArticleCardClick();

        setupWellnessCard();

        setupChallengeCard();

        setupGamesCard();

        // Defensive delegation: the four Arcade cards always remain clickable.
        document.addEventListener("click", function (event) {
            const card = event.target.closest(".arcade-card[data-section]");
            if (!card) return;
            if (card.id === "arcadeArticles" && !articlePanelOpen) openArticleExplorer();
            if (card.id === "arcadeWellness" && !wellnessModal?.classList.contains("open")) openWellness();
            if (card.id === "arcadeChallenges" && !challengeModal?.classList.contains("open")) openChallenges();
            if (card.id === "arcadeGames" && !gamesModal?.classList.contains("open")) openGames();
        });

        updateCardRecommendations();

        updateRecommendation();


        setTimeout(
            refreshQueue,
            250
        );


        queueRefreshTimer =
            setInterval(
                refreshQueue,
                5000
            );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }


})();