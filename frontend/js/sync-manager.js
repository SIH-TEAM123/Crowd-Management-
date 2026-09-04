/**
 * VIZITOR - Offline Sync Manager
 * Manages background synchronization of offline mutations.
 */

class SyncManager {
    constructor() {
        this.isSyncing = false;
    }

    async processSyncQueue() {
        if (this.isSyncing) {
            console.log("[SyncManager] Sync already in progress, skipping...");
            return;
        }

        if (
            !window.Connectivity ||
            !window.Connectivity.isOnline()
        ) {
            console.log(
                "[SyncManager] Cannot sync: connectivity is not ONLINE."
            );
            return;
        }

        this.isSyncing = true;

        console.log(
            "[SyncManager] Starting sync queue processing..."
        );

        try {
            const pendingActions =
                await window.OfflineDB.getPendingSyncActions();

            if (pendingActions.length === 0) {
                console.log(
                    "[SyncManager] No pending actions to sync."
                );

                this.renderSyncCenterModal();
                return;
            }

            console.log(
                `[SyncManager] Found ${pendingActions.length} pending action(s).`
            );

            for (const action of pendingActions) {
                await this.processSingleAction(action);
            }

            window.dispatchEvent(
                new CustomEvent("sync-queue-updated", {
                    detail: {
                        timestamp:
                            new Date().toISOString()
                    }
                })
            );

        } catch (error) {
            console.error(
                "[SyncManager] Error during sync queue processing:",
                error
            );

        } finally {
            this.isSyncing = false;
            this.renderSyncCenterModal();
        }
    }

    async processSingleAction(action) {
        if (!action || !action.id) {
            return;
        }

        await window.OfflineDB.updateSyncAction(
            action.id,
            {
                status: "SYNCING",
                attemptedAt:
                    new Date().toISOString(),
                retryCount:
                    (action.retryCount || 0) + 1
            }
        );

        if (
            action.actionType ===
            "CREATE_APPOINTMENT"
        ) {
            await this.syncAppointmentAction(action);

        } else {
            console.warn(
                "[SyncManager] Unknown action type:",
                action.actionType
            );

            await window.OfflineDB.updateSyncAction(
                action.id,
                {
                    status: "SYNC_REVIEW",
                    lastError:
                        "Unsupported action type"
                }
            );
        }
    }

    async syncAppointmentAction(action) {
        const payload = action.payload;
        const localRef =
            action.localReference;

        try {
            if (
                typeof bookAppointment !==
                "function"
            ) {
                throw new Error(
                    "bookAppointment() is not available."
                );
            }

            const result =
                await bookAppointment(
                    payload
                );

            if (
                result &&
                result.success &&
                result.data
            ) {
                const serverAppt =
                    result.data;

                // VIZITOR backend uses appointment_id.
                const serverId =
                    serverAppt.appointment_id ??
                    serverAppt.id;

                const serverToken =
                    serverAppt.token_number ??
                    serverAppt.token ??
                    serverId ??
                    "Confirmed";

                console.log(
                    "[SyncManager] Appointment synced:",
                    serverId,
                    "Token:",
                    serverToken
                );

                await window.OfflineDB.updateSyncAction(
                    action.id,
                    {
                        status: "COMPLETED",
                        serverId:
                            serverId,
                        tokenNumber:
                            serverToken,
                        completedAt:
                            new Date().toISOString(),
                        lastError: null
                    }
                );

                if (localRef) {
                    await window.OfflineDB.deleteRecord(
                        "appointments",
                        localRef
                    );
                }

                await window.OfflineDB.put(
                    "appointments",
                    {
                        ...serverAppt,

                        id: serverId,

                        _cachedAt:
                            new Date().toISOString(),

                        _synced: true,

                        _localReference:
                            localRef
                    }
                );

                // Refresh the VIZITOR appointment page.
                if (
                    typeof loadAppointmentsFromServer ===
                    "function"
                ) {
                    await loadAppointmentsFromServer();
                }

                this.showToast(
                    `✅ Offline appointment confirmed! Token: #${serverToken}`,
                    "success"
                );

                window.dispatchEvent(
                    new CustomEvent(
                        "vizitor:appointment-changed",
                        {
                            detail: {
                                type: "created",
                                appointment:
                                    serverAppt
                            }
                        }
                    )
                );

                return;
            }

            const status =
                result
                    ? result.status
                    : 0;

            const errorMsg =
                result
                    ? result.message
                    : "Unknown server error";

            if (status === 409) {

                await window.OfflineDB.updateSyncAction(
                    action.id,
                    {
                        status: "CONFLICT",

                        lastError:
                            "The selected slot is no longer available. Your offline request could not be confirmed.",

                        conflictAt:
                            new Date().toISOString()
                    }
                );

                if (localRef) {
                    const localAppt =
                        await window.OfflineDB.get(
                            "appointments",
                            localRef
                        );

                    if (localAppt) {
                        localAppt.status =
                            "CONFLICT";

                        localAppt.sync_error =
                            "Slot is no longer available";

                        await window.OfflineDB.put(
                            "appointments",
                            localAppt
                        );
                    }
                }

                this.showToast(
                    `⚠️ Slot unavailable for offline request ${localRef}.`,
                    "error"
                );

            } else if (
                status === 401 ||
                status === 403
            ) {

                await window.OfflineDB.updateSyncAction(
                    action.id,
                    {
                        status:
                            "SYNC_REVIEW",

                        lastError:
                            "Authentication expired. Please log in again to sync this appointment."
                    }
                );

            } else if (
                status === 422
            ) {

                await window.OfflineDB.updateSyncAction(
                    action.id,
                    {
                        status:
                            "SYNC_REVIEW",

                        lastError:
                            `Validation error: ${errorMsg}`
                    }
                );

            } else {

                await window.OfflineDB.updateSyncAction(
                    action.id,
                    {
                        status:
                            "SYNC_REVIEW",

                        lastError:
                            `Server error (${status}): ${errorMsg}. Outcome unknown — please verify your appointment before retrying.`
                    }
                );

                this.showToast(
                    `⚠️ Sync failed for ${localRef}. Please verify your appointment.`,
                    "error"
                );
            }

        } catch (err) {

            console.error(
                "[SyncManager] Appointment sync exception:",
                err
            );

            await window.OfflineDB.updateSyncAction(
                action.id,
                {
                    status:
                        "SYNC_REVIEW",

                    lastError:
                        `Network exception: ${
                            err.message ||
                            "Connection failure"
                        }. Request outcome is unknown.`
                }
            );

            this.showToast(
                `⚠️ Network error syncing ${localRef}.`,
                "error"
            );
        }
    }

    async openSyncCenter() {
        let modal =
            document.getElementById(
                "syncCenterModal"
            );

        if (!modal) {
            this.createSyncCenterDOM();

            modal =
                document.getElementById(
                    "syncCenterModal"
                );
        }

        await this.renderSyncCenterModal();

        if (modal) {
            modal.style.display =
                "flex";
        }
    }

    closeSyncCenter() {
        const modal =
            document.getElementById(
                "syncCenterModal"
            );

        if (modal) {
            modal.style.display =
                "none";
        }
    }

    createSyncCenterDOM() {
        const modalDiv =
            document.createElement("div");

        modalDiv.id =
            "syncCenterModal";

        modalDiv.className =
            "modal-backdrop";

        modalDiv.style.cssText =
            `
            display:none;
            position:fixed;
            inset:0;
            background:rgba(15,23,42,0.6);
            backdrop-filter:blur(4px);
            z-index:10000;
            align-items:center;
            justify-content:center;
        `;

        modalDiv.innerHTML = `
            <div
                class="modal-card"
                style="
                    background:white;
                    border-radius:16px;
                    width:92%;
                    max-width:540px;
                    max-height:85vh;
                    overflow-y:auto;
                    padding:24px;
                    box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:16px;
                        border-bottom:1px solid #e2e8f0;
                        padding-bottom:12px;
                    "
                >
                    <div>
                        <h3
                            style="
                                margin:0;
                                font-size:1.2rem;
                                font-weight:700;
                                color:#0f172a;
                            "
                        >
                            Sync Center
                        </h3>

                        <p
                            style="
                                margin:2px 0 0;
                                font-size:.8rem;
                                color:#64748b;
                            "
                        >
                            Offline Appointments & Synchronization
                        </p>
                    </div>

                    <button
                        onclick="window.SyncManager.closeSyncCenter()"
                        style="
                            background:none;
                            border:none;
                            font-size:1.5rem;
                            cursor:pointer;
                            color:#64748b;
                        "
                    >
                        &times;
                    </button>
                </div>

                <div
                    id="syncCenterStats"
                    style="
                        display:grid;
                        grid-template-columns:repeat(4,1fr);
                        gap:8px;
                        margin-bottom:16px;
                    "
                ></div>

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:12px;
                    "
                >
                    <span
                        style="
                            font-size:.85rem;
                            font-weight:600;
                            color:#334155;
                        "
                    >
                        Queued Actions
                    </span>

                    <button
                        id="manualSyncBtn"
                        onclick="window.SyncManager.processSyncQueue()"
                        style="
                            padding:6px 14px;
                            background:#7c3aed;
                            color:white;
                            border:none;
                            border-radius:6px;
                            font-size:.8rem;
                            font-weight:600;
                            cursor:pointer;
                        "
                    >
                        ↻ Sync Now
                    </button>
                </div>

                <div
                    id="syncCenterList"
                    style="margin-bottom:16px;"
                ></div>

                <div
                    style="
                        border-top:1px solid #e2e8f0;
                        padding-top:12px;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    "
                >
                    <span
                        id="syncCenterLastSync"
                        style="
                            font-size:.75rem;
                            color:#64748b;
                        "
                    >
                        Last Backend Check: --
                    </span>

                    <button
                        onclick="window.SyncManager.closeSyncCenter()"
                        style="
                            padding:8px 16px;
                            background:#f1f5f9;
                            color:#475569;
                            border:none;
                            border-radius:6px;
                            font-weight:600;
                            cursor:pointer;
                        "
                    >
                        Close
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(
            modalDiv
        );
    }

    async renderSyncCenterModal() {
        const statsEl =
            document.getElementById(
                "syncCenterStats"
            );

        const listEl =
            document.getElementById(
                "syncCenterList"
            );

        const lastSyncEl =
            document.getElementById(
                "syncCenterLastSync"
            );

        if (!statsEl || !listEl) {
            return;
        }

        const allActions =
            await window.OfflineDB.getAllSyncActions();

        const pending =
            allActions.filter(
                a =>
                    a.status === "PENDING" ||
                    a.status === "SYNCING"
            );

        const completed =
            allActions.filter(
                a =>
                    a.status === "COMPLETED"
            );

        const conflicts =
            allActions.filter(
                a =>
                    a.status === "CONFLICT"
            );

        const review =
            allActions.filter(
                a =>
                    a.status === "SYNC_REVIEW"
            );

        statsEl.innerHTML = `
            <div style="padding:10px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;">
                <strong>${pending.length}</strong>
                <div style="font-size:.7rem;">Pending</div>
            </div>

            <div style="padding:10px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;">
                <strong>${completed.length}</strong>
                <div style="font-size:.7rem;">Completed</div>
            </div>

            <div style="padding:10px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;">
                <strong>${conflicts.length}</strong>
                <div style="font-size:.7rem;">Conflicts</div>
            </div>

            <div style="padding:10px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;">
                <strong>${review.length}</strong>
                <div style="font-size:.7rem;">Review</div>
            </div>
        `;

        if (allActions.length === 0) {

            listEl.innerHTML = `
                <div
                    style="
                        padding:24px;
                        text-align:center;
                        color:#94a3b8;
                        background:#f8fafc;
                        border-radius:8px;
                    "
                >
                    No offline requests.
                </div>
            `;

        } else {

            allActions.sort(
                (a, b) =>
                    new Date(
                        b.createdAt || 0
                    ) -
                    new Date(
                        a.createdAt || 0
                    )
            );

            let html =
                '<div style="display:flex;flex-direction:column;gap:8px;">';

            allActions.forEach(
                action => {

                    let badgeColor =
                        "#eab308";

                    if (
                        action.status ===
                        "COMPLETED"
                    ) {
                        badgeColor =
                            "#10b981";
                    }

                    if (
                        action.status ===
                        "CONFLICT"
                    ) {
                        badgeColor =
                            "#ef4444";
                    }

                    if (
                        action.status ===
                        "SYNC_REVIEW"
                    ) {
                        badgeColor =
                            "#6366f1";
                    }

                    html += `
                        <div
                            style="
                                border:1px solid #e2e8f0;
                                border-radius:8px;
                                padding:10px 12px;
                                background:#fff;
                            "
                        >
                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                "
                            >
                                <strong>
                                    ${action.localReference || "Action #" + action.id}
                                </strong>

                                <span
                                    style="
                                        padding:2px 8px;
                                        border-radius:12px;
                                        color:white;
                                        background:${badgeColor};
                                        font-size:.7rem;
                                        font-weight:700;
                                    "
                                >
                                    ${action.status}
                                </span>
                            </div>

                            <div
                                style="
                                    color:#64748b;
                                    font-size:.75rem;
                                    margin-top:4px;
                                "
                            >
                                ${action.actionType}
                            </div>

                            ${
                                action.tokenNumber
                                    ? `
                                    <div
                                        style="
                                            color:#7c3aed;
                                            font-weight:600;
                                            font-size:.8rem;
                                        "
                                    >
                                        Token: #${action.tokenNumber}
                                    </div>
                                    `
                                    : ""
                            }

                            ${
                                action.lastError
                                    ? `
                                    <div
                                        style="
                                            color:#dc2626;
                                            font-size:.75rem;
                                            margin-top:4px;
                                        "
                                    >
                                        ⚠️ ${action.lastError}
                                    </div>
                                    `
                                    : ""
                            }
                        </div>
                    `;
                }
            );

            html += "</div>";

            listEl.innerHTML =
                html;
        }

        if (
            lastSyncEl &&
            window.Connectivity
        ) {
            const last =
                window.Connectivity
                    .lastSuccessfulCheck;

            lastSyncEl.textContent =
                `Last Backend Check: ${
                    last
                        ? last.toLocaleTimeString()
                        : "Never"
                }`;
        }
    }

    showToast(
        message,
        type = "info"
    ) {
        let container =
            document.getElementById(
                "global-toast-container"
            );

        if (!container) {
            container =
                document.createElement(
                    "div"
                );

            container.id =
                "global-toast-container";

            container.style.cssText =
                `
                position:fixed;
                bottom:20px;
                right:20px;
                z-index:11000;
                display:flex;
                flex-direction:column;
                gap:8px;
            `;

            document.body.appendChild(
                container
            );
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.textContent =
            message;

        toast.style.cssText =
            `
            background:${
                type === "success"
                    ? "#059669"
                    : type === "error"
                        ? "#dc2626"
                        : "#1e293b"
            };
            color:white;
            padding:12px 18px;
            border-radius:8px;
            font-size:.85rem;
            font-weight:500;
            box-shadow:0 10px 15px -3px rgba(0,0,0,.1);
        `;

        container.appendChild(
            toast
        );

        setTimeout(
            () => toast.remove(),
            4000
        );
    }
}

window.SyncManager =
    new SyncManager();