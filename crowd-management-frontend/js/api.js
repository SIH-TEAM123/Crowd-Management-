// Communication with the FastAPI backend
const API_BASE_URL = 'http://127.0.0.1:8000'; // Default FastAPI address

/**
 * FRONTEND DEMO MODE TOGGLE
 * Set to `true` to test the frontend UI flow without a running backend.
 * Set to `false` when connecting to the actual FastAPI backend.
 */
const FRONTEND_DEMO_MODE = true;
const DEMO_TEST_OTP = "123456"; // Explicit test OTP for frontend demo testing only

console.log(`api.js loaded: Backend target = ${API_BASE_URL} | FRONTEND_DEMO_MODE = ${FRONTEND_DEMO_MODE}`);

/**
 * Register a new user with the FastAPI backend.
 * @param {Object} userData - Object containing { full_name, email, phone, password }
 * @returns {Promise<Object>} Response status and data/message
 */
async function registerUser(userData) {
    if (FRONTEND_DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency
        return { 
            success: true, 
            data: { message: "Demo mode registration success" } 
        };
    }

    // --- REAL BACKEND FETCH CALL ---
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name: userData.full_name,
                email: userData.email,
                phone: userData.phone,
                password: userData.password
            }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, data: data || {} };
        } else if (response.status === 409 || (data && typeof data.detail === 'string' && data.detail.toLowerCase().includes("already registered"))) {
            return { success: false, status: 409, message: "This email is already registered. Please sign in." };
        } else if (response.status === 422) {
            return { success: false, status: 422, message: "Please check your information and try again." };
        } else {
            const errorMsg = (data && data.detail) ? (typeof data.detail === 'string' ? data.detail : "Registration failed.") : "Registration failed. Please try again later.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network connection error during user registration:", error.message || error);
        return { success: false, status: 0, message: "Unable to create your account right now. Please try again later." };
    }
}

/**
 * Verify Email OTP with the FastAPI backend.
 * @param {string} email - User email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} Response status and message
 */
async function verifyOtp(email, otp) {
    if (FRONTEND_DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 600)); // Simulate network latency
        if (otp === DEMO_TEST_OTP) {
            return { success: true, message: "Demo OTP verification successful" };
        } else {
            return { success: false, status: 400, message: "Invalid verification code. Please try again. (Demo OTP is 123456)" };
        }
    }

    // --- REAL BACKEND FETCH CALL ---
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, otp }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, data: data || {} };
        } else if (response.status === 410 || (data && typeof data.detail === 'string' && data.detail.toLowerCase().includes("expired"))) {
            return { success: false, status: 410, message: "Your verification code has expired. Please request a new code." };
        } else if (response.status === 400 || response.status === 422) {
            return { success: false, status: response.status, message: "Invalid verification code. Please try again." };
        } else {
            const errorMsg = (data && typeof data.detail === 'string') ? data.detail : "Verification failed. Please try again.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network connection error during OTP verification:", error.message || error);
        return { success: false, status: 0, message: "Unable to verify code right now. Please try again later." };
    }
}

/**
 * Resend Email OTP with the FastAPI backend.
 * @param {string} email - User email address
 * @returns {Promise<Object>} Response status and message
 */
async function resendOtp(email) {
    if (FRONTEND_DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network latency
        return { success: true, message: `Demo Mode: Test verification code is ${DEMO_TEST_OTP}.` };
    }

    // --- REAL BACKEND FETCH CALL ---
    try {
        const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, message: "A new verification code has been sent to your email." };
        } else {
            const errorMsg = (data && typeof data.detail === 'string') ? data.detail : "Failed to resend verification code. Please try again.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network connection error during resending OTP:", error.message || error);
        return { success: false, status: 0, message: "Unable to resend code right now. Please try again later." };
    }
}



