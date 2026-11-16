/** Parser SSE incremental: eventos completos, CR/LF y UTF-8 quedan separados. */
export function createSseParser(onEvent: (event: string, data: string) => void) {
  let pending = "";
  let event = "message";
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) onEvent(event, data.join("\n"));
      event = "message"; data = [];
      return;
    }
    if (value.startsWith(":")) return;
    const colon = value.indexOf(":");
    const field = colon < 0 ? value : value.slice(0, colon);
    let content = colon < 0 ? "" : value.slice(colon + 1);
    if (content.startsWith(" ")) content = content.slice(1);
    if (field === "event") event = content;
    if (field === "data") data.push(content);
  };
  return {
    push(chunk: string, end = false) {
      pending += chunk;
      let start = 0;
      for (let i = 0; i < pending.length; i++) {
        if (pending[i] !== "\n" && pending[i] !== "\r") continue;
        if (pending[i] === "\r" && i === pending.length - 1 && !end) break;
        line(pending.slice(start, i));
        if (pending[i] === "\r" && pending[i + 1] === "\n") i++;
        start = i + 1;
      }
      pending = pending.slice(start);
      if (end) { if (pending) line(pending); pending = ""; line(""); }
    },
  };
}
