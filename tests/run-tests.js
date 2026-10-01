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

test('Sanitización de HTML', () => {
    assert.equal(escaparHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escaparHtml('Lima & Cusco'), 'Lima &amp; Cusco');
    assert.equal(escaparHtml("It's fine"), 'It&#039;s fine');
    assert.equal(escaparHtml(null), '');
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
    assert.match(serviceWorker, /peruturismo-shell-v2/);
    assert.match(serviceWorker, /fetch\(request\)\.then/);
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
