export function normalizeAppBaseUrl(value: string) {
  const url = new URL(value.trim());
  const allowHttp = process.env.NODE_ENV === "development";

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("APP_URL must use HTTPS outside development.");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}

export function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return normalizeAppBaseUrl(process.env.APP_URL);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  return normalizeAppBaseUrl("http://localhost:3000");
}
