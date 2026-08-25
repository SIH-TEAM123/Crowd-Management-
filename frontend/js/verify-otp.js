document.addEventListener("DOMContentLoaded", () => {

    const verifyOtpForm = document.getElementById("verifyOtpForm");
    const resendOtpButton = document.getElementById("resendOtp");

    const getEmail = () => {
        return (
            localStorage.getItem("pendingVerificationEmail") ||
            localStorage.getItem("signupEmail") ||
            sessionStorage.getItem("signupEmail")
        );
    };

    if (!verifyOtpForm) {
        console.error("Verify OTP form not found.");
        return;
    }

    // VERIFY OTP
    verifyOtpForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const otp = document.getElementById("otp").value.trim();
        const email = getEmail();

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

            localStorage.removeItem("pendingVerificationEmail");
            localStorage.removeItem("signupEmail");
            sessionStorage.removeItem("signupEmail");

            window.location.href = "index.html";

        } catch (error) {

            console.error("OTP verification error:", error);
            alert("Unable to connect to the server.");

        }

    });


    // RESEND OTP
    if (resendOtpButton) {

        resendOtpButton.addEventListener("click", async () => {

            const email = getEmail();

            if (!email) {
                alert("Email information is missing. Please sign up again.");
                window.location.href = "signup.html";
                return;
            }

            try {

                resendOtpButton.disabled = true;
                resendOtpButton.innerText = "Sending...";

                const response = await fetch(
                    `${API_BASE_URL}/auth/resend-otp`,
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
                    alert(data.detail || "Unable to resend OTP.");
                    return;
                }

                alert("A new OTP has been sent.");

            } catch (error) {

                console.error("Resend OTP error:", error);
                alert("Unable to connect to the server.");

            } finally {

                resendOtpButton.disabled = false;
                resendOtpButton.innerText = "Resend OTP";

            }

        });

    }

});