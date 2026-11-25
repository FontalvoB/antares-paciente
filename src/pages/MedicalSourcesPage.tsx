import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonToolbar,
} from "@ionic/react";
import { chevronBack, openOutline } from "ionicons/icons";
import { Screen } from "../components/Screen";
import { useApp } from "../context/AppContext";
import { medicalSources } from "../data/medicalSources";
import { useT } from "../i18n/I18nContext";

export function MedicalSourcesPage() {
  const t = useT();
  const { medicalSourcesEntry, navigate, showToast } = useApp();
  const section = medicalSourcesEntry?.section;
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const sectionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!section) {
      pageHeading.current?.focus();
      return;
    }

    const frame = requestAnimationFrame(() => {
      sectionHeading.current?.focus({ preventScroll: true });
      sectionHeading.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);

  const openSource = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!Capacitor.isNativePlatform()) return;
    event.preventDefault();
    try {
      await Browser.open({
        url: event.currentTarget.href,
        presentationStyle: "popover",
      });
    } catch {
      showToast(
        t("No se pudo abrir el sitio web. Inténtalo más tarde."),
        "err",
      );
    }
  };

  return (
    <Screen hideNav className="medical-sources">
      <IonHeader>
        <IonToolbar>
          <div className="medical-sources-header">
            <IonButton
              fill="clear"
              aria-label={t("Volver")}
              onClick={() => navigate(medicalSourcesEntry?.returnTo ?? "prof")}
            >
              <IonIcon icon={chevronBack} slot="icon-only" aria-hidden="true" />
            </IonButton>
            <h1 ref={pageHeading} tabIndex={-1}>
              {t("Fuentes y referencias médicas")}
            </h1>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="medical-sources-content">
        <main className="medical-sources-body">
          <div className="medical-sources-intro">
            <p>{t("Última revisión: noviembre de 2026")}</p>
            <p>
              {t(
                "Esta información es educativa y no sustituye el consejo de un profesional de la salud.",
              )}
            </p>
          </div>
          {medicalSources.map(({ id, title, summary, sources }) => (
            <section
              key={id}
              className="medical-sources-section"
              aria-labelledby={`medical-heading-${id}`}
            >
              <h2
                id={`medical-heading-${id}`}
                ref={section === id ? sectionHeading : null}
                tabIndex={-1}
              >
                {t(title)}
              </h2>
              <p>{t(summary)}</p>
              {id === "wearable" && (
                <>
                  <p>
                    {t(
                      "Las lecturas de frecuencia cardíaca, SpO₂, variabilidad de la frecuencia cardíaca (HRV), temperatura, pasos y sueño son estimaciones de bienestar y pueden no ser exactas.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Este accesorio ofrece información general de bienestar y no sustituye la valoración de un profesional de la salud.",
                    )}
                  </p>
                  <p>
                    {t(
                      "Si tienes una emergencia, usa los servicios de emergencia locales o el botón SOS de la app.",
                    )}
                  </p>
                </>
              )}
              <IonList lines="none">
                {sources.map((source) => {
                  const sourceTitle = t(source.title);
                  const publisher = t("{organization} · {year}", {
                    organization: t(source.organization),
                    year: String(source.year),
                  });
                  return (
                    <IonItem key={source.url}>
                      <a
                        className="medical-source-link"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("Abrir {title} · {publisher}", {
                          title: sourceTitle,
                          publisher,
                        })}
                        onClick={(event) => void openSource(event)}
                      >
                        <span>
                          <span className="medical-source-title">
                            {sourceTitle}
                          </span>
                          <small>{publisher}</small>
                        </span>
                        <IonIcon icon={openOutline} aria-hidden="true" />
                      </a>
                    </IonItem>
                  );
                })}
              </IonList>
            </section>
          ))}
        </main>
      </IonContent>
    </Screen>
  );
}
