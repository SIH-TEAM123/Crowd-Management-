// ============================================================
// VIZITOR — Dashboard
//
// SINGLE QUEUE SOURCE:
//     VIZITOR.getQueueStatus()
//
// Real mode:
//     Uses backend appointment/queue data.
//
// Simulation mode:
//     Uses the shared simulation state from shared.js.
//
// IMPORTANT:
//     currently_serving_token = currently served token
//     user_simulated_token    = simulated user's token
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    VIZITOR.requireAuthOrRedirect();
    VIZITOR.wireCommonNav();


    // ============================================================
    // Dynamic Date and Time
    // ============================================================

    const dateTimeElement =
        document.getElementById("currentDateTime");


    function updateDateTime() {

        const now = new Date();

        const dateStr =
            now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric"
            });

        const timeStr =
            now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });

        if (dateTimeElement) {

            dateTimeElement.textContent =
                `${dateStr} • ${timeStr}`;
        }
    }


    updateDateTime();

    setInterval(
        updateDateTime,
        1000
    );


    // ============================================================
    // Welcome Banner + Avatar
    // ============================================================

    async function loadWelcomeUser() {

        try {

            const user =
                await VIZITOR.getCurrentUser();


            const welcomeUserEl =
                document.getElementById(
                    "welcomeUser"
                );


            if (!user) {
                return;
            }


            const fullName =
                user.full_name ||
                user.name ||
                user.username ||
                "";


            const firstName =
                fullName
                    .trim()
                    .split(/\s+/)[0] ||
                fullName;


            if (
                welcomeUserEl &&
                firstName
            ) {

                welcomeUserEl.textContent =
                    `Welcome back, ${firstName}.`;
            }


            if (
                typeof VIZITOR.applyAvatar ===
                "function"
            ) {

                VIZITOR.applyAvatar(
                    fullName
                );
            }


        } catch (error) {

            console.error(
                "Dashboard user loading error:",
                error
            );
        }
    }


    // ============================================================
    // Queue / Summary UI
    //
    // SINGLE SOURCE OF TRUTH:
    //     VIZITOR.getQueueStatus()
    //
    // Simulation-aware through shared.js.
    // ============================================================

    async function loadQueueDrivenUI() {

        try {

            const appointments =
                await VIZITOR.getAppointments();


            const queueStatus =
                await VIZITOR.getQueueStatus();


            const nowD = new Date();
            const today = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}-${String(nowD.getDate()).padStart(2, "0")}`;
            const todayUtc = nowD.toISOString().split("T")[0];

            const todayAppointments =
                Array.isArray(appointments)
                    ? appointments.filter(
                        appointment =>
                            appointment.status !== "CANCELLED" &&
                            (appointment.appointment_date === today || appointment.appointment_date === todayUtc)
                    )
                    : [];

            const appointmentCounter =
                document.getElementById(
                    "todayAppointments"
                );

            if (appointmentCounter) {
                appointmentCounter.textContent =
                    todayAppointments.length;
            }


            if (!queueStatus) {
                return;
            }


            const simulationActive =
                queueStatus.simulation_active === true;


            // ----------------------------------------------------
            // Current Queue
            // ----------------------------------------------------

            const queueElement =
                document.getElementById(
                    "dashboardQueueCount"
                );


            if (queueElement) {

                queueElement.textContent =
                    queueStatus.queue_size ?? 0;
            }


            // ----------------------------------------------------
            // Estimated Waiting Time
            // ----------------------------------------------------

            const waitMinutes =
                simulationActive
                    ? Number(
                        queueStatus.estimated_wait_minutes ?? 0
                    )
                    : (
                        queueStatus.you
                            ? Number(
                                queueStatus.you.estimated_wait_minutes ?? 0
                            )
                            : Number(
                                queueStatus.estimated_wait_minutes ?? 0
                            )
                    );


            const waitElement =
                document.getElementById(
                    "dashboardWaitTime"
                );


            if (waitElement) {

                if (
                    Number.isFinite(waitMinutes)
                ) {

                    waitElement.textContent =
                        `${Math.max(
                            0,
                            Math.ceil(waitMinutes)
                        )} min`;

                } else {

                    waitElement.textContent =
                        "--";
                }
            }


            // ----------------------------------------------------
            // Crowd Level
            // ----------------------------------------------------

            const crowdLevelElement =
                document.getElementById(
                    "dashboardCrowdLevel"
                );


            if (crowdLevelElement) {
                if (typeof VIZITOR !== "undefined" && typeof VIZITOR.renderCrowdBadge === "function") {
                    VIZITOR.renderCrowdBadge(crowdLevelElement, queueStatus.crowd_level, queueStatus.queue_size);
                } else {
                    crowdLevelElement.textContent = queueStatus.crowd_level || "Unknown";
                }
            }


            // ----------------------------------------------------
            // Service / Queue Status
            // ----------------------------------------------------

            const currentServingEl =
                document.getElementById(
                    "svcCurrentServingToken"
                );

            if (currentServingEl) {
                currentServingEl.textContent =
                    queueStatus.currently_serving_token ||
                    (queueStatus.queue_size > 0 ? "A-114" : "--");
            }

            const yourTokenStatusEl =
                document.getElementById(
                    "svcYourTokenStatus"
                );

            const yourTokenNumberEl =
                document.getElementById(
                    "svcYourTokenNumber"
                );

            const peopleAheadEl =
                document.getElementById(
                    "svcPeopleAhead"
                );

            // ----------------------------------------------------
            // SIMULATION MODE
            // ----------------------------------------------------
            if (simulationActive) {
                const simulatedUserToken =
                    queueStatus.user_simulated_token ||
                    queueStatus.you?.token_display ||
                    "--";

                const simulatedPeopleAhead =
                    Number(
                        queueStatus.you?.people_ahead ??
                        queueStatus.queue_size ??
                        0
                    );

                if (yourTokenStatusEl) {
                    yourTokenStatusEl.textContent =
                        queueStatus.you?.status === "BEING_SERVED"
                            ? "Your Turn"
                            : (queueStatus.you?.status === "SERVED"
                                ? "Served"
                                : "Simulation");
                }

                if (yourTokenNumberEl) {
                    yourTokenNumberEl.textContent = simulatedUserToken;
                }

                if (peopleAheadEl) {
                    peopleAheadEl.textContent = `${Math.max(0, simulatedPeopleAhead)} people`;
                }
            }
            // ----------------------------------------------------
            // REAL BACKEND MODE
            // ----------------------------------------------------
            else if (queueStatus.you) {
                if (yourTokenStatusEl) {
                    yourTokenStatusEl.textContent =
                        queueStatus.you.status === "BEING_SERVED"
                            ? "Your Turn"
                            : (typeof VIZITOR.friendlyStatusLabel === "function"
                                ? VIZITOR.friendlyStatusLabel(queueStatus.you.status)
                                : (queueStatus.you.status || "Waiting"));
                }

                if (yourTokenNumberEl) {
                    yourTokenNumberEl.textContent =
                        queueStatus.you.token_display || "--";
                }

                if (peopleAheadEl) {
                    peopleAheadEl.textContent =
                        `${Number(queueStatus.you.people_ahead ?? 0)} people`;
                }
            }
            // ----------------------------------------------------
            // FALLBACK TO USER APPOINTMENT
            // ----------------------------------------------------
            else {
                const activeAppt = Array.isArray(appointments)
                    ? appointments.find(a => a.status !== "CANCELLED" && a.status !== "COMPLETED")
                    : null;

                if (activeAppt) {
                    if (yourTokenStatusEl) {
                        yourTokenStatusEl.textContent =
                            activeAppt.status === "BEING_SERVED"
                                ? "Your Turn"
                                : (typeof VIZITOR.friendlyStatusLabel === "function"
                                    ? VIZITOR.friendlyStatusLabel(activeAppt.status)
                                    : (activeAppt.status || "In Queue"));
                    }
                    if (yourTokenNumberEl) {
                        yourTokenNumberEl.textContent =
                            activeAppt.token_display ||
                            (activeAppt.token_numeric ? `A-${activeAppt.token_numeric}` : "--");
                    }
                    if (peopleAheadEl) {
                        peopleAheadEl.textContent = "In Queue";
                    }
                } else {
                    if (yourTokenStatusEl) {
                        yourTokenStatusEl.textContent = "No Token";
                    }
                    if (yourTokenNumberEl) {
                        yourTokenNumberEl.textContent = "--";
                    }
                    if (peopleAheadEl) {
                        peopleAheadEl.textContent = "0 people";
                    }
                }
            }


            console.log(
                "DASHBOARD LIVE QUEUE:",
                {
                    simulation_active:
                        simulationActive,

                    currently_serving_token:
                        queueStatus.currently_serving_token,

                    user_token:
                        simulationActive
                            ? queueStatus.user_simulated_token
                            : queueStatus.you?.token_display,

                    people_ahead:
                        simulationActive
                            ? queueStatus.you?.people_ahead ??
                              queueStatus.queue_size
                            : queueStatus.you?.people_ahead,

                    wait_minutes:
                        waitMinutes,

                    crowd_level:
                        queueStatus.crowd_level
                }
            );


        } catch (error) {

            console.error(
                "Dashboard queue loading error:",
                error
            );
        }
    }


    // ============================================================
    // Upcoming Appointment
    // ============================================================

    async function loadUpcomingAppointment() {

        const purposeElement =
            document.getElementById(
                "upcomingAppointmentPurpose"
            );

        const statusElement =
            document.getElementById(
                "upcomingAppointmentStatus"
            );

        const infoElement =
            document.getElementById(
                "upcomingAppointmentInfo"
            );

        const dateElement =
            document.getElementById(
                "upcomingAppointmentDate"
            );

        const timeElement =
            document.getElementById(
                "upcomingAppointmentTime"
            );


        if (
            !purposeElement ||
            !statusElement ||
            !infoElement ||
            !dateElement ||
            !timeElement
        ) {

            return;
        }


        try {

            const appointments =
                await VIZITOR.getAppointments();


            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];


            const upcomingAppointments =
                Array.isArray(appointments)
                    ? appointments
                        .filter(
                            appointment =>
                                appointment.status !== "CANCELLED" &&
                                appointment.appointment_date >= today
                        )
                        .sort(
                            (a, b) => {

                                const first =
                                    `${a.appointment_date}T${a.appointment_time}`;

                                const second =
                                    `${b.appointment_date}T${b.appointment_time}`;

                                return first.localeCompare(
                                    second
                                );
                            }
                        )
                    : [];


            if (
                upcomingAppointments.length === 0
            ) {

                purposeElement.textContent =
                    "No upcoming appointment";

                statusElement.textContent =
                    "--";

                infoElement.textContent =
                    "You currently have no upcoming appointments.";

                dateElement.textContent =
                    "--";

                timeElement.textContent =
                    "--";

                return;
            }


            const appointment =
                upcomingAppointments[0];


            purposeElement.textContent =
                appointment.purpose ||
                "Appointment";


            statusElement.textContent =
                appointment.status ||
                "--";


            infoElement.textContent =
                `Token: ${
                    appointment.token_display ||
                    appointment.token_id ||
                    "--"
                }`;


            dateElement.textContent =
                typeof VIZITOR.formatDate ===
                "function"
                    ? VIZITOR.formatDate(
                        appointment.appointment_date
                    )
                    : appointment.appointment_date;


            timeElement.textContent =
                typeof VIZITOR.formatTime ===
                "function"
                    ? VIZITOR.formatTime(
                        appointment.appointment_time
                    )
                    : appointment.appointment_time;


        } catch (error) {

            console.error(
                "Upcoming appointment loading error:",
                error
            );
        }
    }


    // ============================================================
    // Recent Activity
    // ============================================================

    async function loadRecentActivity() {

        const list =
            document.getElementById(
                "recentActivityList"
            );


        if (!list) {
            return;
        }


        try {

            const appointments =
                await VIZITOR.getAppointments();


            if (
                !Array.isArray(appointments) ||
                appointments.length === 0
            ) {

                list.innerHTML = `
                    <div class="activity-item neutral">
                        No activity yet — book your first appointment to get started.
                    </div>
                `;

                return;
            }


            const sorted =
                [...appointments].sort(
                    (a, b) =>
                        Number(b.appointment_id || 0) -
                        Number(a.appointment_id || 0)
                );


            list.innerHTML =
                sorted
                    .slice(0, 3)
                    .map(
                        appointment => {

                            const cancelled =
                                appointment.status ===
                                "CANCELLED";


                            const cls =
                                cancelled
                                    ? "neutral"
                                    : "active";


                            const label =
                                cancelled
                                    ? "Appointment cancelled"
                                    : "Appointment booked";


                            return `
                                <div class="activity-item ${cls}">
                                    <strong>${label}</strong>
                                    for ${VIZITOR.escapeHtml(
                                        appointment.purpose ||
                                        "appointment"
                                    )}
                                    (Token ${VIZITOR.escapeHtml(
                                        appointment.token_display ||
                                        ""
                                    )}).
                                    <span class="time">
                                        ${VIZITOR.formatDate(
                                            appointment.appointment_date
                                        )}
                                    </span>
                                </div>
                            `;
                        }
                    )
                    .join("");


        } catch (error) {

            console.error(
                "Recent activity loading error:",
                error
            );
        }
    }


    // ============================================================
    // Initial Loads
    // ============================================================

    loadWelcomeUser();

    loadQueueDrivenUI();

    loadUpcomingAppointment();

    loadRecentActivity();


    // ============================================================
    // LIVE DASHBOARD REFRESH
    // ============================================================

    setInterval(
        loadQueueDrivenUI,
        5000
    );


    setInterval(
        loadUpcomingAppointment,
        15000
    );


    // ============================================================
    // Export Statistics
    // ============================================================

    const exportBtn =
        document.getElementById(
            "btnExport"
        );


    if (exportBtn) {

        exportBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    "reports.html";
            }
        );
    }


    // ============================================================
    // Book Appointment
    // ============================================================

    const bookApptHeaderBtn =
        document.getElementById(
            "btnCreateAppt"
        );


    if (bookApptHeaderBtn) {

        bookApptHeaderBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    "appointments.html";
            }
        );
    }


    // ============================================================
    // Simulation Events
    // ============================================================

    window.addEventListener(
        "vizitorSimulationUpdated",
        () => {

            loadQueueDrivenUI();
        }
    );


    window.addEventListener(
        "vizitorSimulationCleared",
        () => {

            loadQueueDrivenUI();
        }
    );


    window.addEventListener(
        "vizitor:appointment-changed",
        () => {

            loadQueueDrivenUI();

            loadUpcomingAppointment();

            loadRecentActivity();
        }
    );


    console.log(
        "dashboard.js loaded successfully."
    );

});