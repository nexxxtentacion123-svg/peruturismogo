/**
 * Módulo de Filtros, Búsqueda y Ordenación con Debounce
 */

import { getState, obtenerVisitas, esFavorito, estaVisitado } from './state.js';
import { calcularDistancia } from './utils/geoUtils.js';

export function getCategorias() {
    const { lugares } = getState();
    const cats = new Set();
    lugares.forEach(l => { if (l.categoria) cats.add(l.categoria); });
    return Array.from(cats).sort();
}

export function generarFiltros(onAplicarFiltro) {
    const container = document.getElementById('filtros');
    if (!container) return;

    const categorias = getCategorias();
    let html = `<button class="filtro-btn activo" data-filtro="todos">Todos</button>`;
    categorias.forEach(cat => {
        html += `<button class="filtro-btn" data-filtro="${cat}">${cat}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
            this.classList.add('activo');
            const state = getState();
            state.filtroActual = this.dataset.filtro;
            if (onAplicarFiltro) onAplicarFiltro();
        });
    });
}

export function getRegiones() {
    const { lugares } = getState();
    const regiones = new Set();
    lugares.forEach(l => { if (l.region) regiones.add(l.region); });
    return Array.from(regiones).sort();
}

export function generarFiltroRegion(onAplicarFiltro) {
    const select = document.getElementById('filtro-region');
    if (!select) return;

    const regiones = getRegiones();
    regiones.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = `🗺️ ${region}`;
        select.appendChild(option);
    });

    select.addEventListener('change', function() {
        const state = getState();
        state.filtroRegion = this.value;
        if (onAplicarFiltro) onAplicarFiltro();
    });
}

export function getTiposExplorador() {
    const { lugares } = getState();
    const tipos = new Set();
    lugares.forEach(l => {
        if (l.tiposExplorador && Array.isArray(l.tiposExplorador)) {
            l.tiposExplorador.forEach(t => tipos.add(t));
        }
    });
    return Array.from(tipos).sort();
}

export function generarFiltrosExplorador(onAplicarFiltro) {
    const container = document.getElementById('filtros-tipo');
    if (!container) return;

    const tipos = getTiposExplorador();
    const iconos = {
        'Cultural': '📜',
        'Naturaleza': '🌿',
        'Urbano': '🏙️',
        'Gastronómico': '🍜',
        'Aventura': '⛰️'
    };

    let html = `<button class="filtro-tipo-btn activo" data-tipo="todos">🌍 Todos</button>`;
    tipos.forEach(tipo => {
        const icono = iconos[tipo] || '📍';
        html += `<button class="filtro-tipo-btn" data-tipo="${tipo}">${icono} ${tipo}</button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.filtro-tipo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.filtro-tipo-btn').forEach(b => b.classList.remove('activo'));
            this.classList.add('activo');
            const state = getState();
            state.filtroExplorador = this.dataset.tipo;
            if (onAplicarFiltro) onAplicarFiltro();
        });
    });
}

export function configurarFiltrosRapidos(onAplicarFiltro) {
    const container = document.getElementById('filtros-rapidos');
    if (!container) return;

    container.querySelectorAll('.filtro-rapido-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.filtro-rapido-btn').forEach(b => b.classList.remove('activo'));
            this.classList.add('activo');
            const state = getState();
            state.filtroRapido = this.dataset.rapido;
            if (onAplicarFiltro) onAplicarFiltro();
        });
    });
}

/**
 * Función debounce para retrasar ejecuciones consecutivas (útil en inputs de búsqueda).
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function configurarBuscador(onAplicarFiltro) {
    const input = document.getElementById('buscador-input');
    const limpiarBtn = document.getElementById('buscador-limpiar');

    if (!input) return;

    const debouncedApply = debounce(() => {
        if (onAplicarFiltro) onAplicarFiltro();
    }, 250);

    input.addEventListener('input', function() {
        const state = getState();
        state.filtroBusqueda = this.value;
        limpiarBtn.style.display = this.value.length > 0 ? 'block' : 'none';
        debouncedApply();
    });

    limpiarBtn.addEventListener('click', function() {
        input.value = '';
        const state = getState();
        state.filtroBusqueda = '';
        this.style.display = 'none';
        if (onAplicarFiltro) onAplicarFiltro();
        input.focus();
    });

    // Atajo: tecla / para enfocar el buscador
    document.addEventListener('keydown', function(e) {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        input.focus();
        input.select();
    });
}

export function configurarOrdenar(onAplicarFiltro, mostrarToast) {
    const select = document.getElementById('ordenar-select');
    if (!select) return;

    const state = getState();
    const opcionCercania = document.getElementById('opcion-cercania');
    if (opcionCercania) {
        opcionCercania.disabled = !state.ubicacionUsuario;
        opcionCercania.style.opacity = state.ubicacionUsuario ? '1' : '0.5';
    }

    select.addEventListener('change', function() {
        state.ordenActual = this.value;
        if (state.ordenActual === 'cercania' && !state.ubicacionUsuario && mostrarToast) {
            mostrarToast('📍 Activa tu ubicación para ordenar por cercanía');
        }
        if (onAplicarFiltro) onAplicarFiltro();
    });
}

export function configurarBuscadorRutas(onActualizarRutas) {
    const input = document.getElementById('buscador-rutas-input');
    const btnLimpiar = document.getElementById('buscador-rutas-limpiar');
    const filtrosContainer = document.getElementById('filtros-rutas');

    const debouncedRutas = debounce(() => {
        if (onActualizarRutas) onActualizarRutas();
    }, 250);

    if (input) {
        input.addEventListener('input', (e) => {
            const state = getState();
            state.filtroRutaTexto = e.target.value.trim().toLowerCase();
            if (btnLimpiar) btnLimpiar.style.display = state.filtroRutaTexto ? 'block' : 'none';
            debouncedRutas();
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (input) input.value = '';
            const state = getState();
            state.filtroRutaTexto = '';
            btnLimpiar.style.display = 'none';
            if (onActualizarRutas) onActualizarRutas();
        });
    }

    if (filtrosContainer) {
        filtrosContainer.querySelectorAll('.filtro-ruta-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                filtrosContainer.querySelectorAll('.filtro-ruta-btn').forEach(b => b.classList.remove('activo'));
                this.classList.add('activo');
                const state = getState();
                state.filtroRutaDificultad = this.dataset.filtroRuta;
                if (onActualizarRutas) onActualizarRutas();
            });
        });
    }
}

export function filtrarLugares() {
    const state = getState();
    let resultado = [...state.lugares];

    if (state.filtroRapido === 'joyas') {
        resultado = resultado.filter(l => l.esJoyaOculta);
    } else if (state.filtroRapido === 'favoritos') {
        resultado = resultado.filter(l => esFavorito(l.id));
    } else if (state.filtroRapido === 'visitados') {
        resultado = resultado.filter(l => estaVisitado(l.id));
    } else if (state.filtroRapido === 'pendientes') {
        resultado = resultado.filter(l => !estaVisitado(l.id));
    }

    if (state.filtroActual !== 'todos') {
        resultado = resultado.filter(l => l.categoria === state.filtroActual);
    }

    if (state.filtroExplorador !== 'todos') {
        resultado = resultado.filter(l =>
            l.tiposExplorador && l.tiposExplorador.includes(state.filtroExplorador)
        );
    }

    if (state.filtroRegion !== 'todas') {
        resultado = resultado.filter(l => l.region === state.filtroRegion);
    }

    if (state.filtroBusqueda.trim() !== '') {
        const busqueda = state.filtroBusqueda.toLowerCase().trim();
        resultado = resultado.filter(l =>
            l.nombre.toLowerCase().includes(busqueda) ||
            (l.descripcion || '').toLowerCase().includes(busqueda) ||
            (l.region || '').toLowerCase().includes(busqueda) ||
            (l.categoria || '').toLowerCase().includes(busqueda) ||
            (l.tipLocal || '').toLowerCase().includes(busqueda) ||
            (l.etiquetas || []).some(e => e.toLowerCase().includes(busqueda))
        );
    }

    return resultado;
}

export function ordenarLugares(lista) {
    const state = getState();
    const visitas = obtenerVisitas();

    switch (state.ordenActual) {
        case 'nombre':
            return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));

        case 'nombre-desc':
            return [...lista].sort((a, b) => b.nombre.localeCompare(a.nombre));

        case 'categoria':
            return [...lista].sort((a, b) => a.categoria.localeCompare(b.categoria));

        case 'visitados':
            return [...lista].sort((a, b) => {
                const va = visitas.includes(a.id) ? 1 : 0;
                const vb = visitas.includes(b.id) ? 1 : 0;
                return vb - va;
            });

        case 'no-visitados':
            return [...lista].sort((a, b) => {
                const va = visitas.includes(a.id) ? 1 : 0;
                const vb = visitas.includes(b.id) ? 1 : 0;
                return va - vb;
            });

        case 'cercania':
            if (!state.ubicacionUsuario) {
                return lista;
            }
            return [...lista].sort((a, b) => {
                const da = calcularDistancia(state.ubicacionUsuario.lat, state.ubicacionUsuario.lng, a.lat, a.lng);
                const db = calcularDistancia(state.ubicacionUsuario.lat, state.ubicacionUsuario.lng, b.lat, b.lng);
                return da - db;
            });

        default:
            return lista;
    }
}
