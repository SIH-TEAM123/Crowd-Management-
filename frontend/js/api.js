// ============================================================
// VIZITOR - Centralized API Configuration
// ============================================================

(function () {
    const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === ""; // file:// protocol support

    // Priority:
    // 1. Explicit window override (e.g. window.VIZITOR_API_URL)
    // 2. LocalStorage override (e.g. localStorage.setItem("vizitor_api_url", "..."))
    // 3. Environment detection: local dev -> http://127.0.0.1:8000, production -> https://vizitor.onrender.com
    const defaultApiUrl = isLocalhost
        ? "http://127.0.0.1:8000"
        : "https://vizitor.onrender.com";

    const resolvedApiUrl =
        window.VIZITOR_API_URL ||
        localStorage.getItem("vizitor_api_url") ||
        defaultApiUrl;

    window.API_BASE_URL = resolvedApiUrl;
    window.HEALTHCARE_API_BASE = resolvedApiUrl;

    console.log("[VIZITOR] API Base URL:", resolvedApiUrl, isLocalhost ? "(Local Mode)" : "(Production Mode)");
})();

const API_BASE_URL = window.API_BASE_URL;
const HEALTHCARE_API_BASE = window.HEALTHCARE_API_BASE;


// ============================================================
// Crowd Forecast API
// ============================================================

window.VIZITOR = window.VIZITOR || {};

window.VIZITOR.getCrowdForecast = async function () {

    const response =
        await fetch(
            `${window.API_BASE_URL}/optimization/forecast`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            `Forecast API error: ${response.status}`
        );
    }

    return await response.json();
};