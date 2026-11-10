import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import { persistRequestLanguage } from '../../utils/requestLanguage';
import { EcgTrace } from '../EcgTrace';

afterEach(() => { cleanup(); persistRequestLanguage('es'); });
describe('decoración de medición sin señal ECG', () => {
  it.each([
    ['es', 'Animación decorativa; no es un electrocardiograma (ECG).'],
    ['en', 'Decorative animation; not an electrocardiogram (ECG).'],
  ] as const)('identifica la decoración en %s, sin traza ni datos clínicos', (lang, caption) => {
    persistRequestLanguage(lang);
    const { container } = render(<I18nProvider><EcgTrace height={84} /></I18nProvider>);
    expect(screen.getByText(caption)).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelector('canvas, path, polyline')).toBeNull();
    expect(container.querySelector('svg')?.textContent).toBe('');
    expect(container.querySelector('[aria-valuenow], [data-bpm]')).toBeNull();
  });
});
