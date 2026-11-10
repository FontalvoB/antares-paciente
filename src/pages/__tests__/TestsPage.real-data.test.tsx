import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TestsPage } from '../TestsPage';
import { ApiError } from '../../utils/apiClient';
import { CONTENT_TRANSLATION_RETRY_SOURCE } from '../../utils/localizedError';

const api = vi.hoisted(() => ({ fetchMyAssignments: vi.fn(), fetchMyResults: vi.fn(), fetchMyTest: vi.fn(), startMyTest: vi.fn(), submitMyTest: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
const language = vi.hoisted(() => ({ current: 'es' as 'es' | 'en' }));
vi.mock('../../utils/healthTestsApi', () => api);
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: toast, skipTests: vi.fn(), finishTests: vi.fn(), navigate: vi.fn() }) }));
vi.mock('../../i18n/I18nContext', () => {
  const t = (key: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), key);
  return { useT: () => t, useI18n: () => ({ t, lang: language.current }) };
});
vi.mock('../../components/tests/TestWizard', async () => {
  const { useState } = await import('react');
  return { TestWizard: function TestWizardDouble({ onComplete, steps, extras, hidden }: { hidden?: boolean; onComplete: () => void; steps: Array<{ kind: string; question?: string }>; extras: { openNotes: string[]; onOpenNote: (index: number, value: string) => void } }) {
    const [position, setPosition] = useState(0);
    return <div hidden={hidden}><p>{steps.find(step => step.kind === 'open')?.question}</p><input aria-label="QA draft" value={extras.openNotes[0]} onChange={event => extras.onOpenNote(0, event.target.value)} /><span data-testid="wizard-position">{position}</span><button onClick={() => setPosition(value => value + 1)}>Next local step</button><button onClick={onComplete}>Submit real assessment</button></div>;
  } };
});
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, 'aria-label': label }: { children: ReactNode; onClick?: () => void; 'aria-label'?: string }) => <button aria-label={label} onClick={onClick}>{children}</button>,
  IonIcon: () => null, IonSkeletonText: () => null, IonLoading: () => null,
  IonProgressBar: ({ value }: { value: number }) => <progress aria-label="Assessment progress" value={value} max={1} />,
  IonSpinner: () => <span>Loading</span>,
  IonAccordionGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonAccordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonAvatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  language.current = 'es';
  localStorage.setItem('antares_lang', 'es');
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
    expect(screen.getAllByText('Según el cuestionario: alto').length).toBeGreaterThan(0);
    expect(screen.queryByText('Según el cuestionario: bajo')).toBeNull();
    expect(screen.getByText('Las dimensiones muestran puntuaciones sin etiquetas de nivel: no tienen rangos propios configurados.')).toBeTruthy();
  });

});


function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const detail = (text: string) => ({ questions: [{ id: 'question-1', type: 'open', text, options: [] }] });
describe('assessment language changes', () => {
  it('ignores a late Spanish question response after English finished', async () => {
    const spanish = pending<ReturnType<typeof detail>>();
    const english = pending<ReturnType<typeof detail>>();
    api.fetchMyTest.mockImplementation(() => language.current === 'en' ? english.promise : spanish.promise);
    const view = render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Real assigned test/));
    await waitFor(() => expect(api.fetchMyTest).toHaveBeenCalledTimes(1));
    language.current = 'en'; localStorage.setItem('antares_lang', 'en'); view.rerender(<TestsPage />);
    await waitFor(() => expect(api.fetchMyTest).toHaveBeenCalledTimes(2));
    await act(async () => english.resolve(detail('English question')));
    await screen.findByText('English question');
    await act(async () => spanish.resolve(detail('Pregunta española tardía')));
    expect(screen.queryByText('Pregunta española tardía')).toBeNull();
    expect(screen.getByText('English question')).toBeTruthy();
  });
  it('ignores late Spanish assignment/results and keeps newly translated completed metadata', async () => {
    const spanishList = pending<typeof assigned>();
    const spanishResults = pending<unknown[]>();
    const englishScore = { id: 'en-score', evaluationId: 'evaluation', resultType: 'score', code: 'qa', label: 'English score', value: 10, qualifier: null };
    api.fetchMyAssignments.mockImplementation(() => language.current === 'en'
      ? Promise.resolve([{ ...assigned[0], testName: 'English assessment', status: 'completed' }]) : spanishList.promise);
    api.fetchMyResults.mockImplementation(() => language.current === 'en' ? Promise.resolve([englishScore]) : spanishResults.promise);
    const view = render(<TestsPage />);
    await waitFor(() => expect(api.fetchMyAssignments).toHaveBeenCalledTimes(1));
    language.current = 'en'; localStorage.setItem('antares_lang', 'en'); view.rerender(<TestsPage />);
    await screen.findByText(/English assessment/);
    fireEvent.click(screen.getByText('Resultados de tus evaluaciones'));
    await screen.findByText('English score');
    await act(async () => {
      spanishList.resolve([{ ...assigned[0], testName: 'Evaluación española tardía' }]);
      spanishResults.resolve([{ ...englishScore, label: 'Resultado español tardío' }]);
    });
    expect(screen.queryByText('Resultado español tardío')).toBeNull();
    expect(screen.getByText('English score')).toBeTruthy();
  });

  it('retains completion status without retaining Spanish titles from a stale pending-list response', async () => {
    api.fetchMyAssignments.mockImplementation(() => Promise.resolve([{ ...assigned[0], testName: language.current === 'en' ? 'English assessment' : 'Evaluación española', status: language.current === 'en' ? 'pending' : 'completed' }]));
    const view = render(<TestsPage />);
    await screen.findByText(/Evaluación española/);
    language.current = 'en'; localStorage.setItem('antares_lang', 'en'); view.rerender(<TestsPage />);
    await screen.findByText(/English assessment/);
    expect(screen.queryByText(/Evaluación española/)).toBeNull();
    expect(screen.getByText('Hecho')).toBeTruthy();
  });

  it('preserves draft answers and wizard position while refetching display text', async () => {
    const english = pending<ReturnType<typeof detail>>();
    api.fetchMyTest.mockImplementation(() => language.current === 'en' ? english.promise : Promise.resolve(detail('Pregunta española')));
    const view = render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Real assigned test/));
    await screen.findByText('Pregunta española');
    fireEvent.change(screen.getByLabelText('QA draft'), { target: { value: 'My personal draft' } });
    fireEvent.click(screen.getByText('Next local step'));
    language.current = 'en'; localStorage.setItem('antares_lang', 'en'); view.rerender(<TestsPage />);
    await waitFor(() => expect(api.fetchMyTest).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('QA draft').closest('[hidden]')).toBeTruthy();
    await act(async () => english.resolve(detail('English question')));
    await screen.findByText('English question');
    expect(screen.getByLabelText('QA draft').closest('[hidden]')).toBeNull();
    expect((screen.getByLabelText('QA draft') as HTMLInputElement).value).toBe('My personal draft');
    expect(screen.getByTestId('wizard-position').textContent).toBe('1');
    fireEvent.click(screen.getByText('Submit real assessment'));
    await waitFor(() => expect(api.submitMyTest).toHaveBeenCalledWith('assignment-1', [{ questionId: 'question-1', answerOptionId: null, valueText: 'My personal draft' }]));
  });
});

const translationFailure = () => new ApiError({ status: 503, code: 'CONTENT_TRANSLATION_UNAVAILABLE', message: 'English content could not be prepared. Please try again.' });
const score = (label: string) => ({ id: 'score', evaluationId: 'evaluation', resultType: 'score', code: 'qa', label, value: 10, qualifier: null });
function setLanguage(value: 'es' | 'en') {
  language.current = value;
  localStorage.setItem('antares_lang', value);
}

describe('assessment read recovery', () => {
  it('keeps the initial translation failure distinct from empty data and retries the real assignment request', async () => {
    setLanguage('en');
    api.fetchMyAssignments.mockRejectedValueOnce(translationFailure());
    render(<TestsPage />);
    await screen.findByText(CONTENT_TRANSLATION_RETRY_SOURCE);
    expect(screen.queryByText('No se pudieron cargar tus evaluaciones.')).toBeNull();
    expect(screen.queryByText('No tienes evaluaciones asignadas.')).toBeNull();
    expect(screen.queryByText(/Real assigned test/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText(/Real assigned test/);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.fetchMyAssignments).toHaveBeenCalledTimes(2);
    expect(api.startMyTest).not.toHaveBeenCalled();
  });

  it('retains confirmed English cards, completion and results beside a failed refresh, then replaces them after Retry succeeds', async () => {
    setLanguage('en');
    const englishList = [{ ...assigned[0], testName: 'English assessment' }, { ...assigned[0], id: 'completed', testName: 'Earlier English assessment', status: 'completed' }];
    api.fetchMyAssignments.mockResolvedValue(englishList);
    api.fetchMyResults.mockResolvedValue([score('Saved English score')]);
    render(<TestsPage />);
    fireEvent.click(await screen.findByText(/^1\. English assessment$/));
    const draft = await screen.findByLabelText('QA draft');
    fireEvent.change(draft, { target: { value: 'My original answer' } });
    api.fetchMyAssignments.mockRejectedValueOnce(translationFailure());
    api.fetchMyResults.mockRejectedValueOnce(translationFailure());
    fireEvent.click(screen.getByText('Submit real assessment'));
    await screen.findByText(CONTENT_TRANSLATION_RETRY_SOURCE);
    expect(screen.getByText(/^1\. English assessment$/)).toBeTruthy();
    expect(screen.getByText(/Earlier English assessment/)).toBeTruthy();
    expect(screen.getAllByText('Hecho')).toHaveLength(2);
    expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(1);
    expect(screen.queryByText('No tienes evaluaciones asignadas.')).toBeNull();
    expect(toast).toHaveBeenCalledWith('Evaluación guardada', 'ok');
    expect(toast).not.toHaveBeenCalledWith('No se pudo guardar la evaluación', 'err');

    fireEvent.click(screen.getByText('Resultados de tus evaluaciones'));
    expect(screen.getByText(CONTENT_TRANSLATION_RETRY_SOURCE)).toBeTruthy();
    expect(screen.getByText('Saved English score')).toBeTruthy();
    api.fetchMyAssignments.mockResolvedValue(englishList.map(item => ({ ...item, status: 'completed' })));
    api.fetchMyResults.mockResolvedValue([score('Refreshed English score')]);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Refreshed English score');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Saved English score')).toBeNull();
  });

  it('does not relabel cached Spanish assignments or results as English when both English requests fail', async () => {
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], testName: 'Evaluación anterior en español', status: 'completed' }]);
    api.fetchMyResults.mockResolvedValue([score('Resultado anterior en español')]);
    const view = render(<TestsPage />);
    await screen.findByText(/Evaluación anterior en español/);
    fireEvent.click(screen.getByText('Resultados de tus evaluaciones'));
    await screen.findByText('Resultado anterior en español');
    api.fetchMyAssignments.mockRejectedValue(translationFailure());
    api.fetchMyResults.mockRejectedValue(translationFailure());
    setLanguage('en'); view.rerender(<TestsPage />);
    expect(screen.queryByText('Resultado anterior en español')).toBeNull();
    await screen.findByText(CONTENT_TRANSLATION_RETRY_SOURCE);
    expect(screen.queryByText('Resultado anterior en español')).toBeNull();
    expect(screen.queryByText('Aún no hay resultados calculados disponibles.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText(CONTENT_TRANSLATION_RETRY_SOURCE)).toBeTruthy();
    expect(screen.queryByText(/Evaluación anterior en español/)).toBeNull();
    expect(screen.queryByText('No tienes evaluaciones asignadas.')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps wizard answers and position mounted across a failed English read and question retry', async () => {
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], testName: 'Título anterior en español' }]);
    const view = render(<TestsPage />);
    fireEvent.click(await screen.findByText(/Título anterior en español/));
    const draft = await screen.findByLabelText('QA draft') as HTMLInputElement;
    fireEvent.change(draft, { target: { value: 'Mi respuesta personal intacta' } });
    fireEvent.click(screen.getByText('Next local step'));
    api.fetchMyAssignments.mockRejectedValue(translationFailure());
    api.fetchMyResults.mockRejectedValue(translationFailure());
    api.fetchMyTest.mockRejectedValueOnce(translationFailure());
    setLanguage('en'); view.rerender(<TestsPage />);
    await screen.findByText(CONTENT_TRANSLATION_RETRY_SOURCE);
    expect(screen.getByLabelText('QA draft')).toBe(draft);
    expect(draft.value).toBe('Mi respuesta personal intacta');
    expect(draft.closest('[hidden]')).toBeTruthy();
    expect(screen.getByTestId('wizard-position').textContent).toBe('1');
    expect(screen.queryByText('Título anterior en español')).toBeNull();
    api.fetchMyTest.mockResolvedValueOnce({ name: 'Recovered English title', ...detail('Recovered English question') });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Recovered English question');
    expect(screen.getByLabelText('QA draft')).toBe(draft);
    expect(draft.closest('[hidden]')).toBeNull();
    expect(draft.value).toBe('Mi respuesta personal intacta');
    expect(screen.getByTestId('wizard-position').textContent).toBe('1');
    expect(screen.getByText('Recovered English title')).toBeTruthy();
    expect(screen.queryByText('Título anterior en español')).toBeNull();
    fireEvent.click(screen.getByText('Submit real assessment'));
    await waitFor(() => expect(api.submitMyTest).toHaveBeenCalledWith('assignment-1', [{ questionId: 'question-1', answerOptionId: null, valueText: 'Mi respuesta personal intacta' }]));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Evaluación guardada', 'ok'));
  });

  it('keeps results failure separate from an empty successful result and does not poison the assignment list', async () => {
    setLanguage('en');
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], status: 'completed' }]);
    api.fetchMyResults.mockRejectedValueOnce(translationFailure());
    render(<TestsPage />);
    await screen.findByText(/Real assigned test/);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByText('Resultados de tus evaluaciones'));
    await screen.findByText(CONTENT_TRANSLATION_RETRY_SOURCE);
    expect(screen.queryByText('Aún no hay resultados calculados disponibles.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Aún no hay resultados calculados disponibles.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not carry a missing completed Spanish card into a successful English list', async () => {
    api.fetchMyAssignments.mockResolvedValueOnce([{ ...assigned[0], testName: 'Evaluación antigua en español', status: 'completed' }]);
    const view = render(<TestsPage />);
    await screen.findByText(/Evaluación antigua en español/);
    api.fetchMyAssignments.mockResolvedValue([{ ...assigned[0], id: 'english-only', testName: 'Current English assessment' }]);
    setLanguage('en'); view.rerender(<TestsPage />);
    await screen.findByText(/Current English assessment/);
    expect(screen.queryByText(/Evaluación antigua en español/)).toBeNull();
  });
});
