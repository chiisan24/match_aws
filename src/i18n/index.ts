/**
 * i18n — language dictionaries, the selectable language list and the React
 * wiring (provider + hook) for label resolution with Japanese fallback and
 * 伊予弁 support (Req 1.x / 19.x). The pure `resolveLabel` lives in the domain
 * layer; this barrel exposes everything the UI needs.
 */

export { UI_LABELS } from "./labels";

export {
  LANGUAGE_OPTIONS,
  isRtlLang,
  dirForLang,
} from "./languages";
export type { LanguageOption } from "./languages";

export { resolveLabels } from "./resolveLabels";
export type { ResolveLabelsResult, LabelResolver } from "./resolveLabels";

export { I18nProvider, useI18n, useTranslate } from "./context";
export type { I18nContextValue, I18nProviderProps } from "./context";
