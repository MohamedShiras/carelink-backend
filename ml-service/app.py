from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import List

ROOT = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = ROOT.parent / ".venv" / "Lib" / "site-packages"

if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn

MODEL_PATH = ROOT / "symptom_model.pkl"
FEATURES_PATH = ROOT / "symptom_features.pkl"

app = FastAPI(title="CareLink Symptom Prediction API", version="1.0.0")

model = None
features: List[str] = []


class PredictionRequest(BaseModel):
    symptoms: List[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    predicted_disease: str


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


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    if model is None or not features:
        raise HTTPException(
            status_code=503,
            detail="Model artifacts are missing. Run train_model.py first.",
        )

    symptom_set = {item.strip().lower() for item in request.symptoms if item.strip()}
    input_vector = [1 if feature.lower() in symptom_set else 0 for feature in features]
    predicted_disease = model.predict([input_vector])[0]

    return PredictionResponse(predicted_disease=str(predicted_disease))


if __name__ == "__main__":
    port = int(os.getenv("ML_SERVICE_PORT", "5001"))
    uvicorn.run(app, host="127.0.0.1", port=port)
