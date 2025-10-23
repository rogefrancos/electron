const inputNombre = document.querySelector('#nombre');
const inputFecha = document.querySelector('#fecha');
const inputHora = document.querySelector('#hora');


inputNombre.addEventListener('blur', validar);
inputFecha.addEventListener('blur', validar);
inputHora.addEventListener('blur', validar);

function validar(e){
    if(e.target.value.trim() === ''){
        mostrarAlerta(e.target.parentElement);
        return;
    }
    
    limpiarAlerta(e.target.parentElement);
}

function mostrarAlerta(referencia){
    const mensaje = document.createElement('P');
    mensaje.textContent = 'El campo es obligatorio';
    mensaje.classList.add('error')

    referencia.appendChild(mensaje);
}

function limpiarAlerta(referencia) {
        // comprueba si ya hay una alerta
        const alerta = referencia.querySelector('.error');
        if(alerta){
            alerta.remove();
        }
    }