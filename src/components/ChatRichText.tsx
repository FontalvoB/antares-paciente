import type { ReactNode } from "react";

/**
 * Subconjunto seguro de Markdown para las respuestas del agente en el chat:
 * **negrita**, *cursiva*, `código`, [etiqueta](url), títulos ###, listas
 * (- y 1.) y párrafos. Sin dependencias y sin HTML crudo (a prueba de XSS):
 * todo se construye con nodos React. El texto parcial del streaming se
 * pinta tal cual (las marcas sin cerrar se muestran literales).
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // links, bold, italic, code — en una sola pasada por orden de aparición.
  const re =
    /(\[([^\]]+)\]\((https?:[^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <a
          key={`${keyBase}-${k++}`}
          className="md-link"
          href={m[3]}
          target="_blank"
          rel="noreferrer"
        >
          {m[2]}
        </a>,
      );
    } else if (m[4]) {
      out.push(
        <strong key={`${keyBase}-${k++}`} className="md-b">
          {m[5]}
        </strong>,
      );
    } else if (m[6]) {
      out.push(
        <em key={`${keyBase}-${k++}`} className="md-i">
          {m[7]}
        </em>,
      );
    } else if (m[8]) {
      out.push(
        <code key={`${keyBase}-${k++}`} className="md-code">
          {m[9]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ChatRichText({ text }: { text: string }) {
  if (!text) {
    return (
      <span className="typing" aria-label="Escribiendo">
        <i />
        <i />
        <i />
      </span>
    );
  }
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: ReactNode[] | null = null;
  let ordered = false;
  let k = 0;

  const flushList = () => {
    if (!list) return;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`b-${k++}`} className="md-list">
        {list}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const ul = /^[-•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (ul || ol) {
      const isOrdered = !!ol;
      if (!list || ordered !== isOrdered) {
        flushList();
        list = [];
        ordered = isOrdered;
      }
      list.push(
        <li key={`li-${k++}`}>{inline(ul?.[1] ?? ol?.[1] ?? "", `x${k}`)}</li>,
      );
    } else {
      flushList();
      if (!line) continue;
      if (h) {
        blocks.push(
          <div key={`b-${k++}`} className="md-h">
            {inline(h[2], `h${k}`)}
          </div>,
        );
      } else {
        blocks.push(<p key={`b-${k++}`}>{inline(line, `p${k}`)}</p>);
      }
    }
  }
  flushList();
  return <>{blocks}</>;
}
