// Harness local de Playwright MCP: pantalla y cliente reales, respuestas HTTP de prueba.
// eslint-disable-next-line no-unused-expressions -- Playwright MCP evalúa esta función desde el fichero.
async page => {
  await page.unrouteAll({behavior:'wait'});
  page.qaMessages = []; page.qaNetwork = []; page.qaPageErrors = []; page.qaRequests=[]; page.qaVersion=0; page.qaImageExpired=false;
  page.on('console', message => { if (['warning','error'].includes(message.type())) page.qaMessages.push({type:message.type(),text:message.text()}); });
  page.on('pageerror', error => page.qaPageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) page.qaNetwork.push({status:response.status(),url:response.url()}); });
  page.on('requestfailed', request => page.qaNetwork.push({failure:request.failure()?.errorText,url:request.url()}));
  const origin=page.qaConfig?.origin ?? 'http://127.0.0.1:5182';
  const source=await (await page.request.get(origin+'/src/pages/NutritionPage.tsx')).text();
  const main=await (await page.request.get(origin+'/src/main.tsx')).text();
  const react=source.match(/from "([^"\n]*\/react\.js\?[^"\n]*)"/)[1];
  const ionic=source.match(/from "([^"\n]*\/@ionic_react\.js\?[^"\n]*)"/)[1];
  const query=source.match(/from "([^"\n]*\/@tanstack_react-query\.js\?[^"\n]*)"/)[1];
  const dom=main.match(/from "([^"\n]*\/react-dom_client\.js\?[^"\n]*)"/)[1];
  const mocks={
    '/src/context/AppContext.tsx':`export const useApp=()=>({authLoading:false,user:{nombre:'Paciente QA'},flow:'app',realMode:true,screen:'nut',chatUnread:0,showToast:()=>{},navigate:()=>{},openTests:()=>{},openPanic:()=>{},completeStep:()=>{}});`,
    '/src/context/WearableContext.tsx':`export const useWearable=()=>({today:{activityKcal:null}});`,
    '/src/hooks/useProgram.ts':`export const useProgram=()=>({snapshot:window.__qa.loading?null:window.__qa.snapshot,isLoading:window.__qa.loading,isMockFallback:false,productMessage:null});`,
    '/src/hooks/useMyNutritionPlan.ts':`export const useMyNutritionPlan=()=>({plan:window.__qa.loading?null:window.__qa.plan,isLoading:window.__qa.loading,error:null,refetch:()=>{}});`,
    '/src/hooks/useNutritionPlanStatus.ts':`export const useNutritionPlanStatus=()=>({status:null,isLoading:false,error:null,refetch:()=>{}});`,
    '/src/hooks/useNutritionLog.ts':`export const useNutritionLog=()=>({mutate:()=>{},isPending:false});export const useUpdateNutritionLog=useNutritionLog;export const useDeleteNutritionLog=useNutritionLog;`,
    '/src/hooks/useCompleteTask.ts':`export const useCompleteTask=()=>({mutate:()=>{},isPending:false});export const applyOptimistic=()=>{};`,
    '/src/hooks/useProgramScores.ts':`export const useProgramScores=()=>({scores:null,isLoading:false,isError:false,refetch:()=>{}});`,
    '/src/hooks/useMetricsHistory.ts':`export const useMetricsHistory=()=>({history:null,isLoading:false,isError:false,refetch:()=>{}});`,
  };
  await page.route('**/src/**', async route=>{
    const body=mocks[new URL(route.request().url()).pathname];
    if(body) await route.fulfill({contentType:'application/javascript',body});else await route.continue();
  });
  await page.route('**/api/v1/me/nutrition/cycles/recommendations',async route=>{
    const request=route.request();const headers=request.headers();
    if(request.method()!=='GET'||new URL(request.url()).search||request.postData())throw Error('Petición fuera del contrato 3.10');
    const state=await page.evaluate(()=>structuredClone(window.__qa));
    const version=++page.qaVersion;
    page.qaRequests.push({method:request.method(),path:new URL(request.url()).pathname,language:headers['x-app-language'],acceptLanguage:headers['accept-language'],bearerPresent:headers.authorization?.startsWith('Bearer '),status:state.status,version});
    if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
    if(state.status!==200)return route.fulfill({status:state.status,json:{detail:'Fallo HTTP controlado '+state.status}});
    const result=state.recommendations;
    for(const cycle of [result.current,...result.previous].filter(Boolean)){
      if(headers['x-app-language']==='en')cycle.patientMessage='Published English recommendation for reviewed cycle '+cycle.cycleNumber+'.';
      for(const image of cycle.attachments)image.url=image.url.replace(/X-Amz-Signature=[^&]+/, 'X-Amz-Signature=fixture-'+version);
    }
    await route.fulfill({json:result,headers:{'Cache-Control':'private, no-store','Content-Language':headers['x-app-language'],'Vary':'X-App-Language, Accept-Language'}});
  });
  await page.route('**/api/auth/refresh',async route=>{
    page.qaRequests.push({method:route.request().method(),path:'/api/auth/refresh',status:401});
    await route.fulfill({status:401,json:{detail:'Expired fixture session'}});
  });
  await page.route('https://media.example.invalid/**',async route=>page.qaImageExpired?route.fulfill({status:403,json:{detail:'Expired fixture signature'}}):route.fulfill({response:await page.request.get(origin+'/src/assets/nutrition/daily-mediterranean.jpg')}));
  await page.route('**/qa-expired.jpg',route=>route.fulfill({status:200,contentType:'image/jpeg',body:'invalid-image-fixture'}));
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>QA HTTP 3.10 — NutritionPage real</title>${['core','normalize','structure','typography','padding','flex-utils','display'].map(f=>'<link rel="stylesheet" href="/node_modules/@ionic/react/css/'+f+'.css">').join('')}<link rel="stylesheet" href="/src/theme/variables.css"><link rel="stylesheet" href="/src/theme/global.css"></head><body><div id="root"></div><script type="module">
  import React from '${react}';import ReactDOM from '${dom}';import {IonApp,setupIonicReact} from '${ionic}';import {QueryClient,QueryClientProvider} from '${query}';import {I18nProvider,useI18n} from '/src/i18n/I18nContext.tsx';import {NutritionPage} from '/src/pages/NutritionPage.tsx';import {nutritionArtboardPlan,nutritionArtboardSnapshot} from '/src/components/nutrition/__tests__/fixtures/nutrition-artboard-plan.ts';import {nutritionRecommendationsResponseFixture,nutritionRecommendationsPublicationOrderFixture} from '/src/components/nutrition/__tests__/fixtures/nutrition-recommendation.ts';import {DailyProtocolReminder} from '/src/components/DailyProtocolReminder.tsx';import {applyTabletLayoutClass} from '/src/utils/viewport.ts';
  const {createRoot}=ReactDOM;const {useState}=React;setupIonicReact({mode:'ios'});applyTabletLayoutClass();
  const clone=value=>JSON.parse(JSON.stringify(value));
  window.__qa={plan:{...nutritionArtboardPlan,cycleNumber:3,startDate:'2027-01-06',endDate:'2027-02-04'},snapshot:{...nutritionArtboardSnapshot,todayLocalDate:'2027-01-09'},recommendations:clone(nutritionRecommendationsPublicationOrderFixture),status:200,delay:0,loading:false};
  window.qaRestore=id=>{const token=btoa('{}')+'.'+btoa(JSON.stringify({sub:id,aud:'app',exp:4102444800}))+'.fixture';localStorage.setItem('copp_access_token',token);sessionStorage.setItem('copp_access_token',token);window.qaConfigure?.({});};window.qaRestore('qa-self');localStorage.setItem('antares_lang','es');const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  function Harness(){const[revision,setRevision]=useState(0);const{setLang}=useI18n();window.qaConfigure=(patch)=>{Object.assign(window.__qa,patch);setRevision(v=>v+1)};window.qaLang=setLang;window.qaFixtures={normal:clone(nutritionRecommendationsPublicationOrderFixture),standard:clone(nutritionRecommendationsResponseFixture)};window.qaRefetch=()=>client.refetchQueries({queryKey:['me','nutrition','recommendations']});return React.createElement('div',{className:'app-stage'},React.createElement('div',{className:'app-shell'},React.createElement(React.Fragment,null,React.createElement(NutritionPage),React.createElement(DailyProtocolReminder))));}
  createRoot(document.getElementById('root')).render(React.createElement(IonApp,null,React.createElement(QueryClientProvider,{client},React.createElement(I18nProvider,null,React.createElement(Harness)))));
  </script></body></html>`;
  await page.route('**/qa-integracion',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'/qa-integracion');
  await page.getByText('Nutrición',{exact:true}).first().waitFor({timeout:5000});
  return {url:page.url(),body:(await page.locator('body').innerText()).slice(0,1500),console:page.qaMessages,pageErrors:page.qaPageErrors};
}
