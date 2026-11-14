import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../../i18n/I18nContext';
import { NutritionRecommendations } from '../NutritionRecommendations';
import { nutritionRecommendationFixture as fixture } from './fixtures/nutrition-recommendation';

vi.mock('@ionic/react', () => {
  const Wrap = ({ children, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) => <div {...props}>{children}</div>;
  return { IonCard: Wrap, IonCardHeader: Wrap, IonCardTitle: Wrap, IonCardContent: Wrap, IonIcon: () => null,
    IonImg: ({ src, alt, onIonError }: { src: string; alt: string; onIonError: () => void }) => <img src={src} alt={alt} onError={onIonError} /> };
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('3.18-prep · recomendaciones públicas del nutricionista', () => {
  it('muestra texto clínico, profesional, ciclo y fechas sin alterar la URL firmada', () => {
    render(<I18nProvider><NutritionRecommendations recommendation={fixture} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeTruthy();
    expect(screen.getByText(fixture.professionalName)).toBeTruthy();
    expect(screen.getByText(/Ana, mantén una fuente de proteína/).textContent).toBe(fixture.patientMessage);
    expect(screen.getByText('Revisión de tu ciclo 2')).toBeTruthy();
    expect(screen.getByText('Del 07/11/2026 al 06/12/2026')).toBeTruthy();
    expect(screen.getByText('Publicado el 07/12/2026')).toBeTruthy();
    expect(screen.getByAltText(fixture.attachments[0].caption).getAttribute('src')).toBe(fixture.attachments[0].url);
  });

  it.each([undefined, null])('sin recomendaciones no inventa un bloque o mensaje, valor=%s', recommendation => {
    const { container } = render(<I18nProvider><NutritionRecommendations recommendation={recommendation} /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('ante indisponibilidad de IA/datos omite el bloque incluso con datos anteriores', () => {
    const { container } = render(<I18nProvider><NutritionRecommendations recommendation={fixture} unavailable /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('ignora campos internos inesperados y no interpreta HTML del mensaje', () => {
    const recommendation = { ...fixture,
      professional_notes: 'NOTA_INTERNA_PROHIBIDA', ai_draft_json: 'BORRADOR_PROHIBIDO', summary_json: 'RESUMEN_PROHIBIDO',
      patientMessage: '<img src=x onerror=alert(1)> Mensaje de texto',
    };
    const { container } = render(<I18nProvider><NutritionRecommendations recommendation={recommendation} /></I18nProvider>);
    expect(container.textContent).not.toMatch(/NOTA_INTERNA|BORRADOR_PROHIBIDO|RESUMEN_PROHIBIDO|professional_notes|ai_draft_json|summary_json/);
    expect(screen.getByText(recommendation.patientMessage)).toBeTruthy();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('una imagen caducada conserva el texto y el pie con un estado recuperable', () => {
    render(<I18nProvider><NutritionRecommendations recommendation={fixture} /></I18nProvider>);
    fireEvent.error(screen.getByAltText(fixture.attachments[0].caption));
    expect(screen.getByRole('status').textContent).toContain('Imagen no disponible');
    expect(screen.getByText(fixture.attachments[0].caption)).toBeTruthy();
    expect(screen.getByText(/Ana, mantén/)).toBeTruthy();
  });

  it('sin adjuntos no dibuja una galería vacía y traduce solo la interfaz', () => {
    localStorage.setItem('antares_lang', 'en');
    render(<I18nProvider><NutritionRecommendations recommendation={{ ...fixture, attachments: [] }} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Recommendations from your nutritionist' })).toBeTruthy();
    expect(screen.getByText('Published on 07/12/2026')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Adjuntos')).toBeNull();
    expect(screen.getByText(/Ana, mantén/).textContent).toBe(fixture.patientMessage);
  });
});
