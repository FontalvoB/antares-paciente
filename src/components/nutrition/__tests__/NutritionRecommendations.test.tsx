import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../../i18n/I18nContext';
import { NutritionRecommendations } from '../NutritionRecommendations';
import { nutritionRecommendationFixture as fixture } from './fixtures/nutrition-recommendation';

vi.mock('@ionic/react', () => {
  const Wrap = ({ children, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) => <div {...props}>{children}</div>;
  return { IonCard: Wrap, IonCardHeader: Wrap, IonCardTitle: Wrap, IonCardContent: Wrap, IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-expanded': expanded, 'aria-controls': controls }: { children: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-expanded'?: boolean; 'aria-controls'?: string }) => <button onClick={onClick} disabled={disabled} aria-expanded={expanded} aria-controls={controls}>{children}</button>,
    IonImg: ({ src, alt, onIonError }: { src: string; alt: string; onIonError: () => void }) => <img src={src} alt={alt} onError={onIonError} /> };
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('3.18 · recomendaciones públicas del nutricionista', () => {
  it('muestra texto clínico, profesional, ciclo y fechas sin alterar la URL firmada', () => {
    render(<I18nProvider><NutritionRecommendations recommendation={fixture} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Recomendaciones de tu nutricionista' })).toBeTruthy();
    expect(screen.getByText(fixture.professionalName)).toBeTruthy();
    expect(screen.getByText(/Ana, mantén una fuente de proteína/).textContent).toBe(fixture.patientMessage);
    expect(screen.getByText('Cierre del ciclo 2 · publicado el 07/12/2026')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByAltText(fixture.attachments[0].caption).getAttribute('src')).toBe(fixture.attachments[0].url);
  });

  it('sin fuente conectada no inventa un bloque o mensaje', () => {
    const { container } = render(<I18nProvider><NutritionRecommendations /></I18nProvider>);
    expect(container.textContent).toBe('');
  });

  it('current null muestra el vacío amable de la referencia', () => {
    render(<I18nProvider><NutritionRecommendations recommendation={null} /></I18nProvider>);
    expect(screen.getByText('Aún no tienes recomendaciones')).toBeTruthy();
    expect(screen.getByText(/Tu nutricionista las publicará aquí/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('ante indisponibilidad explica que Plan sigue disponible y permite reintentar', () => {
    const retry = vi.fn();
    render(<I18nProvider><NutritionRecommendations recommendation={fixture} unavailable onRetry={retry} /></I18nProvider>);
    expect(screen.getByRole('alert').textContent).toContain('Tu plan y tus registros siguen disponibles.');
    expect(screen.queryByText(fixture.professionalName)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
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
    const refresh = vi.fn();
    const view = render(<I18nProvider><NutritionRecommendations recommendation={fixture} onRetry={refresh} /></I18nProvider>);
    fireEvent.error(screen.getByAltText(fixture.attachments[0].caption));
    expect(screen.getByRole('status').textContent).toContain('Imagen caducada');
    expect(screen.getByText(fixture.attachments[0].caption)).toBeTruthy();
    expect(screen.getByText(/Ana, mantén/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(refresh).toHaveBeenCalledOnce();
    const renewed = { ...fixture, attachments: [{ ...fixture.attachments[0], url: 'https://media.example.invalid/new-signed-url?signature=renewed' }] };
    view.rerender(<I18nProvider><NutritionRecommendations recommendation={renewed} onRetry={refresh} /></I18nProvider>);
    expect(screen.getByAltText(renewed.attachments[0].caption).getAttribute('src')).toBe(renewed.attachments[0].url);
    expect(screen.queryByText('Imagen caducada')).toBeNull();
  });

  it('sin adjuntos no dibuja una galería vacía y traduce solo la interfaz', () => {
    localStorage.setItem('antares_lang', 'en');
    render(<I18nProvider><NutritionRecommendations recommendation={{ ...fixture, attachments: [] }} /></I18nProvider>);
    expect(screen.getByRole('region', { name: 'Recommendations from your nutritionist' })).toBeTruthy();
    expect(screen.getByText('Cycle 2 review · published on 07/12/2026')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Adjuntos')).toBeNull();
    expect(screen.getByText(/Ana, mantén/).textContent).toBe(fixture.patientMessage);
  });

  it('permite leer y contraer texto largo sin perder contenido', () => {
    const patientMessage = 'Una recomendación clínica extensa. '.repeat(30);
    render(<I18nProvider><NutritionRecommendations recommendation={{ ...fixture, patientMessage }} /></I18nProvider>);
    expect(screen.queryByText(patientMessage)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leer más' }));
    expect(screen.getByText(/Una recomendación clínica extensa/).textContent).toBe(patientMessage);
    expect(screen.getByRole('button', { name: 'Leer menos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leer menos' }));
    expect(screen.getByRole('button', { name: 'Leer más' })).toBeTruthy();
    expect(screen.getByText(/Una recomendación clínica extensa/).textContent?.length).toBeLessThan(patientMessage.length);
  });
});
