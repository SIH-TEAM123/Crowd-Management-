// ============================================================
// VIZITOR — Crowd Analytics
//
// Uses:
//   • Live queue/crowd data
//   • Real Person 3 AI forecast
//   • Shared Crowd Simulation state when simulation is active
//
// Existing Analytics functionality is preserved.
// ============================================================


// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function analyticsLevelClass(level) {

    const normalized =
        String(level || "").toUpperCase();

    if (
        normalized === "CRITICAL" ||
        normalized === "HIGH"
    ) {
        return "high";
    }

    if (
        normalized === "MEDIUM" ||
        normalized === "MODERATE"
    ) {
        return "moderate";
    }

    return "low";
}


function setText(id, value) {

    const el =
        document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}


function setHtml(id, html) {

    const el =
        document.getElementById(id);

    if (el) {
        el.innerHTML = html;
    }
}


function formatMinutes(value) {

    const minutes =
        Number(value);

    if (!Number.isFinite(minutes)) {
        return "--";
    }

    if (minutes === 0) {
        return "0 min";
    }

    if (minutes < 1) {
        return `${Math.round(minutes * 60)} sec`;
    }

    return `${minutes.toFixed(1)} min`;
}


// -------------------------------------------------------
// Recommendation
// -------------------------------------------------------

function getAnalyticsRecommendation(
    queueStatus,
    forecast
) {

    const currentLevel =
        String(
            queueStatus.crowd_level || ""
        ).toUpperCase();


    const predictedLevel =
        String(
            forecast.predicted_congestion_level || ""
        ).toUpperCase();


    const predictedQueue =
        Number(
            forecast.predicted_queue_length ?? 0
        );


    const predictedWait =
        Number(
            forecast.predicted_wait_minutes ?? 0
        );


    const horizon =
        Number(
            forecast.forecast_horizon_minutes ?? 10
        );


    if (predictedLevel === "CRITICAL") {

        return `Critical crowd conditions are forecast for the next ${horizon} minutes. The predicted queue is ${predictedQueue} people. Consider increasing service capacity and managing visitor flow.`;
    }


    if (predictedLevel === "HIGH") {

        return `High crowd conditions are forecast for the next ${horizon} minutes. The predicted queue is ${predictedQueue} people with an estimated wait of ${formatMinutes(predictedWait)}. Consider taking crowd-control measures.`;
    }


    if (
        predictedLevel === "MEDIUM" ||
        predictedLevel === "MODERATE"
    ) {

        return `Moderate crowd conditions are forecast for the next ${horizon} minutes. The predicted queue is ${predictedQueue} people with an estimated wait of ${formatMinutes(predictedWait)}. Continue monitoring visitor flow.`;
    }


    if (
        currentLevel === "LOW" ||
        currentLevel === "NO CROWD"
    ) {

        return `Current crowd levels are low and the AI forecast also indicates low congestion for the next ${horizon} minutes. Normal operations can continue.`;
    }


    return `The AI forecast predicts low congestion for the next ${horizon} minutes, with approximately ${predictedQueue} people in the queue.`;
}


// -------------------------------------------------------
// Section 1 — Overview KPI cards
// -------------------------------------------------------

function renderKPICards(
    queueStatus,
    appointments = []
) {

    const queue =
        Number(
            queueStatus?.queue_size ?? 0
        );


    const wait =
        Number(
            queueStatus?.estimated_wait_minutes ?? 0
        );


    const level =
        queueStatus?.crowd_level || "--";


    // Current Queue
    setText(
        "analyticsQueueCount",
        String(queue)
    );


    // Today's Appointments
    let todayAppointments = 0;

    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    if (Array.isArray(appointments)) {

        todayAppointments =
            appointments.filter(
                appointment => {

                    if (!appointment) {
                        return false;
                    }


                    const status =
                        String(
                            appointment.status || ""
                        ).toLowerCase();


                    if (
                        status === "cancelled" ||
                        status === "canceled"
                    ) {
                        return false;
                    }


                    const appointmentDate =
                        appointment.appointment_date ||
                        appointment.date ||
                        appointment.appointment_datetime ||
                        appointment.datetime ||
                        "";


                    if (!appointmentDate) {
                        return false;
                    }


                    return String(
                        appointmentDate
                    ).startsWith(today);
                }
            ).length;
    }


    setText(
        "analyticsTodayAppointments",
        String(todayAppointments)
    );


    // Estimated Waiting Time
    setText(
        "analyticsWaitTime",
        formatMinutes(wait)
    );


    // Crowd Level
    setText(
        "analyticsCrowdLevel",
        level
    );
}


// -------------------------------------------------------
// Section 2 — Crowd Level display
// -------------------------------------------------------

function renderCrowdLevelDisplay(
    queueStatus
) {

    const level =
        queueStatus?.crowd_level || "--";


    const lvl =
        analyticsLevelClass(level);


    const badge =
        document.getElementById(
            "analyticsCrowdBadge"
        );


    if (badge) {

        badge.textContent =
            level;

        badge.className =
            "card-badge " +
            (
                lvl === "low"
                    ? "badge-success"
                    : lvl === "moderate"
                        ? "badge-warning"
                        : "badge-danger"
            );
    }


    const badgeText =
        document.getElementById(
            "analyticsCrowdBadgeText"
        );


    if (badgeText) {

        badgeText.textContent =
            level;

        badgeText.className =
            `crowd-level-badge ${lvl}`;
    }


    setText(
        "analyticsPeopleCountLarge",
        String(
            queueStatus?.people_currently_present ?? 0
        )
    );


    const dots = {

        low:
            document.getElementById(
                "analyticsDotLow"
            ),

        moderate:
            document.getElementById(
                "analyticsDotModerate"
            ),

        high:
            document.getElementById(
                "analyticsDotHigh"
            )
    };


    const labels = {

        low:
            document.getElementById(
                "analyticsLabelLow"
            ),

        moderate:
            document.getElementById(
                "analyticsLabelModerate"
            ),

        high:
            document.getElementById(
                "analyticsLabelHigh"
            )
    };


    Object.values(dots).forEach(
        d => {

            if (d) {
                d.classList.remove("lit");
            }
        }
    );


    Object.values(labels).forEach(
        l => {

            if (l) {
                l.classList.remove(
                    "active-label"
                );
            }
        }
    );


    if (dots[lvl]) {

        dots[lvl].classList.add(
            "lit"
        );
    }


    if (labels[lvl]) {

        labels[lvl].classList.add(
            "active-label"
        );
    }
}


// -------------------------------------------------------
// Section 3 — Crowd Overview
// -------------------------------------------------------

function renderCrowdOverview(
    queueStatus
) {

    const queue =
        Number(
            queueStatus?.queue_size ?? 0
        );


    const people =
        Number(
            queueStatus?.people_currently_present ?? 0
        );


    const wait =
        Number(
            queueStatus?.estimated_wait_minutes ?? 0
        );


    const level =
        queueStatus?.crowd_level ||
        "Unknown";


    setText(
        "analyticsCrowdStatus",
        `${level} Crowd`
    );


    setText(
        "analyticsCrowdDescription",
        `${people} people currently present, ${queue} people in the queue, with an estimated waiting time of ${formatMinutes(wait)}.`
    );


    setText(
        "analyticsPeopleCount",
        String(people)
    );


    setText(
        "analyticsQueueSize",
        String(queue)
    );
}


// -------------------------------------------------------
// Section 4 — Waiting Information
// -------------------------------------------------------

function renderWaitingInfo(
    queueStatus
) {

    const wait =
        Number(
            queueStatus?.estimated_wait_minutes ?? 0
        );


    const queue =
        Number(
            queueStatus?.queue_size ?? 0
        );


    setHtml(
        "analyticsWaitTimeLarge",
        `${wait}<span class="wait-unit"> min</span>`
    );


    setText(
        "analyticsQueueSizeLarge",
        String(queue)
    );
}


// -------------------------------------------------------
// Section 5 — AI forecast
// -------------------------------------------------------

function renderAIInExistingTrendSection(
    forecast
) {

    const container =
        document.getElementById(
            "analyticsTrendBars"
        );


    if (!container) {
        return;
    }


    const predictedQueue =
        Number(
            forecast?.predicted_queue_length ?? 0
        );


    const currentQueue =
        Number(
            forecast?.current_queue_length ?? 0
        );


    const arrivalRate =
        Number(
            forecast?.predicted_arrival_rate_per_min
            ??
            forecast?.arrival_rate_per_min
            ??
            0
        );


    const predictedWait =
        Number(
            forecast?.predicted_wait_minutes ?? 0
        );


    const congestion =
        forecast?.predicted_congestion_level
        || "--";


    const horizon =
        forecast?.forecast_horizon_minutes
        ?? 10;


    const confidence =
        Number(
            forecast?.prediction_confidence
        );


    let confidenceText =
        "--";


    if (
        Number.isFinite(confidence)
    ) {

        confidenceText =
            `${(
                confidence * 100
            ).toFixed(2)}%`;
    }


    container.innerHTML = `

        <div style="
            width:100%;
            padding:20px;
            display:grid;
            grid-template-columns:
                repeat(auto-fit,minmax(140px,1fr));
            gap:16px;
        ">

            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Current Queue
                </span>

                <span class="queue-stat-value">
                    ${currentQueue}
                </span>

                <span class="queue-stat-sub">
                    people now
                </span>

            </div>


            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Predicted Queue
                </span>

                <span class="queue-stat-value">
                    ${predictedQueue}
                </span>

                <span class="queue-stat-sub">
                    after ${horizon} minutes
                </span>

            </div>


            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Predicted Wait
                </span>

                <span class="queue-stat-value">
                    ${formatMinutes(predictedWait)}
                </span>

                <span class="queue-stat-sub">
                    AI prediction
                </span>

            </div>


            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Congestion
                </span>

                <span class="queue-stat-value"
                      style="font-size:1.25rem;">
                    ${congestion}
                </span>

                <span class="queue-stat-sub">
                    forecast level
                </span>

            </div>


            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Arrival Rate
                </span>

                <span class="queue-stat-value"
                      style="font-size:1.25rem;">
                    ${arrivalRate.toFixed(2)}
                </span>

                <span class="queue-stat-sub">
                    people / min
                </span>

            </div>


            <div class="queue-stat-block">

                <span class="queue-stat-label">
                    Model Indicator
                </span>

                <span class="queue-stat-value"
                      style="font-size:1.25rem;">
                    ${confidenceText}
                </span>

                <span class="queue-stat-sub">
                    validation R²
                </span>

            </div>

        </div>
    `;
}


// -------------------------------------------------------
// Section 6 — Counter section
// -------------------------------------------------------

function renderCounters() {

    const grid =
        document.getElementById(
            "analyticsCountersGrid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = `

        <div style="
            width:100%;
            padding:18px;
        ">

            <div class="recommendation-box">

                <div class="recommendation-icon">

                    <svg viewBox="0 0 24 24"
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2">

                        <circle cx="12"
                                cy="12"
                                r="10"/>

                        <line x1="12"
                              y1="8"
                              x2="12"
                              y2="12"/>

                        <line x1="12"
                              y1="16"
                              x2="12.01"
                              y2="16"/>

                    </svg>

                </div>


                <p class="recommendation-text">

                    Counter-level availability is not
                    currently provided by the backend.
                    The Analytics forecast uses the
                    configured service capacity instead.

                </p>

            </div>

        </div>
    `;
}


// -------------------------------------------------------
// Section 7 — Recommendation
// -------------------------------------------------------

function renderRecommendation(
    queueStatus,
    forecast
) {

    const text =
        getAnalyticsRecommendation(
            queueStatus,
            forecast
        );


    setText(
        "analyticsRecommendationText",
        text
    );
}


// -------------------------------------------------------
// Last updated
// -------------------------------------------------------

function updateLastUpdated() {

    const el =
        document.getElementById(
            "lastUpdated"
        );


    if (!el) {
        return;
    }


    const now =
        new Date();


    const time =
        now.toLocaleTimeString(
            "en-US",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    el.textContent =
        "Last updated: " +
        time +
        " — live backend + AI forecast.";
}


// -------------------------------------------------------
// Error state
// -------------------------------------------------------

function showLoadError() {

    setText(
        "analyticsQueueCount",
        "—"
    );


    setText(
        "analyticsTodayAppointments",
        "—"
    );


    setText(
        "analyticsWaitTime",
        "—"
    );


    setText(
        "analyticsCrowdLevel",
        "—"
    );


    setText(
        "analyticsPeopleCount",
        "—"
    );


    setText(
        "analyticsQueueSize",
        "—"
    );


    setText(
        "analyticsPeopleCountLarge",
        "—"
    );


    setHtml(
        "analyticsWaitTimeLarge",
        '—<span class="wait-unit"></span>'
    );


    setText(
        "analyticsQueueSizeLarge",
        "—"
    );


    setText(
        "analyticsCrowdStatus",
        "Unavailable"
    );


    setText(
        "analyticsCrowdDescription",
        "Unable to load live crowd information."
    );


    const badge =
        document.getElementById(
            "analyticsCrowdBadge"
        );


    if (badge) {

        badge.textContent =
            "Unavailable";

        badge.className =
            "card-badge";
    }


    const badgeText =
        document.getElementById(
            "analyticsCrowdBadgeText"
        );


    if (badgeText) {

        badgeText.textContent =
            "Unavailable";

        badgeText.className =
            "crowd-level-badge";
    }


    const trend =
        document.getElementById(
            "analyticsTrendBars"
        );


    if (trend) {

        trend.innerHTML = `
            <div style="padding:24px;">
                Unable to load AI forecast.
            </div>
        `;
    }


    setText(
        "analyticsRecommendationText",
        "Unable to load current crowd data and AI forecast. Click Refresh Status to try again."
    );


    const el =
        document.getElementById(
            "lastUpdated"
        );


    if (el) {

        el.textContent =
            "Unable to reach backend. Click Refresh Status to retry.";
    }
}


// -------------------------------------------------------
// Main refresh
// -------------------------------------------------------

async function refreshAnalytics() {

    try {

        // IMPORTANT:
        // Queue + appointments belong to the shared VIZITOR
        // object created by shared.js.
        //
        // Forecast belongs to window.VIZITOR created by api.js.
        //
        // Do NOT replace these with each other.

        const results =
            await Promise.all([

                VIZITOR.getQueueStatus(),

                window.VIZITOR.getCrowdForecast(),

                VIZITOR.getAppointments()

            ]);


        const queueStatus =
            results[0];


        const forecast =
            results[1];


        const appointments =
            Array.isArray(results[2])
                ? results[2]
                : [];


        if (
            !queueStatus ||
            !forecast
        ) {

            showLoadError();

            return;
        }


        // Existing KPI cards
        renderKPICards(
            queueStatus,
            appointments
        );


        // Crowd level
        renderCrowdLevelDisplay(
            queueStatus
        );


        // Crowd Overview
        renderCrowdOverview(
            queueStatus
        );


        // Waiting information
        renderWaitingInfo(
            queueStatus
        );


        // AI forecast
        renderAIInExistingTrendSection(
            forecast
        );


        // Counter information
        renderCounters();


        // AI recommendation
        renderRecommendation(
            queueStatus,
            forecast
        );


        // Timestamp
        updateLastUpdated();


    } catch (error) {

        console.error(
            "Analytics loading failed:",
            error
        );


        showLoadError();
    }
}


// -------------------------------------------------------
// Initialise
// -------------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // These belong to shared.js
        VIZITOR.requireAuthOrRedirect();

        VIZITOR.wireCommonNav();


        refreshAnalytics();


        // Keep Analytics live
        setInterval(
            refreshAnalytics,
            20000
        );


        const refreshBtn =
            document.getElementById(
                "btnRefresh"
            );


        if (refreshBtn) {

            refreshBtn.addEventListener(
                "click",
                refreshAnalytics
            );
        }
    }
);