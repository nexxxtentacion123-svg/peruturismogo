/**
 * Asistente turístico local: recomendaciones deterministas, sin IA ni red.
 */

const INTEREST_MATCHERS = {
    cultura: ['cultural', 'historia', 'cultura', 'arqueolog', 'museo', 'patrimonio'],
    naturaleza: ['naturaleza', 'parque', 'reserva', 'laguna', 'cascad', 'playa', 'valle'],
    aventura: ['aventura', 'montaña', 'cañón', 'desierto', 'trekking', 'surf'],
    gastronomia: ['gastronom', 'comida', 'sabor', 'pisco', 'mercado'],
    urbano: ['urbano', 'ciudad', 'barrio', 'plaza']
};

const BUDGET_LIMITS = {
    economico: 25,
    moderado: 80,
    flexible: Number.POSITIVE_INFINITY
};

export const ASSISTANT_STEPS = [
    { id: 'presupuesto', label: 'presupuesto' },
    { id: 'fechas', label: 'fechas y duración' },
    { id: 'salida', label: 'ciudad de salida' },
    { id: 'intereses', label: 'intereses' },
    { id: 'ritmo', label: 'ritmo' },
    { id: 'transporte', label: 'transporte' }
];

export const ASSISTANT_OPTIONS = {
    presupuesto: [
        { value: 'economico', label: 'Económico', hint: 'Hasta S/ 25 por entrada registrada' },
        { value: 'moderado', label: 'Moderado', hint: 'Hasta S/ 80 por entrada registrada' },
        { value: 'flexible', label: 'Flexible', hint: 'Sin tope de entrada en el catálogo' }
    ],
    ritmo: [
        { value: 'tranquilo', label: 'Tranquilo', hint: 'Pocos lugares y tiempo para disfrutarlos' },
        { value: 'equilibrado', label: 'Equilibrado', hint: 'Un plan variado' },
        { value: 'intenso', label: 'Intenso', hint: 'Aprovechar cada jornada' }
    ],
    transporte: [
        { value: 'publico', label: 'Transporte público', hint: 'Prioriza lugares con indicaciones registradas' },
        { value: 'mixto', label: 'Mixto', hint: 'Público, taxi o caminata' },
        { value: 'privado', label: 'Movilidad privada', hint: 'Auto o traslado contratado' }
    ]
};

function textoLugar(lugar) {
    return [
        lugar.nombre,
        lugar.descripcion,
        lugar.categoria,
        lugar.region,
        ...(Array.isArray(lugar.tiposExplorador) ? lugar.tiposExplorador : []),
        ...(Array.isArray(lugar.etiquetas) ? lugar.etiquetas : [])
    ].filter(Boolean).join(' ').toLocaleLowerCase('es-PE');
}

function numeroPrecio(precio) {
    if (!precio || /gratis|free/i.test(String(precio))) return 0;
    const encontrados = String(precio).match(/(?:S\/|s\/)?\s*(\d+(?:[.,]\d+)?)/g);
    if (!encontrados) return null;
    const numeros = encontrados
        .map(valor => Number.parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.')))
        .filter(Number.isFinite);
    return numeros.length ? Math.min(...numeros) : null;
}

export function formatearRangoCosto(precio) {
    const valor = numeroPrecio(precio);
    if (valor === null) return 'No registrado en el catálogo';
    if (valor === 0) return 'Gratis';
    if (valor <= 25) return 'S/ 1–25';
    if (valor <= 80) return 'S/ 26–80';
    return 'S/ 81 a más';
}

function normalizarIntereses(intereses) {
    return Array.isArray(intereses) ? intereses.filter(Boolean).map(String) : [];
}

export function normalizarPerfil(perfil = {}) {
    return {
        presupuesto: perfil.presupuesto || 'flexible',
        fechas: perfil.fechas || '',
        duracion: perfil.duracion || '',
        salida: String(perfil.salida || '').trim(),
        intereses: normalizarIntereses(perfil.intereses),
        ritmo: perfil.ritmo || 'equilibrado',
        transporte: perfil.transporte || 'mixto'
    };
}

function coincideInteres(lugar, interes) {
    const texto = textoLugar(lugar);
    const patrones = INTEREST_MATCHERS[interes] || [String(interes).toLocaleLowerCase('es-PE')];
    return patrones.some(patron => texto.includes(patron));
}

function coincideSalida(lugar, salida) {
    if (!salida) return false;
    const termino = salida.toLocaleLowerCase('es-PE');
    return [lugar.region, lugar.provincia, lugar.distrito]
        .filter(Boolean)
        .some(valor => String(valor).toLocaleLowerCase('es-PE').includes(termino) || termino.includes(String(valor).toLocaleLowerCase('es-PE')));
}

function coincideTransporte(lugar, transporte) {
    if (transporte !== 'publico') return false;
    return Boolean(lugar.transportePublico || lugar.como_llegar);
}

function puntuar(lugar, perfil) {
    const intereses = perfil.intereses.filter(interes => coincideInteres(lugar, interes));
    const salida = coincideSalida(lugar, perfil.salida);
    const transporte = coincideTransporte(lugar, perfil.transporte);
    const precio = numeroPrecio(lugar.precio);
    const limite = BUDGET_LIMITS[perfil.presupuesto] ?? BUDGET_LIMITS.flexible;
    const dentroPresupuesto = precio === null || precio <= limite;

    return {
        lugar,
        intereses,
        salida,
        transporte,
        precio,
        dentroPresupuesto,
        puntuacion: intereses.length * 5 + (salida ? 3 : 0) + (transporte ? 2 : 0) + (dentroPresupuesto ? 1 : 0)
    };
}

export function recomendarDestinos(catalogo = [], perfil = {}, limite = 5) {
    const perfilNormalizado = normalizarPerfil(perfil);
    const maximo = Math.min(5, Math.max(3, Number.isFinite(limite) ? Math.floor(limite) : 5));
    const lugares = Array.isArray(catalogo) ? catalogo.filter(lugar => lugar && lugar.id !== undefined) : [];
    if (!lugares.length) return [];

    const evaluados = lugares.map(lugar => puntuar(lugar, perfilNormalizado));
    const dentro = evaluados.filter(item => item.dentroPresupuesto);
    const hayTransporteRegistrado = lugares.some(lugar => lugar.transportePublico || lugar.como_llegar);
    const conTransporte = perfilNormalizado.transporte === 'publico' && hayTransporteRegistrado
        ? dentro.filter(item => item.transporte)
        : dentro;
    const conIntereses = perfilNormalizado.intereses.length
        ? conTransporte.filter(item => item.intereses.length > 0)
        : conTransporte;
    const base = conIntereses;

    return base
        .sort((a, b) => b.puntuacion - a.puntuacion || String(a.lugar.nombre).localeCompare(String(b.lugar.nombre), 'es'))
        .slice(0, maximo)
        .map(item => ({
            ...item,
            explicacion: crearExplicacion(item, perfilNormalizado),
            costoEstimado: formatearRangoCosto(item.lugar.precio),
            precioRegistrado: item.lugar.precio || 'No registrado en el catálogo'
        }));
}

function crearExplicacion(item, perfil) {
    const razones = [];
    if (item.intereses.length) razones.push(`coincide con ${item.intereses.join(', ')}`);
    if (item.salida) razones.push(`está en la zona de salida (${perfil.salida})`);
    if (item.dentroPresupuesto && item.precio !== null) razones.push('su precio registrado entra en tu presupuesto');
    if (perfil.transporte === 'publico' && item.transporte) razones.push('tiene indicaciones de transporte público');
    if (!razones.length) razones.push('es una opción disponible en el catálogo local');
    return razones.join('; ') + '.';
}

export function obtenerLimitaciones(perfil = {}, catalogo = []) {
    const limitaciones = [];
    const tieneCampo = campo => Array.isArray(catalogo) && catalogo.some(lugar => lugar && lugar[campo] !== undefined && lugar[campo] !== '');
    if (!tieneCampo('duracion')) limitaciones.push('La duración del viaje se usa como contexto, pero el catálogo no registra duración por destino.');
    if (!tieneCampo('ritmo')) limitaciones.push('El ritmo se usa como preferencia, pero el catálogo no registra ritmo por destino.');
    if (!tieneCampo('salida') && perfil.salida) limitaciones.push('La ciudad de salida no tiene rutas ni distancias registradas; se muestra como referencia.');
    limitaciones.push('Los costos son rangos basados en el precio publicado en el catálogo; verifica precios, horarios y accesos antes de viajar.');
    return limitaciones;
}
