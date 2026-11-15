import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {ReactNode,ButtonHTMLAttributes} from 'react';
import {I18nProvider} from '../../../i18n/I18nContext';
import {ComposePostModal} from '../ComposePostModal';

vi.mock('@ionic/react',()=>({
  IonButton:({children,onClick,disabled}:ButtonHTMLAttributes<HTMLButtonElement>)=><button disabled={disabled} onClick={onClick}>{children}</button>,
  IonIcon:()=>null,
  IonInput:()=>null,
  IonModal:({children,isOpen}:{children:ReactNode;isOpen:boolean})=>isOpen?<div role="dialog">{children}</div>:null,
}));
afterEach(()=>{cleanup();vi.restoreAllMocks()});
describe('Borrador de hábito con foto',()=>{
  it('prepara texto e imagen sin subir ni publicar hasta una acción explícita',()=>{
    vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:qa-habit');
    vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
    const file=new File(['photo'],'habit.jpg',{type:'image/jpeg'}),onQueue=vi.fn(),onUploadMedia=vi.fn(),onPublish=vi.fn();
    render(<I18nProvider><ComposePostModal open onClose={()=>{}} me={null} initialDraft="Un paso más" initialMedia={file} onQueue={onQueue} onUploadMedia={onUploadMedia} onPublish={onPublish} onPublishPoll={vi.fn()} onToast={vi.fn()}/></I18nProvider>);
    expect(screen.getByDisplayValue('Un paso más')).toBeTruthy();
    expect(screen.getByRole('img',{name:'Adjunto'}).getAttribute('src')).toBe('blob:qa-habit');
    expect(onUploadMedia).not.toHaveBeenCalled();expect(onPublish).not.toHaveBeenCalled();expect(onQueue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Publicar'}));
    expect(onQueue).toHaveBeenCalledWith({body:'Un paso más',file,options:undefined});
    expect(onUploadMedia).not.toHaveBeenCalled();
  });
});
