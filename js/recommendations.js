/**
 * Recomendador local y determinista para el planificador de viajes.
 * No usa APIs externas: trabaja únicamente con el catálogo público cargado.
 */

const COSTE_BASE = {
    bajo: 120,
    medio: 320,
    alto: 750
};

function normalizar(valor) {
    return String(valor || '').toLocaleLowerCase('es');
}

function estimarCosto(lugar) {
    const precio = normalizar(lugar.precio);
    if (precio.includes('gratis')) return 0;
    const encontrado = precio.match(/(?:s\/|s\/\.|\$)\s*(\d+(?:[.,]\d+)?)/i);
    if (encontrado) return Number(encontrado[1].replace(',', '.'));
    if (normalizar(lugar.categoria).includes('aventura')) return 420;
    if (normalizar(lugar.categoria).includes('museo')) return 180;
    return 120;
}

function puntuar(lugar, preferencias) {
    const texto = normalizar([
        lugar.nombre,
        lugar.descripcion,
        lugar.categoria,
        ...(lugar.tiposExplorador || []),
        ...(lugar.etiquetas || [])
    ].join(' '));
    const intereses = preferencias.intereses.filter(Boolean);
    const coincidencias = intereses.reduce((total, interes) => (
        total + (texto.includes(normalizar(interes)) ? 1 : 0)
    ), 0);
    const costo = estimarCosto(lugar);
    const presupuesto = COSTE_BASE[preferencias.presupuesto] || COSTE_BASE.medio;
    const ajustePresupuesto = costo <= presupuesto ? 3 : -2;
    const cercania = preferencias.region && normalizar(lugar.region) === normalizar(preferencias.region) ? 3 : 0;
    const joya = preferencias.ritmo === 'tranquilo' && lugar.esJoyaOculta ? 2 : 0;
    return coincidencias * 5 + ajustePresupuesto + cercania + joya;
}

export function recomendarLugares(lugares, preferencias, limite = 3) {
    if (!Array.isArray(lugares)) return [];
    return lugares
        .map(lugar => ({ lugar, puntuacion: puntuar(lugar, preferencias) }))
        .sort((a, b) => b.puntuacion - a.puntuacion || String(a.lugar.nombre).localeCompare(String(b.lugar.nombre), 'es'))
        .slice(0, limite)
        .map(({ lugar }) => ({
            ...lugar,
            costoEstimado: estimarCosto(lugar)
        }));
}

export function crearExplicacion(lugar, preferencias) {
    const razones = [];
    if (preferencias.intereses.some(interes => normalizar(lugar.categoria).includes(normalizar(interes)))) {
        razones.push(`encaja con tu interés por ${preferencias.intereses.filter(Boolean).join(' y ')}`);
    }
    if (preferencias.region && normalizar(lugar.region) === normalizar(preferencias.region)) {
        razones.push(`está en ${lugar.region}`);
    }
    if (lugar.costoEstimado <= COSTE_BASE[preferencias.presupuesto]) {
        razones.push('entra en tu rango de presupuesto orientativo');
    }
    return razones.length ? `${razones[0][0].toUpperCase()}${razones[0].slice(1)}.` : 'Es una opción destacada del catálogo para comenzar a explorar.';
}

export function obtenerPresupuestoTexto(presupuesto) {
    return {
        bajo: 'económico (hasta aprox. S/ 200 por actividad)',
        medio: 'moderado (hasta aprox. S/ 600 por actividad)',
        alto: 'amplio (más de S/ 600 por actividad)'
    }[presupuesto] || 'moderado';
}
