// Authentication logic for Symmetry Login

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const googleButton = document.getElementById("btnGoogle");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault(); // Prevent page refresh

            const emailInput = document.getElementById("email");
            const passwordInput = document.getElementById("password");
            const rememberMeInput = document.getElementById("rememberMe");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value.trim() : "";

            if (!email || !password) {
                alert("Please fill in both email and password.");
                return;
            }

            const submitBtn = loginForm.querySelector("button[type='submit']");
            let originalText = "";
            if (submitBtn) {
                originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = "Signing in...";
            }

            const result = await loginUser(email, password);

            if (result.success) {
                console.log("Login successful:", result.data);
                window.location.href = "dashboard.html";
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                alert(result.message || "Login failed. Please check your credentials.");
            }
        });
    }

    if (googleButton) {
        googleButton.addEventListener("click", () => {
            alert("Google Sign-In is for demo purposes. Please log in using your registered email and password.");
        });
    }
});


