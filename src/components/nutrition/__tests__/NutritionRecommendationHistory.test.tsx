import type { HTMLAttributes } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/I18nContext';
import { NutritionRecommendationHistory } from '../NutritionRecommendationHistory';
import { nutritionRecommendationHistoryFixture as history } from './fixtures/nutrition-recommendation';

vi.mock('@ionic/react', () => {
  const Wrap = ({ children, ...props }: HTMLAttributes<HTMLElement>) => <div {...props}>{children}</div>;
  return { IonAccordionGroup: ({ children, value }: HTMLAttributes<HTMLElement> & { value?: string }) => <div data-testid="cycle-group" data-value={value ?? ''}>{children}</div>, IonAccordion: Wrap, IonItem: Wrap, IonLabel: Wrap, IonButton: Wrap, IonBadge: Wrap,
    IonCard: Wrap, IonCardHeader: Wrap, IonCardTitle: Wrap, IonCardContent: Wrap,
    IonIcon: () => null, IonImg: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> };
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('3.19 · historial público alineado con D0014 y los artboards', () => {
  it.each([
    'Tu sesión ha caducado. Inicia sesión de nuevo para ver tus recomendaciones.',
    'No tienes acceso a estas recomendaciones.',
  ])('R7-12: sin acción de acceso no deja un botón inerte en el historial: %s', message => {
    render(<I18nProvider><NutritionRecommendationHistory unavailable errorMessage={message}/></I18nProvider>);
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it.each([
    ['es', 'Aquí quedan las recomendaciones de ciclos que ya cerraron. La recomendación más reciente está en Plan.'],
    ['en', 'Recommendations from completed cycles are saved here. The most recent recommendation is in Plan.'],
  ])('remite a la publicación más reciente sin confundirla con el ciclo vigente en %s', (lang, copy) => {
    localStorage.setItem('antares_lang', lang);
    render(<I18nProvider><NutritionRecommendationHistory history={history}/></I18nProvider>);
    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.queryByText(/La de tu ciclo actual|Your current cycle recommendation/)).toBeNull();
  });

  it('lista los ciclos proporcionados y reutiliza sus recomendaciones completas sin alterar datos o URLs', () => {
    const input = Object.freeze([...history]);
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={input} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Ciclos anteriores' })).toBeTruthy();
    expect(screen.getAllByText(/^Ciclo \d$/).map(item => item.textContent)).toEqual(['Ciclo 2', 'Ciclo 1']);
    expect(screen.getAllByRole('region', { name: /^Recomendaciones del ciclo/ })).toHaveLength(2);
    expect(screen.getByText('Publicado el 7 dic 2026')).toBeTruthy();
    expect(screen.getByText('Publicado el 7 nov 2026')).toBeTruthy();
    expect(screen.getAllByText('Anterior')).toHaveLength(2);
    for (const cycle of history) {
      expect(container.textContent).toContain(cycle.patientMessage);
      expect(screen.getAllByText(cycle.professionalName).length).toBeGreaterThan(0);
      expect(screen.getByAltText(cycle.attachments[0].caption).getAttribute('src')).toBe(cycle.attachments[0].url);
    }
    expect(input).toEqual(history);
  });

  it('un historial vacío ofrece una explicación amable sin recomendaciones ficticias', () => {
    render(<I18nProvider><NutritionRecommendationHistory history={[]} /></I18nProvider>);
    expect(screen.getByText('Todavía no hay ciclos anteriores')).toBeTruthy();
    expect(screen.getByText('Cuando termines tu primer ciclo y tu nutricionista lo cierre, su recomendación quedará guardada aquí.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeNull();
  });

  it.each([undefined, null])('sin fuente conectada no fabrica una respuesta vacía, valor=%s', value => {
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={value} /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('ante datos caídos permite reintentar sin mostrar como actual una lista anterior', () => {
    const retry = vi.fn();
    render(<I18nProvider><NutritionRecommendationHistory history={history} unavailable onRetry={retry}/></I18nProvider>);
    expect(screen.getByRole('alert').textContent).toContain('Puedes volver a Plan');
    expect(screen.queryByText('Ciclo 2')).toBeNull();
    fireEvent.click(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('el historial tampoco expone notas internas, borradores o resumen inesperados', () => {
    const value = { ...history[0], professional_notes: 'NOTA_PRIVADA', ai_draft_json: 'BORRADOR_PRIVADO', summary_json: 'RESUMEN_PRIVADO', programName: 'Programa anterior', reviewId: 'ID_INTERNO' };
    const { container } = render(<I18nProvider><NutritionRecommendationHistory history={[value]} /></I18nProvider>);
    expect(container.textContent).not.toMatch(/NOTA_PRIVADA|BORRADOR_PRIVADO|RESUMEN_PRIVADO|professional_notes|ai_draft_json|summary_json|Programa anterior|ID_INTERNO/);
    expect(container.textContent).toContain(value.patientMessage);
  });

  it('traduce el estado vacío sin cambiar el contrato de los ciclos', () => {
    localStorage.setItem('antares_lang', 'en');
    render(<I18nProvider><NutritionRecommendationHistory history={[]} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Previous cycles' })).toBeTruthy();
    expect(screen.getByText('There are no previous cycles yet')).toBeTruthy();
    expect(screen.getByText('When you finish your first cycle and your nutritionist closes it, their recommendation will be saved here.')).toBeTruthy();
  });

  it('abre el primer ciclo por defecto y permite ocultarlo', () => {
    render(<I18nProvider><NutritionRecommendationHistory history={history}/></I18nProvider>);
    expect(screen.getByTestId('cycle-group').getAttribute('data-value')).toBe('2:2026-11-07');
    fireEvent.click(screen.getAllByText('Ocultar')[0]);
    expect(screen.getByTestId('cycle-group').getAttribute('data-value')).toBe('');
  });

  it('declara sin imágenes en una tarjeta anterior contraída sin inventar adjuntos', () => {
    render(<I18nProvider><NutritionRecommendationHistory history={[history[0], { ...history[1], attachments: [] }]}/></I18nProvider>);
    expect(screen.getByText(/Sin imágenes/)).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });
});
