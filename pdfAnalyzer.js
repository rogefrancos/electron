const labTestDatabase = {
    "glucose": {
        "abbreviation": "GLU",
        "normalRange": {"min": 70, "max": 99},
        "specialist": "Endocrinologist"
    },
    "cholesterol": {
        "abbreviation": "CHOL",
        "normalRange": {"min": 125, "max": 200},
        "specialist": "Cardiologist"
    },
    "hemoglobin": {
        "abbreviation": "HGB",
        "normalRange": {"min": 13.5, "max": 17.5},
        "specialist": "Hematologist"
    }
};

function findLabValue(labResult) {
    const test = labTestDatabase[labResult.abbreviation];
    return test ? test : null;
}

function analyzeLabResults(labResults) {
    const analysis = labResults.map(result => {
        const test = findLabValue(result);
        if (test) {
            const abnormal = result.value < test.normalRange.min || result.value > test.normalRange.max;
            return {
                abbreviation: test.abbreviation,
                value: result.value,
                abnormal: abnormal,
                specialist: test.specialist
            };
        }
        return null;
    });
    return analysis.filter(item => item !== null);
}

function generateAnalysisHTML(analysis) {
    let html = '<h1>Lab Results Analysis</h1><ul>';
    analysis.forEach(item => {
        const status = item.abnormal ? "Abnormal" : "Normal";
        html += `<li>${item.abbreviation}: ${item.value} - ${status} (Recommended Specialist: ${item.specialist})</li>`;
    });
    html += '</ul>';
    return html;
}

// Example usage:
const labResults = [
    {abbreviation: "GLU", value: 150},
    {abbreviation: "CHOL", value: 210},
    {abbreviation: "HGB", value: 13}
];
const analysis = analyzeLabResults(labResults);
const analysisHTML = generateAnalysisHTML(analysis);
console.log(analysisHTML);