import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyNutritionRecommendations } from '../nutrition-recommendations-service';
import { getAccessToken, onSessionInvalid, persistAccessToken } from '../../../utils/authApi';
import { nutritionRecommendationsPublicationOrderFixture as dto } from '../../../components/nutrition/__tests__/fixtures/nutrition-recommendation';

const fetchMock = vi.fn();
const token = (suffix = 'initial') => `${btoa('{}')}.${btoa(JSON.stringify({ sub: 'patient-self', aud: 'app', exp: 4102444800 }))}.${suffix}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); persistAccessToken(token()); });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

describe('3.10 · contrato HTTP real del cliente de recomendaciones', () => {
  it.each(['es', 'en'] as const)('GET propio, Bearer y cabeceras %s, sin IDs ni body, conserva el DTO público', async language => {
    fetchMock.mockResolvedValue(json(dto));
    const result = await getMyNutritionRecommendations(language, undefined, 'patient-self');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/me/nutrition/cycles/recommendations');
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(options.cache).toBe('no-store');
    expect(options.headers.get('Authorization')).toBe(`Bearer ${token()}`);
    expect(options.headers.get('X-App-Language')).toBe(language);
    expect(options.headers.get('Accept-Language')).toBe(language);
    expect(Object.keys(result).sort()).toEqual(['current', 'previous']);
    expect(Object.keys(result.current!).sort()).toEqual(['attachments', 'cycleNumber', 'endDate', 'patientMessage', 'professionalName', 'publishedAt', 'startDate']);
    expect(Object.keys(result.current!.attachments[0]).sort()).toEqual(['caption', 'url']);
    expect(result).toEqual(dto);
    expect(result.current!.cycleNumber).toBe(1);
    expect(result.previous.map(cycle => cycle.cycleNumber)).toEqual([2, 3]);
    expect(result.current!.attachments[0].url).toContain('X-Amz-Expires=300');
    expect(JSON.stringify(result)).not.toMatch(/professional_notes|ai_draft_json|summary_json|reviewId|patientId|storage_key/);
  });

  it('200 sin publicaciones conserva current:null y previous:[]', async () => {
    fetchMock.mockResolvedValue(json({ current: null, previous: [] }));
    await expect(getMyNutritionRecommendations('es')).resolves.toEqual({ current: null, previous: [] });
  });

  it('401 recuperable usa el refresh compartido y repite una vez con el Bearer renovado', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ accessToken: token('renewed'), tokenType: 'Bearer', expiresIn: 3600 })).mockResolvedValueOnce(json(dto));
    await expect(getMyNutritionRecommendations('en', undefined, 'patient-self')).resolves.toEqual(dto);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ application: 'app' });
    expect(fetchMock.mock.calls[2][1].headers.get('Authorization')).toBe(`Bearer ${token('renewed')}`);
    expect(fetchMock.mock.calls[2][1].headers.get('X-App-Language')).toBe('en');
  });

  it('401 definitivo invalida la sesión y no entra en un bucle de reintentos', async () => {
    const listener = vi.fn(); const unsubscribe = onSessionInvalid(listener);
    try {
      fetchMock.mockResolvedValue(json({}, 401));
      await expect(getMyNutritionRecommendations('es')).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getAccessToken()).toBeNull();
      expect(listener).toHaveBeenCalledOnce();
    } finally { unsubscribe(); }
  });

  it.each([403, 404, 503])('%i se propaga como error; no es un historial vacío ni dispara refresh', async status => {
    fetchMock.mockResolvedValue(json({ detail: 'Error de la fixture HTTP' }, status));
    await expect(getMyNutritionRecommendations('es')).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
