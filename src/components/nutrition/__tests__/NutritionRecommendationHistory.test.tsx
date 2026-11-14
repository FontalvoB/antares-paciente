import type { HTMLAttributes } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/I18nContext';
import { NutritionRecommendationHistory } from '../NutritionRecommendationHistory';
import { nutritionRecommendationHistoryFixture as history } from './fixtures/nutrition-recommendation';

vi.mock('@ionic/react', () => {
  const Wrap = ({ children, ...props }: HTMLAttributes<HTMLElement>) => <div {...props}>{children}</div>;
  return { IonAccordionGroup: Wrap, IonAccordion: Wrap, IonItem: Wrap, IonLabel: Wrap, IonButton: Wrap,
    IonCard: Wrap, IonCardHeader: Wrap, IonCardTitle: Wrap, IonCardContent: Wrap,
    IonIcon: () => null, IonImg: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> };
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('3.19-prep · historial con el mismo DTO público por ciclo', () => {
  it('lista los ciclos proporcionados y reutiliza sus recomendaciones completas sin alterar datos o URLs', () => {
    const input = Object.freeze([...history]);
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={input} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Ciclos anteriores' })).toBeTruthy();
    expect(screen.getAllByText(/^Ciclo \d$/).map(item => item.textContent)).toEqual(['Ciclo 2', 'Ciclo 1']);
    expect(screen.getAllByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toHaveLength(2);
    expect(screen.getByText('Cierre del ciclo 2 · publicado el 07/12/2026')).toBeTruthy();
    expect(screen.getByText('Cierre del ciclo 1 · publicado el 07/11/2026')).toBeTruthy();
    for (const cycle of history) {
      expect(container.textContent).toContain(cycle.patientMessage);
      expect(screen.getAllByText(cycle.professionalName).length).toBeGreaterThan(0);
      expect(screen.getByAltText(cycle.attachments[0].caption).getAttribute('src')).toBe(cycle.attachments[0].url);
    }
    expect(input).toEqual(history);
  });

  it('un historial vacío ofrece una explicación amable sin recomendaciones ficticias', () => {
    render(<I18nProvider><NutritionRecommendationHistory history={[]} /></I18nProvider>);
    expect(screen.getByText('Cuando tu nutricionista publique recomendaciones de ciclos anteriores, las encontrarás aquí.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeNull();
  });

  it.each([undefined, null])('sin fuente conectada no fabrica una respuesta vacía, valor=%s', value => {
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={value} /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('ante IA/datos caídos omite el historial, incluso si recibió una lista anterior', () => {
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={history} unavailable /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('el historial tampoco expone notas internas, borradores o resumen inesperados', () => {
    const value = { ...history[0], professional_notes: 'NOTA_PRIVADA', ai_draft_json: 'BORRADOR_PRIVADO', summary_json: 'RESUMEN_PRIVADO' };
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={[value]} /></I18nProvider>);
    expect(container.textContent).not.toMatch(/NOTA_PRIVADA|BORRADOR_PRIVADO|RESUMEN_PRIVADO|professional_notes|ai_draft_json|summary_json/);
    expect(container.textContent).toContain(value.patientMessage);
  });

  it('traduce el estado vacío sin cambiar el contrato de los ciclos', () => {
    localStorage.setItem('antares_lang', 'en');
    render(<I18nProvider><NutritionRecommendationHistory history={[]} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Previous cycles' })).toBeTruthy();
    expect(screen.getByText('When your nutritionist publishes recommendations for previous cycles, you will find them here.')).toBeTruthy();
  });
});
