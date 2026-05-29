import { Link, useLocation } from "react-router-dom"
import { Tag, User, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function BottomNavigation() {
  const { t } = useTranslation()
  const location = useLocation()

  // Check active routes - support both /user/* and /* paths
  const isUnder250 = location.pathname === "/under-250"
  const isProfile = location.pathname.startsWith("/profile")
  const isDelivery =
    !isUnder250 &&
    !isProfile &&
    (location.pathname === "/" ||
      (location.pathname.startsWith("/") &&
        !location.pathname.startsWith("/restaurant") &&
        !location.pathname.startsWith("/delivery") &&
        !location.pathname.startsWith("/admin")))

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[70] px-3 pb-2">
      <div className="overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-xl shadow-[0_-12px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_-12px_35px_rgba(0,0,0,0.45)]">
        <div className="flex items-stretch h-auto divide-x divide-gray-200/80 dark:divide-gray-700/80">
        {/* Delivery Tab */}
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200 relative ${isDelivery
            ? "text-orange-600 dark:text-orange-400"
            : "text-gray-600 dark:text-gray-400"
            }`}
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${isDelivery
            ? "bg-orange-600/10 dark:bg-orange-400/15 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]"
            : "bg-transparent"
            }`}>
            <Truck className={`h-5 w-5 ${isDelivery ? "text-orange-600 dark:text-orange-400 fill-orange-600 dark:fill-orange-400" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
          </div>
          <span className={`text-[11px] sm:text-xs font-medium tracking-wide ${isDelivery ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
            {t("user.bottomNavigation.delivery")}
          </span>
          {isDelivery && (
            <div className="absolute top-1.5 h-1 w-1 rounded-full bg-orange-600 dark:bg-orange-400" />
          )}
        </Link>

        {/* Under 250 Tab */}
        <Link
          to="/under-250"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200 relative ${isUnder250
            ? "text-orange-600 dark:text-orange-400"
            : "text-gray-600 dark:text-gray-400"
            }`}
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${isUnder250
            ? "bg-orange-600/10 dark:bg-orange-400/15 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]"
            : "bg-transparent"
            }`}>
            <Tag className={`h-5 w-5 ${isUnder250 ? "text-orange-600 dark:text-orange-400 fill-orange-600 dark:fill-orange-400" : "text-gray-600 dark:text-gray-400"}`} strokeWidth={2} />
          </div>
          <span className={`text-[11px] sm:text-xs font-medium tracking-wide ${isUnder250 ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
            {t("user.bottomNavigation.under250")}
          </span>
          {isUnder250 && (
            <div className="absolute top-1.5 h-1 w-1 rounded-full bg-orange-600 dark:bg-orange-400" />
          )}
        </Link>

        {/* Profile Tab */}
        <Link
          to="/profile"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200 relative ${isProfile
            ? "text-orange-600 dark:text-orange-400"
            : "text-gray-600 dark:text-gray-400"
            }`}
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${isProfile
            ? "bg-orange-600/10 dark:bg-orange-400/15 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]"
            : "bg-transparent"
            }`}>
            <User className={`h-5 w-5 ${isProfile ? "text-orange-600 dark:text-orange-400 fill-orange-600 dark:fill-orange-400" : "text-gray-600 dark:text-gray-400"}`} />
          </div>
          <span className={`text-[11px] sm:text-xs font-medium tracking-wide ${isProfile ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
            {t("user.bottomNavigation.profile")}
          </span>
          {isProfile && (
            <div className="absolute top-1.5 h-1 w-1 rounded-full bg-orange-600 dark:bg-orange-400" />
          )}
        </Link>
        </div>
      </div>
    </div>
  )
}
