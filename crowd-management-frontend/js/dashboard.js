// ============================================================
// VIZITOR CROWD - LIVE DASHBOARD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("dashboard.js started");

    // ============================================================
    // HELPER
    // ============================================================

    function setText(id, value) {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }


    // ============================================================
    // DATE AND TIME
    // ============================================================

    function updateDateTime() {

        const element =
            document.getElementById("currentDateTime");

        if (!element) return;

        const now = new Date();

        const dateText =
            now.toLocaleDateString(
                "en-US",
                {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                }
            );

        const timeText =
            now.toLocaleTimeString(
                "en-US",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        element.textContent =
            `${dateText} • ${timeText}`;
    }

    updateDateTime();

    setInterval(
        updateDateTime,
        1000
    );


    // ============================================================
    // CROWD BAR
    // ============================================================

    function updateCrowdBar(crowdLevel) {

        const bar =
            document.getElementById(
                "dashboardCrowdBar"
            );

        if (!bar) return;

        const level =
            String(crowdLevel || "No Crowd")
                .trim()
                .toLowerCase();

        let width = 0;

        if (level === "low") {
            width = 25;
        }

        else if (level === "moderate") {
            width = 55;
        }

        else if (level === "high") {
            width = 85;
        }

        bar.style.width =
            `${width}%`;
    }


    // ============================================================
    // UPDATE ALL PEOPLE AHEAD DISPLAYS
    // ============================================================

    function updatePeopleAhead(value) {

        const peopleAhead =
            Math.max(
                0,
                Number(value) || 0
            );

        // Number-only displays
        const numberIds = [

            "dashboardPeopleAhead",
            "peopleAhead",
            "peopleAheadCount",
            "dashboardAheadCount"

        ];

        numberIds.forEach(id => {

            const element =
                document.getElementById(id);

            if (element) {

                element.textContent =
                    peopleAhead;

            }

        });


        // Displays containing "people"
        const textIds = [

            "dashboardPeopleAheadText",
            "peopleAheadText",
            "totalPeopleAhead",
            "peopleInFront"

        ];

        textIds.forEach(id => {

            const element =
                document.getElementById(id);

            if (element) {

                element.textContent =
                    `${peopleAhead} people`;

            }

        });

    }


    // ============================================================
    // LOAD DASHBOARD
    // ============================================================

    async function loadDashboard() {

        const accessToken =
            localStorage.getItem(
                "access_token"
            );

        if (!accessToken) {

            console.warn(
                "Dashboard: no access token"
            );

            return;

        }

        try {

            console.log(
                "Loading live dashboard..."
            );

            const response =
                await fetch(
                    `${API_BASE_URL}/appointments/dashboard`,
                    {
                        method: "GET",

                        headers: {

                            "Authorization":
                                `Bearer ${accessToken}`

                        }

                    }
                );


            let data;

            try {

                data =
                    await response.json();

            }

            catch {

                throw new Error(
                    "Backend returned invalid JSON"
                );

            }


            console.log(
                "DASHBOARD API RESPONSE:",
                data
            );


            if (!response.ok) {

                console.error(
                    "Dashboard backend error:",
                    data
                );

                return;

            }


            // ====================================================
            // TODAY'S APPOINTMENTS
            // ====================================================

            const todayAppointments =
                Math.max(
                    0,
                    Number(
                        data.today_appointments
                    ) || 0
                );

            setText(
                "todayAppointments",
                todayAppointments
            );


            // ====================================================
            // CURRENT QUEUE
            // ====================================================

            const currentQueue =
                Math.max(
                    0,
                    Number(
                        data.current_queue
                    ) || 0
                );

            setText(
                "dashboardQueueCount",
                currentQueue
            );


            // ====================================================
            // WAIT TIME
            // ====================================================

            const waitMinutes =
                Math.max(
                    0,
                    Number(
                        data.estimated_wait_minutes
                    ) || 0
                );

            setText(
                "dashboardWaitTime",
                `${waitMinutes} min`
            );


            // ====================================================
            // CROWD LEVEL
            // ====================================================

            const crowdLevel =
                data.crowd_level ||
                "No Crowd";

            setText(
                "dashboardCrowdLevel",
                crowdLevel
            );

            updateCrowdBar(
                crowdLevel
            );


            // ====================================================
            // CURRENTLY SERVING
            // ====================================================

            const currentlyServing =
                data.currently_serving ||
                "--";

            setText(
                "currentlyServing",
                currentlyServing
            );


            // ====================================================
            // YOUR TOKEN
            // ====================================================

            const yourToken =
                data.your_token ||
                "--";

            setText(
                "dashboardYourToken",
                yourToken
            );


            // ====================================================
            // PEOPLE AHEAD
            // ====================================================

            const peopleAhead =
                Math.max(
                    0,
                    Number(
                        data.people_ahead
                    ) || 0
                );

            updatePeopleAhead(
                peopleAhead
            );


            console.log(
                "Dashboard updated successfully",
                {
                    todayAppointments,
                    currentQueue,
                    waitMinutes,
                    crowdLevel,
                    currentlyServing,
                    yourToken,
                    peopleAhead
                }
            );


            // ====================================================
            // UPDATE UPCOMING APPOINTMENT
            // ====================================================

            await loadUpcomingAppointment();

        }

        catch (error) {

            console.error(
                "Dashboard loading failed:",
                error
            );

        }

    }


    // ============================================================
    // UPCOMING APPOINTMENT
    // ============================================================

    async function loadUpcomingAppointment() {

        const accessToken =
            localStorage.getItem(
                "access_token"
            );

        if (!accessToken) return;

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/appointments`,
                    {
                        headers: {

                            "Authorization":
                                `Bearer ${accessToken}`

                        }
                    }
                );

            const appointments =
                await response.json();

            if (
                !response.ok ||
                !Array.isArray(
                    appointments
                )
            ) {

                return;

            }


            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];


            const upcoming =
                appointments
                    .filter(
                        appointment =>

                            appointment.status !==
                                "CANCELLED" &&

                            appointment.appointment_date >=
                                today
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
                upcoming.length === 0
            ) {

                setText(
                    "upcomingAppointmentPurpose",
                    "No upcoming appointment"
                );

                setText(
                    "upcomingAppointmentStatus",
                    "--"
                );

                setText(
                    "upcomingAppointmentInfo",
                    "You currently have no upcoming appointments."
                );

                setText(
                    "upcomingAppointmentDate",
                    "--"
                );

                setText(
                    "upcomingAppointmentTime",
                    "--"
                );

                return;

            }


            const appointment =
                upcoming[0];


            setText(
                "upcomingAppointmentPurpose",
                appointment.purpose
            );

            setText(
                "upcomingAppointmentStatus",
                appointment.status
            );

            setText(
                "upcomingAppointmentInfo",
                `Token: ${appointment.display_token || "--"}`
            );

            setText(
                "upcomingAppointmentDate",
                appointment.appointment_date
            );

            setText(
                "upcomingAppointmentTime",
                appointment.appointment_time
            );

        }

        catch (error) {

            console.error(
                "Upcoming appointment failed:",
                error
            );

        }

    }


    // ============================================================
    // BUTTONS
    // ============================================================

    const createButton =
        document.getElementById(
            "btnCreateAppt"
        );

    if (createButton) {

        createButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    "appointments.html";

            }
        );

    }


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


    const notificationButton =
        document.querySelector(
            '.icon-btn[title="View alerts"], ' +
            '.icon-btn[title="Notifications"]'
        );

    if (notificationButton) {

        notificationButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    "notifications.html";

            }
        );

    }


    // ============================================================
    // LOGOUT
    // ============================================================

    document
        .querySelectorAll(
            ".sidebar-footer a, #btnLogout"
        )
        .forEach(
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


    // ============================================================
    // INITIAL LOAD
    // ============================================================

    loadDashboard();


    // ============================================================
    // AUTO REFRESH
    // ============================================================

    setInterval(
        loadDashboard,
        15000
    );


    window.addEventListener(
        "focus",
        loadDashboard
    );


    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                loadDashboard();

            }

        }
    );


    console.log(
        "LIVE dashboard.js loaded successfully"
    );

});