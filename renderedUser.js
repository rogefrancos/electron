// Client-side logic for users.html - robust loading of active user and admin UI
// Coloca este archivo donde users.html lo referencia (renderer/renderedUser.js).

(async function () {
  // Elementos DOM
  const activeUserP = document.getElementById('active-user');
  const logoutBtn = document.getElementById('logout-btn');
  const adminSection = document.getElementById('admin-section');

  const createForm = document.getElementById('create-user-form');
  const usersTableBody = document.querySelector('#users-table tbody');
  const usersStatus = document.getElementById('users-status');

  // Mostrar mensaje de estado en la UI (no modal)
  function showStatus(message, type = 'info', timeout = 4000) {
    if (!usersStatus) return;
    usersStatus.style.display = 'block';
    usersStatus.style.color = type === 'error' ? '#800' : (type === 'warn' ? '#a60' : '#084');
    usersStatus.textContent = message;
    if (timeout > 0) {
      clearTimeout(showStatus._t);
      showStatus._t = setTimeout(() => {
        usersStatus.style.display = 'none';
      }, timeout);
    }
  }

  // Helpers de UI
  function showActive(user) {
    if (!user) {
      activeUserP.textContent = 'No user logged in';
    } else {
      activeUserP.textContent = `ID: ${user.id}  |  Username: ${user.username}  |  Role: ${user.role}`;
    }
  }

  // Llamada segura a getActiveUser con manejo de errores
  async function loadActiveUser() {
    try {
      if (!window.apiUsers || typeof window.apiUsers.getActiveUser !== 'function') {
        console.error('apiUsers.getActiveUser no está disponible en preload');
        showStatus('Error: API no disponible (preload). Reinicia la app', 'error', 8000);
        return null;
      }
      const res = await window.apiUsers.getActiveUser();
      if (!res) {
        console.error('getActiveUser returned falsy', res);
        showStatus('Error al obtener usuario activo (respuesta inválida)', 'error', 8000);
        return null;
      }
      if (!res.success) {
        console.warn('getActiveUser returned success=false', res);
        showStatus('No autorizado o error al obtener usuario activo', 'error', 6000);
        return null;
      }
      // res.success === true
      console.log('[users renderer] active user response:', res);
      return res.user || null;
    } catch (err) {
      console.error('getActiveUser threw', err);
      showStatus('Error al obtener usuario activo (ver consola)', 'error', 8000);
      return null;
    }
  }

  // Cargar tabla de usuarios (solo para admin)
  async function loadUsersTable() {
    try {
      if (!window.apiUsers || typeof window.apiUsers.getAllUsers !== 'function') {
        usersTableBody.innerHTML = '<tr><td colspan="4">API de usuarios no disponible</td></tr>';
        return;
      }
      const res = await window.apiUsers.getAllUsers();
      if (!res || !res.success) {
        console.warn('getAllUsers error or unauthorized', res);
        usersTableBody.innerHTML = '<tr><td colspan="4">No autorizado o error al cargar usuarios</td></tr>';
        return;
      }
      const users = res.users || [];
      usersTableBody.innerHTML = '';
      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.dataset.userId = u.id;
        tr.innerHTML = `
          <td style="padding:8px;">${u.id}</td>
          <td style="padding:8px;">${escapeHtml(u.username)}</td>
          <td style="padding:8px;">${escapeHtml(u.role)}</td>
          <td style="padding:8px;">
            <button data-id="${u.id}" class="edit-user-btn boton">Edit</button>
            <button data-id="${u.id}" class="delete-user-btn boton boton_cancelar">Delete</button>
          </td>
        `;
        usersTableBody.appendChild(tr);
      });

      // Attach handlers
      usersTableBody.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', onEditClick));
      usersTableBody.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', onDeleteClick));
    } catch (err) {
      console.error('loadUsersTable error', err);
      usersTableBody.innerHTML = '<tr><td colspan="4">Error loading users (see console)</td></tr>';
    }
  }

  // Escape simple para evitar inyección en innerHTML
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[s]);
  }

  function escapeAttribute(s) {
    if (s == null) return '';
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Handlers de edición y borrado (se mantienen inline)
  function onEditClick(e) {
    try {
      const id = Number(e.currentTarget.dataset.id);
      const tr = usersTableBody.querySelector(`tr[data-user-id="${id}"]`);
      if (!tr) return;
      const usernameCell = tr.children[1];
      const roleCell = tr.children[2];
      const currentUsername = usernameCell.textContent.trim();
      const currentRole = roleCell.textContent.trim();

      tr.innerHTML = `
        <td style="padding:8px;">${id}</td>
        <td style="padding:8px;">
          <input class="edit-username campo__field" value="${escapeAttribute(currentUsername)}" />
        </td>
        <td style="padding:8px;">
          <select class="edit-role select">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </td>
        <td style="padding:8px;">
          <input type="password" placeholder="New password (optional)" class="edit-password campo__field" style="margin-bottom:6px;" />
          <div style="display:flex; gap:6px;">
            <button class="save-user-btn boton">Save</button>
            <button class="cancel-edit-btn boton boton_cancelar">Cancel</button>
          </div>
        </td>
      `;
      const roleSelect = tr.querySelector('.edit-role');
      if (roleSelect) roleSelect.value = (currentRole && currentRole.toLowerCase() === 'admin') ? 'admin' : 'user';

      tr.querySelector('.save-user-btn').addEventListener('click', async () => {
        try {
          const newUsername = tr.querySelector('.edit-username').value.trim();
          const newRole = tr.querySelector('.edit-role').value;
          const newPassword = tr.querySelector('.edit-password').value;
          const fields = {};
          if (newUsername && newUsername !== currentUsername) fields.username = newUsername;
          if (newRole && newRole !== currentRole) fields.role = newRole;
          if (newPassword && newPassword.length > 0) fields.password = newPassword;
          if (Object.keys(fields).length === 0) {
            showStatus('No hay cambios para guardar', 'warn', 2500);
            await refresh();
            return;
          }
          const res = await window.apiUsers.updateUser(id, fields);
          if (res && res.success) {
            showStatus('Usuario actualizado correctamente', 'info');
            await refresh();
          } else {
            showStatus('Error al actualizar usuario: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
            await refresh();
          }
        } catch (err) {
          console.error('save-user error', err);
          showStatus('Error al guardar usuario (ver consola)', 'error', 6000);
          await refresh();
        }
      });

      tr.querySelector('.cancel-edit-btn').addEventListener('click', async () => {
        await refresh();
      });
    } catch (err) {
      console.error('onEditClick error', err);
      showStatus('Error al iniciar edición (ver consola)', 'error', 6000);
    }
  }

  async function onDeleteClick(e) {
    try {
      const id = Number(e.currentTarget.dataset.id);
      const res = await window.apiUsers.deleteUser(id);
      if (res && res.success) {
        showStatus('Usuario eliminado', 'info');
        await refresh();
      } else {
        showStatus('Error al eliminar usuario: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
        await refresh();
      }
    } catch (err) {
      console.error('onDeleteClick error', err);
      showStatus('Error al eliminar usuario (ver consola)', 'error', 6000);
      await refresh();
    }
  }

  // Crear usuario
  createForm.addEventListener('submit', async (e) => {
    try {
      e.preventDefault();
      const username = document.getElementById('new-username').value.trim();
      const password = document.getElementById('new-password').value;
      const role = document.getElementById('new-role').value;
      if (!username || !password) {
        showStatus('username y password son requeridos', 'warn', 3000);
        return;
      }
      const submitBtn = createForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      const res = await window.apiUsers.createUser(username, password, role);
      if (res && res.success) {
        showStatus('Usuario creado correctamente', 'info');
        createForm.reset();
        await refresh();
      } else {
        showStatus('Error al crear usuario: ' + (res && res.error ? res.error : 'unknown'), 'error', 6000);
      }
      if (submitBtn) submitBtn.disabled = false;
    } catch (err) {
      console.error('create-user handler error', err);
      showStatus('Error al crear usuario (ver consola)', 'error', 6000);
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Logout - redirige a index sin dialog
  logoutBtn.addEventListener('click', async () => {
    try {
      await window.apiUsers.logout();
      window.location.replace('index.html');
    } catch (err) {
      console.error('logout error', err);
      showStatus('Error al cerrar sesión', 'error', 4000);
    }
  });

  // Refresh principal: obtiene usuario activo y lista si es admin
  async function refresh() {
    // Cargar usuario activo primero
    const user = await loadActiveUser();
    if (user === null) {
      // Si user es null, probablemente no hay sesión: redirigir al login
      console.log('No hay usuario activo -> redirigiendo a login');
      window.location.replace('index.html');
      return;
    }
    // Mostrar info del usuario activo siempre
    showActive(user);

    // Si es admin, mostrar la sección de gestión
    const isAdmin = user && user.role && String(user.role).toLowerCase() === 'admin';
    console.log('[users renderer] isAdmin=', isAdmin, 'role=', user && user.role);
    if (isAdmin) {
      adminSection.classList.remove('hidden');
      adminSection.style.display = 'block';
      adminSection.setAttribute('aria-hidden', 'false');
      await loadUsersTable();
    } else {
      adminSection.classList.add('hidden');
      adminSection.style.display = 'none';
      adminSection.setAttribute('aria-hidden', 'true');
    }
  }

  // Inicializar
  await refresh();
})();