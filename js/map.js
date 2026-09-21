/**
 * Módulo de Inicialización y Control del Mapa (Leaflet)
 */

import {
    getState,
    TESELAS,
    coloresRutas,
    obtenerVisitas,
    obtenerFavoritos,
    esPresencial,
    esFavorito,
    RADIO_PRESENCIAL,
    getLugarPorId
} from './state.js';
import { escaparHtml } from './utils/sanitize.js';
import { distanciaAlLugar, obtenerUbicacion } from './geo.js';
import { formatearDistancia } from './utils/geoUtils.js';

export const coloresCategoria = {
    'Arqueológico': '#d4a574',
    'Historia': '#b8a0c0',
    'Naturaleza': '#82c4a0',
    'Cultura': '#e8b4b4',
    'Gastronomía': '#f5d78c',
    'Museo': '#8fc1d4',
    'Parque': '#8fc9a8'
};

export const iconosCategoria = {
    'Arqueológico': '🏛️',
    'Historia': '📜',
    'Naturaleza': '🌿',
    'Cultura': '🎨',
    'Gastronomía': '🍜',
    'Museo': '🏛️',
    'Parque': '🌳'
};

export function getColorCategoria(categoria) {
    return coloresCategoria[categoria] || '#bdc3c7';
}

export function getIconoCategoria(categoria) {
    return iconosCategoria[categoria] || '📍';
}

export function inicializarMapa() {
    const state = getState();
    const limitesPeru = L.latLngBounds([-18.6, -81.6], [-0.04, -68.5]);

    state.mapa = L.map('mapa', {
        center: [-9.5, -75.2],
        zoom: 5.4,
        minZoom: 5.4,
        maxZoom: 18,
        maxBounds: limitesPeru,
        maxBoundsViscosity: 1,
        zoomControl: true,
        fadeAnimation: true,
        zoomAnimation: true
    });

    const temaInicial = localStorage.getItem('peruTurismo_tema') === 'oscuro' ? 'oscuro' : 'claro';
    state.capaTeselas = L.tileLayer(TESELAS[temaInicial], {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        minZoom: 5,
        maxZoom: 19
    }).addTo(state.mapa);
    state.temaTeselasAplicado = temaInicial;

    setTimeout(() => {
        if (state.mapa) state.mapa.invalidateSize();
    }, 150);
    setTimeout(() => {
        if (state.mapa) state.mapa.invalidateSize();
    }, 500);

    window.addEventListener('resize', () => {
        if (state.mapa) state.mapa.invalidateSize();
    });

    agregarBotonUbicacion();
    configurarBannerRuta();
}

export function agregarBotonUbicacion() {
    const mapaWrapper = document.querySelector('.mapa-wrapper');
    if (!mapaWrapper || document.getElementById('btn-ubicacion')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-ubicacion';
    btn.className = 'btn-ubicacion';
    btn.innerHTML = '<span aria-hidden="true">📍</span><i class="fas fa-location-dot" aria-hidden="true"></i><span class="sr-only">Activar detección de lugares cercanos</span>';
    btn.title = 'Activar detección de lugares cercanos';
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', () => obtenerUbicacion());
    mapaWrapper.appendChild(btn);
}

export function configurarBannerRuta(onOcultarRuta) {
    const btnCentrar = document.getElementById('btn-centrar-ruta');
    const btnOcultar = document.getElementById('btn-ocultar-ruta');

    if (btnCentrar) {
        btnCentrar.addEventListener('click', () => {
            const state = getState();
            if (state.rutaVisibleId && state.mapa) {
                const ruta = state.rutas.find(r => r.id === state.rutaVisibleId);
                if (ruta) {
                    const puntos = ruta.lugares_ids
                        .map(id => getLugarPorId(id))
                        .filter(Boolean)
                        .map(l => [l.lat, l.lng]);
                    if (puntos.length > 0) {
                        state.mapa.flyToBounds(L.latLngBounds(puntos).pad(0.25), { duration: 1 });
                    }
                }
            }
        });
    }

    if (btnOcultar) {
        btnOcultar.addEventListener('click', () => {
            ocultarRutaEnMapa();
            if (onOcultarRuta) onOcultarRuta();
        });
    }
}

export function crearIcono(categoria, visitado = false, favorito = false) {
    let color = getColorCategoria(categoria);
    let iconoTexto = getIconoCategoria(categoria);
    if (favorito) iconoTexto = '⭐';
    if (visitado) {
        color = '#27ae60';
        iconoTexto = '✓';
    }

    return L.divIcon({
        html: `
            <div class="pin-marcador ${visitado ? 'visitado' : ''} ${favorito ? 'favorito' : ''}" style="--pin-color: ${color};">
                <span class="pin-icono">${iconoTexto}</span>
            </div>
        `,
        className: 'marcador-pin-wrapper',
        iconSize: [32, 40],
        iconAnchor: [16, 38],
        popupAnchor: [0, -38]
    });
}

export function generarPopupLugar(lugar, visitado) {
    const presencial = esPresencial(lugar.id);
    const dist = distanciaAlLugar(lugar);
    const cerca = dist !== null && dist <= RADIO_PRESENCIAL;
    const favorito = esFavorito(lugar.id);

    return `
        <div class="popup-lugar-header">
            <h3>${escaparHtml(lugar.nombre)}</h3>
            ${lugar.esJoyaOculta ? '<span class="badge-joya-mini"><i class="fas fa-gem"></i> Joya Oculta</span>' : ''}
            ${presencial ? '<span class="badge-presencial">In situ</span>' : ''}
        </div>
        <p style="margin: 4px 0 6px;">${escaparHtml(lugar.descripcion)}</p>
        <div style="font-size:0.75rem;color:var(--text-muted, #7f8c8d);margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;">
            <span><i class="fas fa-tag"></i> ${escaparHtml(lugar.categoria || 'Lugar')}</span>
            ${lugar.region ? `<span>· <i class="fas fa-map-marker-alt"></i> ${escaparHtml(lugar.region)}</span>` : ''}
            ${lugar.precio ? `<span>· 💰 ${escaparHtml(lugar.precio)}</span>` : ''}
        </div>
        ${dist !== null ? `<div style="font-size:0.72rem;color:var(--primary, #c0392b);margin-bottom:8px;font-weight:600;"><i class="fas fa-location-arrow"></i> A ${formatearDistancia(dist)}${cerca ? ' (puedes registrar in situ)' : ''}</div>` : ''}
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;">
            <button onclick="window.hacerCheckIn(${lugar.id})"
                    class="btn-checkin ${visitado ? 'completado' : ''}">
                ${visitado ? '<i class="fas fa-check"></i> Visitado' : (cerca ? '🎯 Capturar' : '📍 Check-in')}
            </button>
            <button onclick="window.manejarFavorito(${lugar.id});"
                    class="btn-favorito ${favorito ? 'activo' : ''}"
                    title="${favorito ? 'Quitar favorito' : 'Favorito'}"
                    aria-label="${favorito ? 'Quitar favorito' : 'Añadir a favoritos'}">
                <span aria-hidden="true">⭐</span><i class="fas fa-star" aria-hidden="true"></i>
            </button>
            <button onclick="window.abrirModalLugar(${lugar.id})"
                    class="btn-ver-ruta" style="padding:5px 10px;font-size:0.72rem;">
                <i class="fas fa-info-circle"></i> Detalle
            </button>
        </div>
    `;
}

export function agregarMarcadores() {
    const state = getState();
    Object.values(state.marcadores).forEach(m => state.mapa.removeLayer(m));
    state.marcadores = {};

    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();

    state.lugares.forEach(lugar => {
        const visitado = visitas.includes(lugar.id);
        const favorito = favoritos.includes(lugar.id);
        const icono = crearIcono(lugar.categoria, visitado, favorito);

        const marker = L.marker([lugar.lat, lugar.lng], { icon: icono })
            .addTo(state.mapa)
            .bindPopup(generarPopupLugar(lugar, visitado), { maxWidth: 300, offset: [0, -10] });

        state.marcadores[lugar.id] = marker;
    });

    if (state.lugares.length > 0 && !agregarMarcadores._vistaInicial) {
        agregarMarcadores._vistaInicial = true;
        setTimeout(() => {
            if (state.mapa) {
                state.mapa.invalidateSize();
                const grupo = L.featureGroup(Object.values(state.marcadores));
                state.mapa.fitBounds(grupo.getBounds(), { padding: [40, 40], maxZoom: 14 });
            }
        }, 180);
    }
}

export function actualizarOpacidadMarcadores(lugaresVisibles) {
    const state = getState();
    const idsVisibles = new Set(lugaresVisibles.map(l => l.id));
    const hayFiltro = state.filtroActual !== 'todos' ||
        state.filtroExplorador !== 'todos' ||
        state.filtroRegion !== 'todas' ||
        state.filtroRapido !== 'todos' ||
        state.filtroBusqueda.trim() !== '';

    state.lugares.forEach(lugar => {
        const marker = state.marcadores[lugar.id];
        if (!marker) return;
        const elemento = marker.getElement();
        if (!elemento) return;
        if (hayFiltro && !idsVisibles.has(lugar.id)) {
            elemento.style.opacity = '0.15';
            elemento.style.filter = 'grayscale(80%)';
            elemento.style.pointerEvents = 'none';
        } else {
            elemento.style.opacity = '1';
            elemento.style.filter = 'none';
            elemento.style.pointerEvents = 'auto';
        }
    });
}

export function irAlLugar(id) {
    const state = getState();
    const lugar = getLugarPorId(id);
    if (!lugar || !state.marcadores[id]) return;

    const tabLugares = document.querySelector('[data-tab="lugares"]');
    if (tabLugares) tabLugares.click();

    if (window.innerWidth <= 860) {
        const mapaWrapper = document.querySelector('.mapa-wrapper');
        if (mapaWrapper) {
            mapaWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    state.mapa.flyTo([lugar.lat, lugar.lng], 15, { duration: 1.2 });
    setTimeout(() => {
        if (state.marcadores[id]) state.marcadores[id].openPopup();
    }, 1300);
}

export function mostrarRutaEnMapa(rutaId, callbacks = {}) {
    const state = getState();
    if (state.rutaVisibleId === rutaId) {
        ocultarRutaEnMapa();
        if (callbacks.actualizarRutas) callbacks.actualizarRutas();
        return;
    }

    ocultarRutaEnMapa();

    const ruta = state.rutas.find(r => r.id === rutaId);
    if (!ruta) return;

    const index = state.rutas.indexOf(ruta);
    const color = coloresRutas[index % coloresRutas.length];
    const puntos = [];
    const marcadoresRuta = [];
    const visitas = obtenerVisitas();

    ruta.lugares_ids.forEach((id, i) => {
        const lugar = getLugarPorId(id);
        if (!lugar) return;
        puntos.push([lugar.lat, lugar.lng]);

        const visitado = visitas.includes(id);
        const numeroIcono = L.divIcon({
            html: `<div class="pin-ruta-waypoint ${visitado ? 'visitado' : ''}" style="--ruta-color: ${color};">
                      ${visitado ? '✓' : (i + 1)}
                   </div>`,
            className: 'marcador-pin-wrapper',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -13]
        });
        const marcador = L.marker([lugar.lat, lugar.lng], { icon: numeroIcono });
        marcador.bindPopup(generarPopupLugar(lugar, visitado));
        marcadoresRuta.push(marcador);
    });

    if (puntos.length === 0) return;

    const polyline = L.polyline(puntos, {
        color: color,
        weight: 5,
        opacity: 0.85,
        dashArray: '10, 10',
        lineCap: 'round'
    });

    state.capaRutaActual = L.layerGroup([polyline, ...marcadoresRuta]).addTo(state.mapa);
    state.rutaVisibleId = rutaId;

    const banner = document.getElementById('banner-ruta-activa');
    const bannerTitulo = document.getElementById('banner-ruta-nombre');
    const bannerProgreso = document.getElementById('banner-ruta-progreso');

    if (banner && bannerTitulo && bannerProgreso) {
        const total = ruta.lugares_ids.length;
        const completados = ruta.lugares_ids.filter(id => visitas.includes(id)).length;
        bannerTitulo.textContent = ruta.nombre;
        bannerProgreso.textContent = `${completados}/${total} lugares visitados (${Math.round((completados/total)*100)}%)`;
        banner.classList.remove('hidden');
    }

    state.mapa.flyToBounds(polyline.getBounds().pad(0.25), { duration: 1.2 });

    if (callbacks.actualizarRutas) callbacks.actualizarRutas();
    if (callbacks.mostrarToast) callbacks.mostrarToast(`🗺️ Mostrando ${ruta.nombre}`);
}

export function ocultarRutaEnMapa() {
    const state = getState();
    if (state.capaRutaActual && state.mapa) {
        state.mapa.removeLayer(state.capaRutaActual);
        state.capaRutaActual = null;
    }
    state.rutaVisibleId = null;

    const banner = document.getElementById('banner-ruta-activa');
    if (banner) banner.classList.add('hidden');
}
