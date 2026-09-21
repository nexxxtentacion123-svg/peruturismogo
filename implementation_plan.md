# Plan de Implementación: Sistema de Branding e Identidad Visual — PerúTurismo GO

Integrar la nueva identidad de marca oficial basada en **Kuntur (el Cóndor Andino con chullo)** en el diseño, la estructura HTML y las hojas de estilo de la aplicación web `PerúTurismo GO`.

## User Review Required

> [!IMPORTANT]
> Se ha definido a la mascota como **Kuntur, el Cóndor Explorador**. Luce el tradicional chullo andino con motivos geométricos y de llamas, dando el visto bueno (*thumbs up*) al explorador.
> Las imágenes optimizadas ya han sido procesadas en formatos transparentes (`kuntur-mascot-transparent.png`), avatares circulares (`kuntur-avatar.png`) y favicons (`favicon.png`).

## Open Questions

> [!NOTE]
> ¿Deseas que Kuntur también aparezca animado con una pequeña frase de bienvenida tipo bocadillo ("¡Allillanchu, viajero!") cuando el usuario abre la aplicación por primera vez?

---

## Proposed Changes

### Activos de Marca y Media

#### [NEW] [kuntur-avatar.png](file:///c:/Users/maxtor/Documents/new/assets/kuntur-avatar.png)
- Avatar circular nítido de Kuntur enmarcado con ribetes de Oro Inti y Verde Selva para el navbar y cabeceras.

#### [NEW] [kuntur-mascot-transparent.png](file:///c:/Users/maxtor/Documents/new/assets/kuntur-mascot-transparent.png)
- Ilustración completa de alta resolución con fondo transparente para modales, banners y estados vacíos.

#### [NEW] [favicon.png](file:///c:/Users/maxtor/Documents/new/assets/favicon.png)
- Favicon 32x32 y 64x64 para la pestaña del navegador.

---

### Interfaz de Usuario y Estructura

#### [MODIFY] [index.html](file:///c:/Users/maxtor/Documents/new/index.html)
- Añadir etiquetas `<link rel="icon" type="image/png" href="assets/favicon.png">` y `<link rel="apple-touch-icon" href="assets/kuntur-avatar.png">`.
- Reemplazar el encabezado actual `<h1><i class="fas fa-map-marked-alt"></i> PerúTurismo GO</h1>` por el imagotipo oficial con el avatar de Kuntur, la palabra marca estilizada y el badge dinámico `GO`.
- Integrar la ilustración de Kuntur en el modal de autenticación (`auth-card`) para recibir al usuario con calidez.
- Agregar un ribete decorativo textil andino (*aguayo/chullo stripe*) bajo el header.

---

### Estilos y Sistema de Diseño

#### [MODIFY] [style.css](file:///c:/Users/maxtor/Documents/new/style.css)
- Definir variables cromáticas complementarias basadas en los textiles del chullo de Kuntur (`--carmesi-inca`, `--oro-inti`, `--chullo-ribete`).
- Crear clases para el nuevo imagotipo (`.brand-logo`, `.brand-avatar`, `.brand-badge-go`, `.brand-tagline`).
- Implementar microinteracción al pasar el cursor sobre Kuntur (leve balanceo/giro alegre).
- Diseñar el contenedor y animación del personaje en el modal de inicio de sesión (`.auth-mascot`).
- Añadir el ribete textil andino con gradiente sutil multicromático.

---

### Lógica de Interfaz y Estados Vacíos

#### [MODIFY] [js/ui.js](file:///c:/Users/maxtor/Documents/new/js/ui.js)
- Enriquecer los mensajes de estado vacío (cuando la lista de favoritos o visitas está vacía) con un avatar de Kuntur y una frase motivadora para salir a explorar el mapa.

---

## Verification Plan

### Automated Tests
- Ejecutar el runner de pruebas existente:
  ```powershell
  node tests/run-tests.js
  ```

### Manual Verification
- Verificar en navegador la carga correcta del favicon en la pestaña.
- Comprobar que el header se adapte perfectamente tanto en pantallas móviles como de escritorio.
- Probar el cambio entre Modo Claro y Modo Oscuro para asegurar alto contraste del logo y la mascota.
- Abrir el modal de inicio de sesión ("Guardar progreso") y verificar la presentación estética de Kuntur.
