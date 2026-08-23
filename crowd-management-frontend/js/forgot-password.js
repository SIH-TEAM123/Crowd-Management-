// VIZITOR - Forgot Password

document.addEventListener("DOMContentLoaded", () => {
    const forgotPasswordForm =
        document.getElementById("forgotPasswordForm");

    if (!forgotPasswordForm) return;

    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        if (!email) {
            alert("Please enter your email address.");
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/auth/forgot-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "Unable to send reset code.");
                return;
            }

            // Save email for reset password page
            localStorage.setItem("resetEmail", email);

            alert("A password reset OTP has been sent to your email.");

            window.location.href = "reset-password.html";

        } catch (error) {
            console.error("Forgot password error:", error);
            alert("Unable to connect to the server.");
        }
    });
});
