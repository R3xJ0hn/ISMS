export type ClassworkNotePart = { title?: string; text: string };

// Preserve ordinary text and malformed templates rather than silently losing notes.
export function parseClassworkNote(note: string): ClassworkNotePart[] {
  const parts: ClassworkNotePart[] = [];
  const template = /\[([^\[\]:\r\n]+):([^\[\]]+)\]/g;
  let cursor = 0;
  for (const match of note.matchAll(template)) {
    const title = match[1].trim();
    const text = match[2].trim();
    if (!title || !text) continue;
    const before = note.slice(cursor, match.index).trim();
    if (before) parts.push({ text: before });
    parts.push({ title, text });
    cursor = match.index + match[0].length;
  }
  const remaining = note.slice(cursor).trim();
  if (remaining) parts.push({ text: remaining });
  return parts;
}
