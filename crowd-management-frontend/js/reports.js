// ============================================================
// REPORTS PAGE LOGIC
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "http://127.0.0.1:8000";


    // ========================================================
    // GET AUTH HEADERS
    // ========================================================

    function getAuthHeaders() {

        const token =
            localStorage.getItem("access_token");

        if (!token) {

            console.warn(
                "No access token found."
            );

            return null;
        }

        return {

            "Authorization":
                `Bearer ${token}`,

            "Content-Type":
                "application/json"
        };
    }


    // ========================================================
    // LOAD APPOINTMENTS
    // ========================================================

    async function loadAppointments() {

        const headers =
            getAuthHeaders();

        if (!headers) {

            return [];

        }

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/appointments`,
                    {
                        method: "GET",
                        headers: headers
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                console.error(
                    "Failed to load appointments:",
                    data
                );

                return [];

            }

            return Array.isArray(data)
                ? data
                : [];

        }

        catch (error) {

            console.error(
                "Appointment loading error:",
                error
            );

            return [];

        }
    }


    // ========================================================
    // FORMAT DATE
    // ========================================================

    function formatDate(dateString) {

        if (!dateString) {

            return "-";

        }

        const date =
            new Date(
                `${dateString}T00:00:00`
            );

        return date.toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );
    }


    // ========================================================
    // CALCULATE QUEUE
    // ========================================================

    function getQueueData(appointments) {

        const today =
            new Date()
                .toISOString()
                .split("T")[0];

        const activeAppointments =
            appointments.filter(
                appointment =>
                    appointment.status !==
                    "CANCELLED"
            );

        const upcomingAppointments =
            appointments.filter(
                appointment =>
                    appointment.status !==
                    "CANCELLED" &&
                    appointment.appointment_date >=
                    today
            );

        const queueCount =
            upcomingAppointments.length;

        const estimatedWait =
            queueCount * 5;

        let crowdLevel =
            "Low";

        if (queueCount > 15) {

            crowdLevel =
                "High";

        }

        else if (queueCount > 5) {

            crowdLevel =
                "Moderate";

        }

        return {

            today,
            activeAppointments,
            upcomingAppointments,
            queueCount,
            estimatedWait,
            crowdLevel

        };
    }


    // ========================================================
    // LOAD REPORT
    // ========================================================

    async function loadReport() {

        const appointments =
            await loadAppointments();

        const queueData =
            getQueueData(
                appointments
            );


        // ----------------------------------------------------
        // TOTAL APPOINTMENTS
        // ----------------------------------------------------

        const totalElement =
            document.getElementById(
                "reportTotalAppointments"
            );

        if (totalElement) {

            totalElement.textContent =
                appointments.length;

        }


        // ----------------------------------------------------
        // ACTIVE APPOINTMENTS
        // ----------------------------------------------------

        const activeElement =
            document.getElementById(
                "reportActiveAppointments"
            );

        if (activeElement) {

            activeElement.textContent =
                queueData.activeAppointments.length;

        }


        // ----------------------------------------------------
        // CANCELLED APPOINTMENTS
        // ----------------------------------------------------

        const cancelledAppointments =
            appointments.filter(
                appointment =>
                    appointment.status ===
                    "CANCELLED"
            );

        const cancelledElement =
            document.getElementById(
                "reportCancelledAppointments"
            );

        if (cancelledElement) {

            cancelledElement.textContent =
                cancelledAppointments.length;

        }


        // ----------------------------------------------------
        // TODAY'S APPOINTMENTS
        // ----------------------------------------------------

        const todayAppointments =
            appointments.filter(
                appointment =>
                    appointment.status !==
                    "CANCELLED" &&
                    appointment.appointment_date ===
                    queueData.today
            );

        const todayElement =
            document.getElementById(
                "reportTodayAppointments"
            );

        if (todayElement) {

            todayElement.textContent =
                todayAppointments.length;

        }


        // ----------------------------------------------------
        // CURRENT QUEUE
        // ----------------------------------------------------

        const queueElement =
            document.getElementById(
                "reportQueueCount"
            );

        if (queueElement) {

            queueElement.textContent =
                queueData.queueCount;

        }


        // ----------------------------------------------------
        // ESTIMATED WAIT
        // ----------------------------------------------------

        const waitElement =
            document.getElementById(
                "reportWaitTime"
            );

        if (waitElement) {

            waitElement.textContent =
                `${queueData.estimatedWait} min`;

        }


        // ----------------------------------------------------
        // CROWD LEVEL
        // ----------------------------------------------------

        const crowdElement =
            document.getElementById(
                "reportCrowdLevel"
            );

        if (crowdElement) {

            crowdElement.textContent =
                queueData.crowdLevel;

        }


        // ----------------------------------------------------
        // RECENT COUNT
        // ----------------------------------------------------

        const recentCount =
            document.getElementById(
                "reportRecentCount"
            );

        if (recentCount) {

            recentCount.textContent =
                appointments.length;

        }


        // ----------------------------------------------------
        // RECENT APPOINTMENTS TABLE
        // ----------------------------------------------------

        const tableBody =
            document.getElementById(
                "reportTableBody"
            );

        if (!tableBody) {

            return;

        }

        tableBody.innerHTML = "";

        if (appointments.length === 0) {

            tableBody.innerHTML = `

                <tr>

                    <td colspan="4"
                        style="
                            text-align:center;
                            padding:2rem;
                        ">

                        No appointments found.

                    </td>

                </tr>

            `;

            return;

        }


        const recentAppointments =
            [...appointments]
                .sort(
                    (a, b) => {

                        const dateA =
                            new Date(
                                a.appointment_date
                            );

                        const dateB =
                            new Date(
                                b.appointment_date
                            );

                        return dateB - dateA;

                    }
                )
                .slice(0, 10);


        recentAppointments.forEach(
            appointment => {

                const row =
                    document.createElement("tr");


                let statusClass =
                    "status-pending";

                if (
                    appointment.status ===
                    "CANCELLED"
                ) {

                    statusClass =
                        "status-cancelled";

                }

                else if (
                    appointment.status ===
                    "COMPLETED"
                ) {

                    statusClass =
                        "status-completed";

                }


                row.innerHTML = `

                    <td>
                        ${appointment.service_name ||
                          appointment.service ||
                          "-"}
                    </td>

                    <td>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </td>

                    <td>
                        ${appointment.appointment_time ||
                          appointment.time ||
                          "-"}
                    </td>

                    <td>

                        <span class="
                            status-badge
                            ${statusClass}
                        ">

                            ${appointment.status ||
                              "PENDING"}

                        </span>

                    </td>

                `;

                tableBody.appendChild(
                    row
                );

            }
        );


        console.log(
            "Reports loaded:",
            {
                total:
                    appointments.length,

                active:
                    queueData.activeAppointments.length,

                cancelled:
                    cancelledAppointments.length,

                queue:
                    queueData.queueCount,

                wait:
                    queueData.estimatedWait,

                crowd:
                    queueData.crowdLevel
            }
        );
    }


    // ========================================================
    // EXPORT REPORT
    // ========================================================

    const exportButton =
        document.getElementById(
            "downloadReportBtn"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            () => {

                // Print the current report page.
                // Browser can save it as PDF.

                window.print();

            }
        );

    }


    // ========================================================
    // START
    // ========================================================

    loadReport();

});