// Queue / Token page — driven by the shared /appointments/queue/status
// endpoint, so it always matches Dashboard, Crowd Status, Profile, etc.

function getQueueStatusLabel(status) {
    switch (status) {
        case "BEING_SERVED": return "Being Served";
        case "SERVED": return "Completed";
        case "WAITING": return "Waiting";
        default: return "Waiting";
    }
}

function updateStatusPills(statusLabel) {
    const pills = document.querySelectorAll(".status-pill");
    pills.forEach(pill => {
        const base = pill.textContent.trim().replace("● ", "");
        const isActive = base === statusLabel;
        pill.classList.toggle("active-status", isActive);
        pill.classList.toggle("inactive-status", !isActive);
        if (isActive) {
            pill.textContent = "● " + statusLabel;
        } else {
            pill.textContent = base;
        }
    });
}

async function renderQueueState() {
    const queueStatus = await VIZITOR.getQueueStatus();
    if (!queueStatus) return;

    const currentTokenEl = document.getElementById("currentToken");
    const userTokenEl = document.getElementById("userToken");
    const peopleAheadEl = document.getElementById("peopleAhead");
    const waitTimeEl = document.getElementById("waitTime");
    const aheadSubEl = document.getElementById("aheadSub");
    const noteTokenEl = document.getElementById("noteToken");

    if (currentTokenEl) {
        currentTokenEl.textContent = queueStatus.currently_serving_token || "--";
    }

    const you = queueStatus.you;

    if (userTokenEl) userTokenEl.textContent = you ? you.token_display : "--";
    if (peopleAheadEl) peopleAheadEl.textContent = you ? you.people_ahead : 0;

    if (waitTimeEl) {
        const wait = you ? you.estimated_wait_minutes : queueStatus.estimated_wait_minutes;
        waitTimeEl.innerHTML = wait + `<span style="font-size:1rem;font-weight:600;"> min</span>`;
    }

    if (aheadSubEl) {
        aheadSubEl.textContent = (you ? you.people_ahead : 0) + " ahead";
    }

    if (noteTokenEl) {
        noteTokenEl.textContent = you ? ` ${you.token_display} ` : " -- ";
    }

    // Progress track nodes
    const servingCircle = document.querySelector(".qp-circle.serving");
    const userCircle = document.querySelector(".qp-circle.user");
    if (servingCircle) servingCircle.textContent = queueStatus.currently_serving_token || "--";
    if (userCircle) userCircle.textContent = you ? you.token_display : "--";

    // Status pills + card badge
    const statusLabel = getQueueStatusLabel(you ? you.status : "WAITING");
    updateStatusPills(statusLabel);

    const tokenBadge = document.querySelector(".card-panel .panel-header .card-badge");
    if (tokenBadge && you) {
        if (you.status === "BEING_SERVED") {
            tokenBadge.textContent = "Being Served";
            tokenBadge.className = "card-badge badge-success";
        } else if (you.people_ahead <= 3) {
            tokenBadge.textContent = "Almost There!";
            tokenBadge.className = "card-badge badge-warning";
        } else {
            tokenBadge.textContent = "Waiting";
            tokenBadge.className = "card-badge badge-neutral";
        }
    }

    // Linked appointment card
    const linkedBadge = document.getElementById("linkedApptBadge");
    const linkedPurpose = document.getElementById("linkedApptPurpose");
    const linkedDate = document.getElementById("linkedApptDate");
    const linkedTime = document.getElementById("linkedApptTime");
    const linkedToken = document.getElementById("linkedApptToken");

    if (you) {
        if (linkedBadge) linkedBadge.textContent = "Confirmed";
        if (linkedPurpose) linkedPurpose.textContent = you.purpose;
        if (linkedDate) linkedDate.textContent = VIZITOR.formatDate(you.appointment_date);
        if (linkedTime) linkedTime.textContent = VIZITOR.formatTime(you.appointment_time);
        if (linkedToken) linkedToken.textContent = you.token_display;
    } else {
        if (linkedBadge) linkedBadge.textContent = "None";
        if (linkedPurpose) linkedPurpose.textContent = "No linked appointment";
        if (linkedDate) linkedDate.textContent = "--";
        if (linkedTime) linkedTime.textContent = "--";
        if (linkedToken) linkedToken.textContent = "--";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    VIZITOR.requireAuthOrRedirect();
    VIZITOR.wireCommonNav();

    renderQueueState();
    setInterval(renderQueueState, 15000);

    const viewApptBtns = [
        document.getElementById("btnViewAppt"),
        document.getElementById("btnViewApptBottom")
    ];
    viewApptBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener("click", () => {
                window.location.href = "appointments.html";
            });
        }
    });

    const refreshBtn = document.getElementById("btnRefresh");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            await renderQueueState();
        });
    }

    console.log("queue.js loaded. Live queue status rendering active.");
});
