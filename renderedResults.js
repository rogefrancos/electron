// Client-side logic for Results page: file input, native open dialog, patient selector, generate PDF, send WhatsApp.

(function () {
  const statusMessage = document.getElementById('status-message');
  const reportLinkBlock = document.getElementById('report-link');
  const reportPathAnchor = document.getElementById('report-path');

  const fileInput = document.getElementById('hl7file');
  const generateBtn = document.getElementById('generate-pdf-btn');
  const openNativeBtn = document.getElementById('open-native-btn');
  const sendWhatsBtn = document.getElementById('send-whatsapp-btn');

  const patientSelect = document.getElementById('patient-select');
  const patientPhoneP = document.getElementById('patient-phone');

  let hl7Content = null;
  let hl7Filename = null;
  let lastGenerated = { path: null, filename: null };

  // Utility: format timestamp YYYYMMDD_HHMM
  function formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  // Sanitize for filename (similar to main.js but client-side)
  function sanitizeForFilename(s) {
    if (!s) return 'report';
    return s.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
  }

  // Load patients from DB to selector
  async function loadPatients() {
    const res = await window.apiResults.getPatients();
    if (!res || !res.success) {
      statusMessage.textContent = 'Failed to load patients';
      return;
    }
    const patients = res.patients || [];
    // Clear select
    patientSelect.innerHTML = '<option value="">-- choose patient (optional) --</option>';
    patients.forEach(p => {
      const fullName = `${p.nombre || ''} ${p.apellidoP || ''} ${p.apellidoM || ''}`.trim();
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ id: p.id, telefono: p.telefono || '', name: fullName });
      opt.textContent = `${fullName} (${p.telefono || 'no phone'})`;
      patientSelect.appendChild(opt);
    });
  }

  // When patient selected, display phone
  if (patientSelect) {
    patientSelect.addEventListener('change', () => {
      const val = patientSelect.value;
      if (!val) {
        patientPhoneP.textContent = '';
        return;
      }
      try {
        const obj = JSON.parse(val);
        patientPhoneP.textContent = `Phone: ${obj.telefono || '(none)'}`;
      } catch (e) {
        patientPhoneP.textContent = '';
      }
    });
  }

  // File input handler (HTML file form route)
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        statusMessage.textContent = 'No file selected';
        return;
      }
      hl7Filename = file.name.replace(/\.[^/.]+$/, '');
      const reader = new FileReader();
      reader.onload = () => {
        hl7Content = reader.result;
        statusMessage.textContent = `Loaded ${file.name} (${Math.round(file.size / 1024)} KB)`;
        reportLinkBlock.style.display = 'none';
      };
      reader.onerror = () => {
        statusMessage.textContent = 'Failed to read file';
      };
      reader.readAsText(file);
    });
  }

  // Native dialog open via main process (alternative)
  if (openNativeBtn) {
    openNativeBtn.addEventListener('click', async () => {
      statusMessage.textContent = 'Opening file dialog...';
      const res = await window.apiResults.selectFile();
      if (res && !res.canceled && res.content) {
        hl7Content = res.content;
        hl7Filename = res.filePath ? res.filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '') : 'report';
        statusMessage.textContent = `Loaded ${res.filePath}`;
        reportLinkBlock.style.display = 'none';
      } else if (res && res.canceled) {
        statusMessage.textContent = 'File selection canceled';
      } else {
        statusMessage.textContent = 'No file selected or error';
      }
    });
  }

  // Build filename base using HL7 patient name if available, else DB selection or fallback
  function getFilenameBase(parsedHl7, selectedPatientObj) {
    let namePart = '';
    if (parsedHl7 && parsedHl7.patient && (parsedHl7.patient.firstName || parsedHl7.patient.lastName)) {
      namePart = `${parsedHl7.patient.firstName || ''} ${parsedHl7.patient.lastName || ''}`.trim();
    } else if (selectedPatientObj && selectedPatientObj.name) {
      namePart = selectedPatientObj.name;
    } else if (hl7Filename) {
      namePart = hl7Filename;
    } else {
      namePart = 'Resultados';
    }

    // Choose datetime from HL7 order if present
    let datePart = null;
    if (parsedHl7 && parsedHl7.order && parsedHl7.order.dateTime) {
      // Try to parse HL7 dateTime (often YYYYMMDDHHMMSS or similar)
      const dt = parsedHl7.order.dateTime;
      // Attempt basic parse for YYYYMMDDHHMM or YYYYMMDD
      const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/.exec(dt);
      if (m) {
        const year = m[1], month = m[2], day = m[3], hh = m[4] || '00', mm = m[5] || '00';
        datePart = `${year}${month}${day}_${hh}${mm}`;
      }
    }
    if (!datePart) {
      datePart = formatTimestamp(new Date());
    }

    const base = `Resultados_${namePart}_${datePart}`;
    return sanitizeForFilename(base);
  }

  // Generate PDF
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      if (!hl7Content) {
        statusMessage.textContent = 'Please select an HL7 file first.';
        return;
      }
      statusMessage.textContent = 'Parsing HL7...';
      // Parse HL7 client-side minimal parsing to extract name/dateTime (we rely on main.parse but main parses server-side)
      // We'll call main to produce the PDF but to create a filenameBase we can do a minimal parse similar to HL7.js
      function parseHL7Minimal(message) {
        const lines = message.trim().split(/\r?\n/);
        const result = { header: {}, patient: {}, order: {}, observations: [] };
        for (const line of lines) {
          const parts = line.split('|');
          const seg = parts[0];
          if (seg === 'PID') {
            result.patient = {
              id: parts[3],
              lastName: parts[5]?.split('^')[0],
              firstName: parts[5]?.split('^')[1]
            };
          } else if (seg === 'OBR') {
            result.order = { dateTime: parts[7] };
          } else if (seg === 'OBX') {
            result.observations.push({ name: parts[3]?.split('^')[1], value: parts[5] });
          } else if (seg === 'MSH') {
            result.header = { messageDate: parts[6] };
          }
        }
        return result;
      }

      const parsed = parseHL7Minimal(hl7Content);

      // selected patient for phone
      let selectedPatientObj = null;
      if (patientSelect && patientSelect.value) {
        try { selectedPatientObj = JSON.parse(patientSelect.value); } catch(e){ selectedPatientObj=null; }
      }

      const filenameBase = getFilenameBase(parsed, selectedPatientObj);

      statusMessage.textContent = 'Generating PDF...';

      const res = await window.apiResults.generatePDF(hl7Content, filenameBase);
      if (res && res.success) {
        lastGenerated.path = res.path;
        lastGenerated.filename = res.filename;
        statusMessage.textContent = 'PDF generated: ' + res.path;
        reportPathAnchor.href = `file://${res.path}`;
        reportPathAnchor.textContent = res.path;
        reportLinkBlock.style.display = 'block';
      } else {
        statusMessage.textContent = 'Error generating PDF: ' + (res && res.error ? res.error : 'unknown error');
      }
    });
  }

  // Send to WhatsApp
  if (sendWhatsBtn) {
    sendWhatsBtn.addEventListener('click', async () => {
      // Need phone number from selected patient
      if (!patientSelect || !patientSelect.value) {
        statusMessage.textContent = 'Select a patient from the dropdown to get their phone number.';
        return;
      }
      let selected = null;
      try { selected = JSON.parse(patientSelect.value); } catch(e){ selected = null; }
      if (!selected || !selected.telefono) {
        statusMessage.textContent = 'Selected patient has no phone number.';
        return;
      }
      // sanitize phone: only digits
      let digits = selected.telefono.replace(/\D/g, '');
      if (digits.length === 10) {
        // prepend Mexico country code (52). If you prefer "521" use that instead.
        digits = '52' + digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        // if already has leading 1 (rare), prepend 52 if missing
        digits = '52' + digits;
      } else if (!digits.startsWith('52')) {
        // fallback, still prepend 52
        digits = '52' + digits;
      }

      // Build message: use HL7 name if parsed, else selected name
      const name = (() => {
        // attempt to use last parsed HL7 name
        let parsedHL7name = null;
        if (hl7Content) {
          const parsed = (function (message) {
            const lines = message.trim().split(/\r?\n/);
            for (const line of lines) {
              const parts = line.split('|');
              if (parts[0] === 'PID') {
                const comp = parts[5] || '';
                const last = comp.split('^')[0] || '';
                const first = comp.split('^')[1] || '';
                return `${first} ${last}`.trim();
              }
            }
            return null;
          })(hl7Content);
          parsedHL7name = parsedHL7name || parsed;
        }
        if (parsedHL7name) return parsedHL7name;
        if (selected && selected.name) return selected.name;
        return '';
      })();

      const filenameToShow = lastGenerated.filename || 'Resultados (archivo)';
      const messageText = `Resultados ${name}: ${filenameToShow}`;
      const encoded = encodeURIComponent(messageText);
      const waUrl = `https://wa.me/${digits}?text=${encoded}`;

      statusMessage.textContent = 'Opening WhatsApp...';
      const res = await window.apiResults.openExternal(waUrl);
      if (res && res.success) {
        statusMessage.textContent = 'WhatsApp opened (paste/attach file manually).';
      } else {
        statusMessage.textContent = 'Failed to open WhatsApp link: ' + (res && res.error ? res.error : '');
      }
    });
  }

  // initial load
  loadPatients();

})();