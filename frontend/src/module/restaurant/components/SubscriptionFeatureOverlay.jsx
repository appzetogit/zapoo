import { motion } from "framer-motion"
import { Lock, Crown } from "lucide-react"
import { useNavigate } from "react-router-dom"

/**
 * A wrapper component that blurs its children and shows an "Upgrade" overlay
 * if the user doesn't have the required subscription.
 */
export default function SubscriptionFeatureOverlay({ 
    children, 
    isLocked, 
    title = "Premium Feature",
    message = "Upgrade your plan to unlock this growth tool.",
    fullscreen = false,
    onGoBack
}) {
    const navigate = useNavigate()

    if (!isLocked) return <div className="h-full w-full">{children}</div>

    const overlayClass = fullscreen
        ? "fixed inset-0 bg-white/25 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center z-50"
        : "absolute inset-0 bg-white/30 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center z-10"

    const handleGoBack = (e) => {
        e.stopPropagation()
        if (typeof onGoBack === "function") {
            onGoBack()
            return
        }
        navigate(-1)
    }

    return (
        <div className={`relative overflow-hidden rounded-2xl border border-gray-100 group ${fullscreen ? "min-h-screen" : ""}`}>
            {/* Blurred content */}
            <div className="blur-[8px] grayscale-[0.2] pointer-events-none select-none opacity-40 transition-all duration-500 group-hover:blur-[10px]">
                {children}
            </div>

            {/* Overlay */}
            <div className={overlayClass}>
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center"
                >
                    <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-100 ring-4 ring-white">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 font-medium max-w-[240px] mb-6 leading-relaxed">
                        {message}
                    </p>
                    
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate("/restaurant/subscription")
                        }}
                        className="px-8 py-3 bg-gray-900 text-white text-sm font-bold rounded-2xl border border-gray-800 hover:bg-black transition-all flex items-center gap-2 cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
                        <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                        Unlock Premium
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoBack}
                        className="mt-3 px-6 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                    >
                        Go back
                    </motion.button>
                </motion.div>
            </div>
        </div>
    )
}
