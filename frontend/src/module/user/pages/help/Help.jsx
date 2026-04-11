import { useState } from "react"
import { Link } from "react-router-dom"
import { 
  Search, 
  HelpCircle, 
  Package, 
  CreditCard, 
  User, 
  Truck, 
  MessageCircle, 
  Phone, 
  Mail,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  FileText,
  Shield,
  Clock,
  MapPin
} from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import ScrollReveal from "../../components/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"

const helpCategoryConfig = [
  { id: "ordering", icon: Package, color: "text-blue-600", bgColor: "bg-blue-50", topicCount: 4 },
  { id: "payments", icon: CreditCard, color: "text-green-600", bgColor: "bg-green-50", topicCount: 4 },
  { id: "delivery", icon: Truck, color: "text-orange-600", bgColor: "bg-orange-50", topicCount: 3 },
  { id: "account", icon: User, color: "text-purple-600", bgColor: "bg-purple-50", topicCount: 4 },
  { id: "refunds", icon: Shield, color: "text-red-600", bgColor: "bg-red-50", topicCount: 4 },
  { id: "general", icon: HelpCircle, color: "text-gray-600", bgColor: "bg-gray-50", topicCount: 4 }
]

export default function Help() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const helpCategories = helpCategoryConfig.map((category) => ({
    ...category,
    title: t(`user.help.categories.${category.id}.title`),
    description: t(`user.help.categories.${category.id}.description`),
    topics: Array.from({ length: category.topicCount }, (_, idx) => ({
      question: t(`user.help.categories.${category.id}.topics.${idx + 1}.question`),
      answer: t(`user.help.categories.${category.id}.topics.${idx + 1}.answer`)
    }))
  }))

  const filteredCategories = helpCategories.filter(category =>
    category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.topics.some(topic =>
      topic.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId)
    setExpandedQuestion(null)
  }

  const toggleQuestion = (questionIndex) => {
    setExpandedQuestion(expandedQuestion === questionIndex ? null : questionIndex)
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4 md:p-6 lg:p-8">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto space-y-4 md:space-y-5 lg:space-y-6">
        <ScrollReveal>
          <div className="text-center space-y-3 md:space-y-4 mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">{t("user.help.title")}</h1>
            <p className="text-base md:text-lg lg:text-xl text-muted-foreground">
              {t("user.help.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        {/* Search Bar */}
        <ScrollReveal delay={0.1}>
          <Card className="shadow-lg">
            <CardContent className="p-4 md:p-5 lg:p-6">
              <div className="relative">
                <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("user.help.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 md:pl-12 h-12 md:h-14 text-base md:text-lg"
                />
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal delay={0.2}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            <Link to="/user/orders">
                <CardContent className="p-4 md:p-5 lg:p-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-yellow-100 rounded-lg">
                      <Package className="h-5 w-5 md:h-6 md:w-6 text-primary-orange" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-semibold">{t("user.help.quickActions.trackOrder")}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("user.help.quickActions.trackOrderDescription")}</p>
                    </div>
                  </div>
                </CardContent>
            </Link>
            <Link to="/user/profile">
                <CardContent className="p-4 md:p-5 lg:p-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-blue-100 rounded-lg">
                      <User className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-semibold">{t("user.help.quickActions.manageAccount")}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">{t("user.help.quickActions.manageAccountDescription")}</p>
                    </div>
                  </div>
                </CardContent>
            </Link>
              <CardContent className="p-4 md:p-5 lg:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-green-100 rounded-lg">
                    <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold">{t("user.help.quickActions.contactSupport")}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">{t("user.help.quickActions.contactSupportDescription")}</p>
                  </div>
                </div>
              </CardContent>
          </div>
        </ScrollReveal>

        {/* Help Categories */}
        <ScrollReveal delay={0.3}>
          <div className="space-y-4 md:space-y-5 lg:space-y-6">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">{t("user.help.browseByCategory")}</h2>
            {filteredCategories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <HelpCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold mb-2">{t("user.help.noResultsFound")}</p>
                  <p className="text-muted-foreground mb-4">
                    {t("user.help.tryDifferentKeywords")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                  >
                    {t("user.help.clearSearch")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredCategories.map((category, categoryIndex) => {
                const Icon = category.icon
                const isExpanded = expandedCategory === category.id

                return (
                  <Card key={category.id} className="shadow-lg">
                    <CardHeader
                      onClick={() => toggleCategory(category.id)}
                      className="p-4 md:p-5 lg:p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`p-2 md:p-3 ${category.bgColor} rounded-lg`}>
                            <Icon className={`h-5 w-5 md:h-6 md:w-6 ${category.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg md:text-xl lg:text-2xl">{category.title}</CardTitle>
                            <CardDescription className="text-sm md:text-base">{category.description}</CardDescription>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="space-y-3 md:space-y-4 pt-0 p-4 md:p-5 lg:p-6">
                        {category.topics.map((topic, topicIndex) => {
                          const questionIndex = `${category.id}-${topicIndex}`
                          const isQuestionExpanded = expandedQuestion === questionIndex

                          return (
                            <div
                              key={topicIndex}
                              className="border rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => toggleQuestion(questionIndex)}
                              >
                                <span className="font-semibold pr-4">{topic.question}</span>
                                {isQuestionExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                              </button>
                              {isQuestionExpanded && (
                                <div className="p-4 text-muted-foreground border-t bg-muted/30">
                                  <p>{topic.answer}</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </CardContent>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </ScrollReveal>

        {/* Contact Support Section */}
        <ScrollReveal delay={0.4}>
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-lg">
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl flex items-center gap-2">
                <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-primary-orange" />
                {t("user.help.stillNeedHelp")}
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {t("user.help.supportAvailable")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 lg:space-y-6 p-4 md:p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t("user.help.phoneSupport")}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("user.help.phoneSupportDescription")}
                    </p>
                    <a
                      href="tel:+1-800-123-4567"
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      +1 (800) 123-4567
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Mail className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t("user.help.emailSupport")}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("user.help.emailSupportDescription")}
                    </p>
                    <a
                      href="mailto:support@appzeto.com"
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      support@appzeto.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t("user.help.liveChat")}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("user.help.liveChatDescription")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => alert(t("user.help.liveChatPlaceholder"))}
                    >
                      {t("user.help.startChat")}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {t("user.help.averageResponseTime")}
                </p>
        </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </AnimatedPage>
  )
}
