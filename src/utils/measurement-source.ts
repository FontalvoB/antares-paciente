import type { MeasurementItemDto } from "../services/measurements/types";

type MeasurementSource = Pick<MeasurementItemDto, "sourceChannel" | "reportedBy">;

const PATIENT_SOURCE_LABELS = {
  vita_chat: "Reportado por ti · Chat",
  vita_voice: "Reportado por ti · Voz",
  vita_whatsapp: "Reportado por ti · WhatsApp",
} as const;

export function getMeasurementSourceBadge({ sourceChannel, reportedBy }: MeasurementSource) {
  if (sourceChannel === "lab") {
    return { label: "Laboratorio", variant: "lab" };
  }

  switch (reportedBy ?? sourceChannel) {
    case "device":
      return { label: "Dispositivo", variant: "device" };
    case "professional":
      return { label: "Profesional", variant: "prof" };
    case "patient":
      switch (sourceChannel) {
        case "vita_chat":
        case "vita_voice":
        case "vita_whatsapp":
          return { label: PATIENT_SOURCE_LABELS[sourceChannel], variant: "patient" };
        default:
          return { label: "Reportado por ti", variant: "patient" };
      }
    default:
      return null;
  }
}

export function isSupersededMeasurement({ status }: Pick<MeasurementItemDto, "status">) {
  return status === "superseded";
}
