// Profile page logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {
    // 1. Edit Profile functionality
    const editProfileBtn = document.getElementById("btnEditProfile");
    
    // Grab DOM elements that hold the values
    const valName = document.getElementById("valName");
    const valEmail = document.getElementById("valEmail");
    const valPhone = document.getElementById("valPhone");
    
    // Header labels
    const displayName = document.getElementById("displayName");
    const avatarBadge = document.getElementById("avatarBadge");

    if (editProfileBtn) {
        editProfileBtn.addEventListener("click", () => {
            // Ask user for inputs using simple prompt boxes
            const newName = prompt("Enter your Full Name:", valName.textContent);
            if (newName === null) return; // Clicked cancel
            
            const newEmail = prompt("Enter your Email Address:", valEmail.textContent);
            if (newEmail === null) return;
            
            const newPhone = prompt("Enter your Phone Number:", valPhone.textContent);
            if (newPhone === null) return;

            // Simple validation: Make sure they are not empty
            if (newName.trim() === "" || newEmail.trim() === "" || newPhone.trim() === "") {
                alert("Profile values cannot be empty!");
                return;
            }

            // Update the values on the page!
            valName.textContent = newName;
            valEmail.textContent = newEmail;
            valPhone.textContent = newPhone;
            displayName.textContent = newName;

            // Generate initials for the avatar badge (e.g. "Alex Mercer" -> "AM")
            const nameParts = newName.trim().split(" ");
            let initials = "";
            if (nameParts.length > 0) {
                initials += nameParts[0].charAt(0).toUpperCase();
            }
            if (nameParts.length > 1) {
                initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
            }
            
            if (initials) {
                avatarBadge.textContent = initials;
            }

            alert("Profile details updated successfully! (Local state updated)");
        });
    }

    // 2. Change Password Dialog mock
    const changePasswordBtn = document.getElementById("btnChangePassword");
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener("click", () => {
            const currentPassword = prompt("Enter current password:");
            if (currentPassword === null) return;

            const newPassword = prompt("Enter new password:");
            if (newPassword === null) return;

            const confirmPassword = prompt("Confirm new password:");
            if (confirmPassword === null) return;

            if (newPassword !== confirmPassword) {
                alert("New passwords do not match! Please try again.");
                return;
            }

            if (newPassword.length < 6) {
                alert("New password must be at least 6 characters long!");
                return;
            }

            alert("Password updated successfully! (Local mock confirmation)");
        });
    }

    // 3. Header & Logout Navigation Handlers
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
        link.addEventListener("click", () => {
            localStorage.removeItem("isAuthenticated");
            localStorage.removeItem("userEmail");
        });
    });

    console.log("profile.js successfully loaded. Profile interactive events active.");
});

