import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { guardarStorageJson, leerStorageJson } from './state.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from './supabase-config.js';

export const supabase = SUPABASE_CONFIGURED
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let session = null;
let syncTimer = null;
let syncInFlight = null;
let username = '';

export function usuarioActual() {
    return session?.user || null;
}

function progresoLocal() {
    return {
        visitas: leerStorageJson('peruTurismo_visitas', []),
        favoritos: leerStorageJson('peruTurismo_favoritos', []),
        fechasVisitas: leerStorageJson('peruTurismo_fechasVisitas', {}),
        visitasPresenciales: leerStorageJson('peruTurismo_visitasPresenciales', []),
        fechaInicio: localStorage.getItem('peruTurismo_fechaInicio')
    };
}

async function guardarPerfilUsuario(user, nombreUsuario = '') {
    if (!supabase || !user) return;
    const nombre = String(nombreUsuario || user.user_metadata?.username || '').trim().toLowerCase();
    if (!nombre) return;
    const { error } = await supabase.from('perfiles').upsert({
        id: user.id,
        username: nombre,
        progreso: progresoLocal(),
        actualizado_en: new Date().toISOString()
    });
    if (error) console.warn('No se pudo guardar el username:', error.message);
}

function aplicarProgreso(progreso) {
    if (!progreso) return;
    if (Array.isArray(progreso.visitas)) guardarStorageJson('peruTurismo_visitas', progreso.visitas);
    if (Array.isArray(progreso.favoritos)) guardarStorageJson('peruTurismo_favoritos', progreso.favoritos);
    if (progreso.fechasVisitas) guardarStorageJson('peruTurismo_fechasVisitas', progreso.fechasVisitas);
    if (Array.isArray(progreso.visitasPresenciales)) guardarStorageJson('peruTurismo_visitasPresenciales', progreso.visitasPresenciales);
    if (progreso.fechaInicio) localStorage.setItem('peruTurismo_fechaInicio', progreso.fechaInicio);
}

export async function guardarProgresoRemoto() {
    if (!supabase || !session?.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        if (syncInFlight) return;
        syncInFlight = supabase.from('perfiles').upsert({
            id: session.user.id,
            progreso: progresoLocal(),
            actualizado_en: new Date().toISOString()
        }).then(({ error }) => {
            if (error) {
                console.warn('No se pudo sincronizar el progreso:', error.message);
                window.dispatchEvent(new CustomEvent('peruturismo:sync-error', {
                    detail: { message: error.message }
                }));
            }
        }).catch(error => {
            console.warn('No se pudo sincronizar el progreso:', error);
            window.dispatchEvent(new CustomEvent('peruturismo:sync-error', {
                detail: { message: error instanceof Error ? error.message : 'Error de red' }
            }));
        }).finally(() => {
            syncInFlight = null;
        });
        await syncInFlight;
    }, 450);
}

async function cargarProgresoRemoto(userId) {
    const { data, error } = await supabase
        .from('perfiles')
        .select('progreso')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    return data?.progreso || null;
}

function renderAuth(userSession, callbacks) {
    session = userSession;
    const overlay = document.getElementById('auth-overlay');
    const app = document.querySelector('.contenedor');
    const headerUser = document.getElementById('usuario-sesion');
    const openAuth = document.getElementById('btn-abrir-auth');
    const email = document.getElementById('usuario-email');
    const loggedIn = Boolean(session?.user);
    if (email) email.textContent = username || session?.user?.email || '';
    if (headerUser) headerUser.classList.toggle('hidden', !loggedIn);
    if (openAuth) openAuth.classList.toggle('hidden', loggedIn);
    if (overlay) overlay.classList.add('hidden');
    if (app) app.classList.remove('app-bloqueada');
    callbacks?.onAuthChange?.(session);
}

export async function initAuth(callbacks = {}) {
    const form = document.getElementById('form-auth');
    const modeButton = document.getElementById('btn-cambiar-auth');
    const title = document.getElementById('auth-titulo');
    const submit = document.getElementById('btn-auth-submit');
    const errorBox = document.getElementById('auth-error');
    const logout = document.getElementById('btn-cerrar-sesion');
    const openAuth = document.getElementById('btn-abrir-auth');
    const closeAuth = document.getElementById('btn-cerrar-auth');
    const guestAuth = document.getElementById('btn-explorar-invitado');
    let mode = 'login';

    const showError = message => {
        if (!errorBox) return;
        errorBox.textContent = message || '';
        errorBox.classList.toggle('hidden', !message);
    };
    const openAuthDialog = () => {
        document.getElementById('auth-overlay')?.classList.remove('hidden');
        document.getElementById('auth-email')?.focus();
    };
    const closeAuthDialog = () => document.getElementById('auth-overlay')?.classList.add('hidden');
    const updateMode = () => {
        const register = mode === 'register';
        if (title) title.textContent = register ? 'Crea tu cuenta de explorador' : 'Inicia tu expedición';
        if (submit) submit.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
        if (modeButton) modeButton.textContent = register ? 'Ya tengo una cuenta' : 'Crear una cuenta';
        document.getElementById('auth-confirm-wrap')?.classList.toggle('hidden', !register);
        document.getElementById('auth-username-wrap')?.classList.toggle('hidden', !register);
    };

    if (!supabase) {
        showError('Configura js/supabase-config.js con los datos de tu proyecto Supabase.');
        submit?.removeAttribute('disabled');
    }

    openAuth?.addEventListener('click', openAuthDialog);
    closeAuth?.addEventListener('click', closeAuthDialog);
    guestAuth?.addEventListener('click', closeAuthDialog);
    document.getElementById('auth-overlay')?.addEventListener('click', event => {
        if (event.target.id === 'auth-overlay') closeAuthDialog();
    });

    if (!supabase) {
        renderAuth(null, callbacks);
        updateMode();
        return;
    }

    modeButton?.addEventListener('click', () => {
        mode = mode === 'login' ? 'register' : 'login';
        showError('');
        updateMode();
    });

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        showError('');
        const formData = new FormData(form);
        const email = String(formData.get('email') || '').trim();
        const password = String(formData.get('password') || '');
        const requestedUsername = String(formData.get('username') || '').trim().toLowerCase();
        if (mode === 'register' && !/^[a-z0-9._-]{3,24}$/.test(requestedUsername)) {
            showError('El username debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.');
            return;
        }
        if (mode === 'register' && password !== String(formData.get('confirmPassword') || '')) {
            showError('Las contraseñas no coinciden.');
            return;
        }

        submit.disabled = true;
        let result;
        try {
            result = mode === 'register'
                ? await supabase.auth.signUp({ email, password, options: { data: { username: requestedUsername } } })
                : await supabase.auth.signInWithPassword({ email, password });
        } catch (error) {
            submit.disabled = false;
            showError('No se pudo conectar con Supabase. Revisa tu conexión e inténtalo de nuevo.');
            console.error('Error de autenticación:', error);
            return;
        }
        submit.disabled = false;

        if (result.error) {
            showError(result.error.message);
            return;
        }
        if (mode === 'register' && !result.data.session) {
            showError('Revisa tu correo para confirmar la cuenta y después inicia sesión.');
            return;
        }
        form.reset();
        username = mode === 'register' ? requestedUsername : username;
        if (result.data?.user) await guardarPerfilUsuario(result.data.user, requestedUsername);
        closeAuthDialog();
        callbacks.mostrarToast?.('👋 Bienvenido a PerúTurismo GO');
    });

    logout?.addEventListener('click', () => supabase.auth.signOut());

    let data;
    try {
        ({ data } = await supabase.auth.getSession());
        if (data.session) {
            const progreso = await cargarProgresoRemoto(data.session.user.id);
            aplicarProgreso(progreso);
            username = data.session.user.user_metadata?.username || '';
            const perfil = await supabase.from('perfiles').select('username').eq('id', data.session.user.id).maybeSingle();
            if (perfil.data?.username) username = perfil.data.username;
        }
    } catch (error) {
        showError('No se pudo recuperar la sesión. Puedes explorar como invitado o volver a intentarlo.');
        console.warn('Error recuperando sesión Supabase:', error);
        data = { session: null };
    }
    renderAuth(data.session, callbacks);

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user && !session) {
            try {
                aplicarProgreso(await cargarProgresoRemoto(nextSession.user.id));
                username = nextSession.user.user_metadata?.username || '';
                const perfil = await supabase.from('perfiles').select('username').eq('id', nextSession.user.id).maybeSingle();
                if (perfil.data?.username) username = perfil.data.username;
                await guardarPerfilUsuario(nextSession.user, username);
            } catch (error) {
                showError('Sesión iniciada, pero no se pudo cargar tu progreso.');
                console.warn(error);
            }
            if (!nextSession) username = '';
        }
        renderAuth(nextSession, callbacks);
    });
    updateMode();
}
