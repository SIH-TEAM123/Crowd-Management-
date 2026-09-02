// Reports page — uses the same shared queue/status endpoint as
// every other page, plus the user's own appointment history.
//
// During Crowd Simulation, VIZITOR.getQueueStatus() automatically
// returns the shared simulation queue, waiting time and crowd level.
// Real appointment history remains completely unchanged.

document.addEventListener("DOMContentLoaded", () => {

    VIZITOR.requireAuthOrRedirect();
    VIZITOR.wireCommonNav();

    async function loadReport() {

        const appointments =
            await VIZITOR.getAppointments();

        const queueStatus =
            await VIZITOR.getQueueStatus();

        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        // ========================================================
        // Appointment statistics
        // Existing logic preserved
        // ========================================================

        const activeAppointments =
            appointments.filter(
                a =>
                    a.status !== "CANCELLED"
            );


        const cancelledAppointments =
            appointments.filter(
                a =>
                    a.status === "CANCELLED"
            );


        const todayAppointments =
            activeAppointments.filter(
                a =>
                    a.appointment_date === today
            );


        setText(
            "reportTotalAppointments",
            appointments.length
        );


        setText(
            "reportActiveAppointments",
            activeAppointments.length
        );


        setText(
            "reportCancelledAppointments",
            cancelledAppointments.length
        );


        setText(
            "reportTodayAppointments",
            todayAppointments.length
        );


        // ========================================================
        // Queue / Crowd report
        //
        // IMPORTANT:
        // getQueueStatus() is the shared source of truth.
        //
        // Real mode:
        //     real backend queue values
        //
        // Simulation mode:
        //     shared simulated queue values
        // ========================================================

        if (queueStatus) {

            setText(
                "reportQueueCount",
                queueStatus.queue_size ?? 0
            );


            setText(
                "reportWaitTime",
                `${queueStatus.estimated_wait_minutes ?? 0} min`
            );


            setText(
                "reportCrowdLevel",
                queueStatus.crowd_level || "--"
            );
        }


        // ========================================================
        // Recent appointment count
        // Existing logic preserved
        // ========================================================

        setText(
            "reportRecentCount",
            appointments.length
        );


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
                        style="text-align:center;padding:2rem;">
                        No appointments found.
                    </td>
                </tr>
            `;

            return;
        }


        // ========================================================
        // Recent appointments
        // Existing logic preserved
        // ========================================================

        const recentAppointments =
            [...appointments]
                .sort(
                    (a, b) =>
                        new Date(
                            b.appointment_date
                        ) -
                        new Date(
                            a.appointment_date
                        )
                )
                .slice(0, 10);


        recentAppointments.forEach(
            appointment => {

                const row =
                    document.createElement(
                        "tr"
                    );


                let statusClass =
                    "status-pending";


                if (
                    appointment.status ===
                    "CANCELLED"
                ) {

                    statusClass =
                        "status-cancelled";

                } else if (
                    appointment.status ===
                    "COMPLETED"
                ) {

                    statusClass =
                        "status-completed";
                }


                row.innerHTML = `
                    <td>
                        ${VIZITOR.escapeHtml(
                            appointment.purpose || "-"
                        )}
                    </td>

                    <td>
                        ${VIZITOR.formatDate(
                            appointment.appointment_date
                        )}
                    </td>

                    <td>
                        ${VIZITOR.formatTime(
                            appointment.appointment_time
                        )}
                    </td>

                    <td>
                        <span class="status-badge ${statusClass}">
                            ${VIZITOR.escapeHtml(
                                appointment.status ||
                                "PENDING"
                            )}
                        </span>
                    </td>
                `;


                tableBody.appendChild(
                    row
                );
            }
        );
    }


    // ============================================================
    // Shared helper
    // ============================================================

    function setText(id, value) {

        const el =
            document.getElementById(id);


        if (el) {

            el.textContent =
                value;
        }
    }


    // ============================================================
    // Export / Print
    // Existing functionality preserved
    // ============================================================

    const exportButton =
        document.getElementById(
            "downloadReportBtn"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            () => window.print()
        );
    }


    // ============================================================
    // Initial load + live updates
    // ============================================================

    loadReport();


    setInterval(
        loadReport,
        30000
    );
});