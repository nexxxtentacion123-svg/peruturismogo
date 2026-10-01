const EARTH_RADIUS_KM = 6371;
const DUPLICATE_NAME_DISTANCE_KM = 8;
// Nearby attractions can legitimately share a city block; only effectively
// identical coordinates are suspicious without stronger duplicate evidence.
const SUSPICIOUS_COORDINATE_DISTANCE_KM = 0.001;
const COMBINABLE_TEXT_FIELDS = new Set([
    'descripcion', 'horario', 'precio', 'como_llegar', 'transportePublico', 'tipLocal'
]);

export function normalizeCatalogName(name) {
    return String(name ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function distanciaCatalogo(a, b) {
    const toRadians = value => value * Math.PI / 180;
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLat = lat2 - lat1;
    const dLng = toRadians(b.lng) - toRadians(a.lng);
    const haversine = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(haversine));
}

function tieneCoordenadas(lugar) {
    return Number.isFinite(lugar?.lat) && Number.isFinite(lugar?.lng);
}

function esMismoLugar(a, b) {
    return tieneCoordenadas(a) && tieneCoordenadas(b)
        && distanciaCatalogo(a, b) <= DUPLICATE_NAME_DISTANCE_KM;
}

function fusionar(a, b) {
    const resultado = { ...a };
    for (const [clave, valor] of Object.entries(b)) {
        const actual = resultado[clave];
        if (Array.isArray(actual) && Array.isArray(valor)) {
            resultado[clave] = [...new Map(
                [...actual, ...valor].map(item => [JSON.stringify(item), item])
            ).values()];
        } else if (actual === undefined || actual === null || actual === '') {
            resultado[clave] = valor;
        } else if (COMBINABLE_TEXT_FIELDS.has(clave) &&
            typeof actual === 'string' && typeof valor === 'string' &&
            actual.trim() !== valor.trim()) {
            resultado[clave] = `${actual.trim()} | ${valor.trim()}`;
        }
    }
    return resultado;
}

/**
 * Keeps the first catalog order as the canonical record for an unambiguous
 * same-name duplicate, then fills only missing fields from later records.
 */
export function consolidarCatalogo(lugares) {
    const porId = new Map();
    for (const lugar of lugares.filter(Boolean)) {
        if (!porId.has(lugar.id)) porId.set(lugar.id, lugar);
        else porId.set(lugar.id, fusionar(porId.get(lugar.id), lugar));
    }

    const resultado = [];
    const porNombre = new Map();
    for (const lugar of porId.values()) {
        const clave = normalizeCatalogName(lugar.nombre);
        const previo = porNombre.get(clave);
        if (!clave || !previo || !esMismoLugar(previo, lugar)) {
            resultado.push(lugar);
            if (clave && !previo) porNombre.set(clave, lugar);
            continue;
        }
        const indice = resultado.indexOf(previo);
        resultado[indice] = fusionar(previo, lugar);
        porNombre.set(clave, resultado[indice]);
    }
    return resultado;
}

export function validarCatalogo(lugares) {
    const errores = [];
    const ids = new Map();
    const nombres = new Map();
    lugares.forEach((lugar, indice) => {
        if (ids.has(lugar.id)) errores.push(`ID duplicado ${lugar.id} (filas ${ids.get(lugar.id) + 1} y ${indice + 1})`);
        else ids.set(lugar.id, indice);
        const clave = normalizeCatalogName(lugar.nombre);
        if (clave) nombres.set(clave, [...(nombres.get(clave) ?? []), lugar]);
    });

    for (const [nombre, grupo] of nombres) {
        for (let i = 0; i < grupo.length; i++) {
            for (let j = i + 1; j < grupo.length; j++) {
                if (esMismoLugar(grupo[i], grupo[j])) {
                    errores.push(`Nombre duplicado sin resolver: "${nombre}" (IDs ${grupo[i].id} y ${grupo[j].id})`);
                }
            }
        }
    }
    for (let i = 0; i < lugares.length; i++) {
        for (let j = i + 1; j < lugares.length; j++) {
            if (tieneCoordenadas(lugares[i]) && tieneCoordenadas(lugares[j])
                && lugares[i].id !== lugares[j].id
                && distanciaCatalogo(lugares[i], lugares[j]) <= SUSPICIOUS_COORDINATE_DISTANCE_KM) {
                errores.push(`Coordenadas sospechosamente repetidas (IDs ${lugares[i].id} y ${lugares[j].id})`);
            }
        }
    }
    return errores;
}

export function assertCatalogoValido(lugares) {
    const errores = validarCatalogo(lugares);
    if (errores.length) throw new Error(errores.join('\n'));
    return true;
}
