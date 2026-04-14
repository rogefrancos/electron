// renderer/results-status.js
// Same as before but with a more robust WhatsApp handler and debug logs.
// It will try to use the stored phone (last 10 digits by default) and open wa.me correctly.

(async function () {
  const hl7Input = document.getElementById('hl7file');
  const generateBtn = document.getElementById('generate-pdf-btn');
  const reportLinkP = document.getElementById('report-link');
  const reportPathA = document.getElementById('report-path');
  const statusMessage = document.getElementById('status-message');
  const patientSelect = document.getElementById('patient-select');
  const patientPhoneP = document.getElementById('patient-phone');
  const sendWhatsAppBtn = document.getElementById('send-whatsapp-btn');
  const sendEmailBtn = document.querySelector('.send-email');
  const pdfFilePath = document.getElementById('pdfFilePath');
  const selectPdfFileBtn = document.getElementById('selectPdfFileBtn');
  const analyzePdfBtn = document.getElementById('analyzePdfBtn');
  const analysisModal = document.getElementById('analysisModal');
  const closeAnalysisModal = document.getElementById('closeAnalysisModal');
  const closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
  const analysisResultContent = document.getElementById('analysisResultContent');
  const analysisStatus = document.getElementById('analysisStatus');

  let lastGeneratedPdf = null;
  let currentAnalysisData = null;
  let selectedFilePath = null;

  function setStatus(msg) {
    if (!statusMessage) return;
    statusMessage.textContent = msg;
    statusMessage.style.color = '#084';
  }

  function sanitizeName(n) {
    if (!n) return null;
    return String(n)
      .normalize('NFKD').replace(/[\u0300-\u036F]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || null;
  }

  function tsTag(date = new Date()) {
    const z = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${z(date.getMonth() + 1)}${z(date.getDate())}_${z(date.getHours())}${z(date.getMinutes())}${z(date.getSeconds())}`;
  }

  function readFileAsText(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsText(file);
    });
  }

  // LOCAL fallback: extract PID field 5 (LAST^FIRST) -> return "FIRST LAST"
  function extractNameFromPIDLocal(text) {
    try {
      const lines = String(text || '').split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        if (line.startsWith('PID') || line.startsWith('PID|')) {
          const parts = line.split('|');
          const nameField = parts[5] || '';
          const comps = nameField.split('^');
          const last = (comps[0] || '').trim();
          const first = (comps[1] || '').trim();
          const combined = `${first || ''} ${last || ''}`.trim();
          if (combined) return combined;
        }
      }
    } catch (e) {
      console.warn('extractNameFromPIDLocal failed', e);
    }
    return null;
  }

  // Ask main to parse HL7; if it doesn't return a name, fallback to local PID parse
  async function extractNameFromHl7(text) {
    if (window.apiResults && typeof window.apiResults.parseHL7 === 'function') {
      try {
        const res = await window.apiResults.parseHL7(text);
        if (res && res.success) {
          if (res.patientName) return res.patientName;
          if (res.parsed && res.parsed.patient) {
            const p = res.parsed.patient;
            const first = p.firstName || p.given || p.first || '';
            const last = p.lastName || p.family || p.last || '';
            const combined = `${first || ''} ${last || ''}`.trim();
            if (combined) return combined;
          }
        }
      } catch (e) {
        console.warn('parseHL7 IPC failed, falling back to local parse', e);
      }
    }
    return extractNameFromPIDLocal(text);
  }

  async function generateAndShowFromHl7(text) {
    try {
      const name = await extractNameFromHl7(text);
      const base = name ? sanitizeName(name) : `report`;
      const filenameBase = `${base}-${tsTag()}`;

      const res = await window.apiResults.generatePDF(text, filenameBase);
      if (!res || !res.success) {
        lastGeneratedPdf = null;
        setStatus('Resultados');
        return null;
      }
      lastGeneratedPdf = res.path || res.filePath || res.filename || null;

      if (lastGeneratedPdf) {
        const fileOnly = String(lastGeneratedPdf).split(/[\\/]/).pop();
        reportPathA.href = `file://${lastGeneratedPdf}`;
        reportPathA.textContent = fileOnly;
        reportLinkP.style.display = 'block';

        const displayName = name ? name : '';
        const finalMsg = displayName ? `Resultados de ${displayName} — ${fileOnly}` : `Resultados — ${fileOnly}`;
        setStatus(finalMsg);
      } else {
        reportLinkP.style.display = 'none';
        setStatus('Resultados');
      }
      return lastGeneratedPdf;
    } catch (err) {
      console.error('generateAndShowFromHl7 error', err);
      setStatus('Resultados');
      return null;
    }
  }

  // UI handlers
  generateBtn && generateBtn.addEventListener('click', async () => {
    const file = hl7Input.files && hl7Input.files[0];
    if (!file) { setStatus('Resultados'); return; }
    try {
      const text = await readFileAsText(file);
      await generateAndShowFromHl7(text);
    } catch (e) {
      console.error(e);
      setStatus('Resultados');
    }
  });

  // load patients into select if present (keeps previous behavior)
  async function loadPatients() {
    if (!window.apiPac || typeof window.apiPac.getPatients !== 'function') return;
    try {
      const res = await window.apiPac.getPatients();
      const patients = (res && res.success) ? (res.patients || []) : [];
      if (!patientSelect) return;
      patientSelect.innerHTML = '<option value="">-- paciente --</option>';
      patients.forEach(p => {
        const full = `${p.nombre || ''} ${p.apellidoP || ''} ${p.apellidoM || ''}`.trim() || `#${p.id}`;
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = full;
        if (p.telefono) opt.dataset.phone = p.telefono;
        if (p.correo) opt.dataset.email = p.correo;
        patientSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn('loadPatients failed', e);
    }
  }

  if (patientSelect) {
    patientSelect.addEventListener('change', () => {
      const opt = patientSelect.options[patientSelect.selectedIndex];
      const phone = opt && opt.dataset ? opt.dataset.phone || '' : '';
      const email = opt && opt.dataset ? opt.dataset.email || '' : '';
      patientPhoneP.textContent = ((phone ? `Tel: ${phone}` : '') + (email ? (phone ? ' • ' : '') + `Email: ${email}` : '')) || '';
      if (sendWhatsAppBtn) sendWhatsAppBtn.disabled = !phone;
      if (sendEmailBtn) sendEmailBtn.disabled = !email;
    });
  }

  // Improved WhatsApp handler with logs and robust phone formatting.
  if (sendWhatsAppBtn) {
    sendWhatsAppBtn.addEventListener('click', async () => {
      try {
        const opt = patientSelect.options[patientSelect.selectedIndex];
        const phoneRaw = opt && opt.dataset ? opt.dataset.phone || '' : '';
        if (!phoneRaw) { setStatus('Resultados'); return; }

        // Keep only digits
        const digits = String(phoneRaw).replace(/\D/g, '');
        // If digits length is 10 (local), use it as-is (per your requirement to not auto-add country code).
        // If longer (likely includes country code), use full number.
        let phoneForWa = '';
        if (digits.length >= 11) {
          phoneForWa = digits; // already includes country code
        } else if (digits.length === 10) {
          phoneForWa = digits; // local 10-digit number (user asked not to add 52)
        } else {
          // too short -> invalid
          setStatus('Resultados');
          return;
        }

        const message = 'Te comparto el resultado.';
        const url = `https://wa.me/${phoneForWa}?text=${encodeURIComponent(message)}`;

        // Debug log (visible in DevTools console)
        console.log('[WA] open', { phoneRaw, digits, phoneForWa, url });

        if (window.apiResults && typeof window.apiResults.openExternal === 'function') {
          await window.apiResults.openExternal(url);
        } else {
          window.open(url, '_blank');
        }

        // keep the final message if a result exists
        if (lastGeneratedPdf) {
          const fileOnly = String(lastGeneratedPdf).split(/[\\/]/).pop();
          const name = await extractNameFromHl7(await readFileAsText(hl7Input.files[0]));
          const displayName = name ? name : '';
          const finalMsg = displayName ? `Resultados de ${displayName} — ${fileOnly}` : `Resultados — ${fileOnly}`;
          setStatus(finalMsg);
        } else {
          setStatus('Resultados');
        }
      } catch (err) {
        console.error('sendWhatsApp error', err);
        setStatus('Resultados');
      }
    });
  }

  if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', async () => {
      const opt = patientSelect.options[patientSelect.selectedIndex];
      const email = opt && opt.dataset ? opt.dataset.email || '' : '';
      if (!email) { setStatus('Resultados'); return; }
      if (!lastGeneratedPdf) {
        const file = hl7Input.files && hl7Input.files[0];
        if (!file) { setStatus('Resultados'); return; }
        try {
          const text = await readFileAsText(file);
          await generateAndShowFromHl7(text);
        } catch (e) { console.error(e); setStatus('Resultados'); return; }
      }
      const subject = `Resultado`;
      const body = `Adjunto resultado.\n\nArchivo: ${lastGeneratedPdf ? String(lastGeneratedPdf).split(/[\\/]/).pop() : 'no disponible'}`;
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await window.apiResults.openExternal(mailto);
      if (lastGeneratedPdf && window.apiResults.revealFile) await window.apiResults.revealFile(lastGeneratedPdf);
      if (lastGeneratedPdf) {
        const fileOnly = String(lastGeneratedPdf).split(/[\\/]/).pop();
        const name = await extractNameFromHl7(await readFileAsText(hl7Input.files[0]));
        const displayName = name ? name : '';
        const finalMsg = displayName ? `Resultados de ${displayName} — ${fileOnly}` : `Resultados — ${fileOnly}`;
        setStatus(finalMsg);
      } else {
        setStatus('Resultados');
      }
    });
  }

  if (reportPathA) {
    reportPathA.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!lastGeneratedPdf) return;
      await window.apiResults.openExternal(`file://${lastGeneratedPdf}`);
      if (lastGeneratedPdf) {
        const fileOnly = String(lastGeneratedPdf).split(/[\\/]/).pop();
        const name = await extractNameFromHl7(await readFileAsText(hl7Input.files[0]));
        const displayName = name ? name : '';
        const finalMsg = displayName ? `Resultados de ${displayName} — ${fileOnly}` : `Resultados — ${fileOnly}`;
        setStatus(finalMsg);
      }
    });
  }

  selectPdfFileBtn.addEventListener('click', async () => {
    try {
      const result = await window.apiResults.selectPDFFile();
      if (result.success) {
        selectedFilePath = result.filePath;
        pdfFilePath.value = result.filePath;
        analysisStatus.textContent = 'Archivo PDF seleccionado';
        analysisStatus.style.color = '#5cb85c';
      } else {
        analysisStatus.textContent = 'Ningún archivo seleccionado';
        analysisStatus.style.color = '#d9534f';
      }
    } catch (error) {
      console.error('File selection error:', error);
      analysisStatus.textContent = `Error: ${error.message}`;
      analysisStatus.style.color = '#d9534f';
    }
  });
  // --------------
  // Analisis     -
  //---------------
  analyzePdfBtn.addEventListener('click', async () => {
    if (!selectedFilePath) {
      analysisStatus.textContent = 'Por favor seleccione un archivo PDF primero.';
      analysisStatus.style.color = '#d9534f';
      return;
    }

    analysisStatus.textContent = 'Analizando PDF...';
    analysisStatus.style.color = '#5bc0de';

    try {
      const result = await window.apiResults.analyzePDF(selectedFilePath);
      
      if (result.success) {
        currentAnalysisData = result;
        analysisResultContent.innerHTML = result.html;
        analysisModal.style.display = 'block';
        analysisStatus.textContent = 'Análisis completado';
        analysisStatus.style.color = '#5cb85c';
      } else {
        analysisStatus.textContent = `Error: ${result.error}`;
        analysisStatus.style.color = '#d9534f';
      }
    } catch (error) {
      console.error('Error en el analisis del PDF:', error);
      analysisStatus.textContent = `Error: ${error.message}`;
      analysisStatus.style.color = '#d9534f';
    }
  });

  // Modal controls
  closeAnalysisModal.onclick = () => { 
    analysisModal.style.display = 'none'; 
    analysisStatus.textContent = '';
  };
  
  closeAnalysisBtn.onclick = () => { 
    analysisModal.style.display = 'none';
    analysisStatus.textContent = '';
  };

  window.onclick = (event) => {
    if (event.target === analysisModal) {
      analysisModal.style.display = 'none';
    }
  };

  // init
  if (reportLinkP) reportLinkP.style.display = 'none';
  if (sendWhatsAppBtn) sendWhatsAppBtn.disabled = true;
  if (sendEmailBtn) sendEmailBtn.disabled = true;
  await loadPatients?.();
})();