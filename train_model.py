import pickle

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


df = pd.read_csv("diabetes - diabetes.csv")
X = df.drop(columns=["Outcome"])
y = df["Outcome"]

validation_model = make_pipeline(
    StandardScaler(),
    LogisticRegression(max_iter=1000),
)
scores = cross_validate(
    validation_model,
    X,
    y,
    cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
    scoring={"accuracy": "accuracy", "precision": "precision", "recall": "recall"},
)
print(
    "5-fold CV on %d records: accuracy=%.3f precision=%.3f recall=%.3f"
    % (
        len(df),
        scores["test_accuracy"].mean(),
        scores["test_precision"].mean(),
        scores["test_recall"].mean(),
    )
)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X.to_numpy())

model = LogisticRegression(max_iter=1000)
model.fit(X_scaled, y)

with open("model.pkl", "wb") as model_file:
    pickle.dump(model, model_file)

with open("scaler.pkl", "wb") as scaler_file:
    pickle.dump(scaler, scaler_file)

print("model_ready")
