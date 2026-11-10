import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createClient, getOperationName, Provider, type Exchange, type OperationResult } from 'urql'
import { filter, make, mergeMap, pipe, takeUntil } from 'wonka'
import { ConversationModal } from '../conversation-modal'
import { I18nProvider, useI18n } from '../../i18n/I18nContext'
import type { ChatGroup, Message, Profile } from '../../graphql/community'

// Igual que los tests de overlays existentes: happy-dom no presenta el shell
// Stencil. Solo adaptamos sus controles; el modal y su lógica son los reales.
vi.mock('@ionic/react', () => ({
  IonModal: ({ children, isOpen }: { children?: ReactNode; isOpen?: boolean }) => isOpen ? <div role="dialog">{children}</div> : null,
  IonButton: ({ children, disabled, onClick, 'aria-label': label }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick} aria-label={label}>{children}</button>,
  IonIcon: () => null,
  IonSkeletonText: () => <span role="status" />,
  IonTextarea: ({ value, onIonInput, placeholder, 'aria-label': label }: {
    value: string; onIonInput: (event: { detail: { value: string } }) => void; placeholder?: string; 'aria-label'?: string
  }) => <textarea value={value} aria-label={label} placeholder={placeholder} onChange={event => onIonInput({ detail: { value: event.target.value } })} />,
  IonAlert: ({ isOpen, header, message, inputs = [], buttons, onDidDismiss }: {
    isOpen?: boolean; header: string; message?: string; inputs?: Array<{ name: string; placeholder: string; value: string }>;
    buttons: Array<string | { text: string; handler?: (values: Record<string, string>) => void }>; onDidDismiss: () => void
  }) => isOpen ? <div role="alertdialog" aria-label={header}>
    <h2>{header}</h2><p>{message}</p>
    {inputs.map(input => <input key={input.name} name={input.name} placeholder={input.placeholder} defaultValue={input.value} />)}
    {buttons.map(button => <button key={typeof button === 'string' ? button : button.text} onClick={event => {
      if (typeof button !== 'string') {
        const values = Object.fromEntries([...event.currentTarget.parentElement!.querySelectorAll('input')].map(input => [input.name, input.value]))
        button.handler?.(values)
      }
      onDidDismiss()
    }}>{typeof button === 'string' ? button : button.text}</button>)}
  </div> : null,
}))

const profile = (id: string, displayName: string): Profile => ({
  id, displayName, isSystem: false, status: 'ACTIVE', bio: null, banReason: null, bannedAt: null,
  avatarUrl: null, coverUrl: null, createdAt: '2026-11-06T12:00:00Z', posts: [], reposts: [],
})
const me = profile('me', 'Mi nombre personal')
// Estos nombres coinciden con claves del catálogo: t(nombre) los corrompería.
const peer = profile('peer', 'Creador')
const creator = profile('creator', 'Miembros')
const member = profile('member', 'Enviar')
const friend = profile('friend', 'Grupo renombrado')
const message = (id: string, body: string, senderProfileId = peer.id): Message => ({
  id, body, senderProfileId, recipientProfileId: me.id, createdAt: `2026-11-06T12:00:0${id === 'first' ? '1' : '2'}Z`,
})
const group: ChatGroup = { id: 'family', name: 'Renombrar grupo', createdByProfileId: creator.id,
  createdAt: '2026-11-06T12:00:00Z', memberCount: 3, lastMessage: null }

/** URQL real; respuestas GraphQL y eventos de suscripción enteramente en memoria. */
function fakeGraphQL(history: Message[] = [], members: Profile[] = []) {
  const subscriptions = new Map<string, (data: Record<string, unknown>) => void>()
  const operations: string[] = []
  const data: Record<string, Record<string, unknown>> = {
    Conversation: { conversation: history }, Group: { group: history }, GroupMembers: { groupMembers: members },
  }
  const exchange: Exchange = () => operations$ => pipe(
    operations$,
    filter(operation => operation.kind !== 'teardown'),
    mergeMap(operation => pipe(make<OperationResult>(observer => {
      const name = getOperationName(operation.query) ?? ''
      operations.push(name)
      if (operation.kind === 'subscription') {
        subscriptions.set(name, result => observer.next({ operation, data: result, stale: false, hasNext: true }))
      } else {
        if (!(name in data)) throw new Error(`Unexpected fixture GraphQL operation: ${name}`)
        observer.next({ operation, data: data[name], stale: false, hasNext: false })
        observer.complete()
      }
      return () => { subscriptions.delete(name) }
    }), takeUntil(pipe(operations$, filter(candidate => candidate.kind === 'teardown' && candidate.key === operation.key))))),
  )
  const client = createClient({ url: 'https://community.test.invalid/graphql', exchanges: [exchange] })
  return { client, operations, emit(name: string, value: Record<string, unknown>) {
    const subscriber = subscriptions.get(name)
    if (!subscriber) throw new Error(`Fixture subscription not mounted: ${name}`)
    subscriber(value)
  } }
}

function LanguageSwitch() {
  const { toggleLang } = useI18n()
  return <button onClick={toggleLang}>Switch language</button>
}
function mountConversation(graph: ReturnType<typeof fakeGraphQL>, props: Partial<ComponentProps<typeof ConversationModal>>) {
  const actions = { onClose: vi.fn(), onToast: vi.fn(), onSend: vi.fn(), onAddMember: vi.fn(),
    onRemoveMember: vi.fn(), onRenameGroup: vi.fn(), onLeaveGroup: vi.fn() }
  const view = render(<Provider value={graph.client}><I18nProvider><LanguageSwitch />
    <ConversationModal open me={me} {...actions} {...props} />
  </I18nProvider></Provider>)
  return { ...view, actions }
}
function switchLanguage() { fireEvent.click(screen.getByRole('button', { name: 'Switch language' })) }
function memberPanel() {
  return screen.getByText('Members').closest('[role="dialog"]') as HTMLElement
}

beforeEach(() => {
  localStorage.setItem('antares_lang', 'en')
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No real network is allowed in the conversation fixture') }))
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(function (this: HTMLElement, options: ScrollToOptions | number) {
    if (typeof options === 'object') this.scrollTop = options.top ?? this.scrollTop
  })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('ConversationModal language interaction', () => {
  it('opens the peer profile from a direct conversation header', async () => {
    const graph = fakeGraphQL()
    const onOpenProfile = vi.fn()
    const { actions } = mountConversation(graph, { peer, onOpenProfile })
    await screen.findByText('No messages yet. Say hello!')
    fireEvent.click(screen.getByRole('button', { name: 'View Creador’s profile' }))
    expect(onOpenProfile).toHaveBeenCalledWith(peer.id)
    expect(actions.onSend).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps a peer draft and original messages through EN/ES changes, and exposes the live unread action in the selected language', async () => {
    const graph = fakeGraphQL()
    const { actions } = mountConversation(graph, { peer })
    await screen.findByText('No messages yet. Say hello!')
    expect(screen.getByText(peer.displayName)).toBeTruthy()
    const draft = screen.getByRole('textbox', { name: 'Type a message…' }) as HTMLTextAreaElement
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(draft, { target: { value: 'Mi borrador personal sin enviar' } })
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false)
    // También es una clave de traducción; el cuerpo del autor debe permanecer intacto.
    const first = message('first', 'Sin mensajes todavía. ¡Saluda!')
    await act(async () => graph.emit('MessageAdded', { messageAdded: first }))
    const body = await screen.findByText(first.body)
    expect(screen.queryByText('No messages yet. Say hello!')).toBeNull()
    const scroller = body.parentElement!.parentElement! as HTMLDivElement
    expect(scroller.style.overflowY).toBe('auto')
    Object.defineProperties(scroller, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 300 } })
    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    const incoming = message('second', 'Mensaje entrante de mi familia')
    await act(async () => graph.emit('MessageAdded', { messageAdded: incoming }))
    expect((await screen.findByRole('button', { name: 'Go to latest message' })).textContent).toBe('1')

    switchLanguage()
    expect(screen.getByRole('button', { name: 'Ir al último mensaje' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje…' })).toBe(draft)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy()
    expect(draft.value).toBe('Mi borrador personal sin enviar')
    expect(screen.getByText(first.body)).toBe(body)
    expect(screen.getByText(peer.displayName)).toBeTruthy()
    switchLanguage()
    expect(screen.getByRole('textbox', { name: 'Type a message…' })).toBe(draft)
    expect(draft.value).toBe('Mi borrador personal sin enviar')
    expect(screen.getByText(incoming.body)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go to latest message' }))
    expect(screen.queryByRole('button', { name: 'Go to latest message' })).toBeNull()
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'smooth' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(actions.onClose).toHaveBeenCalledOnce()
    expect(actions.onSend).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect([...new Set(graph.operations)].sort()).toEqual(['Conversation', 'MessageAdded'])
  })

  it('opens and cancels group member/add/rename/remove/leave overlays without writes or losing the composer during language changes', async () => {
    const originalMessage = message('first', 'Guardar', member.id)
    const graph = fakeGraphQL([originalMessage], [creator, me, member])
    const { actions } = mountConversation(graph, { group, friends: [creator, me, member, friend] })
    await screen.findByText(originalMessage.body)
    const draft = screen.getByRole('textbox', { name: 'Type a message…' }) as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: 'Mi borrador del grupo' } })
    fireEvent.click(screen.getByText('3 members'))
    const panel = memberPanel()
    expect(within(panel).getByText('Creator')).toBeTruthy()
    expect(within(panel).getByText('You')).toBeTruthy()
    expect(within(panel).getByText(member.displayName)).toBeTruthy()
    const incoming = message('second', 'Mensaje del grupo sin traducción', member.id)
    await act(async () => graph.emit('GroupMessageAdded', { groupMessageAdded: incoming }))
    expect(screen.getByText(incoming.body)).toBeTruthy()

    fireEvent.click(within(panel).getByText(member.displayName))
    let alert = screen.getByRole('alertdialog', { name: 'Remove member' })
    expect(within(alert).getByText(`Remove ${member.displayName} from the group?`)).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(within(panel).getByRole('button', { name: 'Rename group' }))
    alert = screen.getByRole('alertdialog', { name: 'Rename group' })
    expect((within(alert).getByPlaceholderText('Group name') as HTMLInputElement).value).toBe(group.name)
    switchLanguage()
    alert = screen.getByRole('alertdialog', { name: 'Renombrar grupo' })
    expect((within(alert).getByPlaceholderText('Nombre del grupo') as HTMLInputElement).value).toBe(group.name)
    expect(screen.getByRole('textbox', { name: 'Escribe un mensaje…' })).toBe(draft)
    expect(draft.value).toBe('Mi borrador del grupo')
    expect(within(panel).getByText('Tú')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    switchLanguage()

    fireEvent.click(within(panel).getByRole('button', { name: 'Leave group' }))
    alert = screen.getByRole('alertdialog', { name: 'Leave group' })
    expect(within(alert).getByText('Are you sure you want to leave this group?')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(within(panel).getByRole('button', { name: 'Add member' }))
    const addPanel = screen.getByText(friend.displayName).closest('[role="dialog"]') as HTMLElement
    expect(within(addPanel).getByText(friend.displayName)).toBeTruthy()
    expect(within(addPanel).getByText('Add')).toBeTruthy()
    expect(within(addPanel).queryByText(member.displayName)).toBeNull()
    fireEvent.click(within(addPanel).getByRole('button', { name: 'Close' }))
    expect(screen.queryByText(friend.displayName)).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText(group.name)).toBeTruthy()
    expect(screen.getByText(originalMessage.body)).toBeTruthy()
    expect(screen.getByText(incoming.body)).toBeTruthy()
    expect(screen.getByText(member.displayName)).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Type a message…' })).toBe(draft)
    expect(draft.value).toBe('Mi borrador del grupo')
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect([...new Set(graph.operations)].sort()).toEqual(['Group', 'GroupMembers', 'GroupMessageAdded'])
  })

  it('keeps an add-member selector empty when every friend is already a member, including after switching language', async () => {
    const graph = fakeGraphQL([], [me])
    const { actions } = mountConversation(graph, { group: { ...group, memberCount: 1, createdByProfileId: me.id }, friends: [me] })
    await screen.findByText('No messages yet. Say hello!')
    fireEvent.click(screen.getByText('1 member'))
    const panel = memberPanel()
    fireEvent.click(within(panel).getByRole('button', { name: 'Add member' }))
    const empty = screen.getByText('All your friends are already in the group.')
    const selector = empty.closest('[role="dialog"]') as HTMLElement
    expect(within(selector).queryByText(me.displayName)).toBeNull()
    switchLanguage()
    expect(within(selector).getByText('Todos tus amigos ya están en el grupo.')).toBeTruthy()
    fireEvent.click(within(selector).getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
