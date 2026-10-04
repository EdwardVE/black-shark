// components/TarjetaProceso.tsx
import { legible } from "../lib/estados";
import { textoActuacion } from "../lib/excel/comparar";
import type { ResultadoBloque } from "../lib/tipos";
import BotonCopiar from "./BotonCopiar";
import InsigniaEstado from "./InsigniaEstado";

/** Resultado de un radicado: status anterior → actual y las actuaciones nuevas. */
export default function TarjetaProceso({ resultado: r }: { resultado: ResultadoBloque }) {
  const cambio = r.estado === "cambio" || r.estado === "nuevo";
  const partes = [r.bloque.demandante, r.bloque.demandado].filter(Boolean).join(" vs. ");

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold break-all">{r.bloque.radicadoCrudo}</p>
          <p className="text-xs text-muted truncate">
            {r.bloque.hoja} · {r.bloque.juzgado || r.despacho || "—"}
          </p>
          {partes && <p className="text-xs text-muted line-clamp-2">{partes}</p>}
        </div>
        <InsigniaEstado estado={r.estado} />
      </header>

      <dl className="mt-3 grid gap-2 text-sm">
        {cambio && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Status anterior</dt>
            <dd className="line-through decoration-muted/60 text-muted">{legible(r.statusAnterior) || "—"}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
            {cambio ? "Status actual" : "Status"}
          </dt>
          <dd className={cambio ? "font-semibold" : ""}>{legible(r.statusActual) || "—"}</dd>
        </div>
        {r.detalle && <p className="text-xs text-muted">{r.detalle}</p>}
      </dl>

      {r.nuevas.length > 0 && (
        <details className="mt-3 rounded-xl bg-surface-2 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {r.nuevas.length} actuación(es) nueva(s)
          </summary>
          <ol className="mt-2 grid gap-1 text-sm">
            {r.nuevas.map((a) => (
              <li key={`${a.consecutivo}-${a.fecha}`}>
                <span className="font-mono text-xs text-muted">{a.fecha}</span> {a.actuacion}
                {a.anotacion && <span className="text-muted"> — {a.anotacion}</span>}
              </li>
            ))}
          </ol>
          <div className="mt-2">
            <BotonCopiar
              texto={r.nuevas.map(textoActuacion).join("\n")}
              etiqueta="Copiar para la matriz"
            />
          </div>
        </details>
      )}
    </article>
  );
}
