// Renderer para landing: muestra las citas de hoy en una tabla (informa si está vacía)
// Coloca este archivo en renderer/home.js (o actualiza el existente)

(async function () {
  const tbody = document.getElementById('todays-citas-body');
  const wrapper = document.getElementById('todays-citas-wrapper');
  if (!tbody || !wrapper) return;

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[t]);
  }

  function clearTable() {
    tbody.innerHTML = '';
  }

  function showEmpty() {
    clearTable();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'todays-empty';
    td.textContent = 'No hay citas para hoy.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  try {
    if (!window.apiCitas || typeof window.apiCitas.getTodaysCitas !== 'function') {
      clearTable();
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'todays-empty';
      td.textContent = 'API de citas no disponible.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const res = await window.apiCitas.getTodaysCitas();
    if (!res || !res.success) {
      clearTable();
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'todays-empty';
      td.textContent = `Error cargando citas: ${res && res.error ? res.error : 'desconocido'}`;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const citas = res.citas || [];
    if (citas.length === 0) {
      showEmpty();
      return;
    }

    // Render filas ordenadas por hora (asumimos que main ya las ordenó)
    clearTable();
    citas.forEach(c => {
      const tr = document.createElement('tr');

      const tdTime = document.createElement('td');
      tdTime.className = 'time';
      tdTime.textContent = c.hora || '--:--';
      tr.appendChild(tdTime);

      const tdName = document.createElement('td');
      tdName.className = 'name';
      tdName.innerHTML = escapeHtml(c.nombre);
      tr.appendChild(tdName);

      const tdNote = document.createElement('td');
      tdNote.className = 'note';
      tdNote.innerHTML = c.nota ? escapeHtml(c.nota) : '';
      tr.appendChild(tdNote);

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error al cargar citas de hoy (home):', err);
    clearTable();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'todays-empty';
    td.textContent = 'Error al cargar citas (ver consola).';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
})();