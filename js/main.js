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
import { recomendarLugares, crearExplicacion, obtenerPresupuestoTexto } from './recommendations.js';

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
    document.getElementById('btn-planificar')?.addEventListener('click', () => {
        modal?.classList.remove('hidden');
        document.getElementById('plan-presupuesto')?.focus();
    });
    document.getElementById('planificador-cerrar')?.addEventListener('click', () => modal?.classList.add('hidden'));
    modal?.addEventListener('click', event => {
        if (event.target === modal) modal.classList.add('hidden');
    });
    form?.addEventListener('submit', event => {
        event.preventDefault();
        const datos = new FormData(form);
        const preferencias = {
            presupuesto: String(datos.get('presupuesto') || 'medio'),
            dias: Number(datos.get('dias') || 3),
            region: String(datos.get('region') || '').trim(),
            intereses: datos.getAll('intereses'),
            ritmo: String(datos.get('ritmo') || 'activo')
        };
        const recomendaciones = recomendarLugares(lugares, preferencias);
        if (!recomendaciones.length) {
            resultado.innerHTML = '<p class="planificador-vacio">No encontramos coincidencias todavía. Prueba quitando la región o eligiendo otro interés.</p>';
            return;
        }
        resultado.innerHTML = `
            <div class="planificador-resumen"><strong>Tu plan de ${preferencias.dias} día${preferencias.dias === 1 ? '' : 's'}</strong><span>Presupuesto ${obtenerPresupuestoTexto(preferencias.presupuesto)}</span></div>
            <div class="planificador-lista">${recomendaciones.map(lugar => `
                <article class="planificador-item">
                    <div><strong>${lugar.nombre}</strong><span>${lugar.region}${lugar.distrito ? ` · ${lugar.distrito}` : ''}</span><p>${crearExplicacion(lugar, preferencias)}</p></div>
                    <button type="button" class="btn-plan-lugar" data-lugar-id="${lugar.id}">Ver lugar</button>
                </article>`).join('')}</div>
            <small class="planificador-nota">Costos orientativos: S/ ${recomendaciones[0].costoEstimado}. Verifica tarifas, horarios y transporte antes de viajar.</small>`;
        resultado.querySelectorAll('[data-lugar-id]').forEach(button => {
            button.addEventListener('click', () => {
                modal.classList.add('hidden');
                abrirModalLugar(Number(button.dataset.lugarId));
            });
        });
    });
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
