import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  IonButton,
  IonLoading,
  IonProgressBar,
  IonTextarea,
} from "@ionic/react";
import {
  ADHER_QS,
  ANTECS,
  CARDIO_QS,
  FAM_HX,
  MOV_QS,
  NUT_QS,
  PRIORITIES,
  PURPOSE_OPEN,
  PURPOSE_SCALE,
  SISTEMAS,
  SLEEP_FLAGS,
  SLEEP_QS,
  STRESS_QS,
  TEMP_QS,
  TESTS_META,
  type ScaleQ,
} from "../data/tests";
import { ChipGrid, ScaleList } from "../components/Forms";
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

const SCALE: Record<number, string[]> = {
  2: ["1", "2", "3", "4", "5"],
  3: ["1", "2", "3", "4", "5"],
  4: ["0", "1", "2", "3"],
  5: ["0", "1", "2", "3", "4"],
  6: ["0", "1", "2", "3", "4"],
  7: ["0", "1", "2", "3"],
  8: ["0", "1", "2", "3", "4"],
  9: ["1", "2", "3", "4", "5"],
};

const QMAP: Record<number, ScaleQ[]> = {
  2: TEMP_QS,
  3: NUT_QS,
  4: MOV_QS,
  5: SLEEP_QS,
  6: ADHER_QS,
  7: CARDIO_QS,
  8: STRESS_QS,
  9: PURPOSE_SCALE,
};

/** Resultado demo (fallback sin backend): scores por dimensión de la UX original. */
const DEMO_SCORES: { label: string; value: number; color: string }[] = [
  { label: "Metabolismo", value: 62, color: "#E87B2B" },
  { label: "Nutrición", value: 74, color: "#1D9E75" },
  { label: "Movimiento", value: 58, color: "#1B6CA8" },
  { label: "Sueño", value: 51, color: "#7C3AED" },
  { label: "Adherencia", value: 81, color: "var(--cyan)" },
  { label: "Estrés", value: 44, color: "#E24B4A" },
];

/**
 * Identidad visual de cada test de la batería ANTARES por su código del
 * catálogo (mismos emojis/colores que TESTS_META). El backend expone
 * `testCode` (código del instrumento) en cada asignación.
 */
const TEST_VISUALS: Record<string, { emoji: string; bg: string; sub: string }> =
  {
    "historia-clinica": {
      emoji: "🩺",
      bg: "#E8F5FF",
      sub: "Antecedentes · Examen físico · Sistemas",
    },
    temperamento: {
      emoji: "🧠",
      bg: "#F3EFFE",
      sub: "Sanguíneo · Colérico · Melancólico · Flemático",
    },
    nutricional: {
      emoji: "🥗",
      bg: "#E1F5EE",
      sub: "Alimentación · Conducta · Motivación",
    },
    movimiento: {
      emoji: "🏃",
      bg: "#FFF0E8",
      sub: "AMAF · Nivel funcional · Capacidad",
    },
    sueno: {
      emoji: "🌙",
      bg: "#EDE9FE",
      sub: "Duración · Calidad · Hábitos · Riesgos",
    },
    "iac-adresd": {
      emoji: "🤝",
      bg: "#E6F1FB",
      sub: "Motivación · Autoeficacia · Compromiso",
    },
    orp: {
      emoji: "❤️",
      bg: "#FCEBEB",
      sub: "OMS · Obesidad · Complicaciones · Riesgo",
    },
    ers: {
      emoji: "⚡",
      bg: "#FAEEDA",
      sub: "Familia · Pareja · Trabajo · Entorno social",
    },
    "bateria-antares": {
      emoji: "🧬",
      bg: "#FDF6DC",
      sub: "PHS · Propósito · Mentalidad · Perfil final",
    },
  };

function testVisual(code: string): { emoji: string; bg: string; sub: string } {
  const visual = TEST_VISUALS[code];
  return visual
    ? { emoji: visual.emoji, bg: visual.bg, sub: visual.sub }
    : { emoji: "📋", bg: "#E8F5FF", sub: "" };
}

/** Etiqueta de estado para tests sin descripción conocida (fallback). */
function stateLabel(status: MeAssignment["status"]): string {
  if (status === "completed") return "Completado";
  if (status === "in_progress") return "En curso";
  return "Pendiente";
}

export function TestsPage() {
  const { testsDone, markTest, skipTests, finishTests, showToast } = useApp();
  const t = useT();

  // Estado backend: asignaciones reales + detalle del test abierto.
  const [assignments, setAssignments] = useState<MeAssignment[] | null>(null);
  const [openQuestions, setOpenQuestions] = useState<MeQuestion[] | null>(null);
  const [backendResults, setBackendResults] = useState<MeResult[] | null>(null);

  const [openId, setOpenId] = useState<number | null>(null);
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Record<number, Record<number, number | number[] | string>>
  >({});
  const [chips, setChips] = useState<number[]>([]);
  const [fam, setFam] = useState<number[]>([]);
  const [flags, setFlags] = useState<number[]>([]);
  const [priority, setPriority] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sisOpen, setSisOpen] = useState<number | null>(0);
  const [sisSel, setSisSel] = useState<Record<number, number[]>>({});

  // La batería llega del backend (assignments); fallback a los 9 tests demo.
  const totalTests = assignments ? assignments.length : 9;
  const completed = assignments
    ? assignments.filter((a) => a.status === "completed").length
    : testsDone.length;
  const pct = Math.round((completed / Math.max(totalTests, 1)) * 100);

  // Carga asignaciones + resultados reales al montar (degradación demo si no hay sesión).
  useEffect(() => {
    let cancelled = false;
    fetchMyAssignments()
      .then((list) => {
        if (!cancelled) setAssignments(list);
      })
      .catch(() => {
        // Sin sesión/backend: la app degrada a la batería demo (TESTS_META).
      });
    fetchMyResults()
      .then((results) => {
        if (!cancelled) setBackendResults(results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Card de la lista: backend (title de la asignación) o demo (TESTS_META).
  // Cuando el backend cargó (assignments !== null), se respeta su resultado
  // aunque sea vacío (batería completada) — no se mezcla con el demo.
  const listItems = useMemo(() => {
    const nextDemo = (): number => {
      const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (n) => !testsDone.includes(n),
      );
      return remaining.length === 0 ? -1 : remaining[0];
    };
    if (assignments) {
      return assignments.map((a, idx) => {
        const visual = testVisual(a.testCode ?? "");
        return {
          key: a.id,
          id: idx,
          assignmentId: a.id,
          title: a.testName ?? `Evaluación ${idx + 1}`,
          sub: visual.sub || stateLabel(a.status),
          emoji: visual.emoji,
          bg: visual.bg,
          done: a.status === "completed",
          activeNow: a.status === "in_progress",
        };
      });
    }
    return TESTS_META.map((test) => ({
      key: String(test.id),
      id: test.id,
      assignmentId: null,
      title: test.title,
      sub: test.sub,
      emoji: test.emoji,
      bg: test.bg,
      done: testsDone.includes(test.id),
      activeNow: !testsDone.includes(test.id) && test.id === nextDemo(),
    }));
  }, [assignments, testsDone]);

  const meta = assignments ? null : TESTS_META.find((t) => t.id === openId);

  const toggle = (list: number[], set: (n: number[]) => void, i: number) =>
    set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);

  const openTest = async (item: (typeof listItems)[number]) => {
    setOpenId(item.id);
    setOpenAssignmentId(item.assignmentId);
    setOpenQuestions(null);
    if (item.assignmentId) {
      try {
        const detail = await fetchMyTest(item.assignmentId);
        setOpenQuestions(detail.questions);
      } catch {
        // Degrada a la pregunta demo del índice (sin backend).
      }
    }
  };

  const saveTest = async () => {
    if (openId === null) return;

    // Con backend: inicia (si hace falta) y envía las respuestas.
    if (openAssignmentId) {
      setLoading(true);
      try {
        const questions = openQuestions ?? [];
        // Para multi: una respuesta por opción seleccionada; para el resto,
        // una respuesta con la opción elegida (o texto libre).
        const answersPayload = questions.flatMap((q, qi) => {
          const value = answers[openId]?.[qi];
          if (q.type === "multi") {
            const selected: number[] = Array.isArray(value) ? value : [];
            return selected.map((vi) => ({
              questionId: q.id,
              answerOptionId: q.options[vi]?.id ?? null,
            }));
          }
          if (q.type === "open") {
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
        // Refresca asignaciones (el estado de la lista cambia a completed).
        const list = await fetchMyAssignments().catch(() => null);
        if (list) setAssignments(list);
        showToast(t("Evaluación guardada"), "ok");
      } catch {
        showToast(t("No se pudo guardar la evaluación"), "err");
      } finally {
        setLoading(false);
        setOpenId(null);
        setOpenAssignmentId(null);
      }
      return;
    }

    // Modo demo (sin backend).
    markTest(openId);
    showToast(t("Evaluación guardada"), "ok");
    setOpenId(null);
  };

  const openIA = () => {
    setShowResult(true);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1600);
  };

  // Preguntas del test abierto: backend (si cargó) o demo (QMAP).
  // MeQuestion → ScaleQ (el render de escala solo usa text/section).
  const activeQuestions: ScaleQ[] = openQuestions
    ? openQuestions.map((q) => ({
        text: q.text,
        section: q.section ?? undefined,
      }))
    : openId !== null
      ? (QMAP[openId] ?? [])
      : [];
  const activeScale = openId !== null ? SCALE[openId] : [];

  // Scores del resultado: backend real (subescalas/indicadores) o demo.
  const resultScores = useMemo(() => {
    if (backendResults && backendResults.length > 0) {
      return backendResults
        .filter((r) => r.resultType === "subscale" || r.resultType === "score")
        .slice(0, 6)
        .map((r) => ({
          label: r.label,
          value: Math.min(100, Math.round(r.value)),
          color: "var(--cyan)",
        }));
    }
    return DEMO_SCORES;
  }, [backendResults]);

  return (
    <div className="screen" style={{ background: "#fff" }}>
      <div className="hero hero-cosmos">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {openId !== null && (
            <button
              onClick={() => setOpenId(null)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255,255,255,.1)",
                border: "none",
                color: "#fff",
                fontSize: 18,
              }}
            >
              ←
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div className="kicker">{t("ANTARES · PERFIL DE SALUD")}</div>
            <div className="h2">
              {meta?.title ?? t("Batería de evaluación inicial")}
            </div>
          </div>
          <button
            onClick={skipTests}
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              color: "rgba(255,255,255,.7)",
              borderRadius: 10,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {t("Después")}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "rgba(255,255,255,.5)",
            marginTop: 12,
          }}
        >
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
              marginTop: 6,
              "--background": "rgba(255,255,255,.12)",
              "--progress-background":
                "linear-gradient(90deg,var(--teal),var(--cyan))",
            } as CSSProperties
          }
          value={pct / 100}
        />
      </div>

      {showResult ? (
        <div className="screen-scroll no-nav" style={{ padding: 14 }}>
          <>
            <div
              style={{
                background: "linear-gradient(145deg,#102a50,#173c73)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >
              {resultScores.map((s) => (
                <div
                  key={String(s.label)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 92,
                      fontSize: 11,
                      color: "rgba(255,255,255,.6)",
                    }}
                  >
                    {t(String(s.label))}
                  </span>
                  <IonProgressBar
                    className="pb"
                    style={
                      {
                        flex: 1,
                        "--background": "rgba(255,255,255,.1)",
                        "--progress-background": String(s.color),
                      } as CSSProperties
                    }
                    value={Number(s.value) / 100}
                  />
                  <span
                    style={{
                      width: 28,
                      fontSize: 11,
                      color: "#fff",
                      textAlign: "right",
                    }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="card"
              style={{ marginBottom: 10, borderColor: "var(--pur)" }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--pur)",
                  marginBottom: 8,
                }}
              >
                {t("🤖 ANTARES AI")}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                {t(
                  "Perfil de riesgo bajo-moderado. Prediabetes (HbA1c 5.9%) con buena adherencia (81%) y temperamento mixto sanguíneo-flemático. Prioriza sueño, control glucémico y movimiento progresivo de 12 min/día.",
                )}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                className="card"
                style={{ marginBottom: 0, borderColor: "var(--grn)" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--grn)",
                    marginBottom: 6,
                  }}
                >
                  {t("Fortalezas")}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  Adherencia alta · Apoyo familiar · Motivación clara
                </div>
              </div>
              <div
                className="card"
                style={{ marginBottom: 0, borderColor: "var(--red)" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--red)",
                    marginBottom: 6,
                  }}
                >
                  {t("Riesgos")}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  Prediabetes · Sueño 6.8h · Antecedente familiar DM2
                </div>
              </div>
            </div>
            <IonButton
              expand="block"
              className="bt bt-gold"
              onClick={finishTests}
              style={{ marginTop: 8 }}
            >
              {t("Entrar a mi programa ANTARES")}
            </IonButton>
          </>
        </div>
      ) : openId === null ? (
        <div className="screen-scroll no-nav" style={{ padding: 14 }}>
          <p style={{ fontSize: 13, color: "var(--mu)", lineHeight: 1.6 }}>
            {t(
              "Completa las evaluaciones para personalizar tu programa. Puedes guardar y continuar cuando quieras.",
            )}
          </p>
          {listItems.map((test) => (
            <button
              key={test.key}
              className={`ts-card ${test.done ? "done" : ""} ${test.activeNow ? "active-now" : ""}`}
              onClick={() => void openTest(test)}
            >
              <div className="ts-ico" style={{ background: test.bg }}>
                {test.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {test.id + 1}. {test.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 2 }}>
                  {test.sub}
                </div>
              </div>
              <span
                className={`chip ${test.done ? "chip-teal" : test.activeNow ? "chip-org" : "chip-blue"}`}
                style={{ fontSize: 10 }}
              >
                {test.done
                  ? t("Hecho")
                  : test.activeNow
                    ? t("Ahora")
                    : t("Pendiente")}
              </span>
            </button>
          ))}
          {completed >= 3 && (
            <IonButton
              expand="block"
              className="bt bt-gold"
              style={{ marginTop: 8 }}
              onClick={openIA}
            >
              {t("Ver mi perfil de salud ANTARES · IA")}
            </IonButton>
          )}
        </div>
      ) : (
        <div
          className="screen-scroll no-nav"
          style={{ padding: "14px 14px 110px" }}
        >
          {/* Modo backend: render genérico por tipo de pregunta (las preguntas
              vienen de /me/tests/{id}, no de los mocks demo). */}
          {openAssignmentId && openQuestions && (
            <>
              {openQuestions.map((q, qi) => {
                if (q.type === "scale" || q.type === "single") {
                  return (
                    <ScaleList
                      key={q.id}
                      questions={[
                        { text: q.text, section: q.section ?? undefined },
                      ]}
                      scale={q.options.map((o) => o.text)}
                      answers={
                        answers[openId]?.[qi] !== undefined
                          ? { 0: answers[openId]![qi] as number }
                          : {}
                      }
                      onAnswer={(_i, v) =>
                        setAnswers((a) => ({
                          ...a,
                          [openId]: { ...(a[openId] ?? {}), [qi]: v },
                        }))
                      }
                    />
                  );
                }
                if (q.type === "multi") {
                  const selected =
                    (answers[openId]?.[qi] as number[] | undefined) ?? [];
                  return (
                    <div key={q.id} className="tq-card">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        {q.section || q.text}
                      </div>
                      <ChipGrid
                        items={q.options.map((o) => ({
                          ico: "•",
                          label: o.text,
                        }))}
                        selected={selected}
                        toggle={(vi) =>
                          setAnswers((a) => {
                            const cur =
                              (a[openId]?.[qi] as number[] | undefined) ?? [];
                            const next = cur.includes(vi)
                              ? cur.filter((x) => x !== vi)
                              : [...cur, vi];
                            return {
                              ...a,
                              [openId]: { ...(a[openId] ?? {}), [qi]: next },
                            };
                          })
                        }
                      />
                    </div>
                  );
                }
                // open: texto libre
                return (
                  <div key={q.id} className="tq-card">
                    <div
                      style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}
                    >
                      {q.section || q.text}
                    </div>
                    <IonTextarea
                      className="fld"
                      placeholder={q.text}
                      value={String(answers[openId]?.[qi] ?? "")}
                      onIonInput={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [openId]: {
                            ...(a[openId] ?? {}),
                            [qi]: String(e.detail.value ?? ""),
                          },
                        }))
                      }
                    />
                  </div>
                );
              })}
            </>
          )}

          {openId === 1 && (
            <>
              <div
                style={{ fontSize: 12, fontWeight: 700, margin: "4px 0 8px" }}
              >
                {t("Antecedentes patológicos")}
              </div>
              <ChipGrid
                items={ANTECS}
                selected={chips}
                toggle={(i) => toggle(chips, setChips, i)}
              />
              <div
                style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 8px" }}
              >
                {t("Revisión por sistemas")}
              </div>
              {SISTEMAS.map((s, i) => (
                <div
                  key={s.s}
                  style={{
                    border: `1.5px solid ${s.bg}`,
                    borderRadius: 12,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setSisOpen(sisOpen === i ? null : i)}
                    style={{
                      width: "100%",
                      background: s.bg,
                      border: "none",
                      padding: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{s.ico}</span>
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 700,
                        fontSize: 13,
                        textAlign: "left",
                      }}
                    >
                      {s.s}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--mu)" }}>
                      {sisOpen === i ? "▲" : "▼"}
                    </span>
                  </button>
                  {sisOpen === i && (
                    <div
                      style={{
                        padding: 10,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      {s.sintomas.map((sin, si) => {
                        const on = (sisSel[i] ?? []).includes(si);
                        return (
                          <button
                            key={sin}
                            className={`choice ${on ? "sel" : ""}`}
                            onClick={() => {
                              const cur = sisSel[i] ?? [];
                              setSisSel({
                                ...sisSel,
                                [i]: on
                                  ? cur.filter((x) => x !== si)
                                  : [...cur, si],
                              });
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 600 }}>
                              {sin}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 700, margin: "8px 0" }}>
                {t("Antecedentes familiares")}
              </div>
              <ChipGrid
                items={FAM_HX}
                selected={fam}
                toggle={(i) => toggle(fam, setFam, i)}
              />
            </>
          )}

          {openId && openId >= 2 && openId <= 8 && (
            <ScaleList
              questions={activeQuestions}
              scale={activeScale}
              answers={(answers[openId] ?? {}) as Record<number, number>}
              onAnswer={(i, v) =>
                setAnswers((a) => ({
                  ...a,
                  [openId]: { ...(a[openId] ?? {}), [i]: v },
                }))
              }
            />
          )}

          {openId === 5 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, margin: "8px 0" }}>
                {t("Señales de alerta")}
              </div>
              <ChipGrid
                items={SLEEP_FLAGS}
                selected={flags}
                toggle={(i) => toggle(flags, setFlags, i)}
              />
            </>
          )}

          {openId === 9 && (
            <>
              {PURPOSE_OPEN.map((p) => (
                <div key={p.q} className="tq-card">
                  <div
                    style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}
                  >
                    {p.q}
                  </div>
                  <IonTextarea className="fld" placeholder={p.ph} />
                </div>
              ))}
              <ScaleList
                questions={PURPOSE_SCALE}
                scale={["1", "2", "3", "4", "5"]}
                answers={(answers[9] ?? {}) as Record<number, number>}
                onAnswer={(i, v) =>
                  setAnswers((a) => ({ ...a, 9: { ...(a[9] ?? {}), [i]: v } }))
                }
              />
              <div
                style={{
                  background: "linear-gradient(145deg,#102a50,#173c73)",
                  borderRadius: 16,
                  padding: 14,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    color: "var(--ice)",
                    fontWeight: 700,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  {t("¿Qué priorizarías primero?")}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPriority(p.id)}
                      style={{
                        background:
                          priority === p.id
                            ? "rgba(124,58,237,.35)"
                            : "rgba(255,255,255,.06)",
                        border: `1px solid ${priority === p.id ? "var(--pur)" : "rgba(255,255,255,.1)"}`,
                        borderRadius: 12,
                        padding: 12,
                        color: "#fff",
                      }}
                    >
                      <div>{p.ico}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        {p.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {openId !== null && !showResult && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 14px calc(16px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(transparent,#fff 30%)",
          }}
        >
          <IonButton
            expand="block"
            className="bt bt-teal"
            onClick={() => void saveTest()}
          >
            {t("Guardar evaluación")}
          </IonButton>
        </div>
      )}

      <IonLoading
        className="app-loading"
        isOpen={loading}
        message="Analizando tu perfil…"
      />
    </div>
  );
}
