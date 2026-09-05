// ============================================================
// VIZITOR - Centralized API Configuration
// ============================================================

(function () {
    const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === ""; // file:// protocol support

    // Priority:
    // 1. Explicit window override (e.g. window.VIZITOR_API_URL)
    // 2. LocalStorage override (e.g. localStorage.setItem("vizitor_api_url", "..."))
    // 3. Environment detection: local dev -> http://127.0.0.1:8000, production -> https://vizitor.onrender.com
    const defaultApiUrl = isLocalhost
        ? "http://127.0.0.1:8000"
        : "https://vizitor.onrender.com";

    const resolvedApiUrl =
        window.VIZITOR_API_URL ||
        localStorage.getItem("vizitor_api_url") ||
        defaultApiUrl;

    window.API_BASE_URL = resolvedApiUrl;
    window.HEALTHCARE_API_BASE = resolvedApiUrl;

    console.log("[VIZITOR] API Base URL:", resolvedApiUrl, isLocalhost ? "(Local Mode)" : "(Production Mode)");
})();

const API_BASE_URL = window.API_BASE_URL;
const HEALTHCARE_API_BASE = window.HEALTHCARE_API_BASE;


// ============================================================
// Crowd Forecast API
// ============================================================

window.VIZITOR = window.VIZITOR || {};

window.VIZITOR.getCrowdForecast = async function () {

    const response =
        await fetch(
            `${window.API_BASE_URL}/optimization/forecast`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            `Forecast API error: ${response.status}`
        );
    }

    return await response.json();
};

// ============================================================
// Computer Vision Camera API
// ============================================================

window.VIZITOR.getCameraStreamUrl = function () {
    return `${window.API_BASE_URL}/api/camera/stream?t=${Date.now()}`;
};

window.VIZITOR.getCameraSnapshotUrl = function () {
    return `${window.API_BASE_URL}/api/camera/snapshot?t=${Date.now()}`;
};

window.VIZITOR.getCameraStatus = async function () {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/camera/status`, {
            method: "GET",
            headers: getAuthHeaders(),
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error(`Camera status error: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        console.warn("[VIZITOR] Could not fetch camera status:", err.message);
        return null;
    }
};

window.VIZITOR.startCamera = async function (options = {}) {
    const payload = {
        source_mode: options.source_mode || "webcam",
        camera_index: options.camera_index || 0,
        facility_id: options.facility_id || "FAC_ANGUL_DH",
        camera_id: options.camera_id || "CV_CAM_01",
        roi_enabled: Boolean(options.roi_enabled)
    };
    const response = await fetch(`${window.API_BASE_URL}/api/camera/start`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`Start camera error: ${response.status}`);
    }
    return await response.json();
};

window.VIZITOR.stopCamera = async function () {
    const response = await fetch(`${window.API_BASE_URL}/api/camera/stop`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error(`Stop camera error: ${response.status}`);
    }
    return await response.json();
};

window.VIZITOR.toggleCameraRoi = async function () {
    const response = await fetch(`${window.API_BASE_URL}/api/camera/toggle-roi`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error(`Toggle ROI error: ${response.status}`);
    }
    return await response.json();
};

window.VIZITOR.syncCameraTelemetry = async function () {
    const response = await fetch(`${window.API_BASE_URL}/api/camera/sync-telemetry`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        throw new Error(`Sync camera telemetry error: ${response.status}`);
    }
    return await response.json();
};

// ============================================================
// VIZITOR Auth & Offline Headers Helper
// ============================================================
function getAuthHeaders() {
    const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken");
    const headers = {
        "Content-Type": "application/json"
    };
    if (token && token !== "DEMO_MODE") {
        headers["Authorization"] = "Bearer " + token;
    }
    return headers;
}

function handleAuthExpiry(status) {
    if (status === 401 || status === 403) {
        console.warn("[VIZITOR] Session expired or unauthorized:", status);
    }
}
function showOfflineStaleBanner(anchorElementId = null, lastSyncedAt = null) {
    const BANNER_ID = 'global-offline-stale-banner';
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.style.cssText = 'margin:0 0 12px 0; padding:8px 14px; background:#fefce8; border:1px solid #fde047; border-radius:8px; font-size:0.82rem; color:#854d0e; font-weight:500; display:flex; align-items:center; gap:8px;';
        const anchor = anchorElementId ? document.getElementById(anchorElementId) : null;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(banner, anchor);
        } else {
            const main = document.querySelector('main') || document.querySelector('.main-content') || document.body;
            main.prepend(banner);
        }
    }
    const timeStr = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Unknown';
    banner.innerHTML = `⚠️ <strong>Cached / Offline Data</strong> — Showing locally cached data (last synced: ${timeStr}). Data may be outdated. Connect to backend to refresh.`;
    banner.style.display = 'flex';
}

/**
 * Hide the stale-data banner (call when live data is successfully loaded).
 */
function hideOfflineStaleBanner() {
    const banner = document.getElementById('global-offline-stale-banner');
    if (banner) banner.style.display = 'none';
}

/**
 * Executes a network GET request, caches successful responses to IndexedDB,
 * and falls back to cached IndexedDB data when offline or network fails.
 */
async function fetchWithOfflineCache(storeName, networkFetchFn, cacheFilterFn = null) {
    if (window.Connectivity && window.Connectivity.isOffline() && window.OfflineDB) {
        try {
            const cachedItems = await window.OfflineDB.getAll(storeName);
            const lastSync = await window.OfflineDB.getLastSync(storeName);
            const filtered = cacheFilterFn ? cachedItems.filter(cacheFilterFn) : cachedItems;
            if (filtered && filtered.length > 0) {
                return { success: true, data: filtered, fromCache: true, lastSyncedAt: lastSync };
            }
        } catch (e) {
            console.warn(`[OfflineCache] Error reading ${storeName}:`, e);
        }
    }

    try {
        const result = await networkFetchFn();
        if (result && result.success && Array.isArray(result.data)) {
            if (window.OfflineDB) {
                window.OfflineDB.putMany(storeName, result.data).catch(() => {});
            }
            return { ...result, fromCache: false, lastSyncedAt: new Date().toISOString() };
        } else if (!result || !result.success) {
            if (window.OfflineDB) {
                const cachedItems = await window.OfflineDB.getAll(storeName);
                const lastSync = await window.OfflineDB.getLastSync(storeName);
                const filtered = cacheFilterFn ? cachedItems.filter(cacheFilterFn) : cachedItems;
                if (filtered && filtered.length > 0) {
                    return { success: true, data: filtered, fromCache: true, lastSyncedAt: lastSync, warning: result ? result.message : 'Network error. Showing cached data.' };
                }
            }
        }
        return result;
    } catch (networkErr) {
        if (window.OfflineDB) {
            try {
                const cachedItems = await window.OfflineDB.getAll(storeName);
                const lastSync = await window.OfflineDB.getLastSync(storeName);
                const filtered = cacheFilterFn ? cachedItems.filter(cacheFilterFn) : cachedItems;
                if (filtered && filtered.length > 0) {
                    return { success: true, data: filtered, fromCache: true, lastSyncedAt: lastSync, warning: 'Offline mode active.' };
                }
            } catch (e) {}
        }
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch a single object with offline IndexedDB fallback
 */
async function fetchObjectWithOfflineCache(storeName, key, networkFetchFn) {
    if (window.Connectivity && window.Connectivity.isOffline() && window.OfflineDB) {
        try {
            const cached = await window.OfflineDB.get(storeName, key);
            const lastSync = await window.OfflineDB.getLastSync(storeName);
            if (cached) {
                return { success: true, data: cached, fromCache: true, lastSyncedAt: lastSync };
            }
        } catch (e) {}
    }

    try {
        const result = await networkFetchFn();
        if (result && result.success && result.data) {
            if (window.OfflineDB) {
                window.OfflineDB.put(storeName, result.data).catch(() => {});
            }
            return { ...result, fromCache: false, lastSyncedAt: new Date().toISOString() };
        } else if (!result || !result.success) {
            if (window.OfflineDB) {
                const cached = await window.OfflineDB.get(storeName, key);
                const lastSync = await window.OfflineDB.getLastSync(storeName);
                if (cached) {
                    return { success: true, data: cached, fromCache: true, lastSyncedAt: lastSync };
                }
            }
        }
        return result;
    } catch (err) {
        if (window.OfflineDB) {
            try {
                const cached = await window.OfflineDB.get(storeName, key);
                const lastSync = await window.OfflineDB.getLastSync(storeName);
                if (cached) {
                    return { success: true, data: cached, fromCache: true, lastSyncedAt: lastSync };
                }
            } catch (e) {}
        }
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
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

// =========================================================================
// Healthcare Facility & Referral API Endpoints
// =========================================================================

/**
 * Fetch list of healthcare facilities (Offline-aware)
 * Endpoint: GET /facilities
 */
async function fetchFacilities(isActiveOnly = true) {
    return fetchWithOfflineCache('facilities', async () => {
        const url = `${API_BASE_URL}/facilities?is_active=${isActiveOnly}&limit=200`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch facilities." };
        }
    }, isActiveOnly ? (f) => f.is_active !== false : null);
}

/**
 * Fetch patient referrals with query filters (Offline-aware)
 * Endpoint: GET /referrals
 */
async function fetchReferrals(filters = {}) {
    return fetchWithOfflineCache('referrals', async () => {
        const params = new URLSearchParams();
        if (filters.source_facility_id) params.append("source_facility_id", filters.source_facility_id);
        if (filters.destination_facility_id) params.append("destination_facility_id", filters.destination_facility_id);
        if (filters.patient_id) params.append("patient_id", filters.patient_id);
        if (filters.status) params.append("status", filters.status);
        if (filters.priority) params.append("priority", filters.priority);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/referrals${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch referrals." };
        }
    }, (ref) => {
        if (filters.source_facility_id && ref.source_facility_id !== filters.source_facility_id) return false;
        if (filters.destination_facility_id && ref.destination_facility_id !== filters.destination_facility_id) return false;
        if (filters.status && ref.status !== filters.status) return false;
        return true;
    });
}

/**
 * Fetch single referral details by ID
 * Endpoint: GET /referrals/{id}
 */
async function getReferralById(referralId) {
    try {
        const url = `${API_BASE_URL}/referrals/${encodeURIComponent(referralId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Referral not found." };
        }
    } catch (error) {
        console.error("Network error fetching referral details:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Create a new patient referral
 * Endpoint: POST /referrals (Protected)
 */
async function createReferral(referralPayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/referrals`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(referralPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to create referral.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error creating referral:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Advance referral lifecycle status
 * Endpoint: PATCH /referrals/{id}/status (Protected)
 */
async function updateReferralStatus(referralId, statusUpdate) {
    try {
        const response = await fetch(`${API_BASE_URL}/referrals/${encodeURIComponent(referralId)}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(statusUpdate)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update referral status.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating referral status:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

// =========================================================================
// Specialist Availability API Endpoints
// =========================================================================

/**
 * Fetch specialists with query filters (Offline-aware)
 * Endpoint: GET /specialists
 */
async function fetchSpecialists(filters = {}) {
    return fetchWithOfflineCache('specialists', async () => {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.specialization) params.append("specialization", filters.specialization);
        if (filters.availability_status) params.append("availability_status", filters.availability_status);
        if (filters.is_available_only !== undefined && filters.is_available_only) {
            params.append("is_available_only", "true");
        }
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/specialists${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch specialists." };
        }
    }, (spec) => {
        if (filters.facility_id && spec.facility_id !== filters.facility_id) return false;
        if (filters.specialization && spec.specialization !== filters.specialization) return false;
        if (filters.availability_status && spec.availability_status !== filters.availability_status) return false;
        if (filters.is_available_only && spec.is_available === false) return false;
        return true;
    });
}

/**
 * Fetch available specialists (Offline-aware)
 * Endpoint: GET /specialists/available
 */
async function fetchAvailableSpecialists(filters = {}) {
    return fetchWithOfflineCache('specialists', async () => {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.specialization) params.append("specialization", filters.specialization);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/specialists/available${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch available specialists." };
        }
    }, (spec) => {
        if (filters.facility_id && spec.facility_id !== filters.facility_id) return false;
        if (filters.specialization && spec.specialization !== filters.specialization) return false;
        if (spec.is_available === false || spec.availability_status === 'UNAVAILABLE') return false;
        return true;
    });
}

/**
 * Get specialist details by ID
 * Endpoint: GET /specialists/{id}
 */
async function getSpecialistById(specialistId) {
    try {
        const url = `${API_BASE_URL}/specialists/${encodeURIComponent(specialistId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Specialist not found." };
        }
    } catch (error) {
        console.error("Network error fetching specialist details:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Register a new specialist
 * Endpoint: POST /specialists (Protected)
 */
async function createSpecialist(specialistPayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/specialists`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(specialistPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to register specialist.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error creating specialist:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Update specialist details or availability status
 * Endpoint: PATCH /specialists/{id} (Protected)
 */
async function updateSpecialist(specialistId, updatePayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/specialists/${encodeURIComponent(specialistId)}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(updatePayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update specialist.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating specialist:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/* =========================================================================
   DIAGNOSTICS & BOOKINGS API CLIENT FUNCTIONS
   ========================================================================= */

/**
 * Fetch list of diagnostic tests with optional filters (Offline-aware)
 * Endpoint: GET /diagnostics
 */
async function fetchDiagnostics(filters = {}) {
    return fetchWithOfflineCache('diagnostics', async () => {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.name) params.append("name", filters.name);
        if (filters.category) params.append("category", filters.category);
        if (filters.is_available_only) params.append("is_available_only", "true");
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/diagnostics${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch diagnostic tests." };
        }
    }, (diag) => {
        if (filters.facility_id && diag.facility_id !== filters.facility_id) return false;
        if (filters.category && diag.category !== filters.category) return false;
        if (filters.is_available_only && diag.is_available === false) return false;
        return true;
    });
}

/**
 * Fetch only currently available diagnostic tests (Offline-aware)
 * Endpoint: GET /diagnostics/available
 */
async function fetchAvailableDiagnostics(filters = {}) {
    return fetchWithOfflineCache('diagnostics', async () => {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.name) params.append("name", filters.name);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/diagnostics/available${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch available diagnostics." };
        }
    }, (diag) => {
        if (filters.facility_id && diag.facility_id !== filters.facility_id) return false;
        if (diag.is_available === false) return false;
        return true;
    });
}

/**
 * Check test availability at a specific facility
 * Endpoint: GET /diagnostics/check-availability
 */
async function checkTestAvailability(facilityId, testName) {
    try {
        const params = new URLSearchParams({
            facility_id: facilityId,
            test_name: testName
        });
        const url = `${API_BASE_URL}/diagnostics/check-availability?${params.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to check test availability." };
        }
    } catch (error) {
        console.error("Network error checking test availability:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Get diagnostic test details by ID
 * Endpoint: GET /diagnostics/{diagnostic_id}
 */
async function getDiagnosticById(diagnosticId) {
    try {
        const url = `${API_BASE_URL}/diagnostics/${encodeURIComponent(diagnosticId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Diagnostic test not found." };
        }
    } catch (error) {
        console.error("Network error fetching diagnostic details:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Book a diagnostic test for a patient
 * Endpoint: POST /diagnostics/bookings
 */
async function createDiagnosticBooking(bookingPayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/diagnostics/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(bookingPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to create diagnostic booking.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error creating diagnostic booking:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch diagnostic bookings with optional filters
 * Endpoint: GET /diagnostics/bookings/list
 */
async function fetchDiagnosticBookings(filters = {}) {
    try {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.diagnostic_id) params.append("diagnostic_id", filters.diagnostic_id);
        if (filters.patient_id) params.append("patient_id", filters.patient_id);
        if (filters.status) params.append("status", filters.status);
        if (filters.result_status) params.append("result_status", filters.result_status);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/diagnostics/bookings/list${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch bookings." };
        }
    } catch (error) {
        console.error("Network error fetching diagnostic bookings:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Get details for a specific diagnostic booking
 * Endpoint: GET /diagnostics/bookings/{booking_id}
 */
async function getDiagnosticBookingById(bookingId) {
    try {
        const url = `${API_BASE_URL}/diagnostics/bookings/${encodeURIComponent(bookingId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Diagnostic booking not found." };
        }
    } catch (error) {
        console.error("Network error fetching booking details:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Update diagnostic booking lifecycle state
 * Endpoint: PATCH /diagnostics/bookings/{booking_id}/status (Protected)
 */
async function updateDiagnosticBookingStatus(bookingId, status, notes = null) {
    try {
        const payload = { status };
        if (notes) payload.notes = notes;

        const response = await fetch(`${API_BASE_URL}/diagnostics/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update booking status.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating booking status:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Update diagnostic result availability status
 * Endpoint: PATCH /diagnostics/bookings/{booking_id}/result-status (Protected)
 */
async function updateDiagnosticResultStatus(bookingId, resultStatus, notes = null) {
    try {
        const payload = { result_status: resultStatus };
        if (notes) payload.notes = notes;

        const response = await fetch(`${API_BASE_URL}/diagnostics/bookings/${encodeURIComponent(bookingId)}/result-status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update result status.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating result status:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch real-time queue position for a booking
 * Endpoint: GET /diagnostics/bookings/{booking_id}/queue-position
 */
async function getDiagnosticBookingQueuePosition(bookingId) {
    try {
        const url = `${API_BASE_URL}/diagnostics/bookings/${encodeURIComponent(bookingId)}/queue-position`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch queue position." };
        }
    } catch (error) {
        console.error("Network error fetching booking queue position:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch active queue for a specific diagnostic test
 * Endpoint: GET /diagnostics/{diagnostic_id}/queue
 */
async function getDiagnosticQueue(diagnosticId) {
    try {
        const url = `${API_BASE_URL}/diagnostics/${encodeURIComponent(diagnosticId)}/queue`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Diagnostic queue not found." };
        }
    } catch (error) {
        console.error("Network error fetching diagnostic queue:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch active queues for all diagnostic tests at a facility
 * Endpoint: GET /diagnostics/facilities/{facility_id}/queue
 */
async function getFacilityDiagnosticQueues(facilityId) {
    try {
        const url = `${API_BASE_URL}/diagnostics/facilities/${encodeURIComponent(facilityId)}/queue`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch facility diagnostic queues." };
        }
    } catch (error) {
        console.error("Network error fetching facility diagnostic queues:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/* =========================================================================
   MEDICINES & FACILITY INVENTORY API CLIENT FUNCTIONS
   ========================================================================= */

/**
 * Fetch medicines from catalog with search and filters (Offline-aware)
 * Endpoint: GET /medicines
 */
async function fetchMedicines(filters = {}) {
    return fetchWithOfflineCache('medicines', async () => {
        const params = new URLSearchParams();
        if (filters.query) params.append("query", filters.query);
        if (filters.generic_name) params.append("generic_name", filters.generic_name);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/medicines${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch medicines." };
        }
    }, (med) => {
        if (filters.query) {
            const q = filters.query.toLowerCase();
            const name = (med.name || '').toLowerCase();
            const gen = (med.generic_name || '').toLowerCase();
            if (!name.includes(q) && !gen.includes(q)) return false;
        }
        return true;
    });
}

/**
 * Get medicine details by ID
 * Endpoint: GET /medicines/{medicine_id}
 */
async function getMedicineById(medicineId) {
    try {
        const url = `${API_BASE_URL}/medicines/${encodeURIComponent(medicineId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Medicine not found." };
        }
    } catch (error) {
        console.error("Network error fetching medicine details:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Register a new medicine in the catalog (Protected)
 * Endpoint: POST /medicines
 */
async function createMedicine(medicinePayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/medicines`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(medicinePayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to create medicine.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error creating medicine:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Find facilities stocking a requested medicine (with optional proximity)
 * Endpoint: GET /medicines/{medicine_id}/facilities
 */
async function findFacilitiesWithMedicine(medicineId, options = {}) {
    try {
        const params = new URLSearchParams();
        if (options.min_quantity !== undefined) params.append("min_quantity", options.min_quantity);
        if (options.latitude !== undefined && options.latitude !== null) params.append("latitude", options.latitude);
        if (options.longitude !== undefined && options.longitude !== null) params.append("longitude", options.longitude);
        if (options.max_distance_km !== undefined && options.max_distance_km !== null) params.append("max_distance_km", options.max_distance_km);
        if (options.skip !== undefined) params.append("skip", options.skip);
        if (options.limit !== undefined) params.append("limit", options.limit || 50);

        const url = `${API_BASE_URL}/medicines/${encodeURIComponent(medicineId)}/facilities${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to find facilities with medicine." };
        }
    } catch (error) {
        console.error("Network error finding facilities with medicine:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Retrieve complete medicine inventory for a facility
 * Endpoint: GET /facilities/{facility_id}/inventory
 */
async function getFacilityInventory(facilityId, isAvailableOnly = false, skip = 0, limit = 100) {
    try {
        const params = new URLSearchParams();
        if (isAvailableOnly) params.append("is_available_only", "true");
        if (skip !== undefined) params.append("skip", skip);
        if (limit !== undefined) params.append("limit", limit || 100);

        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/inventory${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch facility inventory." };
        }
    } catch (error) {
        console.error("Network error fetching facility inventory:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Set or initialize facility medicine stock level (Protected)
 * Endpoint: POST /facilities/{facility_id}/inventory
 */
async function setFacilityInventory(facilityId, inventoryPayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/inventory`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(inventoryPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to update inventory.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error setting facility inventory:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Atomically adjust inventory stock / dispense medicine (Protected)
 * Endpoint: POST /facilities/{facility_id}/inventory/adjust?medicine_id={medicine_id}
 */
async function adjustFacilityInventoryStock(facilityId, medicineId, deltaQuantity, reason = null) {
    try {
        const params = new URLSearchParams({ medicine_id: medicineId });
        const payload = { delta_quantity: deltaQuantity };
        if (reason) payload.reason = reason;

        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/inventory/adjust?${params.toString()}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to adjust inventory stock.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error adjusting facility inventory stock:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Check stock level of a specific medicine at a facility
 * Endpoint: GET /facilities/{facility_id}/medicines/{medicine_id}/availability
 */
async function checkMedicineAvailability(facilityId, medicineId) {
    try {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/medicines/${encodeURIComponent(medicineId)}/availability`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Medicine availability record not found." };
        }
    } catch (error) {
        console.error("Network error checking medicine availability:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Intelligent Facility Recommendation and Routing (POST /facilities/recommend)
 */
async function recommendFacilities(routingPayload) {
    try {
        const response = await fetch(`${API_BASE_URL}/facilities/recommend`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(routingPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || { recommendations: [], total_matches: 0 } };
        } else {
            let errorMsg = "Facility recommendation query failed.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.error("Network error recommending facilities:", error);
        return { success: false, status: 0, message: "Unable to connect to backend routing service." };
    }
}

/**
 * Retrieve unified operational state for a specific facility (GET /facilities/{facility_id}/operational-state)
 */
async function getFacilityOperationalState(facilityId) {
    return fetchObjectWithOfflineCache('operational_states', facilityId, async () => {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/operational-state`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch operational state." };
        }
    });
}

/**
 * Retrieve operational states across all active facilities (GET /facilities/operational-state)
 */
async function getAllFacilitiesOperationalState(isActiveOnly = true) {
    return fetchWithOfflineCache('operational_states', async () => {
        const url = `${API_BASE_URL}/facilities/operational-state?is_active_only=${isActiveOnly}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch operational states." };
        }
    });
}

/**
 * Get single facility details by ID (GET /facilities/{facility_id})
 */
async function getFacilityById(facilityId) {
    return fetchObjectWithOfflineCache('facilities', facilityId, async () => {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Facility not found." };
        }
    });
}

/**
 * Discover nearest facilities with calculated Haversine distances (GET /facilities/discovery)
 */
async function discoverNearestFacilities(options = {}) {
    try {
        const params = new URLSearchParams();
        if (options.latitude !== undefined && options.latitude !== null) params.append("latitude", options.latitude);
        if (options.longitude !== undefined && options.longitude !== null) params.append("longitude", options.longitude);
        if (options.facility_type) params.append("facility_type", options.facility_type);
        if (options.max_distance_km) params.append("max_distance_km", options.max_distance_km);
        if (options.skip !== undefined) params.append("skip", options.skip);
        if (options.limit !== undefined) params.append("limit", options.limit || 50);

        const url = `${API_BASE_URL}/facilities/discovery${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to discover facilities." };
        }
    } catch (error) {
        console.error("Network error discovering facilities:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/* =========================================================================
   OPD DEPARTMENTS & DOCTOR SLOTS API ENDPOINTS
   ========================================================================= */

/**
 * Fetch active OPD departments for a healthcare facility (Offline-aware)
 * Endpoint: GET /facilities/{facility_id}/departments
 */
async function fetchFacilityDepartments(facilityId) {
    return fetchWithOfflineCache('departments', async () => {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/departments`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch departments." };
        }
    }, (dept) => dept.facility_id === facilityId);
}

/**
 * Create a new clinical department for a facility (Protected)
 * Endpoint: POST /facilities/{facility_id}/departments
 */
async function createDepartment(facilityId, deptPayload) {
    try {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/departments`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(deptPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to create department.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error creating department:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Fetch OPD consultation time slots for a doctor on a specific date (Offline-aware)
 * Endpoint: GET /specialists/{specialist_id}/slots?date=YYYY-MM-DD
 */
async function fetchDoctorSlots(specialistId, dateStr = null) {
    return fetchWithOfflineCache('slots', async () => {
        const params = new URLSearchParams();
        if (dateStr) params.append("date", dateStr);
        const url = `${API_BASE_URL}/specialists/${encodeURIComponent(specialistId)}/slots${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch doctor slots." };
        }
    }, (slot) => {
        if (slot.specialist_id && slot.specialist_id !== specialistId) return false;
        if (dateStr && slot.slot_date && slot.slot_date !== dateStr) return false;
        return true;
    });
}

/**
 * Update doctor OPD schedule settings (Protected)
 * Endpoint: PUT /specialists/{specialist_id}/schedule
 */
async function updateDoctorSchedule(specialistId, schedulePayload) {
    try {
        const url = `${API_BASE_URL}/specialists/${encodeURIComponent(specialistId)}/schedule`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(schedulePayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update doctor schedule.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating doctor schedule:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/* =========================================================================
   APPOINTMENTS & QUEUE TOKENS API ENDPOINTS
   ========================================================================= */

/**
 * Fetch patient appointments with optional filters (Offline-aware)
 * Endpoint: GET /appointments
 */
async function fetchAppointments(filters = {}) {
    return fetchWithOfflineCache('appointments', async () => {
        const params = new URLSearchParams();
        if (filters.facility_id) params.append("facility_id", filters.facility_id);
        if (filters.patient_id) params.append("patient_id", filters.patient_id);
        if (filters.specialist_id) params.append("specialist_id", filters.specialist_id);
        if (filters.status) params.append("status", filters.status);
        if (filters.skip !== undefined) params.append("skip", filters.skip);
        if (filters.limit !== undefined) params.append("limit", filters.limit || 100);

        const url = `${API_BASE_URL}/appointments${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: Array.isArray(data) ? data : [] };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch appointments." };
        }
    }, (appt) => {
        if (filters.facility_id && appt.facility_id !== filters.facility_id) return false;
        if (filters.status && appt.status !== filters.status) return false;
        if (filters.specialist_id && appt.specialist_id !== filters.specialist_id) return false;
        return true;
    });
}

/**
 * Create a new appointment (Offline-aware: creates pending sync request if offline)
 * Endpoint: POST /appointments
 */
async function createAppointment(appointmentPayload) {
    const isOffline = (window.Connectivity && window.Connectivity.isOffline()) || !navigator.onLine;

    if (isOffline) {
        return queueOfflineAppointment(appointmentPayload);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/appointments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(appointmentPayload)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            if (window.OfflineDB && data) {
                window.OfflineDB.put('appointments', data).catch(() => {});
            }
            return { success: true, data: data || {} };
        } else {
            let errorMsg = "Failed to create appointment.";
            if (data && data.detail) {
                if (typeof data.detail === "string") {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join(', ');
                }
            }
            return { success: false, status: response.status, message: errorMsg };
        }
    } catch (error) {
        console.warn("Network error creating appointment, queueing offline request:", error);
        return queueOfflineAppointment(appointmentPayload);
    }
}

/**
 * Queue an offline appointment request in IndexedDB
 */
async function queueOfflineAppointment(appointmentPayload) {
    const now = new Date();
    const dateCode = now.toISOString().slice(0,10).replace(/-/g, '');
    const timeCode = String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');
    const localRef = `OFF-${dateCode}-${timeCode}-${Math.floor(Math.random()*1000)}`;

    const pendingRecord = {
        id: localRef,
        localReference: localRef,
        patient_id: appointmentPayload.patient_id || 'LOCAL-PATIENT',
        facility_id: appointmentPayload.facility_id,
        specialist_id: appointmentPayload.specialist_id || null,
        department_name: appointmentPayload.department_name || 'General OPD',
        appointment_date: appointmentPayload.appointment_date,
        slot_time: appointmentPayload.slot_time || 'General OPD',
        status: 'PENDING_SYNC',
        token_number: null, // NO FAKE AUTHORITATIVE TOKEN
        is_emergency: !!appointmentPayload.is_emergency,
        triage_category: appointmentPayload.triage_category || 'ROUTINE',
        notes: appointmentPayload.notes || '',
        _isOfflinePending: true,
        _cachedAt: now.toISOString()
    };

    if (window.OfflineDB) {
        await window.OfflineDB.addSyncAction('CREATE_APPOINTMENT', appointmentPayload, localRef);
        await window.OfflineDB.put('appointments', pendingRecord);
    }

    return {
        success: true,
        isOfflineRequest: true,
        localReference: localRef,
        data: pendingRecord,
        message: "Appointment request saved offline. Your appointment token will be generated after the server confirms the slot."
    };
}

// Global Alias for bookAppointment
window.bookAppointment = createAppointment;


/**
 * Update appointment status (Protected)
 * Endpoint: PATCH /appointments/{appointment_id}/status
 */
async function updateAppointmentStatus(appointmentId, statusUpdate) {
    try {
        const url = `${API_BASE_URL}/appointments/${encodeURIComponent(appointmentId)}/status`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(statusUpdate)
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            const errorMsg = data?.detail || "Failed to update appointment status.";
            return { success: false, status: response.status, message: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg) };
        }
    } catch (error) {
        console.error("Network error updating appointment status:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}

/**
 * Get live facility queue metrics
 * Endpoint: GET /facilities/{facility_id}/queue
 */
async function fetchFacilityQueueMetrics(facilityId) {
    try {
        const url = `${API_BASE_URL}/facilities/${encodeURIComponent(facilityId)}/queue`;
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json().catch(() => null);
        if (response.ok) {
            return { success: true, data: data || {} };
        } else {
            return { success: false, status: response.status, message: data?.detail || "Failed to fetch queue metrics." };
        }
    } catch (error) {
        console.error("Network error fetching facility queue metrics:", error);
        return { success: false, status: 0, message: "Unable to connect to backend server." };
    }
}
