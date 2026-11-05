export function browserDetails(ua: string): Record<string, string> {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Não identificado";
  const version = ua.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/([\d.]+)/)?.[1];
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Não identificado";
  const androidModel = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?\)/)?.[1];
  const model = /iPhone/.test(ua) ? "iPhone (geração não informada)" : /iPad/.test(ua) ? "iPad (geração não informada)" : androidModel && androidModel !== "K" ? androidModel : "Modelo não informado pelo navegador";
  return { browser: version ? `${browser} ${version}` : browser, os, model, device: /iPad|Tablet/.test(ua) ? "Tablet" : /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop" };
}

export function locationLabel(info: Record<string, unknown>): string {
  const location = info.location;
  if (!location || typeof location !== "object" || Array.isArray(location)) return "Localização indisponível";
  const values = location as Record<string, unknown>;
  return [values.city, values.region, values.country].filter(v => typeof v === "string" && v.trim()).join(" · ") || "Localização indisponível";
}