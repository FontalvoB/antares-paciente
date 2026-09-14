import type { SkinId } from './avatar-skin-catalog';
import type { AvatarBodyState } from './avatar-body-state';
import { equipmentForGender } from './avatar-equipment';
import type { AvatarEquipmentState, AvatarGender } from './avatar-equipment';

/** Solo preferencias estéticas; nunca contiene peso ni morphs derivados. */
export interface AvatarConfiguration extends AvatarEquipmentState { gender: AvatarGender; skin: SkinId; version: 1 }
export interface AvatarState extends AvatarConfiguration { body: AvatarBodyState }
export function changeAvatarGender(config: AvatarConfiguration, gender: AvatarGender): AvatarConfiguration {
  return { ...equipmentForGender(config, gender), gender, skin: config.skin, version: 1 };
}
