// Dashboard logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {
    // 0. Update Welcome Banner if user email is stored
    const welcomeUserEl = document.getElementById("welcomeUser");
    const storedEmail = localStorage.getItem("userEmail");
    if (welcomeUserEl && storedEmail) {
        const username = storedEmail.split("@")[0];
        const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
        welcomeUserEl.textContent = `Welcome back, ${formattedName}.`;
    }

    // 1. Dynamic Date and Time Updater
    const dateTimeElement = document.getElementById("currentDateTime");
    
    function updateDateTime() {
        const now = new Date();
        
        // Define options for friendly formatting
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        
        const dateStr = now.toLocaleDateString('en-US', options);
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Output format: e.g. "Monday, Aug 17, 2026 • 12:45:00 PM"
        if (dateTimeElement) {
            dateTimeElement.textContent = `${dateStr} • ${timeStr}`;
        }
    }
    
    // Update the clock immediately, then refresh every second
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // 2. Interactive Mock Buttons Click Handlers
    const exportBtn = document.getElementById("btnExport");
    const bookApptHeaderBtn = document.getElementById("btnCreateAppt");

    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            alert("Exporting statistics...\n\n(This action will download today's crowd summary CSV file once connected to the FastAPI backend!)");
        });
    }

    if (bookApptHeaderBtn) {
        bookApptHeaderBtn.addEventListener("click", () => {
            window.location.href = "appointments.html";
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
        link.addEventListener("click", (e) => {
            localStorage.removeItem("isAuthenticated");
            localStorage.removeItem("userEmail");
        });
    });

    console.log("dashboard.js successfully loaded. Dynamic widgets active.");
});

