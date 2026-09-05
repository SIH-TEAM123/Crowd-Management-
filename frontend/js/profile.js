// Profile page — real user (auth/me) + shared queue status,
// so "Active Summary" always matches Dashboard/Queue/Crowd Status.

function localProfileKey(userId, field) {
    return `vizitor_profile_${field}_${userId}`;
}

async function loadProfile() {
    const user = await VIZITOR.getCurrentUser();
    if (!user) return;

    const valName = document.getElementById("valName");
    const valId = document.getElementById("valId");
    const valEmail = document.getElementById("valEmail");
    const valPhone = document.getElementById("valPhone");
    const displayName = document.getElementById("displayName");
    const displayId = document.getElementById("displayId");
    const avatarBadge = document.getElementById("avatarBadge");

    // Phone read from backend user model or local cache
    const phone = user.phone_number || storedPhone || "Not provided";

    if (valName) valName.textContent = user.full_name;
    if (valId) valId.textContent = `USR-${user.user_id}`;
    if (valEmail) valEmail.textContent = user.email;
    if (valPhone) valPhone.textContent = phone;
    if (displayName) displayName.textContent = user.full_name;
    if (displayId) displayId.textContent = `USR-${user.user_id}`;

    const badgeText = VIZITOR.initials(user.full_name);
    if (avatarBadge) avatarBadge.textContent = badgeText;
    VIZITOR.applyAvatar(user.full_name);

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

    if (queueStatus && queueStatus.you) {
        const you = queueStatus.you;
        if (activeTokenStatus) activeTokenStatus.textContent = VIZITOR.friendlyStatusLabel(you.status);
        if (activeTokenNumber) activeTokenNumber.textContent = you.token_display;
        if (queuePeopleAhead) queuePeopleAhead.textContent = you.people_ahead;
        if (queueWaitTime) queueWaitTime.textContent = `${you.estimated_wait_minutes} mins`;
    } else {
        if (activeTokenStatus) activeTokenStatus.textContent = "No Token";
        if (activeTokenNumber) activeTokenNumber.textContent = "--";
        if (queuePeopleAhead) queuePeopleAhead.textContent = "0";
        if (queueWaitTime) queueWaitTime.textContent = "0 mins";
    }

    const today = new Date().toISOString().split("T")[0];
    const upcoming = appointments
        .filter(a => a.status !== "CANCELLED" && a.appointment_date >= today)
        .sort((a, b) => `${a.appointment_date}T${a.appointment_time}`.localeCompare(`${b.appointment_date}T${b.appointment_time}`));

    if (upcoming.length > 0) {
        const appt = upcoming[0];
        if (upcomingApptTitle) upcomingApptTitle.textContent = appt.purpose;
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
    const btnCloseEditModal = document.getElementById("btnCloseEditModal");
    const btnCancelEdit = document.getElementById("btnCancelEdit");
    const formEditProfile = document.getElementById("formEditProfile");
    const editFullName = document.getElementById("editFullName");
    const editEmail = document.getElementById("editEmail");
    const editPhone = document.getElementById("editPhone");

    function openEditModal(user) {
        if (!modalEditProfile) return;
        if (editFullName) editFullName.value = user.full_name || "";
        if (editEmail) editEmail.value = user.email || "";
        const currentPhone = user.phone_number || localStorage.getItem(localProfileKey(user.user_id, "phone")) || "";
        if (editPhone) editPhone.value = (currentPhone === "Not provided") ? "" : currentPhone;
        modalEditProfile.style.display = "flex";
    }

    function closeEditModal() {
        if (modalEditProfile) modalEditProfile.style.display = "none";
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener("click", async () => {
            const user = await VIZITOR.getCurrentUser();
            if (!user) return;
            openEditModal(user);
        });
    }

    if (btnCloseEditModal) btnCloseEditModal.addEventListener("click", closeEditModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeEditModal);

    if (formEditProfile) {
        formEditProfile.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fullName = editFullName ? editFullName.value.trim() : "";
            const email = editEmail ? editEmail.value.trim() : "";
            const phone = editPhone ? editPhone.value.trim() : "";

            const saveBtn = document.getElementById("btnSaveProfile");
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = "Saving...";
            }

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
                    const displayName = document.getElementById("displayName");

                    if (valName) valName.textContent = res.full_name || fullName;
                    if (valEmail) valEmail.textContent = res.email || email;
                    if (valPhone) valPhone.textContent = res.phone_number || phone || "Not provided";
                    if (displayName) displayName.textContent = res.full_name || fullName;

                    if (res.phone_number || phone) {
                        localStorage.setItem(localProfileKey(res.user_id, "phone"), res.phone_number || phone);
                    }
                    VIZITOR.applyAvatar(res.full_name || fullName);

                    closeEditModal();
                    alert("Profile updated successfully!");
                } else {
                    alert("Failed to update profile. Please try again.");
                }
            } catch (err) {
                console.error("Profile update error:", err);
                alert("Failed to update profile. Please check your inputs.");
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Save Changes";
                }
            }
        });
    }

    const changePasswordBtn = document.getElementById("btnChangePassword");
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener("click", () => {
            window.location.href = "forgot-password.html";
        });
    }

    console.log("profile.js loaded — live profile + queue data active.");
});
