// components/ResumenStatus.tsx
import { ESTADOS_POR_FILTRO, type Filtro } from "../lib/estados";
import type { ResultadoBloque } from "../lib/tipos";

const ETIQUETA_FILTRO: Record<Filtro, string> = {
  cambios: "Cambios",
  problemas: "Por revisar",
  sin_cambios: "Sin cambios",
  no_aplica: "No aplica",
  todos: "Todos",
};

export function contarPorFiltro(resultados: ResultadoBloque[], filtro: Filtro) {
  const estados = ESTADOS_POR_FILTRO[filtro];
  return estados ? resultados.filter((r) => estados.includes(r.estado)).length : resultados.length;
}

/** Titular con lo importante (cuántos cambiaron) y filtros por estado. */
export default function ResumenStatus({
  resultados,
  fecha,
  filtro,
  onFiltro,
}: {
  resultados: ResultadoBloque[];
  fecha: string;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
}) {
  const cambios = resultados.filter((r) => r.estado === "cambio").length;
  const sinHistorial = resultados.filter((r) => r.estado === "nuevo").length;
  const problemas = contarPorFiltro(resultados, "problemas");

  return (
    <section className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm">
      <p className="text-sm text-muted">Revisión del {fecha}</p>
      <h2 className="mt-1 text-2xl sm:text-3xl font-bold">
        {cambios === 0
          ? "Ningún proceso cambió de status"
          : `${cambios} proceso${cambios === 1 ? "" : "s"} cambi${cambios === 1 ? "ó" : "aron"} de status`}
      </h2>
      {(sinHistorial > 0 || problemas > 0) && (
        <p className="mt-1 text-sm text-muted">
          {[
            sinHistorial > 0 && `${sinHistorial} sin historial en la matriz`,
            problemas > 0 && `${problemas} por revisar (no verificados, no encontrados o reservados)`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filtrar resultados">
        {(Object.keys(ETIQUETA_FILTRO) as Filtro[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filtro === f}
            onClick={() => onFiltro(f)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              filtro === f
                ? "border-accent bg-accent text-accent-fg"
                : "border-border hover:bg-surface-2"
            }`}
          >
            {ETIQUETA_FILTRO[f]} ({contarPorFiltro(resultados, f)})
          </button>
        ))}
      </div>
    </section>
  );
}
