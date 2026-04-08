import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Bell, CheckCircle2, Clock, Tag, Gift, AlertCircle, Megaphone } from "lucide-react"
import AnimatedPage from "../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import apiClient from "@/lib/api"
import { useTranslation } from "react-i18next"

const buildOrderNotifications = (t) => [
  {
    id: 1,
    type: "order",
    title: t("user.notifications.sample.orderConfirmedTitle"),
    message: t("user.notifications.sample.orderConfirmedMessage"),
    time: t("user.notifications.sample.twoMinutesAgo"),
    read: false,
    icon: CheckCircle2,
    iconColor: "text-green-600"
  },
  {
    id: 2,
    type: "offer",
    title: t("user.notifications.sample.specialOfferTitle"),
    message: t("user.notifications.sample.specialOfferMessage"),
    time: t("user.notifications.sample.oneHourAgo"),
    read: false,
    icon: Tag,
    iconColor: "text-red-600"
  },
  {
    id: 3,
    type: "promotion",
    title: t("user.notifications.sample.newRestaurantTitle"),
    message: t("user.notifications.sample.newRestaurantMessage"),
    time: t("user.notifications.sample.threeHoursAgo"),
    read: true,
    icon: Gift,
    iconColor: "text-blue-600"
  },
  {
    id: 4,
    type: "order",
    title: t("user.notifications.sample.orderDeliveredTitle"),
    message: t("user.notifications.sample.orderDeliveredMessage"),
    time: t("user.notifications.sample.yesterday"),
    read: true,
    icon: CheckCircle2,
    iconColor: "text-green-600"
  },
  {
    id: 5,
    type: "alert",
    title: t("user.notifications.sample.paymentFailedTitle"),
    message: t("user.notifications.sample.paymentFailedMessage"),
    time: t("user.notifications.sample.twoDaysAgo"),
    read: true,
    icon: AlertCircle,
    iconColor: "text-orange-600"
  },
  {
    id: 6,
    type: "offer",
    title: t("user.notifications.sample.weekendSpecialTitle"),
    message: t("user.notifications.sample.weekendSpecialMessage"),
    time: t("user.notifications.sample.threeDaysAgo"),
    read: true,
    icon: Tag,
    iconColor: "text-red-600"
  }
]

function formatTime(isoString, t) {
  try {
    const d = new Date(isoString)
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t("user.notifications.time.justNow")
    if (diffMin < 60) return t("user.notifications.time.minutesAgo", { count: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return t("user.notifications.time.hoursAgo", { count: diffHr })
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  } catch {
    return ""
  }
}

export default function Notifications() {
  const { t } = useTranslation()
  const ORDER_NOTIFICATIONS = buildOrderNotifications(t)
  const [promoNotifs, setPromoNotifs] = useState([])
  const [readPromoIds, setReadPromoIds] = useState(new Set())

  useEffect(() => {
    let mounted = true

    const loadPromotions = async () => {
      try {
        const params = {}
        try {
          const stored = JSON.parse(localStorage.getItem('userLocation'))
          if (stored?.latitude && stored?.longitude) {
            params.latitude = stored.latitude
            params.longitude = stored.longitude
          }
        } catch { /* no stored location */ }
        const res = await apiClient.get("/notification/users", { params })
        if (!mounted) return
        const list = Array.isArray(res?.data?.data?.notifications)
          ? res.data.data.notifications
          : []
        setPromoNotifs(list)
      } catch {
        if (mounted) setPromoNotifs([])
      }
    }

    loadPromotions()
    return () => {
      mounted = false
    }
  }, [])

  const unreadOrderCount = ORDER_NOTIFICATIONS.filter((n) => !n.read).length
  const unreadPromoCount = promoNotifs.filter((n) => !readPromoIds.has(n._id)).length
  const totalUnread = unreadOrderCount + unreadPromoCount

  const markPromoRead = (id) => {
    setReadPromoIds((prev) => new Set([...prev, id]))
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 md:mb-6 lg:mb-8">
          <Link to="/user">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 fill-red-600" />
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white">
              {t("user.notifications.title")}
            </h1>
            {totalUnread > 0 && (
              <Badge className="bg-red-600 text-white text-xs md:text-sm">{totalUnread}</Badge>
            )}
          </div>
        </div>

        {promoNotifs.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-[#FF5200]" />
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {t("user.notifications.promotionsAndOffers")}
              </h2>
              {unreadPromoCount > 0 && (
                <Badge className="bg-[#FF5200] text-white text-xs">{unreadPromoCount}</Badge>
              )}
            </div>
            <div className="space-y-3 md:space-y-4">
              {promoNotifs.map((notif) => {
                const isUnread = !readPromoIds.has(notif._id)
                return (
                  <Card
                    key={notif._id}
                    onClick={() => markPromoRead(notif._id)}
                    className={`relative cursor-pointer transition-all duration-200 py-1 hover:shadow-md ${
                      isUnread
                        ? "bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isUnread && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 md:w-3 md:h-3 bg-[#FF5200] rounded-full" />
                    )}
                    <CardContent className="p-3 md:p-4 lg:p-5">
                      <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                          <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-[#FF5200]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-1 md:mb-2 ${isUnread ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
                            {notif.title}
                          </h3>
                          <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mb-2 md:mb-3 line-clamp-2">
                            {notif.description}
                          </p>
                          <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3 md:h-4 md:w-4" />
                            <span>{formatTime(notif.sentAt, t)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        <div>
          {promoNotifs.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {t("user.notifications.ordersAndUpdates")}
              </h2>
              {unreadOrderCount > 0 && (
                <Badge className="bg-red-600 text-white text-xs">{unreadOrderCount}</Badge>
              )}
            </div>
          )}
          <div className="space-y-3 md:space-y-4">
            {ORDER_NOTIFICATIONS.map((notification) => {
              const Icon = notification.icon
              return (
                <Card
                  key={notification.id}
                  className={`relative cursor-pointer transition-all duration-200 py-1 hover:shadow-md ${!notification.read ? "bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
                >
                  {!notification.read && (
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 md:w-3 md:h-3 bg-red-600 rounded-full" />
                  )}
                  <CardContent className="p-3 md:p-4 lg:p-5">
                    <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                      <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center ${notification.type === "order" ? "bg-green-100 dark:bg-green-900/40" : notification.type === "offer" ? "bg-red-100 dark:bg-red-900/40" : notification.type === "promotion" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-orange-100 dark:bg-orange-900/40"}`}>
                        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 ${notification.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm sm:text-base md:text-lg font-semibold mb-1 md:mb-2 ${!notification.read ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
                          {notification.title}
                        </h3>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-400 mb-2 md:mb-3 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3 md:h-4 md:w-4" />
                          <span>{notification.time}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {ORDER_NOTIFICATIONS.length === 0 && promoNotifs.length === 0 && (
          <div className="text-center py-12 md:py-16 lg:py-20">
            <Bell className="h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 text-gray-300 dark:text-gray-600 mx-auto mb-4 md:mb-5 lg:mb-6" />
            <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2 md:mb-3">
              {t("user.notifications.emptyTitle")}
            </h3>
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
              {t("user.notifications.emptyDescription")}
            </p>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
