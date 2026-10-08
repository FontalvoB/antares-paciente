import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TestsPage } from '../TestsPage';

const api = vi.hoisted(() => ({ fetchMyAssignments: vi.fn(), fetchMyResults: vi.fn(), fetchMyTest: vi.fn(), startMyTest: vi.fn(), submitMyTest: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('../../utils/healthTestsApi', () => api);
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: toast, skipTests: vi.fn(), finishTests: vi.fn(), navigate: vi.fn() }) }));
vi.mock('../../i18n/I18nContext', () => ({ useT: () => (key: string) => key }));
vi.mock('../../components/tests/TestWizard', () => ({ TestWizard: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Submit real assessment</button> }));
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  IonIcon: () => null, IonLoading: () => null, IonProgressBar: () => null, IonSpinner: () => <span>Loading</span>,
  IonAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonAccordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('framer-motion', () => ({ useReducedMotion: () => true,
  motion: { button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }
}));

const assigned = [{ id: 'assignment-1', testCode: 'qa-test', testName: 'Real assigned test', status: 'pending' }];
beforeEach(() => {
  cleanup();
  api.fetchMyAssignments.mockResolvedValue(assigned);
  api.fetchMyResults.mockResolvedValue([]);
  api.fetchMyTest.mockResolvedValue({ questions: [{ id: 'question-1', type: 'open', text: 'QA question', options: [] }] });
  api.startMyTest.mockResolvedValue({});
  api.submitMyTest.mockResolvedValue({});
});

describe('real assessment flow', () => {
  it('shows an error and retries instead of inventing assignments', async () => {
    api.fetchMyAssignments.mockRejectedValueOnce(new Error('offline'));
    render(<TestsPage />);
    await screen.findByText('No se pudieron cargar tus evaluaciones.');
    expect(screen.queryByText('Real assigned test')).toBeNull();
    fireEvent.click(screen.getByText('Reintentar'));
    await screen.findByText(/Real assigned test/);
  });
  it('shows a real empty state', async () => {
    api.fetchMyAssignments.mockResolvedValue([]);
    render(<TestsPage />);
    await screen.findByText('No tienes evaluaciones asignadas.');
    expect(screen.queryByText('Submit real assessment')).toBeNull();
  });
  it('does not fall back to demo questions on a failed detail request', async () => {
    api.fetchMyTest.mockRejectedValue(new Error('offline'));
    render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Real assigned test/));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No se pudieron cargar las preguntas. Intenta nuevamente.', 'err'));
    expect(screen.queryByText('Submit real assessment')).toBeNull();
  });
  it('keeps answers open and reports failure when the server rejects submission', async () => {
    api.submitMyTest.mockRejectedValue(new Error('server rejected'));
    render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Real assigned test/));
    fireEvent.click(await screen.findByText('Submit real assessment'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No se pudo guardar la evaluación', 'err'));
    expect(screen.getByText('Submit real assessment')).toBeTruthy();
    expect(toast).not.toHaveBeenCalledWith('Evaluación guardada', 'ok');
  });
  it('shows saved only after the backend accepts submission', async () => {
    render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Real assigned test/));
    fireEvent.click(await screen.findByText('Submit real assessment'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Evaluación guardada', 'ok'));
    expect(api.submitMyTest).toHaveBeenCalledWith('assignment-1', expect.any(Array));
    expect(screen.queryByText('Submit real assessment')).toBeNull();
    expect(screen.getByText('Hecho')).toBeTruthy();
  });
  it('shows only backend results without static health-profile claims', async () => {
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], status: 'completed' }]);
    api.fetchMyResults.mockResolvedValue([{ id: 'r1', evaluationId: 'eval-1', resultType: 'score', code: 'qa', label: 'Backend score', value: 140, qualifier: null }]);
    render(<TestsPage />);
    fireEvent.click(await screen.findByText('Resultados de tus evaluaciones'));
    await screen.findByText('Backend score');
    expect(screen.getByText('140')).toBeTruthy();
    expect(screen.queryByText('Análisis DOFA')).toBeNull();
  });
  it('keeps the total classification but omits legacy dimension labels', async () => {
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], status: 'completed' }]);
    api.fetchMyResults.mockResolvedValue([
      { id: 'total', evaluationId: 'evaluation', resultType: 'score', code: 'temperamento', label: 'Temperamento', value: 20, qualifier: 'alto', severity: 'high' },
      { id: 'detail', evaluationId: 'evaluation', resultType: 'subscale', code: 'dimension', label: 'Análisis y detalle', value: 4, qualifier: 'bajo', severity: 'low' },
    ]);
    render(<TestsPage />);
    fireEvent.click(await screen.findByText('Resultados de tus evaluaciones'));
    await screen.findByText('Análisis y detalle');
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('alto')).toBeTruthy();
    expect(screen.queryByText('bajo')).toBeNull();
    expect(screen.getByText('Las dimensiones muestran puntuaciones sin etiquetas de nivel: no tienen rangos propios configurados.')).toBeTruthy();
  });

});
