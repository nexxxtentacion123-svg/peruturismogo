import { escaparHtml } from './utils/sanitize.js';
import {
    ASSISTANT_OPTIONS,
    ASSISTANT_STEPS,
    normalizarPerfil,
    obtenerLimitaciones,
    recomendarDestinos
} from './assistant.js';

const INTEREST_OPTIONS = [
    ['cultura', 'Cultura e historia'],
    ['naturaleza', 'Naturaleza'],
    ['aventura', 'Aventura'],
    ['gastronomia', 'Gastronomía'],
    ['urbano', 'Ciudad y barrios']
];

function opcionesRadio(name, opciones, valor) {
    return opciones.map(opcion => `
        <label class="asistente-opcion">
            <input type="radio" name="${name}" value="${escaparHtml(opcion.value)}" ${opcion.value === valor ? 'checked' : ''}>
            <span><strong>${escaparHtml(opcion.label)}</strong><small>${escaparHtml(opcion.hint)}</small></span>
        </label>
    `).join('');
}

function crearPaso(paso, perfil) {
    const titulo = {
        presupuesto: '¿Qué presupuesto quieres cuidar?',
        fechas: '¿Cuándo y por cuánto tiempo viajas?',
        salida: '¿Desde qué ciudad partes?',
        intereses: '¿Qué te gustaría encontrar?',
        ritmo: '¿Qué ritmo te acomoda?',
        transporte: '¿Cómo te moverás?'
    }[paso.id];
    let control = '';
    if (paso.id === 'presupuesto' || paso.id === 'ritmo' || paso.id === 'transporte') {
        control = opcionesRadio(paso.id, ASSISTANT_OPTIONS[paso.id], perfil[paso.id]);
    } else if (paso.id === 'fechas') {
        control = `
            <label class="asistente-campo">Fecha de inicio
                <input type="date" name="fechas" value="${escaparHtml(perfil.fechas)}">
            </label>
            <label class="asistente-campo">Duración
                <select name="duracion">
                    <option value="">Prefiero no indicarla</option>
                    <option value="1" ${perfil.duracion === '1' ? 'selected' : ''}>1 día</option>
                    <option value="2-3" ${perfil.duracion === '2-3' ? 'selected' : ''}>2–3 días</option>
                    <option value="4-7" ${perfil.duracion === '4-7' ? 'selected' : ''}>4–7 días</option>
                    <option value="8+" ${perfil.duracion === '8+' ? 'selected' : ''}>Más de una semana</option>
                </select>
            </label>`;
    } else if (paso.id === 'salida') {
        control = `<label class="asistente-campo">Ciudad de salida
            <input name="salida" type="text" maxlength="60" value="${escaparHtml(perfil.salida)}" placeholder="Ej. Lima" autocomplete="address-level2" required>
        </label>`;
    } else {
        control = `<div class="asistente-intereses">${INTEREST_OPTIONS.map(([value, label]) => `
            <label class="asistente-check"><input type="checkbox" name="intereses" value="${value}" ${perfil.intereses.includes(value) ? 'checked' : ''}><span>${label}</span></label>
        `).join('')}</div>`;
    }
    return `<p class="asistente-kicker">Paso ${ASSISTANT_STEPS.indexOf(paso) + 1} de ${ASSISTANT_STEPS.length}</p>
        <h3 id="asistente-pregunta">${titulo}</h3><div class="asistente-control">${control}</div>`;
}

function renderResultados(container, perfil, catalogo) {
    const resultados = recomendarDestinos(catalogo, perfil, 5);
    const limitaciones = obtenerLimitaciones(perfil, catalogo);
    container.innerHTML = `
        <div class="asistente-resultados">
            <p class="asistente-kicker">Tu plan local</p>
            <h3>Encontramos ${resultados.length} ${resultados.length === 1 ? 'destino' : 'destinos'}</h3>
            <p class="asistente-subtitulo">Recomendaciones calculadas solo con el catálogo disponible en este dispositivo.</p>
            ${resultados.length ? `<div class="asistente-lista-resultados">${resultados.map(({ lugar, explicacion, costoEstimado, precioRegistrado }) => `
                <article class="asistente-destino">
                    <div><h4>${escaparHtml(lugar.nombre)}</h4><p>${escaparHtml(explicacion)}</p>
                    <small><strong>Rango estimado:</strong> ${escaparHtml(costoEstimado)}${precioRegistrado !== costoEstimado ? ` · Registrado: ${escaparHtml(precioRegistrado)}` : ''}</small></div>
                    <button type="button" class="asistente-ver" data-lugar-id="${escaparHtml(lugar.id)}">Ver en mapa</button>
                </article>`).join('')}</div>` : '<p class="asistente-vacio">No hay destinos en el catálogo para esos criterios. Prueba con un presupuesto flexible o menos intereses.</p>'}
            <div class="asistente-limitaciones"><strong>Importante</strong><ul>${limitaciones.map(texto => `<li>${escaparHtml(texto)}</li>`).join('')}</ul></div>
        </div>`;
    container.querySelectorAll('[data-lugar-id]').forEach(btn => btn.addEventListener('click', () => {
        window.abrirModalLugar?.(Number(btn.dataset.lugarId));
    }));
}

export function initAsistente(catalogo) {
    const overlay = document.getElementById('asistente-overlay');
    const panel = document.getElementById('asistente-panel');
    const body = document.getElementById('asistente-body');
    const abrir = document.getElementById('btn-abrir-asistente');
    const cerrar = document.getElementById('asistente-cerrar');
    const atras = document.getElementById('asistente-atras');
    const reiniciar = document.getElementById('asistente-reiniciar');
    const form = document.getElementById('asistente-form');
    if (!overlay || !panel || !body || !abrir || !cerrar || !atras || !reiniciar || !form) return;

    let pasoActual = 0;
    let perfil = normalizarPerfil();
    const render = () => {
        form.classList.remove('hidden');
        body.innerHTML = crearPaso(ASSISTANT_STEPS[pasoActual], perfil);
        atras.disabled = pasoActual === 0;
        document.getElementById('asistente-continuar').textContent = pasoActual === ASSISTANT_STEPS.length - 1 ? 'Ver recomendaciones' : 'Continuar';
    };
    const abrirPanel = () => {
        overlay.classList.remove('hidden');
        render();
        document.getElementById('asistente-continuar').focus();
    };
    const cerrarPanel = () => overlay.classList.add('hidden');
    abrir.addEventListener('click', abrirPanel);
    cerrar.addEventListener('click', cerrarPanel);
    overlay.addEventListener('click', event => { if (event.target === overlay) cerrarPanel(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.classList.contains('hidden')) cerrarPanel(); });
    reiniciar.addEventListener('click', () => { pasoActual = 0; perfil = normalizarPerfil(); render(); });
    atras.addEventListener('click', () => { if (pasoActual > 0) { pasoActual -= 1; render(); } });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        if (ASSISTANT_STEPS[pasoActual].id === 'salida' && !String(data.get('salida') || '').trim()) {
            form.reportValidity();
            return;
        }
        perfil = normalizarPerfil({
            ...perfil,
            [ASSISTANT_STEPS[pasoActual].id]: ASSISTANT_STEPS[pasoActual].id === 'intereses'
                ? data.getAll('intereses')
                : data.get(ASSISTANT_STEPS[pasoActual].id)
        });
        if (ASSISTANT_STEPS[pasoActual].id === 'fechas') perfil.duracion = data.get('duracion') || '';
        if (pasoActual === ASSISTANT_STEPS.length - 1) {
            form.classList.add('hidden');
            renderResultados(body, perfil, catalogo);
            atras.disabled = true;
        } else {
            pasoActual += 1;
            render();
        }
    });
    render();
}
