from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import List, Optional

ROOT = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = ROOT.parent / ".venv" / "Lib" / "site-packages"

if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

MODEL_PATH = ROOT / "symptom_model.pkl"
FEATURES_PATH = ROOT / "symptom_features.pkl"

# ── Disease → Severity / Doctor Visit mapping ─────────────────────────────
# Every disease from training_data.csv is classified into one of four levels.

DISEASE_SEVERITY = {
    # EMERGENCY — Seek ER immediately
    "Heart attack": {
        "urgency": "emergency",
        "should_visit_doctor": True,
        "recommendation": "EMERGENCY: Seek immediate emergency medical care. Call an ambulance or go to the nearest ER right away.",
        "specialty": "Cardiologist",
    },
    "Paralysis (brain hemorrhage)": {
        "urgency": "emergency",
        "should_visit_doctor": True,
        "recommendation": "EMERGENCY: This could indicate a stroke or brain hemorrhage. Call emergency services immediately.",
        "specialty": "Neurologist",
    },

    # DOCTOR REQUIRED — Must see a doctor soon (within 24-48h)
    "Pneumonia": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "You should see a doctor as soon as possible. Pneumonia requires medical evaluation and may need antibiotics or hospitalization.",
        "specialty": "Pulmonologist",
    },
    "Tuberculosis": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please visit a doctor promptly. Tuberculosis requires prolonged antibiotic treatment and monitoring.",
        "specialty": "Pulmonologist",
    },
    "Malaria": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is essential. Malaria requires antimalarial medication and medical supervision.",
        "specialty": "Infectious Disease Specialist",
    },
    "Dengue": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "See a doctor immediately. Dengue requires close monitoring for complications like hemorrhagic fever.",
        "specialty": "Infectious Disease Specialist",
    },
    "Typhoid": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is necessary. Typhoid requires antibiotic treatment and can cause serious complications if untreated.",
        "specialty": "Infectious Disease Specialist",
    },
    "hepatitis A": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please consult a doctor. Hepatitis A needs medical monitoring to prevent liver complications.",
        "specialty": "Hepatologist",
    },
    "Hepatitis B": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is essential. Hepatitis B requires antiviral treatment and liver function monitoring.",
        "specialty": "Hepatologist",
    },
    "Hepatitis C": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "See a doctor soon. Hepatitis C is curable with proper antiviral therapy but needs medical supervision.",
        "specialty": "Hepatologist",
    },
    "Hepatitis D": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is critical. Hepatitis D co-infection can accelerate liver damage.",
        "specialty": "Hepatologist",
    },
    "Hepatitis E": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please see a doctor. Hepatitis E usually resolves but needs monitoring, especially in pregnant women.",
        "specialty": "Hepatologist",
    },
    "Alcoholic hepatitis": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Medical attention is needed. Alcoholic hepatitis can be life-threatening and requires treatment and lifestyle changes.",
        "specialty": "Hepatologist",
    },
    "Diabetes": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please visit a doctor. Diabetes requires proper diagnosis, medication management, and ongoing monitoring.",
        "specialty": "Endocrinologist",
    },
    "Hypertension": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "See a doctor for proper evaluation. Hypertension needs medication and lifestyle management to prevent complications.",
        "specialty": "Cardiologist",
    },
    "Jaundice": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is recommended. Jaundice indicates liver issues that need proper diagnosis and treatment.",
        "specialty": "Hepatologist",
    },
    "Chronic cholestasis": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "See a doctor. Chronic cholestasis requires investigation of underlying liver or bile duct conditions.",
        "specialty": "Gastroenterologist",
    },
    "AIDS": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Immediate medical consultation is essential. HIV/AIDS requires antiretroviral therapy and ongoing care.",
        "specialty": "Infectious Disease Specialist",
    },
    "Chicken pox": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Consult a doctor, especially for adults or immunocompromised patients. Antiviral medication may be needed.",
        "specialty": "Dermatologist",
    },
    "Peptic ulcer diseae": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please see a gastroenterologist. Peptic ulcers need medication (PPIs/antibiotics) to heal and prevent complications.",
        "specialty": "Gastroenterologist",
    },
    "Dimorphic hemmorhoids(piles)": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Consider seeing a doctor. While mild hemorrhoids can be managed at home, persistent or bleeding cases need medical evaluation.",
        "specialty": "Proctologist",
    },
    "Hyperthyroidism": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Doctor visit is necessary. Hyperthyroidism requires medication to regulate thyroid hormone levels.",
        "specialty": "Endocrinologist",
    },
    "Hypothyroidism": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "Please see an endocrinologist. Hypothyroidism requires thyroid hormone replacement therapy.",
        "specialty": "Endocrinologist",
    },
    "Hypoglycemia": {
        "urgency": "doctor_required",
        "should_visit_doctor": True,
        "recommendation": "See a doctor to identify the cause. Recurrent hypoglycemia needs investigation and management adjustment.",
        "specialty": "Endocrinologist",
    },
    "Varicose veins": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Consider consulting a vascular specialist. While not always urgent, varicose veins can worsen and cause complications.",
        "specialty": "Vascular Surgeon",
    },

    # DOCTOR RECOMMENDED — Should see a doctor if symptoms persist (3-5 days)
    "Bronchial Asthma": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Schedule a doctor visit. Asthma needs proper diagnosis, an action plan, and possibly inhaler prescriptions.",
        "specialty": "Pulmonologist",
    },
    "Urinary tract infection": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "See a doctor if symptoms persist beyond 2 days. UTIs typically require antibiotics for proper treatment.",
        "specialty": "Urologist",
    },
    "Migraine": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": False,
        "recommendation": "You can manage mild migraines at home with rest and OTC pain relief. See a doctor if attacks are frequent or severe.",
        "specialty": "Neurologist",
    },
    "Cervical spondylosis": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Consider seeing an orthopedist. Physical therapy and proper management can prevent worsening.",
        "specialty": "Orthopedist",
    },
    "(vertigo) Paroymsal  Positional Vertigo": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "A doctor visit is recommended for proper diagnosis. Positional vertigo can often be treated with repositioning maneuvers.",
        "specialty": "ENT Specialist",
    },
    "Osteoarthristis": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "See a doctor for pain management and physical therapy recommendations. Early treatment slows progression.",
        "specialty": "Orthopedist",
    },
    "Arthritis": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Consult a rheumatologist for proper diagnosis and treatment plan to manage inflammation and pain.",
        "specialty": "Rheumatologist",
    },
    "Psoriasis": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "See a dermatologist for treatment options. Psoriasis is chronic but manageable with proper care.",
        "specialty": "Dermatologist",
    },
    "Impetigo": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "See a doctor for antibiotic treatment. Impetigo is contagious and needs proper medication.",
        "specialty": "Dermatologist",
    },
    "Gastroenteritis": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": False,
        "recommendation": "Most cases resolve in 1-3 days with rest and hydration. See a doctor if symptoms last more than 3 days or you can't keep fluids down.",
        "specialty": "Gastroenterologist",
    },
    "GERD": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": False,
        "recommendation": "Mild GERD can be managed with lifestyle changes and OTC antacids. See a doctor if symptoms are frequent or severe.",
        "specialty": "Gastroenterologist",
    },

    # SELF-CARE — Can manage at home
    "Common Cold": {
        "urgency": "self_care",
        "should_visit_doctor": False,
        "recommendation": "No doctor visit needed. Rest, stay hydrated, and use OTC cold remedies. See a doctor only if symptoms last more than 10 days.",
        "specialty": "General Practitioner",
    },
    "Acne": {
        "urgency": "self_care",
        "should_visit_doctor": False,
        "recommendation": "Mild acne can be managed at home with proper skincare. See a dermatologist only for severe or persistent cases.",
        "specialty": "Dermatologist",
    },
    "Drug Reaction": {
        "urgency": "doctor_recommended",
        "should_visit_doctor": True,
        "recommendation": "Stop the suspected medication and consult your doctor. Severe reactions (breathing difficulty, swelling) need emergency care.",
        "specialty": "Allergist",
    },
    "Fungal infection": {
        "urgency": "self_care",
        "should_visit_doctor": False,
        "recommendation": "Most fungal infections respond to OTC antifungal creams. See a doctor if the infection spreads or doesn't improve in 2 weeks.",
        "specialty": "Dermatologist",
    },
    "Allergy": {
        "urgency": "self_care",
        "should_visit_doctor": False,
        "recommendation": "Mild allergies can be managed with OTC antihistamines. See a doctor for severe or persistent allergic reactions.",
        "specialty": "Allergist",
    },
}

# Fallback for any disease not in the mapping
DEFAULT_SEVERITY = {
    "urgency": "doctor_recommended",
    "should_visit_doctor": True,
    "recommendation": "We recommend consulting a healthcare professional for proper evaluation and treatment.",
    "specialty": "General Practitioner",
}

# ── FastAPI App ────────────────────────────────────────────────────────────

app = FastAPI(title="CareLink Symptom Prediction API", version="2.0.0")

# Enable CORS for frontend direct calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
features: List[str] = []


class PredictionRequest(BaseModel):
    symptoms: List[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    predicted_disease: str
    should_visit_doctor: bool
    urgency_level: str  # "emergency" | "doctor_required" | "doctor_recommended" | "self_care"
    recommendation: str
    specialty: str
    confidence: float
    matched_symptoms: List[str]
    all_matched_count: int
    severity_label: str  # Human-readable: "Emergency", "See Doctor Soon", etc.


class SymptomsListResponse(BaseModel):
    symptoms: List[str]
    count: int


@app.on_event("startup")
def load_artifacts() -> None:
    global model, features
    if not MODEL_PATH.exists() or not FEATURES_PATH.exists():
        return

    model = joblib.load(MODEL_PATH)
    features = joblib.load(FEATURES_PATH)


@app.get("/health")
def health() -> dict[str, str]:
    status = "ready" if model is not None and features else "missing-artifacts"
    return {"status": status}


@app.get("/symptoms", response_model=SymptomsListResponse)
def get_symptoms() -> SymptomsListResponse:
    """Return the full list of symptom names the model was trained on."""
    if not features:
        raise HTTPException(
            status_code=503,
            detail="Model artifacts are missing. Run train_model.py first.",
        )

    # Clean feature names for display: replace underscores with spaces
    cleaned = [f.replace("_", " ").strip() for f in features]
    return SymptomsListResponse(symptoms=cleaned, count=len(cleaned))


SEVERITY_LABELS = {
    "emergency": "Emergency",
    "doctor_required": "See Doctor Soon",
    "doctor_recommended": "Doctor Recommended",
    "self_care": "Self-Care at Home",
}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    if model is None or not features:
        raise HTTPException(
            status_code=503,
            detail="Model artifacts are missing. Run train_model.py first.",
        )

    symptom_set = {item.strip().lower().replace(" ", "_") for item in request.symptoms if item.strip()}

    # Also try matching without underscores (user might type "skin rash" instead of "skin_rash")
    symptom_set_spaces = {item.strip().lower().replace("_", " ") for item in request.symptoms if item.strip()}

    input_vector = []
    matched = []
    for feature in features:
        feat_lower = feature.lower()
        feat_spaces = feat_lower.replace("_", " ")
        if feat_lower in symptom_set or feat_spaces in symptom_set_spaces or feat_lower in symptom_set_spaces or feat_spaces in symptom_set:
            input_vector.append(1)
            matched.append(feature.replace("_", " "))
        else:
            input_vector.append(0)

    if len(matched) == 0:
        return PredictionResponse(
            predicted_disease="No Condition Matched",
            should_visit_doctor=False,
            urgency_level="self_care",
            recommendation="Please provide specific valid symptoms (e.g., 'high fever', 'cough', 'chest pain') so the AI can predict a disease.",
            specialty="None",
            confidence=0.0,
            matched_symptoms=[],
            all_matched_count=0,
            severity_label="Need More Info",
        )

    # Get prediction with probability
    predicted_disease = model.predict([input_vector])[0]
    probabilities = model.predict_proba([input_vector])[0]
    confidence = float(np.max(probabilities))

    # Look up severity mapping
    severity_info = DISEASE_SEVERITY.get(str(predicted_disease), DEFAULT_SEVERITY)

    return PredictionResponse(
        predicted_disease=str(predicted_disease),
        should_visit_doctor=severity_info["should_visit_doctor"],
        urgency_level=severity_info["urgency"],
        recommendation=severity_info["recommendation"],
        specialty=severity_info["specialty"],
        confidence=round(confidence * 100, 1),
        matched_symptoms=matched,
        all_matched_count=len(matched),
        severity_label=SEVERITY_LABELS.get(severity_info["urgency"], "Unknown"),
    )


if __name__ == "__main__":
    port = int(os.getenv("ML_SERVICE_PORT", "5001"))
    uvicorn.run(app, host="127.0.0.1", port=port)
