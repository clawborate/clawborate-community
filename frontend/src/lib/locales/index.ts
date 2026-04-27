import en from './en'
import zh from './zh'

export const locales = { en, zh }
export type Lang = keyof typeof locales
export type { Translations } from './en'

export function getT(lang: Lang): import('./en').Translations {
  return locales[lang] ?? locales.en
}
