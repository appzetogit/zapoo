import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Trophy,
    ChevronLeft,
    Target,
    Clock,
    CheckCircle2,
    ChevronRight,
    Zap,
    Bike,
    ShieldCheck,
    Award
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { deliveryAPI } from "@/lib/api"
import Loader from "@/components/Loader"

export default function DeliveryChallenges() {
    const navigate = useNavigate()
    const [challenges, setChallenges] = useState([])
    const [weeklyBonus, setWeeklyBonus] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchChallenges()
    }, [])

    const fetchChallenges = async () => {
        try {
            setLoading(true)
            const [challengesRes, walletRes] = await Promise.all([
                deliveryAPI.getMyChallenges(),
                deliveryAPI.getWallet().catch(() => null)
            ])

            if (challengesRes.data?.success) {
                // Backend returns { challenges: [...] }
                setChallenges(challengesRes.data.data.challenges || [])
            } else {
                setError("Failed to load challenges")
            }

            const txns = walletRes?.data?.data?.wallet?.transactions || []
            const now = new Date()
            const weekStart = new Date(now)
            const day = weekStart.getDay()
            const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
            weekStart.setDate(diff)
            weekStart.setHours(0, 0, 0, 0)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)
            weekEnd.setHours(23, 59, 59, 999)

            const weekBonus = txns
                .filter((t) => t?.type === "bonus" && t?.status === "Completed")
                .filter((t) => {
                    const d = new Date(t?.createdAt || t?.date || 0)
                    return !Number.isNaN(d.getTime()) && d >= weekStart && d <= weekEnd
                })
                .reduce((sum, t) => sum + (Number(t?.amount) || 0), 0)

            setWeeklyBonus(weekBonus)
        } catch (err) {
            console.error(err)
            setError("Unable to connect. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const getFrequencyLabel = (freq) => {
        switch (freq) {
            case 'daily': return 'Daily'
            case 'weekly': return 'Weekly'
            case 'monthly': return 'Monthly'
            default: return freq
        }
    }

    if (loading) return <Loader />

    return (
        <div className="min-h-screen bg-[#FDF2F2]">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#DC2626] text-white px-4 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Earning Challenges</h1>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                </div>
            </div>

            <div className="px-4 py-6">
                {/* Banner Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2rem] p-6 mb-8 shadow-xl shadow-red-200/50 border border-red-50 relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Extra Earnings</span>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">Crush Your Targets</h2>
                        <p className="text-sm text-gray-600 mb-4 font-medium italic">"Every delivery gets you closer to a bonus! Rewards are applied automatically when you hit the target."</p>

                    <div className="bg-red-50 rounded-2xl p-4 flex items-center border border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                                <Bike className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] text-red-600 font-bold uppercase">This Week</div>
                                <div className="text-lg font-black text-gray-900">₹{Number(weeklyBonus || 0).toFixed(0)} Bonuses</div>
                            </div>
                        </div>
                    </div>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-red-50 rounded-full" />
                    <div className="absolute bottom-[20%] left-[-5%] w-16 h-16 bg-red-100/50 rounded-full" />
                </motion.div>

                {/* Section Title */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-red-600 fill-red-600" />
                        Active Missions
                    </h3>
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">{challenges.length} Available</span>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-white border border-red-100 text-red-700 rounded-2xl p-4 mb-6 shadow-sm flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-red-400" />
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                {/* Challenges Feed */}
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {challenges.length > 0 ? (
                            challenges.map((challenge, index) => {
                                const progress = challenge.progress?.currentProgress || 0
                                const target = challenge.targetValue || 100
                                const percentage = Math.min(Math.round((progress / target) * 100), 100)

                                return (
                                    <motion.div
                                        key={challenge._id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 active:scale-95 transition-transform"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center relative">
                                                    <Award className="w-6 h-6 text-[#DC2626]" />
                                                    {percentage > 0 && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="bg-red-50 text-[#DC2626] text-[9px] font-black px-2 py-0.5 rounded-full inline-block uppercase mb-1">
                                                        {getFrequencyLabel(challenge.frequency)}
                                                    </div>
                                                    <h4 className="text-base font-black text-gray-900 leading-tight">
                                                        {challenge.challengeName}
                                                    </h4>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-black text-red-600">₹{challenge.rewardValue}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Reward</div>
                                            </div>
                                        </div>

                                        {/* Compact Progress */}
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percentage}%` }}
                                                    transition={{ duration: 1 }}
                                                    className="h-full bg-[#DC2626] rounded-full"
                                                />
                                            </div>
                                            <span className="text-xs font-black text-gray-900 whitespace-nowrap">{progress}/{target}</span>
                                        </div>

                                        <div className="flex items-center mt-4 pt-4 border-t border-dashed border-gray-100">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                                                <Clock className="w-3.5 h-3.5" />
                                                Ends {new Date(challenge.endDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })
                        ) : (
                            <div className="bg-white py-16 rounded-[2.5rem] text-center px-8 shadow-sm">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Target className="w-8 h-8 text-red-200" />
                                </div>
                                <h4 className="text-xl font-black text-gray-900 mb-2">Rest Up!</h4>
                                <p className="text-sm text-gray-500 font-medium">No active missions right now. We'll alert you when a new challenge drops.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Motivation Footer */}
            <div className="px-4 mt-4 pb-10">
                <div className="bg-[#DC2626]/5 rounded-2xl p-4 border border-[#DC2626]/10 text-center">
                    <p className="text-xs font-bold text-[#DC2626]">Top Performers Earn 40% More Bonuses Weekly</p>
                </div>
            </div>
        </div>
    )
}
