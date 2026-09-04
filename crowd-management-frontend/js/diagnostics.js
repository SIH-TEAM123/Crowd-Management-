/**
 * Diagnostic Coordination Frontend Controller
 * Integrates with FastAPI Backend (/diagnostics, /facilities)
 */

document.addEventListener("DOMContentLoaded", () => {
    initDiagnosticsPage();
});

// State Store
const diagnosticsState = {
    diagnostics: [],
    facilities: [],
    facilityMap: {},
    bookings: [],
    selectedTest: null,
    selectedBooking: null,
    trackedBookingId: null,
    activeQueue: null,
    viewMode: "grid", // 'grid' | 'table'
    activeTab: "catalog", // 'catalog' | 'queues' | 'bookings'
    isLoading: false,
    filters: {
        search: "",
        facility_id: "",
        category: "",
        is_available_only: false,
    },
    bookingFilters: {
        status: "",
        result_status: "",
        facility_id: "",
        patient_search: "",
    },
};

// Backend Lifecycle State Machine Transitions
const VALID_BOOKING_TRANSITIONS = {
    REQUESTED: ["BOOKED", "CANCELLED", "FAILED"],
    BOOKED: ["IN_PROGRESS", "CANCELLED", "FAILED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED", "FAILED"],
    COMPLETED: [],
    CANCELLED: [],
    FAILED: [],
};

/**
 * Initialize page components, auth checks, and fetch initial data
 */
async function initDiagnosticsPage() {
    setupAuthDisplay();
    setupEventListeners();
    await loadFacilities();
    await loadDiagnostics();
    await loadBookings();
    updateStatsBar();

    // Check if a specific booking ID or diagnostic ID was passed in query params
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get("track_id");
    const testId = urlParams.get("test_id");
    const tab = urlParams.get("tab");

    if (tab) {
        switchTab(tab);
    }
    if (trackId) {
        switchTab("bookings");
        document.getElementById("input-track-booking-id").value = trackId;
        trackBooking(trackId);
    } else if (testId) {
        openTestDetailModal(testId);
    }
}

/**
 * Render user profile / initials
 */
function setupAuthDisplay() {
    const userEmail = localStorage.getItem("userEmail") || "admin@hospital.gov";
    const initials = userEmail.substring(0, 2).toUpperCase();
    const initialsEl = document.getElementById("user-initials");
    if (initialsEl) initialsEl.textContent = initials;
}

/**
 * Setup all interactive event listeners
 */
function setupEventListeners() {
    // 1. Tab Navigation
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tabName = btn.getAttribute("data-tab");
            switchTab(tabName);
        });
    });

    // 2. Global Refresh Button
    const refreshBtn = document.getElementById("btn-global-refresh");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            showToast("Refreshing diagnostic data...", "info");
            await loadFacilities();
            await loadDiagnostics();
            await loadBookings();
            if (diagnosticsState.trackedBookingId) {
                trackBooking(diagnosticsState.trackedBookingId, false);
            }
            if (diagnosticsState.activeQueue && diagnosticsState.activeQueue.diagnostic_id) {
                loadQueueForTest(diagnosticsState.activeQueue.diagnostic_id, false);
            }
            updateStatsBar();
            showToast("Diagnostic data up to date", "success");
        });
    }

    // 3. View Mode Toggle (Grid vs Table)
    const btnGrid = document.getElementById("btn-view-grid");
    const btnTable = document.getElementById("btn-view-table");
    if (btnGrid) btnGrid.addEventListener("click", () => switchViewMode("grid"));
    if (btnTable) btnTable.addEventListener("click", () => switchViewMode("table"));

    // 4. Catalog Filters
    const searchInput = document.getElementById("filter-search");
    const facilitySelect = document.getElementById("filter-facility");
    const categorySelect = document.getElementById("filter-category");
    const availOnlyCheck = document.getElementById("filter-available-only");
    const resetFiltersBtn = document.getElementById("btn-reset-filters");

    let debounceTimeout = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                diagnosticsState.filters.search = e.target.value.trim().toLowerCase();
                renderDiagnosticsView();
            }, 250);
        });
    }

    if (facilitySelect) {
        facilitySelect.addEventListener("change", (e) => {
            diagnosticsState.filters.facility_id = e.target.value;
            loadDiagnostics();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener("change", (e) => {
            diagnosticsState.filters.category = e.target.value;
            loadDiagnostics();
        });
    }

    if (availOnlyCheck) {
        availOnlyCheck.addEventListener("change", (e) => {
            diagnosticsState.filters.is_available_only = e.target.checked;
            loadDiagnostics();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
            diagnosticsState.filters = { search: "", facility_id: "", category: "", is_available_only: false };
            if (searchInput) searchInput.value = "";
            if (facilitySelect) facilitySelect.value = "";
            if (categorySelect) categorySelect.value = "";
            if (availOnlyCheck) availOnlyCheck.checked = false;
            loadDiagnostics();
        });
    }

    // 5. Open Booking Modal Buttons
    const openBookBtn = document.getElementById("btn-open-book-modal");
    if (openBookBtn) {
        openBookBtn.addEventListener("click", () => openBookModal());
    }

    // 6. Queue Tab Controls
    const queueFacSelect = document.getElementById("queue-filter-facility");
    const queueTestSelect = document.getElementById("queue-filter-test");
    const refreshQueueBtn = document.getElementById("btn-refresh-queue");

    if (queueFacSelect) {
        queueFacSelect.addEventListener("change", (e) => {
            const facId = e.target.value;
            populateQueueTestOptions(facId);
            if (facId) {
                loadFacilityQueues(facId);
            } else {
                document.getElementById("facility-queues-overview").style.display = "none";
                document.getElementById("test-queue-hero").style.display = "none";
                document.getElementById("test-queue-table-container").style.display = "none";
                document.getElementById("queue-empty-prompt").style.display = "block";
            }
        });
    }

    if (queueTestSelect) {
        queueTestSelect.addEventListener("change", (e) => {
            const testId = e.target.value;
            if (testId) {
                loadQueueForTest(testId);
            } else {
                const facId = queueFacSelect ? queueFacSelect.value : "";
                if (facId) loadFacilityQueues(facId);
            }
        });
    }

    if (refreshQueueBtn) {
        refreshQueueBtn.addEventListener("click", () => {
            const testId = queueTestSelect ? queueTestSelect.value : "";
            const facId = queueFacSelect ? queueFacSelect.value : "";
            if (testId) {
                loadQueueForTest(testId);
            } else if (facId) {
                loadFacilityQueues(facId);
            } else {
                showToast("Please select a facility or test first", "info");
            }
        });
    }

    // 7. Track Booking Input
    const btnTrack = document.getElementById("btn-track-booking");
    const inputTrack = document.getElementById("input-track-booking-id");
    if (btnTrack && inputTrack) {
        btnTrack.addEventListener("click", () => {
            const bId = inputTrack.value.trim();
            if (!bId) {
                showToast("Please enter a Booking ID", "error");
                return;
            }
            trackBooking(bId);
        });
        inputTrack.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                const bId = inputTrack.value.trim();
                if (bId) trackBooking(bId);
            }
        });
    }

    const refreshTrackedBtn = document.getElementById("btn-refresh-tracked-booking");
    if (refreshTrackedBtn) {
        refreshTrackedBtn.addEventListener("click", () => {
            if (diagnosticsState.trackedBookingId) {
                trackBooking(diagnosticsState.trackedBookingId);
            }
        });
    }

    // 8. Bookings List Filters
    const bStatusFilter = document.getElementById("filter-booking-status");
    const bResultFilter = document.getElementById("filter-booking-result-status");
    const bFacilityFilter = document.getElementById("filter-booking-facility");
    const bPatientSearch = document.getElementById("filter-booking-patient");
    const btnResetBookings = document.getElementById("btn-reset-booking-filters");
    const btnRefreshBookings = document.getElementById("btn-refresh-bookings");

    if (bStatusFilter) {
        bStatusFilter.addEventListener("change", (e) => {
            diagnosticsState.bookingFilters.status = e.target.value;
            loadBookings();
        });
    }

    if (bResultFilter) {
        bResultFilter.addEventListener("change", (e) => {
            diagnosticsState.bookingFilters.result_status = e.target.value;
            loadBookings();
        });
    }

    if (bFacilityFilter) {
        bFacilityFilter.addEventListener("change", (e) => {
            diagnosticsState.bookingFilters.facility_id = e.target.value;
            loadBookings();
        });
    }

    if (bPatientSearch) {
        let bDebounce = null;
        bPatientSearch.addEventListener("input", (e) => {
            clearTimeout(bDebounce);
            bDebounce = setTimeout(() => {
                diagnosticsState.bookingFilters.patient_search = e.target.value.trim().toLowerCase();
                renderBookingsTable();
            }, 250);
        });
    }

    if (btnResetBookings) {
        btnResetBookings.addEventListener("click", () => {
            diagnosticsState.bookingFilters = { status: "", result_status: "", facility_id: "", patient_search: "" };
            if (bStatusFilter) bStatusFilter.value = "";
            if (bResultFilter) bResultFilter.value = "";
            if (bFacilityFilter) bFacilityFilter.value = "";
            if (bPatientSearch) bPatientSearch.value = "";
            loadBookings();
        });
    }

    if (btnRefreshBookings) {
        btnRefreshBookings.addEventListener("click", () => loadBookings());
    }

    // 9. Forms & Modal submissions
    setupModalHandlers();
}

/**
 * Setup modal opening, closing, and form submissions
 */
function setupModalHandlers() {
    // Book Diagnostic Form
    const bookForm = document.getElementById("form-book-diagnostic");
    const bookFacSelect = document.getElementById("book-facility-select");
    const bookTestSelect = document.getElementById("book-test-select");

    if (bookFacSelect) {
        bookFacSelect.addEventListener("change", (e) => {
            const facId = e.target.value;
            populateBookingFormTestOptions(facId);
        });
    }

    if (bookTestSelect) {
        bookTestSelect.addEventListener("change", (e) => {
            const testId = e.target.value;
            const hint = document.getElementById("book-test-info-hint");
            const test = diagnosticsState.diagnostics.find((t) => t.id === testId);
            if (test && hint) {
                hint.textContent = `Cost: ₹${test.cost || 0} | Estimated Duration: ${test.estimated_duration_minutes || 15} mins | Category: ${test.category || "General"}`;
            } else if (hint) {
                hint.textContent = "";
            }
        });
    }

    if (bookForm) {
        bookForm.addEventListener("submit", handleBookingSubmit);
    }

    // Lifecycle Status Transition Form
    const statusForm = document.getElementById("form-update-status");
    if (statusForm) {
        statusForm.addEventListener("submit", handleStatusUpdateSubmit);
    }

    // Result Status Update Form
    const resultForm = document.getElementById("form-update-result");
    if (resultForm) {
        resultForm.addEventListener("submit", handleResultUpdateSubmit);
    }

    // Modal Close Buttons
    document.getElementById("btn-close-detail-modal")?.addEventListener("click", () => closeModal("modal-test-details"));
    document.getElementById("btn-close-detail-modal-btn")?.addEventListener("click", () => closeModal("modal-test-details"));
    document.getElementById("btn-close-book-modal")?.addEventListener("click", () => closeModal("modal-book-test"));
    document.getElementById("btn-cancel-book")?.addEventListener("click", () => closeModal("modal-book-test"));
    document.getElementById("btn-close-confirm-modal")?.addEventListener("click", () => closeModal("modal-booking-confirmation"));
    document.getElementById("btn-close-status-modal")?.addEventListener("click", () => closeModal("modal-update-status"));
    document.getElementById("btn-cancel-status-modal")?.addEventListener("click", () => closeModal("modal-update-status"));
    document.getElementById("btn-close-result-modal")?.addEventListener("click", () => closeModal("modal-update-result"));
    document.getElementById("btn-cancel-result-modal")?.addEventListener("click", () => closeModal("modal-update-result"));

    // Action from Detail Modal to Book Modal
    document.getElementById("btn-book-from-detail-modal")?.addEventListener("click", () => {
        const test = diagnosticsState.selectedTest;
        closeModal("modal-test-details");
        if (test) {
            openBookModal(test.id, test.facility_id);
        }
    });

    // Action from Detail Modal to Queue Tab
    document.getElementById("btn-jump-to-queue-from-detail")?.addEventListener("click", () => {
        const test = diagnosticsState.selectedTest;
        closeModal("modal-test-details");
        if (test) {
            switchTab("queues");
            const qFac = document.getElementById("queue-filter-facility");
            if (qFac) qFac.value = test.facility_id;
            populateQueueTestOptions(test.facility_id);
            const qTest = document.getElementById("queue-filter-test");
            if (qTest) qTest.value = test.id;
            loadQueueForTest(test.id);
        }
    });

    // Action from Tracking Card buttons
    document.getElementById("btn-open-update-status-from-track")?.addEventListener("click", () => {
        if (diagnosticsState.trackedBookingId) {
            openUpdateStatusModal(diagnosticsState.trackedBookingId);
        }
    });

    document.getElementById("btn-open-update-result-from-track")?.addEventListener("click", () => {
        if (diagnosticsState.trackedBookingId) {
            openUpdateResultModal(diagnosticsState.trackedBookingId);
        }
    });

    // Action from Confirmation Modal to Track Tab
    document.getElementById("btn-track-from-confirm")?.addEventListener("click", () => {
        const bId = document.getElementById("confirm-booking-id")?.textContent;
        closeModal("modal-booking-confirmation");
        if (bId) {
            switchTab("bookings");
            document.getElementById("input-track-booking-id").value = bId;
            trackBooking(bId);
        }
    });
}

/**
 * Switch Active Tab
 */
function switchTab(tabName) {
    diagnosticsState.activeTab = tabName;
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.toggle("active", content.id === `tab-content-${tabName}`);
    });
}

/**
 * Switch View Mode (Grid vs Table)
 */
function switchViewMode(mode) {
    diagnosticsState.viewMode = mode;
    document.getElementById("btn-view-grid")?.classList.toggle("active", mode === "grid");
    document.getElementById("btn-view-table")?.classList.toggle("active", mode === "table");

    const gridEl = document.getElementById("diagnostic-cards-grid");
    const tableEl = document.getElementById("diagnostic-table-view");

    if (mode === "grid") {
        if (gridEl) gridEl.style.display = "grid";
        if (tableEl) tableEl.style.display = "none";
    } else {
        if (gridEl) gridEl.style.display = "none";
        if (tableEl) tableEl.style.display = "block";
    }
}

/**
 * Fetch and cache facilities list
 */
async function loadFacilities() {
    try {
        const response = await fetchFacilities();
        if (response.success && Array.isArray(response.data)) {
            diagnosticsState.facilities = response.data;
            diagnosticsState.facilityMap = {};
            response.data.forEach((fac) => {
                diagnosticsState.facilityMap[fac.id] = fac;
            });
            populateFacilityDropdowns();
        }
    } catch (err) {
        console.error("Error loading facilities:", err);
    }
}

/**
 * Populate all facility select dropdowns across the page
 */
function populateFacilityDropdowns() {
    const selects = [
        document.getElementById("filter-facility"),
        document.getElementById("queue-filter-facility"),
        document.getElementById("filter-booking-facility"),
        document.getElementById("book-facility-select"),
    ];

    selects.forEach((select) => {
        if (!select) return;
        const currentVal = select.value;
        const firstOption = select.options[0];
        select.innerHTML = "";
        if (firstOption) select.appendChild(firstOption);

        diagnosticsState.facilities.forEach((fac) => {
            const opt = document.createElement("option");
            opt.value = fac.id;
            opt.textContent = `${fac.name} (${fac.facility_type || "Hospital"})`;
            select.appendChild(opt);
        });

        if (currentVal) select.value = currentVal;
    });
}

/**
 * Populate test dropdown for queue tab
 */
function populateQueueTestOptions(facilityId) {
    const queueTestSelect = document.getElementById("queue-filter-test");
    if (!queueTestSelect) return;

    queueTestSelect.innerHTML = `<option value="">All Tests / Full Facility Queue</option>`;

    let tests = diagnosticsState.diagnostics;
    if (facilityId) {
        tests = tests.filter((t) => t.facility_id === facilityId);
    }

    tests.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.category || "General"})`;
        queueTestSelect.appendChild(opt);
    });
}

/**
 * Populate test dropdown inside the Book Diagnostic modal
 */
function populateBookingFormTestOptions(facilityId) {
    const bookTestSelect = document.getElementById("book-test-select");
    if (!bookTestSelect) return;

    bookTestSelect.innerHTML = `<option value="">Select diagnostic test offering...</option>`;

    let tests = diagnosticsState.diagnostics;
    if (facilityId) {
        tests = tests.filter((t) => t.facility_id === facilityId);
    }

    // Only allow available tests
    tests.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name} - ₹${t.cost || 0} (${t.is_available ? "Available" : "Unavailable"})`;
        if (!t.is_available) {
            opt.disabled = true;
        }
        bookTestSelect.appendChild(opt);
    });
}

/**
 * Load diagnostic test catalog from backend
 */
async function loadDiagnostics() {
    diagnosticsState.isLoading = true;
    try {
        const filters = {};
        if (diagnosticsState.filters.facility_id) filters.facility_id = diagnosticsState.filters.facility_id;
        if (diagnosticsState.filters.category) filters.category = diagnosticsState.filters.category;
        if (diagnosticsState.filters.is_available_only) filters.is_available_only = true;

        const response = await fetchDiagnostics(filters);
        if (response.success && Array.isArray(response.data)) {
            diagnosticsState.diagnostics = response.data;
            if (response.fromCache) {
                showOfflineStaleBanner('catalog-empty-state', response.lastSyncedAt);
            } else {
                hideOfflineStaleBanner();
            }
            renderDiagnosticsView();
        } else {
            showToast(response.message || "Failed to load diagnostic catalog", "error");
        }
    } catch (err) {
        console.error("Failed to load diagnostics:", err);
        showToast("Error connecting to diagnostics API", "error");
    } finally {
        diagnosticsState.isLoading = false;
    }
}

/**
 * Filter & Render diagnostic catalog in Grid and Table views
 */
function renderDiagnosticsView() {
    let list = diagnosticsState.diagnostics;
    const search = diagnosticsState.filters.search;

    if (search) {
        list = list.filter(
            (d) =>
                d.name.toLowerCase().includes(search) ||
                (d.category && d.category.toLowerCase().includes(search)) ||
                (d.facility_name && d.facility_name.toLowerCase().includes(search)) ||
                (d.description && d.description.toLowerCase().includes(search))
        );
    }

    const countEl = document.getElementById("catalog-results-count");
    if (countEl) {
        countEl.textContent = `Showing ${list.length} diagnostic offering${list.length === 1 ? "" : "s"}`;
    }

    const emptyState = document.getElementById("catalog-empty-state");
    const gridEl = document.getElementById("diagnostic-cards-grid");
    const tbodyEl = document.getElementById("diagnostic-table-tbody");

    if (list.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        if (gridEl) gridEl.innerHTML = "";
        if (tbodyEl) tbodyEl.innerHTML = "";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    // 1. Render Grid
    if (gridEl) {
        gridEl.innerHTML = list
            .map((test) => {
                const facName = test.facility_name || (diagnosticsState.facilityMap[test.facility_id]?.name) || test.facility_id;
                const isAvail = test.is_available;
                return `
                <div class="diagnostic-card">
                    <div>
                        <div class="diag-card-header">
                            <div>
                                <span class="badge badge-category">${escapeHtml(test.category || "General Diagnostic")}</span>
                                <h3 class="diag-card-title">${escapeHtml(test.name)}</h3>
                                <div class="diag-card-facility">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span>${escapeHtml(facName)}</span>
                                </div>
                            </div>
                            <span class="${isAvail ? "badge-available" : "badge-unavailable"}">
                                ${isAvail ? "● Available" : "✕ Unavailable"}
                            </span>
                        </div>

                        <div class="diag-card-meta-row">
                            <div class="diag-meta-item">
                                <span class="diag-meta-label">Cost</span>
                                <span class="diag-meta-val">₹${test.cost !== null && test.cost !== undefined ? test.cost : "--"}</span>
                            </div>
                            <div class="diag-meta-item">
                                <span class="diag-meta-label">Est. Duration</span>
                                <span class="diag-meta-val">${test.estimated_duration_minutes || 15} mins</span>
                            </div>
                        </div>

                        <p class="diag-card-desc" title="${escapeHtml(test.description || "")}">
                            ${escapeHtml(test.description || "Standard diagnostic testing service with fast automated queue token assignment.")}
                        </p>
                    </div>

                    <div class="diag-card-actions">
                        <button class="btn btn-secondary" onclick="openTestDetailModal('${test.id}')">Details</button>
                        <button class="btn btn-secondary" onclick="jumpToQueueTab('${test.facility_id}', '${test.id}')" title="View Queue">
                            Queue
                        </button>
                        <button class="btn btn-primary" ${!isAvail ? "disabled" : ""} onclick="openBookModal('${test.id}', '${test.facility_id}')">
                            ${isAvail ? "Book Now" : "Unavailable"}
                        </button>
                    </div>
                </div>
            `;
            })
            .join("");
    }

    // 2. Render Table
    if (tbodyEl) {
        tbodyEl.innerHTML = list
            .map((test) => {
                const facName = test.facility_name || (diagnosticsState.facilityMap[test.facility_id]?.name) || test.facility_id;
                const isAvail = test.is_available;
                return `
                <tr>
                    <td><strong>${escapeHtml(test.name)}</strong></td>
                    <td><span class="badge badge-category">${escapeHtml(test.category || "General")}</span></td>
                    <td>${escapeHtml(facName)}</td>
                    <td><span class="${isAvail ? "badge-available" : "badge-unavailable"}">${isAvail ? "Available" : "Unavailable"}</span></td>
                    <td>₹${test.cost !== null && test.cost !== undefined ? test.cost : "--"}</td>
                    <td>${test.estimated_duration_minutes || 15} mins</td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-secondary" onclick="openTestDetailModal('${test.id}')">View</button>
                            <button class="btn btn-sm btn-primary" ${!isAvail ? "disabled" : ""} onclick="openBookModal('${test.id}', '${test.facility_id}')">Book</button>
                        </div>
                    </td>
                </tr>
            `;
            })
            .join("");
    }
}

/**
 * Open Test Details Modal
 */
async function openTestDetailModal(testId) {
    const test = diagnosticsState.diagnostics.find((t) => t.id === testId);
    if (!test) {
        showToast("Diagnostic test not found", "error");
        return;
    }

    diagnosticsState.selectedTest = test;
    const facName = test.facility_name || (diagnosticsState.facilityMap[test.facility_id]?.name) || test.facility_id;

    document.getElementById("modal-detail-name").textContent = test.name;
    document.getElementById("modal-detail-category").textContent = test.category || "General Diagnostic";
    document.getElementById("modal-detail-facility").textContent = facName;
    document.getElementById("modal-detail-cost").textContent = `₹${test.cost !== null && test.cost !== undefined ? test.cost : "N/A"}`;
    document.getElementById("modal-detail-duration").textContent = `${test.estimated_duration_minutes || 15} minutes`;
    document.getElementById("modal-detail-description").textContent = test.description || "Standard clinical protocol test. Fast digital sample intake and report generation.";

    const badgeEl = document.getElementById("modal-detail-avail-badge");
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="${test.is_available ? "badge-available" : "badge-unavailable"}">${test.is_available ? "● Available for Booking" : "✕ Currently Unavailable"}</span>`;
    }

    const bookBtn = document.getElementById("btn-book-from-detail-modal");
    if (bookBtn) {
        bookBtn.disabled = !test.is_available;
        bookBtn.textContent = test.is_available ? "Book This Test" : "Unavailable";
    }

    // Fetch live queue metric snippet for this test
    const queueTextEl = document.getElementById("modal-detail-queue-text");
    if (queueTextEl) queueTextEl.textContent = "Checking active queue...";

    try {
        const qResp = await getDiagnosticQueue(test.id);
        if (qResp.success && qResp.data) {
            const q = qResp.data;
            if (queueTextEl) {
                queueTextEl.textContent = `${q.waiting_count} patient${q.waiting_count === 1 ? "" : "s"} waiting in queue | Est. wait: ~${q.estimated_wait_minutes || 0} mins`;
            }
        } else {
            if (queueTextEl) queueTextEl.textContent = "No active queue ahead";
        }
    } catch {
        if (queueTextEl) queueTextEl.textContent = "Queue info unavailable";
    }

    openModal("modal-test-details");
}

/**
 * Open Booking Modal with optional pre-selections
 */
function openBookModal(testId = null, facilityId = null) {
    const facSelect = document.getElementById("book-facility-select");
    const testSelect = document.getElementById("book-test-select");
    const nameInput = document.getElementById("book-patient-name");
    const idInput = document.getElementById("book-patient-id");
    const notesInput = document.getElementById("book-notes");

    if (nameInput) nameInput.value = "";
    if (idInput) idInput.value = "";
    if (notesInput) notesInput.value = "";

    if (facilityId && facSelect) {
        facSelect.value = facilityId;
        populateBookingFormTestOptions(facilityId);
    } else if (facSelect && facSelect.options.length > 1) {
        facSelect.selectedIndex = 1;
        populateBookingFormTestOptions(facSelect.value);
    }

    if (testId && testSelect) {
        testSelect.value = testId;
        const test = diagnosticsState.diagnostics.find((t) => t.id === testId);
        const hint = document.getElementById("book-test-info-hint");
        if (test && hint) {
            hint.textContent = `Cost: ₹${test.cost || 0} | Estimated Duration: ${test.estimated_duration_minutes || 15} mins`;
        }
    }

    openModal("modal-book-test");
}

/**
 * Handle Diagnostic Booking Submission
 */
async function handleBookingSubmit(e) {
    e.preventDefault();

    const facility_id = document.getElementById("book-facility-select")?.value;
    const diagnostic_id = document.getElementById("book-test-select")?.value;
    const patient_name = document.getElementById("book-patient-name")?.value.trim();
    const patient_id = document.getElementById("book-patient-id")?.value.trim() || null;
    const initial_status = document.getElementById("book-initial-status")?.value || "REQUESTED";
    const notes = document.getElementById("book-notes")?.value.trim() || null;

    if (!facility_id || !diagnostic_id || !patient_name) {
        showToast("Please fill in all required fields", "error");
        return;
    }

    const payload = {
        facility_id,
        diagnostic_id,
        patient_name,
        patient_id,
        status: initial_status,
        result_status: "PENDING",
        notes,
    };

    const submitBtn = document.getElementById("btn-submit-booking");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";
    }

    try {
        const response = await createDiagnosticBooking(payload);
        if (response.success && response.data) {
            const booking = response.data;
            closeModal("modal-book-test");
            showToast("Diagnostic test booked successfully!", "success");

            // Show Confirmation Modal
            document.getElementById("confirm-booking-id").textContent = booking.id;
            document.getElementById("confirm-test-name").textContent = booking.diagnostic_name || "Diagnostic Test";
            document.getElementById("confirm-facility-name").textContent = booking.facility_name || facility_id;
            document.getElementById("confirm-queue-pos").textContent = booking.queue_position ? `Position #${booking.queue_position}` : "Active";
            document.getElementById("confirm-est-wait").textContent = booking.queue_position ? `~${(booking.queue_position - 1) * 15} mins` : "--";
            document.getElementById("confirm-result-status").textContent = `Result: ${booking.result_status || "PENDING"}`;

            openModal("modal-booking-confirmation");

            // Refresh Bookings & Stats
            await loadBookings();
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to create booking", "error");
        }
    } catch (err) {
        console.error("Booking creation error:", err);
        showToast("An unexpected error occurred while booking", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Confirm Booking";
        }
    }
}

/**
 * Load Active Queue for a specific diagnostic test
 */
async function loadQueueForTest(diagnosticId, notify = true) {
    const heroEl = document.getElementById("test-queue-hero");
    const tableContainer = document.getElementById("test-queue-table-container");
    const emptyPrompt = document.getElementById("queue-empty-prompt");
    const facOverview = document.getElementById("facility-queues-overview");

    try {
        const response = await getDiagnosticQueue(diagnosticId);
        if (response.success && response.data) {
            const q = response.data;
            diagnosticsState.activeQueue = q;

            if (heroEl) heroEl.style.display = "block";
            if (tableContainer) tableContainer.style.display = "block";
            if (emptyPrompt) emptyPrompt.style.display = "none";
            if (facOverview) facOverview.style.display = "none";

            document.getElementById("hero-test-name").textContent = q.diagnostic_name || "Diagnostic Test";
            document.getElementById("hero-facility-name").textContent = q.facility_name || q.facility_id;
            document.getElementById("hero-waiting-count").textContent = q.waiting_count;
            document.getElementById("hero-serving-count").textContent = q.in_progress_count;
            document.getElementById("hero-total-active").textContent = q.total_active;
            document.getElementById("hero-est-wait").textContent = `${q.estimated_wait_minutes || 0} mins`;
            document.getElementById("queue-last-updated").textContent = `Updated: ${new Date().toLocaleTimeString()}`;

            const tbody = document.getElementById("test-queue-tbody");
            if (tbody) {
                if (q.queue.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 2rem;">No patients currently waiting in this queue.</td></tr>`;
                } else {
                    tbody.innerHTML = q.queue
                        .map((item) => {
                            const isServing = item.queue_position === 0;
                            const rankClass = isServing ? "queue-rank-serving" : item.queue_position === 1 ? "queue-rank-1" : item.queue_position === 2 ? "queue-rank-2" : item.queue_position === 3 ? "queue-rank-3" : "queue-rank-general";
                            const rankLabel = isServing ? "Serving" : `#${item.queue_position}`;

                            return `
                            <tr>
                                <td><span class="queue-rank-badge ${rankClass}">${rankLabel}</span></td>
                                <td><strong style="font-family: monospace; color: #7c3aed;">${escapeHtml(item.booking_id)}</strong></td>
                                <td><strong>${escapeHtml(item.patient_name)}</strong></td>
                                <td>${escapeHtml(item.patient_id || "--")}</td>
                                <td>${getStatusBadgeHtml(item.status)}</td>
                                <td>${getResultBadgeHtml(item.result_status)}</td>
                                <td>${formatRelativeOrDate(item.booking_time)}</td>
                                <td>${item.estimated_wait_minutes !== null && item.estimated_wait_minutes !== undefined ? `${item.estimated_wait_minutes} min` : "--"}</td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="jumpToTrackBooking('${item.booking_id}')">Track</button>
                                </td>
                            </tr>
                        `;
                        })
                        .join("");
                }
            }

            if (notify) showToast(`Queue updated: ${q.total_active} active bookings`, "info");
        } else {
            showToast(response.message || "Failed to load test queue", "error");
        }
    } catch (err) {
        console.error("Queue fetch error:", err);
        showToast("Error retrieving queue information", "error");
    }
}

/**
 * Load Facility-wide diagnostic queues
 */
async function loadFacilityQueues(facilityId) {
    const heroEl = document.getElementById("test-queue-hero");
    const tableContainer = document.getElementById("test-queue-table-container");
    const emptyPrompt = document.getElementById("queue-empty-prompt");
    const facOverview = document.getElementById("facility-queues-overview");
    const gridEl = document.getElementById("facility-queue-cards-grid");

    if (heroEl) heroEl.style.display = "none";
    if (tableContainer) tableContainer.style.display = "none";
    if (emptyPrompt) emptyPrompt.style.display = "none";
    if (facOverview) facOverview.style.display = "block";

    try {
        const response = await getFacilityDiagnosticQueues(facilityId);
        if (response.success && Array.isArray(response.data)) {
            if (gridEl) {
                if (response.data.length === 0) {
                    gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem;">No diagnostic services registered at this facility.</div>`;
                } else {
                    gridEl.innerHTML = response.data
                        .map((q) => {
                            return `
                            <div class="diagnostic-card">
                                <div>
                                    <div class="diag-card-header">
                                        <h3 class="diag-card-title">${escapeHtml(q.diagnostic_name || "Diagnostic Service")}</h3>
                                        <span class="badge badge-queue-pos">${q.waiting_count} in queue</span>
                                    </div>
                                    <div class="diag-card-meta-row">
                                        <div class="diag-meta-item">
                                            <span class="diag-meta-label">Waiting</span>
                                            <span class="diag-meta-val">${q.waiting_count}</span>
                                        </div>
                                        <div class="diag-meta-item">
                                            <span class="diag-meta-label">Serving</span>
                                            <span class="diag-meta-val">${q.in_progress_count}</span>
                                        </div>
                                        <div class="diag-meta-item">
                                            <span class="diag-meta-label">Est. Wait</span>
                                            <span class="diag-meta-val">${q.estimated_wait_minutes || 0} min</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="diag-card-actions">
                                    <button class="btn btn-primary" onclick="inspectSingleQueue('${q.facility_id}', '${q.diagnostic_id}')">View Detailed Queue</button>
                                </div>
                            </div>
                        `;
                        })
                        .join("");
                }
            }
        }
    } catch (err) {
        console.error("Facility queues fetch error:", err);
    }
}

function inspectSingleQueue(facilityId, diagnosticId) {
    const qFac = document.getElementById("queue-filter-facility");
    if (qFac) qFac.value = facilityId;
    populateQueueTestOptions(facilityId);
    const qTest = document.getElementById("queue-filter-test");
    if (qTest) qTest.value = diagnosticId;
    loadQueueForTest(diagnosticId);
}

function jumpToQueueTab(facilityId, diagnosticId) {
    switchTab("queues");
    inspectSingleQueue(facilityId, diagnosticId);
}

function jumpToTrackBooking(bookingId) {
    switchTab("bookings");
    const input = document.getElementById("input-track-booking-id");
    if (input) input.value = bookingId;
    trackBooking(bookingId);
}

/**
 * Track an Individual Diagnostic Booking in Real Time
 */
async function trackBooking(bookingId, notify = true) {
    diagnosticsState.trackedBookingId = bookingId;
    const resultBox = document.getElementById("tracking-result-box");

    try {
        const [posResp, bookingResp] = await Promise.all([
            getDiagnosticBookingQueuePosition(bookingId),
            getDiagnosticBookingById(bookingId),
        ]);

        if (!posResp.success && !bookingResp.success) {
            showToast(`Diagnostic booking '${bookingId}' not found`, "error");
            if (resultBox) resultBox.style.display = "none";
            return;
        }

        const pos = posResp.success ? posResp.data : null;
        const b = bookingResp.success ? bookingResp.data : pos;

        if (resultBox) resultBox.style.display = "block";

        document.getElementById("track-patient-name").textContent = b.patient_name || "Patient";
        const diagName = b.diagnostic_name || pos?.diagnostic_name || b.diagnostic_id;
        const facName = b.facility_name || pos?.facility_name || (diagnosticsState.facilityMap[b.facility_id]?.name) || b.facility_id;
        document.getElementById("track-test-and-facility").textContent = `${diagName} • ${facName}`;

        document.getElementById("track-booking-status-badge").innerHTML = getStatusBadgeHtml(b.status);
        document.getElementById("track-result-status-badge").innerHTML = getResultBadgeHtml(b.result_status);

        // Update Timeline
        updateLifecycleTimeline(b.status);

        // Update Metrics
        const qPos = pos?.queue_position;
        const qPosEl = document.getElementById("track-queue-pos");
        if (qPosEl) {
            if (qPos === 0) {
                qPosEl.textContent = "Serving Now";
                qPosEl.style.color = "#0284c7";
            } else if (qPos > 0) {
                qPosEl.textContent = `Rank #${qPos}`;
                qPosEl.style.color = "#7c3aed";
            } else {
                qPosEl.textContent = b.status === "COMPLETED" ? "Completed" : "--";
                qPosEl.style.color = "#64748b";
            }
        }

        document.getElementById("track-people-ahead").textContent = pos?.people_ahead !== null && pos?.people_ahead !== undefined ? `${pos.people_ahead} Ahead` : (qPos === 0 ? "0 Ahead" : "--");
        document.getElementById("track-est-wait").textContent = pos?.estimated_wait_minutes !== null && pos?.estimated_wait_minutes !== undefined ? `~${pos.estimated_wait_minutes} mins` : "--";

        // Decoupled Result Status text
        const isResAvail = b.result_status === "AVAILABLE";
        const resTextEl = document.getElementById("track-result-state-text");
        const resLblEl = document.getElementById("track-result-time-lbl");
        const calloutEl = document.getElementById("track-result-callout");
        const calloutText = document.getElementById("track-callout-text");

        if (resTextEl) {
            resTextEl.textContent = isResAvail ? "✓ AVAILABLE" : "⏳ PENDING";
            resTextEl.style.color = isResAvail ? "#16a34a" : "#d97706";
        }

        if (resLblEl) {
            resLblEl.textContent = isResAvail && b.result_available_time ? `Ready since ${formatDate(b.result_available_time)}` : "Laboratory Result";
        }

        if (calloutEl && calloutText) {
            calloutEl.classList.toggle("available", isResAvail);
            if (isResAvail) {
                calloutText.innerHTML = `<strong>Result is Ready:</strong> Lab report generated and authorized for clinical review at ${formatDate(b.result_available_time)}.`;
            } else {
                calloutText.innerHTML = `<strong>Important Notice:</strong> Test execution lifecycle (COMPLETED) does not automatically mean lab results are finalized. The result remains in analysis until released.`;
            }
        }

        if (notify) showToast(`Live queue position updated for ${bookingId}`, "success");
    } catch (err) {
        console.error("Tracking lookup error:", err);
        showToast("Error retrieving real-time tracking details", "error");
    }
}

/**
 * Update the visual step tracker for a booking's lifecycle
 */
function updateLifecycleTimeline(currentStatus) {
    const steps = ["requested", "booked", "in_progress", "completed"];
    const statusOrder = {
        REQUESTED: 0,
        BOOKED: 1,
        IN_PROGRESS: 2,
        COMPLETED: 3,
        CANCELLED: -1,
        FAILED: -1,
    };

    const currentRank = statusOrder[currentStatus] ?? 0;

    steps.forEach((stepKey, idx) => {
        const stepEl = document.getElementById(`step-${stepKey}`);
        if (!stepEl) return;

        stepEl.className = "lifecycle-step";
        if (currentStatus === "CANCELLED" || currentStatus === "FAILED") {
            if (idx === 0) stepEl.classList.add("cancelled");
        } else {
            if (idx < currentRank) {
                stepEl.classList.add("completed");
            } else if (idx === currentRank) {
                stepEl.classList.add("active");
            }
        }
    });
}

/**
 * Load list of diagnostic bookings
 */
async function loadBookings() {
    try {
        const filters = {};
        if (diagnosticsState.bookingFilters.status) filters.status = diagnosticsState.bookingFilters.status;
        if (diagnosticsState.bookingFilters.result_status) filters.result_status = diagnosticsState.bookingFilters.result_status;
        if (diagnosticsState.bookingFilters.facility_id) filters.facility_id = diagnosticsState.bookingFilters.facility_id;

        const response = await fetchDiagnosticBookings(filters);
        if (response.success && Array.isArray(response.data)) {
            diagnosticsState.bookings = response.data;
            renderBookingsTable();
        }
    } catch (err) {
        console.error("Bookings load error:", err);
    }
}

/**
 * Render Bookings Management Table
 */
function renderBookingsTable() {
    let list = diagnosticsState.bookings;
    const search = diagnosticsState.bookingFilters.patient_search;

    if (search) {
        list = list.filter(
            (b) =>
                b.id.toLowerCase().includes(search) ||
                b.patient_name.toLowerCase().includes(search) ||
                (b.patient_id && b.patient_id.toLowerCase().includes(search)) ||
                (b.diagnostic_name && b.diagnostic_name.toLowerCase().includes(search))
        );
    }

    const tbody = document.getElementById("bookings-table-tbody");
    const emptyState = document.getElementById("bookings-empty-state");

    if (list.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        if (tbody) tbody.innerHTML = "";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    if (tbody) {
        tbody.innerHTML = list
            .map((b) => {
                const diagName = b.diagnostic_name || b.diagnostic_id;
                const facName = b.facility_name || (diagnosticsState.facilityMap[b.facility_id]?.name) || b.facility_id;
                const qPos = b.queue_position;
                const qBadge = qPos === 0 ? `<span class="badge-queue-serving">Serving</span>` : qPos > 0 ? `<span class="badge-queue-pos">#${qPos} in Queue</span>` : `<span style="color:#94a3b8; font-size:0.8rem;">--</span>`;

                return `
                <tr>
                    <td><strong style="font-family: monospace; color: #7c3aed;">${escapeHtml(b.id)}</strong></td>
                    <td>
                        <strong>${escapeHtml(b.patient_name)}</strong>
                        ${b.patient_id ? `<br><small style="color:#94a3b8;">${escapeHtml(b.patient_id)}</small>` : ""}
                    </td>
                    <td>${escapeHtml(diagName)}</td>
                    <td>${escapeHtml(facName)}</td>
                    <td>${getStatusBadgeHtml(b.status)}</td>
                    <td>${getResultBadgeHtml(b.result_status)}</td>
                    <td>${qBadge}</td>
                    <td><small style="color:#64748b;">${formatDate(b.booking_time)}</small></td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-secondary" onclick="jumpToTrackBooking('${b.id}')" title="Track Live">Track</button>
                            <button class="btn btn-sm btn-secondary" onclick="openUpdateStatusModal('${b.id}')" title="Transition Lifecycle">State</button>
                            <button class="btn btn-sm btn-primary" onclick="openUpdateResultModal('${b.id}')" title="Update Result">Result</button>
                        </div>
                    </td>
                </tr>
            `;
            })
            .join("");
    }
}

/**
 * Open Update Lifecycle Status Modal
 */
function openUpdateStatusModal(bookingId) {
    const booking = diagnosticsState.bookings.find((b) => b.id === bookingId);
    if (!booking) {
        showToast("Booking not found", "error");
        return;
    }

    diagnosticsState.selectedBooking = booking;
    document.getElementById("modal-status-booking-id").textContent = booking.id;
    document.getElementById("modal-status-patient-name").textContent = booking.patient_name;
    document.getElementById("modal-status-current-badge").innerHTML = getStatusBadgeHtml(booking.status);

    const nextSelect = document.getElementById("modal-select-next-status");
    const allowed = VALID_BOOKING_TRANSITIONS[booking.status] || [];

    if (nextSelect) {
        if (allowed.length === 0) {
            nextSelect.innerHTML = `<option value="" disabled>Terminal state reached (${booking.status}) - No transitions allowed</option>`;
        } else {
            nextSelect.innerHTML = allowed.map((s) => `<option value="${s}">${s}</option>`).join("");
        }
    }

    const notesInput = document.getElementById("modal-status-notes");
    if (notesInput) notesInput.value = "";

    openModal("modal-update-status");
}

/**
 * Handle Lifecycle Status Transition Submit
 */
async function handleStatusUpdateSubmit(e) {
    e.preventDefault();
    const booking = diagnosticsState.selectedBooking;
    if (!booking) return;

    const nextStatus = document.getElementById("modal-select-next-status")?.value;
    const notes = document.getElementById("modal-status-notes")?.value.trim() || null;

    if (!nextStatus) {
        showToast("Please select a target status", "error");
        return;
    }

    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline mode: Booking status transitions require server connectivity.", "warning");
        return;
    }

    const submitBtn = document.getElementById("btn-submit-status-update");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";
    }

    try {
        const response = await updateDiagnosticBookingStatus(booking.id, nextStatus, notes);
        if (response.success) {
            closeModal("modal-update-status");
            showToast(`Booking ${booking.id} transitioned to ${nextStatus}`, "success");
            await loadBookings();
            if (diagnosticsState.trackedBookingId === booking.id) {
                trackBooking(booking.id, false);
            }
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to update booking status", "error");
        }
    } catch (err) {
        console.error("Status update error:", err);
        showToast("Error updating booking status", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Apply Transition";
        }
    }
}

/**
 * Open Update Result Status Modal
 */
function openUpdateResultModal(bookingId) {
    const booking = diagnosticsState.bookings.find((b) => b.id === bookingId);
    if (!booking) {
        showToast("Booking not found", "error");
        return;
    }

    diagnosticsState.selectedBooking = booking;
    document.getElementById("modal-result-booking-id").textContent = booking.id;
    document.getElementById("modal-result-current-badge").innerHTML = getResultBadgeHtml(booking.result_status);

    const resultSelect = document.getElementById("modal-select-result-status");
    if (resultSelect) {
        resultSelect.value = booking.result_status === "AVAILABLE" ? "AVAILABLE" : "AVAILABLE";
    }

    const notesInput = document.getElementById("modal-result-notes");
    if (notesInput) notesInput.value = "";

    openModal("modal-update-result");
}

/**
 * Handle Result Status Submit
 */
async function handleResultUpdateSubmit(e) {
    e.preventDefault();
    const booking = diagnosticsState.selectedBooking;
    if (!booking) return;

    const targetResultStatus = document.getElementById("modal-select-result-status")?.value;
    const notes = document.getElementById("modal-result-notes")?.value.trim() || null;

    if (!targetResultStatus) {
        showToast("Please select a result status", "error");
        return;
    }

    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline mode: Diagnostic result updates require server connectivity.", "warning");
        return;
    }

    const submitBtn = document.getElementById("btn-submit-result-update");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
    }

    try {
        const response = await updateDiagnosticResultStatus(booking.id, targetResultStatus, notes);
        if (response.success) {
            closeModal("modal-update-result");
            showToast(`Result status for ${booking.id} updated to ${targetResultStatus}`, "success");
            await loadBookings();
            if (diagnosticsState.trackedBookingId === booking.id) {
                trackBooking(booking.id, false);
            }
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to update result status", "error");
        }
    } catch (err) {
        console.error("Result update error:", err);
        showToast("Error updating result status", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Result Status";
        }
    }
}

/**
 * Update top overview statistics numbers
 */
function updateStatsBar() {
    const totalTests = diagnosticsState.diagnostics.length;
    const availableTests = diagnosticsState.diagnostics.filter((t) => t.is_available).length;
    const queuedCount = diagnosticsState.bookings.filter((b) => b.status === "REQUESTED" || b.status === "BOOKED").length;
    const inProgressCount = diagnosticsState.bookings.filter((b) => b.status === "IN_PROGRESS").length;
    const resultsReadyCount = diagnosticsState.bookings.filter((b) => b.result_status === "AVAILABLE").length;

    document.getElementById("stat-total-tests").textContent = totalTests;
    document.getElementById("stat-available-tests").textContent = availableTests;
    document.getElementById("stat-waiting-queue").textContent = queuedCount;
    document.getElementById("stat-in-progress").textContent = inProgressCount;
    document.getElementById("stat-results-ready").textContent = resultsReadyCount;
}

// Modal Open/Close Helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
}

// Toast Notifications
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Formatting & Badge Helpers
function getStatusBadgeHtml(status) {
    switch (status) {
        case "REQUESTED":
            return `<span class="badge badge-created">REQUESTED</span>`;
        case "BOOKED":
            return `<span class="badge badge-accepted">BOOKED</span>`;
        case "IN_PROGRESS":
            return `<span class="badge badge-in-progress">IN PROGRESS</span>`;
        case "COMPLETED":
            return `<span class="badge badge-completed">✓ COMPLETED</span>`;
        case "CANCELLED":
            return `<span class="badge badge-failed">✕ CANCELLED</span>`;
        case "FAILED":
            return `<span class="badge badge-failed">FAILED</span>`;
        default:
            return `<span class="badge badge-neutral">${escapeHtml(status || "UNKNOWN")}</span>`;
    }
}

function getResultBadgeHtml(resultStatus) {
    if (resultStatus === "AVAILABLE") {
        return `<span class="badge-result-available">Result: AVAILABLE</span>`;
    }
    return `<span class="badge-result-pending">Result: PENDING</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
