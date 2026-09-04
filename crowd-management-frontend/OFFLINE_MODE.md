# Task 14 — Offline / Low-Connectivity Healthcare Mode Documentation

## 1. Overview & Guiding Philosophy

> **Core Healthcare Principle:**
> *"Connectivity should affect synchronization speed, not access to essential healthcare information."*

In rural, primary, and intermittent-connectivity healthcare settings (e.g. Sub-Centers and remote Primary Health Centres), network reachability can fluctuate continuously. Symmetry's offline architecture ensures that doctors, frontline healthcare workers, and patients can browse previously cached directories (facilities, doctors, diagnostic tests, essential medicines), view upcoming appointments, inspect active queue positions, and draft new appointment bookings completely offline.

---

## 2. Architecture & Layered Defense

```
+-----------------------------------------------------------------------------------+
|                                 USER INTERFACE                                    |
|   (Banners, Stale Timestamps, Cached Availability Badges, Sync Center Modal)     |
+-----------------------------------------------------------------------------------+
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
+------------------------------------+      +--------------------------------------+
|        Connectivity Manager        |      |             Sync Manager             |
|   (js/connectivity.js)             |      |   (js/sync-manager.js)               |
|   - Tri-state: ONLINE/LIMITED/OFF  |      |   - Background FIFO replay queue     |
|   - /health reachability probe     |      |   - HTTP 409 Conflict resolution     |
|   - Reconnect event dispatcher     |      |   - Interactive Sync Center UI       |
+------------------------------------+      +--------------------------------------+
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
+-----------------------------------------------------------------------------------+
|                        API Client Layer (js/api.js)                               |
|   - fetchWithOfflineCache(url, store, options)                                    |
|   - Offline queueing: createAppointment() -> OFF-YYYYMMDD-HHMM-xxx                |
|   - Privacy purge: logoutUser() -> clearUserData()                                |
+-----------------------------------------------------------------------------------+
                   │                                           │
         (Dynamic Data Mutations)                     (Static Assets & Shell)
                   ▼                                           ▼
+------------------------------------+      +--------------------------------------+
|         IndexedDB Storage          |      |     Service Worker & Cache API       |
|   (js/offline-db.js)               |      |   (service-worker.js)                |
|   Database: crowd-management-offline|      |   Cache: sih-static-shell-v1         |
|   11 Dedicated Object Stores       |      |   - Precaches HTML, CSS, JS, Fonts   |
|   - facilities, slots, queue...    |      |   - Bypasses /auth/ & /api/ routes   |
+------------------------------------+      +--------------------------------------+
```

---

## 3. Storage Separation & Privacy Policy

| Layer | Storage Technology | Scope / Contents | Caching Policy | Privacy & Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Static App Shell** | Cache API (`sih-static-shell-v1`) | HTML pages, CSS stylesheets, Vanilla JS controllers, Web fonts, PWA manifest | Stale-While-Revalidate & Network-First navigation fallback | **Zero PHI/PII.** Explicitly bypasses all `/auth/`, `/appointments`, and REST API endpoints. |
| **Dynamic Healthcare Cache** | IndexedDB (`crowd-management-offline`) | Facilities, OPD Departments, Doctor Slots, Test Catalogs, Medicine Stock, User Appointments | Cache-on-Successful-Fetch (`putMany` / `put`) | **Scoped to Device.** Automatically purged on user logout or manual privacy purge via `OfflineDB.clearUserData()`. |
| **Pending Mutation Queue** | IndexedDB (`sync_queue` store) | Outgoing mutations drafted offline (`CREATE_APPOINTMENT`) | Durable FIFO queue with status tracking (`PENDING`, `SYNCED`, `CONFLICT`, `FAILED`) | Retains idempotency payloads until synced; purged on explicit logout. |

---

## 4. IndexedDB Schema Specification

**Database Name:** `crowd-management-offline`  
**Current Version:** `1`

### Object Stores
1. `meta`: Stores synchronization timestamps (`key: "last_sync_<store>"`).
2. `facilities`: Healthcare facility directory and metadata.
3. `departments`: OPD department catalog per facility (`facility_id`).
4. `specialists`: Doctor profiles, qualifications, and specializations.
5. `slots`: Date/specialist time slots (`[specialist_id+date]`).
6. `appointments`: User appointment records and offline drafts (`id`).
7. `referrals`: Active transfer and referral records (`id`).
8. `diagnostics`: Laboratory and diagnostic test catalog (`id`).
9. `medicines`: Essential drug stock and availability info (`id`).
10. `operational_states`: Crowd occupancy, capacity, and operational telemetry.
11. `sync_queue`: Action mutation log (`id`, `action_type`, `payload`, `status`, `timestamp`, `error`).

---

## 5. Tri-State Connectivity Engine

The frontend maintains real-time connectivity status via `window.Connectivity`:

- 🟢 **ONLINE**: Active internet connection and successful 5-second `/health` backend ping.
- 🟡 **LIMITED**: Browser reports online, but backend health probes are timing out or slow (>3.5s latency).
- 🔴 **OFFLINE**: Browser network adapter offline (`navigator.onLine === false`) or backend unreachable.

### Visual State Feedback
When offline or degraded:
- A persistent warning banner appears at the top of the viewport.
- Data cards display **"Last known state • Synced X min ago"** (e.g., `⚠️ Cached availability — will be verified when connection returns`).
- All real-time badges (Live, Serving) downgrade to **"LAST KNOWN"** or **"CACHED"**.

---

## 6. Offline Appointment Booking & Conflict Protocol

### Step 1: Offline Creation
When `createAppointment()` is invoked while offline:
1. Generates an offline reference token: `OFF-YYYYMMDD-HHMM-xxx` (e.g. `OFF-20260904-1430-842`).
2. Stores the draft in IndexedDB `appointments` with `status: 'PENDING_SYNC'`.
3. Adds a mutation entry into IndexedDB `sync_queue` with status `'PENDING'`.
4. Returns a success-equivalent response without inventing authoritative sequential token numbers or fake queue numbers.
5. Displays a clear confirmation modal explaining that the appointment is queued locally and will synchronize once connected.

### Step 2: Automatic Reconnection & Sync Replay
1. When `Connectivity` transitions to `ONLINE`, it dispatches a `'network-status-change'` event.
2. `SyncManager.processSyncQueue()` activates automatically in the background.
3. It replays each pending action against the authoritative FastAPI backend (`POST /appointments`).

### Step 3: Conflict Resolution (HTTP 409)
- **Success (HTTP 201):** The real token and appointment ID replace the `OFF-` temporary record in IndexedDB.
- **Slot Conflict (HTTP 409):** If another patient booked the slot while offline:
  - Action status is updated to `CONFLICT`.
  - Local appointment card updates to badge `SLOT UNAVAILABLE` (`badge-conflict`).
  - An interactive notification prompts the user to select an alternate slot.
  - **No silent failures; no fake tokens.**

---

## 7. Operational Capabilities Matrix

| System Capability | Online / Connected | Low Connectivity (Limited) | Fully Offline |
| :--- | :---: | :---: | :---: |
| **Browse Facilities & OPD Clinics** | ✅ Live API | 🟡 Cached IndexedDB | 🟡 Cached IndexedDB |
| **Browse Doctor Profiles & Slots** | ✅ Live API | 🟡 Cached (with warning) | 🟡 Cached (with warning) |
| **Search Diagnostics & Tests** | ✅ Live API | 🟡 Cached Directory | 🟡 Cached Directory |
| **Search Medicine Stock & Quantities** | ✅ Live Stock | 🟡 Last Known Stock | 🟡 Last Known Stock |
| **Book OPD Appointment** | ✅ Instant Token | 🟡 Instant Token / Queue | ⏳ Local Draft (`OFF-xxxx`) |
| **Emergency Priority Dispatch** | ✅ Authoritative | ✅ Authoritative | 🛑 Live Hospital Only |
| **Live Queue Progress Telemetry** | ✅ Live WebSocket/API | 🟡 Last Known Position | 🟡 Last Known Snapshot |
| **Facility Routing Recommendation** | ✅ Live Engine | 🟡 Static Distance Only | 🟡 Static Distance Only |
| **Referral Lifecycle Actions** | ✅ Live Transitions | 🟡 Live Transitions | 🛑 Disabled Offline |

---

## 8. Privacy & Shared Device Compliance

Public healthcare centers often share tablet and workstation hardware:
- Logging out (`logoutUser()`) executes `OfflineDB.clearUserData()`.
- This scrubs all patient appointment drafts, referral records, and sync queues from IndexedDB while preserving the static facility and test catalogs.
- Users can manually trigger **"Clear Offline Health Cache"** at any time from `profile.html`.
