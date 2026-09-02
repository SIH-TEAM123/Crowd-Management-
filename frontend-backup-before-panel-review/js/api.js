// VIZITOR - API configuration
const API_BASE_URL =
    window.VIZITOR_API_URL ||
    "https://vizitor.onrender.com";

console.log("VIZITOR API:", API_BASE_URL);


// ---------------------------------------------------------
// VIZITOR API
// ---------------------------------------------------------

window.VIZITOR = window.VIZITOR || {};

VIZITOR.getCrowdForecast = async function () {
    const response = await fetch(
        `${API_BASE_URL}/optimization/forecast`
    );

    if (!response.ok) {
        throw new Error(
            `Forecast API error: ${response.status}`
        );
    }

    return await response.json();
};