# CareLink ML Service

This folder contains the standalone Python microservice for symptom model training and prediction.

## Files

- `train_model.py` trains a model from `trainings.csv` or from a zip archive that contains `trainings.csv`.
- `app.py` exposes the prediction API.
- `requirements.txt` lists the Python dependencies.

## Expected data layout

Place either of these in `ml-service/` or `ml-service/data/`:

- `trainings.csv`
- `archive (2).zip` or any zip file that contains `trainings.csv`
- `testing.csv`

## Train the model

```bash
python train_model.py --data-dir .
```

This creates:

- `symptom_model.pkl`
- `symptom_features.pkl`
- `symptom_metrics.json`

The trainer also looks for `testing.csv` and prints the test accuracy when it is available.

## Run the API

```bash
uvicorn app:app --reload --port 5001
```

The Node backend already uses port 5000, so running the ML service on 5001 avoids a port conflict.

If you want to run the service directly instead of through `uvicorn`, use:

```bash
python app.py
```

If you are on Windows PowerShell, the easiest full startup path is:

```powershell
.\start_ml_service.ps1
```

That script uses the workspace virtual environment, trains the model if the `.pkl` files are missing, and then starts the API.

## Request format

POST to `/predict` with JSON like this:

```json
{
  "symptoms": ["fever", "cough"]
}
```

Response:

```json
{
  "predicted_disease": "Example Disease"
}
```

## Notes

- The model uses the `disease` column when present, and otherwise falls back to common target names like `prognosis`, `label`, or the last column.
- If the model files are missing, the API returns a 503 error until training is run.
- The ML service defaults to port 5001 when launched directly.
- This service is separate from the existing Node backend and does not modify it.
