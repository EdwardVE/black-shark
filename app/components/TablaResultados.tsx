// components/TablaResultados.tsx
import { legible } from "../lib/estados";
import { textoActuacion } from "../lib/excel/comparar";
import type { ResultadoBloque } from "../lib/tipos";
import BotonCopiar from "./BotonCopiar";
import InsigniaEstado from "./InsigniaEstado";

/** Vista de escritorio: una fila por bloque de radicado. */
export default function TablaResultados({ resultados }: { resultados: ResultadoBloque[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3">Radicado / Juzgado</th>
            <th className="px-3 py-3">Status anterior</th>
            <th className="px-3 py-3">Status actual</th>
            <th className="px-3 py-3">Nuevas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {resultados.map((r) => (
            <tr key={`${r.bloque.hoja}-${r.bloque.filaInicio}`} className="align-top hover:bg-surface-2/60">
              <td className="px-3 py-3">
                <InsigniaEstado estado={r.estado} />
              </td>
              <td className="px-3 py-3 min-w-56">
                <p className="font-mono font-semibold">{r.bloque.radicadoCrudo}</p>
                <p className="text-xs text-muted">
                  {r.bloque.hoja} · {r.bloque.juzgado || r.despacho || "—"}
                </p>
                <p className="text-xs text-muted">
                  {[r.bloque.demandante, r.bloque.demandado].filter(Boolean).join(" vs. ")}
                </p>
              </td>
              <td className="px-3 py-3 min-w-64 text-muted">{legible(r.statusAnterior) || "—"}</td>
              <td className="px-3 py-3 min-w-64">
                <p className={r.estado === "cambio" ? "font-semibold" : ""}>
                  {legible(r.statusActual) || "—"}
                </p>
                {r.detalle && <p className="mt-1 text-xs text-muted">{r.detalle}</p>}
              </td>
              <td className="px-3 py-3">
                {r.nuevas.length > 0 ? (
                  <BotonCopiar
                    texto={r.nuevas.map(textoActuacion).join("\n")}
                    etiqueta={`Copiar ${r.nuevas.length}`}
                  />
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
