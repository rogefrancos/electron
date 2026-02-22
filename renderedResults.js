
(async function () {
  //Referencias a elementos del DOM
  const hl7Input = document.getElementById('hl7file');//Input de archivo HL7
  const generateBtn = document.getElementById('generate-pdf-btn');//Boton para generar el PDF
  const reportLinkP = document.getElementById('report-link');//Contenedor del enlace al PDF
  const reportPathA = document.getElementById('report-path');//Enlace al PDF generado
  const statusMessage = document.getElementById('status-message');//Elemento para mostrar mensajes de estado
  const patientSelect = document.getElementById('patient-select');//Select de pacientes
  const patientPhoneP = document.getElementById('patient-phone');//Muestra el telefono del paciente
  const sendWhatsAppBtn = document.getElementById('send-whatsapp-btn');//Boton enviar Wsp
  const sendEmailBtn = document.querySelector('.send-email');// Boton enviar email

  let lastGeneratedPdf = null;//Guarda la ruta del ultimo PDF generado
  //Funcion para actualizar el mensaje de estado

  function setStatus(msg) {
    if (!statusMessage) return;
    statusMessage.textContent = msg;
    statusMessage.style.color = '#084';//El color del estado
  }
//Funcion para limpiar y normalizar nombres de pacientes
  function sanitizeName(n) {
    if (!n) return null;
    return String(n)
      .normalize('NFKD').replace(/[\u0300-\u036F]/g, '')//Quita acentos
      .replace(/[^a-zA-Z0-9 _-]/g, '')//Quita caracteres alfanumericos
      .trim()
      .replace(/\s+/g, '_') || null;//Remplaza espacios por guiones bajos
  }
//Genera un timestamp legible para el nombre de archivo
  function tsTag(date = new Date()) {
    const z = n => String(n).padStart(2, '0');//Asegura dos digitos
    return `${date.getFullYear()}${z(date.getMonth() + 1)}${z(date.getDate())}_${z(date.getHours())}${z(date.getMinutes())}${z(date.getSeconds())}`;
  }
//Leer un archivo cono texto
  function readFileAsText(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsText(file);
    });
  }
//Extrae el nombre del paciente localmente desde el campo PID del HL7
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
//Extrae nombre usando IPC al main, con fallback a la funcion local
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
//Genera PDf y actualiza la UI con el enlace y estado
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

  // Generar PDF al hacer click
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

  // Cargar pacientes en el select
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
//Actualiza telefono/email y habilita botones segun paciente seleccionado
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
//wsp handler mejorado
  if (sendWhatsAppBtn) {
    sendWhatsAppBtn.addEventListener('click', async () => {
      try {
        const opt = patientSelect.options[patientSelect.selectedIndex];
        const phoneRaw = opt && opt.dataset ? opt.dataset.phone || '' : '';
        if (!phoneRaw) { setStatus('Resultados'); return; }

        
        const digits = String(phoneRaw).replace(/\D/g, '');
        
        let phoneForWa = '';
        if (digits.length >= 11) {
          phoneForWa = digits; //incluye codigo de pais
        } else if (digits.length === 10) {
          phoneForWa = digits; //ocal 10 digitos
        } else {
          // numero invalido
          setStatus('Resultados');
          return;
        }

        const message = 'Te comparto el resultado.';
        const url = `https://wa.me/${phoneForWa}?text=${encodeURIComponent(message)}`;

  
        console.log('[WA] open', { phoneRaw, digits, phoneForWa, url });

        if (window.apiResults && typeof window.apiResults.openExternal === 'function') {
          await window.apiResults.openExternal(url);
        } else {
          window.open(url, '_blank');
        }

        // Mantener mensaje final si hay PDF
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
//Email Handler
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
//Click en enlace del PDF
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

  // Inicializacion
  if (reportLinkP) reportLinkP.style.display = 'none';
  if (sendWhatsAppBtn) sendWhatsAppBtn.disabled = true;
  if (sendEmailBtn) sendEmailBtn.disabled = true;
  await loadPatients?.();
})();