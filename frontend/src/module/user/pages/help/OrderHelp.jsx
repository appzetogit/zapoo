import { useParams, Link, useNavigate } from "react-router-dom"
import { 
  ArrowLeft, 
  Package, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Truck, 
  MessageCircle,
  Phone,
  Mail,
  FileText,
  RefreshCw,
  CreditCard,
  MapPin,
  HelpCircle
} from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import ScrollReveal from "../../components/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useOrders } from "../../context/OrdersContext"
import { useTranslation } from "react-i18next"

const commonIssueConfig = [
  { id: "late-delivery", icon: Clock, actionKeys: ["trackOrder", "contactSupport"], actionPaths: ["track", "support"], solutionCount: 4 },
  { id: "missing-items", icon: Package, actionKeys: ["viewInvoice", "reportIssue"], actionPaths: ["invoice", "support"], solutionCount: 4 },
  { id: "wrong-order", icon: XCircle, actionKeys: ["viewOrderDetails", "reportIssue"], actionPaths: ["track", "support"], solutionCount: 4 },
  { id: "quality-issue", icon: AlertCircle, actionKeys: ["reportIssue", "requestRefund"], actionPaths: ["support", "refund"], solutionCount: 4 },
  { id: "payment-issue", icon: CreditCard, actionKeys: ["viewInvoice", "contactSupport"], actionPaths: ["invoice", "support"], solutionCount: 4 },
  { id: "cancel-order", icon: RefreshCw, actionKeys: ["contactSupport", "viewOrder"], actionPaths: ["support", "track"], solutionCount: 4 }
]

export default function OrderHelp() {
  const { t, i18n } = useTranslation()
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { getOrderById } = useOrders()
  const order = getOrderById(orderId)
  const commonIssues = commonIssueConfig.map((issue) => ({
    id: issue.id,
    icon: issue.icon,
    title: t(`user.orderHelp.issues.${issue.id}.title`),
    description: t(`user.orderHelp.issues.${issue.id}.description`),
    solutions: Array.from({ length: issue.solutionCount }, (_, idx) =>
      t(`user.orderHelp.issues.${issue.id}.solutions.${idx + 1}`)
    ),
    actions: issue.actionKeys.map((key, idx) => ({
      label: t(`user.orderHelp.actions.${key}`),
      path: issue.actionPaths[idx]
    }))
  }))

  const formatDate = (dateString) => {
    if (!dateString) return t("user.orderHelp.na")
    const date = new Date(dateString)
    const localeMap = { en: "en-US", hi: "hi-IN", bn: "bn-BD" }
    return date.toLocaleDateString(localeMap[i18n.language] || "en-US", { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-blue-500"
      case "preparing":
        return "bg-primary-orange"
      case "outForDelivery":
        return "bg-orange-500"
      case "delivered":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case "confirmed":
        return t("user.orderHelp.status.confirmed")
      case "preparing":
        return t("user.orderHelp.status.preparing")
      case "outForDelivery":
        return t("user.orderHelp.status.outForDelivery")
      case "delivered":
        return t("user.orderHelp.status.delivered")
      default:
        return status
    }
  }

  const handleAction = (action) => {
    switch (action) {
      case "track":
        navigate(`/user/orders/${orderId}`)
        break
      case "invoice":
        navigate(`/user/orders/${orderId}/invoice`)
        break
      case "support":
        // Scroll to support section or open contact modal
        document.getElementById("contact-support")?.scrollIntoView({ behavior: "smooth" })
        break
      case "refund":
        alert(t("user.orderHelp.toast.refundRequestPlaceholder"))
        break
      default:
        break
    }
  }

  if (!order) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">{t("user.orderHelp.orderNotFound")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("user.orderHelp.orderNotFoundDescription", { orderId })}
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/user/orders">
                  <Button variant="outline">{t("user.orderHelp.viewAllOrders")}</Button>
                </Link>
                <Link to="/user/help">
                  <Button>{t("user.orderHelp.goToHelpCenter")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4 md:p-6 lg:p-8">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto space-y-4 md:space-y-5 lg:space-y-6">
        {/* Header */}
        <ScrollReveal>
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
            <Link to="/user/help">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{t("user.orderHelp.title")}</h1>
              <p className="text-sm md:text-base text-muted-foreground">{t("user.orderHelp.orderWithId", { id: order.id })}</p>
            </div>
          </div>
        </ScrollReveal>

        {/* Order Summary */}
        <ScrollReveal delay={0.1}>
          <Card className="shadow-lg">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl">
                  <Package className="h-4 w-4 md:h-5 md:w-5 text-primary-orange" />
                  {t("user.orderHelp.orderSummary")}
                </CardTitle>
                <Badge className={`${getStatusColor(order.status)} text-white text-xs md:text-sm`}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("user.orderHelp.orderId")}</p>
                  <p className="font-semibold">{order.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("user.orderHelp.placedOn")}</p>
                  <p className="font-semibold">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("user.orderHelp.totalAmount")}</p>
                  <p className="font-semibold text-primary-orange text-xl">${order.total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("user.orderHelp.items")}</p>
                  <p className="font-semibold">{t("user.orderHelp.itemsCount", { count: order.items?.length || 0 })}</p>
                </div>
              </div>
              {order.address && (
                <div className="pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t("user.orderHelp.deliveryAddress")}</p>
                      <p className="text-sm">
                        {order.address.street}
                        {order.address.additionalDetails && `, ${order.address.additionalDetails}`}
                        <br />
                        {order.address.city}, {order.address.state} {order.address.zipCode}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Common Issues */}
        <ScrollReveal delay={0.2}>
          <div className="space-y-4 md:space-y-5 lg:space-y-6">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">{t("user.orderHelp.whatCanWeHelpWith")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
              {commonIssues.map((issue, index) => {
                const Icon = issue.icon
                return (
                  <Card
                    key={issue.id}
                  >
                    <CardHeader className="p-4 md:p-5 lg:p-6">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="p-2 md:p-3 bg-yellow-100 rounded-lg">
                          <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary-orange" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base md:text-lg lg:text-xl">{issue.title}</CardTitle>
                          <CardDescription className="mt-1 text-sm md:text-base">{issue.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4 p-4 md:p-5 lg:p-6">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{t("user.orderHelp.whatToDo")}</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {issue.solutions.map((solution, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{solution}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        {issue.actions.map((action, idx) => (
                          <Button
                            key={idx}
                            variant={idx === 0 ? "default" : "outline"}
                            size="sm"
                            className={idx === 0 ? "bg-primary-orange hover:opacity-90" : ""}
                            onClick={() => handleAction(action.path)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={0.3}>
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-lg">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl">
                <HelpCircle className="h-4 w-4 md:h-5 md:w-5 text-primary-orange" />
                {t("user.orderHelp.quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
                <Link to={`/user/orders/${orderId}`}>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-auto py-3"
                  >
                      <Truck className="h-4 w-4" />
                      <div className="text-left">
                      <div className="font-semibold">{t("user.orderHelp.actions.trackOrder")}</div>
                      <div className="text-xs text-muted-foreground">{t("user.orderHelp.trackOrderDescription")}</div>
                    </div>
                  </Button>
                </Link>
                <Link to={`/user/orders/${orderId}/invoice`}>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-auto py-3"
                  >
                      <FileText className="h-4 w-4" />
                      <div className="text-left">
                      <div className="font-semibold">{t("user.orderHelp.actions.viewInvoice")}</div>
                      <div className="text-xs text-muted-foreground">{t("user.orderHelp.viewInvoiceDescription")}</div>
                    </div>
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-3"
                  onClick={() => document.getElementById("contact-support")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <MessageCircle className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-semibold">{t("user.orderHelp.actions.contactSupport")}</div>
                    <div className="text-xs text-muted-foreground">{t("user.orderHelp.contactSupportDescription")}</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Contact Support Section */}
        <ScrollReveal delay={0.4}>
          <Card id="contact-support" className="shadow-lg">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl flex items-center gap-2">
                <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary-orange" />
                {t("user.orderHelp.contactSupportForOrder")}
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {t("user.orderHelp.supportReadyDescription", { id: order.id })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t("user.orderHelp.phoneSupport")}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("user.orderHelp.mentionOrder", { id: order.id })}
                    </p>
                    <a
                      href="tel:+1-800-123-4567"
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      +1 (800) 123-4567
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t("user.orderHelp.emailSupport")}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("user.orderHelp.includeOrderInSubject", { id: order.id })}
                    </p>
                    <a
                      href={`mailto:support@appzeto.com?subject=Help with Order ${order.id}`}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      support@appzeto.com
                    </a>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button
                  className="w-full bg-primary-orange hover:opacity-90"
                  onClick={() => alert(t("user.orderHelp.toast.liveChatPlaceholder"))}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t("user.orderHelp.startLiveChat")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Back to Orders */}
        <ScrollReveal delay={0.5}>
          <div className="flex gap-4">
            <Link to="/user/orders" className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("user.orderHelp.backToAllOrders")}
              </Button>
            </Link>
            <Link to="/user/help" className="flex-1">
              <Button variant="outline" className="w-full">
                <HelpCircle className="h-4 w-4 mr-2" />
                {t("user.orderHelp.helpCenter")}
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </AnimatedPage>
  )
}
