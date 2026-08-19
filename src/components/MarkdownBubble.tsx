import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renderiza markdown dentro de una burbuja de chat del bot.
 * Soporta: negritas, listas, encabezados, código inline, enlaces.
 * Se adapta al estilo de la burbuja (.bub-bot) vía CSS scoped.
 */
export function MarkdownBubble({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Evita que <a> rompa el layout de la burbuja
        a: ({ children, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        // Encabezados más compactos dentro de la burbuja
        h1: ({ children }) => <span style={{ fontSize: 14, fontWeight: 800 }}>{children}</span>,
        h2: ({ children }) => <span style={{ fontSize: 13, fontWeight: 800 }}>{children}</span>,
        h3: ({ children }) => <span style={{ fontSize: 13, fontWeight: 700 }}>{children}</span>,
      }}
    >
      {content}
    </Markdown>
  )
}
