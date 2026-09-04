/**
 * VIZITOR — Multilingual Support Engine (English, Hindi, Odia)
 * SIH 2026 / S157 — The ODRISCOLLS
 *
 * CRITICAL RULE:
 * Text changes with language, but Token numbers, queue positions,
 * waiting times, and server telemetry remain 100% IDENTICAL backend values.
 */

(function () {
    "use strict";

    const STORAGE_KEY = "vizitor_lang";

    const TRANSLATIONS = {
        en: {
            brandName: "Symmetry",
            navDashboard: "Dashboard",
            navAppointments: "Appointments",
            navQueue: "Live Queue",
            navCrowd: "Crowd Status",
            navForecast: "Crowd Forecast",
            navHealthcare: "Healthcare 360",
            navHospitalMap: "Hospital Map",
            navAnalytics: "Analytics",
            navArcade: "Arcade & Wellness",
            navNotifications: "Notifications",
            navProfile: "Profile",
            navLogout: "Sign Out",

            // Headers & Common
            liveQueue: "Live Queue & Token Status",
            currentlyServing: "Now Serving",
            yourToken: "Your Token",
            peopleAhead: "People Ahead",
            estimatedWait: "Estimated Wait",
            crowdLevel: "Crowd Level",
            activePeople: "People Present",
            bookAppointment: "Book New Appointment",
            serviceName: "Service Name",
            selectDate: "Select Date",
            selectTime: "Select Time",
            priorityType: "Priority Level",
            priorityNormal: "Normal (FCFS)",
            priorityEmergency: "Emergency Priority",
            priorityVulnerable: "Senior / Vulnerable",
            cancel: "Cancel",
            confirmBooking: "Book Appointment",
            viewQR: "QR Pass",
            minutesUnit: "min",
            noCrowd: "No Crowd",
            lowCrowd: "Low",
            moderateCrowd: "Moderate",
            highCrowd: "High",
            criticalCrowd: "Critical",
            waiting: "Waiting",
            serving: "Being Served",
            served: "Served",
        },
        hi: {
            brandName: "सिमेट्री",
            navDashboard: "डैशबोर्ड",
            navAppointments: "अपॉइंटमेंट्स",
            navQueue: "लाइव कतार",
            navCrowd: "भीड़ की स्थिति",
            navForecast: "भीड़ पूर्वानुमान",
            navHealthcare: "स्वास्थ्य 360",
            navHospitalMap: "अस्पताल का नक्शा",
            navAnalytics: "विश्लेषण",
            navArcade: "आर्केड और स्वास्थ्य",
            navNotifications: "सूचनाएं",
            navProfile: "प्रोफ़ाइल",
            navLogout: "लॉग आउट",

            // Headers & Common
            liveQueue: "लाइव कतार और टोकन स्थिति",
            currentlyServing: "वर्तमान सेवा",
            yourToken: "आपका टोकन",
            peopleAhead: "आगे लोग",
            estimatedWait: "अनुमानित प्रतीक्षा",
            crowdLevel: "भीड़ का स्तर",
            activePeople: "उपस्थित लोग",
            bookAppointment: "नया अपॉइंटमेंट बुक करें",
            serviceName: "सेवा का नाम",
            selectDate: "तारीख चुनें",
            selectTime: "समय चुनें",
            priorityType: "प्राथमिकता स्तर",
            priorityNormal: "सामान्य (पहले आओ)",
            priorityEmergency: "आपातकालीन प्राथमिकता",
            priorityVulnerable: "वरिष्ठ / दिव्यांग",
            cancel: "रद्द करें",
            confirmBooking: "अपॉइंटमेंट बुक करें",
            viewQR: "क्यूआर पास",
            minutesUnit: "मिनट",
            noCrowd: "कोई भीड़ नहीं",
            lowCrowd: "कम भीड़",
            moderateCrowd: "मध्यम भीड़",
            highCrowd: "अधिक भीड़",
            criticalCrowd: "अत्यधिक भीड़",
            waiting: "प्रतीक्षारत",
            serving: "सेवा चालू है",
            served: "सेवा पूर्ण",
        },
        or: {
            brandName: "ସିମେଟ୍ରି",
            navDashboard: "ଡ୍ୟାସବୋର୍ଡ",
            navAppointments: "ଆପଏଣ୍ଟମେଣ୍ଟ",
            navQueue: "ଲାଇଭ ଧାଡ଼ି",
            navCrowd: "ଭିଡ଼ ସ୍ଥିତି",
            navForecast: "ଭିଡ଼ ପୂର୍ବାନୁମାନ",
            navHealthcare: "ସ୍ୱାସ୍ଥ୍ୟସେବା ୩୬୦",
            navHospitalMap: "ଡାକ୍ତରଖାନା ମାନଚିତ୍ର",
            navAnalytics: "ବିଶ୍ଳେଷଣ",
            navArcade: "ଆର୍କେଡ ଓ ସ୍ୱାସ୍ଥ୍ୟ",
            navNotifications: "ବାର୍ତ୍ତା",
            navProfile: "ପ୍ରୋଫାଇଲ୍",
            navLogout: "ଲଗ୍ ଆଉଟ୍",

            // Headers & Common
            liveQueue: "ଲାଇଭ ଧାଡ଼ି ଓ ଟୋକନ୍ ସ୍ଥିତି",
            currentlyServing: "ବର୍ତ୍ତମାନ ସେବା",
            yourToken: "ଆପଣଙ୍କ ଟୋକନ୍",
            peopleAhead: "ଆଗରେ ଥିବା ଲୋକ",
            estimatedWait: "ଆନୁମାନିକ ଅପେକ୍ଷା",
            crowdLevel: "ଭିଡ଼ ସ୍ତର",
            activePeople: "ଉପସ୍ଥିତ ଲୋକ",
            bookAppointment: "ନୂତନ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ",
            serviceName: "ସେବା ନାମ",
            selectDate: "ତାରିଖ ବାଛନ୍ତୁ",
            selectTime: "ସମୟ ବାଛନ୍ତୁ",
            priorityType: "ପ୍ରାଥମିକତା ସ୍ତର",
            priorityNormal: "ସାଧାରଣ",
            priorityEmergency: "ଜରୁରୀକାଳୀନ",
            priorityVulnerable: "ବରିଷ୍ଠ ନାଗରିକ",
            cancel: "ବାତିଲ୍",
            confirmBooking: "ବୁକ୍ କରନ୍ତୁ",
            viewQR: "କ୍ୟୁଆର୍ ପାସ୍",
            minutesUnit: "ମିନିଟ୍",
            noCrowd: "ଭିଡ଼ ନାହିଁ",
            lowCrowd: "କମ୍ ଭିଡ଼",
            moderateCrowd: "ମଧ୍ୟମ ଭିଡ଼",
            highCrowd: "ଅଧିକ ଭିଡ଼",
            criticalCrowd: "ଅତ୍ୟଧିକ ଭିଡ଼",
            waiting: "ଅପେକ୍ଷାରତ",
            serving: "ସେବା ଚାଲୁଅଛି",
            served: "ସେବା ସମାପ୍ତ",
        }
    };

    function getCurrentLang() {
        return localStorage.getItem(STORAGE_KEY) || "en";
    }

    function setLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = "en";
        localStorage.setItem(STORAGE_KEY, lang);
        applyTranslations();
        window.dispatchEvent(new CustomEvent("vizitorLanguageChanged", { detail: { lang } }));
    }

    function t(key) {
        const lang = getCurrentLang();
        return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || (TRANSLATIONS.en && TRANSLATIONS.en[key]) || key;
    }

    function applyTranslations() {
        const lang = getCurrentLang();
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

        // Apply to elements marked with data-i18n
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        // Translate sidebar menu items
        const menuLinks = {
            "dashboard.html": dict.navDashboard,
            "appointments.html": dict.navAppointments,
            "queue.html": dict.navQueue,
            "crowd.html": dict.navCrowd,
            "crowd-forecast.html": dict.navForecast,
            "healthcare.html": dict.navHealthcare,
            "hospital-map.html": dict.navHospitalMap,
            "analytics.html": dict.navAnalytics,
            "arcade.html": dict.navArcade,
            "notifications.html": dict.navNotifications,
            "profile.html": dict.navProfile,
        };

        document.querySelectorAll(".sidebar-menu .menu-item").forEach(a => {
            const href = a.getAttribute("href");
            const span = a.querySelector("span");
            if (span && href && menuLinks[href]) {
                span.textContent = menuLinks[href];
            }
        });

        // Update language switcher dropdown selection
        const select = document.getElementById("vizitorLangSelect");
        if (select) {
            select.value = lang;
        }
    }

    function injectLanguageSwitcher() {
        if (document.getElementById("vizitorLangSwitcher")) return;

        const currentLang = getCurrentLang();
        const container = document.createElement("div");
        container.id = "vizitorLangSwitcher";
        container.style.cssText = "display:inline-flex;align-items:center;margin-left:auto;margin-right:1rem;gap:0.4rem;font-size:0.85rem;font-weight:600;";

        container.innerHTML = `
            <span style="color:#64748b;display:inline-flex;align-items:center;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Lang:
            </span>
            <select id="vizitorLangSelect" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:3px 8px;font-size:0.85rem;color:#1e293b;cursor:pointer;font-weight:600;outline:none;">
                <option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
                <option value="hi" ${currentLang === "hi" ? "selected" : ""}>हिंदी (Hindi)</option>
                <option value="or" ${currentLang === "or" ? "selected" : ""}>ଓଡ଼ିଆ (Odia)</option>
            </select>
        `;

        // Try mounting inside .topbar, .user-nav, .dashboard-header, or body
        const mountTarget =
            document.querySelector(".topbar-right") ||
            document.querySelector(".topbar") ||
            document.querySelector(".user-nav") ||
            document.querySelector(".header-right") ||
            document.querySelector(".dashboard-header");

        if (mountTarget) {
            mountTarget.insertBefore(container, mountTarget.firstChild);
        }

        const select = document.getElementById("vizitorLangSelect");
        if (select) {
            select.addEventListener("change", (e) => {
                setLanguage(e.target.value);
            });
        }
    }

    // Public API
    window.VIZITOR_I18N = {
        t,
        setLanguage,
        getCurrentLang,
        applyTranslations
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectLanguageSwitcher();
        applyTranslations();
    });
})();
