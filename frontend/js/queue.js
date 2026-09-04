// ============================================================
// VIZITOR — Queue / Token page
// Uses VIZITOR.getQueueStatus() exclusively.
// Real backend token is never modified by simulation.
// ============================================================


async function loadQueueStatus() {

    try {

        const data =
            await VIZITOR.getQueueStatus();

        if (!data) {
            return;
        }

        updateQueuePage(data);

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

    const simulationActive =
        data?.simulation_active === true;

    const you =
        data?.you || null;


    // ========================================================
    // CURRENTLY SERVING
    // ========================================================

    const currentToken =
        document.getElementById(
            "currentToken"
        );

    if (currentToken) {

        currentToken.textContent =
            data.currently_serving_token ||
            "--";
    }


    // ========================================================
    // USER TOKEN
    // ========================================================

    const userToken =
        document.getElementById(
            "userToken"
        );

    const displayedUserToken =
        simulationActive
            ? (
                data.user_simulated_token ||
                data.real_user_token ||
                "--"
            )
            : (
                you?.token_display ||
                "--"
            );

    if (userToken) {
        userToken.textContent =
            displayedUserToken;
    }


    // ========================================================
    // TOKEN LABEL
    // ========================================================

    const tokenLabel =
        document.querySelector(
            "#userToken + .token-label"
        );

    if (tokenLabel) {

        tokenLabel.textContent =
            simulationActive
                ? (
                    `Simulation • Real token ${data.real_user_token || "--"}`
                )
                : "Registered • Live Queue";
    }


    // ========================================================
    // PEOPLE AHEAD
    // ========================================================

    const peopleAhead =
        document.getElementById(
            "peopleAhead"
        );

    if (peopleAhead) {

        peopleAhead.textContent =
            you?.people_ahead ??
            0;
    }


    // ========================================================
    // WAIT
    // ========================================================

    const waitTime =
        document.getElementById(
            "waitTime"
        );

    if (waitTime) {

        const minutes =
            Math.max(
                0,
                Math.ceil(
                    Number(
                        you?.estimated_wait_minutes ??
                        data.estimated_wait_minutes ??
                        0
                    )
                )
            );

        waitTime.innerHTML =
            `${minutes}` +
            `<span style="font-size:1rem;font-weight:600;"> min</span>`;
    }


    // ========================================================
    // STATUS
    // ========================================================

    const statusPill =
        document.getElementById(
            "statusPill"
        );

    if (statusPill) {

        if (
            you?.status ===
            "BEING_SERVED"
        ) {

            statusPill.textContent =
                "✓ Being Served";

            statusPill.classList.remove(
                "inactive-status"
            );

            statusPill.classList.add(
                "active-status"
            );

        } else if (
            you?.status ===
            "SERVED"
        ) {

            statusPill.textContent =
                "✓ Completed";

        } else {

            statusPill.textContent =
                simulationActive
                    ? "● Simulation Active"
                    : "● Waiting";
        }
    }


    // ========================================================
    // COUNTER INSTRUCTION
    // ========================================================

    let instruction =
        document.getElementById(
            "queueCounterInstruction"
        );

    if (!instruction) {

        instruction =
            document.createElement("div");

        instruction.id =
            "queueCounterInstruction";

        instruction.style.marginTop =
            "16px";

        instruction.style.padding =
            "14px 16px";

        instruction.style.borderRadius =
            "12px";

        instruction.style.fontWeight =
            "700";

        const note =
            document.querySelector(
                ".queue-note"
            );

        if (note?.parentNode) {

            note.parentNode.insertBefore(
                instruction,
                note
            );
        }
    }

    if (instruction) {

        if (
            you?.status ===
            "BEING_SERVED"
        ) {

            instruction.textContent =
                `Proceed to Counter ${you.counter_number || data.counter_number || 1}`;

            instruction.style.background =
                "rgba(34,197,94,.10)";

            instruction.style.color =
                "#15803d";

        } else {

            instruction.textContent =
                simulationActive
                    ? `Simulation active • ${data.estimated_wait_minutes} min remaining`
                    : "Please stay available until your token is called.";

            instruction.style.background =
                "rgba(124,58,237,.08)";

            instruction.style.color =
                "#6d28d9";
        }
    }


    // ========================================================
    // QUEUE PROGRESS
    // ========================================================

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
            displayedUserToken;
    }


    const aheadSub =
        document.getElementById(
            "aheadSub"
        );

    if (aheadSub) {

        aheadSub.textContent =
            simulationActive
                ? `${you?.people_ahead ?? 0} synthetic people ahead`
                : `${you?.people_ahead ?? 0} ahead`;
    }


    // ========================================================
    // NOTE TOKEN
    // ========================================================

    const noteToken =
        document.getElementById(
            "noteToken"
        );

    if (noteToken) {

        noteToken.textContent =
            displayedUserToken;
    }


    // ========================================================
    // LINKED APPOINTMENT
    // ========================================================

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


    if (simulationActive) {

        if (purpose) {
            purpose.textContent =
                you?.purpose ||
                "Crowd Simulation";
        }

        if (date) {
            date.textContent =
                VIZITOR.formatDate(
                    you?.appointment_date
                );
        }

        if (time) {
            time.textContent =
                VIZITOR.formatTime(
                    you?.appointment_time
                );
        }

        if (appointmentToken) {
            appointmentToken.textContent =
                data.real_user_token ||
                "--";
        }

        if (badge) {
            badge.textContent =
                "Simulation Overlay";
        }

        return;
    }


    // ========================================================
    // REAL APPOINTMENT
    // ========================================================

    const appointment =
        you?.appointment ||
        data.appointment ||
        null;

    if (appointment) {

        if (purpose) {
            purpose.textContent =
                appointment.purpose ||
                appointment.service ||
                you?.purpose ||
                "Current Appointment";
        }

        if (date) {
            date.textContent =
                VIZITOR.formatDate(
                    appointment.appointment_date ||
                    appointment.date
                );
        }

        if (time) {
            time.textContent =
                VIZITOR.formatTime(
                    appointment.appointment_time ||
                    appointment.time
                );
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

    } else {

        if (purpose) {
            purpose.textContent =
                "Current Queue Appointment";
        }

        if (date) {
            date.textContent = "--";
        }

        if (time) {
            time.textContent = "--";
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
// PAGE START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        VIZITOR.wireCommonNav();


    const btnViewQR = document.getElementById("btnViewQR");
    if (btnViewQR) {
        btnViewQR.addEventListener("click", async () => {
            const data = await VIZITOR.getQueueStatus();
            const apptId = data?.you?.appointment_id;
            if (!apptId) {
                alert("No active appointment found for your token pass.");
                return;
            }
            if (typeof showQRPassModal === "function") {
                showQRPassModal(apptId, data.you.token_display, data.you.purpose, data.you.appointment_date);
            } else {
                window.open(`${API_BASE_URL}/appointments/${apptId}/qr/svg`, "_blank");
            }
        });
    }

    loadQueueStatus();

        setInterval(
            loadQueueStatus,
            1000
        );


        const refreshButton =
            document.getElementById(
                "btnRefresh"
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                async () => {

                    VIZITOR.clearSimulationState();

                    await
    const btnViewQR = document.getElementById("btnViewQR");
    if (btnViewQR) {
        btnViewQR.addEventListener("click", async () => {
            const data = await VIZITOR.getQueueStatus();
            const apptId = data?.you?.appointment_id;
            if (!apptId) {
                alert("No active appointment found for your token pass.");
                return;
            }
            if (typeof showQRPassModal === "function") {
                showQRPassModal(apptId, data.you.token_display, data.you.purpose, data.you.appointment_date);
            } else {
                window.open(`${API_BASE_URL}/appointments/${apptId}/qr/svg`, "_blank");
            }
        });
    }

    loadQueueStatus();
                }
            );
        }
    }
);