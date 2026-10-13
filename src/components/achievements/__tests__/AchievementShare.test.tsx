import {vi,it,expect,beforeEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
const mocks=vi.hoisted(()=>({upload:vi.fn(),post:vi.fn(),render:vi.fn(),share:vi.fn(),download:vi.fn(),toast:vi.fn()}));
vi.mock('../../../hooks/useCommunity',()=>({useCommunity:()=>({uploadPostImage:mocks.upload,createPost:mocks.post})}));
vi.mock('../../../context/AppContext',()=>({useApp:()=>({showToast:mocks.toast})}));
vi.mock('../../../services/achievements/share-card',()=>({renderAchievementCard:mocks.render,shareAchievementFile:mocks.share,downloadAchievement:mocks.download}));
vi.mock('@ionic/react',()=>({
 IonButton:({children,onClick,disabled}:{children:ReactNode;onClick:()=>void;disabled?:boolean})=><button disabled={disabled} onClick={onClick}>{children}</button>,
 IonSegment:({children}:{children:ReactNode})=><div>{children}</div>,IonSegmentButton:({children}:{children:ReactNode})=><div>{children}</div>,IonIcon:()=>null,IonSpinner:()=>null,IonTextarea:()=>null,
}));
import {AchievementShare} from '../AchievementShare';
import {I18nProvider} from '../../../i18n/I18nContext';
const achievement={id:'verified',kind:'streak' as const,value:7,earnedAt:'2026-10-13T12:00:00Z',readAt:null};
beforeEach(()=>{mocks.upload.mockReset();mocks.post.mockReset();mocks.render.mockResolvedValue(new Blob(['png'],{type:'image/png'}));vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:share');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});});
function show(){render(<I18nProvider><AchievementShare achievement={achievement} onBack={()=>{}}/></I18nProvider>);}
it('uploads and publishes only after explicit tap and prevents double posting',async()=>{
 mocks.upload.mockResolvedValue('image-key');mocks.post.mockResolvedValue({id:'post'});show();
 await waitFor(()=>expect(screen.getByRole('img')).toBeTruthy());expect(mocks.upload).not.toHaveBeenCalled();
 const button=screen.getByText('Publicar en Comunidad');fireEvent.click(button);fireEvent.click(button);
 await waitFor(()=>expect(screen.getByText('Publicado en Comunidad')).toBeTruthy());
 expect(mocks.upload).toHaveBeenCalledTimes(1);expect(mocks.post).toHaveBeenCalledTimes(1);
 expect(mocks.post.mock.calls[0][0]).toContain('7 días de constancia');expect(mocks.post.mock.calls[0][1]).toBe('image-key');
});
it('never creates a post when upload fails',async()=>{
 mocks.upload.mockRejectedValue(new Error('upload failed'));show();await waitFor(()=>expect(screen.getByRole('img')).toBeTruthy());
 fireEvent.click(screen.getByText('Publicar en Comunidad'));
 await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());expect(mocks.post).not.toHaveBeenCalled();
});
it('blocks immediate retry when a post response is ambiguous',async()=>{
 mocks.upload.mockResolvedValue('key');mocks.post.mockRejectedValue(new Error('timeout'));show();await waitFor(()=>expect(screen.getByRole('img')).toBeTruthy());
 fireEvent.click(screen.getByText('Publicar en Comunidad'));
 await waitFor(()=>expect(screen.getByText(/Revisa Comunidad antes/)).toBeTruthy());expect((screen.getByText('Publicar en Comunidad') as HTMLButtonElement).disabled).toBe(true);
});
it('downloads the PNG if browser file sharing is unsupported',async()=>{
 mocks.share.mockResolvedValue('unsupported');show();await waitFor(()=>expect(screen.getByRole('img')).toBeTruthy());
 fireEvent.click(screen.getByText('Compartir en otras apps'));
 await waitFor(()=>expect(mocks.download).toHaveBeenCalledTimes(1));expect(mocks.post).not.toHaveBeenCalled();
});
