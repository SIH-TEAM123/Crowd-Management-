// Notifications page — notifications are generated from real
// queue/appointment data (same source as every other page),
// so what you see here always matches Dashboard/Queue/Crowd Status.

const icons = {
    appointment:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>' +
        '<line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    queue:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/>' +
        '<line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/></svg>',
    crowd:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
        '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    system:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

const categoryLabels = {
    appointment: "Appointment",
    queue: "Queue",
    crowd: "Crowd Status",
    system: "System"
};

let activeCategory = "all";
let notifications = [];
let currentUserId = null;

function readStateKey() {
    return `vizitor_notif_read_${currentUserId}`;
}

function getReadIds() {
    try {
        return JSON.parse(localStorage.getItem(readStateKey())) || [];
    } catch {
        return [];
    }
}

function saveReadIds(ids) {
    localStorage.setItem(readStateKey(), JSON.stringify(ids));
}

async function buildNotifications() {
    const queueStatus = await VIZITOR.getQueueStatus();
    const appointments = await VIZITOR.getAppointments();

    const readIds = getReadIds();
    const items = [];

    const nowLabel = `Today, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

    if (queueStatus && queueStatus.you) {
        const you = queueStatus.you;

        items.push({
            id: "queue-position",
            category: "queue",
            title: "Queue Update",
            message: you.people_ahead > 0
                ? `Your token ${you.token_display} is in the queue. There ${you.people_ahead === 1 ? "is" : "are"} ${you.people_ahead} people ahead of you.`
                : `Your token ${you.token_display} is now being served. Please proceed to the counter.`,
            time: nowLabel
        });

        items.push({
            id: "appointment-confirmed",
            category: "appointment",
            title: "Appointment Confirmed",
            message: `Your appointment for ${you.purpose} is confirmed for ${VIZITOR.formatDate(you.appointment_date)} at ${VIZITOR.formatTime(you.appointment_time)}.`,
            time: nowLabel
        });
    }

    if (queueStatus) {
        items.push({
            id: "crowd-update",
            category: "crowd",
            title: "Crowd Update",
            message: `Crowd level is currently ${queueStatus.crowd_level}. Estimated waiting time is ${queueStatus.estimated_wait_minutes} minutes.`,
            time: nowLabel
        });

        if (queueStatus.currently_serving_token) {
            items.push({
                id: "counter-update",
                category: "queue",
                title: "Counter Update",
                message: `Now serving token ${queueStatus.currently_serving_token}.`,
                time: nowLabel
            });
        }
    }

    const cancelled = appointments.filter(a => a.status === "CANCELLED");
    cancelled.slice(0, 2).forEach(appt => {
        items.push({
            id: `cancelled-${appt.appointment_id}`,
            category: "appointment",
            title: "Appointment Cancelled",
            message: `Your appointment for ${appt.purpose} on ${VIZITOR.formatDate(appt.appointment_date)} was cancelled.`,
            time: VIZITOR.formatDate(appt.appointment_date)
        });
    });

    items.push({
        id: "system-hours",
        category: "system",
        title: "System Notice",
        message: "Facility hours today are 8:00 AM to 5:00 PM. Please arrive a few minutes early.",
        time: "System"
    });

    notifications = items.map(item => ({ ...item, read: readIds.includes(item.id) }));
}

function unreadCount() {
    return notifications.filter(n => !n.read).length;
}

function filteredNotifications() {
    if (activeCategory === "all") return notifications;
    return notifications.filter(n => n.category === activeCategory);
}

function updateSummary() {
    const count = unreadCount();
    const summary = document.getElementById("notifSummary");
    const badge = document.getElementById("unreadCount");
    const markAllBtn = document.getElementById("btnMarkAllRead");
    const headerDot = document.getElementById("headerNotifDot");

    if (summary) {
        if (notifications.length === 0) {
            summary.textContent = "You have no notifications.";
        } else if (count === 0) {
            summary.textContent = "You are all caught up. No unread notifications.";
        } else if (count === 1) {
            summary.textContent = "You have 1 unread notification.";
        } else {
            summary.textContent = "You have " + count + " unread notifications.";
        }
    }

    if (badge) badge.textContent = count + " unread";
    if (markAllBtn) markAllBtn.disabled = count === 0;
    if (headerDot) headerDot.hidden = count === 0;
}

function renderNotifications() {
    const list = document.getElementById("notifList");
    const empty = document.getElementById("notifEmpty");
    const emptyMessage = document.getElementById("emptyMessage");
    if (!list || !empty) return;

    const items = filteredNotifications();
    list.innerHTML = "";

    if (items.length === 0) {
        list.hidden = true;
        empty.hidden = false;
        if (emptyMessage) {
            emptyMessage.textContent = notifications.length === 0
                ? "You have no notifications right now."
                : "No notifications in this category.";
        }
        updateSummary();
        return;
    }

    list.hidden = false;
    empty.hidden = true;

    items.forEach(n => {
        const card = document.createElement("article");
        card.className = "notif-card" + (n.read ? " is-read" : " is-unread");
        card.setAttribute("data-id", String(n.id));

        const statusBadge = n.read
            ? '<span class="card-badge badge-neutral">Read</span>'
            : '<span class="card-badge badge-warning">Unread</span>';

        const action = n.read
            ? ""
            : '<button type="button" class="btn-action-ghost notif-mark-btn" data-id="' + n.id + '">Mark as read</button>';

        card.innerHTML =
            '<div class="notif-icon notif-icon-' + n.category + '">' + icons[n.category] + "</div>" +
            '<div class="notif-body">' +
                '<div class="notif-card-header">' +
                    '<div class="notif-title-row">' +
                        '<h4 class="notif-title">' + VIZITOR.escapeHtml(n.title) + "</h4>" +
                        '<span class="notif-category">' + categoryLabels[n.category] + "</span>" +
                    "</div>" +
                    statusBadge +
                "</div>" +
                '<p class="notif-message">' + VIZITOR.escapeHtml(n.message) + "</p>" +
                '<div class="notif-meta">' +
                    '<span class="notif-time">' + VIZITOR.escapeHtml(n.time) + "</span>" +
                    action +
                "</div>" +
            "</div>";

        list.appendChild(card);
    });

    list.querySelectorAll(".notif-mark-btn").forEach(btn => {
        btn.addEventListener("click", () => markAsRead(btn.getAttribute("data-id")));
    });

    updateSummary();
}

function markAsRead(id) {
    const item = notifications.find(n => n.id === id);
    if (!item || item.read) return;
    item.read = true;

    const readIds = getReadIds();
    if (!readIds.includes(id)) {
        readIds.push(id);
        saveReadIds(readIds);
    }
    renderNotifications();
}

function markAllAsRead() {
    const readIds = getReadIds();
    notifications.forEach(n => {
        n.read = true;
        if (!readIds.includes(n.id)) readIds.push(n.id);
    });
    saveReadIds(readIds);
    renderNotifications();
}

function setupFilters() {
    const filters = document.getElementById("categoryFilters");
    if (!filters) return;

    filters.addEventListener("click", event => {
        const btn = event.target.closest("[data-category]");
        if (!btn) return;

        activeCategory = btn.getAttribute("data-category");

        filters.querySelectorAll(".status-pill").forEach(pill => {
            const isActive = pill.getAttribute("data-category") === activeCategory;
            pill.classList.toggle("active-status", isActive);
            pill.classList.toggle("inactive-status", !isActive);
        });

        renderNotifications();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    VIZITOR.requireAuthOrRedirect();
    VIZITOR.wireCommonNav();

    const user = await VIZITOR.getCurrentUser();
    currentUserId = user ? user.user_id : "anon";

    setupFilters();
    await buildNotifications();
    renderNotifications();

    const markAllBtn = document.getElementById("btnMarkAllRead");
    if (markAllBtn) {
        markAllBtn.addEventListener("click", markAllAsRead);
    }

    setInterval(async () => {
        await buildNotifications();
        renderNotifications();
    }, 30000);
});
