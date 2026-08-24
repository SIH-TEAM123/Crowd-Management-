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

    // Phone isn't stored by the backend yet — keep a local,
    // per-user override so it doesn't leak across accounts.
    const storedPhone = localStorage.getItem(localProfileKey(user.user_id, "phone"));

    if (valName) valName.textContent = user.full_name;
    if (valId) valId.textContent = `USR-${user.user_id}`;
    if (valEmail) valEmail.textContent = user.email;
    if (valPhone) valPhone.textContent = storedPhone || "Not provided";
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

    // Edit Profile — name/email are managed by the backend account;
    // only phone is editable locally for now.
    const editProfileBtn = document.getElementById("btnEditProfile");
    if (editProfileBtn) {
        editProfileBtn.addEventListener("click", async () => {
            const user = await VIZITOR.getCurrentUser();
            if (!user) return;

            const valPhone = document.getElementById("valPhone");

            const newPhone = prompt(
                "Enter your Phone Number:\n(Name & email are managed by your account and can't be changed here.)",
                valPhone.textContent === "Not provided" ? "" : valPhone.textContent
            );
            if (newPhone === null) return;

            if (newPhone.trim() === "") {
                alert("Phone number cannot be empty!");
                return;
            }

            localStorage.setItem(localProfileKey(user.user_id, "phone"), newPhone.trim());
            valPhone.textContent = newPhone.trim();

            alert("Profile updated successfully!");
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
