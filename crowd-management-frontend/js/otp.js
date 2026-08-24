// Email OTP Verification Page Logic for Symmetry Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {
    const otpForm = document.getElementById("otpForm");
    const displayEmailEl = document.getElementById("displayEmail");
    const otpErrorEl = document.getElementById("otpError");
    const errorBanner = document.getElementById("formErrorBanner");
    const successBanner = document.getElementById("formSuccessBanner");
    const demoBadge = document.getElementById("demoBadge");
    const verifyBtn = document.getElementById("btnVerifyOtp");
    const resendBtn = document.getElementById("btnResendOtp");
    const digitInputs = Array.from(document.querySelectorAll(".otp-digit"));

    if (typeof FRONTEND_DEMO_MODE !== 'undefined' && FRONTEND_DEMO_MODE && demoBadge) {
        demoBadge.style.display = "flex";
    }

    // 1. Retrieve email from sessionStorage
    const pendingEmail = sessionStorage.getItem("verifyEmail") || "user@example.com";

    // 2. Helper to safely mask email address (e.g. alex.mercer@example.com -> a***r@example.com)
    function maskEmail(emailStr) {
        if (!emailStr || !emailStr.includes("@")) return emailStr;
        const [localPart, domainPart] = emailStr.split("@");
        if (localPart.length <= 2) {
            return localPart.charAt(0) + "***@" + domainPart;
        }
        const maskedLocal = localPart.charAt(0) + "***" + localPart.charAt(localPart.length - 1);
        return maskedLocal + "@" + domainPart;
    }

    if (displayEmailEl) {
        displayEmailEl.textContent = maskEmail(pendingEmail);
    }

    // 3. Helper to clear error state
    function clearError() {
        if (otpErrorEl) otpErrorEl.textContent = "";
        if (errorBanner) {
            errorBanner.style.display = "none";
            errorBanner.textContent = "";
        }
        digitInputs.forEach(input => input.classList.remove("is-invalid"));
    }

    // 4. Handle 6-Digit OTP Inputs Navigation & Events
    digitInputs.forEach((input, index) => {
        // Enforce numeric input & auto-advance focus
        input.addEventListener("input", (e) => {
            clearError();
            const val = e.target.value;

            // Strip any non-numeric input
            if (!/^\d$/.test(val)) {
                e.target.value = "";
                return;
            }

            // Move to next digit if available
            if (val && index < digitInputs.length - 1) {
                digitInputs[index + 1].focus();
            }
        });

        // Handle Backspace navigation
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") {
                if (!input.value && index > 0) {
                    digitInputs[index - 1].focus();
                }
            }
        });

        // Handle Paste event on any input box
        input.addEventListener("paste", (e) => {
            e.preventDefault();
            clearError();
            const pastedText = (e.clipboardData || window.clipboardData).getData("text");
            const digits = pastedText.replace(/\D/g, "").slice(0, 6);

            if (digits) {
                digits.split("").forEach((char, i) => {
                    if (digitInputs[i]) {
                        digitInputs[i].value = char;
                    }
                });

                // Focus the appropriate input after paste
                const nextFocusIndex = Math.min(digits.length, digitInputs.length - 1);
                digitInputs[nextFocusIndex].focus();
            }
        });
    });

    // 5. Handle OTP Verification Submit
    if (otpForm) {
        otpForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearError();

            const otpCode = digitInputs.map(input => input.value.trim()).join("");

            if (otpCode.length < 6) {
                if (otpErrorEl) otpErrorEl.textContent = "Please enter all 6 digits of the verification code.";
                digitInputs.forEach(input => {
                    if (!input.value) input.classList.add("is-invalid");
                });
                return;
            }

            // Disable verify button during request
            verifyBtn.disabled = true;
            const originalBtnText = verifyBtn.textContent;
            verifyBtn.textContent = "Verifying...";

            try {
                // Call central API layer verifyOtp
                const result = await verifyOtp(pendingEmail, otpCode);

                if (result.success) {
                    // Successful OTP Verification
                    sessionStorage.removeItem("verifyEmail"); // Clear temporary session email

                    if (successBanner) {
                        successBanner.innerHTML = `
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <strong>Email verified successfully!</strong>
                                <span>Your account has been created successfully.</span>
                            </div>
                        `;
                        successBanner.style.display = "flex";
                    }

                    // Transform button to "Go to Login"
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = "Go to Login";
                    verifyBtn.onclick = () => {
                        window.location.href = "index.html";
                    };

                    // Auto redirect after 3 seconds
                    setTimeout(() => {
                        window.location.href = "index.html";
                    }, 3000);
                } else {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = originalBtnText;

                    digitInputs.forEach(input => input.classList.add("is-invalid"));

                    if (errorBanner) {
                        errorBanner.textContent = result.message || "Invalid verification code. Please try again.";
                        errorBanner.style.display = "flex";
                    }
                }
            } catch (err) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = originalBtnText;

                if (errorBanner) {
                    errorBanner.textContent = "Unable to verify code right now. Please try again later.";
                    errorBanner.style.display = "flex";
                }
            }
        });
    }

    // 6. Handle Resend OTP Action
    if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
            clearError();

            // Disable resend button and start cooldown timer
            resendBtn.disabled = true;
            let cooldown = 30;
            resendBtn.textContent = `Resend in ${cooldown}s`;

            const timer = setInterval(() => {
                cooldown -= 1;
                if (cooldown > 0) {
                    resendBtn.textContent = `Resend in ${cooldown}s`;
                } else {
                    clearInterval(timer);
                    resendBtn.disabled = false;
                    resendBtn.textContent = "Resend OTP";
                }
            }, 1000);

            try {
                const result = await resendOtp(pendingEmail);

                if (result.success) {
                    if (successBanner) {
                        successBanner.textContent = result.message || "A new verification code has been sent to your email.";
                        successBanner.style.display = "flex";
                    }
                } else {
                    if (errorBanner) {
                        errorBanner.textContent = result.message || "Failed to resend verification code. Please try again.";
                        errorBanner.style.display = "flex";
                    }
                }
            } catch (err) {
                if (errorBanner) {
                    errorBanner.textContent = "Unable to resend code right now. Please try again later.";
                    errorBanner.style.display = "flex";
                }
            }
        });
    }

    console.log("otp.js loaded: Email OTP verification active.");
});
