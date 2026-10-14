import { useId, type ReactNode } from 'react'

export function Section({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section className="section" aria-labelledby={id}>
      <header className="section-head">
        <div>
          <h3 id={id} className="section-title">
            {title}
          </h3>
          {description && <p className="section-desc">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}
