// debemos asegurarnos que se crea el form y esta en pantalla para hacer la  logica
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const result = await window.api.login(username, password);

    if (result.success) {
      window.location.href = "landing.html";
    } else {
      document.getElementById('result').textContent = 'Usuario o contrasena incorrectos';
    }
  });
}

// api para agregar un paciente

const pacForm = document.getElementById('ingresar-usuario');
if(pacForm){
  pacForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombre').value;
    const apellidoP = document.getElementById('apellidoP').value;
    const apellidoM = document.getElementById('apellidoM').value;

    const result = await window.apiPac.regPac(nombre, apellidoP, apellidoM);

    if (result.success) {
      document.getElementById('result-reg-pac').textContent = 
        'id: ' + result.pac.id + 
        ' nombre: ' + result.pac.nombre + 
        ' ' + result.pac.apellidoP + 
        ' ' + result.pac.apellidoM;
    } else {
      document.getElementById('result-reg-pac').textContent = 'hubo un error al registrar';
    }
  })
}
// logica landing 

//aqui se maneja la side bar
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggle-btn");

//espera que se de click en el botton para que se despliegue
toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});
