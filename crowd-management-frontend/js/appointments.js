/**
 * OPD Appointments, Doctor Consultation Slots, and Queue Management
 * Integrates with FastAPI backend for departments, doctors, slots, tokens, and queues.
 */

// State caches
let allFacilities = [];
let allSpecialists = [];
let allDepartments = [];
let currentAppointments = [];
let selectedSlot = null;

/**
 * Format ISO datetime string or time
 */
function formatDisplayDate(dateStr) {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return dateStr;
    }
}

function formatSlotTime(timeStr) {
    if (!timeStr) return "General OPD";
    try {
        const parts = timeStr.split(":");
        if (parts.length < 2) return timeStr;
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        const period = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 || 12;
        return `${displayH}:${m} ${period}`;
    } catch {
        return timeStr;
    }
}

/**
 * Initialize page on load
 */
document.addEventListener("DOMContentLoaded", async () => {
    initEventListeners();
    await loadInitialData();
});

/**
 * Setup DOM event listeners
 */
function initEventListeners() {
    // Navigation / Header buttons
    const btnBookNew = document.getElementById("btnBookNew");
    if (btnBookNew) btnBookNew.addEventListener("click", openBookingModal);

    const btnCloseModal = document.getElementById("btnCloseModal");
    if (btnCloseModal) btnCloseModal.addEventListener("click", closeBookingModal);

    const btnCancelModal = document.getElementById("btnCancelModal");
    if (btnCancelModal) btnCancelModal.addEventListener("click", closeBookingModal);

    const btnManageSchedule = document.getElementById("btnManageSchedule");
    if (btnManageSchedule) btnManageSchedule.addEventListener("click", openScheduleModal);

    const btnCloseScheduleModal = document.getElementById("btnCloseScheduleModal");
    if (btnCloseScheduleModal) btnCloseScheduleModal.addEventListener("click", closeScheduleModal);

    const btnCancelScheduleModal = document.getElementById("btnCancelScheduleModal");
    if (btnCancelScheduleModal) btnCancelScheduleModal.addEventListener("click", closeScheduleModal);

    // Filters
    const filterFacility = document.getElementById("filterFacility");
    if (filterFacility) filterFacility.addEventListener("change", () => loadAppointments());

    const filterDepartment = document.getElementById("filterDepartment");
    if (filterDepartment) filterDepartment.addEventListener("change", () => loadAppointments());

    const filterStatus = document.getElementById("filterStatus");
    if (filterStatus) filterStatus.addEventListener("change", () => loadAppointments());

    const btnRefreshAppts = document.getElementById("btnRefreshAppts");
    if (btnRefreshAppts) btnRefreshAppts.addEventListener("click", () => loadAppointments());

    const btnResetFilters = document.getElementById("btnResetFilters");
    if (btnResetFilters) {
        btnResetFilters.addEventListener("click", () => {
            if (filterFacility) filterFacility.value = "";
            if (filterDepartment) filterDepartment.value = "";
            if (filterStatus) filterStatus.value = "";
            const search = document.getElementById("appointmentSearch");
            if (search) search.value = "";
            loadAppointments();
        });
    }

    const searchInput = document.getElementById("appointmentSearch");
    if (searchInput) {
        searchInput.addEventListener("input", () => filterDisplayedAppointments());
    }

    // Modal reactive dropdowns
    const modalFacility = document.getElementById("modalFacilitySelect");
    if (modalFacility) {
        modalFacility.addEventListener("change", async () => {
            const facId = modalFacility.value;
            await onModalFacilityChange(facId);
        });
    }

    const modalDept = document.getElementById("modalDeptSelect");
    if (modalDept) {
        modalDept.addEventListener("change", async () => {
            const dept = modalDept.value;
            await onModalDepartmentChange(dept);
        });
    }

    const modalDoctor = document.getElementById("modalDoctorSelect");
    if (modalDoctor) {
        modalDoctor.addEventListener("change", async () => {
            await refreshModalSlots();
        });
    }

    const modalDate = document.getElementById("modalDateInput");
    if (modalDate) {
        modalDate.addEventListener("change", async () => {
            await refreshModalSlots();
        });
    }

    // Modal forms
    const bookingForm = document.getElementById("bookingForm");
    if (bookingForm) bookingForm.addEventListener("submit", handleBookingSubmit);

    const scheduleForm = document.getElementById("scheduleForm");
    if (scheduleForm) scheduleForm.addEventListener("submit", handleScheduleSubmit);

    const schedDoctor = document.getElementById("schedDoctorSelect");
    if (schedDoctor) schedDoctor.addEventListener("change", onScheduleDoctorSelect);

    // Close on backdrop click
    const bookBackdrop = document.getElementById("bookModalBackdrop");
    if (bookBackdrop) {
        bookBackdrop.addEventListener("click", (e) => {
            if (e.target === bookBackdrop) closeBookingModal();
        });
    }

    const schedBackdrop = document.getElementById("scheduleModalBackdrop");
    if (schedBackdrop) {
        schedBackdrop.addEventListener("click", (e) => {
            if (e.target === schedBackdrop) closeScheduleModal();
        });
    }
}

/**
 * Load initial facilities, specialists, and appointments
 */
async function loadInitialData() {
    try {
        // 1. Fetch facilities
        const facRes = await fetchFacilities(true);
        if (facRes.success && Array.isArray(facRes.data)) {
            allFacilities = facRes.data;
            populateFacilitySelects(allFacilities);
        }

        // 2. Fetch specialists
        const specRes = await fetchSpecialists();
        if (specRes.success && Array.isArray(specRes.data)) {
            allSpecialists = specRes.data;
            populateDoctorScheduleSelect(allSpecialists);
        }

        // 3. Load appointments
        await loadAppointments();
    } catch (err) {
        console.error("Error during initial data loading:", err);
    }
}

/**
 * Populate facility dropdowns
 */
function populateFacilitySelects(facilities) {
    const filterSel = document.getElementById("filterFacility");
    const modalSel = document.getElementById("modalFacilitySelect");

    if (filterSel) {
        filterSel.innerHTML = '<option value="">All Facilities</option>';
        facilities.forEach((f) => {
            const opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent = `${f.name} (${f.facility_type.replace('_', ' ')})`;
            filterSel.appendChild(opt);
        });
    }

    if (modalSel) {
        modalSel.innerHTML = '<option value="">Select Healthcare Facility...</option>';
        facilities.forEach((f) => {
            const opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent = `${f.name} (${f.facility_type.replace('_', ' ')})`;
            modalSel.appendChild(opt);
        });
    }
}

/**
 * Load and display appointments from backend
 */
async function loadAppointments() {
    const upcomingGrid = document.getElementById("upcomingGrid");
    const prevTableBody = document.getElementById("prevTableBody");
    const upcomingCount = document.getElementById("upcomingCount");
    const prevCount = document.getElementById("prevCount");

    if (upcomingGrid) {
        upcomingGrid.innerHTML = `
            <div class="state-container" style="grid-column: 1 / -1;">
                <div class="spinner"></div>
                <p>Loading real-time appointment tokens and slot queue...</p>
            </div>
        `;
    }

    const filters = {};
    const filterFacility = document.getElementById("filterFacility");
    if (filterFacility && filterFacility.value) filters.facility_id = filterFacility.value;

    const filterStatus = document.getElementById("filterStatus");
    if (filterStatus && filterStatus.value) filters.status = filterStatus.value;

    const res = await fetchAppointments(filters);

    if (!res.success) {
        if (upcomingGrid) {
            upcomingGrid.innerHTML = `
                <div class="state-container" style="grid-column:1/-1;">
                    <div class="error-icon">⚠️</div>
                    <h3>Failed to Load Appointments</h3>
                    <p>${res.message || "Unable to retrieve appointment queue."}</p>
                </div>
            `;
        }
        return;
    }

    currentAppointments = res.data || [];

    // Show stale data warning if reading from offline cache
    if (res.fromCache) {
        const staleNote = document.getElementById('appointmentStaleBanner') || (() => {
            const n = document.createElement('div');
            n.id = 'appointmentStaleBanner';
            n.style.cssText = 'margin-bottom:12px; padding:8px 14px; background:#fefce8; border:1px solid #fde047; border-radius:8px; font-size:0.82rem; color:#854d0e; font-weight:500;';
            const grid = document.getElementById('upcomingGrid');
            if (grid && grid.parentNode) grid.parentNode.insertBefore(n, grid);
            return n;
        })();
        const lastSynced = res.lastSyncedAt ? new Date(res.lastSyncedAt).toLocaleTimeString() : 'Unknown';
        staleNote.innerHTML = `⚠️ <strong>Offline / Cached Data</strong> — Showing locally cached appointments (last synced: ${lastSynced}). Data may be outdated.`;
        staleNote.style.display = 'block';
    } else {
        const staleNote = document.getElementById('appointmentStaleBanner');
        if (staleNote) staleNote.style.display = 'none';
    }

    filterDisplayedAppointments();
}

/**
 * Filter and render loaded appointments
 */
function filterDisplayedAppointments() {
    const searchVal = (document.getElementById("appointmentSearch")?.value || "").toLowerCase().trim();
    const deptFilter = document.getElementById("filterDepartment")?.value || "";

    const filtered = currentAppointments.filter((a) => {
        if (deptFilter && a.department !== deptFilter) return false;
        if (searchVal) {
            const patient = (a.patient_name || "").toLowerCase();
            const doctor = (a.specialist_name || "").toLowerCase();
            const dept = (a.department || "").toLowerCase();
            const facility = (a.facility_name || "").toLowerCase();
            const token = String(a.token_number || "");
            if (!patient.includes(searchVal) && !doctor.includes(searchVal) && !dept.includes(searchVal) && !facility.includes(searchVal) && !token.includes(searchVal)) {
                return false;
            }
        }
        return true;
    });

    const activeAppts = filtered.filter(a => ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "PENDING_SYNC", "CONFLICT"].includes(a.status) || a._isOfflinePending);
    const historyAppts = filtered.filter(a => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status));

    // Update counters
    const upcomingCount = document.getElementById("upcomingCount");
    if (upcomingCount) upcomingCount.textContent = activeAppts.length;

    const prevCount = document.getElementById("prevCount");
    if (prevCount) prevCount.textContent = historyAppts.length;

    renderActiveAppointments(activeAppts);
    renderHistoricalAppointments(historyAppts);
}

/**
 * Render active appointment cards
 */
function renderActiveAppointments(appts) {
    const grid = document.getElementById("upcomingGrid");
    if (!grid) return;

    if (appts.length === 0) {
        grid.innerHTML = `
            <div class="state-container" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
                <div class="empty-icon">📅</div>
                <h3>No Active Consultations Found</h3>
                <p>There are no active or scheduled appointments matching your filters. Click "Book OPD Appointment" to schedule one.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = appts.map((a) => {
        const slotDisplay = a.slot_start_time
            ? `${formatSlotTime(a.slot_start_time)} - ${formatSlotTime(a.slot_end_time)}`
            : "OPD Walk-in / General";

        let badgeClass = "badge-success";
        let statusLabel = "Scheduled";
        if (a.status === "CHECKED_IN") {
            badgeClass = "badge-urgent";
            statusLabel = "Checked In";
        } else if (a.status === "IN_CONSULTATION") {
            badgeClass = "badge-emergency";
            statusLabel = "In Consultation";
        } else if (a.status === "PENDING_SYNC" || a._isOfflinePending) {
            badgeClass = "badge-pending-sync";
            statusLabel = "Pending Sync";
        } else if (a.status === "CONFLICT") {
            badgeClass = "badge-conflict";
            statusLabel = "Slot Conflict";
        }

        const doctorName = a.specialist_name ? `Dr. ${a.specialist_name}` : "Assigned OPD Specialist";
        let tokenDisplay = `<span class="appt-meta-value token" style="color:#7c3aed; font-size:1.1rem; font-weight:800;">#${a.token_number || "—"}</span>`;
        if (a.status === "PENDING_SYNC" || a._isOfflinePending) {
            tokenDisplay = `<span style="color:#d97706; font-size:0.8rem; font-weight:700;">Pending Server Sync<br><small style="color:#64748b; font-weight:normal;">Ref: ${a.localReference || a.id}</small></span>`;
        } else if (a.status === "CONFLICT") {
            tokenDisplay = `<span style="color:#ef4444; font-size:0.8rem; font-weight:700;">Slot Unavailable<br><small style="color:#64748b; font-weight:normal;">Reselect slot</small></span>`;
        }

        return `
            <div class="appt-card confirmed" data-id="${a.id}">
                <div class="appt-card-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span class="appt-service-name">${escapeHtml(a.patient_name)}</span>
                        <div style="margin-top: 4px; display:flex; gap:0.4rem; flex-wrap:wrap;">
                            <span class="department-badge">${escapeHtml(a.department || "OPD")}</span>
                            <span class="slot-badge">⏰ ${slotDisplay}</span>
                        </div>
                    </div>
                    <span class="card-badge ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="appt-meta-grid" style="margin-top: 1rem;">
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Attending Doctor</span>
                        <span class="appt-meta-value" style="font-weight:600; color:#0f172a;">${escapeHtml(doctorName)}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Facility</span>
                        <span class="appt-meta-value">${escapeHtml(a.facility_name || a.facility_id)}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Date</span>
                        <span class="appt-meta-value">${formatDisplayDate(a.appointment_date)}</span>
                    </div>
                    <div class="appt-meta-item">
                        <span class="appt-meta-label">Queue Token</span>
                        ${tokenDisplay}
                    </div>
                </div>
                <div class="appt-card-actions" style="margin-top: 1rem;">
                    <button class="btn-action-ghost" onclick="viewAppointmentDetails('${a.id}')">View Details</button>
                    ${a.status !== 'PENDING_SYNC' && a.status !== 'CONFLICT' ? `<button class="btn-action-cancel" onclick="cancelAppointmentPrompt('${a.id}', '${escapeHtml(a.patient_name)}', '${a.slot_start_time || ''}', '${a.token_number || ''}')">Cancel</button>` : ''}
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Render historical / completed appointments table
 */
function renderHistoricalAppointments(appts) {
    const tbody = document.getElementById("prevTableBody");
    if (!tbody) return;

    if (appts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 2rem; color:#64748b;">No completed or historical appointments found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = appts.map((a) => {
        let badgeClass = "badge-neutral";
        if (a.status === "COMPLETED") badgeClass = "badge-success";
        if (a.status === "CANCELLED") badgeClass = "badge-danger";

        const slotDisplay = a.slot_start_time
            ? `${formatSlotTime(a.slot_start_time)} - ${formatSlotTime(a.slot_end_time)}`
            : "OPD Regular";

        const doctorDisplay = a.specialist_name ? `Dr. ${a.specialist_name}` : "General OPD";

        return `
            <tr>
                <td>
                    <div style="font-weight:600; color:#0f172a;">${escapeHtml(a.patient_name)}</div>
                    <div style="font-size:0.75rem; color:#7c3aed; font-weight:700;">Token #${a.token_number || "—"}</div>
                </td>
                <td>
                    <div><span class="department-badge">${escapeHtml(a.department || "OPD")}</span></div>
                    <div style="font-size:0.8rem; color:#475569; margin-top:2px;">${escapeHtml(doctorDisplay)}</div>
                </td>
                <td>
                    <span style="font-size:0.85rem; color:#334155;">${escapeHtml(a.facility_name || a.facility_id)}</span>
                </td>
                <td>
                    <span style="font-size:0.85rem; color:#475569;">${slotDisplay}</span>
                    <div style="font-size:0.75rem; color:#94a3b8;">${formatDisplayDate(a.appointment_date)}</div>
                </td>
                <td>
                    <span class="card-badge ${badgeClass}">${a.status}</span>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Modal Handling: Open booking modal
 */
async function openBookingModal() {
    const backdrop = document.getElementById("bookModalBackdrop");
    const dateInput = document.getElementById("modalDateInput");
    const errorBanner = document.getElementById("modalErrorBanner");
    const slotGrid = document.getElementById("modalSlotGrid");
    const slotPill = document.getElementById("selectedSlotPill");

    if (errorBanner) { errorBanner.style.display = "none"; errorBanner.textContent = ""; }
    if (slotPill) slotPill.style.display = "none";

    // Set today's date
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    if (dateInput) {
        dateInput.min = todayStr;
        dateInput.value = todayStr;
    }

    selectedSlot = null;
    document.getElementById("selectedSlotStart").value = "";
    document.getElementById("selectedSlotEnd").value = "";

    if (slotGrid) {
        slotGrid.innerHTML = `
            <div style="grid-column:1/-1; padding:1rem; text-align:center; color:#64748b; font-size:0.85rem;">
                Select a facility, department, and doctor to view live consultation slots.
            </div>
        `;
    }

    if (backdrop) backdrop.style.display = "flex";
}

function closeBookingModal() {
    const backdrop = document.getElementById("bookModalBackdrop");
    if (backdrop) backdrop.style.display = "none";
}

/**
 * Modal Handler: Facility changed
 */
async function onModalFacilityChange(facilityId) {
    const deptSelect = document.getElementById("modalDeptSelect");
    const doctorSelect = document.getElementById("modalDoctorSelect");
    if (!deptSelect || !doctorSelect) return;

    deptSelect.innerHTML = '<option value="">Loading departments...</option>';
    doctorSelect.innerHTML = '<option value="">Any Specialist / General OPD</option>';

    if (!facilityId) {
        deptSelect.innerHTML = '<option value="">Select Facility First...</option>';
        return;
    }

    try {
        // Fetch departments for this facility
        const res = await fetchFacilityDepartments(facilityId);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            deptSelect.innerHTML = '<option value="">Select Department...</option>';
            res.data.forEach((d) => {
                const opt = document.createElement("option");
                opt.value = d.name;
                opt.textContent = d.name;
                deptSelect.appendChild(opt);
            });
            // Update filter department select as well
            updateFilterDepartmentSelect(res.data);
        } else {
            deptSelect.innerHTML = '<option value="General Medicine">General Medicine</option><option value="OPD">OPD</option>';
        }

        // Fetch specialists attached to this facility
        const specRes = await fetchSpecialists({ facility_id: facilityId });
        if (specRes.success && Array.isArray(specRes.data)) {
            populateModalDoctorSelect(specRes.data);
        }
    } catch (err) {
        console.error("Error loading facility departments:", err);
    }
}

function updateFilterDepartmentSelect(depts) {
    const filterDept = document.getElementById("filterDepartment");
    if (!filterDept) return;
    const currentVal = filterDept.value;
    filterDept.innerHTML = '<option value="">All Departments</option>';
    depts.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.name;
        opt.textContent = d.name;
        filterDept.appendChild(opt);
    });
    if (currentVal) filterDept.value = currentVal;
}

/**
 * Modal Handler: Department changed
 */
async function onModalDepartmentChange(departmentName) {
    const facilityId = document.getElementById("modalFacilitySelect")?.value;
    if (!facilityId) return;

    const specRes = await fetchSpecialists({ facility_id: facilityId, department: departmentName });
    if (specRes.success && Array.isArray(specRes.data)) {
        populateModalDoctorSelect(specRes.data);
    }
    await refreshModalSlots();
}

/**
 * Populate doctor select in modal
 */
function populateModalDoctorSelect(doctors) {
    const doctorSelect = document.getElementById("modalDoctorSelect");
    if (!doctorSelect) return;

    doctorSelect.innerHTML = '<option value="">Any Specialist / General OPD</option>';
    doctors.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = `Dr. ${doc.name} (${doc.specialization || doc.department || 'General'})`;
        doctorSelect.appendChild(opt);
    });
}

/**
 * Fetch and render slots in modal for selected doctor + date
 */
async function refreshModalSlots() {
    const doctorId = document.getElementById("modalDoctorSelect")?.value;
    const dateVal = document.getElementById("modalDateInput")?.value;
    const slotGrid = document.getElementById("modalSlotGrid");
    const slotPill = document.getElementById("selectedSlotPill");

    selectedSlot = null;
    document.getElementById("selectedSlotStart").value = "";
    document.getElementById("selectedSlotEnd").value = "";
    if (slotPill) slotPill.style.display = "none";

    if (!slotGrid) return;

    if (!doctorId) {
        slotGrid.innerHTML = `
            <div style="grid-column:1/-1; padding:0.85rem; text-align:center; color:#64748b; font-size:0.85rem;">
                Please select a specific doctor above to view individual time slots, or proceed for general queue triage.
            </div>
        `;
        return;
    }

    if (!dateVal) {
        slotGrid.innerHTML = `
            <div style="grid-column:1/-1; padding:0.85rem; text-align:center; color:#64748b; font-size:0.85rem;">
                Please pick an appointment date.
            </div>
        `;
        return;
    }

    slotGrid.innerHTML = `
        <div style="grid-column:1/-1; padding:1rem; text-align:center; color:#7c3aed;">
            <div class="spinner" style="width:24px; height:24px; margin:0 auto 6px;"></div>
            Loading live available consultation slots...
        </div>
    `;

    const res = await fetchDoctorSlots(doctorId, dateVal);

    if (!res.success) {
        slotGrid.innerHTML = `
            <div style="grid-column:1/-1; padding:0.85rem; text-align:center; color:#dc2626; font-size:0.85rem;">
                ${res.message || "Failed to load doctor slots."}
            </div>
        `;
        return;
    }

    const isCachedSlot = !!res.fromCache || (window.Connectivity && !window.Connectivity.isOnline());
    const slots = res.data || [];
    if (slots.length === 0) {
        slotGrid.innerHTML = `
            <div style="grid-column:1/-1; padding:0.85rem; text-align:center; color:#64748b; font-size:0.85rem;">
                No slots configured for this doctor on the selected date.
            </div>
        `;
        return;
    }

    let slotHtml = '';
    if (isCachedSlot) {
        slotHtml += `
            <div style="grid-column:1/-1; margin-bottom:8px; padding:6px 12px; background:#fefce8; border:1px solid #fde047; border-radius:6px; font-size:0.75rem; color:#854d0e; text-align:center; font-weight:500;">
                ⚠️ <strong>Cached availability</strong> — will be verified with the server when connection returns.
            </div>
        `;
    }

    slotHtml += slots.map((s, idx) => {
        let chipClass = "slot-chip";
        let subText = "Open";

        if (s.is_booked) {
            chipClass += " booked";
            subText = "Booked";
        } else if (s.reason && s.reason.toLowerCase().includes("break")) {
            chipClass += " break";
            subText = "Break";
        } else if (!s.is_available) {
            chipClass += " disabled";
            subText = s.reason || "Unavailable";
        } else {
            chipClass += " available";
        }

        const isClickable = s.is_available && !s.is_booked;

        return `
            <div class="${chipClass}" 
                 data-start="${s.slot_start_time}" 
                 data-end="${s.slot_end_time}"
                 ${isClickable ? `onclick="selectSlot(this, '${s.slot_start_time}', '${s.slot_end_time}')"` : ''}
                 title="${s.reason || (isClickable ? 'Click to book this slot' : 'Unavailable')}">
                <span class="slot-time-text">${formatSlotTime(s.slot_start_time)}</span>
                <span class="slot-sub-text">${subText}</span>
            </div>
        `;
    }).join("");

    slotGrid.innerHTML = slotHtml;
}

/**
 * Handle Slot Chip Selection
 */
window.selectSlot = function(element, startTime, endTime) {
    document.querySelectorAll("#modalSlotGrid .slot-chip").forEach((chip) => {
        chip.classList.remove("selected");
    });

    element.classList.add("selected");
    selectedSlot = { start: startTime, end: endTime };
    document.getElementById("selectedSlotStart").value = startTime;
    document.getElementById("selectedSlotEnd").value = endTime;

    const slotPill = document.getElementById("selectedSlotPill");
    const slotPillText = document.getElementById("slotPillText");
    if (slotPill && slotPillText) {
        slotPillText.textContent = `${formatSlotTime(startTime)} - ${formatSlotTime(endTime)}`;
        slotPill.style.display = "flex";
    }
};

/**
 * Handle Appointment Booking Submission
 */
async function handleBookingSubmit(e) {
    e.preventDefault();

    const facilityId = document.getElementById("modalFacilitySelect")?.value;
    const department = document.getElementById("modalDeptSelect")?.value;
    const specialistId = document.getElementById("modalDoctorSelect")?.value || null;
    const patientName = document.getElementById("modalPatientName")?.value.trim();
    const patientId = document.getElementById("modalPatientId")?.value.trim() || null;
    const notes = document.getElementById("modalNotes")?.value.trim() || null;
    const slotStart = document.getElementById("selectedSlotStart")?.value || null;
    const slotEnd = document.getElementById("selectedSlotEnd")?.value || null;
    const errorBanner = document.getElementById("modalErrorBanner");
    const submitBtn = document.getElementById("btnSubmitBooking");

    if (errorBanner) { errorBanner.style.display = "none"; errorBanner.textContent = ""; }

    if (!facilityId) {
        showModalError("Please select a healthcare facility.");
        return;
    }
    if (!department) {
        showModalError("Please select an OPD department.");
        return;
    }
    if (!patientName) {
        showModalError("Please enter the patient's full name.");
        return;
    }

    const payload = {
        facility_id: facilityId,
        department: department,
        specialist_id: specialistId,
        patient_name: patientName,
        patient_id: patientId,
        slot_start_time: slotStart,
        slot_end_time: slotEnd,
        notes: notes,
    };

    let origBtnText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Booking Slot...";
    }

    const res = await createAppointment(payload);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
    }

    if (res.success && res.data) {
        const appt = res.data;
        closeBookingModal();
        await loadAppointments();

        if (res.isOfflineRequest) {
            alert(
                `📋 Appointment Request Saved Offline!\n\n` +
                `Local Reference: ${res.localReference || appt.id}\n` +
                `Patient: ${appt.patient_name}\n` +
                `Department: ${appt.department}\n` +
                `Status: Pending Sync\n\n` +
                `Your appointment token will be generated after the server confirms the slot when connectivity is restored.`
            );
            return;
        }

        const slotMsg = appt.slot_start_time
            ? `\nTime Slot: ${formatSlotTime(appt.slot_start_time)} - ${formatSlotTime(appt.slot_end_time)}`
            : "";

        alert(
            `✅ Appointment & Token Booked Successfully!\n\n` +
            `Patient: ${appt.patient_name}\n` +
            `Token Number: #${appt.token_number}\n` +
            `Department: ${appt.department}\n` +
            `Doctor: ${appt.specialist_name ? 'Dr. ' + appt.specialist_name : 'General OPD'}${slotMsg}\n` +
            `Status: ${appt.status}`
        );
    } else {
        const msg = res.message || "Failed to book appointment. Please check availability.";
        showModalError(msg);
    }
}

function showModalError(msg) {
    const errorBanner = document.getElementById("modalErrorBanner");
    if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = "flex";
    } else {
        alert(msg);
    }
}

/**
 * View detailed summary of an appointment
 */
window.viewAppointmentDetails = function(appointmentId) {
    const appt = currentAppointments.find(a => a.id === appointmentId);
    if (!appt) return;

    const slotMsg = appt.slot_start_time
        ? `${formatSlotTime(appt.slot_start_time)} - ${formatSlotTime(appt.slot_end_time)}`
        : "General OPD / Walk-in";

    alert(
        `📋 OPD Consultation & Token Details\n` +
        `─────────────────────────────────────\n` +
        `Appointment ID : ${appt.id}\n` +
        `Patient Name   : ${appt.patient_name}\n` +
        `Token Number   : #${appt.token_number || 'N/A'}\n` +
        `Department     : ${appt.department}\n` +
        `Doctor         : ${appt.specialist_name ? 'Dr. ' + appt.specialist_name : 'General OPD'}\n` +
        `Facility       : ${appt.facility_name || appt.facility_id}\n` +
        `Slot Time      : ${slotMsg}\n` +
        `Status         : ${appt.status}\n` +
        `Date           : ${formatDisplayDate(appt.appointment_date)}\n` +
        `Notes          : ${appt.notes || 'None'}\n` +
        `─────────────────────────────────────`
    );
};

/**
 * Prompt to cancel an appointment and free the slot
 */
window.cancelAppointmentPrompt = async function(appointmentId, patientName, slotTime, tokenNumber) {
    const slotDesc = slotTime ? `at ${formatSlotTime(slotTime)}` : '';
    const tokenDesc = tokenNumber ? `(Token #${tokenNumber})` : '';

    const confirmed = confirm(
        `Are you sure you want to cancel this appointment?\n\n` +
        `Patient : ${patientName} ${tokenDesc}\n` +
        `Slot    : ${slotDesc}\n\n` +
        `This will immediately release the time slot for other patients.`
    );

    if (!confirmed) return;

    const res = await updateAppointmentStatus(appointmentId, {
        status: "CANCELLED",
        notes: "Cancelled by patient/operator via dashboard",
    });

    if (res.success) {
        await loadAppointments();
        alert(`Appointment cancelled successfully. Time slot has been freed.`);
    } else {
        alert(res.message || "Failed to cancel appointment.");
    }
};

/**
 * OPD Doctor Schedule Modal (For Staff & Operators)
 */
function openScheduleModal() {
    const backdrop = document.getElementById("scheduleModalBackdrop");
    const errorBanner = document.getElementById("scheduleErrorBanner");
    if (errorBanner) { errorBanner.style.display = "none"; errorBanner.textContent = ""; }

    populateDoctorScheduleSelect(allSpecialists);
    if (backdrop) backdrop.style.display = "flex";
}

function closeScheduleModal() {
    const backdrop = document.getElementById("scheduleModalBackdrop");
    if (backdrop) backdrop.style.display = "none";
}

function populateDoctorScheduleSelect(specialists) {
    const select = document.getElementById("schedDoctorSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Choose Specialist / Doctor...</option>';
    specialists.forEach((doc) => {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = `Dr. ${doc.name} (${doc.specialization || doc.department || 'General'}) - ${doc.facility_name || doc.facility_id}`;
        select.appendChild(opt);
    });
}

function onScheduleDoctorSelect() {
    const docId = document.getElementById("schedDoctorSelect")?.value;
    if (!docId) return;

    const doc = allSpecialists.find(s => s.id === docId);
    if (doc) {
        if (doc.opd_start_time) document.getElementById("schedStartTime").value = doc.opd_start_time;
        if (doc.opd_end_time) document.getElementById("schedEndTime").value = doc.opd_end_time;
        if (doc.slot_duration_minutes) document.getElementById("schedSlotDuration").value = String(doc.slot_duration_minutes);
        if (doc.working_days) document.getElementById("schedWorkingDays").value = doc.working_days;
        if (doc.break_start_time) document.getElementById("schedBreakStart").value = doc.break_start_time;
        if (doc.break_end_time) document.getElementById("schedBreakEnd").value = doc.break_end_time;
    }
}

async function handleScheduleSubmit(e) {
    e.preventDefault();

    const docId = document.getElementById("schedDoctorSelect")?.value;
    const startTime = document.getElementById("schedStartTime")?.value;
    const endTime = document.getElementById("schedEndTime")?.value;
    const duration = parseInt(document.getElementById("schedSlotDuration")?.value || "15", 10);
    const workingDays = document.getElementById("schedWorkingDays")?.value.trim();
    const breakStart = document.getElementById("schedBreakStart")?.value;
    const breakEnd = document.getElementById("schedBreakEnd")?.value;
    const submitBtn = document.getElementById("btnSaveSchedule");
    const errorBanner = document.getElementById("scheduleErrorBanner");

    if (!docId) {
        if (errorBanner) {
            errorBanner.textContent = "Please select a doctor.";
            errorBanner.style.display = "flex";
        }
        return;
    }

    const payload = {
        opd_start_time: startTime,
        opd_end_time: endTime,
        slot_duration_minutes: duration,
        working_days: workingDays,
        break_start_time: breakStart,
        break_end_time: breakEnd,
        is_schedule_active: true,
    };

    let origText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving Schedule...";
    }

    const res = await updateDoctorSchedule(docId, payload);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
    }

    if (res.success) {
        closeScheduleModal();
        alert("Doctor OPD schedule updated successfully!");
        // Refresh specialist cache
        const specRes = await fetchSpecialists();
        if (specRes.success && Array.isArray(specRes.data)) {
            allSpecialists = specRes.data;
        }
    } else {
        if (errorBanner) {
            errorBanner.textContent = res.message || "Failed to update doctor schedule.";
            errorBanner.style.display = "flex";
        } else {
            alert(res.message || "Failed to update doctor schedule.");
        }
    }
}

/**
 * Utility: HTML sanitizer
 */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
