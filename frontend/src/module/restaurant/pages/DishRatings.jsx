import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function DishRatings() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  // Restaurant information - in a real app, this would come from state/context/API
  const restaurantName = t("restaurant.dishRatings.restaurantName")
  const restaurantId = "20959122"
  const restaurantLocation = t("restaurant.dishRatings.restaurantLocation")

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t("restaurant.dishRatings.aria.goBack")}
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{restaurantName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">{restaurantId}</span>
              <span className="text-xs text-gray-500">·</span>
              <span className="text-xs text-gray-500">{restaurantLocation.slice(0, 30)}...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t("restaurant.dishRatings.empty")}
          </p>
        </div>
      </div>
    </div>
  )
}
