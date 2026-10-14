import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PollBlock } from '../PollBlock'
vi.mock('../../../i18n/I18nContext', () => ({useI18n: () => ({t: (key:string, vars?: {text:string}) => vars ? key.replace('{text}',vars.text) : key})}))
it('keeps author-defined option order even if the API returns a shuffled collection', () => {
  const options = [{id:'b',text:'B',position:1,votes:[]},{id:'a',text:'A',position:0,votes:[]}]
  render(<PollBlock poll={{id:'poll',options}} myId="patient" onVote={async()=>{}} />)
  expect(screen.getAllByRole('button').map(button=>button.textContent)).toEqual(['A','B'])
  expect(options.map(option=>option.id)).toEqual(['b','a'])
})
