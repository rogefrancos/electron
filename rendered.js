// esta fucnion se llama en cuanto nuestro boton del form de login se presiona
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // capturamos la informacion tanto de el username como de la contrasena
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

// aqui se llama a la api que une el main con esto donde guardamos la informacion, que viene siendo el preload
  const result = await window.api.login(username, password);

// esta parte usa la respuesta que se estaba esperando de la api y segun la situacion responde
// determina el contenido del div
  document.getElementById('result').textContent = 
    result.success ? window.location.href = "index2.html" : 'Estado: Usuario o constrasena incorrectos';
});
