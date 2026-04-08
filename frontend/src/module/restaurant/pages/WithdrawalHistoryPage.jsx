import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Wallet } from "lucide-react"
import BottomNavOrders from "../components/BottomNavOrders"
import { restaurantAPI } from "@/lib/api"
import { useTranslation } from "react-i18next"

export default function WithdrawalHistoryPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [withdrawalHistoryTab, setWithdrawalHistoryTab] = useState('pending')
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [loadingWithdrawalRequests, setLoadingWithdrawalRequests] = useState(false)

  // Fetch withdrawal requests on mount
  useEffect(() => {
    const fetchWithdrawalRequests = async () => {
      try {
        setLoadingWithdrawalRequests(true)
        const response = await restaurantAPI.getWithdrawalRequests()
        if (response.data?.success && response.data?.data?.requests) {
          setWithdrawalRequests(response.data.data.requests)
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error('❌ Error fetching withdrawal requests:', error)
        }
      } finally {
        setLoadingWithdrawalRequests(false)
      }
    }

    fetchWithdrawalRequests()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant/hub-finance")}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t("restaurant.withdrawalHistory.aria.goBack")}
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{t("restaurant.withdrawalHistory.title")}</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 pt-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setWithdrawalHistoryTab('pending')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
              withdrawalHistoryTab === 'pending'
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t("restaurant.withdrawalHistory.tabs.pending")}
          </button>
          <button
            onClick={() => setWithdrawalHistoryTab('successful')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
              withdrawalHistoryTab === 'successful'
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t("restaurant.withdrawalHistory.tabs.successful")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loadingWithdrawalRequests ? (
          <div className="py-8 text-center text-gray-500">{t("restaurant.withdrawalHistory.loading")}</div>
        ) : (
          <>
            {withdrawalHistoryTab === 'pending' ? (
              <div className="space-y-3">
                {withdrawalRequests
                  .filter(req => req.status === 'Pending')
                  .length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">{t("restaurant.withdrawalHistory.empty.pending")}</p>
                  </div>
                ) : (
                  withdrawalRequests
                    .filter(req => req.status === 'Pending')
                    .map((request) => (
                      <div
                        key={request.id}
                        className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900 mb-2">
                              ₹{request.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-gray-600">
                              {t("restaurant.withdrawalHistory.labels.requested")}: {request.requestedAt ? new Date(request.requestedAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : t("restaurant.withdrawalHistory.common.na")}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            {t("restaurant.withdrawalHistory.status.pending")}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawalRequests
                  .filter(req => req.status === 'Approved' || req.status === 'Processed')
                  .length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">{t("restaurant.withdrawalHistory.empty.successful")}</p>
                  </div>
                ) : (
                  withdrawalRequests
                    .filter(req => req.status === 'Approved' || req.status === 'Processed')
                    .map((request) => (
                      <div
                        key={request.id}
                        className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-lg font-bold text-gray-900 mb-2">
                              ₹{request.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-gray-600">
                              {t("restaurant.withdrawalHistory.labels.processed")}: {request.processedAt ? new Date(request.processedAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : t("restaurant.withdrawalHistory.common.na")}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            {request.status === 'Approved' ? t("restaurant.withdrawalHistory.status.approved") : t("restaurant.withdrawalHistory.status.processed")}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNavOrders />
    </div>
  )
}
