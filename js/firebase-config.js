// Configuración pública de Firebase. No incluyas aquí claves privadas o
// secretos de OAuth; Firebase restringe el uso mediante dominios autorizados.
export const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'TU_FIREBASE_API_KEY',
    authDomain: 'TU_PROYECTO.firebaseapp.com',
    projectId: 'TU_PROYECTO',
    appId: 'TU_FIREBASE_APP_ID'
});

export const FIREBASE_CONFIGURED =
    !FIREBASE_CONFIG.apiKey.includes('TU_') &&
    !FIREBASE_CONFIG.authDomain.includes('TU_') &&
    !FIREBASE_CONFIG.projectId.includes('TU_') &&
    !FIREBASE_CONFIG.appId.includes('TU_');
