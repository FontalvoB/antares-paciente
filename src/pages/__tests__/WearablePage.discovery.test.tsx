import type { ReactNode } from 'react';
import type { WearableErrorCode } from '../../devices/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setupIonicReact } from '@ionic/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  t: (key: string) => key,
  app: { wearableConnected: false, wearableName: 'H59_E206', showToast: vi.fn() },
  state: {
    phase: 'idle', sessionStale: false, hasScanned: false,
    devices: [
      { deviceId: 'band', name: 'H59_E206', kind: 'colmi' },
      { deviceId: 'ring', name: 'R88 C1BF', kind: 'ycbt' },
      { deviceId: 'tv', name: 'Living Room TV', kind: 'unknown' },
    ],
    info: {}, samples: {}, today: { steps: null, sleepMinutes: null }, error: null as WearableErrorCode | null,
    diagnostics: false, accessoryDiscoverySupported: true, addingAccessory: false,
    gatt: [], log: [], measureKinds: [], syncing: false, syncStage: null,
    lastSyncAt: null, savedDevice: null,
    connect: vi.fn(), scan: vi.fn(), refreshInfo: vi.fn(), syncHistory: vi.fn(), cancelSync: vi.fn(),
    setDiagnostics: vi.fn(), measurePolicy: vi.fn(),
  },
}));
vi.mock('../../context/WearableContext', () => ({ useWearable: () => fixture.state }));
// Stencil presenta los overlays fuera del DOM de happy-dom; verificamos su
// contrato de apertura/cierre conservando los demás componentes Ionic reales.
vi.mock('@ionic/react', async (importOriginal) => ({
  ...await importOriginal<typeof import('@ionic/react')>(),
  IonAlert: ({ isOpen, header, message, buttons = [], onDidDismiss }: {
    isOpen: boolean; header?: string; message?: string;
    buttons?: Array<string | { text: string; handler?: () => void }>;
    onDidDismiss?: () => void;
  }) => isOpen ? <div role="alertdialog" aria-label={header}>
    <h2>{header}</h2><p>{message}</p>
    {buttons.map(button => <button key={typeof button === 'string' ? button : button.text}
      onClick={() => { if (typeof button !== 'string') button.handler?.(); onDidDismiss?.(); }}>
      {typeof button === 'string' ? button : button.text}
    </button>)}
  </div> : null,
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => fixture.app }));
vi.mock('../../i18n/I18nContext', () => ({ useI18n: () => ({ t: fixture.t, lang: 'es' }) }));
vi.mock('../../components/icons3d', () => ({ WatchIcon3D: () => null }));
vi.mock('../../components/MeasureFocusOverlay', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../components/MeasureFocusOverlay')>(),
  MeasureSyncOverlay: ({ isOpen, onCancel }: { isOpen: boolean; onCancel: () => void }) => isOpen
    ? <div data-testid="history-progress"><button onClick={onCancel}>cancel history</button></div> : null,
}));
vi.mock('../../components/Screen', () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scroll: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
import { WearablePage } from '../WearablePage';
setupIonicReact({ mode: 'ios' });

describe('WearablePage — compatibilidad y alta', () => {
  beforeEach(() => {
    vi.clearAllMocks(); fixture.app.wearableConnected = false; fixture.state.sessionStale = false;
    fixture.state.syncing = false; fixture.state.diagnostics = false; fixture.state.error = null; fixture.state.phase = 'idle';
    fixture.state.syncHistory.mockReset(); fixture.state.cancelSync.mockReset();
  });
  afterEach(cleanup);

  it('muestra los modelos compatibles y ofrece el selector iOS', () => {
    render(<WearablePage />);
    expect(screen.getByText('Banda H59 · Anillo R88')).toBeTruthy();
    expect(screen.getAllByLabelText('Compatible').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('R88 C1BF')).toBeTruthy();
    expect(screen.getByText('Living Room TV')).toBeTruthy();
    fireEvent.click(screen.getByText('Living Room TV'));
    expect(fixture.state.connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Buscar dispositivo'));
    expect(fixture.state.scan).toHaveBeenCalledOnce();
    expect(screen.queryByText('Agregar wearable')).toBeNull();
    expect(screen.queryByText('Actualizar dispositivos autorizados')).toBeNull();
    fireEvent.click(screen.getByText('H59_E206'));
    expect(fixture.state.connect).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'band' }));
  });

  it('en diagnóstico muestra el TV como no compatible y nunca permite conectar', () => {
    fixture.state.diagnostics = true;
    render(<WearablePage />);
    const tv = screen.getByText('Living Room TV');
    expect(screen.getByText('Dispositivo no compatible')).toBeTruthy();
    fireEvent.click(tv);
    expect(fixture.state.connect).not.toHaveBeenCalled();
  });

  it('un manager no listo no dice que el Bluetooth del teléfono esté apagado', () => {
    fixture.state.phase = 'error';
    fixture.state.error = 'bluetooth-not-ready';
    render(<WearablePage />);
    expect(screen.queryByText('Bluetooth está apagado. Actívalo para buscar tu dispositivo.')).toBeNull();
    expect(screen.getByText('No se pudo conectar. Inténtalo de nuevo.')).toBeTruthy();
    expect(screen.getByText('Buscar dispositivo')).toBeTruthy();
  });

  it('apagado conserva el hero y abre un popup para encender Bluetooth', () => {
    fixture.state.error = 'bluetooth-off';
    fixture.state.phase = 'scanning';
    render(<WearablePage />);
    expect(screen.getByText('Conecta tu wearable')).toBeTruthy();
    expect(screen.getByText('Bluetooth apagado')).toBeTruthy();
    expect(screen.getByRole('alertdialog', { name: 'Activa Bluetooth' })).toBeTruthy();
    expect(screen.getByText('Enciende Bluetooth en Ajustes para conectar tu wearable.')).toBeTruthy();
    expect(screen.getByText('Entendido')).toBeTruthy();
    expect(screen.queryByText('Enciende Bluetooth en Ajustes.')).toBeNull();
    expect(screen.queryByText('Activa Bluetooth para conectar tu wearable.')).toBeNull();
    expect(screen.queryByText('Buscando dispositivos…')).toBeNull();
    expect(screen.queryByText('Buscando cerca de ti…')).toBeNull();
    expect(screen.queryByText('Conectando…')).toBeNull();
    expect((screen.getByText('Buscar dispositivo').closest('ion-button') as HTMLElement & { disabled: boolean }).disabled).toBe(true);
    fireEvent.click(screen.getByText('H59_E206'));
    expect(fixture.state.connect).not.toHaveBeenCalled();
  });

  it('Entendido cierra el aviso sin repetirlo hasta el siguiente apagado', () => {
    fixture.state.error = 'bluetooth-off';
    const view = render(<WearablePage />);
    fireEvent.click(screen.getByText('Entendido'));
    view.rerender(<WearablePage />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fixture.state.error = null;
    view.rerender(<WearablePage />);
    fixture.state.error = 'bluetooth-off';
    view.rerender(<WearablePage />);
    expect(screen.getByRole('alertdialog', { name: 'Activa Bluetooth' })).toBeTruthy();
  });

  it('encender Bluetooth cierra el popup y un estado transitorio no lo vuelve a abrir', () => {
    fixture.state.error = 'bluetooth-off';
    const view = render(<WearablePage />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fixture.state.error = null;
    view.rerender(<WearablePage />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fixture.state.error = 'bluetooth-not-ready';
    fixture.state.phase = 'error';
    view.rerender(<WearablePage />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('explica por qué no puede conectar si falta la identidad de sesión', () => {
    fixture.state.phase = 'error';
    fixture.state.error = 'session-unavailable';
    render(<WearablePage />);
    expect(screen.getByText('No pudimos identificar tu sesión. Vuelve a iniciar sesión para conectar el wearable.')).toBeTruthy();
  });

  it('conserva Conectado si las lecturas están antiguas pero el enlace sigue activo', () => {
    fixture.app.wearableConnected = true;
    fixture.state.phase = 'connected';
    fixture.state.sessionStale = true;
    render(<WearablePage />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Tu dispositivo está conectado')).toBeTruthy();
    expect(screen.getByText('Conexión activa. Esperando nuevas lecturas del dispositivo.')).toBeTruthy();
    expect(screen.queryByText('Conectando…')).toBeNull();
  });

  it('una conexión pendiente real sigue mostrando Conectando', () => {
    fixture.state.phase = 'connecting';
    fixture.state.sessionStale = true;
    render(<WearablePage />);
    expect(screen.getAllByText('Conectando…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Conectado')).toBeNull();
  });

  it('un enlace perdido no se presenta conectado por tener lecturas antiguas', () => {
    fixture.state.sessionStale = true;
    render(<WearablePage />);
    expect(screen.getByText('Sin wearable')).toBeTruthy();
    expect(screen.queryByText('Conectado')).toBeNull();
    expect(screen.queryByText('Conectando…')).toBeNull();
  });

  it('el historial automático mantiene Reloj visible y Conectado, sin abrir el foco', () => {
    fixture.app.wearableConnected = true;
    fixture.state.phase = 'connected';
    fixture.state.syncing = true;
    render(<WearablePage />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Tu dispositivo está conectado')).toBeTruthy();
    expect(screen.queryByTestId('history-progress')).toBeNull();
  });

  it('Sincronizar ahora sí abre progreso y lo cierra al terminar', async () => {
    fixture.app.wearableConnected = true;
    fixture.state.phase = 'connected';
    let finish!: () => void;
    fixture.state.syncHistory.mockImplementation(() => {
      fixture.state.syncing = true;
      return new Promise<void>(resolve => { finish = resolve; });
    });
    render(<WearablePage />);
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    expect(fixture.state.syncHistory).toHaveBeenCalledOnce();
    expect(screen.getByTestId('history-progress')).toBeTruthy();
    await act(async () => { fixture.state.syncing = false; finish(); });
    expect(screen.queryByTestId('history-progress')).toBeNull();
  });

  it('cancelar el progreso manual no convierte el siguiente refresco automático en un modal', async () => {
    fixture.app.wearableConnected = true;
    fixture.state.phase = 'connected';
    let finish!: () => void;
    fixture.state.syncHistory.mockImplementation(() => {
      fixture.state.syncing = true;
      return new Promise<void>(resolve => { finish = resolve; });
    });
    fixture.state.cancelSync.mockImplementation(() => { fixture.state.syncing = false; });
    const view = render(<WearablePage />);
    fireEvent.click(screen.getByText('Sincronizar ahora'));
    fireEvent.click(screen.getByText('cancel history'));
    expect(fixture.state.cancelSync).toHaveBeenCalledOnce();
    fixture.state.syncing = true;
    view.rerender(<WearablePage />);
    expect(screen.queryByTestId('history-progress')).toBeNull();
    await act(async () => { finish(); });
    expect(screen.queryByTestId('history-progress')).toBeNull();
  });
});
