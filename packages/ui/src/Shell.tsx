import type { ReactNode } from "react";
import { t, type Locale } from "./i18n.js";

export interface ShellTab { id: string; label: string }

export type Theme = "warm-paper" | "ink-paper" | "plain";

export interface ShellProps {
  theme?: Theme;
  title: string;
  subtitle?: string;
  locale: Locale;
  tabs: readonly ShellTab[];
  activeTab: string;
  onTab: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}

/** The frame: title, tab list, actions, main area. Keyboard first, print-safe. */
export function Shell({ theme = "plain", title, subtitle, locale, tabs, activeTab, onTab, actions, children }: ShellProps) {
  return (
    <div className="bb-shell" data-theme={theme}>
      <header className="bb-header">
        <h1>{title}</h1>
        {subtitle ? <span className="bb-sub">{subtitle}</span> : null}
        <div className="bb-actions">
          {actions}
          <button className="bb-btn" type="button" onClick={() => globalThis.print?.()}>{t(locale, "print")}</button>
        </div>
      </header>
      <nav className="bb-tabs" role="tablist" aria-label={title}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className="bb-tab"
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="bb-main" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {children}
      </main>
    </div>
  );
}
