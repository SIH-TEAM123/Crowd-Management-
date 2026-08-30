// Dashboard logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", async () => {
    // 0. Fetch logged-in user profile from FastAPI backend (/auth/me)
    const welcomeUserEl = document.getElementById("welcomeUser");
    const userProfileAvatar = document.querySelector(".profile-badge .profile-avatar");

    const userResult = await getCurrentUser();
    if (userResult.success && userResult.data) {
        const user = userResult.data;
        if (welcomeUserEl) {
            welcomeUserEl.textContent = `Welcome back, ${user.full_name || user.email.split('@')[0]}.`;
        }
        if (userProfileAvatar) {
            userProfileAvatar.textContent = (user.full_name ? user.full_name.charAt(0) : user.email.charAt(0)).toUpperCase();
        }
    } else {
        const storedEmail = localStorage.getItem("userEmail");
        if (welcomeUserEl && storedEmail) {
            welcomeUserEl.textContent = `Welcome back, ${storedEmail.split('@')[0]}.`;
        }
    }

    // 1. Dynamic Date and Time Updater
    const dateTimeElement = document.getElementById("currentDateTime");
    
    function updateDateTime() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        if (dateTimeElement) {
            dateTimeElement.textContent = `${dateStr} • ${timeStr}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // 2. Load active token state if present
    const activeToken = getActiveToken();
    if (activeToken) {
        updateDashboardTokenDisplay(activeToken);
    }

    // 3. Normal Booking Button ("Book Token")
    const bookTokenBtn = document.getElementById("btnCreateAppt");
    if (bookTokenBtn) {
        bookTokenBtn.addEventListener("click", async () => {
            bookTokenBtn.disabled = true;
            const orig = bookTokenBtn.textContent;
            bookTokenBtn.textContent = "Requesting...";

            const res = await createToken("NORMAL");
            bookTokenBtn.disabled = false;
            bookTokenBtn.textContent = orig;

            if (res.success && res.data) {
                updateDashboardTokenDisplay(res.data);
                showQRModal(res.data);
            } else {
                alert(res.message || "Failed to book normal token. Check backend service.");
            }
        });
    }

    // 4. Emergency Booking Button & Modal Setup
    const emergencyBtn = document.getElementById("btnEmergencyBooking");
    const emergencyModal = document.getElementById("emergencyModal");
    const closeEmergencyModal = document.getElementById("closeEmergencyModal");
    const cancelEmergencyBtn = document.getElementById("cancelEmergencyBtn");
    const emergencyForm = document.getElementById("emergencyForm");

    if (emergencyBtn && emergencyModal) {
        emergencyBtn.addEventListener("click", () => {
            emergencyModal.style.display = "flex";
        });
    }

    function hideEmergencyModal() {
        if (emergencyModal) emergencyModal.style.display = "none";
    }

    if (closeEmergencyModal) closeEmergencyModal.addEventListener("click", hideEmergencyModal);
    if (cancelEmergencyBtn) cancelEmergencyBtn.addEventListener("click", hideEmergencyModal);

    if (emergencyForm) {
        emergencyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emergencyType = document.getElementById("emergencyTypeSelect")?.value || "GENERAL_EMERGENCY";
            const emergencyDetails = document.getElementById("emergencyDetailsInput")?.value || "";

            const submitBtn = document.getElementById("submitEmergencyBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submitting to P5 Backend...";
            }

            // Execute ACTUAL Emergency Token request via POST /tokens (TIME_CRITICAL)
            const result = await createToken("TIME_CRITICAL", {
                emergency_type: emergencyType,
                emergency_details: emergencyDetails
            });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Emergency Request";
            }

            hideEmergencyModal();

            if (result.success && result.data) {
                const tokenData = result.data;
                updateDashboardTokenDisplay(tokenData);
                showQRModal(tokenData, true);
            } else {
                alert(result.message || "Emergency request submission failed. Please try again.");
            }
        });
    }

    // 5. QR Code Modal Handlers
    const qrModal = document.getElementById("qrModal");
    const closeQrModal = document.getElementById("closeQrModal");
    const doneQrBtn = document.getElementById("doneQrBtn");

    function showQRModal(tokenData, isEmergency = false) {
        const qrDisplay = document.getElementById("qrModalDisplay");
        const tokenRef = document.getElementById("qrModalTokenRef");
        const statusEl = document.getElementById("qrModalStatus");

        const tokenId = tokenData.token_id || tokenData.token_number || "A-001";
        const tokenNum = tokenData.token_number || "A-001";
        const pos = tokenData.queue_position || 1;
        const ahead = Math.max(0, pos - 1);

        if (qrDisplay) {
            qrDisplay.innerHTML = generateQRCodeSVG(tokenId, 200);
        }
        if (tokenRef) {
            tokenRef.innerHTML = `Token #${tokenNum} ${isEmergency ? '<span style="color:#ef4444; font-size:0.85rem;">(Emergency)</span>' : ''}`;
        }
        if (statusEl) {
            statusEl.innerHTML = `Queue Position: <strong>#${pos}</strong> (${ahead} people ahead)<br/>Status: <strong>${tokenData.token_status || 'WAITING'}</strong>`;
        }
        if (qrModal) qrModal.style.display = "flex";
    }

    function hideQRModal() {
        if (qrModal) qrModal.style.display = "none";
    }

    if (closeQrModal) closeQrModal.addEventListener("click", hideQRModal);
    if (doneQrBtn) doneQrBtn.addEventListener("click", hideQRModal);

    // Helper to update dashboard widgets with real backend token response
    function updateDashboardTokenDisplay(tokenData) {
        const userTokenBadge = document.querySelector(".status-item strong[style*='0f172a']");
        const aheadValue = document.querySelector(".status-item strong[style*='ef4444']");

        if (userTokenBadge) userTokenBadge.textContent = tokenData.token_number || "A-001";
        if (aheadValue) {
            const pos = tokenData.queue_position || 1;
            const ahead = Math.max(0, pos - 1);
            aheadValue.textContent = `${ahead} people`;
        }
    }

    // 6. Navigation & Logout Handlers
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

    console.log("dashboard.js loaded. P5 FastAPI backend integration active.");
});


