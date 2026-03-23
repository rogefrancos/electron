const labTestDatabase = {
    "glucose": {
        "names": ["Glucosa", "GLU", "Glucose"],
        "abbreviation": "GLU",
        "normalRange": {"min": 70, "max": 99},
        "specialist": "Endocrinologist"
    },
    "cholesterol": {
        "names": ["Colesterol", "CHOL", "Cholesterol"],
        "abbreviation": "CHOL",
        "normalRange": {"min": 125, "max": 200},
        "specialist": "Cardiologist"
    },
    "hemoglobin": {
        "names": ["Hemoglobina", "HGB", "Hemoglobin"],
        "abbreviation": "HGB",
        "normalRange": {"min": 13.5, "max": 17.5},
        "specialist": "Hematologist"
    },
    "creatinina": {
        "names": ["Creatinina", "Creatinine"],
        "abbreviation": "CREA",
        "normalRange": {"min": 0.5, "max": 1.2},
        "specialist": "Nephrologist"
    },
    "urea": {
        "names": ["Urea"],
        "abbreviation": "UREA",
        "normalRange": {"min": 16.6, "max": 48.5},
        "specialist": "Nephrologist"
    },
    "trigliceridos": {
        "names": ["Triglicéridos", "Trigliceridos", "Triglycerides"],
        "abbreviation": "TRIG",
        "normalRange": {"min": 0, "max": 150},
        "specialist": "Cardiologist"
    }
};

/**
 * Extract lab values from PDF text
 * Searches for test names and captures the number that follows
 */
function extractLabValuesFromText(pdfText) {
    const results = [];
    
    // Loop through all tests in the database
    for (const [key, testConfig] of Object.entries(labTestDatabase)) {
        // Try each name variant for this test
        for (const testName of testConfig.names) {
            // Create regex to find the test name and capture the following number
            const regex = new RegExp(`${testName}[:\\s]*([0-9]+\\.?[0-9]*)`, 'i');
            const match = pdfText.match(regex);
            
            if (match && match[1]) {
                results.push({
                    abbreviation: testConfig.abbreviation,
                    testName: testName,
                    value: parseFloat(match[1]),
                    normalRange: testConfig.normalRange,
                    specialist: testConfig.specialist
                });
                break; // Found this test, move to next one
            }
        }
    }
    
    return results;
}

/**
 * Analyze extracted lab values
 */
function analyzeLabResults(labResults) {
    if (!Array.isArray(labResults)) {
        console.error('ERROR: analyzeLabResults expects an array, got:', typeof labResults);
        return [];
    }
    
    const analysis = labResults.map(result => {
        if (result && result.normalRange) {
            const abnormal = result.value < result.normalRange.min || result.value > result.normalRange.max;
            const status = result.value < result.normalRange.min ? 'LOW' : (abnormal ? 'HIGH' : 'NORMAL');
            
            return {
                abbreviation: result.abbreviation,
                testName: result.testName,
                value: result.value,
                normalRange: result.normalRange,
                abnormal: abnormal,
                status: status,
                specialist: result.specialist
            };
        }
        return null;
    });
    
    return analysis.filter(item => item !== null);
}

/**
 * Generate HTML report from analysis
 */
function generateAnalysisHTML(analysis) {
    if (!Array.isArray(analysis)) {
        return '<div class="error"><p>Error: Analysis data is invalid</p></div>';
    }
    
    let html = '<div class="analysis-report">';
    
    // Summary
    const abnormalCount = analysis.filter(a => a.abnormal).length;
    const normalCount = analysis.filter(a => !a.abnormal).length;
    
    html += `
        <section class="summary-section">
            <h3>📊 Summary</h3>
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-number">${abnormalCount}</span>
                    <span class="stat-label">Abnormal</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${normalCount}</span>
                    <span class="stat-label">Normal</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${analysis.length}</span>
                    <span class="stat-label">Total</span>
                </div>
            </div>
        </section>
    `;
    
    // Abnormal results
    const abnormalResults = analysis.filter(a => a.abnormal);
    if (abnormalResults.length > 0) {
        html += '<section class="abnormal-results"><h3>⚠️ Out of Range Values</h3>';
        abnormalResults.forEach(result => {
            const statusEmoji = result.status === 'HIGH' ? '↑' : '↓';
            const statusClass = result.status === 'HIGH' ? 'status-high' : 'status-low';
            
            html += `
                <div class="result-card abnormal">
                    <div class="result-header">
                        <span class="field-name">${result.testName} (${result.abbreviation})</span>
                        <span class="status ${statusClass}"><span class="emoji">${statusEmoji}</span> ${result.status}</span>
                    </div>
                    <div class="result-value">${result.value}</div>
                    <div class="result-range">Normal range: ${result.normalRange.min} - ${result.normalRange.max}</div>
                    <div class="recommendation">
                        <strong>Recommendation:</strong> Consider consulting a <strong>${result.specialist}</strong>
                    </div>
                </div>
            `;
        });
        html += '</section>';
    }
    
    // Normal results
    const normalResults = analysis.filter(a => !a.abnormal);
    if (normalResults.length > 0) {
        html += '<section class="normal-results"><h3>✓ Normal Values</h3>';
        normalResults.forEach(result => {
            html += `
                <div class="result-card normal">
                    <span class="field-name">${result.testName} (${result.abbreviation}):</span>
                    <span class="result-value">${result.value}</span>
                    <span class="status-ok">✓</span>
                </div>
            `;
        });
        html += '</section>';
    }
    
    // Disclaimer
    html += `
        <section class="disclaimer">
            <p><strong>⚕️ Important Disclaimer:</strong></p>
            <p>This analysis is for informational purposes only and does not constitute medical diagnosis or treatment. 
               Always consult with a qualified healthcare professional for proper interpretation of laboratory results 
               and appropriate medical care.</p>
        </section>
    `;
    
    html += '</div>';
    return html;
}

// Export functions
module.exports = { 
    analyzeLabResults, 
    generateAnalysisHTML, 
    extractLabValuesFromText,
    labTestDatabase 
};