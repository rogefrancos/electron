// Variables 
const inputNombre = document.querySelector('#nombre');
const inputApellidoP = document.querySelector('#apellidoP');
const inputApellidoM = document.querySelector('#apellidoM');
const inputFechaNac = document.querySelector('#fechaNac');
const inputGenero = document.querySelector('#genero');
const inputEmail = document.querySelector('#email');
const inputTelefono = document.querySelector('#telefono');

// Eventos 
inputNombre.addEventListener('blur',validar);
inputApellidoP.addEventListener('blur', validar);
inputApellidoM.addEventListener('blur', validar);
inputGenero.addEventListener('blur', validar);
inputFechaNac.addEventListener('blur', validar);
inputTelefono.addEventListener('blur', validar);
inputEmail.addEventListener('blur', validar);

// Funciones
function validar(e){
    if(e.target.value.trim() === ''){
        mostrarAlerta(`El campo ${e.target.id}  es obligatorio`, e.target.parentElement);
        return;
    }

    if(e.target.id === 'email' && !validarEmail(e.target.value)){
        mostrarAlerta('El email no es valido', e.target.parentElement);
        return;
    }


    limpiarAlerta(e.target.parentElement);
}

function mostrarAlerta(mensaje, referencia){
    limpiarAlerta(referencia);

    const error = document.createElement('P');
    error.textContent = mensaje;
    error.classList.add('error')

    referencia.appendChild(error);
}

function limpiarAlerta(referencia) {
        // comprueba si ya hay una alerta
        const alerta = referencia.querySelector('.error');
        if(alerta){
            alerta.remove();
        }
}

function validarEmail(email){
        const regex =  /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/ 
        const resultado = regex.test(email);
        return resultado;
    }