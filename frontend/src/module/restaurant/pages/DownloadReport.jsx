import { useState, useMemo, useEffect } from "react"
import { ArrowLeft, CheckCircle, Mail } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

const REPORT_VIEWS = ["detailed", "item"]
const VIEW_TYPES = ["daily", "weekly", "monthly"]

export default function DownloadReport() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [reportView, setReportView] = useState("detailed")
  const [viewType, setViewType] = useState("daily")
  const durations = useMemo(() => {
    if (viewType === "weekly") {
      return [
        { id: "4w", labelKey: "restaurant.downloadReport.durations.weekly.last4w" },
        { id: "8w", labelKey: "restaurant.downloadReport.durations.weekly.last8w" },
        { id: "12w", labelKey: "restaurant.downloadReport.durations.weekly.last12w" },
        { id: "custom", labelKey: "restaurant.downloadReport.durations.common.custom" },
      ]
    }
    if (viewType === "monthly") {
      return [
        { id: "3m", labelKey: "restaurant.downloadReport.durations.monthly.last3m" },
        { id: "6m", labelKey: "restaurant.downloadReport.durations.monthly.last6m" },
        { id: "12m", labelKey: "restaurant.downloadReport.durations.monthly.last12m" },
        { id: "custom", labelKey: "restaurant.downloadReport.durations.common.custom" },
      ]
    }
    return [
      { id: "7", labelKey: "restaurant.downloadReport.durations.daily.last7" },
      { id: "14", labelKey: "restaurant.downloadReport.durations.daily.last14" },
      { id: "30", labelKey: "restaurant.downloadReport.durations.daily.last30" },
      { id: "custom", labelKey: "restaurant.downloadReport.durations.common.custom" },
    ]
  }, [viewType])

  const [duration, setDuration] = useState("7")
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (durations.length > 0 && !durations.find((d) => d.id === duration)) {
      setDuration(durations[0].id)
    }
  }, [viewType, durations, duration])

  const handleSend = () => {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 z-20 bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-200">
        <button
          className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          onClick={() => navigate(-1)}
          aria-label={t("restaurant.downloadReport.aria.back")}
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{t("restaurant.downloadReport.title")}</h1>
      </div>

      <div className="bg-[#f8e7a0] text-gray-900 text-sm px-4 py-2">
        {t("restaurant.downloadReport.banner.generatingFor")}{" "}
        <span className="font-semibold">{t("restaurant.downloadReport.banner.allOutlets")}</span>
      </div>

      <div className="flex-1 px-4 py-5 space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">{t("restaurant.downloadReport.labels.selectReportView")}</p>
          <div className="space-y-3">
            {REPORT_VIEWS.map((id) => (
              <label key={id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="reportView"
                  value={id}
                  checked={reportView === id}
                  onChange={() => setReportView(id)}
                  className="w-5 h-5 accent-black"
                />
                {t(`restaurant.downloadReport.reportViews.${id}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">{t("restaurant.downloadReport.labels.selectDataView")}</p>
          <div className="grid grid-cols-3 border border-gray-300 rounded-xl overflow-hidden text-center text-sm font-semibold">
            {VIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={`py-2 ${viewType === type ? "bg-black text-white" : "bg-white text-gray-800"}`}
              >
                {t(`restaurant.downloadReport.viewTypes.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">{t("restaurant.downloadReport.labels.selectDuration")}</p>
          <div className="space-y-3">
            {durations.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="duration"
                  value={opt.id}
                  checked={duration === opt.id}
                  onChange={() => setDuration(opt.id)}
                  className="w-5 h-5 accent-black"
                />
                {t(opt.labelKey)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-6">
        <button
          onClick={handleSend}
          className="w-full bg-black text-white py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Mail className="w-5 h-5" />
          {t("restaurant.downloadReport.actions.sendEmail")}
        </button>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-6 pointer-events-none">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-200 px-4 py-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("restaurant.downloadReport.success.title")}</p>
                <p className="text-xs text-gray-600">{t("restaurant.downloadReport.success.subtitle")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





