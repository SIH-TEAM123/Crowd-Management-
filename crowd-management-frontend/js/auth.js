// Authentication logic for Symmetry Login

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const googleButton = document.getElementById("btnGoogle");

    if (loginForm) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault(); // Prevent the page from refreshing

            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");
            const rememberMeInput = document.getElementById("rememberMe");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value.trim() : "";
            const rememberMe = rememberMeInput ? rememberMeInput.checked : false;

            if (!email || !password) {
                alert("Please fill in both email and password.");
                return;
            }

            console.log("Mock Sign In Event triggered:");
            console.log("Email:", email);
            console.log("Password:", password ? "••••••••" : "Empty");
            console.log("Remember for 30 days:", rememberMe);

            // Persist mock authentication state
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("userEmail", email);

            // Redirect to dashboard
            window.location.href = "dashboard.html";
        });
    }

    if (googleButton) {
        googleButton.addEventListener("click", () => {
            console.log("Mock Sign In with Google triggered");

            // Persist mock authentication state
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("userEmail", "google.user@example.com");

            // Redirect to dashboard
            window.location.href = "dashboard.html";
        });
    }
});

