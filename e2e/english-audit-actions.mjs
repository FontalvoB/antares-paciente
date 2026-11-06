/** Acciones de recorrido en el navegador compartido; requiere datos aislados. */
export async function wait(ms=350){await new Promise(r=>setTimeout(r,ms))}
export function visible(el){return el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[aria-hidden="true"]')}
export function controls(){return [...document.querySelectorAll('ion-button,button,ion-segment-button,ion-item[button]')].filter(visible)}
export async function tap(label,options={}){const candidates=controls().filter(el=>!el.disabled&&(el.getAttribute('aria-label')===label||el.innerText.trim()===label||options.includes&&el.innerText.includes(label)));const el=candidates[options.index||0];if(!el)throw new Error(`Missing control: ${label}`);el.scrollIntoView({block:'center'});el.click();await wait();return window.__auditCapture(options.name||`tap:${label}`)}
export async function route(screen){window.__englishAuditApp.navigate(screen);await wait(500);return window.__auditCapture(`route:${screen}`)}
export async function close(){for(const label of ['Close','Go back','Cancel','Back to protocol','Back to app']){if(controls().some(el=>!el.disabled&&(el.getAttribute('aria-label')===label||el.innerText.trim()===label)))return tap(label)}return null}
