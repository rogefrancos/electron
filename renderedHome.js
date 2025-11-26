

//Funcion autoejecutavle asincronica que se ejecuta al cargar el script
(async function () {
  //Referencias a elementos de la tabla en el DOM
  const tbody = document.getElementById('todays-citas-body');
  const wrapper = document.getElementById('todays-citas-wrapper');
  //Si no existen los elementos requeridos, no se continua
  if (!tbody || !wrapper) return;
  //Funcion para evitar inyeccion de HTML, reemplazando caracteres especiales
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[t]);
  }
  //Limpia la tabla
  function clearTable() {
    tbody.innerHTML = '';
  }
  //Muestra un mensaje indicando que no hay citas para hoy
  function showEmpty() {
    clearTable();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;                         //Abarca 3 columnas
    td.className = 'todays-empty';          //Clase para los estilos
    td.textContent = 'No hay citas para hoy.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  try {
    //Comprobacion de que la API esta disponible
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
    //Llamada a la API para oobtener las citas de hoy
    const res = await window.apiCitas.getTodaysCitas();
    //Verificar que hubo un error en la respuesta
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
    //Lista de citas obtenidas
    const citas = res.citas || [];
    //Si no hay citas, muestra el mensaje
    if (citas.length === 0) {
      showEmpty();
      return;
    }

    // Render filas ordenadas por hora (asumimos que main ya las ordenó)
    clearTable();
    citas.forEach(c => {
      const tr = document.createElement('tr');
      //Columna de la HORA
      const tdTime = document.createElement('td');
      tdTime.className = 'time';
      tdTime.textContent = c.hora || '--:--';
      tr.appendChild(tdTime);
      //Columna de NOMBRE
      const tdName = document.createElement('td');
      tdName.className = 'name';
      tdName.innerHTML = escapeHtml(c.nombre);  //Sanitiza el HTML
      tr.appendChild(tdName);
      //Columna de la NOTA
      const tdNote = document.createElement('td');
      tdNote.className = 'note';
      tdNote.innerHTML = c.nota ? escapeHtml(c.nota) : '';  
      tr.appendChild(tdNote);

      tbody.appendChild(tr);
    });
  } catch (err) {
    //Manejo de errores inesperados
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