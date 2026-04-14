// Diccionario utilizado para identificar en el PDF y guadar el rango de valores aceptado
// asi como el especialista pertinente a cada uno

const labTestDatabase = {
    "glucose": {
        "names": ["Glucosa", "GLU", "Glucose"],
        "abbreviation": "GLU",
        "normalRange": {"min": 70, "max": 99},
        "specialist": "Endocrinólogo"
    },
    "cholestrol": {
    "names": ["COLESTEROL TOTAL", "COLESTEROL TOTAL EN SUERO"],
    "abbreviation": "CHOL-T",
    "normalRange": {"min": 125, "max": 200},
    "specialist": "Cardiólogo"
},
    "hemoglobin": {
        "names": ["Hemoglobina", "HGB", "Hemoglobin"],
        "abbreviation": "HGB",
        "normalRange": {"min": 13.5, "max": 17.5},
        "specialist": "Hematólogo"
    },
    "creatinina": {
        "names": ["Creatinina", "Creatinine"],
        "abbreviation": "CREA",
        "normalRange": {"min": 0.5, "max": 1.2},
        "specialist": "Nefrólogo"
    },
    "urea": {
        "names": ["Urea"],
        "abbreviation": "UREA",
        "normalRange": {"min": 16.6, "max": 48.5},
        "specialist": "Nefrólogo"
    },
    "trigliceridos": {
        "names": ["Triglicéridos", "Trigliceridos", "Triglycerides"],
        "abbreviation": "TRIG",
        "normalRange": {"min": 0, "max": 150},
        "specialist": "Cardiólogo"
    }
};

// Esta funcion recorre el PDF para buscar los valores clave, es decir los nombres o abreviaciones
//  y de ahi sacar los valores de cada uni

function extractLabValuesFromText(pdfText) {
    const results = [];
    
    // Se itera buscando todos lo valores de nuestro diccionario 
    for (const [key, testConfig] of Object.entries(labTestDatabase)) {
        // Se busca utilizando cada nombre guardado en caso que este escrito de otra forma
        for (const testName of testConfig.names) {
            // Se normaliza el nombre que se esta buscando para aceptar diferentes formas
            // y a continuacion se saca el numero
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
                break; 
                // En cuanto se ecuentra el match se corta el loop
            }
        }
    }
    
    return results;
}

// Se hace una comprobacion si  son validos los datos que se recibieron

function analyzeLabResults(labResults) {
    if (!Array.isArray(labResults)) {
        console.error('ERROR: se esperaba un array se recibio:', typeof labResults);
        return [];
    }
    
    // Se analizan los resultados conforme a los rangos dados
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

// Genera el HTML para dar los resultados

function generateAnalysisHTML(analysis) {
    if (!Array.isArray(analysis)) {
        return '<div class="error"><p>Error: La informacion del analisis es invalida</p></div>';
    }
    
    let html = '<div class="analysis-report">';
    
    // Resumen
    const abnormalCount = analysis.filter(a => a.abnormal).length;
    const normalCount = analysis.filter(a => !a.abnormal).length;
    
    html += `
        <section class="summary-section">
            <h3>Resumen</h3>
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-number">${abnormalCount}</span>
                    <span class="stat-label">Fuera de rango</span>
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
    
    // Resultados fuera de rango
    const abnormalResults = analysis.filter(a => a.abnormal);
    if (abnormalResults.length > 0) {
        html += '<section class="abnormal-results"><h3>Valores Fuera de Rango</h3>';
        abnormalResults.forEach(result => {
            const statusEmoji = result.status === 'HIGH' ? '' : '';
            const statusClass = result.status === 'HIGH' ? 'status-high' : 'status-low';
            const statusLabel = result.status === 'HIGH' ? 'ALTO' : 'BAJO';
            
            html += `
                <div class="result-card abnormal">
                    <div class="result-header">
                        <span class="field-name">${result.testName} (${result.abbreviation})</span>
                        <span class="status ${statusClass}"><span class="emoji">${statusEmoji}</span> ${statusLabel}</span>
                    </div>
                    <div class="result-value">${result.value}</div>
                    <div class="result-range">Rango normal: ${result.normalRange.min} - ${result.normalRange.max}</div>
                    <div class="recommendation">
                        <strong>Recomendación:</strong> Considere consultar a un <strong>${result.specialist}</strong>
                    </div>
                </div>
            `;
        });
        html += '</section>';
    }
    
    // Resultados normales
    const normalResults = analysis.filter(a => !a.abnormal);
    if (normalResults.length > 0) {
        html += '<section class="normal-results"><h3>Valores Normales</h3>';
        normalResults.forEach(result => {
            html += `
                <div class="result-card normal">
                    <span class="field-name">${result.testName} (${result.abbreviation}):</span>
                    <span class="result-value">${result.value}</span>
                    <span class="status-ok"></span>
                </div>
            `;
        });
        html += '</section>';
    }
    
    // Aviso
    html += `
        <section class="disclaimer">
            <p><strong>Aviso Importante:</strong></p>
            <p>Este análisis es únicamente informativo y no constituye diagnóstico médico ni tratamiento. 
               Consulte siempre a un profesional de la salud calificado para la interpretación adecuada 
               de los resultados de laboratorio y la atención médica correspondiente.</p>
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