// Appointments page logic for Crowd Management

// ─────────────────────────────────────────────
// Helper – update the "3" badge counters
// ─────────────────────────────────────────────
// ============================================================
// CREATE APPOINTMENT / TOKEN
// ============================================================

async function createToken(priorityType = "NORMAL") {

    const token =
        localStorage.getItem("access_token");

    if (!token) {

        window.location.href = "index.html";

        return {
            success: false,
            message: "Please login again."
        };
    }


    const serviceInput =
        document.getElementById("apptService");

    const dateInput =
        document.getElementById("apptDate");

    const timeInput =
        document.getElementById("apptTime");


    const purpose =
        serviceInput
            ? serviceInput.value.trim()
            : "General Consultation";

    const appointmentDate =
        dateInput
            ? dateInput.value
            : "";

    const appointmentTime =
        timeInput
            ? timeInput.value
            : "";


    if (!purpose) {

        return {
            success: false,
            message: "Please select a service."
        };
    }


    if (!appointmentDate || !appointmentTime) {

        return {
            success: false,
            message: "Please select date and time."
        };
    }


    try {

        const response =
            await fetch(
                "https://vizitor.onrender.com/appointments",
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        purpose:
                            purpose,

                        appointment_date:
                            appointmentDate,

                        appointment_time:
                            appointmentTime

                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Appointment API response:",
            data
        );


        if (!response.ok) {

            let message =
                "Unable to book appointment.";


            if (Array.isArray(data.detail)) {

                message =
                    data.detail
                        .map(error =>
                            `${error.loc?.slice(-1)[0] || "Field"}: ${error.msg}`
                        )
                        .join("\n");

            } else if (
                typeof data.detail === "string"
            ) {

                message =
                    data.detail;
            }


            return {
                success: false,
                message: message
            };
        }


        return {
            success: true,
            data: data
        };


    } catch (error) {

        console.error(
            "Appointment booking error:",
            error
        );


        return {
            success: false,
            message:
                "Unable to connect to the appointment server."
        };
    }
}
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
// Modal & Date/Time Picker Logic
// ─────────────────────────────────────────────
function validateDateTimeFields() {
    const dateInput = document.getElementById("apptDate");
    const timeInput = document.getElementById("apptTime");
    const dateError = document.getElementById("dateError");
    const timeError = document.getElementById("timeError");

    let isValid = true;

    if (!dateInput || !timeInput) return false;

    // Reset single field errors
    if (dateError) dateError.textContent = "";
    if (timeError) timeError.textContent = "";
    dateInput.classList.remove("invalid");
    timeInput.classList.remove("invalid");

    const dateVal = dateInput.value;
    const timeVal = timeInput.value;

    const now = new Date();
    const todayYyyy = now.getFullYear();
    const todayMm = String(now.getMonth() + 1).padStart(2, '0');
    const todayDd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayYyyy}-${todayMm}-${todayDd}`;

    if (!dateVal) {
        if (dateError) dateError.textContent = "Please select a valid date.";
        dateInput.classList.add("invalid");
        isValid = false;
    } else if (dateVal < todayStr) {
        if (dateError) dateError.textContent = "Past dates cannot be selected.";
        dateInput.classList.add("invalid");
        isValid = false;
    }

    if (!timeVal) {
        if (timeError) timeError.textContent = "Please select a valid time.";
        timeInput.classList.add("invalid");
        isValid = false;
    } else if (dateVal === todayStr && timeVal) {
        const [selHours, selMins] = timeVal.split(':').map(Number);
        const currentHours = now.getHours();
        const currentMins = now.getMinutes();

        if (selHours < currentHours || (selHours === currentHours && selMins < currentMins)) {
            if (timeError) timeError.textContent = "Time cannot be in the past for today.";
            timeInput.classList.add("invalid");
            isValid = false;
        }
    }

    return isValid;
}

function openBookingModal() {
    const backdrop = document.getElementById("bookModalBackdrop");
    const dateInput = document.getElementById("apptDate");
    const timeInput = document.getElementById("apptTime");
    const serviceInput = document.getElementById("apptService");
    const errorBanner = document.getElementById("modalErrorBanner");
    const dateError = document.getElementById("dateError");
    const timeError = document.getElementById("timeError");

    if (!backdrop || !dateInput || !timeInput) return;

    // Reset errors
    if (errorBanner) { errorBanner.style.display = "none"; errorBanner.textContent = ""; }
    if (dateError) dateError.textContent = "";
    if (timeError) timeError.textContent = "";
    dateInput.classList.remove("invalid");
    timeInput.classList.remove("invalid");

    // Set minimum date to today (YYYY-MM-DD)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // Set maximum date limit (90 days in advance)
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90);
    const maxYyyy = maxDate.getFullYear();
    const maxMm = String(maxDate.getMonth() + 1).padStart(2, '0');
    const maxDd = String(maxDate.getDate()).padStart(2, '0');
    const maxStr = `${maxYyyy}-${maxMm}-${maxDd}`;

    dateInput.min = todayStr;
    dateInput.max = maxStr;

    if (!dateInput.value || dateInput.value < todayStr) {
        dateInput.value = todayStr;
    }

    // Set default time to current time if empty
    if (!timeInput.value) {
        const hh = String(today.getHours()).padStart(2, '0');
        const mins = String(today.getMinutes()).padStart(2, '0');
        timeInput.value = `${hh}:${mins}`;
    }

    if (serviceInput && !serviceInput.value) {
        serviceInput.value = "General Consultation";
    }

    backdrop.style.display = "flex";
}

function closeBookingModal() {
    const backdrop = document.getElementById("bookModalBackdrop");
    if (backdrop) {
        backdrop.style.display = "none";
    }
}

async function handleBookingSubmit(e) {
    e.preventDefault();

    const serviceInput = document.getElementById("apptService");
    const dateInput = document.getElementById("apptDate");
    const timeInput = document.getElementById("apptTime");
    const errorBanner = document.getElementById("modalErrorBanner");
    const submitBtn = document.getElementById("btnSubmitBooking");

    // Clear banner
    if (errorBanner) { errorBanner.style.display = "none"; errorBanner.textContent = ""; }

    const serviceVal = serviceInput ? serviceInput.value.trim() : "General Consultation";

    if (!serviceVal) {
        if (errorBanner) {
            errorBanner.textContent = "Please enter a service name.";
            errorBanner.style.display = "flex";
        }
        return;
    }

    // Run Date + Time validation
    if (!validateDateTimeFields()) {
        return;
    }

    const dateVal = dateInput ? dateInput.value : "";
    const timeVal = timeInput ? timeInput.value : "";

    // Disable submit button during booking
    let origText = "Book Appointment";
    if (submitBtn) {
        origText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Booking...";
    }

    let res;

try {

    res = await createToken("NORMAL");

} catch (error) {

    console.error(
        "Booking submission error:",
        error
    );

    res = {
        success: false,
        message: "Booking failed. Please try again."
    };
}

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
    }

    if (res.success && res.data) {
        const tokenData = res.data;
        const tokenNum = tokenData.token_number || "A-104";
        const counter = "Counter 1";

        // Format Date: YYYY-MM-DD -> MMM DD, YYYY
        const [y, m, d] = dateVal.split('-').map(Number);
        const selDateObj = new Date(y, m - 1, d);
        const formattedDate = selDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Format Time: HH:mm -> hh:mm AM/PM
        const [h, min] = timeVal.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const formattedTime = `${String(displayH).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;

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
                    <span class="appt-service-name">${serviceVal}</span>
                    <span class="card-badge badge-success">Active</span>
                </div>
                <div class="appt-meta-grid">
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Date</span>
                        <span class="appt-meta-value">${formattedDate}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Time</span>
                        <span class="appt-meta-value">${formattedTime}</span>
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
                    <button class="btn-action-cancel" onclick="cancelAppointment(${newId}, '${serviceVal}', '${formattedDate}', '${tokenNum}')">Cancel</button>
                </div>
            `;
            grid.prepend(card);
            refreshCounts();
        }

        closeBookingModal();
        alert(`Token Booked Successfully!\n\nToken Number: ${tokenNum}\nQueue Position: #${tokenData.queue_position}\nDate: ${formattedDate}\nTime: ${formattedTime}`);
    } else {
        if (errorBanner) {
            errorBanner.textContent = res.message || "Unable to book token. Check backend service.";
            errorBanner.style.display = "flex";
        } else {
            alert(res.message || "Unable to book token. Check backend service.");
        }
    }
}

// ─────────────────────────────────────────────
// On page ready
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const bookBtn = document.getElementById("btnBookNew");
    if (bookBtn) {
        bookBtn.addEventListener("click", openBookingModal);
    }

    const closeBtn = document.getElementById("btnCloseModal");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeBookingModal);
    }

    const cancelBtn = document.getElementById("btnCancelModal");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", closeBookingModal);
    }

    const bookingForm = document.getElementById("bookingForm");
    if (bookingForm) {
        bookingForm.addEventListener("submit", handleBookingSubmit);
    }

    // Attach real-time validation on Date + Time pickers
    const apptDateInput = document.getElementById("apptDate");
    const apptTimeInput = document.getElementById("apptTime");
    if (apptDateInput) {
        apptDateInput.addEventListener("change", validateDateTimeFields);
        apptDateInput.addEventListener("input", validateDateTimeFields);
    }
    if (apptTimeInput) {
        apptTimeInput.addEventListener("change", validateDateTimeFields);
        apptTimeInput.addEventListener("input", validateDateTimeFields);
    }

    const backdrop = document.getElementById("bookModalBackdrop");
    if (backdrop) {
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                closeBookingModal();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeBookingModal();
        }
    });

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



