import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ChevronRight, Menu, Megaphone, Crown, Bell } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import offersAndDiscountsIcon from "@/assets/hub/icons/offersanddiscounts.png"
import { subscriptionAPI } from "@/lib/api"

export default function HubGrowth() {
  const navigate = useNavigate()
  const [activePlan, setActivePlan] = useState(null)

  useEffect(() => {
    subscriptionAPI.getMySubscription()
      .then((res) => {
        if (res?.data?.success && res?.data?.data?.status === 'active') {
          setActivePlan(res.data.data?.planId?.name || null)
        }
      })
      .catch(() => { }) // silently ignore if not subscribed
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Grow your business</h1>
          <button
            onClick={() => navigate("/restaurant/explore")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        {/* Build your own section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Build your own</h2>

          <div className="space-y-3">
            {/* Offers and discounts card */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/restaurant/hub-growth/create-offers")}
              className="bg-white rounded-lg p-4 flex items-center gap-4  border border-gray-200 cursor-pointer "
            >
              <div className="shrink-0">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <img src={offersAndDiscountsIcon} alt="Offers and discounts" className="w-full h-full object-contain" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">Offers and discounts</h3>
                <p className="text-sm text-gray-600">Start your own offers and grow your business</p>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
            </motion.div>

            {/* Promoted Banners card */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/restaurant/advertisements")}
              className="bg-white rounded-lg p-4 flex items-center gap-4  border border-gray-200 cursor-pointer "
            >
              <div className="shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">Promoted Banners</h3>
                <p className="text-sm text-gray-600">Get better visibility on homepage & search</p>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
            </motion.div>

            {/* Notify Customers card */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/restaurant/notify-customers")}
              className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200 cursor-pointer"
            >
              <div className="shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">Notify Customers</h3>
                <p className="text-sm text-gray-600">Request admin to send a push notification to all users</p>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
            </motion.div>

            {/* Subscription Plan card 
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/restaurant/subscription")}
              className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200 cursor-pointer"
            >
              <div className="shrink-0">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-gray-900">Subscription Plan</h3>
                  {activePlan && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 leading-tight">
                      {activePlan}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {activePlan
                    ? `Active plan: ${activePlan}. Tap to manage.`
                    : "View all plans & manage your active subscription"}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
            </motion.div>
            */}

          </div>
        </div>
      </div>

      <BottomNavOrders />
    </div>
  )
}
