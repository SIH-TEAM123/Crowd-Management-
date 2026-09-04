from dataclasses import dataclass


@dataclass
class TriageResult:
    priority: str
    department: str
    reason: str
    emergency: bool


EMERGENCY_KEYWORDS = [
    "chest pain",
    "difficulty breathing",
    "severe bleeding",
    "unconscious",
    "stroke",
    "seizure",
    "heart attack",
    "severe burn",
]


URGENT_KEYWORDS = [
    "high fever",
    "severe pain",
    "persistent vomiting",
    "dehydration",
    "fracture",
    "infection",
]


def assess_symptoms(symptoms: str) -> TriageResult:
    text = symptoms.lower().strip()

    if not text:
        return TriageResult(
            priority="NORMAL",
            department="General Medicine",
            reason="No symptoms were provided.",
            emergency=False,
        )

    # Emergency assessment
    for keyword in EMERGENCY_KEYWORDS:
        if keyword in text:
            return TriageResult(
                priority="EMERGENCY",
                department="Emergency",
                reason=f"Symptom indicates a possible emergency: {keyword}.",
                emergency=True,
            )

    # Urgent assessment
    for keyword in URGENT_KEYWORDS:
        if keyword in text:
            return TriageResult(
                priority="URGENT",
                department="General Medicine",
                reason=f"Symptoms may require prompt medical attention: {keyword}.",
                emergency=False,
            )

    # Default
    return TriageResult(
        priority="NORMAL",
        department="General Medicine",
        reason="Symptoms do not match the configured emergency or urgent indicators.",
        emergency=False,
    )