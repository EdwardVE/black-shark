// hooks/useJudicialQuery.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { queryJudicialProcess } from "../lib/api/judicial";

interface Message {
  text: string;
  isError: boolean;
}

const initialProcessNumber = "76001310500420190033500";

export function useJudicialQuery() {
  const [processNumber, setProcessNumber] =
    useState<string>(initialProcessNumber);
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Función para mostrar mensajes (con timeout)
  const showMessage = useCallback((text: string, isError: boolean) => {
    setMessage({ text, isError });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!processNumber || processNumber.trim() === "") {
        showMessage("Por favor, ingresa un número de radicación válido.", true);
        return;
      }

      setResult("");
      setMessage(null);
      setIsLoading(true);

      try {
        const data = await queryJudicialProcess(processNumber);
        setResult(JSON.stringify(data, null, 2));
        showMessage(
          `¡Consulta exitosa! Proceso ${processNumber} cargado.`,
          false
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Ocurrió un error desconocido al obtener los datos del proceso.";
        setResult(
          `Error al consultar el proceso ${processNumber}:\n${errorMessage}`
        );
        showMessage(errorMessage, true);
      } finally {
        setIsLoading(false);
      }
    },
    [processNumber, showMessage]
  );

  const messageClasses = useMemo(() => {
    if (!message) return "";
    return message.isError
      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
  }, [message]);

  return {
    processNumber,
    setProcessNumber,
    result,
    isLoading,
    message,
    messageClasses,
    handleSubmit,
  };
}
