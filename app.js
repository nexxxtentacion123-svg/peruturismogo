// ================================================================
// 1. VARIABLES GLOBALES
// ================================================================
let lugares = [];
let rutas = [];
let marcadores = {};
let mapa = null;
let filtroActual = 'todos';
let filtroExplorador = 'todos';
let filtroBusqueda = '';
let filtroRegion = 'todas';
let filtroRapido = 'todos'; // 'todos', 'joyas', 'favoritos', 'visitados', 'pendientes'
let filtroRutaTexto = '';
let filtroRutaDificultad = 'todas';
let ordenActual = 'nombre';
let ubicacionUsuario = null;
let marcadorUbicacion = null;
let circuloUbicacion = null;
let watchIdUbicacion = null;
let ultimaNotificacionCercania = {};
let ultimaActualizacionUbicacion = 0;
let capaRutaActual = null;   // capa Leaflet con la ruta dibujada
let rutaVisibleId = null;    // id de la ruta mostrada en el mapa
let capaTeselas = null;
let temaTeselasAplicado = null;

const RADIO_AUTO_CHECKIN = 120;
const RADIO_PRESENCIAL = 250;
const RADIO_RADAR = 5000;
const INTERVALO_NOTIFICACION_CERCANIA = 5 * 60 * 1000;
const TESELAS = {
    // OpenStreetMap — 100% libre, sin API key (https://www.openstreetmap.org)
    claro:  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    oscuro: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'   // mismo mapa; el modo oscuro lo invierte el CSS
};

// Extensión geográfica de Perú con un margen pequeño para no cortar la costa
// ni las zonas fronterizas del mapa al hacer zoom o arrastrar.
const limitesPeru = L.latLngBounds([-18.6, -81.6], [-0.04, -68.5]);

const coloresRutas = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#c2185b', '#5d6d7e', '#b7950b'];

function leerStorageJson(clave, valorPorDefecto) {
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

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ================================================================
// 2. GESTIÓN DE COLECCIONES (localStorage)
// ================================================================
function obtenerVisitas() {
    const data = leerStorageJson('peruTurismo_visitas', []);
    return Array.isArray(data) ? data : [];
}

function guardarVisitas(visitas) {
    localStorage.setItem('peruTurismo_visitas', JSON.stringify(visitas));
}

function toggleVisita(id) {
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

function estaVisitado(id) {
    return obtenerVisitas().includes(id);
}

// ===== NUEVO: fechas de visita =====
function obtenerFechasVisitas() {
    const data = leerStorageJson('peruTurismo_fechasVisitas', {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function registrarFechaVisita(id) {
    const fechas = obtenerFechasVisitas();
    fechas[id] = new Date().toISOString();
    localStorage.setItem('peruTurismo_fechasVisitas', JSON.stringify(fechas));
}

function eliminarFechaVisita(id) {
    const fechas = obtenerFechasVisitas();
    delete fechas[id];
    localStorage.setItem('peruTurismo_fechasVisitas', JSON.stringify(fechas));
}

function obtenerVisitasPresenciales() {
    const data = leerStorageJson('peruTurismo_visitasPresenciales', []);
    return Array.isArray(data) ? data : [];
}

function guardarVisitasPresenciales(lista) {
    localStorage.setItem('peruTurismo_visitasPresenciales', JSON.stringify(lista));
}

function marcarVisitaPresencial(id) {
    const lista = obtenerVisitasPresenciales();
    if (!lista.includes(id)) {
        lista.push(id);
        guardarVisitasPresenciales(lista);
    }
}

function quitarVisitaPresencial(id) {
    guardarVisitasPresenciales(obtenerVisitasPresenciales().filter(x => x !== id));
}

function esPresencial(id) {
    return obtenerVisitasPresenciales().includes(id);
}

function distanciaAlLugar(lugar) {
    if (!ubicacionUsuario || !lugar) return null;
    return calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, lugar.lat, lugar.lng);
}

function calcularPuntos() {
    const visitas = obtenerVisitas();
    const presenciales = obtenerVisitasPresenciales();
    let puntos = 0;
    visitas.forEach(id => {
        const lugar = lugares.find(l => l.id === id);
        if (!lugar) return;
        puntos += 10;
        if (lugar.esJoyaOculta) puntos += 20;
        if (presenciales.includes(id)) puntos += 15;
    });
    return puntos;
}

function obtenerNivel(puntos) {
    if (puntos >= 500) return { nombre: 'Embajador del Perú', icono: '👑' };
    if (puntos >= 300) return { nombre: 'Aventurero', icono: '🏆' };
    if (puntos >= 150) return { nombre: 'Explorador', icono: '🌟' };
    if (puntos >= 50) return { nombre: 'Caminante', icono: '🥾' };
    return { nombre: 'Recién llegado', icono: '🎒' };
}

function puntosPorCheckIn(lugar, presencial) {
    let pts = 10;
    if (lugar && lugar.esJoyaOculta) pts += 20;
    if (presencial) pts += 15;
    return pts;
}

// ===== NUEVO: favoritos =====
function obtenerFavoritos() {
    const data = leerStorageJson('peruTurismo_favoritos', []);
    return Array.isArray(data) ? data : [];
}

function guardarFavoritos(favoritos) {
    localStorage.setItem('peruTurismo_favoritos', JSON.stringify(favoritos));
}

function toggleFavorito(id) {
    let favoritos = obtenerFavoritos();
    const idx = favoritos.indexOf(id);
    if (idx === -1) {
        favoritos.push(id);
        mostrarToast('⭐ Añadido a favoritos');
    } else {
        favoritos.splice(idx, 1);
        mostrarToast('💔 Quitado de favoritos');
    }
    guardarFavoritos(favoritos);
    return favoritos;
}

function esFavorito(id) {
    return obtenerFavoritos().includes(id);
}

// ================================================================
// 3. CARGAR DATOS
// ================================================================
async function cargarLugares() {
    try {
        if (window.location.protocol === 'file:') {
            throw new Error('La app necesita ejecutarse desde un servidor local, no desde file://');
        }
        const [resp, extraResp] = await Promise.all([
            fetch('lugares.json'),
            fetch('lugares-extra.json').catch(() => null)
        ]);
        if (!resp.ok) throw new Error('No se pudo cargar lugares.json');
        const base = await resp.json();
        const extra = extraResp && extraResp.ok ? await extraResp.json() : [];
        const unicos = new Map([...base, ...extra].map(lugar => [lugar.id, lugar]));
        return [...unicos.values()];
    } catch (error) {
        console.error('Error cargando lugares:', error);
        alert('⚠️ No se pudo cargar lugares.json.\nAbre la carpeta con servidor local (por ejemplo: python servidor.py).');
        return [];
    }
}

async function cargarRutas() {
    try {
        const resp = await fetch('rutas.json');
        if (!resp.ok) throw new Error('No se pudo cargar rutas.json');
        return await resp.json();
    } catch (error) {
        console.warn('No se encontró rutas.json, usando rutas por defecto');
        return generarRutasPorDefecto();
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

// ================================================================
// 4. INICIALIZAR MAPA
// ================================================================
function inicializarMapa() {
    mapa = L.map('mapa', {
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
    capaTeselas = L.tileLayer(TESELAS[temaInicial], {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        minZoom: 5,
        maxZoom: 19
    }).addTo(mapa);
    temaTeselasAplicado = temaInicial;

    // Asegurar renderizado correcto al terminar de cargar el DOM
    setTimeout(() => {
        if (mapa) mapa.invalidateSize();
    }, 150);
    setTimeout(() => {
        if (mapa) mapa.invalidateSize();
    }, 500);

    window.addEventListener('resize', () => {
        if (mapa) mapa.invalidateSize();
    });

    agregarBotonUbicacion();
    configurarBannerRuta();
}

function configurarBannerRuta() {
    const btnCentrar = document.getElementById('btn-centrar-ruta');
    const btnOcultar = document.getElementById('btn-ocultar-ruta');

    if (btnCentrar) {
        btnCentrar.addEventListener('click', () => {
            if (rutaVisibleId && mapa) {
                const ruta = rutas.find(r => r.id === rutaVisibleId);
                if (ruta) {
                    const puntos = ruta.lugares_ids
                        .map(id => lugares.find(l => l.id === id))
                        .filter(Boolean)
                        .map(l => [l.lat, l.lng]);
                    if (puntos.length > 0) {
                        mapa.flyToBounds(L.latLngBounds(puntos).pad(0.25), { duration: 1 });
                    }
                }
            }
        });
    }

    if (btnOcultar) {
        btnOcultar.addEventListener('click', () => {
            ocultarRutaEnMapa();
            actualizarRutas();
        });
    }
}

// ================================================================
// 5. BOTÓN DE UBICACIÓN (GEOLOCALIZACIÓN)
// ================================================================
function agregarBotonUbicacion() {
    const btn = document.createElement('button');
    btn.id = 'btn-ubicacion';
    btn.className = 'btn-ubicacion';
    btn.innerHTML = '<i class="fas fa-location-dot"></i>';
    btn.title = 'Ir a mi ubicación';
    btn.addEventListener('click', obtenerUbicacion);
    document.querySelector('.mapa-wrapper').appendChild(btn);
}

function obtenerUbicacion() {
    const btn = document.getElementById('btn-ubicacion');

    if (ubicacionUsuario && mapa) {
        mapa.flyTo([ubicacionUsuario.lat, ubicacionUsuario.lng], Math.max(mapa.getZoom(), 15), { duration: 0.8 });
        if (marcadorUbicacion) marcadorUbicacion.openPopup();
        return;
    }

    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    solicitarPermisoNotificaciones();
    navigator.geolocation.getCurrentPosition(
        (pos) => manejarNuevaUbicacion(pos, true),
        (err) => {
            console.error('Error de geolocalización:', err);
            btn.innerHTML = '<i class="fas fa-location-dot"></i>';
            btn.disabled = false;
            alert('⚠️ No se pudo obtener tu ubicación.\n' +
                'Asegúrate de permitir el acceso a la ubicación.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
}

function solicitarPermisoNotificaciones() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    Notification.requestPermission().catch(error => {
        console.warn('No se pudo solicitar permiso de notificaciones:', error);
    });
}

function iniciarSeguimientoUbicacion() {
    if (watchIdUbicacion !== null || !navigator.geolocation) return;
    watchIdUbicacion = navigator.geolocation.watchPosition(
        pos => manejarNuevaUbicacion(pos, false),
        error => console.warn('Seguimiento de ubicación pausado:', error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
}

function manejarNuevaUbicacion(posicion, centrarMapa) {
    const lat = posicion.coords.latitude;
    const lng = posicion.coords.longitude;

    if (!limitesPeru.contains([lat, lng])) {
        ubicacionUsuario = null;
        detenerSeguimientoUbicacion();
        mostrarToast('📍 Tu ubicación está fuera de Perú.');
        return;
    }

    ubicacionUsuario = {
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

    if (!marcadorUbicacion) {
        marcadorUbicacion = L.marker([lat, lng], { icon: icono })
            .addTo(mapa)
            .bindPopup('📍 Estás aquí');
    } else {
        marcadorUbicacion.setLatLng([lat, lng]);
        marcadorUbicacion.setIcon(icono);
    }

    if (!circuloUbicacion) {
        circuloUbicacion = L.circle([lat, lng], {
            radius: Math.max(ubicacionUsuario.precision, 18),
            color: '#f4b942',
            fillColor: '#f4b942',
            fillOpacity: 0.12,
            weight: 1
        }).addTo(mapa);
    } else {
        circuloUbicacion.setLatLng([lat, lng]);
        circuloUbicacion.setRadius(Math.max(ubicacionUsuario.precision, 18));
    }

    if (centrarMapa || !ultimaActualizacionUbicacion) {
        mapa.setView([lat, lng], Math.max(mapa.getZoom(), 15), { animate: true });
    }

    ultimaActualizacionUbicacion = Date.now();
    if (btn) {
        btn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
        btn.disabled = false;
        btn.classList.add('activo');
        btn.title = 'Seguimiento activo: centrar en mi ubicación';
    }

    const opcionCercania = document.getElementById('opcion-cercania');
    if (opcionCercania) {
        opcionCercania.disabled = false;
        opcionCercania.style.opacity = '1';
    }

    verificarCercania(lat, lng);
    actualizarRadarCercanos();
    actualizarUI();
    iniciarSeguimientoUbicacion();
}

function detenerSeguimientoUbicacion() {
    if (watchIdUbicacion !== null) {
        navigator.geolocation.clearWatch(watchIdUbicacion);
        watchIdUbicacion = null;
    }
}

// ================================================================
// 6. VERIFICAR CERCANÍA (check-in automático)
// ================================================================
function verificarCercania(lat, lng, radio = RADIO_AUTO_CHECKIN) {
    let visitas = obtenerVisitas();
    let nuevos = 0;
    let puntosGanados = 0;

    lugares.forEach(lugar => {
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
        agregarMarcadores();
        actualizarUI();
        actualizarRutas();

        const mensaje = nuevos === 1 ?
            '🎯 ¡Lugar capturado in situ!' :
            `🎯 ¡Has llegado a ${nuevos} lugares!`;
        mostrarToast(`${mensaje} +${puntosGanados} pts`);
    }

    notificarLugaresCercanos(lat, lng);
}

function obtenerLugaresCercanos() {
    if (!ubicacionUsuario || !lugares.length) return [];
    return lugares
        .map(lugar => ({ lugar, distancia: distanciaAlLugar(lugar) }))
        .filter(item => item.distancia !== null && item.distancia <= RADIO_RADAR)
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, 3);
}

function actualizarRadarCercanos() {
    const panel = document.getElementById('panel-cercanos');
    const contenido = document.getElementById('cercanos-contenido');
    if (!panel || !contenido || !ubicacionUsuario) return;

    const cercanos = obtenerLugaresCercanos();
    panel.classList.remove('hidden');
    if (!cercanos.length) {
        contenido.innerHTML = '<span class="cercano-vacio">No hay lugares registrados en un radio de 5 km.</span>';
        return;
    }

    contenido.innerHTML = cercanos.map(({ lugar, distancia }, indice) => {
        const cerca = distancia <= RADIO_PRESENCIAL;
        return `
            <button type="button" class="cercano-item ${cerca ? 'cerca-ahora' : ''}" onclick="irAlLugar(${lugar.id})">
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

function notificarLugaresCercanos(lat, lng) {
    const candidato = lugares
        .map(lugar => ({ lugar, distancia: calcularDistancia(lat, lng, lugar.lat, lugar.lng) }))
        .filter(item => item.distancia <= RADIO_PRESENCIAL && !estaVisitado(item.lugar.id))
        .sort((a, b) => a.distancia - b.distancia)[0];

    if (!candidato) return;
    const id = candidato.lugar.id;
    const ahora = Date.now();
    if (ultimaNotificacionCercania[id] && ahora - ultimaNotificacionCercania[id] < INTERVALO_NOTIFICACION_CERCANIA) return;
    ultimaNotificacionCercania[id] = ahora;

    const mensaje = `🎯 ${candidato.lugar.nombre} está a ${formatearDistancia(candidato.distancia)}. ¡Puedes capturarlo!`;
    mostrarToast(mensaje, 'radar');

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('PerúTurismo GO', {
            body: mensaje,
            tag: `lugar-${id}`,
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/svgs/solid/map-location-dot.svg'
        });
    }
}

// ================================================================
// 7. CALCULAR DISTANCIA (Haversine)
// ================================================================
function calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
}

function formatearDistancia(metros) {
    if (metros < 1000) return `${Math.round(metros)} m`;
    return `${(metros / 1000).toFixed(1)} km`;
}

// ================================================================
// 8. CREAR MARCADORES CON COLORES POR CATEGORÍA
// ================================================================
const coloresCategoria = {
    'Arqueológico': '#d4a574',
    'Historia': '#b8a0c0',
    'Naturaleza': '#82c4a0',
    'Cultura': '#e8b4b4',
    'Gastronomía': '#f5d78c',
    'Museo': '#8fc1d4',
    'Parque': '#8fc9a8'
};

const iconosCategoria = {
    'Arqueológico': '🏛️',
    'Historia': '📜',
    'Naturaleza': '🌿',
    'Cultura': '🎨',
    'Gastronomía': '🍜',
    'Museo': '🏛️',
    'Parque': '🌳'
};

function getColorCategoria(categoria) {
    return coloresCategoria[categoria] || '#bdc3c7';
}

function getIconoCategoria(categoria) {
    return iconosCategoria[categoria] || '📍';
}

function crearIcono(categoria, visitado = false, favorito = false) {
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

// ===== NUEVO: contenido del popup reutilizable =====
function generarPopupLugar(lugar, visitado) {
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
            <button onclick="hacerCheckIn(${lugar.id})"
                    class="btn-checkin ${visitado ? 'completado' : ''}">
                ${visitado ? '<i class="fas fa-check"></i> Visitado' : (cerca ? '🎯 Capturar' : '📍 Check-in')}
            </button>
            <button onclick="manejarFavorito(${lugar.id});"
                    class="btn-favorito ${favorito ? 'activo' : ''}"
                    title="${favorito ? 'Quitar favorito' : 'Favorito'}">
                <i class="fas fa-star"></i>
            </button>
            <button onclick="abrirModalLugar(${lugar.id})"
                    class="btn-ver-ruta" style="padding:5px 10px;font-size:0.72rem;">
                <i class="fas fa-info-circle"></i> Detalle
            </button>
        </div>
    `;
}

function agregarMarcadores() {
    Object.values(marcadores).forEach(m => mapa.removeLayer(m));
    marcadores = {};

    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();

    lugares.forEach(lugar => {
        const visitado = visitas.includes(lugar.id);
        const favorito = favoritos.includes(lugar.id);
        const icono = crearIcono(lugar.categoria, visitado, favorito);

        const marker = L.marker([lugar.lat, lugar.lng], { icon: icono })
            .addTo(mapa)
            .bindPopup(generarPopupLugar(lugar, visitado), { maxWidth: 300, offset: [0, -10] });

        marcadores[lugar.id] = marker;
    });

    // Vista inicial: encuadrar todos los lugares de forma limpia tras renderizado
    if (lugares.length > 0 && !agregarMarcadores._vistaInicial) {
        agregarMarcadores._vistaInicial = true;
        setTimeout(() => {
            if (mapa) {
                mapa.invalidateSize();
                const grupo = L.featureGroup(Object.values(marcadores));
                mapa.fitBounds(grupo.getBounds(), { padding: [40, 40], maxZoom: 14 });
            }
        }, 180);
    }
}

// ===== NUEVO: atenuar marcadores que no pasan los filtros =====
function actualizarOpacidadMarcadores(lugaresVisibles) {
    const idsVisibles = new Set(lugaresVisibles.map(l => l.id));
    const hayFiltro = filtroActual !== 'todos' ||
        filtroExplorador !== 'todos' ||
        filtroRegion !== 'todas' ||
        filtroRapido !== 'todos' ||
        filtroBusqueda.trim() !== '';

    lugares.forEach(lugar => {
        const marker = marcadores[lugar.id];
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

// ================================================================
// 9. FUNCIÓN CHECK-IN
// ================================================================
function hacerCheckIn(id) {
    const yaVisitado = estaVisitado(id);
    const lugar = lugares.find(l => l.id === id);
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

    const marker = marcadores[id];
    if (marker && lugar) {
        const favorito = esFavorito(id);
        marker.setIcon(crearIcono(lugar.categoria, visitado, favorito));
        marker.setPopupContent(generarPopupLugar(lugar, visitado));
    }

    if (mapa) mapa.closePopup();
    actualizarUI();
    actualizarRutas();

    // Refrescar el modal si está abierto con este lugar
    const modal = document.getElementById('modal-lugar');
    if (modal && !modal.classList.contains('hidden') && modal.dataset.lugarId == id) {
        abrirModalLugar(id);
    }
}

// ===== NUEVO: ir a un lugar en el mapa =====
function irAlLugar(id) {
    const lugar = lugares.find(l => l.id === id);
    if (!lugar || !marcadores[id]) return;
    const tabLugares = document.querySelector('[data-tab="lugares"]');
    if (tabLugares) tabLugares.click();

    if (window.innerWidth <= 860) {
        const mapaWrapper = document.querySelector('.mapa-wrapper');
        if (mapaWrapper) {
            mapaWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    mapa.flyTo([lugar.lat, lugar.lng], 15, { duration: 1.2 });
    setTimeout(() => {
        if (marcadores[id]) marcadores[id].openPopup();
    }, 1300);
}

// ================================================================
// 10. FILTROS
// ================================================================
function getCategorias() {
    const cats = new Set();
    lugares.forEach(l => { if (l.categoria) cats.add(l.categoria); });
    return Array.from(cats).sort();
}

function generarFiltros() {
    const container = document.getElementById('filtros');
    const categorias = getCategorias();

    let html =
        `<button class="filtro-btn activo" data-filtro="todos" onclick="aplicarFiltro('todos', this)">Todos</button>`;
    categorias.forEach(cat => {
        html +=
            `<button class="filtro-btn" data-filtro="${cat}" onclick="aplicarFiltro('${cat}', this)">${cat}</button>`;
    });
    container.innerHTML = html;
}

function aplicarFiltro(filtro, btn) {
    filtroActual = filtro;
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
    if (btn) btn.classList.add('activo');
    actualizarUI();
}

// ===== NUEVO: filtro por región =====
function getRegiones() {
    const regiones = new Set();
    lugares.forEach(l => { if (l.region) regiones.add(l.region); });
    return Array.from(regiones).sort();
}

function generarFiltroRegion() {
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
        filtroRegion = this.value;
        actualizarUI();
    });
}

// ================================================================
// 11. FILTROS POR TIPO DE EXPLORADOR
// ================================================================
function getTiposExplorador() {
    const tipos = new Set();
    lugares.forEach(l => {
        if (l.tiposExplorador && Array.isArray(l.tiposExplorador)) {
            l.tiposExplorador.forEach(t => tipos.add(t));
        }
    });
    return Array.from(tipos).sort();
}

function generarFiltrosExplorador() {
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

    let html = `<button class="filtro-tipo-btn activo" data-tipo="todos" onclick="aplicarFiltroExplorador('todos', this)">
        🌍 Todos
    </button>`;

    tipos.forEach(tipo => {
        const icono = iconos[tipo] || '📍';
        html += `<button class="filtro-tipo-btn" data-tipo="${tipo}" onclick="aplicarFiltroExplorador('${tipo}', this)">
            ${icono} ${tipo}
        </button>`;
    });

    container.innerHTML = html;
}

function aplicarFiltroExplorador(tipo, btn) {
    filtroExplorador = tipo;
    document.querySelectorAll('.filtro-tipo-btn').forEach(b => b.classList.remove('activo'));
    if (btn) btn.classList.add('activo');
    actualizarUI();
}

// ================================================================
// 12. ORDENAR LUGARES
// ================================================================
function ordenarLugares(lista) {
    const visitas = obtenerVisitas();

    switch (ordenActual) {
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
            if (!ubicacionUsuario) {
                return lista;
            }
            return [...lista].sort((a, b) => {
                const da = calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, a.lat, a.lng);
                const db = calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, b.lat, b.lng);
                return da - db;
            });

        default:
            return lista;
    }
}

// ================================================================
// 13. ACTUALIZAR UI (CON BUSCADOR, REGIÓN Y ORDENAR)
// ================================================================
function filtrarLugares() {
    let resultado = [...lugares];

    // 1. Filtro rápido de estado
    if (filtroRapido === 'joyas') {
        resultado = resultado.filter(l => l.esJoyaOculta);
    } else if (filtroRapido === 'favoritos') {
        resultado = resultado.filter(l => esFavorito(l.id));
    } else if (filtroRapido === 'visitados') {
        resultado = resultado.filter(l => estaVisitado(l.id));
    } else if (filtroRapido === 'pendientes') {
        resultado = resultado.filter(l => !estaVisitado(l.id));
    }

    if (filtroActual !== 'todos') {
        resultado = resultado.filter(l => l.categoria === filtroActual);
    }

    if (filtroExplorador !== 'todos') {
        resultado = resultado.filter(l =>
            l.tiposExplorador && l.tiposExplorador.includes(filtroExplorador)
        );
    }

    if (filtroRegion !== 'todas') {
        resultado = resultado.filter(l => l.region === filtroRegion);
    }

    if (filtroBusqueda.trim() !== '') {
        const busqueda = filtroBusqueda.toLowerCase().trim();
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

function configurarFiltrosRapidos() {
    const container = document.getElementById('filtros-rapidos');
    if (!container) return;

    container.querySelectorAll('.filtro-rapido-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.filtro-rapido-btn').forEach(b => b.classList.remove('activo'));
            this.classList.add('activo');
            filtroRapido = this.dataset.rapido;
            actualizarUI();
        });
    });
}

function actualizarUI() {
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();

    document.getElementById('contador-visitas').textContent = visitas.length;
    document.getElementById('total-lugares').textContent = lugares.length;
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
    if (badgeRutas && rutas) {
        badgeRutas.textContent = rutas.length;
    }

    const lugaresFiltrados = ordenarLugares(filtrarLugares());

    actualizarOpacidadMarcadores(lugaresFiltrados);

    document.getElementById('resultados-count').textContent = lugaresFiltrados.length;
    const totalDisponibles = document.getElementById('total-disponibles');
    if (totalDisponibles) totalDisponibles.textContent = lugares.length;

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
                `<span class="etiqueta ${lugar.esJoyaOculta ? 'joya' : ''}">${et}</span>`
            ).join('');
        }
        if (lugar.esJoyaOculta) {
            etiquetasHtml += `<span class="badge-joya-mini"><i class="fas fa-gem"></i> Joya Oculta</span>`;
        }

        let tipHtml = '';
        if (lugar.tipLocal) {
            tipHtml = `<div class="tip-local"><i class="fas fa-lightbulb"></i> ${lugar.tipLocal}</div>`;
        }

        // Distancia si hay ubicación
        let distanciaHtml = '';
        if (ubicacionUsuario) {
            const d = calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, lugar.lat, lugar.lng);
            distanciaHtml = `<span class="badge-distancia"><i class="fas fa-location-arrow"></i> ${formatearDistancia(d)}</span>`;
        }

        return `
            <article class="item-lugar ${visitado ? 'visitado-card' : ''}">
                <div class="contenido" onclick="abrirModalLugar(${lugar.id})">
                    <div class="placeholder-icono" style="background:${colorFondo};">
                        ${visitado ? '✅' : icono}
                    </div>
                    <div class="info">
                        <span class="nombre">${visitado ? '✅ ' : ''}${escaparHtml(lugar.nombre)}${esPresencial(lugar.id) ? ' <span class="badge-presencial">In situ</span>' : ''}</span>
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
                            onclick="event.stopPropagation(); irAlLugar(${lugar.id})">
                        <i class="fas fa-map-location-dot"></i>
                    </button>
                    <button class="btn-favorito ${favorito ? 'activo' : ''}"
                            title="${favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
                            onclick="event.stopPropagation(); manejarFavorito(${lugar.id})">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="btn-checkin ${visitado ? 'completado' : ''}"
                            onclick="event.stopPropagation(); hacerCheckIn(${lugar.id})">
                        ${visitado ? '<i class="fas fa-check"></i>' : '<i class="fas fa-location-dot"></i>'}
                        ${visitado ? 'Visitado' : 'Check-in'}
                    </button>
                </div>
            </article>
        `;
    }).join('');

    document.getElementById('lista-lugares').innerHTML =
        lugaresFiltrados.length === 0 ?
        `<div class="vacio">
                <i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
                No se encontraron lugares<br>
                <span style="font-size:0.8rem;color:#95a5a6;">Intenta con otra búsqueda o filtro</span>
            </div>` :
        listaHtml;

    actualizarColecciones();
    actualizarProgreso();
    actualizarLogros();
    actualizarFavoritos();
    actualizarBotonCompartir();
}

// ===== NUEVO: manejador de favorito (actualiza icono del marcador) =====
function manejarFavorito(id) {
    toggleFavorito(id);
    const lugar = lugares.find(l => l.id === id);
    const visitado = estaVisitado(id);
    const marker = marcadores[id];
    if (marker) marker.setIcon(crearIcono(lugar.categoria, visitado, esFavorito(id)));
    actualizarUI();
}

// ===== NUEVO: sección "Mis Visitas" =====
function actualizarColecciones() {
    const visitas = obtenerVisitas();
    const coleccionesDiv = document.getElementById('colecciones');
    const fechas = obtenerFechasVisitas();

    if (visitas.length === 0) {
        coleccionesDiv.innerHTML = `<div class="vacio">
                <i class="fas fa-sad-tear" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
                Aún no has visitado ningún lugar.<br>¡Explora Perú y haz check-in!
            </div>`;
        return;
    }

    const items = [...visitas].reverse().map(id => {
        const lugar = lugares.find(l => l.id === id);
        if (!lugar) return '';
        const fecha = fechas[id] ? new Date(fechas[id]).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const presencial = esPresencial(id);
        return `
            <div class="item-visita" onclick="abrirModalLugar(${lugar.id})">
                <span class="item-visita-nombre"><i class="fas fa-check-circle"></i> ${lugar.nombre}${presencial ? ' <span class="badge-presencial">In situ</span>' : ''}</span>
                <span class="item-visita-fecha">${fecha}</span>
                <button class="btn-ir-mapa" title="Ver en el mapa" onclick="event.stopPropagation(); irAlLugar(${lugar.id})">
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

// ===== NUEVO: barra de progreso general =====
function actualizarProgreso() {
    const visitas = obtenerVisitas();
    const total = lugares.length;
    if (total === 0) return;
    const porcentaje = Math.round((visitas.length / total) * 100);
    document.getElementById('progreso-porcentaje').textContent = `${porcentaje}%`;
    const relleno = document.getElementById('progreso-relleno');
    relleno.style.width = `${porcentaje}%`;
    relleno.style.background = porcentaje === 100 ?
        'linear-gradient(90deg,#f1c40f,#27ae60)' :
        'linear-gradient(90deg,#c0392b,#f1c40f)';
}

// ===== NUEVO: sistema de logros =====
function calcularLogros() {
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();
    const total = lugares.length;
    const joyasVisitadas = visitas.filter(id => {
        const lugar = lugares.find(l => l.id === id);
        return lugar && lugar.esJoyaOculta;
    }).length;
    const rutasCompletadas = rutas.filter(ruta =>
        ruta.lugares_ids.every(id => visitas.includes(id))
    ).length;

    return [
        { icono: '🥾', nombre: 'Primer paso', desc: 'Visita tu primer lugar', logrado: visitas.length >= 1 },
        { icono: '🌟', nombre: 'Explorador', desc: 'Visita 5 lugares', logrado: visitas.length >= 5 },
        { icono: '🏆', nombre: 'Aventurero', desc: 'Visita 10 lugares', logrado: visitas.length >= 10 },
        { icono: '👑', nombre: 'Conquistador', desc: 'Visita 25 lugares', logrado: visitas.length >= 25 },
        { icono: '🇵🇪', nombre: 'Leyenda del Perú', desc: 'Visita todos los lugares', logrado: total > 0 && visitas.length >= total },
        { icono: '💎', nombre: 'Cazador de joyas', desc: 'Descubre una Joya Oculta', logrado: joyasVisitadas >= 1 },
        { icono: '💠', nombre: 'Tesoro completo', desc: 'Descubre todas las Joyas Ocultas', logrado: joyasVisitadas >= 9 },
        { icono: '🗺️', nombre: 'Trotamundos', desc: 'Completa tu primera ruta', logrado: rutasCompletadas >= 1 },
        { icono: '🧭', nombre: 'Maestro de rutas', desc: 'Completa todas las rutas', logrado: rutas.length > 0 && rutasCompletadas >= rutas.length },
        { icono: '⭐', nombre: 'Soñador', desc: 'Marca 3 favoritos', logrado: favoritos.length >= 3 },
        { icono: '📡', nombre: 'Explorador real', desc: 'Haz 3 visitas in situ', logrado: obtenerVisitasPresenciales().length >= 3 }
    ];
}

function actualizarLogros() {
    const container = document.getElementById('lista-logros');
    if (!container) return;
    const logros = calcularLogros();
    container.innerHTML = logros.map(logro => `
        <div class="logro ${logro.logrado ? 'logrado' : ''}" title="${logro.desc}">
            <span class="logro-icono">${logro.icono}</span>
            <div>
                <div class="logro-nombre">${logro.nombre}</div>
                <div class="logro-desc">${logro.desc}</div>
            </div>
        </div>
    `).join('');
}

// ===== NUEVO: sección de favoritos =====
function actualizarFavoritos() {
    const favoritos = obtenerFavoritos();
    const seccion = document.getElementById('seccion-favoritos');
    const lista = document.getElementById('lista-favoritos');
    if (!seccion || !lista) return;

    if (favoritos.length === 0) {
        seccion.style.display = 'none';
        return;
    }

    seccion.style.display = 'block';
    lista.innerHTML = favoritos.map(id => {
        const lugar = lugares.find(l => l.id === id);
        if (!lugar) return '';
        const visitado = estaVisitado(id);
        return `
            <div class="item-visita" onclick="abrirModalLugar(${lugar.id})">
                <span class="item-visita-nombre">⭐ ${lugar.nombre}</span>
                <span class="item-visita-fecha">${visitado ? '✅ Visitado' : lugar.region}</span>
                <button class="btn-ir-mapa" title="Ver en el mapa" onclick="event.stopPropagation(); irAlLugar(${lugar.id})">
                    <i class="fas fa-map-location-dot"></i>
                </button>
                <button class="btn-ir-mapa btn-quitar-fav" title="Quitar de favoritos" onclick="event.stopPropagation(); manejarFavorito(${lugar.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function actualizarBotonCompartir() {
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

// ================================================================
// 14. RUTAS TURÍSTICAS
// ================================================================
function calcularDistanciaRutaKm(ruta) {
    if (!ruta || !ruta.lugares_ids || ruta.lugares_ids.length < 2) return null;
    let totalMetros = 0;
    for (let i = 0; i < ruta.lugares_ids.length - 1; i++) {
        const l1 = lugares.find(l => l.id === ruta.lugares_ids[i]);
        const l2 = lugares.find(l => l.id === ruta.lugares_ids[i + 1]);
        if (l1 && l2) {
            totalMetros += calcularDistancia(l1.lat, l1.lng, l2.lat, l2.lng);
        }
    }
    return Math.round(totalMetros / 1000);
}

function actualizarRutas() {
    const container = document.getElementById('lista-rutas');
    if (!container) return;
    const visitas = obtenerVisitas();

    const badgeRutas = document.getElementById('badge-rutas');
    if (badgeRutas && rutas) {
        badgeRutas.textContent = rutas.length;
    }

    if (!rutas || rutas.length === 0) {
        container.innerHTML = `<div class="vacio"><i class="fas fa-route" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No hay rutas disponibles</div>`;
        return;
    }

    let rutasFiltradas = [...rutas];

    // Filtro por texto
    if (filtroRutaTexto) {
        const texto = filtroRutaTexto.toLowerCase();
        rutasFiltradas = rutasFiltradas.filter(r =>
            r.nombre.toLowerCase().includes(texto) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(texto)) ||
            (r.region && r.region.toLowerCase().includes(texto)) ||
            (r.categoria && r.categoria.toLowerCase().includes(texto))
        );
    }

    // Filtro por estado / dificultad
    if (filtroRutaDificultad !== 'todas') {
        if (filtroRutaDificultad === 'completadas') {
            rutasFiltradas = rutasFiltradas.filter(r =>
                r.lugares_ids.length > 0 && r.lugares_ids.every(id => visitas.includes(id))
            );
        } else if (filtroRutaDificultad === 'pendientes') {
            rutasFiltradas = rutasFiltradas.filter(r =>
                !r.lugares_ids.every(id => visitas.includes(id))
            );
        } else {
            rutasFiltradas = rutasFiltradas.filter(r =>
                r.dificultad && r.dificultad.toLowerCase() === filtroRutaDificultad.toLowerCase()
            );
        }
    }

    if (rutasFiltradas.length === 0) {
        container.innerHTML = `<div class="vacio"><i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No se encontraron rutas con este criterio.</div>`;
        return;
    }

    const html = rutasFiltradas.map((ruta) => {
        const indexOriginal = rutas.indexOf(ruta);
        const total = ruta.lugares_ids.length;
        const completados = ruta.lugares_ids.filter(id => visitas.includes(id)).length;
        const porcentaje = Math.round((completados / total) * 100);
        const completada = completados === total && total > 0;
        const color = coloresRutas[indexOriginal % coloresRutas.length];
        const esVisible = rutaVisibleId === ruta.id;
        const distKm = calcularDistanciaRutaKm(ruta);

        const lugaresLista = ruta.lugares_ids.map(id => {
            const lugar = lugares.find(l => l.id === id);
            const visitado = visitas.includes(id);
            return lugar ?
                `<span class="ruta-lugar ${visitado ? 'completado' : ''}" onclick="irAlLugar(${id})" style="cursor:pointer;" title="${visitado ? 'Lugar visitado' : 'Pendiente de visita'}">
                    ${visitado ? '✅' : '📍'} ${lugar.nombre}
                </span>` :
                '';
        }).join('');

        const dificultadClass = ruta.dificultad ? `dificultad-${ruta.dificultad.toLowerCase()}` : '';

        return `
            <div class="card-ruta ${completada ? 'completada' : ''}" style="border-left-color: ${completada ? '#27ae60' : color}; ${esVisible ? `box-shadow: 0 0 0 2px ${color};` : ''}">
                <div class="ruta-header">
                    <div>
                        <div class="ruta-nombre">${ruta.nombre}</div>
                        <div class="ruta-chips" style="margin-top: 4px;">
                            ${ruta.dificultad ? `<span class="chip-ruta ${dificultadClass}">${ruta.dificultad}</span>` : ''}
                            ${ruta.duracion ? `<span class="chip-ruta"><i class="fas fa-clock"></i> ${ruta.duracion}</span>` : ''}
                            ${distKm ? `<span class="chip-ruta"><i class="fas fa-road"></i> ~${distKm} km</span>` : ''}
                            ${ruta.region ? `<span class="chip-ruta"><i class="fas fa-map-pin"></i> ${ruta.region}</span>` : ''}
                        </div>
                    </div>
                    <span class="ruta-progreso-badge">${completados}/${total} (${porcentaje}%)</span>
                </div>
                <div class="ruta-barra">
                    <div class="ruta-barra-relleno" style="width:${porcentaje}%;background:${completada ? '#27ae60' : color};"></div>
                </div>
                <div class="ruta-desc">${ruta.descripcion || ''}</div>
                <div class="ruta-lugares">${lugaresLista}</div>
                <div class="ruta-acciones">
                    <button class="btn-ver-ruta ${esVisible ? 'activa' : ''}" onclick="mostrarRutaEnMapa(${ruta.id})" style="border-color:${color};color:${esVisible ? 'white' : color};background:${esVisible ? color : 'transparent'};">
                        <i class="fas ${esVisible ? 'fa-eye-slash' : 'fa-map'}"></i> ${esVisible ? 'Ocultar del mapa' : 'Ver en el mapa'}
                    </button>
                    ${completada ? '<span style="color:#27ae60;font-weight:800;font-size:0.78rem;"><i class="fas fa-trophy"></i> ¡Ruta completada!</span>' : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ===== NUEVO: dibujar ruta en el mapa =====
function mostrarRutaEnMapa(rutaId) {
    if (rutaVisibleId === rutaId) {
        ocultarRutaEnMapa();
        actualizarRutas();
        return;
    }

    ocultarRutaEnMapa();

    const ruta = rutas.find(r => r.id === rutaId);
    if (!ruta) return;

    const index = rutas.indexOf(ruta);
    const color = coloresRutas[index % coloresRutas.length];
    const puntos = [];
    const marcadoresRuta = [];
    const visitas = obtenerVisitas();

    ruta.lugares_ids.forEach((id, i) => {
        const lugar = lugares.find(l => l.id === id);
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

    capaRutaActual = L.layerGroup([polyline, ...marcadoresRuta]).addTo(mapa);
    rutaVisibleId = rutaId;

    // Actualizar banner flotante en el mapa
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

    mapa.flyToBounds(polyline.getBounds().pad(0.25), { duration: 1.2 });

    actualizarRutas();
    mostrarToast(`🗺️ Mostrando ${ruta.nombre}`);
}

function ocultarRutaEnMapa() {
    if (capaRutaActual) {
        mapa.removeLayer(capaRutaActual);
        capaRutaActual = null;
    }
    rutaVisibleId = null;

    const banner = document.getElementById('banner-ruta-activa');
    if (banner) banner.classList.add('hidden');
}

function configurarBuscadorRutas() {
    const input = document.getElementById('buscador-rutas-input');
    const btnLimpiar = document.getElementById('buscador-rutas-limpiar');
    const filtrosContainer = document.getElementById('filtros-rutas');

    if (input) {
        input.addEventListener('input', (e) => {
            filtroRutaTexto = e.target.value.trim().toLowerCase();
            if (btnLimpiar) btnLimpiar.style.display = filtroRutaTexto ? 'block' : 'none';
            actualizarRutas();
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (input) input.value = '';
            filtroRutaTexto = '';
            btnLimpiar.style.display = 'none';
            actualizarRutas();
        });
    }

    if (filtrosContainer) {
        filtrosContainer.querySelectorAll('.filtro-ruta-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                filtrosContainer.querySelectorAll('.filtro-ruta-btn').forEach(b => b.classList.remove('activo'));
                this.classList.add('activo');
                filtroRutaDificultad = this.dataset.filtroRuta;
                actualizarRutas();
            });
        });
    }
}

// ================================================================
// 15. TABS (PESTAÑAS)
// ================================================================
function initTabs() {
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
                contents[key].classList.toggle('hidden', key !== tab);
            });

            // Repintar mapa ante posibles cambios de layout
            if (mapa) setTimeout(() => mapa.invalidateSize(), 60);

            if (tab === 'rutas') actualizarRutas();
        });
    });
}

// ================================================================
// 16. MODAL DE DETALLE DE LUGAR
// ================================================================
function abrirModalLugar(id) {
    const lugar = lugares.find(l => l.id === id);
    const modal = document.getElementById('modal-lugar');
    const body = document.getElementById('modal-body');
    if (!lugar || !modal || !body) return;

    const visitado = estaVisitado(id);
    const favorito = esFavorito(id);
    const fechas = obtenerFechasVisitas();
    const colorFondo = getColorCategoria(lugar.categoria);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lugar.lat},${lugar.lng}`)}`;

    let distanciaHtml = '';
    if (ubicacionUsuario) {
        const d = calcularDistancia(ubicacionUsuario.lat, ubicacionUsuario.lng, lugar.lat, lugar.lng);
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
                <button class="btn-checkin modal-btn-checkin ${visitado ? 'visitado' : ''}" onclick="hacerCheckIn(${lugar.id})">
                    ${visitado ? '<i class="fas fa-check"></i> Visitado' : '<i class="fas fa-location-dot"></i> Hacer Check-in'}
                </button>
                <button class="btn-favorito modal-btn-favorito ${favorito ? 'activo' : ''}" onclick="manejarFavorito(${lugar.id}); abrirModalLugar(${lugar.id});">
                    <i class="fas fa-star"></i> ${favorito ? 'Favorito' : 'Añadir a favoritos'}
                </button>
                <button class="btn-ver-mapa" onclick="cerrarModal(); irAlLugar(${lugar.id});">
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

function cerrarModal() {
    const modal = document.getElementById('modal-lugar');
    if (modal) modal.classList.add('hidden');
}

function initModal() {
    const modal = document.getElementById('modal-lugar');
    const btnCerrar = document.getElementById('modal-cerrar');
    if (!modal) return;

    btnCerrar.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModal();
    });
}

// ================================================================
// 17. ANIMACIÓN PULSO (CSS dinámico)
// ================================================================
function agregarAnimacionPulso() {
    const style = document.createElement('style');
    style.textContent = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(39,174,96,0.4); }
                70% { box-shadow: 0 0 0 15px rgba(39,174,96,0); }
                100% { box-shadow: 0 0 0 0 rgba(39,174,96,0); }
            }
        `;
    document.head.appendChild(style);
}

// ================================================================
// 18. INICIALIZAR FECHA DE INICIO
// ================================================================
function initFechaInicio() {
    if (!localStorage.getItem('peruTurismo_fechaInicio')) {
        localStorage.setItem('peruTurismo_fechaInicio', new Date().toISOString());
    }
}

// ================================================================
// 19. COMPARTIR PROGRESO
// ================================================================
function generarMensajeCompartir() {
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();
    const total = lugares.length;
    const visitados = visitas.length;

    if (visitados === 0) {
        alert('⚠️ Aún no has visitado ningún lugar.\n¡Explora Perú y haz check-in para compartir tu progreso!');
        return null;
    }

    const nombresVisitas = visitas.map(id => {
        const lugar = lugares.find(l => l.id === id);
        return lugar ? `📍 ${lugar.nombre}` : null;
    }).filter(Boolean);

    const joyasVisitadas = visitas.filter(id => {
        const lugar = lugares.find(l => l.id === id);
        return lugar && lugar.esJoyaOculta === true;
    });

    const logros = calcularLogros();
    const logrosLogrados = logros.filter(l => l.logrado).length;

    let emojiInicio = '🎒';
    if (visitados >= 30) emojiInicio = '👑';
    else if (visitados >= 15) emojiInicio = '🏆';
    else if (visitados >= 5) emojiInicio = '🌟';

    let mensaje = `${emojiInicio} ¡Mi aventura en PerúTurismo GO! 🇵🇪\n\n`;
    mensaje += `✅ He visitado ${visitados} de ${total} lugares increíbles:\n`;
    mensaje += nombresVisitas.slice(0, 10).join('\n');

    if (nombresVisitas.length > 10) {
        mensaje += `\n... y ${nombresVisitas.length - 10} más`;
    }

    mensaje += '\n';

    if (joyasVisitadas.length > 0) {
        mensaje += `\n💎 ¡He descubierto ${joyasVisitadas.length} Joya${joyasVisitadas.length > 1 ? 's' : ''} Ocult${joyasVisitadas.length > 1 ? 'as' : 'a'}!`;
    }

    if (favoritos.length > 0) {
        mensaje += `\n⭐ ${favoritos.length} lugares en mi lista de favoritos`;
    }

    mensaje += `\n🏆 ${logrosLogrados}/${logros.length} logros desbloqueados`;
    mensaje += `\n⚡ ${calcularPuntos()} pts · ${obtenerNivel(calcularPuntos()).nombre}`;

    const fechaInicio = localStorage.getItem('peruTurismo_fechaInicio');
    if (fechaInicio) {
        const dias = Math.floor((Date.now() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24));
        if (dias > 0) {
            mensaje += `\n📅 ${dias} día${dias > 1 ? 's' : ''} explorando Perú`;
        }
    }

    mensaje += '\n\n¡Descubre Perú conmigo! 👇';
    mensaje += '\n🔗 ' + window.location.href;

    return mensaje;
}

function compartirProgreso() {
    if (obtenerVisitas().length === 0) {
        generarMensajeCompartir();
        return;
    }

    const mensaje = generarMensajeCompartir();
    if (!mensaje) return;

    if (navigator.share) {
        navigator.share({
            title: 'Mi progreso en PerúTurismo GO',
            text: mensaje,
            url: window.location.href
        }).catch(err => {
            console.log('Error al compartir:', err);
            copiarAlPortapapeles(mensaje);
        });
    } else {
        copiarAlPortapapeles(mensaje);
    }
}

function copiarAlPortapapeles(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            mostrarToast('📋 ¡Mensaje copiado al portapapeles! Pégala donde quieras compartir.');
        }).catch(() => copiarConFallback(texto));
        return;
    }
    copiarConFallback(texto);
}

function copiarConFallback(texto) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copiado = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copiado) throw new Error('El navegador rechazó la copia');
        mostrarToast('📋 ¡Mensaje copiado al portapapeles!');
    } catch (error) {
        console.warn('No se pudo copiar el progreso:', error);
        mostrarToast('No se pudo copiar automáticamente. Selecciona y copia el mensaje manualmente.');
    }
}

function mostrarToast(mensaje, tipo = 'normal') {
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

// ================================================================
// 20. EXPORTAR / IMPORTAR PROGRESO
// ================================================================
function exportarProgreso() {
    const app = 'PerúTurismo GO';
    const version = 3;
    const exportado = new Date().toISOString();
    const datos = {
        app,
        version,
        exportado,
        visitas: obtenerVisitas(),
        favoritos: obtenerFavoritos(),
        fechasVisitas: obtenerFechasVisitas(),
        visitasPresenciales: obtenerVisitasPresenciales(),
        fechaInicio: localStorage.getItem('peruTurismo_fechaInicio')
    };

    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peruturismo-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarToast('💾 Progreso exportado como JSON');
}

function importarProgreso(archivo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const datos = JSON.parse(e.target.result);

            if (!datos || typeof datos !== 'object' || !Array.isArray(datos.visitas)) {
                throw new Error('El archivo no tiene un formato válido');
            }

            // Validar que los ids existan en los lugares cargados
            const idsValidos = new Set(lugares.map(l => l.id));
            const visitas = [...new Set(datos.visitas)].filter(id => idsValidos.has(id));
            const favoritos = Array.isArray(datos.favoritos) ?
                [...new Set(datos.favoritos)].filter(id => idsValidos.has(id)) : [];

            if (!confirm(`¿Importar ${visitas.length} visitas y ${favoritos.length} favoritos?` +
                `\nEsto reemplazará tu progreso actual.`)) {
                return;
            }

            guardarVisitas(visitas);
            guardarFavoritos(favoritos);

            if (datos.fechasVisitas && typeof datos.fechasVisitas === 'object') {
                const fechasLimpias = {};
                Object.keys(datos.fechasVisitas).forEach(key => {
                    const id = Number(key);
                    if (idsValidos.has(id) || idsValidos.has(key)) {
                        fechasLimpias[id] = datos.fechasVisitas[key];
                    }
                });
                localStorage.setItem('peruTurismo_fechasVisitas', JSON.stringify(fechasLimpias));
            }
            const presenciales = Array.isArray(datos.visitasPresenciales) ?
                [...new Set(datos.visitasPresenciales)].filter(id => visitas.includes(id) && idsValidos.has(id)) : [];
            guardarVisitasPresenciales(presenciales);
            if (datos.fechaInicio) {
                localStorage.setItem('peruTurismo_fechaInicio', datos.fechaInicio);
            }

            agregarMarcadores();
            actualizarUI();
            actualizarRutas();
            mostrarToast(`📥 Progreso importado: ${visitas.length} visitas`);
        } catch (error) {
            alert('⚠️ No se pudo importar el archivo.\n' + error.message);
        }
    };
    reader.readAsText(archivo);
}

// ================================================================
// 21. CONFIGURAR BUSCADOR
// ================================================================
function configurarBuscador() {
    const input = document.getElementById('buscador-input');
    const limpiarBtn = document.getElementById('buscador-limpiar');

    if (!input) return;

    input.addEventListener('input', function() {
        filtroBusqueda = this.value;
        limpiarBtn.style.display = this.value.length > 0 ? 'block' : 'none';
        actualizarUI();
    });

    limpiarBtn.addEventListener('click', function() {
        input.value = '';
        filtroBusqueda = '';
        this.style.display = 'none';
        actualizarUI();
        input.focus();
    });

    // Atajo: tecla / para buscar (no intercepta Ctrl+F del navegador)
    document.addEventListener('keydown', function(e) {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        input.focus();
        input.select();
    });
}

// ================================================================
// 22. CONFIGURAR ORDENAR
// ================================================================
function configurarOrdenar() {
    const select = document.getElementById('ordenar-select');
    if (!select) return;

    // Deshabilitar "cercanía" si no hay ubicación
    const opcionCercania = document.getElementById('opcion-cercania');
    if (opcionCercania) {
        opcionCercania.disabled = !ubicacionUsuario;
        opcionCercania.style.opacity = ubicacionUsuario ? '1' : '0.5';
    }

    select.addEventListener('change', function() {
        ordenActual = this.value;
        if (ordenActual === 'cercania' && !ubicacionUsuario) {
            mostrarToast('📍 Activa tu ubicación para ordenar por cercanía');
        }
        actualizarUI();
    });
}

// ================================================================
// 23. MODO OSCURO
// ================================================================
function initTema() {
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

function mostrarBienvenida() {
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

function aplicarTema(tema) {
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
    // Las teselas OSM son las mismas para ambos modos;
    // el CSS aplica filter: invert en body.dark .leaflet-tile-pane
    // Solo se necesita re-añadir si la capa fue eliminada externamente
    if (capaTeselas && mapa && temaTeselasAplicado !== tema) {
        temaTeselasAplicado = tema;
        // No se intercambia la URL; el cambio visual es puramente CSS
        setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 80);
    }
}

// ================================================================
// 24. ARRANQUE DE LA APP
// ================================================================
async function init() {
    if (localStorage.getItem('peruTurismo_tema') === 'oscuro') {
        document.body.classList.add('dark');
    }
    agregarAnimacionPulso();

    inicializarMapa();

    lugares = await cargarLugares();
    rutas = await cargarRutas();

    if (lugares.length === 0) {
        document.getElementById('lista-lugares').innerHTML =
            `<div class="vacio">⚠️ No se pudieron cargar los lugares.<br>Verifica que lugares.json exista.</div>`;
        return;
    }

    generarFiltros();
    generarFiltrosExplorador();
    generarFiltroRegion();

    agregarMarcadores();

    configurarBuscador();
    configurarFiltrosRapidos();
    configurarBuscadorRutas();
    configurarOrdenar();
    initModal();
    initTema();

    actualizarUI();
    actualizarRutas();

    initTabs();

    initFechaInicio();

    document.getElementById('btn-reiniciar').addEventListener('click', () => {
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

    document.getElementById('btn-compartir').addEventListener('click', compartirProgreso);

    document.getElementById('btn-exportar').addEventListener('click', exportarProgreso);

    const btnImportar = document.getElementById('btn-importar');
    const inputImportar = document.getElementById('input-importar');
    if (btnImportar && inputImportar) {
        btnImportar.addEventListener('click', () => inputImportar.click());
        inputImportar.addEventListener('change', function() {
            if (this.files.length > 0) {
                importarProgreso(this.files[0]);
                this.value = '';
            }
        });
    }

    mostrarBienvenida();

    console.log(`🗺️ PerúTurismo GO cargado con ${lugares.length} lugares y ${rutas.length} rutas`);
    console.log(`✅ ${obtenerVisitas().length} lugares visitados`);
}

// ================================================================
// 25. INICIAR
// ================================================================
document.addEventListener('DOMContentLoaded', init);
