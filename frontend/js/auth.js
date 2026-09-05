// Real authentication using FastAPI
const LOCAL_API_URL = "http://127.0.0.1:8000";
const RENDER_API_URL = "https://vizitor.onrender.com";

function getEffectiveApiBaseUrl() {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1" ||
        window.location.hostname === "";
    return isLocal ? LOCAL_API_URL : RENDER_API_URL;
}

var API_BASE_URL = getEffectiveApiBaseUrl();

document.addEventListener("DOMContentLoaded", () => {

    const loginForm =
        document.getElementById("loginForm");

    const googleButton =
        document.getElementById("btnGoogle");


    // ========================================================
    // LOGIN
    // ========================================================

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                const email =
                    document
                        .getElementById("email")
                        ?.value
                        .trim();

                const password =
                    document
                        .getElementById("password")
                        ?.value;

                const rememberMe =
                    document
                        .getElementById("rememberMe")
                        ?.checked;


                if (!email || !password) {

                    alert(
                        "Please fill in both email and password."
                    );

                    return;
                }


                let primaryApi = getEffectiveApiBaseUrl();
                let fallbackApi = primaryApi === LOCAL_API_URL ? RENDER_API_URL : LOCAL_API_URL;

                let response = null;
                let usedApi = primaryApi;

                try {
                    response = await fetch(`${primaryApi}/auth/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: email, password: password })
                    });
                } catch (netErr) {
                    console.warn(`[VIZITOR Auth] Primary API (${primaryApi}) unreachable, attempting fallback (${fallbackApi}):`, netErr);
                    try {
                        response = await fetch(`${fallbackApi}/auth/login`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: email, password: password })
                        });
                        usedApi = fallbackApi;
                        window.API_BASE_URL = fallbackApi;
                        API_BASE_URL = fallbackApi;
                    } catch (fallbackErr) {
                        console.error("[VIZITOR Auth] Both APIs unreachable:", netErr, fallbackErr);
                        alert(`Unable to connect to the backend server.\nTried: ${primaryApi} and ${fallbackApi}.\nPlease verify that FastAPI is running on ${LOCAL_API_URL} or check your internet connection.`);
                        return;
                    }
                }

                try {
                    const data = await response.json();


                    if (!response.ok) {
                        let errMsg = "Login failed.";
                        if (typeof data.detail === "string") {
                            errMsg = data.detail;
                        } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
                            errMsg = data.detail[0].msg;
                        } else if (data.message) {
                            errMsg = data.message;
                        }
                        alert(errMsg);
                        return;
                    }


                    // ====================================================
                    // STORE REAL JWT FROM RENDER BACKEND
                    // ====================================================

                    localStorage.setItem(
                        "access_token",
                        data.access_token
                    );

                    localStorage.setItem(
                        "userEmail",
                        email
                    );

                    localStorage.setItem(
                        "isAuthenticated",
                        "true"
                    );


                    if (rememberMe) {

                        localStorage.setItem(
                            "rememberMe",
                            "true"
                        );

                    } else {

                        localStorage.removeItem(
                            "rememberMe"
                        );
                    }


                    // ====================================================
                    // GO TO DASHBOARD
                    // ====================================================

                    window.location.href =
                        "dashboard.html";


                } catch (error) {

                    console.error(
                        "Login error:",
                        error
                    );

                    alert(
                        "Unable to connect to the server."
                    );
                }
            }
        );
    }


    // ========================================================
    // GOOGLE LOGIN
    // ========================================================

    if (googleButton) {

        googleButton.addEventListener(
            "click",
            () => {

                alert(
                    "Google Sign-In is not connected yet."
                );

            }
        );
    }

});