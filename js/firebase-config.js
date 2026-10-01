// Configuración pública de Firebase. No incluyas aquí claves privadas o
// secretos de OAuth; Firebase restringe el uso mediante dominios autorizados.
export const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyAteNAYvm5Dp1BaWNz-aiCSIZAGQd-LC4A',
    authDomain: 'peru-turismo-go.firebaseapp.com',
    projectId: 'peru-turismo-go',
    appId: '1:523565304895:web:379bc88a87173ae7373c8a'
});

export const FIREBASE_CONFIGURED =
    !FIREBASE_CONFIG.apiKey.includes('TU_') &&
    !FIREBASE_CONFIG.authDomain.includes('TU_') &&
    !FIREBASE_CONFIG.projectId.includes('TU_') &&
    !FIREBASE_CONFIG.appId.includes('TU_');
