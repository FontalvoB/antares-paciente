import { describe, expect, it } from 'vitest';
import { classifyDevice } from '../classify';
import { COLMI_SERVICE } from '../colmi/protocol';
import { HR_SERVICE, YCBT_SERVICE } from '../ycbt/protocol';

describe('classifyDevice', () => {
  it('reconoce el servicio del anillo', () => {
    expect(classifyDevice('Anillo', [YCBT_SERVICE])).toBe('ycbt');
  });

  it('reconoce el Nordic UART de la banda', () => {
    expect(classifyDevice('', [COLMI_SERVICE])).toBe('colmi');
    expect(classifyDevice('H59_2A1B')).toBe('colmi');
    expect(classifyDevice('QWatch Pro')).toBe('colmi');
  });

  it('reconoce el servicio estándar de frecuencia cardíaca', () => {
    expect(classifyDevice('Banda', [HR_SERVICE])).toBe('hrs');
  });

  it('usa el nombre cuando el anuncio no trae servicios', () => {
    expect(classifyDevice('R88 C1BF')).toBe('ycbt');
    expect(classifyDevice('SmartHealth Ring')).toBe('ycbt');
  });

  it('marca como desconocido lo que no puede clasificar', () => {
    expect(classifyDevice('Auriculares')).toBe('unknown');
    expect(classifyDevice('')).toBe('unknown');
  });
});
