/**
 * Módulo de Geolocalización y Radar de Cercanía
 */

import {
    getState,
    RADIO_AUTO_CHECKIN,
    RADIO_PRESENCIAL,
    RADIO_RADAR,
    INTERVALO_NOTIFICACION_CERCANIA,
    obtenerVisitas,
    guardarVisitas,
    registrarFechaVisita,
    marcarVisitaPresencial,
    estaVisitado,
    puntosPorCheckIn,
    getLugarPorId
} from './state.js';
import { calcularDistancia, formatearDistancia } from './utils/geoUtils.js';

export function distanciaAlLugar(lugar) {
    const { ubicacionUsuario } = getState();
    if (!ubicacionUsuario || !lugar) return null;
    return calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, lugar.lat, lugar.lng);
}

export function obtenerUbicacion(callbacks = {}) {
    const state = getState();
    const btn = document.getElementById('btn-ubicacion');

    if (state.watchIdUbicacion !== null) {
        detenerSeguimientoUbicacion();
        if (btn) {
            btn.innerHTML = '<span aria-hidden="true">📍</span><i class="fas fa-location-dot" aria-hidden="true"></i><span class="sr-only">Activar detección de lugares cercanos</span>';
            btn.classList.remove('activo');
            btn.title = 'Activar detección de lugares cercanos';
        }
        callbacks.mostrarToast?.('⏸️ Detección de lugares pausada');
        return;
    }

    if (state.ubicacionUsuario && state.mapa) {
        state.mapa.flyTo([state.ubicacionUsuario.lat, state.ubicacionUsuario.lng], Math.max(state.mapa.getZoom(), 15), { duration: 0.8 });
        if (state.marcadorUbicacion) state.marcadorUbicacion.openPopup();
        iniciarSeguimientoUbicacion(callbacks);
        return;
    }

    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }

    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => manejarNuevaUbicacion(pos, true, callbacks),
        (err) => {
            console.error('Error de geolocalización:', err);
            if (btn) {
                btn.innerHTML = '<span aria-hidden="true">📍</span><i class="fas fa-location-dot" aria-hidden="true"></i><span class="sr-only">Activar detección de lugares cercanos</span>';
                btn.disabled = false;
            }
            alert('⚠️ No se pudo obtener tu ubicación.\nAsegúrate de permitir el acceso a la ubicación.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
}

export function solicitarPermisoNotificaciones() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    Notification.requestPermission().catch(error => {
        console.warn('No se pudo solicitar permiso de notificaciones:', error);
    });
}

export function iniciarSeguimientoUbicacion(callbacks = {}) {
    const state = getState();
    if (state.watchIdUbicacion !== null || !navigator.geolocation) return;
    state.watchIdUbicacion = navigator.geolocation.watchPosition(
        pos => manejarNuevaUbicacion(pos, false, callbacks),
        error => console.warn('Seguimiento de ubicación pausado:', error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
}

export function detenerSeguimientoUbicacion() {
    const state = getState();
    if (state.watchIdUbicacion !== null) {
        navigator.geolocation.clearWatch(state.watchIdUbicacion);
        state.watchIdUbicacion = null;
    }
}

export function manejarNuevaUbicacion(posicion, centrarMapa, callbacks = {}) {
    const state = getState();
    const lat = posicion.coords.latitude;
    const lng = posicion.coords.longitude;

    // Limites de Perú
    const limitesPeru = L.latLngBounds([-18.6, -81.6], [-0.04, -68.5]);

    if (!limitesPeru.contains([lat, lng])) {
        state.ubicacionUsuario = null;
        detenerSeguimientoUbicacion();
        if (callbacks.mostrarToast) callbacks.mostrarToast('📍 Tu ubicación está fuera de Perú.');
        return;
    }

    state.ubicacionUsuario = {
        lat,
        lng,
        precision: Math.round(posicion.coords.accuracy || 0),
        velocidad: Number.isFinite(posicion.coords.speed) ? posicion.coords.speed : null,
        actualizado: Date.now()
    };

    const btn = document.getElementById('btn-ubicacion');
    const icono = L.divIcon({
        html: `<div class="pin-usuario-gps"></div>`,
        className: 'marcador-pin-wrapper',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
    });

    if (!state.marcadorUbicacion) {
        state.marcadorUbicacion = L.marker([lat, lng], { icon: icono })
            .addTo(state.mapa)
            .bindPopup('📍 Estás aquí');
    } else {
        state.marcadorUbicacion.setLatLng([lat, lng]);
        state.marcadorUbicacion.setIcon(icono);
    }

    if (!state.circuloUbicacion) {
        state.circuloUbicacion = L.circle([lat, lng], {
            radius: Math.max(state.ubicacionUsuario.precision, 18),
            color: '#f4b942',
            fillColor: '#f4b942',
            fillOpacity: 0.12,
            weight: 1
        }).addTo(state.mapa);
    } else {
        state.circuloUbicacion.setLatLng([lat, lng]);
        state.circuloUbicacion.setRadius(Math.max(state.ubicacionUsuario.precision, 18));
    }

    if (centrarMapa || !state.ultimaActualizacionUbicacion) {
        state.mapa.setView([lat, lng], Math.max(state.mapa.getZoom(), 15), { animate: true });
    }

    state.ultimaActualizacionUbicacion = Date.now();
    if (btn) {
        btn.innerHTML = '<span aria-hidden="true">🎯</span><i class="fas fa-location-crosshairs" aria-hidden="true"></i><span class="sr-only">Pausar detección de lugares cercanos</span>';
        btn.disabled = false;
        btn.classList.add('activo');
        btn.title = 'Detección activa. Pulsa para pausar';
    }

    const opcionCercania = document.getElementById('opcion-cercania');
    if (opcionCercania) {
        opcionCercania.disabled = false;
        opcionCercania.style.opacity = '1';
    }

    verificarCercania(lat, lng, RADIO_AUTO_CHECKIN, callbacks);

    if (callbacks.onUbicacionActualizada) {
        callbacks.onUbicacionActualizada();
    }

    iniciarSeguimientoUbicacion(callbacks);
}

export function verificarCercania(lat, lng, radio = RADIO_AUTO_CHECKIN, callbacks = {}) {
    const state = getState();
    let visitas = obtenerVisitas();
    let nuevos = 0;
    let puntosGanados = 0;

    state.lugares.forEach(lugar => {
        if (visitas.includes(lugar.id)) return;

        const distancia = calcularDistancia(lat, lng, lugar.lat, lugar.lng);
        if (distancia <= radio) {
            visitas.push(lugar.id);
            registrarFechaVisita(lugar.id);
            marcarVisitaPresencial(lugar.id);
            puntosGanados += puntosPorCheckIn(lugar, true);
            nuevos++;
        }
    });

    if (nuevos > 0) {
        guardarVisitas(visitas);
        if (callbacks.onNuevasVisitasAutocheckin) {
            callbacks.onNuevasVisitasAutocheckin();
        }

        const mensaje = nuevos === 1 ?
            '🎯 ¡Lugar capturado in situ!' :
            `🎯 ¡Has llegado a ${nuevos} lugares!`;
        if (callbacks.mostrarToast) {
            callbacks.mostrarToast(`${mensaje} +${puntosGanados} pts`);
        }
    }

    notificarLugaresCercanos(lat, lng, callbacks);
}

export function obtenerLugaresCercanos() {
    const state = getState();
    if (!state.ubicacionUsuario || !state.lugares.length) return [];
    return state.lugares
        .map(lugar => ({ lugar, distancia: distanciaAlLugar(lugar) }))
        .filter(item => item.distancia !== null && item.distancia <= RADIO_RADAR)
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, 3);
}

export function notificarLugaresCercanos(lat, lng, callbacks = {}) {
    const state = getState();
    const candidato = state.lugares
        .map(lugar => ({ lugar, distancia: calcularDistancia(lat, lng, lugar.lat, lugar.lng) }))
        .filter(item => item.distancia <= RADIO_PRESENCIAL && !estaVisitado(item.lugar.id))
        .sort((a, b) => a.distancia - b.distancia)[0];

    if (!candidato) return;
    const id = candidato.lugar.id;
    const ahora = Date.now();
    if (state.ultimaNotificacionCercania[id] && ahora - state.ultimaNotificacionCercania[id] < INTERVALO_NOTIFICACION_CERCANIA) return;
    state.ultimaNotificacionCercania[id] = ahora;

    const mensaje = `🎯 ${candidato.lugar.nombre} está a ${formatearDistancia(candidato.distancia)}. ¡Puedes capturarlo!`;
    if (callbacks.mostrarToast) {
        callbacks.mostrarToast(mensaje, 'radar');
    }

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('PerúTurismo GO', {
            body: mensaje,
            tag: `lugar-${id}`,
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/svgs/solid/map-location-dot.svg'
        });
    }
}
