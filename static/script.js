const featureOrder = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
];
const recordsKey = "glucoscope-assessment-records";
const form = document.getElementById("predictForm");
const message = document.getElementById("formMessage");
const recordsBody = document.getElementById("recordsBody");
const clearRecordsButton = document.getElementById("clearRecords");
const chartCanvas = document.getElementById("resultChart");
const navLinks = document.querySelectorAll(".sidebar nav .nav-link");
let resultChart;

navLinks.forEach(link => {
    link.addEventListener("click", () => {
        navLinks.forEach(navLink => navLink.classList.toggle("active", navLink === link));
    });
});

function loadRecords() {
    try {
        const saved = JSON.parse(localStorage.getItem(recordsKey) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

let records = loadRecords();

function saveRecords() {
    localStorage.setItem(recordsKey, JSON.stringify(records));
}

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function addCell(row, text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    row.append(cell);
}

function renderRecords() {
    recordsBody.replaceChildren();
    const visibleRecords = records.slice(0, 8);

    if (visibleRecords.length === 0) {
        const row = document.createElement("tr");
        row.className = "empty-row";
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = "No saved assessments. Your completed check-ins will appear here.";
        row.append(cell);
        recordsBody.append(row);
    } else {
        visibleRecords.forEach(record => {
            const row = document.createElement("tr");
            const outcome = record.prediction === 1 ? "Diabetic" : "Non-diabetic";
            addCell(row, formatDate(record.createdAt));
            addCell(row, `${record.values.Age} yrs`);
            addCell(row, `${record.values.Glucose} mg/dL`);
            addCell(row, `${Number(record.values.BMI).toFixed(1)} kg/m²`);
            addCell(row, `${Math.round(record.probability * 100)}%`);
            addCell(row, outcome, `outcome outcome-${record.prediction === 1 ? "diabetic" : "non-diabetic"}`);
            recordsBody.append(row);
        });
    }

    document.getElementById("totalCount").textContent = records.length;
    document.getElementById("diabeticCount").textContent = records.filter(record => record.prediction === 1).length;
    document.getElementById("nonDiabeticCount").textContent = records.filter(record => record.prediction === 0).length;
    const latest = records[0];
    document.getElementById("latestEstimate").textContent = latest ? `${Math.round(latest.probability * 100)}%` : "—";
    document.getElementById("latestCaption").textContent = latest ? formatDate(latest.createdAt) : "No assessment yet";
    clearRecordsButton.disabled = records.length === 0;
}

function renderChart(classProbabilities, prediction) {
    const diabeticProbability = Math.max(0, Math.min(1, classProbabilities.diabetic));
    const nonDiabeticProbability = Math.max(0, Math.min(1, classProbabilities.non_diabetic));
    document.getElementById("probabilityValue").textContent = `${Math.round(diabeticProbability * 100)}%`;
    document.getElementById("resultStatus").textContent = prediction === 1 ? "Model class: Diabetic" : "Model class: Non-diabetic";
    document.getElementById("resultStatus").className = `result-status ${prediction === 1 ? "status-diabetic" : "status-non-diabetic"}`;
    document.getElementById("resultDetail").textContent = `Diabetic: ${Math.round(diabeticProbability * 100)}% · Non-diabetic: ${Math.round(nonDiabeticProbability * 100)}%. Model estimate, not a diagnosis.`;

    if (typeof Chart === "undefined") {
        document.querySelector(".chart-wrap").classList.add("chart-unavailable");
        return;
    }

    if (resultChart) resultChart.destroy();
    resultChart = new Chart(chartCanvas, {
        type: "pie",
        data: {
            labels: ["Non-diabetic", "Diabetic"],
            datasets: [{
                data: [nonDiabeticProbability * 100, diabeticProbability * 100],
                backgroundColor: ["#b9d2c4", "#e17b5f"],
                borderColor: "#ffffff",
                borderWidth: 4,
                hoverOffset: 5,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${context.raw.toFixed(1)}%` } } },
        },
    });
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "Calculating estimate…";
    message.className = "form-message";

    const values = Object.fromEntries(featureOrder.map(name => [name, Number(form.elements[name].value)]));
    const data = featureOrder.map(name => values[name]);

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not calculate an estimate.");

        const record = { createdAt: new Date().toISOString(), values, prediction: result.prediction, probability: result.probability, classProbabilities: result.class_probabilities };
        records.unshift(record);
        saveRecords();
        renderRecords();
        renderChart(result.class_probabilities, result.prediction);
        message.textContent = "Estimate calculated and saved to your records.";
        message.classList.add("message-success");
        document.querySelector(".result-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        message.textContent = error.message || "Unable to reach the prediction service. Try again.";
        message.classList.add("message-error");
    }
});

clearRecordsButton.addEventListener("click", () => {
    if (!window.confirm("Delete all saved assessment records from this browser?")) return;
    records = [];
    saveRecords();
    renderRecords();
});

renderRecords();
if (records[0]) {
    const savedProbabilities = records[0].classProbabilities || {
        diabetic: records[0].probability,
        non_diabetic: 1 - records[0].probability,
    };
    renderChart(savedProbabilities, records[0].prediction);
}
