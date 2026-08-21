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
function bookNewAppointment() {
    const service = prompt("Enter service name (e.g. Blood Test, Passport Renewal):");
    if (!service || service.trim() === "") return;

    const date = prompt("Enter appointment date (e.g. Sep 5, 2026):");
    if (!date || date.trim() === "") return;

    const time = prompt("Enter time slot (e.g. 11:30 AM):");
    if (!time || time.trim() === "") return;

    // Generate a mock token
    const letters = "ABCDE";
    const token = letters[Math.floor(Math.random() * letters.length)] +
                  "-" + String(Math.floor(Math.random() * 900) + 100);

    // Get a counter number
    const counter = "Counter " + (Math.floor(Math.random() * 5) + 1);

    // Generate a new card ID
    const newId = Date.now(); // use timestamp as unique id

    // Remove empty state if present
    const emptyState = document.querySelector("#upcomingGrid .empty-state");
    if (emptyState) emptyState.remove();

    // Build the new card HTML and prepend it
    const grid = document.getElementById("upcomingGrid");
    if (!grid) return;

    const safeService = service.trim().replace(/'/g, "\\'");
    const safeDate = date.trim().replace(/'/g, "\\'");

    const card = document.createElement("div");
    card.className = "appt-card pending";
    card.setAttribute("data-id", newId);
    card.innerHTML = `
        <div class="appt-card-header">
            <span class="appt-service-name">${service.trim()}</span>
            <span class="card-badge badge-warning">Pending</span>
        </div>
        <div class="appt-meta-grid">
            <div class="appt-meta-item">
                <span class="appt-meta-label">Date</span>
                <span class="appt-meta-value">${date.trim()}</span>
            </div>
            <div class="appt-meta-item">
                <span class="appt-meta-label">Time</span>
                <span class="appt-meta-value">${time.trim()}</span>
            </div>
            <div class="appt-meta-item">
                <span class="appt-meta-label">Counter</span>
                <span class="appt-meta-value">${counter}</span>
            </div>
            <div class="appt-meta-item">
                <span class="appt-meta-label">Token</span>
                <span class="appt-meta-value token">${token}</span>
            </div>
        </div>
        <div class="appt-card-actions">
            <button class="btn-action-ghost" onclick="viewDetails(${newId})">View Details</button>
            <button class="btn-action-cancel" onclick="cancelAppointment(${newId}, '${safeService}', '${safeDate}', '${token}')">Cancel</button>
        </div>
    `;

    grid.prepend(card);
    refreshCounts();
    alert(`Appointment booked!\n\nToken: ${token}\nDate: ${date}\nCounter: ${counter}\n\n(This is a local demo. It will be saved to the backend in a future step.)`);
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
        link.addEventListener("click", () => {
            localStorage.removeItem("isAuthenticated");
            localStorage.removeItem("userEmail");
        });
    });

    refreshCounts();
    console.log("appointments.js loaded. Appointment event handlers active.");
});

