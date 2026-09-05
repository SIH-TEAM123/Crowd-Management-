/**
 * Medicine Availability & Facility Inventory Frontend Controller
 * Integrates with FastAPI Backend (/medicines, /facilities)
 */

document.addEventListener("DOMContentLoaded", () => {
    initMedicinesPage();
});

// State Store
const medicinesState = {
    medicines: [],
    facilities: [],
    facilityMap: {},
    facilityInventory: [],
    selectedMedicine: null,
    activeFacilityId: null,
    viewMode: "grid", // 'grid' | 'table'
    activeTab: "catalog", // 'catalog' | 'facility-inventory' | 'stock-mgmt'
    isLoading: false,
    userLocation: {
        latitude: null,
        longitude: null,
        maxDistanceKm: 25,
        minQuantity: 1,
    },
    filters: {
        search: "",
        dosageForm: "",
        manufacturer: "",
    },
    inventoryFilters: {
        facilityId: "",
        search: "",
        isAvailableOnly: false,
    },
};

/**
 * Initialize page components, event listeners, and initial data fetch
 */
async function initMedicinesPage() {
    setupAuthDisplay();
    setupEventListeners();
    await loadFacilities();
    await loadMedicines();

    // Check query params for deep linking (e.g. ?medicine_id=xxx or ?facility_id=xxx or ?tab=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    const medIdParam = urlParams.get("medicine_id");
    const facIdParam = urlParams.get("facility_id");

    if (tabParam) {
        switchTab(tabParam);
    }

    if (facIdParam) {
        const facSelect = document.getElementById("inventory-facility-select");
        if (facSelect) {
            facSelect.value = facIdParam;
            medicinesState.inventoryFilters.facilityId = facIdParam;
            await loadFacilityInventory(facIdParam);
        }
    }

    if (medIdParam) {
        openMedicineDetails(medIdParam);
    }
}

/**
 * Setup user initials and role display
 */
function setupAuthDisplay() {
    const userEmail = localStorage.getItem("userEmail") || "admin@hospital.gov";
    const initials = userEmail.substring(0, 2).toUpperCase();
    const initialsEl = document.getElementById("user-initials");
    if (initialsEl) initialsEl.textContent = initials;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // 1. Tab Switching
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
            showToast("Refreshing pharmaceutical network data...", "info");
            await loadFacilities();
            await loadMedicines();
            if (medicinesState.inventoryFilters.facilityId) {
                await loadFacilityInventory(medicinesState.inventoryFilters.facilityId);
            }
            showToast("Data refreshed successfully.", "success");
        });
    }

    // 3. View Mode Toggle (Grid vs Table)
    const btnGrid = document.getElementById("btn-view-grid");
    const btnTable = document.getElementById("btn-view-table");
    if (btnGrid) btnGrid.addEventListener("click", () => switchViewMode("grid"));
    if (btnTable) btnTable.addEventListener("click", () => switchViewMode("table"));

    // 4. Medicine Directory Filters
    const searchInput = document.getElementById("filter-medicine-search");
    const formSelect = document.getElementById("filter-dosage-form");
    const mfgSelect = document.getElementById("filter-manufacturer");
    const resetFiltersBtn = document.getElementById("btn-reset-medicine-filters");

    let debounceTimeout = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                medicinesState.filters.search = e.target.value.trim().toLowerCase();
                renderMedicinesView();
            }, 250);
        });
    }

    if (formSelect) {
        formSelect.addEventListener("change", (e) => {
            medicinesState.filters.dosageForm = e.target.value;
            renderMedicinesView();
        });
    }

    if (mfgSelect) {
        mfgSelect.addEventListener("change", (e) => {
            medicinesState.filters.manufacturer = e.target.value;
            renderMedicinesView();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener("click", () => {
            medicinesState.filters = { search: "", dosageForm: "", manufacturer: "" };
            if (searchInput) searchInput.value = "";
            if (formSelect) formSelect.value = "";
            if (mfgSelect) mfgSelect.value = "";
            renderMedicinesView();
        });
    }

    // 5. Geolocation / Proximity Controls
    const geoBtn = document.getElementById("btn-use-geolocation");
    const clearLocBtn = document.getElementById("btn-clear-location");
    const latInput = document.getElementById("input-origin-lat");
    const lonInput = document.getElementById("input-origin-lon");
    const distSelect = document.getElementById("select-max-distance");
    const minQtyInput = document.getElementById("input-min-quantity");

    if (geoBtn) {
        geoBtn.addEventListener("click", useBrowserGeolocation);
    }

    if (clearLocBtn) {
        clearLocBtn.addEventListener("click", clearLocation);
    }

    if (latInput) {
        latInput.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            medicinesState.userLocation.latitude = isNaN(val) ? null : val;
            updateLocationStatus();
        });
    }

    if (lonInput) {
        lonInput.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            medicinesState.userLocation.longitude = isNaN(val) ? null : val;
            updateLocationStatus();
        });
    }

    if (distSelect) {
        distSelect.addEventListener("change", (e) => {
            const val = parseFloat(e.target.value);
            medicinesState.userLocation.maxDistanceKm = isNaN(val) ? null : val;
        });
    }

    if (minQtyInput) {
        minQtyInput.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10);
            medicinesState.userLocation.minQuantity = isNaN(val) || val < 1 ? 1 : val;
        });
    }

    // 6. Facility Inventory Explorer Controls
    const facInvSelect = document.getElementById("inventory-facility-select");
    const invSearchInput = document.getElementById("inventory-filter-search");
    const invAvailCheck = document.getElementById("inventory-available-only-toggle");
    const btnRefreshInv = document.getElementById("btn-refresh-inventory");
    const btnQuickCheck = document.getElementById("btn-quick-check-availability");

    if (facInvSelect) {
        facInvSelect.addEventListener("change", (e) => {
            const facId = e.target.value;
            medicinesState.inventoryFilters.facilityId = facId;
            if (facId) {
                loadFacilityInventory(facId);
            } else {
                medicinesState.facilityInventory = [];
                renderInventoryView();
            }
        });
    }

    let invDebounce = null;
    if (invSearchInput) {
        invSearchInput.addEventListener("input", (e) => {
            clearTimeout(invDebounce);
            invDebounce = setTimeout(() => {
                medicinesState.inventoryFilters.search = e.target.value.trim().toLowerCase();
                renderInventoryView();
            }, 250);
        });
    }

    if (invAvailCheck) {
        invAvailCheck.addEventListener("change", (e) => {
            medicinesState.inventoryFilters.isAvailableOnly = e.target.checked;
            if (medicinesState.inventoryFilters.facilityId) {
                loadFacilityInventory(medicinesState.inventoryFilters.facilityId);
            }
        });
    }

    if (btnRefreshInv) {
        btnRefreshInv.addEventListener("click", () => {
            if (medicinesState.inventoryFilters.facilityId) {
                loadFacilityInventory(medicinesState.inventoryFilters.facilityId);
            } else {
                showToast("Please choose a facility first.", "warning");
            }
        });
    }

    if (btnQuickCheck) {
        btnQuickCheck.addEventListener("click", () => {
            openAvailabilityQueryModal(medicinesState.inventoryFilters.facilityId);
        });
    }

    // 7. Stock Management Forms
    const formSetInv = document.getElementById("form-set-inventory");
    if (formSetInv) formSetInv.addEventListener("submit", handleSetInventorySubmit);

    const formAdjustStock = document.getElementById("form-adjust-stock");
    if (formAdjustStock) formAdjustStock.addEventListener("submit", handleAdjustStockSubmit);

    const formCreateMed = document.getElementById("form-create-medicine");
    if (formCreateMed) formCreateMed.addEventListener("submit", handleCreateMedicineSubmit);

    // 8. Availability Check Form
    const formQueryAvail = document.getElementById("form-query-availability");
    if (formQueryAvail) formQueryAvail.addEventListener("submit", handleQueryAvailabilitySubmit);

    // 9. Modal Close Buttons
    document.getElementById("btn-close-med-modal")?.addEventListener("click", () => closeModal("modal-medicine-details"));
    document.getElementById("btn-close-med-modal-btn")?.addEventListener("click", () => closeModal("modal-medicine-details"));
    document.getElementById("btn-close-avail-modal")?.addEventListener("click", () => closeModal("modal-check-availability"));
    document.getElementById("btn-close-avail-modal-btn")?.addEventListener("click", () => closeModal("modal-check-availability"));

    // Close modals on clicking overlay backdrop or pressing ESC
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
 * Tab Navigation Switcher
 */
function switchTab(tabName) {
    medicinesState.activeTab = tabName;

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });

    document.querySelectorAll(".tab-content").forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
}

/**
 * Switch Directory View Mode (Grid vs Table)
 */
function switchViewMode(mode) {
    medicinesState.viewMode = mode;
    const btnGrid = document.getElementById("btn-view-grid");
    const btnTable = document.getElementById("btn-view-table");
    const gridContainer = document.getElementById("medicines-grid-container");
    const tableContainer = document.getElementById("medicines-table-container");

    if (btnGrid) btnGrid.classList.toggle("active", mode === "grid");
    if (btnTable) btnTable.classList.toggle("active", mode === "table");

    if (gridContainer && tableContainer) {
        if (mode === "grid") {
            gridContainer.style.display = "grid";
            tableContainer.style.display = "none";
        } else {
            gridContainer.style.display = "none";
            tableContainer.style.display = "block";
        }
    }
}

/**
 * Fetch and cache facilities list
 */
async function loadFacilities() {
    try {
        const response = await fetchFacilities();
        if (response.success && Array.isArray(response.data)) {
            medicinesState.facilities = response.data;
            medicinesState.facilityMap = {};
            response.data.forEach((fac) => {
                medicinesState.facilityMap[fac.id] = fac;
            });
            populateFacilityDropdowns();
            updateStatsBar();
        }
    } catch (err) {
        console.error("Error loading facilities:", err);
    }
}

/**
 * Populate all facility dropdown selects across the page
 */
function populateFacilityDropdowns() {
    const selects = [
        document.getElementById("inventory-facility-select"),
        document.getElementById("form-set-facility"),
        document.getElementById("form-adjust-facility"),
        document.getElementById("query-avail-facility"),
    ];

    selects.forEach((select) => {
        if (!select) return;
        const currentVal = select.value;
        const defaultText = select.id === "inventory-facility-select" ? "-- Choose a Facility --" : "-- Select Facility --";
        select.innerHTML = `<option value="">${defaultText}</option>`;

        medicinesState.facilities.forEach((fac) => {
            const opt = document.createElement("option");
            opt.value = fac.id;
            opt.textContent = `${fac.name} (${fac.type || "Facility"}${fac.address ? " - " + fac.address : ""})`;
            select.appendChild(opt);
        });

        if (currentVal && medicinesState.facilityMap[currentVal]) {
            select.value = currentVal;
        }
    });
}

/**
 * Populate medicine options in dropdown selects
 */
function populateMedicineDropdowns() {
    const selects = [
        document.getElementById("form-set-medicine"),
        document.getElementById("form-adjust-medicine"),
        document.getElementById("query-avail-medicine"),
    ];

    selects.forEach((select) => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = `<option value="">-- Select Medicine --</option>`;

        medicinesState.medicines.forEach((med) => {
            const opt = document.createElement("option");
            opt.value = med.id;
            const extra = [med.generic_name, med.dosage_form, med.strength].filter(Boolean).join(" • ");
            opt.textContent = `${med.name}${extra ? " (" + extra + ")" : ""}`;
            select.appendChild(opt);
        });

        if (currentVal) {
            select.value = currentVal;
        }
    });
}

/**
 * Populate manufacturer filter options
 */
function populateManufacturerFilter() {
    const select = document.getElementById("filter-manufacturer");
    if (!select) return;

    const manufacturers = new Set();
    medicinesState.medicines.forEach((med) => {
        if (med.manufacturer && med.manufacturer.trim()) {
            manufacturers.add(med.manufacturer.trim());
        }
    });

    const currentVal = select.value;
    select.innerHTML = `<option value="">All Manufacturers</option>`;
    Array.from(manufacturers).sort().forEach((mfg) => {
        const opt = document.createElement("option");
        opt.value = mfg;
        opt.textContent = mfg;
        select.appendChild(opt);
    });

    if (currentVal && manufacturers.has(currentVal)) {
        select.value = currentVal;
    }
}

/**
 * Fetch medicine catalog from backend
 */
async function loadMedicines() {
    const loadingEl = document.getElementById("medicines-loading");
    const emptyEl = document.getElementById("medicines-empty");

    if (loadingEl) loadingEl.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "none";

    try {
        const response = await fetchMedicines();
        if (response.success && Array.isArray(response.data)) {
            medicinesState.medicines = response.data;
            if (response.fromCache) {
                showOfflineStaleBanner('medicines-loading', response.lastSyncedAt);
            } else {
                hideOfflineStaleBanner();
            }
            populateMedicineDropdowns();
            populateManufacturerFilter();
            renderMedicinesView();
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to load medicines.", "error");
            renderMedicinesView();
        }
    } catch (err) {
        console.error("Error loading medicines:", err);
        showToast("Error connecting to medicine service.", "error");
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

/**
 * Render filtered medicine directory in Grid and Table view
 */
function renderMedicinesView() {
    const gridContainer = document.getElementById("medicines-grid-container");
    const tableBody = document.getElementById("medicines-table-body");
    const emptyEl = document.getElementById("medicines-empty");

    if (!gridContainer || !tableBody) return;

    // Filter items based on active search, dosage form, and manufacturer
    const filtered = medicinesState.medicines.filter((med) => {
        if (medicinesState.filters.search) {
            const query = medicinesState.filters.search;
            const nameMatch = (med.name || "").toLowerCase().includes(query);
            const genericMatch = (med.generic_name || "").toLowerCase().includes(query);
            const idMatch = (med.id || "").toLowerCase().includes(query);
            if (!nameMatch && !genericMatch && !idMatch) return false;
        }
        if (medicinesState.filters.dosageForm) {
            if ((med.dosage_form || "").toLowerCase() !== medicinesState.filters.dosageForm.toLowerCase()) {
                return false;
            }
        }
        if (medicinesState.filters.manufacturer) {
            if ((med.manufacturer || "").toLowerCase() !== medicinesState.filters.manufacturer.toLowerCase()) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = "";
        tableBody.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    // 1. Render Grid Cards
    gridContainer.innerHTML = filtered.map((med) => createMedicineCardHtml(med)).join("");

    // 2. Render Table Rows
    tableBody.innerHTML = filtered.map((med) => createMedicineTableRowHtml(med)).join("");
}

/**
 * Generate HTML for an individual medicine card
 */
function createMedicineCardHtml(med) {
    const dosageForm = med.dosage_form || "Pharmaceutical";
    const strength = med.strength ? `<span class="strength-tag">${escapeHtml(med.strength)}</span>` : "";
    const generic = med.generic_name
        ? `<div class="medicine-generic-name">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            ${escapeHtml(med.generic_name)}
           </div>`
        : "";

    const manufacturer = med.manufacturer
        ? `<div class="medicine-manufacturer-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Mfg: <strong>${escapeHtml(med.manufacturer)}</strong></span>
           </div>`
        : "";

    return `
        <div class="medicine-card" id="med-card-${escapeHtml(med.id)}">
            <div>
                <div class="medicine-card-header">
                    <div>
                        <h3 class="medicine-brand-name">${escapeHtml(med.name)}</h3>
                        ${generic}
                    </div>
                    <span class="dosage-chip">${escapeHtml(dosageForm)}</span>
                </div>

                <div class="medicine-meta-row">
                    ${strength}
                </div>

                ${manufacturer}
            </div>

            <div class="medicine-card-footer">
                <button class="btn-primary" style="flex: 1; font-size: 0.8rem; padding: 0.55rem 0.75rem;" onclick="openMedicineDetails('${escapeHtml(med.id)}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>Check Availability</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for an individual medicine table row
 */
function createMedicineTableRowHtml(med) {
    const dosageForm = med.dosage_form || "--";
    const strength = med.strength ? ` • ${escapeHtml(med.strength)}` : "";
    const generic = med.generic_name ? escapeHtml(med.generic_name) : `<span style="color: #94a3b8;">N/A</span>`;
    const mfg = med.manufacturer ? escapeHtml(med.manufacturer) : `<span style="color: #94a3b8;">--</span>`;

    return `
        <tr>
            <td>
                <strong>${escapeHtml(med.name)}</strong>
                <div style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">ID: ${escapeHtml(med.id)}</div>
            </td>
            <td>${generic}</td>
            <td><span class="dosage-chip">${escapeHtml(dosageForm)}${strength}</span></td>
            <td>${mfg}</td>
            <td>
                <span class="badge-stock-in" style="font-size: 0.7rem;">Network Catalog</span>
            </td>
            <td style="text-align: right;">
                <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;" onclick="openMedicineDetails('${escapeHtml(med.id)}')">
                    Find Stock Nearby
                </button>
            </td>
        </tr>
    `;
}

/**
 * Fetch and render stocking facilities for a selected medicine
 */
async function openMedicineDetails(medicineId) {
    const modal = document.getElementById("modal-medicine-details");
    const loadingEl = document.getElementById("modal-stocking-facilities-loading");
    const listEl = document.getElementById("modal-stocking-facilities-list");
    const emptyEl = document.getElementById("modal-stocking-facilities-empty");
    const countEl = document.getElementById("modal-facilities-count");

    if (!modal || !listEl) return;

    // Reset modal state
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "flex";
    if (countEl) countEl.textContent = "Checking inventory...";

    // 1. Fetch medicine detail
    try {
        const medResponse = await getMedicineById(medicineId);
        if (medResponse.success && medResponse.data) {
            const med = medResponse.data;
            medicinesState.selectedMedicine = med;

            document.getElementById("modal-med-title").textContent = med.name;
            document.getElementById("modal-med-subtitle").textContent = med.generic_name ? `Generic: ${med.generic_name}` : "Pharmaceutical Product";
            document.getElementById("modal-med-id").textContent = med.id;
            document.getElementById("modal-med-generic").textContent = med.generic_name || "N/A";
            document.getElementById("modal-med-form-strength").textContent = `${med.dosage_form || "Standard"} ${med.strength ? "• " + med.strength : ""}`;
            document.getElementById("modal-med-manufacturer").textContent = med.manufacturer || "N/A";
        }
    } catch (err) {
        console.error("Error fetching medicine detail:", err);
    }

    openModal("modal-medicine-details");

    // 2. Fetch stocking facilities with backend proximity if coordinates available
    const queryOptions = {
        min_quantity: medicinesState.userLocation.minQuantity || 1,
    };

    if (medicinesState.userLocation.latitude !== null && medicinesState.userLocation.longitude !== null) {
        queryOptions.latitude = medicinesState.userLocation.latitude;
        queryOptions.longitude = medicinesState.userLocation.longitude;
        if (medicinesState.userLocation.maxDistanceKm) {
            queryOptions.max_distance_km = medicinesState.userLocation.maxDistanceKm;
        }
    }

    try {
        const facResponse = await findFacilitiesWithMedicine(medicineId, queryOptions);
        if (loadingEl) loadingEl.style.display = "none";

        if (facResponse.success && Array.isArray(facResponse.data)) {
            const facilities = facResponse.data;
            if (countEl) countEl.textContent = `${facilities.length} facility(ies) with stock`;

            if (facilities.length === 0) {
                if (emptyEl) emptyEl.style.display = "block";
            } else {
                listEl.innerHTML = facilities.map((fac) => createFacilityStockCardHtml(fac)).join("");
            }
        } else {
            if (emptyEl) {
                emptyEl.style.display = "block";
                emptyEl.innerHTML = `<p style="color: #ef4444;">${facResponse.message || "Unable to check facility availability."}</p>`;
            }
        }
    } catch (err) {
        console.error("Error finding facilities with medicine:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) emptyEl.style.display = "block";
    }
}

/**
 * Generate HTML for facility stock card in modal
 */
function createFacilityStockCardHtml(fac) {
    const isAvail = fac.is_available && fac.quantity > 0;
    const badgeClass = isAvail ? "badge-stock-in" : "badge-stock-out";
    const statusText = isAvail ? "IN STOCK" : "OUT OF STOCK";

    const distanceDisplay = fac.distance_km !== null && fac.distance_km !== undefined
        ? `<span class="distance-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${fac.distance_km.toFixed(1)} km away
           </span>`
        : "";

    return `
        <div class="facility-stock-card">
            <div class="facility-stock-left">
                <div class="facility-stock-name">
                    ${escapeHtml(fac.facility_name)}
                    <span class="dosage-chip">${escapeHtml(fac.facility_type || "Hospital")}</span>
                </div>
                <div class="facility-stock-address">
                    ${escapeHtml(fac.address || "Address on record")}
                </div>
                <div style="margin-top: 4px;">
                    ${distanceDisplay}
                </div>
            </div>

            <div class="facility-stock-right">
                <div class="stock-qty-highlight">
                    <span class="stock-qty-number" style="color: ${isAvail ? "#059669" : "#dc2626"};">${fac.quantity}</span>
                    <span class="stock-qty-unit">${escapeHtml(fac.unit || "units")}</span>
                </div>
                <span class="${badgeClass}">${statusText}</span>
            </div>
        </div>
    `;
}

/**
 * Fetch and render complete inventory for a specific facility
 */
async function loadFacilityInventory(facilityId) {
    const loadingEl = document.getElementById("inventory-loading");
    const emptyEl = document.getElementById("inventory-empty");
    const tableContainer = document.getElementById("inventory-table-container");
    const overviewBar = document.getElementById("facility-inventory-overview-bar");

    if (!facilityId) {
        if (tableContainer) tableContainer.style.display = "none";
        if (overviewBar) overviewBar.style.display = "none";
        if (emptyEl) {
            emptyEl.style.display = "block";
            document.getElementById("inventory-empty-title").textContent = "No Facility Selected";
            document.getElementById("inventory-empty-desc").textContent = "Choose a healthcare facility from the dropdown above to view its live pharmaceutical inventory.";
        }
        return;
    }

    if (loadingEl) loadingEl.style.display = "flex";
    if (emptyEl) emptyEl.style.display = "none";

    try {
        const isAvailOnly = medicinesState.inventoryFilters.isAvailableOnly;
        const response = await getFacilityInventory(facilityId, isAvailOnly);

        if (response.success && Array.isArray(response.data)) {
            medicinesState.facilityInventory = response.data;
            medicinesState.activeFacilityId = facilityId;

            const fac = medicinesState.facilityMap[facilityId];
            if (fac && overviewBar) {
                overviewBar.style.display = "flex";
                document.getElementById("inventory-fac-name").textContent = fac.name;
                document.getElementById("inventory-fac-meta").textContent = `Type: ${fac.type || "Hospital"} • Location: ${fac.address || "Main Campus"} • Total Items: ${response.data.length}`;
            }

            renderInventoryView();
        } else {
            showToast(response.message || "Failed to load facility inventory.", "error");
            medicinesState.facilityInventory = [];
            renderInventoryView();
        }
    } catch (err) {
        console.error("Error loading facility inventory:", err);
        showToast("Error connecting to inventory service.", "error");
    } finally {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

/**
 * Render filtered inventory items for the selected facility
 */
function renderInventoryView() {
    const tableContainer = document.getElementById("inventory-table-container");
    const tableBody = document.getElementById("inventory-table-body");
    const emptyEl = document.getElementById("inventory-empty");

    if (!tableContainer || !tableBody) return;

    if (!medicinesState.inventoryFilters.facilityId) {
        tableContainer.style.display = "none";
        if (emptyEl) emptyEl.style.display = "block";
        return;
    }

    const filtered = medicinesState.facilityInventory.filter((item) => {
        if (medicinesState.inventoryFilters.search) {
            const query = medicinesState.inventoryFilters.search;
            const medName = (item.medicine_name || "").toLowerCase();
            const generic = (item.generic_name || "").toLowerCase();
            const batch = (item.batch_number || "").toLowerCase();
            if (!medName.includes(query) && !generic.includes(query) && !batch.includes(query)) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        tableContainer.style.display = "none";
        if (emptyEl) {
            emptyEl.style.display = "block";
            document.getElementById("inventory-empty-title").textContent = "No Inventory Items Found";
            document.getElementById("inventory-empty-desc").textContent = "This facility currently has no stocked items matching your filter criteria.";
        }
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    tableContainer.style.display = "block";

    tableBody.innerHTML = filtered.map((item) => createInventoryTableRowHtml(item)).join("");
}

/**
 * Generate HTML for facility inventory table row
 */
function createInventoryTableRowHtml(item) {
    const isAvail = item.is_available && item.quantity > 0;
    let badgeClass = "badge-stock-in";
    let statusText = "IN STOCK";

    if (item.quantity === 0 || !item.is_available) {
        badgeClass = "badge-stock-out";
        statusText = "OUT OF STOCK";
    } else if (item.quantity < 10) {
        badgeClass = "badge-stock-low";
        statusText = "LOW STOCK";
    }

    const medName = item.medicine_name || `Medicine (${item.medicine_id})`;
    const generic = item.generic_name ? escapeHtml(item.generic_name) : `<span style="color: #94a3b8;">--</span>`;
    const batch = item.batch_number ? escapeHtml(item.batch_number) : `<span style="color: #94a3b8;">N/A</span>`;
    const expiry = item.expiry_date ? formatDate(item.expiry_date) : `<span style="color: #94a3b8;">N/A</span>`;

    return `
        <tr>
            <td>
                <strong>${escapeHtml(medName)}</strong>
                <div style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">ID: ${escapeHtml(item.medicine_id)}</div>
            </td>
            <td>${generic}</td>
            <td><code style="font-size: 0.8rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${batch}</code></td>
            <td>${expiry}</td>
            <td>
                <span style="font-size: 1.05rem; font-weight: 800; color: ${isAvail ? "#0f172a" : "#dc2626"};">${item.quantity}</span>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">${escapeHtml(item.unit || "units")}</span>
            </td>
            <td>
                <span class="${badgeClass}">${statusText}</span>
            </td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 4px;">
                    <button class="btn-outline" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;" title="Adjust Stock" onclick="openQuickAdjustStock('${escapeHtml(item.facility_id)}', '${escapeHtml(item.medicine_id)}')">
                        Adjust
                    </button>
                    <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.65rem;" title="Verify Real-time Availability" onclick="checkSpecificMedicineStock('${escapeHtml(item.facility_id)}', '${escapeHtml(item.medicine_id)}')">
                        Verify
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Handle form submit to add/set facility stock
 */
async function handleSetInventorySubmit(e) {
    e.preventDefault();

    const facilityId = document.getElementById("form-set-facility").value;
    const medicineId = document.getElementById("form-set-medicine").value;
    const quantity = parseInt(document.getElementById("form-set-quantity").value, 10);
    const unit = document.getElementById("form-set-unit").value.trim() || "tablets";
    const batchNumber = document.getElementById("form-set-batch").value.trim() || null;
    const expiryDateVal = document.getElementById("form-set-expiry").value;

    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline mode: Medicine stock adjustments require server connectivity.", "warning");
        return;
    }

    if (!facilityId || !medicineId) {
        showToast("Please select both facility and medicine.", "warning");
        return;
    }

    if (isNaN(quantity) || quantity < 0) {
        showToast("Quantity must be a non-negative integer.", "error");
        return;
    }

    const payload = {
        facility_id: facilityId,
        medicine_id: medicineId,
        quantity: quantity,
        unit: unit,
        batch_number: batchNumber,
        expiry_date: expiryDateVal ? new Date(expiryDateVal).toISOString() : null,
    };

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating Inventory...";
    }

    try {
        const response = await setFacilityInventory(facilityId, payload);
        if (response.success) {
            showToast(`Inventory updated successfully (${quantity} ${unit} in stock).`, "success");
            e.target.reset();
            // Refresh inventory view if current facility is selected
            if (medicinesState.inventoryFilters.facilityId === facilityId) {
                await loadFacilityInventory(facilityId);
            }
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to update inventory.", "error");
        }
    } catch (err) {
        console.error("Error setting inventory:", err);
        showToast("Error updating inventory stock.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Update Inventory Stock";
        }
    }
}

/**
 * Handle atomic stock adjustment (+restock / -dispense)
 */
async function handleAdjustStockSubmit(e) {
    e.preventDefault();

    if (window.Connectivity && window.Connectivity.isOffline()) {
        showToast("Offline mode: Medicine stock adjustments require server connectivity.", "warning");
        return;
    }

    const facilityId = document.getElementById("form-adjust-facility").value;
    const medicineId = document.getElementById("form-adjust-medicine").value;
    const delta = parseInt(document.getElementById("form-adjust-delta").value, 10);
    const reason = document.getElementById("form-adjust-reason").value.trim() || null;

    if (!facilityId || !medicineId) {
        showToast("Please select both facility and medicine.", "warning");
        return;
    }

    if (isNaN(delta) || delta === 0) {
        showToast("Please enter a non-zero adjustment delta (+ to restock, - to dispense).", "warning");
        return;
    }

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Applying Adjustment...";
    }

    try {
        const response = await adjustFacilityInventoryStock(facilityId, medicineId, delta, reason);
        if (response.success) {
            const action = delta > 0 ? `Restocked +${delta}` : `Dispensed ${delta}`;
            showToast(`Stock updated: ${action}. New balance: ${response.data.quantity} ${response.data.unit}.`, "success");
            document.getElementById("form-adjust-delta").value = "";
            document.getElementById("form-adjust-reason").value = "";

            if (medicinesState.inventoryFilters.facilityId === facilityId) {
                await loadFacilityInventory(facilityId);
            }
            updateStatsBar();
        } else {
            showToast(response.message || "Failed to adjust inventory stock.", "error");
        }
    } catch (err) {
        console.error("Error adjusting stock:", err);
        showToast("Error executing stock adjustment.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Apply Stock Adjustment";
        }
    }
}

/**
 * Handle registering a new medicine in the catalog
 */
async function handleCreateMedicineSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("form-create-name").value.trim();
    const genericName = document.getElementById("form-create-generic").value.trim() || null;
    const dosageForm = document.getElementById("form-create-dosage").value.trim() || null;
    const strength = document.getElementById("form-create-strength").value.trim() || null;
    const manufacturer = document.getElementById("form-create-manufacturer").value.trim() || null;

    if (!name) {
        showToast("Medicine brand name is required.", "warning");
        return;
    }

    const payload = {
        name: name,
        generic_name: genericName,
        dosage_form: dosageForm,
        strength: strength,
        manufacturer: manufacturer,
    };

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Registering...";
    }

    try {
        const response = await createMedicine(payload);
        if (response.success) {
            showToast(`Medicine '${name}' successfully registered in catalog!`, "success");
            e.target.reset();
            await loadMedicines();
        } else {
            showToast(response.message || "Failed to create medicine.", "error");
        }
    } catch (err) {
        console.error("Error creating medicine:", err);
        showToast("Error connecting to catalog service.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Register Medicine";
        }
    }
}

/**
 * Open direct availability verification modal
 */
function openAvailabilityQueryModal(preselectFacilityId = null, preselectMedicineId = null) {
    const facSelect = document.getElementById("query-avail-facility");
    const medSelect = document.getElementById("query-avail-medicine");
    const resultBox = document.getElementById("avail-query-result-box");

    if (resultBox) resultBox.style.display = "none";
    if (preselectFacilityId && facSelect) facSelect.value = preselectFacilityId;
    if (preselectMedicineId && medSelect) medSelect.value = preselectMedicineId;

    openModal("modal-check-availability");
}

/**
 * Direct check of medicine stock at a facility
 */
async function checkSpecificMedicineStock(facilityId, medicineId) {
    openAvailabilityQueryModal(facilityId, medicineId);
    await executeAvailabilityQuery(facilityId, medicineId);
}

/**
 * Form handler for specific availability query
 */
async function handleQueryAvailabilitySubmit(e) {
    e.preventDefault();
    const facilityId = document.getElementById("query-avail-facility").value;
    const medicineId = document.getElementById("query-avail-medicine").value;

    if (!facilityId || !medicineId) {
        showToast("Please select both a facility and a medicine.", "warning");
        return;
    }

    await executeAvailabilityQuery(facilityId, medicineId);
}

/**
 * Execute direct GET /facilities/{facility_id}/medicines/{medicine_id}/availability
 */
async function executeAvailabilityQuery(facilityId, medicineId) {
    const resultBox = document.getElementById("avail-query-result-box");
    if (!resultBox) return;

    try {
        const response = await checkMedicineAvailability(facilityId, medicineId);
        if (response.success && response.data) {
            const inv = response.data;
            resultBox.style.display = "block";

            document.getElementById("avail-result-med-name").textContent = inv.medicine_name || `Medicine (${inv.medicine_id})`;
            document.getElementById("avail-result-qty").textContent = inv.quantity;
            document.getElementById("avail-result-unit").textContent = inv.unit || "units";
            document.getElementById("avail-result-fac-name").textContent = inv.facility_name || facilityId;
            document.getElementById("avail-result-batch").textContent = inv.batch_number || "N/A";
            document.getElementById("avail-result-expiry").textContent = inv.expiry_date ? formatDate(inv.expiry_date) : "N/A";

            const badge = document.getElementById("avail-result-badge");
            if (badge) {
                if (inv.is_available && inv.quantity > 0) {
                    badge.className = "badge-stock-in";
                    badge.textContent = "IN STOCK";
                } else {
                    badge.className = "badge-stock-out";
                    badge.textContent = "OUT OF STOCK";
                }
            }
        } else {
            resultBox.style.display = "block";
            document.getElementById("avail-result-med-name").textContent = "Item Not Stocked";
            document.getElementById("avail-result-qty").textContent = "0";
            document.getElementById("avail-result-unit").textContent = "units";
            document.getElementById("avail-result-fac-name").textContent = facilityId;
            document.getElementById("avail-result-batch").textContent = "None";
            document.getElementById("avail-result-expiry").textContent = "None";

            const badge = document.getElementById("avail-result-badge");
            if (badge) {
                badge.className = "badge-stock-out";
                badge.textContent = "NOT STOCKED";
            }
        }
    } catch (err) {
        console.error("Error querying medicine availability:", err);
        showToast("Error checking availability.", "error");
    }
}

/**
 * Open stock adjustment tab with prefilled values
 */
function openQuickAdjustStock(facilityId, medicineId) {
    switchTab("stock-mgmt");
    const facSelect = document.getElementById("form-adjust-facility");
    const medSelect = document.getElementById("form-adjust-medicine");
    if (facSelect) facSelect.value = facilityId;
    if (medSelect) medSelect.value = medicineId;

    const deltaInput = document.getElementById("form-adjust-delta");
    if (deltaInput) {
        deltaInput.focus();
    }
}

/**
 * Geolocation helpers
 */
function useBrowserGeolocation() {
    const geoBtnLabel = document.getElementById("geo-btn-label");
    if (!navigator.geolocation) {
        showToast("Geolocation is not supported by your browser.", "warning");
        return;
    }

    if (geoBtnLabel) geoBtnLabel.textContent = "Acquiring GPS...";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = parseFloat(pos.coords.latitude.toFixed(6));
            const lon = parseFloat(pos.coords.longitude.toFixed(6));

            medicinesState.userLocation.latitude = lat;
            medicinesState.userLocation.longitude = lon;

            const latInput = document.getElementById("input-origin-lat");
            const lonInput = document.getElementById("input-origin-lon");
            if (latInput) latInput.value = lat;
            if (lonInput) lonInput.value = lon;

            if (geoBtnLabel) geoBtnLabel.textContent = "GPS Acquired";
            updateLocationStatus();
            showToast(`Location detected: ${lat}, ${lon}`, "success");
        },
        (err) => {
            console.warn("Geolocation permission denied or error:", err.message);
            if (geoBtnLabel) geoBtnLabel.textContent = "Use My Location";
            showToast("Could not retrieve GPS location. You can enter coordinates manually.", "warning");
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

function clearLocation() {
    medicinesState.userLocation.latitude = null;
    medicinesState.userLocation.longitude = null;

    const latInput = document.getElementById("input-origin-lat");
    const lonInput = document.getElementById("input-origin-lon");
    const geoBtnLabel = document.getElementById("geo-btn-label");

    if (latInput) latInput.value = "";
    if (lonInput) lonInput.value = "";
    if (geoBtnLabel) geoBtnLabel.textContent = "Use My Location";

    updateLocationStatus();
    showToast("Proximity coordinates cleared.", "info");
}

function updateLocationStatus() {
    const badge = document.getElementById("location-status-badge");
    if (!badge) return;

    if (medicinesState.userLocation.latitude !== null && medicinesState.userLocation.longitude !== null) {
        badge.innerHTML = `<span style="color: #10b981; font-weight: 700;">● Active (${medicinesState.userLocation.latitude}, ${medicinesState.userLocation.longitude})</span>`;
    } else {
        badge.innerHTML = `<span style="color: #64748b;">Proximity inactive</span>`;
    }
}

/**
 * Update top hero statistics bar
 */
function updateStatsBar() {
    const totalMedsEl = document.getElementById("stat-total-medicines");
    const totalFacsEl = document.getElementById("stat-total-facilities");
    const inStockRateEl = document.getElementById("stat-in-stock-rate");
    const lowStockEl = document.getElementById("stat-low-stock-count");

    if (totalMedsEl) totalMedsEl.textContent = medicinesState.medicines.length;
    if (totalFacsEl) totalFacsEl.textContent = medicinesState.facilities.length;

    // Calculate low stock / out of stock items from loaded facility inventories
    if (medicinesState.facilityInventory.length > 0) {
        const inStockCount = medicinesState.facilityInventory.filter((i) => i.is_available && i.quantity > 0).length;
        const lowStockCount = medicinesState.facilityInventory.filter((i) => !i.is_available || i.quantity < 10).length;
        const rate = Math.round((inStockCount / medicinesState.facilityInventory.length) * 100);

        if (inStockRateEl) inStockRateEl.textContent = `${rate}%`;
        if (lowStockEl) lowStockEl.textContent = lowStockCount;
    } else {
        if (inStockRateEl) inStockRateEl.textContent = "--%";
        if (lowStockEl) lowStockEl.textContent = "0";
    }
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
        return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
