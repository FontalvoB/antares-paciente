import { useEffect, useId, useRef, useState } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonTextarea, IonToggle } from '@ionic/react';
import { cameraOutline, checkmarkOutline, checkmarkCircleOutline, closeOutline, leafOutline, peopleOutline, shieldCheckmarkOutline, timeOutline, calendarOutline } from 'ionicons/icons';
import { MISSION_PHOTOS } from '../../data/missionPhotos';
import { WEEK_LABELS } from '../../data/program';
import { weekdayMondayIndex } from '../../utils/dates';
import { resolveNbDayOk } from '../../utils/nbWeekDays';
import { useI18n } from '../../i18n/I18nContext';
import type { CommunityShareDraft } from '../../utils/communityShareDraft';
import { wellnessSheetAnimation } from '../../utils/wellnessSheetAnimation';

export function NutraceuticLesson({done,pending=false,saving=false,errorMessage,pts,awardedPoints,takenAt,recordedAt,nbWeekDays,dayNumber,localDate,onComplete,onShare,onExit}: {
  done:boolean;pending?:boolean;saving?:boolean;errorMessage?:string|null;pts:number;awardedPoints?:number|null;takenAt:string;recordedAt?:string|null;nbWeekDays?:boolean[]|null;dayNumber?:number|null;localDate?:string;
  onComplete:()=>void;onShare?:(draft?:CommunityShareDraft)=>void;onExit?:()=>void;
}) {
  const {t,lang}=useI18n();const titleId=useId();
  const [open,setOpen]=useState(false);const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState<string|null>(null);const [share,setShare]=useState(false);const [message,setMessage]=useState('');const [fileError,setFileError]=useState<string|null>(null);
  const input=useRef<HTMLInputElement>(null);
  const today=weekdayMondayIndex(localDate ? new Date(`${localDate}T12:00:00`) : undefined);
  const confirmed=done&&!pending;
  const timestamp=recordedAt||takenAt.includes('T') ? new Date(recordedAt||takenAt) : null;
  const time=timestamp&&Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleTimeString(lang==='en'?'en-US':'es-ES',{hour:'numeric',minute:'2-digit'}) : takenAt;
  useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
  useEffect(()=>{if(confirmed)setOpen(false)},[confirmed]);
  const draftText=message.trim()||(dayNumber ? t('Día {day} cuidándome. Un paso que cuenta.',{day:String(dayNumber)}) : t('Hoy cumplí mi hábito de bienestar. ¡Un paso a la vez!'));
  const week=<section className="p2-nb-week"><header><h3><IonIcon icon={calendarOutline} aria-hidden="true" />{t('Tu semana')}</h3>{confirmed&&dayNumber!=null&&<small>{t('Día {day} completado',{day:String(dayNumber)})}</small>}</header><div className="p2-nb-days">{WEEK_LABELS.map((day,index)=>{const ok=resolveNbDayOk(index,today,nbWeekDays,confirmed);return <div key={day} className={`${ok?'is-done':''} ${index===today?'is-today':''}`} aria-label={t('Día {day}: {status}',{day:t(day),status:ok?t('Registrado'):t('Sin registro')})}><span>{ok?<IonIcon icon={checkmarkOutline} aria-hidden="true"/>:index===today?t('Hoy'):'—'}</span><small>{t(day)}</small></div>})}</div></section>;
  return <div className={`nutraceutic-detail p2-nutraceutic${confirmed?' is-complete':''}`} data-testid={confirmed?'nutraceutic-completed':'nutraceutic-detail'}>
    {confirmed ? <>
      <section className="p2-success p2-nb-success"><div className="p2-success-mark"><IonIcon icon={checkmarkOutline} aria-hidden="true"/></div><h2>{t('¡Toma registrada!')}</h2>{awardedPoints!=null&&<span className="p2-points-badge">+{awardedPoints} {t('pts')}</span>}<p>{time?t('Registrado · {takenAt}',{takenAt:time}):t('Dosis de hoy confirmada')}</p></section>
      {week}
      {share&&<section className="p2-share-preview"><header><strong>{t('Así se vería en tu comunidad')}</strong><span>{t('Vista previa')}</span></header>{preview&&<img src={preview} alt={t('Tu foto de hoy')}/>}<p>{draftText}</p></section>}
      <div className="p2-success-actions">{onShare&&<IonButton expand="block" onClick={()=>onShare({text:draftText,file:share?file:null})}><IonIcon icon={peopleOutline} slot="start"/>{t('Compartir en la comunidad')}</IonButton>}{onExit&&<IonButton expand="block" fill="clear" onClick={onExit}>{t('Ahora no')}</IonButton>}</div>
    </> : <>
      <section className="p2-nb-hero" aria-label={dayNumber!=null?t('Día {day} para estar más sano',{day:String(dayNumber)}):t('Tu bienestar se construye cada día')}><img src={MISSION_PHOTOS.nutraceutico} alt={t('Nutracéutico: imagen de referencia')}/><span className="p2-image-note">{t('Imagen de referencia')}</span><div><small>{t('HOY ELIGES CUIDARTE')}</small>{dayNumber!=null&&dayNumber>0&&<p>{t('Día')} <strong>{dayNumber}</strong></p>}<h2>{t('Para estar más sano')}</h2></div></section>
      {week}
      <section className="p2-nb-prescription"><header><IonIcon icon={leafOutline} aria-hidden="true"/><div><h3>{t('Tu dosis indicada')}</h3><p>{t('Sigue la dosis y las indicaciones que te dio tu profesional de salud.')}</p></div></header><div className="protocol-note"><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true"/><p>{t('Registra únicamente la toma que ya realizaste. Si tienes dudas sobre tu producto, consulta a tu equipo de atención.')}</p></div></section>
      {pending?<section role="status" className="p2-status"><IonIcon icon={timeOutline} aria-hidden="true"/><h3>{t(saving?'Guardando…':'Pendiente de sincronización')}</h3><p>{t('Tu registro se confirmará al sincronizar con el servidor.')}</p></section>:<div className="p2-nb-actions"><IonButton fill="outline" aria-label={t('Añadir foto de mi toma')} disabled={saving} onClick={()=>{setOpen(true);input.current?.click()}}><IonIcon icon={cameraOutline} slot="icon-only"/></IonButton><IonButton expand="block" disabled={saving} onClick={()=>setOpen(true)}><IonIcon icon={checkmarkCircleOutline} slot="start"/>{t('Sí, ya lo tomé · +{pts} pts',{pts:String(pts)})}</IonButton></div>}
    </>}
    {errorMessage&&<p role="alert" className="p2-save-error">{errorMessage}</p>}
    {/* Ionic no tiene selector de archivos: se usa el picker nativo y la cámara del dispositivo. */}
    <input ref={input} data-testid="nutraceutic-photo-input" type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" capture="environment" onChange={event=>{const next=event.target.files?.[0];event.target.value='';if(!next)return;if(!['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'].includes(next.type)||next.size>8*1024*1024){setFileError(t('Elige una imagen de hasta 8 MB.'));return;}setFileError(null);setFile(next)}}/>
    <IonModal className="p2-nb-sheet" isOpen={open&&!confirmed} initialBreakpoint={1} breakpoints={[0,1]} handle onDidDismiss={()=>setOpen(false)} aria-labelledby={titleId}
      enterAnimation={(base,options)=>wellnessSheetAnimation(base,true,options?.currentBreakpoint)} leaveAnimation={(base,options)=>wellnessSheetAnimation(base,false,options?.currentBreakpoint)}>
      <IonContent><div className="p2-nb-register"><header><div><h2 id={titleId}>{t('Registrar la toma de hoy')}</h2>{dayNumber!=null&&<p>{t('Día {day}',{day:String(dayNumber)})}</p>}</div><span className="p2-points-badge">+{pts} {t('pts')}</span><IonButton fill="clear" aria-label={t('Cerrar')} onClick={()=>setOpen(false)}><IonIcon icon={closeOutline} slot="icon-only"/></IonButton></header>
        <section className="p2-photo-choice">{preview&&<div className="p2-photo-thumb"><img src={preview} alt={t('Tu foto de hoy')}/><IonButton fill="clear" aria-label={t('Quitar adjunto')} onClick={()=>setFile(null)}><IonIcon icon={closeOutline} slot="icon-only"/></IonButton></div>}<div><h3>{t('Tu foto de hoy')}</h3><p>{t('Opcional. Solo se compartirá si revisas y publicas el borrador.')}</p><IonButton fill="outline" onClick={()=>input.current?.click()}><IonIcon icon={cameraOutline} slot="start"/>{t(file?'Cambiar foto':'Añadir foto')}</IonButton></div></section>
        {fileError&&<p role="alert" className="p2-save-error">{fileError}</p>}
        <section className="p2-share-choice"><IonToggle checked={share} onIonChange={event=>setShare(event.detail.checked)}>{t('Compartir en la comunidad')}</IonToggle><p>{t('Podrás revisar el mensaje antes de publicarlo.')}</p>{share&&<><IonTextarea label={t('Mensaje (opcional)')} labelPlacement="stacked" value={message} maxlength={280} autoGrow rows={3} onIonInput={event=>setMessage((event.detail.value??'').slice(0,280))}/><small className="p2-char-count">{message.length} / 280</small></>}</section>
        {errorMessage&&<p role="alert" className="p2-save-error">{errorMessage}</p>}
        <IonButton expand="block" disabled={saving||pending} onClick={()=>{if(!saving&&!pending)onComplete()}}>{saving?t('Guardando…'):t(share?'Confirmar toma y compartir':'Confirmar toma')}</IonButton><IonButton expand="block" fill="clear" onClick={()=>setOpen(false)}>{t('Cancelar')}</IonButton>
      </div></IonContent>
    </IonModal>
  </div>;
}
