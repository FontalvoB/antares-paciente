"""QA sintético del historial: navegador aislado, API/SDK simulados, sin proveedor real."""
import base64
import json
import os
import re
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("VITA_QA_URL", "http://127.0.0.1:5197")
EVIDENCE = Path("docs/integracion/evidencia-vita-historial")
EVIDENCE.mkdir(parents=True, exist_ok=True)
payload = base64.urlsafe_b64encode(json.dumps({"sub": "vita-qa", "aud": "app", "exp": int(time.time()) + 3600}).encode()).decode().rstrip("=")
TOKEN = f"header.{payload}.synthetic"
source = urllib.request.urlopen(f"{BASE}/src/components/VoiceOverlay.tsx").read().decode()
react_module = re.search(r'from "([^"]*/react\.js[^"]*)"', source).group(1)
SDK = """
import React from 'REACT_MODULE';
const C = React.createContext(null);
export function ConversationProvider({children,...callbacks}) { return React.createElement(C.Provider,{value:callbacks},children); }
export function useConversation(hooks) {
 const callbacks=React.useContext(C); const [isMuted,setMuted]=React.useState(false);
 window.__historyVoiceEvents=callbacks;
 return {status:'connected',isMuted,isSpeaking:false,setMuted,
 startSession:()=>{window.__historyStarts=(window.__historyStarts||0)+1;callbacks.onConnect?.({});},
 endSession:()=>{window.__historyEnds=(window.__historyEnds||0)+1;hooks?.onDisconnect?.();},
 getInputVolume:()=>0,getOutputVolume:()=>0,sendUserMessage:()=>{}};
}
""".replace("REACT_MODULE", react_module)

results = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    try:
        for lang in ["es", "en"]:
            for width in [320, 390, 1440]:
                context = browser.new_context(viewport={"width": width, "height": 900})
                state = {"revision": 0, "reason": None, "history": [{"role": "bot", "text": "Synthetic previous month", "messageId": "before"}], "fail": True, "deletes": 0, "order": []}
                errors = []
                context.add_init_script(f"localStorage.setItem('copp_access_token',{json.dumps(TOKEN)});localStorage.setItem('antares_lang','{lang}');localStorage.setItem('antares:vita-welcome:v1:vita-qa','seen');")
                context.route("**/node_modules/.vite/deps/@elevenlabs_react.js*", lambda route: route.fulfill(content_type="text/javascript", body=SDK))

                def api(route):
                    request = route.request
                    path = urllib.parse.urlparse(request.url).path
                    def reply(body, status=200, content_type="application/json"):
                        route.fulfill(status=status, content_type=content_type, body=body if isinstance(body, str) else json.dumps(body))
                    metadata = {"threadId": "proactive-vita-qa", "historyRevision": state["revision"], "clearedAt": "2026-11-01T05:00:00Z" if state["revision"] else None, "resetReason": state["reason"]}
                    if path == "/api/auth/refresh": return reply({"accessToken": TOKEN, "tokenType": "Bearer", "expiresIn": 3600})
                    if path == "/api/auth/me": return reply({"id": "vita-qa", "firstName": "Alex", "lastName": "Fixture", "email": "fixture@example.invalid"})
                    if path == "/api/v1/me/patient-profile": return reply({}, 404)
                    if path == "/api/v1/telemedicine/me": return reply({"patient": {"id": "fixture-patient"}})
                    if "professionals-catalog" in path: return reply({"data": []})
                    if "/threads/" in path:
                        if request.method == "DELETE":
                            state["deletes"] += 1
                            state["order"].append("history-delete")
                            assert not request.post_data
                            assert "userId" not in request.url
                            if state["fail"]: return reply({"detail": "Synthetic unavailable history"}, 503)
                            state["revision"] += 1
                            state["reason"] = "manual"
                            state["history"] = []
                            return reply({**metadata, "historyRevision": state["revision"], "clearedAt": "2026-11-14T20:00:00Z", "resetReason": "manual"})
                        return reply({**metadata, "messageCount": len(state["history"]), "messages": state["history"], "hasMore": False, "lastMessage": None})
                    if path == "/api/v1/chat/voice/session": return reply({"signedUrl": "wss://example.invalid", "agentId": "fixture", "sessionId": "voice-fixture", "threadId": "proactive-vita-qa", "runtimeMode": "legacy"})
                    if path == "/api/v1/chat/voice/session/voice-fixture":
                        state["order"].append("voice-delete")
                        return reply({})
                    if path == "/api/v1/chat/stream":
                        state["history"] = [{"role": "user", "text": "Synthetic new turn"}, {"role": "bot", "text": "Synthetic current reply"}]
                        return reply('event: done\ndata: {"type":"done","answer":"Synthetic current reply","thread_id":"proactive-vita-qa"}\n\n', content_type="text/event-stream")
                    if "community/graphql" in path: return reply({"data": {}})
                    return reply({"message": "Outside synthetic scenario"}, 501)

                context.route("**/api/**", api)
                context.route("**/*", lambda route: route.abort() if urllib.parse.urlparse(route.request.url).netloc != urllib.parse.urlparse(BASE).netloc else route.fallback())
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(BASE)
                page.wait_for_load_state("networkidle")
                page.get_by_role("button", name="Chat", exact=True).click()
                page.get_by_text("Synthetic previous month", exact=True).wait_for()
                page.wait_for_function("Number(getComputedStyle(document.querySelector('.router-page')).opacity)>.99")
                clear_label = "Limpiar conversación" if lang == "es" else "Clear conversation"
                clear = page.locator(".vita-header-clear")
                box = clear.bounding_box()
                assert box["width"] >= 43.9 and box["height"] >= 43.9, box
                assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                clear.click()
                page.get_by_role("alertdialog").wait_for()
                page.get_by_role("button", name="Cancelar" if lang == "es" else "Cancel", exact=True).click()
                assert state["deletes"] == 0
                clear.click()
                page.get_by_role("alertdialog").get_by_role("button", name=clear_label, exact=True).click()
                error_label = "No se pudo confirmar la limpieza" if lang == "es" else "Could not confirm deletion"
                page.get_by_role("alertdialog", name=error_label).wait_for()
                page.wait_for_function("""() => [...document.querySelectorAll('ion-alert')].some(el => {
                  const wrapper=el.querySelector('.alert-wrapper');
                  return wrapper && Number(getComputedStyle(wrapper).opacity)>.99 && el.getBoundingClientRect().height>0;
                })""")
                assert page.get_by_text("Synthetic previous month", exact=True).is_visible()
                page.screenshot(path=str(EVIDENCE / f"error-{width}-{lang}.png"))
                state["fail"] = False
                page.get_by_role("alertdialog").get_by_role("button", name="Reintentar" if lang == "es" else "Retry", exact=True).click()
                page.locator(".vita-chat-welcome").wait_for()
                assert state["deletes"] == 2
                page.screenshot(path=str(EVIDENCE / f"empty-{width}-{lang}.png"))

                page.locator("ion-textarea textarea").fill("Synthetic new turn")
                page.locator("ion-button.chat-send").click()
                page.get_by_text("Synthetic current reply", exact=True).wait_for()
                assert page.get_by_text("Synthetic previous month", exact=True).count() == 0
                # Un GET mensual vacío al volver a primer plano retira toda la caché.
                state["revision"] += 1
                state["reason"] = "monthly"
                state["history"] = []
                page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
                page.locator(".vita-chat-welcome").wait_for()
                assert page.get_by_text("Synthetic current reply", exact=True).count() == 0
                # Un cambio de mes sin salir de pantalla se detecta antes del turno.
                page.locator("ion-textarea textarea").fill("Synthetic new turn")
                page.locator("ion-button.chat-send").click()
                page.get_by_text("Synthetic current reply", exact=True).wait_for()
                state["revision"] += 1
                state["history"] = []
                page.locator("ion-textarea textarea").fill("Synthetic new turn")
                page.locator("ion-button.chat-send").click()
                page.wait_for_function("document.querySelectorAll('.bub-bot').length===1 && [...document.querySelectorAll('.bub-bot')].every(el=>el.textContent.includes('Synthetic current reply'))")
                assert page.get_by_text("Synthetic current reply", exact=True).count() == 1

                if lang == "es" and width == 390:
                    page.locator(".vita-header-call").click()
                    page.locator(".vc-shell").wait_for()
                    page.wait_for_function("window.__historyStarts===1")
                    page.get_by_role("button", name="Volver al chat", exact=True).click()
                    page.locator(".vita-call-bar").wait_for()
                    page.wait_for_function("!document.querySelector('ion-modal.show-modal')")
                    clear.click()
                    page.get_by_role("alertdialog").get_by_role("button", name=clear_label, exact=True).click()
                    page.locator(".vita-chat-welcome").wait_for()
                    assert page.evaluate("window.__historyEnds") >= 1
                    assert state["order"].index("voice-delete") < len(state["order"]) - 1
                    page.evaluate("window.__historyVoiceEvents?.onMessage({role:'agent',source:'ai',message:'Stale voice',event_id:99})")
                    assert page.get_by_text("Stale voice", exact=True).count() == 0
                assert not errors, errors
                results.append({"lang": lang, "width": width, "clearTouch": box, "deletes": state["deletes"], "pageErrors": errors, "passed": True})
                context.close()
    finally:
        browser.close()
        (EVIDENCE / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps({"passed": len(results), "results": results}))
