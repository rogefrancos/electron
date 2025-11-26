// Variables 
const inputNombre = document.querySelector('#nombre');
const inputFecha = document.querySelector('#fecha');
const inputHora = document.querySelector('#hora');

// Eventos 
inputNombre.addEventListener('blur', validar);
inputFecha.addEventListener('blur', validar);
inputHora.addEventListener('blur', validar);

// Funciones
function validar(e){
    //Validacion de campo vacio
    if(e.target.value.trim() === ''){
        mostrarAlerta(`El campo ${e.target.id}  es obligatorio`, e.target.parentElement);
        return;
    }
//Si todo esta bien limpia errores
    limpiarAlerta(e.target.parentElement);
}
//Crea un mensaje de error bajo el campo
function mostrarAlerta(mensaje, referencia){
    limpiarAlerta(referencia); //Evita duplicados

    const error = document.createElement('P');
    error.textContent = mensaje;
    error.classList.add('error')

    referencia.appendChild(error);
}
//Remueve el error si ya existe
function limpiarAlerta(referencia) {
        // comprueba si ya hay una alerta
        const alerta = referencia.querySelector('.error');
        if(alerta){
            alerta.remove();
        }
}


