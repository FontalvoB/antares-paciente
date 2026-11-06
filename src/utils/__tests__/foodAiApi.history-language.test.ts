import { expect, it, vi } from 'vitest';
import { getFoodAnalysis } from '../foodAiApi';
import { apiFetch } from '../apiClient';
vi.mock('../apiClient', () => ({ apiFetch: vi.fn().mockResolvedValue({ foods: [] }) }));
it('requests historical food names in the selected language and keeps Spanish compatibility by default', async () => {
  await getFoodAnalysis('analysis', 'en');
  expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/foodai/analyses/analysis?language=en');
  await getFoodAnalysis('analysis');
  expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/foodai/analyses/analysis?language=es');
});
