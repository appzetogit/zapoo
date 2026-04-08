import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Check } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { userAPI } from "@/lib/api"
import {
  getCurrentLanguage,
  persistLanguage,
  setAppLanguage,
} from "@/lib/i18n/language.js"

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
]

export default function Settings() {
  const { t } = useTranslation()
  const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage())
  const [savingLanguage, setSavingLanguage] = useState(false)

  const handleLanguageChange = async (code) => {
    if (savingLanguage || code === selectedLanguage) return

    setSavingLanguage(true)
    try {
      const languageName =
        LANGUAGES.find((item) => item.code === code)?.name || t("common.language")
      await userAPI.updatePreferences({ language: code })
      await setAppLanguage(code)
      persistLanguage(code)
      setSelectedLanguage(code)
      toast.success(t("common.languageUpdated", { language: languageName }))
      window.location.reload()
    } catch (error) {
      toast.error(
        error?.response?.data?.message || t("common.languageUpdateFailed")
      )
    } finally {
      setSavingLanguage(false)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/user/profile">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-black dark:text-white">{t("user.settings.title")}</h1>
        </div>
        <Card className="bg-white dark:bg-[#1a1a1a] border-0 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">{t("user.settings.notificationsPreferences")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>{t("common.language")}</Label>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => handleLanguageChange(language.code)}
                    disabled={savingLanguage}
                    className="w-full px-4 py-3 flex items-center justify-between text-left bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#242424] border-b border-gray-100 dark:border-gray-800 last:border-b-0 disabled:opacity-60"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">{language.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{language.nativeName}</span>
                    </div>
                    {selectedLanguage === language.code && (
                      <Check className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {savingLanguage ? t("common.savingLanguage") : t("common.languageRefreshNotice")}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("user.settings.emailNotifications")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("user.settings.emailNotificationsDescription")}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("user.settings.pushNotifications")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("user.settings.pushNotificationsDescription")}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}
