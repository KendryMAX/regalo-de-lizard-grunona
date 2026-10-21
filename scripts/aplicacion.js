'use strict';

const SELECTOR_VALIDO = /^[A-Za-z_][\w-]*$/;
const ESPERA_SUGERENCIAS = 220;
const ESPERA_FETCH = 5000;

function erroresDe(campo) {
  if (!campo || !campo.id || !SELECTOR_VALIDO.test(campo.id)) return null;
  return document.querySelector(`[data-error-de="${campo.id}"]`);
}

const reglasDe = {
  requerido: (valor) => valor.trim().length > 0,
  email: (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim()),
  numero: (valor) => /^(\d+|\d{1,3}(\.\d{3})+)$/.test(valor.trim().replace(/\s/g, '')),
};

function validarCampo(campo) {
  if (campo.disabled) return true;

  const igualA = campo.dataset.igualA;
  const tipo = campo.type;
  const valor = campo.value;
  let correcto = true;
  let aviso = campo.dataset.error || 'Revisar este campo.';

  if (campo.hasAttribute('required')) correcto = reglasDe.requerido(valor);
  if (correcto && tipo === 'email' && valor) correcto = reglasDe.email(valor);
  if (correcto && campo.dataset.numero === 'si' && valor.trim()) {
    correcto = reglasDe.numero(valor);

    if (correcto) {
      const numero = Number(valor.trim().replace(/[.\s]/g, ''));
      const min = campo.dataset.min !== undefined ? Number(campo.dataset.min) : null;
      const max = campo.dataset.max !== undefined ? Number(campo.dataset.max) : null;
      if (min !== null && numero < min) correcto = false;
      if (max !== null && numero > max) correcto = false;
    }
  }
  if (correcto && igualA) {
    const otro = document.getElementById(igualA);
    correcto = !!otro && valor === otro.value;
  }
  if (correcto && typeof campo.checkValidity === 'function') {
    correcto = campo.checkValidity();
  }

  if (correcto && campo.dataset.tomado === 'si') {
    correcto = false;
    aviso = campo.dataset.errorDisponible || aviso;
  }

  campo.classList.toggle('invalido', !correcto);

  const destino = erroresDe(campo);
  if (destino) destino.textContent = correcto ? '' : aviso;

  return correcto;
}

function activarValidacion(formulario) {
  const campos = formulario.querySelectorAll('input, textarea, select');

  campos.forEach((campo) => {
    campo.addEventListener('blur', () => validarCampo(campo));
    campo.addEventListener('input', () => {
      if (campo.classList.contains('invalido')) validarCampo(campo);
    });
  });

  formulario.addEventListener('submit', (evento) => {
    const invalidos = [...campos].filter((campo) => !validarCampo(campo));

    if (invalidos.length === 0) return;

    evento.preventDefault();
    invalidos[0].focus();
  });
}

function activarDisponibilidad(campo) {
  const url = campo.dataset.disponibleEn;
  if (!url) return;

  let temporizador = null;
  let peticion = null;

  campo.addEventListener('input', () => {
    clearTimeout(temporizador);
    if (peticion) peticion.abort();

    campo.dataset.tomado = 'no';
    if (campo.classList.contains('invalido')) validarCampo(campo);

    const nombre = campo.value.trim();
    if (!nombre) return;

    temporizador = setTimeout(async () => {
      peticion = new AbortController();
      const limite = setTimeout(() => peticion.abort(), ESPERA_FETCH);

      try {
        const respuesta = await fetch(
          `${url}?nombre=${encodeURIComponent(nombre)}`,
          { signal: peticion.signal, headers: { Accept: 'application/json' } }
        );

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        if (campo.value.trim() !== nombre) return;

        campo.dataset.tomado = datos.disponible ? 'no' : 'si';
        validarCampo(campo);
      } catch (error) {
        if (error.name !== 'AbortError') {
          campo.dataset.tomado = 'no';
        }
      } finally {
        clearTimeout(limite);
      }
    }, ESPERA_SUGERENCIAS);
  });
}

function activarMenu() {
  const navegacion = document.getElementById('navegacion-principal');
  if (!navegacion) return;

  const sincronizar = (abierta) => {
    navegacion.classList.toggle('abierta', abierta);
    document.body.classList.toggle('menu-abierto', abierta);
  };

  document.querySelectorAll('.boton-menu, .accesos-boton').forEach((boton) => {
    boton.addEventListener('click', () => {
      const abierta = !navegacion.classList.contains('abierta');
      sincronizar(abierta);
      boton.setAttribute('aria-expanded', String(abierta));
    });
  });

  const accesos = document.querySelector('.accesos-rapidos');
  if (accesos) {
    accesos.addEventListener('mouseenter', () => {
      document.body.classList.add('menu-abierto');
    });
    accesos.addEventListener('mouseleave', () => {
      if (!navegacion.classList.contains('abierta')) {
        document.body.classList.remove('menu-abierto');
      }
    });
  }
}

function itemDeSugerencia(elemento) {
  const item = document.createElement('li');
  const titulo = document.createElement('span');
  item.setAttribute('role', 'option');
  titulo.textContent = elemento.titulo;
  item.append(titulo);

  if (elemento.tipo) {
    const tipo = document.createElement('span');
    tipo.className = 'sugerencia-tipo';
    tipo.textContent = elemento.tipo;
    item.append(tipo);
  }

  item.addEventListener('mousedown', (evento) => {
    evento.preventDefault();
    window.location.assign(elemento.enlace);
  });

  return item;
}

function pintarSugerencias(lista, elementos) {
  const fragmento = document.createDocumentFragment();

  if (elementos.length === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'vacio-sugerencia';
    vacio.textContent = 'Sin resultados';
    fragmento.append(vacio);
  } else {
    elementos.forEach((elemento, indice) => {
      const item = itemDeSugerencia(elemento);
      item.setAttribute('aria-selected', indice === 0 ? 'true' : 'false');
      fragmento.append(item);
    });
  }

  lista.replaceChildren(fragmento);
}

async function pedirSugerencias(termino, señal) {
  const url = `/buscar?formato=json&q=${encodeURIComponent(termino)}`;
  const respuesta = await fetch(url, {
    signal: señal,
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) throw new Error(`La búsqueda falló con el código ${respuesta.status}`);

  return respuesta.json();
}

function activarAutocompletado(campo) {
  const contenedor = campo.closest('form') || campo.parentElement;
  const lista = contenedor ? contenedor.querySelector('[data-sugerencias]') : null;

  if (!lista) return;

  let temporizador = null;
  let peticion = null;

  const ocultar = () => {
    lista.hidden = true;
  };

  const buscar = async (termino, señal) => {
    try {
      pintarSugerencias(lista, await pedirSugerencias(termino, señal));
      lista.hidden = false;
    } catch (error) {
      if (error.name !== 'AbortError') ocultar();
    }
  };

  campo.addEventListener('input', () => {
    const termino = campo.value.trim();

    clearTimeout(temporizador);
    if (peticion) peticion.abort();

    if (termino.length < 2) {
      ocultar();
      return;
    }

    temporizador = setTimeout(() => {
      peticion = new AbortController();
      const limite = setTimeout(() => peticion.abort(), ESPERA_FETCH);
      buscar(termino, peticion.signal).finally(() => clearTimeout(limite));
    }, ESPERA_SUGERENCIAS);
  });

  campo.addEventListener('blur', () => setTimeout(ocultar, 120));

  campo.addEventListener('keydown', (evento) => {
    const items = [...lista.querySelectorAll('li:not(.vacio-sugerencia)')];

    if (lista.hidden || items.length === 0) return;

    const teclas = ['ArrowDown', 'ArrowUp', 'Enter'];
    if (!teclas.includes(evento.key)) return;

    const elegido = items.findIndex((item) => item.getAttribute('aria-selected') === 'true');

    if (evento.key === 'Enter') {
      if (elegido < 0) return;
      evento.preventDefault();
      items[elegido].dispatchEvent(new MouseEvent('mousedown'));
      return;
    }

    evento.preventDefault();
    const salto = evento.key === 'ArrowDown' ? 1 : -1;
    const indice = (elegido + salto + items.length) % items.length;

    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === indice)));
    items[indice].scrollIntoView({ block: 'nearest' });
  });
}

function activarVistaPrevia() {
  document.querySelectorAll('[data-vista-previa]').forEach((area) => {
    const contador = area.parentElement.querySelector('.contador-vista-previa');
    if (!contador) return;

    const actualizar = () => {
      const n = area.value.length;
      if (n === 0) {
        contador.textContent = '';
      } else if (n > 500) {
        contador.textContent = `${n}/500 (la vista previa se corta con …)`;
      } else {
        contador.textContent = `${n}/500`;
      }
      contador.style.color = n > 500 ? '#e74c3c' : (n > 450 ? '#f39c12' : 'var(--gris)');
    };

    area.addEventListener('input', actualizar);
    actualizar();
  });
}

function activarEditores() {
  const areas = [...document.querySelectorAll('textarea.editor-memo')];
  if (areas.length === 0) return;

  const ajustar = (area) => {
    if (area.disabled) return;
    area.style.overflowY = 'hidden';
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`;
  };

  areas.forEach((area) => area.addEventListener('input', () => ajustar(area)));

  const formulario = areas[0].closest('form');
  if (formulario) formulario.addEventListener('change', () => areas.forEach(ajustar));

  window.addEventListener('resize', () => areas.forEach(ajustar));

  areas.forEach(ajustar);
}

function activarContadores() {
  document.querySelectorAll('[data-contador-de]').forEach((contador) => {
    const campo = document.getElementById(contador.dataset.contadorDe);

    if (!campo) return;

    const actualizar = () => {
      const largo = campo.value.length;
      const tope = campo.maxLength > 0 ? ` de ${campo.maxLength}` : '';
      contador.textContent = largo + (largo === 1 ? ' carácter' : ' caracteres') + tope;

      if (largo < 10) return;

      const estado = erroresDe(campo);
      if (estado && campo.classList.contains('invalido')) {
        estado.textContent = '';
        campo.classList.remove('invalido');
      }
    };

    campo.addEventListener('input', actualizar);
    actualizar();
  });
}

function activarCategoria(formulario) {
  const categoria = formulario.querySelector('#categoria');
  const contenedor = formulario.querySelector('#ficha-categoria');
  const nota = formulario.querySelector('#sin-categoria');

  if (!categoria || !contenedor) return;

  const grupos = [...formulario.querySelectorAll('[data-grupo-categoria]')];

  const actualizar = () => {
    const id = categoria.value;
    const hay = Boolean(id);
    let visible = false;

    grupos.forEach((grupo) => {
      const activo = hay && grupo.dataset.grupoCategoria === id;
      grupo.hidden = !activo;
      if (activo) visible = true;
    });

    contenedor.hidden = !hay;
    if (nota) nota.hidden = hay;

    formulario.querySelectorAll('input, textarea, select').forEach((campo) => {
      if (campo.id === 'categoria') return;
      const grupo = campo.closest('[data-grupo-categoria]');
      const habilitado = hay && (!grupo || !grupo.hidden);
      campo.disabled = !habilitado;
    });

    if (!visible && hay) contenedor.hidden = true;
  };

  categoria.addEventListener('change', actualizar);
  actualizar();
}

function activarConfirmaciones() {
  document.querySelectorAll('form[data-confirmar]').forEach((formulario) => {
    formulario.addEventListener('submit', (evento) => {
      if (!window.confirm(formulario.dataset.confirmar)) evento.preventDefault();
    });
  });
}

function activarVerClaves() {
  document.querySelectorAll('[data-ver-clave]').forEach((boton) => {
    const campo = document.getElementById(boton.dataset.verClave);

    if (!campo) return;

    boton.addEventListener('click', () => {
      const oculto = campo.type === 'password';
      campo.type = oculto ? 'text' : 'password';
      boton.classList.toggle('visible', oculto);
      boton.setAttribute('aria-pressed', String(oculto));

      const etiqueta = oculto ? 'Ocultar contraseña' : 'Mostrar contraseña';
      boton.setAttribute('aria-label', etiqueta);
      boton.setAttribute('title', etiqueta);
    });
  });
}

function activarCondicionales() {
  document.querySelectorAll('form[data-validar]').forEach((formulario) => {
    const dependientes = [...formulario.querySelectorAll('[data-visible-si]')];
    if (dependientes.length === 0) return;

    const actualizar = () => {
      dependientes.forEach((campo) => {
        const control = document.getElementById(campo.dataset.visibleSi);
        if (!control) return;

        const coincide = control.value.trim() === campo.dataset.visibleValor;
        campo.hidden = !coincide;

        campo.querySelectorAll('input, select, textarea').forEach((elemento) => {
          elemento.disabled = !coincide || control.disabled;
        });
      });
    };

    formulario.addEventListener('change', actualizar);
    actualizar();
  });
}

function activarVolver() {
  document.querySelectorAll('[data-volver]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
      const referrer = document.referrer;
      const mismoOrigen = referrer && new URL(referrer).origin === window.location.origin;

      if (mismoOrigen && window.history.length > 1) {
        evento.preventDefault();
        window.history.back();
      }
    });
  });
}

function activarMenuUsuario() {
  const contenedor = document.querySelector('[data-menu-usuario]');
  if (!contenedor) return;

  const boton = contenedor.querySelector('.usuario-boton');
  const panel = contenedor.querySelector('.menu-usuario-panel');
  if (!boton || !panel) return;

  const sincronizar = (abierta) => {
    panel.hidden = !abierta;
    boton.setAttribute('aria-expanded', String(abierta));
  };

  boton.addEventListener('click', () => sincronizar(panel.hidden));

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panel.hidden) {
      sincronizar(false);
      boton.focus();
    }
  });

  document.addEventListener('click', (evento) => {
    if (!panel.hidden && !contenedor.contains(evento.target)) sincronizar(false);
  });

  if (contenedor.dataset.aviso) sincronizar(true);

  const campoFoto = contenedor.querySelector('[data-foto-usuario]');
  if (!campoFoto) return;

  campoFoto.addEventListener('change', async () => {
    const archivo = campoFoto.files[0];
    if (!archivo) return;

    const formulario = campoFoto.closest('form');
    const circulo = contenedor.querySelector('.usuario-circulo');

    try {
      const respuesta = await fetch(formulario.action, {
        method: 'POST',
        body: new FormData(formulario),
        headers: { Accept: 'application/json' },
      });

      const datos = await respuesta.json();

      if (!datos.ok) {
        mostrarAvisoUsuario(datos.mensaje || 'No se pudo guardar la foto.');
        campoFoto.value = '';
        return;
      }

      if (!circulo.classList.contains('con-foto')) {
        circulo.querySelector('svg')?.remove();
        const imagen = document.createElement('img');
        imagen.alt = '';
        circulo.prepend(imagen);
        circulo.classList.add('con-foto');
      }
      circulo.querySelector('img').src = `${datos.avatar}?v=${Date.now()}`;

      const textoFoto = formulario.querySelector('.menu-usuario-texto-foto');
      if (textoFoto) textoFoto.textContent = 'Cambiar la foto';
      mostrarAvisoUsuario(datos.mensaje);
      campoFoto.value = '';
    } catch (error) {
      formulario.submit();
    }
  });
}

function mostrarAvisoUsuario(mensaje) {
  const panel = document.querySelector('.menu-usuario-panel');
  if (!panel) return;

  let aviso = panel.querySelector('.menu-usuario-aviso');
  if (!aviso) {
    aviso = document.createElement('p');
    aviso.className = 'menu-usuario-aviso';
    aviso.setAttribute('role', 'status');
    panel.prepend(aviso);
  }
  aviso.textContent = mensaje;
}

function iniciar() {
  document.querySelectorAll('form[data-validar]').forEach((formulario) => {
    activarValidacion(formulario);
    activarCategoria(formulario);
  });
  document.querySelectorAll('[data-disponible-en]').forEach(activarDisponibilidad);
  activarCondicionales();
  document.querySelectorAll('[data-autocompletado]').forEach(activarAutocompletado);
  activarMenu();
  activarMenuUsuario();
  activarContadores();
  activarVolver();
  activarVistaPrevia();
  activarEditores();
  activarVerClaves();
  activarConfirmaciones();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}