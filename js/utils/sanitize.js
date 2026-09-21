/**
 * Sanitiza valores de texto para prevenir inyección HTML (XSS).
 * @param {*} valor - Texto a sanitizar.
 * @returns {string} Texto sanitizado.
 */
export function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
