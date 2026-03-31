"""
main.py - FastAPI Application Entry Point
==========================================
This is the main server file. It wires together the database, AI logic,
and all API endpoints. Run it with: uvicorn main:app --reload
"""

from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os

# Import our own modules
from database import init_db, seed_demo_data, get_connection
from ai_logic import analyze_symptoms

# ── App Setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Maternal Health API",
    description="Bridging rural patients with quality healthcare.",
    version="1.0.0"
)

# Allow the frontend (HTML) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve Frontend Files ───────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


def serve_frontend_file(filename: str, cache_control: str = "no-store"):
    """Serve a frontend file with headers that avoid stale browser caches."""
    return FileResponse(
        os.path.join(FRONTEND_DIR, filename),
        headers={"Cache-Control": cache_control},
    )


@app.get("/")
def serve_home():
    """Serve the main role selection portal page."""
    return serve_frontend_file("index.html")

@app.get("/patient")
def serve_patient():
    """Serve the patient interactive dashboard page."""
    return serve_frontend_file("patient.html")

@app.get("/asha")
def serve_asha():
    """Serve the ASHA worker dashboard page."""
    return serve_frontend_file("asha.html")

@app.get("/landing")
def serve_landing():
    """Serve the marketing/landing page."""
    return serve_frontend_file("landing.html")

@app.get("/doctor-portal")
def serve_doctor_portal():
    """Serve the doctor dashboard HTML page."""
    return serve_frontend_file("doctor.html")


@app.get("/style.css")
def serve_style():
    """Compatibility route for older HTML that still requests /style.css."""
    return serve_frontend_file("style.css")


@app.get("/script.js")
def serve_script():
    """Compatibility route for older HTML that still requests /script.js."""
    return serve_frontend_file("script.js")


@app.get("/manifest.json")
def serve_manifest():
    """Compatibility route for older HTML that still requests /manifest.json."""
    return serve_frontend_file("manifest.json")


@app.get("/aiWorker.js")
def serve_ai_worker():
    """Compatibility route for the frontend web worker entry file."""
    return serve_frontend_file("aiWorker.js")


# ── Startup Event ──────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    """Runs once when the server starts. Sets up the database."""
    init_db()
    seed_demo_data()


# ── Pydantic Models (Request/Response Shapes) ──────────────────────────────
class PatientRequest(BaseModel):
    name: str
    age: Optional[int] = None
    language: Optional[str] = "en"

class SymptomRequest(BaseModel):
    patient_id: int
    symptoms: str
    trimester: Optional[int] = None  # 1, 2, or 3

class TranslateRequest(BaseModel):
    text: str
    target_language: str  # e.g., 'ml' for Malayalam, 'hi' for Hindi

class DoctorLoginRequest(BaseModel):
    email: str
    password: str

class ReferralUpdateRequest(BaseModel):
    status: str          # 'reviewed' or 'resolved'
    doctor_notes: str


# ── Patient Endpoints ──────────────────────────────────────────────────────

@app.post("/patient/register")
def register_patient(req: PatientRequest):
    """
    Register a new patient.
    Example: POST /patient/register
    Body: {"name": "Meera", "age": 25, "language": "ml"}
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO patients (name, age, language) VALUES (?, ?, ?)",
        (req.name, req.age, req.language)
    )
    conn.commit()
    patient_id = cursor.lastrowid
    conn.close()
    return {"success": True, "patient_id": patient_id, "message": f"Welcome, {req.name}!"}


@app.post("/predict")
def predict_advice(req: SymptomRequest):
    """
    Core AI endpoint. Takes patient symptoms and returns advice.
    Also auto-creates a doctor referral if severity is 'high' or 'emergency'.
    
    Example: POST /predict
    Body: {"patient_id": 1, "symptoms": "I have heavy bleeding and severe pain", "trimester": 3}
    """
    # Step 1: Run symptom analysis using our AI logic
    result = analyze_symptoms(req.symptoms, req.trimester)

    conn = get_connection()
    cursor = conn.cursor()

    # Step 2: Save the consultation to the database
    cursor.execute("""
        INSERT INTO consultations (patient_id, symptoms, ai_advice, severity, referred_to_doctor)
        VALUES (?, ?, ?, ?, ?)
    """, (
        req.patient_id,
        req.symptoms,
        result["advice"],
        result["severity"],
        1 if result["refer_to_doctor"] else 0
    ))
    consultation_id = cursor.lastrowid

    # Step 3: If high severity, auto-create a referral to the first available doctor
    referral_created = False
    if result["refer_to_doctor"]:
        cursor.execute("SELECT id FROM doctors WHERE is_available = 1 LIMIT 1")
        doctor = cursor.fetchone()
        if doctor:
            cursor.execute("""
                INSERT INTO referrals (consultation_id, doctor_id, status)
                VALUES (?, ?, 'pending')
            """, (consultation_id, doctor["id"]))
            referral_created = True

    conn.commit()
    conn.close()

    return {
        "severity": result["severity"],
        "advice": result["advice"],
        "refer_to_doctor": result["refer_to_doctor"],
        "referral_created": referral_created,
        "trimester_tip": result["trimester_tip"],
    }


@app.post("/translate")
def translate_text(req: TranslateRequest):
    """
    Translate text to a target language.
    Uses deep-translator (works offline with some languages, online with Google).
    
    Example: POST /translate
    Body: {"text": "You have a fever.", "target_language": "ml"}
    """
    try:
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(source='auto', target=req.target_language).translate(req.text)
        return {"original": req.text, "translated": translated, "language": req.target_language}
    except Exception as e:
        # If translation fails (e.g., offline), return original text with a note
        return {"original": req.text, "translated": req.text, "error": f"Translation failed: {str(e)}"}


@app.post("/voice/text-to-speech")
def text_to_speech(text: str = Form(...), lang: str = Form("en")):
    """
    Convert text advice to speech. Plays audio on the SERVER side (for demos).
    In production, use a cloud TTS API to send audio back to the client.
    
    Example: POST /voice/text-to-speech (form data: text, lang)
    """
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)   # Speed of speech (words per minute)
        engine.setProperty('volume', 1.0) # Volume (0.0 to 1.0)
        engine.say(text)
        engine.runAndWait()
        return {"success": True, "message": "Speech played successfully."}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Doctor Portal Endpoints ────────────────────────────────────────────────

@app.post("/doctor/login")
def doctor_login(req: DoctorLoginRequest):
    """
    Authenticate a part-time doctor.
    
    Example: POST /doctor/login
    Body: {"email": "doctor@health.com", "password": "doctor123"}
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, specialization FROM doctors WHERE email = ? AND password = ?",
        (req.email, req.password)
    )
    doctor = cursor.fetchone()
    conn.close()

    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "success": True,
        "doctor_id": doctor["id"],
        "name": doctor["name"],
        "specialization": doctor["specialization"],
    }


@app.get("/doctor/{doctor_id}/referrals")
def get_doctor_referrals(doctor_id: int):
    """
    Get all pending and reviewed patient referrals assigned to this doctor.
    
    Example: GET /doctor/1/referrals
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            r.id as referral_id,
            r.status,
            r.doctor_notes,
            r.created_at,
            c.symptoms,
            c.ai_advice,
            c.severity,
            p.name as patient_name,
            p.age as patient_age,
            p.language as patient_language
        FROM referrals r
        JOIN consultations c ON r.consultation_id = c.id
        JOIN patients p ON c.patient_id = p.id
        WHERE r.doctor_id = ?
        ORDER BY r.created_at DESC
    """, (doctor_id,))
    rows = cursor.fetchall()
    conn.close()

    referrals = [dict(row) for row in rows]
    return {"referrals": referrals, "count": len(referrals)}


@app.put("/doctor/referral/{referral_id}")
def update_referral(referral_id: int, req: ReferralUpdateRequest):
    """
    Doctor updates the status of a referral (e.g., adds notes and marks as resolved).
    
    Example: PUT /doctor/referral/1
    Body: {"status": "resolved", "doctor_notes": "Patient should take paracetamol 500mg."}
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE referrals SET status = ?, doctor_notes = ? WHERE id = ?
    """, (req.status, req.doctor_notes, referral_id))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Referral #{referral_id} updated to '{req.status}'."}


@app.get("/health")
def health_check():
    """Simple ping endpoint to check if the server is running."""
    return {"status": "online", "message": "Maternal Health API is running!"}
