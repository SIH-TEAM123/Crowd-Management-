// ============================================================
// VIZITOR - API configuration
// ============================================================

const API_BASE_URL =
    window.VIZITOR_API_URL ||
    "https://vizitor.onrender.com";

console.log(
    "VIZITOR API:",
    API_BASE_URL
);


// ============================================================
// Crowd Forecast API
// ============================================================

window.VIZITOR = window.VIZITOR || {};

window.VIZITOR.getCrowdForecast = async function () {

    const response =
        await fetch(
            `${API_BASE_URL}/optimization/forecast`,
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