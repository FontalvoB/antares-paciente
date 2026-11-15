import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NutritionDisclaimer } from '../NutritionDisclaimer';

const state = vi.hoisted(() => ({ token: '' }));
vi.mock('../../../utils/authApi', () => ({getAccessToken: () => state.token}));
vi.mock('../../../i18n/I18nContext', () => ({useT: () => (key:string) => key}));
vi.mock('@ionic/react', () => ({
  IonIcon: () => null,
  IonContent: ({children}:{children:ReactNode}) => <div>{children}</div>,
  IonButton: ({children,onClick,'aria-label':label}:{children:ReactNode;onClick:()=>void;'aria-label'?:string}) => <button onClick={onClick} aria-label={label}>{children}</button>,
  IonModal: ({children,isOpen}:{children:ReactNode;isOpen:boolean}) => isOpen ? <div role="dialog">{children}</div> : null,
}));
const account = (id:string) => { state.token = `${btoa('{}')}.${btoa(JSON.stringify({sub:id}))}.fixture`; };

describe('Aviso nutricional premium', () => {
  beforeEach(() => { localStorage.clear(); account('patient-a'); });
  it('se muestra una vez por cuenta y permite releerlo sin perder el contenido legal', () => {
    const view = render(<NutritionDisclaimer/>);
    expect(screen.getByRole('dialog').textContent).toContain('no es consejo médico, diagnóstico ni tratamiento');
    fireEvent.click(screen.getByText('Entendido'));
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
    const next = render(<NutritionDisclaimer/>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Leer aviso'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
    account('patient-b');
    next.rerender(<NutritionDisclaimer/>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(localStorage.getItem('antares:nutrition-notice:v1:patient-b')).toBeNull();
  });
});
