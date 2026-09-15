import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approachBody, bodyMorphs, bodyState, weightRecords } from '../../components/avatar/avatar-body-state';
import type { MetricsHistoryDto } from '../../services/program/types';
import { ApiError } from '../../utils/apiClient';

const mocks = vi.hoisted(() => ({ token: 'session-a' as string | null, fetch: vi.fn() }));
vi.mock('../../utils/authApi', () => ({ getAccessToken: () => mocks.token, onSessionInvalid: () => () => {} }));
vi.mock('../../services/program/metrics-history-service', () => ({ getMetricsHistory: (...args: unknown[]) => mocks.fetch(...args) }));
import { useAvatarProgress } from '../useAvatarProgress';

// Fixtures de pruebas exclusivamente: nunca se escriben en la BD ni se usan como fallback.
function history(values: number[], unit = 'kg'): MetricsHistoryDto {
  return { heightCm: null, metrics: [{ code: 'weight', unit, target: null, favorableDirection: null,
    points: values.map((value, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value })) }] };
}
beforeEach(() => { mocks.token = 'session-a'; mocks.fetch.mockReset(); });
afterEach(cleanup);

describe('Avatar Body State relativo, sin inferencias clínicas', () => {
  it('el peso absoluto no asigna una constitución', () => {
    expect(bodyState(50, 55)).toEqual(bodyState(100, 110));
    expect(bodyState(130, 130).bodyVolume).toBe(0);
    expect(bodyState(50, 50).bodyLean).toBe(0);
  });
  it('evoluciona continuamente, revierte a referencia y satura dentro de 0..1', () => {
    expect(bodyState(100, 110).bodyVolume).toBeCloseTo(0.5);
    expect(bodyState(100, 90).bodyLean).toBeCloseTo(0.5);
    expect(bodyState(100, 100).bodyLean).toBe(0);
    expect(bodyState(100, 300).bodyVolume).toBe(1);
    expect(bodyState(100, 1).bodyLean).toBe(1);
    expect(bodyState(100, 101).bodyVolume).toBeLessThan(bodyState(100, 102).bodyVolume);
  });
  it('no infiere distribución de grasa ni músculo y conserva nombres del GLB', () => {
    const weights = bodyMorphs(bodyState(100, 80));
    expect(weights).toEqual({ BodyVolume: 0, BodyLean: 1, Abdomen: 0, Waist: 0,
      Chest: 0, Arms: 0, Thighs: 0, FaceVolume: 0, MuscleDefinition: 0 });
  });
  it('rechaza unidades desconocidas, valores inválidos y fechas imposibles; ordena sin mutar', () => {
    expect(() => weightRecords(history([100], 'lb'))).toThrow('UNSUPPORTED_WEIGHT_UNIT');
    expect(() => weightRecords(undefined)).toThrow('INVALID_HISTORY_RESPONSE');
    expect(() => weightRecords(history([0, -1]))).toThrow('INVALID_WEIGHT_RECORDS');
    const input = history([100, 0, -1, NaN, Infinity, 95]);
    input.metrics[0].points.push({ date: '2026-02-30', value: 90 });
    input.metrics[0].points.reverse();
    expect(weightRecords(input).map(r => r.value)).toEqual([100, 95]);
    expect(input.metrics[0].points[0].date).toBe('2026-02-30');
    expect(bodyState(0, 90)).toEqual(bodyState(90, 90));
  });
  it('transiciona sin saltos ni sobrepasar el objetivo y con independencia de FPS', () => {
    let a = 1, b = 1;
    for (let i = 0; i < 30; i++) a = approachBody(a, -1, 1 / 30);
    for (let i = 0; i < 60; i++) b = approachBody(b, -1, 1 / 60);
    expect(a).toBeCloseTo(b, 8);
    expect(a).toBeGreaterThan(-1);
    expect(approachBody(1, -1, 1 / 30)).toBeGreaterThan(0);
    expect(approachBody(-0.99999, -1, 0.1)).toBe(-1);
  });
});

describe('Historial autenticado aislado, sin datos demo', () => {
  it('espera las preferencias y consulta automáticamente cuando están listas', async () => {
    mocks.fetch.mockResolvedValue(history([100, 110]));
    const { result, rerender }=renderHook(({ready})=>useAvatarProgress(ready),{initialProps:{ready:false}});
    expect(result.current.status).toBe('loading');expect(result.current.resolved).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
    rerender({ready:true});
    await waitFor(()=>expect(result.current.status).toBe('ready'));
    expect(result.current.records.map(r=>r.value)).toEqual([100,110]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('espera la primera respuesta y conserva el estado validado durante una actualización', async () => {
    let complete!: (value: MetricsHistoryDto) => void;
    mocks.fetch.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const { result, rerender } = renderHook(useAvatarProgress);
    expect(result.current.resolved).toBe(false);
    await act(async () => complete(history([100, 90])));
    expect(result.current.resolved).toBe(true);
    act(() => result.current.refresh());
    expect(result.current.status).toBe('loading');
    expect(result.current.resolved).toBe(true);
    expect(result.current.records.map(r => r.value)).toEqual([100, 90]);
    await act(async () => complete(history([100, 90, 110])));
    expect(result.current.records.map(r => r.value)).toEqual([100, 90, 110]);
    expect(result.current.historyMs).toBeGreaterThanOrEqual(0);
    mocks.token = 'session-b'; rerender();
    expect(result.current.resolved).toBe(false);
    expect(result.current.records).toEqual([]);
  });

  it('un fallo inicial no habilita el avatar neutral y un fallo de recarga no inventa pesos', async () => {
    mocks.fetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(useAvatarProgress);
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.resolved).toBe(false);
    mocks.fetch.mockResolvedValue(history([100, 90]));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    mocks.fetch.mockRejectedValue(new Error('network'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.records.map(r => r.value)).toEqual([100, 90]);
  });
  it.each([null, 'demo-access-token'])('no consulta ni representa mediciones con sesión %s', token => {
    mocks.token = token;
    const { result } = renderHook(useAvatarProgress);
    expect(result.current.status).toBe('session-required');
    expect(result.current.records).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('reutiliza el endpoint con solo peso y la ventana máxima; actualizar consulta de nuevo', async () => {
    mocks.fetch.mockResolvedValue(history([100, 95]));
    const { result } = renderHook(useAvatarProgress);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mocks.fetch).toHaveBeenCalledWith(['weight'], 365, { cache: 'no-store' });
    expect(result.current.records.map(r => r.value)).toEqual([100, 95]);
    mocks.fetch.mockResolvedValue(history([100, 95, 94]));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.records).toHaveLength(3));
  });
  it('oculta datos de A inmediatamente al cambiar a B; una respuesta tardía de A se descarta', async () => {
    let resolveA!: (value: MetricsHistoryDto) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
    const { result, rerender } = renderHook(useAvatarProgress);
    mocks.token = 'session-b';
    mocks.fetch.mockResolvedValue(history([70]));
    rerender();
    await waitFor(() => expect(result.current.records[0]?.value).toBe(70));
    await act(async () => resolveA(history([100])));
    expect(result.current.records[0]?.value).toBe(70);
    mocks.token = null; rerender();
    expect(result.current.records).toEqual([]);
  });
  it.each([
    [new ApiError({ message: 'NO_ACTIVE_ENROLLMENT', code: 'NO_ACTIVE_ENROLLMENT', status: 404 }), 'unavailable'],
    [new ApiError({ message: 'Endpoint not found', status: 404 }), 'error'],
    [new Error('network'), 'error'],
  ])('no sustituye un fallo por mediciones', async (error, status) => {
    mocks.fetch.mockRejectedValue(error);
    const { result } = renderHook(useAvatarProgress);
    await waitFor(() => expect(result.current.status).toBe(status));
    expect(result.current.records).toEqual([]);
  });
  it('distingue ausencia de registros y un único registro real', async () => {
    mocks.fetch.mockResolvedValue(history([]));
    const { result } = renderHook(useAvatarProgress);
    await waitFor(() => expect(result.current.status).toBe('empty'));
    mocks.fetch.mockResolvedValue(history([90]));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.records).toHaveLength(1);
  });
});
