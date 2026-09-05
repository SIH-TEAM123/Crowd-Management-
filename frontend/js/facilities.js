
/* ============================================================
   VIZITOR — FACILITIES & ROUTING
   Backend-connected controller.
   IMPORTANT: IDs/classes here match the current facilities.html.
   ============================================================ */

(function () {
    "use strict";

    let facilities = [];
    let operationalStates = [];
    let recommendations = [];
    let selectedPriority = "ROUTINE";
    let recommendationView = "cards";
    let selectedFacilityId = null;

    const $ = (id) => document.getElementById(id);

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        setupPriorityButtons();
        setupTabs();
        setupEventListeners();
        setupSpecializationSelector();
        setupViewToggle();
        setupModal();
        switchTab("recommend");

        await Promise.allSettled([
            loadFacilities(),
            loadOperationalStates()
        ]);

        populateSourceFacilities();
        updateStats();

        // Optional deep links.
        const params = new URLSearchParams(window.location.search);
        const spec = params.get("specialization");
        const diag = params.get("diagnostic");
        const med = params.get("medicine");
        const facilityId = params.get("facility_id");
        const priority = params.get("priority");

        if (spec) setValue("req-specialization", spec);
        if (diag) setValue("req-diagnostic", diag);
        if (med) setValue("req-medicine", med);

        if (priority && ["ROUTINE", "URGENT", "EMERGENCY"].includes(priority.toUpperCase())) {
            selectPriority(priority.toUpperCase());
        }

        if (facilityId) {
            await openFacilityDetails(facilityId);
        } else if (spec || diag || med) {
            await executeRouting();
        }
    }

    /* ============================================================
       EVENTS
       ============================================================ */

    function setupEventListeners() {
        $("form-facility-routing")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            await executeRouting();
        });

        $("btn-reset-routing-form")?.addEventListener("click", resetRoutingForm);
        $("btn-use-routing-gps")?.addEventListener("click", useRoutingGPS);
        $("btn-refresh-telemetry")?.addEventListener("click", refreshTelemetry);

        $("directory-search")?.addEventListener("input", debounce(renderDirectory, 200));
        $("directory-filter-type")?.addEventListener("change", renderDirectory);
    }

    function setupSpecializationSelector() {
        const current = $("req-specialization");
        if (!current) return;

        // Preserve the existing value while upgrading the field to a searchable/selectable control.
        const options = [
            "All Specializations",
            "Cardiology",
            "Dermatology",
            "ENT",
            "Emergency Medicine",
            "General Medicine",
            "Gynecology",
            "Neurology",
            "Obstetrics & Gynecology",
            "Ophthalmology",
            "Orthopedics",
            "Pediatrics",
            "Psychiatry",
            "Radiology"
        ];

        const select = document.createElement("select");
        select.id = "req-specialization";
        select.name = current.name || "required_specialization";
        select.className = current.className || "";
        select.setAttribute("aria-label", "Required Specialist / Specialization");

        const oldValue = String(current.value || "").trim();
        options.forEach((name) => {
            const option = document.createElement("option");
            option.value = name === "All Specializations" ? "" : name;
            option.textContent = name;
            if ((oldValue && option.value.toLowerCase() === oldValue.toLowerCase()) ||
                (!oldValue && option.value === "")) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        current.replaceWith(select);
    }

    function setupPriorityButtons() {
    const priorityButtons = document.querySelectorAll(
        "#btn-prio-routine, #btn-prio-urgent, #btn-prio-emergency"
    );

    priorityButtons.forEach((button) => {
        // Prevent duplicate listeners
        if (button.dataset.priorityBound === "true") return;

        button.dataset.priorityBound = "true";

        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const priority = (
                this.dataset.priority ||
                this.id.replace("btn-prio-", "")
            ).toUpperCase();

            selectPriority(priority);
        });
    });

    selectPriority("ROUTINE");
}

function selectPriority(priority) {
    selectedPriority = String(priority || "ROUTINE").toUpperCase();

    const buttons = [
        $("btn-prio-routine"),
        $("btn-prio-urgent"),
        $("btn-prio-emergency")
    ].filter(Boolean);

    buttons.forEach((button) => {
        const buttonPriority = String(
            button.dataset.priority ||
            button.id.replace("btn-prio-", "")
        ).toUpperCase();

        const active = buttonPriority === selectedPriority;

        button.classList.toggle("active", active);
        button.classList.toggle("selected", active);

        // Supports BOTH versions of your HTML/CSS
        button.setAttribute("aria-pressed", String(active));

        if (active) {
            button.dataset.selected = "true";
        } else {
            delete button.dataset.selected;
        }
    });

    console.log("VIZITOR priority selected:", selectedPriority);
}



    function setupTabs() {
        $("tab-btn-recommend")?.addEventListener("click", () => switchTab("recommend"));
        $("tab-btn-directory")?.addEventListener("click", () => switchTab("directory"));
    }

    function switchTab(name) {
        const isRecommend = name === "recommend";

        $("tab-btn-recommend")?.classList.toggle("active", isRecommend);
        $("tab-btn-directory")?.classList.toggle("active", !isRecommend);

        const recommendPanel = $("tab-recommend");
        const directoryPanel = $("tab-directory");

        recommendPanel?.classList.toggle("active", isRecommend);
        directoryPanel?.classList.toggle("active", !isRecommend);

        // Explicit display wins over the inline display:none in facilities.html.
        if (recommendPanel) recommendPanel.style.display = isRecommend ? "block" : "none";
        if (directoryPanel) directoryPanel.style.display = isRecommend ? "none" : "block";

        $("tab-btn-recommend")?.setAttribute("aria-selected", String(isRecommend));
        $("tab-btn-directory")?.setAttribute("aria-selected", String(!isRecommend));

        if (!isRecommend) {
            renderDirectory();
            loadOperationalStates().catch(() => {});
            showToast("Network facilities and live telemetry opened.", "info");
        }
    }

    function setupViewToggle() {
        $("btn-recommend-view-cards")?.addEventListener("click", () => {
            recommendationView = "cards";
            applyRecommendationView();
        });

        $("btn-recommend-view-comparison")?.addEventListener("click", () => {
            recommendationView = "comparison";
            applyRecommendationView();
        });
    }

    function applyRecommendationView() {
        const cards = $("recommendations-container");
        const comparison = $("comparison-table-container");

        $("btn-recommend-view-cards")?.classList.toggle(
            "active",
            recommendationView === "cards"
        );
        $("btn-recommend-view-comparison")?.classList.toggle(
            "active",
            recommendationView === "comparison"
        );

        if (cards) {
            cards.style.display = recommendationView === "cards" ? "" : "none";
        }

        if (comparison) {
            comparison.style.display = recommendationView === "comparison" ? "" : "none";
        }
    }

    function setupModal() {
        $("btn-close-fac-modal")?.addEventListener("click", closeFacilityModal);
        $("btn-close-fac-modal-btn")?.addEventListener("click", closeFacilityModal);
        $("btn-modal-refresh-telemetry")?.addEventListener(
            "click",
            refreshSelectedFacilityState
        );

        $("modal-facility-details")?.addEventListener("click", (event) => {
            if (event.target === $("modal-facility-details")) {
                closeFacilityModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeFacilityModal();
        });
    }

    /* ============================================================
       FACILITIES + TELEMETRY
       ============================================================ */

    async function loadFacilities() {
        try {
            if (typeof fetchFacilities !== "function") {
                throw new Error("fetchFacilities() is unavailable. Check api.js.");
            }

            const response = await fetchFacilities(true);
            if (response?.success === false) {
                throw new Error(response.message || response.error || "Failed to load facilities.");
            }

            facilities = normalizeArray(response);
            populateSourceFacilities();
            renderDirectory();
            updateStats();
        } catch (error) {
            console.error("Facilities loading failed:", error);
            facilities = [];
            renderDirectoryError(error.message);
        }
    }

    async function loadOperationalStates() {
        try {
            if (typeof getAllFacilitiesOperationalState !== "function") {
                console.warn("getAllFacilitiesOperationalState() unavailable.");
                return;
            }

            const response = await getAllFacilitiesOperationalState(true);
            if (response?.success === false) {
                throw new Error(
                    response.message ||
                    response.error ||
                    "Failed to load operational telemetry."
                );
            }

            operationalStates = normalizeArray(response);
            renderDirectory();
        } catch (error) {
            console.error("Operational telemetry loading failed:", error);
        }
    }

    async function refreshTelemetry() {
        const button = $("btn-refresh-telemetry");
        setButtonLoading(button, true);

        try {
            await Promise.all([
                loadFacilities(),
                loadOperationalStates()
            ]);

            populateSourceFacilities();
            renderDirectory();
            updateStats();
            showToast("Facility telemetry refreshed.", "success");
        } catch (error) {
            console.error(error);
            showToast("Unable to refresh facility telemetry.", "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    function normalizeArray(response) {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.results)) return response.results;
        if (response.data && Array.isArray(response.data.items)) return response.data.items;
        if (response.data && Array.isArray(response.data.results)) return response.data.results;
        return [];
    }

    function getOperationalState(facilityId) {
        return operationalStates.find(
            (state) =>
                String(state?.facility_id ?? state?.facilityId ?? state?.id ?? "") ===
                String(facilityId)
        ) || null;
    }

    /* ============================================================
       ROUTING — POST /facilities/recommend
       ============================================================ */

    async function executeRouting() {
        const payload = buildRoutingPayload();

        if (!validateRoutingPayload(payload)) return;

        const button = $("btn-execute-routing");
        setRoutingLoading(true);

        try {
            if (typeof recommendFacilities !== "function") {
                throw new Error("recommendFacilities() is unavailable. Check api.js.");
            }

            const response = await recommendFacilities(payload);

            if (response?.success === false) {
                throw new Error(
                    response.message ||
                    response.error ||
                    "Facility recommendation failed."
                );
            }

            // api.js returns { success: true, data: {...} }.
            const result = response?.data ?? response;

            recommendations = normalizeRecommendations(result);

            renderRecommendations(result);

            if (recommendations.length) {
                showToast(
                    `${recommendations.length} suitable facility recommendation(s) found.`,
                    "success"
                );
            } else {
                showToast(
                    "No feasible facilities matched the selected criteria.",
                    "info"
                );
            }
        } catch (error) {
            console.error("Facility routing failed:", error);
            recommendations = [];
            showRoutingError(error.message || "Unable to calculate recommendations.");
        } finally {
            setRoutingLoading(false);
        }
    }

    function buildRoutingPayload() {
        const payload = {
            required_specialization: getValue("req-specialization") || null,
            required_diagnostic: getValue("req-diagnostic") || null,
            required_medicine: getValue("req-medicine") || null,
            required_facility_type: getValue("req-facility-type") || null,
            priority: selectedPriority,
            source_facility_id: getValue("req-source-facility") || null,
            max_distance_km: numberOrNull(getValue("req-max-dist")),
            limit: clamp(parseInt(getValue("req-limit") || "10", 10), 1, 100)
        };

        const latitude = numberOrNull(getValue("req-lat"));
        const longitude = numberOrNull(getValue("req-lon"));

        if (latitude !== null || longitude !== null) {
            payload.latitude = latitude;
            payload.longitude = longitude;
        }

        return removeNullValues(payload);
    }

    function validateRoutingPayload(payload) {
        const hasRequirement = Boolean(
            payload.required_specialization ||
            payload.required_diagnostic ||
            payload.required_medicine ||
            payload.required_facility_type
        );

        const hasLat = payload.latitude !== undefined && payload.latitude !== null;
        const hasLon = payload.longitude !== undefined && payload.longitude !== null;

        if (!hasRequirement && !hasLat && !hasLon) {
            showToast(
                "Enter at least one clinical requirement or provide patient GPS coordinates.",
                "warning"
            );
            return false;
        }

        if (hasLat !== hasLon) {
            showToast("Please provide both latitude and longitude.", "warning");
            return false;
        }

        return true;
    }

    function normalizeRecommendations(response) {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (Array.isArray(response.recommendations)) return response.recommendations;
        if (Array.isArray(response.items)) return response.items;
        if (Array.isArray(response.data)) return response.data;
        if (response.data && Array.isArray(response.data.recommendations)) {
            return response.data.recommendations;
        }
        return [];
    }

    /* ============================================================
       RECOMMENDATION RENDERING
       ============================================================ */

    function renderRecommendations(result) {
        const header = $("routing-results-header");
        const empty = $("routing-empty");
        const cards = $("recommendations-container");
        const comparison = $("comparison-table-container");
        const count = $("routing-matches-count");
        const criteria = $("routing-criteria-echo");

        if (header) header.style.display = "flex";

        if (count) {
            const total = Number(result?.total_matches ?? recommendations.length);
            count.textContent = `${total} match${total === 1 ? "" : "es"}`;
        }

        if (criteria) {
            criteria.textContent = buildCriteriaText(result);
        }

        if (!recommendations.length) {
            if (empty) empty.style.display = "block";
            if (cards) cards.innerHTML = "";
            if (comparison) comparison.style.display = "none";
            return;
        }

        if (empty) empty.style.display = "none";

        renderRecommendationCards();
        renderComparisonTable();
        applyRecommendationView();
        updateStatsFromRecommendations();
    }

    function renderRecommendationCards() {
        const container = $("recommendations-container");
        if (!container) return;

        container.innerHTML = recommendations.map((item, index) => {
            const id = item?.facility_id ?? "";
            const name = item?.facility_name ?? "Unnamed Facility";
            const type = formatFacilityType(item?.facility_type);
            const score = formatScore(item?.suitability_score);
            const distance = formatDistance(item?.distance_km);
            const matched = Array.isArray(item?.matched_requirements)
                ? item.matched_requirements
                : [];
            const reason =
                item?.recommendation_reason ||
                "Recommended based on the selected routing criteria.";

            return `
                <article class="facility-recommendation-card">
                    <div class="facility-card-rank">#${index + 1}</div>
                    <div class="facility-card-content">
                        <div class="facility-card-header">
                            <div>
                                <h3>${escapeHtml(name)}</h3>
                                <span class="facility-type">${escapeHtml(type)}</span>
                            </div>
                            <div class="facility-score">${escapeHtml(score)}</div>
                        </div>

                        <div class="facility-meta">
                            <span>Distance <strong>${escapeHtml(distance)}</strong></span>
                        </div>

                        ${
                            matched.length
                                ? `<div class="matched-requirements">
                                    ${matched.map(x =>
                                        `<span class="requirement-chip">${escapeHtml(String(x))}</span>`
                                    ).join("")}
                                   </div>`
                                : ""
                        }

                        <p class="recommendation-reason">${escapeHtml(reason)}</p>

                        <div class="facility-card-actions">
                            <button
                                type="button"
                                class="btn btn-primary"
                                data-facility-id="${escapeHtml(id)}"
                                data-action="details">
                                View Details
                            </button>

                            <button
                                type="button"
                                class="btn btn-secondary facility-route-button"
                                data-facility-id="${escapeHtml(id)}"
                                data-action="route">
                                View Route →
                            </button>

                            <a
                                class="btn btn-secondary"
                                href="referrals.html?dest_facility_id=${encodeURIComponent(id)}">
                                Start Referral
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        container.querySelectorAll("[data-action='details']").forEach((button) => {
            button.addEventListener("click", () => {
                openFacilityDetails(button.dataset.facilityId);
            });
        });

        container.querySelectorAll("[data-action='route']").forEach((button) => {
            button.addEventListener("click", () => {
                openFacilityRoute(button.dataset.facilityId);
            });
        });
    }

    function openFacilityRoute(facilityId) {
        const facility = facilities.find(
            (item) => String(item?.id) === String(facilityId)
        );

        if (!facility) {
            showToast("Route destination is unavailable.", "error");
            return;
        }

        const lat = Number(facility.latitude);
        const lon = Number(facility.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            showToast("This facility does not have valid map coordinates.", "warning");
            return;
        }

        const userLat = Number(getValue("req-lat"));
        const userLon = Number(getValue("req-lon"));

        if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
            showToast("Use My Location first to get a route from your current location.", "warning");
            return;
        }

        const destination = `${lat},${lon}`;
        const origin = `${userLat},${userLon}`;
        const url =
            `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}` +
            `&destination=${encodeURIComponent(destination)}&travelmode=driving`;

        showToast(`Opening route to ${facility.name || "selected facility"}.`, "success");
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function renderComparisonTable() {
        const container = $("comparison-table-container");
        if (!container) return;

        container.innerHTML = `
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Facility</th>
                            <th>Match</th>
                            <th>Distance</th>
                            <th>Matched Requirements</th>
                        </tr>
                    </thead>
                    <tbody id="comparison-table-body"></tbody>
                </table>
            </div>
        `;

        const body = $("comparison-table-body");
        if (!body) return;

        body.innerHTML = recommendations.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item?.facility_name ?? "Unnamed Facility")}</td>
                <td>${escapeHtml(formatScore(item?.suitability_score))}</td>
                <td>${escapeHtml(formatDistance(item?.distance_km))}</td>
                <td>${Array.isArray(item?.matched_requirements)
                    ? item.matched_requirements.length
                    : 0}</td>
            </tr>
        `).join("");
    }

    function buildCriteriaText(result) {
        const criteria = result?.query_criteria || {};
        const parts = [];

        if (criteria.required_specialization) {
            parts.push(`Specialist: ${criteria.required_specialization}`);
        }
        if (criteria.required_diagnostic) {
            parts.push(`Diagnostic: ${criteria.required_diagnostic}`);
        }
        if (criteria.required_medicine) {
            parts.push(`Medicine: ${criteria.required_medicine}`);
        }
        if (criteria.required_facility_type) {
            parts.push(`Tier: ${formatFacilityType(criteria.required_facility_type)}`);
        }
        if (criteria.priority) {
            parts.push(`Priority: ${criteria.priority}`);
        }
        if (criteria.latitude != null && criteria.longitude != null) {
            parts.push("GPS location used");
        }

        return parts.join(" • ");
    }

    /* ============================================================
       DIRECTORY
       ============================================================ */

    function renderDirectory() {
        const grid = $("directory-grid");
        const empty = $("directory-empty");

        if (!grid) return;

        const search = getValue("directory-search").toLowerCase();
        const type = getValue("directory-filter-type");

        const filtered = facilities.filter((facility) => {
            const searchable = [
                facility?.name,
                facility?.address,
                facility?.facility_type,
                facility?.id
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesSearch = !search || searchable.includes(search);
            const matchesType =
                !type ||
                String(facility?.facility_type || facility?.facilityType || "") === type;

            return matchesSearch && matchesType;
        });

        if (!filtered.length) {
            grid.innerHTML = "";
            if (empty) empty.style.display = "block";
            return;
        }

        if (empty) empty.style.display = "none";
        grid.innerHTML = filtered.map(createDirectoryCard).join("");

        grid.querySelectorAll("[data-action='details']").forEach((button) => {
            button.addEventListener("click", () => {
                openFacilityDetails(button.dataset.facilityId);
            });
        });

        grid.querySelectorAll("[data-action='route']").forEach((button) => {
            button.addEventListener("click", () => {
                openFacilityRoute(button.dataset.facilityId);
            });
        });
    }

    function createDirectoryCard(facility) {
        const id = facility?.id ?? "";
        const state = getOperationalState(id);
        const active = facility?.is_active !== false;

        return `
            <article class="facility-directory-card">
                <div class="facility-directory-header">
                    <div>
                        <h3>${escapeHtml(facility?.name ?? "Unnamed Facility")}</h3>
                        <span class="facility-type">
                            ${escapeHtml(formatFacilityType(facility?.facility_type))}
                        </span>
                    </div>
                    <span class="status-badge ${active ? "status-active" : "status-inactive"}">
                        ${active ? "Active" : "Inactive"}
                    </span>
                </div>

                <p class="facility-address">
                    ${escapeHtml(facility?.address ?? "Address unavailable")}
                </p>

                <div class="facility-directory-actions">
                    <button
                        type="button"
                        class="btn btn-primary"
                        data-action="details"
                        data-facility-id="${escapeHtml(id)}">
                        View Details
                    </button>
                    <button
                        type="button"
                        class="btn btn-secondary facility-route-button"
                        data-action="route"
                        data-facility-id="${escapeHtml(id)}">
                        View Route →
                    </button>
                </div>
            </article>
        `;
    }

    function renderDirectoryError(message) {
        const grid = $("directory-grid");
        if (!grid) return;

        grid.innerHTML = `
            <div class="empty-state error-state">
                <h3>Facilities unavailable</h3>
                <p>${escapeHtml(message || "Unable to load facilities.")}</p>
            </div>
        `;
    }

    function populateSourceFacilities() {
        const select = $("req-source-facility");
        if (!select) return;

        const current = select.value;
        select.innerHTML = '<option value="">-- None (Patient Origin) --</option>';

        facilities
            .filter((facility) => facility?.is_active !== false)
            .sort((a, b) =>
                String(a?.name || "").localeCompare(String(b?.name || ""))
            )
            .forEach((facility) => {
                const option = document.createElement("option");
                option.value = facility.id;
                option.textContent =
                    `${facility.name || "Unnamed Facility"} — ${formatFacilityType(facility.facility_type)}`;
                select.appendChild(option);
            });

        if (current && facilities.some((facility) => String(facility.id) === String(current))) {
            select.value = current;
        }
    }

    /* ============================================================
       MODAL
       ============================================================ */

    async function openFacilityDetails(facilityId) {
        const facility = facilities.find(
            (item) => String(item?.id) === String(facilityId)
        );

        if (!facility) {
            showToast("Facility details are unavailable.", "error");
            return;
        }

        selectedFacilityId = facility.id;

        setText("modal-fac-name", facility.name || "Facility Details");
        setText(
            "modal-fac-type-address",
            `${formatFacilityType(facility.facility_type)} • ${facility.address || "Address unavailable"}`
        );
        setText("modal-fac-id", facility.id || "--");
        setText("modal-fac-tier", formatFacilityType(facility.facility_type));
        setText(
            "modal-fac-coords",
            `${formatCoordinate(facility.latitude)}, ${formatCoordinate(facility.longitude)}`
        );

        const status = $("modal-fac-status");
        if (status) {
            status.textContent =
                facility.is_active !== false ? "Active" : "Inactive";
        }

        const modal = $("modal-facility-details");
        if (modal) {
            modal.classList.add("open");
            modal.classList.remove("hidden");
            modal.removeAttribute("hidden");
            modal.classList.add("vizitor-facility-modal");
        }

        await refreshSelectedFacilityState();
    }

    async function refreshSelectedFacilityState() {
        if (!selectedFacilityId) return;

        const loading = $("modal-telemetry-loading");
        const content = $("modal-telemetry-content");

        if (loading) loading.style.display = "none";
        if (content) content.style.opacity = "1";

        /*
         * DEMO-ONLY FACILITY TELEMETRY
         * These values are intentionally presentation data.
         * They do not overwrite or modify backend telemetry.
         */
        const facilityIndex = Math.max(
            0,
            facilities.findIndex(
                (facility) =>
                    String(facility.id) === String(selectedFacilityId)
            )
        );

        const demoProfiles = [
            {
                crowd: "Low",
                queue: "8 patients",
                wait: "11 min",
                emergency: "Available",
                specialists: "6 available",
                diagnostics: "Available",
                medicines: "Available",
                capacity: "42%",
                referralsIn: "2",
                referralsOut: "1",
                referralProgress: "3 active"
            },
            {
                crowd: "Moderate",
                queue: "18 patients",
                wait: "24 min",
                emergency: "Available",
                specialists: "8 available",
                diagnostics: "Available",
                medicines: "Available",
                capacity: "68%",
                referralsIn: "6",
                referralsOut: "3",
                referralProgress: "4 active"
            },
            {
                crowd: "High",
                queue: "34 patients",
                wait: "46 min",
                emergency: "Available",
                specialists: "5 available",
                diagnostics: "Limited",
                medicines: "Available",
                capacity: "86%",
                referralsIn: "11",
                referralsOut: "5",
                referralProgress: "3 active"
            },
            {
                crowd: "Moderate",
                queue: "21 patients",
                wait: "29 min",
                emergency: "Available",
                specialists: "10 available",
                diagnostics: "Available",
                medicines: "Limited",
                capacity: "74%",
                referralsIn: "7",
                referralsOut: "4",
                referralProgress: "5 active"
            },
            {
                crowd: "Low",
                queue: "5 patients",
                wait: "9 min",
                emergency: "Available",
                specialists: "7 available",
                diagnostics: "Available",
                medicines: "Available",
                capacity: "38%",
                referralsIn: "2",
                referralsOut: "1",
                referralProgress: "2 active"
            }
        ];

        const demoState =
            demoProfiles[facilityIndex % demoProfiles.length];

        updateModalTelemetry(demoState);

        const index = facilities.findIndex(
            (facility) =>
                String(facility.id) === String(selectedFacilityId)
        );

        if (index >= 0) {
            facilities[index].operational_state = {
                ...demoState,
                demo: true
            };
        }
    }

    function updateModalTelemetry(state) {
        const safe = state || {};

        setText("modal-tel-crowd", safe.crowd || "Moderate");
        setText("modal-tel-queue", safe.queue || "18 patients");
        setText("modal-tel-wait", safe.wait || "24 min");
        setText("modal-tel-emergency", safe.emergency || "Available");
        setText("modal-tel-spec", safe.specialists || "8 available");
        setText("modal-tel-diag", safe.diagnostics || "Available");
        setText("modal-tel-meds", safe.medicines || "Available");
        setText("modal-tel-cap", safe.capacity || "68%");
        setText("modal-tel-ref-prog", safe.referralProgress || "4 active");
        setText("modal-tel-ref-in", safe.referralsIn || "6");
        setText("modal-tel-ref-out", safe.referralsOut || "3");
        setText("modal-tel-ts", "Demo data • Updated just now");
        setText("modal-tel-sources", "VIZITOR presentation demo");
    }

    function closeFacilityModal() {
        const modal = $("modal-facility-details");
        if (!modal) return;

        modal.classList.remove("open");
        modal.classList.add("hidden");
        modal.setAttribute("hidden", "");
        selectedFacilityId = null;
    }

    /* ============================================================
       GPS
       ============================================================ */

    function useRoutingGPS() {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by this browser.", "error");
            return;
        }

        const button = $("btn-use-routing-gps");
        const label = $("routing-gps-label");

        if (button) button.disabled = true;
        if (label) label.textContent = "Locating…";

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setValue("req-lat", position.coords.latitude.toFixed(6));
                setValue("req-lon", position.coords.longitude.toFixed(6));

                if (label) label.textContent = "GPS";
                if (button) button.disabled = false;

                showToast("Patient location captured.", "success");
            },
            (error) => {
                console.error("Geolocation error:", error);

                if (label) label.textContent = "GPS";
                if (button) button.disabled = false;

                const message =
                    error?.code === 1
                        ? "Location permission was denied."
                        : error?.code === 2
                            ? "Your location could not be determined."
                            : error?.code === 3
                                ? "Location request timed out."
                                : "Unable to determine your location.";

                showToast(message, "error");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }

    /* ============================================================
       RESET / STATS / LOADING
       ============================================================ */

    function resetRoutingForm() {
        $("form-facility-routing")?.reset();
        selectPriority("ROUTINE");
        clearRoutingResults();
        showToast("Routing form reset.", "info");
    }

    function clearRoutingResults() {
        $("routing-results-header") && ($("routing-results-header").style.display = "none");
        $("routing-loading") && ($("routing-loading").style.display = "none");
        $("routing-empty") && ($("routing-empty").style.display = "none");

        if ($("recommendations-container")) {
            $("recommendations-container").innerHTML = "";
        }

        if ($("comparison-table-container")) {
            $("comparison-table-container").style.display = "none";
            $("comparison-table-container").innerHTML = "";
        }

        setText("routing-criteria-echo", "");
        setText("routing-matches-count", "0 matches");

        recommendations = [];
    }

    function setRoutingLoading(loading) {
        const loader = $("routing-loading");
        const button = $("btn-execute-routing");

        if (loader) loader.style.display = loading ? "block" : "none";

        if (button) {
            button.disabled = loading;
            const span = button.querySelector("span");
            if (span) {
                span.textContent = loading
                    ? "Finding Facilities..."
                    : "Find Recommendations";
            }
        }
    }

    function showRoutingError(message) {
        const header = $("routing-results-header");
        const empty = $("routing-empty");

        if (header) header.style.display = "flex";
        if (empty) empty.style.display = "block";

        setText("routing-empty-title", "Routing Request Failed");
        setText("routing-empty-desc", message);
    }

    function updateStats() {
        const total = facilities.length;
        const active = facilities.filter(
            (facility) => facility?.is_active !== false
        ).length;

        const districtHospitals = facilities.filter(
            (facility) =>
                String(facility?.facility_type || facility?.facilityType || "") ===
                "DISTRICT_HOSPITAL"
        ).length;

        setText("stat-total-network-facilities", total);
        setText("stat-active-facilities", active);
        setText("stat-emergency-tier-count", districtHospitals);
    }

    function updateStatsFromRecommendations() {
        const scores = recommendations
            .map((item) => Number(item?.suitability_score))
            .filter(Number.isFinite);

        if (scores.length) {
            setText("stat-avg-suitability", `${Math.round(Math.max(...scores))}%`);
        }
    }

    /* ============================================================
       HELPERS
       ============================================================ */

    function getValue(id) {
        return $(id)?.value?.trim() || "";
    }

    function setValue(id, value) {
        const element = $(id);
        if (element) element.value = value ?? "";
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value == null ? "" : String(value);
    }

    function unwrapObject(response) {
        if (
            response?.data &&
            typeof response.data === "object" &&
            !Array.isArray(response.data)
        ) {
            return response.data;
        }
        return response;
    }

    function getStateValue(state, keys) {
        if (!state) return null;

        for (const key of keys) {
            if (state[key] !== undefined && state[key] !== null) {
                return state[key];
            }
        }

        return null;
    }

    function pickValue(object, keys) {
        if (!object) return null;

        for (const key of keys) {
            if (object[key] !== undefined && object[key] !== null) {
                return object[key];
            }
        }

        return null;
    }

    function formatTelemetryValue(value) {
        if (value === null || value === undefined || value === "") {
            return "Unavailable";
        }
        return String(value);
    }

    function formatWait(value) {
        const number = Number(value);
        return Number.isFinite(number)
            ? `${Math.round(number)} min`
            : "Unavailable";
    }

    function formatDistance(value) {
        const number = Number(value);
        return Number.isFinite(number)
            ? `${number.toFixed(1)} km`
            : "Unavailable";
    }

    function formatScore(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) return "—";

        const percent = number <= 1 ? number * 100 : number;
        return `${percent.toFixed(1)}%`;
    }

    function formatCoordinate(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number.toFixed(4) : "--";
    }

    function formatTimestamp(value) {
        if (!value) return "Unavailable";

        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString();
    }

    function formatFacilityType(value) {
        if (!value) return "Healthcare Facility";

        const map = {
            SUB_CENTRE: "Sub Centre",
            PHC: "Primary Health Centre",
            RURAL_HOSPITAL: "Rural Hospital",
            DISTRICT_HOSPITAL: "District Hospital"
        };

        return map[value] ||
            String(value)
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function numberOrNull(value) {
        if (value === null || value === undefined || value === "") return null;

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function removeNullValues(object) {
        return Object.fromEntries(
            Object.entries(object).filter(
                ([, value]) =>
                    value !== null &&
                    value !== undefined &&
                    value !== ""
            )
        );
    }

    function clamp(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.min(Math.max(value, min), max);
    }

    function setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            button.disabled = true;
        } else {
            button.disabled = false;
        }
    }

    function showToast(message, type = "info") {
        // Use the shared VIZITOR toast only when it is a different function.
        if (
            typeof window.showToast === "function" &&
            window.showToast !== showToast
        ) {
            window.showToast(message, type);
            return;
        }

        let container = $("facilities-toast-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "facilities-toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 3500);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function debounce(callback, delay) {
        let timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(callback, delay);
        };
    }

    window.FacilitiesPage = {
        openFacilityDetails,
        closeFacilityModal,
        refreshSelectedFacilityState,
        refreshTelemetry,
        executeRouting,
        resetRoutingForm,
        useRoutingGPS,
        selectPriority,
        openFacilityRoute
    };
})();
