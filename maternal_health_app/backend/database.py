import sqlite3
import os

# Path to database file
DB_PATH = os.path.join(os.path.dirname(__file__), "health.db")


def get_connection():
    """Create and return a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Allows accessing columns by name
    return conn


def init_db():
    """
    Initialize the database by creating tables if they don't exist.
    Called once when the server starts.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Table 1: Patients - stores basic info submitted through the patient app
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            language TEXT DEFAULT 'en',
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)

    # Table 2: Consultations - stores each symptom check and its AI advice
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            symptoms TEXT NOT NULL,
            ai_advice TEXT,
            severity TEXT,         -- 'low', 'medium', 'high', 'emergency'
            referred_to_doctor INTEGER DEFAULT 0,  -- 1 = yes, 0 = no
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    # Table 3: Doctors - part-time doctors registered in the system
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialization TEXT DEFAULT 'General Physician',
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,   -- In a real app, store hashed passwords
            is_available INTEGER DEFAULT 1
        )
    """)

    # Table 4: Referrals - when AI triages a patient to a doctor
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consultation_id INTEGER,
            doctor_id INTEGER,
            status TEXT DEFAULT 'pending',   -- 'pending', 'reviewed', 'resolved'
            doctor_notes TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (consultation_id) REFERENCES consultations(id),
            FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Database initialized successfully.")


def seed_demo_data():
    """Insert a demo doctor account if the doctors table is empty."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM doctors")
    count = cursor.fetchone()[0]
    if count == 0:
        cursor.execute("""
            INSERT INTO doctors (name, specialization, email, password)
            VALUES (?, ?, ?, ?)
        """, ("Dr. Priya Nair", "Obstetrician", "doctor@health.com", "doctor123"))
        conn.commit()
        print("[DB] Demo doctor account seeded: doctor@health.com / doctor123")
    conn.close()
