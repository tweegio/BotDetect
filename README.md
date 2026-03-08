
Detecta y oculta comentarios sospechosos de bots y spam en Facebook , Instagram y LinkedIn .
Extensión para PC que filtra automáticamente + Web App / PWA que funciona en cualquier celular sin instalar nada.

🖥️ PC vs 📱 Móvil — Estrategia dual
Extensión Chrome	Aplicación web (PWA)
Plataforma	Chrome en el escritorio	Cualquier navegador/dispositivo
Instalación	Cargar enchrome://extensions	Ninguna — abrir URL y listo
Modo de uso	Automático al navegar	Pegás el comentario y analizás
Funciona sin conexión	✅	✅ (Trabajador de servicio)
Instalar como aplicación	N / A	✅ "Agregar una pantalla de inicio"
Flujo de usuario en móvil (3 pasos)
1. Ves un comentario sospechoso en Instagram / Facebook / LinkedIn
2. Mantenés presionado el comentario → "Copiar texto"
3. Abrís botfilter.app → pegás → resultado instantáneo
Manifiesto V3 Licencia: MIT Versión

📋 Tabla de contenidos
¿Qué hace?
Capturas de pantalla
Instalación local (Modo Desarrollador)
Cómo funciona la detección
Estructura del proyecto
Hoja de ruta y mejoras futuras
Monetización
Contribuir
Licencia
✨ ¿Qué hace?
BotFilter analiza los comentarios visibles en tu navegador sin enviar datos a ningún servidor . Todo el procesamiento ocurre localmente en su dispositivo.

Característica	Descripción
🔍 Detección heurística	Sistema de puntuación con múltiples señales
👁️ Oculta automáticamente	Comentarios que superan el umbral de puntuación
🔄 Observador de mutaciones	Detecta comentarios cargados dinámicamente (scroll infinito)
🎛️ Configurable	Ajusta la sensibilidad desde el popup
🌙 Modo oscuro	Se adapta al modo oscuro del sistema
🔒 Privacidad total	Sin telemetría, sin envío de datos externos.
🖼️ Capturas de pantalla
[Popup de la extensión]          [Comentario marcado como bot]
┌─────────────────────┐          ┌──────────────────────────────────────┐
│ 🤖 BotFilter        │          │ 🤖 Posible bot/spam detectado         │
│ Filtro de bots...   │          │ Puntuación: 4.5 • Frase spam: "DM me"│
├─────────────────────┤          │                              [Mostrar]│
│ Filtrado activo  ✅ │          └──────────────────────────────────────┘
├──────────┬──────────┤
│ 12       │  3.0     │
│ Ocultados│  Umbral  │
├──────────┴──────────┤
│ 📘 Facebook – activo│
├─────────────────────┤
│ Sensibilidad  ──●── │
│ Estricto    Permisivo│
└─────────────────────┘
🚀 Instalación local (Modo Desarrollador)
Opción A – Cargar carpeta descomprimida
Descarga este repositorio como .zipo clonalo:

git clone https://github.com/tu-usuario/botfilter-extension.git
Abre Chrome y ve a:

chrome://extensions/
Active el interruptor "Modo desarrollador" (esquina superior derecha).

Haga clic en "Cargar descomprimida" .

Selecciona la carpeta botfilter-extension.

¡Listo! El ícono de BotFilter aparecerá en tu barra de herramientas.

Opción B – Instalar desde Chrome Web Store (próximamente)
🧠 Cómo funciona la detección
BotFilter utiliza un sistema de puntuación heurístico . Cada comentario analizador acumula puntos según múltiples señales. Cuando supera el umbral configurable (por defecto: 3 puntos), el comentario se oculta.

Señales detectadas
Señal	Puntos	Ejemplo
Frase spam conocida	+2	"great post", "dm me","earn money fast"
URL externa / acortador	+1.5	bit.ly/...,https://...
Comentario de los expertos	+3	Mismo texto en Múltiples comentarios
Comentario muy similar	+1.5	>60% palabras en común con otro
Comentario genérico corto	+1.5	"nice!","wow 😂"
Todo en mayúsculas	+1	"CLICK HERE NOW"
Exceso de signos!	+0.5	Más de 3 exclamaciones
Exceso de emojis	+0.5	Más de 5 emojis seguidos
Emojis de dinero	+1.5	💰 💵 💸 🤑
Patrones de repetición	+1.5	aaaaa,hola hola hola
Similitud textual
Se usa el algoritmo Jaccard Similarity para comparar comentarios:

similitud = |palabras_comunes| / |palabras_totales_únicas|
>85%→ Duplicado (+3 puntos)
>60%→ Muy similar (+1.5 puntos)
Observador de mutaciones
La extensión no escanea toda la página continuamente . En cambio, usa MutationObserverpara reaccionar solo cuando se añaden nuevos nodos al DOM (scroll infinito, carga AJAX). Un rebote de 400 ms previene escaneos excesivos.

📁 Estructura del proyecto
botfilter-extension/
├── manifest.json          # Configuración de la extensión (Manifest V3)
├── content.js             # Script principal – detección y ocultamiento
├── style.css              # Estilos aislados del content script
├── background.js          # Service worker – gestión del badge
├── popup/
│   ├── popup.html         # Interfaz del popup
│   └── popup.js           # Lógica del popup
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
🗺️ Hoja de ruta y mejoras futuras
Versión 1.1
Panel de configuración con lista blanca de usuarios
Exportar lista de bots detectados
Soporte para Twitter/X y YouTube
Versión 1.2
Base de datos locales de frases spam (IndexedDB)
Historial de comentarios ocultos con posibilidad de revisión.
Versión 2.0 (con IA)
 Modelo NLP local usando transformers.jsONNX Runtime Web
Clasificador de spam entrenado con datos reales
Sin envío de datos a la nube
 Sistema de puntuación semántico (incrustaciones de texto)
 Aprendizaje activo : el usuario puede marcar falsos positivos para mejorar el modelo
Sincronización de patrones spam entre usuarios (opt-in)
💰 Monetización
BotFilter usa un modelo freemium :

Plan	Características	Precio
Gratis	Detección básica, 3 plataformas, umbral configurable	Gratis
Pro (próximamente)	IA local, reglas personalizadas, soporte prioritario	$3/mes
También aceptamos donaciones para mantener el proyecto activo:

☕ Invítame a un café

🤝 Contribuir
Haz fork del repositorio
Crea una rama:git checkout -b feature/nueva-funcionalidad
Commitea los cambios:git commit -m 'feat: descripción'
Haz empujar:git push origin feature/nueva-funcionalidad
Abre una solicitud de extracción
Agregar frases spam
Puedes contribuir frases spam al array BOT_PHRASESen content.js. Acepta Pull Requests con nuevos patrones en cualquier idioma.

📄 Licencia
MIT © 2025 tweegio — Libre para uso personal y comercial.
