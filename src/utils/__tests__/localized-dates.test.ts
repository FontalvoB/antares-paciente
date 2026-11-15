import { describe, expect, it } from 'vitest';
import { formatLocalizedDate, formatLocalizedDateRange } from '../dates';

describe('R7-13 · fechas de recomendaciones localizadas sin cambiar el día ISO', () => {
  it.each([['es-ES', '19 nov 2026'], ['en-US', 'Nov 19, 2026']])('fecha legible en %s', (locale, expected) => {
    expect(formatLocalizedDate('2026-11-19', locale)).toBe(expected);
    expect(formatLocalizedDate('2026-11-19T23:30:00-05:00', locale)).toBe(expected);
  });
  it.each([['es-ES', '21 sept – 20 oct 2026'], ['en-US', 'Sep 21 – Oct 20, 2026']])('rango con meses y año en %s', (locale, expected) => {
    expect(formatLocalizedDateRange('2026-09-21', '2026-10-20', locale).replace(/\s+/g, ' ')).toBe(expected);
  });
  it('un rango que cambia de año conserva ambos años', () => {
    expect(formatLocalizedDateRange('2026-12-21', '2027-01-20', 'en-US')).toMatch(/Dec 21, 2026.*Jan 20, 2027/);
  });
  it('un dato inválido no rompe la pantalla ni se convierte en otra fecha', () => {
    expect(formatLocalizedDate('2026-02-30', 'es-ES')).toBe('2026-02-30');
    expect(formatLocalizedDateRange('sin fecha', '2026-11-19', 'es-ES')).toBe('sin fecha – 19 nov 2026');
  });
});
