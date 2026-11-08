# Prompt Library — prompts de texto reutilizables para Wan2GP

*[English](README.md)* · Licencia MIT · v1.2.1

**Prompt Library** es un plugin para [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) que convierte tus mejores prompts en una librería de plantillas buscable.

- Escribes una palabra (o varias) junto al cuadro de prompt de WanGP → aparecen los prompts que coinciden.
- Eliges uno → se inserta en el prompt de WanGP (reemplazar, añadir al final, o en el cursor).
- Lo gestionas todo desde la pestaña **Prompt Library**: crear, editar, duplicar, borrar, importar y exportar.
- Opcional: asocia prompts a las colecciones de imágenes de [Reference Library](https://github.com/sweetyshots123/wan2gp-reference-library), en los dos sentidos.

Es un plugin normal de WanGP. No modifica ningún archivo del núcleo, así que sobrevive a las actualizaciones. Convive con [Dragger](https://github.com/sweetyshots123/wan2gp-dragger), [Vidosser](https://github.com/sweetyshots123/wan2gp-vidosser) y Reference Library.

> Prompt Library habla **inglés y español**. Por defecto sigue el idioma del navegador (español si es español; si no, inglés); puedes forzar cualquiera en los ajustes (*Language / Idioma*).

## Funciones

**Búsqueda con autocompletado**
- Una barra **Prompt Library** justo bajo el prompt principal de WanGP (y en la pestaña **Editar** de la cola si está activado). Sigue el mismo estilo que la barra de Reference Library: cabecera con icono y estado a la derecha, el campo de búsqueda (texto de ayuda + borrar ×) y los mismos botones que la barra de Reference Library: **Aplicar**, **Guardar como…**, **Actualizar** y **Gestionar**, más un cuadrado **Historial** solo con icono. Está hecha con componentes Gradio normales, así que sigue los **temas oscuro y claro** de WanGP.
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

**Prompt actual, Aplicar, Actualizar y Guardar como… (1.2.0, renombrados en 1.4.0)**
- La barra recuerda el prompt que cargaste, tanto si lo elegiste en el autocompletado como si lo aplicó otro plugin (`promptlib:apply`, p. ej. un chip de Reference Library). Se guarda por sesión del navegador y por pestaña (Generar / Editar). La cabecera muestra **Prompt «X» cargado**, y una marca de **modificado** mientras el prompt de WanGP sea distinto del texto guardado. En una plantilla, se compara con los valores que rellenaste.
- **Aplicar** vuelve a cargar el prompt actual en el prompt de WanGP (descarta los cambios sin guardar allí).
- **Actualizar** (antes de 1.4.0 se llamaba *Guardar*) sobrescribe el prompt cargado con el texto actual de WanGP. El aviso trae **Deshacer**. Si no hay ninguno cargado, Actualizar funciona como *Guardar como…*. Si no hay cambios, solo lo indica. Si guardas encima de una plantilla y sus `{variables}` ya no están en el texto, pregunta antes.
- **Guardar como…** crea un prompt **nuevo** con el texto actual y deja el cargado sin cambios. Su diálogo tiene el título (con «X (copia)» ya escrito), las etiquetas y las colecciones de Reference Library del cargado como punto de partida, y una vista previa del texto. El nuevo pasa a ser el actual. **Deshacer** en el aviso lo borra de nuevo.
- **Detalles en línea:** bajo la barra, las **etiquetas** del prompt actual aparecen como chips con × y un campo «+ etiqueta» que autocompleta con tus etiquetas existentes. Si está Reference Library 1.1+, sus **colecciones** tienen el mismo editor, con un selector limitado a las colecciones existentes. Los cambios se guardan al momento y el aviso trae **Deshacer**. El diálogo *Guardar como…* usa los mismos editores de chips, pero ahí no se guarda nada hasta que confirmas.
- **El cuadro de búsqueda muestra el prompt cargado (1.2.1):** en reposo, muestra el título del prompt cargado como valor. Al enfocarlo, el título queda seleccionado y al escribir se busca como siempre; Esc o hacer clic fuera sin elegir nada recupera el título. Para **renombrarlo**, usa el pequeño lápiz dentro del cuadro (junto a la ×) o haz doble clic en el cuadro. El cuadro se vuelve ámbar y muestra *Renombrar prompt…* sin desplegable. Enter guarda, Esc cancela, y un título vacío se rechaza. Renombra **ese** prompt: mismo id, con el texto, las etiquetas y las colecciones intactos. El aviso trae **Deshacer**, y el gestor, el autocompletado y los chips de Reference Library se refrescan. En el estado, los títulos largos se recortan con puntos suspensivos.
- **Renombrar una etiqueta en todas partes (1.2.1):** doble clic sobre un chip de etiqueta en la barra (o en el pequeño lápiz que aparece al pasar el ratón). Se convierte en un campo de texto: **Enter** o hacer clic fuera guarda, **Esc** cancela. Guardar renombra esa etiqueta en **todos** los prompts; no crea una etiqueta nueva. Las etiquetas se comparan sin distinguir mayúsculas ni acentos, como en el resto del plugin. Si un prompt ya tiene el nombre nuevo, se fusionan y el aviso dice «fusionada». **Deshacer** restaura exactamente las etiquetas anteriores en cada prompt afectado. El gestor tiene la misma herramienta en su sección **Etiquetas**: elige una etiqueta (con su número de prompts), escribe el nombre nuevo y pulsa **Renombrar**. El diálogo *Guardar como…* solo edita la lista de etiquetas del prompt nuevo.
- Cada cambio emite `promptlib:changed`, así que la pestaña del gestor refresca su lista, y también su editor salvo que tenga cambios sin guardar. Reference Library y otras páginas abiertas también se refrescan.

**Gestor (pestaña Prompt Library, o el botón Gestionar)**
- Librería y editor a la izquierda, ajustes a la derecha.
- Lista + filtro, crear, editar, duplicar, eliminar (escribe `DELETE` para confirmar).
- Etiquetas y una categoría opcional.
- Importar / exportar en JSON (librería completa) o texto plano (bloques separados por `---`).

**Ejemplos iniciales**
- La primera vez se crean tres prompts con título `[Example] …`. Bórralos cuando quieras; solo sirven de semilla.

## Descripción en lenguaje natural (1.4.0)

Cada prompt puede guardar, opcionalmente, una descripción de la idea con tus palabras junto a su texto adaptado al modelo. Por ejemplo, «una mujer camina bajo la lluvia de neón, de noche, melancólica» junto al prompt preparado para H3. No depende de ningún modelo.

- **Barra:** la fila **Natural**, bajo las etiquetas, muestra un avance o *+ descripción*. Haz clic para editarla ahí mismo. Al editarla, el prompt queda *modificado*; **Actualizar** o **Guardar como…** la guardan, y Esc cierra el editor. **Copiar al prompt** pone la descripción en el prompt de WanGP. **Aplicar** siempre carga el prompt del modelo, nunca la descripción.
- **Guardar como…** (también al guardar desde el historial) y el **gestor** tienen el campo *Descripción en lenguaje natural (opcional)*.
- La **búsqueda** también mira la descripción. Si un resultado solo coincide ahí, lleva la marca *en la descripción natural* y un fragmento.
- Se guarda como `natural` en `library.json`. Las bibliotecas antiguas cargan igual, y `list_prompts()` / `get_prompt()` la incluyen.

## Historial de prompts (1.3.0)

Se guarda cada prompt que usas de verdad: al pulsar **Generate** (o **Add New Prompt To Queue**) en WanGP, el texto del cuadro de prompt visible pasa al historial.
- Ábrelo con el icono **Historial** (el cuadrado al final de los botones de la barra). Las entradas van de la más reciente a la más antigua, cada una con su fecha. La búsqueda usa la misma coincidencia de varias palabras sin distinguir acentos ni mayúsculas que la barra, y resalta lo encontrado.
- Cada entrada tiene tres acciones:
  - **Aplicar** la carga en el prompt de WanGP.
  - **Guardar en biblioteca** abre el diálogo *Guardar como…* de siempre, ya relleno.
  - **Borrar** la elimina.
- **Vaciar historial** lo deja vacío tras pedir confirmación. La casilla **Guardar historial** del diálogo desactiva la grabación (se guarda en `settings.json`).
- Repetir el mismo prompt seguido no crea un duplicado, solo actualiza la fecha. Se conservan las últimas 500 entradas.
- Se guarda en `history.json`, aparte de la biblioteca.

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

**Python:** `sys.modules["wan2gp_prompt_library_api"]`, `API_VERSION = 1`: `list_prompts()`, `prompts_for_collection(cid)`, `set_collection_prompts(cid, prompt_ids)`, `collections_for_prompt(pid)`, `set_prompt_collections(pid, cids)`, `get_prompt(pid)`, `revision()` y, desde 1.2.1, `rename_tag(old, new)`. Desde 1.4.0, `list_prompts()` y `get_prompt()` incluyen `natural`. Todas las escrituras son seguras entre hilos y se guardan de forma atómica. Consulta la tabla del README en inglés.

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
| Botones «Actualizar» / «Guardar como…» en la barra | muestra los dos botones de guardar | sí |
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
- `history.json` — el historial de prompts (1.3.0; se crea con el primer Generate).

Ninguno de ellos va en el zip ni en git, así que actualizar el plugin los conserva.

## Licencia

MIT © 2026 sweetyshots123
