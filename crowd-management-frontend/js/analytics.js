// Analytics page logic for Crowd Management UI
// Uses the same appointment data source as dashboard.js

document.addEventListener("DOMContentLoaded", () => {

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

            const data = await response.json();

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
    // Load Analytics
    // ============================================================

    async function loadAnalytics() {

        const appointments =
            await getAppointments();

        const today =
            new Date().toISOString().split("T")[0];


        // ========================================================
        // Same logic as Dashboard:
        // Today's non-cancelled appointments
        // ========================================================

        const todayAppointments =
            appointments.filter(
                appointment =>
                    appointment.status !== "CANCELLED" &&
                    appointment.appointment_date === today
            );


        // ========================================================
        // Upcoming active appointments
        // ========================================================

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
        // Current Queue
        //
        // Temporary frontend estimate based on active appointments.
        // Later this can be replaced with Person 2/ML queue data.
        // ========================================================

        const queueCount =
            upcomingAppointments.length;

        const queueElement =
            document.getElementById(
                "analyticsQueueCount"
            );

        if (queueElement) {
            queueElement.textContent =
                queueCount;
        }


        // ========================================================
        // Today's Appointments
        //
        // EXACT same calculation as dashboard.js
        // ========================================================

        const todayElement =
            document.getElementById(
                "analyticsTodayAppointments"
            );

        if (todayElement) {
            todayElement.textContent =
                todayAppointments.length;
        }


        // ========================================================
        // Estimated Wait Time
        //
        // Temporary estimate: 5 minutes per active queue position.
        // ========================================================

        const estimatedWaitMinutes =
            queueCount * 5;

        const waitElement =
            document.getElementById(
                "analyticsWaitTime"
            );

        if (waitElement) {

            waitElement.textContent =
                queueCount === 0
                    ? "0 min"
                    : `${estimatedWaitMinutes} min`;
        }


        // ========================================================
        // Crowd Level
        //
        // Based on the same active queue count.
        // ========================================================

        let crowdLevel;
        let crowdDescription;

        if (queueCount === 0) {

            crowdLevel = "No Crowd";

            crowdDescription =
                "There are currently no active upcoming appointments.";

        } else if (queueCount <= 5) {

            crowdLevel = "Low";

            crowdDescription =
                "Crowd levels are currently low. " +
                "Service counters should operate normally.";

        } else if (queueCount <= 15) {

            crowdLevel = "Moderate";

            crowdDescription =
                "Crowd levels are moderate. " +
                "Normal queue monitoring is recommended.";

        } else {

            crowdLevel = "High";

            crowdDescription =
                "Crowd levels are high. " +
                "Additional crowd management may be required.";
        }


        const crowdLevelElement =
            document.getElementById(
                "analyticsCrowdLevel"
            );

        if (crowdLevelElement) {
            crowdLevelElement.textContent =
                crowdLevel;
        }


        // ========================================================
        // Crowd Overview
        // ========================================================

        const crowdStatusElement =
            document.getElementById(
                "analyticsCrowdStatus"
            );

        const crowdDescriptionElement =
            document.getElementById(
                "analyticsCrowdDescription"
            );

        if (crowdStatusElement) {
            crowdStatusElement.textContent =
                `${crowdLevel} Crowd Level`;
        }

        if (crowdDescriptionElement) {
            crowdDescriptionElement.textContent =
                crowdDescription;
        }


        // ========================================================
        // Debug
        // ========================================================

        console.log(
            "Analytics loaded successfully:",
            {
                totalAppointments:
                    appointments.length,

                todayAppointments:
                    todayAppointments.length,

                upcomingAppointments:
                    queueCount,

                estimatedWaitMinutes:
                    estimatedWaitMinutes,

                crowdLevel:
                    crowdLevel
            }
        );
    }


    // ============================================================
    // Navigation
    // ============================================================

    const profileBadge =
        document.querySelector(".profile-badge");

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
    // Start
    // ============================================================

    loadAnalytics();

});