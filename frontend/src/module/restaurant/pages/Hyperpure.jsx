import { motion } from "framer-motion"
import { Leaf } from "lucide-react"
import { useTranslation } from "react-i18next"
import BottomNavOrders from "../components/BottomNavOrders"

export default function Hyperpure() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex items-center justify-center"
      >
        <div className="text-center">
          <Leaf className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("restaurant.hyperpure.title")}</h2>
          <p className="text-gray-600">{t("restaurant.hyperpure.underDevelopment")}</p>
        </div>
      </motion.div>
      <BottomNavOrders />
    </div>
  )
}
