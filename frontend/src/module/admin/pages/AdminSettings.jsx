import { useState } from "react";
import { adminAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Save, Loader2, Shield, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getCurrentLanguage,
  persistLanguage,
  setAppLanguage,
} from "@/lib/i18n/language.js";

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
];

export default function AdminSettings() {
  const { t } = useTranslation();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage());
  const [errors, setErrors] = useState({});

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validatePasswordForm = () => {
    const newErrors = {};

    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = t("admin.settings.validation.currentRequired");
    }

    if (!passwordForm.newPassword) {
      newErrors.newPassword = t("admin.settings.validation.newRequired");
    } else if (passwordForm.newPassword.length < 6) {
      newErrors.newPassword = t("admin.settings.validation.minLength");
    }

    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = t("admin.settings.validation.confirmRequired");
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = t("admin.settings.validation.mismatch");
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      newErrors.newPassword = t("admin.settings.validation.mustDiffer");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    try {
      setSaving(true);
      await adminAPI.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      // Clear form
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast.success(t("admin.settings.toast.passwordUpdated"));
    } catch (error) {
      console.error("Error changing password:", error);
      const errorMessage =
        error?.response?.data?.message || t("admin.settings.toast.passwordUpdateFailed");
      
      // Set specific error for current password
      if (errorMessage.includes("current password") || errorMessage.includes("incorrect")) {
        setErrors({ currentPassword: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (code) => {
    if (savingLanguage || code === selectedLanguage) return;

    try {
      setSavingLanguage(true);
      const languageName =
        LANGUAGES.find((item) => item.code === code)?.name || t("common.language");
      await adminAPI.updatePreferences({ language: code });
      await setAppLanguage(code);
      persistLanguage(code);
      setSelectedLanguage(code);
      toast.success(t("common.languageUpdated", { language: languageName }));
      window.location.reload();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || t("common.languageUpdateFailed")
      );
    } finally {
      setSavingLanguage(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t("admin.settings.title")}</h1>
        <p className="text-neutral-600 mt-1">
          {t("admin.settings.subtitle")}
        </p>
      </div>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-neutral-700" />
            <CardTitle>{t("admin.settings.changePassword")}</CardTitle>
          </div>
          <CardDescription>
            {t("admin.settings.changePasswordDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t("admin.settings.currentPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    handlePasswordChange("currentPassword", e.target.value)
                  }
                  placeholder={t("admin.settings.currentPasswordPlaceholder")}
                  className={`h-11 pr-12 ${
                    errors.currentPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-red-600">{errors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t("admin.settings.newPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    handlePasswordChange("newPassword", e.target.value)
                  }
                  placeholder={t("admin.settings.newPasswordPlaceholder")}
                  className={`h-11 pr-12 ${
                    errors.newPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-red-600">{errors.newPassword}</p>
              )}
              <p className="text-xs text-neutral-500">
                {t("admin.settings.passwordHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t("admin.settings.confirmPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    handlePasswordChange("confirmPassword", e.target.value)
                  }
                  placeholder={t("admin.settings.confirmPasswordPlaceholder")}
                  className={`h-11 pr-12 ${
                    errors.confirmPassword ? "border-red-500" : ""
                  }`}
                  disabled={saving}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  disabled={saving}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-200">
              <Button
                type="submit"
                disabled={saving}
                className="bg-black text-white hover:bg-neutral-900 h-11 px-8"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("admin.settings.changingPassword")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t("admin.settings.changePasswordAction")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.language")}</CardTitle>
          <CardDescription>
            {t("common.languageSettingsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => handleLanguageChange(language.code)}
              disabled={savingLanguage}
              className="w-full rounded-md border border-neutral-200 px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors disabled:opacity-60"
            >
              <div className="text-left">
                <p className="font-medium text-neutral-900">{language.name}</p>
                <p className="text-sm text-neutral-500">{language.nativeName}</p>
              </div>
              {selectedLanguage === language.code && (
                <Check className="w-5 h-5 text-blue-600" />
              )}
            </button>
          ))}
          <p className="text-xs text-neutral-500 pt-1">
            {savingLanguage ? t("common.savingLanguage") : t("common.languageRefreshNotice")}
          </p>
        </CardContent>
      </Card>

      {/* Additional Settings can be added here */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.accountSettings")}</CardTitle>
          <CardDescription>
            {t("admin.settings.accountSettingsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">
            {t("admin.settings.moreSettingsSoon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
