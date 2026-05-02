export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}

export function sanitizeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const allowHttp = process.env.NODE_ENV === "development";

    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error("URL is invalid.");
  }
}
