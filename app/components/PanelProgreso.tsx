// components/PanelProgreso.tsx
"use client";

import { useEffect, useState } from "react";
import type { Progreso } from "../hooks/useConsultaLote";

const formatoDuracion = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
};

export default function PanelProgreso({
  progreso,
  onCancelar,
}: {
  progreso: Progreso;
  onCancelar: () => void;
}) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { hechos, total, inicio, pausaHasta, aviso } = progreso;
  const porcentaje = total ? Math.round((hechos / total) * 100) : 0;
  const restante = hechos > 0 ? ((ahora - inicio) / hechos) * (total - hechos) : null;

  return (
    <section className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div aria-live="polite">
          <p className="font-semibold">
            Consultando {hechos} de {total} radicados
          </p>
          <p className="text-sm text-muted">
            {pausaHasta
              ? `Reanuda en ${formatoDuracion(pausaHasta - ahora)}`
              : restante !== null
                ? `~${formatoDuracion(restante)} restantes`
                : "Calculando tiempo…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface-2"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${porcentaje}%` }} />
      </div>

      {aviso && <p className="mt-3 rounded-lg bg-warn-bg p-3 text-sm text-warn">{aviso}</p>}
      <p className="mt-3 text-xs text-muted">
        Mantén esta pantalla abierta: si cambias de app, el teléfono puede pausar la consulta.
      </p>
    </section>
  );
}
