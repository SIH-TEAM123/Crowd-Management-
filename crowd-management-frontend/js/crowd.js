// Crowd Status page — LIVE backend data only

document.addEventListener("DOMContentLoaded", () => {

    async function loadCrowdStatus() {

        const accessToken = localStorage.getItem("access_token");

        if (!accessToken) {
            alert("Please sign in again.");
            window.location.href = "index.html";
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
                console.error("Crowd backend error:", data);
                throw new Error(
                    data.detail || "Unable to load crowd status"
                );
            }

            console.log("LIVE CROWD DATA:", data);

            // =====================================================
            // LIVE VALUES FROM BACKEND
            // =====================================================

            const queueSize =
                Number(data.current_queue) || 0;

            const waitMinutes =
                Number(data.estimated_wait_minutes) || 0;

            const currentlyServing =
                data.currently_serving || null;

            const peoplePresent =
                queueSize + (currentlyServing ? 1 : 0);


            // =====================================================
            // USE BACKEND CROWD LEVEL
            // =====================================================

            let crowdLevel = data.crowd_level || "No Crowd";

            const normalizedLevel =
                String(crowdLevel).trim().toLowerCase();

            if (
                normalizedLevel === "medium"
            ) {
                crowdLevel = "Moderate";
            }
            else if (
                normalizedLevel === "low"
            ) {
                crowdLevel = "Low";
            }
            else if (
                normalizedLevel === "moderate"
            ) {
                crowdLevel = "Moderate";
            }
            else if (
                normalizedLevel === "high"
            ) {
                crowdLevel = "High";
            }
            else if (
                normalizedLevel === "none" ||
                normalizedLevel === "no crowd"
            ) {
                crowdLevel = "No Crowd";
            }


            // =====================================================
            // CROWD LEVEL MAIN DISPLAY
            // =====================================================

            const levelText =
                document.getElementById("levelText");

            if (levelText) {
                levelText.textContent = crowdLevel;

                levelText.className =
                    "crowd-level-badge";
            }


            const levelBadge =
                document.getElementById("levelBadge");

            if (levelBadge) {

                levelBadge.textContent = crowdLevel;

                levelBadge.className = "card-badge";

                if (crowdLevel === "Low") {
                    levelBadge.classList.add("badge-success");
                }
                else if (crowdLevel === "Moderate") {
                    levelBadge.classList.add("badge-warning");
                }
                else if (crowdLevel === "High") {
                    levelBadge.classList.add("badge-danger");
                }
                else {
                    levelBadge.classList.add("badge-neutral");
                }
            }


            // =====================================================
            // PEOPLE CURRENTLY PRESENT
            // =====================================================

            const peopleEl =
                document.getElementById("peopleCount");

            if (peopleEl) {
                peopleEl.textContent =
                    peoplePresent;
            }


            // =====================================================
            // QUEUE SIZE
            // =====================================================

            const queueEl =
                document.getElementById("queueSize");

            if (queueEl) {
                queueEl.textContent =
                    queueSize;
            }


            // =====================================================
            // WAIT TIME
            // =====================================================

            const waitEl =
                document.getElementById("waitTime");

            if (waitEl) {
                waitEl.innerHTML =
                    `${waitMinutes}<span class="wait-unit"> min</span>`;
            }


            // =====================================================
            // VISUAL INDICATOR
            //
            // Shows ONLY the actual backend crowd level.
            // No fake threshold logic.
            // =====================================================

            const dotLow =
                document.getElementById("dotLow");

            const dotModerate =
                document.getElementById("dotModerate");

            const dotHigh =
                document.getElementById("dotHigh");

            const labelLow =
                document.getElementById("labelLow");

            const labelModerate =
                document.getElementById("labelModerate");

            const labelHigh =
                document.getElementById("labelHigh");


            // Reset everything

            [
                dotLow,
                dotModerate,
                dotHigh
            ].forEach(dot => {

                if (dot) {
                    dot.classList.remove("lit");
                }

            });


            [
                labelLow,
                labelModerate,
                labelHigh
            ].forEach(label => {

                if (label) {
                    label.classList.remove(
                        "active-label"
                    );
                }

            });


            // Activate ONLY actual backend level

            if (crowdLevel === "Low") {

                if (dotLow) {
                    dotLow.classList.add("lit");
                }

                if (labelLow) {
                    labelLow.classList.add(
                        "active-label"
                    );
                }

            }

            else if (crowdLevel === "Moderate") {

                if (dotModerate) {
                    dotModerate.classList.add("lit");
                }

                if (labelModerate) {
                    labelModerate.classList.add(
                        "active-label"
                    );
                }

            }

            else if (crowdLevel === "High") {

                if (dotHigh) {
                    dotHigh.classList.add("lit");
                }

                if (labelHigh) {
                    labelHigh.classList.add(
                        "active-label"
                    );
                }

            }


            // =====================================================
            // RECOMMENDATION
            // =====================================================

            const recommendationText =
                document.getElementById(
                    "recommendationText"
                );

            if (recommendationText) {

                if (queueSize === 0) {

                    recommendationText.textContent =
                        "No active queue at the moment. You can visit now.";

                }
                else {

                    recommendationText.textContent =
                        `${crowdLevel} crowd. ` +
                        `${queueSize} people are currently waiting. ` +
                        `Estimated waiting time is ${waitMinutes} minutes.`;

                }
            }


            // =====================================================
            // LAST UPDATED
            // =====================================================

            const lastUpdated =
                document.getElementById(
                    "lastUpdated"
                );

            if (lastUpdated) {

                const now = new Date();

                const formattedTime =
                    now.toLocaleTimeString(
                        "en-US",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

                lastUpdated.textContent =
                    `Last updated: ${formattedTime} — live backend data.`;
            }


            console.log(
                "CROWD STATUS UPDATED:",
                {
                    queueSize,
                    currentlyServing,
                    peoplePresent,
                    crowdLevel,
                    waitMinutes
                }
            );

        }
        catch (error) {

            console.error(
                "Crowd status loading error:",
                error
            );

            const lastUpdated =
                document.getElementById(
                    "lastUpdated"
                );

            if (lastUpdated) {
                lastUpdated.textContent =
                    "Unable to load live crowd data.";
            }
        }
    }


    // =====================================================
    // REFRESH BUTTON
    // =====================================================

    const refreshBtn =
        document.getElementById("btnRefresh");

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            loadCrowdStatus
        );

    }


    // =====================================================
    // PROFILE NAVIGATION
    // =====================================================

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


    // =====================================================
    // NOTIFICATIONS
    // =====================================================

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


    // =====================================================
    // LOGOUT
    // =====================================================

    const logoutLinks =
        document.querySelectorAll(
            '.sidebar-footer a, #btnLogout'
        );

    logoutLinks.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                localStorage.removeItem(
                    "isAuthenticated"
                );

                localStorage.removeItem(
                    "userEmail"
                );

                localStorage.removeItem(
                    "access_token"
                );

                localStorage.removeItem(
                    "userProfile"
                );

            }
        );

    });


    // =====================================================
    // LOAD LIVE DATA
    // =====================================================

    loadCrowdStatus();

    console.log(
        "crowd.js loaded — LIVE backend data only"
    );

});