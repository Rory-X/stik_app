import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { Locale } from "@/i18n";
import { createTranslator } from "@/i18n";
import type { StikSettings } from "@/types";

interface LanguageOnboardingProps {
  settings: StikSettings;
  onComplete: (settings: StikSettings) => void;
}

export default function LanguageOnboarding({
  settings,
  onComplete,
}: LanguageOnboardingProps) {
  const [selectedLocale, setSelectedLocale] = useState<Locale>("zh-CN");
  const [isSaving, setIsSaving] = useState(false);
  const t = useMemo(() => createTranslator(selectedLocale), [selectedLocale]);

  const saveLanguage = async () => {
    setIsSaving(true);
    try {
      const nextSettings: StikSettings = {
        ...settings,
        locale: selectedLocale,
        has_completed_onboarding: true,
      };
      await invoke("save_settings", { settings: nextSettings });
      await emit("settings-changed", nextSettings);
      onComplete(nextSettings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[280px] bg-bg text-ink rounded-[14px] border border-line shadow-stik overflow-hidden">
      <div className="h-full flex flex-col justify-center p-6">
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-coral font-semibold mb-2">
            Stik
          </p>
          <h1 className="text-[22px] font-semibold leading-tight">
            {t("onboarding.language.title")}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-stone">
            {t("onboarding.language.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { locale: "zh-CN" as const, label: "简体中文" },
            { locale: "en" as const, label: "English" },
          ].map((option) => (
            <button
              key={option.locale}
              type="button"
              onClick={() => setSelectedLocale(option.locale)}
              className={`px-3 py-3 rounded-lg border text-[14px] font-medium transition-colors ${
                selectedLocale === option.locale
                  ? "border-coral bg-coral-light text-coral"
                  : "border-line bg-line/30 text-ink hover:border-coral/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={saveLanguage}
          disabled={isSaving}
          className="w-full px-4 py-3 rounded-lg bg-coral text-white text-[14px] font-medium hover:bg-coral-dark transition-colors disabled:opacity-60"
        >
          {isSaving ? t("common.loading") : t("onboarding.language.continue")}
        </button>
      </div>
    </div>
  );
}
