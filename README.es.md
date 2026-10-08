# Prompt Library — prompts de texto reutilizables para Wan2GP

*[English](README.md)* · Licencia MIT · v1.0.0

**Prompt Library** es un plugin para [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) que convierte tus mejores prompts en una librería de plantillas buscable.

- Escribes una palabra (o varias) junto al cuadro de prompt de WanGP → aparecen los prompts que coinciden.
- Eliges uno → se inserta en el prompt de WanGP (reemplazar, añadir al final, o en el cursor).
- Lo gestionas todo desde la pestaña **Prompt Library**: crear, editar, duplicar, borrar, importar y exportar.

Es un plugin normal de WanGP. No modifica ningún archivo del núcleo, así que sobrevive a las actualizaciones. Convive con [Dragger](https://github.com/sweetyshots123/wan2gp-dragger), [Vidosser](https://github.com/sweetyshots123/wan2gp-vidosser) y Reference Library.

> Prompt Library habla **inglés y español**. Por defecto sigue el idioma del navegador (español si es español; si no, inglés); puedes forzar cualquiera en los ajustes (*Language / Idioma*).

## Funciones

**Búsqueda con autocompletado**
- Un campo compacto bajo el prompt principal de WanGP (y en la pestaña **Editar** de la cola si está activado).
- Varias palabras = **AND**: todas tienen que aparecer en el título, las etiquetas o el texto.
- Sin distinguir mayúsculas ni **acentos** (`cancion` encuentra `canción`). Valen coincidencias parciales.
- Orden: primero coincidencias en el título, luego etiquetas, luego el cuerpo; después por uso reciente / frecuente.
- El desplegable muestra título, etiquetas y un fragmento resaltado. Navega con **↑ ↓ Enter Esc** o el ratón.
- La búsqueda corre en el navegador sobre una copia en caché (rápida con cientos/miles de prompts).

**Inserción**
- Por defecto: **reemplazar** el prompt actual. Opciones: **añadir al final** o **insertar en el cursor**.
- El servidor escribe en los componentes Gradio reales `prompt` / `wizard_prompt` de WanGP, para que la generación lea el valor nuevo.
- Aviso opcional de **Deshacer** unos segundos después de insertar.
- Variables simples como `{subject}` abren un diálogo para rellenarlas antes de insertar.

**Guardar el actual**
- Botón opcional junto a la búsqueda que guarda el contenido actual del prompt como entrada nueva.

**Gestor (pestaña Prompt Library)**
- Lista + filtro, crear, editar, duplicar, eliminar (escribe `DELETE` para confirmar).
- Etiquetas y categoría/colección opcional.
- Importar / exportar en JSON (librería completa) o texto plano (bloques separados por `---`).

**Ejemplos iniciales**
- La primera vez se crean tres prompts con título `[Example] …`. Bórralos cuando quieras; solo sirven de semilla.

## Cómo funciona

1. Los prompts viven en `library.json` dentro de la carpeta del plugin (escrituras atómicas). Ese archivo está en `.gitignore` y no va en el zip de la release, así que las actualizaciones no borran tu librería. Los ajustes están en `settings.json` al lado.
2. `prompt_library.js` (inyectado con la API `add_custom_js` de WanGP) monta la UI de búsqueda junto al prompt visible y busca en la caché.
3. Al elegir un prompt se dispara un puente Gradio oculto (caja de texto + botón en la pestaña Prompt Library) cuyas salidas son los componentes reales de prompt de WanGP. El contador de usos / última vez se actualiza en el servidor.

## Ajustes

| Opción | Significado | Por defecto |
|---|---|---|
| Language / Idioma | *Auto (idioma del navegador)*, *English* o *Español* | Auto |
| Mostrar el cuadro de búsqueda junto al prompt | interruptor maestro de la UI | sí |
| Mostrarlo también en la pestaña Editar de la cola | montar la búsqueda también en Editar | sí |
| Botón «Guardar prompt actual» | botón junto a la búsqueda | sí |
| Cómo insertar | *Reemplazar* / *Añadir al final* / *Insertar en el cursor* | Reemplazar |
| Ofrecer «Deshacer» tras insertar | aviso de deshacer | sí |
| Mensajes de confirmación + Duración | avisos (los errores siempre se muestran) | sí, 3,5 s |

## Instalación

1. Descarga el zip de la release (`wan2gp-prompt-library.zip`).
2. En WanGP → Plugins, instálalo desde el zip (o copia la carpeta `wan2gp-prompt-library/` en el directorio `plugins/` de WanGP).
3. Activa **Prompt Library** y reinicia WanGP si hace falta.

## Dónde se guardan los datos

Dentro de la carpeta del plugin (junto a `plugin.py`):

- `library.json` — tus prompts (se crea al usarlo por primera vez, con 3 ejemplos).
- `settings.json` — tus ajustes (se crea al guardar).

Ninguno de los dos va en el zip ni en git.

## Licencia

MIT © 2026 sweetyshots123
