import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AvatarConfiguration } from '../../components/avatar/avatar-state';
import { changeAvatarGender } from '../../components/avatar/avatar-state';
const mocks = vi.hoisted(() => ({ token: 'a' as string | null, get: vi.fn(), put: vi.fn() }));
vi.mock('../../utils/authApi', () => ({ getAccessToken: () => mocks.token, onSessionInvalid: () => () => {} }));
vi.mock('../../services/avatar-configuration-service', () => ({ getAvatarConfiguration: (...args: unknown[]) => mocks.get(...args), putAvatarConfiguration: (...args: unknown[]) => mocks.put(...args) }));
import { useAvatarConfiguration } from '../useAvatarConfiguration';
const female: AvatarConfiguration = { version: 1, skin: 'skin-03', gender: 'female', hair: 'hair-02', clothing: { shirt: 'shirt-basic-01', pants: null, shoes: null }, accessories: { glasses: null, watch: null, bracelet: null } };
beforeEach(() => { mocks.token='a'; mocks.get.mockReset(); mocks.put.mockReset(); });
afterEach(cleanup);

it('no expone configuración provisional ni acepta respuestas de otra sesión', async () => {
  let resolve!: (value: AvatarConfiguration) => void;
  mocks.get.mockImplementationOnce(() => new Promise(r => { resolve=r; })).mockResolvedValue({ ...female, gender: 'male' });
  const { result, rerender }=renderHook(useAvatarConfiguration);
  expect(result.current.value).toBeNull();
  mocks.token='b';rerender();await waitFor(()=>expect(result.current.value?.gender).toBe('male'));
  await act(async()=>resolve(female));expect(result.current.value?.gender).toBe('male');
});
it('conserva la selección tras fallo y no descarta cambios hechos mientras guarda', async () => {
  mocks.get.mockResolvedValue(female);mocks.put.mockRejectedValueOnce(new Error('offline'));
  const { result }=renderHook(useAvatarConfiguration);await waitFor(()=>expect(result.current.status).toBe('ready'));
  act(()=>result.current.change({...female,hair:null}));await act(()=>result.current.save());
  expect(result.current.saveError).toBe(true);expect(result.current.value?.hair).toBeNull();expect(result.current.dirty).toBe(true);
  let complete!: (value: AvatarConfiguration)=>void;
  mocks.put.mockImplementation(()=>new Promise(r=>{complete=r;}));
  let saving!: Promise<void>;act(()=>{saving=result.current.save();});
  act(()=>result.current.change({...female,accessories:{...female.accessories,glasses:'glasses-01'}}));
  await act(async()=>{complete({...female,hair:null});await saving;});
  expect(result.current.value?.accessories.glasses).toBe('glasses-01');expect(result.current.dirty).toBe(true);expect(result.current.saveError).toBe(false);
});
it('no permite guardar ni cargar preferencias sin sesión real', () => {
  mocks.token=null;const {result}=renderHook(useAvatarConfiguration);
  expect(result.current.value).toBeNull();expect(result.current.status).toBe('session-required');expect(mocks.get).not.toHaveBeenCalled();
});
it('descarta únicamente los elementos incompatibles al cambiar de género', () => {
  const male={...female,gender:'male' as const,hair:'hair-03'};
  expect(changeAvatarGender(male,'female')).toEqual({...female,hair:null});
});
it.each(['female-hair-long-01','female-hair-long-02','female-hair-long-03'])('conserva %s en femenino y lo retira en masculino', hair => {
  const selected={...female,hair};
  expect(changeAvatarGender(selected,'female')).toEqual(selected);
  expect(changeAvatarGender(selected,'male')).toEqual({...female,gender:'male',hair:null});
});
