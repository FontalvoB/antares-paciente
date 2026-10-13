import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type CardFormat = "square" | "story";
/** Ilustración de dominio exportable: misma paleta de marca, sin datos clínicos. */
export async function renderAchievementCard(
  title: string,
  message: string,
  eyebrow: string,
  format: CardFormat,
): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = format === "story" ? 1920 : 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const tokens = getComputedStyle(document.documentElement);
  const color = (key: string, fallback: string) =>
    tokens.getPropertyValue(key).trim() || fallback;
  const navy = color("--brand-navy", "#142855"),
    green = color("--brand-green", "#035d4d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, navy);
  gradient.addColorStop(1, green);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [x, y, r] of [
    [1020, 120, 360],
    [20, canvas.height - 80, 300],
  ]) {
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x, y, r + i * 44, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const top = format === "story" ? 370 : 140;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText("COPP · ADRESD", 540, top - 50);
  // Medallón vectorial: escala sin depender de emojis o fuentes del sistema.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(540, top + 140, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(493, top + 145);
  ctx.lineTo(526, top + 178);
  ctx.lineTo(592, top + 108);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 23px Inter, sans-serif";
  ctx.fillText(eyebrow.toLocaleUpperCase(), 540, top + 305);
  const lines = (text: string, y: number, font: string, height: number) => {
    ctx.font = font;
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 860 && line) {
        ctx.fillText(line, 540, y);
        y += height;
        line = word;
      } else line = next;
    }
    ctx.fillText(line, 540, y);
    return y + height;
  };
  const bottom = lines(
    title,
    top + 395,
    '700 70px "Space Grotesk", Inter, sans-serif',
    84,
  );
  lines(message, bottom + 44, "400 34px Inter, sans-serif", 50);
  ctx.font = "500 25px Inter, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(
    "#MiConstancia",
    540,
    canvas.height - (format === "story" ? 270 : 94),
  );
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
