// ============================================================
// VIZITOR — Shared frontend helpers
//
// Live backend data + shared Crowd Simulation state.
//
// Crowd simulation is stored in localStorage so Dashboard,
// Analytics, Reports, Queue and Crowd Status can display the
// SAME simulated queue, waiting time and serving token.
// ============================================================

const VIZITOR = (() => {

    const SIMULATION_STORAGE_KEY =
        "vizitor_crowd_simulation";


    // ========================================================
    // AUTH
    // ========================================================

    function getAccessToken() {
        return localStorage.getItem("access_token");
    }


    function requireAuthOrRedirect() {

        const token =
            getAccessToken();

        // Demo mode is allowed.
        if (!token) {
            return "DEMO_MODE";
        }

        return token;
    }


    function authHeaders() {

        const token =
            requireAuthOrRedirect();

        if (!token) {
            return null;
        }

        return {
            "Authorization":
                `Bearer ${token}`,

            "Content-Type":
                "application/json"
        };
    }


    // ========================================================
    // GENERIC API GET
    // ========================================================

    async function apiGet(path) {

        const headers =
            authHeaders();

        if (!headers) {
            return null;
        }


        try {

            const response =
                await fetch(
                    `${API_BASE_URL}${path}`,
                    {
                        method: "GET",
                        headers
                    }
                );


            if (response.status === 401) {

                localStorage.removeItem(
                    "access_token"
                );

                localStorage.removeItem(
                    "isAuthenticated"
                );

                window.location.href =
                    "index.html";

                return null;
            }


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    `GET ${path} failed:`,
                    data
                );

                return null;
            }


            return data;


        } catch (error) {

            console.error(
                `GET ${path} error:`,
                error
            );

            return null;
        }
    }


    // ========================================================
    // APPOINTMENTS
    // ========================================================

        async function getCurrentUser() {
        return apiGet("/auth/me");
    }
	async function getAppointments() {

        const data =
            await apiGet(
                "/appointments"
            );

        return Array.isArray(data)
            ? data
            : [];
    }


    // ========================================================
    // CROWD SIMULATION STORAGE
    // ========================================================

    function getSimulationState() {

        try {

            const raw =
                localStorage.getItem(
                    SIMULATION_STORAGE_KEY
                );


            if (!raw) {
                return null;
            }


            const state =
                JSON.parse(raw);


            if (
                !state ||
                state.active !== true
            ) {
                return null;
            }


            return state;


        } catch (error) {

            console.error(
                "Unable to read crowd simulation state:",
                error
            );

            return null;
        }
    }


    function setSimulationState(state) {

        try {

            localStorage.setItem(
                SIMULATION_STORAGE_KEY,
                JSON.stringify({
                    ...state,
                    active: true,
                    updated_at:
                        new Date().toISOString()
                })
            );


            // Notify other tabs/windows.
            window.dispatchEvent(
                new CustomEvent(
                    "vizitorSimulationUpdated",
                    {
                        detail: state
                    }
                )
            );


        } catch (error) {

            console.error(
                "Unable to save crowd simulation state:",
                error
            );
        }
    }


    function clearSimulationState() {

        localStorage.removeItem(
            SIMULATION_STORAGE_KEY
        );


        window.dispatchEvent(
            new CustomEvent(
                "vizitorSimulationCleared"
            )
        );
    }


    function isSimulationActive() {

        return Boolean(
            getSimulationState()
        );
    }


    // ========================================================
    // SIMULATED QUEUE STATUS
    // ========================================================

    function buildSimulationQueueStatus(
        simulation
    ) {

        const queueSize =
            Math.max(
                0,
                Number(
                    simulation.queue_size ?? 0
                )
            );


        const peoplePresent =
            Math.max(
                0,
                Number(
                    simulation.people_currently_present ??
                    queueSize
                )
            );


        const wait =
            Number(
                simulation.estimated_wait_minutes ?? 0
            );


        const serviceRate =
            Number(
                simulation.service_rate ?? 0
            );


        const activeCounters =
            Math.max(
                1,
                Number(
                    simulation.active_counters ?? 1
                )
            );


        let crowdLevel =
            simulation.crowd_level;


        if (!crowdLevel) {

            if (queueSize <= 0) {
                crowdLevel = "No Crowd";
            }

            else if (queueSize <= 5) {
                crowdLevel = "Low";
            }

            else if (queueSize <= 15) {
                crowdLevel = "Moderate";
            }

            else {
                crowdLevel = "High";
            }
        }


        return {

            // Same queue everywhere.
            queue_size:
                queueSize,

            // Same people-present count everywhere.
            people_currently_present:
                peoplePresent,

            // Same waiting time everywhere.
            estimated_wait_minutes:
                Math.max(
                    0,
                    Math.round(wait)
                ),

            // Same crowd level everywhere.
            crowd_level:
                crowdLevel,

            // Same simulated serving token everywhere.
            currently_serving_token:
                simulation.currently_serving_token ||
                "SIM-001",

            // Additional shared simulation data.
            service_rate:
                serviceRate,

            service_rate_patients_per_hour:
                serviceRate,

            active_counters:
                activeCounters,

            total_active:
                Math.max(
                    1,
                    queueSize
                ),

            served_so_far:
                Number(
                    simulation.served_so_far ?? 0
                ),

            remaining_current_service_minutes:
                Number(
                    simulation.remaining_current_service_minutes ?? 0
                ),

            simulation_active:
                true,

            simulation_users:
                Number(
                    simulation.simulation_users ??
                    peoplePresent
                ),

            simulation_step:
                Number(
                    simulation.simulation_step ?? 0
                ),

            server_time:
                new Date().toISOString(),

            you:
                null
        };
    }


    // ========================================================
    // SINGLE SOURCE OF TRUTH
    // ========================================================

    async function getQueueStatus() {

        /*
         * IMPORTANT:
         *
         * If Crowd Status has started a simulation,
         * ALL pages receive the simulation state instead
         * of independently showing different backend values.
         */

        const simulation =
            getSimulationState();


        if (simulation) {

            return buildSimulationQueueStatus(
                simulation
            );
        }


        // Otherwise use the real backend.
        return apiGet(
            "/appointments/queue/status"
        );
    }


    // ========================================================
    // DATE / TIME HELPERS
    // ========================================================

    function formatDate(dateString) {

        if (!dateString) {
            return "--";
        }


        const date =
            new Date(
                `${dateString}T00:00:00`
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {
            return dateString;
        }


        return date.toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );
    }


    function formatTime(timeString) {

        if (!timeString) {
            return "--";
        }


        const cleanTime =
            timeString
                .split(".")[0];


        const parts =
            cleanTime.split(":");


        if (
            parts.length < 2
        ) {
            return timeString;
        }


        const date =
            new Date();


        date.setHours(
            Number(parts[0])
        );

        date.setMinutes(
            Number(parts[1])
        );

        date.setSeconds(0);


        return date.toLocaleTimeString(
            "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            }
        );
    }


    // ========================================================
    // HTML SAFETY
    // ========================================================

    function escapeHtml(value) {

        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            value ?? "";

        return div.innerHTML;
    }


    // ========================================================
    // STATUS
    // ========================================================

    function friendlyStatusLabel(
        status
    ) {

        switch (status) {

            case "BEING_SERVED":
                return "Being Served";

            case "SERVED":
                return "Served";

            case "WAITING":
                return "Waiting";

            case "CANCELLED":
                return "Cancelled";

            case "PENDING":
                return "Pending";

            default:
                return status || "--";
        }
    }


    // ========================================================
    // INITIALS
    // ========================================================

    function initials(fullName) {

        if (!fullName) {
            return "U";
        }


        const parts =
            fullName
                .trim()
                .split(/\s+/);


        let out =
            parts[0]
                .charAt(0)
                .toUpperCase();


        if (parts.length > 1) {

            out +=
                parts[
                    parts.length - 1
                ]
                .charAt(0)
                .toUpperCase();
        }


        return out;
    }


    // ========================================================
    // COMMON NAV
    // ========================================================

    function wireCommonNav() {

        const profileBadge =
            document.querySelector(
                ".profile-badge"
            );


        if (profileBadge) {

            profileBadge.style.cursor =
                "pointer";


            profileBadge.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "profile.html";
                }
            );
        }


        const notifBtn =
            document.querySelector(
                '.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]'
            );


        if (notifBtn) {

            notifBtn.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "notifications.html";
                }
            );
        }


        const logoutLinks =
            document.querySelectorAll(
                '.sidebar-footer a, #btnLogout'
            );


        logoutLinks.forEach(
            link => {

                link.addEventListener(
                    "click",
                    () => {

                        localStorage.removeItem(
                            "access_token"
                        );

                        localStorage.removeItem(
                            "isAuthenticated"
                        );

                        localStorage.removeItem(
                            "userEmail"
                        );

                        clearSimulationState();
                    }
                );
            }
        );
    }


    // ========================================================
    // AVATAR
    // ========================================================

    function applyAvatar(
        fullName
    ) {

        const badgeText =
            initials(
                fullName
            );


        document
            .querySelectorAll(
                ".profile-avatar"
            )
            .forEach(
                el => {

                    el.textContent =
                        badgeText;
                }
            );
    }


    // ========================================================
    // PUBLIC API
    // ========================================================

    return {

        getAccessToken,
        requireAuthOrRedirect,
        authHeaders,
        apiGet,

        getCurrentUser,
        getAppointments,
        getQueueStatus,

        getSimulationState,
        setSimulationState,
        clearSimulationState,
        isSimulationActive,

        formatDate,
        formatTime,
        escapeHtml,
        friendlyStatusLabel,
        initials,

        wireCommonNav,
        applyAvatar
    };

})();