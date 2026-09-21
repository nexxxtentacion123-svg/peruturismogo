// Pega aquí los datos de tu proyecto Supabase.
// La clave anon/publishable es segura para el navegador cuando RLS está bien configurado.
export const SUPABASE_URL = 'https://eshjuoagtghzixbvtrkp.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_On8Lm_1rVNS0RmBJK1OxKA_Sn-lVkUz';

export const SUPABASE_CONFIGURED =
    !SUPABASE_URL.includes('TU-PROYECTO') &&
    !SUPABASE_ANON_KEY.includes('TU_CLAVE');
