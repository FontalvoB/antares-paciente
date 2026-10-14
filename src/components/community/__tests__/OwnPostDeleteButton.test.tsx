import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OwnPostDeleteButton } from '../OwnPostDeleteButton'
vi.mock('../../../i18n/I18nContext',()=>({useI18n:()=>({t:(key:string)=>key})}))
vi.mock('@ionic/react',()=>({
  IonIcon:()=>null,
  IonButton:({children,onClick,disabled,'aria-label':label}:{children:ReactNode;onClick:()=>void;disabled:boolean;'aria-label':string})=><button onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
  IonActionSheet:({isOpen,buttons}:{isOpen:boolean;buttons:{text:string;handler?:()=>void}[]})=>isOpen?<div>{buttons.map(button=><button key={button.text} onClick={button.handler}>{button.text}</button>)}</div>:null,
  IonAlert:({isOpen,buttons}:{isOpen:boolean;buttons:{text:string;handler?:()=>void}[]})=>isOpen?<div role="alertdialog">{buttons.map(button=><button key={button.text} onClick={button.handler}>{button.text}</button>)}</div>:null,
}))
it('does not expose deletion for another author',()=>{
  render(<OwnPostDeleteButton postId="post" authorId="other" myId="me" onDelete={vi.fn()} onToast={vi.fn()} />)
  expect(screen.queryByLabelText('Eliminar mi publicación')).toBeNull()
})
it('requires confirmation before deleting the owned post',async()=>{
  const remove=vi.fn().mockResolvedValue(undefined);const onDeleted=vi.fn()
  render(<OwnPostDeleteButton postId="post" authorId="me" myId="me" onDelete={remove} onDeleted={onDeleted} onToast={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('Opciones de publicación'))
  fireEvent.click(screen.getByText('Eliminar mi publicación'))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Eliminar'))
  await waitFor(()=>expect(remove).toHaveBeenCalledWith('post'))
  await waitFor(()=>expect(onDeleted).toHaveBeenCalledOnce())
})
