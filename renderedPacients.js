// Client-side for pacients.html - create, search-autocomplete, list, inline edit/delete
// Género: masculino, femenino, "39 tipos de gay" (exactamente como pediste)

(async function () {
  const GENDER_OPTIONS = ['masculino', 'femenino', '39 tipos de gay'];

  function labelize(s) {
    if (!s) return '';
    // Capitalize first letter only (keeps the exact phrase for "39 tipos de gay")
    if (/^\d/.test(s)) return s; // if starts with digit, keep as-is
    return String(s)[0].toUpperCase() + String(s).slice(1);
  }

  const form = document.getElementById('create-pac-form');
  const inputSearch = document.getElementById('patient-search-input');
  const ac = document.getElementById('patient-autocomplete');
  const statusEl = document.getElementById('patients-status');
  const tbody = document.querySelector('#patients-table tbody');
  const generoSelect = document.getElementById('p-genero');

  // Ensure the create form select remains consistent (in case HTML was changed elsewhere)
  function populateMainGender() {
    if (!generoSelect) return;
    // If HTML already has the options (as in provided pacients.html), skip overwriting to preserve exact wording.
    // But ensure at least the required three exist; if not, populate from GENDER_OPTIONS.
    const existing = Array.from(generoSelect.options).map(o => o.value.toLowerCase().trim());
    const needed = GENDER_OPTIONS.every(g => existing.includes(String(g).toLowerCase()));
    if (needed) return;
    generoSelect.innerHTML = '<option value="">-- Selecciona --</option>';
    for (const g of GENDER_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = labelize(g);
      generoSelect.appendChild(opt);
    }
  }

  function populateGenderSelect(selectEl, selectedValue) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">--</option>';
    for (const g of GENDER_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = labelize(g);
      if (selectedValue && String(selectedValue).toLowerCase() === String(g).toLowerCase()) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  function showStatus(msg, type='info', timeout=4000) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.color = type === 'error' ? '#800' : '#084';
    statusEl.textContent = msg;
    if (timeout>0) { clearTimeout(showStatus._t); showStatus._t = setTimeout(()=> { statusEl.style.display='none'; }, timeout); }
  }

  function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, t=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[t])); }
  function escapeAttr(s) { if (!s) return ''; return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

  // Validation helpers
  function validDate(d) { return !d || /^\d{4}-\d{2}-\d{2}$/.test(d); }
  function validEmail(e) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function validPhone(p) { return !p || /^[0-9+\s\-()]{6,20}$/.test(p); }

  function validatePatientInput({ nombre, apellidoP, fechaNac, correo, telefono }) {
    if (!nombre || nombre.trim().length === 0) return { ok: false, error: 'Nombre requerido' };
    if (!apellidoP || apellidoP.trim().length === 0) return { ok: false, error: 'Apellido paterno requerido' };
    if (fechaNac && !validDate(fechaNac)) return { ok: false, error: 'Fecha inválida. Usa YYYY-MM-DD' };
    if (correo && !validEmail(correo)) return { ok: false, error: 'Correo inválido' };
    if (telefono && !validPhone(telefono)) return { ok: false, error: 'Teléfono inválido' };
    return { ok: true };
  }

  // Populate main gender select (but don't override if HTML already has the three options)
  populateMainGender();

  // --- load + render patients ---
  async function loadAll() {
    try {
      if (!window.apiPac || typeof window.apiPac.getPatients !== 'function') {
        tbody.innerHTML = '<tr><td colspan="4">API de pacientes no disponible</td></tr>';
        return;
      }
      const res = await window.apiPac.getPatients();
      if (!res || !res.success) { tbody.innerHTML = '<tr><td colspan="4">Error cargando pacientes</td></tr>'; return; }
      const patients = res.patients || [];
      renderPatientsTable(patients);
    } catch (err) {
      console.error('loadAll patients error', err);
      tbody.innerHTML = '<tr><td colspan="4">Error (ver consola)</td></tr>';
    }
  }

  function renderPatientsTable(list) {
    tbody.innerHTML = '';
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No hay pacientes</td></tr>';
      return;
    }
    list.forEach(p => {
      const full = `${p.nombre || ''} ${p.apellidoP || ''} ${p.apellidoM || ''}`.trim();
      const tr = document.createElement('tr');
      tr.dataset.id = p.id;
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${escapeHtml(full)}</td>
        <td>${escapeHtml(p.telefono || '')}</td>
        <td>
          <div class="actions">
            <button data-id="${p.id}" class="edit-pac boton">Edit</button>
            <button data-id="${p.id}" class="del-pac boton boton_cancelar">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-pac').forEach(b => b.addEventListener('click', onEdit));
    tbody.querySelectorAll('.del-pac').forEach(b => b.addEventListener('click', onDelete));
  }

  // --- create patient ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('p-nombre').value.trim();
    const apellidoP = document.getElementById('p-apellidoP').value.trim();
    const apellidoM = document.getElementById('p-apellidoM').value.trim();
    const genero = document.getElementById('p-genero').value;
    const fechaNac = document.getElementById('p-fechaNac').value.trim();
    const correo = document.getElementById('p-correo').value.trim();
    const telefono = document.getElementById('p-telefono').value.trim();

    const v = validatePatientInput({ nombre, apellidoP, fechaNac, correo, telefono });
    if (!v.ok) { showStatus(v.error, 'error'); return; }

    try {
      const res = await window.apiPac.regPac(nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono);
      if (res && res.success) {
        showStatus('Paciente creado', 'info');
        form.reset();
        await loadAll();
      } else {
        showStatus('Error creando paciente: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
      }
    } catch (err) {
      console.error('create patient error', err);
      showStatus('Error creando paciente (ver consola)', 'error', 6000);
    }
  });

  // --- autocomplete/search logic ---
  let patientsCache = null;
  const MAX = 12;

  async function loadPatientsCache() {
    if (patientsCache) return patientsCache;
    try {
      const res = await window.apiPac.getPatients();
      if (res && res.success) {
        patientsCache = (res.patients || []).map(p => ({
          id: p.id,
          nombre: p.nombre,
          apellidoP: p.apellidoP,
          apellidoM: p.apellidoM,
          telefono: p.telefono,
          correo: p.correo,
          fullName: `${p.nombre || ''} ${p.apellidoP || ''} ${p.apellidoM || ''}`.trim()
        }));
      } else {
        patientsCache = [];
      }
      return patientsCache;
    } catch (err) {
      console.error('loadPatientsCache error', err);
      patientsCache = [];
      return patientsCache;
    }
  }

  function filterPatientsLocal(q) {
    if (!q) return [];
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out = [];
    for (const p of patientsCache || []) {
      if ((p.fullName || '').toLowerCase().includes(s) || (p.telefono || '').toLowerCase().includes(s)) out.push(p);
      if (out.length >= MAX) break;
    }
    return out;
  }

  async function fetchPatientsQuery(q) {
    try {
      const res = await window.apiPac.getPatients({ query: q });
      if (res && res.success) return res.patients || [];
      return [];
    } catch (err) {
      console.error('fetchPatientsQuery error', err);
      return [];
    }
  }

  function renderSuggestions(list) {
    ac.innerHTML = '';
    ac.setAttribute('aria-hidden', list.length === 0 ? 'true' : 'false');
    if (!list || list.length === 0) { ac.style.display = 'none'; return; }
    ac.style.display = 'block';
    list.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.dataset.index = idx;
      item.innerHTML = `<span class="ac-name">${escapeHtml(p.fullName)}</span><span class="ac-phone">${escapeHtml(p.telefono||'')}</span>`;
      item.addEventListener('click', () => selectSuggestion(p));
      ac.appendChild(item);
    });
  }

  function selectSuggestion(p) {
    inputSearch.value = p.fullName;
    ac.style.display = 'none';
    renderPatientsTable([p]);
    showStatus(`Mostrando: ${p.fullName}`, 'info', 2500);
  }

  inputSearch.addEventListener('input', async (ev) => {
    const q = ev.target.value;
    if (!q || q.length < 1) { ac.style.display = 'none'; await loadAll(); return; }
    const list = await fetchPatientsQuery(q);
    if (list && list.length > 0) {
      renderSuggestions(list.slice(0, MAX));
      return;
    }
    await loadPatientsCache();
    const local = filterPatientsLocal(q);
    renderSuggestions(local);
  });

  inputSearch.addEventListener('blur', () => setTimeout(()=> ac.style.display='none', 150));

  // --- edit inline ---
  async function onEdit(e) {
    const id = Number(e.currentTarget.dataset.id);
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    const res = await window.apiPac.getPatients({ id });
    const p = (res && res.success && res.patients && res.patients[0]) ? res.patients[0] : null;
    const nombre = p ? p.nombre : '';
    const apellidoP = p ? p.apellidoP : '';
    const apellidoM = p ? p.apellidoM : '';
    const telefono = p ? p.telefono : '';
    const genero = p ? p.genero : '';
    const fechaNac = p ? p.fechaNac : '';
    const correo = p ? p.correo : '';

    tr.innerHTML = `
      <td>${id}</td>
      <td>
        <input class="edit-nombre campo__field" value="${escapeAttr(nombre)}" placeholder="Nombre" />
        <input class="edit-apellidoP campo__field" value="${escapeAttr(apellidoP)}" placeholder="Apellido P" />
        <input class="edit-apellidoM campo__field" value="${escapeAttr(apellidoM)}" placeholder="Apellido M" />
        <select class="edit-genero select"></select>
        <input class="edit-fecha campo__field" value="${escapeAttr(fechaNac)}" placeholder="YYYY-MM-DD" />
        <input class="edit-correo campo__field" value="${escapeAttr(correo)}" placeholder="Correo" />
      </td>
      <td><input class="edit-telefono campo__field" value="${escapeAttr(telefono)}" /></td>
      <td>
        <div class="actions">
          <button class="save-pac boton">Save</button>
          <button class="cancel-pac boton boton_cancelar">Cancel</button>
        </div>
      </td>
    `;

    const generoSel = tr.querySelector('.edit-genero');
    populateGenderSelect(generoSel, genero);

    tr.querySelector('.save-pac').addEventListener('click', async () => {
      const fields = {};
      const newNombre = tr.querySelector('.edit-nombre').value.trim();
      const newApellidoP = tr.querySelector('.edit-apellidoP').value.trim();
      const newApellidoM = tr.querySelector('.edit-apellidoM').value.trim();
      const newTelefono = tr.querySelector('.edit-telefono').value.trim();
      const newGenero = tr.querySelector('.edit-genero').value;
      const newFecha = tr.querySelector('.edit-fecha').value.trim();
      const newCorreo = tr.querySelector('.edit-correo').value.trim();

      const v = validatePatientInput({ nombre: newNombre, apellidoP: newApellidoP, fechaNac: newFecha, correo: newCorreo, telefono: newTelefono });
      if (!v.ok) { showStatus(v.error, 'error'); return; }

      if (newNombre) fields.nombre = newNombre;
      if (newApellidoP) fields.apellidoP = newApellidoP;
      if (newApellidoM) fields.apellidoM = newApellidoM;
      if (newTelefono) fields.telefono = newTelefono;
      if (newGenero) fields.genero = newGenero;
      if (newFecha) fields.fechaNac = newFecha;
      if (newCorreo) fields.correo = newCorreo;

      const res2 = await window.apiPac.updatePatient(id, fields);
      if (res2 && res2.success) {
        showStatus('Paciente actualizado', 'info');
        patientsCache = null;
        await loadAll();
      } else {
        showStatus('Error al actualizar paciente: ' + (res2 && res2.error ? res2.error : 'unknown'), 'error', 6000);
      }
    });

    tr.querySelector('.cancel-pac').addEventListener('click', async () => { await loadAll(); });
  }

  // --- delete ---
  async function onDelete(e) {
    const id = Number(e.currentTarget.dataset.id);
    const res = await window.apiPac.deletePatient(id);
    if (res && res.success) {
      showStatus('Paciente eliminado', 'info');
      patientsCache = null;
      await loadAll();
    } else {
      showStatus('Error al eliminar paciente: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
    }
  }

  // init
  await loadAll();
})();