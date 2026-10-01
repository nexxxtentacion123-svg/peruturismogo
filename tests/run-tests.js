/**
 * Pruebas unitarias sencillas ejecutables con Node.js (`node tests/run-tests.js`)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

import { escaparHtml } from '../js/utils/sanitize.js';
import { calcularDistancia, formatearDistancia } from '../js/utils/geoUtils.js';
import { obtenerNivel, puntosPorCheckIn } from '../js/state.js';
import { formatearRangoCosto, normalizarPerfil, obtenerLimitaciones, recomendarDestinos } from '../js/assistant.js';

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
    assert.match(fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), /No intercept.*Supabase|Supabase/);
});

const catalogoAsistente = [
    { id: 1, nombre: 'Museo de Lima', region: 'Lima', categoria: 'Museo', tiposExplorador: ['Cultural'], precio: 'S/ 15.00', transportePublico: 'Metropolitano' },
    { id: 2, nombre: 'Reserva Verde', region: 'Lima', categoria: 'Reserva', tiposExplorador: ['Naturaleza'], precio: 'S/ 40.00', transportePublico: 'Bus local' },
    { id: 3, nombre: 'Cañón Andino', region: 'Arequipa', categoria: 'Aventura', tiposExplorador: ['Aventura'], precio: 'S/ 120.00' },
    { id: 4, nombre: 'Plaza Gratis', region: 'Cusco', categoria: 'Historia', tiposExplorador: ['Cultural'], precio: 'Gratis' },
    { id: 5, nombre: 'Barrio Cultural', region: 'Lima', categoria: 'Cultura', tiposExplorador: ['Cultural'], precio: 'S/ 10.00' },
    { id: 6, nombre: 'Parque Urbano', region: 'Lima', categoria: 'Parque', tiposExplorador: ['Urbano'], precio: 'Gratis' }
];

test('Asistente: perfil normalizado y filtros por intereses/presupuesto', () => {
    const perfil = normalizarPerfil({ presupuesto: 'economico', intereses: ['cultura'], salida: 'Lima', duracion: '2-3' });
    assert.equal(perfil.presupuesto, 'economico');
    const resultados = recomendarDestinos(catalogoAsistente, perfil, 5);
    assert.ok(resultados.length >= 1 && resultados.length <= 5);
    assert.ok(resultados.every(resultado => resultado.dentroPresupuesto));
    assert.ok(resultados.every(resultado => resultado.intereses.length > 0));
    assert.ok(resultados.some(resultado => resultado.lugar.id === 1));
    assert.match(resultados[0].explicacion, /coincide|presupuesto/);
});

test('Asistente: catálogo vacío y pocos resultados no fallan', () => {
    assert.deepEqual(recomendarDestinos([], {}, 5), []);
    const pocos = recomendarDestinos(catalogoAsistente.slice(0, 2), {}, 5);
    assert.equal(pocos.length, 2);
    assert.equal(formatearRangoCosto('Gratis'), 'Gratis');
    assert.equal(formatearRangoCosto('S/ 35.00'), 'S/ 26–80');
});

test('Asistente: límite siempre entre 3 y 5 cuando hay suficientes datos', () => {
    assert.equal(recomendarDestinos(catalogoAsistente, {}, 2).length, 3);
    assert.equal(recomendarDestinos(catalogoAsistente, {}, 9).length, 5);
    assert.ok(obtenerLimitaciones({ salida: 'Lima' }, catalogoAsistente).some(texto => texto.includes('duración')));
});

console.log('✅ ¡Todas las pruebas unitarias pasaron exitosamente!');
