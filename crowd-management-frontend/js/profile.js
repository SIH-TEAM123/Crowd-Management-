// ============================================================
// VIZITOR - PROFILE PAGE LOGIC
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================================
    // GET AUTHENTICATION DATA
    // ========================================================

    const accessToken =
        localStorage.getItem("access_token");

    const storedEmail =
        localStorage.getItem("userEmail") ||
        localStorage.getItem("email") ||
        "";

    // ========================================================
    // DOM ELEMENTS
    // ========================================================

    const editProfileBtn =
        document.getElementById("btnEditProfile");

    const valName =
        document.getElementById("valName");

    const valId =
        document.getElementById("valId");

    const valEmail =
        document.getElementById("valEmail");

    const valPhone =
        document.getElementById("valPhone");

    const displayName =
        document.getElementById("displayName");

    const displayId =
        document.getElementById("displayId");

    const avatarBadge =
        document.getElementById("avatarBadge");

    const headerAvatar =
        document.getElementById("headerAvatar");

    // Active Summary

    const activeTokenStatus =
        document.getElementById("activeTokenStatus");

    const activeTokenNumber =
        document.getElementById("activeTokenNumber");

    const summaryPeopleAhead =
        document.getElementById("summaryPeopleAhead");

    const summaryWaitTime =
        document.getElementById("summaryWaitTime");

    const summaryAppointmentService =
        document.getElementById(
            "summaryAppointmentService"
        );

    const summaryAppointmentDate =
        document.getElementById(
            "summaryAppointmentDate"
        );


    // ========================================================
    // CREATE DEFAULT NAME FROM EMAIL
    // ========================================================

    function createNameFromEmail(email) {

        if (!email) {
            return "User";
        }

        let name =
            email.split("@")[0];

        name =
            name
                .replace(/[._-]/g, " ")
                .trim();

        if (!name) {
            return "User";
        }

        return name
            .split(" ")
            .map(word =>
                word.charAt(0).toUpperCase() +
                word.slice(1)
            )
            .join(" ");
    }


    // ========================================================
    // GENERATE INITIALS
    // ========================================================

    function getInitials(name) {

        if (!name) {
            return "U";
        }

        const parts =
            name
                .trim()
                .split(/\s+/);

        if (parts.length === 1) {
            return parts[0]
                .charAt(0)
                .toUpperCase();
        }

        return (
            parts[0]
                .charAt(0)
                .toUpperCase()
            +
            parts[
                parts.length - 1
            ]
                .charAt(0)
                .toUpperCase()
        );
    }


    // ========================================================
    // LOAD SAVED PROFILE
    // ========================================================

    function loadProfile() {

        const savedProfile =
            JSON.parse(
                localStorage.getItem(
                    "vizitor_profile"
                ) || "{}"
            );

        const email =
            savedProfile.email ||
            storedEmail ||
            "Not available";

        const name =
            savedProfile.name ||
            createNameFromEmail(email);

        const phone =
            savedProfile.phone ??
            "null";

        const userId =
            savedProfile.userId ||
            localStorage.getItem(
                "user_id"
            ) ||
            "--";


        // Update Profile Page

        if (valName) {
            valName.textContent = name;
        }

        if (valEmail) {
            valEmail.textContent = email;
        }

        if (valPhone) {
            valPhone.textContent = phone;
        }

        if (valId) {
            valId.textContent = userId;
        }

        if (displayName) {
            displayName.textContent = name;
        }

        if (displayId) {
            displayId.textContent = userId;
        }


        // Avatar

        const initials =
            getInitials(name);

        if (avatarBadge) {
            avatarBadge.textContent =
                initials;
        }

        if (headerAvatar) {
            headerAvatar.textContent =
                initials;
        }


        // IMPORTANT:
        // Store data separately so dashboard.js
        // can use exactly the same profile name.

        localStorage.setItem(
            "vizitor_profile",
            JSON.stringify({
                name: name,
                email: email,
                phone: phone,
                userId: userId
            })
        );

        // Extra simple dashboard compatibility

        localStorage.setItem(
            "displayName",
            name
        );

        localStorage.setItem(
            "userEmail",
            email
        );
    }


    // ========================================================
    // SAVE PROFILE
    // ========================================================

    function saveProfile(
        name,
        email,
        phone
    ) {

        const existing =
            JSON.parse(
                localStorage.getItem(
                    "vizitor_profile"
                ) || "{}"
            );

        const profile = {

            name: name,

            email: email,

            phone: phone,

            userId:
                existing.userId ||
                localStorage.getItem(
                    "user_id"
                ) ||
                "--"
        };


        localStorage.setItem(
            "vizitor_profile",
            JSON.stringify(profile)
        );


        // Dashboard shared values

        localStorage.setItem(
            "displayName",
            name
        );

        localStorage.setItem(
            "userEmail",
            email
        );
    }


    // ========================================================
    // EDIT PROFILE
    // ========================================================

    if (editProfileBtn) {

        editProfileBtn.addEventListener(
            "click",
            () => {

                const currentName =
                    valName
                        ? valName.textContent
                        : "";

                const currentEmail =
                    valEmail
                        ? valEmail.textContent
                        : "";

                const currentPhone =
                    valPhone
                        ? valPhone.textContent
                        : "null";


                const newName =
                    prompt(
                        "Enter your Full Name:",
                        currentName
                    );

                if (newName === null) {
                    return;
                }


                const newEmail =
                    prompt(
                        "Enter your Email Address:",
                        currentEmail
                    );

                if (newEmail === null) {
                    return;
                }


                const newPhone =
                    prompt(
                        "Enter your Phone Number (leave empty for null):",
                        currentPhone === "null"
                            ? ""
                            : currentPhone
                    );

                if (newPhone === null) {
                    return;
                }


                // Validation

                if (
                    newName.trim() === ""
                ) {

                    alert(
                        "Name cannot be empty."
                    );

                    return;
                }


                if (
                    newEmail.trim() === ""
                ) {

                    alert(
                        "Email cannot be empty."
                    );

                    return;
                }


                const finalPhone =
                    newPhone.trim() === ""
                        ? "null"
                        : newPhone.trim();


                // Save

                saveProfile(
                    newName.trim(),
                    newEmail.trim(),
                    finalPhone
                );


                // Update page immediately

                if (valName) {
                    valName.textContent =
                        newName.trim();
                }

                if (valEmail) {
                    valEmail.textContent =
                        newEmail.trim();
                }

                if (valPhone) {
                    valPhone.textContent =
                        finalPhone;
                }

                if (displayName) {
                    displayName.textContent =
                        newName.trim();
                }


                const initials =
                    getInitials(
                        newName.trim()
                    );


                if (avatarBadge) {
                    avatarBadge.textContent =
                        initials;
                }

                if (headerAvatar) {
                    headerAvatar.textContent =
                        initials;
                }


                alert(
                    "Profile details updated successfully!"
                );
            }
        );
    }


    // ========================================================
    // LOAD ACTIVE SUMMARY FROM BACKEND
    // ========================================================

    async function loadActiveSummary() {

        // Reset default state

        function showNoAppointment() {

            if (activeTokenStatus) {
                activeTokenStatus.textContent =
                    "No Appointment";
            }

            if (activeTokenNumber) {
                activeTokenNumber.textContent =
                    "--";
            }

            if (summaryPeopleAhead) {
                summaryPeopleAhead.textContent =
                    "0";
            }

            if (summaryWaitTime) {
                summaryWaitTime.textContent =
                    "0 mins";
            }

            if (
                summaryAppointmentService
            ) {

                summaryAppointmentService.textContent =
                    "No upcoming appointment";
            }

            if (
                summaryAppointmentDate
            ) {

                summaryAppointmentDate.textContent =
                    "Create an appointment to see it here.";
            }
        }


        if (!accessToken) {

            console.warn(
                "No access token found."
            );

            showNoAppointment();

            return;
        }


        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/appointments`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${accessToken}`
                        }
                    }
                );


            const appointments =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Profile appointment API error:",
                    appointments
                );

                showNoAppointment();

                return;
            }


            if (
                !Array.isArray(
                    appointments
                )
            ) {

                console.error(
                    "Unexpected appointment response:",
                    appointments
                );

                showNoAppointment();

                return;
            }


            // Active appointments only

            const active =
                appointments.filter(
                    appointment =>
                        appointment.status !==
                            "CANCELLED"
                        &&
                        appointment.status !==
                            "COMPLETED"
                        &&
                        appointment.token_status !==
                            "CANCELLED"
                        &&
                        appointment.token_status !==
                            "COMPLETED"
                );


            if (active.length === 0) {

                showNoAppointment();

                return;
            }


            // Prefer queue appointment

            const queued =
                active.filter(
                    appointment =>
                        appointment.queue_position !==
                            null
                        &&
                        appointment.queue_position !==
                            undefined
                );


            const appointment =
                queued.length > 0
                    ? queued[
                        queued.length - 1
                    ]
                    : active[
                        active.length - 1
                    ];


            // ------------------------------------------------
            // TOKEN
            // ------------------------------------------------

            const displayToken =
                appointment.display_token ||
                (
                    appointment.appointment_id
                        ? "A-" +
                            String(
                                appointment.appointment_id
                            ).padStart(
                                3,
                                "0"
                            )
                        : "--"
                );


            if (activeTokenNumber) {

                activeTokenNumber.textContent =
                    displayToken;
            }


            // ------------------------------------------------
            // PEOPLE AHEAD
            // ------------------------------------------------

            const peopleAhead =
                Number(
                    appointment.people_ahead ?? 0
                );


            if (summaryPeopleAhead) {

                summaryPeopleAhead.textContent =
                    peopleAhead;
            }


            // ------------------------------------------------
            // WAIT TIME
            //
            // Use backend value if provided.
            // Otherwise estimate 3 minutes/person.
            // ------------------------------------------------

            let waitMinutes =
                appointment.estimated_wait_time ??
                appointment.wait_minutes;


            if (
                waitMinutes === undefined ||
                waitMinutes === null
            ) {

                waitMinutes =
                    peopleAhead * 3;
            }


            waitMinutes =
                Math.max(
                    0,
                    Math.round(
                        Number(waitMinutes) || 0
                    )
                );


            if (summaryWaitTime) {

                summaryWaitTime.textContent =
                    `${waitMinutes} mins`;
            }


            // ------------------------------------------------
            // STATUS
            // ------------------------------------------------

            let statusText =
                appointment.token_status ||
                appointment.status ||
                "WAITING";


            statusText =
                statusText
                    .replace(
                        /_/g,
                        " "
                    )
                    .toLowerCase()
                    .replace(
                        /\b\w/g,
                        char =>
                            char.toUpperCase()
                    );


            if (activeTokenStatus) {

                activeTokenStatus.textContent =
                    statusText;
            }


            // ------------------------------------------------
            // SERVICE
            // ------------------------------------------------

            if (
                summaryAppointmentService
            ) {

                summaryAppointmentService.textContent =
                    appointment.purpose ||
                    "General Appointment";
            }


            // ------------------------------------------------
            // DATE AND TIME
            // ------------------------------------------------

            let appointmentInfo = "";


            if (
                appointment.appointment_date
            ) {

                appointmentInfo +=
                    appointment.appointment_date;
            }


            if (
                appointment.appointment_time
            ) {

                if (appointmentInfo) {
                    appointmentInfo += " • ";
                }

                appointmentInfo +=
                    appointment.appointment_time;
            }


            if (
                summaryAppointmentDate
            ) {

                summaryAppointmentDate.textContent =
                    appointmentInfo ||
                    "Appointment scheduled";
            }


            console.log(
                "PROFILE ACTIVE SUMMARY:",
                {
                    appointment,
                    displayToken,
                    peopleAhead,
                    waitMinutes
                }
            );


        } catch (error) {

            console.error(
                "Unable to load active summary:",
                error
            );

            showNoAppointment();
        }
    }


    // ========================================================
    // CHANGE PASSWORD
    // ========================================================

    const changePasswordBtn =
        document.getElementById(
            "btnChangePassword"
        );


    if (changePasswordBtn) {

        changePasswordBtn.addEventListener(
            "click",
            () => {

                alert(
                    "Please use the Forgot Password option from the login page to change your password."
                );
            }
        );
    }


    // ========================================================
    // PROFILE BADGE
    // ========================================================

    const profileBadge =
        document.querySelector(
            ".profile-badge"
        );


    if (profileBadge) {

        profileBadge.style.cursor =
            "pointer";

        profileBadge.addEventListener(
            "click",
            () => {

                window.location.href =
                    "profile.html";
            }
        );
    }


    // ========================================================
    // NOTIFICATIONS
    // ========================================================

    const notifBtn =
        document.querySelector(
            '.icon-btn[title="View alerts"], .icon-btn[title="Notifications"]'
        );


    if (notifBtn) {

        notifBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    "notifications.html";
            }
        );
    }


    // ========================================================
    // LOGOUT
    // ========================================================

    const logoutLinks =
        document.querySelectorAll(
            '.sidebar-footer a, #btnLogout'
        );


    logoutLinks.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    localStorage.removeItem(
                        "isAuthenticated"
                    );

                    localStorage.removeItem(
                        "access_token"
                    );

                    localStorage.removeItem(
                        "userEmail"
                    );

                    localStorage.removeItem(
                        "email"
                    );

                    localStorage.removeItem(
                        "user_id"
                    );

                    localStorage.removeItem(
                        "displayName"
                    );

                    localStorage.removeItem(
                        "vizitor_profile"
                    );
                }
            );
        }
    );


    // ========================================================
    // INITIAL LOAD
    // ========================================================

    loadProfile();

    loadActiveSummary();

    console.log(
        "VIZITOR profile loaded successfully."
    );

});