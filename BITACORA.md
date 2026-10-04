# Bitácora: Black Shark

Esta bitácora reúne el plan de desarrollo y el registro de cambios. Cada cambio se anota abajo en **Registro de cambios**, con la fecha y lo que se hizo.

## Registro de cambios

### 2026-10-04: La app recuerda la última revisión, y se corrigen encabezados y fechas

**Lo que reportó el usuario.** La primera revisión completa dio 73 "Cambió de status", 163 "No aplica" y filas sin sentido.

**Errores**
1. **Encabezados repetidos a mitad de hoja** ("Radicación / Ultima Actuación") se contaban como procesos "No aplica". Ahora una fila de encabezado separa bloques. Resultado: los "No aplica" bajan de 163 a 20, todos de otras entidades (Fiscalía 9, Superintendencia 6, hoja interna 3, Penal 1, Civil 1). Los bloques bajan de 316 a 173.
2. **Fechas `25-05-08`** se leían como 25/05/2008 → 2030-04-25. Ahora:
   - Con guion y todo de 2 dígitos, se lee como año-mes-día.
   - Con `/` o `.`, se lee como día/mes/año.
   - Una fecha futura nunca es válida: se prueba la otra lectura.
   - Resultado: 0 fechas futuras en la matriz.

**Cambio de diseño: comparar contra la última revisión**
- Los 73 cambios eran reales: la matriz está atrasada (p. ej. un bloque termina en 2021 y la Rama Judicial va en 2026). Pero, como la app solo comparaba contra la matriz, **se habrían repetido cada día** mientras no se pegaran las actuaciones.
- Ahora el Excel generado guarda una **hoja oculta `_blackshark`** con lo visto hoy por radicado: fecha y actuaciones del último día, más la fecha de la revisión.
- Al día siguiente se compara contra **lo más reciente entre la matriz y esa revisión** (`registradasEfectivas`). El detalle dice "Comparado con la revisión del AAAA-MM-DD".
- Si una consulta falla, se conserva la revisión anterior de ese radicado.
- La pantalla muestra antes de consultar si es la primera revisión del archivo o desde qué fecha se compara.
- La columna pasa a llamarse "Status anterior (matriz o última revisión)".

**Verificación**
- 34 pruebas: lectura de fechas, encabezado repetido, revisión previa y la ida y vuelta de dos días. También pasan `tsc`, `lint` y `build`.
- **Simulación real de dos días** (matriz real, API real, 6 radicados):
  - Día 1: 3 cambios y 2 sin historial, con 10 peticiones.
  - Día 2, con el archivo del día 1: **todo sin cambios**, con 6 peticiones.

### 2026-10-04: Compartir arreglado, pie de página con autor y licencia

**Por qué fallaba Compartir**

Había tres causas, todas del navegador:
1. **Chrome y Edge no permiten compartir archivos `.xlsx`** con `navigator.share`: solo aceptan imágenes, PDF, texto, audio y video. `canShare` devolvía `false` y el botón no hacía nada, sin avisar.
2. **Safari exige que el menú se abra dentro del mismo toque.** La app generaba primero el Excel (1-2 s) y para entonces el permiso ya había vencido.
3. **Abierta por `http://IP:3000`** (celular en la misma wifi), el navegador desactiva `navigator.share` y `navigator.clipboard`, porque solo funcionan en `https` o `localhost`.

**Solución**
- El Excel se genera en cuanto termina la consulta y queda guardado, así que Compartir abre el menú al instante.
- **Compartir** envía un **resumen de texto** con los procesos que cambiaron (antes → ahora) y los conteos. El texto funciona en todos los navegadores y es ideal para WhatsApp. El Excel se adjunta solo donde el navegador lo permite (p. ej. Safari en iPhone).
- Sin `navigator.share`, el botón pasa a ser **Copiar resumen**, con un respaldo (`execCommand`) que funciona sin `https`. Los botones "Copiar para la matriz" usan el mismo respaldo.
- La app siempre muestra qué pasó: archivo compartido, solo texto, copiado o error.
- Código: `app/lib/compartir.ts` (`copiarTexto`, `resumenTexto`) y su prueba.

**Diseño**
- **Pie de página** (`app/components/PiePagina.tsx`):
  - Autor Edward Vasallo, con enlaces a [GitHub](https://github.com/EdwardVE) y [LinkedIn](https://www.linkedin.com/in/edward-vasallo-83a7a6159/).
  - "© 2026 · Licencia MIT" y la aclaración "Datos de la API pública de la Rama Judicial de Colombia. Herramienta no oficial."
- **Licencia MIT:** archivo `LICENSE`, y `license` y `author` en `package.json`.
- **"Cómo funciona"** en la pantalla inicial, en 3 pasos: subir la matriz, revisar el status, actualizar y compartir.
- En el celular, la barra de acciones es *sticky* en vez de fija, para no tapar el pie de página al final.

**Verificación**
- `tsc`, `lint`, `vitest` (29 pruebas) y `npm run build` pasan.

### 2026-10-04: Implementación de las fases 0 a 4

**Cambio de diseño con la matriz real** (`2. MATRIZ PROCESOS JUDICIALES V2026.xlsx`). La matriz no tiene una celda "Status" por proceso: es una bitácora.
- Tiene 13 hojas. En cada una, un radicado ocupa un bloque de filas con el Juzgado, las partes y el Radicado en celdas combinadas.
- Cada fila del bloque es una actuación (`AAAA-MM-DD ⇥ Actuación ⇥ Anotación`, copiada del portal).

Por eso:
- **Status anterior** = la última actuación del bloque en la matriz.
- **Status actual** = la última actuación en la Rama Judicial.
- **Actuaciones nuevas** = las publicadas después de la última fecha registrada. Para el mismo día, se comparan por nombre.
- **Entrega** (decisión del usuario): las hojas originales quedan intactas y se añade al inicio una hoja `Status AAAA-MM-DD` con una fila por bloque. Esa hoja trae estado, status anterior/actual, fecha, actuaciones nuevas listas para copiar en la matriz y detalle.
- Se descartó la hoja oculta `_blackshark`: la propia matriz ya guarda la última fecha.

**Fase 0: bases**
- `globals.css`:
  - `@custom-variant dark` para que el modo oscuro siga al botón y no al sistema operativo.
  - Tokens en `@theme` (`bg-surface`, `text-fg`, `bg-accent`…).
  - Se eliminó el `<style jsx>` duplicado y se arregló el botón sin fondo.
- `layout.tsx`: script anti-parpadeo (rescatado de `BlackShark.html`), `lang="es"`, título y `themeColor` para móviles.
- `useTheme.ts` usa `useSyncExternalStore`. `ThemeToggle.tsx` muestra los íconos con CSS (`dark:`), así que es correcto desde el primer pintado.
- Borrados: `app/hooks/useJudicialQuery.ts`, `public/BlackShark.html` y los 5 SVG de plantilla.
- Se quitaron los 5 radicados reales que venían escritos en el campo de texto.

**Fase 1: API resistente a fallos**
- `lib/api/judicial.ts` es ahora la única implementación.
  - Tipos de respuesta y timeout de 20 s.
  - `ApiError` con un campo `reintentable`.
  - Corregido el chequeo de no encontrado: `paginacion.cantidadRegistros`.
- `lib/api/cola.ts`:
  - Una petición a la vez, cada ~2 s con ±30 % de *jitter*.
  - 3 reintentos (2/4/8 s).
  - Cortacircuitos: tras 3 fallos seguidos, pausa de 60 s; si sigue fallando, se detiene.
  - Cancelación.
  - Ningún radicado se queda sin resultado: si falla, conserva su status anterior como "No verificado".

**Fase 2: Status**
- `lib/excel/leer.ts`:
  - Detecta en cada hoja la fila de encabezados y las columnas Radicación, Actuación, Juzgado y partes.
  - Agrupa los bloques.
  - Marca como "No aplica" los radicados que no tienen 23 dígitos (Superintendencia, Fiscalía, Penal).
  - Detecta los radicados guardados como número.
- `lib/excel/comparar.ts`: lógica pura. Lee fechas en varios formatos (`2023-02-23`, `14/11/19`, `25 01 2022`…), detecta actuaciones nuevas y decide el estado.
- `lib/excel/status.ts`: **solo pide las actuaciones si el proceso se movió** después de la última fecha de la matriz.
- `lib/excel/escribir.ts`: genera la hoja `Status` como primera pestaña, con filtros, encabezado fijo y colores por estado.

**Fase 3: interfaz pensada para el celular**
- `useConsultaLote.ts` maneja el estado, el progreso, cancelar, reintentar fallidos, la pantalla encendida (Wake Lock), descargar y compartir (`navigator.share`).
- Componentes: `ZonaExcel`, `PanelProgreso`, `ResumenStatus` (titular "N procesos cambiaron de status" con filtros), `TarjetaProceso` (celular), `TablaResultados` (escritorio), `InsigniaEstado` y `BotonCopiar` (copia las actuaciones nuevas en el formato de la matriz).
- En el celular, la barra de acciones queda fija abajo, con botones de al menos 44 px y respeta el área segura del teléfono.

**Fase 4: verificación**
- `npx tsc --noEmit`, `npm run lint` y `npm test` pasan: 28 pruebas en 4 archivos.
- `npm run build` pasa. **Antes fallaba.**
- Prueba de punta a punta con la matriz real y la API real (6 radicados):
  - 10 peticiones en 19 s. El ahorro evitó 2 peticiones.
  - Detectó 3 cambios de status reales.
- La matriz completa tiene 316 bloques: 153 consultables y 140 radicados únicos. Estimado: unos 6-8 min por revisión completa.
- Al comparar la matriz con el Excel generado, el contenido, el formato y las celdas combinadas de las 13 hojas originales quedan iguales. Las únicas diferencias son 9 celdas que tenían un retorno de carro invisible al final (`\r` → `\n`), que no se nota.
- exceljs (~900 KB) se carga aparte, solo al subir un archivo.

**Pendiente o fuera de alcance**
- Probar la interfaz en un navegador real y en el celular. No se pudo hacer desde la terminal.
- ⚠️ **`next@16.0.3` tiene una vulnerabilidad crítica** según `npm audit`. Conviene actualizar a la última versión 16.x en un cambio aparte.
- La matriz del usuario no se sube a git (`*.xlsx` en `.gitignore`). Hay que borrarla antes del push.

### 2026-10-04: Hallazgos al probar la API real

- `GET /api/v2/Procesos/Consulta/NumeroRadicacion` responde en menos de 1 s y trae `Access-Control-Allow-Origin: *`, así que la consulta desde el navegador funciona.
- **Error nuevo:** `cantidadRegistros` viene dentro de `paginacion`, no en la raíz de la respuesta. Por eso el chequeo de "no encontrado" del código actual nunca se activa.
- La API no expone `Retry-After` al navegador (solo expone `Content-Disposition`). La espera entre reintentos se calcula por nuestra cuenta.
- `GET /api/v2/Proceso/Actuaciones/{idProceso}?pagina=1` funciona y devuelve las actuaciones de la más reciente a la más antigua. Cada una trae `actuacion` (p. ej. "Fijacion estado", "Auto de Trámite") y `anotacion` (p. ej. "AUTO REPROGRAMA AUDIENCIA"). La hipótesis Status = última actuación es viable.
- `GET /api/v2/Proceso/Detalle/{idProceso}` trae `tipoProceso`, `claseProceso` y `ubicacion` (llegó en `null` en la prueba).

---

## Plan aprobado (2026-10-04)

## Contexto

Black Shark consulta procesos en la API de la Rama Judicial (`consultaprocesos.ramajudicial.gov.co:448`) a partir de radicados pegados a mano. **El objetivo de la app es el Status de cada proceso.**

Cada día subes tu Excel, que trae el Status de la última revisión, por ejemplo la de ayer. La app consulta la Rama Judicial y te dice **si cambió el Status y cuál es el Status actual**. Después descarga el Excel actualizado. Todo tiene que funcionar **también desde el celular**.

También hay que resolver lo siguiente:
- Aguantar los fallos de la API del Estado: timeouts, reintentos y pausas.
- Modo claro/oscuro, diseño y usabilidad.
- Limpiar el código duplicado.

Decisiones tuyas:
- Flujo de subir y descargar en la web, sin servidor.
- Excel con formato propio.
- Tu columna Status se **actualiza** y el valor anterior se guarda en "Status anterior".
- La limpieza incluye unificar el código y borrar `BlackShark.html` y los SVG de plantilla.

> ⚠️ **Pendiente: tu documento.** La API que usa hoy la app (búsqueda por radicado) **no devuelve un campo "status"**: solo trae fechas, despacho y sujetos. De qué endpoint sale el Status depende de lo que contenga tu columna, y eso lo confirmo con tu Excel antes de escribir `status.ts` (Fase 2). Mientras tanto, la hipótesis de trabajo es que **Status = última actuación** (p. ej. "Auto admite demanda", "Al despacho"). Las fases 0 y 1 no dependen de esto.

### Respuestas a tus preguntas del grafo

- **¿Qué relación hay entre `page.tsx` y `BlackShark.html`?** El HTML es el **prototipo** del que salió `page.tsx`. Ambos entraron en el commit `9a14879 initial`.
  - Comparten la misma maqueta, las mismas variables CSS, los mismos IDs (`theme-toggle`, `loading-spinner`, `message-box`…) y el mismo `showMessage`.
  - El prototipo consultaba datos falsos (planetas) por ID. `page.tsx` lo adaptó a la API real.
  - Lo único que valía la pena y no se migró es su script anti-parpadeo de tema. Se rescata en la Fase 0.
- **¿Por qué `react` conecta tema, consulta y resultados?** Es un artefacto del grafo: los tres archivos importan `react` y nada más, así que no hay acoplamiento real. Lo real es que `page.tsx` **copia** dentro de sí el tema, el `ThemeToggle` y la función de consulta.
- **¿Qué pasa con los 61 nodos aislados?** Tienen tres causas:
  - (a) **Código muerto.** `useTheme.ts`, `ThemeToggle.tsx`, `lib/api/judicial.ts` y `useJudicialQuery.ts` no los importa nadie, porque `page.tsx` tiene copias propias. De ahí `ThemeToggleProps`, `Message`, etc.
  - (b) Cada clave de `tsconfig.json` y `package.json` es un nodo. Es normal.
  - (c) `geistSans`, `metadata`… se usan en JSX, y graphify no dibuja esas aristas.
  - Solo (a) es un problema real, y se arregla aquí.
- **¿Dividir "Config TypeScript" (cohesión 0.11)?** No. Es un único `tsconfig.json`, y la cohesión baja solo refleja cómo graphify modela el JSON. No aporta nada.

### Errores encontrados en la depuración (se corrigen en este plan)

1. **La compilación falla:** `npx tsc --noEmit` da `app/page.tsx(83,45): TS18046 'data' is of type 'unknown'`. Por eso `npm run build` no pasa.
2. **Las clases `dark:` siguen al sistema operativo y no al botón** (Tailwind v4). Los avisos salen oscuros con la app en modo claro.
3. **El botón "Consultar" no tiene fondo.** `bg-accent-color` no existe, así que queda texto blanco sobre blanco.
4. Hay dos juegos de variables de color que chocan: `--color-accent` (`globals.css`) y `--color-accent-color` (`<style jsx>` de `page.tsx`).
5. Al cargar parpadea el tema equivocado, porque se aplica en `useEffect`.
6. La lista de errores muestra `**` literales (`page.tsx:204`).
7. El campo de texto viene relleno con 5 radicados reales. Se quitan por privacidad.
8. El comentario dice "1 segundo", pero el código espera 2000 ms.
9. `layout.tsx` tiene `lang="en"` y el título "Create Next App".
10. **Riesgo del Excel:** un radicado tiene 23 dígitos y Excel guarda solo 15 en celdas numéricas. Si la columna no es de texto, los dígitos ya están perdidos en el archivo. La app lo detecta y avisa.
11. **En el celular no es usable hoy:** la tabla de 5 columnas desborda y no hay forma de subir ni descargar archivos.

## Enfoque

Todo corre en el navegador, ya sea en el PC o en el celular: se lee el Excel, se consulta la API y se genera el Excel nuevo. Las consultas ya funcionan desde tu navegador. Un servidor en la nube (fuera de Colombia) arriesga bloqueos de la Rama Judicial.

El Excel se maneja con [exceljs](https://github.com/exceljs/exceljs), que lee y escribe estilos para poder resaltar los cambios. Se carga con `import()` dinámico solo al subir el archivo, para que en el celular la carga inicial siga siendo liviana.

### Fase 0: Bases (tema, compilación, limpieza)

- **`app/globals.css`**
  - Añadir `@custom-variant dark (&:where(.dark, .dark *));`.
  - Tokens en `@theme` (`--color-surface`, `--color-fg`, `--color-muted`, `--color-accent`, `--color-border`, `--color-danger`, `--color-warn`, `--color-ok`) con sus valores para `.dark`.
  - Eliminar el `<style jsx global>` de `page.tsx`.
- **`app/layout.tsx`**
  - Script anti-parpadeo en `<head>` (el de `BlackShark.html`) y `suppressHydrationWarning`.
  - `lang="es"`, título "Black Shark · Consulta de procesos" y `themeColor` para la barra del navegador móvil.
- **Reutilizar**
  - [useTheme.ts](app/hooks/useTheme.ts): inicializar desde la clase ya aplicada.
  - [ThemeToggle.tsx](app/components/ThemeToggle.tsx): `page.tsx` lo usa y se borra la copia inline.
- **Borrar** `app/hooks/useJudicialQuery.ts`, `public/BlackShark.html` y `public/{file,globe,next,vercel,window}.svg`.
- **Tipar la respuesta de la API.** Con eso se arregla el error de compilación.

### Fase 1: Cliente de la API resistente a fallos

- **[app/lib/api/judicial.ts](app/lib/api/judicial.ts)** pasa a ser la única implementación.
  - Tipos `ApiProceso` (`idProceso`, `llaveProceso`, `fechaProceso`, `fechaUltimaActuacion`, `despacho`, `departamento`, `sujetosProcesales`, `esPrivado`).
  - `consultarRadicado(radicado, { signal, timeoutMs = 20000 })` corta por timeout con `AbortController`.
  - Se añade la consulta del Status (hipótesis: `GET /api/v2/Proceso/Actuaciones/{idProceso}?pagina=1`, primera actuación = la más reciente). El endpoint exacto se confirma con tu documento.
  - Clase `ApiError` con `tipo` y un campo `reintentable`.
    - Se reintentan: timeout, red, 429, 5xx y respuestas que no son JSON.
    - No se reintentan: 404/400 ni `cantidadRegistros === 0`.
- **`app/lib/api/cola.ts` (nuevo)**: `ejecutarCola(...)`. Reemplaza `queryMultipleJudicialProcesses`.
  - **Una petición a la vez**, con ~2 s más *jitter* (±30 %) entre peticiones. Se conserva el ritmo del commit `b7dd8f6 limite`.
  - **Hasta 3 reintentos** con espera exponencial (~2/4/8 s más *jitter*). Se respeta `Retry-After`.
  - **Cortacircuitos:** tras 3 fallos seguidos, pausa de 60 s con cuenta atrás visible. Si vuelve a fallar, se detiene y puedes descargar lo que haya.
  - **Nunca se pierde el Status.** Si una fila falla, su Status queda **igual que ayer** y se marca "No verificado hoy – reintentar". Nunca se borra ni se inventa un cambio.
  - Botones **Cancelar** y **"Reintentar fallidos"**.

### Fase 2: Status (el núcleo)

Los archivos nuevos van en `app/lib/excel/`.

- **`leer.ts`**
  - Autodetecta, por encabezado y por contenido, la **columna de radicados**, la **columna Status** ("status"/"estado") y, si existe, la de **fecha de última revisión**. Si hay duda, un selector te deja elegirlas.
  - Valida 23 dígitos, quita duplicados y avisa de las celdas numéricas.
- **`status.ts`**: `obtenerStatusActual(radicado, procesos)` devuelve el Status actual.
  - Si un radicado tiene varios procesos (p. ej. primera y segunda instancia), se toma el de la `fechaUltimaActuacion` más reciente y los demás se listan en el detalle.
  - **Ahorro de peticiones:** solo se pide la actuación cuando `fechaUltimaActuacion` es posterior a la última revisión o cuando la fila no tiene Status. Si el proceso no se movió, su Status no pudo cambiar. Así, la mayoría de los días casi no hay peticiones extra.
- **`comparar.ts`**: función pura `comparar(statusAnterior, statusActual, procesos)`.
  - Normaliza el texto (mayúsculas, sin tildes, espacios) para no dar cambios falsos por formato.

  | Resultado | Cuándo |
  |---|---|
  | **Cambió de Status** | El Status actual ≠ el Status del Excel (se muestran anterior → actual) |
  | Sin cambios | Mismo Status |
  | Nuevo | Fila sin Status previo; se llena por primera vez |
  | Proceso nuevo / ya no aparece | Entra o sale un proceso de la lista del radicado |
  | No encontrado | La API respondió sin registros |
  | No verificado hoy | Falló después de los reintentos; se conserva el Status anterior |

- **`escribir.ts`**: respeta tus hojas y columnas.
  - Tu **columna Status pasa a tener el Status actual**.
  - Columnas nuevas al final:
    - **Status anterior**
    - **¿Cambió?** (Sí/No)
    - **Fecha del cambio**
    - **Última revisión** (la de hoy)
    - Fecha de última actuación
    - Despacho
    - Detalle
  - Filas resaltadas: amarillo = cambió de Status, verde = nuevo, rojo = no verificado.
  - Hoja **"Historial de status"**: se va acumulando con fecha, radicado, Status anterior y Status nuevo. Así queda la línea de tiempo de cada proceso.
  - Hoja oculta **`_blackshark`**: la foto por proceso (`idProceso`, `fechaUltimaActuacion`) que permite el ahorro de peticiones.
  - Nombre del archivo: `<nombre>_actualizado_AAAA-MM-DD.xlsx`.

### Fase 3: Interfaz, pensada primero para el celular

- **`app/page.tsx`** queda solo como composición. La lógica pasa a `app/hooks/useConsultaLote.ts`, con los estados, el progreso, cancelar y reintentar.
- **Pantalla de resultados con el Status primero.** Arriba va un resumen: **"3 procesos cambiaron de Status desde la revisión del 03/10/2026"**, con esas tarjetas primero (Status anterior → actual). Debajo, filtros: Cambios | Sin cambios | No verificados | Todos.
- **Celular**
  - **Tarjetas** por radicado (radicado, Status actual y anterior, fecha, despacho) en vez de la tabla en pantallas `< md`. La tabla se queda para escritorio.
  - Botones de al menos 44 px y un botón principal fijo abajo ("Subir Excel" / "Descargar").
  - Subir desde Archivos, Drive o descargas de WhatsApp con `<input type="file" accept=".xlsx">`.
  - **Compartir el Excel resultante** con el menú nativo del teléfono (`navigator.share` con el archivo: WhatsApp, correo, Drive). Si el navegador no lo soporta, se descarga normal.
  - **Pantalla encendida durante la consulta** (Wake Lock API), más un aviso de no cambiar de app. Los navegadores móviles congelan las pestañas en segundo plano.
- **Pestaña "Pegar radicados"**: el textarea actual, vacío, con validación por línea. Sirve para consultas rápidas sin Excel.
- **Componentes nuevos en `app/components/`:**
  - `ZonaExcel.tsx`: subir, vista previa de las columnas detectadas y avisos.
  - `PanelProgreso.tsx`: "12/80 · ~2 min", pausas y Cancelar, anunciado con `aria-live`.
  - `ResumenStatus.tsx`.
  - `TarjetaProceso.tsx` (celular) y `TablaResultados.tsx` (escritorio, movida desde `page.tsx`), con enlace a cada proceso en el portal oficial.
  - `InsigniaEstado.tsx`.

### Fase 4: Pruebas

- `vitest` (dependencia de desarrollo), con pruebas para:
  - `comparar.ts`: cada resultado de la tabla, incluida la normalización de texto.
  - `status.ts`: que **no** pida la actuación si la fecha no se movió.
  - `cola.ts`: reintentos y cortacircuitos, con temporizadores falsos.
  - Ida y vuelta del Excel: escribir, leer y volver a comparar debe dar "Sin cambios".

## Archivos clave

- **Modificar:** `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/lib/api/judicial.ts`, `app/hooks/useTheme.ts`, `app/components/ThemeToggle.tsx`, `package.json` (exceljs, vitest).
- **Nuevos:**
  - `app/lib/api/cola.ts`
  - `app/lib/excel/{leer,status,comparar,escribir}.ts`
  - `app/hooks/useConsultaLote.ts`
  - `app/components/{ZonaExcel,PanelProgreso,ResumenStatus,TarjetaProceso,TablaResultados,InsigniaEstado}.tsx`
  - Sus pruebas.
- **Borrar:** `app/hooks/useJudicialQuery.ts`, `public/BlackShark.html`, `public/{file,globe,next,vercel,window}.svg`.

## Verificación

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` pasan. Hoy el build falla.
2. **Con tu Excel** (una copia, con 3-5 radicados):
   - Se detectan bien la columna de radicados y la de Status.
   - En la descarga, tu Status muestra el actual, junto a "Status anterior" y "¿Cambió?", con las filas resaltadas y la hoja "Historial de status".
   - Cambiar a mano un Status en el Excel y volver a subirlo debe dar "Cambió de Status" con el anterior y el actual.
   - Volver a subir el archivo descargado sin tocar nada debe dar todo "Sin cambios", casi sin peticiones de actuaciones.
3. **Fallos:** cortar la red (DevTools → Offline) a mitad de la corrida. Deben verse los reintentos y la pausa. Las filas quedan como "No verificado hoy" con su Status intacto, y "Reintentar fallidos" las completa.
4. **Celular**
   - DevTools en modo dispositivo (iPhone o Android a 390 px de ancho).
   - Además, en tu teléfono real: `npm run dev -- -H 0.0.0.0` y abrir `http://<IP-del-PC>:3000` en la misma wifi.
   - Probar subir el Excel desde Archivos o WhatsApp, ver las tarjetas, compartir el resultado por WhatsApp y comprobar que la pantalla no se apaga.
5. **Tema:** con el sistema en oscuro, poner la app en claro (y al revés). Todo debe seguir al botón, sin parpadeo y con el botón Consultar visible.

## Sugerencias para mejorar la app

**Incluidas en este plan:**
- El resumen "cambiaron de Status" arriba.
- La hoja "Historial de status".
- Compartir por WhatsApp desde el celular.
- La pantalla encendida mientras consulta.
- El ahorro de peticiones.

**Para después (dime cuáles te interesan):**
1. **Instalable en el celular (PWA):** un ícono en la pantalla de inicio que se abre como una app.
2. **"Días sin movimiento":** una columna más una alerta para procesos estancados más de N días.
3. **Avisos automáticos** por correo o WhatsApp cuando cambie un Status. Requiere un servidor en Colombia y es una fase aparte.
4. **Acceso con contraseña.** Hoy cualquiera con el enlace puede usar la app.
5. **Filtros** por despacho, ciudad o sujeto procesal.

**Preguntas abiertas:**
- ¿Cuántos radicados revisas al día? Con unos 100, la corrida tarda unos 4 min.
- ¿Dónde está desplegada (Vercel u otro)?
