import { afterEach, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { shareCommunityContent } from '../community-sharing'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('copies actual content rather than an invented public link', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {clipboard: {writeText}})
  expect(await shareCommunityContent('Community', 'My milestone')).toBe('copied')
  expect(writeText).toHaveBeenCalledWith('My milestone')
})
it('treats a dismissed share sheet as cancellation', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
  vi.stubGlobal('navigator', {share: vi.fn().mockRejectedValue(new DOMException('Dismissed', 'AbortError'))})
  expect(await shareCommunityContent('Community', 'My milestone')).toBe('cancelled')
})
