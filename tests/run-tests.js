/**
 * Pruebas unitarias sencillas ejecutables con Node.js (`node tests/run-tests.js`)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

import { escaparHtml } from '../js/utils/sanitize.js';
import { calcularDistancia, formatearDistancia } from '../js/utils/geoUtils.js';
import { obtenerNivel, puntosPorCheckIn } from '../js/state.js';
import { formatearRangoCosto, normalizarPreferencias, obtenerLimitaciones } from '../js/recommendations.js';
import { recomendarLugares, crearExplicacion } from '../js/recommendations.js';
import { assertCatalogoValido, consolidarCatalogo, distanciaCatalogo } from '../js/catalog.js';
import { esOrigenOAuthPermitido, obtenerRedirectOAuth } from '../js/auth-redirect.js';

test('Sanitización de HTML', () => {
    assert.equal(escaparHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escaparHtml('Lima & Cusco'), 'Lima &amp; Cusco');
    assert.equal(escaparHtml("It's fine"), 'It&#039;s fine');
    assert.equal(escaparHtml(null), '');
});

test('Redirect de Google usa solo orígenes seguros', () => {
    assert.equal(esOrigenOAuthPermitido('http://localhost:8000'), true);
    assert.equal(esOrigenOAuthPermitido('https://peru-turismo-go.netlify.app'), true);
    assert.equal(esOrigenOAuthPermitido('https://preview-123--peru-turismo-go.netlify.app'), true);
    assert.equal(esOrigenOAuthPermitido('https://evil.example'), false);
    assert.equal(
        obtenerRedirectOAuth({ href: 'https://peru-turismo-go.netlify.app/index.html?tab=rutas#auth' }),
        'https://peru-turismo-go.netlify.app/index.html?tab=rutas'
    );
    assert.equal(obtenerRedirectOAuth({ href: 'file:///C:/peru/index.html' }), null);
});

test('Cálculo de Distancia (Haversine)', () => {
    // Distancia aproximada entre Plaza Mayor de Lima (-12.0453, -77.0311) y Huaca Pucllana (-12.1107, -77.0336) ~ 7.27 km (7270m)
    const dist = calcularDistancia(-12.0453, -77.0311, -12.1107, -77.0336);
    assert.ok(dist > 7000 && dist < 7600, `Distancia esperada ~7.2km, obtenida: ${dist}m`);

    assert.equal(formatearDistancia(450), '450 m');
    assert.equal(formatearDistancia(2500), '2.5 km');
});

test('Niveles y Gamificación', () => {
    assert.equal(obtenerNivel(0).nombre, 'Recién llegado');
    assert.equal(obtenerNivel(60).nombre, 'Caminante');
    assert.equal(obtenerNivel(160).nombre, 'Explorador');
    assert.equal(obtenerNivel(320).nombre, 'Aventurero');
    assert.equal(obtenerNivel(550).nombre, 'Embajador del Perú');

    const lugarNormal = { id: 1, esJoyaOculta: false };
    const joyaOculta = { id: 2, esJoyaOculta: true };

    assert.equal(puntosPorCheckIn(lugarNormal, false), 10);
    assert.equal(puntosPorCheckIn(lugarNormal, true), 25);
    assert.equal(puntosPorCheckIn(joyaOculta, false), 30);
    assert.equal(puntosPorCheckIn(joyaOculta, true), 45);
});

test('Catálogo ampliado de Lima y PWA', () => {
    const lima = JSON.parse(fs.readFileSync(new URL('../lugares-lima.json', import.meta.url)));
    assert.equal(lima.length, 39);
    assert.equal(new Set(lima.map(lugar => lugar.id)).size, lima.length);
    assert.ok(lima.some(lugar => lugar.distrito === 'Miraflores'));
    assert.ok(lima.some(lugar => lugar.provincia === 'Yauyos'));
    assert.ok(lima.every(lugar => Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng)));

    const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url)));
    assert.equal(manifest.display, 'standalone');
    const serviceWorker = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
    assert.match(serviceWorker, /No intercept.*Supabase|Supabase/);
    assert.match(serviceWorker, /peruturismo-shell-v4/);
    assert.match(serviceWorker, /fetch\(request\)\.then/);
});

test('Catálogo de Áncash integrado sin IDs duplicados', () => {
    const archivos = ['lugares.json', 'lugares-extra.json', 'lugares-lima.json', 'lugares-ancash.json'];
    const catalogo = archivos.flatMap(archivo => JSON.parse(fs.readFileSync(new URL(`../${archivo}`, import.meta.url))));
    const ancash = catalogo.filter(lugar => lugar.region === 'Áncash');
    assert.ok(ancash.length >= 50);
    assert.equal(new Set(catalogo.map(lugar => lugar.id)).size, catalogo.length);
    assert.ok(ancash.every(lugar => Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng)));
    assert.ok(ancash.some(lugar => lugar.provincia === 'Huaraz'));
    assert.ok(ancash.some(lugar => lugar.provincia === 'Huari'));
});

test('Consolidación del catálogo: IDs, nombres y coordenadas', () => {
    const archivos = ['lugares.json', 'lugares-extra.json', 'lugares-lima.json', 'lugares-ancash.json'];
    const catalogo = archivos.flatMap(archivo => JSON.parse(fs.readFileSync(new URL(`../${archivo}`, import.meta.url))));
    assert.equal(catalogo.length, 193);
    assert.doesNotThrow(() => assertCatalogoValido(catalogo));
    assert.equal(catalogo.filter(lugar => lugar.nombre === 'Laguna 69').length, 1);
    assert.deepEqual(
        catalogo.filter(lugar => lugar.nombre === 'Cañón de los Perdidos').map(lugar => lugar.id),
        [70, 82]
    );

    const duplicado = [{ id: 1, nombre: 'Mirador', lat: -12, lng: -77 }, { id: 2, nombre: 'Mirador', lat: -12.001, lng: -77.001 }];
    assert.throws(() => assertCatalogoValido(duplicado), /Nombre duplicado/);
    assert.ok(distanciaCatalogo(duplicado[0], duplicado[1]) < 1);
    assert.throws(() => assertCatalogoValido([
        { id: 7, nombre: 'Uno', lat: -12, lng: -77 },
        { id: 7, nombre: 'Dos', lat: -13, lng: -76 }
    ]), /ID duplicado/);
    assert.throws(() => assertCatalogoValido([
        { id: 1, nombre: 'Uno', lat: -12, lng: -77 },
        { id: 2, nombre: 'Dos', lat: -12, lng: -77 }
    ]), /Coordenadas sospechosamente repetidas/);
    assert.doesNotThrow(() => assertCatalogoValido([
        { id: 1, nombre: 'Cañón', lat: -12, lng: -77 },
        { id: 2, nombre: 'Cañón', lat: -15, lng: -75 }
    ]));
    const fusionado = consolidarCatalogo([
        { id: 1, nombre: 'Laguna', lat: -9, lng: -77, descripcion: 'corta' },
        { id: 2, nombre: 'Laguna', lat: -9.001, lng: -77.001, descripcion: 'larga', precio: 'Gratis', tiposExplorador: ['Aventura'] }
    ]);
    assert.equal(fusionado.length, 1);
    assert.equal(fusionado[0].id, 1);
    assert.match(fusionado[0].descripcion, /corta.*larga/);
    assert.deepEqual(fusionado[0].tiposExplorador, ['Aventura']);
});

test('El planificador avanza con pasos posteriores ocultos', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="form-planificador"[^>]*novalidate/);
    assert.doesNotMatch(html, /id="plan-region"[^>]*required/);
});

test('El modal del planificador es hermano del modal de lugar', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(
        html,
        /id="modal-body"><\/div>\s*<\/div>\s*<\/div>\s*<div class="modal-overlay hidden" id="modal-planificador">/
    );
});

test('Recomendador local por preferencias', () => {
    const lugares = [
        { id: 1, nombre: 'Museo de Lima', region: 'Lima', categoria: 'Museo', descripcion: 'Historia y cultura', tiposExplorador: ['Cultural'], precio: 'S/ 20' },
        { id: 2, nombre: 'Cañón', region: 'Arequipa', categoria: 'Aventura', descripcion: 'Naturaleza', tiposExplorador: ['Naturaleza'], precio: 'Consultar' }
    ];
    const preferencias = { presupuesto: 'bajo', dias: 3, region: 'Lima', intereses: ['Cultural'], ritmo: 'activo' };
    const [primero] = recomendarLugares(lugares, preferencias);
    assert.equal(primero.id, 1);
    assert.match(crearExplicacion(primero, preferencias), /interés|Lima|presupuesto/i);
});

test('Recomendador: catálogo vacío, filtros estrictos y límites 3–5', () => {
    assert.deepEqual(recomendarLugares([], {}, 5), []);
    const catalogo = [
        { id: 1, nombre: 'Museo Lima', region: 'Lima', categoria: 'Museo', tiposExplorador: ['Cultural'], precio: 'S/ 15', transportePublico: 'Bus' },
        { id: 2, nombre: 'Parque Lima', region: 'Lima', categoria: 'Parque', tiposExplorador: ['Naturaleza'], precio: 'Gratis', transportePublico: 'Bus' },
        { id: 3, nombre: 'Cañón', region: 'Arequipa', categoria: 'Aventura', tiposExplorador: ['Aventura'], precio: 'S/ 120' },
        { id: 4, nombre: 'Plaza Cusco', region: 'Cusco', categoria: 'Historia', tiposExplorador: ['Cultural'], precio: 'S/ 10' },
        { id: 5, nombre: 'Barrio Lima', region: 'Lima', categoria: 'Cultura', tiposExplorador: ['Cultural'], precio: 'S/ 10' },
        { id: 6, nombre: 'Reserva Lima', region: 'Lima', categoria: 'Reserva', tiposExplorador: ['Naturaleza'], precio: 'S/ 20' }
    ];
    const perfil = normalizarPreferencias({ presupuesto: 'bajo', intereses: ['Cultural'], salida: 'Lima', transporte: 'publico' });
    const resultados = recomendarLugares(catalogo, perfil, 5);
    assert.ok(resultados.length >= 1 && resultados.length <= 5);
    assert.ok(resultados.every(lugar => lugar.costoEstimado === null || lugar.costoEstimado <= 25));
    assert.ok(resultados.every(lugar => lugar._coincidencias.length > 0 && lugar._coincideTransporte));
    assert.equal(recomendarLugares(catalogo, {}, 2).length, 3);
    assert.equal(recomendarLugares(catalogo, {}, 9).length, 5);
    assert.equal(formatearRangoCosto('S/ 35'), 'S/ 26–80');
    assert.ok(obtenerLimitaciones({ salida: 'Lima' }, catalogo).some(texto => texto.includes('duración')));
});

console.log('✅ ¡Todas las pruebas unitarias pasaron exitosamente!');
