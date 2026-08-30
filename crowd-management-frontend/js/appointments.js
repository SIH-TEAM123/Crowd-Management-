// Appointments page logic for Crowd Management

// ─────────────────────────────────────────────
// Helper – update the "3" badge counters
// ─────────────────────────────────────────────
function refreshCounts() {
    const upcomingCards = document.querySelectorAll("#upcomingGrid .appt-card");
    const prevRows      = document.querySelectorAll("#prevTableBody tr");
    const upcomingCount = document.getElementById("upcomingCount");
    const prevCount     = document.getElementById("prevCount");

    if (upcomingCount) upcomingCount.textContent = upcomingCards.length;
    if (prevCount)     prevCount.textContent     = prevRows.length;
}

// ─────────────────────────────────────────────
// View Details – shows a read-only alert summary
// ─────────────────────────────────────────────
function viewDetails(id) {
    const card = document.querySelector(`.appt-card[data-id="${id}"]`);
    if (!card) return;

    const service  = card.querySelector(".appt-service-name")?.textContent || "—";
    const values   = card.querySelectorAll(".appt-meta-value");
    const date     = values[0]?.textContent || "—";
    const time     = values[1]?.textContent || "—";
    const counter  = values[2]?.textContent || "—";
    const token    = values[3]?.textContent || "—";
    const status   = card.querySelector(".card-badge")?.textContent || "—";

    alert(
        `📋 Appointment Details\n` +
        `──────────────────────\n` +
        `Service  : ${service}\n` +
        `Date     : ${date}\n` +
        `Time     : ${time}\n` +
        `Counter  : ${counter}\n` +
        `Token    : ${token}\n` +
        `Status   : ${status}\n` +
        `──────────────────────\n` +
        `(Full details will be available once connected to the backend.)`
    );
}

// ─────────────────────────────────────────────
// Cancel Appointment
// ─────────────────────────────────────────────
function cancelAppointment(id, service, date, token) {
    const confirmed = confirm(
        `Are you sure you want to cancel this appointment?\n\n` +
        `Service : ${service}\n` +
        `Date    : ${date}\n` +
        `Token   : ${token}`
    );

    if (!confirmed) return;

    // Remove the upcoming card
    const card = document.querySelector(`.appt-card[data-id="${id}"]`);
    if (card) card.remove();

    // Add a new row to Previous Appointments table
    const tbody = document.getElementById("prevTableBody");
    if (tbody) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <div class="table-icon-row">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>${service}</span>
                </div>
            </td>
            <td>${date}</td>
            <td style="color:#7c3aed;font-weight:600;">${token}</td>
            <td><span class="card-badge badge-danger">Cancelled</span></td>
        `;
        tbody.prepend(row); // put it at the top
    }

    // Show empty state if no cards remain
    const grid = document.getElementById("upcomingGrid");
    if (grid && grid.querySelectorAll(".appt-card").length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p>No upcoming appointments. Book one using the button above!</p>
            </div>
        `;
    }

    refreshCounts();
    alert(`Appointment for "${service}" has been cancelled.`);
}

// ─────────────────────────────────────────────
// Book New Appointment
// ─────────────────────────────────────────────
// Book New Appointment / Token via FastAPI backend
async function bookNewAppointment() {
    const service = prompt("Enter service name (e.g. General Consultation, Health Screening):", "General Consultation");
    if (!service || service.trim() === "") return;

    const bookBtn = document.getElementById("btnBookNew");
    let orig = "";
    if (bookBtn) {
        orig = bookBtn.textContent;
        bookBtn.disabled = true;
        bookBtn.textContent = "Booking Token...";
    }

    const res = await createToken("NORMAL");
    if (bookBtn) {
        bookBtn.disabled = false;
        bookBtn.textContent = orig;
    }

    if (res.success && res.data) {
        const tokenData = res.data;
        const tokenNum = tokenData.token_number || "A-104";
        const counter = "Counter 1";
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const newId = Date.now();

        const emptyState = document.querySelector("#upcomingGrid .empty-state");
        if (emptyState) emptyState.remove();

        const grid = document.getElementById("upcomingGrid");
        if (grid) {
            const card = document.createElement("div");
            card.className = "appt-card confirmed";
            card.setAttribute("data-id", newId);
            card.innerHTML = `
                <div class="appt-card-header">
                    <span class="appt-service-name">${service.trim()}</span>
                    <span class="card-badge badge-success">Active</span>
                </div>
                <div class="appt-meta-grid">
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Date</span>
                        <span class="appt-meta-value">${date}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Time</span>
                        <span class="appt-meta-value">${time}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Counter</span>
                        <span class="appt-meta-value">${counter}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Token</span>
                        <span class="appt-meta-value token">${tokenNum}</span>
                    </div>
                </div>
                <div class="appt-card-actions">
                    <button class="btn-action-ghost" onclick="viewDetails(${newId})">View Details</button>
                    <button class="btn-action-cancel" onclick="cancelAppointment(${newId}, '${service}', '${date}', '${tokenNum}')">Cancel</button>
                </div>
            `;
            grid.prepend(card);
            refreshCounts();
        }
        alert(`Token Booked Successfully!\n\nToken Number: ${tokenNum}\nQueue Position: #${tokenData.queue_position}\nDate: ${date}`);
    } else {
        alert(res.message || "Unable to book token. Check backend service.");
    }
}

// ─────────────────────────────────────────────
// On page ready
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const bookBtn = document.getElementById("btnBookNew");
    if (bookBtn) {
        bookBtn.addEventListener("click", bookNewAppointment);
    }

    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    const notifBtn = document.querySelector('.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            logoutUser();
        });
    });

    refreshCounts();
    console.log("appointments.js loaded. Real backend token booking active.");
});


