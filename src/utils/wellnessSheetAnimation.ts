import { createAnimation } from '@ionic/react';

/** Conserva los identificadores del gesto nativo de Ionic y respeta movimiento reducido. */
export function wellnessSheetAnimation(base:HTMLElement, entering:boolean, breakpoint=1) {
  const root=base.shadowRoot??base;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resting=`translateY(${100-breakpoint*100}%)`;
  const wrapper=createAnimation('wrapperAnimation').addElement(root.querySelectorAll('.modal-wrapper, .modal-shadow'))
    .beforeStyles({opacity:'1'}).fromTo('transform',entering?'translateY(100%)':resting,entering?resting:'translateY(100%)');
  const backdrop=createAnimation('backdropAnimation').addElement(root.querySelector('ion-backdrop')!)
    .fromTo('opacity',entering?0:'var(--backdrop-opacity)',entering?'var(--backdrop-opacity)':0);
  return createAnimation().addElement(base).duration(reduced?0:280).easing('ease-out').addAnimation([wrapper,backdrop]);
}
