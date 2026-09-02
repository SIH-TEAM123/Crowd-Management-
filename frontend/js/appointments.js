// ============================================================
// VIZITOR - APPOINTMENTS PAGE
// Complete fixed version
// ============================================================


// ============================================================
// CREATE APPOINTMENT / TOKEN
// ============================================================

async function createToken(priorityType = "NORMAL") {

    const token = localStorage.getItem("access_token");

    if (!token) {
        window.location.href = "index.html";

        return {
            success: false,
            message: "Please login again."
        };
    }

    const serviceInput = document.getElementById("apptService");
    const dateInput = document.getElementById("apptDate");
    const timeInput = document.getElementById("apptTime");

    const purpose = serviceInput
        ? serviceInput.value.trim()
        : "General Consultation";

    const appointmentDate = dateInput
        ? dateInput.value
        : "";

    const appointmentTime = timeInput
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

        const response = await fetch(
            "https://vizitor.onrender.com/appointments",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    purpose: purpose,
                    appointment_date: appointmentDate,
                    appointment_time: appointmentTime
                })
            }
        );

        const data = await response.json();

        console.log("Appointment API response:", data);

        if (!response.ok) {

            let message = "Unable to book appointment.";

            if (Array.isArray(data.detail)) {

                message = data.detail
                    .map(error =>
                        `${error.loc?.slice(-1)[0] || "Field"}: ${error.msg}`
                    )
                    .join("\n");

            } else if (typeof data.detail === "string") {

                message = data.detail;
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

        console.error("Appointment booking error:", error);

        return {
            success: false,
            message:
                "Unable to connect to the appointment server."
        };
    }
}


// ============================================================
// MODAL STYLES
// ============================================================

function injectAppointmentModalStyles() {

    if (
        document.getElementById(
            "vizitorAppointmentModalStyles"
        )
    ) {
        return;
    }

    const style = document.createElement("style");

    style.id =
        "vizitorAppointmentModalStyles";

    style.textContent = `

        .vizitor-ui-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.48);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
        }

        .vizitor-ui-card {
            width: min(460px, 100%);
            background: #ffffff;
            border-radius: 18px;
            padding: 30px;
            position: relative;
            box-shadow:
                0 25px 70px rgba(15, 23, 42, 0.24);
            animation:
                vizitorModalIn 0.22s ease-out;
        }

        @keyframes vizitorModalIn {
            from {
                opacity: 0;
                transform: translateY(12px) scale(0.97);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .vizitor-ui-close {
            position: absolute;
            top: 12px;
            right: 16px;
            border: none;
            background: transparent;
            color: #64748b;
            font-size: 28px;
            line-height: 1;
            cursor: pointer;
        }

        .vizitor-ui-icon {
            width: 62px;
            height: 62px;
            border-radius: 50%;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            font-weight: 700;
        }

        .vizitor-ui-icon.success {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #059669;
        }

        .vizitor-ui-icon.cancel {
            background: #fff7ed;
            border: 1px solid #fed7aa;
            color: #ea580c;
        }

        .vizitor-ui-card h2 {
            margin: 0;
            text-align: center;
            color: #172033;
            font-size: 23px;
        }

        .vizitor-ui-subtitle {
            text-align: center;
            color: #64748b;
            font-size: 14px;
            margin: 8px 0 22px;
        }

        .vizitor-token-box {
            text-align: center;
            background: #faf7ff;
            border: 1px solid #e9d5ff;
            border-radius: 14px;
            padding: 17px;
            margin-bottom: 16px;
        }

        .vizitor-token-label {
            display: block;
            color: #7c3aed;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }

        .vizitor-token-number {
            color: #6d28d9;
            font-size: 30px;
            font-weight: 700;
        }

        .vizitor-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 17px;
        }

        .vizitor-detail-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 11px;
        }

        .vizitor-detail-box span {
            display: block;
            color: #64748b;
            font-size: 11px;
            margin-bottom: 4px;
        }

        .vizitor-detail-box strong {
            display: block;
            color: #172033;
            font-size: 14px;
            word-break: break-word;
        }

        .vizitor-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            border-radius: 9px;
            background: #ecfdf5;
            color: #047857;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 17px;
        }

        .vizitor-status.cancelled {
            background: #fff7ed;
            color: #c2410c;
        }

        .vizitor-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
        }

        .vizitor-status.cancelled .vizitor-status-dot {
            background: #f97316;
        }

        .vizitor-primary-btn {
            width: 100%;
            border: none;
            border-radius: 9px;
            padding: 12px;
            background: #7c3aed;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
        }

        .vizitor-primary-btn:hover {
            background: #6d28d9;
        }

        .vizitor-danger-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 9px;
            background: #ef4444;
            color: #ffffff;
            font-weight: 600;
            cursor: pointer;
        }

        .vizitor-secondary-btn {
            flex: 1;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #ffffff;
            color: #334155;
            font-weight: 600;
            cursor: pointer;
        }

        .vizitor-info-row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 11px 0;
            border-bottom: 1px solid #eef2f7;
        }

        .vizitor-info-row:last-child {
            border-bottom: none;
        }

        .vizitor-info-row span {
            color: #64748b;
            font-size: 13px;
        }

        .vizitor-info-row strong {
            color: #172033;
            font-size: 13px;
            text-align: right;
        }

        @media (max-width: 520px) {

            .vizitor-ui-card {
                padding: 24px;
            }

            .vizitor-details-grid {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(style);
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// UPDATE COUNTERS
// ============================================================

function refreshCounts() {

    const upcomingCards =
        document.querySelectorAll(
            "#upcomingGrid .appt-card"
        );

    const prevRows =
        document.querySelectorAll(
            "#prevTableBody tr"
        );

    const upcomingCount =
        document.getElementById(
            "upcomingCount"
        );

    const prevCount =
        document.getElementById(
            "prevCount"
        );

    if (upcomingCount) {
        upcomingCount.textContent =
            upcomingCards.length;
    }

    if (prevCount) {
        prevCount.textContent =
            prevRows.length;
    }
}


// ============================================================
// VIEW DETAILS
// ============================================================

function viewDetails(id) {

    injectAppointmentModalStyles();

    const card =
        document.querySelector(
            `.appt-card[data-id="${id}"]`
        );

    if (!card) return;

    const service =
        card.querySelector(
            ".appt-service-name"
        )?.textContent || "—";

    const values =
        card.querySelectorAll(
            ".appt-meta-value"
        );

    const date =
        values[0]?.textContent || "—";

    const time =
        values[1]?.textContent || "—";

    const counter =
        values[2]?.textContent || "—";

    const token =
        values[3]?.textContent || "—";

    const status =
        card.querySelector(
            ".card-badge"
        )?.textContent || "—";

    const old =
        document.getElementById(
            "vizitorDetailsModal"
        );

    if (old) old.remove();

    const modal =
        document.createElement("div");

    modal.id =
        "vizitorDetailsModal";

    modal.className =
        "vizitor-ui-overlay";

    modal.innerHTML = `

        <div class="vizitor-ui-card">

            <button
                class="vizitor-ui-close"
                id="closeDetailsModal">
                ×
            </button>

            <div class="vizitor-ui-icon success">
                ✓
            </div>

            <h2>Appointment Details</h2>

            <p class="vizitor-ui-subtitle">
                Your appointment information
            </p>

            <div>

                <div class="vizitor-info-row">
                    <span>Service</span>
                    <strong>${escapeHTML(service)}</strong>
                </div>

                <div class="vizitor-info-row">
                    <span>Date</span>
                    <strong>${escapeHTML(date)}</strong>
                </div>

                <div class="vizitor-info-row">
                    <span>Time</span>
                    <strong>${escapeHTML(time)}</strong>
                </div>

                <div class="vizitor-info-row">
                    <span>Counter</span>
                    <strong>${escapeHTML(counter)}</strong>
                </div>

                <div class="vizitor-info-row">
                    <span>Token</span>
                    <strong>${escapeHTML(token)}</strong>
                </div>

                <div class="vizitor-info-row">
                    <span>Status</span>
                    <strong>${escapeHTML(status)}</strong>
                </div>

            </div>

            <br>

            <button
                class="vizitor-primary-btn"
                id="closeDetailsDone">
                Done
            </button>

        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
    };

    document
        .getElementById("closeDetailsModal")
        ?.addEventListener("click", close);

    document
        .getElementById("closeDetailsDone")
        ?.addEventListener("click", close);
}


// ============================================================
// BOOKING SUCCESS
// ============================================================

function showBookingSuccess({
    token,
    queuePosition,
    date,
    time,
    service
}) {

    injectAppointmentModalStyles();

    const old =
        document.getElementById(
            "bookingSuccessModal"
        );

    if (old) old.remove();

    const modal =
        document.createElement("div");

    modal.id =
        "bookingSuccessModal";

    modal.className =
        "vizitor-ui-overlay";

    const safeQueue =
        queuePosition !== undefined &&
        queuePosition !== null &&
        queuePosition !== ""
            ? queuePosition
            : "Confirmed";

    modal.innerHTML = `

        <div class="vizitor-ui-card">

            <button
                class="vizitor-ui-close"
                id="closeBookingSuccess">
                ×
            </button>

            <div class="vizitor-ui-icon success">
                ✓
            </div>

            <h2>Appointment Confirmed</h2>

            <p class="vizitor-ui-subtitle">
                Your appointment has been successfully booked.
            </p>

            <div class="vizitor-token-box">

                <span class="vizitor-token-label">
                    YOUR TOKEN
                </span>

                <div class="vizitor-token-number">
                    ${escapeHTML(token)}
                </div>

            </div>

            <div class="vizitor-details-grid">

                <div class="vizitor-detail-box">
                    <span>Service</span>
                    <strong>${escapeHTML(service)}</strong>
                </div>

                <div class="vizitor-detail-box">
                    <span>Date</span>
                    <strong>${escapeHTML(date)}</strong>
                </div>

                <div class="vizitor-detail-box">
                    <span>Time</span>
                    <strong>${escapeHTML(time)}</strong>
                </div>

                <div class="vizitor-detail-box">
                    <span>Queue Position</span>
                    <strong>#${escapeHTML(safeQueue)}</strong>
                </div>

            </div>

            <div class="vizitor-status">

                <span class="vizitor-status-dot"></span>

                Appointment Confirmed

            </div>

            <button
                class="vizitor-primary-btn"
                id="bookingSuccessDone">

                Done

            </button>

        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
        refreshCounts();
    };

    document
        .getElementById("closeBookingSuccess")
        ?.addEventListener("click", close);

    document
        .getElementById("bookingSuccessDone")
        ?.addEventListener("click", close);
}


// ============================================================
// CANCEL SUCCESS
// ============================================================

function showCancelSuccess(service, token) {

    injectAppointmentModalStyles();

    const old =
        document.getElementById(
            "cancelSuccessModal"
        );

    if (old) old.remove();

    const modal =
        document.createElement("div");

    modal.id =
        "cancelSuccessModal";

    modal.className =
        "vizitor-ui-overlay";

    modal.innerHTML = `

        <div class="vizitor-ui-card">

            <button
                class="vizitor-ui-close"
                id="closeCancelSuccess">
                ×
            </button>

            <div class="vizitor-ui-icon cancel">
                ✓
            </div>

            <h2>Appointment Cancelled</h2>

            <p class="vizitor-ui-subtitle">
                Your appointment has been successfully cancelled.
            </p>

            <div class="vizitor-details-grid">

                <div class="vizitor-detail-box">

                    <span>Service</span>

                    <strong>
                        ${escapeHTML(service)}
                    </strong>

                </div>

                <div class="vizitor-detail-box">

                    <span>Token</span>

                    <strong>
                        ${escapeHTML(token)}
                    </strong>

                </div>

            </div>

            <div class="vizitor-status cancelled">

                <span class="vizitor-status-dot"></span>

                Cancellation Confirmed

            </div>

            <button
                class="vizitor-primary-btn"
                id="cancelSuccessDone">

                Done

            </button>

        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
        refreshCounts();
    };

    document
        .getElementById("closeCancelSuccess")
        ?.addEventListener("click", close);

    document
        .getElementById("cancelSuccessDone")
        ?.addEventListener("click", close);
}


// ============================================================
// CANCEL CONFIRMATION MODAL
// ============================================================

function showCancelConfirm(
    id,
    service,
    date,
    token
) {

    injectAppointmentModalStyles();

    const oldModal =
        document.getElementById(
            "cancelConfirmModal"
        );

    if (oldModal) {
        oldModal.remove();
    }

    const modal =
        document.createElement("div");

    modal.id =
        "cancelConfirmModal";

    modal.className =
        "vizitor-ui-overlay";

    modal.innerHTML = `

        <div class="vizitor-ui-card">

            <button
                class="vizitor-ui-close"
                id="closeCancelConfirm">
                ×
            </button>

            <div class="vizitor-ui-icon cancel">
                !
            </div>

            <h2>Cancel Appointment?</h2>

            <p class="vizitor-ui-subtitle">
                Are you sure you want to cancel this appointment?
            </p>

            <div class="vizitor-details-grid">

                <div class="vizitor-detail-box">

                    <span>Service</span>

                    <strong>
                        ${escapeHTML(service)}
                    </strong>

                </div>

                <div class="vizitor-detail-box">

                    <span>Date</span>

                    <strong>
                        ${escapeHTML(date)}
                    </strong>

                </div>

                <div class="vizitor-detail-box">

                    <span>Token</span>

                    <strong>
                        ${escapeHTML(token)}
                    </strong>

                </div>

                <div class="vizitor-detail-box">

                    <span>Status</span>

                    <strong>
                        Active
                    </strong>

                </div>

            </div>

            <div style="
                display:flex;
                gap:10px;
                margin-top:18px;
            ">

                <button
                    id="cancelConfirmNo"
                    class="vizitor-secondary-btn">

                    Keep Appointment

                </button>

                <button
                    id="cancelConfirmYes"
                    class="vizitor-danger-btn">

                    Yes, Cancel

                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {

        const element =
            document.getElementById(
                "cancelConfirmModal"
            );

        if (element) {
            element.remove();
        }
    };

    document
        .getElementById("closeCancelConfirm")
        ?.addEventListener(
            "click",
            closeModal
        );

    document
        .getElementById("cancelConfirmNo")
        ?.addEventListener(
            "click",
            closeModal
        );

    document
        .getElementById("cancelConfirmYes")
        ?.addEventListener(
            "click",
            () => {

                closeModal();

                performCancellation(
                    id,
                    service,
                    date,
                    token
                );
            }
        );
}


// ============================================================
// PERFORM CANCELLATION
// ============================================================

function performCancellation(
    id,
    service,
    date,
    token
) {

    // Remove appointment card

    const card =
        document.querySelector(
            `.appt-card[data-id="${id}"]`
        );

    if (card) {
        card.remove();
    }


    // Add cancelled appointment
    // to previous appointments

    const tbody =
        document.getElementById(
            "prevTableBody"
        );

    if (tbody) {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>

                <div class="table-icon-row">

                    <svg
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24">

                        <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"/>

                        <line
                            x1="16"
                            y1="2"
                            x2="16"
                            y2="6"/>

                        <line
                            x1="8"
                            y1="2"
                            x2="8"
                            y2="6"/>

                        <line
                            x1="3"
                            y1="10"
                            x2="21"
                            y2="10"/>

                    </svg>

                    <span>
                        ${escapeHTML(service)}
                    </span>

                </div>

            </td>

            <td>
                ${escapeHTML(date)}
            </td>

            <td
                style="
                    color:#7c3aed;
                    font-weight:600;
                ">

                ${escapeHTML(token)}

            </td>

            <td>

                <span
                    class="card-badge badge-danger">

                    Cancelled

                </span>

            </td>
        `;

        tbody.prepend(row);
    }


    // Empty upcoming state

    const grid =
        document.getElementById(
            "upcomingGrid"
        );

    if (
        grid &&
        grid.querySelectorAll(
            ".appt-card"
        ).length === 0
    ) {

        grid.innerHTML = `

            <div
                class="empty-state"
                style="grid-column:1/-1;">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5">

                    <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"/>

                    <line
                        x1="16"
                        y1="2"
                        x2="16"
                        y2="6"/>

                    <line
                        x1="8"
                        y1="2"
                        x2="8"
                        y2="6"/>

                    <line
                        x1="3"
                        y1="10"
                        x2="21"
                        y2="10"/>

                </svg>

                <p>
                    No upcoming appointments.
                    Book one using the button above!
                </p>

            </div>
        `;
    }

    refreshCounts();

    showCancelSuccess(
        service,
        token
    );
}


// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

function cancelAppointment(
    id,
    service,
    date,
    token
) {

    showCancelConfirm(
        id,
        service,
        date,
        token
    );
}


// ============================================================
// DATE + TIME VALIDATION
// ============================================================

function validateDateTimeFields() {

    const dateInput =
        document.getElementById(
            "apptDate"
        );

    const timeInput =
        document.getElementById(
            "apptTime"
        );

    const dateError =
        document.getElementById(
            "dateError"
        );

    const timeError =
        document.getElementById(
            "timeError"
        );

    let isValid = true;

    if (!dateInput || !timeInput) {
        return false;
    }

    if (dateError) {
        dateError.textContent = "";
    }

    if (timeError) {
        timeError.textContent = "";
    }

    dateInput.classList.remove("invalid");
    timeInput.classList.remove("invalid");

    const dateVal =
        dateInput.value;

    const timeVal =
        timeInput.value;

    const now =
        new Date();

    const todayYyyy =
        now.getFullYear();

    const todayMm =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const todayDd =
        String(
            now.getDate()
        ).padStart(2, "0");

    const todayStr =
        `${todayYyyy}-${todayMm}-${todayDd}`;


    if (!dateVal) {

        if (dateError) {
            dateError.textContent =
                "Please select a valid date.";
        }

        dateInput.classList.add("invalid");

        isValid = false;

    } else if (
        dateVal < todayStr
    ) {

        if (dateError) {
            dateError.textContent =
                "Past dates cannot be selected.";
        }

        dateInput.classList.add("invalid");

        isValid = false;
    }


    if (!timeVal) {

        if (timeError) {
            timeError.textContent =
                "Please select a valid time.";
        }

        timeInput.classList.add("invalid");

        isValid = false;

    } else if (
        dateVal === todayStr
    ) {

        const [
            selHours,
            selMins
        ] =
            timeVal
                .split(":")
                .map(Number);

        const currentHours =
            now.getHours();

        const currentMins =
            now.getMinutes();

        if (
            selHours < currentHours ||
            (
                selHours === currentHours &&
                selMins < currentMins
            )
        ) {

            if (timeError) {
                timeError.textContent =
                    "Time cannot be in the past for today.";
            }

            timeInput.classList.add("invalid");

            isValid = false;
        }
    }

    return isValid;
}


// ============================================================
// OPEN BOOKING MODAL
// ============================================================

function openBookingModal() {

    const backdrop =
        document.getElementById(
            "bookModalBackdrop"
        );

    const dateInput =
        document.getElementById(
            "apptDate"
        );

    const timeInput =
        document.getElementById(
            "apptTime"
        );

    const serviceInput =
        document.getElementById(
            "apptService"
        );

    const errorBanner =
        document.getElementById(
            "modalErrorBanner"
        );

    const dateError =
        document.getElementById(
            "dateError"
        );

    const timeError =
        document.getElementById(
            "timeError"
        );

    if (
        !backdrop ||
        !dateInput ||
        !timeInput
    ) {
        return;
    }

    if (errorBanner) {
        errorBanner.style.display = "none";
        errorBanner.textContent = "";
    }

    if (dateError) {
        dateError.textContent = "";
    }

    if (timeError) {
        timeError.textContent = "";
    }

    dateInput.classList.remove("invalid");
    timeInput.classList.remove("invalid");

    const today =
        new Date();

    const yyyy =
        today.getFullYear();

    const mm =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const dd =
        String(
            today.getDate()
        ).padStart(2, "0");

    const todayStr =
        `${yyyy}-${mm}-${dd}`;

    const maxDate =
        new Date();

    maxDate.setDate(
        today.getDate() + 90
    );

    const maxYyyy =
        maxDate.getFullYear();

    const maxMm =
        String(
            maxDate.getMonth() + 1
        ).padStart(2, "0");

    const maxDd =
        String(
            maxDate.getDate()
        ).padStart(2, "0");

    const maxStr =
        `${maxYyyy}-${maxMm}-${maxDd}`;

    dateInput.min =
        todayStr;

    dateInput.max =
        maxStr;

    if (
        !dateInput.value ||
        dateInput.value < todayStr
    ) {

        dateInput.value =
            todayStr;
    }

    if (!timeInput.value) {

        const hh =
            String(
                today.getHours()
            ).padStart(2, "0");

        const mins =
            String(
                today.getMinutes()
            ).padStart(2, "0");

        timeInput.value =
            `${hh}:${mins}`;
    }

    if (
        serviceInput &&
        !serviceInput.value
    ) {

        serviceInput.value =
            "General Consultation";
    }

    backdrop.style.display =
        "flex";
}


// ============================================================
// CLOSE BOOKING MODAL
// ============================================================

function closeBookingModal() {

    const backdrop =
        document.getElementById(
            "bookModalBackdrop"
        );

    if (backdrop) {
        backdrop.style.display =
            "none";
    }
}


// ============================================================
// HANDLE BOOKING
// ============================================================

async function handleBookingSubmit(e) {

    e.preventDefault();

    const serviceInput =
        document.getElementById(
            "apptService"
        );

    const dateInput =
        document.getElementById(
            "apptDate"
        );

    const timeInput =
        document.getElementById(
            "apptTime"
        );

    const errorBanner =
        document.getElementById(
            "modalErrorBanner"
        );

    const submitBtn =
        document.getElementById(
            "btnSubmitBooking"
        );

    if (errorBanner) {

        errorBanner.style.display =
            "none";

        errorBanner.textContent =
            "";
    }

    const serviceVal =
        serviceInput
            ? serviceInput.value.trim()
            : "General Consultation";

    if (!serviceVal) {

        if (errorBanner) {

            errorBanner.textContent =
                "Please enter a service name.";

            errorBanner.style.display =
                "flex";
        }

        return;
    }

    if (!validateDateTimeFields()) {
        return;
    }

    const dateVal =
        dateInput
            ? dateInput.value
            : "";

    const timeVal =
        timeInput
            ? timeInput.value
            : "";

    let origText =
        "Book Appointment";

    if (submitBtn) {

        origText =
            submitBtn.textContent;

        submitBtn.disabled =
            true;

        submitBtn.textContent =
            "Booking...";
    }

    let res;

    try {

        res =
            await createToken(
                "NORMAL"
            );

    } catch (error) {

        console.error(
            "Booking submission error:",
            error
        );

        res = {

            success: false,

            message:
                "Booking failed. Please try again."
        };
    }

    // Always restore button

    if (submitBtn) {

        submitBtn.disabled =
            false;

        submitBtn.textContent =
            origText;
    }


    // SUCCESS

    if (
        res.success &&
        res.data
    ) {

        const tokenData =
            res.data;

        const tokenNum =
            tokenData.token_number ||
            "Confirmed";

        const queuePosition =
            tokenData.queue_position ??
            "Confirmed";

        const counter =
            tokenData.counter ||
            "Counter 1";


        // FORMAT DATE

        const [
            y,
            m,
            d
        ] =
            dateVal
                .split("-")
                .map(Number);

        const selDateObj =
            new Date(
                y,
                m - 1,
                d
            );

        const formattedDate =
            selDateObj.toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                }
            );


        // FORMAT TIME

        const [
            h,
            min
        ] =
            timeVal
                .split(":")
                .map(Number);

        const period =
            h >= 12
                ? "PM"
                : "AM";

        const displayH =
            h % 12 || 12;

        const formattedTime =
            `${String(displayH).padStart(2, "0")}:` +
            `${String(min).padStart(2, "0")} ${period}`;


        const newId =
            Date.now();


        // REMOVE EMPTY STATE

        const emptyState =
            document.querySelector(
                "#upcomingGrid .empty-state"
            );

        if (emptyState) {
            emptyState.remove();
        }


        // CREATE CARD

        const grid =
            document.getElementById(
                "upcomingGrid"
            );

        if (grid) {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "appt-card confirmed";

            card.setAttribute(
                "data-id",
                newId
            );

            card.innerHTML = `

                <div class="appt-card-header">

                    <span class="appt-service-name">

                        ${escapeHTML(serviceVal)}

                    </span>

                    <span
                        class="card-badge badge-success">

                        Active

                    </span>

                </div>


                <div class="appt-meta-grid">

                    <div class="appt-meta-item">

                        <span class="appt-meta-label">
                            Date
                        </span>

                        <span class="appt-meta-value">
                            ${escapeHTML(formattedDate)}
                        </span>

                    </div>


                    <div class="appt-meta-item">

                        <span class="appt-meta-label">
                            Time
                        </span>

                        <span class="appt-meta-value">
                            ${escapeHTML(formattedTime)}
                        </span>

                    </div>


                    <div class="appt-meta-item">

                        <span class="appt-meta-label">
                            Counter
                        </span>

                        <span class="appt-meta-value">
                            ${escapeHTML(counter)}
                        </span>

                    </div>


                    <div class="appt-meta-item">

                        <span class="appt-meta-label">
                            Token
                        </span>

                        <span class="appt-meta-value token">
                            ${escapeHTML(tokenNum)}
                        </span>

                    </div>

                </div>


                <div class="appt-card-actions">

                    <button
                        class="btn-action-ghost"
                        data-action="details">

                        View Details

                    </button>


                    <button
                        class="btn-action-cancel"
                        data-action="cancel">

                        Cancel

                    </button>

                </div>
            `;


            // VIEW DETAILS

            card
                .querySelector(
                    '[data-action="details"]'
                )
                ?.addEventListener(
                    "click",
                    () => {

                        viewDetails(
                            newId
                        );
                    }
                );


            // CANCEL

            card
                .querySelector(
                    '[data-action="cancel"]'
                )
                ?.addEventListener(
                    "click",
                    () => {

                        showCancelConfirm(
                            newId,
                            serviceVal,
                            formattedDate,
                            tokenNum
                        );
                    }
                );


            grid.prepend(card);

            refreshCounts();
        }


        // CLOSE BOOKING FORM

        closeBookingModal();


        // SUCCESS MODAL

        showBookingSuccess({

            token:
                tokenNum,

            queuePosition:
                queuePosition,

            date:
                formattedDate,

            time:
                formattedTime,

            service:
                serviceVal
        });


    } else {

        // ERROR

        if (errorBanner) {

            errorBanner.textContent =
                res.message ||
                "Unable to book token. Check backend service.";

            errorBanner.style.display =
                "flex";

        } else {

            showErrorModal(
                res.message ||
                "Unable to book token. Check backend service."
            );
        }
    }
}


// ============================================================
// ERROR UI
// ============================================================

function showErrorModal(message) {

    injectAppointmentModalStyles();

    const old =
        document.getElementById(
            "vizitorErrorModal"
        );

    if (old) old.remove();

    const modal =
        document.createElement("div");

    modal.id =
        "vizitorErrorModal";

    modal.className =
        "vizitor-ui-overlay";

    modal.innerHTML = `

        <div class="vizitor-ui-card">

            <button
                class="vizitor-ui-close"
                id="closeErrorModal">
                ×
            </button>

            <div class="vizitor-ui-icon cancel">
                !
            </div>

            <h2>Booking Unsuccessful</h2>

            <p class="vizitor-ui-subtitle">
                ${escapeHTML(message)}
            </p>

            <button
                class="vizitor-primary-btn"
                id="errorDone">

                Try Again

            </button>

        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
    };

    document
        .getElementById("closeErrorModal")
        ?.addEventListener(
            "click",
            close
        );

    document
        .getElementById("errorDone")
        ?.addEventListener(
            "click",
            close
        );
}


// ============================================================
// PAGE READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        injectAppointmentModalStyles();


        // BOOK BUTTON

        const bookBtn =
            document.getElementById(
                "btnBookNew"
            );

        if (bookBtn) {

            bookBtn.addEventListener(
                "click",
                openBookingModal
            );
        }


        // CLOSE BUTTON

        const closeBtn =
            document.getElementById(
                "btnCloseModal"
            );

        if (closeBtn) {

            closeBtn.addEventListener(
                "click",
                closeBookingModal
            );
        }


        // CANCEL BOOKING MODAL

        const cancelBtn =
            document.getElementById(
                "btnCancelModal"
            );

        if (cancelBtn) {

            cancelBtn.addEventListener(
                "click",
                closeBookingModal
            );
        }


        // BOOKING FORM

        const bookingForm =
            document.getElementById(
                "bookingForm"
            );

        if (bookingForm) {

            bookingForm.addEventListener(
                "submit",
                handleBookingSubmit
            );
        }


        // DATE VALIDATION

        const apptDateInput =
            document.getElementById(
                "apptDate"
            );

        const apptTimeInput =
            document.getElementById(
                "apptTime"
            );

        if (apptDateInput) {

            apptDateInput.addEventListener(
                "change",
                validateDateTimeFields
            );

            apptDateInput.addEventListener(
                "input",
                validateDateTimeFields
            );
        }

        if (apptTimeInput) {

            apptTimeInput.addEventListener(
                "change",
                validateDateTimeFields
            );

            apptTimeInput.addEventListener(
                "input",
                validateDateTimeFields
            );
        }


        // BOOKING BACKDROP

        const backdrop =
            document.getElementById(
                "bookModalBackdrop"
            );

        if (backdrop) {

            backdrop.addEventListener(
                "click",
                (e) => {

                    if (
                        e.target === backdrop
                    ) {

                        closeBookingModal();
                    }
                }
            );
        }


        // ESCAPE KEY

        document.addEventListener(
            "keydown",
            (e) => {

                if (e.key === "Escape") {

                    closeBookingModal();

                    [
                        "bookingSuccessModal",
                        "cancelSuccessModal",
                        "cancelConfirmModal",
                        "vizitorDetailsModal",
                        "vizitorErrorModal"
                    ].forEach(
                        id => {

                            const modal =
                                document.getElementById(
                                    id
                                );

                            if (modal) {
                                modal.remove();
                            }
                        }
                    );
                }
            }
        );


        // PROFILE

        const profileBadge =
            document.querySelector(
                ".profile-badge"
            );

        if (profileBadge) {

            profileBadge.style.cursor =
                "pointer";

            profileBadge.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "profile.html";
                }
            );
        }


        // NOTIFICATIONS

        const notifBtn =
            document.querySelector(
                '.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]'
            );

        if (notifBtn) {

            notifBtn.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "notifications.html";
                }
            );
        }


        // LOGOUT

        const logoutLinks =
            document.querySelectorAll(
                '.sidebar-footer a, #btnLogout'
            );

        logoutLinks.forEach(
            link => {

                link.addEventListener(
                    "click",
                    (e) => {

                        e.preventDefault();

                        if (
                            typeof logoutUser ===
                            "function"
                        ) {

                            logoutUser();

                        } else {

                            localStorage.removeItem(
                                "access_token"
                            );

                            window.location.href =
                                "index.html";
                        }
                    }
                );
            }
        );


        refreshCounts();


        console.log(
            "appointments.js loaded successfully. " +
            "VIZITOR appointment UI active."
        );
    }
);