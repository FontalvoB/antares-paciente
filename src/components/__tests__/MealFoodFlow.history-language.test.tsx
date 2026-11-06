import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider, useI18n } from '../../i18n/I18nContext';
import { MealFoodFlow } from '../MealFoodFlow';
import type { NutritionIntakeLogDto } from '../../services/program/types';

const api = vi.hoisted(() => ({ detail: vi.fn(), analyze: vi.fn() }));
vi.mock('../../utils/foodAiApi', async original => ({ ...(await original<typeof import('../../utils/foodAiApi')>()), getFoodAnalysis: api.detail, analyzeFoodImage: api.analyze }));
vi.mock('../CameraCapture', () => ({ CameraCapture: ({ onCapture }: { onCapture: (blob: Blob, name: string) => void }) => <button onClick={() => onCapture(new Blob(['photo']), 'meal.jpg')}>Capture fixture</button> }));
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: vi.fn() }) }));
vi.mock('../../hooks/useNutritionLog', () => ({ useNutritionLog: () => ({ mutate: vi.fn() }), useUpdateNutritionLog: () => ({ mutate: vi.fn() }) }));
vi.mock('@ionic/react', async original => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, disabled, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick} aria-label={props['aria-label']}>{children}</button>,
  IonIcon: () => null,
  IonSpinner: () => null,
  IonChip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('framer-motion', async original => ({
  ...(await original<typeof import('framer-motion')>()), useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div>, span: ({ children }: { children: ReactNode }) => <span>{children}</span> },
}));
function LanguageSwitch() { const { toggleLang } = useI18n(); return <button onClick={toggleLang}>Switch language</button>; }
afterEach(() => { cleanup(); localStorage.clear(); api.detail.mockReset(); api.analyze.mockReset(); });

it('hydrates historical English names and reloads language-specific detail without changing meal values', async () => {
  localStorage.setItem('antares_lang', 'es');
  const original = { name: 'Arroz con pollo de la familia', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 10, height: 10 }, portion: null, nutrition: null, nutritionStatus: 'unavailable', source: null };
  api.detail.mockImplementation(async (_id: string, language: string) => ({ analysisId: 'analysis', status: 'completed', imageKey: null, summary: null,
    foods: [{ ...original, nameEn: language === 'en' ? 'Family chicken and rice' : null }] }));
  const log = { mealCode: 'alm', localDate: '2026-11-05', foodAnalysisId: 'analysis', calories: 380, proteinG: 20, carbsG: 50, fatG: 10, source: 'ai_photo' } as NutritionIntakeLogDto;
  render(<I18nProvider><LanguageSwitch /><MealFoodFlow meal="alm" mode="detail" log={log} onClose={() => {}} onManual={() => {}} /></I18nProvider>);
  await waitFor(() => expect(screen.getByText(original.name)).toBeTruthy());
  expect(api.detail).toHaveBeenCalledWith('analysis', 'es');
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
  await waitFor(() => expect(screen.getByText('Family chicken and rice')).toBeTruthy());
  expect(api.detail).toHaveBeenCalledWith('analysis', 'en');
  expect(screen.queryByText(original.name)).toBeNull();
  expect(screen.getByText('380 kcal')).toBeTruthy();
  expect(log.calories).toBe(380); expect(log.proteinG).toBe(20); expect(original.name).toBe('Arroz con pollo de la familia');
});

it('localizes the new retained-photo error and retries using the same capture', async () => {
  localStorage.setItem('antares_lang', 'en');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:meal-retry');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  api.analyze.mockRejectedValue(new Error('Servicio temporalmente no disponible'));
  render(<I18nProvider><MealFoodFlow meal="alm" mode="register" onClose={() => {}} onManual={() => {}} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Capture fixture' }));
  await screen.findByText('We couldn’t analyze this photo');
  expect(screen.getByRole('alert').textContent).toContain('An error occurred while analyzing the image.');
  expect(screen.queryByText('Servicio temporalmente no disponible')).toBeNull();
  expect(screen.getByAltText('Food photo').getAttribute('src')).toBe('blob:meal-retry');
  const capture = api.analyze.mock.calls[0];
  fireEvent.click(screen.getByRole('button', { name: 'Analyze again' }));
  await waitFor(() => expect(api.analyze).toHaveBeenCalledTimes(2));
  expect(api.analyze.mock.calls[1]).toEqual(capture);
});

it('retains the upstream explicit detail retry when a language-specific fetch fails', async () => {
  localStorage.setItem('antares_lang', 'en');
  api.detail.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ analysisId: 'analysis', imageKey: null, foods: [] });
  const log = { mealCode: 'alm', localDate: '2026-11-05', foodAnalysisId: 'analysis', calories: 380, source: 'ai_photo' } as NutritionIntakeLogDto;
  render(<I18nProvider><MealFoodFlow meal="alm" mode="detail" log={log} onClose={() => {}} onManual={() => {}} /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByText('No photo saved');
  expect(api.detail.mock.calls).toEqual([['analysis', 'en'], ['analysis', 'en']]);
  expect(screen.getByText('380 kcal')).toBeTruthy();
});
