/**
 * Symmetry Healthcare Platform - Sync Manager
 * Manages background synchronization of offline mutations against authoritative backend APIs.
 */

class SyncManager {
    constructor() {
        this.isSyncing = false;
    }

    /**
     * Process all pending actions in the sync queue
     */
    async processSyncQueue() {
        if (this.isSyncing) {
            console.log('[SyncManager] Sync already in progress, skipping...');
            return;
        }

        if (!window.Connectivity || !window.Connectivity.isOnline()) {
            console.log('[SyncManager] Cannot sync: connectivity is not ONLINE.');
            return;
        }

        this.isSyncing = true;
        console.log('[SyncManager] Starting sync queue processing...');

        try {
            const pendingActions = await window.OfflineDB.getPendingSyncActions();
            if (pendingActions.length === 0) {
                console.log('[SyncManager] No pending actions to sync.');
                this.isSyncing = false;
                this.renderSyncCenterModal();
                return;
            }

            console.log(`[SyncManager] Found ${pendingActions.length} pending action(s) to process.`);

            for (const action of pendingActions) {
                await this.processSingleAction(action);
            }

            // After processing, notify UI
            window.dispatchEvent(new CustomEvent('sync-queue-updated', {
                detail: { timestamp: new Date().toISOString() }
            }));
        } catch (error) {
            console.error('[SyncManager] Error during sync queue processing:', error);
        } finally {
            this.isSyncing = false;
            this.renderSyncCenterModal();
        }
    }

    /**
     * Process a single sync action
     */
    async processSingleAction(action) {
        if (!action || !action.id) return;

        // Mark action as SYNCING
        await window.OfflineDB.updateSyncAction(action.id, {
            status: 'SYNCING',
            attemptedAt: new Date().toISOString(),
            retryCount: (action.retryCount || 0) + 1
        });

        if (action.actionType === 'CREATE_APPOINTMENT') {
            await this.syncAppointmentAction(action);
        } else {
            console.warn('[SyncManager] Unknown action type:', action.actionType);
            await window.OfflineDB.updateSyncAction(action.id, {
                status: 'SYNC_REVIEW',
                lastError: 'Unsupported action type'
            });
        }
    }

    /**
     * Synchronize an offline appointment creation request
     */
    async syncAppointmentAction(action) {
        const payload = action.payload;
        const localRef = action.localReference;

        try {
            // Call existing bookAppointment API
            const result = await bookAppointment(payload);

            if (result && result.success && result.data) {
                const serverAppt = result.data;
                console.log('[SyncManager] Appointment synced successfully with server ID:', serverAppt.id, 'Token:', serverAppt.token_number);

                // Update action in sync_queue
                await window.OfflineDB.updateSyncAction(action.id, {
                    status: 'COMPLETED',
                    serverId: serverAppt.id,
                    tokenNumber: serverAppt.token_number,
                    completedAt: new Date().toISOString(),
                    lastError: null
                });

                // Update or replace local appointment in IndexedDB
                if (localRef) {
                    await window.OfflineDB.deleteRecord('appointments', localRef);
                }
                await window.OfflineDB.put('appointments', {
                    ...serverAppt,
                    _cachedAt: new Date().toISOString(),
                    _synced: true,
                    _localReference: localRef
                });

                // Refresh appointments list if function is present
                if (typeof loadAppointments === 'function') {
                    loadAppointments();
                }

                // Show success toast
                this.showToast(`✅ Offline appointment confirmed! Token: #${serverAppt.token_number || serverAppt.id}`, 'success');
            } else {
                const status = result ? result.status : 0;
                const errorMsg = result ? result.message : 'Unknown server error';

                if (status === 409) {
                    // Slot conflict!
                    console.warn('[SyncManager] Conflict on appointment slot:', errorMsg);
                    await window.OfflineDB.updateSyncAction(action.id, {
                        status: 'CONFLICT',
                        lastError: 'The selected slot is no longer available. Your offline request could not be confirmed.',
                        conflictAt: new Date().toISOString()
                    });

                    // Mark local appointment record as conflict
                    if (localRef) {
                        const localAppt = await window.OfflineDB.get('appointments', localRef);
                        if (localAppt) {
                            localAppt.status = 'CONFLICT';
                            localAppt.sync_error = 'Slot is no longer available';
                            await window.OfflineDB.put('appointments', localAppt);
                        }
                    }

                    this.showToast(`⚠️ Slot unavailable for offline request ${localRef}. Please choose another slot.`, 'error');
                } else if (status === 401 || status === 403) {
                    console.warn('[SyncManager] Authentication failure during sync.');
                    await window.OfflineDB.updateSyncAction(action.id, {
                        status: 'SYNC_REVIEW',
                        lastError: 'Authentication expired. Please log in again to sync this appointment.'
                    });
                } else if (status === 422) {
                    console.warn('[SyncManager] Validation error during sync:', errorMsg);
                    await window.OfflineDB.updateSyncAction(action.id, {
                        status: 'SYNC_REVIEW',
                        lastError: `Validation error: ${errorMsg}`
                    });
                } else {
                    // Unexpected server error (5xx, etc.) — outcome is UNKNOWN.
                    // Do NOT re-queue as PENDING to avoid infinite retry loops.
                    console.warn('[SyncManager] Unexpected server error during sync:', errorMsg);
                    await window.OfflineDB.updateSyncAction(action.id, {
                        status: 'SYNC_REVIEW',
                        lastError: `Server error (${status}): ${errorMsg}. Outcome unknown — please verify your appointment before retrying.`
                    });
                    this.showToast(`⚠️ Sync failed for ${localRef}. Server returned an unexpected error. Please verify your appointment manually.`, 'error');
                }
            }
        } catch (err) {
            console.error('[SyncManager] Exception during appointment sync:', err);
            // Network-level exception: request may or may not have reached the server.
            // Mark SYNC_REVIEW so the user can verify before retrying.
            // Do NOT re-queue as PENDING to prevent indefinite retry loops.
            await window.OfflineDB.updateSyncAction(action.id, {
                status: 'SYNC_REVIEW',
                lastError: `Network exception: ${err.message || 'Connection failure'}. Request outcome is unknown — verify this appointment before retrying.`
            });
            this.showToast(`⚠️ Network error syncing ${localRef}. Outcome unknown — please verify this appointment.`, 'error');
        }
    }

    /**
     * Open the Sync Center Modal UI
     */
    async openSyncCenter() {
        let modal = document.getElementById('syncCenterModal');
        if (!modal) {
            this.createSyncCenterDOM();
            modal = document.getElementById('syncCenterModal');
        }

        await this.renderSyncCenterModal();
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * Close the Sync Center Modal UI
     */
    closeSyncCenter() {
        const modal = document.getElementById('syncCenterModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Create base modal DOM for Sync Center
     */
    createSyncCenterDOM() {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'syncCenterModal';
        modalDiv.className = 'modal-backdrop';
        modalDiv.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:10000; align-items:center; justify-content:center;';

        modalDiv.innerHTML = `
            <div class="modal-card" style="background:white; border-radius:16px; width:92%; max-width:540px; max-height:85vh; overflow-y:auto; padding:24px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
                    <div>
                        <h3 style="margin:0; font-size:1.2rem; font-weight:700; color:#0f172a;">Sync Center</h3>
                        <p style="margin:2px 0 0 0; font-size:0.8rem; color:#64748b;">Offline Mutations & Synchronization Status</p>
                    </div>
                    <button onclick="window.SyncManager.closeSyncCenter()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;">&times;</button>
                </div>

                <div id="syncCenterStats" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:16px;"></div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="font-size:0.85rem; font-weight:600; color:#334155;">Queued Actions</span>
                    <button id="manualSyncBtn" onclick="window.SyncManager.processSyncQueue()" style="padding:6px 14px; background:#7c3aed; color:white; border:none; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <span>↻</span> Sync Now
                    </button>
                </div>

                <div id="syncCenterList" style="margin-bottom:16px;"></div>

                <div style="border-top:1px solid #e2e8f0; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span id="syncCenterLastSync" style="font-size:0.75rem; color:#64748b;">Last Sync Check: --</span>
                    <button onclick="window.SyncManager.closeSyncCenter()" style="padding:8px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.85rem;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    /**
     * Render the contents of Sync Center Modal
     */
    async renderSyncCenterModal() {
        const statsEl = document.getElementById('syncCenterStats');
        const listEl = document.getElementById('syncCenterList');
        const lastSyncEl = document.getElementById('syncCenterLastSync');
        if (!statsEl || !listEl) return;

        const allActions = await window.OfflineDB.getAllSyncActions();
        const pending = allActions.filter(a => a.status === 'PENDING' || a.status === 'SYNCING');
        const completed = allActions.filter(a => a.status === 'COMPLETED');
        const conflicts = allActions.filter(a => a.status === 'CONFLICT');
        const review = allActions.filter(a => a.status === 'SYNC_REVIEW');

        statsEl.innerHTML = `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:1.1rem; font-weight:700; color:#eab308;">${pending.length}</div>
                <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;">Pending</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:1.1rem; font-weight:700; color:#10b981;">${completed.length}</div>
                <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;">Completed</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:1.1rem; font-weight:700; color:#ef4444;">${conflicts.length}</div>
                <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;">Conflicts</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:1.1rem; font-weight:700; color:#6366f1;">${review.length}</div>
                <div style="font-size:0.7rem; color:#64748b; text-transform:uppercase;">Review</div>
            </div>
        `;

        if (allActions.length === 0) {
            listEl.innerHTML = `
                <div style="padding:24px; text-align:center; color:#94a3b8; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1; font-size:0.85rem;">
                    No pending offline requests. All data is synchronized.
                </div>
            `;
        } else {
            // Sort recent first
            allActions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            allActions.forEach(action => {
                let badgeColor = '#eab308';
                let badgeText = action.status;
                if (action.status === 'COMPLETED') badgeColor = '#10b981';
                if (action.status === 'CONFLICT') badgeColor = '#ef4444';
                if (action.status === 'SYNC_REVIEW') badgeColor = '#6366f1';

                html += `
                    <div style="border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; background:#fff; font-size:0.825rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:600; color:#1e293b;">${action.localReference || 'Action #' + action.id}</span>
                            <span style="padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; color:white; background:${badgeColor};">${badgeText}</span>
                        </div>
                        <div style="color:#64748b; font-size:0.75rem; margin-bottom:4px;">
                            Type: ${action.actionType} • Created: ${action.createdAt ? new Date(action.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}
                        </div>
                        ${action.tokenNumber ? `<div style="font-weight:600; color:#7c3aed;">Authoritative Token: #${action.tokenNumber}</div>` : ''}
                        ${action.lastError ? `<div style="color:#dc2626; font-size:0.75rem; margin-top:4px;">⚠️ ${action.lastError}</div>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            listEl.innerHTML = html;
        }

        if (lastSyncEl && window.Connectivity) {
            const last = window.Connectivity.lastSuccessfulCheck;
            lastSyncEl.textContent = `Last Backend Check: ${last ? last.toLocaleTimeString() : 'Never'}`;
        }
    }

    /**
     * Helper to show brief toast notification
     */
    showToast(message, type = 'info') {
        let toastContainer = document.getElementById('global-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'global-toast-container';
            toastContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:11000; display:flex; flex-direction:column; gap:8px;';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        let bg = '#1e293b';
        if (type === 'success') bg = '#059669';
        if (type === 'error') bg = '#dc2626';

        toast.style.cssText = `background:${bg}; color:white; padding:12px 18px; border-radius:8px; font-size:0.85rem; font-weight:500; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); opacity:0; transform:translateY(10px); transition:all 0.3s ease; max-width:320px;`;
        toast.textContent = message;

        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Global Singleton Instance
window.SyncManager = new SyncManager();
