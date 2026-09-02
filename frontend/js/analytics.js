// ============================================================
// VIZITOR — Crowd Analytics
//
// Uses:
//   • Live queue/crowd data
//   • Real Person 3 AI forecast
//
// UI is kept compatible with the existing VIZITOR Analytics page.
// No fabricated historical trend data.
// No fabricated counter status.
// ============================================================


// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function analyticsLevelClass(level) {
    const normalized = String(level || "").toUpperCase();

    if (normalized === "CRITICAL" || normalized === "HIGH") {
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
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}


function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}


function formatMinutes(value) {
    const minutes = Number(value);

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
        String(queueStatus.crowd_level || "")
            .toUpperCase();

    const predictedLevel =
        String(forecast.predicted_congestion_level || "")
            .toUpperCase();

    const predictedQueue =
        Number(forecast.predicted_queue_length ?? 0);

    const predictedWait =
        Number(forecast.predicted_wait_minutes ?? 0);

    const horizon =
        Number(forecast.forecast_horizon_minutes ?? 10);


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
// Section 1 — Existing Overview KPI cards
// -------------------------------------------------------

function renderKPICards(queueStatus) {

    setText(
        "analyticsCrowdLevel",
        queueStatus.crowd_level || "--"
    );


    setText(
        "analyticsPeopleCount",
        String(
            queueStatus.people_currently_present ?? 0
        )
    );


    setText(
        "analyticsQueueSize",
        String(
            queueStatus.queue_size ?? 0
        )
    );


    const wait =
        Number(
            queueStatus.estimated_wait_minutes ?? 0
        );


    setText(
        "analyticsWaitTime",
        formatMinutes(wait)
    );
}


// -------------------------------------------------------
// Section 2 — Existing Crowd Level display
// -------------------------------------------------------

function renderCrowdLevelDisplay(queueStatus) {

    const lvl =
        analyticsLevelClass(
            queueStatus.crowd_level
        );


    const badge =
        document.getElementById(
            "analyticsCrowdBadge"
        );


    if (badge) {

        badge.textContent =
            queueStatus.crowd_level || "--";

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
            queueStatus.crowd_level || "--";

        badgeText.className =
            `crowd-level-badge ${lvl}`;
    }


    setText(
        "analyticsPeopleCountLarge",
        String(
            queueStatus.people_currently_present ?? 0
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
        d =>
            d &&
            d.classList.remove("lit")
    );


    Object.values(labels).forEach(
        l =>
            l &&
            l.classList.remove(
                "active-label"
            )
    );


    if (dots[lvl]) {
        dots[lvl].classList.add("lit");
    }


    if (labels[lvl]) {
        labels[lvl].classList.add(
            "active-label"
        );
    }
}


// -------------------------------------------------------
// Section 3 — Existing Waiting Information
// -------------------------------------------------------

function renderWaitingInfo(queueStatus) {

    const wait =
        Number(
            queueStatus.estimated_wait_minutes ?? 0
        );


    setHtml(
        "analyticsWaitTimeLarge",
        `${wait}<span class="wait-unit"> min</span>`
    );


    setText(
        "analyticsQueueSizeLarge",
        String(
            queueStatus.queue_size ?? 0
        )
    );
}


// -------------------------------------------------------
// Section 4 — Replace fake trend with REAL AI forecast
// -------------------------------------------------------

function renderAIInExistingTrendSection(forecast) {

    const container =
        document.getElementById(
            "analyticsTrendBars"
        );


    if (!container) {
        return;
    }


    const predictedQueue =
        Number(
            forecast.predicted_queue_length ?? 0
        );


    const currentQueue =
        Number(
            forecast.current_queue_length ?? 0
        );


    const arrivalRate =
        Number(
            forecast.predicted_arrival_rate_per_min
            ?? forecast.arrival_rate_per_min
            ?? 0
        );


    const predictedWait =
        Number(
            forecast.predicted_wait_minutes ?? 0
        );


    const congestion =
        forecast.predicted_congestion_level
        || "--";


    const horizon =
        forecast.forecast_horizon_minutes
        ?? 10;


    const confidence =
        Number(
            forecast.prediction_confidence
        );


    let confidenceText = "--";


    if (Number.isFinite(confidence)) {

        confidenceText =
            `${(confidence * 100).toFixed(2)}%`;
    }


    /*
     * We deliberately do NOT create fake historical bars.
     *
     * Instead, use the existing trend container to present
     * the real forecast in a compact VIZITOR-compatible panel.
     */

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
// Section 5 — Counter section
// -------------------------------------------------------

function renderCounters() {

    /*
     * Counter-by-counter Busy/Available status is NOT
     * available from the current backend.
     *
     * Therefore we do not fabricate individual statuses.
     */

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
// Section 6 — Recommendation
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
        "analyticsWaitTime",
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

        const results =
            await Promise.all([
                VIZITOR.getQueueStatus(),
                VIZITOR.getCrowdForecast()
            ]);


        const queueStatus =
            results[0];


        const forecast =
            results[1];


        if (!queueStatus || !forecast) {

            showLoadError();

            return;
        }


        // Existing VIZITOR UI
        renderKPICards(
            queueStatus
        );


        renderCrowdLevelDisplay(
            queueStatus
        );


        renderWaitingInfo(
            queueStatus
        );


        // Real AI forecast inside existing UI
        renderAIInExistingTrendSection(
            forecast
        );


        // Do not invent individual counter status
        renderCounters();


        // Forecast-based recommendation
        renderRecommendation(
            queueStatus,
            forecast
        );


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

        VIZITOR.requireAuthOrRedirect();

        VIZITOR.wireCommonNav();


        refreshAnalytics();


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