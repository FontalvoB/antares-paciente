import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { TestWizard } from '../TestWizard';
import { FALLBACK_THEME, type WizardStep } from '../model';
vi.mock('../../../i18n/I18nContext', () => ({ useT: () => (text: string) => text }));
vi.mock('@capacitor/haptics', () => ({ Haptics: { impact: () => Promise.resolve() }, ImpactStyle: { Light: 'light' } }));
vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    button: ({ children, onClick, 'aria-label': label }: { children: ReactNode; onClick: () => void; 'aria-label'?: string }) => <button aria-label={label} onClick={onClick}>{children}</button>,
  },
}));
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
  IonInput: ({ value, onIonInput, 'aria-label': label }: { value: string | number; onIonInput: (e: { detail: { value: string } }) => void; 'aria-label': string }) => <input aria-label={label} value={value} onChange={e => onIonInput({ detail: { value: e.target.value } })} />,
  IonIcon: () => null, IonSpinner: () => null, IonProgressBar: () => null, IonTextarea: () => null,
}));
const steps: WizardStep[] = [
  { kind: 'intro', key: 'intro', title: 'Inicio', sub: '', emoji: '', minutes: 1, count: 1 },
  { kind: 'num', key: 'height', index: 0, text: 'Estatura', emoji: '', unit: 'cm', min: 100, max: 220, def: 170 },
];
const complete = vi.fn();
function Harness({ initial = 175 }: { initial?: number | string }) {
  const [answers, setAnswers] = useState<Record<number, number | string>>({ 0: initial });
  return <TestWizard initialStep={1} theme={FALLBACK_THEME} steps={steps} answers={answers}
    extras={{ openNotes: [], onOpenNote: vi.fn() }} onScale={vi.fn()} onBackendMulti={vi.fn()}
    onNum={(index, value) => setAnswers(a => ({ ...a, [index]: value }))} onComplete={complete} />;
}
beforeEach(() => { cleanup(); complete.mockClear(); });
describe('editable numeric assessment', () => {
  it('resumes the stored step and permits clearing, typing and using both stepper buttons', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Estatura') as HTMLInputElement;
    expect(input.value).toBe('175');
    fireEvent.change(input, { target: { value: '' } });
    expect((screen.getByText('Guardar evaluación') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '182' } });
    fireEvent.click(screen.getByLabelText('Aumentar'));
    expect(input.value).toBe('183');
    fireEvent.click(screen.getByLabelText('Disminuir'));
    expect(input.value).toBe('182');
    fireEvent.click(screen.getByText('Guardar evaluación'));
    expect(complete).toHaveBeenCalledOnce();
  });
  it.each(['999', 'texto', '180.5', ''])('prevents submitting invalid input %s', value => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Estatura'), { target: { value } });
    fireEvent.click(screen.getByText('Guardar evaluación'));
    expect(complete).not.toHaveBeenCalled();
  });
  it('does not overwrite an unfinished numeric draft when resuming', () => {
    render(<Harness initial="18" />);
    expect((screen.getByLabelText('Estatura') as HTMLInputElement).value).toBe('18');
    expect((screen.getByText('Guardar evaluación') as HTMLButtonElement).disabled).toBe(true);
  });
});

it('records the next question immediately when leaving just after selecting a purpose answer', () => {
  const choices: WizardStep[] = [0, 1, 2].map(index => ({
    kind: 'scale', key: String(index), index, text: 'Propósito', emoji: '',
    scale: ['Sí', 'No'], leftLabel: 'Sí', rightLabel: 'No', variant: 'cards',
  }));
  const saveAnswer = vi.fn();
  const saveStep = vi.fn();
  const view = render(<TestWizard initialStep={1} theme={FALLBACK_THEME} steps={choices}
    answers={{ 0: 0 }} extras={{ openNotes: [], onOpenNote: vi.fn() }}
    onScale={saveAnswer} onStepChange={saveStep} onNum={vi.fn()} onBackendMulti={vi.fn()} onComplete={complete} />);
  fireEvent.click(screen.getByText('Sí'));
  view.unmount();
  expect(saveAnswer).toHaveBeenCalledWith(1, 0);
  expect(saveStep).toHaveBeenCalledWith(2);
});
