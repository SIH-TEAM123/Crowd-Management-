/**
 * Facility Discovery & Crowd-Aware Routing Frontend Controller
 * Integrates with FastAPI Backend (/facilities/recommend, /facilities/{id}/operational-state)
 */

document.addEventListener("DOMContentLoaded", () => {
    initFacilitiesPage();
});

// State Store
const facilitiesState = {
    facilities: [],
    facilityMap: {},
    recommendations: [],
    operationalStates: {},
    selectedFacility: null,
    activeTab: "recommend", // 'recommend' | 'directory'
    recommendViewMode: "cards", // 'cards' | 'comparison'
    selectedPriority: "ROUTINE", // 'ROUTINE' | 'URGENT' | 'EMERGENCY'
    lastQueryCriteria: null,
    userGps: {
        latitude: null,
        longitude: null,
    },
    directoryFilters: {
        search: "",
        facilityType: "",
    },
    isLoading: false,
};

/**
 * Initialize page components, auth display, and initial data fetch
 */
async function initFacilitiesPage() {
    setupAuthDisplay();
    setupEventListeners();
    await loadFacilities();
    await loadDirectoryOperationalStates();

    // Check query params for deep linking (e.g. ?specialization=Cardiology or ?facility_id=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const specParam = urlParams.get("specialization");
    const diagParam = urlParams.get("diagnostic");
    const medParam = urlParams.get("medicine");
    const facIdParam = urlParams.get("facility_id");
    const prioParam = urlParams.get("priority");
    const tabParam = urlParams.get("tab");

    if (tabParam) {
        switchTab(tabParam);
    }

    if (prioParam && ["ROUTINE", "URGENT", "EMERGENCY"].includes(prioParam.toUpperCase())) {
        selectPriority(prioParam.toUpperCase());
    }

    if (specParam) document.getElementById("req-specialization").value = specParam;
    if (diagParam) document.getElementById("req-diagnostic").value = diagParam;
    if (medParam) document.getElementById("req-medicine").value = medParam;

    if (facIdParam) {
        openFacilityDetailsModal(facIdParam);
    } else if (specParam || diagParam || medParam) {
        // Auto execute recommendation query if parameters provided
        executeRoutingRecommendation();
    }
}

/**
 * Setup user profile display
 */
function setupAuthDisplay() {
    const userEmail = localStorage.getItem("userEmail") || "admin@hospital.gov";
    const initials = userEmail.substring(0, 2).toUpperCase();
    const initialsEl = document.getElementById("user-initials");
    if (initialsEl) initialsEl.textContent = initials;
}

/**
 * Setup event listeners for forms, buttons, tabs, and filters
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
            showToast("Refreshing facility operational states and routing data...", "info");
            await loadFacilities();
            await loadDirectoryOperationalStates();
            if (facilitiesState.recommendations.length > 0) {
                await executeRoutingRecommendation();
            }
            showToast("Data refreshed successfully.", "success");
        });
    }

    // 3. Priority Selector Pills
    document.querySelectorAll(".priority-pill-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const prio = btn.getAttribute("data-priority");
            selectPriority(prio);
        });
    });

    // 4. Geolocation Trigger
    const gpsBtn = document.getElementById("btn-use-routing-gps");
    if (gpsBtn) {
        gpsBtn.addEventListener("click", useBrowserGeolocation);
    }

    // 5. Routing Form Submission
    const routingForm = document.getElementById("form-facility-routing");
    if (routingForm) {
        routingForm.addEventListener("submit", (e) => {
            e.preventDefault();
            executeRoutingRecommendation();
        });
    }

    // 6. Reset Routing Form
    const resetBtn = document.getElementById("btn-reset-routing-form");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            routingForm.reset();
            selectPriority("ROUTINE");
            facilitiesState.userGps = { latitude: null, longitude: null };
            document.getElementById("routing-gps-label").textContent = "GPS";
            document.getElementById("routing-results-header").style.display = "none";
            document.getElementById("recommendations-container").innerHTML = "";
            document.getElementById("comparison-table-container").style.display = "none";
            document.getElementById("routing-empty").style.display = "none";
            facilitiesState.recommendations = [];
        });
    }

    // 7. Recommendation View Toggle (Cards vs Comparison Table)
    const btnCards = document.getElementById("btn-recommend-view-cards");
    const btnComparison = document.getElementById("btn-recommend-view-comparison");
    if (btnCards) btnCards.addEventListener("click", () => switchRecommendViewMode("cards"));
    if (btnComparison) btnComparison.addEventListener("click", () => switchRecommendViewMode("comparison"));

    // 8. Directory Filters
    const dirSearch = document.getElementById("directory-search");
    const dirType = document.getElementById("directory-filter-type");
    const btnRefreshTel = document.getElementById("btn-refresh-telemetry");

    let dirDebounce = null;
    if (dirSearch) {
        dirSearch.addEventListener("input", (e) => {
            clearTimeout(dirDebounce);
            dirDebounce = setTimeout(() => {
                facilitiesState.directoryFilters.search = e.target.value.trim().toLowerCase();
                renderDirectoryGrid();
            }, 250);
        });
    }

    if (dirType) {
        dirType.addEventListener("change", (e) => {
            facilitiesState.directoryFilters.facilityType = e.target.value;
            renderDirectoryGrid();
        });
    }

    if (btnRefreshTel) {
        btnRefreshTel.addEventListener("click", async () => {
            showToast("Refreshing live operational telemetry across facilities...", "info");
            await loadDirectoryOperationalStates();
            showToast("Telemetry updated.", "success");
        });
    }

    // 9. Modal Refresh Telemetry Button
    const btnModalRef = document.getElementById("btn-modal-refresh-telemetry");
    if (btnModalRef) {
        btnModalRef.addEventListener("click", () => {
            if (facilitiesState.selectedFacility) {
                fetchAndRenderModalTelemetry(facilitiesState.selectedFacility.id);
            }
        });
    }

    // 10. Modal Close Buttons
    document.getElementById("btn-close-fac-modal")?.addEventListener("click", () => closeModal("modal-facility-details"));
    document.getElementById("btn-close-fac-modal-btn")?.addEventListener("click", () => closeModal("modal-facility-details"));

    document.querySelectorAll(".modal-overlay").forEach((modal) => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });
}

/**
 * Switch Active Page Tab
 */
function switchTab(tabName) {
    facilitiesState.activeTab = tabName;

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });

    document.querySelectorAll(".tab-content").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
}

/**
 * Switch Recommendation View Mode (Cards vs Comparison Table)
 */
function switchRecommendViewMode(mode) {
    facilitiesState.recommendViewMode = mode;
    const btnCards = document.getElementById("btn-recommend-view-cards");
    const btnComp = document.getElementById("btn-recommend-view-comparison");
    const cardsContainer = document.getElementById("recommendations-container");
    const compContainer = document.getElementById("comparison-table-container");

    if (btnCards) btnCards.classList.toggle("active", mode === "cards");
    if (btnComp) btnComp.classList.toggle("active", mode === "comparison");

    if (cardsContainer && compContainer) {
        if (mode === "cards") {
            cardsContainer.style.display = "flex";
            compContainer.style.display = "none";
        } else {
            cardsContainer.style.display = "none";
            compContainer.style.display = "block";
        }
    }
}

/**
 * Handle Priority Pill Selection
 */
function selectPriority(priority) {
    facilitiesState.selectedPriority = priority;
    document.querySelectorAll(".priority-pill-btn").forEach((btn) => {
        const isMatch = btn.getAttribute("data-priority") === priority;
        btn.classList.toggle("active", isMatch);

        // Visual emphasis styling
        if (isMatch) {
            if (priority === "EMERGENCY") {
                btn.style.background = "#fef2f2";
                btn.style.color = "#dc2626";
                btn.style.borderColor = "#f87171";
            } else if (priority === "URGENT") {
                btn.style.background = "#fffbeb";
                btn.style.color = "#d97706";
                btn.style.borderColor = "#fde68a";
            } else {
                btn.style.background = "#eff6ff";
                btn.style.color = "#2563eb";
                btn.style.borderColor = "#bfdbfe";
            }
        } else {
            btn.style.background = "";
            btn.style.color = "";
            btn.style.borderColor = "";
        }
    });
}

/**
 * Fetch and cache network facilities
 */
async function loadFacilities() {
    try {
        const response = await fetchFacilities(true);
        if (response.success && Array.isArray(response.data)) {
            facilitiesState.facilities = response.data;
            facilitiesState.facilityMap = {};
            response.data.forEach((fac) => {
                facilitiesState.facilityMap[fac.id] = fac;
            });
            if (response.fromCache) {
                showOfflineStaleBanner('req-source-facility', response.lastSyncedAt);
            } else {
                hideOfflineStaleBanner();
            }
            populateSourceFacilityDropdown();
            updateStatsBar();
        }
    } catch (err) {
        console.error("Error loading facilities:", err);
    }
}

/**
 * Populate Source Facility dropdown select
 */
function populateSourceFacilityDropdown() {
    const select = document.getElementById("req-source-facility");
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = `<option value="">-- None (Patient Origin) --</option>`;

    facilitiesState.facilities.forEach((fac) => {
        const opt = document.createElement("option");
        opt.value = fac.id;
        opt.textContent = `${fac.name} (${formatFacilityTier(fac.facility_type)})`;
        select.appendChild(opt);
    });

    if (currentVal && facilitiesState.facilityMap[currentVal]) {
        select.value = currentVal;
    }
}

/**
 * Execute Facility Recommendation Query (POST /facilities/recommend)
 */
async function executeRoutingRecommendation() {
    const spec = document.getElementById("req-specialization").value.trim() || null;
    const diag = document.getElementById("req-diagnostic").value.trim() || null;
    const med = document.getElementById("req-medicine").value.trim() || null;
    const facType = document.getElementById("req-facility-type").value || null;
    const srcFac = document.getElementById("req-source-facility").value || null;
    const maxDistVal = document.getElementById("req-max-dist").value;
    const limitVal = parseInt(document.getElementById("req-limit").value, 10) || 10;
    const latVal = parseFloat(document.getElementById("req-lat").value);
    const lonVal = parseFloat(document.getElementById("req-lon").value);

    const hasLat = !isNaN(latVal);
    const hasLon = !isNaN(lonVal);

    if ((hasLat && !hasLon) || (!hasLat && hasLon)) {
        showToast("Both latitude and longitude must be provided together.", "warning");
        return;
    }

    const hasCriteria = spec || diag || med || facType || (hasLat && hasLon);
    if (!hasCriteria) {
        showToast("Please specify at least one search criterion: specialist, diagnostic, medicine, tier, or GPS coordinates.", "warning");
        return;
    }

    const payload = {
        priority: facilitiesState.selectedPriority,
        limit: limitVal,
    };

    if (spec) payload.required_specialization = spec;
    if (diag) payload.required_diagnostic = diag;
    if (med) payload.required_medicine = med;
    if (facType) payload.required_facility_type = facType;
    if (srcFac) payload.source_facility_id = srcFac;
    if (hasLat && hasLon) {
        payload.latitude = latVal;
        payload.longitude = lonVal;
    }
    if (maxDistVal) payload.max_distance_km = parseFloat(maxDistVal);

    const loadingEl = document.getElementById("routing-loading");
    const emptyEl = document.getElementById("routing-empty");
    const headerEl = document.getElementById("routing-results-header");
    const cardsContainer = document.getElementById("recommendations-container");
    const compContainer = document.getElementById("comparison-table-container");

    if (loadingEl) loadingEl.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "none";
    if (headerEl) headerEl.style.display = "none";
    if (cardsContainer) cardsContainer.innerHTML = "";

    try {
        const isOffline = (window.Connectivity && window.Connectivity.isOffline()) || !navigator.onLine;
        if (isOffline) {
            facilitiesState.recommendations = [];
            if (cardsContainer) {
                cardsContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; width: 100%;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📡</div>
                        <h3 style="font-size: 1.1rem; color: #1e293b; margin-bottom: 0.5rem;">Live Facility Recommendation Unavailable Offline</h3>
                        <p style="color: #64748b; font-size: 0.85rem; max-width: 480px; margin: 0 auto 1rem;">
                            Live AI crowd-aware routing calculations require active backend connectivity. Showing previously viewed facilities in the Directory.
                        </p>
                        <button class="btn-primary" onclick="switchTab('directory')" style="display: inline-block; cursor:pointer;">Browse Cached Facility Directory</button>
                    </div>
                `;
            }
            if (headerEl) headerEl.style.display = "flex";
            updateStatsBar();
            return;
        }

        const response = await recommendFacilities(payload);
        if (response.success && response.data) {
            const data = response.data;
            facilitiesState.recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
            facilitiesState.lastQueryCriteria = data.query_criteria || payload;

            // Fetch live operational state telemetry for all recommended facilities
            await preloadOperationalStatesForRecommendations(facilitiesState.recommendations);

            renderRecommendations();
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to calculate facility recommendations.", "error");
            facilitiesState.recommendations = [];
            renderRecommendations();
        }
    } catch (err) {
        console.error("Error executing facility routing:", err);
        showToast("Error connecting to facility routing engine.", "error");
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

/**
 * Preload real-time operational states for recommended candidates
 */
async function preloadOperationalStatesForRecommendations(recommendations) {
    const promises = recommendations.map(async (rec) => {
        try {
            const res = await getFacilityOperationalState(rec.facility_id);
            if (res.success && res.data) {
                facilitiesState.operationalStates[rec.facility_id] = res.data;
            }
        } catch (e) {
            console.warn(`Could not fetch operational state for ${rec.facility_id}:`, e);
        }
    });

    await Promise.allSettled(promises);
}

/**
 * Render Ranked Recommendations (Cards and Comparison Table)
 */
function renderRecommendations() {
    const headerEl = document.getElementById("routing-results-header");
    const matchesCountEl = document.getElementById("routing-matches-count");
    const criteriaEchoEl = document.getElementById("routing-criteria-echo");
    const cardsContainer = document.getElementById("recommendations-container");
    const compBody = document.getElementById("comparison-table-body");
    const emptyEl = document.getElementById("routing-empty");

    const recommendations = facilitiesState.recommendations;

    if (!recommendations || recommendations.length === 0) {
        if (headerEl) headerEl.style.display = "none";
        if (cardsContainer) cardsContainer.innerHTML = "";
        if (compBody) compBody.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (headerEl) headerEl.style.display = "flex";
    if (matchesCountEl) matchesCountEl.textContent = `${recommendations.length} feasible facility(ies)`;

    // Echo query criteria
    if (criteriaEchoEl && facilitiesState.lastQueryCriteria) {
        const c = facilitiesState.lastQueryCriteria;
        const parts = [];
        parts.push(`Priority: <strong>${c.priority || "ROUTINE"}</strong>`);
        if (c.required_specialization) parts.push(`Specialist: <strong>${escapeHtml(c.required_specialization)}</strong>`);
        if (c.required_diagnostic) parts.push(`Diagnostic: <strong>${escapeHtml(c.required_diagnostic)}</strong>`);
        if (c.required_medicine) parts.push(`Medicine: <strong>${escapeHtml(c.required_medicine)}</strong>`);
        if (c.required_facility_type) parts.push(`Tier: <strong>${formatFacilityTier(c.required_facility_type)}</strong>`);
        if (c.max_distance_km) parts.push(`Max Distance: <strong>${c.max_distance_km} km</strong>`);
        criteriaEchoEl.innerHTML = parts.join(" • ");
    }

    // 1. Render Ranked Cards
    cardsContainer.innerHTML = recommendations.map((rec, idx) => createRecommendationCardHtml(rec, idx + 1)).join("");

    // 2. Render Side-by-Side Comparison Table
    if (compBody) {
        compBody.innerHTML = recommendations.map((rec, idx) => createComparisonTableRowHtml(rec, idx + 1)).join("");
    }

    // Maintain active view mode
    switchRecommendViewMode(facilitiesState.recommendViewMode);
}

/**
 * Generate HTML for an individual Recommendation Card
 */
function createRecommendationCardHtml(rec, rank) {
    const isTopRank = rank === 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : "";
    const scoreVal = typeof rec.suitability_score === "number" ? rec.suitability_score.toFixed(1) : "--";

    // Distance Badge
    const distanceDisplay = rec.distance_km !== null && rec.distance_km !== undefined
        ? `<span class="distance-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${rec.distance_km.toFixed(1)} km away
           </span>`
        : `<span class="dosage-chip">Network Distance</span>`;

    // Matched Requirement Pills
    const reqPills = Array.isArray(rec.matched_requirements) && rec.matched_requirements.length > 0
        ? rec.matched_requirements.map((req) => `
            <span class="req-match-pill">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ${escapeHtml(req)}
            </span>
        `).join("")
        : `<span class="req-match-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> General Healthcare Services Available</span>`;

    // Operational Telemetry Mini-Bar
    const opState = facilitiesState.operationalStates[rec.facility_id];
    let telemetryBar = "";
    if (opState) {
        const crowdText = opState.current_crowd !== null && opState.current_crowd !== undefined
            ? `${opState.current_crowd} people`
            : `<span class="null-state">Telemetry unavail.</span>`;

        const queueText = opState.queue_length !== null && opState.queue_length !== undefined
            ? `${opState.queue_length} patients`
            : `<span class="null-state">No active queue</span>`;

        const waitText = opState.predicted_wait !== null && opState.predicted_wait !== undefined
            ? `~${Math.round(opState.predicted_wait)} mins`
            : `<span class="null-state">Prediction unavail.</span>`;

        const emText = opState.emergency_load !== null && opState.emergency_load !== undefined
            ? `Score ${opState.emergency_load.toFixed(1)}`
            : `<span class="null-state">None</span>`;

        telemetryBar = `
            <div class="operational-telemetry-grid">
                <div class="telemetry-cell">
                    <span class="telemetry-lbl">Live Crowd (Vision)</span>
                    <span class="telemetry-val">${crowdText}</span>
                </div>
                <div class="telemetry-cell">
                    <span class="telemetry-lbl">Active Queue</span>
                    <span class="telemetry-val">${queueText}</span>
                </div>
                <div class="telemetry-cell">
                    <span class="telemetry-lbl">Predicted Wait</span>
                    <span class="telemetry-val">${waitText}</span>
                </div>
                <div class="telemetry-cell">
                    <span class="telemetry-lbl">Emergency Load</span>
                    <span class="telemetry-val">${emText}</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="recommendation-card ${isTopRank ? "rank-top" : ""}" id="rec-card-${escapeHtml(rec.facility_id)}">
            <div class="recommendation-card-header">
                <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
                    <div class="rank-badge ${rankClass}">#${rank}</div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">${escapeHtml(rec.facility_name)}</h3>
                            <span class="dosage-chip" style="font-weight: 700; color: #6d28d9; background: #faf5ff; border-color: #ede9fe;">${escapeHtml(formatFacilityTier(rec.facility_type))}</span>
                            ${distanceDisplay}
                        </div>
                        <p style="font-size: 0.825rem; color: #64748b; margin-top: 3px;">
                            ${escapeHtml(rec.address || "Main Medical Campus")}
                        </p>
                    </div>
                </div>

                <div class="score-display-box">
                    <span class="score-number">${scoreVal}</span>
                    <span class="score-label">Suitability Score</span>
                </div>
            </div>

            <!-- Matched Requirements -->
            <div class="requirement-pills-row">
                ${reqPills}
            </div>

            <!-- Recommendation Reason Explanation -->
            <div class="recommendation-reason-box">
                <strong>Recommendation Rationale:</strong> ${escapeHtml(rec.recommendation_reason)}
            </div>

            <!-- Live Telemetry Bar -->
            ${telemetryBar}

            <!-- Card Actions -->
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; align-items: center;">
                <button class="btn-outline" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;" onclick="openFacilityDetailsModal('${escapeHtml(rec.facility_id)}')">
                    Inspect Telemetry & Evidence
                </button>
                <a href="referrals.html?dest_facility_id=${encodeURIComponent(rec.facility_id)}" class="btn-primary" style="font-size: 0.8rem; padding: 0.45rem 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                    <span>Create Referral</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for Side-by-Side Comparison Table Row
 */
function createComparisonTableRowHtml(rec, rank) {
    const opState = facilitiesState.operationalStates[rec.facility_id];

    const crowdText = opState && opState.current_crowd !== null && opState.current_crowd !== undefined
        ? `${opState.current_crowd} people`
        : `<span style="color: #94a3b8; font-size: 0.75rem;">N/A</span>`;

    const queueWaitText = opState
        ? `${opState.queue_length !== null ? opState.queue_length + " queued" : "--"} / ${opState.predicted_wait !== null ? Math.round(opState.predicted_wait) + " min" : "--"}`
        : `<span style="color: #94a3b8; font-size: 0.75rem;">--</span>`;

    const emText = opState && opState.emergency_load !== null && opState.emergency_load !== undefined
        ? opState.emergency_load.toFixed(1)
        : `<span style="color: #94a3b8; font-size: 0.75rem;">None</span>`;

    const distText = rec.distance_km !== null && rec.distance_km !== undefined ? `${rec.distance_km.toFixed(1)} km` : "N/A";
    const reqSummary = rec.matched_requirements.length > 0
        ? `${rec.matched_requirements.length} matched`
        : "Standard";

    return `
        <tr>
            <td><div class="rank-badge rank-${rank <= 3 ? rank : ''}" style="width: 26px; height: 26px; font-size: 0.75rem;">#${rank}</div></td>
            <td>
                <strong>${escapeHtml(rec.facility_name)}</strong>
                <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(rec.address || "Campus")}</div>
            </td>
            <td><span class="dosage-chip">${escapeHtml(formatFacilityTier(rec.facility_type))}</span></td>
            <td><strong>${distText}</strong></td>
            <td><strong style="color: #7c3aed; font-size: 1.05rem;">${rec.suitability_score.toFixed(1)}</strong></td>
            <td><span class="badge-stock-in" style="font-size: 0.72rem;">${escapeHtml(reqSummary)}</span></td>
            <td>${crowdText}</td>
            <td>${queueWaitText}</td>
            <td>${emText}</td>
            <td style="text-align: right;">
                <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;" onclick="openFacilityDetailsModal('${escapeHtml(rec.facility_id)}')">
                    Details
                </button>
            </td>
        </tr>
    `;
}

/**
 * Open Detailed Facility Modal and Fetch Live Telemetry
 */
async function openFacilityDetailsModal(facilityId) {
    const fac = facilitiesState.facilityMap[facilityId];
    facilitiesState.selectedFacility = fac || { id: facilityId, name: `Facility (${facilityId})` };

    document.getElementById("modal-fac-name").textContent = fac ? fac.name : facilityId;
    document.getElementById("modal-fac-type-address").textContent = fac ? `${formatFacilityTier(fac.facility_type)} • ${fac.address || "Address on record"}` : "Healthcare Facility";
    document.getElementById("modal-fac-id").textContent = facilityId;
    document.getElementById("modal-fac-tier").textContent = fac ? formatFacilityTier(fac.facility_type) : "--";
    document.getElementById("modal-fac-coords").textContent = fac ? `${fac.latitude.toFixed(4)}, ${fac.longitude.toFixed(4)}` : "--";

    const statusEl = document.getElementById("modal-fac-status");
    if (statusEl) {
        statusEl.innerHTML = fac && fac.is_active
            ? `<span class="badge-stock-in" style="font-size: 0.75rem;">ACTIVE NODE</span>`
            : `<span class="badge-stock-out" style="font-size: 0.75rem;">INACTIVE</span>`;
    }

    openModal("modal-facility-details");
    await fetchAndRenderModalTelemetry(facilityId);
}

/**
 * Fetch and render unified operational state inside modal
 */
async function fetchAndRenderModalTelemetry(facilityId) {
    const loadingEl = document.getElementById("modal-telemetry-loading");
    const contentEl = document.getElementById("modal-telemetry-content");

    if (loadingEl) loadingEl.style.display = "flex";

    try {
        const response = await getFacilityOperationalState(facilityId);
        if (response.success && response.data) {
            const op = response.data;
            facilitiesState.operationalStates[facilityId] = op;

            // Crowd
            const crowdEl = document.getElementById("modal-tel-crowd");
            if (crowdEl) {
                crowdEl.className = "telemetry-val";
                if (op.current_crowd !== null && op.current_crowd !== undefined) {
                    crowdEl.textContent = `${op.current_crowd} persons`;
                } else {
                    crowdEl.className = "telemetry-val null-state";
                    crowdEl.textContent = "Camera telemetry unavailable";
                }
            }

            // Queue
            const queueEl = document.getElementById("modal-tel-queue");
            if (queueEl) {
                queueEl.className = "telemetry-val";
                if (op.queue_length !== null && op.queue_length !== undefined) {
                    const servingStr = op.current_serving !== null ? ` (${op.current_serving} in consultation)` : "";
                    queueEl.textContent = `${op.queue_length} waiting${servingStr}`;
                } else {
                    queueEl.className = "telemetry-val null-state";
                    queueEl.textContent = "No active queue data";
                }
            }

            // Wait
            const waitEl = document.getElementById("modal-tel-wait");
            if (waitEl) {
                waitEl.className = "telemetry-val";
                if (op.predicted_wait !== null && op.predicted_wait !== undefined) {
                    waitEl.textContent = `~${Math.round(op.predicted_wait)} mins`;
                } else {
                    waitEl.className = "telemetry-val null-state";
                    waitEl.textContent = "Prediction unavailable";
                }
            }

            // Emergency
            const emEl = document.getElementById("modal-tel-emergency");
            if (emEl) {
                emEl.className = "telemetry-val";
                if (op.emergency_load !== null && op.emergency_load !== undefined) {
                    emEl.textContent = `Score ${op.emergency_load.toFixed(1)}`;
                } else {
                    emEl.className = "telemetry-val null-state";
                    emEl.textContent = "No active emergency load";
                }
            }

            // Clinical Resources
            document.getElementById("modal-tel-spec").textContent = `${op.specialists_available} available / ${op.specialists_total} registered`;
            document.getElementById("modal-tel-diag").textContent = `${op.diagnostics_available} operational / ${op.diagnostics_total} offerings`;
            document.getElementById("modal-tel-meds").textContent = `${op.medicines_in_stock} in-stock (${op.medicines_out_of_stock} depleted)`;
            document.getElementById("modal-tel-cap").textContent = op.service_capacity !== null ? `${op.service_capacity} patients/hr` : "Standard capacity";

            // Referrals
            document.getElementById("modal-tel-ref-prog").textContent = op.referrals_in_progress;
            document.getElementById("modal-tel-ref-in").textContent = op.referrals_incoming;
            document.getElementById("modal-tel-ref-out").textContent = op.referrals_outgoing;
            document.getElementById("modal-tel-ts").textContent = formatDate(op.timestamp);

            // Audit Sources
            const sourcesEl = document.getElementById("modal-tel-sources");
            if (sourcesEl && op.data_sources && Object.keys(op.data_sources).length > 0) {
                const sourceEntries = Object.entries(op.data_sources).map(([k, v]) => `${k}: ${v}`).join(" • ");
                sourcesEl.textContent = sourceEntries;
            }
        }
    } catch (err) {
        console.error("Error fetching modal operational state:", err);
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

/**
 * Fetch and populate directory tab operational states across all facilities
 */
async function loadDirectoryOperationalStates() {
    const loadingEl = document.getElementById("directory-loading");
    if (loadingEl) loadingEl.style.display = "flex";

    try {
        const response = await getAllFacilitiesOperationalState(true);
        if (response.success && Array.isArray(response.data)) {
            response.data.forEach((op) => {
                facilitiesState.operationalStates[op.facility_id] = op;
            });
            renderDirectoryGrid();
        }
    } catch (err) {
        console.error("Error loading all operational states:", err);
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

/**
 * Render Directory Tab Grid Cards
 */
function renderDirectoryGrid() {
    const gridEl = document.getElementById("directory-grid");
    const emptyEl = document.getElementById("directory-empty");
    if (!gridEl) return;

    const filtered = facilitiesState.facilities.filter((fac) => {
        if (facilitiesState.directoryFilters.search) {
            const q = facilitiesState.directoryFilters.search;
            const nameMatch = (fac.name || "").toLowerCase().includes(q);
            const addrMatch = (fac.address || "").toLowerCase().includes(q);
            const typeMatch = (fac.facility_type || "").toLowerCase().includes(q);
            if (!nameMatch && !addrMatch && !typeMatch) return false;
        }
        if (facilitiesState.directoryFilters.facilityType) {
            if (fac.facility_type !== facilitiesState.directoryFilters.facilityType) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        gridEl.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    gridEl.innerHTML = filtered.map((fac) => createDirectoryCardHtml(fac)).join("");
}

/**
 * Generate HTML for an individual facility card in Directory Tab
 */
function createDirectoryCardHtml(fac) {
    const op = facilitiesState.operationalStates[fac.id];

    const crowdDisplay = op && op.current_crowd !== null && op.current_crowd !== undefined
        ? `<strong style="color: #0f172a;">${op.current_crowd}</strong> people`
        : `<span style="color: #94a3b8; font-style: italic;">No camera feed</span>`;

    const queueDisplay = op && op.queue_length !== null && op.queue_length !== undefined
        ? `<strong style="color: #0f172a;">${op.queue_length}</strong> queued`
        : `<span style="color: #94a3b8; font-style: italic;">No active queue</span>`;

    const waitDisplay = op && op.predicted_wait !== null && op.predicted_wait !== undefined
        ? `~${Math.round(op.predicted_wait)} min wait`
        : `<span style="color: #94a3b8; font-style: italic;">Prediction unavail.</span>`;

    return `
        <div class="medicine-card" id="dir-card-${escapeHtml(fac.id)}">
            <div>
                <div class="medicine-card-header">
                    <div>
                        <h3 class="medicine-brand-name">${escapeHtml(fac.name)}</h3>
                        <div class="medicine-generic-name">
                            ${escapeHtml(fac.address || "Address on record")}
                        </div>
                    </div>
                    <span class="dosage-chip">${escapeHtml(formatFacilityTier(fac.facility_type))}</span>
                </div>

                <div class="medicine-meta-row" style="gap: 0.4rem; font-size: 0.775rem;">
                    <span class="badge-stock-in" style="font-size: 0.7rem;">Active Node</span>
                    <span class="dosage-chip">${fac.latitude.toFixed(3)}, ${fac.longitude.toFixed(3)}</span>
                </div>

                <!-- Operational Mini Stats -->
                <div style="background: #f8fafc; border: 1px solid #ede9fe; border-radius: 8px; padding: 0.75rem; margin-top: 0.75rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 4px;">
                    <div>Live Crowd: ${crowdDisplay}</div>
                    <div>Queue / Wait: ${queueDisplay} • ${waitDisplay}</div>
                    <div>Resources: <strong>${op ? op.specialists_available : 0}</strong> specialists • <strong>${op ? op.medicines_in_stock : 0}</strong> drugs</div>
                </div>
            </div>

            <div class="medicine-card-footer">
                <button class="btn-primary" style="flex: 1; font-size: 0.8rem; padding: 0.55rem 0.75rem;" onclick="openFacilityDetailsModal('${escapeHtml(fac.id)}')">
                    Inspect Operational State
                </button>
            </div>
        </div>
    `;
}

/**
 * Use Browser Geolocation
 */
function useBrowserGeolocation() {
    const label = document.getElementById("routing-gps-label");
    if (!navigator.geolocation) {
        showToast("Geolocation is not supported by your browser.", "warning");
        return;
    }

    if (label) label.textContent = "Detecting...";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = parseFloat(pos.coords.latitude.toFixed(6));
            const lon = parseFloat(pos.coords.longitude.toFixed(6));

            facilitiesState.userGps = { latitude: lat, longitude: lon };

            const latInput = document.getElementById("req-lat");
            const lonInput = document.getElementById("req-lon");
            if (latInput) latInput.value = lat;
            if (lonInput) lonInput.value = lon;

            if (label) label.textContent = "GPS Set";
            showToast(`Patient GPS set: ${lat}, ${lon}`, "success");
        },
        (err) => {
            console.warn("GPS acquire error:", err.message);
            if (label) label.textContent = "GPS";
            showToast("Could not retrieve GPS coordinates. You can enter coordinates manually.", "warning");
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

/**
 * Update top hero statistics bar
 */
function updateStatsBar() {
    const totalFacsEl = document.getElementById("stat-total-network-facilities");
    const activeFacsEl = document.getElementById("stat-active-facilities");
    const avgScoreEl = document.getElementById("stat-avg-suitability");
    const emTierEl = document.getElementById("stat-emergency-tier-count");

    if (totalFacsEl) totalFacsEl.textContent = facilitiesState.facilities.length;
    if (activeFacsEl) activeFacsEl.textContent = facilitiesState.facilities.filter((f) => f.is_active).length;

    const districtHospitals = facilitiesState.facilities.filter((f) => f.facility_type === "DISTRICT_HOSPITAL" || f.facility_type === "district_hospital").length;
    if (emTierEl) emTierEl.textContent = districtHospitals;

    if (facilitiesState.recommendations.length > 0) {
        const topScore = facilitiesState.recommendations[0].suitability_score;
        if (avgScoreEl) avgScoreEl.textContent = `${topScore.toFixed(1)} / 100`;
    } else {
        if (avgScoreEl) avgScoreEl.textContent = "--";
    }
}

/**
 * Utility: Format Facility Tier Enums
 */
function formatFacilityTier(tier) {
    if (!tier) return "Healthcare Facility";
    const str = String(tier).replace(/_/g, " ").toLowerCase();
    return str.replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Toast Notification System
 */
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            ${iconSvg}
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Modal utilities
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
}

/**
 * Utility: Format ISO timestamp
 */
function formatDate(isoString) {
    if (!isoString) return "N/A";
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return isoString;
    }
}

/**
 * Utility: HTML Sanitizer to prevent XSS
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
