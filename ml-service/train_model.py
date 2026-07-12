from __future__ import annotations

import json
import argparse
import io
import sys
from pathlib import Path
from zipfile import ZipFile
from typing import Iterable

ROOT = Path(__file__).resolve().parent
VENV_SITE_PACKAGES = ROOT.parent / ".venv" / "Lib" / "site-packages"

if VENV_SITE_PACKAGES.exists() and str(VENV_SITE_PACKAGES) not in sys.path:
    sys.path.insert(0, str(VENV_SITE_PACKAGES))

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_MODEL_PATH = ROOT / "symptom_model.pkl"
DEFAULT_FEATURES_PATH = ROOT / "symptom_features.pkl"


def iter_unique_paths(paths: Iterable[Path]) -> Iterable[Path]:
    seen: set[Path] = set()
    for path in paths:
        if path not in seen:
            seen.add(path)
            yield path


def find_dataset(data_dir: Path) -> tuple[pd.DataFrame, str]:
    csv_candidates = iter_unique_paths(
        (
            data_dir / "training_data.csv",
            ROOT / "training_data.csv",
            data_dir / "trainings.csv",
            ROOT / "trainings.csv",
        )
    )

    best_df: pd.DataFrame | None = None
    best_source: str | None = None
    best_score: tuple[int, float] | None = None

    for csv_path in csv_candidates:
        if not csv_path.exists():
            continue

        df = read_csv_with_fallback(csv_path)
        target_column = detect_target_column(df)
        row_count = int(len(df))
        unique_targets = int(df[target_column].nunique(dropna=False))
        class_ratio = unique_targets / row_count if row_count else 1.0
        score = (row_count, 1.0 - class_ratio)

        if best_score is None or score > best_score:
            best_df = df
            best_source = str(csv_path)
            best_score = score

    if best_df is not None and best_source is not None:
        return best_df, best_source

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
                        source = f"{zip_path}::{member}"
                        return read_csv_with_fallback(io.BytesIO(handle.read())), source

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


def find_testing_dataset(data_dir: Path) -> tuple[pd.DataFrame, str] | None:
    for csv_path in (
        data_dir / "test_data.csv",
        ROOT / "test_data.csv",
        data_dir / "testing.csv",
        ROOT / "testing.csv",
    ):
        if csv_path.exists():
            return read_csv_with_fallback(csv_path), str(csv_path)
    return None


def train(data_dir: Path, model_path: Path, features_path: Path) -> None:
    df, training_source = find_dataset(data_dir)
    target_column = detect_target_column(df)

    X = df.drop(columns=[target_column])
    y = df[target_column]

    model = RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=-1)
    model.fit(X, y)

    metrics = {
        "training_source": training_source,
        "trained_rows": int(len(df)),
        "feature_count": int(X.shape[1]),
        "target_column": target_column,
    }

    train_X, val_X, train_y, val_y = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y if y.nunique() > 1 else None,
    )
    validation_model = RandomForestClassifier(
        n_estimators=300, random_state=42, n_jobs=-1
    )
    validation_model.fit(train_X, train_y)
    val_predictions = validation_model.predict(val_X)
    metrics["validation_rows"] = int(len(val_X))
    metrics["validation_accuracy"] = float(accuracy_score(val_y, val_predictions))

    testing_dataset = find_testing_dataset(data_dir)
    if testing_dataset is not None:
        test_df, testing_source = testing_dataset
        test_target_column = detect_target_column(test_df)
        test_X = test_df.drop(columns=[test_target_column], errors="ignore")
        test_y = test_df[test_target_column]
        shared_features = sorted(set(X.columns).intersection(test_X.columns))
        feature_coverage = len(shared_features) / len(X.columns) if len(X.columns) else 0.0
        metrics["testing_source"] = testing_source
        metrics["testing_rows"] = int(len(test_df))
        metrics["testing_feature_coverage"] = float(feature_coverage)

        if feature_coverage >= 0.8:
            aligned_test_X = test_X.reindex(columns=X.columns, fill_value=0)
            predictions = model.predict(aligned_test_X)
            metrics["testing_accuracy"] = float(accuracy_score(test_y, predictions))
        else:
            metrics["testing_skipped_reason"] = (
                "Testing dataset is incompatible with the selected training features."
            )

    joblib.dump(model, model_path)
    joblib.dump(X.columns.tolist(), features_path)
    (model_path.parent / "symptom_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"Model trained and saved to {model_path}")
    print(f"Feature order saved to {features_path}")
    print(f"Training source: {training_source}")
    print(f"Target column: {target_column}")
    print(f"Validation accuracy: {metrics['validation_accuracy']:.4f}")
    if "testing_accuracy" in metrics:
        print(f"Testing accuracy: {metrics['testing_accuracy']:.4f}")
    elif "testing_skipped_reason" in metrics:
        print(f"Testing skipped: {metrics['testing_skipped_reason']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the symptom prediction model.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--features-path", type=Path, default=DEFAULT_FEATURES_PATH)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args.data_dir, args.model_path, args.features_path)
