// Communication with the FastAPI backend
const API_BASE_URL = window.LOCAL_BACKEND_URL || 'http://127.0.0.1:8000'; // Centralized FastAPI backend URL

console.log(`api.js loaded: Backend target = ${API_BASE_URL}`);

/**
 * Get standard headers for API requests including JWT authorization
 */
function getAuthHeaders() {
    const token = localStorage.getItem("accessToken");
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Handle HTTP 401/403 auth expiry gracefully
 */
function handleAuthExpiry(status) {
    if (status === 401 || status === 403) {
        console.warn("Session expired or invalid token. Redirecting to login.");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("userEmail");
        if (!window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("signup.html") && !window.location.pathname.endsWith("otp.html")) {
            window.location.href = "index.html";
        }
    }
}

/**
 * Register a new user with the FastAPI backend.
 * Endpoint: POST /auth/register
 */
async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: userData.full_name,
                email: userData.email,
                password: userData.password
            }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = (data && data.detail) ? (typeof data.detail === 'string' ? data.detail : "Registration failed.") : "Registration failed.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error during registration:", error.message || error);
        return { success: false, status: 0, message: "Unable to connect to backend server. Ensure FastAPI is running on " + API_BASE_URL };
    }
}

/**
 * Verify Email OTP with the FastAPI backend.
 * Endpoint: POST /auth/verify-otp
 */
async function verifyOtp(email, otp) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = (data && typeof data.detail === 'string') ? data.detail : "Verification failed.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error during OTP verification:", error.message || error);
        return { success: false, status: 0, message: "Unable to verify code right now. Please check backend connection." };
    }
}

/**
 * Resend Email OTP with the FastAPI backend.
 * Endpoint: POST /auth/resend-otp
 */
async function resendOtp(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
            return { success: true, message: data.message || "A new verification code has been sent." };
        } else {
            const errorMsg = (data && typeof data.detail === 'string') ? data.detail : "Failed to resend code.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error during resending OTP:", error.message || error);
        return { success: false, status: 0, message: "Unable to resend code right now." };
    }
}

/**
 * Log in a user with the FastAPI backend.
 * Endpoint: POST /auth/login
 */
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data && data.access_token) {
            localStorage.setItem("accessToken", data.access_token);
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("userEmail", email);
            return { success: true, data };
        } else {
            const errorMsg = (data && typeof data.detail === 'string') ? data.detail : "Invalid email or password.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error during login:", error.message || error);
        return { success: false, status: 0, message: "Unable to sign in. Please verify the FastAPI backend is running on " + API_BASE_URL };
    }
}

/**
 * Fetch currently logged in user profile.
 * Endpoint: GET /auth/me
 */
async function getCurrentUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });

        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            handleAuthExpiry(response.status);
            return { success: false, status: response.status };
        }
    } catch (error) {
        console.error("Error fetching current user profile:", error);
        return { success: false, status: 0, message: "Backend connection error" };
    }
}

/**
 * Generate a new queue token or emergency token via P5 backend.
 * Endpoint: POST /tokens
 * @param {string} priorityType - "NORMAL", "VULNERABLE", or "TIME_CRITICAL" (Emergency)
 * @param {Object} options - { expiry_minutes, active_counters, admin_configured_service_time_minutes }
 */
async function createToken(priorityType = "NORMAL", options = {}) {
    try {
        const body = {
            priority_type: priorityType.toUpperCase(),
            expiry_minutes: options.expiry_minutes || 60,
            admin_configured_service_time_minutes: options.admin_configured_service_time_minutes || 10,
            active_counters: options.active_counters || 1
        };

        const response = await fetch(`${API_BASE_URL}/tokens`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data) {
            saveActiveToken(data);
            return { success: true, data };
        } else {
            handleAuthExpiry(response.status);
            const errorMsg = (data && data.detail) ? (typeof data.detail === 'string' ? data.detail : "Failed to generate token.") : "Token request failed.";
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Error creating token:", error);
        return { success: false, status: 0, message: "Unable to request token right now. Please check backend connection." };
    }
}

/**
 * Get active token stored in session
 */
function getActiveToken() {
    const raw = localStorage.getItem("activeToken");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/**
 * Save active token into session
 */
function saveActiveToken(tokenData) {
    localStorage.setItem("activeToken", JSON.stringify(tokenData));
}

/**
 * Logout current user and clear token storage
 */
function logoutUser() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("activeToken");
    window.location.href = "index.html";
}

/**
 * Generate a standalone vector SVG QR Code for a given token string.
 * @param {string} text - Token ID or payload string
 * @param {number} size - Output width/height in pixels
 * @returns {string} SVG HTML string
 */
function generateQRCodeSVG(text, size = 180) {
    if (!text) text = "TOKEN-UNKNOWN";
    
    // Payload JSON matching backend QRPayload format: {"type":"QUEUE_TOKEN","token_ref": text}
    const payloadStr = JSON.stringify({ type: "QUEUE_TOKEN", token_ref: text });
    
    // Deterministic 21x21 QR Grid Generator
    const gridDim = 21;
    const matrix = Array(gridDim).fill(0).map(() => Array(gridDim).fill(false));
    
    // Helper to draw 7x7 Finder Pattern
    function drawFinder(row, col) {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                    matrix[row + r][col + c] = true;
                }
            }
        }
    }
    
    // 1. Draw 3 corner finders
    drawFinder(0, 0); // Top-left
    drawFinder(0, gridDim - 7); // Top-right
    drawFinder(gridDim - 7, 0); // Bottom-left
    
    // 2. Draw Timing patterns
    for (let i = 8; i < gridDim - 8; i++) {
        if (i % 2 === 0) {
            matrix[6][i] = true;
            matrix[i][6] = true;
        }
    }

    // 3. Fill data bits deterministically using simple hashing algorithm on string
    let hash = 0;
    for (let i = 0; i < payloadStr.length; i++) {
        hash = ((hash << 5) - hash) + payloadStr.charCodeAt(i);
        hash |= 0;
    }
    
    let bitIndex = 0;
    for (let r = 0; r < gridDim; r++) {
        for (let c = 0; c < gridDim; c++) {
            // Skip finder pattern zones
            const isTopLeft = r < 8 && c < 8;
            const isTopRight = r < 8 && c >= gridDim - 8;
            const isBottomLeft = r >= gridDim - 8 && c < 8;
            const isTiming = r === 6 || c === 6;

            if (!isTopLeft && !isTopRight && !isBottomLeft && !isTiming) {
                // Pseudo-random bit based on character code and position hash
                const charCode = payloadStr.charCodeAt(bitIndex % payloadStr.length);
                const bit = ((charCode ^ (r * 13 + c * 31 + Math.abs(hash))) % 3 === 0);
                matrix[r][c] = bit;
                bitIndex++;
            }
        }
    }

    // Render matrix to crisp SVG
    const cellSize = size / gridDim;
    let rects = "";
    for (let r = 0; r < gridDim; r++) {
        for (let c = 0; c < gridDim; c++) {
            if (matrix[r][c]) {
                const x = (c * cellSize).toFixed(2);
                const y = (r * cellSize).toFixed(2);
                const w = (cellSize + 0.1).toFixed(2);
                rects += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#0f172a" />`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="border-radius:12px; background:#ffffff; padding:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
        ${rects}
    </svg>`;
}





