from __future__ import annotations

import json
import argparse
import io
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = ROOT.parent / ".venv" / "Lib" / "site-packages"

if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.ensemble import RandomForestClassifier

DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_MODEL_PATH = ROOT / "symptom_model.pkl"
DEFAULT_FEATURES_PATH = ROOT / "symptom_features.pkl"


def find_dataset(data_dir: Path) -> pd.DataFrame:
    for csv_path in (data_dir / "trainings.csv", ROOT / "trainings.csv"):
        if csv_path.exists():
            return read_csv_with_fallback(csv_path)

    zip_candidates = sorted(data_dir.glob("*.zip"))
    if not zip_candidates:
        raise FileNotFoundError(
            f"No trainings.csv or zip archive found in {data_dir}. Place archive (2).zip or trainings.csv there."
        )

    for zip_path in zip_candidates:
        with ZipFile(zip_path) as archive:
            for member in archive.namelist():
                if member.endswith("trainings.csv"):
                    with archive.open(member) as handle:
                        return read_csv_with_fallback(io.BytesIO(handle.read()))

    raise FileNotFoundError(
        f"Could not find trainings.csv inside any zip file in {data_dir}."
    )


def detect_target_column(df: pd.DataFrame) -> str:
    lower_map = {column.lower(): column for column in df.columns}
    for candidate in ("disease", "prognosis", "label", "target"):
        if candidate in lower_map:
            return lower_map[candidate]
    return df.columns[-1]


def read_csv_with_fallback(source: Path | io.BytesIO) -> pd.DataFrame:
    for encoding in ("utf-8", "utf-8-sig", "latin1", "cp1252"):
        try:
            return pd.read_csv(source, encoding=encoding)
        except UnicodeDecodeError:
            if hasattr(source, "seek"):
                source.seek(0)

    return pd.read_csv(source, encoding="latin1")


def train(data_dir: Path, model_path: Path, features_path: Path) -> None:
    df = find_dataset(data_dir)
    target_column = detect_target_column(df)

    X = df.drop(columns=[target_column])
    y = df[target_column]

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)

    metrics = {
        "trained_rows": int(len(df)),
        "feature_count": int(X.shape[1]),
        "target_column": target_column,
    }

    testing_csv = data_dir / "testing.csv"
    if not testing_csv.exists():
        testing_csv = ROOT / "testing.csv"

    if testing_csv.exists():
        test_df = read_csv_with_fallback(testing_csv)
        test_target_column = detect_target_column(test_df)
        test_X = test_df.drop(columns=[test_target_column])
        test_y = test_df[test_target_column]
        test_X = test_X.reindex(columns=X.columns, fill_value=0)
        predictions = model.predict(test_X)
        metrics["testing_rows"] = int(len(test_df))
        metrics["testing_accuracy"] = float(accuracy_score(test_y, predictions))

    joblib.dump(model, model_path)
    joblib.dump(X.columns.tolist(), features_path)
    (model_path.parent / "symptom_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"Model trained and saved to {model_path}")
    print(f"Feature order saved to {features_path}")
    print(f"Target column: {target_column}")
    if "testing_accuracy" in metrics:
        print(f"Testing accuracy: {metrics['testing_accuracy']:.4f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the symptom prediction model.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--features-path", type=Path, default=DEFAULT_FEATURES_PATH)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args.data_dir, args.model_path, args.features_path)
