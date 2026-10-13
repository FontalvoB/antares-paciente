import { afterEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { communityMediaUrl, resolveCommunityMedia, uploadCommunityMedia } from '../community-media'
import { ensureFreshAccessToken } from '../authApi'
vi.mock('../authApi', () => ({ ensureFreshAccessToken: vi.fn(async () => 'qa-token') }))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function native() {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
  vi.stubEnv('VITE_GATEWAY_BASE_URL', 'https://erp.coppadresd.com')
}
describe('Community storage on a phone', () => {
  it('uploads a generated card to the gateway, never capacitor://localhost', async () => {
    native(); const send = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', send)
    const file = new File(['png'], 'achievement.png', { type: 'image/png' })
    await uploadCommunityMedia('/storage/community/posts/card.png', file)
    expect(send).toHaveBeenCalledWith('https://erp.coppadresd.com/storage/community/posts/card.png', {
      method: 'PUT', headers: { 'Content-Type': 'image/png', Authorization: 'Bearer qa-token' }, body: file,
    })
  })
  it('preserves signed cloud URLs and does not send the app token to cloud storage', async () => {
    native(); vi.mocked(ensureFreshAccessToken).mockClear()
    const send = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', send)
    const url = 'https://bucket.s3.amazonaws.com/card.png?X-Amz-Signature=qa'
    await uploadCommunityMedia(url, new File(['png'], 'card.png', { type: 'image/png' }))
    expect(send.mock.calls[0][0]).toBe(url)
    expect(send.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    expect(ensureFreshAccessToken).not.toHaveBeenCalled()
  })
  it('resolves nested media without modifying post text or signed query strings', () => {
    native()
    const data = { feed: [{ imageUrl: '/storage/a.png?sig=abc&exp=1', body: '/storage/example', profile: { avatarUrl: '/storage/me.png' } }] }
    const normalized = resolveCommunityMedia(data)
    expect(normalized.feed[0].imageUrl).toBe('https://erp.coppadresd.com/storage/a.png?sig=abc&exp=1')
    expect(normalized.feed[0].profile.avatarUrl).toBe('https://erp.coppadresd.com/storage/me.png')
    expect(normalized.feed[0].body).toBe('/storage/example')
    expect(data.feed[0].imageUrl).toBe('/storage/a.png?sig=abc&exp=1')
  })
  it('keeps Vite proxy paths relative and surfaces rejected uploads', async () => {
    vi.stubEnv('DEV', true); vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    expect(communityMediaUrl('/storage/a.png')).toBe('/storage/a.png')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 413 }))
    await expect(uploadCommunityMedia('/storage/a.png', new File(['png'], 'a.png'))).rejects.toThrow('413')
  })
})
