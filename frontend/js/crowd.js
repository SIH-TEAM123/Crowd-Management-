// ============================================================
// Crowd Status page
// Live queue + synthetic crowd simulation
// ============================================================

const counters = [
    { name: "Counter 1", service: "General Consultation" },
    { name: "Counter 2", service: "Document Verification" },
    { name: "Counter 3", service: "Health Screening" },
    { name: "Counter 4", service: "ID & License Services" }
];


// ============================================================
// SIMULATION STATE
// ============================================================

window.simulationRunning = false;

window.simulationState = {
    queueLength: 0,
    activeCounters: 4,
    serviceRate: 10
};


// ============================================================
// CROWD LEVEL
// ============================================================

function levelClass(level) {
    if (level === "High") return "high";
    if (level === "Moderate") return "moderate";
    return "low";
}


// ============================================================
// RECOMMENDATION
// ============================================================

function getRecommendation(level, waitMinutes) {

    if (level === "No Crowd") {
        return "No crowd right now — walk-ins can be served immediately.";
    }

    return `${level} crowd. Your current estimated waiting time is ${waitMinutes} minutes.`;
}


// ============================================================
// SERVICE RATE WAIT CALCULATION
// ============================================================

function calculateWaitFromServiceRate(queueLength, serviceRate) {

    queueLength = Math.max(
        0,
        Number(queueLength) || 0
    );

    serviceRate = Number(serviceRate);

    /*
     * Service rate = patients served per hour.
     *
     * Waiting time = queue / service rate × 60
     */

    if (!Number.isFinite(serviceRate) || serviceRate <= 0) {
        return null;
    }

    return Math.max(
        0,
        Math.round(
            (queueLength / serviceRate) * 60
        )
    );
}


// ============================================================
// UPDATE SERVICE RATE WAIT TIME
// ============================================================

function updateSimulationWaitTime() {

    const serviceRateInput =
        document.getElementById("serviceRate");

    if (!serviceRateInput) return;

    const serviceRate =
        Number(serviceRateInput.value);

    const queueLength =
        Math.max(
            0,
            Number(
                window.simulationState.queueLength
            ) || 0
        );

    const wait =
        calculateWaitFromServiceRate(
            queueLength,
            serviceRate
        );

    const waitEl =
        document.getElementById("waitTime");

    const recText =
        document.getElementById(
            "recommendationText"
        );

    if (wait === null) {

        if (waitEl) {
            waitEl.innerHTML =
                `Service unavailable`;
        }

        if (recText) {
            recText.textContent =
                "Service rate is unavailable. Waiting time cannot be estimated until service resumes.";
        }

        return;
    }


    if (waitEl) {

        waitEl.innerHTML =
            `${wait}` +
            `<span class="wait-unit"> min</span>`;
    }


    const level =
        calculateSimulationLevel(
            queueLength
        );


    if (recText) {

        recText.textContent =
            getRecommendation(
                level,
                wait
            );
    }


    const lastUpdated =
        document.getElementById(
            "lastUpdated"
        );


    if (
        lastUpdated &&
        window.simulationRunning
    ) {

        lastUpdated.textContent =
            `Simulation active — ` +
            `${queueLength} people • ` +
            `Service rate: ${serviceRate} patients/hour • ` +
            `Estimated wait: ${wait} min`;
    }
}


// ============================================================
// RENDER CROWD STATUS
// ============================================================

function renderCrowdStatus(queueStatus) {

    const level =
        queueStatus.crowd_level || "Low";

    const lvl =
        levelClass(level);

    const levelText =
        document.getElementById("levelText");

    const levelBadge =
        document.getElementById("levelBadge");

    const peopleEl =
        document.getElementById("peopleCount");

    const queueEl =
        document.getElementById("queueSize");

    const waitEl =
        document.getElementById("waitTime");

    const recText =
        document.getElementById(
            "recommendationText"
        );


    if (peopleEl) {
        peopleEl.textContent =
            String(
                queueStatus.people_currently_present ?? 0
            );
    }


    if (queueEl) {
        queueEl.textContent =
            String(
                queueStatus.queue_size ?? 0
            );
    }


    if (waitEl) {

        const simulationWait =
            window.simulationRunning
                ? calculateWaitFromServiceRate(
                    queueStatus.queue_size ?? 0,
                    document.getElementById(
                        "serviceRate"
                    )?.value
                )
                : null;


        if (simulationWait !== null) {

            waitEl.innerHTML =
                `${simulationWait}` +
                `<span class="wait-unit"> min</span>`;

        } else {

            waitEl.innerHTML =
                `${queueStatus.estimated_wait_minutes ?? 0}` +
                `<span class="wait-unit"> min</span>`;
        }
    }


    if (levelText) {

        levelText.textContent =
            level;

        levelText.className =
            `crowd-level-badge ${lvl}`;
    }


    if (levelBadge) {

        levelBadge.textContent =
            level;

        levelBadge.className =
            "card-badge " +
            (
                lvl === "low"
                    ? "badge-success"
                    : lvl === "moderate"
                        ? "badge-warning"
                        : "badge-danger"
            );
    }


    const dots = {

        low:
            document.getElementById("dotLow"),

        moderate:
            document.getElementById("dotModerate"),

        high:
            document.getElementById("dotHigh")
    };


    const labels = {

        low:
            document.getElementById("labelLow"),

        moderate:
            document.getElementById("labelModerate"),

        high:
            document.getElementById("labelHigh")
    };


    Object.values(dots).forEach(dot => {

        if (dot) {
            dot.classList.remove("lit");
        }
    });


    Object.values(labels).forEach(label => {

        if (label) {
            label.classList.remove(
                "active-label"
            );
        }
    });


    if (dots[lvl]) {
        dots[lvl].classList.add("lit");
    }


    if (labels[lvl]) {
        labels[lvl].classList.add(
            "active-label"
        );
    }


    if (recText) {

        const wait =
            window.simulationRunning
                ? calculateWaitFromServiceRate(
                    queueStatus.queue_size ?? 0,
                    document.getElementById(
                        "serviceRate"
                    )?.value
                )
                : Number(
                    queueStatus.estimated_wait_minutes ?? 0
                );


        recText.textContent =
            getRecommendation(
                level,
                wait ?? 0
            );
    }
}


// ============================================================
// TREND BARS
// ============================================================

function renderTrendBars(queueStatus) {

    const container =
        document.getElementById(
            "trendBars"
        );

    if (!container) return;


    const now =
        new Date();

    const currentHour =
        now.getHours();


    const current =
        Math.max(
            0,
            Number(
                queueStatus.queue_size ?? 0
            )
        );


    const hours =
        [-4, -3, -2, -1, 0].map(offset => {

            const h =
                (
                    (currentHour + offset) %
                    24 +
                    24
                ) % 24;


            const label =
                new Date(
                    0,
                    0,
                    0,
                    h
                ).toLocaleTimeString(
                    "en-US",
                    {
                        hour: "numeric"
                    }
                );


            return {
                hour: h,
                label
            };
        });


    const trend =
        hours.map((h, i) => {

            const isNow =
                i === hours.length - 1;


            const count =
                isNow
                    ? current
                    : Math.max(
                        0,
                        Math.round(
                            current *
                            (
                                0.55 +
                                0.12 * i
                            )
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


    const maxCount =
        Math.max(
            1,
            ...trend.map(d => d.count)
        );


    container.innerHTML = "";


    trend.forEach(d => {

        const wrap =
            document.createElement("div");


        wrap.className =
            "trend-bar-wrap";


        const heightPct =
            Math.max(
                8,
                Math.round(
                    (
                        d.count /
                        maxCount
                    ) * 100
                )
            );


        wrap.innerHTML =

            '<span class="trend-bar-val">' +
            d.count +
            "</span>" +

            '<div class="trend-bar ' +
            d.level +
            (d.current ? " current" : "") +
            '" style="height:' +
            heightPct +
            '%;"></div>' +

            '<span class="trend-bar-label">' +
            d.time +
            "</span>";


        container.appendChild(
            wrap
        );
    });
}


// ============================================================
// COUNTER DISTRIBUTION
// ============================================================

function renderCounters(queueStatus) {

    const grid =
        document.getElementById(
            "countersGrid"
        );

    if (!grid) return;


    grid.innerHTML = "";


    const queueSize =
        Math.max(
            0,
            Number(
                queueStatus.queue_size ?? 0
            )
        );


    const activeCounters =
        Math.max(
            1,
            Math.min(
                counters.length,
                Number(
                    queueStatus.active_counters ?? 4
                )
            )
        );


    const base =
        Math.floor(
            queueSize /
            activeCounters
        );


    const remainder =
        queueSize %
        activeCounters;


    counters.forEach(
        (counter, index) => {

            const active =
                index <
                activeCounters;


            const assigned =
                active
                    ? base +
                      (
                          index < remainder
                              ? 1
                              : 0
                      )
                    : 0;


            let status;


            if (!active) {

                status = "Closed";

            } else if (assigned === 0) {

                status = "Available";

            } else if (assigned >= 6) {

                status = "Overloaded";

            } else if (assigned >= 3) {

                status = "Busy";

            } else {

                status = "Available";
            }


            const badge =
                status === "Overloaded"
                    ? "badge-danger"
                    : status === "Busy"
                        ? "badge-warning"
                        : status === "Closed"
                            ? "badge-secondary"
                            : "badge-success";


            const card =
                document.createElement("div");


            card.className =
                "counter-card";


            card.innerHTML =

                '<div class="counter-card-header">' +

                    '<span class="counter-name">' +
                    counter.name +
                    "</span>" +

                    '<span class="card-badge ' +
                    badge +
                    '">' +
                    status +
                    "</span>" +

                "</div>" +

                '<span class="counter-service">' +
                counter.service +
                "</span>" +

                '<div class="counter-queue">' +
                (
                    active
                        ? `${assigned} people assigned`
                        : "Not active"
                ) +
                "</div>";


            grid.appendChild(card);
        }
    );
}


// ============================================================
// LAST UPDATED
// ============================================================

function updateLastUpdated() {

    const el =
        document.getElementById(
            "lastUpdated"
        );

    if (!el) return;


    const now =
        new Date();


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


// ============================================================
// LIVE STATUS
// ============================================================

async function refreshStatus() {

    /*
     * Refresh is intentionally independent.
     *
     * If simulation is active, do not overwrite
     * the simulation screen automatically.
     */

    if (window.simulationRunning) {
        return;
    }


    try {

        const queueStatus =
            await VIZITOR.getQueueStatus();


        if (!queueStatus) {
            return;
        }


        renderCrowdStatus(
            queueStatus
        );


        renderTrendBars(
            queueStatus
        );


        renderCounters(
            queueStatus
        );


        updateLastUpdated();


    } catch (error) {

        console.error(
            "Queue status refresh error:",
            error
        );
    }
}


// ============================================================
// SIMULATION WAIT TIME
// ============================================================

function calculateSimulationWait(
    queueLength,
    activeCounters
) {

    queueLength =
        Math.max(
            0,
            Number(queueLength) || 0
        );


    activeCounters =
        Math.max(
            1,
            Number(activeCounters) || 1
        );


    const peoplePerCounter =
        3;


    const capacity =
        activeCounters *
        peoplePerCounter;


    const wait =
        (
            queueLength /
            capacity
        ) * 5;


    return Math.max(
        0,
        Math.round(wait)
    );
}


// ============================================================
// CROWD LEVEL FOR SIMULATION
// ============================================================

function calculateSimulationLevel(
    queueLength
) {

    if (queueLength <= 5) {
        return "Low";
    }


    if (queueLength <= 15) {
        return "Moderate";
    }


    return "High";
}


// ============================================================
// RUN SIMULATION
// ============================================================

async function runSimulation(
    numUsers,
    simulationBtn
) {

    window.simulationRunning =
        true;


    simulationBtn.disabled =
        true;


    simulationBtn.textContent =
        "Running...";


    try {

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


        if (
            !data ||
            !Array.isArray(data.steps) ||
            data.steps.length === 0
        ) {

            throw new Error(
                "Backend returned no simulation steps."
            );
        }


        const steps =
            data.steps;


        console.log(
            "%c========== CROWD SIMULATION START ==========",
            "font-weight:bold;"
        );


        console.log(
            "Total simulated users:",
            numUsers
        );


        console.log(
            "Total simulation steps:",
            steps.length
        );


        for (
            let i = 0;
            i < steps.length;
            i++
        ) {

            const step =
                steps[i];


            console.log(
                `%c[CROWD SIMULATION] Step ${step.step}`,
                "font-weight:bold;",
                {
                    totalUsers:
                        numUsers,

                    usersProcessed:
                        step.users_processed,

                    queueLength:
                        step.queue_length,

                    activeCounters:
                        step.active_counters,

                    prediction:
                        step.prediction,

                    optimization:
                        step.optimization
                }
            );


            const queueLength =
                Math.max(
                    0,
                    Number(
                        step.queue_length ?? 0
                    )
                );


            if (
                !Number.isFinite(
                    queueLength
                )
            ) {

                throw new Error(
                    "Invalid queue length returned by backend."
                );
            }


            const optimization =
                step.optimization ||
                {};


            const activeCounters =
                Math.max(
                    1,
                    Number(
                        step.active_counters ??
                        4
                    )
                );


            /*
             * Store simulation state.
             *
             * Service rate is deliberately NOT
             * tied to the simulation backend.
             */

            window.simulationState.queueLength =
                queueLength;

            window.simulationState.activeCounters =
                activeCounters;


            const serviceRate =
                Number(
                    document.getElementById(
                        "serviceRate"
                    )?.value
                );


            const predictedWait =
                calculateWaitFromServiceRate(
                    queueLength,
                    serviceRate
                );


            const crowdLevel =
                calculateSimulationLevel(
                    queueLength
                );


            const simulatedStatus = {

                crowd_level:
                    crowdLevel,

                people_currently_present:
                    queueLength,

                queue_size:
                    queueLength,

                estimated_wait_minutes:
                    predictedWait ?? 0,

                active_counters:
                    activeCounters
            };


            renderCrowdStatus(
                simulatedStatus
            );


            renderTrendBars(
                simulatedStatus
            );


            renderCounters(
                simulatedStatus
            );


            const lastUpdated =
                document.getElementById(
                    "lastUpdated"
                );


            if (lastUpdated) {

                lastUpdated.textContent =
                    `Simulation: Step ${step.step} — ` +
                    `${queueLength}/${numUsers} people ` +
                    `in crowd model • ` +
                    (
                        predictedWait === null
                            ? "Service unavailable"
                            : `Estimated wait: ${predictedWait} min`
                    );
            }


            const recText =
                document.getElementById(
                    "recommendationText"
                );


            if (recText) {

                const action =
                    optimization
                        ?.recommended_action
                        ?.type;


                const reason =
                    optimization
                        ?.reason;


                if (action) {

                    recText.textContent =
                        `${action}: ` +
                        (
                            reason ||
                            `System recommends managing ${queueLength} people across ${activeCounters} active counters.`
                        );

                } else {

                    recText.textContent =
                        getRecommendation(
                            crowdLevel,
                            predictedWait ?? 0
                        );
                }
            }


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        700
                    )
            );
        }


        const finalStep =
            steps[
                steps.length - 1
            ];


        const finalQueue =
            Math.max(
                0,
                Number(
                    finalStep.queue_length ??
                    numUsers
                )
            );


        const finalActiveCounters =
            Math.max(
                1,
                Number(
                    finalStep.active_counters ??
                    4
                )
            );


        window.simulationState.queueLength =
            finalQueue;


        window.simulationState.activeCounters =
            finalActiveCounters;


        const serviceRate =
            Number(
                document.getElementById(
                    "serviceRate"
                )?.value
            );


        const finalWait =
            calculateWaitFromServiceRate(
                finalQueue,
                serviceRate
            );


        const finalLevel =
            calculateSimulationLevel(
                finalQueue
            );


        const finalStatus = {

            crowd_level:
                finalLevel,

            people_currently_present:
                finalQueue,

            queue_size:
                finalQueue,

            estimated_wait_minutes:
                finalWait ?? 0,

            active_counters:
                finalActiveCounters
        };


        renderCrowdStatus(
            finalStatus
        );


        renderTrendBars(
            finalStatus
        );


        renderCounters(
            finalStatus
        );


        const lastUpdated =
            document.getElementById(
                "lastUpdated"
            );


        if (lastUpdated) {

            lastUpdated.textContent =
                `Simulation Complete — ` +
                `${finalQueue}/${numUsers} people ` +
                `in crowd model • ` +
                (
                    finalWait === null
                        ? "Service unavailable"
                        : `Service rate: ${serviceRate} patients/hour • ` +
                          `Estimated wait: ${finalWait} min`
                );
        }


        console.log(
            "%c========== CROWD SIMULATION COMPLETE ==========",
            "font-weight:bold;"
        );


        console.log({
            totalUsers:
                numUsers,

            finalQueue:
                finalQueue,

            finalWaitMinutes:
                finalWait,

            serviceRate:
                serviceRate,

            activeCounters:
                finalActiveCounters
        });


    } catch (error) {

        console.error(
            "Simulation error:",
            error
        );


        alert(
            `Could not run simulation.\n\n` +
            `${error?.message || "Unknown error"}`
        );


        window.simulationRunning =
            false;


    } finally {

        simulationBtn.disabled =
            false;

        simulationBtn.textContent =
            "Run Simulation";
    }
}


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            typeof VIZITOR !== "undefined" &&
            VIZITOR.wireCommonNav
        ) {

            VIZITOR.wireCommonNav();
        }


        refreshStatus();


        setInterval(
            () => {

                if (
                    !window.simulationRunning
                ) {

                    refreshStatus();
                }

            },
            20000
        );


        // --------------------------------------------------------
        // REFRESH BUTTON
        // --------------------------------------------------------

        const refreshBtn =
            document.getElementById(
                "btnRefresh"
            );


        if (refreshBtn) {

            refreshBtn.addEventListener(
                "click",
                async () => {

                    /*
                     * Manual refresh is independent.
                     * It returns to live backend data.
                     */

                    window.simulationRunning =
                        false;


                    await refreshStatus();
                }
            );
        }


        // --------------------------------------------------------
        // SIMULATION BUTTON
        // --------------------------------------------------------

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

                    if (
                        window.simulationRunning
                    ) {

                        return;
                    }


                    const numUsers =
                        Number(
                            simulationInput.value
                        );


                    if (
                        !Number.isInteger(
                            numUsers
                        ) ||
                        numUsers < 1 ||
                        numUsers > 500
                    ) {

                        alert(
                            "Enter a whole number between 1 and 500."
                        );

                        return;
                    }


                    await runSimulation(
                        numUsers,
                        simulationBtn
                    );
                }
            );
        }


        // --------------------------------------------------------
        // SERVICE RATE — COMPLETELY INDEPENDENT
        // --------------------------------------------------------

        const serviceRateInput =
            document.getElementById(
                "serviceRate"
            );


        if (serviceRateInput) {

            serviceRateInput.addEventListener(
                "input",
                () => {

                    /*
                     * This ONLY changes the waiting-time
                     * calculation.
                     *
                     * It does not run another simulation.
                     * It does not add people.
                     * It does not call Refresh Status.
                     */

                    if (
                        !window.simulationRunning
                    ) {
                        return;
                    }


                    const serviceRate =
                        Number(
                            serviceRateInput.value
                        );


                    window.simulationState.serviceRate =
                        serviceRate;


                    updateSimulationWaitTime();
                }
            );
        }
    }
);