import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, X, AlertTriangle, Clock } from "lucide-react"
import { subscriptionAPI } from "@/lib/api"

const DISMISS_KEY = "subscription_renewal_dismissed_date"

/**
 * Shows a popup warning when the restaurant's subscription plan
 * is expiring within 3 days (or already expired).
 *
 * Edge cases handled:
 * - No subscription → no popup
 * - auto-renewal is ON → no popup (it'll renew automatically)
 * - Already expired → shows "Expired" variant
 * - Within 3 days of expiry → shows "Expiring soon" variant
 * - More than 3 days left → no popup
 * - Dismissed today → no popup again until next day
 * - API error → silently skips popup
 */
export default function SubscriptionRenewalPopup() {
    const navigate = useNavigate()
    const [popupState, setPopupState] = useState(null) // null | 'expiring' | 'expired'
    const [planName, setPlanName] = useState("")
    const [daysLeft, setDaysLeft] = useState(0)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Don't show again if already dismissed today
        const dismissedDate = sessionStorage.getItem(DISMISS_KEY)
        const today = new Date().toDateString()
        if (dismissedDate === today) return

        let cancelled = false

        subscriptionAPI.getMySubscription()
            .then((res) => {
                if (cancelled) return
                const sub = res?.data?.data
                if (!sub || !sub.planId || (sub.status !== 'active' && sub.status !== 'expired')) return

                // If auto-renew is ON, the plan will renew automatically — no warning needed
                if (sub.autoRenew) return

                const endDate = new Date(sub.endDate)
                const now = new Date()
                if (Number.isNaN(endDate.getTime())) return
                const isExpiredNow = endDate.getTime() <= now.getTime()
                const startOfToday = new Date(now)
                startOfToday.setHours(0, 0, 0, 0)
                const startOfEndDay = new Date(endDate)
                startOfEndDay.setHours(0, 0, 0, 0)
                const days = Math.max(
                    0,
                    Math.round((startOfEndDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))
                )

                const name = sub.planId?.name || "your current plan"
                setPlanName(name)

                if (isExpiredNow) {
                    // Already expired (time-based)
                    setDaysLeft(0)
                    setPopupState('expired')
                    setVisible(true)
                } else if (days <= 3) {
                    // Within 3 days of expiry
                    setDaysLeft(days)
                    setPopupState('expiring')
                    setVisible(true)
                }
                // else: more than 3 days left → do nothing
            })
            .catch(() => { }) // silently ignore errors

        return () => { cancelled = true }
    }, [])

    const handleDismiss = () => {
        // Remember dismissal for the rest of the day (per session)
        sessionStorage.setItem(DISMISS_KEY, new Date().toDateString())
        setVisible(false)
    }

    const handleRenew = () => {
        handleDismiss()
        navigate("/restaurant/subscription")
    }

    if (!popupState) return null

    const isExpired = popupState === 'expired'

    return (
        <AnimatePresence>
            {visible && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleDismiss}
                    />

                    {/* Popup Card */}
                    <motion.div
                        className="fixed inset-x-4 bottom-24 z-[9991] max-w-sm mx-auto"
                        initial={{ opacity: 0, y: 60, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                        <div className={`rounded-2xl shadow-2xl overflow-hidden border ${isExpired
                                ? 'bg-white border-red-200'
                                : 'bg-white border-amber-200'
                            }`}>
                            {/* Coloured top strip */}
                            <div className={`px-5 pt-5 pb-4 ${isExpired ? 'bg-red-50' : 'bg-amber-50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
                                            {isExpired
                                                ? <AlertTriangle className="w-5 h-5 text-red-500" />
                                                : <Clock className="w-5 h-5 text-amber-500" />
                                            }
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold uppercase tracking-wider ${isExpired ? 'text-red-500' : 'text-amber-600'}`}>
                                                {isExpired ? 'Plan Expired' : 'Plan Expiring Soon'}
                                            </p>
                                            <h3 className="text-base font-bold text-gray-900 mt-0.5">
                                                {isExpired
                                                    ? `Your ${planName} plan has expired`
                                                    : daysLeft === 0
                                                        ? `Your ${planName} expires today`
                                                        : daysLeft === 1
                                                            ? `Your ${planName} expires tomorrow`
                                                            : `Your ${planName} expires in ${daysLeft} days`
                                                }
                                            </h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDismiss}
                                        className="p-1.5 rounded-full hover:bg-gray-200 transition-colors shrink-0 mt-0.5"
                                        aria-label="Dismiss"
                                    >
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="px-5 py-4">
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {isExpired
                                        ? "Your subscription has ended. Renew now to keep enjoying premium features and maintain your business visibility."
                                        : "Renew before it expires to avoid any interruption in your premium features and restaurant visibility."
                                    }
                                </p>

                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={handleDismiss}
                                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        Later
                                    </button>
                                    <button
                                        onClick={handleRenew}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${isExpired
                                                ? 'bg-red-500 hover:bg-red-600'
                                                : 'bg-amber-500 hover:bg-amber-600'
                                            }`}
                                    >
                                        <Crown className="w-4 h-4" />
                                        {isExpired ? 'Renew Now' : 'Renew Plan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
