// Analytics page — uses the same shared queue/status endpoint
// as Dashboard/Queue/Crowd Status/Reports, so numbers always match.

document.addEventListener("DOMContentLoaded", () => {

    VIZITOR.requireAuthOrRedirect();
    VIZITOR.wireCommonNav();

    async function loadAnalytics() {
        const appointments = await VIZITOR.getAppointments();
        const queueStatus = await VIZITOR.getQueueStatus();

        const today = new Date().toISOString().split("T")[0];

        const todayAppointments = appointments.filter(
            a => a.status !== "CANCELLED" && a.appointment_date === today
        );

        setText("analyticsTodayAppointments", todayAppointments.length);

        if (!queueStatus) return;

        setText("analyticsQueueCount", queueStatus.queue_size);
        setText(
            "analyticsWaitTime",
            queueStatus.estimated_wait_minutes === 0 ? "0 min" : `${queueStatus.estimated_wait_minutes} min`
        );
        setText("analyticsCrowdLevel", queueStatus.crowd_level);

        const descriptions = {
            "No Crowd": "There is currently no active queue.",
            "Low": "Crowd levels are currently low. Service counters should operate normally.",
            "Moderate": "Crowd levels are moderate. Normal queue monitoring is recommended.",
            "High": "Crowd levels are high. Additional crowd management may be required."
        };

        setText("analyticsCrowdStatus", `${queueStatus.crowd_level} Crowd Level`);
        setText("analyticsCrowdDescription", descriptions[queueStatus.crowd_level] || "");
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    loadAnalytics();
    setInterval(loadAnalytics, 30000);
});
