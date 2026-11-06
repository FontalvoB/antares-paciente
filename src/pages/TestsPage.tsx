import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  IonButton,
  IonIcon,
  IonSkeletonText,
  IonProgressBar,
  IonSpinner,
} from "@ionic/react";
import {
  checkmarkCircle,
  arrowBackOutline,
  chevronForward,
  sparkles,
} from "ionicons/icons";
import { useApp } from "../context/AppContext";
import { useI18n } from "../i18n/I18nContext";
import { requestLanguage } from "../utils/requestLanguage";
import { ApiError } from "../utils/apiClient";
import { localizedError } from "../utils/localizedError";
import {
  fetchMyAssignments,
  fetchMyResults,
  fetchMyTest,
  startMyTest,
  submitMyTest,
  type MeAssignment,
  type MeQuestion,
  type MeResult,
} from "../utils/healthTestsApi";
import { AssessmentResults } from "../components/tests/AssessmentResults";
import { TestWizard, type WizardExtras } from "../components/tests/TestWizard";
import {
  buildBackendSteps,
  FALLBACK_THEME,
  PATIENT_TITLES,
  themeFor,
  type TestTheme,
} from "../components/tests/model";

const EASE = [0.22, 1, 0.36, 1] as const;
const MIN_REQUIRED_TESTS = 3;

function stateLabel(status: MeAssignment["status"]): string {
  if (status === "completed") return "Completado";
  if (status === "in_progress") return "En curso";
  return "Pendiente";
}

function isListedAssignment(a: MeAssignment): boolean {
  return (
    a.status === "pending" ||
    a.status === "in_progress" ||
    a.status === "completed"
  );
}

/** Conserva estados completados, pero solo retiene tarjetas ausentes del mismo idioma. */
function mergeAssignmentList(
  previous: MeAssignment[] | null,
  incoming: MeAssignment[],
  retainMissing = true,
): MeAssignment[] {
  const incomingIds = new Set(incoming.map((a) => a.id));
  const retained = (previous ?? []).filter(
    (a) => retainMissing && a.status === "completed" && !incomingIds.has(a.id),
  );
  return [...incoming.filter(isListedAssignment).map(a => {
    const confirmed = previous?.find(p => p.id === a.id && p.status === "completed");
    return confirmed && (a.status === "pending" || a.status === "in_progress")
      ? { ...a, status: confirmed.status, completedAt: confirmed.completedAt } : a;
  }), ...retained];
}

interface AssessmentReadError {
  language: "es" | "en";
  error: unknown;
}

export function TestsPage() {
  const { skipTests, finishTests, showToast, navigate } =
    useApp();
  const i18n = useI18n();
  const { t, lang } = i18n;
  const languageRef = useRef(lang);
  languageRef.current = lang;
  const readErrorText = (error: unknown, fallback: string) => error instanceof ApiError && error.code === "CONTENT_TRANSLATION_UNAVAILABLE"
    ? localizedError(error, i18n, fallback) : t(fallback);
  const reduce = useReducedMotion();

  const [assignments, setAssignments] = useState<MeAssignment[] | null>(null);
  const [openQuestions, setOpenQuestions] = useState<MeQuestion[] | null>(null);
  const [backendResults, setBackendResults] = useState<MeResult[] | null>(null);
  const [assignmentsLanguage, setAssignmentsLanguage] = useState(lang);
  const [resultsLanguage, setResultsLanguage] = useState(lang);
  const [questionsLanguage, setQuestionsLanguage] = useState(lang);
  const questionsRef = useRef(openQuestions);
  questionsRef.current = openQuestions;
  const [questionsError, setQuestionsError] = useState<unknown>(null);
  const [questionsRetry, setQuestionsRetry] = useState(0);
  const [resultsError, setResultsError] = useState<AssessmentReadError | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<AssessmentReadError | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [openId, setOpenId] = useState<number | null>(null);
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);
  const [openTitle, setOpenTitle] = useState({ text: "", language: lang });
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Record<number, Record<number, number | number[] | string>>
  >({});
  const [openNotes, setOpenNotes] = useState<string[]>(["", "", "", ""]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentAssignmentsError = assignmentsError?.language === lang ? assignmentsError : null;
  const currentResultsError = resultsError?.language === lang ? resultsError : null;
  const visibleAssignments = assignmentsLanguage === lang ? assignments : null;
  const visibleResults = resultsLanguage === lang ? backendResults : null;
  const listedAssignments = visibleAssignments?.filter(isListedAssignment) ?? null;
  const totalTests = listedAssignments?.length ?? 0;
  const completed = listedAssignments
    ? listedAssignments.filter((a) => a.status === "completed").length
    : 0;
  const pct = Math.round((completed / Math.max(totalTests, 1)) * 100);

  useEffect(() => {
    let cancelled = false;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    setResultsError(null);
    fetchMyAssignments()
      .then((list) => {
        if (!cancelled) {
          setAssignments((prev) => mergeAssignmentList(prev, list, assignmentsLanguage === lang));
          setAssignmentsLanguage(lang);
        }
      })
      .catch(error => { if (!cancelled) setAssignmentsError({ language: lang, error }); })
      .finally(() => { if (!cancelled) setAssignmentsLoading(false); });
    fetchMyResults()
      .then((results) => {
        if (!cancelled) { setBackendResults(results); setResultsError(null); setResultsLanguage(lang); }
      })
      .catch(error => { if (!cancelled) setResultsError({ language: lang, error }); });
    return () => {
      cancelled = true;
    };
    // El idioma del dato confirmado solo cambia con una respuesta correcta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, lang]);

  const retryReads = () => {
    setAssignmentsError(null);
    setResultsError(null);
    setAssignmentsLoading(true);
    setRefreshKey(key => key + 1);
  };

  const listItems = useMemo(() => {
    if (visibleAssignments) {
      return visibleAssignments.filter(isListedAssignment).map((a, idx) => {
        const visual = themeFor(a.testCode ?? "");
        return {
          key: a.id,
          id: idx,
          assignmentId: a.id,
          title:
            PATIENT_TITLES[a.testCode ?? ""] ??
            a.testName ??
            "Evaluación",
          sub: visual.sub || stateLabel(a.status),
          emoji: visual.emoji,
          bg: visual.accentSoft,
          accent: visual.accent,
          mood: visual.mood,
          code: a.testCode,
          done: a.status === "completed",
          activeNow: a.status === "in_progress",
        };
      });
    }
    return [];
  }, [visibleAssignments]);

  const theme: TestTheme =
    openId !== null
      ? themeFor(openCode)
      : FALLBACK_THEME;

  const openTest = (item: (typeof listItems)[number]) => {
    if (item.done) {
      showToast(t("Ya completaste esta evaluación"), "ok");
      return;
    }
    setOpenId(item.id);
    setOpenAssignmentId(item.assignmentId);
    setOpenTitle({ text: item.title, language: lang });
    setOpenCode(item.code);
    setOpenQuestions(null);
    setQuestionsError(null);
    setQuestionsLoading(true);
  };

  useEffect(() => {
    if (!openAssignmentId) return;
    let cancelled = false;
    const hadQuestions = questionsRef.current !== null;
    setQuestionsLoading(true);
    setQuestionsError(null);
    void fetchMyTest(openAssignmentId).then(detail => {
      if (cancelled) return;
      if (!detail.questions.length) throw new Error("No questions");
      setOpenQuestions(detail.questions);
      setQuestionsLanguage(lang);
      if (detail.name?.trim()) setOpenTitle({ text: detail.name, language: lang });
    }).catch(error => {
      if (cancelled) return;
      if (hadQuestions) setQuestionsError(error || new Error("Questions unavailable"));
      else { setOpenId(null); setOpenAssignmentId(null); setOpenQuestions(null); }
      showToast(t("No se pudieron cargar las preguntas. Intenta nuevamente."), "err");
    }).finally(() => { if (!cancelled) setQuestionsLoading(false); });
    return () => { cancelled = true; };
    // Solo cambia la copia de presentación; conserva respuestas y la posición del wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAssignmentId, lang, questionsRetry]);

  const closeTest = () => {
    setOpenId(null);
    setOpenAssignmentId(null);
    setOpenQuestions(null);
    setOpenCode(null);
    setQuestionsError(null);
  };

  const saveTest = async () => {
    if (loading || openId === null || !openAssignmentId || !openQuestions?.length) return;

    if (openAssignmentId) {
      setLoading(true);
      try {
        const questions = openQuestions ?? [];
        const answersPayload = questions.flatMap((q, qi) => {
          const value = answers[openId]?.[qi];
          if (q.type === "multi") {
            const selected: number[] = Array.isArray(value) ? value : [];
            return selected.map((vi) => ({
              questionId: q.id,
              answerOptionId: q.options[vi]?.id ?? null,
            }));
          }
          if (q.type === "open" || q.type === "num") {
            return [
              {
                questionId: q.id,
                answerOptionId: null,
                valueText: String(value ?? ""),
              },
            ];
          }
          const option =
            value !== undefined ? q.options[value as number] : null;
          return [
            {
              questionId: q.id,
              answerOptionId: option?.id ?? null,
            },
          ];
        });
        await startMyTest(openAssignmentId);
        await submitMyTest(openAssignmentId, answersPayload);
        setAssignments((prev) =>
          prev
            ? prev.map((a) =>
                a.id === openAssignmentId
                  ? {
                      ...a,
                      status: "completed",
                      completedAt: new Date().toISOString(),
                    }
                  : a,
              )
            : prev,
        );
        const listLanguage = requestLanguage();
        await fetchMyAssignments().then(list => {
          if (listLanguage !== languageRef.current) return;
          setAssignments((prev) => mergeAssignmentList(prev, list, assignmentsLanguage === listLanguage));
          setAssignmentsLanguage(listLanguage);
          setAssignmentsError(null);
        }).catch(error => {
          if (listLanguage === languageRef.current) setAssignmentsError({ language: listLanguage, error });
        });
        const resultLanguage = requestLanguage();
        await fetchMyResults().then(results => {
          if (resultLanguage !== languageRef.current) return;
          setBackendResults(results);
          setResultsError(null);
          setResultsLanguage(resultLanguage);
        }).catch(error => {
          if (resultLanguage === languageRef.current) setResultsError({ language: resultLanguage, error });
        });
        showToast(t("Evaluación guardada"), "ok");
        closeTest();
      } catch {
        showToast(t("No se pudo guardar la evaluación"), "err");
      } finally {
        setLoading(false);
      }
      return;
    }

  };

  const openIA = () => setShowResult(true);

  const displayedTitle = listItems.find(item => item.assignmentId === openAssignmentId)?.title
    ?? (openTitle.language === lang ? openTitle.text : PATIENT_TITLES[openCode ?? ""] ?? theme.kicker);
  const steps = useMemo(() => {
    if (openId === null || !openAssignmentId || !openQuestions) return [];
    return buildBackendSteps(openQuestions, displayedTitle, theme);
  }, [openId, openAssignmentId, openQuestions, displayedTitle, theme]);

  const currentAnswers = openId !== null ? (answers[openId] ?? {}) : {};
  const canSkip = completed >= MIN_REQUIRED_TESTS;

  const trySkip = () => {
    if (!canSkip) {
      showToast(
        t("Completa al menos {n} evaluaciones para poder omitir el resto", {
          n: String(MIN_REQUIRED_TESTS),
        }),
        "warn",
      );
      return;
    }
    if (completed < 9) showToast(t("Tu plan queda pendiente hasta completar las 9 evaluaciones."), "warn");
    skipTests();
  };

  const extras: WizardExtras = {
    openNotes,
    onOpenNote: (i, value) => {
      setOpenNotes((prev) => {
        const next = [...prev];
        next[i] = value;
        return next;
      });
      if (openAssignmentId && openId !== null) {
        setAnswers((a) => ({
          ...a,
          [openId]: { ...(a[openId] ?? {}), [i]: value },
        }));
      }
    },
  };

  const heroClass = openId !== null ? theme.hero : "hero-cosmos";

  return (
    <div
      className={`screen ht-page mood-${showResult ? "results" : openId !== null ? theme.mood : "list"}`}
    >
      {showResult ? (
        <div className="hero ht-hero ar-hero">
          <div className="ht-hero-top">
            <IonButton
              fill="clear"
              className="ht-hero-back"
              aria-label={t("Volver")}
              onClick={() => setShowResult(false)}
            >
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
            <div className="ar-hero-copy">
              <div className="ar-eyebrow">{t("TU PERFIL DE SALUD")}</div>
              <h1>{t("Resultados de tus evaluaciones")}</h1>
              <p>{t("Conoce tus resultados, a tu ritmo.")}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`hero ${heroClass} ht-hero`}>
          <div className="ht-hero-orbs" aria-hidden="true" />
          <div className="ht-hero-top">
            <IonButton
              fill="clear"
              className="ht-hero-back"
              aria-label={t("Volver")}
              onClick={openId !== null ? closeTest : skipTests}
            >
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker">{t("COPP ADRESD · PERFIL DE SALUD")}</div>
              <div className="h2">
                {openId !== null
                  ? t(displayedTitle || theme.kicker)
                  : t("Batería de evaluación inicial")}
              </div>
            </div>
            {canSkip && (
              <IonButton fill="solid" className="bt ht-skip" onClick={trySkip}>
                {t("Después")}
              </IonButton>
            )}
          </div>
          {openId === null && (
            <>
              <div className="ht-hero-meta">
                <span>
                  {t("{completed} de {total} evaluaciones", {
                    completed: String(completed),
                    total: String(totalTests),
                  })}
                </span>
                <span>{pct}%</span>
              </div>
              <IonProgressBar
                className="pb"
                style={
                  {
                    marginTop: 8,
                    "--background": "var(--g1)",
                    "--progress-background":
                      "linear-gradient(90deg,var(--teal),var(--cyan))",
                  } as CSSProperties
                }
                value={pct / 100}
              />
            </>
          )}
        </div>
      )}

      {showResult ? (
        <>
          {currentResultsError && <div role="alert" className="ht-loading">
            <p>{readErrorText(currentResultsError.error, "No se pudieron cargar los resultados.")}</p>
            <IonButton onClick={retryReads}>{t("Reintentar")}</IonButton>
          </div>}
          {(!currentResultsError || visibleResults !== null) && <AssessmentResults
            results={visibleResults ?? []}
            loading={visibleResults === null && !currentResultsError}
            error={false}
            onEnter={() => {
              finishTests();
              navigate("prof");
            }}
            onCommunity={() => {
              finishTests();
              navigate("com");
            }}
          />}
        </>
      ) : openId === null ? (
        <div className="screen-scroll no-nav ht-list">
          <p className="ht-lead">
            {t(
              "Puedes omitir el resto después de {n} evaluaciones. Tu plan queda pendiente hasta completar las 9 evaluaciones.",
              { n: String(MIN_REQUIRED_TESTS) },
            )}
          </p>
          {assignmentsLoading || (assignmentsLanguage !== lang && !currentAssignmentsError) ? <div className="ht-loading-list" role="status" aria-label={t("Cargando tus evaluaciones…")}>
            <div className="ht-loading-caption"><IonSpinner name="crescent" /><span>{t("Estamos preparando tu perfil de salud")}</span></div>
            {[0, 1, 2].map(index => <div key={index} className="ht-loading-card" aria-hidden="true"><IonSkeletonText animated className="ht-loading-icon" /><div><IonSkeletonText animated style={{ width: "78%" }} /><IonSkeletonText animated style={{ width: "95%" }} /></div></div>)}
          </div> : currentAssignmentsError ? (
            <div role="alert">
              <p>{readErrorText(currentAssignmentsError.error, "No se pudieron cargar tus evaluaciones.")}</p>
              <IonButton onClick={retryReads}>{t("Reintentar")}</IonButton>
            </div>
          ) : listItems.length === 0 ? <p>{t("No tienes evaluaciones asignadas.")}</p> : null}
          {listItems.map((test, i) => (
            <motion.button
              key={test.key}
              type="button"
              className={`ht-list-card ${test.done ? "done" : ""} ${test.activeNow ? "now" : ""}`}
              onClick={() => void openTest(test)}
              aria-disabled={test.done || undefined}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.38,
                delay: reduce ? 0 : i * 0.05,
                ease: EASE,
              }}
            >
              <div
                className="ht-list-accent"
                style={{ background: test.accent }}
              />
              <div className="ht-list-ico" style={{ background: test.bg }}>
                {test.emoji}
              </div>
              <div className="ht-list-body">
                <div className="ht-list-title">
                  {i + 1}. {t(test.title)}
                </div>
                <div className="ht-list-sub">{t(test.sub)}</div>
              </div>
              <span
                className={`ht-list-badge ${test.done ? "ok" : test.activeNow ? "hot" : ""}`}
              >
                {test.done ? (
                  <>
                    <IonIcon icon={checkmarkCircle} />
                    {t("Hecho")}
                  </>
                ) : test.activeNow ? (
                  t("Ahora")
                ) : (
                  t("Pendiente")
                )}
              </span>
              {!test.done && (
                <IonIcon icon={chevronForward} className="ht-list-chev" />
              )}
            </motion.button>
          ))}
          {completed > 0 && (
            <>
              <IonButton
                expand="block"
                className="bt bt-gold ht-cta"
                style={{ marginTop: 12 }}
                onClick={openIA}
              >
                {t("Resultados de tus evaluaciones")}
                <IonIcon icon={sparkles} slot="end" />
              </IonButton>
              {canSkip && completed < totalTests && (
                <IonButton
                  expand="block"
                  fill="outline"
                  className="bt bt-ghost ht-cta"
                  style={{ marginTop: 8 }}
                  onClick={trySkip}
                >
                  {t("Omitir el resto")}
                </IonButton>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {questionsError ? <div role="alert" className="ht-loading">
            <p>{readErrorText(questionsError, "No se pudieron cargar las preguntas. Intenta nuevamente.")}</p>
            <IonButton onClick={() => setQuestionsRetry(value => value + 1)}>{t("Reintentar")}</IonButton>
          </div> : (questionsLoading || questionsLanguage !== lang) && <div className="ht-loading">
            <IonSpinner name="crescent" /><p>{t("Preparando tu evaluación…")}</p>
          </div>}
          {openQuestions && <TestWizard
          hidden={questionsLoading || questionsLanguage !== lang || Boolean(questionsError)}
          theme={theme}
          steps={steps}
          answers={currentAnswers}
          extras={extras}
          onScale={(index, value) => {
            if (openId === null) return;
            setAnswers((a) => ({
              ...a,
              [openId]: { ...(a[openId] ?? {}), [index]: value },
            }));
          }}
          onNum={(index, value) => {
            if (openId === null) return;
            setAnswers((a) => ({
              ...a,
              [openId]: { ...(a[openId] ?? {}), [index]: value },
            }));
          }}
          onBackendMulti={(index, option) => {
            if (openId === null) return;
            setAnswers((a) => {
              const cur = (a[openId]?.[index] as number[] | undefined) ?? [];
              const next = cur.includes(option)
                ? cur.filter((x) => x !== option)
                : [...cur, option];
              return {
                ...a,
                [openId]: { ...(a[openId] ?? {}), [index]: next },
              };
            });
          }}
          saving={loading}
          onComplete={() => void saveTest()}
        />}
        </>
      )}


    </div>
  );
}
