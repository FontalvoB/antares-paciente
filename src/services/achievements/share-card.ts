import certificateSerif from "../../assets/CertificateSerif.ttf";
import coppLogo from "../../assets/LogoIndividual.png";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

let certificateFont: Promise<FontFace> | undefined;
const loadCertificateFont = () => certificateFont ??= new FontFace(
  'Certificate Serif', `url(${certificateSerif})`, { weight: '400 700' },
).load().then(font => { document.fonts.add(font); return font; });

export type CardFormat = "square" | "story";
/** Ilustración de dominio exportable: misma paleta de marca, sin datos clínicos. */
export async function renderAchievementCard(
  title: string,
  message: string,
  eyebrow: string,
  format: CardFormat,
  certificate?: {heading:string;recipient?:string;footer:string},
): Promise<Blob> {
  await loadCertificateFont();
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = format === "story" ? 1920 : 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const w = canvas.width, h = canvas.height;
  const offset = (h - 1080) / 2;
  const green = '#005b49', navy = '#173b36', gold = '#b99a58';
  ctx.fillStyle = '#faf8f1'; ctx.fillRect(0,0,w,h);
  // Inset hairline frame with restrained, hand-drawn botanical corners.
  ctx.strokeStyle = '#c5ad76'; ctx.lineWidth = 1.2;
  ctx.strokeRect(44,44,w-88,h-88);
  ctx.strokeStyle = '#e3d7bc'; ctx.lineWidth = .8;
  ctx.strokeRect(52,52,w-104,h-104);
  for (const [x,y,sx,sy] of [[64,64,1,1],[w-64,64,-1,1],[64,h-64,1,-1],[w-64,h-64,-1,-1]]) {
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
    ctx.strokeStyle=gold;ctx.lineWidth=1.3;
    // Engraved quarter-circle flourishes, with a single diamond accent.
    ctx.beginPath();ctx.moveTo(0,100);ctx.lineTo(0,44);
    ctx.bezierCurveTo(0,16,16,0,44,0);ctx.lineTo(100,0);ctx.stroke();
    ctx.strokeStyle='#d7c49b';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(8,76);ctx.lineTo(8,44);
    ctx.bezierCurveTo(8,22,22,8,44,8);ctx.lineTo(76,8);ctx.stroke();
    ctx.strokeStyle=gold;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(16,16);ctx.lineTo(23,23);ctx.stroke();
    ctx.fillStyle=gold;ctx.beginPath();ctx.moveTo(29,21);ctx.lineTo(37,29);
    ctx.lineTo(29,37);ctx.lineTo(21,29);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  // A faint brand seal gives the paper depth without reducing legibility.
  ctx.strokeStyle = 'rgba(0,91,73,.035)'; ctx.lineWidth = 1;
  for (let i=0;i<4;i++) {ctx.beginPath();ctx.arc(540,h/2,300+i*24,0,Math.PI*2);ctx.stroke()}
  const logo = await new Promise<HTMLImageElement>((resolve,reject)=>{
    const image = new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Brand logo unavailable'));image.src=coppLogo;
  });
  ctx.drawImage(logo,490,offset+88,100,100);
  ctx.textAlign='center';ctx.fillStyle=green;ctx.font='700 24px Inter, sans-serif';ctx.fillText('COPP-ADRESD',540,offset+209);
  ctx.fillStyle='#6f7e73';ctx.font='500 17px Inter, sans-serif';ctx.fillText(eyebrow.toLocaleUpperCase(),540,offset+250);
  ctx.fillStyle=navy;ctx.font='400 54px "Certificate Serif", serif';ctx.fillText(certificate?.heading ?? eyebrow,540,offset+333);
  ctx.strokeStyle=gold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(370,offset+365);ctx.lineTo(710,offset+365);ctx.stroke();
  const lines = (text:string,y:number,font:string,height:number,maxWidth=790) => {
    ctx.font=font;let line='';
    for(const word of text.split(/\s+/)) {
      const next=line ? `${line} ${word}` : word;
      if(ctx.measureText(next).width>maxWidth && line) {ctx.fillText(line,540,y);y+=height;line=word} else line=next;
    }
    ctx.fillText(line,540,y);return y+height;
  }
  ctx.fillStyle=green;
  const titleBottom=lines(title,offset+455,'600 60px "Certificate Serif", serif',70);
  let messageY=titleBottom+32;
  if(certificate?.recipient) {
    ctx.fillStyle=green;
    messageY=lines(certificate.recipient,messageY,'600 44px "Certificate Serif", serif',54)+22;
  }
  ctx.fillStyle='#52665e';lines(message,messageY,'400 28px "Certificate Serif", serif',42,740);
  const sealY=offset+815;
  // Larger brand medallion with two gold laurel branches.
  ctx.save();ctx.translate(540,sealY);ctx.scale(1.4,1.4);ctx.translate(-540,-sealY);
  ctx.strokeStyle='#d4c29a';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(540,sealY,48,0,Math.PI*2);ctx.stroke();
  ctx.drawImage(logo,505,sealY-35,70,70);
  for(const side of [-1,1]) {
    // Sample an elliptical stem, with paired pointed leaves along its tangent.
    const point=(angle:number)=>({x:540+side*Math.sin(angle)*76,y:sealY+Math.cos(angle)*70});
    ctx.strokeStyle=gold;ctx.lineWidth=1.8;ctx.beginPath();
    for(let step=0;step<=48;step++) {
      const angle=(17+step*2.9)*Math.PI/180,p=point(angle);
      if(step===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
    for(let i=0;i<8;i++) {
      const angle=(28+i*16)*Math.PI/180,p=point(angle);
      const tangent={x:side*Math.cos(angle),y:-Math.sin(angle)};
      const normal={x:side*Math.sin(angle),y:Math.cos(angle)};
      for(const outward of [-1,1]) {
        const length=19-i*.65;
        const tip={x:p.x+tangent.x*length+normal.x*outward*13,y:p.y+tangent.y*length+normal.y*outward*13};
        const dx=tip.x-p.x,dy=tip.y-p.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
        ctx.fillStyle=outward===1 ? '#b99a58' : '#cdb77f';ctx.beginPath();ctx.moveTo(p.x,p.y);
        ctx.bezierCurveTo(p.x+dx*.25+nx*5,p.y+dy*.25+ny*5,p.x+dx*.68+nx*6,p.y+dy*.68+ny*6,tip.x,tip.y);
        ctx.bezierCurveTo(p.x+dx*.72-nx*4,p.y+dy*.72-ny*4,p.x+dx*.25-nx*4,p.y+dy*.25-ny*4,p.x,p.y);ctx.fill();
        ctx.strokeStyle='rgba(110,83,30,.35)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(tip.x-dx*.13,tip.y-dy*.13);ctx.stroke();
      }
    }
  }
  ctx.restore();
  ctx.fillStyle=green;ctx.font='600 18px Inter, sans-serif';
  if(certificate?.footer)ctx.fillText(certificate.footer,540,offset+945);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG unavailable"))),
      "image/png",
    ),
  );
}
export async function shareAchievementFile(
  file: File,
  title: string,
  text: string,
): Promise<"shared" | "unsupported"> {
  if (Capacitor.isNativePlatform()) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const saved = await Filesystem.writeFile({
      path: "achievement-share.png",
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title, text, files: [saved.uri], dialogTitle: title });
    return "shared";
  }
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ title, text, files: [file] });
    return "shared";
  }
  return "unsupported";
}
export function downloadAchievement(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
