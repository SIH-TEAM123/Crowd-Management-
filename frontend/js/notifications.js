// ============================================================
// VIZITOR — Notifications
// Reads the SAME global notification event store used by every
// page.
// ============================================================


const notificationIcons = {

    appointment:
        "📅",

    queue:
        "🎟️",

    crowd:
        "👥",

    system:
        "⚙️"
};


const categoryLabels = {

    appointment:
        "Appointment",

    queue:
        "Queue",

    crowd:
        "Crowd Status",

    system:
        "System"
};


let activeCategory = "all";
let notifications = [];


function loadNotifications() {

    notifications =
        VIZITOR.getNotificationEvents()
            .sort(
                (a, b) =>
                    new Date(b.created_at || 0) -
                    new Date(a.created_at || 0)
            );
}


function unreadCount() {

    return notifications.filter(
        n => !n.read
    ).length;
}


function filteredNotifications() {

    if (
        activeCategory ===
        "all"
    ) {
        return notifications;
    }

    return notifications.filter(
        n =>
            n.category ===
            activeCategory
    );
}


function updateSummary() {

    const count =
        unreadCount();

    const summary =
        document.getElementById(
            "notifSummary"
        );

    const badge =
        document.getElementById(
            "unreadCount"
        );

    const markAllBtn =
        document.getElementById(
            "btnMarkAllRead"
        );

    const headerDot =
        document.getElementById(
            "headerNotifDot"
        );


    if (summary) {

        if (count === 0) {

            summary.textContent =
                "You are all caught up. No unread notifications.";

        } else if (count === 1) {

            summary.textContent =
                "You have 1 unread notification.";

        } else {

            summary.textContent =
                `You have ${count} unread notifications.`;
        }
    }


    if (badge) {

        badge.textContent =
            `${count} unread`;
    }


    if (markAllBtn) {

        markAllBtn.disabled =
            count === 0;
    }


    if (headerDot) {

        headerDot.hidden =
            count === 0;
    }
}


function renderNotifications() {

    const list =
        document.getElementById(
            "notifList"
        );

    const empty =
        document.getElementById(
            "notifEmpty"
        );

    const emptyMessage =
        document.getElementById(
            "emptyMessage"
        );

    if (!list || !empty) {
        return;
    }


    const items =
        filteredNotifications();

    list.innerHTML = "";


    if (items.length === 0) {

        list.hidden = true;
        empty.hidden = false;

        if (emptyMessage) {

            emptyMessage.textContent =
                notifications.length === 0
                    ? "You have no notifications right now."
                    : "No notifications in this category.";
        }

        updateSummary();

        return;
    }


    list.hidden = false;
    empty.hidden = true;


    items.forEach(
        notification => {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "notif-card" +
                (
                    notification.read
                        ? " is-read"
                        : " is-unread"
                );

            card.dataset.id =
                notification.id;


            const statusBadge =
                notification.read

                    ? `<span class="card-badge badge-neutral">Read</span>`

                    : `<span class="card-badge badge-warning">Unread</span>`;


            const action =
                notification.read

                    ? ""

                    : `<button
                            type="button"
                            class="btn-action-ghost notif-mark-btn"
                            data-id="${VIZITOR.escapeHtml(notification.id)}">
                            Mark as read
                       </button>`;


            card.innerHTML =

                `<div class="notif-icon notif-icon-${VIZITOR.escapeHtml(notification.category)}">
                    ${notificationIcons[notification.category] || "🔔"}
                </div>` +

                `<div class="notif-body">

                    <div class="notif-card-header">

                        <div class="notif-title-row">

                            <h4 class="notif-title">
                                ${VIZITOR.escapeHtml(notification.title)}
                            </h4>

                            <span class="notif-category">
                                ${VIZITOR.escapeHtml(
                                    categoryLabels[
                                        notification.category
                                    ] ||
                                    "System"
                                )}
                            </span>

                        </div>

                        ${statusBadge}

                    </div>

                    <p class="notif-message">
                        ${VIZITOR.escapeHtml(notification.message)}
                    </p>

                    <div class="notif-meta">

                        <span class="notif-time">
                            ${VIZITOR.escapeHtml(
                                notification.time ||
                                notification.created_at ||
                                ""
                            )}
                        </span>

                        ${action}

                    </div>

                </div>`;


            list.appendChild(card);
        }
    );


    list
        .querySelectorAll(
            ".notif-mark-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const id =
                            button.dataset.id;

                        VIZITOR.markNotificationRead(
                            id
                        );

                        loadNotifications();
                        renderNotifications();
                    }
                );
            }
        );


    updateSummary();
}


function markAllAsRead() {

    VIZITOR.markAllNotificationsRead();

    loadNotifications();
    renderNotifications();
}


function setupFilters() {

    const filters =
        document.getElementById(
            "categoryFilters"
        );

    if (!filters) {
        return;
    }


    filters.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-category]"
                );

            if (!button) {
                return;
            }


            activeCategory =
                button.dataset.category;


            filters
                .querySelectorAll(
                    ".status-pill"
                )
                .forEach(
                    pill => {

                        const active =
                            pill.dataset.category ===
                            activeCategory;

                        pill.classList.toggle(
                            "active-status",
                            active
                        );

                        pill.classList.toggle(
                            "inactive-status",
                            !active
                        );
                    }
                );


            renderNotifications();
        }
    );
}


// ============================================================
// LIVE REFRESH
// ============================================================

function refreshNotificationPage() {

    loadNotifications();
    renderNotifications();
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        VIZITOR.requireAuthOrRedirect();

        VIZITOR.wireCommonNav();

        setupFilters();

        refreshNotificationPage();


        document.addEventListener(
            "vizitorNotificationAdded",
            refreshNotificationPage
        );


        setInterval(
            refreshNotificationPage,
            3000
        );


        const markAll =
            document.getElementById(
                "btnMarkAllRead"
            );

        if (markAll) {

            markAll.addEventListener(
                "click",
                markAllAsRead
            );
        }
    }
);