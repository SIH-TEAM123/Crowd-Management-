// Dashboard logic for Crowd Management UI

document.addEventListener("DOMContentLoaded", () => {
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
            // In a real app, this would redirect or open a modal.
            // Let's redirect to appointments.html
            alert("Redirecting to the Appointments page...");
            window.location.href = "appointments.html";
        });
    }
    
    // 3. Quick Actions Mock Notifications
    const quickActionBtns = document.querySelectorAll(".quick-action-btn");
    quickActionBtns.forEach(btn => {
        btn.addEventListener("click", (event) => {
            const actionText = btn.textContent.trim();
            console.log(`Quick Action clicked: ${actionText}`);
        });
    });

    console.log("dashboard.js successfully loaded. Dynamic widgets active.");
});
