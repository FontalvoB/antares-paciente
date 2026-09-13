import { toLocalISODate } from '../../utils/dates';

export function weightFormError(weight: string, date: string, today = toLocalISODate()): string | null {
  const normalized = weight.trim().replace(',', '.');
  // Rangos de entrada de CompleteTask/CreatePatient; no son metas clínicas.
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) < 1 || Number(normalized) > 500)
    return 'Introduce un peso entre 1 y 500 kg, con un máximo de dos decimales.';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date || date === '0001-01-01' || date > today)
    return 'Selecciona una fecha válida que no sea futura.';
  return null;
}
