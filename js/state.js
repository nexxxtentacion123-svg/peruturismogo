/**
 * Módulo de Gestión de Estado y Almacenamiento Local (localStorage)
 */

import { consolidarCatalogo, assertCatalogoValido } from './catalog.js';

// Estado global de la aplicación
const state = {
    lugares: [],
    lugaresMap: new Map(), // O(1) lookup map por ID
    rutas: [],
    marcadores: {},
    mapa: null,
    capaTeselas: null,
    temaTeselasAplicado: null,
    capaRutaActual: null,
    rutaVisibleId: null,
    filtroActual: 'todos',
    filtroExplorador: 'todos',
    filtroBusqueda: '',
    filtroRegion: 'todas',
    filtroRapido: 'todos', // 'todos', 'joyas', 'favoritos', 'visitados', 'pendientes'
    filtroRutaTexto: '',
    filtroRutaDificultad: 'todas',
    ordenActual: 'nombre',
    ubicacionUsuario: null,
    marcadorUbicacion: null,
    circuloUbicacion: null,
    watchIdUbicacion: null,
    ultimaNotificacionCercania: {},
    ultimaActualizacionUbicacion: 0
};

export const RADIO_AUTO_CHECKIN = 120;
export const RADIO_PRESENCIAL = 250;
export const RADIO_RADAR = 5000;
export const INTERVALO_NOTIFICACION_CERCANIA = 5 * 60 * 1000;

export const TESELAS = {
    claro: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    oscuro: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

export const coloresRutas = [
    '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22',
    '#16a085', '#d35400', '#c2185b', '#5d6d7e', '#b7950b'
];

/**
 * Lee un valor JSON de localStorage con fallback seguro.
 */
export function leerStorageJson(clave, valorPorDefecto) {
    try {
        const valor = localStorage.getItem(clave);
        if (!valor) return valorPorDefecto;
        const parseado = JSON.parse(valor);
        return parseado ?? valorPorDefecto;
    } catch (error) {
        console.warn(`Se ignoró un valor corrupto de almacenamiento: ${clave}`, error);
        localStorage.removeItem(clave);
        return valorPorDefecto;
    }
}

/**
 * Guarda un valor JSON en localStorage con manejo de cuotas/errores.
 */
export function guardarStorageJson(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
        console.error(`Error guardando en localStorage (${clave}):`, error);
    }
    if (window.peruAuth?.guardarProgresoRemoto &&
        ['peruTurismo_visitas', 'peruTurismo_favoritos', 'peruTurismo_fechasVisitas', 'peruTurismo_visitasPresenciales'].includes(clave)) {
        window.peruAuth.guardarProgresoRemoto();
    }
}

// ===== GETTERS & SETTERS DEL ESTADO =====

export function getState() {
    return state;
}

export function setLugares(listaLugares) {
    state.lugares = listaLugares;
    state.lugaresMap = new Map(listaLugares.map(lugar => [lugar.id, lugar]));
}

export function getLugarPorId(id) {
    return state.lugaresMap.get(id) || null;
}

export function setRutas(listaRutas) {
    state.rutas = listaRutas;
}

// ===== GESTIÓN DE VISITAS (localStorage) =====

export function obtenerVisitas() {
    const data = leerStorageJson('peruTurismo_visitas', []);
    return Array.isArray(data) ? data : [];
}

export function guardarVisitas(visitas) {
    guardarStorageJson('peruTurismo_visitas', visitas);
}

export function toggleVisita(id) {
    let visitas = obtenerVisitas();
    const idx = visitas.indexOf(id);
    if (idx === -1) {
        visitas.push(id);
        registrarFechaVisita(id);
    } else {
        visitas.splice(idx, 1);
        eliminarFechaVisita(id);
        quitarVisitaPresencial(id);
    }
    guardarVisitas(visitas);
    return visitas;
}

export function estaVisitado(id) {
    return obtenerVisitas().includes(id);
}

// ===== FECHAS DE VISITA =====

export function obtenerFechasVisitas() {
    const data = leerStorageJson('peruTurismo_fechasVisitas', {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export function registrarFechaVisita(id) {
    const fechas = obtenerFechasVisitas();
    fechas[id] = new Date().toISOString();
    guardarStorageJson('peruTurismo_fechasVisitas', fechas);
}

export function eliminarFechaVisita(id) {
    const fechas = obtenerFechasVisitas();
    delete fechas[id];
    guardarStorageJson('peruTurismo_fechasVisitas', fechas);
}

// ===== VISITAS PRESENCIALES =====

export function obtenerVisitasPresenciales() {
    const data = leerStorageJson('peruTurismo_visitasPresenciales', []);
    return Array.isArray(data) ? data : [];
}

export function guardarVisitasPresenciales(lista) {
    guardarStorageJson('peruTurismo_visitasPresenciales', lista);
}

export function marcarVisitaPresencial(id) {
    const lista = obtenerVisitasPresenciales();
    if (!lista.includes(id)) {
        lista.push(id);
        guardarVisitasPresenciales(lista);
    }
}

export function quitarVisitaPresencial(id) {
    guardarVisitasPresenciales(obtenerVisitasPresenciales().filter(x => x !== id));
}

export function esPresencial(id) {
    return obtenerVisitasPresenciales().includes(id);
}

// ===== FAVORITOS =====

export function obtenerFavoritos() {
    const data = leerStorageJson('peruTurismo_favoritos', []);
    return Array.isArray(data) ? data : [];
}

export function guardarFavoritos(favoritos) {
    guardarStorageJson('peruTurismo_favoritos', favoritos);
}

export function toggleFavorito(id) {
    let favoritos = obtenerFavoritos();
    const idx = favoritos.indexOf(id);
    if (idx === -1) {
        favoritos.push(id);
    } else {
        favoritos.splice(idx, 1);
    }
    guardarFavoritos(favoritos);
    return favoritos;
}

export function esFavorito(id) {
    return obtenerFavoritos().includes(id);
}

// ===== PUNTOS Y NIVELES =====

export function calcularPuntos() {
    const visitas = obtenerVisitas();
    const presenciales = obtenerVisitasPresenciales();
    let puntos = 0;
    visitas.forEach(id => {
        const lugar = getLugarPorId(id);
        if (!lugar) return;
        puntos += 10;
        if (lugar.esJoyaOculta) puntos += 20;
        if (presenciales.includes(id)) puntos += 15;
    });
    return puntos;
}

export function obtenerNivel(puntos) {
    if (puntos >= 500) return { nombre: 'Embajador del Perú', icono: '👑' };
    if (puntos >= 300) return { nombre: 'Aventurero', icono: '🏆' };
    if (puntos >= 150) return { nombre: 'Explorador', icono: '🌟' };
    if (puntos >= 50) return { nombre: 'Caminante', icono: '🥾' };
    return { nombre: 'Recién llegado', icono: '🎒' };
}

export function puntosPorCheckIn(lugar, presencial) {
    let pts = 10;
    if (lugar && lugar.esJoyaOculta) pts += 20;
    if (presencial) pts += 15;
    return pts;
}

// ===== CARGAR DATOS =====

export async function cargarLugares() {
    try {
        if (window.location.protocol === 'file:') {
            throw new Error('La app necesita ejecutarse desde un servidor local, no desde file://');
        }
        const [resp, extraResp, limaResp, ancashResp] = await Promise.all([
            fetch('lugares.json'),
            fetch('lugares-extra.json'),
            fetch('lugares-lima.json'),
            fetch('lugares-ancash.json')
        ]);
        if (!resp.ok) throw new Error('No se pudo cargar lugares.json');
        const base = await resp.json();
        if (!Array.isArray(base)) throw new Error('lugares.json no contiene una lista válida');
        if (!extraResp.ok) throw new Error('No se pudo cargar lugares-extra.json');
        if (!limaResp.ok) throw new Error('No se pudo cargar lugares-lima.json');
        if (!ancashResp.ok) throw new Error('No se pudo cargar lugares-ancash.json');
        const extra = await extraResp.json();
        const lima = await limaResp.json();
        const ancash = await ancashResp.json();
        if (!Array.isArray(extra) || !Array.isArray(lima) || !Array.isArray(ancash)) {
            throw new Error('Uno de los catálogos turísticos no contiene una lista válida');
        }
        const listaLugares = consolidarCatalogo([...base, ...extra, ...lima, ...ancash]);
        assertCatalogoValido(listaLugares);
        setLugares(listaLugares);
        return listaLugares;
    } catch (error) {
        console.error('Error cargando lugares:', error);
        const mensaje = error instanceof Error ? error.message : 'Error desconocido';
        const estado = document.getElementById('estado-carga');
        if (estado) {
            estado.textContent = `No se pudo cargar el catálogo turístico (${mensaje}). Revisa tu conexión o abre la app desde un servidor local.`;
            estado.classList.remove('hidden');
        }
        return [];
    }
}

export async function cargarRutas() {
    try {
        const resp = await fetch('rutas.json');
        if (!resp.ok) throw new Error('No se pudo cargar rutas.json');
        const listaRutas = await resp.json();
        setRutas(listaRutas);
        return listaRutas;
    } catch (error) {
        console.error('Error cargando rutas:', error);
        const estado = document.getElementById('estado-carga');
        if (estado) {
            estado.textContent = 'No se pudieron cargar las rutas temáticas. Puedes explorar el catálogo de lugares mientras se recupera la conexión.';
            estado.classList.remove('hidden');
        }
        setRutas([]);
        return [];
    }
}

function generarRutasPorDefecto() {
    return [
        {
            id: 1,
            nombre: '🏛️ Ruta Colonial',
            descripcion: 'Descubre el corazón histórico de Lima',
            lugares_ids: [1, 2, 3, 50]
        },
        {
            id: 2,
            nombre: '🌊 Ruta del Pacífico',
            descripcion: 'Los mejores atardeceres y playas de Lima',
            lugares_ids: [5, 6, 8, 52]
        },
        {
            id: 3,
            nombre: '🗿 Ruta Arqueológica',
            descripcion: 'Las huellas de las culturas preincaicas',
            lugares_ids: [7, 11, 36]
        },
        {
            id: 4,
            nombre: '🍽️ Ruta Gastronómica',
            descripcion: 'Sabores auténticos del Perú',
            lugares_ids: [10, 23, 24, 53]
        }
    ];
}
