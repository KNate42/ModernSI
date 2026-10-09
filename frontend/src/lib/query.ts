// Builds query strings, repeating keys for arrays (category=a&category=b) like the API expects.
// This work made by Anfinogentov Nikita

type Value = string | number | boolean | null | undefined | Array<string | number>;

export function qs(params: Record<string, Value>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)));
    else search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Where to go after login. Only same-site paths: "//host", "/\host" and absolute URLs would send people off the site.
export function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/personal";
  return next;
}

// Route ids are UUIDs; anything else is a 404 before the API is even asked.
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
