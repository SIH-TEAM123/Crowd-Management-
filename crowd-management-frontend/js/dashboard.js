/**
 * PHC Administrator & Facility Operator Dashboard Controller
 * Integrates real-time telemetry, appointments, doctors, resources, and referrals.
 */

// Application state caches
let activeFacilityId = null;
let cachedFacilities = [];
let lastOperationalState = null;
let lastAppointments = [];
let lastSpecialists = [];
let lastInventory = [];
let lastDiagnostics = [];
let lastReferrals = [];
let refreshTimer = null;

/**
 * Initialize dashboard on DOM ready
 */
document.addEventListener("DOMContentLoaded", async () => {
    initUserSession();
    initEventListeners();
    await loadFacilities();
    startAutoRefresh();
});

/**
 * Initialize user profile from /auth/me
 */
async function initUserSession() {
    const avatarEl = document.querySelector(".profile-badge .profile-avatar");
    try {
        const userRes = await getCurrentUser();
        if (userRes.success && userRes.data) {
            const user = userRes.data;
            if (avatarEl) {
                avatarEl.textContent = (user.full_name ? user.full_name.charAt(0) : (user.email ? user.email.charAt(0) : "A")).toUpperCase();
            }
        }
    } catch (e) {
        console.warn("Could not load user session:", e);
    }
}

/**
 * Setup Event Listeners
 */
function initEventListeners() {
    // Facility selector change
    const facilitySelect = document.getElementById("facilityContextSelect");
    if (facilitySelect) {
        facilitySelect.addEventListener("change", async (e) => {
            const facId = e.target.value;
            if (facId && facId !== activeFacilityId) {
                activeFacilityId = facId;
                localStorage.setItem("adminFacilityId", facId);
                await refreshDashboardData(activeFacilityId);
            }
        });
    }

    // Manual Refresh Button
    const refreshBtn = document.getElementById("btnRefreshDashboard");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            if (activeFacilityId) {
                await refreshDashboardData(activeFacilityId);
            }
        });
    }

    // Emergency Booking Modal setup (Preserved from legacy dashboard)
    const emergencyBtn = document.getElementById("btnEmergencyBooking");
    const emergencyModal = document.getElementById("emergencyModal");
    const closeEmergencyModal = document.getElementById("closeEmergencyModal");
    const cancelEmergencyBtn = document.getElementById("cancelEmergencyBtn");
    const emergencyForm = document.getElementById("emergencyForm");

    if (emergencyBtn && emergencyModal) {
        emergencyBtn.addEventListener("click", () => {
            emergencyModal.style.display = "flex";
        });
    }

    function hideEmergencyModal() {
        if (emergencyModal) emergencyModal.style.display = "none";
    }

    if (closeEmergencyModal) closeEmergencyModal.addEventListener("click", hideEmergencyModal);
    if (cancelEmergencyBtn) cancelEmergencyBtn.addEventListener("click", hideEmergencyModal);

    if (emergencyForm) {
        emergencyForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Offline emergency guard
            if (window.Connectivity && window.Connectivity.isOffline()) {
                alert("Offline mode: Emergency backend notification cannot be dispatched without server connectivity. Please contact local hospital directly or call emergency services.");
                return;
            }

            const emergencyType = document.getElementById("emergencyTypeSelect")?.value || "GENERAL_EMERGENCY";
            const emergencyDetails = document.getElementById("emergencyDetailsInput")?.value || "";

            const submitBtn = document.getElementById("submitEmergencyBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Issuing Emergency Token...";
            }

            const result = await createToken("TIME_CRITICAL", {
                emergency_type: emergencyType,
                emergency_details: emergencyDetails
            });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Issue Emergency Token";
            }

            hideEmergencyModal();

            if (result.success && result.data) {
                showQRModal(result.data, true);
                if (activeFacilityId) refreshDashboardData(activeFacilityId);
            } else {
                alert(result.message || "Emergency request submission failed.");
            }
        });
    }

    // QR Token Modal setup
    const closeQrModal = document.getElementById("closeQrModal");
    const doneQrBtn = document.getElementById("doneQrBtn");
    const qrModal = document.getElementById("qrModal");

    function hideQrModal() {
        if (qrModal) qrModal.style.display = "none";
    }

    if (closeQrModal) closeQrModal.addEventListener("click", hideQrModal);
    if (doneQrBtn) doneQrBtn.addEventListener("click", hideQrModal);

    // Profile and Logout Links
    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", () => window.location.href = "profile.html");
    }

    const notifBtn = document.getElementById("btnNotifications");
    if (notifBtn) {
        notifBtn.addEventListener("click", () => window.location.href = "notifications.html");
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            logoutUser();
        });
    });
}

/**
 * Load all facilities into context selector
 */
async function loadFacilities() {
    const facilitySelect = document.getElementById("facilityContextSelect");
    const facilityNameHeader = document.getElementById("activeFacilityNameHeader");

    try {
        const facRes = await fetchFacilities(true);
        if (facRes.success && Array.isArray(facRes.data) && facRes.data.length > 0) {
            cachedFacilities = facRes.data;

            if (facilitySelect) {
                facilitySelect.innerHTML = cachedFacilities.map(f => `
                    <option value="${f.id}">${escapeHtml(f.name)} (${f.facility_type.replace(/_/g, ' ')})</option>
                `).join("");

                // Check stored preference or default to first facility
                const savedFacId = localStorage.getItem("adminFacilityId");
                const matched = cachedFacilities.find(f => f.id === savedFacId);
                activeFacilityId = matched ? matched.id : cachedFacilities[0].id;
                facilitySelect.value = activeFacilityId;
            } else {
                activeFacilityId = cachedFacilities[0].id;
            }

            // Set Header name
            const currentFac = cachedFacilities.find(f => f.id === activeFacilityId);
            if (facilityNameHeader && currentFac) {
                facilityNameHeader.textContent = currentFac.name;
            }

            // Load all dashboard sections
            await refreshDashboardData(activeFacilityId);
        } else {
            console.warn("No facilities found or failed to load facilities.");
        }
    } catch (e) {
        console.error("Error loading facilities:", e);
    }
}

/**
 * Unified Telemetry & Section Refresh
 */
async function refreshDashboardData(facilityId) {
    if (!facilityId) return;

    const spinner = document.getElementById("refreshSpinnerIcon");
    const syncDot = document.getElementById("syncIndicatorDot");
    const lastUpdatedText = document.getElementById("lastUpdatedText");

    if (spinner) spinner.style.animation = "spin 0.8s linear infinite";
    if (syncDot) syncDot.style.background = "#f59e0b";
    if (lastUpdatedText) lastUpdatedText.textContent = "Syncing telemetry...";

    // Fetch operational state, appointments, specialists, inventory, diagnostics, and referrals in parallel
    const [
        opStateRes,
        facilityRes,
        apptsRes,
        specsRes,
        deptsRes,
        inventoryRes,
        diagsRes,
        diagQueueRes,
        referralsRes,
    ] = await Promise.allSettled([
        getFacilityOperationalState(facilityId),
        getFacilityById(facilityId),
        fetchAppointments({ facility_id: facilityId }),
        fetchSpecialists({ facility_id: facilityId }),
        fetchFacilityDepartments(facilityId),
        getFacilityInventory(facilityId),
        fetchDiagnostics({ facility_id: facilityId }),
        getFacilityDiagnosticQueues(facilityId),
        fetchReferrals(),
    ]);

    if (spinner) spinner.style.animation = "none";

    const isOfflineOrLimited = (window.Connectivity && !window.Connectivity.isOnline()) || (opStateRes.status === "fulfilled" && opStateRes.value.fromCache);

    // 1. Process Facility & Operational State
    if (opStateRes.status === "fulfilled" && opStateRes.value.success) {
        lastOperationalState = opStateRes.value.data;
        const isFromCache = !!opStateRes.value.fromCache || isOfflineOrLimited;
        renderTopKPIs(lastOperationalState, isFromCache, opStateRes.value.lastSyncedAt);
        renderDataSources(lastOperationalState, isFromCache);

        if (isFromCache) {
            if (syncDot) syncDot.style.background = "#eab308";
            if (lastUpdatedText) {
                const staleTime = window.OfflineDB ? window.OfflineDB.formatStaleTime(opStateRes.value.lastSyncedAt) : "recently";
                lastUpdatedText.innerHTML = `<span class="badge-cached">CACHED</span> Last known state • Synced ${staleTime}`;
            }
        } else {
            if (syncDot) syncDot.style.background = "#10b981";
            if (lastUpdatedText) {
                const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                lastUpdatedText.textContent = `Live • Synced at ${timeStr}`;
            }
        }
    } else {
        if (syncDot) syncDot.style.background = "#ef4444";
        if (lastUpdatedText) lastUpdatedText.textContent = "Telemetry unreachable (showing cached)";
        if (!lastOperationalState) renderNullKPIs();
    }

    // Update Facility Header Badges
    const currentFac = (facilityRes.status === "fulfilled" && facilityRes.value.success) 
        ? facilityRes.value.data 
        : cachedFacilities.find(f => f.id === facilityId);

    if (currentFac) {
        const activeBadge = document.getElementById("facilityActiveBadge");
        const typeBadge = document.getElementById("facilityTypeBadge");
        if (activeBadge) {
            activeBadge.className = currentFac.is_active ? "card-badge badge-success" : "card-badge badge-danger";
            activeBadge.textContent = currentFac.is_active ? "Active" : "Inactive";
        }
        if (typeBadge) {
            typeBadge.textContent = currentFac.facility_type.replace(/_/g, " ");
        }
    }

    // 2. Process Appointments & OPD Volume
    if (apptsRes.status === "fulfilled" && apptsRes.value.success) {
        lastAppointments = apptsRes.value.data || [];
    }
    renderOPDAppointments(lastAppointments);

    // 3. Process Specialists & Departments
    if (specsRes.status === "fulfilled" && specsRes.value.success) {
        lastSpecialists = specsRes.value.data || [];
    }
    renderDoctorRoster(lastSpecialists);

    // 4. Process Resources (Medicines & Diagnostics)
    if (inventoryRes.status === "fulfilled" && inventoryRes.value.success) {
        lastInventory = inventoryRes.value.data || [];
    }
    if (diagsRes.status === "fulfilled" && diagsRes.value.success) {
        lastDiagnostics = diagsRes.value.data || [];
    }
    const diagQueues = (diagQueueRes.status === "fulfilled" && diagQueueRes.value.success) ? diagQueueRes.value.data : [];
    renderResources(lastInventory, lastDiagnostics, diagQueues);

    // 5. Process Referrals
    if (referralsRes.status === "fulfilled" && referralsRes.value.success) {
        lastReferrals = referralsRes.value.data || [];
    }
    renderReferrals(lastReferrals, facilityId);

    // 6. Evaluate Operational Alerts
    renderAlerts(lastOperationalState, currentFac, lastAppointments, lastSpecialists, lastInventory, lastDiagnostics, lastReferrals, facilityId);
}

/**
 * Render Top 6 KPI Cards
 */
function renderTopKPIs(opState) {
    const crowdEl = document.getElementById("kpiCrowdCount");
    const crowdLevelEl = document.getElementById("kpiCrowdLevel");
    const queueEl = document.getElementById("kpiQueueLength");
    const queuePressureEl = document.getElementById("kpiQueuePressure");
    const servingEl = document.getElementById("kpiServingCount");
    const servingCountersEl = document.getElementById("kpiServingCounters");
    const waitEl = document.getElementById("kpiPredictedWait");
    const capacityEl = document.getElementById("kpiServiceCapacity");
    const capacityRatioEl = document.getElementById("kpiCapacityRatio");
    const emergencyEl = document.getElementById("kpiEmergencyLoad");

    // 1. Crowd
    if (crowdEl) {
        if (opState.people_present !== null && opState.people_present !== undefined) {
            crowdEl.className = "kpi-num";
            crowdEl.textContent = `${opState.people_present} people`;
        } else {
            crowdEl.className = "kpi-num null-state";
            crowdEl.textContent = "Unavailable";
        }
    }
    if (crowdLevelEl) {
        crowdLevelEl.textContent = opState.crowd_level ? `Crowd Level: ${opState.crowd_level}` : "Camera Telemetry Active";
    }

    // 2. Queue Length
    if (queueEl) {
        if (opState.queue_length !== null && opState.queue_length !== undefined) {
            queueEl.className = "kpi-num";
            queueEl.textContent = `${opState.queue_length}`;
        } else {
            queueEl.className = "kpi-num null-state";
            queueEl.textContent = "Unavailable";
        }
    }
    if (queuePressureEl) {
        const q = opState.queue_length || 0;
        let pressure = "Manageable";
        if (q > 25) pressure = "Critical Queue Pressure";
        else if (q > 12) pressure = "High Queue Pressure";
        else if (q > 5) pressure = "Moderate Queue Pressure";
        queuePressureEl.textContent = pressure;
    }

    // 3. Current Serving
    if (servingEl) {
        if (opState.current_serving !== null && opState.current_serving !== undefined) {
            servingEl.className = "kpi-num";
            servingEl.textContent = `${opState.current_serving}`;
        } else {
            servingEl.className = "kpi-num null-state";
            servingEl.textContent = "Unavailable";
        }
    }
    if (servingCountersEl) {
        servingCountersEl.textContent = opState.current_serving > 0 ? "In active consultation" : "Counters Idle";
    }

    // 4. Predicted Wait
    if (waitEl) {
        const wait = opState.predicted_wait !== null && opState.predicted_wait !== undefined ? opState.predicted_wait : opState.estimated_wait;
        if (wait !== null && wait !== undefined) {
            waitEl.className = "kpi-num";
            waitEl.textContent = `${Math.round(wait)} min`;
        } else {
            waitEl.className = "kpi-num null-state";
            waitEl.textContent = "Prediction unavailable";
        }
    }

    // 5. Service Capacity
    if (capacityEl) {
        if (opState.service_capacity !== null && opState.service_capacity !== undefined) {
            capacityEl.className = "kpi-num";
            capacityEl.textContent = `${opState.service_capacity}`;
        } else {
            capacityEl.className = "kpi-num null-state";
            capacityEl.textContent = "Unavailable";
        }
    }
    if (capacityRatioEl) {
        const cap = opState.service_capacity || 0;
        const q = opState.queue_length || 0;
        const ratio = cap > 0 ? Math.round((q / cap) * 100) : 0;
        capacityRatioEl.textContent = `${ratio}% capacity utilized`;
    }

    // 6. Emergency Load
    if (emergencyEl) {
        emergencyEl.textContent = `${opState.emergency_load || 0}`;
        emergencyEl.style.color = (opState.emergency_load || 0) > 0 ? "#dc2626" : "#0f172a";
    }
}

function renderNullKPIs() {
    const ids = ["kpiCrowdCount", "kpiQueueLength", "kpiServingCount", "kpiPredictedWait", "kpiServiceCapacity", "kpiEmergencyLoad"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = "kpi-num null-state";
            el.textContent = "Unavailable";
        }
    });
}

/**
 * Render Attention Required / Alerts
 */
function renderAlerts(opState, facility, appts, specialists, inventory, diagnostics, referrals, facilityId) {
    const container = document.getElementById("alertsListContainer");
    const countBadge = document.getElementById("alertCountBadge");
    if (!container) return;

    const alerts = [];

    // 1. Inactive facility alert
    if (facility && !facility.is_active) {
        alerts.push({
            severity: "critical",
            icon: "🛑",
            title: "Facility Inactive",
            desc: "This healthcare facility is currently marked inactive in the registry.",
        });
    }

    // 2. Critical/High crowd alert
    if (opState && (opState.crowd_level === "CRITICAL" || (opState.people_present && opState.people_present >= 50))) {
        alerts.push({
            severity: "critical",
            icon: "🔴",
            title: "Critical Crowd Alert",
            desc: `${opState.people_present || 'Extreme'} people currently detected on-site. Recommend routing diversion.`,
        });
    } else if (opState && (opState.crowd_level === "HIGH" || (opState.people_present && opState.people_present >= 30))) {
        alerts.push({
            severity: "warning",
            icon: "🟠",
            title: "High Crowd Volume",
            desc: `${opState.people_present} people present. Monitor waiting area capacity.`,
        });
    }

    // 3. Emergency Load Alert
    if (opState && opState.emergency_load > 0) {
        alerts.push({
            severity: "critical",
            icon: "🚨",
            title: "Active Emergency Triage",
            desc: `${opState.emergency_load} time-critical emergency token(s) currently queued for immediate care.`,
        });
    }

    // 4. Incoming Emergency / Urgent Referrals
    const incomingEmergencies = referrals.filter(r => 
        r.destination_facility_id === facilityId && 
        ["EMERGENCY", "URGENT"].includes(r.priority) && 
        ["CREATED", "ACCEPTED", "IN_PROGRESS"].includes(r.status)
    );
    if (incomingEmergencies.length > 0) {
        alerts.push({
            severity: "critical",
            icon: "🚑",
            title: "Incoming Emergency Transfer",
            desc: `${incomingEmergencies.length} high-priority patient transfer(s) en-route to this facility.`,
        });
    }

    // 5. Specialist Doctor Shortage / On-Leave
    const availableDocs = specialists.filter(s => s.availability_status === "AVAILABLE");
    const onLeaveDocs = specialists.filter(s => s.availability_status === "ON_LEAVE");
    if (specialists.length > 0 && availableDocs.length === 0) {
        alerts.push({
            severity: "warning",
            icon: "⚠️",
            title: "No Available Doctors",
            desc: `All ${specialists.length} registered specialists are currently busy, on-leave, or off-duty.`,
        });
    } else if (onLeaveDocs.length > 0) {
        alerts.push({
            severity: "info",
            icon: "👨‍⚕️",
            title: "Doctor On Leave",
            desc: `${onLeaveDocs.map(d => 'Dr. ' + d.name).join(', ')} marked on-leave today.`,
        });
    }

    // 6. Medicine Stock-Outs
    const outOfStock = inventory.filter(i => (i.current_stock || 0) <= 0);
    if (outOfStock.length > 0) {
        alerts.push({
            severity: "warning",
            icon: "💊",
            title: "Pharmacy Stock-Out",
            desc: `${outOfStock.length} vital medicine item(s) are completely out of stock at this facility.`,
        });
    }

    // 7. Diagnostic Downtime
    const unavailDiags = diagnostics.filter(d => !d.is_available);
    if (unavailDiags.length > 0 && diagnostics.length > 0) {
        alerts.push({
            severity: "info",
            icon: "🔬",
            title: "Diagnostic Equipment Notice",
            desc: `${unavailDiags.length} diagnostic test(s) temporarily unavailable (${unavailDiags.map(d => d.name).slice(0, 2).join(', ')}).`,
        });
    }

    // Update count badge
    if (countBadge) {
        countBadge.textContent = `${alerts.length} Alert${alerts.length === 1 ? '' : 's'}`;
        countBadge.className = alerts.some(a => a.severity === "critical") 
            ? "card-badge badge-emergency" 
            : (alerts.length > 0 ? "card-badge badge-warning" : "card-badge badge-success");
    }

    // Render alerts
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-card info">
                <span class="alert-icon">✅</span>
                <div class="alert-content">
                    <div class="alert-title">Facility Operating Normally</div>
                    <div class="alert-desc">No active bottlenecks, staffing shortages, or resource stock-outs detected.</div>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = alerts.map(a => `
            <div class="alert-card ${a.severity}">
                <span class="alert-icon">${a.icon}</span>
                <div class="alert-content">
                    <div class="alert-title">${escapeHtml(a.title)}</div>
                    <div class="alert-desc">${escapeHtml(a.desc)}</div>
                </div>
            </div>
        `).join("");
    }
}

/**
 * Render OPD Queue & Appointments
 */
function renderOPDAppointments(appts) {
    const totalEl = document.getElementById("opdTotalCount");
    const schedEl = document.getElementById("opdScheduledCount");
    const checkEl = document.getElementById("opdCheckedInCount");
    const inConsEl = document.getElementById("opdInConsultCount");
    const compEl = document.getElementById("opdCompletedCount");
    const cancEl = document.getElementById("opdCancelledCount");
    const tbody = document.getElementById("activeAppointmentsTableBody");

    const total = appts.length;
    const scheduled = appts.filter(a => a.status === "SCHEDULED").length;
    const checkedIn = appts.filter(a => a.status === "CHECKED_IN").length;
    const inConsult = appts.filter(a => a.status === "IN_CONSULTATION").length;
    const completed = appts.filter(a => a.status === "COMPLETED").length;
    const cancelled = appts.filter(a => ["CANCELLED", "NO_SHOW"].includes(a.status)).length;

    if (totalEl) totalEl.textContent = total;
    if (schedEl) schedEl.textContent = scheduled;
    if (checkEl) checkEl.textContent = checkedIn;
    if (inConsEl) inConsEl.textContent = inConsult;
    if (compEl) compEl.textContent = completed;
    if (cancEl) cancEl.textContent = cancelled;

    if (!tbody) return;

    // Active queue: scheduled, checked-in, in-consultation (sorted by token number)
    const activeList = appts.filter(a => ["IN_CONSULTATION", "CHECKED_IN", "SCHEDULED"].includes(a.status))
        .sort((a, b) => (a.token_number || 0) - (b.token_number || 0));

    if (activeList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:1.5rem; color:#64748b;">No active appointments in queue today.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = activeList.slice(0, 6).map(a => {
        let badgeClass = "badge-neutral";
        if (a.status === "IN_CONSULTATION") badgeClass = "badge-emergency";
        if (a.status === "CHECKED_IN") badgeClass = "badge-urgent";
        if (a.status === "SCHEDULED") badgeClass = "badge-success";

        const slotTime = a.slot_start_time ? `${a.slot_start_time} - ${a.slot_end_time || ''}` : "Walk-in";
        const docName = a.specialist_name ? `Dr. ${a.specialist_name}` : "General OPD";

        return `
            <tr>
                <td>
                    <span style="font-weight:800; color:#7c3aed; font-size:1rem;">#${a.token_number || '—'}</span>
                </td>
                <td>
                    <span style="font-weight:600; color:#0f172a;">${escapeHtml(a.patient_name)}</span>
                </td>
                <td>
                    <div><span class="department-badge">${escapeHtml(a.department || 'OPD')}</span></div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${escapeHtml(docName)}</div>
                </td>
                <td>
                    <span style="font-size:0.8rem; color:#475569;">⏰ ${slotTime}</span>
                </td>
                <td>
                    <span class="card-badge ${badgeClass}">${a.status.replace(/_/g, ' ')}</span>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Render Clinical Departments & Doctor Roster
 */
function renderDoctorRoster(specialists) {
    const container = document.getElementById("doctorRosterContainer");
    const availCountEl = document.getElementById("docAvailCount");
    const busyCountEl = document.getElementById("docBusyCount");
    const leaveCountEl = document.getElementById("docLeaveCount");
    const unavailCountEl = document.getElementById("docUnavailCount");

    const available = specialists.filter(s => s.availability_status === "AVAILABLE").length;
    const busy = specialists.filter(s => s.availability_status === "BUSY").length;
    const onLeave = specialists.filter(s => s.availability_status === "ON_LEAVE").length;
    const unavail = specialists.filter(s => s.availability_status === "UNAVAILABLE").length;

    if (availCountEl) availCountEl.textContent = available;
    if (busyCountEl) busyCountEl.textContent = busy;
    if (leaveCountEl) leaveCountEl.textContent = onLeave;
    if (unavailCountEl) unavailCountEl.textContent = unavail;

    if (!container) return;

    if (specialists.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:#64748b;">
                No specialists registered at this facility.
            </div>
        `;
        return;
    }

    container.innerHTML = specialists.map(doc => {
        let badgeClass = "available";
        let statusText = "Available";
        if (doc.availability_status === "BUSY") { badgeClass = "busy"; statusText = "In Consult"; }
        if (doc.availability_status === "ON_LEAVE") { badgeClass = "on_leave"; statusText = "On Leave"; }
        if (doc.availability_status === "UNAVAILABLE") { badgeClass = "unavailable"; statusText = "Off Duty"; }

        const hours = (doc.opd_start_time && doc.opd_end_time) 
            ? `${doc.opd_start_time} - ${doc.opd_end_time}`
            : (doc.schedule_info || "09:00 - 17:00");

        return `
            <div class="doctor-roster-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-weight:700; color:#0f172a; font-size:0.92rem;">Dr. ${escapeHtml(doc.name)}</div>
                        <div style="font-size:0.78rem; color:#7c3aed; font-weight:600;">${escapeHtml(doc.specialization)}</div>
                    </div>
                    <span class="availability-badge ${badgeClass}">${statusText}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.75rem; color:#64748b;">
                    <span class="department-badge">${escapeHtml(doc.department || doc.specialization)}</span>
                    <span>⏰ ${hours}</span>
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Render Pharmacy & Diagnostics Resource Overview
 */
function renderResources(inventory, diagnostics, diagQueues) {
    // Pharmacy
    const inStockEl = document.getElementById("medInStockCount");
    const lowStockEl = document.getElementById("medLowStockCount");
    const outStockEl = document.getElementById("medOutOfStockCount");

    const inStock = inventory.filter(i => (i.current_stock || 0) > (i.reorder_threshold || 10)).length;
    const lowStock = inventory.filter(i => (i.current_stock || 0) > 0 && (i.current_stock || 0) <= (i.reorder_threshold || 10)).length;
    const outStock = inventory.filter(i => (i.current_stock || 0) <= 0).length;

    if (inStockEl) inStockEl.textContent = inStock;
    if (lowStockEl) lowStockEl.textContent = lowStock;
    if (outStockEl) outStockEl.textContent = outStock;

    // Diagnostics
    const totalDiagEl = document.getElementById("diagTotalCount");
    const availDiagEl = document.getElementById("diagAvailableCount");
    const activeDiagBookingsEl = document.getElementById("diagActiveBookingsCount");

    const totalDiags = diagnostics.length;
    const availDiags = diagnostics.filter(d => d.is_available).length;
    const activeDiagBookings = Array.isArray(diagQueues) 
        ? diagQueues.reduce((acc, q) => acc + (q.active_bookings_count || 0), 0)
        : 0;

    if (totalDiagEl) totalDiagEl.textContent = totalDiags;
    if (availDiagEl) availDiagEl.textContent = availDiags;
    if (activeDiagBookingsEl) activeDiagBookingsEl.textContent = activeDiagBookings;
}

/**
 * Render Referral Network Tracking
 */
function renderReferrals(referrals, facilityId) {
    const incomingEl = document.getElementById("refIncomingCount");
    const outgoingEl = document.getElementById("refOutgoingCount");
    const listContainer = document.getElementById("recentReferralsList");

    const incoming = referrals.filter(r => r.destination_facility_id === facilityId);
    const outgoing = referrals.filter(r => r.source_facility_id === facilityId);

    if (incomingEl) incomingEl.textContent = incoming.length;
    if (outgoingEl) outgoingEl.textContent = outgoing.length;

    if (!listContainer) return;

    // Relevant transfers for this facility (incoming or outgoing)
    const facilityReferrals = referrals.filter(r => r.source_facility_id === facilityId || r.destination_facility_id === facilityId);

    if (facilityReferrals.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:1rem; color:#64748b; font-size:0.85rem;">
                No inter-facility transfers recorded for this facility.
            </div>
        `;
        return;
    }

    listContainer.innerHTML = facilityReferrals.slice(0, 3).map(r => {
        const isIncoming = r.destination_facility_id === facilityId;
        const priorityBadge = r.priority === "EMERGENCY" 
            ? "badge-emergency" 
            : (r.priority === "URGENT" ? "badge-urgent" : "badge-neutral");

        return `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem 0.85rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:600; color:#0f172a; font-size:0.85rem;">
                        ${isIncoming ? '📥 From: ' + escapeHtml(r.source_facility_name || r.source_facility_id) : '📤 To: ' + escapeHtml(r.destination_facility_name || r.destination_facility_id)}
                    </div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                        Patient: <strong>${escapeHtml(r.patient_name || 'Patient')}</strong> • Req: ${escapeHtml(r.required_specialization || 'Clinical Care')}
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="card-badge ${priorityBadge}">${r.priority}</span>
                    <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">${r.status}</div>
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Render Data Sources Transparency Tags
 */
function renderDataSources(opState) {
    const container = document.getElementById("dataSourcesContainer");
    if (!container) return;

    if (opState && opState.data_sources && Object.keys(opState.data_sources).length > 0) {
        container.innerHTML = Object.entries(opState.data_sources).map(([key, val]) => `
            <span class="data-source-pill">
                <span class="dot"></span>
                <strong>${escapeHtml(key.replace(/_/g, ' '))}:</strong> ${escapeHtml(val)}
            </span>
        `).join("");
    } else {
        container.innerHTML = `
            <span class="data-source-pill"><span class="dot"></span> Camera Telemetry</span>
            <span class="data-source-pill"><span class="dot"></span> Appointment Queue DB</span>
            <span class="data-source-pill"><span class="dot"></span> Person 3 ML Model</span>
            <span class="data-source-pill"><span class="dot"></span> Medicine Inventory DB</span>
            <span class="data-source-pill"><span class="dot"></span> Diagnostic Lab DB</span>
            <span class="data-source-pill"><span class="dot"></span> Referral Tracking Bus</span>
        `;
    }
}

/**
 * Start 30s Auto-Refresh Timer
 */
function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
        if (activeFacilityId) {
            refreshDashboardData(activeFacilityId);
        }
    }, 30000); // 30 seconds
}

/**
 * HTML Sanitizer
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

/**
 * QR Modal Generator (Preserved)
 */
function showQRModal(tokenData, isEmergency = false) {
    const qrDisplay = document.getElementById("qrModalDisplay");
    const tokenRef = document.getElementById("qrModalTokenRef");
    const statusEl = document.getElementById("qrModalStatus");
    const qrModal = document.getElementById("qrModal");

    const tokenId = tokenData.token_id || tokenData.token_number || "A-001";
    const tokenNum = tokenData.token_number || "A-001";
    const pos = tokenData.queue_position || 1;
    const ahead = Math.max(0, pos - 1);

    if (qrDisplay) {
        qrDisplay.innerHTML = generateQRCodeSVG(tokenId, 200);
    }
    if (tokenRef) {
        tokenRef.innerHTML = `Token #${tokenNum} ${isEmergency ? '<span style="color:#ef4444; font-size:0.85rem;">(Emergency)</span>' : ''}`;
    }
    if (statusEl) {
        statusEl.innerHTML = `Queue Position: <strong>#${pos}</strong> (${ahead} people ahead)<br/>Status: <strong>${tokenData.token_status || 'WAITING'}</strong>`;
    }
    if (qrModal) qrModal.style.display = "flex";
}
