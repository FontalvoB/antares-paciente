import { useEffect, useState } from "react";

/**
 * Segundos transcurridos desde `since` (0 si no hay marca). Se actualiza cada
 * segundo y se reinicia cuando cambia la marca: es el tic-tac compartido por el
 * cronómetro de medidas de Reloj y Programa.
 */
export function useElapsed(since?: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!since) {
      setElapsed(0);
      return;
    }
    const read = () => Math.max(0, Math.round((Date.now() - since) / 1000));
    setElapsed(read());
    const timer = window.setInterval(() => setElapsed(read()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);

  return elapsed;
}
