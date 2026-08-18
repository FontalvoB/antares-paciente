import type { ReactNode } from 'react'

export function PageHeader({
  title,
  sub,
  kicker,
  trailing,
}: {
  title: string
  sub?: string
  kicker?: string
  trailing?: ReactNode
}) {
  return (
    <header className="page-head">
      {kicker ? <div className="page-head-kicker">{kicker}</div> : null}
      <div className="page-head-row">
        <h1 className="page-head-title">{title}</h1>
        {trailing}
      </div>
      {sub ? <p className="page-head-sub">{sub}</p> : null}
    </header>
  )
}
