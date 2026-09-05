/**
 * Specialist Availability Frontend Controller
 * Integrates with FastAPI Backend (/specialists, /facilities)
 */

document.addEventListener("DOMContentLoaded", () => {
    initSpecialistsPage();
});

// State Store
const specialistsState = {
    specialists: [],
    facilities: [],
    facilityMap: {},
    activeFilters: {
        facility_id: "",
        specialization: "",
        availability_status: "",
        is_available_only: false,
        search: "",
    },
    viewMode: "grid", // 'grid' | 'by_facility' | 'table'
    selectedSpecialist: null,
    isLoading: false,
};

/**
 * Initialize page components and fetch data
 */
async function initSpecialistsPage() {
    setupEventListeners();
    await loadFacilities();
    await loadSpecialists();
}

/**
 * Setup event listeners for forms, filters, and modal controls
 */
function setupEventListeners() {
    const specializationFilter = document.getElementById("filter-specialization");
    const facilityFilter = document.getElementById("filter-facility");
    const statusFilter = document.getElementById("filter-status");
    const availableOnlyCheckbox = document.getElementById("filter-available-only");
    const searchInput = document.getElementById("filter-specialist-search");
    const resetFiltersBtn = document.getElementById("btn-reset-filters");
    const refreshBtn = document.getElementById("btn-refresh-specialists");

    // View Switchers
    const btnViewGrid = document.getElementById("btn-view-grid");
    const btnViewFacility = document.getElementById("btn-view-facility");
    const btnViewTable = document.getElementById("btn-view-table");

    if (btnViewGrid) {
        btnViewGrid.addEventListener("click", () => switchViewMode("grid"));
    }
    if (btnViewFacility) {
        btnViewFacility.addEventListener("click", () => switchViewMode("by_facility"));
    }
    if (btnViewTable) {
        btnViewTable.addEventListener("click", () => switchViewMode("table"));
    }

    if (specializationFilter) {
        specializationFilter.addEventListener("change", (e) => {
            specialistsState.activeFilters.specialization = e.target.value;
            loadSpecialists();
        });
    }

    if (facilityFilter) {
        facilityFilter.addEventListener("change", (e) => {
            specialistsState.activeFilters.facility_id = e.target.value;
            loadSpecialists();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            specialistsState.activeFilters.availability_status = e.target.value;
            loadSpecialists();
        });
    }

    if (availableOnlyCheckbox) {
        availableOnlyCheckbox.addEventListener("change", (e) => {
            specialistsState.activeFilters.is_available_only = e.target.checked;
            loadSpecialists();
        });
    }

    let debounceTimeout = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                specialistsState.activeFilters.search = e.target.value.trim().toLowerCase();
                renderCurrentView();
            }, 250);
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
            specialistsState.activeFilters = {
                facility_id: "",
                specialization: "",
                availability_status: "",
                is_available_only: false,
                search: "",
            };
            if (specializationFilter) specializationFilter.value = "";
            if (facilityFilter) facilityFilter.value = "";
            if (statusFilter) statusFilter.value = "";
            if (availableOnlyCheckbox) availableOnlyCheckbox.checked = false;
            if (searchInput) searchInput.value = "";
            loadSpecialists();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadSpecialists();
        });
    }

    // Modal controls for Register Specialist
    const btnOpenCreate = document.getElementById("btn-open-create-modal");
    const btnCloseCreate = document.getElementById("btn-close-create-modal");
    const createModal = document.getElementById("modal-create-specialist");
    const createForm = document.getElementById("form-create-specialist");

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
        createForm.addEventListener("submit", handleCreateSpecialistSubmit);
    }

    // Modal controls for Detail view
    const btnCloseDetail = document.getElementById("btn-close-detail-modal");
    const detailModal = document.getElementById("modal-specialist-detail");
    if (btnCloseDetail && detailModal) {
        btnCloseDetail.addEventListener("click", () => {
            detailModal.classList.remove("active");
            document.body.style.overflow = "auto";
        });
    }

    // Backdrop clicks
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
 * Switch View Mode between Grid, Facility Grouping, and Table
 */
function switchViewMode(mode) {
    specialistsState.viewMode = mode;

    document.querySelectorAll(".view-switch-btn").forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`btn-view-${mode === 'by_facility' ? 'facility' : mode}`);
    if (activeBtn) activeBtn.classList.add("active");

    renderCurrentView();
}

/**
 * Load list of facilities to populate select dropdowns
 */
async function loadFacilities() {
    try {
        const res = await fetchFacilities(true);
        if (res.success && Array.isArray(res.data)) {
            specialistsState.facilities = res.data;
            specialistsState.facilityMap = {};
            res.data.forEach((f) => {
                specialistsState.facilityMap[f.id] = f;
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
 * Populate Facility dropdowns in filter bar and create modal
 */
function populateFacilityDropdowns() {
    const facilityFilter = document.getElementById("filter-facility");
    const createFacilitySelect = document.getElementById("create-specialist-facility");

    const buildOptions = (includeAllOption = true) => {
        let opts = includeAllOption ? '<option value="">All Facilities</option>' : '<option value="" disabled selected>Select Healthcare Facility...</option>';
        specialistsState.facilities.forEach((f) => {
            opts += `<option value="${f.id}">${escapeHtml(f.name)} (${f.facility_type.replace('_', ' ')})</option>`;
        });
        return opts;
    };

    if (facilityFilter) facilityFilter.innerHTML = buildOptions(true);
    if (createFacilitySelect) createFacilitySelect.innerHTML = buildOptions(false);
}

/**
 * Load specialists from backend using query parameters
 */
async function loadSpecialists() {
    const loadingState = document.getElementById("specialists-loading-state");
    const emptyState = document.getElementById("specialists-empty-state");
    const errorState = document.getElementById("specialists-error-state");
    const errorMessage = document.getElementById("specialists-error-message");

    if (loadingState) loadingState.style.display = "flex";
    if (emptyState) emptyState.style.display = "none";
    if (errorState) errorState.style.display = "none";

    specialistsState.isLoading = true;

    try {
        const queryFilters = {
            facility_id: specialistsState.activeFilters.facility_id || undefined,
            specialization: specialistsState.activeFilters.specialization || undefined,
            availability_status: specialistsState.activeFilters.availability_status || undefined,
            is_available_only: specialistsState.activeFilters.is_available_only || undefined,
        };

        const res = await fetchSpecialists(queryFilters);
        specialistsState.isLoading = false;
        if (loadingState) loadingState.style.display = "none";

        if (res.success && Array.isArray(res.data)) {
            specialistsState.specialists = res.data;
            if (res.fromCache) {
                showOfflineStaleBanner('specialists-loading-state', res.lastSyncedAt);
            } else {
                hideOfflineStaleBanner();
            }
            updateKPICards(res.data);
            populateSpecializationDropdown(res.data);
            renderCurrentView();
        } else {
            if (errorState) {
                errorState.style.display = "flex";
                if (errorMessage) errorMessage.textContent = res.message || "Failed to load specialists.";
            }
        }
    } catch (err) {
        specialistsState.isLoading = false;
        if (loadingState) loadingState.style.display = "none";
        if (errorState) {
            errorState.style.display = "flex";
            if (errorMessage) errorMessage.textContent = "Unable to connect to backend server.";
        }
    }
}

/**
 * Dynamically extract and populate unique specializations
 */
function populateSpecializationDropdown(specialists) {
    const specSelect = document.getElementById("filter-specialization");
    if (!specSelect) return;

    const currentVal = specSelect.value;
    const allSpecs = new Set([
        "Cardiology",
        "Neurology",
        "Orthopedics",
        "Pediatrics",
        "General Medicine",
        "Obstetrics & Gynecology",
        "Dermatology",
        "Radiology",
        "Emergency Medicine",
        "Ophthalmology",
        "ENT",
        "Psychiatry",
    ]);

    specialists.forEach((s) => {
        if (s.specialization) allSpecs.add(s.specialization);
    });

    let html = '<option value="">All Specializations</option>';
    Array.from(allSpecs).sort().forEach((spec) => {
        html += `<option value="${escapeHtml(spec)}">${escapeHtml(spec)}</option>`;
    });
    specSelect.innerHTML = html;
    specSelect.value = currentVal;
}

/**
 * Update top KPI metrics
 */
function updateKPICards(specialists) {
    const totalEl = document.getElementById("kpi-total-specialists");
    const availEl = document.getElementById("kpi-available-specialists");
    const busyEl = document.getElementById("kpi-busy-specialists");
    const leaveEl = document.getElementById("kpi-leave-specialists");
    const coverageEl = document.getElementById("kpi-facility-coverage");

    const total = specialists.length;
    const available = specialists.filter((s) => s.availability_status === "AVAILABLE").length;
    const busy = specialists.filter((s) => s.availability_status === "BUSY").length;
    const onLeave = specialists.filter(
        (s) => s.availability_status === "ON_LEAVE" || s.availability_status === "UNAVAILABLE"
    ).length;

    const facilitiesWithSpecialists = new Set(specialists.map((s) => s.facility_id)).size;

    if (totalEl) totalEl.textContent = total;
    if (availEl) availEl.textContent = available;
    if (busyEl) busyEl.textContent = busy;
    if (leaveEl) leaveEl.textContent = onLeave;
    if (coverageEl) coverageEl.textContent = facilitiesWithSpecialists;
}

/**
 * Master render router based on viewMode and search keyword
 */
function renderCurrentView() {
    const gridContainer = document.getElementById("specialists-grid-container");
    const facilityContainer = document.getElementById("specialists-facility-container");
    const tableContainer = document.getElementById("specialists-table-container");
    const emptyState = document.getElementById("specialists-empty-state");

    // Client search filtering
    let items = specialistsState.specialists;
    if (specialistsState.activeFilters.search) {
        const q = specialistsState.activeFilters.search;
        items = items.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.specialization.toLowerCase().includes(q) ||
                (s.facility_name && s.facility_name.toLowerCase().includes(q)) ||
                (s.schedule_info && s.schedule_info.toLowerCase().includes(q))
        );
    }

    if (items.length === 0) {
        if (gridContainer) gridContainer.style.display = "none";
        if (facilityContainer) facilityContainer.style.display = "none";
        if (tableContainer) tableContainer.style.display = "none";
        if (emptyState) emptyState.style.display = "flex";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    if (specialistsState.viewMode === "grid") {
        if (gridContainer) {
            gridContainer.style.display = "grid";
            renderDirectoryGrid(items);
        }
        if (facilityContainer) facilityContainer.style.display = "none";
        if (tableContainer) tableContainer.style.display = "none";
    } else if (specialistsState.viewMode === "by_facility") {
        if (facilityContainer) {
            facilityContainer.style.display = "flex";
            renderFacilityOrientedView(items);
        }
        if (gridContainer) gridContainer.style.display = "none";
        if (tableContainer) tableContainer.style.display = "none";
    } else if (specialistsState.viewMode === "table") {
        if (tableContainer) {
            tableContainer.style.display = "block";
            renderTableView(items);
        }
        if (gridContainer) gridContainer.style.display = "none";
        if (facilityContainer) facilityContainer.style.display = "none";
    }
}

/**
 * 1. Render Specialist Directory Cards View
 */
function renderDirectoryGrid(specialists) {
    const grid = document.getElementById("specialists-grid-container");
    if (!grid) return;

    grid.innerHTML = specialists
        .map((spec) => {
            const statusBadge = getAvailabilityBadgeHtml(spec.availability_status);
            const facilityName = spec.facility_name || specialistsState.facilityMap[spec.facility_id]?.name || spec.facility_id;
            const facilityTier = specialistsState.facilityMap[spec.facility_id]?.facility_type || "HEALTHCARE_FACILITY";
            const initials = getInitials(spec.name);
            const isAvail = spec.availability_status === "AVAILABLE";

            return `
            <div class="specialist-card ${isAvail ? 'available-card' : ''}" data-id="${spec.id}">
                <div class="specialist-card-header">
                    <div class="specialist-avatar-wrap">
                        <div class="specialist-avatar ${spec.availability_status.toLowerCase()}">${initials}</div>
                        <span class="status-indicator-dot ${spec.availability_status.toLowerCase()}"></span>
                    </div>
                    <div class="specialist-card-status">
                        ${statusBadge}
                    </div>
                </div>

                <div class="specialist-card-body">
                    <h3 class="specialist-name">${escapeHtml(spec.name)}</h3>
                    <div class="specialist-spec-badge">🩺 ${escapeHtml(spec.specialization)}</div>

                    <div class="specialist-facility-row">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        <span class="facility-name-text" title="${escapeHtml(facilityName)}">${escapeHtml(facilityName)}</span>
                        <span class="tier-pill">${facilityTier.replace('_', ' ')}</span>
                    </div>

                    <div class="specialist-schedule-row">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span class="schedule-text">${escapeHtml(spec.schedule_info || "Mon - Sat (Regular OPD Hours)")}</span>
                    </div>
                </div>

                <div class="specialist-card-footer">
                    <div class="quick-contact-pills">
                        ${spec.contact_phone ? `<a href="tel:${escapeHtml(spec.contact_phone)}" class="contact-pill" title="Call ${escapeHtml(spec.contact_phone)}">📞 Call</a>` : ''}
                        ${spec.contact_email ? `<a href="mailto:${escapeHtml(spec.contact_email)}" class="contact-pill" title="Email ${escapeHtml(spec.contact_email)}">✉️ Email</a>` : ''}
                    </div>
                    <button class="btn btn-outline-purple btn-sm" onclick="openSpecialistDetailModal('${spec.id}')">
                        <span>Details</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        })
        .join("");
}

/**
 * 2. Render Facility-Oriented Grouped View
 * Answers: "Which facility currently has an available specialist for this specialization?"
 */
function renderFacilityOrientedView(specialists) {
    const container = document.getElementById("specialists-facility-container");
    if (!container) return;

    // Group specialists by facility ID
    const grouped = {};
    specialists.forEach((s) => {
        if (!grouped[s.facility_id]) {
            grouped[s.facility_id] = [];
        }
        grouped[s.facility_id].push(s);
    });

    const facilityIds = Object.keys(grouped);

    container.innerHTML = facilityIds
        .map((facId) => {
            const fac = specialistsState.facilityMap[facId] || { name: facId, facility_type: "HOSPITAL" };
            const facSpecialists = grouped[facId];
            const availCount = facSpecialists.filter((s) => s.availability_status === "AVAILABLE").length;
            const totalCount = facSpecialists.length;

            const specialistsCardsHtml = facSpecialists
                .map((spec) => {
                    const statusBadge = getAvailabilityBadgeHtml(spec.availability_status);
                    const isAvail = spec.availability_status === "AVAILABLE";

                    return `
                    <div class="facility-specialist-item ${isAvail ? 'available' : ''}" onclick="openSpecialistDetailModal('${spec.id}')">
                        <div class="f-spec-left">
                            <div class="f-spec-avatar ${spec.availability_status.toLowerCase()}">${getInitials(spec.name)}</div>
                            <div>
                                <h4 class="f-spec-name">${escapeHtml(spec.name)}</h4>
                                <div class="f-spec-field">🩺 ${escapeHtml(spec.specialization)}</div>
                            </div>
                        </div>
                        <div class="f-spec-right">
                            ${statusBadge}
                            <span class="f-spec-sched">${escapeHtml(spec.schedule_info || "OPD Hours")}</span>
                        </div>
                    </div>
                `;
                })
                .join("");

            return `
            <div class="facility-group-card">
                <div class="facility-group-header">
                    <div class="facility-group-info">
                        <div class="facility-group-icon">🏥</div>
                        <div>
                            <h2 class="facility-group-name">${escapeHtml(fac.name)}</h2>
                            <div class="facility-group-meta">
                                <span class="tier-pill">${fac.facility_type.replace('_', ' ')}</span>
                                ${fac.address ? `<span class="facility-address">📍 ${escapeHtml(fac.address)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="facility-group-counts">
                        <div class="count-badge ${availCount > 0 ? 'available' : 'zero'}">
                            <span class="count-num">${availCount}</span>
                            <span class="count-lbl">Available Now</span>
                        </div>
                        <div class="count-badge total">
                            <span class="count-num">${totalCount}</span>
                            <span class="count-lbl">Total Specialists</span>
                        </div>
                    </div>
                </div>

                <div class="facility-group-body">
                    ${specialistsCardsHtml}
                </div>
            </div>
        `;
        })
        .join("");
}

/**
 * 3. Render Table View
 */
function renderTableView(specialists) {
    const tbody = document.getElementById("specialists-table-body");
    if (!tbody) return;

    tbody.innerHTML = specialists
        .map((spec) => {
            const statusBadge = getAvailabilityBadgeHtml(spec.availability_status);
            const facilityName = spec.facility_name || specialistsState.facilityMap[spec.facility_id]?.name || spec.facility_id;

            return `
            <tr class="specialist-table-row" onclick="openSpecialistDetailModal('${spec.id}')">
                <td>
                    <div class="patient-cell">
                        <div class="patient-avatar" style="background: linear-gradient(135deg, #4f46e5, #7c3aed);">${getInitials(spec.name)}</div>
                        <div>
                            <div class="patient-name">${escapeHtml(spec.name)}</div>
                            <div class="patient-id">ID: ${escapeHtml(spec.id)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-routine" style="font-size:0.82rem;">🩺 ${escapeHtml(spec.specialization)}</span>
                </td>
                <td>
                    <span class="facility-name-text" style="font-weight:600; color:#334155;">${escapeHtml(facilityName)}</span>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <span class="date-text">${escapeHtml(spec.schedule_info || "Standard OPD")}</span>
                </td>
                <td>
                    <span class="date-text">${spec.contact_phone ? escapeHtml(spec.contact_phone) : (spec.contact_email ? escapeHtml(spec.contact_email) : '--')}</span>
                </td>
                <td style="text-align: right;">
                    <button class="btn-action-view" onclick="event.stopPropagation(); openSpecialistDetailModal('${spec.id}')">
                        <span>Profile</span>
                    </button>
                </td>
            </tr>
        `;
        })
        .join("");
}

/**
 * Open Specialist Detail & Schedule Modal
 */
async function openSpecialistDetailModal(specialistId) {
    const modal = document.getElementById("modal-specialist-detail");
    const content = document.getElementById("specialist-detail-content");
    if (!modal || !content) return;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    content.innerHTML = `
        <div class="detail-loading">
            <div class="spinner"></div>
            <p>Loading specialist profile...</p>
        </div>
    `;

    try {
        const res = await getSpecialistById(specialistId);
        if (res.success && res.data) {
            specialistsState.selectedSpecialist = res.data;
            renderSpecialistDetailModal(res.data);
        } else {
            content.innerHTML = `
                <div class="detail-error">
                    <p>Failed to load specialist: ${escapeHtml(res.message || 'Unknown error')}</p>
                    <button class="btn btn-primary" onclick="openSpecialistDetailModal('${specialistId}')">Retry</button>
                </div>
            `;
        }
    } catch (err) {
        content.innerHTML = `
            <div class="detail-error">
                <p>Unable to connect to backend server.</p>
            </div>
        `;
    }
}

/**
 * Render Specialist Detail Modal View
 */
function renderSpecialistDetailModal(spec) {
    const content = document.getElementById("specialist-detail-content");
    if (!content) return;

    const facilityName = spec.facility_name || specialistsState.facilityMap[spec.facility_id]?.name || spec.facility_id;
    const facilityTier = specialistsState.facilityMap[spec.facility_id]?.facility_type || "HEALTHCARE_FACILITY";
    const statusBadge = getAvailabilityBadgeHtml(spec.availability_status);
    const initials = getInitials(spec.name);

    content.innerHTML = `
        <div class="specialist-modal-hero">
            <div class="modal-hero-avatar ${spec.availability_status.toLowerCase()}">${initials}</div>
            <div class="modal-hero-info">
                <span class="detail-ref-id">SPECIALIST #${escapeHtml(spec.id)}</span>
                <h2 class="modal-hero-name">${escapeHtml(spec.name)}</h2>
                <div class="modal-hero-meta">
                    <span class="hero-spec-pill">🩺 ${escapeHtml(spec.specialization)}</span>
                    ${statusBadge}
                </div>
            </div>
        </div>

        <!-- Assigned Facility Card -->
        <div class="detail-section">
            <h3 class="section-subtitle">Assigned Healthcare Facility</h3>
            <div class="transfer-overview-box" style="grid-template-columns: 1fr;">
                <div class="transfer-box-node">
                    <div class="node-label">Facility Practice Base</div>
                    <div class="node-facility-name">${escapeHtml(facilityName)}</div>
                    <div class="node-facility-tier">${facilityTier.replace('_', ' ')}</div>
                </div>
            </div>
        </div>

        <!-- Consultation & Schedule Details -->
        <div class="detail-section">
            <h3 class="section-subtitle">Schedule & Duty Hours</h3>
            <div class="detail-info-grid">
                <div class="info-item full-width">
                    <span class="info-label">Consultation Hours</span>
                    <p class="info-value-box">${escapeHtml(spec.schedule_info || "Monday - Saturday: 09:00 AM - 02:00 PM (Outpatient Department)")}</p>
                </div>
                <div class="info-item">
                    <span class="info-label">Direct Phone Contact</span>
                    <span class="info-value">${spec.contact_phone ? `<a href="tel:${escapeHtml(spec.contact_phone)}" style="color:#7c3aed; text-decoration:none;">📞 ${escapeHtml(spec.contact_phone)}</a>` : '<em>Not specified</em>'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Direct Email</span>
                    <span class="info-value">${spec.contact_email ? `<a href="mailto:${escapeHtml(spec.contact_email)}" style="color:#7c3aed; text-decoration:none;">✉️ ${escapeHtml(spec.contact_email)}</a>` : '<em>Not specified</em>'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Registration Timestamp</span>
                    <span class="info-value">${formatFullDateTime(spec.created_at)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Last Status Update</span>
                    <span class="info-value">${formatFullDateTime(spec.updated_at)}</span>
                </div>
            </div>
        </div>

        <!-- Availability Status Management for Operators -->
        <div class="detail-section actions-section">
            <h3 class="section-subtitle">Update Availability Status (Operator)</h3>
            <div class="status-action-bar">
                <div class="action-instructions">Select current duty status:</div>
                <div class="action-buttons-group">
                    <button class="btn ${spec.availability_status === 'AVAILABLE' ? 'btn-success' : 'btn-outline'}" onclick="triggerSpecialistStatusUpdate('${spec.id}', 'AVAILABLE')">
                        ● Mark Available
                    </button>
                    <button class="btn ${spec.availability_status === 'BUSY' ? 'btn-warning' : 'btn-outline'}" onclick="triggerSpecialistStatusUpdate('${spec.id}', 'BUSY')">
                        ● Mark Busy / In Consult
                    </button>
                    <button class="btn ${spec.availability_status === 'ON_LEAVE' ? 'btn-outline-danger' : 'btn-outline'}" onclick="triggerSpecialistStatusUpdate('${spec.id}', 'ON_LEAVE')">
                        ● Mark On Leave
                    </button>
                    <button class="btn ${spec.availability_status === 'UNAVAILABLE' ? 'btn-outline-neutral' : 'btn-outline'}" onclick="triggerSpecialistStatusUpdate('${spec.id}', 'UNAVAILABLE')">
                        ● Mark Off Duty
                    </button>
                </div>
            </div>
        </div>

        <!-- Quick Link to Referral Action -->
        <div class="detail-section" style="margin-top: 1.5rem; text-align: right;">
            <a href="referrals.html" class="btn btn-primary">
                <span>Refer Patient to this Specialist →</span>
            </a>
        </div>
    `;
}

/**
 * Trigger Specialist Availability update via PATCH /specialists/{id}
 */
async function triggerSpecialistStatusUpdate(specialistId, newStatus) {
    try {
        showToast("Updating availability...", "info");
        const res = await updateSpecialist(specialistId, { availability_status: newStatus });
        if (res.success) {
            showToast(`Status updated to ${newStatus}!`, "success");
            await openSpecialistDetailModal(specialistId);
            await loadSpecialists();
        } else {
            showToast(`Update failed: ${res.message}`, "error");
        }
    } catch (err) {
        showToast("Error updating status. Please verify backend is running.", "error");
    }
}

/**
 * Handle Specialist Registration Form
 */
async function handleCreateSpecialistSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("create-specialist-name")?.value.trim();
    const spec = document.getElementById("create-specialist-specialization")?.value.trim();
    const facilityId = document.getElementById("create-specialist-facility")?.value;
    const status = document.getElementById("create-specialist-status")?.value || "AVAILABLE";
    const schedule = document.getElementById("create-specialist-schedule")?.value.trim() || undefined;
    const phone = document.getElementById("create-specialist-phone")?.value.trim() || undefined;
    const email = document.getElementById("create-specialist-email")?.value.trim() || undefined;

    const errorBox = document.getElementById("create-specialist-error");
    const submitBtn = document.getElementById("btn-submit-specialist");

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    if (!name) {
        showFormError("Specialist full name is required.");
        return;
    }
    if (!spec) {
        showFormError("Medical specialization is required.");
        return;
    }
    if (!facilityId) {
        showFormError("Please select an assigned healthcare facility.");
        return;
    }

    const payload = {
        name: name,
        specialization: spec,
        facility_id: facilityId,
        availability_status: status,
        schedule_info: schedule,
        contact_phone: phone,
        contact_email: email,
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Registering...";
    }

    try {
        const res = await createSpecialist(payload);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Register Specialist";
        }

        if (res.success) {
            showToast("Specialist registered successfully!", "success");
            const modal = document.getElementById("modal-create-specialist");
            if (modal) modal.classList.remove("active");
            document.body.style.overflow = "auto";
            resetCreateForm();
            await loadSpecialists();
        } else {
            showFormError(res.message || "Failed to register specialist.");
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Register Specialist";
        }
        showFormError("Network error while connecting to backend.");
    }
}

function showFormError(msg) {
    const errorBox = document.getElementById("create-specialist-error");
    if (errorBox) {
        errorBox.style.display = "block";
        errorBox.textContent = msg;
    }
}

function resetCreateForm() {
    const form = document.getElementById("form-create-specialist");
    if (form) form.reset();
    const errorBox = document.getElementById("create-specialist-error");
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
function getAvailabilityBadgeHtml(status) {
    const isOffline = (window.Connectivity && !window.Connectivity.isOnline()) || !navigator.onLine;
    const prefix = isOffline ? "LAST KNOWN: " : "● ";

    switch (status) {
        case "AVAILABLE":
            return `<span class="${isOffline ? 'badge badge-cached' : 'badge badge-avail-green'}">${prefix}AVAILABLE</span>`;
        case "BUSY":
            return `<span class="${isOffline ? 'badge badge-cached' : 'badge badge-avail-amber'}">${prefix}BUSY</span>`;
        case "ON_LEAVE":
            return `<span class="${isOffline ? 'badge badge-cached' : 'badge badge-avail-red'}">${prefix}ON LEAVE</span>`;
        case "UNAVAILABLE":
            return `<span class="${isOffline ? 'badge badge-cached' : 'badge badge-avail-gray'}">${prefix}OFF DUTY</span>`;
        default:
            return `<span class="badge badge-neutral">${prefix}${escapeHtml(status)}</span>`;
    }
}

function getInitials(name) {
    if (!name) return "DR";
    const parts = name.trim().replace(/^Dr\.?\s*/i, "").split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
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
    });
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
