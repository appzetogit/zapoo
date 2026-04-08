import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "react-i18next"
import {
  Trophy,
  ChevronLeft,
  Target,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  X
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { restaurantAPI } from "@/lib/api"
import Loader from "@/components/Loader"

export default function RestaurantChallenges() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [challenges, setChallenges] = useState([])
    const [filter, setFilter] = useState("all")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedChallenge, setSelectedChallenge] = useState(null)
    const [showDetails, setShowDetails] = useState(false)

    useEffect(() => {
        fetchChallenges()
    }, [])

    const fetchChallenges = async () => {
        try {
            setLoading(true)
            const res = await restaurantAPI.getMyChallenges()
            if (res.data?.success) {
                // Backend returns { challenges: [...] }
                setChallenges(res.data.data.challenges || [])
            } else {
                setError(t("restaurant.challenges.errors.fetchFailed"))
            }
        } catch (err) {
            console.error(err)
            setError(t("restaurant.challenges.errors.unexpected"))
        } finally {
            setLoading(false)
        }
    }

    const filteredChallenges = challenges.filter(challenge => {
        if (filter === "all") return true
        if (filter === "active") return challenge.status === "active"
        if (filter === "completed") return challenge.progress?.status === "completed"
        return true
    })

    const getFrequencyLabel = (freq) => {
        switch (freq) {
            case 'daily': return t("restaurant.challenges.frequency.daily")
            case 'weekly': return t("restaurant.challenges.frequency.weekly")
            case 'monthly': return t("restaurant.challenges.frequency.monthly")
            default: return freq
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200'
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'expired': return 'bg-gray-100 text-gray-700 border-gray-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    const openDetails = (challenge) => {
        setSelectedChallenge(challenge)
        setShowDetails(true)
    }

    const closeDetails = () => {
        setShowDetails(false)
        setSelectedChallenge(null)
    }

    if (loading) return <Loader />

    return (
        <div className="min-h-screen bg-[#F3F6FC]">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-blue-100 px-4 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                                className="p-2 -ml-2 hover:bg-blue-50 rounded-full transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6 text-slate-700" />
                            </button>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-sky-500 bg-clip-text text-transparent">
                            {t("restaurant.challenges.title")}
                        </h1>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-blue-600" />
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Welcome Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-sky-500 rounded-3xl p-6 mb-8 text-white shadow-xl shadow-blue-200"
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-medium uppercase tracking-wider opacity-80">{t("restaurant.challenges.hero.badge")}</span>
                        </div>
                        <h2 className="text-3xl font-extrabold mb-2">{t("restaurant.challenges.hero.title")}</h2>
                        <p className="text-blue-100 max-w-sm mb-6 leading-relaxed">
                            {t("restaurant.challenges.hero.description")}
                        </p>
                        <div className="flex gap-4">
                            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
                                <div className="text-xs opacity-80 mb-1">{t("restaurant.challenges.hero.totalRewards")}</div>
                                <div className="text-lg font-bold">₹0.00</div>
                            </div>
                            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/20">
                                <div className="text-xs opacity-80 mb-1">{t("restaurant.challenges.hero.rank")}</div>
                                <div className="text-lg font-bold">Top 15%</div>
                            </div>
                        </div>
                    </div>
                    {/* Abstract blobs */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-[-30%] left-[-20%] w-72 h-72 bg-sky-400/30 rounded-full blur-3xl" />
                </motion.div>

                {/* Challenge Tabs/Filter */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all whitespace-nowrap ${filter === "all"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                            : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
                            }`}
                    >
                        {t("restaurant.challenges.filters.all")}
                    </button>
                    <button
                        onClick={() => setFilter("active")}
                        className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all whitespace-nowrap ${filter === "active"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                            : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
                            }`}
                    >
                        {t("restaurant.challenges.filters.active")}
                    </button>
                    <button
                        onClick={() => setFilter("completed")}
                        className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all whitespace-nowrap ${filter === "completed"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                            : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
                            }`}
                    >
                        {t("restaurant.challenges.filters.completed")}
                    </button>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 flex items-center gap-3 mb-6">
                        <CheckCircle2 className="w-5 h-5 text-red-400 rotate-180" />
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* Challenge List */}
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {filteredChallenges.length > 0 ? (
                            filteredChallenges.map((challenge, index) => {
                                const progress = challenge.progress?.currentProgress || 0
                                const target = challenge.targetValue || 100
                                const percentage = Math.min(Math.round((progress / target) * 100), 100)

                                return (
                                    <motion.div
                                        key={challenge._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="group bg-white rounded-[2rem] p-5 border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${challenge.metricKey?.includes('order') ? 'bg-sky-50' : 'bg-blue-50'
                                                    }`}>
                                                    {challenge.metricKey?.includes('order') ? (
                                                        <TrendingUp className="w-7 h-7 text-sky-600" />
                                                    ) : (
                                                        <Award className="w-7 h-7 text-blue-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${getStatusColor(challenge.status)}`}>
                                                            {getFrequencyLabel(challenge.frequency)}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                                        {challenge.challengeName}
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                                            <Target className="w-3.5 h-3.5" />
                                                            {t("restaurant.challenges.labels.target")}: {target}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                            <Zap className="w-3 h-3 fill-blue-600" />
                                                            {challenge.rewardType === 'free_banner'
                                                              ? t("restaurant.challenges.labels.rewardFreeBanner")
                                                              : t("restaurant.challenges.labels.rewardAmount", { amount: challenge.rewardValue })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-slate-900 leading-none">{percentage}%</div>
                                                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1">{t("restaurant.challenges.labels.progress")}</div>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percentage}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${percentage === 100
                                                    ? 'from-emerald-500 to-green-400'
                                                    : 'from-blue-600 to-sky-500'
                                                    }`}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                                <Clock className="w-4 h-4" />
                                                {t("restaurant.challenges.labels.expires")}: {new Date(challenge.endDate).toLocaleDateString(i18n.language === "bn" ? "bn-IN" : i18n.language === "hi" ? "hi-IN" : "en-IN", {
                                                    day: '2-digit',
                                                    month: 'short'
                                                })}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    openDetails(challenge)
                                                }}
                                                className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:gap-2 transition-all"
                                            >
                                                {t("restaurant.challenges.actions.viewDetails")} <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )
                            })
                        ) : (
                            <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-300">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                    <Trophy className="w-10 h-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{t("restaurant.challenges.empty.title")}</h3>
                                <p className="text-slate-500 max-w-xs mx-auto">
                                    {t("restaurant.challenges.empty.description", {
                                      filter: filter !== "all" ? t(`restaurant.challenges.filters.${filter}`) : "",
                                    })}
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Details bottom sheet */}
            {showDetails && selectedChallenge && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
                    <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-slate-900">
                                {selectedChallenge.challengeName}
                            </h2>
                            <button
                                type="button"
                                onClick={closeDetails}
                                className="p-1.5 rounded-full hover:bg-slate-100"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        <div className="space-y-3 text-sm text-slate-700">
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.frequency")}</span>
                                <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                                    {getFrequencyLabel(selectedChallenge.frequency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.target")}</span>
                                <span>{selectedChallenge.targetValue}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.reward")}</span>
                                <span>
                                    {selectedChallenge.rewardType === 'free_banner'
                                        ? t("restaurant.challenges.labels.freeBanner")
                                        : t("restaurant.challenges.labels.amountWithCurrency", { amount: selectedChallenge.rewardValue })}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.validity")}</span>
                                <span>
                                    {selectedChallenge.startDate
                                        ? `${new Date(selectedChallenge.startDate).toLocaleDateString(i18n.language === "bn" ? "bn-IN" : i18n.language === "hi" ? "hi-IN" : "en-IN", {
                                            day: '2-digit',
                                            month: 'short'
                                        })} → ${new Date(selectedChallenge.endDate).toLocaleDateString(i18n.language === "bn" ? "bn-IN" : i18n.language === "hi" ? "hi-IN" : "en-IN", {
                                            day: '2-digit',
                                            month: 'short'
                                        })}`
                                        : t("restaurant.challenges.common.dash")}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.currentProgress")}</span>
                                <span>
                                    {selectedChallenge.progress?.currentProgress || 0}/{selectedChallenge.targetValue}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{t("restaurant.challenges.details.status")}</span>
                                <span className="capitalize">{selectedChallenge.progress?.status || selectedChallenge.status}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={closeDetails}
                            className="mt-5 w-full py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                            {t("restaurant.challenges.actions.gotIt")}
                        </button>
                    </motion.div>
                </div>
            )}

            {/* Spacing for mobile nav */}
            <div className="h-24" />
        </div>
    )
}
