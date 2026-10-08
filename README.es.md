# Prompt Library — prompts de texto reutilizables para Wan2GP

*[English](README.md)* · Licencia MIT · v1.1.0

**Prompt Library** es un plugin para [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) que convierte tus mejores prompts en una librería de plantillas buscable.

- Escribes una palabra (o varias) junto al cuadro de prompt de WanGP → aparecen los prompts que coinciden.
- Eliges uno → se inserta en el prompt de WanGP (reemplazar, añadir al final, o en el cursor).
- Lo gestionas todo desde la pestaña **Prompt Library**: crear, editar, duplicar, borrar, importar y exportar.
- Opcional: asocia prompts a las colecciones de imágenes de [Reference Library](https://github.com/sweetyshots123/wan2gp-reference-library), en los dos sentidos.

Es un plugin normal de WanGP. No modifica ningún archivo del núcleo, así que sobrevive a las actualizaciones. Convive con [Dragger](https://github.com/sweetyshots123/wan2gp-dragger), [Vidosser](https://github.com/sweetyshots123/wan2gp-vidosser) y Reference Library.

> Prompt Library habla **inglés y español**. Por defecto sigue el idioma del navegador (español si es español; si no, inglés); puedes forzar cualquiera en los ajustes (*Language / Idioma*).

## Funciones

**Búsqueda con autocompletado**
- Una barra compacta justo bajo el prompt principal de WanGP (y en la pestaña **Editar** de la cola si está activado): campo de búsqueda con texto de ayuda, botón para borrar (×) y botones **Guardar actual** y **Gestionar**. Está hecha con componentes Gradio normales, así que sigue los **temas oscuro y claro** de WanGP.
- Varias palabras = **AND**: todas tienen que aparecer en el título, las etiquetas o el texto.
- Sin distinguir mayúsculas ni **acentos** (`cancion` encuentra `canción`). Valen coincidencias parciales.
- Orden: primero coincidencias en el título, luego etiquetas, luego el cuerpo; después por uso reciente / frecuente.
- El desplegable, opaco, muestra el título, las etiquetas como chips y un fragmento resaltado (máx. 2 líneas). Flota por encima del resto de la página y tiene scroll si hay muchos resultados. Navega con **↑ ↓ Enter Esc** o el ratón.
- La búsqueda corre en el navegador sobre una copia en caché (rápida con cientos/miles de prompts).

**Inserción**
- Por defecto: **reemplazar** el prompt actual. Opciones: **añadir al final** o **insertar en el cursor**.
- El servidor escribe en los componentes Gradio reales `prompt` / `wizard_prompt` de WanGP, para que la generación lea el valor nuevo.
- Aviso opcional de **Deshacer** unos segundos después de insertar.
- Variables simples como `{subject}` abren un diálogo para rellenarlas antes de insertar.

**Guardar el actual**
- Botón opcional junto a la búsqueda que guarda el contenido actual del prompt como entrada nueva.

**Gestor (pestaña Prompt Library, o el botón Gestionar)**
- Librería y editor a la izquierda, ajustes a la derecha.
- Lista + filtro, crear, editar, duplicar, eliminar (escribe `DELETE` para confirmar).
- Etiquetas y una categoría opcional.
- Importar / exportar en JSON (librería completa) o texto plano (bloques separados por `---`).

**Ejemplos iniciales**
- La primera vez se crean tres prompts con título `[Example] …`. Bórralos cuando quieras; solo sirven de semilla.

## Colecciones de Reference Library (1.1.0)

Si tienes [Reference Library](https://github.com/sweetyshots123/wan2gp-reference-library) **1.1 o posterior**, puedes asociar prompts y colecciones de imágenes entre sí:

- **Gestor:** bajo las etiquetas aparece un selector múltiple **Colecciones** con las colecciones de Reference Library. Marca las que van con el prompt y pulsa *Guardar prompt*. Reference Library muestra el mismo vínculo desde su lado (su selector *Prompts*), porque los dos plugins leen los mismos datos.
- **Autocompletado:** las colecciones asociadas salen como chips pequeños con un icono de imagen, distintos de las etiquetas. Si escribes el nombre de una colección también aparecen sus prompts (p. ej. `retratos`).
- **Al elegir un prompt con colecciones** (ajuste *Al elegir un prompt con colecciones*):
  - *Ofrecer cargar su colección* (por defecto): el aviso de inserción trae un botón **Cargar colección X**. No cambia nada hasta que lo pulsas.
  - *Cargar la primera colección automáticamente*.
  - *No hacer nada*.
- **Al cargar una colección en Reference Library:** Reference Library ya ofrece sus prompts asociados, así que por defecto Prompt Library no dice nada. El ajuste *Al cargar una colección en Reference Library → Ofrecer también aquí sus prompts asociados* añade un aviso con botones *Usar «título»*. El prompt nunca se sobrescribe sin un clic.
- **Sin Reference Library** (o con una versión antigua o incompatible), todos los controles de colecciones se ocultan y lo demás funciona igual.

**Colecciones borradas.** Un vínculo a una colección que Reference Library ya no lista (borrada, o en su papelera de 15 minutos) simplemente se ignora: no se muestra ni se puede buscar. Nunca se elimina automáticamente. Si deshaces el borrado, los vínculos vuelven. Guardar un prompt en el gestor también conserva esos vínculos ocultos.

### Para desarrolladores de plugins

Los vínculos solo viven en `library.json` de Prompt Library (`collections: [id de colección, …]` por prompt; esquema 2). Los archivos antiguos de 1.0.x se migran solos.

**Python:** `sys.modules["wan2gp_prompt_library_api"]`, `API_VERSION = 1`: `list_prompts()`, `prompts_for_collection(cid)`, `set_collection_prompts(cid, prompt_ids)`, `collections_for_prompt(pid)`, `set_prompt_collections(pid, cids)`, `get_prompt(pid)` y `revision()`. Todas las escrituras son seguras entre hilos y se guardan de forma atómica. Consulta la tabla del README en inglés.

**Eventos JS:**

- Escucha `promptlib:apply` `{detail: {id}}`.
- Emite `promptlib:applied` y `promptlib:changed` (también cuando el cambio llega por la API de Python: la página consulta la revisión cada 3 s).
- Lanza `reflib:apply` `{id}`.
- Escucha `reflib:changed` y `reflib:applied`.

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
| Al elegir un prompt con colecciones | *No hacer nada* / *Ofrecer cargar su colección* / *Cargar la primera colección automáticamente* (solo con Reference Library 1.1+) | Ofrecer |
| Al cargar una colección en Reference Library | *No hacer nada aquí* / *Ofrecer también aquí sus prompts asociados* (solo con Reference Library 1.1+) | No hacer nada |

## Instalación

1. Descarga el zip de la release (`wan2gp-prompt-library.zip`).
2. En WanGP → Plugins, instálalo desde el zip (o copia la carpeta `wan2gp-prompt-library/` en el directorio `plugins/` de WanGP).
3. Activa **Prompt Library** y reinicia WanGP si hace falta.

## Dónde se guardan los datos

Dentro de la carpeta del plugin (junto a `plugin.py`):

- `library.json` — tus prompts y sus vínculos con colecciones de Reference Library (se crea al usarlo por primera vez, con 3 ejemplos).
- `settings.json` — tus ajustes (se crea al guardar).

Ninguno de los dos va en el zip ni en git.

## Licencia

MIT © 2026 sweetyshots123
