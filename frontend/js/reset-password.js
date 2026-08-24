// VIZITOR - Reset Password

document.addEventListener("DOMContentLoaded", () => {
    const resetPasswordForm =
        document.getElementById("resetPasswordForm");

    if (!resetPasswordForm) return;

    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = localStorage.getItem("resetEmail");
        const otp = document.getElementById("otp").value.trim();
        const newPassword =
            document.getElementById("newPassword").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!email) {
            alert("Reset session expired. Please request a new reset code.");
            window.location.href = "forgot-password.html";
            return;
        }

        if (!otp || !newPassword || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (otp.length !== 6) {
            alert("Please enter a valid 6-digit OTP.");
            return;
        }

        if (newPassword.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
}

        if (newPassword !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/auth/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        otp: otp,
                        new_password: newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "Unable to reset password.");
                return;
            }

            localStorage.removeItem("resetEmail");

            alert("Password reset successfully! Please sign in.");

            window.location.href = "index.html";

        } catch (error) {
            console.error("Reset password error:", error);
            alert("Unable to connect to the server.");
        }
    });
});