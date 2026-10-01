const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
    'https://peru-turismo-go.netlify.app'
]);

function normalizeOrigin(value) {
    try {
        return new URL(value).origin;
    } catch {
        return '';
    }
}

export function esOrigenOAuthPermitido(origin, allowedOrigins = DEFAULT_ALLOWED_ORIGINS) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return false;

    const url = new URL(normalizedOrigin);
    const isLocalDevelopment = url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const isNetlifyPreview = url.protocol === 'https:' &&
        /^[a-z0-9-]+--peru-turismo-go\.netlify\.app$/i.test(url.hostname);
    if (isLocalDevelopment || isNetlifyPreview) return true;

    return allowedOrigins
        .map(normalizeOrigin)
        .filter(Boolean)
        .includes(normalizedOrigin);
}

/**
 * Returns the current page only when its origin is an explicitly trusted
 * production origin or a loopback development origin.
 */
export function obtenerRedirectOAuth(locationLike, allowedOrigins = DEFAULT_ALLOWED_ORIGINS) {
    if (!locationLike?.href) return null;

    let current;
    try {
        current = new URL(locationLike.href);
    } catch {
        return null;
    }

    if (!['http:', 'https:'].includes(current.protocol) ||
        !esOrigenOAuthPermitido(current.origin, allowedOrigins)) {
        return null;
    }

    current.hash = '';
    return current.toString();
}
