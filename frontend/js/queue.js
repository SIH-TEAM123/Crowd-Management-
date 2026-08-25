const API_BASE = ""https://vizitor.onrender.com"";

async function loadQueueStatus() {
    try {
        const token = localStorage.getItem("access_token");

        if (!token) {
            console.error("No access token found");
            return;
        }

        const response = await fetch(
            `${API_BASE}/appointments/queue/status`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error("Failed to load queue status");
        }

        const data = await response.json();

        console.log("LIVE QUEUE DATA:", data);

        updateQueuePage(data);

    } catch (error) {
        console.error("Queue error:", error);
    }
}


function updateQueuePage(data) {

    const you = data.you;

    // ===============================
    // CURRENTLY SERVING
    // ===============================

    const currentToken =
        document.getElementById("currentToken");

    if (currentToken) {
        currentToken.textContent =
            data.currently_serving_token || "--";
    }


    // ===============================
    // YOUR TOKEN
    // ===============================

    const userToken =
        document.getElementById("userToken");

    if (userToken) {
        userToken.textContent =
            you?.token_display || "--";
    }


    // ===============================
    // PEOPLE AHEAD
    // ===============================

    const peopleAhead =
        document.getElementById("peopleAhead");

    if (peopleAhead) {
        peopleAhead.textContent =
            you?.people_ahead ?? 0;
    }


    // ===============================
    // WAIT TIME
    // ===============================

    const waitTime =
        document.getElementById("waitTime");

    if (waitTime) {
        const minutes =
            Math.ceil(you?.estimated_wait_minutes ?? 0);

        waitTime.innerHTML =
            `${minutes}<span style="font-size:1rem;font-weight:600;"> min</span>`;
    }


    // ===============================
    // STATUS BADGE
    // ===============================

    const statusPill =
        document.getElementById("statusPill");

    if (statusPill) {

        if (you?.status === "BEING_SERVED") {
            statusPill.textContent = "● Being Served";
        }

        else if (you?.status === "WAITING") {
            statusPill.textContent = "● Waiting";
        }

        else if (you?.status === "SERVED") {
            statusPill.textContent = "● Completed";
        }

        else {
            statusPill.textContent =
                "● " + (you?.status || "Waiting");
        }
    }


    // ===============================
    // QUEUE PROGRESS
    // ===============================

    const servingProgress =
        document.querySelector(".qp-circle.serving");

    if (servingProgress) {
        servingProgress.textContent =
            data.currently_serving_token || "--";
    }


    const userProgress =
        document.querySelector(".qp-circle.user");

    if (userProgress) {
        userProgress.textContent =
            you?.token_display || "--";
    }


    const aheadSub =
        document.getElementById("aheadSub");

    if (aheadSub) {
        aheadSub.textContent =
            `${you?.people_ahead ?? 0} ahead`;
    }


    // ===============================
    // NOTE TOKEN
    // ===============================

    const noteToken =
        document.getElementById("noteToken");

    if (noteToken) {
        noteToken.textContent =
            you?.token_display || "--";
    }


    // ===============================
    // LINKED APPOINTMENT
    // ===============================

    const appointment =
        you?.appointment || data.appointment;

    const purpose =
        document.getElementById("linkedApptPurpose");

    const date =
        document.getElementById("linkedApptDate");

    const time =
        document.getElementById("linkedApptTime");

    const appointmentToken =
        document.getElementById("linkedApptToken");

    const badge =
        document.getElementById("linkedApptBadge");

    if (appointment) {

        if (purpose) {
            purpose.textContent =
                appointment.purpose ||
                appointment.service ||
                "Current Appointment";
        }

        if (date) {
            date.textContent =
                appointment.date || "--";
        }

        if (time) {
            time.textContent =
                appointment.time || "--";
        }

        if (appointmentToken) {
            appointmentToken.textContent =
                you?.token_display ||
                appointment.token ||
                "--";
        }

        if (badge) {
            badge.textContent = "Active";
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
                you?.token_display || "--";
        }

        if (badge) {
            badge.textContent = "Active";
        }
    }
}


// ===============================
// PAGE LOAD
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    loadQueueStatus();

    setInterval(loadQueueStatus, 10000);

    const refreshButton =
        document.getElementById("btnRefresh");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadQueueStatus
        );
    }
});