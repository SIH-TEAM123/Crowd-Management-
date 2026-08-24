// Analytics page — connected to real backend dashboard data

document.addEventListener("DOMContentLoaded", () => {

    async function loadAnalytics() {

        const accessToken =
            localStorage.getItem("access_token");

        if (!accessToken) {
            console.warn("No access token found.");
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/appointments/dashboard`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                console.error(
                    "Failed to load analytics:",
                    data
                );
                return;
            }

            console.log(
                "Analytics backend data:",
                data
            );

            // Today's appointments
            const todayElement =
                document.getElementById(
                    "analyticsTodayAppointments"
                );

            if (todayElement) {
                todayElement.textContent =
                    data.today_appointments ?? 0;
            }


            // Current queue
            const queueElement =
                document.getElementById(
                    "analyticsQueueCount"
                );

            if (queueElement) {
                queueElement.textContent =
                    data.current_queue ?? 0;
            }


            // Estimated wait time
            const waitElement =
                document.getElementById(
                    "analyticsWaitTime"
                );

            if (waitElement) {
                waitElement.textContent =
                    `${data.estimated_wait_minutes ?? 0} min`;
            }


            // Crowd level
            const crowdLevel =
                data.crowd_level || "No Crowd";

            const crowdLevelElement =
                document.getElementById(
                    "analyticsCrowdLevel"
                );

            if (crowdLevelElement) {
                crowdLevelElement.textContent =
                    crowdLevel;
            }


            // Crowd description
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

                const queue =
                    data.current_queue ?? 0;

                const wait =
                    data.estimated_wait_minutes ?? 0;

                const serving =
                    data.currently_serving || "None";

                crowdDescriptionElement.textContent =
                    `There are currently ${queue} people waiting. ` +
                    `Token ${serving} is currently being served. ` +
                    `Estimated waiting time is ${wait} minutes.`;
            }


        } catch (error) {

            console.error(
                "Error loading analytics:",
                error
            );
        }
    }


    // Navigation

    const profileBadge =
        document.querySelector(".profile-badge");

    if (profileBadge) {

        profileBadge.style.cursor = "pointer";

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


    // Start
    loadAnalytics();

});