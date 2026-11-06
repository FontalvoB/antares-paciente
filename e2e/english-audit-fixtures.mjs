import { TESTS } from "../src/data/tests.ts";

/** Datos aislados para recorrer traducciones. No proxy ni escrituras externas. */
export const id='11111111-1111-4111-8111-111111111111';
/** Respuestas de éxito aisladas para Liga/Evolución e historial conversacional. */
export function careAuditResponse(path){
 const now=new Date().toISOString();
 if(/^\/api\/v1\/threads\/[^/]+\/messages$/.test(path))return {threadId:path.split('/')[4],messageCount:0,lastMessage:null,messages:[],hasMore:false,nextCursor:null};
 if(path==='/api/v1/program/me/league'){
  const category=(value)=>({entries:[{position:1,display:'QA Member A',isMe:false,value:value+2},{position:2,display:'QA Patient',isMe:true,value},{position:3,display:'QA Member B',isMe:false,value:value-1}],myRank:2,myValue:value,totalParticipants:3});
  return {cohort:{scope:'national',stateCode:null,participants:3,computedAt:now},me:{optedIn:true,nickname:'QA Patient'},categories:{racha:category(5),evo:category(70),adh:category(80),clin:category(75)}};
 }
 if(path==='/api/v1/program/scores')return {health_score:{current:75,previous:70,trend:'up',dimensions:{nutrition:80,exercise:70,psychology:75,adherence:85,clinical:65}},transformation_score:{current:70,previous:65,trend:'up',detail:{weight:{baseline:85,current:82,unit:'kg',delta:-3,delta_pct:-3.5,favorable:true}}}};
 if(path==='/api/v1/program/me/scores-history')return {points:[{weekNumber:1,periodStart:null,periodEnd:now.slice(0,10),healthScore:70,healthPrevious:null,transformationScore:65},{weekNumber:2,periodStart:null,periodEnd:now.slice(0,10),healthScore:75,healthPrevious:70,transformationScore:70}]};
}
export function installEnglishAudit(){
 const realFetch=window.fetch.bind(window),params=new URLSearchParams(location.search);
 localStorage.setItem('antares_lang',params.get('lang')||'en');
 let testCompleted=new Set();
 let session=!['login','onboarding'].includes(params.get('flow')),completed=new Set();
 const token='x.'+btoa(JSON.stringify({sub:id,exp:4102444800}))+'.x';
 const now=new Date(),date=now.toISOString().slice(0,10),weekStart=new Date(now);weekStart.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));
 const testCodes=['historia-clinica','temperamento','nutricional','movimiento','sueno','iac-adresd','orp','ers','bateria-antares'];
 const assignments=()=>TESTS.map((test,index)=>({id:'qa-test-'+test.id,testCode:testCodes[index],testName:test.title,status:testCompleted.has('qa-test-'+test.id)?'completed':'pending'}));
 const questions=(assignmentId)=>{const test=TESTS.find(test=>'qa-test-'+test.id===assignmentId);return (test?.questions||[]).map((q,index)=>({id:q.id,code:q.id,section:q.section,text:q.text,type:q.type,sortOrder:index,isActive:true,hint:q.hint||null,unit:q.unit||null,minValue:q.min??null,maxValue:q.max??null,defaultValue:q.def??null,minLabel:q.minLabel||null,maxLabel:q.maxLabel||null,options:(q.options||[]).map((option,sortOrder)=>({id:q.id+'-'+sortOrder,text:option.text,sortOrder,scoreValue:option.score,isActive:true}))}));};
 const tasks=['podcast','vitals','nut','ejercicio','nutraceutico','emocional'];
 const titles=['Escuchar podcast','Medir signos vitales','Nutrición','Ejercicio del día','Tomar nutracéutico','Check-in emocional'];
 const profile={patientId:id,userId:id,firstName:'María',lastName:'García',documentNumber:'QA-EN',email:'qa@example.invalid',phone:'+12025550101',dateOfBirth:'1990-01-01',gender:'F',emergencyName:'QA Contact',emergencyPhone:'+12025550102',emergencyRelationship:'Familiar',emergencyEmail:'contact@example.invalid',secondaryEmergencyContact:null,insurerId:null,memberId:''};
 const meals=[['Desayuno','Oats and fruit',380],['Almuerzo','Chicken and rice',560],['Snack','Yogurt and apple',190],['Cena','Fish and vegetables',470]].map(([mealType,description,calories],i)=>({mealType,description,foods:'Example prescribed portion',calories,proteinG:20,carbsG:35,fatG:8,waterMl:250,notes:'Example clinician instruction',sortOrder:i+1,suggestedTime:['07:00','12:00','15:30','19:00'][i]}));
 const plan={id,revision:1,name:'Example approved plan',durationDays:30,currentDay:10,startDate:date,endDate:date,dailyCalorieTarget:1600,dailyProteinTarget:80,dailyCarbsTarget:200,dailyFatTarget:50,dailyFiberTarget:25,dailyWaterMl:2000,days:[{dayNumber:1,dailyWaterMl:2000,meals},{dayNumber:2,dailyWaterMl:1800,meals}]};
 const snapshot=()=>({enrollmentId:id,todayLocalDate:date,template:{id,code:'QA',name:'Example program',totalWeeks:24,currentWeekNumber:3,currentWeekStatus:'Active',currentWeekStartDateLocal:weekStart.toISOString().slice(0,10),currentWeekEndDateLocal:date},todayTasks:tasks.map((taskCode,i)=>({taskCode,title:titles[i],short:'Tu actividad asignada para hoy',points:100,status:completed.has(taskCode)?'Completed':'Pending',completedAt:completed.has(taskCode)?new Date().toISOString():null,content:taskCode==='nut'?{nutritionPlanName:plan.name,meals,dailyCalorieTarget:1600,dailyWaterMl:2000,nutritionIntakeLogs:[]}:taskCode==='podcast'?{title:'Example assigned podcast',author:'Example author',description:'Example episode description',durationSecs:600,mediaUrl:null,chapters:[{atSeconds:0,label:'Introduction'}],takeaways:['Example takeaway']}:taskCode==='ejercicio'?{title:'Example routine',exerciseRoutineName:'Example routine',exercises:[{name:'Marcha en el lugar',description:'Example prescribed instruction',durationSecs:60,sets:3,repetitions:10,restSeconds:30,targetMuscle:'Piernas',equipment:'Ninguno',sortOrder:1},{name:'Plancha',description:'Example prescribed instruction',durationSecs:30,sortOrder:2}]}:null})),todayPoints:completed.size*100,todayPointsMax:650,todayBonusAvailable:true,dailyBonusAmount:50,xp:{balance:1200,level:'Semilla',nextLevelAt:2000},streak:{current:5,longest:9,freezesRemaining:1,multiplierActive:1,multiplierEndsAt:null,multiplierRemainingHours:0,nbStreak:3,nbWeekDays:[true,false,true,false,false,false,false]},nextMilestoneDays:7,calendar:[],streakChests:[]});
 const me={id,displayName:'María García',bio:'Example user biography',status:'ACTIVE',avatarUrl:null,coverUrl:null,createdAt:now.toISOString(),posts:[],reposts:[]};
 const post={id:'22222222-2222-4222-8222-222222222222',body:'Example user-authored community post',pinned:false,imageUrl:null,mediaType:null,poll:{id,options:[{id,text:'Option one',votes:[]},{id:'2',text:'Option two',votes:[]}]},createdAt:now.toISOString(),profile:me,likes:[],reposts:[],comments:[]};
 window.__englishAudit={requests:[],unhandled:[],captures:[],missing:[],session:()=>session};
 const warn=console.warn.bind(console);console.warn=(...args)=>{if(String(args[0]).includes('[i18n]'))window.__englishAudit.missing.push(args);warn(...args)};
 window.fetch=async(input,init={})=>{
  const request=input instanceof Request?input:null,url=new URL(request?.url||input,location.origin),p=url.pathname;
  if(!p.startsWith('/api/')&&!p.startsWith('/storage/'))return realFetch(input,init);
  const method=init.method||request?.method||'GET';let body={};try{body=JSON.parse(init.body||'{}')}catch{}
  window.__englishAudit.requests.push({path:p,method});
  const reply=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
  const care=careAuditResponse(p);if(care!==undefined)return reply(care);
  if(p.includes('/community')&&(body.query||url.searchParams.get('query'))){const fields={me,feed:[post],followingFeed:[post],profile:me,post,profiles:[me],followers:[],following:[],friendRequests:[],friends:[],conversations:[],conversation:[],groups:[],clubs:[],myClubs:[],publicClubPosts:[]};return reply({data:fields});}
  if(p==='/api/auth/refresh')return session?reply({accessToken:token,expiresIn:86400}):reply({},401);
  if(p==='/api/auth/me/avatar')return reply(method==='PUT'?body:{version:1,gender:'male',skin:'skin-03',hair:'hair-02',clothing:{shirt:'shirt-basic-01',pants:'pants-male-01',shoes:null},accessories:{glasses:null,watch:null,bracelet:null}});
  if(p==='/api/auth/me')return reply({id,firstName:profile.firstName,lastName:profile.lastName,roles:['Patient'],permissions:[]});
  if(p==='/api/auth/login'||p==='/api/auth/verify-otp'){if(body.documentNumber==='QA-ERROR')return reply({message:'Credenciales inválidas'},401);session=true;return reply({accessToken:token,tokenType:'Bearer',expiresIn:86400})}
  if(p==='/api/auth/id-lookup')return reply({...profile,contacts:[{id:'qa-contact',type:'Email',label:'qa@example.invalid'},{id:'qa-phone',type:'Phone',label:'+1•••0101'}]});
  if(p==='/api/auth/send-otp'||p==='/api/auth/recovery-code')return reply({expiresInSeconds:300,devCode:'123456'});
  if(p==='/api/auth/recover-password'||p==='/api/auth/set-first-password')return reply({message:'Contraseña actualizada.'});
  if(p.includes('/patient-profile'))return reply(profile);
  if(p==='/api/v1/me/context'||p==='/api/v1/telemedicine/me')return reply({patient:{id,organizationId:id},clinics:[]});
  if(p==='/api/v1/program/me/snapshot')return reply(snapshot());
  if(p==='/api/v1/program/tasks/complete'){completed.add(body.taskCode);return reply({taskCompletionId:id,pointsAwarded:100,xpBalanceAfter:1300,isPerfectDay:false,dailyBonusAwarded:0,streakCurrent:5,dayPoints:100,dayPointsMax:650})}
  if(p.endsWith('/calendar'))return reply({days:[]});
  if(p.includes('metrics-history'))return reply({heightCm:170,metrics:[]});
  if(p.includes('scores'))return reply({message:'Example unavailable score'},404);
  if(p.endsWith('/nutrition-plan/status'))return reply({status:'active',durationDays:30,currentDay:10,planId:id,revision:1,startDate:date,endDate:date});
  if(p.endsWith('/nutrition-plan'))return reply(plan);
  if(p==='/api/v1/health-tests/me/profile-analysis')return reply(method==='POST'?{summary:'Example English guidance.',priorities:[{title:'Example priority',explanation:'Example explanation.',action:'Example action.',evidenceCodes:['temperamento']}],encouragement:'Example encouragement.',questions:['Example question for your care team?'],generatedAt:now.toISOString(),sourceRevision:'qa'}:null);
  if(p==='/api/v1/health-tests/me/assignments')return reply(assignments());
  if(p==='/api/v1/health-tests/me/results')return reply([...testCompleted].map((assignmentId,index)=>({id:'qa-result-'+index,evaluationId:assignmentId,resultType:'score',code:testCodes[Number(assignmentId.split('-').at(-1))-1],label:TESTS[Number(assignmentId.split('-').at(-1))-1].tag,value:15.5,qualifier:'Moderado',severity:'medium'})));
  if(p.includes('/health-tests/me/tests/')){const assignmentId=p.split('/tests/')[1].split('/')[0];if(p.endsWith('/submit')){testCompleted.add(assignmentId);return reply({id,assignmentId,status:'completed',results:[]})}if(p.endsWith('/start'))return reply({id,assignmentId,status:'started'});return reply({id:assignmentId,questions:questions(assignmentId)});}
  if(p.includes('/health-tests/me/'))return reply([]);
  if(p.includes('/sos/alerts/active'))return reply({},404);
  if(p.endsWith('/sos/alerts'))return reply({id,status:'Active',createdAt:now.toISOString(),recipients:[]},201);
  if(p.includes('/notifications'))return reply({items:[],total:0,unreadCount:0});
  if(p.includes('/measurements'))return reply({items:[],total:0});
  const pro={id,employeeId:id,fullName:'QA Professional',professionalTypeName:'Médico',specialties:[{id,name:'Medicina General'}],locations:[],clinicIds:[],status:'Active'};
  const day=url.searchParams.get('date')||url.searchParams.get('from')||date;
  const slot={start:day+'T15:00:00Z',end:day+'T15:30:00Z',durationMinutes:30,isAvailable:true,conflictReason:null,availableProfessionalCount:1};
  if(p.endsWith('/specialties'))return reply([{id,code:'FAMILY_MEDICINE',name:'Medicina General',category:'Medicina',description:'Control y prevención',isActive:true},{id:'33333333-3333-4333-8333-333333333333',code:'URGENT_CARE',name:'Urgencia',category:'Medicina',description:'Atención prioritaria',isActive:true}]);
  if(p.endsWith('/insurers'))return reply([]);
  if(p.includes('professionals-catalog'))return reply({items:[pro],data:[pro],total:1,page:1,pageSize:100,totalPages:1});
  if(p.includes('/availability/professionals'))return reply({specialtyId:id,from:day,to:day,timezoneOffset:'-05:00',professionals:[{professionalId:id,nextAvailableStart:slot.start,availableDays:1}]});
  if(p.includes('/availability'))return reply({professionalId:id,specialtyId:id,date:day,timezoneOffset:'-05:00',slots:[slot],days:[{date:day,slots:[slot]}]});
  if(p.includes('/requests/mine')||p.includes('/appointments/mine'))return reply([]);
  if(p.includes('/appointments')||p.includes('/requests'))return reply({items:[],total:0});
  if(p.includes('/legal-documents'))return reply([]);
  window.__englishAudit.unhandled.push({path:p,method});return reply({message:'Example test response unavailable'},404);
 };
 window.open=()=>null;
 window.__auditCapture=(name)=>{const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[aria-hidden="true"],.overlay-hidden');const elements=[...document.querySelectorAll('button,ion-button,ion-segment-button,input,textarea,ion-select,[role="button"]')].filter(visible);const record={name,screen:window.__englishAuditApp?.screen,flow:window.__englishAuditApp?.flow,text:document.body.innerText,controls:elements.map(el=>({tag:el.tagName,label:el.getAttribute('aria-label')||el.innerText||el.getAttribute('placeholder')||'',disabled:el.disabled||false})),missing:[...window.__englishAudit.missing]};window.__englishAudit.captures.push(record);return record};
}
