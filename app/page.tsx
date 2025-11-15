// src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

// --- 0. Definiciones de Tipos ---

// Tipo simplificado para los datos de un proceso que queremos mostrar
interface ProcessSummary {
  llaveProceso: string;
  fechaRadicacion: string;
  fechaUltimaActuacion: string;
  despachoCompleto: string;
  sujetosProcesales: string;
}

// Estructura simplificada para manejar los resultados de múltiples consultas
interface QueryResult {
  processNumber: string;
  data: ProcessSummary[] | null;
  error: string | null;
}

// --- 1. LÓGICA DEL BACKEND REAL (API RAMA JUDICIAL) ---

/**
 * Función para consultar UN proceso en la API de la Rama Judicial.
 * NOTA: Esta función se mantiene para el manejo individual de la promesa.
 */
async function querySingleJudicialProcess(processNumber: string): Promise<any> {
  const url = `https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta/NumeroRadicacion?numero=${processNumber}&SoloActivos=false&pagina=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error HTTP ${response.status}: ${errorText || response.statusText}`
    );
  }

  const data = await response.json();

  if (data && data.cantidadRegistros === 0) {
    throw new Error(`No encontrado.`);
  }

  return data;
}

/**
 * Función principal para consultar múltiples procesos.
 * @param processNumbers Array de números de radicación a consultar.
 * @returns Promesa con un array de QueryResult para cada consulta.
 */
async function queryMultipleJudicialProcesses(
  processNumbers: string[]
): Promise<QueryResult[]> {
  const promises = processNumbers.map((number) =>
    querySingleJudicialProcess(number)
      .then((data) => {
        // Mapear los datos JSON crudos a ProcessSummary
        const summaries: ProcessSummary[] = data.procesos.map((p: any) => ({
          llaveProceso: p.llaveProceso,
          // La API usa fechaProceso para la radicación y fechaUltimaActuacion
          fechaRadicacion: p.fechaProceso
            ? p.fechaProceso.split("T")[0]
            : "N/A",
          fechaUltimaActuacion: p.fechaUltimaActuacion
            ? p.fechaUltimaActuacion.split("T")[0]
            : "N/A",
          despachoCompleto: `${p.despacho} (${p.departamento})`,
          // Reemplazamos el separador "|" por un salto de línea para la visualización en tabla
          sujetosProcesales: p.sujetosProcesales
            ? p.sujetosProcesales.replace(/ \| /g, "\n")
            : "N/A",
        }));

        return {
          processNumber: number,
          data: summaries,
          error: null,
        } as QueryResult;
      })
      .catch((e) => {
        return {
          processNumber: number,
          data: null,
          error: e.message,
        } as QueryResult;
      })
  );

  return Promise.all(promises);
}

// --- 2. COMPONENTES SECUNDARIOS ---

const ThemeToggle: React.FC<{ isDark: boolean; toggleTheme: () => void }> = ({
  isDark,
  toggleTheme,
}) => (
  <button
    id="theme-toggle"
    onClick={toggleTheme}
    className="p-3 rounded-full bg-input-bg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-color transition duration-300 border border-border-color"
    aria-label="Alternar modo oscuro y claro"
  >
    {/* Icono del Sol (Modo Claro/Oculto) */}
    <svg
      id="sun-icon"
      className={`w-6 h-6 text-yellow-500 ${isDark ? "block" : "hidden"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      ></path>
    </svg>
    {/* Icono de la Luna (Modo Oscuro/Oculto) */}
    <svg
      id="moon-icon"
      className={`w-6 h-6 text-gray-500 ${isDark ? "hidden" : "block"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      ></path>
    </svg>
  </button>
);

/**
 * Nuevo componente para mostrar los resultados en formato de tabla.
 */
const ResultsTable: React.FC<{ results: QueryResult[] }> = ({ results }) => {
  // Aplanar los resultados: unir todos los procesos de todas las consultas exitosas
  const allProcesses: ProcessSummary[] = useMemo(() => {
    return results.flatMap((queryResult) => queryResult.data || []);
  }, [results]);

  // Obtener los errores para mostrar un resumen
  const errors = useMemo(() => {
    return results.filter((r) => r.error !== null);
  }, [results]);

  if (allProcesses.length === 0 && errors.length === 0) {
    return null;
  }

  return (
    <div
      id="result-table-area"
      className="w-full mt-8 p-0 rounded-xl shadow-xl overflow-hidden border border-border-color"
    >
      <h3 className="text-xl font-semibold mb-0 p-4 bg-bg-primary border-b border-border-color">
        Resultados de Consultas ({allProcesses.length} Proceso(s) Encontrado(s))
      </h3>

      {errors.length > 0 && (
        <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 p-4 border-b border-border-color">
          <p className="font-semibold">
            ⚠️ Errores en la consulta de {errors.length} radicado(s):
          </p>
          <ul className="list-disc list-inside text-sm mt-1">
            {errors.map((err, index) => (
              <li key={index} className="break-all">
                **{err.processNumber}**: {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allProcesses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-color bg-bg-primary">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-primary uppercase tracking-wider">
                  Número de Radicación
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-primary uppercase tracking-wider">
                  Fecha Radicación
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-primary uppercase tracking-wider">
                  Última Actuación
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-primary uppercase tracking-wider">
                  Despacho
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-primary uppercase tracking-wider">
                  Sujetos Procesales
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {allProcesses.map((p, index) => (
                <tr
                  key={index}
                  className="hover:bg-bg-secondary/50 transition duration-150"
                >
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-accent-color break-all">
                    {p.llaveProceso}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-text-primary">
                    {p.fechaRadicacion}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-text-primary">
                    {p.fechaUltimaActuacion}
                  </td>
                  <td className="px-3 py-4 text-sm text-text-primary">
                    {p.despachoCompleto}
                  </td>
                  <td className="px-3 py-4 text-sm text-text-primary whitespace-pre-wrap">
                    {/* Usamos el pre-wrap para que se vea el salto de línea */}
                    {p.sujetosProcesales}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- 3. LÓGICA DEL COMPONENTE REACT PRINCIPAL ---

export default function QueryPage() {
  // El input ahora manejará múltiples números separados por espacios o saltos de línea
  const initialProcessNumbers =
    "76001310502120240049700 76001310502220240030600 76001410500320240068600 76001410500320250009000 76001310500620250022200";

  const [processNumbersInput, setProcessNumbersInput] = useState<string>(
    initialProcessNumbers
  );

  // El resultado ahora es un array de objetos para manejar múltiples consultas
  const [results, setResults] = useState<QueryResult[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  // --- LÓGICA DE TEMA (SIN CAMBIOS) ---

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const initialDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    setIsDark(initialDark);
    document.documentElement.classList.toggle("dark", initialDark);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      document.documentElement.classList.toggle("dark", newIsDark);
      localStorage.setItem("theme", newIsDark ? "dark" : "light");
      return newIsDark;
    });
  }, []);

  // --- LÓGICA DE MENSAJES (SIN CAMBIOS) ---

  const showMessage = useCallback((text: string, isError: boolean) => {
    setMessage({ text, isError });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  }, []);

  const messageClasses = useMemo(() => {
    if (!message) return "";
    if (message.isError) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
    } else {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    }
  }, [message]);

  // --- LÓGICA DEL FORMULARIO (MODIFICADA) ---

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // 1. Limpiar y validar los números de radicación
      const numbersToQuery = processNumbersInput
        .split(/[\s,]+/) // Separar por espacios o comas
        .map((num) => num.trim())
        .filter((num) => num.length > 0); // Eliminar vacíos

      if (numbersToQuery.length === 0) {
        showMessage(
          "Por favor, ingresa al menos un número de radicación válido.",
          true
        );
        return;
      }

      // 2. Limpiar estados y preparar
      setResults([]);
      setMessage(null);
      setIsLoading(true);

      try {
        // 3. Llama a la nueva función de consulta múltiple
        const queryResults = await queryMultipleJudicialProcesses(
          numbersToQuery
        );

        // 4. Actualizar el estado con todos los resultados
        setResults(queryResults);

        const successfulQueries = queryResults.filter((r) => r.data).length;
        const totalQueries = numbersToQuery.length;

        showMessage(
          `¡Consulta finalizada! ${successfulQueries} de ${totalQueries} proceso(s) consultado(s) exitosamente.`,
          successfulQueries === totalQueries ? false : true // Muestra error si no todas fueron exitosas
        );
      } catch (error) {
        // Este catch debería ser solo para errores de red general, no de la API individual
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Ocurrió un error desconocido durante la ejecución de las consultas.";
        showMessage(errorMessage, true);
      } finally {
        setIsLoading(false);
      }
    },
    [processNumbersInput, showMessage]
  );

  return (
    <div
      className={`flex flex-col items-center min-h-screen font-sans ${
        isDark ? "bg-bg-secondary" : "bg-white"
      } text-text-primary`}
    >
      {/* Estilos Base para Tailwind (SIN CAMBIOS) */}
      <style jsx global>{`
        :root {
          --color-bg-primary: #ffffff;
          --color-bg-secondary: #f3f4f6;
          --color-input-bg: #f9fafb;
          --color-text-primary: #1f2937;
          --color-accent-color: #059669; /* Emerald 600 */
          --color-border-color: #e5e7eb;
        }

        .dark {
          --color-bg-primary: #1f2937;
          --color-bg-secondary: #111827;
          --color-input-bg: #374151;
          --color-text-primary: #f9fafb;
          --color-accent-color: #10b981; /* Emerald 500 */
          --color-border-color: #374151;
        }

        .bg-bg-primary {
          background-color: var(--color-bg-primary);
        }
        .bg-bg-secondary {
          background-color: var(--color-bg-secondary);
        }
        .bg-input-bg {
          background-color: var(--color-input-bg);
        }
        .text-text-primary {
          color: var(--color-text-primary);
        }
        .text-accent-color {
          color: var(--color-accent-color);
        }
        .border-border-color {
          border-color: var(--color-border-color);
        }
        .focus\\:ring-accent-color:focus {
          --tw-ring-color: var(--color-accent-color);
        }
        .focus\\:border-accent-color:focus {
          border-color: var(--color-accent-color);
        }
        .hover\\:bg-emerald-600:hover {
          background-color: #059669;
        }
      `}</style>

      {/* Encabezado y Toggle de Tema */}
      <header className="w-full max-w-4xl px-4 py-6 flex justify-between items-center bg-bg-primary shadow-md">
        <h1 className="text-3xl font-bold text-accent-color">
          Consulta Múltiple Procesos Judiciales
        </h1>
        <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
      </header>

      {/* Contenedor Principal de la Aplicación */}
      <main className="w-full max-w-4xl p-4 md:p-8 flex flex-col items-center flex-grow">
        {/* Tarjeta de Formulario de Consulta */}
        <div className="w-full bg-bg-primary p-6 md:p-8 rounded-xl shadow-2xl border border-border-color transition duration-500">
          <h2 className="text-2xl font-semibold mb-6">
            Buscar Procesos por Radicación
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="process-number" className="text-sm font-medium">
                Números de Radicación (separados por espacio o salto de línea)
              </label>
              <textarea // Usamos textarea para facilitar múltiples IDs
                id="process-number"
                name="process-number"
                rows={5}
                required
                value={processNumbersInput}
                onChange={(e) => setProcessNumbersInput(e.target.value)}
                className="p-3 border border-border-color rounded-lg bg-input-bg text-text-primary focus:ring-accent-color focus:border-accent-color transition duration-300 shadow-sm resize-y"
                placeholder="Ej: 76001310502120240049700 76001310502220240030600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Consulta en la API de la Rama Judicial.
              </p>
            </div>

            <button
              type="submit"
              id="submit-button"
              disabled={isLoading}
              className={`w-full py-3 mt-4 bg-accent-color text-white font-bold rounded-lg shadow-lg transition duration-300 transform focus:outline-none focus:ring-4 focus:ring-accent-color/50 ${
                isLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-emerald-600 hover:scale-[1.01]"
              }`}
            >
              {isLoading
                ? "Consultando..."
                : `Consultar ${
                    processNumbersInput
                      .split(/[\s,]+/)
                      .filter((n) => n.length > 0).length
                  } Proceso(s)`}
            </button>
          </form>

          {/* Indicador de Carga (Spinner) */}
          {isLoading && (
            <div id="loading-spinner" className="mt-6 text-center">
              <svg
                className="animate-spin h-8 w-8 text-accent-color mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">Consultando datos...</p>
            </div>
          )}
        </div>

        {/* Área de Resultados (Ahora es la Tabla) */}
        <ResultsTable results={results} />

        {/* El área de JSON crudo se elimina, se mantiene solo si es necesario para debug. */}
        {/* Si quieres el JSON crudo puedes crear otro estado y actualizarlo con JSON.stringify(results) */}

        {/* Área de Mensajes (Error/Info) */}
        {message && (
          <div
            id="message-box"
            className={`w-full mt-4 p-4 rounded-lg transition-opacity duration-300 ${messageClasses}`}
            role="alert"
          >
            <p id="message-text" className="font-medium">
              {message.text}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
