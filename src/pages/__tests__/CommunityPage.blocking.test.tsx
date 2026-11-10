import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { createClient, getOperationName, Provider, type Exchange, type Operation, type OperationResult } from 'urql'
import { filter, make, mergeMap, pipe, takeUntil } from 'wonka'
import { CommunityPage } from '../CommunityPage'
import { I18nProvider } from '../../i18n/I18nContext'
import { useCommunity } from '../../hooks/useCommunity'
import type { BlockedProfile, ChatGroup, Message, Post, Profile } from '../../graphql/community'

const app = vi.hoisted(() => ({ showToast: vi.fn(), navigate: vi.fn() }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ ...app, pointsTotal: 0, user: { id: 'me', cedula: 'me' } }) }))
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, disabled, onClick, 'aria-label': label }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick} aria-label={label}>{children}</button>,
  IonIcon: () => null, IonBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonSkeletonText: () => <span role="status" />, IonSpinner: () => <span role="status" />,
  IonList: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  IonItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
  IonLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  IonSearchbar: () => null,
  IonAlert: ({ isOpen, header, message, buttons, onDidDismiss }: {
    isOpen: boolean; header: string; message: string;
    buttons: Array<string | { text: string; handler?: () => void }>; onDidDismiss: () => void
  }) => isOpen ? <div role="alertdialog" aria-label={header}><p>{message}</p>
    {buttons.map(button => <button key={typeof button === 'string' ? button : button.text} onClick={() => {
      if (typeof button !== 'string') button.handler?.()
      onDidDismiss()
    }}>{typeof button === 'string' ? button : button.text}</button>)}
  </div> : null,
}))
vi.mock('../../components/Screen', () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Scroll: ({ children, ref }: { children: ReactNode; ref: React.Ref<HTMLDivElement> }) => <div ref={ref}>{children}</div>,
}))
vi.mock('../../services/clubs-api', () => ({ fetchPublicClubPosts: vi.fn().mockResolvedValue([]) }))
vi.mock('../../components/community/ClubsSection', () => ({ ClubsSection: () => null, toFeedPost: (post: Post) => post }))
vi.mock('../../components/community/CommunityProfile', () => ({
  CommunityProfile: () => null, VIEW_TABS: [], formatCount: String,
}))
vi.mock('../../components/community/ProfileTimeline', () => ({ ProfileTimeline: () => null }))
vi.mock('../../components/community/CommunityVideo', () => ({ CommunityVideo: () => null }))
vi.mock('../../components/community/ComposePostModal', () => ({ ComposePostModal: () => null }))
vi.mock('../../components/community/CreateGroupModal', () => ({ CreateGroupModal: () => null }))
vi.mock('../../components/community/CommunityFab', () => ({ CommunityFab: () => null }))
vi.mock('../../components/community/ComSidebar', () => ({ ComSidebar: () => null }))
vi.mock('../../components/community/NewChatModal', () => ({ NewChatModal: () => null }))
vi.mock('../../components/community/MediaLightbox', () => ({ MediaLightbox: () => null }))
vi.mock('../../components/community/PostDetailModal', () => ({ PostDetailModal: () => null }))
vi.mock('../../components/conversation-modal', () => ({ ConversationModal: () => null }))
vi.mock('../../components/community/PostCard', () => ({ PostCard: ({ view, onOpenProfile }: {
  view: { post: Post }; onOpenProfile: (id: string) => void
}) => <article>{view.post.body}<button onClick={() => onOpenProfile(view.post.profile.id)}>Open {view.post.profile.displayName}</button></article> }))

function profile(id: string, displayName: string): Profile {
  return { id, displayName, bio: null, status: 'ACTIVE', banReason: null, bannedAt: null,
    avatarUrl: null, coverUrl: null, createdAt: '2026-11-10T12:00:00Z', posts: [], reposts: [] }
}
const peer = profile('peer', 'Miembros')
const other = profile('other', 'Otra persona')
const peerPost: Post = { id: 'peer-post', body: 'Contenido del miembro', pinned: false, imageUrl: null, mediaType: null,
  poll: null, createdAt: '2026-11-10T12:00:00Z', profile: peer, likes: [], reposts: [], comments: [] }
const myPost: Post = { ...peerPost, id: 'mine', body: 'Mi publicación', profile: { id: 'me', displayName: 'Yo' },
  comments: [{ id: 'comment', postId: 'mine', parentCommentId: null, body: 'Comentario del miembro',
    createdAt: peerPost.createdAt, profile: peer, likes: [], replies: [] }] }
const me = { ...profile('me', 'Yo'), posts: [myPost], reposts: [{ id: 'repost', postId: peerPost.id,
  profileId: 'me', createdAt: peerPost.createdAt, post: peerPost }] }
const lastMessage: Message = { id: 'msg', senderProfileId: peer.id, recipientProfileId: me.id,
  body: 'Mensaje del miembro', createdAt: peerPost.createdAt }
const group: ChatGroup = { id: 'group', name: 'Grupo', createdByProfileId: me.id,
  createdAt: peerPost.createdAt, memberCount: 3, lastMessage }

/** Servidor GraphQL en memoria; puede retener las consultas posteriores para probar caché obsoleta. */
function fakeGraphQL(initialBlocked = false) {
  let blocked = initialBlocked
  let relationshipsRemoved = initialBlocked
  const operations: Operation[] = []
  const pending: (() => void)[] = []
  const controls = { holdQueries: false, failBlock: false, failUnblock: false, blockedRows: null as BlockedProfile[] | null }
  const exchange: Exchange = () => operations$ => pipe(operations$,
    filter(operation => operation.kind !== 'teardown'),
    mergeMap(operation => pipe(make<OperationResult>(observer => {
      operations.push(operation)
      const name = getOperationName(operation.query) ?? ''
      if (operation.kind === 'subscription') return () => {}
      function respond() {
        let data: Record<string, unknown>
        if (name === 'BlockUser') {
          if (!controls.failBlock) { blocked = true; relationshipsRemoved = true }
          data = { blockUser: !controls.failBlock }
        } else if (name === 'UnblockUser') {
          if (!controls.failUnblock) blocked = false
          data = { unblockUser: !controls.failUnblock }
        } else {
          const people = blocked ? [] : [{ profile: peer, isFollowing: !relationshipsRemoved, isFollower: !relationshipsRemoved, isFriend: !relationshipsRemoved }]
          const rows: Record<string, Record<string, unknown>> = {
            Me: { me: { ...me, reposts: blocked ? [] : me.reposts,
              posts: blocked ? [{ ...myPost, comments: [] }] : me.posts } },
            Feed: { feed: blocked ? [myPost] : [peerPost, myPost] },
            FollowingFeed: { followingFeed: relationshipsRemoved ? [] : [peerPost] },
            Friends: { friends: relationshipsRemoved ? [] : [peer] },
            Following: { following: relationshipsRemoved ? [] : [peer] },
            Followers: { followers: relationshipsRemoved ? [] : [peer] },
            People: { people }, Conversations: { conversations: blocked ? [] : [{ peer, lastMessage }] },
            Groups: { groups: [{ ...group, lastMessage: blocked ? null : lastMessage }] },
            BlockedProfiles: { blockedProfiles: controls.blockedRows
              ? controls.blockedRows.slice(Number(operation.variables?.skip), Number(operation.variables?.skip) + Number(operation.variables?.take))
              : blocked ? [{ profileId: peer.id, displayName: peer.displayName, avatarUrl: null, createdAt: peerPost.createdAt }] : [] },
            Profile: { profile: blocked ? null : { ...peer, posts: [peerPost] } },
            ProfileFollowers: { profileFollowers: blocked ? [] : [me] },
            ProfileFollowing: { profileFollowing: blocked ? [] : [other] },
          }
          if (!(name in rows)) throw new Error(`Unexpected fixture operation: ${name}`)
          data = rows[name]
        }
        observer.next({ operation, data, stale: false, hasNext: false })
        observer.complete()
      }
      if (controls.holdQueries && operation.kind === 'query') pending.push(respond)
      else respond()
      return () => {}
    }), takeUntil(pipe(operations$, filter(candidate => candidate.kind === 'teardown' && candidate.key === operation.key))))),
  )
  const client = createClient({ url: 'https://community.test.invalid/graphql', exchanges: [exchange] })
  return { client, operations, controls, flush() { controls.holdQueries = false; pending.splice(0).forEach(respond => respond()) } }
}
function mountPage(graph: ReturnType<typeof fakeGraphQL>) {
  return render(<Provider value={graph.client}><I18nProvider><CommunityPage /></I18nProvider></Provider>)
}
beforeEach(() => {
  localStorage.setItem('antares_lang', 'en')
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden in blocking tests') }))
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('community blocking', () => {
  it('loads blocked users beyond the server cap using bounded offsets and deduplicates overlapping pages', async () => {
    const graph = fakeGraphQL()
    const rows = Array.from({ length: 120 }, (_, index) => ({ profileId: `blocked-${index}`,
      displayName: `Persona ${index}`, avatarUrl: null, createdAt: peerPost.createdAt }))
    // Un cambio concurrente puede desplazar una fila a la página siguiente.
    graph.controls.blockedRows = [...rows.slice(0, 50), rows[0], ...rows.slice(50)]
    const { result } = renderHook(() => useCommunity(), { wrapper: ({ children }) => <Provider value={graph.client}>{children}</Provider> })
    await waitFor(() => expect(result.current.blockedProfiles).toHaveLength(50))
    expect(result.current.blockedProfilesHasMore).toBe(true)
    await act(async () => { await result.current.loadMoreBlockedProfiles() })
    expect(result.current.blockedProfiles).toHaveLength(99)
    expect(result.current.blockedProfilesHasMore).toBe(true)
    await act(async () => { await result.current.loadMoreBlockedProfiles() })
    expect(result.current.blockedProfiles).toHaveLength(120)
    expect(result.current.blockedProfilesHasMore).toBe(false)
    const pageRequests = graph.operations.filter(operation => getOperationName(operation.query) === 'BlockedProfiles')
    expect(pageRequests.every(operation => operation.variables?.take === 50)).toBe(true)
    expect(pageRequests.filter(operation => operation.variables?.skip !== 0).map(operation => operation.variables?.skip))
      .toEqual([50, 99])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires confirmation, cancels without a write, and keeps the member visible when blocking fails', async () => {
    const graph = fakeGraphQL()
    graph.controls.failBlock = true
    mountPage(graph)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Miembros' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Block user' }))
    let confirm = screen.getByRole('alertdialog', { name: 'Block user' })
    expect(confirm.textContent).toContain('Block Miembros?')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(graph.operations.filter(operation => operation.kind === 'mutation')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Block user' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Block user' }))
    confirm = screen.getByRole('alertdialog', { name: 'Block user' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Block' }))
    expect(await screen.findByRole('alertdialog', { name: 'Could not block this user.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Block user' })).toBeTruthy()
    expect(app.showToast).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('closes the member view after a confirmed block and exposes unblock from the community feed', async () => {
    const graph = fakeGraphQL()
    mountPage(graph)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Miembros' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Block user' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Block' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Block user' })).toBeNull())
    expect(screen.queryByText(peerPost.body)).toBeNull()
    expect(app.showToast).toHaveBeenCalledWith('User blocked.', 'ok')
    fireEvent.click(screen.getByRole('button', { name: 'Blocked users' }))
    const unblock = await screen.findByRole('button', { name: 'Unblock Miembros' })
    expect(screen.getByText('You can unblock these people at any time. Unblocking does not restore following relationships between you.')).toBeTruthy()
    fireEvent.click(unblock)
    expect(await screen.findByText('You have no blocked users.')).toBeTruthy()
    expect(app.showToast).toHaveBeenCalledWith('User unblocked. Following relationships have not been restored.', 'ok')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps an outgoing block in the management list when unblock fails', async () => {
    localStorage.setItem('antares_lang', 'es')
    const graph = fakeGraphQL(true)
    graph.controls.failUnblock = true
    mountPage(graph)
    fireEvent.click(await screen.findByRole('button', { name: 'Usuarios bloqueados' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Desbloquear a Miembros' }))
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo desbloquear al usuario.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desbloquear a Miembros' })).toBeTruthy()
    expect(app.showToast).not.toHaveBeenCalled()
  })

  it('masks stale rows immediately, refreshes every affected query network-only, and never restores old follows on unblock', async () => {
    const graph = fakeGraphQL()
    const { result } = renderHook(() => useCommunity(), { wrapper: ({ children }) => <Provider value={graph.client}>{children}</Provider> })
    await waitFor(() => expect(result.current.friends).toHaveLength(1))
    await act(async () => { result.current.setDiscoverPeople(true) })
    await waitFor(() => expect(result.current.people).toHaveLength(1))
    graph.operations.splice(0)
    graph.controls.holdQueries = true
    await act(async () => { await result.current.blockUser(peer.id) })
    expect(result.current.feed.map(view => view.post.id)).toEqual(['mine'])
    expect(result.current.feed[0].post.comments).toEqual([])
    expect(result.current.meTimelinePosts.map(post => post.id)).toEqual(['mine'])
    expect(result.current.friends).toEqual([])
    expect(result.current.peopleFollowing).toEqual([])
    expect(result.current.followers).toEqual([])
    expect(result.current.people).toEqual([])
    expect(result.current.conversations).toEqual([])
    expect(result.current.groups[0].lastMessage).toBeNull()
    const names = ['Feed', 'FollowingFeed', 'Me', 'Friends', 'Following', 'Followers', 'People', 'Conversations', 'Groups', 'BlockedProfiles']
    await waitFor(() => {
      for (const name of names) expect(graph.operations.some(operation => getOperationName(operation.query) === name && operation.context.requestPolicy === 'network-only')).toBe(true)
    })
    // Las listas anteriores siguen retenidas: desbloquear no puede revivir esos follows.
    await act(async () => { await result.current.unblockUser(peer.id) })
    expect(result.current.friends).toEqual([])
    expect(result.current.peopleFollowing).toEqual([])
    expect(result.current.followers).toEqual([])
    expect(result.current.people[0].isFollowing).toBe(false)
    expect(result.current.people[0].isFriend).toBe(false)
    await act(async () => { graph.flush() })
    expect(result.current.friends).toEqual([])
    expect(result.current.blockedProfiles).toEqual([])
    expect(result.current.communityRevision).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })
})
