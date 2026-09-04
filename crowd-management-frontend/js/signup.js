// Sign Up page logic for Symmetry Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signupForm");
    const googleButton = document.getElementById("btnGoogleSignup");
    const submitBtn = document.getElementById("btnSubmit");

    const errorBanner = document.getElementById("formErrorBanner");
    const successBanner = document.getElementById("formSuccessBanner");
    const demoBadge = document.getElementById("demoBadge");

    if (typeof FRONTEND_DEMO_MODE !== 'undefined' && FRONTEND_DEMO_MODE && demoBadge) {
        demoBadge.style.display = "flex";
    }

    const fields = {
        fullName: {
            input: document.getElementById("fullName"),
            error: document.getElementById("fullNameError")
        },
        email: {
            input: document.getElementById("email"),
            error: document.getElementById("emailError")
        },
        phone: {
            input: document.getElementById("phone"),
            error: document.getElementById("phoneError")
        },
        password: {
            input: document.getElementById("password"),
            error: document.getElementById("passwordError")
        },
        confirmPassword: {
            input: document.getElementById("confirmPassword"),
            error: document.getElementById("confirmPasswordError")
        }
    };

    // Helper functions for clearing/showing errors
    function clearFieldError(fieldKey) {
        if (fields[fieldKey]) {
            fields[fieldKey].error.textContent = "";
            fields[fieldKey].input.classList.remove("is-invalid");
        }
    }

    function showFieldError(fieldKey, message) {
        if (fields[fieldKey]) {
            fields[fieldKey].error.textContent = message;
            fields[fieldKey].input.classList.add("is-invalid");
        }
    }

    function clearAllErrors() {
        Object.keys(fields).forEach(key => clearFieldError(key));
        if (errorBanner) {
            errorBanner.style.display = "none";
            errorBanner.textContent = "";
        }
        if (successBanner) {
            successBanner.style.display = "none";
            successBanner.textContent = "";
        }
    }

    // Real-time input listeners to clear errors on typing
    Object.keys(fields).forEach(key => {
        if (fields[key].input) {
            fields[key].input.addEventListener("input", () => {
                clearFieldError(key);
                if (errorBanner) errorBanner.style.display = "none";
            });
        }
    });

    // Validation rules
    function validateForm() {
        clearAllErrors();
        let isValid = true;

        const fullNameVal = fields.fullName.input.value.trim();
        const emailVal = fields.email.input.value.trim();
        const phoneVal = fields.phone.input.value.trim();
        const passwordVal = fields.password.input.value;
        const confirmPasswordVal = fields.confirmPassword.input.value;

        // 1. Full Name check
        if (!fullNameVal) {
            showFieldError("fullName", "Full name is required.");
            isValid = false;
        }

        // 2. Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailVal) {
            showFieldError("email", "Email address is required.");
            isValid = false;
        } else if (!emailRegex.test(emailVal)) {
            showFieldError("email", "Please enter a valid email address.");
            isValid = false;
        }

        // 3. Phone number check
        const phoneRegex = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]{6,15}$/;
        if (!phoneVal) {
            showFieldError("phone", "Phone number is required.");
            isValid = false;
        } else if (!phoneRegex.test(phoneVal)) {
            showFieldError("phone", "Please enter a valid phone number.");
            isValid = false;
        }

        // 4. Password check
        if (!passwordVal) {
            showFieldError("password", "Password is required.");
            isValid = false;
        } else if (passwordVal.length < 6) {
            showFieldError("password", "Password must be at least 6 characters.");
            isValid = false;
        }

        // 5. Confirm Password check
        if (!confirmPasswordVal) {
            showFieldError("confirmPassword", "Please confirm your password.");
            isValid = false;
        } else if (passwordVal !== confirmPasswordVal) {
            showFieldError("confirmPassword", "Passwords do not match.");
            isValid = false;
        }

        return isValid;
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!validateForm()) {
                return;
            }

            const fullName = fields.fullName.input.value.trim();
            const email = fields.email.input.value.trim();
            const phone = fields.phone.input.value.trim();
            const password = fields.password.input.value;

            // Loading state
            submitBtn.disabled = true;
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = "Creating account...";

            try {
                // Call central API layer
                const result = await registerUser({
                    full_name: fullName,
                    email: email,
                    phone: phone,
                    password: password
                });

                if (result.success) {
                    // Store email for OTP verification session
                    sessionStorage.setItem("verifyEmail", email);

                    if (successBanner) {
                        successBanner.innerHTML = `<span>Account registered! Redirecting to email verification...</span>`;
                        successBanner.style.display = "flex";
                    }

                    // Redirect to OTP verification page after brief delay
                    setTimeout(() => {
                        window.location.href = "otp.html";
                    }, 1000);
                } else {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;

                    if (errorBanner) {
                        errorBanner.textContent = result.message || "Unable to create your account right now. Please try again later.";
                        errorBanner.style.display = "flex";
                    }

                    // If email duplicate specifically
                    if (result.status === 409) {
                        showFieldError("email", "This email is already registered.");
                    }
                }
            } catch (err) {
                console.error("Registration error:", err);
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;

                if (errorBanner) {
                    errorBanner.textContent = "Unable to create your account right now. Please try again later.";
                    errorBanner.style.display = "flex";
                }
            }
        });
    }

    if (googleButton) {
        googleButton.addEventListener("click", () => {
            // Mock Sign Up with Google
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("userEmail", "google.user@example.com");
            window.location.href = "dashboard.html";
        });
    }

    console.log("signup.js loaded: Sign Up form logic active.");
});
