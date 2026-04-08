import { useTranslation } from "react-i18next"

export default function UserHome() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6 lg:p-8">
      <div className="text-center max-w-md md:max-w-2xl lg:max-w-4xl">
        <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 md:mb-4 lg:mb-5">{t("user.userHome.title")}</h1>
        <p className="text-base md:text-lg lg:text-xl text-muted-foreground">{t("user.userHome.subtitle")}</p>
      </div>
    </div>
  )
}
