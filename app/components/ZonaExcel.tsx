// components/ZonaExcel.tsx
"use client";

import { useRef, useState } from "react";

interface Props {
  ocupado: boolean;
  onArchivo: (archivo: File) => void;
  onTexto: (texto: string) => void;
}

type Pestana = "excel" | "texto";

/** Entrada de datos: subir la matriz en Excel (principal) o pegar radicados. */
export default function ZonaExcel({ ocupado, onArchivo, onTexto }: Props) {
  const [pestana, setPestana] = useState<Pestana>("excel");
  const [arrastrando, setArrastrando] = useState(false);
  const [texto, setTexto] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const elegir = (archivos: FileList | null) => {
    const archivo = archivos?.[0];
    if (archivo) onArchivo(archivo);
  };

  const claseTab = (p: Pestana) =>
    `flex-1 min-h-11 rounded-lg text-sm font-semibold transition ${
      pestana === p ? "bg-surface shadow text-fg" : "text-muted hover:text-fg"
    }`;

  return (
    <section className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-sm">
      <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1 mb-4">
        <button role="tab" aria-selected={pestana === "excel"} className={claseTab("excel")} onClick={() => setPestana("excel")}>
          Subir Excel
        </button>
        <button role="tab" aria-selected={pestana === "texto"} className={claseTab("texto")} onClick={() => setPestana("texto")}>
          Pegar radicados
        </button>
      </div>

      {pestana === "excel" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            elegir(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 sm:p-10 text-center transition ${
            arrastrando ? "border-accent bg-surface-2" : "border-border"
          }`}
        >
          <svg className="size-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-muted max-w-md">
            Sube tu matriz de procesos (.xlsx). La app compara la última actuación de cada radicado
            con la Rama Judicial y te dice cuáles cambiaron de status.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => input.current?.click()}
            className="min-h-12 w-full sm:w-auto rounded-xl bg-accent px-6 font-bold text-accent-fg shadow hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            {ocupado ? "Leyendo…" : "Elegir archivo"}
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              elegir(e.target.files);
              e.target.value = ""; // permite volver a subir el mismo archivo
            }}
          />
          <p className="hidden sm:block text-xs text-muted">o arrástralo aquí</p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onTexto(texto);
          }}
        >
          <label htmlFor="radicados" className="text-sm font-medium">
            Números de radicación (23 dígitos), uno por línea o separados por espacio
          </label>
          <textarea
            id="radicados"
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="76001310500020240000100"
            className="rounded-xl border border-border bg-surface-2 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
          <button
            type="submit"
            disabled={ocupado || !texto.trim()}
            className="min-h-12 rounded-xl bg-accent px-6 font-bold text-accent-fg shadow hover:bg-accent-hover disabled:opacity-50"
          >
            Preparar consulta
          </button>
        </form>
      )}
    </section>
  );
}
