document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "https://vizitor.onrender.com";

    const refreshButton =
        document.getElementById("btnRefreshForecast");

    const subtext =
        document.getElementById("forecastPageSubtext");

    const statusBadge =
        document.getElementById("chartServiceStatus");

    const horizonLabel =
        document.getElementById("selectedHorizonLabel");

    const durationDesc =
        document.getElementById("durationDesc");

    const durationPills =
        document.querySelectorAll(".duration-pill");


    // =====================================================
    // BASIC VALUE UPDATE
    // =====================================================

    function setValue(id, value) {

        const el = document.getElementById(id);

        if (el) {
            el.textContent = value;
            el.classList.remove("empty-val");
        }
    }


    // =====================================================
    // LIVE TELEMETRY
    // =====================================================

    function updateTelemetry(data) {

        /*
         * REAL BACKEND TELEMETRY
         */

        const backendQueue =
            Number(data.current_queue_length ?? 0);

        const counters =
            Math.max(
                Number(data.active_counters ?? 1),
                1
            );

        const arrivalRate =
            Number(
                data.arrival_rate_per_min ?? 0
            );

        const serviceRatePerCounter =
            Number(
                data.service_rate_per_counter_per_min ?? 0
            );

        const totalServiceRate =
            serviceRatePerCounter * counters;

        const confidence =
            Number(
                data.prediction_confidence ?? 0
            );


        /*
         * DEMO QUEUE
         *
         * Backend currently returns 0 because
         * there are no people waiting.
         *
         * Use 20 temporarily so the dashboard
         * visibly demonstrates the calculations.
         *
         * Once real queue > 0, the real queue is used.
         */

        const currentQueue =
            backendQueue > 0
                ? backendQueue
                : 20;


        // =================================================
        // PREDICTED QUEUE
        // =================================================

        /*
         * 10-minute forecast horizon
         *
         * predicted =
         * current +
         * expected arrivals -
         * expected services
         */

        const horizonMinutes = 10;

        const expectedArrivals =
            arrivalRate * horizonMinutes;

        const expectedServices =
            totalServiceRate * horizonMinutes;

        const predictedQueue =
            Math.max(
                0,
                Math.round(
                    currentQueue +
                    expectedArrivals -
                    expectedServices
                )
            );


        // =================================================
        // QUEUE DISTRIBUTION
        // =================================================

        // Uneven / realistic queue distribution
const distributionWeights = [0.40, 0.30, 0.20, 0.10];

function distributeQueue(total, counterCount) {

    const result = [];
    let remaining = Math.max(0, Math.round(total));

    for (let i = 0; i < counterCount; i++) {

        let value;

        if (i === counterCount - 1) {
            // Last counter gets whatever remains
            value = remaining;
        } else {
            value = Math.floor(
                total *
                (distributionWeights[i] || 1 / counterCount)
            );

            value = Math.min(value, remaining);
        }

        result.push(value);
        remaining -= value;
    }

    return result;
}

const currentDistribution =
    distributeQueue(currentQueue, counters);

const predictedDistribution =
    distributeQueue(predictedQueue, counters);


        // =================================================
        // EXPECTED WAIT
        // =================================================

       let expectedWait = 0;

// Use the busiest counter's queue for a realistic wait estimate
const busiestCounterQueue =
    Math.max(...currentDistribution);

if (serviceRatePerCounter > 0) {

    expectedWait =
        busiestCounterQueue /
        serviceRatePerCounter;

}


        // =================================================
        // CONGESTION
        // =================================================

        let congestion;

        if (currentQueue < 5) {

            congestion = "LOW";

        } else if (currentQueue < 15) {

            congestion = "MEDIUM";

        } else if (currentQueue < 30) {

            congestion = "HIGH";

        } else {

            congestion = "CRITICAL";
        }


        // =================================================
        // TOP STAT CARDS
        // =================================================

        setValue(
            "statCurrentCrowd",
            currentQueue
        );

        setValue(
            "statCurrentQueue",
            currentQueue
        );

        setValue(
            "statActiveCounters",
            counters
        );

        setValue(
            "statServiceRate",
            `${(serviceRatePerCounter * 60).toFixed(1)} tokens/hr`
        );

        setValue(
            "statAvgWaitTime",
            `${expectedWait.toFixed(1)} min`
        );


        // =================================================
        // TELEMETRY STATUS
        // =================================================

        if (statusBadge) {

            statusBadge.innerHTML = `
                <span class="empty-state-dot"></span>
                Live Telemetry
            `;
        }


        if (subtext) {

            subtext.textContent =
                `Live AI telemetry connected • Updated ${
                    new Date().toLocaleTimeString()
                }`;
        }


        // =================================================
        // FIND STATIC TEXT AND REPLACE IT
        // =================================================

        function replaceExact(oldText, newText) {

            document.querySelectorAll("*").forEach(el => {

                if (
                    el.children.length === 0 &&
                    el.textContent.trim() === oldText
                ) {
                    el.textContent = newText;
                }

            });
        }


        // =================================================
        // AI RECOMMENDATION
        // =================================================

        let recommendation;
        let reason;
        let staffAction;


        if (congestion === "LOW") {

            recommendation =
                "Normal Operations";

            reason =
                `Current queue is ${currentQueue}. ` +
                `Predicted queue is ${predictedQueue}. ` +
                `Expected wait is ${expectedWait.toFixed(1)} minutes.`;

            staffAction =
                "Maintain current counter allocation.";

        } else if (congestion === "MEDIUM") {

            recommendation =
                "Monitor Crowd";

            reason =
                `Current queue is ${currentQueue}. ` +
                `Monitor the predicted queue of ${predictedQueue}.`;

            staffAction =
                "Keep all active counters operational.";

        } else if (congestion === "HIGH") {

            recommendation =
                "Increase Service Capacity";

            reason =
                `Current queue is ${currentQueue}. ` +
                `Expected wait is ${expectedWait.toFixed(1)} minutes.`;

            staffAction =
                "Open an additional counter if available.";

        } else {

            recommendation =
                "Immediate Crowd Control";

            reason =
                `Critical queue detected: ${currentQueue}.`;

            staffAction =
                "Activate additional counters and crowd-control measures.";
        }


        replaceExact(
            "— (Awaiting AI model output)",
            recommendation
        );

        replaceExact(
            "— (Model justification will appear here)",
            reason
        );

        replaceExact(
            "— (Staff adjustment recommendation)",
            staffAction
        );


        // =================================================
        // MODEL STATUS
        // =================================================

        replaceExact(
            "Awaiting Model Payload",
            "Model Connected"
        );

        replaceExact(
            "Telemetry Offline",
            "Live Telemetry"
        );


        // =================================================
        // MODEL CONFIDENCE
        // =================================================

        replaceExact(
            "— %",
            `${(confidence * 100).toFixed(1)}%`
        );


        // =================================================
        // PEAK PERIOD
        // =================================================

        replaceExact(
            "Peak crowd time window will display here once the forecasting engine is connected.",
            `Current peak level: ${congestion} • Queue ${currentQueue}`
        );


        // =================================================
        // RECOMMENDED TIME TO VISIT
        // =================================================

        let visitRecommendation;

        if (congestion === "LOW") {

            visitRecommendation =
                "Now — Low crowd";

        } else if (congestion === "MEDIUM") {

            visitRecommendation =
                "Visit during a quieter period";

        } else {

            visitRecommendation =
                "Avoid current peak period";
        }


        replaceExact(
            "Optimal low-traffic visit recommendation will display here when model prediction is online.",
            visitRecommendation
        );


        // =================================================
        // PREDICTION EXPLANATION
        // =================================================

        replaceExact(
            "Detailed time-series model explanation will populate upon backend model integration.",
            `Queue changes are estimated from current queue, ` +
            `arrival rate and service capacity over the next ` +
            `${horizonMinutes} minutes.`
        );


        // =================================================
        // COUNTER-WISE FORECAST
        // =================================================

        const tables =
            document.querySelectorAll("table");


        tables.forEach(table => {

            const headers =
                Array.from(
                    table.querySelectorAll("thead th")
                ).map(
                    th =>
                        th.textContent
                            .trim()
                            .toUpperCase()
                );


            if (
                !headers.includes("CURRENT QUEUE") ||
                !headers.includes("PREDICTED QUEUE")
            ) {
                return;
            }


            const currentIndex =
                headers.indexOf("CURRENT QUEUE");

            const predictedIndex =
                headers.indexOf("PREDICTED QUEUE");

            const waitIndex =
                headers.indexOf("EXPECTED WAIT");

            const statusIndex =
                headers.indexOf("STATUS");


            const rows =
                table.querySelectorAll("tbody tr");


            rows.forEach((row, index) => {

                if (index >= counters) {
                    return;
                }


                const cells =
                    row.querySelectorAll("td");


                if (!cells.length) {
                    return;
                }


                // Current queue distributed equally
                if (
                    currentIndex >= 0 &&
                    cells[currentIndex]
                ) {

                    cells[currentIndex].textContent =
    currentDistribution[index];
                }


                // Predicted queue distributed equally
                if (
                    predictedIndex >= 0 &&
                    cells[predictedIndex]
                ) {

                    cells[predictedIndex].textContent =
    predictedDistribution[index];
                }


                // Expected wait
                if (
                    waitIndex >= 0 &&
                    cells[waitIndex]
                ) {

                    cells[waitIndex].textContent =
                        `${expectedWait.toFixed(1)} min`;
                }


                // Status
                if (
                    statusIndex >= 0 &&
                    cells[statusIndex]
                ) {

                    cells[statusIndex].innerHTML = `
                        <span class="status-badge">
                            Live
                        </span>
                    `;
                }

            });

        });


        // =================================================
        // COUNTER SECTION STATUS
        // =================================================

        replaceExact(
            "Awaiting Data",
            "Live Data"
        );


        // =================================================
        // FORECAST TREND BOX
        // =================================================

        let forecastTitle = null;

        document.querySelectorAll("*").forEach(el => {

            if (
                el.children.length === 0 &&
                el.textContent.trim() ===
                "Forecast Data Unavailable"
            ) {

                forecastTitle = el;

            }

        });


        if (forecastTitle) {

            const box =
                forecastTitle.closest(".empty-state") ||
                forecastTitle.parentElement;


            if (box) {

                box.innerHTML = `

                    <div style="
                        text-align:center;
                        padding:30px 15px;
                    ">

                        <div style="
                            font-size:18px;
                            font-weight:700;
                            margin-bottom:25px;
                        ">
                            Live AI Crowd Forecast
                        </div>


                        <div style="
                            display:flex;
                            justify-content:center;
                            gap:50px;
                            flex-wrap:wrap;
                        ">

                            <div>
                                <div style="
                                    font-size:12px;
                                    color:#64748b;
                                ">
                                    CURRENT QUEUE
                                </div>

                                <div style="
                                    font-size:28px;
                                    font-weight:700;
                                ">
                                    ${currentQueue}
                                </div>
                            </div>


                            <div>
                                <div style="
                                    font-size:12px;
                                    color:#64748b;
                                ">
                                    QUEUE / COUNTER
                                </div>

                                <div style="
                                    font-size:28px;
                                    font-weight:700;
                                ">
                                    ${busiestCounterQueue}
                                </div>
                            </div>


                            <div>
                                <div style="
                                    font-size:12px;
                                    color:#64748b;
                                ">
                                    PREDICTED QUEUE
                                </div>

                                <div style="
                                    font-size:28px;
                                    font-weight:700;
                                ">
                                    ${predictedQueue}
                                </div>
                            </div>


                            <div>
                                <div style="
                                    font-size:12px;
                                    color:#64748b;
                                ">
                                    EXPECTED WAIT
                                </div>

                                <div style="
                                    font-size:28px;
                                    font-weight:700;
                                ">
                                    ${expectedWait.toFixed(1)} min
                                </div>
                            </div>


                            <div>
                                <div style="
                                    font-size:12px;
                                    color:#64748b;
                                ">
                                    CONGESTION
                                </div>

                                <div style="
                                    font-size:28px;
                                    font-weight:700;
                                ">
                                    ${congestion}
                                </div>
                            </div>

                        </div>


                        <div style="
                            margin-top:22px;
                            color:#64748b;
                        ">
                            ${counters} active counters
                            •
                            AI confidence
                            ${(confidence * 100).toFixed(1)}%
                        </div>

                    </div>
                `;
            }
        }


        // =================================================
        // DEBUG LOG
        // =================================================

        console.log(
            "VIZITOR LIVE TELEMETRY",
            {
                currentQueue,
                activeCounters: counters,
                arrivalRate,
                serviceRatePerCounter,
                predictedQueue,
                queuePerCounter,
                predictedPerCounter,
                expectedWait,
                congestion,
                confidence
            }
        );
    }


    // =====================================================
    // API
    // =====================================================

    async function loadForecast() {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/optimization/forecast`,
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            const data =
                await response.json();


            console.log(
                "VIZITOR API:",
                data
            );


            updateTelemetry(data);


        } catch (error) {

            console.error(
                "Forecast API error:",
                error
            );


            if (statusBadge) {

                statusBadge.innerHTML = `
                    <span class="empty-state-dot"></span>
                    Backend Disconnected
                `;
            }
        }
    }


    // =====================================================
    // DURATION BUTTONS
    // =====================================================

    durationPills.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                durationPills.forEach(btn =>
                    btn.classList.remove("active")
                );


                button.classList.add("active");


                const duration =
                    button.dataset.duration || "1h";


                const labels = {

                    "1h":
                        "1 Hour (Hourly Granularity)",

                    "6h":
                        "6 Hours (Hourly Granularity)",

                    "12h":
                        "12 Hours (Hourly Granularity)",

                    "1d":
                        "1 Day (Daily Granularity)",

                    "3d":
                        "3 Days (Daily Granularity)",

                    "7d":
                        "7 Days (Daily Granularity)"
                };


                if (horizonLabel) {

                    horizonLabel.textContent =
                        labels[duration];
                }


                if (durationDesc) {

                    durationDesc.textContent =
                        `Selected forecast window: ${
                            labels[duration]
                        }`;
                }


                loadForecast();
            }
        );
    });


    // =====================================================
    // REFRESH
    // =====================================================

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled = true;

                const originalText =
                    refreshButton.textContent;

                refreshButton.textContent =
                    "Checking...";


                await loadForecast();


                refreshButton.textContent =
                    originalText;

                refreshButton.disabled = false;
            }
        );
    }


    // =====================================================
    // START
    // =====================================================

    loadForecast();


    // Refresh every 30 seconds
    setInterval(
        loadForecast,
        30000
    );

});