/**
 * Referral Tracking Frontend Controller
 * Integrates with FastAPI Backend (/referrals, /facilities)
 */

document.addEventListener("DOMContentLoaded", () => {
    initReferralsPage();
});

// State Store
const referralsState = {
    referrals: [],
    facilities: [],
    facilityMap: {},
    activeFilters: {
        status: "",
        priority: "",
        source_facility_id: "",
        destination_facility_id: "",
        patient_id: "",
    },
    selectedReferral: null,
    isLoading: false,
};

/**
 * Initialize page components and fetch data
 */
async function initReferralsPage() {
    setupEventListeners();
    await loadFacilities();
    await loadReferrals();
}

/**
 * Setup event listeners for forms, filters, and modal controls
 */
function setupEventListeners() {
    // Filter controls
    const statusFilter = document.getElementById("filter-status");
    const priorityFilter = document.getElementById("filter-priority");
    const sourceFilter = document.getElementById("filter-source-facility");
    const destFilter = document.getElementById("filter-dest-facility");
    const patientSearch = document.getElementById("filter-patient-search");
    const resetFiltersBtn = document.getElementById("btn-reset-filters");
    const refreshBtn = document.getElementById("btn-refresh-referrals");

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            referralsState.activeFilters.status = e.target.value;
            loadReferrals();
        });
    }

    if (priorityFilter) {
        priorityFilter.addEventListener("change", (e) => {
            referralsState.activeFilters.priority = e.target.value;
            loadReferrals();
        });
    }

    if (sourceFilter) {
        sourceFilter.addEventListener("change", (e) => {
            referralsState.activeFilters.source_facility_id = e.target.value;
            loadReferrals();
        });
    }

    if (destFilter) {
        destFilter.addEventListener("change", (e) => {
            referralsState.activeFilters.destination_facility_id = e.target.value;
            loadReferrals();
        });
    }

    let debounceTimeout = null;
    if (patientSearch) {
        patientSearch.addEventListener("input", (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                referralsState.activeFilters.patient_id = e.target.value.trim();
                loadReferrals();
            }, 300);
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
            referralsState.activeFilters = {
                status: "",
                priority: "",
                source_facility_id: "",
                destination_facility_id: "",
                patient_id: "",
            };
            if (statusFilter) statusFilter.value = "";
            if (priorityFilter) priorityFilter.value = "";
            if (sourceFilter) sourceFilter.value = "";
            if (destFilter) destFilter.value = "";
            if (patientSearch) patientSearch.value = "";
            loadReferrals();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadReferrals();
        });
    }

    // Create Referral Modal Controls
    const btnOpenCreate = document.getElementById("btn-open-create-modal");
    const btnCloseCreate = document.getElementById("btn-close-create-modal");
    const createModal = document.getElementById("modal-create-referral");
    const createForm = document.getElementById("form-create-referral");

    if (btnOpenCreate && createModal) {
        btnOpenCreate.addEventListener("click", () => {
            resetCreateForm();
            createModal.classList.add("active");
            document.body.style.overflow = "hidden";
        });
    }

    if (btnCloseCreate && createModal) {
        btnCloseCreate.addEventListener("click", () => {
            createModal.classList.remove("active");
            document.body.style.overflow = "auto";
        });
    }

    if (createForm) {
        createForm.addEventListener("submit", handleCreateReferralSubmit);
    }

    // Detail Modal Controls
    const btnCloseDetail = document.getElementById("btn-close-detail-modal");
    const detailModal = document.getElementById("modal-referral-detail");
    if (btnCloseDetail && detailModal) {
        btnCloseDetail.addEventListener("click", () => {
            detailModal.classList.remove("active");
            document.body.style.overflow = "auto";
        });
    }

    // Close modals on clicking backdrop
    window.addEventListener("click", (e) => {
        if (createModal && e.target === createModal) {
            createModal.classList.remove("active");
            document.body.style.overflow = "auto";
        }
        if (detailModal && e.target === detailModal) {
            detailModal.classList.remove("active");
            document.body.style.overflow = "auto";
        }
    });
}

/**
 * Load list of facilities to populate select dropdowns
 */
async function loadFacilities() {
    try {
        const res = await fetchFacilities(true);
        if (res.success && Array.isArray(res.data)) {
            referralsState.facilities = res.data;
            referralsState.facilityMap = {};
            res.data.forEach((f) => {
                referralsState.facilityMap[f.id] = f;
            });
            populateFacilityDropdowns();
        } else {
            console.warn("Could not load facilities list:", res.message);
        }
    } catch (err) {
        console.error("Error loading facilities:", err);
    }
}

/**
 * Populate Source and Destination select options
 */
function populateFacilityDropdowns() {
    const sourceFilter = document.getElementById("filter-source-facility");
    const destFilter = document.getElementById("filter-dest-facility");
    const createSource = document.getElementById("create-source-facility");
    const createDest = document.getElementById("create-dest-facility");

    const buildOptions = (includeAllOption = true) => {
        let opts = includeAllOption ? '<option value="">All Facilities</option>' : '<option value="" disabled selected>Select Facility...</option>';
        referralsState.facilities.forEach((f) => {
            opts += `<option value="${f.id}">${escapeHtml(f.name)} (${f.facility_type.replace('_', ' ')})</option>`;
        });
        return opts;
    };

    if (sourceFilter) sourceFilter.innerHTML = buildOptions(true);
    if (destFilter) destFilter.innerHTML = buildOptions(true);
    if (createSource) createSource.innerHTML = buildOptions(false);
    if (createDest) createDest.innerHTML = buildOptions(false);
}

/**
 * Load referrals from backend with current filter query parameters
 */
async function loadReferrals() {
    const tableBody = document.getElementById("referrals-table-body");
    const emptyState = document.getElementById("referrals-empty-state");
    const loadingState = document.getElementById("referrals-loading-state");
    const errorState = document.getElementById("referrals-error-state");
    const errorMessage = document.getElementById("referrals-error-message");

    if (loadingState) loadingState.style.display = "flex";
    if (emptyState) emptyState.style.display = "none";
    if (errorState) errorState.style.display = "none";
    if (tableBody) tableBody.innerHTML = "";

    referralsState.isLoading = true;

    try {
        const res = await fetchReferrals(referralsState.activeFilters);
        referralsState.isLoading = false;
        if (loadingState) loadingState.style.display = "none";

        if (res.success && Array.isArray(res.data)) {
            referralsState.referrals = res.data;
            updateKPICards(res.data);
            if (res.fromCache) {
                showOfflineStaleBanner('referrals-table-body', res.lastSyncedAt);
            } else {
                hideOfflineStaleBanner();
            }

            if (res.data.length === 0) {
                if (emptyState) emptyState.style.display = "flex";
            } else {
                renderReferralsTable(res.data);
            }
        } else {
            if (errorState) {
                errorState.style.display = "flex";
                if (errorMessage) errorMessage.textContent = res.message || "Failed to load referrals.";
            }
        }
    } catch (err) {
        referralsState.isLoading = false;
        if (loadingState) loadingState.style.display = "none";
        if (errorState) {
            errorState.style.display = "flex";
            if (errorMessage) errorMessage.textContent = "Unable to connect to backend server.";
        }
    }
}

/**
 * Update top KPI metric counters
 */
function updateKPICards(referrals) {
    const totalEl = document.getElementById("kpi-total-referrals");
    const activeEl = document.getElementById("kpi-active-referrals");
    const pendingEl = document.getElementById("kpi-pending-referrals");
    const completedEl = document.getElementById("kpi-completed-referrals");
    const urgentEl = document.getElementById("kpi-urgent-referrals");

    const total = referrals.length;
    const inProgress = referrals.filter((r) => r.status === "IN_PROGRESS").length;
    const pending = referrals.filter((r) => r.status === "CREATED" || r.status === "ACCEPTED").length;
    const completed = referrals.filter((r) => r.status === "COMPLETED").length;
    const urgent = referrals.filter((r) => r.priority === "URGENT" || r.priority === "EMERGENCY").length;

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = inProgress;
    if (pendingEl) pendingEl.textContent = pending;
    if (completedEl) completedEl.textContent = completed;
    if (urgentEl) urgentEl.textContent = urgent;
}

/**
 * Render referrals rows in table
 */
function renderReferralsTable(referrals) {
    const tbody = document.getElementById("referrals-table-body");
    if (!tbody) return;

    tbody.innerHTML = referrals
        .map((ref) => {
            const priorityBadge = getPriorityBadgeHtml(ref.priority);
            const statusBadge = getStatusBadgeHtml(ref.status);
            const createdFormatted = formatDate(ref.created_at);
            const sourceName = ref.source_facility_name || referralsState.facilityMap[ref.source_facility_id]?.name || ref.source_facility_id;
            const destName = ref.destination_facility_name || referralsState.facilityMap[ref.destination_facility_id]?.name || ref.destination_facility_id;

            // Requirements summary badges
            const reqs = [];
            if (ref.required_specialization) reqs.push(`<span class="req-tag">👨‍⚕️ ${escapeHtml(ref.required_specialization)}</span>`);
            if (ref.required_diagnostic) reqs.push(`<span class="req-tag">🔬 ${escapeHtml(ref.required_diagnostic)}</span>`);
            if (ref.required_medicine) reqs.push(`<span class="req-tag">💊 ${escapeHtml(ref.required_medicine)}</span>`);
            const reqsHtml = reqs.length > 0 ? reqs.join(" ") : '<span class="text-muted" style="font-size:0.85rem;">None</span>';

            return `
            <tr class="referral-row" data-id="${ref.id}">
                <td>
                    <div class="patient-cell">
                        <div class="patient-avatar">${escapeHtml(ref.patient_name.charAt(0).toUpperCase())}</div>
                        <div>
                            <div class="patient-name">${escapeHtml(ref.patient_name)}</div>
                            <div class="patient-id">${ref.patient_id ? 'ID: ' + escapeHtml(ref.patient_id) : 'Ref: ' + ref.id.substring(0, 8)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="facility-transfer-cell">
                        <div class="facility-pill source">
                            <span class="facility-dot"></span>
                            <span class="facility-text" title="${escapeHtml(sourceName)}">${escapeHtml(sourceName)}</span>
                        </div>
                        <div class="transfer-arrow">→</div>
                        <div class="facility-pill dest">
                            <span class="facility-dot"></span>
                            <span class="facility-text" title="${escapeHtml(destName)}">${escapeHtml(destName)}</span>
                        </div>
                    </div>
                </td>
                <td>${priorityBadge}</td>
                <td>
                    <div class="requirements-wrapper">${reqsHtml}</div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <span class="date-text">${createdFormatted}</span>
                </td>
                <td style="text-align: right;">
                    <button class="btn-action-view" onclick="openReferralDetailModal('${ref.id}')">
                        <span>View Details</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
        })
        .join("");
}

/**
 * Open Referral Detail & Status Management Modal
 */
async function openReferralDetailModal(referralId) {
    const modal = document.getElementById("modal-referral-detail");
    const content = document.getElementById("referral-detail-content");
    if (!modal || !content) return;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    content.innerHTML = `
        <div class="detail-loading">
            <div class="spinner"></div>
            <p>Loading referral details...</p>
        </div>
    `;

    try {
        const res = await getReferralById(referralId);
        if (res.success && res.data) {
            referralsState.selectedReferral = res.data;
            renderReferralDetailView(res.data);
        } else {
            content.innerHTML = `
                <div class="detail-error">
                    <p>Failed to load referral details: ${escapeHtml(res.message || 'Unknown error')}</p>
                    <button class="btn btn-primary" onclick="openReferralDetailModal('${referralId}')">Retry</button>
                </div>
            `;
        }
    } catch (err) {
        content.innerHTML = `
            <div class="detail-error">
                <p>Failed to load referral details.</p>
            </div>
        `;
    }
}

/**
 * Render referral full detail view, timeline, and valid action transitions
 */
function renderReferralDetailView(ref) {
    const content = document.getElementById("referral-detail-content");
    if (!content) return;

    const sourceName = ref.source_facility_name || referralsState.facilityMap[ref.source_facility_id]?.name || ref.source_facility_id;
    const destName = ref.destination_facility_name || referralsState.facilityMap[ref.destination_facility_id]?.name || ref.destination_facility_id;

    const priorityBadge = getPriorityBadgeHtml(ref.priority);
    const statusBadge = getStatusBadgeHtml(ref.status);

    // Lifecycle Timeline Construction
    const timelineHtml = renderLifecycleTimeline(ref);

    // Valid Next Actions calculation
    const actionsHtml = renderStatusActionsHtml(ref);

    content.innerHTML = `
        <div class="referral-detail-header">
            <div>
                <span class="detail-ref-id">REFERRAL #${escapeHtml(ref.id)}</span>
                <h2 class="detail-patient-title">${escapeHtml(ref.patient_name)}</h2>
                <div class="detail-badges-row">
                    ${priorityBadge}
                    ${statusBadge}
                </div>
            </div>
            <div class="detail-header-date">
                <div class="date-label">Created At</div>
                <div class="date-val">${formatFullDateTime(ref.created_at)}</div>
            </div>
        </div>

        <!-- Visual Lifecycle Progress -->
        <div class="detail-section">
            <h3 class="section-subtitle">Lifecycle Progress</h3>
            ${timelineHtml}
        </div>

        <!-- Transfer Information Grid -->
        <div class="detail-section">
            <h3 class="section-subtitle">Transfer Routing</h3>
            <div class="transfer-overview-box">
                <div class="transfer-box-node">
                    <div class="node-label">Source Healthcare Facility</div>
                    <div class="node-facility-name">${escapeHtml(sourceName)}</div>
                    <div class="node-facility-tier">${ref.source_facility_type ? ref.source_facility_type.replace('_', ' ') : 'Origin Facility'}</div>
                </div>
                <div class="transfer-box-arrow">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>
                <div class="transfer-box-node">
                    <div class="node-label">Destination Healthcare Facility</div>
                    <div class="node-facility-name">${escapeHtml(destName)}</div>
                    <div class="node-facility-tier">${ref.destination_facility_type ? ref.destination_facility_type.replace('_', ' ') : 'Destination Tier'}</div>
                </div>
            </div>
        </div>

        <!-- Clinical Reason & Requirements -->
        <div class="detail-section">
            <h3 class="section-subtitle">Clinical Context & Requirements</h3>
            <div class="detail-info-grid">
                <div class="info-item full-width">
                    <span class="info-label">Clinical Referral Reason</span>
                    <p class="info-value-box">${escapeHtml(ref.reason)}</p>
                </div>
                <div class="info-item">
                    <span class="info-label">Required Specialist</span>
                    <span class="info-value">${ref.required_specialization ? '👨‍⚕️ ' + escapeHtml(ref.required_specialization) : '<em>Not specified</em>'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Required Diagnostic</span>
                    <span class="info-value">${ref.required_diagnostic ? '🔬 ' + escapeHtml(ref.required_diagnostic) : '<em>Not specified</em>'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Required Medicine</span>
                    <span class="info-value">${ref.required_medicine ? '💊 ' + escapeHtml(ref.required_medicine) : '<em>Not specified</em>'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Patient Record ID</span>
                    <span class="info-value">${ref.patient_id ? escapeHtml(ref.patient_id) : '<em>Unregistered Patient</em>'}</span>
                </div>
                ${ref.notes ? `
                <div class="info-item full-width">
                    <span class="info-label">Audit / Clinical Notes</span>
                    <p class="info-value-box notes-box">${escapeHtml(ref.notes)}</p>
                </div>` : ''}
            </div>
        </div>

        <!-- Status Management Actions -->
        <div class="detail-section actions-section">
            <h3 class="section-subtitle">Authorized Status Actions</h3>
            ${actionsHtml}
        </div>
    `;
}

/**
 * Render visual lifecycle progress tracker with timestamps
 */
function renderLifecycleTimeline(ref) {
    const isFailed = ref.status === "FAILED";
    const isMissed = ref.status === "MISSED";

    if (isFailed || isMissed) {
        return `
            <div class="terminal-alert ${isFailed ? 'failed' : 'missed'}">
                <div class="terminal-alert-icon">⚠️</div>
                <div class="terminal-alert-content">
                    <h4>Referral ${ref.status}</h4>
                    <p>This referral entered a terminal failure state on <strong>${ref.failed_at ? formatFullDateTime(ref.failed_at) : formatFullDateTime(ref.updated_at)}</strong>.</p>
                    ${ref.notes ? `<p class="terminal-notes">Reason: ${escapeHtml(ref.notes)}</p>` : ''}
                </div>
            </div>
        `;
    }

    const steps = [
        { key: "CREATED", label: "Created", date: ref.created_at },
        { key: "ACCEPTED", label: "Accepted", date: ref.accepted_at },
        { key: "IN_PROGRESS", label: "In Progress", date: ref.started_at },
        { key: "COMPLETED", label: "Completed", date: ref.completed_at },
    ];

    const order = ["CREATED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];
    const currentIndex = order.indexOf(ref.status);

    let stepsHtml = "";
    steps.forEach((step, idx) => {
        let stateClass = "pending";
        if (idx < currentIndex) stateClass = "completed";
        else if (idx === currentIndex) stateClass = "active";

        stepsHtml += `
            <div class="timeline-step ${stateClass}">
                <div class="step-indicator">
                    ${stateClass === "completed" ? "✓" : idx + 1}
                </div>
                <div class="step-label">${step.label}</div>
                <div class="step-time">${step.date ? formatRelativeOrDate(step.date) : "--"}</div>
            </div>
        `;
        if (idx < steps.length - 1) {
            const lineClass = idx < currentIndex ? "completed" : "";
            stepsHtml += `<div class="timeline-connector ${lineClass}"></div>`;
        }
    });

    return `<div class="lifecycle-timeline">${stepsHtml}</div>`;
}

/**
 * Generate Context-Aware Status Action Buttons based on valid lifecycle transitions
 */
function renderStatusActionsHtml(ref) {
    const status = ref.status;

    if (status === "COMPLETED" || status === "FAILED" || status === "MISSED") {
        return `
            <div class="terminal-badge-box">
                <span class="badge badge-neutral">Terminal State (${status})</span>
                <p>No further lifecycle transitions are allowed for this completed or closed referral.</p>
            </div>
        `;
    }

    let primaryActions = "";
    let cancelActions = `
        <button class="btn btn-outline-danger" onclick="triggerStatusTransition('${ref.id}', 'FAILED')">
            Mark Failed
        </button>
        <button class="btn btn-outline-neutral" onclick="triggerStatusTransition('${ref.id}', 'MISSED')">
            Mark Missed
        </button>
    `;

    if (status === "CREATED") {
        primaryActions = `
            <button class="btn btn-primary" onclick="triggerStatusTransition('${ref.id}', 'ACCEPTED')">
                ✓ Accept Referral
            </button>
        `;
    } else if (status === "ACCEPTED") {
        primaryActions = `
            <button class="btn btn-primary" onclick="triggerStatusTransition('${ref.id}', 'IN_PROGRESS')">
                🚀 Start Transit / In-Progress
            </button>
        `;
    } else if (status === "IN_PROGRESS") {
        primaryActions = `
            <button class="btn btn-success" onclick="triggerStatusTransition('${ref.id}', 'COMPLETED')">
                🎉 Complete Referral
            </button>
        `;
    }

    return `
        <div class="status-action-bar">
            <div class="action-instructions">Advance referral status or record outcome:</div>
            <div class="action-buttons-group">
                ${primaryActions}
                ${cancelActions}
            </div>
        </div>
    `;
}

/**
 * Trigger status transition with prompt for optional audit notes
 */
async function triggerStatusTransition(referralId, targetStatus) {
    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline Mode: Referral status transitions require live backend connectivity.", "warning");
        return;
    }
    const confirmationMsg = `Advance referral status to '${targetStatus}'?`;
    if (!confirm(confirmationMsg)) return;

    let notes = "";
    if (targetStatus === "FAILED" || targetStatus === "MISSED") {
        notes = prompt(`Please enter the reason for marking this referral as ${targetStatus}:`) || "";
    }

    const payload = {
        status: targetStatus,
        notes: notes ? notes.trim() : undefined,
    };

    try {
        showToast("Updating referral status...", "info");
        const res = await updateReferralStatus(referralId, payload);
        if (res.success) {
            showToast(`Referral successfully marked as ${targetStatus}!`, "success");
            // Reload details and table
            await openReferralDetailModal(referralId);
            await loadReferrals();
        } else {
            showToast(`Update failed: ${res.message}`, "error");
        }
    } catch (err) {
        showToast("Error updating status. Ensure backend is running.", "error");
    }
}

/**
 * Handle Create Referral Form Submission
 */
async function handleCreateReferralSubmit(e) {
    e.preventDefault();

    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline Mode: Referral creation requires authoritative live hospital verification.", "warning");
        return;
    }

    const patientName = document.getElementById("create-patient-name")?.value.trim();
    const patientId = document.getElementById("create-patient-id")?.value.trim() || undefined;
    const sourceId = document.getElementById("create-source-facility")?.value;
    const destId = document.getElementById("create-dest-facility")?.value;
    const reason = document.getElementById("create-reason")?.value.trim();
    const priority = document.getElementById("create-priority")?.value || "ROUTINE";
    const specialist = document.getElementById("create-specialist")?.value.trim() || undefined;
    const diagnostic = document.getElementById("create-diagnostic")?.value.trim() || undefined;
    const medicine = document.getElementById("create-medicine")?.value.trim() || undefined;
    const notes = document.getElementById("create-notes")?.value.trim() || undefined;

    const errorBox = document.getElementById("create-form-error");
    const submitBtn = document.getElementById("btn-submit-referral");

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    // Validation
    if (!patientName) {
        showFormError("Patient name is required.");
        return;
    }
    if (!sourceId) {
        showFormError("Please select a Source Healthcare Facility.");
        return;
    }
    if (!destId) {
        showFormError("Please select a Destination Healthcare Facility.");
        return;
    }
    if (sourceId === destId) {
        showFormError("Source facility and Destination facility cannot be the same.");
        return;
    }
    if (!reason) {
        showFormError("Clinical reason for referral is required.");
        return;
    }

    const payload = {
        patient_name: patientName,
        patient_id: patientId,
        source_facility_id: sourceId,
        destination_facility_id: destId,
        reason: reason,
        priority: priority,
        required_specialization: specialist,
        required_diagnostic: diagnostic,
        required_medicine: medicine,
        notes: notes,
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Referral...";
    }

    try {
        const res = await createReferral(payload);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Referral";
        }

        if (res.success) {
            showToast("Referral created successfully!", "success");
            const modal = document.getElementById("modal-create-referral");
            if (modal) modal.classList.remove("active");
            document.body.style.overflow = "auto";
            resetCreateForm();
            await loadReferrals();
        } else {
            showFormError(res.message || "Failed to create referral.");
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Referral";
        }
        showFormError("Network error while connecting to backend.");
    }
}

function showFormError(msg) {
    const errorBox = document.getElementById("create-form-error");
    if (errorBox) {
        errorBox.style.display = "block";
        errorBox.textContent = msg;
    }
}

function resetCreateForm() {
    const form = document.getElementById("form-create-referral");
    if (form) form.reset();
    const errorBox = document.getElementById("create-form-error");
    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-message ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Helpers
function getPriorityBadgeHtml(priority) {
    if (priority === "EMERGENCY") {
        return `<span class="badge badge-emergency">🚨 EMERGENCY</span>`;
    }
    if (priority === "URGENT") {
        return `<span class="badge badge-urgent">⚡ URGENT</span>`;
    }
    return `<span class="badge badge-routine">ROUTINE</span>`;
}

function getStatusBadgeHtml(status) {
    switch (status) {
        case "CREATED":
            return `<span class="badge badge-created">CREATED</span>`;
        case "ACCEPTED":
            return `<span class="badge badge-accepted">ACCEPTED</span>`;
        case "IN_PROGRESS":
            return `<span class="badge badge-in-progress">IN PROGRESS</span>`;
        case "COMPLETED":
            return `<span class="badge badge-completed">✓ COMPLETED</span>`;
        case "FAILED":
            return `<span class="badge badge-failed">✕ FAILED</span>`;
        case "MISSED":
            return `<span class="badge badge-missed">MISSED</span>`;
        default:
            return `<span class="badge badge-neutral">${escapeHtml(status)}</span>`;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatFullDateTime(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatRelativeOrDate(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
