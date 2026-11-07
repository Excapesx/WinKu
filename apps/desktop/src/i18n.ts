import { english } from "./locales/en";
let locale: "zh" | "en" = "zh";
export function resolveLanguage(
  preference: string,
  system: string,
): "zh" | "en" {
  return preference === "zh" || preference === "en"
    ? preference
    : /^zh\b/i.test(system)
      ? "zh"
      : "en";
}
export function setUILanguage(preference: string, system: string) {
  locale = resolveLanguage(preference, system);
  return locale;
}
export const getLocale = () => locale;
export function t(text: string): string {
  if (locale === "zh") return text;
  if (english[text]) return english[text];
  // Only explicitly supplied UI messages pass here, never conversation bodies.
  if (text.startsWith("Error: "))
    return "Error: " + (english[text.slice(7)] ?? text.slice(7));
  return text;
}
