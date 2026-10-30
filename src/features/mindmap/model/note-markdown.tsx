import type { ReactNode } from "react";

/**
 * Markdown mínimo y seguro para las notas (sin dangerouslySetInnerHTML).
 * Títulos, listas, citas, párrafos, **negrita**, *cursiva*, `código`,
 * [[enlaces internos]] y #etiquetas. Los colores salen del tema (clases mm-md-*).
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[\[[^\]]+\]\]|(?<![\w/#])#[\p{L}\p{N}_-]+)/gu;
const LIST = /^\s*([-*]|\d+\.)\s+/;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key} className="mm-md-code">{token.slice(1, -1)}</code>);
    else if (token.startsWith("[[")) out.push(<span key={key} className="mm-md-link">{token.slice(2, -2)}</span>);
    else if (token.startsWith("#")) out.push(<span key={key} className="mm-md-tag">{token}</span>);
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderNoteMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <p key={k++} className={heading[1].length === 1 ? "mm-md-h1" : "mm-md-h2"}>
          {inline(heading[2], `h${k}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (LIST.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && LIST.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(LIST, ""), `li${i}`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++}>{inline(quote.join(" "), `q${k}`)}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*([-*]|\d+\.)\s|>)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return blocks;
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
