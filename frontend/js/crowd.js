// Crowd Status page — driven by the shared /appointments/queue/status
// endpoint (same data source as Dashboard, Queue, Profile, etc.)

const counters = [
    { name: "Counter 1", service: "General Consultation" },
    { name: "Counter 2", service: "Document Verification" },
    { name: "Counter 3", service: "Health Screening" },
    { name: "Counter 4", service: "ID & License Services" }
];

function levelClass(level) {
    if (level === "High") return "high";
    if (level === "Moderate") return "moderate";
    return "low";
}

function getRecommendation(level, waitMinutes) {
    if (level === "No Crowd") {
        return "No crowd right now — walk-ins can be served immediately.";
    }

    return `${level} crowd. Your current estimated waiting time is ${waitMinutes} minutes.`;
}

function renderCrowdStatus(queueStatus) {
    const lvl = levelClass(queueStatus.crowd_level);

    const levelText = document.getElementById("levelText");
    const levelBadge = document.getElementById("levelBadge");
    const peopleEl = document.getElementById("peopleCount");
    const queueEl = document.getElementById("queueSize");
    const waitEl = document.getElementById("waitTime");
    const recText = document.getElementById("recommendationText");

    if (levelText) {
        levelText.textContent = queueStatus.crowd_level;
        levelText.className = `crowd-level-badge ${lvl}`;
    }

    if (peopleEl) {
        peopleEl.textContent = String(
            queueStatus.people_currently_present ?? 0
        );
    }

    if (queueEl) {
        queueEl.textContent = String(
            queueStatus.queue_size ?? 0
        );
    }

    if (waitEl) {
        waitEl.innerHTML =
            `${queueStatus.estimated_wait_minutes ?? 0}` +
            `<span class="wait-unit"> min</span>`;
    }

    if (levelBadge) {
        levelBadge.textContent = queueStatus.crowd_level;

        levelBadge.className = "card-badge " + (
            lvl === "low"
                ? "badge-success"
                : lvl === "moderate"
                    ? "badge-warning"
                    : "badge-danger"
        );
    }

    const dots = {
        low: document.getElementById("dotLow"),
        moderate: document.getElementById("dotModerate"),
        high: document.getElementById("dotHigh")
    };

    const labels = {
        low: document.getElementById("labelLow"),
        moderate: document.getElementById("labelModerate"),
        high: document.getElementById("labelHigh")
    };

    Object.values(dots).forEach(dot => {
        if (dot) dot.classList.remove("lit");
    });

    Object.values(labels).forEach(label => {
        if (label) label.classList.remove("active-label");
    });

    if (dots[lvl]) {
        dots[lvl].classList.add("lit");
    }

    if (labels[lvl]) {
        labels[lvl].classList.add("active-label");
    }

    if (recText) {
        recText.textContent = getRecommendation(
            queueStatus.crowd_level,
            queueStatus.estimated_wait_minutes ?? 0
        );
    }
}


function renderTrendBars(queueStatus) {
    const container = document.getElementById("trendBars");

    if (!container) return;

    const now = new Date();
    const currentHour = now.getHours();

    const current = Number(
        queueStatus.queue_size ?? 0
    );

    const hours = [-4, -3, -2, -1, 0].map(offset => {

        const h = ((currentHour + offset) % 24 + 24) % 24;

        const label = new Date(
            0,
            0,
            0,
            h
        ).toLocaleTimeString("en-US", {
            hour: "numeric"
        });

        return {
            hour: h,
            label
        };
    });

    const trend = hours.map((h, i) => {

        const isNow = i === hours.length - 1;

        const count = isNow
            ? current
            : Math.max(
                0,
                Math.round(
                    current *
                    (0.6 + 0.15 * i) +
                    (i % 2 === 0 ? 1 : -1)
                )
            );

        const level =
            count <= 5
                ? "low"
                : count <= 15
                    ? "moderate"
                    : "high";

        return {
            time: h.label,
            count,
            level,
            current: isNow
        };
    });

    const counts = trend.map(d => d.count);

    const maxCount = Math.max(
        1,
        ...counts
    );

    container.innerHTML = "";

    trend.forEach(d => {

        const wrap = document.createElement("div");

        wrap.className = "trend-bar-wrap";

        const heightPct = Math.max(
            8,
            Math.round(
                (d.count / maxCount) * 100
            )
        );

        const extraClass =
            d.current ? " current" : "";

        wrap.innerHTML =
            '<span class="trend-bar-val">' +
            d.count +
            "</span>" +

            '<div class="trend-bar ' +
            d.level +
            extraClass +
            '" style="height:' +
            heightPct +
            '%;"></div>' +

            '<span class="trend-bar-label">' +
            d.time +
            "</span>";

        container.appendChild(wrap);
    });
}


function renderCounters(queueStatus) {

    const grid =
        document.getElementById("countersGrid");

    if (!grid) return;

    grid.innerHTML = "";

    const queueSize = Number(
        queueStatus.queue_size ?? 0
    );

    counters.forEach(c => {

        const share = Math.ceil(
            queueSize / counters.length
        );

        const isBusy = share > 3;

        const status =
            queueSize === 0
                ? "Available"
                : isBusy
                    ? "Busy"
                    : "Available";

        const badge =
            status === "Busy"
                ? "badge-warning"
                : "badge-success";

        const card =
            document.createElement("div");

        card.className =
            "counter-card";

        card.innerHTML =
            '<div class="counter-card-header">' +

                '<span class="counter-name">' +
                c.name +
                "</span>" +

                '<span class="card-badge ' +
                badge +
                '">' +
                status +
                "</span>" +

            "</div>" +

            '<span class="counter-service">' +
            c.service +
            "</span>";

        grid.appendChild(card);
    });
}


function updateLastUpdated() {

    const el =
        document.getElementById("lastUpdated");

    if (!el) return;

    const now = new Date();

    const time =
        now.toLocaleTimeString(
            "en-US",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    el.textContent =
        "Last updated: " +
        time +
        " — live backend data.";
}


async function refreshStatus() {

    try {

        const queueStatus =
            await VIZITOR.getQueueStatus();

        if (!queueStatus) return;

        renderCrowdStatus(queueStatus);

        renderTrendBars(queueStatus);

        renderCounters(queueStatus);

        updateLastUpdated();

    } catch (error) {

        console.error(
            "Queue status refresh error:",
            error
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        VIZITOR.wireCommonNav();

        refreshStatus();

        setInterval(
            refreshStatus,
            20000
        );


        const refreshBtn =
            document.getElementById(
                "btnRefresh"
            );

        if (refreshBtn) {

            refreshBtn.addEventListener(
                "click",
                refreshStatus
            );
        }


        // ============================================================
        // SYNTHETIC CROWD SIMULATION
        // ============================================================

        const simulationBtn =
            document.getElementById(
                "btnSimulation"
            );

        const simulationInput =
            document.getElementById(
                "simulationUsers"
            );


        if (
            simulationBtn &&
            simulationInput
        ) {

            simulationBtn.addEventListener(
                "click",
                async () => {

                    const numUsers =
                        Number(
                            simulationInput.value
                        );


                    if (
                        !Number.isInteger(numUsers) ||
                        numUsers < 1 ||
                        numUsers > 500
                    ) {

                        alert(
                            "Enter a number between 1 and 500."
                        );

                        return;
                    }


                    simulationBtn.disabled = true;

                    simulationBtn.textContent =
                        "Running...";


                    try {

                        // ------------------------------------------------
                        // Call backend simulation
                        // ------------------------------------------------

                        const response =
                            await fetch(
                                `http://127.0.0.1:8000/optimization/simulation?num_users=${encodeURIComponent(numUsers)}`,
                                {
                                    method: "POST"
                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                `Simulation failed: HTTP ${response.status}`
                            );
                        }


                        const data =
                            await response.json();


                        // ------------------------------------------------
                        // Validate backend response
                        // ------------------------------------------------

                        if (
                            !data ||
                            !Array.isArray(data.steps) ||
                            data.steps.length === 0
                        ) {

                            throw new Error(
                                "Backend returned no simulation steps."
                            );
                        }


                        // ------------------------------------------------
                        // Replay simulation
                        // ------------------------------------------------

                        for (
                            const step of data.steps
                        ) {

                            const prediction =
                                step.prediction || {};

                            const optimization =
                                step.optimization || {};


                            // IMPORTANT:
                            // Backend returns queue_length directly.
                            //
                            // It does NOT return:
                            // step.current_state.queue_length
                            //
                            // This was the reason the old simulation
                            // was throwing an error.

                            const currentQueue =
                                Number(
                                    step.queue_length ?? 0
                                );


                            if (
                                !Number.isFinite(
                                    currentQueue
                                ) ||
                                currentQueue < 0
                            ) {

                                throw new Error(
                                    "Invalid queue length returned by backend."
                                );
                            }


                            const predictedWait =
                                Number(
                                    prediction.predicted_wait_minutes ?? 0
                                );


                            const congestion =
                                prediction.predicted_congestion_level ||
                                "LOW";


                            // ------------------------------------------------
                            // Convert backend congestion to UI level
                            // ------------------------------------------------

                            let crowdLevel;

                            if (
                                congestion === "CRITICAL" ||
                                congestion === "HIGH"
                            ) {

                                crowdLevel = "High";

                            } else if (
                                congestion === "MEDIUM"
                            ) {

                                crowdLevel = "Moderate";

                            } else {

                                crowdLevel = "Low";
                            }


                            // ------------------------------------------------
                            // Build simulated queue status
                            // ------------------------------------------------

                            const simulatedStatus = {

                                crowd_level:
                                    crowdLevel,

                                people_currently_present:
                                    currentQueue,

                                queue_size:
                                    currentQueue,

                                estimated_wait_minutes:
                                    Number.isFinite(
                                        predictedWait
                                    )
                                        ? Math.round(
                                            predictedWait * 10
                                        ) / 10
                                        : 0
                            };


                            // ------------------------------------------------
                            // Update UI
                            // ------------------------------------------------

                            renderCrowdStatus(
                                simulatedStatus
                            );

                            renderTrendBars(
                                simulatedStatus
                            );

                            renderCounters(
                                simulatedStatus
                            );


                            // ------------------------------------------------
                            // Update simulation progress
                            // ------------------------------------------------

                            const lastUpdated =
                                document.getElementById(
                                    "lastUpdated"
                                );


                            if (lastUpdated) {

                                lastUpdated.textContent =
                                    `Simulation: Step ${step.step} — ` +
                                    `${currentQueue}/${numUsers} people ` +
                                    `processed through crowd model.`;
                            }


                            // ------------------------------------------------
                            // Display AI optimizer recommendation
                            // ------------------------------------------------

                            const recText =
                                document.getElementById(
                                    "recommendationText"
                                );


                            if (
                                recText &&
                                optimization.recommended_action &&
                                optimization.recommended_action.type
                            ) {

                                recText.textContent =
                                    `${optimization.recommended_action.type}: ` +
                                    `${optimization.reason || "System recommendation generated."}`;
                            }


                            // ------------------------------------------------
                            // Wait before next simulation step
                            // ------------------------------------------------

                            await new Promise(
                                resolve =>
                                    setTimeout(
                                        resolve,
                                        800
                                    )
                            );
                        }


                    } catch (error) {

                        console.error(
                            "Simulation error:",
                            error
                        );


                        alert(
                            `Could not run simulation.\n\n` +
                            `${error?.message || "Unknown error"}\n\n` +
                            `Check that the backend is running on ` +
                            `http://127.0.0.1:8000.`
                        );


                    } finally {

                        simulationBtn.disabled =
                            false;

                        simulationBtn.textContent =
                            "Run Simulation";
                    }
                }
            );
        }
    }
);