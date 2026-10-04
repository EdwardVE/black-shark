// lib/excel/comparar.ts
// Lógica pura (sin red ni Excel): interpreta las actuaciones escritas en la
// matriz y decide si la Rama Judicial publicó algo nuevo.

import type {
  Actuacion,
  ActuacionRegistrada,
  BloqueRadicado,
  DatosRama,
  ResultadoBloque,
  RevisionPrevia,
} from "../tipos";

/** Texto comparable: sin tildes, sin espacios extra y en mayúsculas. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

function fechaValida(a: number, m: number, d: number): string | null {
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${a}-${dosDigitos(m)}-${dosDigitos(d)}`;
}

const hoyLocal = () => new Date().toLocaleDateString("sv-SE");

/**
 * Fecha al inicio del texto, en los formatos que aparecen en la matriz:
 * "2023-02-23 …", "14/11/19. …", "25 01 2022 …", "25-05-2022 …" y
 * "25-05-08 …" (año corto primero, como el portal pero sin el siglo).
 * Una fecha futura no es válida: se prueba la otra lectura.
 */
export function parsearFecha(texto: string, hoy: string = hoyLocal()): string | null {
  const t = texto.trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return fechaValida(+iso[1], +iso[2], +iso[3]);

  const m = t.match(/^(\d{1,2})([/\-. ])(\d{1,2})[/\-. ](\d{4}|\d{2})(?!\d)/);
  if (!m) return null;
  const [, a, separador, b, c] = m;
  const diaMesAnio = fechaValida(c.length === 2 ? 2000 + +c : +c, +b, +a);
  const anioMesDia = c.length === 2 ? fechaValida(2000 + +a, +b, +c) : null;

  // Con guion y todo de 2 dígitos ("25-05-08") lo usual es año-mes-día.
  const candidatas =
    separador === "-" && a.length === 2 && c.length === 2
      ? [anioMesDia, diaMesAnio]
      : [diaMesAnio, anioMesDia];
  return candidatas.find((f) => f !== null && f <= hoy) ?? null;
}

/** Interpreta una celda de actuación de la matriz. */
export function parsearRegistro(texto: string): ActuacionRegistrada {
  const limpio = texto.trim();
  const fecha = parsearFecha(limpio);
  let nombre: string;
  if (limpio.includes("\t")) {
    // Formato copiado del portal: fecha ⇥ actuación ⇥ anotación…
    nombre = limpio.split("\t")[1] ?? "";
  } else {
    nombre = limpio
      .replace(/^[\d/\-. ]+/, "")
      .replace(/^[.:\-\s]+/, "");
  }
  return { fecha, nombre: nombre.trim(), texto: limpio };
}

/** La actuación en el mismo formato que la matriz (fecha ⇥ actuación ⇥ anotación). */
export function textoActuacion(a: Actuacion): string {
  return [a.fecha ?? "", a.actuacion, a.anotacion].filter(Boolean).join("\t");
}

/** Fecha más reciente registrada en la matriz para un bloque. */
export function fechaMasReciente(registradas: ActuacionRegistrada[]): string | null {
  return registradas.reduce<string | null>(
    (max, r) => (r.fecha && (!max || r.fecha > max) ? r.fecha : max),
    null
  );
}

/**
 * Actuaciones de la Rama Judicial que no están en la matriz.
 * Con fechas: todo lo posterior a la última fecha registrada; si es del mismo
 * día, solo si su nombre no aparece en las filas de ese día.
 * Sin fechas legibles: lo que esté antes de la primera actuación reconocida.
 */
export function actuacionesNuevas(
  registradas: ActuacionRegistrada[],
  actuaciones: Actuacion[]
): Actuacion[] {
  const ultima = fechaMasReciente(registradas);
  const textos = registradas.map((r) => normalizar(r.texto));

  if (ultima) {
    const delDia = registradas
      .filter((r) => r.fecha === ultima)
      .map((r) => normalizar(r.texto));
    return actuaciones.filter((a) => {
      if (!a.fecha) return false;
      if (a.fecha > ultima) return true;
      return (
        a.fecha === ultima &&
        !delDia.some((t) => t.includes(normalizar(a.actuacion)))
      );
    });
  }

  const nuevas: Actuacion[] = [];
  for (const a of actuaciones) {
    const nombre = normalizar(a.actuacion);
    if (nombre && textos.some((t) => t.includes(nombre))) break;
    nuevas.push(a);
  }
  return nuevas;
}

/**
 * Actuaciones contra las que se compara un bloque: las de la matriz y, si la
 * última revisión guardada es igual o más reciente, también las de esa revisión.
 * Así, si la matriz no se actualizó, mañana no se repiten los cambios de hoy.
 */
export function registradasEfectivas(bloque: BloqueRadicado): {
  registradas: ActuacionRegistrada[];
  revision: RevisionPrevia | null;
} {
  const previa = bloque.revisionPrevia;
  const fechaMatriz = fechaMasReciente(bloque.registradas);
  if (!previa || (fechaMatriz && previa.fecha < fechaMatriz)) {
    return { registradas: bloque.registradas, revision: null };
  }
  // La revisión guarda la más reciente primero; aquí la más reciente va al final.
  const vistas = previa.status.split("\n").filter(Boolean).map(parsearRegistro).reverse();
  return { registradas: [...bloque.registradas, ...vistas], revision: previa };
}

/** Fecha desde la que hay que buscar actuaciones nuevas para un bloque. */
export const fechaComparacion = (bloque: BloqueRadicado) =>
  fechaMasReciente(registradasEfectivas(bloque).registradas);

const MAX_NUEVAS_SIN_HISTORIAL = 10;

/** Decide el estado de un bloque a partir de lo que respondió la Rama Judicial. */
export function evaluarBloque(
  bloque: BloqueRadicado,
  datos: DatosRama | null
): ResultadoBloque {
  const { registradas, revision } = registradasEfectivas(bloque);
  const anterior = registradas.at(-1) ?? null;
  const origen = revision ? `Comparado con la revisión del ${revision.revisadoEl}.` : "";
  const base: ResultadoBloque = {
    bloque,
    estado: "sin_cambios",
    statusAnterior: anterior?.texto ?? null,
    fechaAnterior: fechaMasReciente(registradas),
    statusActual: anterior?.texto ?? null,
    fechaActual: fechaMasReciente(registradas),
    nuevas: [],
    despacho: datos?.principal?.despacho ?? "",
    detalle: origen,
  };

  if (!bloque.consultable) {
    return { ...base, estado: "no_aplica", detalle: bloque.motivoNoConsultable ?? "" };
  }
  if (!datos) {
    return { ...base, estado: "error", detalle: "No se consultó" };
  }
  if (datos.error) {
    return {
      ...base,
      estado: datos.error.tipo === "no_encontrado" ? "no_encontrado" : "error",
      detalle: datos.error.mensaje,
    };
  }

  const otros = datos.procesos.length - 1;
  const detalleProcesos =
    otros > 0 ? `El radicado tiene ${datos.procesos.length} procesos; se usa el más reciente.` : "";

  if (datos.principal?.esPrivado) {
    return {
      ...base,
      estado: "reservado",
      detalle: "Proceso reservado: la Rama Judicial no publica sus actuaciones.",
    };
  }

  const unir = (...partes: string[]) => partes.filter(Boolean).join(" ");

  // Sin movimiento desde la última fecha registrada: no se pidieron actuaciones.
  if (datos.actuaciones === null) {
    return { ...base, detalle: unir(origen, detalleProcesos) };
  }

  const [ultima] = datos.actuaciones;
  if (!ultima) {
    return { ...base, detalle: "La Rama Judicial no tiene actuaciones publicadas." };
  }

  if (registradas.length === 0) {
    return {
      ...base,
      estado: "nuevo",
      statusActual: textoActuacion(ultima),
      fechaActual: ultima.fecha,
      nuevas: datos.actuaciones.slice(0, MAX_NUEVAS_SIN_HISTORIAL),
      detalle: ["Sin actuaciones en la matriz.", detalleProcesos].filter(Boolean).join(" "),
    };
  }

  const nuevas = actuacionesNuevas(registradas, datos.actuaciones);
  if (nuevas.length === 0) {
    return { ...base, detalle: unir(origen, detalleProcesos) };
  }

  const avisoSinFecha = base.fechaAnterior
    ? ""
    : "El status anterior no tiene fecha legible; verifica el cambio.";
  return {
    ...base,
    estado: "cambio",
    statusActual: textoActuacion(nuevas[0]),
    fechaActual: nuevas[0].fecha,
    nuevas,
    detalle: unir(`${nuevas.length} actuación(es) nueva(s).`, origen, avisoSinFecha, detalleProcesos),
  };
}

/**
 * Revisiones a guardar tras consultar: lo visto hoy para cada radicado
 * verificado; los que fallaron conservan su revisión anterior.
 */
export function actualizarRevisiones(
  previas: Map<string, RevisionPrevia>,
  datos: DatosRama[],
  hoy: string
): Map<string, RevisionPrevia> {
  const revisiones = new Map(previas);
  for (const d of datos) {
    if (d.error) continue;
    const [ultima] = d.actuaciones ?? [];
    if (ultima?.fecha) {
      const delDia = d.actuaciones!.filter((a) => a.fecha === ultima.fecha);
      revisiones.set(d.radicado, {
        fecha: ultima.fecha,
        status: delDia.map(textoActuacion).join("\n"),
        revisadoEl: hoy,
      });
    } else {
      // Sin movimiento: se mantiene lo último visto, con la fecha de hoy.
      const previa = revisiones.get(d.radicado);
      if (previa) revisiones.set(d.radicado, { ...previa, revisadoEl: hoy });
    }
  }
  return revisiones;
}

/** Orden de importancia para mostrar resultados: lo que cambió va primero. */
export const PRIORIDAD_ESTADO: Record<ResultadoBloque["estado"], number> = {
  cambio: 0,
  nuevo: 1,
  error: 2,
  no_encontrado: 3,
  reservado: 4,
  sin_cambios: 5,
  no_aplica: 6,
};

export function ordenarResultados(resultados: ResultadoBloque[]): ResultadoBloque[] {
  return [...resultados].sort(
    (a, b) => PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado]
  );
}
