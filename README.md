# 🩺 Maternal Health AI — Rural Healthcare Bridge

An AI-powered maternal health assistant designed to connect rural patients with quality healthcare through ASHA workers and part-time doctors.

---

## 🚀 Features

- **AI Symptom Triage** — Rule-based decision engine classifies symptoms as `low / medium / high / emergency`
- **Auto Doctor Referral** — High-severity cases are automatically assigned to an available doctor
- **Multi-Role Portal** — Separate dashboards for Patients, ASHA Workers, and Doctors
- **Multilingual Support** — Advice translated to regional languages (Hindi, Malayalam, etc.)
- **Offline-First** — Core AI works without internet or GPU

---

## 👥 User Roles

| Role | URL | Description |
|------|-----|-------------|
| Patient | `/patient` | Symptom check + instant AI advice |
| ASHA Worker | `/asha` | Community health worker dashboard |
| Doctor | `/doctor-portal` | Review and resolve patient referrals |

**Demo Doctor Login:** `doctor@health.com` / `doctor123`

---

## 🛠️ Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the server
```bash
cd maternal_health_app/backend
uvicorn main:app --reload
```

### 3. Open in browser
```
http://localhost:8000
```

The database (`health.db`) is auto-created on first startup.

---

## 📁 Project Structure

```
maternal_health_app/
├── backend/
│   ├── main.py          # FastAPI app + all API routes
│   ├── ai_logic.py      # Rule-based symptom triage engine
│   └── database.py      # SQLite schema + seed data
├── frontend/
│   ├── index.html       # Role selection portal
│   ├── patient.html     # Patient dashboard
│   ├── asha.html        # ASHA worker dashboard
│   ├── doctor.html      # Doctor portal
│   ├── landing.html     # Marketing/landing page
│   ├── style.css        # Global styles
│   ├── script.js        # Frontend logic
│   └── aiWorker.js      # Web worker for AI calls
└── requirements.txt     # Python dependencies
```

---

## 📦 Tech Stack

- **Backend:** FastAPI (Python)
- **Database:** SQLite (auto-created, no setup needed)
- **Frontend:** Vanilla HTML / CSS / JavaScript
- **Translation:** deep-translator (Google Translate)
- **TTS:** pyttsx3 (offline text-to-speech)
