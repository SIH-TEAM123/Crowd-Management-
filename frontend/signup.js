// VIZITOR - User Signup

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signupForm");

    if (!signupForm) return;

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        // Basic validation
        if (!fullName || !email || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: fullName,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "Unable to create account.");
                return;
            }

            alert("Account created successfully! Please sign in.");

            window.location.href = "index.html";

        } catch (error) {
            console.error("Signup error:", error);
            alert("Unable to connect to the server.");
        }
    });
});