import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { restaurantAPI } from "@/lib/api";
import {
  getCurrentLanguage,
  persistLanguage,
  setAppLanguage,
} from "@/lib/i18n/language.js";

export default function ChangeLanguage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const LANGUAGES = [
    { code: "en", name: t("common.languageNames.en"), nativeName: "English" },
    { code: "hi", name: t("common.languageNames.hi"), nativeName: "हिंदी" },
    { code: "bn", name: t("common.languageNames.bn"), nativeName: "বাংলা" },
  ];
  const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage());
  const [saving, setSaving] = useState(false);

  const handleLanguageChange = async (code) => {
    if (saving || code === selectedLanguage) return;

    setSaving(true);
    try {
      const nextLanguageName =
        LANGUAGES.find((item) => item.code === code)?.name || t("common.language");
      await restaurantAPI.updatePreferences({ language: code });
      await setAppLanguage(code);
      persistLanguage(code);
      setSelectedLanguage(code);
      toast.success(t("common.languageUpdated", { language: nextLanguageName }));
      window.location.reload();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || t("common.languageUpdateFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {t("restaurant.changeLanguage.title")}
          </h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-gray-600 text-sm mb-4">
          {t("restaurant.changeLanguage.subtitle")}
        </p>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              disabled={saving}
              type="button"
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 disabled:opacity-60"
            >
              <div className="flex flex-col items-start">
                <span className="font-semibold text-gray-900">{language.name}</span>
                <span className="text-sm text-gray-600">{language.nativeName}</span>
              </div>
              {selectedLanguage === language.code && (
                <Check className="w-5 h-5 text-blue-600" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            {saving
              ? t("restaurant.changeLanguage.saving")
              : t("restaurant.changeLanguage.restartNotice")}
          </p>
        </div>
      </div>
    </div>
  );
}
