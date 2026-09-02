document.addEventListener("DOMContentLoaded", () => {

    const signupForm = document.getElementById("signupForm");

    if (!signupForm) {
        console.error("Signup form not found.");
        return;
    }

    signupForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const fullName = document.getElementById("fullName")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value;
        const confirmPassword =
            document.getElementById("confirmPassword")?.value;

        if (!fullName || !email || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        if (password.length < 8) {
            alert("Password must be at least 8 characters.");
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        full_name: fullName,
                        email: email,
                        password: password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {

    if (
        data.detail &&
        data.detail.toLowerCase().includes("already registered")
    ) {
        // Save email for OTP verification
        localStorage.setItem(
            "pendingVerificationEmail",
            email
        );

        localStorage.setItem(
            "signupEmail",
            email
        );

        alert("Email already registered. Please verify your email.");

        // Go to OTP verification page
        window.location.href = "verify-otp.html";
        return;
    }

    alert(data.detail || "Registration failed.");
    return;
}

            // Save email for OTP verification
            localStorage.setItem(
                "pendingVerificationEmail",
                email
            );

            localStorage.setItem(
                "signupEmail",
                email
            );

            alert("Account created! Please check your email for the OTP.");

            // Go to OTP verification page
            window.location.href = "verify-otp.html";

        } catch (error) {

            console.error("Signup error:", error);
            alert("Unable to connect to the server.");

        }

    });

});