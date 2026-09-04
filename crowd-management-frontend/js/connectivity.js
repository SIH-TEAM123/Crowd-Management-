/**
 * Symmetry Healthcare Platform - Connectivity Manager
 * Manages ONLINE, LIMITED, and OFFLINE states with backend reachability checks.
 */

const CONNECTIVITY_STATES = {
    ONLINE: 'ONLINE',
    LIMITED: 'LIMITED',
    OFFLINE: 'OFFLINE'
};

class ConnectivityManager {
    constructor() {
        this.status = navigator.onLine ? CONNECTIVITY_STATES.ONLINE : CONNECTIVITY_STATES.OFFLINE;
        this.lastChecked = null;
        this.lastSuccessfulCheck = null;
        this.listeners = [];
        this.checkTimer = null;
        this.isChecking = false;
        this.pingTimeoutMs = 5000;
        this.periodicIntervalMs = 30000; // 30 seconds
    }

    init() {
        // Window offline/online event listeners
        window.addEventListener('online', () => {
            console.log('[Connectivity] Browser reported ONLINE. Checking backend reachability...');
            this.checkNow();
        });

        window.addEventListener('offline', () => {
            console.log('[Connectivity] Browser reported OFFLINE.');
            this.setStatus(CONNECTIVITY_STATES.OFFLINE);
        });

        // Initial reachability check
        this.checkNow();

        // Start low-frequency periodic check
        this.startPeriodicCheck();

        // Initial UI render
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.renderUI());
        } else {
            this.renderUI();
        }
    }

    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    notifyListeners(newStatus, oldStatus) {
        this.listeners.forEach(cb => {
            try {
                cb(newStatus, oldStatus);
            } catch (err) {
                console.error('[Connectivity] Error in status change listener:', err);
            }
        });
        window.dispatchEvent(new CustomEvent('connectivity-change', {
            detail: { status: newStatus, previous: oldStatus, timestamp: new Date().toISOString() }
        }));
    }

    setStatus(newStatus) {
        const oldStatus = this.status;
        this.status = newStatus;
        this.lastChecked = new Date();

        if (newStatus === CONNECTIVITY_STATES.ONLINE) {
            this.lastSuccessfulCheck = new Date();
        }

        if (oldStatus !== newStatus) {
            console.log(`[Connectivity] Status changed: ${oldStatus} -> ${newStatus}`);
            this.notifyListeners(newStatus, oldStatus);
            this.renderUI();

            // When returning ONLINE, trigger automatic sync queue processing
            if (newStatus === CONNECTIVITY_STATES.ONLINE && window.SyncManager) {
                window.SyncManager.processSyncQueue();
            }
        } else {
            this.renderUI();
        }
    }

    getStatus() {
        return this.status;
    }

    isOnline() {
        return this.status === CONNECTIVITY_STATES.ONLINE;
    }

    isOffline() {
        return this.status === CONNECTIVITY_STATES.OFFLINE;
    }

    isLimited() {
        return this.status === CONNECTIVITY_STATES.LIMITED;
    }

    /**
     * Check backend reachability with a timeout
     */
    async checkNow() {
        if (!navigator.onLine) {
            this.setStatus(CONNECTIVITY_STATES.OFFLINE);
            return CONNECTIVITY_STATES.OFFLINE;
        }

        if (this.isChecking) return this.status;
        this.isChecking = true;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.pingTimeoutMs);

        const baseUrl = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.LOCAL_BACKEND_URL || 'http://127.0.0.1:8000'));

        try {
            const res = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                this.setStatus(CONNECTIVITY_STATES.ONLINE);
            } else {
                this.setStatus(CONNECTIVITY_STATES.LIMITED);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (navigator.onLine) {
                // Browser online, but backend ping timed out or failed
                this.setStatus(CONNECTIVITY_STATES.LIMITED);
            } else {
                this.setStatus(CONNECTIVITY_STATES.OFFLINE);
            }
        } finally {
            this.isChecking = false;
        }

        return this.status;
    }

    startPeriodicCheck() {
        if (this.checkTimer) clearInterval(this.checkTimer);
        this.checkTimer = setInterval(() => {
            this.checkNow();
        }, this.periodicIntervalMs);
    }

    /**
     * Render global top connectivity banner and status pill
     */
    renderUI() {
        let banner = document.getElementById('global-connectivity-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'global-connectivity-banner';
            banner.className = 'connectivity-banner';
            document.body.prepend(banner);
        }

        let content = '';
        let bannerClass = 'connectivity-banner';

        if (this.status === CONNECTIVITY_STATES.ONLINE) {
            bannerClass += ' conn-status-online';
            content = `
                <div class="conn-inner">
                    <span class="conn-dot dot-online"></span>
                    <span class="conn-text">Online — Data synchronized</span>
                    <button class="conn-action-btn" onclick="window.Connectivity.checkNow()">Check</button>
                </div>
            `;
            // Auto hide online banner after 3 seconds if not clicked
            setTimeout(() => {
                if (this.status === CONNECTIVITY_STATES.ONLINE && banner) {
                    banner.classList.add('conn-banner-hidden');
                }
            }, 3000);
        } else if (this.status === CONNECTIVITY_STATES.LIMITED) {
            bannerClass += ' conn-status-limited';
            banner.classList.remove('conn-banner-hidden');
            content = `
                <div class="conn-inner">
                    <span class="conn-dot dot-limited"></span>
                    <span class="conn-text"><strong>Limited Connectivity</strong> — Backend requests slow/unreachable. Showing cached information.</span>
                    <button class="conn-action-btn" onclick="window.Connectivity.checkNow()">Retry</button>
                    <button class="conn-action-btn" onclick="window.SyncManager && window.SyncManager.openSyncCenter()">Sync Center</button>
                </div>
            `;
        } else {
            // OFFLINE
            bannerClass += ' conn-status-offline';
            banner.classList.remove('conn-banner-hidden');
            content = `
                <div class="conn-inner">
                    <span class="conn-dot dot-offline"></span>
                    <span class="conn-text"><strong>Offline Mode</strong> — Operating offline. Showing last synced healthcare data.</span>
                    <button class="conn-action-btn" onclick="window.Connectivity.checkNow()">Retry</button>
                    <button class="conn-action-btn" onclick="window.SyncManager && window.SyncManager.openSyncCenter()">Sync Center</button>
                </div>
            `;
        }

        banner.className = bannerClass;
        banner.innerHTML = content;

        // Also update any inline status badges on page
        const badges = document.querySelectorAll('.connectivity-status-pill');
        badges.forEach(pill => {
            if (this.status === CONNECTIVITY_STATES.ONLINE) {
                pill.className = 'connectivity-status-pill pill-online';
                pill.innerHTML = `<span class="pill-dot"></span> Online`;
            } else if (this.status === CONNECTIVITY_STATES.LIMITED) {
                pill.className = 'connectivity-status-pill pill-limited';
                pill.innerHTML = `<span class="pill-dot"></span> Limited`;
            } else {
                pill.className = 'connectivity-status-pill pill-offline';
                pill.innerHTML = `<span class="pill-dot"></span> Offline`;
            }
        });
    }
}

// Global Singleton Instance
window.Connectivity = new ConnectivityManager();
window.Connectivity.init();
