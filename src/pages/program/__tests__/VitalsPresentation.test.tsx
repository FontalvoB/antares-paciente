import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthSample } from '../../../devices/types';
import { I18nProvider } from '../../../i18n/I18nContext';
import { persistRequestLanguage } from '../../../utils/requestLanguage';
import { VitalsLesson } from '../Lessons';

const wearable = vi.hoisted(() => ({
  samples: {} as Record<string, HealthSample>, today: {}, info: {}, phase: 'connected',
  sessionStale: false, lastSyncAt: null, syncHistory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../context/WearableContext', () => ({ useWearable: () => wearable }));
vi.mock('../../../components/icons3d', () => ({ WatchIcon3D: () => null }));
vi.mock('@ionic/react', async (original) => ({
  ...await original<typeof import('@ionic/react')>(),
  IonInput: ({ label, value, onIonInput, disabled }: { label: string; value: string; disabled: boolean; onIonInput: (e: { detail: { value: string } }) => void }) =>
    <label>{label}<input value={value} disabled={disabled} onChange={e => onIonInput({ detail: { value: e.target.value } })} /></label>,
  IonButton: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
}));
beforeEach(() => { persistRequestLanguage('es'); wearable.samples = {}; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-10T15:00:00Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); persistRequestLanguage('es'); });
function lesson(onComplete = vi.fn()) {
  return <I18nProvider><VitalsLesson done={false} pts={50} wearableConnected onOpenWearable={vi.fn()} onComplete={onComplete}
    recentVitals={{ heartRate: 220, recordedAt: '2026-11-08T10:00:00Z' }} /></I18nProvider>;
}
describe('registro neutral de mediciones', () => {
  it('conserva valores fuera de las antiguas bandas sin generar Alto/Bajo/En rango', () => {
    const save = vi.fn(); render(lesson(save));
    for (const [label, value] of [['Frecuencia cardíaca', '180'], ['SpO2', '88'], ['Temperatura', '39.2'], ['Glucosa', '200']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    expect(screen.getAllByText('Valor ingresado')).toHaveLength(4);
    expect(screen.queryByText(/^(Alto|Bajo|En rango)$/)).toBeNull();
    fireEvent.click(screen.getByText('Guardar signos · +50 pts'));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ heartRate: 180, o2Saturation: 88, temperatureC: 39.2, glucose: 200, measuredAt: '2026-11-10T15:00:00.000Z' }));
  });
  it('una lectura histórica o de snapshot no se convierte en dato actual ni en juicio clínico', async () => {
    wearable.samples.heart_rate = { metric: 'heart_rate', value: 220, unit: 'bpm', deviceId: 'qa-band', ts: Date.now() - 86_400_000, source: 'history' };
    render(lesson());
    await act(async () => { fireEvent.click(screen.getByText('Sincronizar ahora')); });
    expect((screen.getByLabelText('Frecuencia cardíaca') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/^(Alto|Bajo|En rango)$/)).toBeNull();
  });
  it('presenta el mismo estado neutral en inglés', () => {
    persistRequestLanguage('en'); render(lesson());
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '180' } });
    expect(screen.getByText('Entered value')).toBeTruthy();
    expect(screen.queryByText(/^(High|Low|In range)$/)).toBeNull();
  });
});
