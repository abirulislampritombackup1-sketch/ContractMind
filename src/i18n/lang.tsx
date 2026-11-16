// Shared language state for components, so every screen follows the EN / বাংলা toggle
// without threading a `lang` prop through each one.

import React, { createContext, useContext } from "react";
import { Language } from "./translations";
import { TERMS_BN } from "./dataBn";

const LangContext = createContext<Language>("en");

export function LangProvider({ lang, children }: { lang: Language; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export type LFn = (en: string, bn: string) => string;

/** `L(en, bn)` picks the text for the current language; `term(x)` translates a fixed
 *  label such as "Critical" or "Vendor" (unknown values are shown unchanged). */
export function useLang() {
  const lang = useContext(LangContext);
  const bn = lang === "bn";
  const L: LFn = (en, bnText) => (bn ? bnText : en);
  const term = (value: string | undefined | null) => {
    const v = value ?? "";
    return bn ? TERMS_BN[v] ?? v : v;
  };
  return { lang, bn, L, term };
}

