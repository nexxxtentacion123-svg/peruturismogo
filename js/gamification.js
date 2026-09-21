/**
 * Módulo de Gamificación, Logros, Exportación/Importación y Compartir
 */

import {
    getState,
    obtenerVisitas,
    guardarVisitas,
    obtenerFavoritos,
    guardarFavoritos,
    obtenerFechasVisitas,
    obtenerVisitasPresenciales,
    guardarVisitasPresenciales,
    calcularPuntos,
    obtenerNivel,
    getLugarPorId
} from './state.js';
import { escaparHtml } from './utils/sanitize.js';

export function calcularLogros() {
    const { lugares, rutas } = getState();
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();
    const total = lugares.length;

    const joyasVisitadas = visitas.filter(id => {
        const lugar = getLugarPorId(id);
        return lugar && lugar.esJoyaOculta;
    }).length;

    const rutasCompletadas = rutas.filter(ruta =>
        ruta.lugares_ids.length > 0 && ruta.lugares_ids.every(id => visitas.includes(id))
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

export function actualizarLogros() {
    const container = document.getElementById('lista-logros');
    if (!container) return;
    const logros = calcularLogros();
    container.innerHTML = logros.map(logro => `
        <div class="logro ${logro.logrado ? 'logrado' : ''}" title="${escaparHtml(logro.desc)}">
            <span class="logro-icono">${logro.icono}</span>
            <div>
                <div class="logro-nombre">${escaparHtml(logro.nombre)}</div>
                <div class="logro-desc">${escaparHtml(logro.desc)}</div>
            </div>
        </div>
    `).join('');
}

export function exportarProgreso(mostrarToast) {
    const datos = {
        app: 'PerúTurismo GO',
        version: 3,
        exportado: new Date().toISOString(),
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

    if (mostrarToast) mostrarToast('💾 Progreso exportado como JSON');
}

export function importarProgreso(archivo, callbacks = {}) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const datos = JSON.parse(e.target.result);
            const { lugares } = getState();

            if (!datos || typeof datos !== 'object' || !Array.isArray(datos.visitas)) {
                throw new Error('El archivo no tiene un formato válido');
            }

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

            if (callbacks.onImportSuccess) callbacks.onImportSuccess(visitas.length);
        } catch (error) {
            alert('⚠️ No se pudo importar el archivo.\n' + error.message);
        }
    };
    reader.readAsText(archivo);
}

export function generarMensajeCompartir() {
    const { lugares } = getState();
    const visitas = obtenerVisitas();
    const favoritos = obtenerFavoritos();
    const total = lugares.length;
    const visitados = visitas.length;

    if (visitados === 0) {
        alert('⚠️ Aún no has visitado ningún lugar.\n¡Explora Perú y haz check-in para compartir tu progreso!');
        return null;
    }

    const nombresVisitas = visitas.map(id => {
        const lugar = getLugarPorId(id);
        return lugar ? `📍 ${lugar.nombre}` : null;
    }).filter(Boolean);

    const joyasVisitadas = visitas.filter(id => {
        const lugar = getLugarPorId(id);
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

export function compartirProgreso(mostrarToast) {
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
            copiarAlPortapapeles(mensaje, mostrarToast);
        });
    } else {
        copiarAlPortapapeles(mensaje, mostrarToast);
    }
}

export function copiarAlPortapapeles(texto, mostrarToast) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => {
            if (mostrarToast) mostrarToast('📋 ¡Mensaje copiado al portapapeles! Pégalo donde quieras compartir.');
        }).catch(() => copiarConFallback(texto, mostrarToast));
        return;
    }
    copiarConFallback(texto, mostrarToast);
}

function copiarConFallback(texto, mostrarToast) {
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
        if (mostrarToast) mostrarToast('📋 ¡Mensaje copiado al portapapeles!');
    } catch (error) {
        console.warn('No se pudo copiar el progreso:', error);
        if (mostrarToast) mostrarToast('No se pudo copiar automáticamente. Selecciona y copia el mensaje manualmente.');
    }
}
