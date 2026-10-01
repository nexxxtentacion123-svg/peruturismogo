/**
 * Punto de Entrada Principal (Main ES Module) — PerúTurismo GO
 */

import {
    cargarLugares,
    cargarRutas,
    obtenerVisitas,
    guardarVisitas,
    guardarFavoritos,
    guardarVisitasPresenciales
} from './state.js';

import {
    inicializarMapa,
    agregarMarcadores,
    irAlLugar,
    mostrarRutaEnMapa,
    ocultarRutaEnMapa
} from './map.js';

import {
    generarFiltros,
    generarFiltrosExplorador,
    generarFiltroRegion,
    configurarBuscador,
    configurarFiltrosRapidos,
    configurarBuscadorRutas,
    configurarOrdenar
} from './filters.js';

import {
    actualizarUI,
    actualizarRutas,
    actualizarRadarCercanos,
    initModal,
    abrirModalLugar,
    cerrarModal,
    hacerCheckIn,
    manejarFavorito,
    initTabs,
    initVistaMovil,
    initControlesMovil,
    initTema,
    mostrarBienvenida,
    agregarAnimacionPulso,
    mostrarToast
} from './ui.js';

import {
    exportarProgreso,
    importarProgreso,
    compartirProgreso
} from './gamification.js';

import {
    solicitarPermisoNotificaciones
} from './geo.js';
import { initAuth, guardarProgresoRemoto } from './auth.js';
import { escaparHtml } from './utils/sanitize.js';
import {
    recomendarLugares,
    crearExplicacion,
    obtenerLimitaciones,
    obtenerPresupuestoTexto,
    normalizarPreferencias
} from './recommendations.js';

window.peruAuth = { guardarProgresoRemoto };

function registrarServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.info('PWA: service worker registrado'))
        .catch(error => console.warn('PWA: no se pudo registrar el service worker', error));
}

function initPlanificador(lugares) {
    const modal = document.getElementById('modal-planificador');
    const form = document.getElementById('form-planificador');
    const resultado = document.getElementById('planificador-resultado');
    const paso = document.getElementById('planificador-paso');
    const atras = document.getElementById('planificador-atras');
    const reiniciar = document.getElementById('planificador-reiniciar');
    let pasoActual = 0;
    let preferencias = normalizarPreferencias();
    const pasos = ['presupuesto', 'fechas', 'salida', 'intereses', 'ritmo', 'transporte'];
    const renderPaso = () => {
        form?.querySelectorAll('[data-plan-step]').forEach(seccion => {
            seccion.hidden = seccion.dataset.planStep !== pasos[pasoActual];
        });
        if (paso) paso.textContent = `Paso ${pasoActual + 1} de ${pasos.length}`;
        if (atras) atras.disabled = pasoActual === 0;
        const continuar = document.getElementById('planificador-continuar');
        if (continuar) continuar.textContent = pasoActual === pasos.length - 1 ? 'Ver recomendaciones' : 'Continuar';
    };
    const resetear = () => {
        pasoActual = 0;
        preferencias = normalizarPreferencias();
        form?.reset();
        renderPaso();
        if (resultado) resultado.innerHTML = '';
    };
    document.getElementById('btn-planificar')?.addEventListener('click', () => {
        modal?.classList.remove('hidden');
        document.getElementById('plan-presupuesto')?.focus();
        resetear();
    });
    document.getElementById('planificador-cerrar')?.addEventListener('click', () => modal?.classList.add('hidden'));
    atras?.addEventListener('click', () => { if (pasoActual > 0) { pasoActual -= 1; renderPaso(); } });
    reiniciar?.addEventListener('click', resetear);
    modal?.addEventListener('click', event => {
        if (event.target === modal) modal.classList.add('hidden');
    });
    form?.addEventListener('submit', event => {
        event.preventDefault();
        const datos = new FormData(form);
        const actual = pasos[pasoActual];
        preferencias = normalizarPreferencias({
            ...preferencias,
            presupuesto: actual === 'presupuesto' ? datos.get('presupuesto') : preferencias.presupuesto,
            fechas: actual === 'fechas' ? datos.get('fechas') : preferencias.fechas,
            dias: actual === 'fechas' ? datos.get('dias') : preferencias.dias,
            salida: actual === 'salida' ? datos.get('salida') : preferencias.salida,
            region: actual === 'salida' ? datos.get('salida') : preferencias.region,
            intereses: actual === 'intereses' ? datos.getAll('intereses') : preferencias.intereses,
            ritmo: actual === 'ritmo' ? datos.get('ritmo') : preferencias.ritmo,
            transporte: actual === 'transporte' ? datos.get('transporte') : preferencias.transporte
        });
        if (actual === 'salida' && !preferencias.salida) {
            form.reportValidity();
            return;
        }
        if (pasoActual < pasos.length - 1) {
            pasoActual += 1;
            renderPaso();
            return;
        }
        const recomendaciones = recomendarLugares(lugares, preferencias, 5);
        if (!recomendaciones.length) {
            resultado.innerHTML = '<p class="planificador-vacio">No encontramos coincidencias con esos filtros. Prueba un presupuesto más amplio o menos intereses.</p>';
            return;
        }
        resultado.innerHTML = `
            <div class="planificador-resumen"><strong>Tu plan local</strong><span>Presupuesto ${obtenerPresupuestoTexto(preferencias.presupuesto)}</span></div>
            <div class="planificador-lista">${recomendaciones.map(lugar => `
                <article class="planificador-item">
                    <div><strong>${escaparHtml(lugar.nombre)}</strong><span>${escaparHtml(lugar.region || 'Perú')}</span><p>${escaparHtml(crearExplicacion(lugar, preferencias))}</p><small>Rango estimado: ${escaparHtml(lugar.costoRango)}</small></div>
                    <button type="button" class="btn-plan-lugar" data-lugar-id="${lugar.id}">Ver lugar</button>
                </article>`).join('')}</div>
            <div class="planificador-limitaciones"><strong>Transparencia</strong><ul>${obtenerLimitaciones(preferencias, lugares).map(texto => `<li>${escaparHtml(texto)}</li>`).join('')}</ul></div>`;
        resultado.querySelectorAll('[data-lugar-id]').forEach(button => {
            button.addEventListener('click', () => {
                modal.classList.add('hidden');
                abrirModalLugar(Number(button.dataset.lugarId));
            });
        });
    });
    renderPaso();
}

window.addEventListener('peruturismo:sync-error', () => {
    mostrarToast('No se pudo sincronizar tu progreso. Tus cambios siguen guardados en este dispositivo.', 'error');
});

// Exponer funciones necesarias en window para los event handlers inline en popups / templates
window.hacerCheckIn = hacerCheckIn;
window.manejarFavorito = manejarFavorito;
window.irAlLugar = irAlLugar;
window.abrirModalLugar = abrirModalLugar;
window.cerrarModal = cerrarModal;
window.mostrarRutaEnMapa = (id) => mostrarRutaEnMapa(id, { actualizarRutas, mostrarToast });

function initFechaInicio() {
    if (!localStorage.getItem('peruTurismo_fechaInicio')) {
        localStorage.setItem('peruTurismo_fechaInicio', new Date().toISOString());
    }
}

async function init() {
    registrarServiceWorker();
    if (localStorage.getItem('peruTurismo_tema') === 'oscuro') {
        document.body.classList.add('dark');
    }
    agregarAnimacionPulso();

    await initAuth({
        mostrarToast,
        onAuthChange: () => {
            actualizarUI();
            actualizarRutas();
        }
    });

    // 1. Inicializar Mapa
    inicializarMapa();

    // 2. Cargar Datos
    const lugares = await cargarLugares();
    const rutas = await cargarRutas();

    if (lugares.length === 0) {
        const listaContainer = document.getElementById('lista-lugares');
        if (listaContainer) {
            listaContainer.innerHTML = `<div class="vacio">No hay lugares disponibles todavía. Revisa el aviso superior y vuelve a intentar cuando tengas conexión.</div>`;
        }
        return;
    }

    // 3. Generar Controles de Filtros
    generarFiltros(actualizarUI);
    generarFiltrosExplorador(actualizarUI);
    generarFiltroRegion(actualizarUI);

    // 4. Renderizar Marcadores iniciales
    agregarMarcadores();

    // 5. Configurar Event Listeners e Inputs
    configurarBuscador(actualizarUI);
    configurarFiltrosRapidos(actualizarUI);
    configurarBuscadorRutas(actualizarRutas);
    configurarOrdenar(actualizarUI, mostrarToast);

    initModal();
    initTema();
    initTabs();
    initVistaMovil();
    initControlesMovil();
    initPlanificador(lugares);
    initFechaInicio();

    // 6. Actualizar Interfaz
    actualizarUI();
    actualizarRutas();

    // 7. Botones de Acción
    const btnReiniciar = document.getElementById('btn-reiniciar');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', () => {
            if (confirm('¿Reiniciar todas tus visitas y favoritos?')) {
                guardarVisitas([]);
                guardarFavoritos([]);
                guardarVisitasPresenciales([]);
                localStorage.removeItem('peruTurismo_fechasVisitas');
                agregarMarcadores();
                actualizarUI();
                actualizarRutas();
                mostrarToast('🔄 Progreso reiniciado. ¡Nueva aventura!');
            }
        });
    }

    const btnCompartir = document.getElementById('btn-compartir');
    if (btnCompartir) {
        btnCompartir.addEventListener('click', () => compartirProgreso(mostrarToast));
    }

    const btnExportar = document.getElementById('btn-exportar');
    if (btnExportar) {
        btnExportar.addEventListener('click', () => exportarProgreso(mostrarToast));
    }

    const btnImportar = document.getElementById('btn-importar');
    const inputImportar = document.getElementById('input-importar');
    if (btnImportar && inputImportar) {
        btnImportar.addEventListener('click', () => inputImportar.click());
        inputImportar.addEventListener('change', function() {
            if (this.files.length > 0) {
                importarProgreso(this.files[0], {
                    onImportSuccess: (count) => {
                        agregarMarcadores();
                        actualizarUI();
                        actualizarRutas();
                        mostrarToast(`📥 Progreso importado: ${count} visitas`);
                    }
                });
                this.value = '';
            }
        });
    }

    mostrarBienvenida();

    console.log(`🗺️ PerúTurismo GO (Módulos ES) cargado con ${lugares.length} lugares y ${rutas.length} rutas`);
    console.log(`✅ ${obtenerVisitas().length} lugares visitados`);
}

document.addEventListener('DOMContentLoaded', init);
