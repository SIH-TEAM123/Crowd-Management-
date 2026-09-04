// Frontend logic for Crowd Forecast page

document.addEventListener("DOMContentLoaded", async function () {
    // 1. Fetch current user profile if logged in via FastAPI backend (/auth/me)
    const userProfileAvatar = document.querySelector(".profile-badge .profile-avatar");
    
    if (typeof getCurrentUser === "function") {
        const userResult = await getCurrentUser();
        if (userResult.success && userResult.data) {
            const user = userResult.data;
            if (userProfileAvatar) {
                userProfileAvatar.textContent = (user.full_name ? user.full_name.charAt(0) : user.email.charAt(0)).toUpperCase();
            }
        } else {
            const storedEmail = localStorage.getItem("userEmail");
            if (userProfileAvatar && storedEmail) {
                userProfileAvatar.textContent = storedEmail.charAt(0).toUpperCase();
            }
        }
    }

    // 2. Functional Forecast Duration Pills Selector
    const durationPillContainer = document.getElementById("durationPillContainer");
    const selectedHorizonLabel = document.getElementById("selectedHorizonLabel");
    const chartPanelTitle = document.getElementById("chartPanelTitle");

    const horizonMap = {
        "1h": { label: "1 Hour", granularity: "Hourly Granularity" },
        "6h": { label: "6 Hours", granularity: "Hourly Granularity" },
        "12h": { label: "12 Hours", granularity: "Hourly Granularity" },
        "1d": { label: "1 Day", granularity: "Daily Granularity" },
        "3d": { label: "3 Days", granularity: "Daily Granularity" },
        "7d": { label: "7 Days", granularity: "Daily Granularity" }
    };

    if (durationPillContainer) {
        const pills = durationPillContainer.querySelectorAll(".duration-pill");
        pills.forEach(function (pill) {
            pill.addEventListener("click", function () {
                pills.forEach(function (p) { p.classList.remove("active"); });
                pill.classList.add("active");

                const durationKey = pill.getAttribute("data-duration");
                const horizonInfo = horizonMap[durationKey] || { label: pill.textContent, granularity: "Projections" };

                if (selectedHorizonLabel) {
                    selectedHorizonLabel.textContent = `${horizonInfo.label} (${horizonInfo.granularity})`;
                }

                if (chartPanelTitle) {
                    chartPanelTitle.textContent = `Crowd Prediction Trend (${horizonInfo.label})`;
                }
            });
        });
    }

    // 3. Status Refresh Button Handler
    const btnRefreshForecast = document.getElementById("btnRefreshForecast");
    const forecastPageSubtext = document.getElementById("forecastPageSubtext");

    if (btnRefreshForecast) {
        btnRefreshForecast.addEventListener("click", function () {
            btnRefreshForecast.disabled = true;
            const origHTML = btnRefreshForecast.innerHTML;
            btnRefreshForecast.textContent = "Checking...";

            setTimeout(function () {
                btnRefreshForecast.disabled = false;
                btnRefreshForecast.innerHTML = origHTML;

                const now = new Date();
                const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                if (forecastPageSubtext) {
                    forecastPageSubtext.textContent = `Forecast status checked at ${timeStr} • Backend prediction service is offline (awaiting API endpoint activation).`;
                }
            }, 500);
        });
    }

    // 4. Header & Navigation Handlers (Profile, Notifications, Logout)
    const profileBadge = document.querySelector(".profile-badge");
    if (profileBadge) {
        profileBadge.style.cursor = "pointer";
        profileBadge.addEventListener("click", function () {
            window.location.href = "profile.html";
        });
    }

    const notifBtn = document.querySelector('.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]');
    if (notifBtn) {
        notifBtn.addEventListener("click", function () {
            window.location.href = "notifications.html";
        });
    }

    const logoutLinks = document.querySelectorAll('.sidebar-footer a, #btnLogout');
    logoutLinks.forEach(function (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            if (typeof logoutUser === "function") {
                logoutUser();
            } else {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("isAuthenticated");
                localStorage.removeItem("userEmail");
                window.location.href = "index.html";
            }
        });
    });
});
