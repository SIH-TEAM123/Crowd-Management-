// ============================================================
// VIZITOR — Queue / Token page
//
// Real mode:
//   Uses the live backend queue/status endpoint.
//
// Simulation mode:
//   Uses the shared Crowd Status simulation state.
//
// IMPORTANT:
//   Real appointment/token logic is untouched.
//   SIM-001 is only used for the synthetic simulation.
// ============================================================


const API_BASE = "https://vizitor.onrender.com";


// ============================================================
// LOAD QUEUE STATUS
// ============================================================

async function loadQueueStatus() {

    try {

        // --------------------------------------------------------
        // If Crowd Simulation is active, use the SAME shared
        // simulation state used by Dashboard / Analytics / Reports.
        // --------------------------------------------------------

        if (
            typeof VIZITOR !== "undefined" &&
            VIZITOR.isSimulationActive &&
            VIZITOR.isSimulationActive()
        ) {

            const simulationState =
                VIZITOR.getSimulationState();


            if (simulationState) {

                console.log(
                    "SHARED SIMULATION QUEUE DATA:",
                    simulationState
                );


                updateQueuePage(
                    simulationState
                );


                return;
            }
        }


        // ========================================================
        // REAL BACKEND QUEUE
        // Existing functionality preserved
        // ========================================================

        const token =
            localStorage.getItem(
                "access_token"
            );


        if (!token) {

            console.error(
                "No access token found"
            );

            return;
        }


        const response =
            await fetch(
                `${API_BASE}/appointments/queue/status`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load queue status"
            );
        }


        const data =
            await response.json();


        console.log(
            "LIVE QUEUE DATA:",
            data
        );


        updateQueuePage(
            data
        );


    } catch (error) {

        console.error(
            "Queue error:",
            error
        );
    }
}


// ============================================================
// UPDATE QUEUE PAGE
// ============================================================

function updateQueuePage(data) {

    // ----------------------------------------------------------
    // Detect simulation mode
    // ----------------------------------------------------------

    const simulationActive =
        data?.simulation_active === true;


    const you =
        simulationActive
            ? null
            : data.you;


    // ==========================================================
    // CURRENTLY SERVING
    // ==========================================================

    const currentToken =
        document.getElementById(
            "currentToken"
        );


    if (currentToken) {

        currentToken.textContent =
            data.currently_serving_token ||
            "--";
    }


    // ==========================================================
    // YOUR TOKEN
    //
    // Real mode:
    //     Shows user's actual token.
    //
    // Simulation:
    //     Shows SIM-001 as the synthetic serving token.
    // ==========================================================

    const userToken =
        document.getElementById(
            "userToken"
        );


    if (userToken) {

        userToken.textContent =
            simulationActive
                ? (
                    data.currently_serving_token ||
                    "SIM-001"
                )
                : (
                    you?.token_display ||
                    "--"
                );
    }


    // ==========================================================
    // PEOPLE AHEAD
    // ==========================================================

    const peopleAhead =
        document.getElementById(
            "peopleAhead"
        );


    if (peopleAhead) {

        peopleAhead.textContent =
            simulationActive
                ? (
                    data.queue_size ??
                    data.people_currently_present ??
                    0
                )
                : (
                    you?.people_ahead ??
                    0
                );
    }


    // ==========================================================
    // WAIT TIME
    // ==========================================================

    const waitTime =
        document.getElementById(
            "waitTime"
        );


    if (waitTime) {

        const minutes =
            simulationActive
                ? Math.ceil(
                    Number(
                        data.estimated_wait_minutes ??
                        0
                    )
                )
                : Math.ceil(
                    Number(
                        you?.estimated_wait_minutes ??
                        0
                    )
                );


        waitTime.innerHTML =
            `${minutes}` +
            `<span style="font-size:1rem;font-weight:600;"> min</span>`;
    }


    // ==========================================================
    // STATUS BADGE
    // ==========================================================

    const statusPill =
        document.getElementById(
            "statusPill"
        );


    if (statusPill) {

        if (simulationActive) {

            statusPill.textContent =
                "● Simulation Active";

        }

        else if (
            you?.status ===
            "BEING_SERVED"
        ) {

            statusPill.textContent =
                "● Being Served";

        }

        else if (
            you?.status ===
            "WAITING"
        ) {

            statusPill.textContent =
                "● Waiting";

        }

        else if (
            you?.status ===
            "SERVED"
        ) {

            statusPill.textContent =
                "● Completed";

        }

        else {

            statusPill.textContent =
                "● " +
                (
                    you?.status ||
                    "Waiting"
                );
        }
    }


    // ==========================================================
    // QUEUE PROGRESS
    // ==========================================================

    const servingProgress =
        document.querySelector(
            ".qp-circle.serving"
        );


    if (servingProgress) {

        servingProgress.textContent =
            data.currently_serving_token ||
            "--";
    }


    const userProgress =
        document.querySelector(
            ".qp-circle.user"
        );


    if (userProgress) {

        userProgress.textContent =
            simulationActive
                ? (
                    data.currently_serving_token ||
                    "SIM-001"
                )
                : (
                    you?.token_display ||
                    "--"
                );
    }


    const aheadSub =
        document.getElementById(
            "aheadSub"
        );


    if (aheadSub) {

        aheadSub.textContent =
            simulationActive
                ? `${data.queue_size ?? 0} in simulation`
                : `${you?.people_ahead ?? 0} ahead`;
    }


    // ==========================================================
    // NOTE TOKEN
    // ==========================================================

    const noteToken =
        document.getElementById(
            "noteToken"
        );


    if (noteToken) {

        noteToken.textContent =
            simulationActive
                ? (
                    data.currently_serving_token ||
                    "SIM-001"
                )
                : (
                    you?.token_display ||
                    "--"
                );
    }


    // ==========================================================
    // LINKED APPOINTMENT
    //
    // Real appointment data is preserved.
    // Simulation does not create fake appointments.
    // ==========================================================

    const appointment =
        simulationActive
            ? null
            : (
                you?.appointment ||
                data.appointment
            );


    const purpose =
        document.getElementById(
            "linkedApptPurpose"
        );


    const date =
        document.getElementById(
            "linkedApptDate"
        );


    const time =
        document.getElementById(
            "linkedApptTime"
        );


    const appointmentToken =
        document.getElementById(
            "linkedApptToken"
        );


    const badge =
        document.getElementById(
            "linkedApptBadge"
        );


    // ==========================================================
    // SIMULATION APPOINTMENT DISPLAY
    // ==========================================================

    if (simulationActive) {

        if (purpose) {

            purpose.textContent =
                "Crowd Simulation";
        }


        if (date) {

            date.textContent =
                "Simulation";
        }


        if (time) {

            time.textContent =
                "Live";
        }


        if (appointmentToken) {

            appointmentToken.textContent =
                data.currently_serving_token ||
                "SIM-001";
        }


        if (badge) {

            badge.textContent =
                "Simulation";
        }


        return;
    }


    // ==========================================================
    // REAL APPOINTMENT DISPLAY
    // Existing functionality preserved
    // ==========================================================

    if (appointment) {

        if (purpose) {

            purpose.textContent =
                appointment.purpose ||
                appointment.service ||
                "Current Appointment";
        }


        if (date) {

            date.textContent =
                appointment.date ||
                "--";
        }


        if (time) {

            time.textContent =
                appointment.time ||
                "--";
        }


        if (appointmentToken) {

            appointmentToken.textContent =
                you?.token_display ||
                appointment.token ||
                "--";
        }


        if (badge) {

            badge.textContent =
                "Active";
        }

    }

    else {

        if (purpose) {

            purpose.textContent =
                "Current Queue Appointment";
        }


        if (date) {

            date.textContent =
                "--";
        }


        if (time) {

            time.textContent =
                "--";
        }


        if (appointmentToken) {

            appointmentToken.textContent =
                you?.token_display ||
                "--";
        }


        if (badge) {

            badge.textContent =
                "Active";
        }
    }
}


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadQueueStatus();


        // Keep queue live.
        setInterval(
            loadQueueStatus,
            10000
        );


        const refreshButton =
            document.getElementById(
                "btnRefresh"
            );


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                () => {

                    /*
                     * If simulation is active, Refresh Status
                     * should return to the real backend.
                     */

                    if (
                        typeof VIZITOR !== "undefined" &&
                        VIZITOR.clearSimulationState
                    ) {

                        VIZITOR.clearSimulationState();
                    }


                    loadQueueStatus();
                }
            );
        }
    }
);