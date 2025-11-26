// Client-side logic for citas.html: create, list, inline edit/delete
// (updated to avoid inline styles in generated HTML)
(async function () {
  const form = document.getElementById('create-cita-form');
  const tbody = document.querySelector('#citas-table tbody');
  const statusEl = document.getElementById('citas-status');

  function showStatus(msg, type='info', timeout=4000) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.color = type === 'error' ? '#800' : '#084';
    statusEl.textContent = msg;
    if (timeout>0) { clearTimeout(showStatus._t); showStatus._t = setTimeout(()=> { statusEl.style.display='none'; }, timeout); }
  }

  async function loadAll() {
    try {
      if (!window.apiCitas || typeof window.apiCitas.getAllCitas !== 'function') {
        tbody.innerHTML = '<tr><td colspan="4">API de citas no disponible</td></tr>';
        return;
      }
      const res = await window.apiCitas.getAllCitas();
      if (!res || !res.success) { tbody.innerHTML = '<tr><td colspan="4">Error cargando citas</td></tr>'; return; }
      const citas = res.citas || [];
      if (citas.length === 0) { tbody.innerHTML = '<tr><td colspan="4">No hay citas</td></tr>'; return; }
      tbody.innerHTML = '';
      citas.forEach(c => {
        const tr = document.createElement('tr');
        tr.dataset.id = c.id;
        tr.innerHTML = `
          <td>${c.id}</td>
          <td>${escapeHtml(c.nombre)}</td>
          <td>${c.fecha}${c.hora ? ' ' + c.hora : ''}</td>
          <td>
            <div class="actions">
              <button data-id="${c.id}" class="edit-cita boton">Edit</button>
              <button data-id="${c.id}" class="del-cita boton boton_cancelar">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.edit-cita').forEach(b => b.addEventListener('click', onEdit));
      tbody.querySelectorAll('.del-cita').forEach(b => b.addEventListener('click', onDelete));
    } catch (err) {
      console.error('loadAll citas error', err);
      tbody.innerHTML = '<tr><td colspan="4">Error (ver consola)</td></tr>';
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[t]);
  }

  // Create
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('c-nombre').value.trim();
    const fecha = document.getElementById('c-fecha').value.trim();
    const hora = document.getElementById('c-hora').value.trim();
    const nota = document.getElementById('c-nota').value.trim();
    if (!nombre || !fecha) { showStatus('Nombre y fecha son requeridos', 'error'); return; }
    const res = await window.apiCitas.createCita(nombre, fecha, hora, nota);
    if (res && res.success) {
      showStatus('Cita creada', 'info');
      form.reset();
      await loadAll();
    } else {
      showStatus('Error creando cita: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
    }
  });

  // Edit inline
  async function onEdit(e) {
    const id = Number(e.currentTarget.dataset.id);
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    const nombre = tr.children[1].textContent.trim();
    const fechaHora = tr.children[2].textContent.trim().split(' ');
    const fecha = fechaHora[0] || '';
    const hora = fechaHora[1] || '';

    tr.innerHTML = `
      <td>${id}</td>
      <td><input class="edit-nombre campo__field" value="${escapeAttr(nombre)}" /></td>
      <td>
        <div class="multi-input">
          <input class="edit-fecha campo__field" value="${escapeAttr(fecha)}" placeholder="YYYY-MM-DD" />
          <input class="edit-hora campo__field" value="${escapeAttr(hora)}" placeholder="HH:MM" />
        </div>
      </td>
      <td>
        <input class="edit-nota campo__field" placeholder="Nota (opcional)" />
        <div class="actions" style="margin-top:6px;">
          <button class="save-cita boton">Save</button>
          <button class="cancel-cita boton boton_cancelar">Cancel</button>
        </div>
      </td>
    `;

    tr.querySelector('.save-cita').addEventListener('click', async () => {
      const fields = {};
      const newNombre = tr.querySelector('.edit-nombre').value.trim();
      const newFecha = tr.querySelector('.edit-fecha').value.trim();
      const newHora = tr.querySelector('.edit-hora').value.trim();
      const newNota = tr.querySelector('.edit-nota').value.trim();
      if (newNombre) fields.nombre = newNombre;
      if (newFecha) fields.fecha = newFecha;
      if (newHora) fields.hora = newHora;
      if (newNota) fields.nota = newNota;
      const res = await window.apiCitas.updateCita(id, fields);
      if (res && res.success) {
        showStatus('Cita actualizada', 'info');
        await loadAll();
      } else {
        showStatus('Error al actualizar: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
        await loadAll();
      }
    });
    tr.querySelector('.cancel-cita').addEventListener('click', async () => { await loadAll(); });
  }

  // Delete
  async function onDelete(e) {
    const id = Number(e.currentTarget.dataset.id);
    const res = await window.apiCitas.deleteCita(id);
    if (res && res.success) {
      showStatus('Cita eliminada', 'info');
      await loadAll();
    } else {
      showStatus('Error al eliminar cita: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
      await loadAll();
    }
  }

  function escapeAttr(s) { if (!s) return ''; return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // init
  await loadAll();
})();