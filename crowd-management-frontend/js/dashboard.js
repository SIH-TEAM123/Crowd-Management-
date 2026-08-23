// Dashboard logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    // 0. Welcome Banner
    // ============================================================

    const welcomeUserEl = document.getElementById("welcomeUser");
    const storedEmail = localStorage.getItem("userEmail");

    if (welcomeUserEl && storedEmail) {
        const username = storedEmail.split("@")[0];

        const formattedName =
            username.charAt(0).toUpperCase() +
            username.slice(1);

        welcomeUserEl.textContent =
            `Welcome back, ${formattedName}.`;
    }


    // ============================================================
    // 1. Dynamic Date and Time
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
    // Helper: Get authenticated appointments
    // ============================================================

    async function getAppointments() {

        const accessToken =
            localStorage.getItem("access_token");

        if (!accessToken) {
            console.warn("No access token found.");
            return [];
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/appointments`,
                {
                    method: "GET",
                    headers: {
                        "Authorization":
                            `Bearer ${accessToken}`
                    }
                }
            );

            const data =
                await response.json();

            if (!response.ok) {

                console.error(
                    "Failed to load appointments:",
                    data
                );

                return [];
            }

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            console.error(
                "Error loading appointments:",
                error
            );

            return [];
        }
    }


    // ============================================================
    // Helper: Format Date
    // ============================================================

    function formatDate(dateString) {

        if (!dateString) {
            return "--";
        }

        const date =
            new Date(
                `${dateString}T00:00:00`
            );

        return date.toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );
    }


    // ============================================================
    // Helper: Format Time
    // ============================================================

    function formatTime(timeString) {

        if (!timeString) {
            return "--";
        }

        const cleanTime =
            timeString.split(".")[0];

        const parts =
            cleanTime.split(":");

        const hours =
            Number(parts[0]);

        const minutes =
            Number(parts[1]);

        const date =
            new Date();

        date.setHours(hours);
        date.setMinutes(minutes);
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


    // ============================================================
    // Load ALL Dashboard Statistics
    // Same logic used by Analytics
    // ============================================================

    async function loadDashboardStatistics() {

        const appointments =
            await getAppointments();

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        // --------------------------------------------------------
        // Today's active appointments
        // --------------------------------------------------------

        const todayAppointments =
            appointments.filter(
                appointment =>
                    appointment.status !== "CANCELLED" &&
                    appointment.appointment_date === today
            );


        // --------------------------------------------------------
        // Upcoming active appointments
        // --------------------------------------------------------

        const upcomingAppointments =
            appointments
                .filter(
                    appointment =>
                        appointment.status !== "CANCELLED" &&
                        appointment.appointment_date >= today
                )
                .sort((a, b) => {

                    const first =
                        `${a.appointment_date}T${a.appointment_time}`;

                    const second =
                        `${b.appointment_date}T${b.appointment_time}`;

                    return first.localeCompare(second);
                });


        // ========================================================
        // Today's Appointments
        // ========================================================

        const appointmentCounter =
            document.getElementById(
                "todayAppointments"
            );

        if (appointmentCounter) {

            appointmentCounter.textContent =
                todayAppointments.length;
        }


        // ========================================================
        // Current Queue
        // ========================================================

        const queueCount =
            upcomingAppointments.length;

        const queueElement =
            document.getElementById(
                "dashboardQueueCount"
            );

        if (queueElement) {

            queueElement.textContent =
                queueCount;
        }


        // ========================================================
        // Estimated Waiting Time
        // ========================================================

        const estimatedWaitMinutes =
            queueCount * 5;

        const waitElement =
            document.getElementById(
                "dashboardWaitTime"
            );

        if (waitElement) {

            waitElement.textContent =
                queueCount === 0
                    ? "0 min"
                    : `${estimatedWaitMinutes} min`;
        }


        // ========================================================
        // Crowd Level
        // ========================================================

        let crowdLevel;

        if (queueCount === 0) {

            crowdLevel =
                "No Crowd";

        } else if (queueCount <= 5) {

            crowdLevel =
                "Low";

        } else if (queueCount <= 15) {

            crowdLevel =
                "Moderate";

        } else {

            crowdLevel =
                "High";
        }


        const crowdLevelElement =
            document.getElementById(
                "dashboardCrowdLevel"
            );

        if (crowdLevelElement) {

            crowdLevelElement.textContent =
                crowdLevel;
        }


        console.log(
            "Dashboard statistics loaded:",
            {
                todayAppointments:
                    todayAppointments.length,

                currentQueue:
                    queueCount,

                estimatedWait:
                    estimatedWaitMinutes,

                crowdLevel:
                    crowdLevel
            }
        );
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

            console.warn(
                "Upcoming appointment elements not found."
            );

            return;
        }

        const appointments =
            await getAppointments();

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        const upcomingAppointments =
            appointments
                .filter(
                    appointment =>
                        appointment.status !== "CANCELLED" &&
                        appointment.appointment_date >= today
                )
                .sort((a, b) => {

                    const first =
                        `${a.appointment_date}T${a.appointment_time}`;

                    const second =
                        `${b.appointment_date}T${b.appointment_time}`;

                    return first.localeCompare(second);
                });


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
            `Token: ${appointment.token_id}`;

        dateElement.textContent =
            formatDate(
                appointment.appointment_date
            );

        timeElement.textContent =
            formatTime(
                appointment.appointment_time
            );
    }


    // ============================================================
    // Load Dashboard Data
    // ============================================================

    loadDashboardStatistics();

    loadUpcomingAppointment();


    // ============================================================
    // Export Statistics
    // ============================================================

    const exportBtn =
        document.getElementById("btnExport");

    if (exportBtn) {

        exportBtn.addEventListener(
            "click",
            () => {

                alert(
                    "Export Stats will be connected to the analytics backend next."
                );
            }
        );
    }


    // ============================================================
    // Book Appointment
    // ============================================================

    const bookApptHeaderBtn =
        document.getElementById("btnCreateAppt");

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
    // Profile Navigation
    // ============================================================

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


    // ============================================================
    // Notifications Navigation
    // ============================================================

    const notifBtn =
        document.querySelector(
            '.icon-btn[title="View alerts"], ' +
            '.icon-btn[title="Notifications"]'
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


    // ============================================================
    // Logout
    // ============================================================

    const logoutLinks =
        document.querySelectorAll(
            ".sidebar-footer a, #btnLogout"
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
                }
            );
        }
    );


    console.log(
        "dashboard.js loaded successfully."
    );

});