import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { FIREBASE_CONFIG, FIREBASE_CONFIGURED } from './firebase-config.js';

const firebaseApp = FIREBASE_CONFIGURED ? initializeApp(FIREBASE_CONFIG) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let authInitialized = false;

export function usuarioActual() {
    return currentUser;
}

export async function guardarProgresoRemoto() {
    // Firebase Authentication no incluye base de datos. El progreso sigue
    // disponible localmente; Firestore puede añadirse después como alcance separado.
    return undefined;
}

function errorDeAuth(error) {
    const mensajes = {
        'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
        'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
        'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo de nuevo.',
        'auth/unauthorized-domain': 'Este dominio aún no está autorizado en Firebase Authentication.',
        'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'
    };
    return mensajes[error?.code] || 'No se pudo completar la autenticación. Inténtalo de nuevo.';
}

function renderAuth(user, callbacks) {
    currentUser = user || null;
    const overlay = document.getElementById('auth-overlay');
    const app = document.querySelector('.contenedor');
    const headerUser = document.getElementById('usuario-sesion');
    const openAuth = document.getElementById('btn-abrir-auth');
    const email = document.getElementById('usuario-email');
    const loggedIn = Boolean(currentUser);
    if (email) email.textContent = currentUser?.displayName || currentUser?.email || '';
    if (headerUser) headerUser.classList.toggle('hidden', !loggedIn);
    if (openAuth) openAuth.classList.toggle('hidden', loggedIn);
    if (overlay && loggedIn) overlay.classList.add('hidden');
    if (app) app.classList.remove('app-bloqueada');
    callbacks?.onAuthChange?.(currentUser);
}

export async function initAuth(callbacks = {}) {
    if (authInitialized) return;
    authInitialized = true;

    const form = document.getElementById('form-auth');
    const modeButton = document.getElementById('btn-cambiar-auth');
    const title = document.getElementById('auth-titulo');
    const submit = document.getElementById('btn-auth-submit');
    const errorBox = document.getElementById('auth-error');
    const logout = document.getElementById('btn-cerrar-sesion');
    const openAuth = document.getElementById('btn-abrir-auth');
    const closeAuth = document.getElementById('btn-cerrar-auth');
    const guestAuth = document.getElementById('btn-explorar-invitado');
    const googleAuth = document.getElementById('btn-auth-google');
    let mode = 'login';

    const showError = message => {
        if (!errorBox) return;
        errorBox.textContent = message || '';
        errorBox.classList.toggle('hidden', !message);
    };
    const setMode = () => {
        const register = mode === 'register';
        if (title) title.textContent = register ? 'Crea tu cuenta de explorador' : 'Inicia tu expedición';
        if (submit) submit.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
        if (modeButton) modeButton.textContent = register ? 'Ya tengo una cuenta' : 'Crear una cuenta';
        document.getElementById('auth-confirm-wrap')?.classList.toggle('hidden', !register);
        document.getElementById('auth-username-wrap')?.classList.toggle('hidden', !register);
    };
    const openDialog = () => {
        document.getElementById('auth-overlay')?.classList.remove('hidden');
        document.getElementById('auth-email')?.focus();
    };
    const closeDialog = () => document.getElementById('auth-overlay')?.classList.add('hidden');

    openAuth?.addEventListener('click', openDialog);
    closeAuth?.addEventListener('click', closeDialog);
    guestAuth?.addEventListener('click', closeDialog);
    document.getElementById('auth-overlay')?.addEventListener('click', event => {
        if (event.target.id === 'auth-overlay') closeDialog();
    });

    if (!firebaseAuth) {
        showError('Configura js/firebase-config.js para activar la autenticación.');
        googleAuth?.setAttribute('disabled', '');
        renderAuth(null, callbacks);
        setMode();
        return;
    }

    modeButton?.addEventListener('click', () => {
        mode = mode === 'login' ? 'register' : 'login';
        showError('');
        setMode();
    });

    googleAuth?.addEventListener('click', async () => {
        showError('');
        if (!navigator.onLine) {
            showError('No hay conexión. Conéctate a internet para continuar con Google.');
            return;
        }
        googleAuth.disabled = true;
        try {
            await signInWithPopup(firebaseAuth, googleProvider);
            callbacks.mostrarToast?.('👋 Bienvenido a PerúTurismo GO');
        } catch (error) {
            console.error('Error iniciando sesión con Google:', error);
            showError(errorDeAuth(error));
        } finally {
            googleAuth.disabled = false;
        }
    });

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        showError('');
        const data = new FormData(form);
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');
        const requestedUsername = String(data.get('username') || '').trim();
        if (mode === 'register' && !/^[a-z0-9._-]{3,24}$/i.test(requestedUsername)) {
            showError('El username debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.');
            return;
        }
        if (mode === 'register' && password !== String(data.get('confirmPassword') || '')) {
            showError('Las contraseñas no coinciden.');
            return;
        }
        submit.disabled = true;
        try {
            const credential = mode === 'register'
                ? await createUserWithEmailAndPassword(firebaseAuth, email, password)
                : await signInWithEmailAndPassword(firebaseAuth, email, password);
            if (mode === 'register' && requestedUsername) {
                await updateProfile(credential.user, { displayName: requestedUsername });
            }
            form.reset();
            closeDialog();
            callbacks.mostrarToast?.('👋 Bienvenido a PerúTurismo GO');
        } catch (error) {
            console.error('Error de autenticación:', error);
            showError(errorDeAuth(error));
        } finally {
            submit.disabled = false;
        }
    });

    logout?.addEventListener('click', async () => {
        showError('');
        try {
            await signOut(firebaseAuth);
            callbacks.mostrarToast?.('Sesión cerrada');
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            showError(errorDeAuth(error));
        }
    });

    onAuthStateChanged(firebaseAuth, user => renderAuth(user, callbacks));
    setMode();
}
