// hooks/useConsultaLote.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ejecutarCola, type EventoCola } from "../lib/api/cola";
import { copiarTexto, resumenTexto } from "../lib/compartir";
import { actualizarRevisiones, evaluarBloque, fechaComparacion } from "../lib/excel/comparar";
import { generarExcel, nombreSalida, TIPO_XLSX } from "../lib/excel/escribir";
import { bloquesDesdeTexto, leerMatriz, type MatrizLeida } from "../lib/excel/leer";
import { datosConError, obtenerDatosRama } from "../lib/excel/status";
import type { BloqueRadicado, DatosRama, ResultadoBloque } from "../lib/tipos";

export type Fase = "inicial" | "leyendo" | "lista" | "consultando" | "terminada";

export type ResultadoCompartir = "archivo" | "texto" | "copiado" | "cancelado" | "error";

export interface Progreso {
  hechos: number;
  total: number;
  inicio: number;
  pausaHasta: number | null;
  aviso: string | null;
}

/** Fecha local AAAA-MM-DD. */
const hoy = () => new Date().toLocaleDateString("sv-SE");

/** Mantiene la pantalla encendida mientras se consulta (si el navegador lo permite). */
async function mantenerPantallaEncendida(): Promise<() => void> {
  let bloqueo: WakeLockSentinel | null = null;
  const pedir = async () => {
    try {
      bloqueo = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      bloqueo = null; // batería baja, permiso denegado o navegador sin soporte
    }
  };
  const alVolver = () => {
    if (document.visibilityState === "visible") void pedir();
  };
  await pedir();
  document.addEventListener("visibilitychange", alVolver);
  return () => {
    document.removeEventListener("visibilitychange", alVolver);
    void bloqueo?.release().catch(() => {});
  };
}

/** Radicados a consultar con la fecha registrada más antigua de sus bloques. */
function radicadosAConsultar(bloques: BloqueRadicado[], solo?: Set<string>) {
  const fechas = new Map<string, string | null>();
  for (const b of bloques) {
    if (!b.consultable || (solo && !solo.has(b.radicado))) continue;
    const fecha = fechaComparacion(b);
    if (!fechas.has(b.radicado)) {
      fechas.set(b.radicado, fecha);
      continue;
    }
    const previa = fechas.get(b.radicado) ?? null;
    fechas.set(b.radicado, previa === null || fecha === null ? null : fecha < previa ? fecha : previa);
  }
  return [...fechas];
}

function aplicarEvento(p: Progreso, e: EventoCola): Progreso {
  switch (e.tipo) {
    case "reintento":
      return {
        ...p,
        aviso: `La Rama Judicial falló (${e.error.message}). Reintento ${e.intento} en ${Math.round(
          e.esperaMs / 1000
        )} s…`,
      };
    case "pausa":
      return { ...p, pausaHasta: e.hasta, aviso: "La Rama Judicial no responde. Pausa de 1 minuto…" };
    case "reanudada":
      return { ...p, pausaHasta: null, aviso: null };
    case "detenida":
      return { ...p, pausaHasta: null, aviso: e.motivo };
  }
}

export function useConsultaLote() {
  const [fase, setFase] = useState<Fase>("inicial");
  const [matriz, setMatriz] = useState<MatrizLeida | null>(null);
  const [bloques, setBloques] = useState<BloqueRadicado[]>([]);
  const [datos, setDatos] = useState<Map<string, DatosRama>>(new Map());
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detenida, setDetenida] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const control = useRef<AbortController | null>(null);

  const resultados: ResultadoBloque[] = useMemo(
    () =>
      bloques
        .filter((b) => !b.consultable || datos.has(b.radicado))
        .map((b) => evaluarBloque(b, datos.get(b.radicado) ?? null)),
    [bloques, datos]
  );

  const fallidos = useMemo(
    () =>
      [...datos.values()].filter((d) => d.error && d.error.tipo !== "no_encontrado")
        .length,
    [datos]
  );

  const prepararBloques = (nuevos: BloqueRadicado[], leida: MatrizLeida | null) => {
    setMatriz(leida);
    setBloques(nuevos);
    setDatos(new Map());
    setProgreso(null);
    setDetenida(false);
    setFase(nuevos.length > 0 ? "lista" : "inicial");
  };

  const cargarArchivo = useCallback(async (archivo: File) => {
    setError(null);
    setFase("leyendo");
    try {
      const leida = await leerMatriz(await archivo.arrayBuffer(), archivo.name);
      const nuevos = leida.hojas.flatMap((h) => h.bloques);
      if (nuevos.length === 0) {
        setError("No se encontró ninguna hoja con columnas «Radicación» y «Actuación».");
      }
      prepararBloques(nuevos, leida);
    } catch (e) {
      setError(
        `No se pudo leer el archivo. ¿Es un Excel (.xlsx)? ${e instanceof Error ? e.message : ""}`
      );
      setFase("inicial");
    }
  }, []);

  const cargarTexto = useCallback((texto: string) => {
    setError(null);
    const nuevos = bloquesDesdeTexto(texto);
    if (nuevos.length === 0) setError("Escribe al menos un número de radicación.");
    prepararBloques(nuevos, null);
  }, []);

  const consultar = useCallback(
    async (solo?: Set<string>) => {
      const items = radicadosAConsultar(bloques, solo);
      if (items.length === 0) return;

      const ctrl = new AbortController();
      control.current = ctrl;
      setError(null);
      setDetenida(false);
      setFecha(hoy());
      setFase("consultando");
      setProgreso({ hechos: 0, total: items.length, inicio: Date.now(), pausaHasta: null, aviso: null });
      const liberarPantalla = await mantenerPantallaEncendida();

      try {
        const salida = await ejecutarCola(items, {
          tarea: ([radicado, fechaRegistrada], pedir) =>
            obtenerDatosRama(radicado, fechaRegistrada, pedir),
          alFallar: ([radicado], e) => datosConError(radicado, e),
          alTerminarItem: (d, hechos) => {
            setDatos((previos) => new Map(previos).set(d.radicado, d));
            setProgreso((p) => p && { ...p, hechos, aviso: p.pausaHasta ? p.aviso : null });
          },
          onEvento: (e) => setProgreso((p) => p && aplicarEvento(p, e)),
          signal: ctrl.signal,
        });
        setDetenida(salida.detenida);
      } finally {
        liberarPantalla();
        control.current = null;
        setFase("terminada");
      }
    },
    [bloques]
  );

  const cancelar = useCallback(() => control.current?.abort(), []);

  const reintentarFallidos = useCallback(() => {
    const solo = new Set(
      [...datos.values()]
        .filter((d) => d.error && d.error.tipo !== "no_encontrado")
        .map((d) => d.radicado)
    );
    return consultar(solo);
  }, [datos, consultar]);

  // El Excel se genera una sola vez por juego de resultados y se guarda listo:
  // Safari solo permite compartir si se llama justo en el toque, sin esperar 1-2 s.
  const archivo = useRef<{ clave: ResultadoBloque[]; promesa: Promise<File>; listo: File | null } | null>(null);

  const obtenerArchivo = useCallback(() => {
    if (archivo.current?.clave !== resultados) {
      const entrada = {
        clave: resultados,
        listo: null as File | null,
        promesa: generarExcel({
          libro: matriz?.libro ?? null,
          resultados,
          fecha,
          revisiones: actualizarRevisiones(matriz?.revisiones ?? new Map(), [...datos.values()], fecha),
        }).then(
          (contenido) =>
            new File([contenido], nombreSalida(matriz?.nombreArchivo ?? null, fecha), { type: TIPO_XLSX })
        ),
      };
      entrada.promesa.then((f) => (entrada.listo = f)).catch(() => {});
      archivo.current = entrada;
    }
    return archivo.current;
  }, [matriz, resultados, fecha, datos]);

  useEffect(() => {
    if (fase === "terminada") obtenerArchivo().promesa.catch(() => {});
  }, [fase, obtenerArchivo]);

  const descargar = useCallback(async () => {
    const f = await obtenerArchivo().promesa;
    const url = URL.createObjectURL(f);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = f.name;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [obtenerArchivo]);

  /**
   * Menú nativo de compartir. Adjunta el Excel si el navegador lo permite
   * (Chrome/Edge no aceptan .xlsx); si no, comparte el resumen en texto.
   * Sin navigator.share (p. ej. en http), copia el resumen.
   */
  const compartir = useCallback(async (): Promise<ResultadoCompartir> => {
    const texto = resumenTexto(resultados, fecha);
    if (typeof navigator.share !== "function") {
      return (await copiarTexto(texto)) ? "copiado" : "error";
    }
    const listo = obtenerArchivo().listo;
    const conArchivo = listo !== null && navigator.canShare?.({ files: [listo] }) === true;
    try {
      await navigator.share(
        conArchivo ? { files: [listo], title: listo.name, text: texto } : { title: "Black Shark", text: texto }
      );
      return conArchivo ? "archivo" : "texto";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelado";
      return (await copiarTexto(texto)) ? "copiado" : "error";
    }
  }, [resultados, fecha, obtenerArchivo]);

  const reiniciar = useCallback(() => {
    control.current?.abort();
    setError(null);
    prepararBloques([], null);
  }, []);

  return {
    fase,
    matriz,
    bloques,
    resultados,
    progreso,
    error,
    detenida,
    fallidos,
    fecha,
    cargarArchivo,
    cargarTexto,
    consultar,
    cancelar,
    reintentarFallidos,
    descargar,
    compartir,
    reiniciar,
  };
}
