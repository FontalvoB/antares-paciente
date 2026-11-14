import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNutritionRecommendations } from '../useNutritionRecommendations';
import { clearSessionAndNotify, persistAccessToken } from '../../utils/authApi';
import { nutritionKeys } from '../queryKeys';
import { nutritionRecommendationsPublicationOrderFixture as dto } from '../../components/nutrition/__tests__/fixtures/nutrition-recommendation';

const state = vi.hoisted(() => ({ lang: 'es' as 'es' | 'en' }));
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ authLoading: false }) }));
vi.mock('../../i18n/I18nContext', () => ({ useI18n: () => ({ lang: state.lang }) }));
const fetchMock = vi.fn();
const clients: QueryClient[] = [];
const token = (sub: string) => `${btoa('{}')}.${btoa(JSON.stringify({ sub, aud: 'app' }))}.fixture`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function wrapper() {
  const client = new QueryClient(); clients.push(client);
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { state.lang = 'es'; persistAccessToken(token('self-a')); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

describe('3.18/3.19 · carga real y caché de recomendaciones', () => {
  it('un refetch renueva el envoltorio y las firmas sin modificar la URL anterior', async () => {
    const renewed = structuredClone(dto); renewed.current!.attachments[0].url += '-renewed';
    fetchMock.mockResolvedValueOnce(json(dto)).mockResolvedValueOnce(json(renewed));
    const { result } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.recommendations).toEqual(dto));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.recommendations).toEqual(renewed));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renueva a los cuatro minutos, antes de vencer las firmas de cinco', async () => {
    vi.useFakeTimers(); fetchMock.mockImplementation(async () => json(dto));
    const { result } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.recommendations).toEqual(dto);
    await act(async () => { await vi.advanceTimersByTimeAsync(4 * 60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cambiar ES/EN recarga el mensaje con cabecera propia y no conserva la proyección anterior', async () => {
    const english = structuredClone(dto); english.current!.patientMessage = 'Published English message';
    fetchMock.mockResolvedValueOnce(json(dto)).mockResolvedValueOnce(json(english));
    const { result, rerender } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.recommendations).toEqual(dto));
    state.lang = 'en'; rerender();
    expect(result.current.recommendations).toBeUndefined();
    await waitFor(() => expect(result.current.recommendations).toEqual(english));
    expect(fetchMock.mock.calls[1][1].headers.get('X-App-Language')).toBe('en');
  });

  it('una respuesta tardía de otra cuenta no aparece en la cuenta nueva', async () => {
    let resolveOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(json({ current: null, previous: [] }));
    const { result, rerender } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    persistAccessToken(token('self-b')); rerender();
    expect(result.current.recommendations).toBeUndefined();
    await waitFor(() => expect(result.current.recommendations).toEqual({ current: null, previous: [] }));
    await act(async () => { resolveOld(json(dto)); });
    expect(result.current.recommendations).toEqual({ current: null, previous: [] });
  });

  it('invalidar la sesión elimina datos y detiene las consultas sin reutilizar la cuenta anterior', async () => {
    fetchMock.mockResolvedValue(json(dto));
    const { result } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.recommendations).toEqual(dto));
    act(() => clearSessionAndNotify());
    expect(result.current.recommendations).toBeUndefined();
    expect(result.current.error).toMatchObject({ status: 401 });
    expect(clients[0].getQueriesData({ queryKey: nutritionKeys.recommendations }).every(([, data]) => data === undefined)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('un fallo de refetch oculta el dato anterior y permite recuperación explícita', async () => {
    fetchMock.mockResolvedValueOnce(json(dto)).mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(dto));
    const { result } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.recommendations).toEqual(dto));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 503 }));
    expect(result.current.recommendations).toBeUndefined();
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.recommendations).toEqual(dto));
  });

  it('403 no reintenta automáticamente ni expone recomendaciones anteriores', async () => {
    fetchMock.mockResolvedValue(json({}, 403));
    const { result } = renderHook(useNutritionRecommendations, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 403 }));
    expect(result.current.recommendations).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
