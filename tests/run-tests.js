/**
 * Pruebas unitarias sencillas ejecutables con Node.js (`node tests/run-tests.js`)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

import { escaparHtml } from '../js/utils/sanitize.js';
import { calcularDistancia, formatearDistancia } from '../js/utils/geoUtils.js';
import { obtenerNivel, puntosPorCheckIn } from '../js/state.js';

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

console.log('✅ ¡Todas las pruebas unitarias pasaron exitosamente!');
