// Profile page logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Fetch authenticated user details from backend (/auth/me)
    const valName = document.getElementById("valName");
    const valEmail = document.getElementById("valEmail");
    const valPhone = document.getElementById("valPhone");
    const displayName = document.getElementById("displayName");
    const avatarBadge = document.getElementById("avatarBadge");

    const res = await getCurrentUser();
    if (res.success && res.data) {
        const user = res.data;
        if (valName) valName.textContent = user.full_name || "User";
        if (valEmail) valEmail.textContent = user.email || "";
        if (displayName) displayName.textContent = user.full_name || user.email.split('@')[0];
        
        if (avatarBadge) {
            const name = user.full_name || user.email;
            const parts = name.trim().split(" ");
            let initials = parts[0].charAt(0).toUpperCase();
            if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
            avatarBadge.textContent = initials;
        }
    } else {
        const email = localStorage.getItem("userEmail");
        if (email && valEmail) valEmail.textContent = email;
    }

    // 2. Header & Logout Navigation Handlers
    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    const notifBtn = document.querySelector('.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            logoutUser();
        });
    });

    // 3. Offline storage & Sync summary handlers
    const syncSummaryEl = document.getElementById("profile-sync-summary");
    if (syncSummaryEl && window.OfflineDB) {
        try {
            const pending = await window.OfflineDB.getPendingSyncActions();
            const total = await window.OfflineDB.getAllSyncActions();
            syncSummaryEl.textContent = `${pending.length} pending actions (${total.length} total synced/recorded).`;
        } catch (e) {
            syncSummaryEl.textContent = "Offline storage active (IndexedDB).";
        }
    }

    const btnClearCache = document.getElementById("btnClearOfflineCache");
    if (btnClearCache) {
        btnClearCache.addEventListener("click", async () => {
            if (confirm("Are you sure you want to purge all cached personal healthcare records and pending appointment drafts on this device?")) {
                if (window.OfflineDB) {
                    await window.OfflineDB.clearUserData();
                    alert("Local health cache purged successfully.");
                    window.location.reload();
                }
            }
        });
    }

    console.log("profile.js loaded. Live profile details active.");
});


