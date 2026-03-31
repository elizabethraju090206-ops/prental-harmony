"""
AI Logic Module - Rule-Based Symptom Decision Tree
====================================================
This module contains the core AI logic for analyzing maternal health symptoms.
It uses a simple rule-based approach (IF symptom THEN advice) which is fast,
works offline, and is easy to understand and extend.
"""

# ── Symptom Keywords mapped to severity levels ──────────────────────────────
# Each key is a severity level, each value is a list of symptom keywords.
# If a patient reports a symptom matching any keyword in EMERGENCY, 
# it's flagged as an emergency and a doctor referral is auto-created.

SYMPTOM_RULES = {
    "emergency": {
        "keywords": [
            "bleeding", "heavy bleeding", "hemorrhage",
            "severe pain", "chest pain",
            "convulsion", "seizure", "fits",
            "unconscious", "fainted", "not breathing",
            "water broke", "water break", "labour", "delivery",
            "no baby movement", "baby not moving", "reduced fetal movement",
            "preeclampsia", "high bp", "very high blood pressure",
        ],
        "advice": (
            "🚨 EMERGENCY ALERT! This is a serious condition. "
            "Please go to the nearest hospital IMMEDIATELY or call emergency services. "
            "A doctor has been alerted and will contact you shortly."
        ),
        "refer_to_doctor": True,
    },
    "high": {
        "keywords": [
            "high fever", "fever over 39", "very high fever",
            "severe vomiting", "cannot eat", "dehydration",
            "blurred vision", "vision problem", "swollen face",
            "severe headache", "worst headache",
            "difficulty breathing", "shortness of breath",
        ],
        "advice": (
            "⚠️ Your symptoms need urgent medical attention. "
            "Please visit a clinic or hospital today. "
            "A doctor will review your case and may contact you soon."
        ),
        "refer_to_doctor": True,
    },
    "medium": {
        "keywords": [
            "fever", "temperature", "feeling hot",
            "nausea", "vomiting", "morning sickness",
            "headache", "head pain",
            "backache", "back pain", "lower back pain",
            "fatigue", "tired", "weakness",
            "mild swelling", "ankle swelling", "leg swelling",
            "vaginal discharge", "discharge",
            "heartburn", "acid reflux", "indigestion",
            "constipation", "difficulty passing stool",
        ],
        "advice": (
            "📋 These symptoms are common during pregnancy but should be monitored. "
            "Rest well, drink plenty of water, and eat nutritious food. "
            "If symptoms get worse or don't improve in 24 hours, please see a doctor."
        ),
        "refer_to_doctor": False,
    },
    "low": {
        "keywords": [
            "mild cramps", "light cramps", "minor pain",
            "mood swings", "anxiety", "stress", "feeling sad",
            "itching", "skin rash", "stretch marks",
            "frequent urination", "urinating often",
            "gas", "bloating", "flatulence",
            "dizziness", "lightheaded",
        ],
        "advice": (
            "✅ These are common symptoms during pregnancy and are generally not a concern. "
            "Get plenty of rest, eat balanced meals, and stay hydrated. "
            "Attend your next prenatal checkup as scheduled."
        ),
        "refer_to_doctor": False,
    },
}

# ── Trimester Tips ───────────────────────────────────────────────────────────
TRIMESTER_TIPS = {
    1: "First Trimester Tip: Take folic acid daily. Avoid alcohol, raw foods, and smoking.",
    2: "Second Trimester Tip: Regular prenatal checkups are important. Monitor baby's movements.",
    3: "Third Trimester Tip: Prepare your hospital bag. Learn the signs of labor. Rest is crucial.",
}


def analyze_symptoms(symptoms_text: str, trimester: int = None) -> dict:
    """
    Analyze a patient's symptom text and return advice.
    
    Args:
        symptoms_text: A string describing the patient's symptoms.
        trimester: Optional (1, 2, or 3) - adds trimester-specific tips.
    
    Returns:
        A dictionary with: severity, advice, refer_to_doctor, trimester_tip.
    """
    # Convert input to lowercase for easy matching
    text_lower = symptoms_text.lower()

    # Check symptoms against rules, from most severe to least severe
    matched_severity = "low"
    matched_advice = "✅ No specific symptoms matched. Please monitor your health and attend regular prenatal checkups."
    refer_to_doctor = False

    for severity in ["emergency", "high", "medium", "low"]:
        rule = SYMPTOM_RULES[severity]
        for keyword in rule["keywords"]:
            if keyword in text_lower:
                matched_severity = severity
                matched_advice = rule["advice"]
                refer_to_doctor = rule["refer_to_doctor"]
                break  # Stop at first match for this severity level
        if matched_severity == severity and severity != "low":
            break  # Stop checking if we found an emergency or high match

    # Add trimester-specific tip if provided
    trimester_tip = None
    if trimester and trimester in TRIMESTER_TIPS:
        trimester_tip = TRIMESTER_TIPS[trimester]

    return {
        "severity": matched_severity,
        "advice": matched_advice,
        "refer_to_doctor": refer_to_doctor,
        "trimester_tip": trimester_tip,
    }
