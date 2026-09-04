/* =========================================================
   PATIENT 360 - HEALTHCARE MODULE
   VIZITOR / Crowd Management
========================================================= */

const HEALTHCARE_API_BASE = "http://127.0.0.1:8000";


/* =========================================================
   AUTH
========================================================= */

function getHealthcareToken() {
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("token")
    );
}


function healthcareHeaders() {
    const token = getHealthcareToken();

    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}


/* =========================================================
   API HELPER
========================================================= */

async function healthcareFetch(endpoint, options = {}) {

    const response = await fetch(
        `${HEALTHCARE_API_BASE}${endpoint}`,
        {
            ...options,
            headers: {
                ...healthcareHeaders(),
                ...(options.headers || {})
            }
        }
    );

    if (response.status === 401 || response.status === 403) {
        throw new Error(
            "Your session has expired or you are not authorized."
        );
    }

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        throw new Error(
            data?.detail ||
            data?.message ||
            "Healthcare request failed."
        );
    }

    return data;
}


/* =========================================================
   SAFE TEXT
========================================================= */

function escapeHealthcareHTML(value) {

    if (value === null || value === undefined) {
        return "--";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatHealthcareDate(value) {

    if (!value) {
        return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   LOAD PATIENT PROFILE
========================================================= */

async function loadHealthcareProfile() {

    try {

        const patient =
            await healthcareFetch("/patients/profile");

        document.getElementById("patientName").textContent =
            patient.full_name || "--";

        document.getElementById("patientId").textContent =
            patient.patient_id || "--";

        document.getElementById("bloodGroup").textContent =
            patient.blood_group || "--";

        document.getElementById("profileName").textContent =
            patient.full_name || "--";

        document.getElementById("profileAge").textContent =
            patient.age ?? "--";

        document.getElementById("profileGender").textContent =
            patient.gender || "--";

        document.getElementById("profileContact").textContent =
            patient.contact_number || "--";

        document.getElementById("profileLocation").textContent =
            patient.location || "--";

        document.getElementById("profileEmergency").textContent =
            patient.emergency_contact || "--";

        document.getElementById("profileAllergies").textContent =
            patient.allergies || "--";

        document.getElementById("profileConditions").textContent =
            patient.existing_conditions || "--";

        document.getElementById("profileMedications").textContent =
            patient.current_medications || "--";

        document.getElementById("healthcareWelcome").textContent =
            `Welcome, ${patient.full_name || "Patient"}`;

        document.getElementById("healthcareAvatar").textContent =
            (patient.full_name || "U")
                .trim()
                .charAt(0)
                .toUpperCase();

    } catch (error) {

        console.error(
            "Patient profile error:",
            error
        );

        document.getElementById("patientName").textContent =
            "Unable to load";

        document.getElementById("profileName").textContent =
            "Unable to load";
    }
}


/* =========================================================
   LOAD RISK
========================================================= */

async function loadHealthcareRisk() {

    try {

        const risk =
            await healthcareFetch("/patients/risk");

        const riskElement =
            document.getElementById("riskStatus");

        const messageElement =
            document.getElementById("riskMessage");

        riskElement.textContent =
            risk.risk_status || "--";

        messageElement.textContent =
            risk.message || "";

        riskElement.classList.remove(
            "status-high",
            "status-normal"
        );

        if (risk.high_risk) {

            riskElement.classList.add(
                "status-high"
            );

        } else {

            riskElement.classList.add(
                "status-normal"
            );
        }

    } catch (error) {

        console.error(
            "Risk assessment error:",
            error
        );

        document.getElementById("riskStatus").textContent =
            "--";

        document.getElementById("riskMessage").textContent =
            "Risk status unavailable.";
    }
}


/* =========================================================
   LOAD FOLLOW-UP ALERTS
========================================================= */

async function loadFollowUpAlerts() {

    const alertContainer =
        document.getElementById("riskAlerts");

    const followUpContainer =
        document.getElementById("followUpList");

    try {

        const data =
            await healthcareFetch("/follow-ups/alerts");

        const alerts =
            data.alerts || [];

        if (!alerts.length) {

            alertContainer.innerHTML = `
                <div class="health-empty">
                    No follow-up alerts.
                </div>
            `;

            followUpContainer.innerHTML = `
                <div class="health-empty">
                    No follow-ups scheduled.
                </div>
            `;

            document.getElementById(
                "nextFollowUp"
            ).textContent = "--";

            return;
        }


        /* -------------------------------------------------
           ALERTS
        ------------------------------------------------- */

        const importantAlerts =
            alerts.filter(
                item =>
                    item.status === "MISSED" ||
                    item.status === "DUE_TODAY"
            );


        if (!importantAlerts.length) {

            alertContainer.innerHTML = `
                <div class="health-alert-item alert-upcoming">

                    <div class="health-alert-icon">
                        ✓
                    </div>

                    <div class="health-alert-content">

                        <div class="health-alert-title">
                            No urgent follow-up alerts
                        </div>

                        <div class="health-alert-text">
                            Your scheduled follow-ups are currently on track.
                        </div>

                    </div>

                </div>
            `;

        } else {

            alertContainer.innerHTML =
                importantAlerts.map(item => {

                    const missed =
                        item.status === "MISSED";

                    return `
                        <div class="health-alert-item ${
                            missed
                                ? "alert-missed"
                                : "alert-due"
                        }">

                            <div class="health-alert-icon">
                                ${missed ? "!" : "•"}
                            </div>

                            <div class="health-alert-content">

                                <div class="health-alert-title">
                                    ${escapeHealthcareHTML(
                                        item.follow_up_type
                                    )}
                                </div>

                                <div class="health-alert-text">
                                    ${
                                        missed
                                            ? "This follow-up has been missed."
                                            : "This follow-up is due today."
                                    }
                                    Scheduled for
                                    ${formatHealthcareDate(
                                        item.scheduled_date
                                    )}.
                                </div>

                            </div>

                            <span class="health-status ${
                                missed
                                    ? "status-missed"
                                    : "status-due"
                            }">
                                ${
                                    missed
                                        ? "MISSED"
                                        : "DUE"
                                }
                            </span>

                        </div>
                    `;
                }).join("");
        }


        /* -------------------------------------------------
           FOLLOW-UP LIST
        ------------------------------------------------- */

        followUpContainer.innerHTML =
            alerts.map(item => {

                let statusClass =
                    "status-upcoming";

                if (item.status === "MISSED") {
                    statusClass = "status-missed";
                }

                if (item.status === "DUE_TODAY") {
                    statusClass = "status-due";
                }

                if (item.status === "COMPLETED") {
                    statusClass = "status-completed";
                }

                return `
                    <div class="health-list-item">

                        <div class="follow-up-row">

                            <div class="follow-up-main">

                                <div class="follow-up-title">
                                    ${escapeHealthcareHTML(
                                        item.follow_up_type
                                    )}
                                </div>

                                <div class="follow-up-date">
                                    ${formatHealthcareDate(
                                        item.scheduled_date
                                    )}
                                </div>

                            </div>

                            <span class="health-status ${statusClass}">
                                ${escapeHealthcareHTML(
                                    item.status
                                )}
                            </span>

                        </div>

                    </div>
                `;
            }).join("");


        /* -------------------------------------------------
           NEXT FOLLOW-UP CARD
        ------------------------------------------------- */

        const upcoming =
            alerts
                .filter(
                    item =>
                        item.status === "UPCOMING" ||
                        item.status === "DUE_TODAY"
                )
                .sort(
                    (a, b) =>
                        new Date(a.scheduled_date) -
                        new Date(b.scheduled_date)
                );

        if (upcoming.length) {

            document.getElementById(
                "nextFollowUp"
            ).textContent =
                formatHealthcareDate(
                    upcoming[0].scheduled_date
                );

            document.getElementById(
                "followUpStatus"
            ).textContent =
                upcoming[0].status === "DUE_TODAY"
                    ? "Due today"
                    : "Upcoming";

        }

    } catch (error) {

        console.error(
            "Follow-up alert error:",
            error
        );

        alertContainer.innerHTML = `
            <div class="health-error">
                Unable to load follow-up alerts.
            </div>
        `;

        followUpContainer.innerHTML = `
            <div class="health-error">
                Unable to load follow-up schedule.
            </div>
        `;
    }
}


/* =========================================================
   LOAD MEDICAL TIMELINE
========================================================= */

async function loadMedicalTimeline() {

    const container =
        document.getElementById("medicalTimeline");

    try {

        const data =
            await healthcareFetch(
                "/medical-records/timeline"
            );

        const timeline =
            data.timeline || [];

        if (!timeline.length) {

            container.innerHTML = `
                <div class="health-empty">
                    No medical history or appointments available yet.
                </div>
            `;

            return;
        }


        container.innerHTML =
            timeline.map(item => {

                const isAppointment =
                    item.timeline_type === "APPOINTMENT";

                const title =
                    isAppointment
                        ? item.purpose || "Appointment"
                        : item.record_type || "Medical Visit";

                const meta =
                    isAppointment
                        ? item.status || "Appointment"
                        : [
                            item.facility_name,
                            item.department
                        ]
                        .filter(Boolean)
                        .join(" • ");


                let details = "";

                if (!isAppointment) {

                    if (item.diagnosis) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Diagnosis:</strong>
                                ${escapeHealthcareHTML(
                                    item.diagnosis
                                )}
                            </div>
                        `;
                    }

                    if (item.prescription) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Prescription:</strong>
                                ${escapeHealthcareHTML(
                                    item.prescription
                                )}
                            </div>
                        `;
                    }

                    if (item.test_results) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Test Results:</strong>
                                ${escapeHealthcareHTML(
                                    item.test_results
                                )}
                            </div>
                        `;
                    }

                    if (item.referral) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Referral:</strong>
                                ${escapeHealthcareHTML(
                                    item.referral
                                )}
                            </div>
                        `;
                    }

                } else {

                    if (item.token_number) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Token:</strong>
                                ${escapeHealthcareHTML(
                                    item.token_number
                                )}
                            </div>
                        `;
                    }

                    if (item.appointment_time) {

                        details += `
                            <div class="timeline-detail-row">
                                <strong>Time:</strong>
                                ${escapeHealthcareHTML(
                                    item.appointment_time
                                )}
                            </div>
                        `;
                    }
                }


                return `
                    <div class="timeline-item">

                        <div class="timeline-dot"></div>

                        <div class="timeline-card">

                            <div class="timeline-header">

                                <div class="timeline-title">
                                    ${escapeHealthcareHTML(
                                        title
                                    )}
                                </div>

                                <div class="timeline-date">
                                    ${formatHealthcareDate(
                                        item.date
                                    )}
                                </div>

                            </div>

                            <div class="timeline-meta">
                                ${escapeHealthcareHTML(
                                    meta
                                )}
                            </div>

                            ${
                                details
                                    ? `
                                        <div class="timeline-detail">
                                            ${details}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Medical timeline error:",
            error
        );

        container.innerHTML = `
            <div class="health-error">
                Unable to load your medical timeline.
            </div>
        `;
    }
}


/* =========================================================
   LOAD MATERNAL / CHILD
========================================================= */

async function loadMaternalChildRecords() {

    const container =
        document.getElementById(
            "maternalChildList"
        );

    try {

        const data =
            await healthcareFetch(
                "/maternal-child"
            );

        const records =
            data.records || [];

        if (!records.length) {

            container.innerHTML = `
                <div class="health-empty">
                    No maternal or child records available.
                </div>
            `;

            return;
        }


        container.innerHTML =
            records.map(record => {

                const fields = [];


                if (record.pregnancy_status) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Pregnancy Status</span>
                            <strong>
                                ${escapeHealthcareHTML(
                                    record.pregnancy_status
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.expected_delivery_date) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Expected Delivery</span>
                            <strong>
                                ${formatHealthcareDate(
                                    record.expected_delivery_date
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.anc_visit_date) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>ANC Visit</span>
                            <strong>
                                ${formatHealthcareDate(
                                    record.anc_visit_date
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.maternal_vaccination) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Maternal Vaccination</span>
                            <strong>
                                ${escapeHealthcareHTML(
                                    record.maternal_vaccination
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.child_name) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Child</span>
                            <strong>
                                ${escapeHealthcareHTML(
                                    record.child_name
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.child_vaccination) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Child Vaccination</span>
                            <strong>
                                ${escapeHealthcareHTML(
                                    record.child_vaccination
                                )}
                            </strong>
                        </div>
                    `);
                }


                if (record.child_checkup_date) {

                    fields.push(`
                        <div class="health-record-field">
                            <span>Child Checkup</span>
                            <strong>
                                ${formatHealthcareDate(
                                    record.child_checkup_date
                                )}
                            </strong>
                        </div>
                    `);
                }


                return `
                    <div class="health-list-item">

                        <div class="health-record-header">

                            <div>

                                <div class="health-record-title">
                                    ${escapeHealthcareHTML(
                                        record.record_category
                                    )}
                                    Follow-up
                                </div>

                                <div class="health-record-subtitle">
                                    ${formatHealthcareDate(
                                        record.created_at
                                    )}
                                </div>

                            </div>

                            ${
                                record.missed_follow_up
                                    ? `
                                        <span class="health-status status-missed">
                                            MISSED
                                        </span>
                                      `
                                    : ""
                            }

                        </div>

                        ${
                            fields.length
                                ? `
                                    <div class="health-record-grid">
                                        ${fields.join("")}
                                    </div>
                                  `
                                : ""
                        }

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Maternal/child error:",
            error
        );

        container.innerHTML = `
            <div class="health-error">
                Unable to load maternal and child records.
            </div>
        `;
    }
}


/* =========================================================
   LOAD CHRONIC DISEASE
========================================================= */

async function loadChronicDiseaseRecords() {

    const container =
        document.getElementById(
            "chronicDiseaseList"
        );

    try {

        const data =
            await healthcareFetch(
                "/chronic-disease"
            );

        const records =
            data.records || [];

        if (!records.length) {

            container.innerHTML = `
                <div class="health-empty">
                    No chronic disease records available.
                </div>
            `;

            return;
        }


        container.innerHTML =
            records.map(record => {

                let statusClass =
                    "status-normal";

                if (
                    record.missed_visit ||
                    record.reminder_status === "MISSED"
                ) {

                    statusClass =
                        "status-missed";

                } else if (
                    record.reminder_status === "PENDING"
                ) {

                    statusClass =
                        "status-upcoming";
                }


                return `
                    <div class="health-list-item">

                        <div class="health-record-header">

                            <div>

                                <div class="health-record-title">
                                    ${escapeHealthcareHTML(
                                        record.disease_name
                                    )}
                                </div>

                                <div class="health-record-subtitle">
                                    ${escapeHealthcareHTML(
                                        record.diagnosis_status
                                    )}
                                </div>

                            </div>

                            <span class="health-status ${statusClass}">
                                ${escapeHealthcareHTML(
                                    record.reminder_status
                                )}
                            </span>

                        </div>


                        <div class="health-record-grid">

                            <div class="health-record-field">

                                <span>
                                    Medication
                                </span>

                                <strong>
                                    ${escapeHealthcareHTML(
                                        record.medication
                                    )}
                                </strong>

                            </div>


                            <div class="health-record-field">

                                <span>
                                    Last Checkup
                                </span>

                                <strong>
                                    ${formatHealthcareDate(
                                        record.checkup_date
                                    )}
                                </strong>

                            </div>


                            <div class="health-record-field">

                                <span>
                                    Next Follow-up
                                </span>

                                <strong>
                                    ${formatHealthcareDate(
                                        record.next_follow_up
                                    )}
                                </strong>

                            </div>


                            <div class="health-record-field">

                                <span>
                                    Visit Status
                                </span>

                                <strong>
                                    ${
                                        record.missed_visit
                                            ? "Missed"
                                            : "On Track"
                                    }
                                </strong>

                            </div>

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Chronic disease error:",
            error
        );

        container.innerHTML = `
            <div class="health-error">
                Unable to load chronic disease records.
            </div>
        `;
    }
}


/* =========================================================
   DIGITAL TRIAGE
========================================================= */

async function assessHealthcareTriage() {

    const symptomsElement =
        document.getElementById("symptoms");

    const resultContainer =
        document.getElementById("triageResult");

    const button =
        document.getElementById(
            "assessTriageBtn"
        );

    const symptoms =
        symptomsElement.value.trim();


    if (!symptoms) {

        resultContainer.innerHTML = `
            <div class="health-error">
                Please describe your symptoms first.
            </div>
        `;

        return;
    }


    button.disabled = true;
    button.textContent = "Assessing...";


    try {

        const result =
            await healthcareFetch(
                "/triage",
                {
                    method: "POST",

                    body: JSON.stringify({
                        symptoms: symptoms
                    })
                }
            );


        let priorityClass =
            "status-normal";

        if (result.priority === "EMERGENCY") {

            priorityClass =
                "status-high";

        } else if (result.priority === "URGENT") {

            priorityClass =
                "status-due";
        }


        resultContainer.innerHTML = `

            <div class="triage-result-card">

                <div class="triage-result-header">

                    <div>

                        <div class="triage-priority">
                            ${escapeHealthcareHTML(
                                result.priority
                            )}
                        </div>

                        <div class="triage-department">
                            Recommended:
                            ${escapeHealthcareHTML(
                                result.department
                            )}
                        </div>

                    </div>


                    <span class="health-status ${priorityClass}">
                        ${escapeHealthcareHTML(
                            result.priority
                        )}
                    </span>

                </div>


                <div class="triage-reason">

                    <strong>
                        Assessment
                    </strong>

                    <br>

                    ${escapeHealthcareHTML(
                        result.reason
                    )}

                </div>


                ${
                    result.emergency
                        ? `
                            <div class="triage-emergency">
                                ⚠ Emergency indicators detected.
                                Seek immediate medical attention.
                            </div>
                          `
                        : ""
                }


                <div class="health-card-subtext"
                     style="margin-top:14px;">

                    ${escapeHealthcareHTML(
                        result.disclaimer
                    )}

                </div>

            </div>
        `;

    } catch (error) {

        console.error(
            "Triage error:",
            error
        );

        resultContainer.innerHTML = `
            <div class="health-error">
                ${escapeHealthcareHTML(
                    error.message
                )}
            </div>
        `;

    } finally {

        button.disabled = false;
        button.textContent = "Assess Symptoms";
    }
}


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

async function initializeHealthcarePage() {

    const token =
        getHealthcareToken();

    if (!token) {

        console.warn(
            "No authentication token found."
        );

        return;
    }


    await Promise.allSettled([
        loadHealthcareProfile(),
        loadHealthcareRisk(),
        loadFollowUpAlerts(),
        loadMedicalTimeline(),
        loadMaternalChildRecords(),
        loadChronicDiseaseRecords()
    ]);
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const triageButton =
            document.getElementById(
                "assessTriageBtn"
            );

        if (triageButton) {

            triageButton.addEventListener(
                "click",
                assessHealthcareTriage
            );
        }


        initializeHealthcarePage();
    }
);