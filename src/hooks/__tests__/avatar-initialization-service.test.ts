import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../../utils/apiClient',async importOriginal=>({
  ...await importOriginal<typeof import('../../utils/apiClient')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args),
}));
import {getAvatarConfiguration} from '../../services/avatar-configuration-service';
import {loadUserAvatarData} from '../useAvatarProgress';
beforeEach(()=>{mocks.fetch.mockReset();});
it.each([null,undefined])('aplica defaults solo ante ausencia confirmada de preferencias (%s)',async value=>{
  mocks.fetch.mockResolvedValue(value);
  expect(await getAvatarConfiguration()).toMatchObject({version:1,gender:'male',hair:'hair-02'});
});
it('no oculta errores de preferencias con defaults',async()=>{
  mocks.fetch.mockRejectedValue(new Error('service unavailable'));
  await expect(getAvatarConfiguration()).rejects.toMatchObject({message:'service unavailable'});
});
it('consulta el endpoint real sin caché y conserva la diferencia entre vacío y error',async()=>{
  mocks.fetch.mockResolvedValue({heightCm:null,metrics:[]});
  await expect(loadUserAvatarData()).resolves.toEqual([]);
  expect(mocks.fetch).toHaveBeenCalledWith('/api/v1/program/me/metrics-history?codes=weight&days=365',{method:'GET',cache:'no-store'});
  mocks.fetch.mockRejectedValue(new Error('offline'));
  await expect(loadUserAvatarData()).rejects.toMatchObject({message:'offline'});
});
