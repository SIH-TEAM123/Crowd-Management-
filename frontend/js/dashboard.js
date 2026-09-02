// Dashboard logic for VIZITOR — driven entirely by real backend
// data (auth/me, appointments, and the shared queue/status
// endpoint), so it always matches Queue, Crowd Status, Profile,
// Notifications, Reports and Analytics.

document.addEventListener("DOMContentLoaded", () => {

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
    // Welcome Banner + avatar (real user)
    // ============================================================

    async function loadWelcomeUser() {

        const user =
            await VIZITOR.getCurrentUser();

        const welcomeUserEl =
            document.getElementById(
                "welcomeUser"
            );

        if (user) {

            const firstName =
                user.full_name?.split(" ")[0] ||
                user.full_name;

            if (welcomeUserEl) {

                welcomeUserEl.textContent =
                    `Welcome back, ${firstName}.`;
            }

            VIZITOR.applyAvatar(
                user.full_name
            );
        }
    }


    // ============================================================
    // Summary cards + Service/Queue Status panel
    //
    // SINGLE SOURCE OF TRUTH:
    // VIZITOR.getQueueStatus()
    //
    // When Crowd Simulation is active, shared.js supplies the
    // simulated values automatically.
    // When simulation is inactive, real backend data is used.
    // ============================================================

    async function loadQueueDrivenUI() {

        const appointments =
            await VIZITOR.getAppointments();

        const queueStatus =
            await VIZITOR.getQueueStatus();

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        const todayAppointments =
            appointments.filter(
                a =>
                    a.status !== "CANCELLED" &&
                    a.appointment_date === today
            );


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


        // --------------------------------------------------------
        // Current Queue
        // --------------------------------------------------------

        const queueElement =
            document.getElementById(
                "dashboardQueueCount"
            );


        if (queueElement) {

            queueElement.textContent =
                queueStatus.queue_size ?? 0;
        }


        // --------------------------------------------------------
        // Estimated Waiting Time
        //
        // Real mode:
        //   user's own wait if token exists
        //   otherwise facility average
        //
        // Simulation mode:
        //   shared simulated waiting time
        // --------------------------------------------------------

        const waitMinutes =
            queueStatus.simulation_active
                ? Number(
                    queueStatus.estimated_wait_minutes ?? 0
                )
                : (
                    queueStatus.you
                        ? queueStatus.you.estimated_wait_minutes
                        : queueStatus.estimated_wait_minutes
                );


        const waitElement =
            document.getElementById(
                "dashboardWaitTime"
            );


        if (waitElement) {

            waitElement.textContent =
                waitMinutes === 0
                    ? "0 min"
                    : `${waitMinutes} min`;
        }


        // --------------------------------------------------------
        // Crowd Level
        // --------------------------------------------------------

        const crowdLevelElement =
            document.getElementById(
                "dashboardCrowdLevel"
            );


        if (crowdLevelElement) {

            crowdLevelElement.textContent =
                queueStatus.crowd_level ||
                "Low";
        }


        // --------------------------------------------------------
        // Service / Queue Status panel
        // --------------------------------------------------------

        const currentServingEl =
            document.getElementById(
                "svcCurrentServingToken"
            );


        if (currentServingEl) {

            currentServingEl.textContent =
                queueStatus.currently_serving_token ||
                "--";
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


        // --------------------------------------------------------
        // SIMULATION MODE
        //
        // The simulation uses a synthetic token SIM-001.
        // Real appointment/token logic is not changed.
        // --------------------------------------------------------

        if (queueStatus.simulation_active) {

            if (yourTokenStatusEl) {

                yourTokenStatusEl.textContent =
                    "Simulation";
            }


            if (yourTokenNumberEl) {

                yourTokenNumberEl.textContent =
                    queueStatus.currently_serving_token ||
                    "SIM-001";
            }


            if (peopleAheadEl) {

                peopleAheadEl.textContent =
                    `${queueStatus.queue_size ?? 0} people`;
            }

        }

        // --------------------------------------------------------
        // REAL BACKEND MODE
        // --------------------------------------------------------

        else if (queueStatus.you) {

            if (yourTokenStatusEl) {

                yourTokenStatusEl.textContent =
                    VIZITOR.friendlyStatusLabel(
                        queueStatus.you.status
                    );
            }


            if (yourTokenNumberEl) {

                yourTokenNumberEl.textContent =
                    queueStatus.you.token_display;
            }


            if (peopleAheadEl) {

                peopleAheadEl.textContent =
                    `${queueStatus.you.people_ahead} people`;
            }

        }

        else {

            if (yourTokenStatusEl) {

                yourTokenStatusEl.textContent =
                    "No Token";
            }


            if (yourTokenNumberEl) {

                yourTokenNumberEl.textContent =
                    "--";
            }


            if (peopleAheadEl) {

                peopleAheadEl.textContent =
                    "0 people";
            }
        }
    }


    // ============================================================
    // Load Upcoming Appointment
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


        const appointments =
            await VIZITOR.getAppointments();


        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        const upcomingAppointments =
            appointments
                .filter(
                    a =>
                        a.status !== "CANCELLED" &&
                        a.appointment_date >= today
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
                );


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
            appointment.purpose;

        statusElement.textContent =
            appointment.status;

        infoElement.textContent =
            `Token: ${
                appointment.token_display ||
                appointment.token_id
            }`;

        dateElement.textContent =
            VIZITOR.formatDate(
                appointment.appointment_date
            );

        timeElement.textContent =
            VIZITOR.formatTime(
                appointment.appointment_time
            );
    }


    // ============================================================
    // Recent Activity
    // (built from real appointment history)
    // ============================================================

    async function loadRecentActivity() {

        const list =
            document.getElementById(
                "recentActivityList"
            );


        if (!list) {
            return;
        }


        const appointments =
            await VIZITOR.getAppointments();


        if (appointments.length === 0) {

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
                    b.appointment_id -
                    a.appointment_id
            );


        list.innerHTML =
            sorted
                .slice(0, 3)
                .map(
                    appointment => {

                        const cls =
                            appointment.status === "CANCELLED"
                                ? "neutral"
                                : "active";


                        const label =
                            appointment.status === "CANCELLED"
                                ? "Appointment cancelled"
                                : "Appointment booked";


                        return `
                            <div class="activity-item ${cls}">
                                <strong>${label}</strong>
                                for ${VIZITOR.escapeHtml(
                                    appointment.purpose
                                )}
                                (Token ${VIZITOR.escapeHtml(
                                    appointment.token_display || ""
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
    }


    // ============================================================
    // Load Dashboard Data
    // ============================================================

    loadWelcomeUser();

    loadQueueDrivenUI();

    loadUpcomingAppointment();

    loadRecentActivity();


    // Keep the dashboard live.
    // During simulation, getQueueStatus() receives the shared
    // simulation state. After Refresh Status, it automatically
    // returns to real backend data.
    setInterval(
        loadQueueDrivenUI,
        30000
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


    console.log(
        "dashboard.js loaded successfully."
    );
});