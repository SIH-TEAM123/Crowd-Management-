// ============================================================
// VIZITOR — Crowd Status
//
// Real queue remains backend-authoritative.
// Simulation creates a temporary overlay on the real queue.
//
// Example:
// Real serving = A-114
// Synthetic users = 50
// Simulated serving = A-115
// Simulated user token = A-164
//
// Refresh Status clears the overlay.
// ============================================================


const counters = [

    {
        name: "Counter 1",
        service: "General Consultation"
    },

    {
        name: "Counter 2",
        service: "Document Verification"
    },

    {
        name: "Counter 3",
        service: "Health Screening"
    },

    {
        name: "Counter 4",
        service: "ID & License Services"
    }
];


window.simulationRunning =
    false;


// ============================================================
// CROWD LEVEL
// ============================================================

function calculateLevel(queue) {

    queue =
        Math.max(
            0,
            Number(queue) || 0
        );

    if (queue <= 0) {
        return "No Crowd";
    }

    if (queue <= 5) {
        return "Low";
    }

    if (queue <= 15) {
        return "Moderate";
    }

    return "High";
}


function levelClass(level) {

    if (level === "High") {
        return "high";
    }

    if (level === "Moderate") {
        return "moderate";
    }

    return "low";
}


// ============================================================
// RENDER CROWD STATUS
// ============================================================

function renderCrowdStatus(
    queueStatus
) {

    const queueSize =
        Number(
            queueStatus.queue_size ?? 0
        );

    const level =
        queueStatus.crowd_level ||
        calculateLevel(queueSize);

    const levelClassName =
        levelClass(level);


    const peopleEl =
        document.getElementById(
            "peopleCount"
        );

    const queueEl =
        document.getElementById(
            "queueSize"
        );

    const waitEl =
        document.getElementById(
            "waitTime"
        );

    const levelText =
        document.getElementById(
            "levelText"
        );

    const levelBadge =
        document.getElementById(
            "levelBadge"
        );

    const recommendation =
        document.getElementById(
            "recommendationText"
        );


    if (peopleEl) {

        peopleEl.textContent =
            String(
                queueStatus.people_currently_present ??
                queueSize
            );
    }


    if (queueEl) {

        queueEl.textContent =
            String(
                queueSize
            );
    }


    if (waitEl) {

        waitEl.innerHTML =
            `${Math.max(
                0,
                Math.ceil(
                    Number(
                        queueStatus.estimated_wait_minutes ??
                        0
                    )
                )
            )}` +
            `<span class="wait-unit"> min</span>`;
    }


    if (levelText) {

        levelText.textContent =
            level;

        levelText.className =
            `crowd-level-badge ${levelClassName}`;
    }


    if (levelBadge) {
        if (typeof VIZITOR !== "undefined" && typeof VIZITOR.renderCrowdBadge === "function") {
            VIZITOR.renderCrowdBadge(levelBadge, level, queueSize);
        } else {
            levelBadge.textContent =
                level;

            levelBadge.className =
                "card-badge " +
                (
                    levelClassName === "low"
                        ? "badge-success"
                        : levelClassName === "moderate"
                            ? "badge-warning"
                            : "badge-danger"
                );
        }
    }


    const dots = {

        low:
            document.getElementById(
                "dotLow"
            ),

        moderate:
            document.getElementById(
                "dotModerate"
            ),

        high:
            document.getElementById(
                "dotHigh"
            )
    };


    const labels = {

        low:
            document.getElementById(
                "labelLow"
            ),

        moderate:
            document.getElementById(
                "labelModerate"
            ),

        high:
            document.getElementById(
                "labelHigh"
            )
    };


    Object.values(dots)
        .forEach(
            dot => {

                if (dot) {
                    dot.classList.remove(
                        "lit"
                    );
                }
            }
        );


    Object.values(labels)
        .forEach(
            label => {

                if (label) {
                    label.classList.remove(
                        "active-label"
                    );
                }
            }
        );


    if (dots[levelClassName]) {

        dots[levelClassName]
            .classList.add(
                "lit"
            );
    }


    if (labels[levelClassName]) {

        labels[levelClassName]
            .classList.add(
                "active-label"
            );
    }


    if (recommendation) {

        if (
            queueStatus.simulation_called
        ) {

            recommendation.textContent =
                `Your token is being served. Proceed to Counter ${queueStatus.counter_number || 1}.`;

        } else {

            recommendation.textContent =
                `${level} crowd. Current estimated waiting time is ${queueStatus.estimated_wait_minutes ?? 0} minutes.`;
        }
    }
}


// ============================================================
// TREND
// ============================================================

function renderTrendBars(
    queueStatus
) {

    const container =
        document.getElementById(
            "trendBars"
        );

    if (!container) {
        return;
    }


    const current =
        Math.max(
            0,
            Number(
                queueStatus.queue_size ?? 0
            )
        );


    const now =
        new Date();


    const currentHour =
        now.getHours();


    const trend =
        [-4, -3, -2, -1, 0]
            .map(
                (offset, index) => {

                    const hour =
                        (
                            currentHour +
                            offset +
                            24
                        ) % 24;

                    const label =
                        new Date(
                            2000,
                            0,
                            1,
                            hour
                        ).toLocaleTimeString(
                            "en-US",
                            {
                                hour: "numeric"
                            }
                        );

                    const count =
                        index === 4
                            ? current
                            : Math.max(
                                0,
                                Math.round(
                                    current *
                                    (
                                        0.55 +
                                        index *
                                        0.10
                                    )
                                )
                            );

                    return {
                        label,
                        count,
                        level:
                            calculateLevel(
                                count
                            ),
                        current:
                            index === 4
                    };
                }
            );


    const max =
        Math.max(
            1,
            ...trend.map(
                item => item.count
            )
        );


    container.innerHTML = "";


    trend.forEach(
        item => {

            const wrap =
                document.createElement(
                    "div"
                );

            wrap.className =
                "trend-bar-wrap";


            const height =
                Math.max(
                    8,
                    Math.round(
                        item.count /
                        max *
                        100
                    )
                );


            const level =
                levelClass(
                    item.level
                );


            wrap.innerHTML =

                `<span class="trend-bar-val">
                    ${item.count}
                </span>` +

                `<div class="trend-bar ${level}${item.current ? " current" : ""}"
                      style="height:${height}%;">
                </div>` +

                `<span class="trend-bar-label">
                    ${item.label}
                </span>`;


            container.appendChild(
                wrap
            );
        }
    );
}


// ============================================================
// COUNTERS
// ============================================================

function renderCounters(
    queueStatus
) {

    const grid =
        document.getElementById(
            "countersGrid"
        );

    if (!grid) {
        return;
    }


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
                    queueStatus.active_counters ??
                    4
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
                            index <
                            remainder
                                ? 1
                                : 0
                        )
                    : 0;


            let status;

            if (!active) {

                status = "Closed";

            } else if (
                assigned >= 6
            ) {

                status = "Overloaded";

            } else if (
                assigned >= 3
            ) {

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
                document.createElement(
                    "div"
                );


            card.className =
                "counter-card";


            card.innerHTML =

                `<div class="counter-card-header">

                    <span class="counter-name">
                        ${counter.name}
                    </span>

                    <span class="card-badge ${badge}">
                        ${status}
                    </span>

                </div>

                <span class="counter-service">
                    ${counter.service}
                </span>

                <div class="counter-queue">
                    ${
                        active
                            ? `${assigned} people assigned`
                            : "Not active"
                    }
                </div>`;


            grid.appendChild(
                card
            );
        }
    );
}


// ============================================================
// LAST UPDATED
// ============================================================

function updateLastUpdated(
    queueStatus
) {

    const element =
        document.getElementById(
            "lastUpdated"
        );

    if (!element) {
        return;
    }


    if (
        queueStatus.simulation_active
    ) {

        if (
            queueStatus.simulation_called
        ) {

            element.textContent =
                `Simulation active — Token ${queueStatus.user_simulated_token} is being served. Proceed to Counter ${queueStatus.counter_number || 1}.`;

        } else {

            element.textContent =
                `Simulation active — real token ${queueStatus.real_user_token || "--"} • simulated token ${queueStatus.user_simulated_token || "--"} • ${queueStatus.estimated_wait_minutes} min remaining.`;
        }

        return;
    }


    element.textContent =
        `Last updated: ${new Date().toLocaleTimeString(
            "en-US",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )} — live backend data.`;
}


// ============================================================
// RENDER EVERYTHING
// ============================================================

function renderEverything(
    queueStatus
) {

    renderCrowdStatus(
        queueStatus
    );

    renderTrendBars(
        queueStatus
    );

    renderCounters(
        queueStatus
    );

    updateLastUpdated(
        queueStatus
    );
}


// ============================================================
// REAL STATUS
// ============================================================

async function refreshStatus() {

    try {

        const status =
            await VIZITOR.getQueueStatus();

        if (!status) {
            return;
        }

        renderEverything(
            status
        );

    } catch (error) {

        console.error(
            "Queue status refresh error:",
            error
        );
    }
}


// ============================================================
// GET PERSON 3 FORECAST
// ============================================================

async function getPerson3Forecast(
    realStatus
) {

    try {

        const you =
            realStatus?.you || {};


        const appointments =
            await VIZITOR.getAppointments();


        const currentAppointment =
            appointments.find(
                appointment =>
                    String(
                        appointment.appointment_id
                    ) ===
                    String(
                        you.appointment_id
                    )
            );


        const now =
            new Date();


        const recentArrivals =
            Math.max(
                1,
                Number(
                    realStatus.queue_size ??
                    1
                )
            );


        const recentServices =
            Math.max(
                1,
                Number(
                    realStatus.served_so_far ??
                    1
                )
            );


        const response =
            await fetch(
                `${API_BASE_URL}/optimization/forecast`,
                {
                    method: "GET",
                    headers:
                        VIZITOR.authHeaders()
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `Person 3 forecast HTTP ${response.status}`
            );
        }


        const forecast =
            await response.json();


        return {

            predicted_wait_minutes:
                Number(
                    forecast
                        ?.prediction
                        ?.predicted_wait_minutes ??
                    realStatus.estimated_wait_minutes ??
                    0
                ),

            prediction_confidence:
                Number(
                    forecast
                        ?.prediction
                        ?.prediction_confidence ??
                    0
                ),

            predicted_queue_length:
                Number(
                    forecast
                        ?.prediction
                        ?.predicted_queue_length ??
                    realStatus.queue_size ??
                    0
                ),

            currentAppointment,

            now,

            recentArrivals,

            recentServices
        };

    } catch (error) {

        console.warn(
            "Person 3 forecast unavailable; using live queue wait:",
            error
        );

        return {

            predicted_wait_minutes:
                Number(
                    realStatus.estimated_wait_minutes ??
                    0
                ),

            prediction_confidence:
                0,

            predicted_queue_length:
                Number(
                    realStatus.queue_size ??
                    0
                )
        };
    }
}


// ============================================================
// START SIMULATION
// ============================================================

async function runSimulation(
    syntheticUsers,
    button
) {

    button.disabled = true;

    button.textContent =
        "Starting...";


    try {

        // ------------------------------------------------------
        // ALWAYS capture the REAL backend state first.
        // ------------------------------------------------------

        const realStatus =
            await VIZITOR.apiGet(
                "/appointments/queue/status"
            );


        if (!realStatus) {

            throw new Error(
                "Unable to read the real queue before simulation."
            );
        }


        const realYou = realStatus.you;

        const baseTokenNum = realStatus.currently_serving_number || 112;
        const realUserToken = realYou ? realYou.token_display : ("A-" + (baseTokenNum + (realStatus.queue_size || 0) + 1));
        const realServingToken = realStatus.currently_serving_token || ("A-" + baseTokenNum);
        const realAppointmentId = realYou ? realYou.appointment_id : null;
        const realPurpose = realYou ? realYou.purpose : "General Consultation";
        const realApptDate = realYou ? realYou.appointment_date : new Date().toISOString().split("T")[0];
        const realApptTime = realYou ? realYou.appointment_time : "10:00:00";


        // ------------------------------------------------------
        // Person 3 prediction
        // ------------------------------------------------------

        button.textContent =
            "Loading prediction...";


        const forecast =
            await getPerson3Forecast(
                realStatus
            );


        // ------------------------------------------------------
        // Calculate temporary simulation wait.
        //
        // Synthetic users are inserted ahead of the user's
        // real appointment.
        // ------------------------------------------------------

        const serviceRate =
            Number(
                document.getElementById(
                    "serviceRate"
                )?.value ||
                10
            );


        const rate =
            Math.max(
                0.01,
                serviceRate
            );


        /*
         * Synthetic users ahead of the appointment.
         *
         * At 10 patients/hour:
         * 50 people = 300 minutes.
         *
         * The actual countdown is based on elapsed real time.
         */

        const serviceMinutesPerPerson =
            60 / rate;


        const syntheticWait =
            syntheticUsers *
            serviceMinutesPerPerson;


        /*
         * Person 3 gives the facility prediction.
         * We combine the predicted wait with the synthetic
         * queue workload so the simulation remains grounded
         * in the ML source while representing the requested
         * temporary crowd insertion.
         */

        const predictedBaseWait =
            Math.max(
                0,
                Number(
                    forecast.predicted_wait_minutes ??
                    0
                )
            );


        const initialWait =
            Math.max(
                predictedBaseWait,
                syntheticWait
            );


        const startedAt =
            new Date();


        // ------------------------------------------------------
        // Save temporary overlay.
        // ------------------------------------------------------

        await VIZITOR.startSimulation(syntheticUsers, serviceMinutesPerPerson);

        VIZITOR.setSimulationState({

            real_user_token:
                realUserToken,

            real_serving_token:
                realServingToken,

            real_appointment_id:
                realAppointmentId,

            real_purpose:
                realPurpose,

            real_appointment_date:
                realApptDate,

            real_appointment_time:
                realApptTime,

            base_queue_size:
                Number(
                    realStatus.queue_size ??
                    0
                ),

            base_people_present:
                Number(
                    realStatus.people_currently_present ??
                    realStatus.queue_size ??
                    0
                ),

            synthetic_users:
                syntheticUsers,

            initial_wait_minutes:
                initialWait,

            estimated_wait_minutes:
                initialWait,

            service_rate:
                rate,

            minutes_per_person:
                serviceMinutesPerPerson,

            active_counters:
                Number(
                    realStatus.active_counters ??
                    1
                ),

            counter_number:
                1,

            crowd_level:
                calculateLevel(
                    Number(
                        realStatus.queue_size ??
                        0
                    ) +
                    syntheticUsers
                ),

            served_so_far:
                Number(
                    realStatus.served_so_far ??
                    0
                ),

            prediction_confidence:
                Number(
                    forecast.prediction_confidence ??
                    0
                ),

            predicted_queue_length:
                Number(
                    forecast.predicted_queue_length ??
                    0
                ),

            started_at:
                startedAt.toISOString(),

            started_at_ms:
                startedAt.getTime(),

            simulation_step:
                0
        });


        window.simulationRunning =
            true;


        button.textContent =
            "Simulation Active";


        await refreshSimulationDisplay();


    } catch (error) {

        console.error(
            "Simulation error:",
            error
        );


        alert(
            `Could not start simulation.\n\n${error.message}`
        );


    } finally {

        button.disabled =
            false;

        if (
            !VIZITOR.isSimulationActive()
        ) {

            button.textContent =
                "Run Simulation";

            window.simulationRunning =
                false;
        }
    }
}


// ============================================================
// LIVE SIMULATION DISPLAY
// ============================================================

async function refreshSimulationDisplay() {

    const simulation =
        VIZITOR.getSimulationState();


    if (!simulation) {

        window.simulationRunning =
            false;

        await refreshStatus();

        return;
    }


    window.simulationRunning =
        true;


    const status =
        VIZITOR.buildSimulationQueueStatus(
            simulation
        );


    renderEverything(
        status
    );


    // ----------------------------------------------------------
    // Called notification
    // ----------------------------------------------------------

    if (
        status.simulation_called
    ) {

        const calledKey =
            `called-${status.user_simulated_token}-${status.real_appointment_id}`;


        if (
            localStorage.getItem(
                "vizitor_last_sim_called"
            ) !==
            calledKey
        ) {

            localStorage.setItem(
                "vizitor_last_sim_called",
                calledKey
            );


            VIZITOR.addNotificationEvent({

                id:
                    calledKey,

                category:
                    "queue",

                title:
                    "Your Token Is Being Called",

                message:
                    `Token ${status.user_simulated_token} is now being served. Proceed to Counter ${status.counter_number || 1}.`,

                important:
                    true
            });
        }
    }


    const simulationButton =
        document.getElementById(
            "btnSimulation"
        );


    if (simulationButton) {

        simulationButton.textContent =
            status.simulation_called
                ? "Called — Simulation Active"
                : "Simulation Active";
    }
}


// ============================================================
// REFRESH / CLEAR SIMULATION
// ============================================================

async function clearSimulationAndRefresh() {

    window.simulationRunning =
        false;

    VIZITOR.clearSimulationState();

    localStorage.removeItem(
        "vizitor_last_sim_called"
    );


    const button =
        document.getElementById(
            "btnSimulation"
        );

    if (button) {

        button.textContent =
            "Run Simulation";
    }


    await refreshStatus();
}


// ============================================================
// PAGE INIT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        VIZITOR.wireCommonNav();


        refreshStatus();


        // ------------------------------------------------------
        // One-second live update.
        // This makes the displayed simulation wait decrease with
        // actual elapsed time rather than animation speed.
        // ------------------------------------------------------

        setInterval(
            async () => {

                if (
                    VIZITOR.isSimulationActive()
                ) {

                    await refreshSimulationDisplay();

                } else {

                    await refreshStatus();
                }

            },
            1000
        );


        // ------------------------------------------------------
        // Refresh Status
        // ------------------------------------------------------

        const refreshButton =
            document.getElementById(
                "btnRefresh"
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                clearSimulationAndRefresh
            );
        }


        // ------------------------------------------------------
        // Simulation button
        // ------------------------------------------------------

        const simulationButton =
            document.getElementById(
                "btnSimulation"
            );

        const simulationInput =
            document.getElementById(
                "simulationUsers"
            );


        if (
            simulationButton &&
            simulationInput
        ) {

            simulationButton.addEventListener(
                "click",
                async () => {

                    if (
                        VIZITOR.isSimulationActive()
                    ) {

                        return;
                    }


                    const users =
                        Number(
                            simulationInput.value
                        );


                    if (
                        !Number.isInteger(users) ||
                        users < 1 ||
                        users > 500
                    ) {

                        alert(
                            "Enter a whole number between 1 and 500."
                        );

                        return;
                    }


                    await runSimulation(
                        users,
                        simulationButton
                    );
                }
            );
        }


        // ------------------------------------------------------
        // Service rate
        // ------------------------------------------------------

        const serviceRate =
            document.getElementById(
                "serviceRate"
            );


        if (serviceRate) {

            serviceRate.addEventListener(
                "change",
                () => {

                    /*
                     * Do not alter the real appointment.
                     * Re-running simulation is required to use
                     * a different service rate.
                     */

                    if (
                        VIZITOR.isSimulationActive()
                    ) {

                        serviceRate.title =
                            "Service rate is fixed for the current simulation. Refresh Status and run again to change it.";
                    }
                }
            );
        }
    }
);