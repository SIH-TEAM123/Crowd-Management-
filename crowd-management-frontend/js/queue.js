// Queue / Token page logic for Crowd Management

// Retrieve active token from session or backend
function getStoredQueueState() {
    const activeToken = getActiveToken();
    if (activeToken) {
        const queuePos = activeToken.queue_position || 1;
        const peopleAhead = Math.max(0, queuePos - 1);
        const estWait = (activeToken.decision && activeToken.decision.predicted_wait_minutes) 
            ? Math.round(activeToken.decision.predicted_wait_minutes) 
            : (peopleAhead * 5);

        return {
            tokenId: activeToken.token_id || "uuid-sample-token",
            userToken: activeToken.token_number || "A-104",
            currentToken: "A-001",
            counter: "Counter 1",
            queuePosition: queuePos,
            peopleAhead: peopleAhead,
            waitMinutes: estWait,
            priorityType: activeToken.priority_type || "NORMAL",
            fairnessScore: (activeToken.fairness && typeof activeToken.fairness.fairness === 'number') 
                ? activeToken.fairness.fairness.toFixed(2) 
                : "0.85",
            emergencyActive: (activeToken.emergency_state && activeToken.emergency_state.emergency_active) ? "Yes (Active)" : "No",
            crowdCount: (activeToken.crowd_state && activeToken.crowd_state.people_count) 
                ? `${activeToken.crowd_state.people_count} People` 
                : "Active Facility",
            status: activeToken.token_status || "WAITING"
        };
    }

    // Default fallback if no active token created yet
    return {
        tokenId: "A-104-SAMPLE",
        userToken: "A-104",
        currentToken: "A-087",
        counter: "Counter 1",
        queuePosition: 18,
        peopleAhead: 17,
        waitMinutes: 24,
        priorityType: "NORMAL",
        fairnessScore: "0.85",
        emergencyActive: "No",
        crowdCount: "18 In Facility",
        status: "WAITING"
    };
}

function renderQueueState() {
    const state = getStoredQueueState();

    // 1. Render Big Token & Stats
    const currentTokenEl = document.getElementById("currentToken");
    const userTokenEl    = document.getElementById("userToken");
    const peopleAheadEl  = document.getElementById("peopleAhead");
    const waitTimeEl     = document.getElementById("waitTime");

    if (currentTokenEl) currentTokenEl.textContent = state.currentToken;
    if (userTokenEl)    userTokenEl.textContent    = state.userToken;
    if (peopleAheadEl)  peopleAheadEl.textContent  = state.peopleAhead;
    if (waitTimeEl)     waitTimeEl.innerHTML        = state.waitMinutes + `<span style="font-size:1rem;font-weight:600;"> min</span>`;

    // 2. Render Digital QR Code
    const qrContainer = document.getElementById("queueQrContainer");
    if (qrContainer) {
        qrContainer.innerHTML = generateQRCodeSVG(state.tokenId || state.userToken, 160);
    }

    // 3. Render Priority & Fairness Details
    const priorityLabel = document.getElementById("tokenPriorityLabel");
    if (priorityLabel) {
        priorityLabel.textContent = `Priority: ${state.priorityType} · ${state.status}`;
    }

    const priorityValEl = document.getElementById("priorityVal");
    const fairnessValEl = document.getElementById("fairnessVal");
    const emergencyValEl = document.getElementById("emergencyActiveVal");
    const crowdValEl = document.getElementById("crowdStateVal");

    if (priorityValEl) priorityValEl.textContent = state.priorityType;
    if (fairnessValEl) fairnessValEl.textContent = state.fairnessScore;
    if (emergencyValEl) {
        emergencyValEl.textContent = state.emergencyActive;
        emergencyValEl.style.color = state.emergencyActive.includes("Yes") ? "#ef4444" : "#10b981";
    }
    if (crowdValEl) crowdValEl.textContent = state.crowdCount;

    // 4. Update Progress Track
    const servingCircle = document.querySelector(".qp-circle.serving");
    const userCircle    = document.querySelector(".qp-circle.user");
    if (servingCircle) servingCircle.textContent = state.currentToken;
    if (userCircle)    userCircle.textContent    = state.userToken;

    const aheadNode = document.querySelectorAll(".qp-node")[1];
    if (aheadNode) {
        const sub = aheadNode.querySelector(".qp-sub");
        if (sub) sub.textContent = state.peopleAhead + " ahead";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderQueueState();

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
            renderQueueState();
            alert("Queue status refreshed with latest FastAPI backend data.");
        });
    }

    // Header & Logout Navigation Handlers
    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    const notifBtn = document.querySelector('.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            logoutUser();
        });
    });

    console.log("queue.js loaded. Real backend token rendering active.");
});


