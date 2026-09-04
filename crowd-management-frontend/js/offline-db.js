/**
 * Symmetry Healthcare Platform - IndexedDB Offline Storage Utility
 * Database Name: crowd-management-offline
 * Version: 1
 */

const DB_NAME = 'crowd-management-offline';
const DB_VERSION = 1;

const STORES = [
    { name: 'meta', keyPath: 'key' },
    { name: 'facilities', keyPath: 'id' },
    { name: 'departments', keyPath: 'id' },
    { name: 'specialists', keyPath: 'id' },
    { name: 'slots', keyPath: 'id' },
    { name: 'appointments', keyPath: 'id' },
    { name: 'referrals', keyPath: 'id' },
    { name: 'diagnostics', keyPath: 'id' },
    { name: 'medicines', keyPath: 'id' },
    { name: 'operational_states', keyPath: 'facility_id' },
    { name: 'sync_queue', keyPath: 'id', autoIncrement: true, indexes: [{ name: 'status', keyPath: 'status' }, { name: 'localReference', keyPath: 'localReference', unique: true }] }
];

let dbPromise = null;

/**
 * Open or initialize the IndexedDB connection
 */
function getOfflineDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            console.warn('[OfflineDB] IndexedDB is not supported in this browser.');
            return resolve(null);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log(`[OfflineDB] Upgrading schema to version ${DB_VERSION}...`);

            STORES.forEach(storeConfig => {
                if (!db.objectStoreNames.contains(storeConfig.name)) {
                    const opts = { keyPath: storeConfig.keyPath };
                    if (storeConfig.autoIncrement) opts.autoIncrement = true;
                    const store = db.createObjectStore(storeConfig.name, opts);

                    if (storeConfig.indexes) {
                        storeConfig.indexes.forEach(idx => {
                            store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique });
                        });
                    }
                }
            });
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('[OfflineDB] Failed to open IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });

    return dbPromise;
}

/**
 * Put a single item into a store with timestamps
 */
async function putOfflineItem(storeName, item) {
    const db = await getOfflineDB();
    if (!db) return null;

    const record = {
        ...item,
        _cachedAt: item._cachedAt || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(record);

        req.onsuccess = () => resolve(record);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Put multiple items into a store in a single transaction
 */
async function putOfflineItems(storeName, items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const db = await getOfflineDB();
    if (!db) return [];

    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);

        items.forEach(item => {
            if (item) {
                store.put({
                    ...item,
                    _cachedAt: item._cachedAt || now
                });
            }
        });

        tx.oncomplete = () => {
            setLastSyncTime(storeName, now);
            resolve(items);
        };
        tx.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Get an item by its primary key
 */
async function getOfflineItem(storeName, key) {
    const db = await getOfflineDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Get all items from a store
 */
async function getAllOfflineItems(storeName) {
    const db = await getOfflineDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Delete a record by key
 */
async function deleteOfflineItem(storeName, key) {
    const db = await getOfflineDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Clear all items in a store
 */
async function clearOfflineStore(storeName) {
    const db = await getOfflineDB();
    if (!db) return false;

    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Store metadata sync timestamp
 */
async function setLastSyncTime(storeName, timestamp = new Date().toISOString()) {
    try {
        await putOfflineItem('meta', {
            key: `last_sync_${storeName}`,
            value: timestamp,
            updatedAt: timestamp
        });
    } catch (e) {
        console.warn(`[OfflineDB] Could not set last sync for ${storeName}:`, e);
    }
}

/**
 * Retrieve metadata sync timestamp
 */
async function getLastSyncTime(storeName) {
    try {
        const record = await getOfflineItem('meta', `last_sync_${storeName}`);
        return record ? record.value : null;
    } catch (e) {
        return null;
    }
}

/**
 * Add an offline action to the sync queue
 */
async function addSyncAction(actionType, payload, localReference = null) {
    const ref = localReference || `OFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const action = {
        actionType,
        payload,
        localReference: ref,
        status: 'PENDING', // PENDING, SYNCING, COMPLETED, CONFLICT, SYNC_REVIEW
        createdAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
        attemptedAt: null
    };

    const db = await getOfflineDB();
    if (!db) return action;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['sync_queue'], 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.add(action);

        req.onsuccess = (e) => {
            action.id = e.target.result;
            resolve(action);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Get all pending sync actions
 */
async function getPendingSyncActions() {
    const db = await getOfflineDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['sync_queue'], 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();

        req.onsuccess = () => {
            const all = req.result || [];
            // Filter pending actions
            const pending = all.filter(a => a.status === 'PENDING' || a.status === 'SYNCING');
            resolve(pending);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Get all sync actions (for Sync Center UI)
 */
async function getAllSyncActions() {
    return getAllOfflineItems('sync_queue');
}

/**
 * Update a sync action record
 */
async function updateSyncAction(id, updates) {
    const db = await getOfflineDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['sync_queue'], 'readwrite');
        const store = tx.objectStore('sync_queue');
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const existing = getReq.result;
            if (!existing) return resolve(null);

            const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
            const putReq = store.put(merged);
            putReq.onsuccess = () => resolve(merged);
            putReq.onerror = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Clear user-specific cached data on logout for privacy
 */
async function clearUserData() {
    try {
        console.log('[OfflineDB] Clearing user-specific offline caches on logout...');
        await clearOfflineStore('appointments');
        await clearOfflineStore('referrals');
        await clearOfflineStore('sync_queue');
        await putOfflineItem('meta', { key: 'currentUser', value: null, updatedAt: new Date().toISOString() });
        return true;
    } catch (e) {
        console.warn('[OfflineDB] Error clearing user offline data:', e);
        return false;
    }
}

/**
 * Format relative stale timestamp for UI badges
 */
function formatStaleTime(isoString) {
    if (!isoString) return 'May be outdated';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'May be outdated';

    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

// Global Export
window.OfflineDB = {
    getOfflineDB,
    put: putOfflineItem,
    putMany: putOfflineItems,
    get: getOfflineItem,
    getAll: getAllOfflineItems,
    deleteRecord: deleteOfflineItem,
    clearStore: clearOfflineStore,
    setLastSync: setLastSyncTime,
    getLastSync: getLastSyncTime,
    addSyncAction,
    getPendingSyncActions,
    getAllSyncActions,
    updateSyncAction,
    clearUserData,
    formatStaleTime
};
