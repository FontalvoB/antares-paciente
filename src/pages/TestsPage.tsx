import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  IonButton,
  IonIcon,
  IonLoading,
  IonProgressBar,
  IonSpinner,
} from "@ionic/react";
import {
  calendar,
  checkmarkCircle,
  chevronBack,
  chevronForward,
  link,
  person,
  sparkles,
  star,
} from "ionicons/icons";
import { TESTS_META } from "../data/tests";
import { HEALTH_PROFILE } from "../data/healthProfile";
import { RingProgress } from "../components/RingProgress";
import { RadarChart } from "../components/tests/RadarChart";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n/I18nContext";
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
import { TestWizard, type WizardExtras } from "../components/tests/TestWizard";
import {
  buildBackendSteps,
  buildDemoSteps,
  FALLBACK_THEME,
  PATIENT_TITLES,
  themeFor,
  type TestTheme,
} from "../components/tests/model";

const EASE = [0.22, 1, 0.36, 1] as const;
const MIN_REQUIRED_TESTS = 3;

const CODE_TO_DEMO: Record<string, number> = {
  "historia-clinica": 1,
  temperamento: 2,
  nutricional: 3,
  movimiento: 4,
  sueno: 5,
  "iac-adresd": 6,
  orp: 7,
  ers: 8,
  "bateria-antares": 9,
};

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

/** Conserva los completados si el API aún no los incluye (p. ej. caché o lista solo-activa). */
function mergeAssignmentList(
  previous: MeAssignment[] | null,
  incoming: MeAssignment[],
): MeAssignment[] {
  const incomingIds = new Set(incoming.map((a) => a.id));
  const retained = (previous ?? []).filter(
    (a) => a.status === "completed" && !incomingIds.has(a.id),
  );
  return [...incoming.filter(isListedAssignment), ...retained];
}

export function TestsPage() {
  const { testsDone, markTest, skipTests, finishTests, showToast, navigate } =
    useApp();
  const t = useT();
  const reduce = useReducedMotion();

  const [assignments, setAssignments] = useState<MeAssignment[] | null>(null);
  const [openQuestions, setOpenQuestions] = useState<MeQuestion[] | null>(null);
  const [backendResults, setBackendResults] = useState<MeResult[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);
  const [openTitle, setOpenTitle] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Record<number, Record<number, number | number[] | string>>
  >({});
  const [openNotes, setOpenNotes] = useState<string[]>(["", "", "", ""]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  const listedAssignments = assignments?.filter(isListedAssignment) ?? null;
  const totalTests = listedAssignments ? listedAssignments.length : 9;
  const completed = listedAssignments
    ? listedAssignments.filter((a) => a.status === "completed").length
    : testsDone.length;
  const pct = Math.round((completed / Math.max(totalTests, 1)) * 100);

  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments()
      .then((list) => {
        if (!cancelled)
          setAssignments((prev) => mergeAssignmentList(prev, list));
      })
      .catch(() => {});
    fetchMyResults()
      .then((results) => {
        if (!cancelled) setBackendResults(results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const listItems = useMemo(() => {
    const nextDemo = (): number => {
      const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (n) => !testsDone.includes(n),
      );
      return remaining.length === 0 ? -1 : remaining[0];
    };
    if (assignments) {
      return assignments.filter(isListedAssignment).map((a, idx) => {
        const visual = themeFor(a.testCode ?? "");
        return {
          key: a.id,
          id: idx,
          assignmentId: a.id,
          title:
            PATIENT_TITLES[a.testCode ?? ""] ??
            a.testName ??
            `Evaluación ${idx + 1}`,
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
    return TESTS_META.map((test) => {
      const visual = themeFor(null, test.id);
      return {
        key: String(test.id),
        id: test.id,
        assignmentId: null as string | null,
        title: test.title,
        sub: test.sub,
        emoji: test.emoji,
        bg: visual.accentSoft,
        accent: visual.accent,
        mood: visual.mood,
        code: null as string | null,
        done: testsDone.includes(test.id),
        activeNow: !testsDone.includes(test.id) && test.id === nextDemo(),
      };
    });
  }, [assignments, testsDone]);

  const theme: TestTheme =
    openId !== null
      ? themeFor(openCode, assignments ? undefined : openId)
      : FALLBACK_THEME;

  const openTest = async (item: (typeof listItems)[number]) => {
    if (item.done) {
      showToast(t("Ya completaste esta evaluación"), "ok");
      return;
    }
    setOpenId(item.id);
    setOpenAssignmentId(item.assignmentId);
    setOpenTitle(item.title);
    setOpenCode(item.code);
    setOpenQuestions(null);
    if (item.assignmentId) {
      setQuestionsLoading(true);
      try {
        const detail = await fetchMyTest(item.assignmentId);
        setOpenQuestions(detail.questions);
      } catch {
        setOpenQuestions(null);
      } finally {
        setQuestionsLoading(false);
      }
    }
  };

  const closeTest = () => {
    setOpenId(null);
    setOpenAssignmentId(null);
    setOpenQuestions(null);
    setOpenCode(null);
  };

  const saveTest = async () => {
    if (openId === null) return;

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
        await startMyTest(openAssignmentId).catch(() => null);
        await submitMyTest(openAssignmentId, answersPayload);
        markTest(openId);
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
        const list = await fetchMyAssignments().catch(() => null);
        if (list) setAssignments((prev) => mergeAssignmentList(prev, list));
        showToast(t("Evaluación guardada"), "ok");
      } catch {
        showToast(t("No se pudo guardar la evaluación"), "err");
      } finally {
        setLoading(false);
        closeTest();
      }
      return;
    }

    markTest(openId);
    showToast(t("Evaluación guardada"), "ok");
    closeTest();
  };

  const openIA = () => {
    setShowResult(true);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1600);
  };

  const steps = useMemo(() => {
    if (openId === null) return [];
    if (openAssignmentId && openQuestions) {
      return buildBackendSteps(openQuestions, openTitle, theme);
    }
    if (openAssignmentId && questionsLoading) return [];
    const demoId = openCode ? (CODE_TO_DEMO[openCode] ?? openId) : openId;
    return buildDemoSteps(
      demoId,
      openTitle || TESTS_META.find((x) => x.id === demoId)?.title || "",
    );
  }, [
    openId,
    openAssignmentId,
    openQuestions,
    openTitle,
    theme,
    questionsLoading,
    openCode,
  ]);

  const resultScores = useMemo(() => {
    if (backendResults && backendResults.length > 0) {
      return backendResults
        .filter((r) => r.resultType === "subscale" || r.resultType === "score")
        .slice(0, HEALTH_PROFILE.dims.length)
        .map((r) => ({
          label: r.label,
          value: Math.min(100, Math.round(r.value)),
          color: "var(--cyan)",
        }));
    }
    return HEALTH_PROFILE.dims.map((d) => ({
      label: d.label,
      value: d.value,
      color: d.color,
    }));
  }, [backendResults]);

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
      className={`screen ht-page mood-${showResult ? "cosmos" : openId !== null ? theme.mood : "list"}`}
    >
      {showResult ? (
        <div className="hero ht-hero ht-hero-ghost">
          <div className="ht-hero-top">
            <IonButton
              fill="clear"
              className="ht-hero-back"
              aria-label={t("Volver")}
              onClick={() => setShowResult(false)}
            >
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
          </div>
        </div>
      ) : (
        <div className={`hero ${heroClass} ht-hero`}>
          <div className="ht-hero-orbs" aria-hidden="true" />
          <div className="ht-hero-top">
            {openId !== null && (
              <IonButton
                fill="clear"
                className="ht-hero-back"
                aria-label={t("Volver")}
                onClick={closeTest}
              >
                <IonIcon slot="icon-only" icon={chevronBack} />
              </IonButton>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kicker">{t("ANTARES · PERFIL DE SALUD")}</div>
              <div className="h2">
                {openId !== null
                  ? t(openTitle || theme.kicker)
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
                    "--background": "rgba(255,255,255,.12)",
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
        <HealthResult
          scores={resultScores}
          onEnter={finishTests}
          onCommunity={() => {
            finishTests();
            navigate("com");
          }}
        />
      ) : openId === null ? (
        <div className="screen-scroll no-nav ht-list">
          <p className="ht-lead">
            {t(
              "Completa al menos {n} evaluaciones para personalizar tu programa. El resto puedes hacerlo después.",
              { n: String(MIN_REQUIRED_TESTS) },
            )}
          </p>
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
          {canSkip && (
            <>
              <IonButton
                expand="block"
                className="bt bt-gold ht-cta"
                style={{ marginTop: 12 }}
                onClick={openIA}
              >
                {t("Ver mi perfil de salud ANTARES · IA")}
                <IonIcon icon={sparkles} slot="end" />
              </IonButton>
              {completed < totalTests && (
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
      ) : questionsLoading ? (
        <div className="ht-loading">
          <IonSpinner name="crescent" />
          <p>{t("Preparando tu evaluación…")}</p>
        </div>
      ) : (
        <TestWizard
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
          onComplete={() => void saveTest()}
        />
      )}

      <IonLoading
        className="app-loading"
        isOpen={loading}
        message={t("Analizando tu perfil…")}
      />
    </div>
  );
}

function HealthResult({
  scores,
  onEnter,
  onCommunity,
}: {
  scores: { label: string; value: number; color: string }[];
  onEnter: () => void;
  onCommunity: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  const p = useMemo(() => {
    const dims = HEALTH_PROFILE.dims.map((d, i) =>
      scores[i]
        ? {
            ...d,
            label: String(scores[i].label),
            value: scores[i].value,
            color: String(scores[i].color),
          }
        : d,
    );
    return { ...HEALTH_PROFILE, dims };
  }, [scores]);

  const fade = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 16 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: reduce ? 0 : i * 0.07, ease: EASE },
  });

  return (
    <div className="screen-scroll no-nav ht-result htp-page">
      <motion.div className="htp-hero" {...fade(0)}>
        <div className="htp-hero-orbs" aria-hidden="true" />
        <div className="htp-hero-top">
          <RingProgress
            value={p.ahs / 100}
            size={92}
            stroke={10}
            gradient={["#3d7b72", "#87aeca"]}
          >
            <b>{p.ahs}</b>
            <small>/100</small>
          </RingProgress>
          <div className="htp-hero-info">
            <div className="htp-hero-kicker">{t("Mi Perfil ANTARES")}</div>
            <div className="htp-hero-badges">
              <span className="htp-hero-cond">🫀 {t(p.condition)}</span>
              <span className="htp-hero-ahs">
                <IonIcon icon={star} />
                {t("AHS {score}/100", { score: String(p.ahs) })} ·{" "}
                {t(p.summary)}
              </span>
            </div>
          </div>
        </div>
        <div className="htp-chips">
          {p.chips.map((c) => (
            <span key={c.text} className="htp-chip">
              <span className="htp-chip-ico">{c.ico}</span>
              {t(c.text)}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div className="htp-banner" {...fade(1)}>
        <div className="htp-banner-ico">🩸</div>
        <div>
          <div className="htp-banner-title">{t(p.banner.title)}</div>
          <div className="htp-banner-text">{t(p.banner.text)}</div>
        </div>
      </motion.div>

      <motion.div className="htp-sec" {...fade(2)}>
        <span className="htp-sec-ico">📊</span>
        {t("Tus indicadores calculados")}
      </motion.div>
      <motion.div className="htp-metrics" {...fade(3)}>
        {p.indicators.map((m) => (
          <div key={m.label} className={`htp-metric ${m.tone}`}>
            <div className="htp-metric-ico">{m.ico}</div>
            <div className="htp-metric-value">{m.value}</div>
            <div className="htp-metric-unit">{t(m.unit)}</div>
            <span className="htp-metric-q">{t(m.qualifier)}</span>
            <div className="htp-metric-label">{t(m.label)}</div>
          </div>
        ))}
      </motion.div>
      <motion.p className="htp-footnote" {...fade(4)}>
        {t(p.footnote)}
      </motion.p>

      <motion.div className="htp-ai" {...fade(5)}>
        <div className="htp-ai-avatar">
          <IonIcon icon={sparkles} />
        </div>
        <div className="htp-ai-body">
          <div className="htp-ai-label">{t(p.ai.label)}</div>
          <p>{t(p.ai.message)}</p>
        </div>
      </motion.div>

      <motion.div className="htp-sec" {...fade(6)}>
        <span className="htp-sec-ico">📡</span>
        {t("Radar de 7 dimensiones")}
      </motion.div>
      <motion.div className="htp-card htp-radar" {...fade(7)}>
        <RadarChart dims={p.dims} />
        <div className="htp-dims">
          {p.dims.map((d) => (
            <div key={d.label} className="htp-dim">
              <span
                className="htp-dim-ico"
                style={{ background: `${d.color}1f` }}
              >
                {d.ico}
              </span>
              <div className="htp-dim-body">
                <div className="htp-dim-top">
                  <span>{t(d.label)}</span>
                  <strong>{d.value}</strong>
                </div>
                <div className="htp-dim-track">
                  <motion.div
                    className="htp-dim-fill"
                    style={{ background: d.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.value}%` }}
                    transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}
                  />
                </div>
                {d.note && <div className="htp-dim-note">{t(d.note)}</div>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="htp-sec" {...fade(8)}>
        <span className="htp-sec-ico">🧭</span>
        {t("Análisis DOFA")}
      </motion.div>
      <motion.div className="htp-dofa" {...fade(9)}>
        <div className="htp-dofa-card ok">
          <div className="htp-dofa-h">
            <span>✅</span>
            {t("Fortalezas")}
          </div>
          {p.dofa.f.map((x) => (
            <div className="htp-dofa-item" key={x}>
              {t(x)}
            </div>
          ))}
        </div>
        <div className="htp-dofa-card bad">
          <div className="htp-dofa-h">
            <span>⚠️</span>
            {t("Debilidades")}
          </div>
          {p.dofa.d.map((x) => (
            <div className="htp-dofa-item" key={x}>
              {t(x)}
            </div>
          ))}
        </div>
        <div className="htp-dofa-card op">
          <div className="htp-dofa-h">
            <span>🌟</span>
            {t("Oportunidades")}
          </div>
          {p.dofa.o.map((x) => (
            <div className="htp-dofa-item" key={x}>
              {t(x)}
            </div>
          ))}
        </div>
        <div className="htp-dofa-card th">
          <div className="htp-dofa-h">
            <span>🚨</span>
            {t("Amenazas")}
          </div>
          {p.dofa.a.map((x) => (
            <div className="htp-dofa-item" key={x}>
              {t(x)}
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="htp-sec" {...fade(10)}>
        <span className="htp-sec-ico">🔗</span>
        {t("Correlaciones detectadas")}
      </motion.div>
      {p.correlations.map((c, i) => (
        <motion.div
          key={c.title}
          className="htp-card htp-corr"
          style={{ borderLeftColor: c.color }}
          {...fade(11 + i)}
        >
          <div className="htp-corr-top">
            <IonIcon icon={link} style={{ color: c.color }} />
            <strong>{t(c.title)}</strong>
          </div>
          <p>{t(c.text)}</p>
        </motion.div>
      ))}

      <motion.div className="htp-sec" {...fade(13)}>
        <span className="htp-sec-ico">🎯</span>
        {t("Plan de intervención priorizado")}
      </motion.div>
      <motion.div className="htp-plan" {...fade(14)}>
        {p.plan.map((item, i) => {
          const inner = (
            <>
              <span className="htp-plan-num" style={{ background: item.color }}>
                {i + 1}
              </span>
              <div className="htp-plan-body">
                <div className="htp-plan-title">{t(item.title)}</div>
                <div className="htp-plan-meta">
                  <span
                    className="htp-plan-spec"
                    style={{ color: item.color, background: `${item.color}1a` }}
                  >
                    {t(item.specialty)}
                  </span>
                  {item.prof && (
                    <span className="htp-plan-prof">
                      <IonIcon icon={person} />
                      {t(item.prof)}
                    </span>
                  )}
                  {item.week && (
                    <span className="htp-plan-week">
                      <IonIcon icon={calendar} />
                      {t(item.week)}
                    </span>
                  )}
                </div>
              </div>
              {item.action ? (
                <span className="htp-plan-cta">{t("Ver en comunidad")}</span>
              ) : (
                <IonIcon icon={chevronForward} className="htp-plan-chev" />
              )}
            </>
          );
          return item.action ? (
            <button
              key={item.title}
              type="button"
              className="htp-plan-item"
              onClick={onCommunity}
            >
              {inner}
            </button>
          ) : (
            <div key={item.title} className="htp-plan-item">
              {inner}
            </div>
          );
        })}
      </motion.div>

      <IonButton
        expand="block"
        className="bt bt-gold ht-cta"
        style={{ marginTop: 14 }}
        onClick={onEnter}
      >
        {t("Entrar a mi programa ANTARES")}
      </IonButton>
    </div>
  );
}
