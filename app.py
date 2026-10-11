from flask import Flask, render_template, request, jsonify
import pickle
import numpy as np

app = Flask(__name__)
FEATURES = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]

# Load model and scaler
with open("model.pkl", "rb") as model_file:
    model = pickle.load(model_file)
with open("scaler.pkl", "rb") as scaler_file:
    scaler = pickle.load(scaler_file)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Provide measurements as a JSON object."}), 400
    values = payload.get("data")

    if not isinstance(values, list) or len(values) != len(FEATURES):
        return jsonify({"error": "Provide all eight measurements in the expected order."}), 400

    try:
        measurements = np.asarray(values, dtype=float).reshape(1, -1)
    except (TypeError, ValueError):
        return jsonify({"error": "Measurements must be numeric values."}), 400

    if not np.isfinite(measurements).all():
        return jsonify({"error": "Measurements must be finite numbers."}), 400

    scaled_measurements = scaler.transform(measurements)
    prediction = int(model.predict(scaled_measurements)[0])
    positive_class_index = list(model.classes_).index(1)
    probabilities = model.predict_proba(scaled_measurements)[0]
    diabetic_probability = float(probabilities[positive_class_index])
    return jsonify({
        "prediction": prediction,
        "probability": diabetic_probability,
        "class_probabilities": {
            "non_diabetic": 1.0 - diabetic_probability,
            "diabetic": diabetic_probability,
        },
        "features": FEATURES,
    })

if __name__ == "__main__":
    app.run(debug=True)
