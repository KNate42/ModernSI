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
