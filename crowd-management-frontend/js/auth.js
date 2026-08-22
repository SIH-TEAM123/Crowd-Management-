// Real authentication using FastAPI

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const googleButton = document.getElementById("btnGoogle");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = document.getElementById("email")?.value.trim();
            const password = document.getElementById("password")?.value;
            const rememberMe = document.getElementById("rememberMe")?.checked;

            if (!email || !password) {
                alert("Please fill in both email and password.");
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.detail || "Login failed.");
                    return;
                }

                // Store the real JWT
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("userEmail", email);
                localStorage.setItem("isAuthenticated", "true");

                if (rememberMe) {
                    localStorage.setItem("rememberMe", "true");
                } else {
                    localStorage.removeItem("rememberMe");
                }

                // Go to dashboard
                window.location.href = "dashboard.html";

            } catch (error) {
                console.error("Login error:", error);
                alert("Unable to connect to the server.");
            }
        });
    }

    // Google login is not connected to FastAPI yet.
    if (googleButton) {
        googleButton.addEventListener("click", () => {
            alert("Google Sign-In is not connected yet.");
        });
    }
});