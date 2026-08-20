// Queue / Token page logic for Crowd Management

// ─────────────────────────────────────────────
// Sample data (will be replaced by backend data later)
// ─────────────────────────────────────────────
const queueData = {
    userToken:     "A-104",
    currentToken:  "A-087",
    counter:       "Counter 1",
    peopleAhead:   17,
    waitMinutes:   24,
    service:       "General Consultation",
    date:          "Aug 17, 2026",
    time:          "02:30 PM"
};

// ─────────────────────────────────────────────
// Determine queue status label based on people ahead
// ─────────────────────────────────────────────
function getQueueStatus(ahead) {
    if (ahead === 0)  return "Being Served";
    if (ahead <= 3)   return "Almost There";
    if (ahead <= 20)  return "Waiting";
    return "Waiting";
}

// ─────────────────────────────────────────────
// Update the status pills to highlight the correct one
// ─────────────────────────────────────────────
function updateStatusPills(statusLabel) {
    const pills = document.querySelectorAll(".status-pill");
    pills.forEach(pill => {
        pill.classList.remove("active-status");
        pill.classList.add("inactive-status");
    });

    pills.forEach(pill => {
        // Match by text content (ignore the "●" prefix)
        if (pill.textContent.trim().replace("● ", "") === statusLabel) {
            pill.classList.add("active-status");
            pill.classList.remove("inactive-status");
            pill.textContent = "● " + statusLabel;
        }
    });
}

// ─────────────────────────────────────────────
// Simulate a "refresh" – advances the queue by 1-3 tokens
// ─────────────────────────────────────────────
function simulateRefresh() {
    if (queueData.peopleAhead <= 0) {
        alert("You are currently being served! Please proceed to " + queueData.counter + ".");
        return;
    }

    // Advance serving token by 1-3 positions
    const advance = Math.min(Math.floor(Math.random() * 3) + 1, queueData.peopleAhead);
    queueData.peopleAhead  -= advance;
    queueData.waitMinutes   = Math.max(0, Math.round(queueData.peopleAhead * 1.4));

    // Parse and bump the current token number
    const parts  = queueData.currentToken.split("-");
    const letter = parts[0];
    const num    = parseInt(parts[1], 10) + advance;
    queueData.currentToken = letter + "-" + String(num).padStart(3, "0");

    // Re-render the page values
    renderQueueState();
}

// ─────────────────────────────────────────────
// Render all dynamic values onto the page
// ─────────────────────────────────────────────
function renderQueueState() {
    // Update big token displays
    const currentTokenEl = document.getElementById("currentToken");
    const userTokenEl    = document.getElementById("userToken");
    const peopleAheadEl  = document.getElementById("peopleAhead");
    const waitTimeEl     = document.getElementById("waitTime");

    if (currentTokenEl) currentTokenEl.textContent = queueData.currentToken;
    if (userTokenEl)    userTokenEl.textContent    = queueData.userToken;
    if (peopleAheadEl)  peopleAheadEl.textContent  = queueData.peopleAhead;
    if (waitTimeEl)     waitTimeEl.innerHTML        =
        queueData.waitMinutes + `<span style="font-size:1rem;font-weight:600;"> min</span>`;

    // Update progress track nodes
    const servingCircle = document.querySelector(".qp-circle.serving");
    const aheadCircle   = document.querySelector(".qp-circle.ahead");
    const userCircle    = document.querySelector(".qp-circle.user");
    const aheadSub      = document.querySelector(".qp-circle.ahead + .qp-sub, .qp-node:nth-child(3) .qp-sub");

    if (servingCircle) servingCircle.textContent = queueData.currentToken;
    if (userCircle)    userCircle.textContent    = queueData.userToken;

    // Update the "17 ahead" label on the middle dot
    const aheadNode = document.querySelectorAll(".qp-node")[1];
    if (aheadNode) {
        const sub = aheadNode.querySelector(".qp-sub");
        if (sub) sub.textContent = queueData.peopleAhead + " ahead";
    }

    // Update status pills
    const statusLabel = getQueueStatus(queueData.peopleAhead);
    updateStatusPills(statusLabel);

    // If queue position changes to being served – update token card badge
    const tokenBadge = document.querySelector(".card-panel .panel-header .card-badge");
    if (tokenBadge) {
        if (queueData.peopleAhead === 0) {
            tokenBadge.textContent = "Being Served";
            tokenBadge.className   = "card-badge badge-success";
        } else if (queueData.peopleAhead <= 3) {
            tokenBadge.textContent = "Almost There!";
            tokenBadge.className   = "card-badge badge-warning";
        } else {
            tokenBadge.textContent = "Waiting";
            tokenBadge.className   = "card-badge badge-neutral";
        }
    }
}

// ─────────────────────────────────────────────
// On page ready
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Initial render
    renderQueueState();

    // "View Appointment" buttons – both the header and the card button
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

    // "Refresh Status" button
    const refreshBtn = document.getElementById("btnRefresh");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            simulateRefresh();
            alert(
                `Queue refreshed!\n\n` +
                `Currently Serving: ${queueData.currentToken}\n` +
                `People Ahead: ${queueData.peopleAhead}\n` +
                `Estimated Wait: ${queueData.waitMinutes} min\n\n` +
                `(Live data will be fetched from the backend in a future step.)`
            );
        });
    }

    console.log("queue.js loaded. Queue status rendering active.");
});
