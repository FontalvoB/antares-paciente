import type { ScaleQ } from '../data/tests'

export function ScaleList({
  questions,
  scale,
  answers,
  onAnswer,
}: {
  questions: ScaleQ[]
  scale: string[]
  answers: Record<number, number>
  onAnswer: (i: number, v: number) => void
}) {
  return (
    <>
      {questions.map((q, i) => (
        <div key={i} className={`tq-card ${answers[i] !== undefined ? 'answered' : ''}`}>
          {q.section && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--mu)', marginBottom: 6, textTransform: 'uppercase' }}>
              {q.section}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', marginBottom: 10, lineHeight: 1.45 }}>{q.text}</div>
          <div className="tq-scale">
            {scale.map((s, si) => (
              <button key={s} className={`tq-opt ${answers[i] === si ? 'sel' : ''}`} onClick={() => onAnswer(i, si)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

export function ChipGrid({
  items,
  selected,
  toggle,
}: {
  items: { ico: string; label: string }[]
  selected: number[]
  toggle: (i: number) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {items.map((it, i) => (
        <button key={it.label} className={`choice ${selected.includes(i) ? 'sel' : ''}`} onClick={() => toggle(i)}>
          <span>{it.ico}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}
