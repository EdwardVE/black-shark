// app/page.tsx
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import PanelProgreso from "./components/PanelProgreso";
import ResumenStatus from "./components/ResumenStatus";
import TablaResultados from "./components/TablaResultados";
import TarjetaProceso from "./components/TarjetaProceso";
import ThemeToggle from "./components/ThemeToggle";
import ZonaExcel from "./components/ZonaExcel";
import { useConsultaLote, type ResultadoCompartir } from "./hooks/useConsultaLote";
import { ESTADOS_POR_FILTRO, type Filtro } from "./lib/estados";
import { normalizar, ordenarResultados } from "./lib/excel/comparar";

/** Segundos aproximados por radicado (ritmo de 2 s + a veces una segunda petición). */
const SEGUNDOS_POR_RADICADO = 3;

const sinSuscripcion = () => () => {};
const soportaCompartir = () => typeof navigator.share === "function";

const MENSAJE_COMPARTIR: Record<ResultadoCompartir, string | null> = {
  archivo: null,
  texto:
    "Se compartió el resumen. Tu navegador no permite adjuntar archivos Excel: usa «Descargar Excel» y envíalo desde Descargas.",
  copiado: "Resumen copiado. Pégalo en WhatsApp o en un correo.",
  cancelado: null,
  error: "No se pudo compartir ni copiar el resumen en este navegador.",
};

const PASOS = [
  ["Sube tu matriz", "El Excel completo, con todas sus hojas. Cada bloque de filas de un radicado es un proceso."],
  ["Revisa el status", "La app compara la última actuación de cada proceso con la Rama Judicial."],
  ["Actualiza y comparte", "Copia las actuaciones nuevas a tu matriz, descarga el Excel con la hoja Status o comparte el resumen."],
] as const;

export default function QueryPage() {
  const lote = useConsultaLote();
  const [filtro, setFiltro] = useState<Filtro>("cambios");
  const [busqueda, setBusqueda] = useState("");
  const [generando, setGenerando] = useState(false);
  const puedeCompartir = useSyncExternalStore(sinSuscripcion, soportaCompartir, () => false);

  const consultables = useMemo(() => lote.bloques.filter((b) => b.consultable), [lote.bloques]);
  const radicadosUnicos = useMemo(() => new Set(consultables.map((b) => b.radicado)).size, [consultables]);
  const ultimaRevision = useMemo(
    () =>
      [...(lote.matriz?.revisiones.values() ?? [])].reduce<string | null>(
        (max, r) => (!max || r.revisadoEl > max ? r.revisadoEl : max),
        null
      ),
    [lote.matriz]
  );

  const visibles = useMemo(() => {
    const estados = ESTADOS_POR_FILTRO[filtro];
    const q = normalizar(busqueda);
    return ordenarResultados(lote.resultados).filter(
      (r) =>
        (!estados || estados.includes(r.estado)) &&
        (!q ||
          normalizar(
            [r.bloque.radicadoCrudo, r.bloque.juzgado, r.bloque.demandante, r.bloque.demandado, r.bloque.hoja].join(" ")
          ).includes(q))
    );
  }, [lote.resultados, filtro, busqueda]);

  const [aviso, setAviso] = useState<string | null>(null);

  const descargar = async () => {
    setGenerando(true);
    setAviso(null);
    try {
      await lote.descargar();
    } catch {
      setAviso("No se pudo generar el Excel. Intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  // Sin await previo: el menú de compartir debe abrirse dentro del mismo toque.
  const compartir = async () => {
    setAviso(null);
    setAviso(MENSAJE_COMPARTIR[await lote.compartir()]);
  };

  const mostrarResultados = lote.fase === "consultando" || lote.fase === "terminada";

  return (
    <div className="w-full flex flex-col items-center">
      <header className="sticky top-0 z-10 w-full border-b border-border bg-surface/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-accent truncate">Black Shark</h1>
            <p className="text-xs sm:text-sm text-muted truncate">Status de procesos · Rama Judicial</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:py-6">
        {lote.error && (
          <p role="alert" className="rounded-xl bg-danger-bg p-4 text-sm text-danger">
            {lote.error}
          </p>
        )}

        {(lote.fase === "inicial" || lote.fase === "leyendo") && (
          <ZonaExcel
            ocupado={lote.fase === "leyendo"}
            onArchivo={lote.cargarArchivo}
            onTexto={lote.cargarTexto}
          />
        )}

        {lote.fase === "inicial" && (
          <section aria-labelledby="como-funciona" className="w-full">
            <h2 id="como-funciona" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Cómo funciona
            </h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {PASOS.map(([titulo, texto], i) => (
                <li key={titulo} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-fg">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{titulo}</p>
                    <p className="text-sm text-muted">{texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {lote.fase === "lista" && (
          <section className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm">
            <p className="text-sm text-muted break-all">{lote.matriz?.nombreArchivo ?? "Lista pegada"}</p>
            <h2 className="mt-1 text-xl font-bold">
              {radicadosUnicos} radicado{radicadosUnicos === 1 ? "" : "s"} para consultar
            </h2>
            <ul className="mt-2 grid gap-1 text-sm text-muted">
              {lote.matriz && <li>{lote.matriz.hojas.length} hojas · {lote.bloques.length} procesos en la matriz</li>}
              {lote.matriz && (
                <li>
                  {ultimaRevision
                    ? `Se compara con la última revisión (${ultimaRevision}): solo verás lo que cambió desde entonces.`
                    : "Primera revisión de este archivo: se compara con la última actuación escrita en la matriz."}
                </li>
              )}
              {lote.bloques.length - consultables.length > 0 && (
                <li>
                  {lote.bloques.length - consultables.length} no se consultan (no son radicados de 23 dígitos de la
                  Rama Judicial: Superintendencia, Fiscalía…)
                </li>
              )}
              {lote.matriz?.hojasOmitidas.map((h) => (
                <li key={h.nombre}>
                  Hoja «{h.nombre}» omitida: {h.motivo}
                </li>
              ))}
              <li>Tiempo estimado: ~{Math.max(1, Math.round((radicadosUnicos * SEGUNDOS_POR_RADICADO) / 60))} min</li>
            </ul>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => lote.consultar()}
                disabled={radicadosUnicos === 0}
                className="min-h-12 rounded-xl bg-accent px-6 font-bold text-accent-fg shadow hover:bg-accent-hover disabled:opacity-50"
              >
                Revisar status ahora
              </button>
              <button
                type="button"
                onClick={lote.reiniciar}
                className="min-h-12 rounded-xl border border-border px-6 font-semibold hover:bg-surface-2"
              >
                Cambiar archivo
              </button>
            </div>
          </section>
        )}

        {lote.fase === "consultando" && lote.progreso && (
          <PanelProgreso progreso={lote.progreso} onCancelar={lote.cancelar} />
        )}

        {lote.fase === "terminada" && lote.detenida && (
          <p role="alert" className="rounded-xl bg-warn-bg p-4 text-sm text-warn">
            La consulta se detuvo antes de terminar. Los radicados pendientes conservan su status anterior y
            quedan como «No verificado».
          </p>
        )}

        {mostrarResultados && (
          <>
            <ResumenStatus resultados={lote.resultados} fecha={lote.fecha} filtro={filtro} onFiltro={setFiltro} />

            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por radicado, juzgado o partes…"
              aria-label="Buscar"
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />

            {visibles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                {lote.fase === "consultando" ? "Los resultados aparecerán aquí…" : "No hay resultados en este filtro."}
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:hidden">
                  {visibles.map((r) => (
                    <TarjetaProceso key={`${r.bloque.hoja}-${r.bloque.filaInicio}`} resultado={r} />
                  ))}
                </div>
                <div className="hidden md:block">
                  <TablaResultados resultados={visibles} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {lote.fase === "terminada" && (
        // sticky (no fixed): en el celular queda abajo sin tapar el pie de página al final.
        <div className="sticky bottom-0 z-10 w-full border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
          {aviso && (
            <p role="status" className="mx-auto max-w-6xl px-4 pt-3 text-sm text-muted">
              {aviso}
            </p>
          )}
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-3">
            <button
              type="button"
              disabled={generando}
              onClick={descargar}
              className="min-h-12 flex-1 sm:flex-none rounded-xl bg-accent px-6 font-bold text-accent-fg shadow hover:bg-accent-hover disabled:opacity-50"
            >
              {generando ? "Generando…" : "Descargar Excel"}
            </button>
            <button
              type="button"
              onClick={compartir}
              className="min-h-12 flex-1 sm:flex-none rounded-xl border border-border px-6 font-semibold hover:bg-surface-2"
            >
              {puedeCompartir ? "Compartir" : "Copiar resumen"}
            </button>
            {lote.fallidos > 0 && (
              <button
                type="button"
                onClick={lote.reintentarFallidos}
                className="min-h-12 flex-1 sm:flex-none rounded-xl border border-border px-6 font-semibold hover:bg-surface-2"
              >
                Reintentar {lote.fallidos} no verificado{lote.fallidos === 1 ? "" : "s"}
              </button>
            )}
            <button
              type="button"
              onClick={lote.reiniciar}
              className="min-h-12 flex-1 sm:flex-none rounded-xl border border-border px-6 font-semibold hover:bg-surface-2"
            >
              Nueva revisión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
