// Profile page — modern user profile, live queue synchronization,
// instant toast notifications, and persistent health credentials.

(function () {
    "use strict";

    function localProfileKey(userId, field) {
        return `vizitor_profile_${field}_${userId}`;
    }

    // Modern in-app Toast Notification
    function showToast(options) {
        const { title = "Notification", message = "", type = "success", duration = 3500 } = options;
        const container = document.getElementById("vizitorToastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = "vizitor-toast";

        const isSuccess = type === "success";
        const iconSvg = isSuccess
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        toast.innerHTML = `
            <div class="vizitor-toast-icon" style="background:${isSuccess ? '#ecfdf5' : '#fef2f2'}; color:${isSuccess ? '#059669' : '#dc2626'};">
                ${iconSvg}
            </div>
            <div class="vizitor-toast-content">
                <h4 class="vizitor-toast-title">${title}</h4>
                <p class="vizitor-toast-desc">${message}</p>
            </div>
            <button type="button" class="vizitor-toast-close" aria-label="Close">&times;</button>
            <div class="vizitor-toast-bar" style="background:${isSuccess ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #ef4444, #b91c1c)'}; animation-duration:${duration}ms;"></div>
        `;

        const closeBtn = toast.querySelector(".vizitor-toast-close");
        const dismiss = () => {
            toast.classList.add("hide");
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 250);
        };

        if (closeBtn) closeBtn.addEventListener("click", dismiss);
        const timer = setTimeout(dismiss, duration);

        container.appendChild(toast);
    }

    async function loadProfile() {
        const user = await VIZITOR.getCurrentUser();
        if (!user) return;

        const valName = document.getElementById("valName");
        const valId = document.getElementById("valId");
        const valEmail = document.getElementById("valEmail");
        const valPhone = document.getElementById("valPhone");
        const valEmergency = document.getElementById("valEmergency");
        const valBloodGroup = document.getElementById("valBloodGroup");
        const valLanguage = document.getElementById("valLanguage");

        const displayName = document.getElementById("displayName");
        const displayId = document.getElementById("displayId");
        const displayRole = document.getElementById("displayRole");
        const avatarBadge = document.getElementById("avatarBadge");
        const topNavAvatar = document.getElementById("topNavAvatar");

        const storedPhone = localStorage.getItem(localProfileKey(user.user_id, "phone"));
        const storedEmergency = localStorage.getItem(localProfileKey(user.user_id, "emergency")) || "Not provided";
        const storedBloodGroup = localStorage.getItem(localProfileKey(user.user_id, "blood_group")) || "O+ (Positive)";

        const phone = user.phone_number || storedPhone || "Not provided";
        const fullName = user.full_name || "User";
        const role = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : "Patient";

        if (valName) valName.textContent = fullName;
        if (valId) valId.textContent = `USR-${user.user_id}`;
        if (valEmail) valEmail.textContent = user.email;
        if (valPhone) valPhone.textContent = phone;
        if (valEmergency) valEmergency.textContent = storedEmergency;
        if (valBloodGroup) valBloodGroup.textContent = storedBloodGroup;

        // Current Language display
        const langNames = {
            or: "ଓଡ଼ିଆ (Odia)",
            mr: "मराठी (Marathi)",
            hi: "हिंदी (Hindi)",
            en: "English (EN)"
        };
        const curLang = localStorage.getItem("vizitor_lang") || "or";
        if (valLanguage) valLanguage.textContent = langNames[curLang] || curLang.toUpperCase();

        if (displayName) displayName.textContent = fullName;
        if (displayId) displayId.textContent = `USR-${user.user_id}`;
        if (displayRole) displayRole.textContent = role;

        const badgeText = VIZITOR.initials(fullName);
        if (avatarBadge) avatarBadge.textContent = badgeText;
        if (topNavAvatar) topNavAvatar.textContent = badgeText;
        VIZITOR.applyAvatar(fullName);

        await loadActiveSummary();
    }

    async function loadActiveSummary() {
        const queueStatus = await VIZITOR.getQueueStatus();
        const appointments = await VIZITOR.getAppointments();

        const activeTokenStatus = document.getElementById("activeTokenStatus");
        const activeTokenNumber = document.getElementById("activeTokenNumber");
        const queuePeopleAhead = document.getElementById("queuePeopleAhead");
        const queueWaitTime = document.getElementById("queueWaitTime");
        const upcomingApptTitle = document.getElementById("upcomingApptTitle");
        const upcomingApptDate = document.getElementById("upcomingApptDate");

        const heroToken = document.getElementById("heroToken");
        const heroWait = document.getElementById("heroWait");
        const heroAhead = document.getElementById("heroAhead");
        const heroApptCount = document.getElementById("heroApptCount");

        if (queueStatus && queueStatus.you) {
            const you = queueStatus.you;
            const statusText = VIZITOR.friendlyStatusLabel(you.status);
            if (activeTokenStatus) activeTokenStatus.textContent = statusText;
            if (activeTokenNumber) activeTokenNumber.textContent = you.token_display || "--";
            if (queuePeopleAhead) queuePeopleAhead.textContent = you.people_ahead ?? 0;
            if (queueWaitTime) queueWaitTime.textContent = `${you.estimated_wait_minutes ?? 0} mins`;

            if (heroToken) heroToken.textContent = you.token_display || "--";
            if (heroWait) heroWait.textContent = `${you.estimated_wait_minutes ?? 0} mins`;
            if (heroAhead) heroAhead.textContent = you.people_ahead ?? 0;
        } else {
            if (activeTokenStatus) activeTokenStatus.textContent = "No Token";
            if (activeTokenNumber) activeTokenNumber.textContent = "--";
            if (queuePeopleAhead) queuePeopleAhead.textContent = "0";
            if (queueWaitTime) queueWaitTime.textContent = "0 mins";

            if (heroToken) heroToken.textContent = "--";
            if (heroWait) heroWait.textContent = "0 mins";
            if (heroAhead) heroAhead.textContent = "0";
        }

        const today = new Date().toISOString().split("T")[0];
        const upcoming = appointments
            .filter(a => a.status !== "CANCELLED" && a.appointment_date >= today)
            .sort((a, b) => `${a.appointment_date}T${a.appointment_time}`.localeCompare(`${b.appointment_date}T${b.appointment_time}`));

        if (heroApptCount) heroApptCount.textContent = `${upcoming.length} Active`;

        if (upcoming.length > 0) {
            const appt = upcoming[0];
            if (upcomingApptTitle) upcomingApptTitle.textContent = appt.purpose || "Medical Consultation";
            if (upcomingApptDate) {
                upcomingApptDate.textContent =
                    `Date: ${VIZITOR.formatDate(appt.appointment_date)} at ${VIZITOR.formatTime(appt.appointment_time)} (Token ${appt.token_display})`;
            }
        } else {
            if (upcomingApptTitle) upcomingApptTitle.textContent = "No upcoming appointment";
            if (upcomingApptDate) upcomingApptDate.textContent = "--";
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        VIZITOR.requireAuthOrRedirect();
        VIZITOR.wireCommonNav();

        loadProfile();
        setInterval(loadActiveSummary, 20000);

        // Edit Profile Modal Wiring
        const modalEditProfile = document.getElementById("modalEditProfile");
        const editProfileBtn = document.getElementById("btnEditProfile");
        const editProfileBtnSec = document.getElementById("btnEditProfileSec");
        const btnCloseEditModal = document.getElementById("btnCloseEditModal");
        const btnCancelEdit = document.getElementById("btnCancelEdit");
        const formEditProfile = document.getElementById("formEditProfile");

        const editFullName = document.getElementById("editFullName");
        const editEmail = document.getElementById("editEmail");
        const editPhone = document.getElementById("editPhone");
        const editEmergency = document.getElementById("editEmergency");
        const editBloodGroup = document.getElementById("editBloodGroup");

        async function openEditModal() {
            const user = await VIZITOR.getCurrentUser();
            if (!user || !modalEditProfile) return;

            if (editFullName) editFullName.value = user.full_name || "";
            if (editEmail) editEmail.value = user.email || "";

            const currentPhone = user.phone_number || localStorage.getItem(localProfileKey(user.user_id, "phone")) || "";
            if (editPhone) editPhone.value = (currentPhone === "Not provided") ? "" : currentPhone;

            const curEmerg = localStorage.getItem(localProfileKey(user.user_id, "emergency")) || "";
            if (editEmergency) editEmergency.value = (curEmerg === "Not provided") ? "" : curEmerg;

            const curBlood = localStorage.getItem(localProfileKey(user.user_id, "blood_group")) || "O+";
            if (editBloodGroup) {
                for (const opt of editBloodGroup.options) {
                    if (opt.value === curBlood || curBlood.startsWith(opt.value)) {
                        opt.selected = true;
                        break;
                    }
                }
            }

            modalEditProfile.style.display = "flex";
        }

        function closeEditModal() {
            if (modalEditProfile) modalEditProfile.style.display = "none";
        }

        if (editProfileBtn) editProfileBtn.addEventListener("click", openEditModal);
        if (editProfileBtnSec) editProfileBtnSec.addEventListener("click", openEditModal);
        if (btnCloseEditModal) btnCloseEditModal.addEventListener("click", closeEditModal);
        if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeEditModal);

        // Close on background click or Esc key
        if (modalEditProfile) {
            modalEditProfile.addEventListener("click", (e) => {
                if (e.target === modalEditProfile) closeEditModal();
            });
        }
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modalEditProfile && modalEditProfile.style.display === "flex") {
                closeEditModal();
            }
        });

        // Form Submit
        if (formEditProfile) {
            formEditProfile.addEventListener("submit", async (e) => {
                e.preventDefault();
                const fullName = editFullName ? editFullName.value.trim() : "";
                const email = editEmail ? editEmail.value.trim() : "";
                const phone = editPhone ? editPhone.value.trim() : "";
                const emergency = editEmergency ? editEmergency.value.trim() : "";
                const bloodGroup = editBloodGroup ? editBloodGroup.value : "";

                const saveBtn = document.getElementById("btnSaveProfile");
                const saveSpinner = document.getElementById("saveBtnSpinner");
                const saveText = document.getElementById("saveBtnText");

                if (saveBtn) saveBtn.disabled = true;
                if (saveSpinner) saveSpinner.style.display = "inline-block";
                if (saveText) saveText.textContent = "Saving...";

                try {
                    const res = await VIZITOR.apiPut("/auth/me", {
                        full_name: fullName,
                        email: email,
                        phone_number: phone
                    });

                    if (res) {
                        const valName = document.getElementById("valName");
                        const valEmail = document.getElementById("valEmail");
                        const valPhone = document.getElementById("valPhone");
                        const valEmergency = document.getElementById("valEmergency");
                        const valBloodGroup = document.getElementById("valBloodGroup");
                        const displayName = document.getElementById("displayName");

                        const updatedName = res.full_name || fullName;
                        const updatedEmail = res.email || email;
                        const updatedPhone = res.phone_number || phone || "Not provided";

                        if (valName) valName.textContent = updatedName;
                        if (valEmail) valEmail.textContent = updatedEmail;
                        if (valPhone) valPhone.textContent = updatedPhone;
                        if (displayName) displayName.textContent = updatedName;

                        const uid = res.user_id || (await VIZITOR.getCurrentUser())?.user_id;
                        if (uid) {
                            if (updatedPhone) localStorage.setItem(localProfileKey(uid, "phone"), updatedPhone);
                            if (emergency) {
                                localStorage.setItem(localProfileKey(uid, "emergency"), emergency);
                                if (valEmergency) valEmergency.textContent = emergency;
                            }
                            if (bloodGroup) {
                                localStorage.setItem(localProfileKey(uid, "blood_group"), bloodGroup);
                                if (valBloodGroup) valBloodGroup.textContent = bloodGroup;
                            }
                        }

                        VIZITOR.applyAvatar(updatedName);
                        closeEditModal();

                        // Modern Animated Toast Notification
                        showToast({
                            title: "Profile Updated",
                            message: "Your personal details have been saved across VIZITOR.",
                            type: "success",
                            duration: 3500
                        });

                        // Show inline live banner on hero card
                        const liveBanner = document.getElementById("profileSavedBanner");
                        if (liveBanner) {
                            liveBanner.style.display = "inline-flex";
                            setTimeout(() => {
                                liveBanner.style.display = "none";
                            }, 5000);
                        }
                    } else {
                        showToast({
                            title: "Update Failed",
                            message: "Failed to update profile. Please try again.",
                            type: "error"
                        });
                    }
                } catch (err) {
                    console.error("Profile update error:", err);
                    showToast({
                        title: "Update Error",
                        message: err.message || "Failed to update profile. Please check your inputs.",
                        type: "error"
                    });
                } finally {
                    if (saveBtn) saveBtn.disabled = false;
                    if (saveSpinner) saveSpinner.style.display = "none";
                    if (saveText) saveText.textContent = "Save Changes";
                }
            });
        }

        // Quick action buttons
        const btnViewQRPass = document.getElementById("btnViewQRPass");
        if (btnViewQRPass) {
            btnViewQRPass.addEventListener("click", () => {
                window.location.href = "appointments.html";
            });
        }

        const btnChangePassword = document.getElementById("btnChangePassword");
        const btnChangePasswordQuick = document.getElementById("btnChangePasswordQuick");
        const goChangePassword = () => { window.location.href = "forgot-password.html"; };
        if (btnChangePassword) btnChangePassword.addEventListener("click", goChangePassword);
        if (btnChangePasswordQuick) btnChangePasswordQuick.addEventListener("click", goChangePassword);

        // Listen for language changes to update language info card dynamically
        window.addEventListener("vizitorLanguageChanged", (e) => {
            const langNames = {
                or: "ଓଡ଼ିଆ (Odia)",
                mr: "मराठी (Marathi)",
                hi: "हिंदी (Hindi)",
                en: "English (EN)"
            };
            const valLanguage = document.getElementById("valLanguage");
            if (valLanguage && e.detail && e.detail.lang) {
                valLanguage.textContent = langNames[e.detail.lang] || e.detail.lang.toUpperCase();
            }
        });

        console.log("profile.js loaded — modern profile UI active.");
    });
})();
