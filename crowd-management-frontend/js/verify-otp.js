document.addEventListener("DOMContentLoaded", () => {

    const verifyOtpForm = document.getElementById("verifyOtpForm");

    if (!verifyOtpForm) {
        console.error("Verify OTP form not found.");
        return;
    }

    verifyOtpForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const otp = document.getElementById("otp").value.trim();

        // Get email saved during signup
        const email =
            localStorage.getItem("pendingVerificationEmail") ||
            localStorage.getItem("signupEmail") ||
            sessionStorage.getItem("signupEmail");

        if (!email) {
            alert("Email information is missing. Please sign up again.");
            window.location.href = "signup.html";
            return;
        }

        if (!otp || otp.length !== 6) {
            alert("Please enter a valid 6-digit OTP.");
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/auth/verify-otp`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        otp: otp
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "OTP verification failed.");
                return;
            }

            alert("Account verified successfully! Please sign in.");

            // Remove temporary signup data
            localStorage.removeItem("pendingVerificationEmail");
            localStorage.removeItem("signupEmail");
            sessionStorage.removeItem("signupEmail");

            // GO TO LOGIN PAGE
            window.location.href = "index.html";

        } catch (error) {

            console.error("OTP verification error:", error);

            alert("Unable to connect to the server.");

        }

    });

});