// ============================================================
// VIZITOR — shared frontend helpers
//
// Every page (dashboard, queue, crowd status, profile,
// notifications, reports, analytics) loads this file and uses
// it to talk to the SAME backend endpoints. Because the queue /
// crowd numbers all come from one backend endpoint
// (`/appointments/queue/status`) that is derived from the real
// appointment rows in the database, every page always shows
// identical, live, time-based numbers — there is no separate
// "sample data" per page anymore.
// ============================================================

const VIZITOR = (() => {

    function getAccessToken() {
        return localStorage.getItem("access_token");
    }

    function requireAuthOrRedirect() {
    const token = getAccessToken();

    // Allow Crowd Status simulation demo without login
    if (!token) {
        return "DEMO_MODE";
    }

    return token;
}

    function authHeaders() {
        const token = requireAuthOrRedirect();
        if (!token) return null;

        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    }

    async function apiGet(path) {
        const headers = authHeaders();
        if (!headers) return null;

        try {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: "GET",
                headers
            });

            if (response.status === 401) {
                // Session expired / invalid token.
                localStorage.removeItem("access_token");
                localStorage.removeItem("isAuthenticated");
                window.location.href = "index.html";
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                console.error(`GET ${path} failed:`, data);
                return null;
            }

            return data;

        } catch (error) {
            console.error(`GET ${path} error:`, error);
            return null;
        }
    }

    async function getCurrentUser() {
        return apiGet("/auth/me");
    }

    async function getAppointments() {
        const data = await apiGet("/appointments");
        return Array.isArray(data) ? data : [];
    }

    // The single source of truth for queue position, currently
    // serving token, people ahead, estimated wait and crowd
    // level. Every page calls this same endpoint.
    async function getQueueStatus() {
        return apiGet("/appointments/queue/status");
    }

    function formatDate(dateString) {
        if (!dateString) return "--";
        const date = new Date(`${dateString}T00:00:00`);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function formatTime(timeString) {
        if (!timeString) return "--";
        const cleanTime = timeString.split(".")[0];
        const parts = cleanTime.split(":");
        if (parts.length < 2) return timeString;

        const date = new Date();
        date.setHours(Number(parts[0]));
        date.setMinutes(Number(parts[1]));
        date.setSeconds(0);

        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function friendlyStatusLabel(status) {
        switch (status) {
            case "BEING_SERVED": return "Being Served";
            case "SERVED": return "Served";
            case "WAITING": return "Waiting";
            case "CANCELLED": return "Cancelled";
            case "PENDING": return "Pending";
            default: return status || "--";
        }
    }

    function initials(fullName) {
        if (!fullName) return "U";
        const parts = fullName.trim().split(/\s+/);
        let out = parts[0].charAt(0).toUpperCase();
        if (parts.length > 1) {
            out += parts[parts.length - 1].charAt(0).toUpperCase();
        }
        return out;
    }

    // ------------------------------------------------------
    // Shared header/sidebar wiring (profile badge, notif bell,
    // logout) used on every dashboard-style page.
    // ------------------------------------------------------
    function wireCommonNav() {
        const profileBadge = document.querySelector(".profile-badge");
        if (profileBadge) {
            profileBadge.style.cursor = "pointer";
            profileBadge.addEventListener("click", () => {
                window.location.href = "profile.html";
            });
        }

        const notifBtn = document.querySelector(
            '.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]'
        );
        if (notifBtn) {
            notifBtn.addEventListener("click", () => {
                window.location.href = "notifications.html";
            });
        }

        const logoutLinks = document.querySelectorAll(
            '.sidebar-footer a, #btnLogout'
        );
        logoutLinks.forEach(link => {
            link.addEventListener("click", () => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("isAuthenticated");
                localStorage.removeItem("userEmail");
            });
        });
    }

    // Fills in the little avatar badges (sidebar/header + any
    // large profile avatar) from the logged-in user's name.
    function applyAvatar(fullName) {
        const badgeText = initials(fullName);
        document.querySelectorAll(".profile-avatar").forEach(el => {
            el.textContent = badgeText;
        });
    }

    return {
        getAccessToken,
        requireAuthOrRedirect,
        authHeaders,
        apiGet,
        getCurrentUser,
        getAppointments,
        getQueueStatus,
        formatDate,
        formatTime,
        escapeHtml,
        friendlyStatusLabel,
        initials,
        wireCommonNav,
        applyAvatar
    };
})();
