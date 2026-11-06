import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { I18nProvider, useI18n } from '../../i18n/I18nContext'
import { requestLanguage } from '../../utils/requestLanguage'
import { LanguageQuerySync } from '../LanguageQuerySync'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const clients: QueryClient[] = []
beforeEach(() => localStorage.setItem('antares_lang', 'es'))
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear(); localStorage.clear() })
function setup() {
  const reads: Array<{ language: string; response: ReturnType<typeof deferred<string>> }> = []
  const save = deferred<string>()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  client.setQueryData(['inactive'], 'cached Spanish content')
  let mounts = 0
  function FormAndQuery() {
    const { setLang } = useI18n()
    const [draft, setDraft] = useState('original')
    useEffect(() => { mounts += 1 }, [])
    const read = useQuery({ queryKey: ['translated'], queryFn: () => {
      // Ignora AbortSignal deliberadamente: una promesa anterior tampoco debe reescribir la cache.
      const response = deferred<string>()
      reads.push({ language: requestLanguage(), response })
      return response.promise
    } })
    const mutation = useMutation({ mutationKey: ['save'], mutationFn: () => save.promise })
    return <><button onClick={() => setLang('en')}>English</button><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /><button onClick={() => mutation.mutate()}>Save draft</button><output data-testid="content">{read.data ?? 'loading'}</output><output data-testid="mutation">{mutation.status}</output></>
  }
  render(<QueryClientProvider client={client}><I18nProvider><LanguageQuerySync /><FormAndQuery /></I18nProvider></QueryClientProvider>)
  return { reads, save, client, mounts: () => mounts }
}
describe('cambio de idioma y cache activa', () => {
  it('renueva lecturas anteriores y vacía cache inactiva sin desmontar formularios ni cancelar mutaciones', async () => {
    const state = setup()
    await waitFor(() => expect(state.reads).toHaveLength(1))
    await act(async () => state.reads[0].response.resolve('contenido ES'))
    await screen.findByText('contenido ES')
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'My unsaved text' } })
    fireEvent.click(screen.getByText('Save draft'))
    await waitFor(() => expect(screen.getByTestId('mutation').textContent).toBe('pending'))
    const pendingMutation = state.client.getMutationCache().getAll()[0]
    fireEvent.click(screen.getByText('English'))
    await waitFor(() => expect(state.reads).toHaveLength(2))
    expect(state.reads[1].language).toBe('en')
    expect(state.client.getQueryData(['inactive'])).toBeUndefined()
    expect(state.client.getQueryData(['translated'])).toBe('contenido ES')
    expect(screen.getByTestId('content').textContent).toBe('contenido ES')
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('My unsaved text')
    expect(state.mounts()).toBe(1)
    expect(state.client.getMutationCache().getAll()[0]).toBe(pendingMutation)
    expect(pendingMutation.state.status).toBe('pending')
    await act(async () => { state.reads[1].response.resolve('English content'); state.save.resolve('saved') })
    await screen.findByText('English content')
    await waitFor(() => expect(screen.getByTestId('mutation').textContent).toBe('success'))
  })
  it('una respuesta ES en vuelo no puede sobrescribir la lectura EN que ya terminó', async () => {
    const state = setup()
    await waitFor(() => expect(state.reads).toHaveLength(1))
    expect(state.reads[0].language).toBe('es')
    fireEvent.click(screen.getByText('English'))
    await waitFor(() => expect(state.reads).toHaveLength(2))
    await act(async () => state.reads[1].response.resolve('English content'))
    await screen.findByText('English content')
    await act(async () => state.reads[0].response.resolve('late Spanish content'))
    expect(state.client.getQueryData(['translated'])).toBe('English content')
    expect(screen.getByTestId('content').textContent).toBe('English content')
    expect(state.reads.map(read => read.language)).toEqual(['es', 'en'])
  })
})
