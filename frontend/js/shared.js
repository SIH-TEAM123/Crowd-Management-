// ============================================================
// VIZITOR — Shared frontend helpers
//
// ONE SOURCE OF TRUTH:
// Real queue -> backend
// Simulation -> temporary local overlay
// Notifications -> shared local event store
// ============================================================

const VIZITOR = (() => {

    const SIMULATION_STORAGE_KEY =
        "vizitor_crowd_simulation";

    const NOTIFICATION_EVENTS_KEY =
        "vizitor_notification_events";

    const NOTIFICATION_BASELINE_KEY =
        "vizitor_notification_baseline";

    const SIMULATION_TICK_MS = 1000;

    let notificationMonitorStarted = false;
    let lastQueueSnapshot = null;
    let lastAppointmentSnapshot = null;
    let lastCalledToken = null;


    // ========================================================
    // AUTH
    // ========================================================

    function getAccessToken() {
        return localStorage.getItem("access_token");
    }


    function requireAuthOrRedirect() {
        return getAccessToken() || "DEMO_MODE";
    }


    function authHeaders() {
        const token = getAccessToken();
        const headers = {
            "Content-Type": "application/json"
        };
        if (token && token !== "DEMO_MODE") {
            headers["Authorization"] = `Bearer ${token}`;
        }
        return headers;
    }


    // ========================================================
    // API
    // ========================================================

    function shouldRedirectOn401() {
        const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
        const publicPages = [
            "index.html",
            "",
            "help.html",
            "signup.html",
            "verify-otp.html",
            "forgot-password.html",
            "reset-password.html"
        ];
        return !publicPages.includes(current);
    }

    async function apiGet(path) {

        const headers = authHeaders();

        if (!headers) {
            return null;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}${path}`,
                {
                    method: "GET",
                    headers
                }
            );

            if (response.status === 401) {
                let errData = {};
                try {
                    errData = await response.json();
                } catch (_) {}
                const detail = String(errData.detail || "").toLowerCase();
                const isAuthExpired = detail.includes("invalid") || detail.includes("expired") || detail.includes("not authenticated");
                if (isAuthExpired && (path === "/auth/me" || path === "/auth/login")) {
                    console.warn("[VIZITOR] Confirmed invalid/expired token on auth check. Clearing session.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("isAuthenticated");
                    if (shouldRedirectOn401()) {
                        window.location.href = "index.html";
                    }
                } else {
                    console.warn(`[VIZITOR] Received 401 on ${path}. Session kept intact.`);
                }
                return null;
            }

            const data = await response.json();

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

    async function apiPost(path, body = {}) {
        const headers = authHeaders();
        if (!headers) {
            return null;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}${path}`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                }
            );

            if (response.status === 401) {
                let errData = {};
                try {
                    errData = await response.json();
                } catch (_) {}
                const detail = String(errData.detail || "").toLowerCase();
                const isAuthExpired = detail.includes("invalid") || detail.includes("expired") || detail.includes("not authenticated");
                if (isAuthExpired && (path === "/auth/me" || path === "/auth/login")) {
                    console.warn("[VIZITOR] Confirmed invalid/expired token on auth check. Clearing session.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("isAuthenticated");
                    if (shouldRedirectOn401()) {
                        window.location.href = "index.html";
                    }
                } else {
                    console.warn(`[VIZITOR] Received 401 on ${path}. Session kept intact.`);
                }
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                console.error(`POST ${path} failed:`, data);
                return null;
            }
            return data;
        } catch (error) {
            console.error(`POST ${path} error:`, error);
            return null;
        }
    }

    async function apiPut(path, body = {}) {
        const headers = authHeaders();
        if (!headers) return null;

        try {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: "PUT",
                headers,
                body: JSON.stringify(body)
            });

            if (response.status === 401) {
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                console.error(`PUT ${path} failed:`, data);
                return null;
            }
            return data;
        } catch (error) {
            console.error(`PUT ${path} error:`, error);
            return null;
        }
    }

    async function apiPatch(path, body = {}) {
        const headers = authHeaders();
        if (!headers) return null;

        try {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(body)
            });

            if (response.status === 401) {
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                console.error(`PATCH ${path} failed:`, data);
                return null;
            }
            return data;
        } catch (error) {
            console.error(`PATCH ${path} error:`, error);
            return null;
        }
    }



    // ========================================================
    // USER / APPOINTMENTS
    // ========================================================

    async function getCurrentUser() {
        return apiGet("/auth/me");
    }


    async function getAppointments() {

        const data =
            await apiGet("/appointments");

        return Array.isArray(data)
            ? data
            : [];
    }


    // ========================================================
    // SIMULATION STORAGE
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
                "Unable to read simulation state:",
                error
            );

            return null;
        }
    }



    async function startSimulation(numUsers = 50, serviceRateMinutes = 4.0) {
        try {
            const result = await apiPost("/appointments/queue/simulate", {
                num_users: Number(numUsers) || 50,
                service_rate_minutes: Number(serviceRateMinutes) || 4.0
            });
            if (result && result.success) {
                setSimulationState(result);
                window.dispatchEvent(new CustomEvent("vizitorSimulationUpdated", { detail: result }));
            }
            return result;
        } catch (error) {
            console.error("VIZITOR startSimulation error:", error);
            return null;
        }
    }

    function setSimulationState(state) {

        try {

            const finalState = {
                ...state,
                active: true,
                updated_at:
                    new Date().toISOString()
            };

            localStorage.setItem(
                SIMULATION_STORAGE_KEY,
                JSON.stringify(finalState)
            );

            window.dispatchEvent(
                new CustomEvent(
                    "vizitorSimulationUpdated",
                    {
                        detail: finalState
                    }
                )
            );

        } catch (error) {

            console.error(
                "Unable to save simulation state:",
                error
            );
        }
    }


    async function clearSimulationState() {
        localStorage.removeItem(
            SIMULATION_STORAGE_KEY
        );

        try {
            await apiPost("/appointments/queue/simulation/reset", {});
        } catch (e) {
            console.warn("Backend reset notice:", e);
        }

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
    // TOKEN HELPERS
    // ========================================================

    function tokenNumber(token) {

        if (!token) {
            return null;
        }

        const match =
            String(token).match(
                /(\d+)\s*$/
            );

        return match
            ? Number(match[1])
            : null;
    }


    function tokenFromNumber(number) {

        if (
            !Number.isFinite(
                Number(number)
            )
        ) {
            return "--";
        }

        return `A-${Math.max(
            0,
            Math.round(
                Number(number)
            )
        )}`;
    }


    // ========================================================
    // SIMULATION STATUS
    //
    // Example:
    //
    // Real serving = A-114
    // Synthetic users = 50
    // User real token = A-165
    //
    // At simulation start:
    // Simulated serving = A-115
    //
    // As time passes:
    // A-116, A-117, A-118...
    //
    // The user's simulated token remains A-165.
    // ========================================================

    function buildSimulationQueueStatus(
        simulation
    ) {

        const startedAtMs =
            Number(
                simulation.started_at_ms ||
                Date.now()
            );

        const elapsedSeconds =
            Math.max(
                0,
                (
                    Date.now() -
                    startedAtMs
                ) / 1000
            );

        const elapsedMinutes =
            elapsedSeconds / 60;


        const initialWait =
            Math.max(
                0,
                Number(
                    simulation.initial_wait_minutes ??
                    simulation.estimated_wait_minutes ??
                    0
                )
            );


        const minutesPerPerson =
            Math.max(
                0.01,
                Number(
                    simulation.minutes_per_person ??
                    1
                )
            );


        /*
         * Number of synthetic patients that have already
         * completed service.
         */
        const syntheticAhead =
            Math.max(
                0,
                Number(
                    simulation.synthetic_users ?? 0
                )
            );


        const completedSynthetic =
            Math.min(
                syntheticAhead,
                Math.floor(
                    elapsedMinutes /
                    minutesPerPerson
                )
            );


        /*
         * Remaining waiting time.
         *
         * This is the user's simulation waiting window.
         */
        const remainingWait =
            Math.max(
                0,
                initialWait -
                elapsedMinutes
            );


        const roundedWait =
            Math.ceil(
                remainingWait
            );


        const initialUserTokenNumber =
            tokenNumber(
                simulation.real_user_token
            );


        const initialServingNumber =
            tokenNumber(
                simulation.real_serving_token
            );


        /*
         * IMPORTANT:
         *
         * The real serving token is NOT the user's token.
         *
         * At simulation start, the next simulated token after
         * the real serving token becomes the simulated serving
         * token.
         *
         * Example:
         *
         * real serving = A-114
         * simulated serving = A-115
         */
        let servingNumber =
            initialServingNumber !== null
                ? initialServingNumber + 1
                : null;


        /*
         * The user's simulated token is placed after all
         * synthetic users.
         *
         * Example:
         *
         * real user = A-115
         * synthetic = 50
         * simulated user = A-165
         */
        let simulatedUserNumber =
            initialUserTokenNumber !== null
                ? initialUserTokenNumber +
                    syntheticAhead
                : null;


        /*
         * As synthetic patients are completed, the simulated
         * serving token moves forward.
         *
         * Example:
         *
         * t=0      -> A-115
         * 1 person -> A-116
         * 2 people -> A-117
         */
        if (
            servingNumber !== null
        ) {

            servingNumber +=
                completedSynthetic;
        }


        /*
         * Once all synthetic patients have been processed,
         * the simulated serving token reaches the user's
         * simulated token.
         */
        const called =
            completedSynthetic >=
            syntheticAhead ||
            remainingWait <= 0;


        if (
            called &&
            simulatedUserNumber !== null
        ) {

            servingNumber =
                simulatedUserNumber;
        }


        /*
         * Queue size:
         *
         * Original real queue
         * +
         * synthetic users
         * -
         * synthetic users already served
         */
        const queueSize =
            Math.max(
                0,
                Number(
                    simulation.base_queue_size ?? 0
                ) +
                syntheticAhead -
                completedSynthetic
            );


        const peoplePresent =
            Math.max(
                0,
                Number(
                    simulation.base_people_present ??
                    simulation.base_queue_size ??
                    0
                ) +
                syntheticAhead -
                completedSynthetic
            );


        const activeCounters =
            Math.max(
                1,
                Number(
                    simulation.active_counters ?? 1
                )
            );


        let crowdLevel;

        if (
            queueSize <= 0
        ) {

            crowdLevel =
                "No Crowd";

        } else if (
            queueSize <= 5
        ) {

            crowdLevel =
                "Low";

        } else if (
            queueSize <= 15
        ) {

            crowdLevel =
                "Moderate";

        } else {

            crowdLevel =
                "High";
        }


        const currentServingToken =
            servingNumber !== null
                ? tokenFromNumber(
                    servingNumber
                )
                : (
                    simulation.real_serving_token ||
                    "--"
                );


        const simulatedUserToken =
            simulatedUserNumber !== null
                ? tokenFromNumber(
                    simulatedUserNumber
                )
                : (
                    simulation.real_user_token ||
                    "--"
                );


        const peopleAhead =
            called
                ? 0
                : Math.max(
                    0,
                    syntheticAhead -
                    completedSynthetic
                );


        return {

            queue_size:
                queueSize,

            people_currently_present:
                peoplePresent,

            estimated_wait_minutes:
                roundedWait,

            initial_wait_minutes:
                initialWait,

            crowd_level:
                crowdLevel,

            currently_serving_token:
                currentServingToken,

            user_simulated_token:
                simulatedUserToken,

            real_user_token:
                simulation.real_user_token,

            real_serving_token:
                simulation.real_serving_token,

            synthetic_users:
                syntheticAhead,

            synthetic_completed:
                completedSynthetic,

            synthetic_remaining:
                Math.max(
                    0,
                    syntheticAhead -
                    completedSynthetic
                ),

            active_counters:
                activeCounters,

            service_rate:
                Number(
                    simulation.service_rate ?? 0
                ),

            service_rate_patients_per_hour:
                Number(
                    simulation.service_rate ?? 0
                ),

            counter_number:
                Number(
                    simulation.counter_number ?? 1
                ),

            served_so_far:
                Number(
                    simulation.served_so_far ?? 0
                ) +
                completedSynthetic,

            remaining_current_service_minutes:
                Math.max(
                    0,
                    remainingWait
                ),

            simulation_active:
                true,

            simulation_users:
                syntheticAhead,

            simulation_step:
                Number(
                    simulation.simulation_step ?? 0
                ) +
                completedSynthetic,

            simulation_called:
                called,

            simulation_started_at:
                simulation.started_at,

            server_time:
                new Date().toISOString(),

            /*
             * IMPORTANT:
             *
             * `you.token_display` is ALWAYS the user's
             * simulated token during simulation.
             *
             * It must NEVER be replaced by currently_serving.
             */
            you: {

                appointment_id:
                    simulation.real_appointment_id,

                token_display:
                    simulatedUserToken,

                real_token_display:
                    simulation.real_user_token,

                purpose:
                    simulation.real_purpose ||
                    "Current Appointment",

                appointment_date:
                    simulation.real_appointment_date,

                appointment_time:
                    simulation.real_appointment_time,

                position:
                    called
                        ? 1
                        : peopleAhead + 1,

                people_ahead:
                    peopleAhead,

                estimated_wait_minutes:
                    roundedWait,

                status:
                    called
                        ? "BEING_SERVED"
                        : "WAITING",

                counter_number:
                    Number(
                        simulation.counter_number ?? 1
                    ),

                proceed_to_counter:
                    called
            }
        };
    }


    // ========================================================
    // QUEUE SINGLE SOURCE
    // ========================================================

    async function getQueueStatus() {
        // ALWAYS query the authoritative backend queue status
        const data = await apiGet("/appointments/queue/status");

        if (data) {
            // Cache to offline DB if supported
            if (window.OfflineDB && typeof window.OfflineDB.putRecord === "function") {
                try {
                    await window.OfflineDB.putRecord("meta", { key: "last_queue_status", data: data });
                } catch (e) { /* ignore cache error */ }
            }
            return data;
        }

        // Offline fallback: attempt to read cached queue status
        if (window.OfflineDB && typeof window.OfflineDB.getRecord === "function") {
            try {
                const cached = await window.OfflineDB.getRecord("meta", "last_queue_status");
                if (cached && cached.data) {
                    return { ...cached.data, _offline_cached: true };
                }
            } catch (e) { /* ignore */ }
        }

        return null;
    }


    // ========================================================
    // PERSISTED NOTIFICATION EVENTS
    // ========================================================

    function currentUserKey() {

        return (
            localStorage.getItem("userEmail") ||
            localStorage.getItem("access_token") ||
            "anon"
        );
    }


    function notificationStorageKey() {

        return `${NOTIFICATION_EVENTS_KEY}_${currentUserKey()}`;
    }


    function getNotificationEvents() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    notificationStorageKey()
                )
            ) || [];

        } catch {

            return [];
        }
    }


    function saveNotificationEvents(
        events
    ) {

        localStorage.setItem(
            notificationStorageKey(),
            JSON.stringify(
                events.slice(-100)
            )
        );

        window.dispatchEvent(
            new CustomEvent(
                "vizitorNotificationAdded"
            )
        );
    }


    function addNotificationEvent({
        id,
        category,
        title,
        message,
        time,
        important = false
    }) {

        const events =
            getNotificationEvents();

        const eventId =
            id ||
            `${category}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;


        if (
            events.some(
                item =>
                    item.id === eventId
            )
        ) {
            return;
        }


        const item = {

            id:
                eventId,

            category:
                category || "system",

            title:
                title || "VIZITOR Update",

            message:
                message || "",

            time:
                time ||
                new Date().toLocaleString(
                    "en-US",
                    {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                    }
                ),

            important:
                Boolean(important),

            created_at:
                new Date().toISOString(),

            read:
                false
        };


        events.push(item);

        saveNotificationEvents(
            events
        );


        if (important) {
            showGlobalNotification(item);
        }
    }


    function markNotificationRead(id) {

        const events =
            getNotificationEvents();

        const updated =
            events.map(
                item =>
                    item.id === id
                        ? {
                            ...item,
                            read: true
                        }
                        : item
            );

        saveNotificationEvents(
            updated
        );
    }


    function markAllNotificationsRead() {

        const events =
            getNotificationEvents();

        saveNotificationEvents(
            events.map(
                item => ({
                    ...item,
                    read: true
                })
            )
        );
    }


    // ========================================================
    // GLOBAL NOTIFICATION POPUP
    // ========================================================

    function ensureGlobalNotificationUI() {

        if (
            document.getElementById(
                "vizitorGlobalNotification"
            )
        ) {
            return;
        }


        const style =
            document.createElement(
                "style"
            );

        style.id =
            "vizitor-global-notification-style";


        style.textContent = `

            #vizitorGlobalNotification {
                position: fixed;
                top: 24px;
                right: 24px;
                width: min(390px, calc(100vw - 32px));
                z-index: 999999;
                display: none;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                box-shadow: 0 18px 50px rgba(15,23,42,.18);
                padding: 16px;
                animation: vizitorNotifIn .3s ease;
            }

            #vizitorGlobalNotification.show {
                display: block;
            }

            .vizitor-global-notif-row {
                display: flex;
                gap: 12px;
                align-items: flex-start;
            }

            .vizitor-global-notif-icon {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                background: rgba(124,58,237,.10);
                color: #7c3aed;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 20px;
                font-weight: 800;
            }

            .vizitor-global-notif-content {
                flex: 1;
                min-width: 0;
            }

            .vizitor-global-notif-title {
                margin: 0 0 4px;
                font-size: 14px;
                font-weight: 800;
                color: #111827;
            }

            .vizitor-global-notif-message {
                margin: 0;
                font-size: 13px;
                line-height: 1.5;
                color: #64748b;
            }

            .vizitor-global-notif-close {
                border: 0;
                background: transparent;
                color: #94a3b8;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
            }

            .vizitor-global-notif-action {
                margin-top: 12px;
                width: 100%;
                height: 36px;
                border: 0;
                border-radius: 9px;
                background: #7c3aed;
                color: white;
                font-weight: 700;
                cursor: pointer;
            }

            @keyframes vizitorNotifIn {
                from {
                    opacity: 0;
                    transform: translateY(-12px) translateX(12px);
                }

                to {
                    opacity: 1;
                    transform: translateY(0) translateX(0);
                }
            }
        `;


        document.head.appendChild(
            style
        );


        const box =
            document.createElement(
                "div"
            );

        box.id =
            "vizitorGlobalNotification";


        box.innerHTML = `
            <div class="vizitor-global-notif-row">
                <div class="vizitor-global-notif-icon">!</div>

                <div class="vizitor-global-notif-content">

                    <h4
                        class="vizitor-global-notif-title"
                        id="vizitorGlobalNotifTitle">
                    </h4>

                    <p
                        class="vizitor-global-notif-message"
                        id="vizitorGlobalNotifMessage">
                    </p>

                </div>

                <button
                    type="button"
                    class="vizitor-global-notif-close"
                    id="vizitorGlobalNotifClose">
                    ×
                </button>
            </div>

            <button
                type="button"
                class="vizitor-global-notif-action"
                id="vizitorGlobalNotifAction">
                View Notifications
            </button>
        `;


        document.body.appendChild(
            box
        );


        document
            .getElementById(
                "vizitorGlobalNotifClose"
            )
            ?.addEventListener(
                "click",
                () => {
                    box.classList.remove(
                        "show"
                    );
                }
            );


        document
            .getElementById(
                "vizitorGlobalNotifAction"
            )
            ?.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "notifications.html";
                }
            );
    }


    let globalNotificationTimer =
        null;


    function showGlobalNotification(
        item
    ) {

        ensureGlobalNotificationUI();


        const box =
            document.getElementById(
                "vizitorGlobalNotification"
            );

        const title =
            document.getElementById(
                "vizitorGlobalNotifTitle"
            );

        const message =
            document.getElementById(
                "vizitorGlobalNotifMessage"
            );


        if (
            !box ||
            !title ||
            !message
        ) {
            return;
        }


        title.textContent =
            item.title;

        message.textContent =
            item.message;


        box.classList.add(
            "show"
        );


        clearTimeout(
            globalNotificationTimer
        );


        globalNotificationTimer =
            setTimeout(
                () => {

                    box.classList.remove(
                        "show"
                    );

                },
                8000
            );
    }


    // ========================================================
    // NOTIFICATION MONITOR
    // ========================================================

    async function checkNotificationChanges() {
        const token = getAccessToken();
        if (!token || token === "DEMO_MODE") {
            return;
        }

        try {

            const queue =
                await getQueueStatus();

            const appointments =
                await getAppointments();


            if (!queue) {
                return;
            }


            if (!lastAppointmentSnapshot) {

                lastAppointmentSnapshot =
                    appointments.map(
                        a => ({
                            id:
                                a.appointment_id,

                            status:
                                a.status,

                            token:
                                a.token_display ||
                                a.token
                        })
                    );

            } else {

                const previous =
                    new Map(
                        lastAppointmentSnapshot.map(
                            a => [
                                a.id,
                                a
                            ]
                        )
                    );


                for (
                    const appointment
                    of appointments
                ) {

                    const old =
                        previous.get(
                            appointment.appointment_id
                        );


                    if (!old) {

                        addNotificationEvent({

                            id:
                                `booking-${appointment.appointment_id}`,

                            category:
                                "appointment",

                            title:
                                "Appointment Confirmed",

                            message:
                                `Your appointment for ${appointment.purpose} is confirmed for ${formatDate(appointment.appointment_date)} at ${formatTime(appointment.appointment_time)}.`,

                            important:
                                true
                        });

                    } else if (
                        old.status !==
                        appointment.status &&
                        appointment.status ===
                        "CANCELLED"
                    ) {

                        addNotificationEvent({

                            id:
                                `cancelled-${appointment.appointment_id}`,

                            category:
                                "appointment",

                            title:
                                "Appointment Cancelled",

                            message:
                                `Your appointment for ${appointment.purpose} has been cancelled.`,

                            important:
                                true
                        });
                    }
                }


                lastAppointmentSnapshot =
                    appointments.map(
                        a => ({
                            id:
                                a.appointment_id,

                            status:
                                a.status,

                            token:
                                a.token_display ||
                                a.token
                        })
                    );
            }


            const you =
                queue.you;


            if (you) {

                const called =
                    you.status ===
                    "BEING_SERVED";


                const token = you.token_display;
                const counter = you.assigned_counter || (you.counter_number ? `Counter ${you.counter_number}` : "Counter 1");

                // Near Turn Notification (people_ahead <= 2)
                if (you.status === "WAITING" && you.people_ahead <= 2 && !you._nearTurnNotified) {
                    you._nearTurnNotified = true;
                    addNotificationEvent({
                        id: `near-turn-${token}-${you.appointment_id || "user"}`,
                        category: "queue",
                        title: `Turn Approaching — ${token}`,
                        message: `Your turn is coming up! Token ${token} has been assigned to ${counter}. Please proceed toward the counter.`,
                        important: true
                    });
                }

                if (
                    called &&
                    token &&
                    lastCalledToken !== token
                ) {
                    lastCalledToken = token;
                    addNotificationEvent({
                        id: `called-${token}-${you.appointment_id || "user"}`,
                        category: "queue",
                        title: `It's Your Turn! — ${token}`,
                        message: `Token ${token} is now being served. Please proceed to ${counter} now.`,
                        important: true
                    });
                }

                // Section J: Contextual Arcade Recommendation while waiting
                if (you.status === "WAITING" && you.people_ahead >= 3 && you.estimated_wait_minutes >= 5 && !you._arcadeSuggested) {
                    you._arcadeSuggested = true;
                    addNotificationEvent({
                        id: `arcade-suggest-${token}`,
                        category: "wellness",
                        title: "Waiting for Your Turn?",
                        message: `You have ~${you.estimated_wait_minutes} min estimated wait. Check out the Arcade for relaxing wellness games while you wait!`,
                        important: false
                    });
                }
            }


            lastQueueSnapshot =
                queue;

        } catch (error) {

            console.error(
                "Notification monitor error:",
                error
            );
        }
    }


    function startNotificationMonitor() {
        const token = getAccessToken();
        if (!token || token === "DEMO_MODE") {
            return;
        }

        if (
            notificationMonitorStarted
        ) {
            return;
        }


        notificationMonitorStarted =
            true;


        ensureGlobalNotificationUI();


        checkNotificationChanges();


        setInterval(
            checkNotificationChanges,
            5000
        );
    }


    // ========================================================
    // DATE / TIME
    // ========================================================

    function formatDate(
        dateString
    ) {

        if (!dateString) {
            return "--";
        }


        const date =
            new Date(
                `${dateString}T00:00:00`
            );


        if (
            Number.isNaN(
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


    function formatTime(
        timeString
    ) {

        if (!timeString) {
            return "--";
        }


        const clean =
            String(
                timeString
            ).split(".")[0];


        const parts =
            clean.split(":");


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

    function escapeHtml(
        value
    ) {

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

    function initials(
        fullName
    ) {

        if (!fullName) {
            return "U";
        }


        const parts =
            fullName
                .trim()
                .split(/\s+/);


        let result =
            parts[0]
                .charAt(0)
                .toUpperCase();


        if (
            parts.length > 1
        ) {

            result +=
                parts[
                    parts.length - 1
                ]
                .charAt(0)
                .toUpperCase();
        }


        return result;
    }


    // ========================================================
    // NAV
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

        const text =
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
                        text;
                }
            );
    }


    // ========================================================
    // SHARED QR PASS COMPONENT (SECTION D)
    // ========================================================

    function showQRPassModal(appointmentId, tokenDisplay, serviceName, apptDate) {
        let modal = document.getElementById("vizitorQRModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "vizitorQRModal";
            document.body.appendChild(modal);
        }

        const passToken = tokenDisplay || "A-114";
        const passService = serviceName || "General Consultation";
        const passDate = apptDate || new Date().toISOString().split("T")[0];

        modal.innerHTML = `
            <div class="vizitor-modal-card" style="position:relative;background:#ffffff;border-radius:16px;max-width:380px;width:90%;margin:auto;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1);text-align:center;font-family:'Inter',system-ui,-apple-system,sans-serif;">
                <button type="button" class="vizitor-modal-close" style="position:absolute;top:16px;right:16px;background:transparent;border:none;font-size:24px;color:#94a3b8;cursor:pointer;line-height:1;" onclick="document.getElementById('vizitorQRModal').style.display='none'">&times;</button>
                <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:6px;" data-i18n="qrPassTitle">Digital QR Token Pass</div>
                <div style="font-size:13px;color:#64748b;margin-bottom:16px;" data-i18n="qrPassSubtitle">Scan at clinic counter kiosk</div>

                <div id="qrModalBox" style="background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e2e8f0;display:inline-flex;justify-content:center;align-items:center;min-width:200px;min-height:200px;margin-bottom:16px;">
                    <div id="qrSvgHolder" style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;">
                        <svg viewBox="0 0 180 180" width="180" height="180" style="max-width:100%;height:auto;">
                            <rect width="180" height="180" fill="#ffffff" rx="8"/>
                            <rect x="15" y="15" width="45" height="45" fill="#0f172a" rx="4"/>
                            <rect x="23" y="23" width="29" height="29" fill="#ffffff" rx="2"/>
                            <rect x="29" y="29" width="17" height="17" fill="#7c3aed" rx="1"/>
                            <rect x="120" y="15" width="45" height="45" fill="#0f172a" rx="4"/>
                            <rect x="128" y="23" width="29" height="29" fill="#ffffff" rx="2"/>
                            <rect x="134" y="29" width="17" height="17" fill="#7c3aed" rx="1"/>
                            <rect x="15" y="120" width="45" height="45" fill="#0f172a" rx="4"/>
                            <rect x="23" y="128" width="29" height="29" fill="#ffffff" rx="2"/>
                            <rect x="29" y="134" width="17" height="17" fill="#7c3aed" rx="1"/>
                            <rect x="70" y="20" width="10" height="10" fill="#0f172a"/>
                            <rect x="85" y="35" width="10" height="10" fill="#7c3aed"/>
                            <rect x="100" y="20" width="10" height="10" fill="#0f172a"/>
                            <rect x="20" y="75" width="10" height="10" fill="#0f172a"/>
                            <rect x="35" y="90" width="10" height="10" fill="#7c3aed"/>
                            <rect x="75" y="70" width="30" height="30" fill="#0f172a" rx="2"/>
                            <rect x="80" y="75" width="20" height="20" fill="#7c3aed" rx="1"/>
                            <rect x="120" y="75" width="10" height="10" fill="#0f172a"/>
                            <rect x="145" y="90" width="10" height="10" fill="#0f172a"/>
                            <rect x="70" y="135" width="10" height="10" fill="#7c3aed"/>
                            <rect x="95" y="145" width="10" height="10" fill="#0f172a"/>
                            <rect x="125" y="130" width="10" height="10" fill="#0f172a"/>
                            <rect x="145" y="140" width="10" height="10" fill="#7c3aed"/>
                        </svg>
                    </div>
                </div>

                <div style="background:#f1f5f9;padding:12px 16px;border-radius:10px;margin-bottom:16px;">
                    <div style="font-size:20px;font-weight:800;color:#7c3aed;letter-spacing:0.5px;">${escapeHtml(passToken)}</div>
                    <div style="font-size:13px;font-weight:500;color:#334155;margin-top:2px;">${escapeHtml(passService)} • ${escapeHtml(passDate)}</div>
                </div>

                <button type="button" class="btn-primary" style="width:100%;padding:10px;border-radius:8px;background:#7c3aed;color:#ffffff;border:none;font-weight:600;cursor:pointer;font-size:14px;" onclick="document.getElementById('vizitorQRModal').style.display='none'" data-i18n="close">Done</button>
            </div>
        `;

        modal.style.cssText = "display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.6);z-index:1200;align-items:center;justify-content:center;backdrop-filter:blur(3px);";

        if (appointmentId) {
            apiGet(`/appointments/${encodeURIComponent(appointmentId)}/qr`).then(data => {
                if (data && data.qr_svg) {
                    const holder = document.getElementById("qrSvgHolder");
                    if (holder) {
                        holder.innerHTML = data.qr_svg;
                        const svgEl = holder.querySelector("svg");
                        if (svgEl) {
                            svgEl.setAttribute("width", "180");
                            svgEl.setAttribute("height", "180");
                            svgEl.style.maxWidth = "100%";
                            svgEl.style.height = "auto";
                        }
                    }
                }
            }).catch(() => {});
        }
    }

    window.showQRPassModal = showQRPassModal;

    // ========================================================
    // SHARED CROWD DISPLAY COMPONENT (SECTION H)
    // ========================================================

    function calculateCrowdLevel(queueSize) {
        const size = Number(queueSize) || 0;
        if (size <= 0) return "No Crowd";
        if (size <= 5) return "Low";
        if (size <= 15) return "Moderate";
        if (size <= 30) return "High";
        return "Critical";
    }

    window.calculateCrowdLevel = calculateCrowdLevel;

    function renderCrowdBadge(elementOrId, crowdLevel, queueSize) {
        const el = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
        if (!el) return;
        const level = crowdLevel || calculateCrowdLevel(queueSize || 0);
        const colorMap = {
            "No Crowd": { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
            "Low": { bg: "#ecfdf5", text: "#059669", dot: "#10b981" },
            "Moderate": { bg: "#fef3c7", text: "#d97706", dot: "#f59e0b" },
            "High": { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
            "Critical": { bg: "#fdf2f8", text: "#be185d", dot: "#ec4899" }
        };
        const c = colorMap[level] || colorMap["Low"];
        el.style.backgroundColor = c.bg;
        el.style.color = c.text;
        el.style.padding = "4px 10px";
        el.style.borderRadius = "9999px";
        el.style.fontWeight = "600";
        el.style.fontSize = "0.85rem";
        el.style.display = "inline-flex";
        el.style.alignItems = "center";
        el.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${c.dot};margin-right:6px;"></span>${escapeHtml(level)}`;
    }

    window.renderCrowdBadge = renderCrowdBadge;

    // ========================================================
    // PUBLIC API
    // ========================================================

    return {

        getAccessToken,
        requireAuthOrRedirect,
        authHeaders,
        apiGet,
        apiPost,
        apiPut,
        apiPatch,
        startSimulation,

        getCurrentUser,
        getAppointments,
        getQueueStatus,
        calculateCrowdLevel,
        renderCrowdBadge,
        showQRPassModal,

        getSimulationState,
        setSimulationState,
        clearSimulationState,
        isSimulationActive,

        buildSimulationQueueStatus,

        tokenNumber,
        tokenFromNumber,

        getNotificationEvents,
        addNotificationEvent,
        markNotificationRead,
        markAllNotificationsRead,
        startNotificationMonitor,
        showGlobalNotification,

        formatDate,
        formatTime,
        escapeHtml,
        friendlyStatusLabel,
        initials,

        wireCommonNav,
        applyAvatar
    };

})();


/* ============================================================
   GLOBAL STARTUP
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        try {

            VIZITOR.startNotificationMonitor();

        } catch (error) {

            console.error(
                "VIZITOR notification startup error:",
                error
            );
        }
    }
);