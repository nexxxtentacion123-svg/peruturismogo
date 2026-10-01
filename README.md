<div align="center">

  <img src="assets/kuntur-mascot-transparent.png" alt="Kuntur el Cóndor Explorador" width="220" />

  # 🇵🇪 PerúTurismo GO
  ### *Tu bitácora interactiva y gamificada de exploración por el Perú*

  [![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
  [![Leaflet](https://img.shields.io/badge/Leaflet-v1.9.4-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
  [![Brand: Kuntur](https://img.shields.io/badge/Mascota-Kuntur%20el%20C%C3%B3ndor-f39c12)](brand_showcase.html)

  <p align="center">
    <b>Recorre el Perú como en un videojuego: descubre lugares emblemáticos, completa rutas temáticas, sube de nivel y desbloquea medallas mientras viajas.</b>
  </p>

  <p align="center">
    <a href="#-características-principales">Características</a> •
    <a href="#-embajador-oficial-kuntur">Mascota & Branding</a> •
    <a href="#-inicio-rápido">Inicio Rápido</a> •
    <a href="#-configuración-con-supabase">Supabase</a> •
    <a href="#-despliegue">Despliegue</a> •
    <a href="brand_showcase.html">Manual de Marca</a>
  </p>

</div>

---

## 🧭 ¿Qué es PerúTurismo GO?

**PerúTurismo GO** es una aplicación web progresiva diseñada para transformar el turismo en el Perú en una **aventura interactiva y gamificada**.

A través de un mapa dinámico con cartografía detallada, los viajeros pueden registrar sus descubrimientos en tiempo real, seguir rutas guiadas por la Costa, Sierra y Selva, y acumular puntos de experiencia (XP) para ascender de rango: desde *Recién llegado* hasta *Chaski Maestro*.

---

## 🦅 Embajador Oficial: Kuntur

<div align="center">
  <table>
    <tr>
      <td width="160" align="center">
        <img src="assets/kuntur-avatar.png" width="120" alt="Kuntur Avatar" />
      </td>
      <td>
        <strong>Conoce a Kuntur</strong>, el cóndor andino explorador y guardián de nuestra bitácora.<br/>
        En la cosmovisión andina, el cóndor simboliza el <em>Hanan Pacha</em> (el mundo de las alturas y la visión panorámica). Portando su tradicional <strong>chullo peruano</strong> con patrones de llamas y el sol Inti, Kuntur acompaña a cada viajero con su entusiasta gesto de aprobación (👍), celebrando cada hito y ruta completada.
        <br/><br/>
        🎨 <em>Consulta el ecosistema visual completo abriendo <a href="brand_showcase.html"><strong>brand_showcase.html</strong></a> en tu navegador.</em>
      </td>
    </tr>
  </table>
</div>

---

## ✨ Características Principales

- 🗺️ **Mapa Interactivo Nacional (Leaflet.js):**
  - Más de 140 atractivos geolocalizados: sitios arqueológicos, maravillas naturales, museos, gastronomía y reservas.
  - Marcadores personalizados por categoría con ventanas emergentes interactivas y fotos.

- 🛣️ **Rutas Temáticas Guiadas:**
  - Circuitos prediseñados: *Ruta Moche, Circuito Sur Andino, Maravillas del Altiplano, Paraísos Amazónicos*, etc.
  - Trazado poligonal en el mapa y barra de progreso en vivo (*ej. 3/6 lugares visitados*).

- 🎮 **Sistema de Gamificación & Bitácora:**
  - **Puntos de Expedición (XP):** Gana puntos por cada lugar descubierto y ruta finalizada.
  - **Niveles de Explorador:** Progresión dinámica (*Recién llegado ➔ Caminante ➔ Explorador Andino ➔ Guardián del Qhapaq Ñan ➔ Chaski Maestro*).
  - **Lista de Favoritos y Registro de Visitas:** Guarda tus destinos pendientes y los ya conquistados.

- 📡 **Radar de Exploración:**
  - Detección de proximidad por GPS (geolocalización en tiempo real) que alerta al viajero cuando se encuentra cerca de un punto de interés.

- 🧭 **Planificador de viaje:**
  - Chat guiado sin API externa que toma presupuesto, duración, región, intereses y ritmo para recomendar destinos del catálogo local.
  - Las recomendaciones son orientativas y transparentes: los precios, horarios, transporte y disponibilidad deben verificarse antes de viajar.

- 🌓 **Modo Claro / Modo Oscuro:**
  - Paleta de diseño inspirada en los textiles andinos y la naturaleza peruana (Verde Selva `#123c32`, Oro Inti `#f39c12`, Carmesí `#c0392b`).

- ☁️ **Modo Híbrido (Invitado u Online):**
  - **Modo Invitado:** Funciona 100% offline guardando el progreso en `localStorage`.
  - **Sincronización Cloud (Supabase):** Guarda tu bitácora y continúa tu viaje en cualquier teléfono, tablet o computadora.

---

## 🎨 Paleta de Colores Oficial

| Muestra | Nombre | Código HEX | Uso en la Aplicación |
| :---: | :--- | :--- | :--- |
| ![#123c32](https://via.placeholder.com/20/123c32/000000?text=+) | **Verde Selva Andina** | `#123c32` | Color primario, barras de navegación y branding |
| ![#f39c12](https://via.placeholder.com/20/f39c12/000000?text=+) | **Oro Inti** | `#f39c12` | Insignia "GO", puntos XP, estrellas y medallas |
| ![#c0392b](https://via.placeholder.com/20/c0392b/000000?text=+) | **Rojo Carmín Telar** | `#c0392b` | Acentos del chullo, rutas activas y retos |
| ![#2980b9](https://via.placeholder.com/20/2980b9/000000?text=+) | **Azul Titikaka** | `#2980b9` | Ríos, lagos y tarjetas informativas |
| ![#27ae60](https://via.placeholder.com/20/27ae60/000000?text=+) | **Verde Valle Sagrado** | `#27ae60` | Check-in completado y confirmaciones de éxito |
| ![#231815](https://via.placeholder.com/20/231815/000000?text=+) | **Negro Pluma Cóndor** | `#231815` | Texto tipográfico principal y alto contraste |

---

## 📁 Estructura del Proyecto

```text
peruturismo-go/
│
├── assets/                          # Activos de identidad visual
│   ├── kuntur-mascot.png            # Ilustración master de Kuntur
│   ├── kuntur-mascot-transparent.png# Mascota sin fondo en alta resolución
│   ├── kuntur-avatar.png            # Avatar circular con ribete dorado
│   ├── favicon.png                  # Favicon 32x32 para el navegador
│   └── favicon-64.png               # Favicon 64x64 de alta densidad
│
├── js/                              # Lógica modular de la aplicación
│   ├── main.js                      # Punto de entrada y orquestación
│   ├── map.js                       # Controlador Leaflet y capas
│   ├── ui.js                        # Renderizado del DOM y paneles
│   ├── auth.js                      # Autenticación con Supabase
│   ├── gamification.js              # Cálculo de XP, niveles y medallas
│   ├── filters.js                   # Filtros por categoría y búsqueda
│   ├── geo.js                       # Geolocalización y radar GPS
│   ├── state.js                     # Gestión de estado (favoritos, visitas)
│   ├── supabase-config.js           # Variables de conexión API
│   └── utils/                       # Sanitización HTML y cálculo Haversine
│
├── tests/                           # Suite de pruebas unitarias
│   └── run-tests.js                 # Tests de sanitización, geo y niveles
│
├── brand_showcase.html              # Manual interactivo de identidad de marca
├── index.html                       # Documento principal de la aplicación
├── style.css                        # Design System y hojas de estilo
├── lugares.json                     # Catálogo nacional base
├── lugares-extra.json               # Ampliación nacional
├── lugares-lima.json                # Curaduría ampliada de Lima Metropolitana y provincias
├── rutas.json                       # Definición de rutas temáticas y polígonos
├── manifest.json                    # Metadatos instalables de la PWA
├── service-worker.js                # Caché segura del shell y catálogos públicos
├── supabase.sql                     # Script SQL para tablas y políticas RLS
├── servidor.py                      # Servidor HTTP local para desarrollo
├── INICIAR.bat                      # Lanzador rápido de un clic para Windows
├── .github/workflows/ci.yml         # CI: tests, JSON y comprobaciones de seguridad
└── package.json                     # Configuración y runner de tests
```

La aplicación usa `js/main.js` como único punto de entrada y mantiene la lógica separada por módulos. El antiguo `app.js` fue eliminado: la búsqueda del repositorio confirmó que no estaba referenciado por HTML, scripts, documentación ni configuración; conservarlo habría duplicado la implementación activa.

El planificador vive en `js/recommendations.js`, donde el algoritmo determinista puntúa coincidencias del catálogo sin enviar preferencias a servicios externos. Es una primera versión preparada para incorporar una IA híbrida en el futuro, siempre detrás de un backend y con el catálogo como fuente de verdad.

### Catálogo de Lima

`lugares-lima.json` incorpora 39 destinos adicionales (IDs 104–142) de Lima Metropolitana, Callao y las provincias de Barranca, Huaral, Oyón, Canta, Cañete y Yauyos. Cada ficha incluye coordenadas de referencia, distrito/provincia cuando están disponibles y una descripción breve. Es una curaduría amplia basada en destinos reconocidos, no una garantía literal de incluir absolutamente todos los puntos turísticos de la región; horarios, precios y accesos deben verificarse antes de viajar.

---

## 🚀 Inicio Rápido

> [!IMPORTANT]
> No abras `index.html` directamente haciendo doble clic desde el explorador de archivos; los navegadores bloquean la carga de archivos JSON (`lugares.json`, `rutas.json`) bajo el protocolo `file://` por políticas de seguridad (CORS).

### Opción 1: En Windows (Un solo clic)
Haz doble clic en el archivo **`INICIAR.bat`**. Se iniciará el servidor local y se abrirá automáticamente tu navegador en `http://localhost:8000`.

### Opción 2: Con Python
```bash
python -m http.server 8000
```
Luego abre en tu navegador: [http://localhost:8000](http://localhost:8000)

### Opción 3: Con VS Code Live Server
Abre la carpeta en Visual Studio Code y haz clic derecho en `index.html` ➔ **Open with Live Server**.

### Ejecutar Pruebas Unitarias
El proyecto incluye pruebas automatizadas para la sanitización de datos, cálculo de distancias (fórmula de Haversine) y lógica de niveles:
```bash
npm test
```

La CI ejecuta `npm test`, valida el JSON de los catálogos y comprueba que el frontend no incluya una `service_role` key. No se necesitan dependencias adicionales.

### PWA y uso sin conexión

En una primera visita con conexión, el service worker precarga el shell, los catálogos y el módulo público de Supabase. Después puede abrirse la interfaz y consultar el catálogo sin conexión; el progreso invitado permanece en `localStorage`. No se cachean respuestas de Supabase, sesiones, credenciales, teselas de mapas ni solicitudes privadas. La autenticación y sincronización requieren conexión y muestran un aviso visible si fallan.

### Fase 1: asistente turístico local

La Fase 1 añade un asistente guiado accesible desde **Plan local**. Pregunta presupuesto, fechas y duración, ciudad de salida, intereses, ritmo y transporte; después recomienda entre 3 y 5 destinos usando únicamente los catálogos locales cacheados por la PWA. Cada recomendación explica sus coincidencias, muestra el precio registrado como estimación y recuerda verificar precios, horarios y accesos.

No usa IA, APIs de inteligencia artificial ni claves, y no actúa como agencia de viajes. Las fechas/duración, ritmo y ciudad de salida se conservan como contexto: el catálogo actual no registra duración, ritmo ni rutas/distancias por destino. Tampoco incluye videos en esta fase.

---

## ⚡ Configuración con Supabase (Opcional)

Si deseas habilitar la persistencia de usuarios en la nube para sincronizar datos entre múltiples dispositivos:

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Ve al **SQL Editor** y ejecuta todo el script [`supabase.sql`](supabase.sql). Esto creará las tablas seguras con políticas de seguridad a nivel de fila (**RLS**).
3. Ve a **Project Settings ➔ API** y copia tu `Project URL` y `Publishable/anon key`.
4. Abre `js/supabase-config.js` y reemplaza los valores de ejemplo:
   ```javascript
   export const SUPABASE_URL = "https://tu-proyecto.supabase.co";
   export const SUPABASE_ANON_KEY = "tu-clave-anonima-publica";
   ```
5. En Supabase > **Authentication ➔ URL Configuration**, agrega `http://localhost:8000` a las *Redirect URLs*.

---

## 🌐 Despliegue en Producción

Puedes alojar este proyecto en cualquier plataforma de hosting estático gratuita:

- **GitHub Pages:**
  1. Sube el repositorio a tu cuenta de GitHub.
  2. Ve a **Settings ➔ Pages**.
  3. En *Branch*, selecciona `main` / `root` y guarda.
- **Vercel / Netlify / Cloudflare Pages:**
  - Simplemente conecta tu repositorio y despliega. No se requiere comando de compilación (cero dependencias de empaquetado).

### Producción y previews de Netlify

La URL de producción es [`peru-turismo-go.netlify.app`](https://peru-turismo-go.netlify.app/).
Una URL con el formato `deploy-id--peru-turismo-go.netlify.app` es un deployment
separado de preview: puede servir otro commit y no reemplaza producción hasta que
ese cambio se publique en `main`. Para comparar deployments, revisa el commit del
deployment en Netlify; no mezcles una URL de preview con la de producción al
reportar una diferencia.

La aplicación usa un service worker para funcionar offline. El cache se versiona
con cada cambio relevante y los archivos de aplicación y catálogos se solicitan
primero desde la red, usando el cache solo como fallback offline. Netlify entrega
`service-worker.js` e `index.html` sin cache HTTP para que las actualizaciones
lleguen al navegador y el service worker elimina caches anteriores al activarse.

---

## 🤝 Contribuciones

¡Las contribuciones son muy bienvenidas! Si deseas agregar nuevos lugares turísticos en `lugares.json`, trazar nuevas rutas en `rutas.json` o mejorar la interfaz:

1. Haz un **Fork** del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-ruta-andina`).
3. Confirma tus cambios (`git commit -m 'feat: Añadir Ruta del Cacao en San Martín'`).
4. Haz Push a la rama (`git push origin feature/nueva-ruta-andina`).
5. Abre un **Pull Request**.

---

## 📄 Licencia

Este proyecto se encuentra bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

<div align="center">
  <sub>Desarrollado con ❤️ para celebrar la riqueza cultural y natural del <strong>Perú</strong> 🇵🇪</sub>
</div>
