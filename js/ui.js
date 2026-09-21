/**
 * Módulo de Renderizado de Interfaz de Usuario (UI) y Controladores Visuales
 */

import {
    getState,
    obtenerVisitas,
    toggleVisita,
    obtenerFavoritos,
    toggleFavorito,
    esFavorito,
    estaVisitado,
    obtenerFechasVisitas,
    obtenerVisitasPresenciales,
    marcarVisitaPresencial,
    esPresencial,
    calcularPuntos,
    obtenerNivel,
    puntosPorCheckIn,
    RADIO_PRESENCIAL,
    getLugarPorId,
    coloresRutas
} from './state.js';
import { escaparHtml } from './utils/sanitize.js';
import { calcularDistancia, formatearDistancia } from './utils/geoUtils.js';
import { obtenerLugaresCercanos, distanciaAlLugar } from './geo.js';
import {
    crearIcono,
    generarPopupLugar,
    getColorCategoria,
    getIconoCategoria,
    actualizarOpacidadMarcadores,
    irAlLugar,
    mostrarRutaEnMapa
} from './map.js';
import { filtrarLugares, ordenarLugares } from './filters.js';
import { actualizarLogros } from './gamification.js';

const KUNTUR_AVATAR = 'assets/kuntur-avatar.png';

function estadoVacioKuntur(titulo, mensaje) {
    return `<div class="vacio vacio-brand">
        <img class="vacio-brand-avatar" src="${KUNTUR_AVATAR}" alt="Kuntur, el Cóndor Explorador">
        <strong>${titulo}</strong>
        <span>${mensaje}</span>
    </div>`;
}

export function mostrarToast(mensaje, tipo = 'normal') {
    const toastAnterior = document.querySelector('.toast');
    if (toastAnterior) toastAnterior.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<i class="fas ${tipo === 'radar' ? 'fa-location-crosshairs' : 'fa-check-circle'}"></i> ${escaparHtml(mensaje)}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 100);

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

export function hacerCheckIn(id) {
    const state = getState();
    const yaVisitado = estaVisitado(id);
    const lugar = getLugarPorId(id);
    const dist = distanciaAlLugar(lugar);
    const presencial = !yaVisitado && dist !== null && dist <= RADIO_PRESENCIAL;

    const visitas = toggleVisita(id);
    const visitado = visitas.includes(id);

    if (visitado && presencial) {
        marcarVisitaPresencial(id);
    }

    if (visitado) {
        const pts = puntosPorCheckIn(lugar, presencial);
        const extra = presencial ? ' · visita in situ' : '';
        const joya = lugar && lugar.esJoyaOculta ? ' 💎 Joya Oculta' : '';
        mostrarToast(`🎯 ¡${lugar ? lugar.nombre : 'Lugar'} descubierto! +${pts} pts${extra}${joya}`);
    } else {
        mostrarToast('Visita desmarcada');
    }

    const marker = state.marcadores[id];
    if (marker && lugar) {
        const favorito = esFavorito(id);
        marker.setIcon(crearIcono(lugar.categoria, visitado, favorito));
        marker.setPopupContent(generarPopupLugar(lugar, visitado));
    }

    if (state.mapa) state.mapa.closePopup();
    actualizarUI();
    actualizarRutas();

    const modal = document.getElementById('modal-lugar');
    if (modal && !modal.classList.contains('hidden') && modal.dataset.lugarId == id) {
        abrirModalLugar(id);
    }
}

export function manejarFavorito(id) {
    const state = getState();
    const favorito = toggleFavorito(id);
    if (favorito.includes(id)) {
        mostrarToast('⭐ Añadido a favoritos');
    } else {
        mostrarToast('💔 Quitado de favoritos');
    }

    const lugar = getLugarPorId(id);
    const visitado = estaVisitado(id);
    const marker = state.marcadores[id];
    if (marker && lugar) {
        marker.setIcon(crearIcono(lugar.categoria, visitado, esFavorito(id)));
    }
    actualizarUI();
}

export function actualizarRadarCercanos() {
    const state = getState();
    const panel = document.getElementById('panel-cercanos');
    const contenido = document.getElementById('cercanos-contenido');
    if (!panel || !contenido || !state.ubicacionUsuario) return;

    const cercanos = obtenerLugaresCercanos();
    panel.classList.remove('hidden');
    if (!cercanos.length) {
        contenido.innerHTML = '<span class="cercano-vacio">No hay lugares registrados en un radio de 5 km.</span>';
        return;
    }

    contenido.innerHTML = cercanos.map(({ lugar, distancia }, indice) => {
        const cerca = distancia <= RADIO_PRESENCIAL;
        return `
            <button type="button" class="cercano-item ${cerca ? 'cerca-ahora' : ''}" onclick="window.irAlLugar(${lugar.id})">
                <span class="cercano-numero">${indice + 1}</span>
                <span class="cercano-info">
                    <strong>${escaparHtml(lugar.nombre)}</strong>
                    <small>${cerca ? '🎯 ¡Puedes capturarlo!' : '📍 En tu zona de exploración'} · ${formatearDistancia(distancia)}</small>
                </span>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }).join('');
}

export function actualizarUI() {
    const state = getState();
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();

    const contadorVisitas = document.getElementById('contador-visitas');
    if (contadorVisitas) contadorVisitas.textContent = visitas.length;

    const totalLugares = document.getElementById('total-lugares');
    if (totalLugares) totalLugares.textContent = state.lugares.length;

    const contadorFavoritos = document.getElementById('contador-favoritos');
    if (contadorFavoritos) contadorFavoritos.textContent = favoritos.length;

    const puntos = calcularPuntos();
    const contadorPuntos = document.getElementById('contador-puntos');
    if (contadorPuntos) contadorPuntos.textContent = puntos;

    const nivelNombre = document.getElementById('nivel-nombre');
    if (nivelNombre) {
        const nivel = obtenerNivel(puntos);
        nivelNombre.textContent = `${nivel.icono} ${nivel.nombre}`;
    }

    const badgeRutas = document.getElementById('badge-rutas');
    if (badgeRutas && state.rutas) {
        badgeRutas.textContent = state.rutas.length;
    }

    const lugaresFiltrados = ordenarLugares(filtrarLugares());

    actualizarOpacidadMarcadores(lugaresFiltrados);

    const resultadosCount = document.getElementById('resultados-count');
    if (resultadosCount) resultadosCount.textContent = lugaresFiltrados.length;

    const totalDisponibles = document.getElementById('total-disponibles');
    if (totalDisponibles) totalDisponibles.textContent = state.lugares.length;

    const listaHtml = lugaresFiltrados.map(lugar => {
        const visitado = visitas.includes(lugar.id);
        const favorito = favoritos.includes(lugar.id);
        const badgeClass = lugar.categoria ? `badge-${lugar.categoria}` : 'badge-default';
        const categoriaLabel = lugar.categoria || 'Sin categoría';
        const colorFondo = getColorCategoria(lugar.categoria);
        const icono = getIconoCategoria(lugar.categoria);

        let etiquetasHtml = '';
        if (lugar.etiquetas && Array.isArray(lugar.etiquetas)) {
            etiquetasHtml = lugar.etiquetas.map(et =>
                `<span class="etiqueta ${lugar.esJoyaOculta ? 'joya' : ''}">${escaparHtml(et)}</span>`
            ).join('');
        }
        if (lugar.esJoyaOculta) {
            etiquetasHtml += `<span class="badge-joya-mini"><i class="fas fa-gem"></i> Joya Oculta</span>`;
        }

        let tipHtml = '';
        if (lugar.tipLocal) {
            tipHtml = `<div class="tip-local"><i class="fas fa-lightbulb"></i> ${escaparHtml(lugar.tipLocal)}</div>`;
        }

        let distanciaHtml = '';
        if (state.ubicacionUsuario) {
            const d = calcularDistancia(state.ubicacionUsuario.lat, state.ubicacionUsuario.lng, lugar.lat, lugar.lng);
            distanciaHtml = `<span class="badge-distancia"><i class="fas fa-location-arrow"></i> ${formatearDistancia(d)}</span>`;
        }

        return `
            <article class="item-lugar ${visitado ? 'visitado-card' : ''}">
                <div class="contenido" onclick="window.abrirModalLugar(${lugar.id})">
                    <div class="placeholder-icono" style="background:${colorFondo};">
                        ${visitado ? '✅' : icono}
                    </div>
                    <div class="info">
                        <span class="nombre">
                            ${visitado ? '<span class="estado-icono estado-visitado" title="Lugar visitado" aria-label="Lugar visitado">✅</span>' : ''}
                            ${favorito ? '<span class="estado-icono estado-favorito" title="Lugar favorito" aria-label="Lugar favorito">⭐</span>' : ''}
                            ${escaparHtml(lugar.nombre)}
                            ${esPresencial(lugar.id) ? ' <span class="badge-presencial">In situ</span>' : ''}
                        </span>
                        <div class="meta">
                            <span class="region"><i class="fas fa-map-marker-alt"></i> ${escaparHtml(lugar.region || 'Perú')}</span>
                            <span class="badge-cat ${badgeClass}">${escaparHtml(categoriaLabel)}</span>
                            ${lugar.transportePublico ? `<span class="region"><i class="fas fa-bus"></i> ${escaparHtml(lugar.transportePublico)}</span>` : ''}
                            ${distanciaHtml}
                        </div>
                        ${etiquetasHtml ? `<div class="etiquetas-container">${etiquetasHtml}</div>` : ''}
                        ${tipHtml}
                    </div>
                </div>
                <div class="accion">
                    <button class="btn-favorito"
                            title="Ver en el mapa"
                            aria-label="Ver en el mapa"
                            onclick="event.stopPropagation(); window.irAlLugar(${lugar.id})">
                        <span aria-hidden="true">🗺️</span><i class="fas fa-map-location-dot" aria-hidden="true"></i>
                    </button>
                    <button class="btn-favorito ${favorito ? 'activo' : ''}"
                            title="${favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
                            aria-label="${favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
                            onclick="event.stopPropagation(); window.manejarFavorito(${lugar.id})">
                        <span aria-hidden="true">⭐</span><i class="fas fa-star" aria-hidden="true"></i>
                    </button>
                    <button class="btn-checkin ${visitado ? 'completado' : ''}"
                            aria-label="${visitado ? 'Marcar como no visitado' : 'Registrar visita'}"
                            onclick="event.stopPropagation(); window.hacerCheckIn(${lugar.id})">
                        ${visitado ? '<span aria-hidden="true">✅</span><i class="fas fa-check" aria-hidden="true"></i>' : '<span aria-hidden="true">📍</span><i class="fas fa-location-dot" aria-hidden="true"></i>'}
                        ${visitado ? 'Visitado' : 'Check-in'}
                    </button>
                </div>
            </article>
        `;
    }).join('');

    const listaContainer = document.getElementById('lista-lugares');
    if (listaContainer) {
        listaContainer.innerHTML = lugaresFiltrados.length === 0 ?
            `<div class="vacio">
                <i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
                No se encontraron lugares<br>
                <span style="font-size:0.8rem;color:#95a5a6;">Intenta con otra búsqueda o filtro</span>
            </div>` :
            listaHtml;
    }

    actualizarColecciones();
    actualizarProgreso();
    actualizarLogros();
    actualizarFavoritos();
    actualizarBotonCompartir();
}

export function actualizarColecciones() {
    const state = getState();
    const visitas = obtenerVisitas();
    const coleccionesDiv = document.getElementById('colecciones');
    const fechas = obtenerFechasVisitas();

    if (!coleccionesDiv) return;

    if (visitas.length === 0) {
        coleccionesDiv.innerHTML = estadoVacioKuntur(
            'Tu bitácora está lista para despegar',
            'Kuntur te espera en el mapa. Haz check-in en tu primer destino y empieza a escribir tu historia por el Perú.'
        );
        return;
    }

    const items = [...visitas].reverse().map(id => {
        const lugar = getLugarPorId(id);
        if (!lugar) return '';
        const fecha = fechas[id] ? new Date(fechas[id]).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const presencial = esPresencial(id);
        return `
            <div class="item-visita" onclick="window.abrirModalLugar(${lugar.id})">
                <span class="item-visita-nombre"><i class="fas fa-check-circle"></i> ${escaparHtml(lugar.nombre)}${presencial ? ' <span class="badge-presencial">In situ</span>' : ''}</span>
                <span class="item-visita-fecha">${fecha}</span>
                <button class="btn-ir-mapa" title="Ver en el mapa" onclick="event.stopPropagation(); window.irAlLugar(${lugar.id})">
                    <i class="fas fa-map-location-dot"></i>
                </button>
            </div>
        `;
    }).join('');

    coleccionesDiv.innerHTML = `
        <div style="margin-bottom:6px;font-weight:300;font-size:0.85rem;">
            <i class="fas fa-shoe-prints"></i> Has visitado <strong>${visitas.length}</strong> lugares:
        </div>
        <div class="lista-visitas">${items}</div>
    `;
}

export function actualizarProgreso() {
    const state = getState();
    const visitas = obtenerVisitas();
    const total = state.lugares.length;
    if (total === 0) return;
    const porcentaje = Math.round((visitas.length / total) * 100);

    const elemPorcentaje = document.getElementById('progreso-porcentaje');
    if (elemPorcentaje) elemPorcentaje.textContent = `${porcentaje}%`;

    const relleno = document.getElementById('progreso-relleno');
    if (relleno) {
        relleno.style.width = `${porcentaje}%`;
        relleno.style.background = porcentaje === 100 ?
            'linear-gradient(90deg,#f1c40f,#27ae60)' :
            'linear-gradient(90deg,#c0392b,#f1c40f)';
    }
}

export function actualizarFavoritos() {
    const favoritos = obtenerFavoritos();
    const seccion = document.getElementById('seccion-favoritos');
    const lista = document.getElementById('lista-favoritos');
    if (!seccion || !lista) return;

    if (favoritos.length === 0) {
        seccion.style.display = 'block';
        lista.innerHTML = estadoVacioKuntur(
            'Todavía no tienes favoritos',
            'Guarda las rutas y lugares que te hagan volar. Kuntur te ayudará a encontrarlos cuando estés listo para explorar.'
        );
        return;
    }

    seccion.style.display = 'block';
    lista.innerHTML = favoritos.map(id => {
        const lugar = getLugarPorId(id);
        if (!lugar) return '';
        const visitado = estaVisitado(id);
        return `
            <div class="item-visita" onclick="window.abrirModalLugar(${lugar.id})">
                <span class="item-visita-nombre">⭐ ${escaparHtml(lugar.nombre)}</span>
                <span class="item-visita-fecha">${visitado ? '✅ Visitado' : escaparHtml(lugar.region || 'Perú')}</span>
                <button class="btn-ir-mapa" title="Ver en el mapa" onclick="event.stopPropagation(); window.irAlLugar(${lugar.id})">
                    <i class="fas fa-map-location-dot"></i>
                </button>
                <button class="btn-ir-mapa btn-quitar-fav" title="Quitar de favoritos" onclick="event.stopPropagation(); window.manejarFavorito(${lugar.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

export function actualizarBotonCompartir() {
    const btnCompartir = document.getElementById('btn-compartir');
    if (!btnCompartir) return;
    const visitas = obtenerVisitas();
    if (visitas.length === 0) {
        btnCompartir.style.opacity = '0.5';
        btnCompartir.style.cursor = 'not-allowed';
        btnCompartir.title = 'Visita al menos un lugar para compartir';
    } else {
        btnCompartir.style.opacity = '1';
        btnCompartir.style.cursor = 'pointer';
        btnCompartir.title = 'Compartir mi progreso';
    }
}

export function calcularDistanciaRutaKm(ruta) {
    if (!ruta || !ruta.lugares_ids || ruta.lugares_ids.length < 2) return null;
    let totalMetros = 0;
    for (let i = 0; i < ruta.lugares_ids.length - 1; i++) {
        const l1 = getLugarPorId(ruta.lugares_ids[i]);
        const l2 = getLugarPorId(ruta.lugares_ids[i + 1]);
        if (l1 && l2) {
            totalMetros += calcularDistancia(l1.lat, l1.lng, l2.lat, l2.lng);
        }
    }
    return Math.round(totalMetros / 1000);
}

export function actualizarRutas() {
    const container = document.getElementById('lista-rutas');
    if (!container) return;
    const state = getState();
    const visitas = obtenerVisitas();

    const badgeRutas = document.getElementById('badge-rutas');
    if (badgeRutas && state.rutas) {
        badgeRutas.textContent = state.rutas.length;
    }

    if (!state.rutas || state.rutas.length === 0) {
        container.innerHTML = `<div class="vacio"><i class="fas fa-route" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No hay rutas disponibles</div>`;
        return;
    }

    let rutasFiltradas = [...state.rutas];

    if (state.filtroRutaTexto) {
        const texto = state.filtroRutaTexto.toLowerCase();
        rutasFiltradas = rutasFiltradas.filter(r =>
            r.nombre.toLowerCase().includes(texto) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(texto)) ||
            (r.region && r.region.toLowerCase().includes(texto)) ||
            (r.categoria && r.categoria.toLowerCase().includes(texto))
        );
    }

    if (state.filtroRutaDificultad !== 'todas') {
        if (state.filtroRutaDificultad === 'completadas') {
            rutasFiltradas = rutasFiltradas.filter(r =>
                r.lugares_ids.length > 0 && r.lugares_ids.every(id => visitas.includes(id))
            );
        } else if (state.filtroRutaDificultad === 'pendientes') {
            rutasFiltradas = rutasFiltradas.filter(r =>
                !r.lugares_ids.every(id => visitas.includes(id))
            );
        } else {
            rutasFiltradas = rutasFiltradas.filter(r =>
                r.dificultad && r.dificultad.toLowerCase() === state.filtroRutaDificultad.toLowerCase()
            );
        }
    }

    if (rutasFiltradas.length === 0) {
        container.innerHTML = `<div class="vacio"><i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No se encontraron rutas con este criterio.</div>`;
        return;
    }

    const html = rutasFiltradas.map((ruta) => {
        const indexOriginal = state.rutas.indexOf(ruta);
        const total = ruta.lugares_ids.length;
        const completados = ruta.lugares_ids.filter(id => visitas.includes(id)).length;
        const porcentaje = Math.round((completados / total) * 100);
        const completada = completados === total && total > 0;
        const color = coloresRutas[indexOriginal % coloresRutas.length];
        const esVisible = state.rutaVisibleId === ruta.id;
        const distKm = calcularDistanciaRutaKm(ruta);

        const lugaresLista = ruta.lugares_ids.map(id => {
            const lugar = getLugarPorId(id);
            const visitado = visitas.includes(id);
            return lugar ?
                `<span class="ruta-lugar ${visitado ? 'completado' : ''}" onclick="window.irAlLugar(${id})" style="cursor:pointer;" title="${visitado ? 'Lugar visitado' : 'Pendiente de visita'}">
                    ${visitado ? '✅' : '📍'} ${escaparHtml(lugar.nombre)}
                </span>` :
                '';
        }).join('');

        const dificultadClass = ruta.dificultad ? `dificultad-${ruta.dificultad.toLowerCase()}` : '';

        return `
            <div class="card-ruta ${completada ? 'completada' : ''}" style="border-left-color: ${completada ? '#27ae60' : color}; ${esVisible ? `box-shadow: 0 0 0 2px ${color};` : ''}">
                <div class="ruta-header">
                    <div>
                        <div class="ruta-nombre">${escaparHtml(ruta.nombre)}</div>
                        <div class="ruta-chips" style="margin-top: 4px;">
                            ${ruta.dificultad ? `<span class="chip-ruta ${dificultadClass}">${escaparHtml(ruta.dificultad)}</span>` : ''}
                            ${ruta.duracion ? `<span class="chip-ruta"><i class="fas fa-clock"></i> ${escaparHtml(ruta.duracion)}</span>` : ''}
                            ${distKm ? `<span class="chip-ruta"><i class="fas fa-road"></i> ~${distKm} km</span>` : ''}
                            ${ruta.region ? `<span class="chip-ruta"><i class="fas fa-map-pin"></i> ${escaparHtml(ruta.region)}</span>` : ''}
                        </div>
                    </div>
                    <span class="ruta-progreso-badge">${completados}/${total} (${porcentaje}%)</span>
                </div>
                <div class="ruta-barra">
                    <div class="ruta-barra-relleno" style="width:${porcentaje}%;background:${completada ? '#27ae60' : color};"></div>
                </div>
                <div class="ruta-desc">${escaparHtml(ruta.descripcion || '')}</div>
                <div class="ruta-lugares">${lugaresLista}</div>
                <div class="ruta-acciones">
                    <button class="btn-ver-ruta ${esVisible ? 'activa' : ''}" onclick="window.mostrarRutaEnMapa(${ruta.id})" style="border-color:${color};color:${esVisible ? 'white' : color};background:${esVisible ? color : 'transparent'};">
                        <i class="fas ${esVisible ? 'fa-eye-slash' : 'fa-map'}"></i> ${esVisible ? 'Ocultar del mapa' : 'Ver en el mapa'}
                    </button>
                    ${completada ? '<span style="color:#27ae60;font-weight:800;font-size:0.78rem;"><i class="fas fa-trophy"></i> ¡Ruta completada!</span>' : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

export function abrirModalLugar(id) {
    const state = getState();
    const lugar = getLugarPorId(id);
    const modal = document.getElementById('modal-lugar');
    const body = document.getElementById('modal-body');
    if (!lugar || !modal || !body) return;

    const visitado = estaVisitado(id);
    const favorito = esFavorito(id);
    const fechas = obtenerFechasVisitas();
    const colorFondo = getColorCategoria(lugar.categoria);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lugar.lat},${lugar.lng}`)}`;

    let distanciaHtml = '';
    if (state.ubicacionUsuario) {
        const d = calcularDistancia(state.ubicacionUsuario.lat, state.ubicacionUsuario.lng, lugar.lat, lugar.lng);
        distanciaHtml = `<span class="modal-meta-item"><i class="fas fa-person-walking"></i> A ${formatearDistancia(d)} de ti</span>`;
    }

    body.innerHTML = `
        <div class="modal-encabezado" style="background:${colorFondo};">
            <span class="modal-icono">${visitado ? '✅' : getIconoCategoria(lugar.categoria)}</span>
            <div>
                <h2 class="modal-titulo">${escaparHtml(lugar.nombre)}</h2>
                ${lugar.esJoyaOculta ? '<span class="badge-joya">💎 Joya Oculta</span>' : ''}
            </div>
        </div>
        <div class="modal-cuerpo">
            <p class="modal-descripcion">${escaparHtml(lugar.descripcion)}</p>

            <div class="modal-meta">
                <span class="modal-meta-item"><i class="fas fa-map-marker-alt"></i> ${escaparHtml(lugar.region || 'Perú')}</span>
                <span class="modal-meta-item"><i class="fas fa-tag"></i> ${escaparHtml(lugar.categoria || 'Sin categoría')}</span>
                ${lugar.horario ? `<span class="modal-meta-item"><i class="fas fa-clock"></i> ${escaparHtml(lugar.horario)}</span>` : ''}
                ${lugar.precio ? `<span class="modal-meta-item"><i class="fas fa-ticket-alt"></i> ${escaparHtml(lugar.precio)}</span>` : ''}
                ${distanciaHtml}
            </div>

            ${lugar.transportePublico ? `
                <div class="modal-seccion">
                    <div class="modal-seccion-titulo"><i class="fas fa-bus"></i> Cómo llegar</div>
                    <p>${escaparHtml(lugar.transportePublico)}${lugar.como_llegar ? ` — ${escaparHtml(lugar.como_llegar)}` : ''}</p>
                </div>` : (lugar.como_llegar ? `
                <div class="modal-seccion">
                    <div class="modal-seccion-titulo"><i class="fas fa-route"></i> Cómo llegar</div>
                    <p>${escaparHtml(lugar.como_llegar)}</p>
                </div>` : '')}

            ${lugar.tipLocal ? `
                <div class="modal-seccion modal-tip">
                    <div class="modal-seccion-titulo"><i class="fas fa-lightbulb"></i> Tip local</div>
                    <p>${escaparHtml(lugar.tipLocal)}</p>
                </div>` : ''}

            ${lugar.etiquetas && lugar.etiquetas.length ? `
                <div class="modal-seccion">
                    <div class="etiquetas-container">
                        ${lugar.etiquetas.map(e => `<span class="etiqueta">${escaparHtml(e)}</span>`).join('')}
                    </div>
                </div>` : ''}

            ${visitado && fechas[id] ? `
                <div class="modal-seccion modal-fecha-visita">
                    <i class="fas fa-calendar-check"></i> Visitado el ${new Date(fechas[id]).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    ${esPresencial(id) ? ' · <span class="badge-presencial">In situ</span>' : ''}
                </div>` : ''}

            <div class="modal-acciones">
                <button class="btn-checkin modal-btn-checkin ${visitado ? 'visitado' : ''}" onclick="window.hacerCheckIn(${lugar.id})">
                    ${visitado ? '<i class="fas fa-check"></i> Visitado' : '<i class="fas fa-location-dot"></i> Hacer Check-in'}
                </button>
                <button class="btn-favorito modal-btn-favorito ${favorito ? 'activo' : ''}" onclick="window.manejarFavorito(${lugar.id}); window.abrirModalLugar(${lugar.id});">
                    <i class="fas fa-star"></i> ${favorito ? 'Favorito' : 'Añadir a favoritos'}
                </button>
                <button class="btn-ver-mapa" onclick="window.cerrarModal(); window.irAlLugar(${lugar.id});">
                    <i class="fas fa-map-location-dot"></i> Ver en el mapa
                </button>
                <a class="btn-ver-mapa btn-direcciones" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
                    <i class="fas fa-diamond-turn-right"></i> Cómo llegar
                </a>
            </div>
        </div>
    `;

    modal.dataset.lugarId = id;
    modal.classList.remove('hidden');
}

export function cerrarModal() {
    const modal = document.getElementById('modal-lugar');
    if (modal) modal.classList.add('hidden');
}

export function initModal() {
    const modal = document.getElementById('modal-lugar');
    const btnCerrar = document.getElementById('modal-cerrar');
    if (!modal) return;

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModal();
    });
}

export function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = {
        lugares: document.getElementById('tab-lugares'),
        rutas: document.getElementById('tab-rutas'),
        colecciones: document.getElementById('tab-colecciones')
    };

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');

            const tab = btn.dataset.tab;
            Object.keys(contents).forEach(key => {
                if (contents[key]) contents[key].classList.toggle('hidden', key !== tab);
            });

            const state = getState();
            if (state.mapa) setTimeout(() => state.mapa.invalidateSize(), 60);

            if (tab === 'rutas') actualizarRutas();
        });
    });
}

export function initVistaMovil() {
    const botones = document.querySelectorAll('.vista-movil-btn');
    if (!botones.length) return;

    botones.forEach(boton => {
        boton.addEventListener('click', () => {
            const vista = boton.dataset.vista;
            document.body.classList.toggle('vista-lista-movil', vista === 'lista');
            botones.forEach(item => {
                const activo = item === boton;
                item.classList.toggle('activo', activo);
                item.setAttribute('aria-pressed', String(activo));
            });

            const destino = vista === 'lista'
                ? document.querySelector('.panel')
                : document.querySelector('.mapa-wrapper');
            destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const state = getState();
            if (state.mapa) setTimeout(() => state.mapa.invalidateSize(), 120);
        });
    });
}

export function initControlesMovil() {
    const boton = document.getElementById('btn-toggle-filtros-movil');
    if (!boton) return;

    const guardado = localStorage.getItem('peruTurismo_filtrosMovilOcultos') === 'true';
    const actualizar = (ocultos) => {
        document.body.classList.toggle('filtros-movil-ocultos', ocultos);
        boton.setAttribute('aria-expanded', String(!ocultos));
        boton.querySelector('span').textContent = ocultos ? 'Mostrar opciones de búsqueda' : 'Ocultar opciones de búsqueda';
        boton.querySelector('strong').textContent = ocultos ? '+' : '−';
    };

    actualizar(guardado);
    boton.addEventListener('click', () => {
        const ocultos = !document.body.classList.contains('filtros-movil-ocultos');
        actualizar(ocultos);
        localStorage.setItem('peruTurismo_filtrosMovilOcultos', String(ocultos));
    });
}

export function initTema() {
    const temaGuardado = localStorage.getItem('peruTurismo_tema') || 'claro';
    aplicarTema(temaGuardado);

    const btn = document.getElementById('btn-tema');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const actual = document.body.classList.contains('dark') ? 'oscuro' : 'claro';
        const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
        aplicarTema(nuevo);
        localStorage.setItem('peruTurismo_tema', nuevo);
        mostrarToast(nuevo === 'oscuro' ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado');
    });
}

export function aplicarTema(tema) {
    const state = getState();
    const btn = document.getElementById('btn-tema');

    if (tema === 'oscuro') {
        document.body.classList.add('dark');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-sun"></i>';
            btn.title = 'Cambiar a modo claro';
            btn.setAttribute('aria-label', 'Cambiar a modo claro');
        }
    } else {
        document.body.classList.remove('dark');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-moon"></i>';
            btn.title = 'Cambiar a modo oscuro';
            btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
        }
    }

    if (state.capaTeselas && state.mapa && state.temaTeselasAplicado !== tema) {
        state.temaTeselasAplicado = tema;
        setTimeout(() => { if (state.mapa) state.mapa.invalidateSize(); }, 80);
    }
}

export function mostrarBienvenida() {
    const overlay = document.getElementById('overlay-bienvenida');
    const btn = document.getElementById('btn-empezar');
    if (!overlay || localStorage.getItem('peruTurismo_bienvenido')) return;

    overlay.classList.remove('hidden');
    const cerrar = () => {
        overlay.classList.add('hidden');
        localStorage.setItem('peruTurismo_bienvenido', 'true');
    };
    if (btn) btn.addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrar();
    });
}

export function agregarAnimacionPulso() {
    if (document.getElementById('style-pulso-animation')) return;
    const style = document.createElement('style');
    style.id = 'style-pulso-animation';
    style.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(39,174,96,0.4); }
            70% { box-shadow: 0 0 0 15px rgba(39,174,96,0); }
            100% { box-shadow: 0 0 0 0 rgba(39,174,96,0); }
        }
    `;
    document.head.appendChild(style);
}
