import {it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({permission:vi.fn(),request:vi.fn(),schedule:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{checkPermissions:mocks.permission,requestPermissions:mocks.request,schedule:mocks.schedule}}));
import{notifyAchievement,enableAchievementNotifications}from'../native-notifications';
it('never requests permission automatically and does not schedule when denied',async()=>{
 mocks.permission.mockResolvedValue({display:'denied'});await notifyAchievement('title','body',()=>true);
 expect(mocks.request).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();
});
it('rejects stale account work after asynchronous permission check',async()=>{
 mocks.permission.mockResolvedValue({display:'granted'});await notifyAchievement('title','body',()=>false);
 expect(mocks.schedule).not.toHaveBeenCalled();
});
it('schedules confirmed current-account achievements and exposes opt-in separately',async()=>{
 mocks.permission.mockResolvedValue({display:'granted'});await notifyAchievement('title','body',()=>true);
 expect(mocks.schedule).toHaveBeenCalledWith({notifications:[expect.objectContaining({title:'title',body:'body'})]});
 mocks.request.mockResolvedValue({display:'granted'});expect(await enableAchievementNotifications()).toBe(true);
});
