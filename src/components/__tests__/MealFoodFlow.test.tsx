import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import { MealFoodFlow } from '../MealFoodFlow';
const api = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock('../../utils/foodAiApi', () => ({ analyzeFoodImage: api.analyze }));
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: vi.fn() }) }));
vi.mock('../../i18n/I18nContext', () => ({ useT: () => (s: string) => s }));
vi.mock('../../hooks/useNutritionLog', () => ({ useNutritionLog: () => ({ mutate: vi.fn() }), useUpdateNutritionLog: () => ({ mutate: vi.fn() }) }));
vi.mock('../CameraCapture', () => ({ CameraCapture: ({ onCapture }: { onCapture: (b: Blob, n: string) => void }) => <button onClick={() => onCapture(new Blob(['photo']), 'meal.jpg')}>Capture fixture</button> }));
vi.mock('../FoodResultCard', () => ({ FoodResultCard: () => <div>Detected food detail</div> }));
it('keeps the analyzed photo on Back and places plan comparison before the food list', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:meal');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  let resolve!: (v: unknown) => void;
  api.analyze.mockImplementation(() => new Promise(r => { resolve = r; }));
  const back = vi.fn();
  const close = vi.fn();
  const view = render(<MealFoodFlow meal="des" mode="register" onBack={back} onClose={close} onManual={vi.fn()} />);
  fireEvent.click(screen.getByText('Capture fixture'));
  expect(view.container.querySelector('.food-photo-scan')).toBeTruthy();
  await act(async () => resolve({ analysisId: 'a', foods: [{name:'Food',nutritionStatus:'available'}], summary: { calories: 250 } }));
  await waitFor(() => expect(screen.getByText('Detected food detail')).toBeTruthy());
  expect(view.container.querySelector('.food-photo-scan')).toBeNull();
  const plan = screen.getByRole('region', { name: 'Tu comida y tu plan' });
  expect(plan.compareDocumentPosition(screen.getByText('Detected food detail')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(back).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByText('Capture fixture')).toBeNull();
  expect(screen.getByAltText('Fotografía de la comida').getAttribute('src')).toBe('blob:meal');
  expect(api.analyze).toHaveBeenCalledOnce();
});

vi.mock('@ionic/react', async (original) => ({
 ...(await original<typeof import('@ionic/react')>()),
 IonButton: ({children,onClick,disabled,...props}: {children?:ReactNode;onClick?:()=>void;disabled?:boolean;'aria-label'?:string}) => <button disabled={disabled} onClick={onClick} aria-label={props['aria-label']}>{children}</button>,
 IonSpinner: () => <span />,
}));
vi.mock('framer-motion', () => ({ motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> } }));
