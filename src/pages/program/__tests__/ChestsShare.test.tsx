import type { ReactNode } from "react";
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, it, expect } from 'vitest';
import { StreakChestsTrail } from '../ChestsPanel';
vi.mock('../../../i18n/I18nContext', () => ({ useI18n: () => ({ lang: 'es', t: (s:string,p?:Record<string,string>) => s.replace('{days}',p?.days ?? '') }) }));
it('shares an earned chest directly and never exposes sharing on a locked chest', () => {
 const share=vi.fn();
 render(<StreakChestsTrail streak={1} chests={[{days:7,xp:100,granted:true},{days:14,xp:200,granted:false}]} onShare={share} />);
 expect(screen.queryByRole('button',{name:'Compartir logro de 14 días'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Compartir logro de 7 días'}));
 expect(share).toHaveBeenCalledWith(7);
});

vi.mock('@ionic/react', async (original) => ({
 ...(await original<typeof import('@ionic/react')>()),
 IonButton: ({children,onClick,disabled,...props}: {children?:ReactNode;onClick?:()=>void;disabled?:boolean;'aria-label'?:string}) => <button disabled={disabled} onClick={onClick} aria-label={props['aria-label']}>{children}</button>,
 IonSpinner: () => <span />,
}));
vi.mock('framer-motion', () => ({ motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> } }));
