import type { ButtonHTMLAttributes } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PodcastLesson } from '../Lessons';
vi.mock('../../../i18n/I18nContext', () => ({ useT: () => (text: string) => text }));
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button onClick={onClick} disabled={disabled} aria-label={props['aria-label']}>{children}</button>,
  IonProgressBar: () => <div />,
  IonIcon: () => <span />,
  IonChip: () => <span />,
  IonInput: () => <input />,
  IonRange: () => <input />,
  IonSegment: () => <div />,
  IonSegmentButton: () => <button />,
  IonSpinner: () => <span />,
  IonTextarea: () => <textarea />,
}));
afterEach(cleanup);
const props = { done: false, pts: 80, mediaUrl: '/audio.mp3', durationSecs: 195, progress: 0.5, playing: false, audioReady: true, onToggle: vi.fn(), onSkip: vi.fn(), onComplete: vi.fn() };
describe('PodcastLesson real media timing', () => {
  it('renders the elapsed clock using the supplied file duration', () => {
    render(<PodcastLesson {...props} />);
    expect(screen.getByText('01:37')).toBeTruthy();
    expect(screen.getByText('03:15')).toBeTruthy();
  });
  it('hides corrupt chapter metadata and preserves labelled chapters', () => {
    render(<PodcastLesson {...props} chapters={[
      { atSeconds: 0, label: null as unknown as string },
      { atSeconds: 0, label: '' },
      { atSeconds: 60, label: 'Segundo tramo' },
      { atSeconds: 0, label: 'Introducción' },
    ]} />);
    expect(screen.getByRole('button', { name: /Introducción/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Segundo tramo/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '00:00 ·' })).toBeNull();
  });
  it('enforces listening threshold before completion', () => {
    render(<PodcastLesson {...props} progress={0.69} />);
    expect(screen.getByRole('button', { name: /Escucha el 70%/ }).hasAttribute('disabled')).toBe(true);
  });
});
