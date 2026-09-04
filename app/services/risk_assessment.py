def assess_patient_risk(
    age: int,
    existing_conditions: str | None,
    current_medications: str | None,
) -> str:

    conditions = (existing_conditions or "").lower()
    medications = (current_medications or "").lower()

    high_risk_conditions = [
        "diabetes",
        "hypertension",
        "heart disease",
        "cardiac",
        "stroke",
        "kidney disease",
        "renal",
        "cancer",
    ]

    for condition in high_risk_conditions:
        if condition in conditions:
            return "HIGH"

    if age >= 65:
        return "HIGH"

    if medications:
        high_risk_medications = [
            "insulin",
            "anticoagulant",
            "warfarin",
        ]

        for medication in high_risk_medications:
            if medication in medications:
                return "HIGH"

    return "NORMAL"