// Real appointment integration with FastAPI

function getAuthHeaders() {
    const token = localStorage.getItem("access_token");

    if (!token) {
        window.location.href = "index.html";
        return null;
    }

    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}


async function loadAppointments() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/appointments`,
            {
                method: "GET",
                headers: headers
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Unable to load appointments.");
            return;
        }

        renderAppointments(data);

    } catch (error) {
        console.error("Appointment loading error:", error);
        alert("Unable to connect to the server.");
    }
}


function renderAppointments(appointments) {
    const grid = document.getElementById("upcomingGrid");
    const count = document.getElementById("upcomingCount");

    if (!grid) return;

    grid.innerHTML = "";

    const upcoming = appointments.filter(
        appointment =>
            appointment.status !== "CANCELLED"
    );

    if (count) {
        count.textContent = upcoming.length;
    }

    if (upcoming.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <p>No upcoming appointments. Book one using the button above!</p>
            </div>
        `;
        return;
    }

    upcoming.forEach(appointment => {
        const card = document.createElement("div");

        card.className = "appt-card";
        card.dataset.id = appointment.appointment_id;

        const date = appointment.appointment_date;
        const time = appointment.appointment_time;

        card.innerHTML = `
            <div class="appt-card-header">
                <span class="appt-service-name">
                    ${escapeHtml(appointment.purpose)}
                </span>

                <span class="card-badge badge-warning">
                    ${escapeHtml(appointment.status)}
                </span>
            </div>

            <div class="appt-meta-grid">

                <div class="appt-meta-item">
                    <span class="appt-meta-label">Date</span>
                    <span class="appt-meta-value">
                        ${date}
                    </span>
                </div>

                <div class="appt-meta-item">
                    <span class="appt-meta-label">Time</span>
                    <span class="appt-meta-value">
                        ${time}
                    </span>
                </div>

                <div class="appt-meta-item">
                    <span class="appt-meta-label">Counter</span>
                    <span class="appt-meta-value">
                        Not assigned
                    </span>
                </div>

                <div class="appt-meta-item">
                    <span class="appt-meta-label">Token</span>
                    <span class="appt-meta-value token">
                        ${escapeHtml(appointment.token_id)}
                    </span>
                </div>

            </div>

            <div class="appt-card-actions">

                <button
                    class="btn-action-ghost"
                    onclick="viewDetails(${appointment.appointment_id})">
                    View Details
                </button>

                <button
                    class="btn-action-cancel"
                    onclick="cancelAppointment(${appointment.appointment_id})">
                    Cancel
                </button>

            </div>
        `;

        grid.appendChild(card);
    });
}


async function viewDetails(id) {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/appointments/${id}`,
            {
                method: "GET",
                headers: headers
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Unable to load appointment.");
            return;
        }

        alert(
            `Appointment Details\n\n` +
            `Service: ${data.purpose}\n` +
            `Date: ${data.appointment_date}\n` +
            `Time: ${data.appointment_time}\n` +
            `Token: ${data.token_id}\n` +
            `Status: ${data.status}`
        );

    } catch (error) {
        console.error("View appointment error:", error);
        alert("Unable to connect to the server.");
    }
}


async function cancelAppointment(id) {
    const confirmed = confirm(
        "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/appointments/${id}`,
            {
                method: "DELETE",
                headers: headers
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Unable to cancel appointment.");
            return;
        }

        alert("Appointment cancelled successfully.");

        await loadAppointments();

    } catch (error) {
        console.error("Cancel appointment error:", error);
        alert("Unable to connect to the server.");
    }
}


async function bookNewAppointment() {
    const service = prompt(
        "Enter service name (e.g. Blood Test, Passport Renewal):"
    );

    if (!service || !service.trim()) return;

    const date = prompt(
        "Enter appointment date (YYYY-MM-DD):"
    );

    if (!date || !date.trim()) return;

    const time = prompt(
        "Enter appointment time (HH:MM:SS):"
    );

    if (!time || !time.trim()) return;

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(
            `${API_BASE_URL}/appointments`,
            {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    purpose: service.trim(),
                    appointment_date: date.trim(),
                    appointment_time: time.trim()
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Unable to book appointment.");
            return;
        }

        alert(
            `Appointment booked successfully!\n\n` +
            `Token: ${data.token_id}\n` +
            `Date: ${data.appointment_date}\n` +
            `Time: ${data.appointment_time}`
        );

        await loadAppointments();

    } catch (error) {
        console.error("Booking error:", error);
        alert("Unable to connect to the server.");
    }
}


function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


document.addEventListener("DOMContentLoaded", () => {

    const bookBtn = document.getElementById("btnBookNew");

    if (bookBtn) {
        bookBtn.addEventListener(
            "click",
            bookNewAppointment
        );
    }

    const profileBadge =
        document.querySelector(".profile-badge");

    if (profileBadge) {
        profileBadge.style.cursor = "pointer";

        profileBadge.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    const notifBtn =
        document.querySelector(
            '.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]'
        );

    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks =
        document.querySelectorAll(
            '.sidebar-footer a, #btnLogout'
        );

    logoutLinks.forEach(link => {
        link.addEventListener("click", () => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("isAuthenticated");
            localStorage.removeItem("userEmail");
        });
    });

    loadAppointments();
});