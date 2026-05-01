import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { 
  ArrowLeft,
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Package
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function Notifications() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const notifications = [
    {
      id: 1,
      type: "order",
      title: t("delivery.notificationsPage.items.newOrderRequest.title"),
      message: t("delivery.notificationsPage.items.newOrderRequest.message", { restaurant: "Hungry Puppets", orderId: "100102" }),
      time: t("delivery.notificationsPage.time.minutesAgo", { count: 2 }),
      read: false,
      icon: Package,
      color: "bg-[#ff8100]"
    },
    {
      id: 2,
      type: "success",
      title: t("delivery.notificationsPage.items.orderDelivered.title"),
      message: t("delivery.notificationsPage.items.orderDelivered.message", { orderId: "100101", amount: "2,539.80" }),
      time: t("delivery.notificationsPage.time.hoursAgo", { count: 1 }),
      read: false,
      icon: CheckCircle,
      color: "bg-green-500"
    },
    {
      id: 3,
      type: "alert",
      title: t("delivery.notificationsPage.items.paymentPending.title"),
      message: t("delivery.notificationsPage.items.paymentPending.message", { orderId: "100099" }),
      time: t("delivery.notificationsPage.time.hoursAgo", { count: 3 }),
      read: true,
      icon: AlertCircle,
      color: "bg-yellow-500"
    },
    {
      id: 4,
      type: "info",
      title: t("delivery.notificationsPage.items.systemUpdate.title"),
      message: t("delivery.notificationsPage.items.systemUpdate.message"),
      time: t("delivery.notificationsPage.time.hoursAgo", { count: 5 }),
      read: true,
      icon: Info,
      color: "bg-blue-500"
    },
    {
      id: 5,
      type: "order",
      title: t("delivery.notificationsPage.items.orderCancelled.title"),
      message: t("delivery.notificationsPage.items.orderCancelled.message", { orderId: "100098" }),
      time: t("delivery.notificationsPage.time.daysAgo", { count: 1 }),
      read: true,
      icon: Package,
      color: "bg-red-500"
    },
    {
      id: 6,
      type: "success",
      title: t("delivery.notificationsPage.items.withdrawalSuccessful.title"),
      message: t("delivery.notificationsPage.items.withdrawalSuccessful.message", { amount: "41,500.00" }),
      time: t("delivery.notificationsPage.time.daysAgo", { count: 2 }),
      read: true,
      icon: CheckCircle,
      color: "bg-green-500"
    },
    {
      id: 7,
      type: "info",
      title: t("delivery.notificationsPage.items.profileUpdated.title"),
      message: t("delivery.notificationsPage.items.profileUpdated.message"),
      time: t("delivery.notificationsPage.time.daysAgo", { count: 3 }),
      read: true,
      icon: Info,
      color: "bg-blue-500"
    }
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center justify-between rounded-b-3xl md:rounded-b-none sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={() => navigate("/delivery")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t("delivery.notificationsPage.aria.goBack")}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">{t("delivery.notificationsPage.title")}</h1>
        </div>
        {unreadCount > 0 && (
          <span className="bg-[#ff8100] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {t("delivery.notificationsPage.newCount", { count: unreadCount })}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = notification.icon
              return (
                <Card 
                  key={notification.id}
                  className={`bg-white shadow-sm border py-0 border-gray-100 transition-all ${
                    !notification.read ? 'border-l-4 border-l-[#ff8100]' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`${notification.color} p-2 rounded-full flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className={`font-semibold text-sm md:text-base ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-[#ff8100] rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-gray-600 text-sm md:text-base mb-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base md:text-lg">{t("delivery.notificationsPage.empty")}</p>
          </div>
        )}
      </div>

    </div>
  )
}
