// Crowd Status page — sample data only (no backend yet)

const crowdData = {
    level: "Moderate",
    peopleCount: 64,
    queueSize: 38,
    waitMinutes: 24
};

const trendData = [
    { time: "8 AM",  count: 12, level: "low" },
    { time: "9 AM",  count: 28, level: "low" },
    { time: "10 AM", count: 47, level: "moderate" },
    { time: "11 AM", count: 82, level: "high" },
    { time: "12 PM", count: 93, level: "high" },
    { time: "1 PM",  count: 64, level: "moderate", current: true },
    { time: "2 PM",  count: 58, level: "moderate" },
    { time: "3 PM",  count: 41, level: "moderate" }
];

const counters = [
    { name: "Counter 1", service: "General Consultation", status: "Busy",        badge: "badge-warning" },
    { name: "Counter 2", service: "Document Verification", status: "Available",  badge: "badge-success" },
    { name: "Counter 3", service: "Health Screening",      status: "High Demand", badge: "badge-danger" },
    { name: "Counter 4", service: "ID & License Services", status: "Available",   badge: "badge-success" }
];

function getRecommendation(level, waitMinutes) {
    return `${level} crowd. Your current estimated waiting time is ${waitMinutes} minutes.`;
}

function renderCrowdStatus() {
    const lvl = crowdData.level.toLowerCase();

    const levelText = document.getElementById("levelText");
    const levelBadge = document.getElementById("levelBadge");
    const peopleEl = document.getElementById("peopleCount");
    const queueEl = document.getElementById("queueSize");
    const waitEl = document.getElementById("waitTime");
    const recText = document.getElementById("recommendationText");

    if (levelText) {
        levelText.textContent = crowdData.level;
        levelText.className = `crowd-level-badge ${lvl}`;
    }

    if (peopleEl) peopleEl.textContent = String(crowdData.peopleCount);
    if (queueEl) queueEl.textContent = String(crowdData.queueSize);
    if (waitEl) {
        waitEl.innerHTML = `${crowdData.waitMinutes}<span class="wait-unit"> min</span>`;
    }

    if (levelBadge) {
        levelBadge.textContent = crowdData.level;
        if (lvl === "low") levelBadge.className = "card-badge badge-success";
        if (lvl === "moderate") levelBadge.className = "card-badge badge-warning";
        if (lvl === "high") levelBadge.className = "card-badge badge-danger";
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

    Object.values(dots).forEach(function (dot) {
        if (dot) dot.classList.remove("lit");
    });
    Object.values(labels).forEach(function (label) {
        if (label) label.classList.remove("active-label");
    });

    if (dots[lvl]) dots[lvl].classList.add("lit");
    if (labels[lvl]) labels[lvl].classList.add("active-label");

    if (recText) {
        recText.textContent = getRecommendation(crowdData.level, crowdData.waitMinutes);
    }
}

function renderTrendBars() {
    const container = document.getElementById("trendBars");
    if (!container) return;

    const counts = trendData.map(function (d) { return d.count; });
    const maxCount = Math.max.apply(null, counts);
    container.innerHTML = "";

    trendData.forEach(function (d) {
        const wrap = document.createElement("div");
        wrap.className = "trend-bar-wrap";

        const heightPct = Math.max(8, Math.round((d.count / maxCount) * 100));
        const extraClass = d.current ? " current" : "";

        wrap.innerHTML =
            '<span class="trend-bar-val">' + d.count + "</span>" +
            '<div class="trend-bar ' + d.level + extraClass + '" style="height:' + heightPct + '%;"></div>' +
            '<span class="trend-bar-label">' + d.time + "</span>";

        container.appendChild(wrap);
    });
}

function renderCounters() {
    const grid = document.getElementById("countersGrid");
    if (!grid) return;

    grid.innerHTML = "";
    counters.forEach(function (c) {
        const card = document.createElement("div");
        card.className = "counter-card";
        card.innerHTML =
            '<div class="counter-card-header">' +
                '<span class="counter-name">' + c.name + "</span>" +
                '<span class="card-badge ' + c.badge + '">' + c.status + "</span>" +
            "</div>" +
            '<span class="counter-service">' + c.service + "</span>";
        grid.appendChild(card);
    });
}

function updateLastUpdated() {
    const el = document.getElementById("lastUpdated");
    if (!el) return;

    const now = new Date();
    const time = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
    });
    el.textContent = "Last updated: " + time + " — sample data (not connected to live services yet).";
}

function refreshStatus() {
    renderCrowdStatus();
    renderTrendBars();
    renderCounters();
    updateLastUpdated();
}

document.addEventListener("DOMContentLoaded", function () {
    refreshStatus();

    const refreshBtn = document.getElementById("btnRefresh");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", refreshStatus);
    }

    // Header & Logout Navigation Handlers
    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", function () {
            window.location.href = "profile.html";
        });
    }

    const notifBtn = document.querySelector('.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener("click", function () {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(function (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            logoutUser();
        });
    });
});


