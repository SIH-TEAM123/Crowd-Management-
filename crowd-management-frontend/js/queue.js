// Queue / Token page logic - LIVE backend data

document.addEventListener("DOMContentLoaded", () => {

    async function loadQueueData() {

        const token = localStorage.getItem("access_token");

        if (!token) {
            alert("Please sign in again.");
            window.location.href = "index.html";
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/appointments`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const appointments = await response.json();

            if (!response.ok) {
                console.error("Backend response:", appointments);

                throw new Error(
                    appointments.detail || "Unable to load appointments"
                );
            }

            console.log("Appointments received:", appointments);

            // Keep only appointments that are still active
            const activeAppointments = appointments.filter(
                appointment =>
                    appointment.status !== "CANCELLED" &&
                    appointment.status !== "COMPLETED" &&
                    appointment.token_status !== "CANCELLED"
            );

            if (activeAppointments.length === 0) {
                showNoAppointment();
                return;
            }

            /*
             * Select the newest active appointment.
             * This prevents an old appointment from appearing
             * when the user creates a new appointment.
             */
            const appointment = activeAppointments
                .sort((a, b) => {

                    const dateA = new Date(
                        a.created_at ||
                        a.appointment_date ||
                        0
                    );

                    const dateB = new Date(
                        b.created_at ||
                        b.appointment_date ||
                        0
                    );

                    return dateB - dateA;
                })[0];

            console.log(
                "Selected LIVE appointment:",
                appointment
            );

            renderQueue(appointment);

        } catch (error) {

            console.error(
                "Queue loading error:",
                error
            );

            alert(
                "Unable to load queue data: " +
                error.message
            );
        }
    }


    function formatToken(token) {

        if (!token) {
            return "No Token";
        }

        return String(token).replace(
            /^([A-Za-z]+)-?(\d+)$/,
            "$1-$2"
        );
    }


    function renderQueue(appointment) {

        // --------------------------------
        // USER TOKEN
        // --------------------------------

        const userToken = formatToken(
            appointment.display_token ||
            appointment.token_number ||
            appointment.token
        );


        // --------------------------------
        // PEOPLE AHEAD
        // --------------------------------

        const peopleAhead =
            Number(
                appointment.people_ahead ??
                appointment.queue_position ??
                0
            ) || 0;


        /*
         * IMPORTANT:
         * Use backend wait time if available.
         * Only calculate as fallback.
         */

        let waitMinutes =
            appointment.estimated_wait_time ??
            appointment.wait_time ??
            appointment.estimated_wait_minutes;

        if (
            waitMinutes === null ||
            waitMinutes === undefined
        ) {
            waitMinutes = peopleAhead * 3;
        }

        waitMinutes =
            Math.max(
                0,
                Math.round(Number(waitMinutes) || 0)
            );


        // --------------------------------
        // CURRENTLY SERVING TOKEN
        // --------------------------------

        let currentToken =
            appointment.current_token ||
            appointment.currently_serving ||
            appointment.serving_token;

        /*
         * If backend does not provide
         * currently serving token,
         * calculate from the user's token
         * and people ahead.
         */

        if (!currentToken) {

            const tokenMatch =
                String(
                    appointment.display_token ||
                    appointment.token_number ||
                    appointment.token ||
                    ""
                ).match(/^([A-Za-z]+)-?(\d+)$/);

            if (tokenMatch) {

                const prefix =
                    tokenMatch[1];

                const tokenNumber =
                    parseInt(
                        tokenMatch[2],
                        10
                    );

                const currentNumber =
                    Math.max(
                        1,
                        tokenNumber - peopleAhead
                    );

                currentToken =
                    `${prefix}-${String(
                        currentNumber
                    ).padStart(3, "0")}`;

            } else {

                currentToken = "Not Available";
            }
        }

        currentToken =
            formatToken(currentToken);


        // --------------------------------
        // MAIN TOKEN VALUES
        // --------------------------------

        const userTokenEl =
            document.getElementById("userToken");

        if (userTokenEl) {
            userTokenEl.textContent =
                userToken;
        }


        const currentTokenEl =
            document.getElementById("currentToken");

        if (currentTokenEl) {
            currentTokenEl.textContent =
                currentToken;
        }


        const peopleAheadEl =
            document.getElementById("peopleAhead");

        if (peopleAheadEl) {
            peopleAheadEl.textContent =
                peopleAhead;
        }


        const waitTimeEl =
            document.getElementById("waitTime");

        if (waitTimeEl) {
            waitTimeEl.innerHTML =
                `${waitMinutes}<span style="font-size:1rem;font-weight:600;"> min</span>`;
        }


        // --------------------------------
        // QUEUE PROGRESS
        // --------------------------------

        const servingCircle =
            document.querySelector(
                ".qp-circle.serving"
            );

        if (servingCircle) {
            servingCircle.textContent =
                currentToken;
        }


        const userCircle =
            document.querySelector(
                ".qp-circle.user"
            );

        if (userCircle) {
            userCircle.textContent =
                userToken;
        }


        const queueNodes =
            document.querySelectorAll(
                ".qp-node"
            );

        /*
         * Update the middle
         * "X ahead" value.
         */

        if (queueNodes.length > 1) {

            const aheadNode =
                queueNodes[1];

            const sub =
                aheadNode.querySelector(
                    ".qp-sub"
                );

            if (sub) {
                sub.textContent =
                    `${peopleAhead} ahead`;
            }
        }


        // --------------------------------
        // STATUS
        // --------------------------------

        let statusLabel =
            "Waiting";

        if (peopleAhead === 0) {

            statusLabel =
                "Being Served";

        } else if (peopleAhead <= 3) {

            statusLabel =
                "Almost There";
        }


        updateStatusPills(
            statusLabel
        );


        const tokenBadge =
            document.querySelector(
                ".card-panel .panel-header .card-badge"
            );

        if (tokenBadge) {

            tokenBadge.textContent =
                statusLabel;

            if (
                statusLabel ===
                "Being Served"
            ) {

                tokenBadge.className =
                    "card-badge badge-success";

            } else if (
                statusLabel ===
                "Almost There"
            ) {

                tokenBadge.className =
                    "card-badge badge-warning";

            } else {

                tokenBadge.className =
                    "card-badge badge-neutral";
            }
        }


        // --------------------------------
        // UPDATE PURPLE MESSAGE
        // FIXES HARDCODED A-104
        // --------------------------------

        updateQueueMessage(
            userToken,
            currentToken,
            peopleAhead
        );


        // --------------------------------
        // UPDATE LINKED APPOINTMENT
        // FIXES HARDCODED OLD TOKEN
        // --------------------------------

        updateLinkedAppointment(
            appointment,
            userToken
        );


        console.log(
            "LIVE QUEUE RENDERED:",
            {
                userToken,
                currentToken,
                peopleAhead,
                waitMinutes,
                appointment
            }
        );
    }


    // --------------------------------
    // UPDATE STATUS PILLS
    // --------------------------------

    function updateStatusPills(
        statusLabel
    ) {

        const pills =
            document.querySelectorAll(
                ".status-pill"
            );

        pills.forEach(pill => {

            const text =
                pill.textContent
                    .trim()
                    .replace("●", "")
                    .trim();

            pill.classList.remove(
                "active-status"
            );

            pill.classList.add(
                "inactive-status"
            );

            if (
                text === statusLabel
            ) {

                pill.classList.remove(
                    "inactive-status"
                );

                pill.classList.add(
                    "active-status"
                );
            }
        });
    }


    // --------------------------------
    // UPDATE QUEUE MESSAGE
    // --------------------------------

    function updateQueueMessage(
        userToken,
        currentToken,
        peopleAhead
    ) {

        /*
         * Finds the purple information
         * box without requiring a hardcoded
         * token like A-104.
         */

        const infoBoxes =
            document.querySelectorAll(
                ".queue-alert, .queue-message, .info-banner, .alert-box"
            );

        infoBoxes.forEach(box => {

            if (
                box.textContent.includes(
                    "Please stay available"
                ) ||
                box.textContent.includes(
                    "proceed to Counter"
                )
            ) {

                if (peopleAhead === 0) {

                    box.innerHTML =
                        `⚠ Please proceed to Counter 1. Your token <strong>${userToken}</strong> is now being served.`;

                } else {

                    box.innerHTML =
                        `ⓘ Please stay available. There ${peopleAhead === 1 ? "is" : "are"} <strong>${peopleAhead}</strong> ${peopleAhead === 1 ? "person" : "people"} ahead of you. Your token <strong>${userToken}</strong> will be called soon.`;
                }
            }
        });


        /*
         * Extra fallback:
         * Replace any old hardcoded A-104 text
         * anywhere inside the queue page.
         */

        document.querySelectorAll(
            "strong, b, span"
        ).forEach(element => {

            if (
                element.textContent.trim() ===
                "A-104"
            ) {

                element.textContent =
                    userToken;
            }
        });
    }


    // --------------------------------
    // UPDATE LINKED APPOINTMENT
    // --------------------------------

    function updateLinkedAppointment(
        appointment,
        userToken
    ) {

        /*
         * SERVICE NAME
         */

        const serviceName =
            appointment.service_name ||
            appointment.service ||
            appointment.service_type ||
            "General Consultation";


        /*
         * DATE
         */

        let appointmentDate =
            appointment.appointment_date ||
            appointment.date ||
            "";

        if (appointmentDate) {

            try {

                appointmentDate =
                    new Date(
                        appointmentDate
                    ).toLocaleDateString(
                        "en-US",
                        {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                        }
                    );

            } catch (error) {

                console.warn(
                    "Unable to format date:",
                    error
                );
            }
        }


        /*
         * TIME
         */

        const appointmentTime =
            appointment.appointment_time ||
            appointment.time ||
            appointment.slot_time ||
            "";


        /*
         * COUNTER
         */

        const counter =
            appointment.counter ||
            appointment.counter_number ||
            "Counter 1";


        /*
         * Find the Linked Appointment section.
         */

        const linkedSection =
            Array.from(
                document.querySelectorAll(
                    ".card-panel, .panel, .queue-card"
                )
            ).find(section =>
                section.textContent.includes(
                    "Linked Appointment"
                )
            );


        if (!linkedSection) {

            console.log(
                "Linked Appointment section not found."
            );

            return;
        }


        /*
         * Replace old hardcoded token.
         */

        const allTextElements =
            linkedSection.querySelectorAll(
                "span, strong, b, p, div"
            );

        allTextElements.forEach(element => {

            const text =
                element.textContent.trim();

            /*
             * Replace old A-104 or token-like text
             */

            if (
                /^Token:\s*A-?\d+$/i.test(
                    text
                )
            ) {

                element.textContent =
                    `Token: ${userToken}`;
            }


            /*
             * Replace old service name
             */

            if (
                text ===
                "General Consultation"
            ) {

                element.textContent =
                    serviceName;
            }


            /*
             * Replace date text
             */

            if (
                /^Date:/i.test(
                    text
                ) &&
                appointmentDate
            ) {

                element.textContent =
                    `Date: ${appointmentDate}`;
            }


            /*
             * Replace time text
             */

            if (
                /^Time:/i.test(
                    text
                ) &&
                appointmentTime
            ) {

                element.textContent =
                    `Time: ${appointmentTime}`;
            }


            /*
             * Replace counter text
             */

            if (
                /^Counter/i.test(
                    text
                )
            ) {

                element.textContent =
                    counter;
            }
        });


        console.log(
            "Linked appointment updated:",
            {
                serviceName,
                appointmentDate,
                appointmentTime,
                counter,
                userToken
            }
        );
    }


    // --------------------------------
    // NO APPOINTMENT
    // --------------------------------

    function showNoAppointment() {

        const userTokenEl =
            document.getElementById(
                "userToken"
            );

        if (userTokenEl) {
            userTokenEl.textContent =
                "No Token";
        }


        const currentTokenEl =
            document.getElementById(
                "currentToken"
            );

        if (currentTokenEl) {
            currentTokenEl.textContent =
                "No Token";
        }


        const peopleAheadEl =
            document.getElementById(
                "peopleAhead"
            );

        if (peopleAheadEl) {
            peopleAheadEl.textContent =
                "0";
        }


        const waitTimeEl =
            document.getElementById(
                "waitTime"
            );

        if (waitTimeEl) {
            waitTimeEl.innerHTML =
                `0<span style="font-size:1rem;font-weight:600;"> min</span>`;
        }


        const servingCircle =
            document.querySelector(
                ".qp-circle.serving"
            );

        if (servingCircle) {
            servingCircle.textContent =
                "-";
        }


        const userCircle =
            document.querySelector(
                ".qp-circle.user"
            );

        if (userCircle) {
            userCircle.textContent =
                "-";
        }
    }


    // --------------------------------
    // VIEW APPOINTMENT BUTTONS
    // --------------------------------

    const viewApptBtns = [

        document.getElementById(
            "btnViewAppt"
        ),

        document.getElementById(
            "btnViewApptBottom"
        )
    ];


    viewApptBtns.forEach(btn => {

        if (btn) {

            btn.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "appointments.html";
                }
            );
        }
    });


    // --------------------------------
    // REFRESH BUTTON
    // --------------------------------

    const refreshBtn =
        document.getElementById(
            "btnRefresh"
        );


    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            async () => {

                refreshBtn.disabled =
                    true;

                const oldText =
                    refreshBtn.textContent;

                refreshBtn.textContent =
                    "Refreshing...";

                await loadQueueData();

                setTimeout(() => {

                    refreshBtn.disabled =
                        false;

                    refreshBtn.textContent =
                        oldText;

                }, 500);
            }
        );
    }


    // --------------------------------
    // LOAD LIVE DATA
    // --------------------------------

    loadQueueData();


    console.log(
        "queue.js loaded - LIVE backend queue enabled"
    );

});