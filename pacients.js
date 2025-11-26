// Variables: Inputs del formulario
const inputNombre = document.querySelector('#nombre');
const inputApellidoP = document.querySelector('#apellidoP');
const inputApellidoM = document.querySelector('#apellidoM');
const inputFechaNac = document.querySelector('#fechaNac');
const inputGenero = document.querySelector('#genero');
const inputEmail = document.querySelector('#email');
const inputTelefono = document.querySelector('#telefono');

// Eventos: Validar cuando el usuario sale del campo
inputNombre.addEventListener('blur',validar);
inputApellidoP.addEventListener('blur', validar);
inputApellidoM.addEventListener('blur', validar);
inputGenero.addEventListener('blur', validar);
inputFechaNac.addEventListener('blur', validar);
inputTelefono.addEventListener('blur', validar);
inputEmail.addEventListener('blur', validar);

// Funciones principales de validacion
function validar(e){
    //Si el campo esta vacio, marcamos el error
    if(e.target.value.trim() === ''){
        mostrarAlerta(`El campo ${e.target.id}  es obligatorio`, e.target.parentElement);
        return;
    }
    //Validacion especifica para email
    if(e.target.id === 'email' && !validarEmail(e.target.value)){
        mostrarAlerta('El email no es valido', e.target.parentElement);
        return;
    }

    //Si todo esta correcto, eliminamos el error previo
    limpiarAlerta(e.target.parentElement);
}
//Mostrar mensaje de error debajo del campo
function mostrarAlerta(mensaje, referencia){
    limpiarAlerta(referencia);
    //Crear mensaje
    const error = document.createElement('P');
    error.textContent = mensaje;
    error.classList.add('error')
    //Insertar en el HTML
    referencia.appendChild(error);
}
//Eliminar error si ya existe
function limpiarAlerta(referencia) {
        // comprueba si ya hay una alerta
        const alerta = referencia.querySelector('.error');
        if(alerta){
            alerta.remove();
        }
}
    //Validar formato de email con regex
function validarEmail(email){
        const regex =  /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/ 
        const resultado = regex.test(email);
        return resultado;
    }