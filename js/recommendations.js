/**
 * Recomendador local y determinista. No usa APIs externas ni inventa destinos.
 */
const INTEREST_MATCHERS = {
    Cultural: ['cultural', 'historia', 'cultura', 'arqueolog', 'museo', 'patrimonio'],
    Naturaleza: ['naturaleza', 'parque', 'reserva', 'laguna', 'cascad', 'playa', 'valle'],
    Aventura: ['aventura', 'montaña', 'cañón', 'desierto', 'trekking', 'surf'],
    Gastronómica: ['gastronom', 'comida', 'sabor', 'pisco', 'mercado'],
    Urbana: ['urbano', 'ciudad', 'barrio', 'plaza']
};

const BUDGET_LIMITS = { bajo: 25, medio: 80, alto: Number.POSITIVE_INFINITY };

function normalizar(valor) {
    return String(valor || '').toLocaleLowerCase('es-PE');
}

function estimarCosto(lugar) {
    const precio = normalizar(lugar.precio);
    if (!precio) return null;
    if (precio.includes('gratis')) return 0;
    const encontrados = precio.match(/(?:s\/|s\/\.|\$)?\s*(\d+(?:[.,]\d+)?)/g);
    if (!encontrados) return null;
    const numeros = encontrados.map(valor => Number.parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'))).filter(Number.isFinite);
    return numeros.length ? Math.min(...numeros) : null;
}

export function formatearRangoCosto(precio) {
    const valor = estimarCosto({ precio });
    if (valor === null) return 'No registrado en el catálogo';
    if (valor === 0) return 'Gratis';
    if (valor <= 25) return 'S/ 1–25';
    if (valor <= 80) return 'S/ 26–80';
    return 'S/ 81 a más';
}

export function normalizarPreferencias(preferencias = {}) {
    return {
        presupuesto: preferencias.presupuesto || 'medio',
        dias: preferencias.dias || '',
        fechas: preferencias.fechas || '',
        region: String(preferencias.region || '').trim(),
        salida: String(preferencias.salida || '').trim(),
        intereses: Array.isArray(preferencias.intereses) ? preferencias.intereses.filter(Boolean) : [],
        ritmo: preferencias.ritmo || 'activo',
        transporte: preferencias.transporte || 'mixto'
    };
}

function textoLugar(lugar) {
    return [
        lugar.nombre, lugar.descripcion, lugar.categoria, lugar.region,
        ...(lugar.tiposExplorador || []), ...(lugar.etiquetas || [])
    ].filter(Boolean).join(' ');
}

function coincideInteres(lugar, interes) {
    const patrones = INTEREST_MATCHERS[interes] || [normalizar(interes)];
    const texto = normalizar(textoLugar(lugar));
    return patrones.some(patron => texto.includes(normalizar(patron)));
}

function coincideZona(lugar, zona) {
    if (!zona) return false;
    const termino = normalizar(zona);
    return [lugar.region, lugar.provincia, lugar.distrito].filter(Boolean)
        .some(valor => normalizar(valor).includes(termino) || termino.includes(normalizar(valor)));
}

function puntuar(lugar, preferencias) {
    const intereses = preferencias.intereses.filter(interes => coincideInteres(lugar, interes));
    const zona = coincideZona(lugar, preferencias.region || preferencias.salida);
    const transporte = preferencias.transporte === 'publico' && Boolean(lugar.transportePublico || lugar.como_llegar);
    const costo = estimarCosto(lugar);
    const limite = BUDGET_LIMITS[preferencias.presupuesto] ?? BUDGET_LIMITS.medio;
    const dentroPresupuesto = costo === null || costo <= limite;
    return {
        lugar, intereses, zona, transporte, costo, dentroPresupuesto,
        puntuacion: intereses.length * 5 + (zona ? 3 : 0) + (transporte ? 2 : 0) + (dentroPresupuesto ? 1 : 0)
    };
}

export function recomendarLugares(lugares, preferencias = {}, limite = 5) {
    if (!Array.isArray(lugares) || !lugares.length) return [];
    const perfil = normalizarPreferencias(preferencias);
    const maximo = Math.min(5, Math.max(3, Number.isFinite(limite) ? Math.floor(limite) : 5));
    const evaluados = lugares.filter(Boolean).map(lugar => puntuar(lugar, perfil));
    const dentro = evaluados.filter(item => item.dentroPresupuesto);
    const conIntereses = perfil.intereses.length ? dentro.filter(item => item.intereses.length) : dentro;
    const hayTransporte = lugares.some(lugar => lugar.transportePublico || lugar.como_llegar);
    const base = perfil.transporte === 'publico' && hayTransporte ? conIntereses.filter(item => item.transporte) : conIntereses;
    return base.sort((a, b) => b.puntuacion - a.puntuacion || String(a.lugar.nombre).localeCompare(String(b.lugar.nombre), 'es'))
        .slice(0, maximo)
        .map(item => ({
            ...item.lugar,
            costoEstimado: item.costo,
            costoRango: formatearRangoCosto(item.lugar.precio),
            _coincidencias: item.intereses,
            _coincideZona: item.zona,
            _coincideTransporte: item.transporte,
            _dentroPresupuesto: item.dentroPresupuesto
        }));
}

export function crearExplicacion(lugar, preferencias = {}) {
    const perfil = normalizarPreferencias(preferencias);
    const razones = [];
    if (lugar._coincidencias?.length) razones.push(`coincide con ${lugar._coincidencias.join(', ')}`);
    if (lugar._coincideZona) razones.push(`está en la zona de salida o región elegida (${perfil.region || perfil.salida})`);
    if (lugar._dentroPresupuesto && lugar.costoEstimado !== null) razones.push('su precio registrado entra en tu presupuesto');
    if (perfil.transporte === 'publico' && lugar._coincideTransporte) razones.push('tiene indicaciones de transporte público');
    return `${razones.length ? razones.join('; ') : 'es una opción disponible en el catálogo local'}.`;
}

export function obtenerLimitaciones(preferencias = {}, lugares = []) {
    const campoExiste = campo => lugares.some(lugar => lugar && lugar[campo] !== undefined && lugar[campo] !== '');
    const limitaciones = [];
    if (!campoExiste('duracion')) limitaciones.push('La duración se usa como contexto, pero no está registrada por destino.');
    if (!campoExiste('ritmo')) limitaciones.push('El ritmo se usa como preferencia, pero no está registrado por destino.');
    if (preferencias.salida && !lugares.some(lugar => coincideZona(lugar, preferencias.salida))) {
        limitaciones.push('No hay rutas ni distancias desde esa ciudad; la salida se muestra como referencia.');
    }
    limitaciones.push('Los costos son rangos del catálogo: verifica precios, horarios, transporte y accesos antes de viajar.');
    return limitaciones;
}

export function obtenerPresupuestoTexto(presupuesto) {
    return { bajo: 'económico', medio: 'moderado', alto: 'amplio' }[presupuesto] || 'moderado';
}
