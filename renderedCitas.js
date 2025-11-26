
//Aqui se hacen referencias a elementos del DOM
(async function () {
  const form = document.getElementById('create-cita-form'); //Formulario para crear citas
  const tbody = document.querySelector('#citas-table tbody'); //Cuerpo de la tabla donde se listan las citas
  const statusEl = document.getElementById('citas-status');//Elemento para mensajes de estado

  //Funcion para mostrar mensajes informativos o de error
  function showStatus(msg, type='info', timeout=4000) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.color = type === 'error' ? '#800' : '#084';
    statusEl.textContent = msg;
    //Ocultar el mensaje despues de cierto tiempo
    if (timeout>0) { clearTimeout(showStatus._t); showStatus._t = setTimeout(()=> { statusEl.style.display='none'; }, timeout); }
  }
    //Aqui se cargan y muestran todas las citas existentes 
  async function loadAll() {
    try {
      //Valida que exista la API
      if (!window.apiCitas || typeof window.apiCitas.getAllCitas !== 'function') {
        tbody.innerHTML = '<tr><td colspan="4">API de citas no disponible</td></tr>';
        return;
      }
      const res = await window.apiCitas.getAllCitas(); //Obtiene citas desde la API
      if (!res || !res.success) { tbody.innerHTML = '<tr><td colspan="4">Error cargando citas</td></tr>'; return; }
      const citas = res.citas || [];
      //Si no hay citas muestra el mensaje
      if (citas.length === 0) { tbody.innerHTML = '<tr><td colspan="4">No hay citas</td></tr>'; return; }
      tbody.innerHTML = '';//Limpiar la tabla
      //Recorre cada cita y la anade a la tabla
      citas.forEach(c => {
        const tr = document.createElement('tr');
        tr.dataset.id = c.id;
        //Crea una fila con datos de la cita
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
      //Asigma eventos a los botones "Edit" y "Delete"

      tbody.querySelectorAll('.edit-cita').forEach(b => b.addEventListener('click', onEdit));
      tbody.querySelectorAll('.del-cita').forEach(b => b.addEventListener('click', onDelete));
    } catch (err) {
      console.error('loadAll citas error', err);
      tbody.innerHTML = '<tr><td colspan="4">Error (ver consola)</td></tr>';
    }
  }
  //Evita caracteres peligrosos para prevenir XSS
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[t]);
  }

  // AQUI CREA LA CITA
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    //Aqui obtiene los valores del formulario
    const nombre = document.getElementById('c-nombre').value.trim();
    const fecha = document.getElementById('c-fecha').value.trim();
    const hora = document.getElementById('c-hora').value.trim();
    const nota = document.getElementById('c-nota').value.trim();
    //Validacion basica
    if (!nombre || !fecha) { showStatus('Nombre y fecha son requeridos', 'error'); return; }
    //Envia la cita a la API
    const res = await window.apiCitas.createCita(nombre, fecha, hora, nota);
    if (res && res.success) {
      showStatus('Cita creada', 'info');
      form.reset();
      await loadAll();
    } else {
      showStatus('Error creando cita: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
    }
  });

  // EDITAR CITA EN LINEA
  async function onEdit(e) {
    const id = Number(e.currentTarget.dataset.id); //ID de la cita
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    //Obtiene informacion actual de la fila
    const nombre = tr.children[1].textContent.trim();
    const fechaHora = tr.children[2].textContent.trim().split(' ');
    const fecha = fechaHora[0] || '';
    const hora = fechaHora[1] || '';
    //Reemplaza contenido de la fila con inputs editables
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
    //Para cuando se hace clic en el boton "Guardar" dentro de la fila editada
    tr.querySelector('.save-cita').addEventListener('click', async () => {
      const fields = {}; //Este objeto contendra solo los campos que no han sido modificados
      //Aqui obtiene los valores editados y los limpia con trim
      const newNombre = tr.querySelector('.edit-nombre').value.trim();
      const newFecha = tr.querySelector('.edit-fecha').value.trim();
      const newHora = tr.querySelector('.edit-hora').value.trim();
      const newNota = tr.querySelector('.edit-nota').value.trim();
      //Solo agrega al objeto los campos que tengan valor
      if (newNombre) fields.nombre = newNombre;
      if (newFecha) fields.fecha = newFecha;
      if (newHora) fields.hora = newHora;
      if (newNota) fields.nota = newNota;
      //Llama a la API para actualizar la cita
      const res = await window.apiCitas.updateCita(id, fields);
      //Comprueba si la operacion fue exitosa
      if (res && res.success) {
        showStatus('Cita actualizada', 'info');
        await loadAll();
      } else {
        //Muestra error en caso de fallo
        showStatus('Error al actualizar: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
        await loadAll();
      }
    });
    //Boton de "Cancelar" solo recarga todo y descarta los cambios
    tr.querySelector('.cancel-cita').addEventListener('click', async () => { await loadAll(); });
  }

  // ELIMINAR LA CITA
  async function onDelete(e) {
    const id = Number(e.currentTarget.dataset.id); //Aqui obtiene el ID de la cita
    const res = await window.apiCitas.deleteCita(id);//Equi ejecuta la eliminacion atraves de la API
    //Comprueba el resultado
    if (res && res.success) {
      showStatus('Cita eliminada', 'info');
      await loadAll();
    } else {
      showStatus('Error al eliminar cita: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
      await loadAll();
    }
  }
  //Funcion para evitar caracteres peligrosos en los atributos HTML
  function escapeAttr(s) { if (!s) return ''; return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // Aqui inicializa cargando todas las citas al entrar en la pagina
  await loadAll();
})();