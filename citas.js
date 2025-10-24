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
    if(e.target.value.trim() === ''){
        mostrarAlerta(`El campo ${e.target.id}  es obligatorio`, e.target.parentElement);
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


