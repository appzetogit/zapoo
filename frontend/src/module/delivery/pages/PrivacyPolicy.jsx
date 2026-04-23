import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { 
  ArrowLeft,
  Loader2
} from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [privacyData, setPrivacyData] = useState({
    title: "Privacy Policy",
    content: "<p>Loading...</p>"
  })

  useEffect(() => {
    const fetchPrivacyData = async () => {
      try {
        setLoading(true)
        const response = await api.get(API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC, {
          params: { module: "delivery" }
        })
        if (response.data.success) {
          setPrivacyData(response.data.data)
        }
      } catch (error) {
        console.error("Error fetching delivery privacy:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPrivacyData()
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center gap-4 rounded-b-3xl md:rounded-b-none">
        <button 
          onClick={() => navigate("/delivery/profile")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-6 pb-24 md:pb-6">
        <div className="w-full max-w-none">
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-gray-900 font-bold text-xl md:text-2xl">{privacyData.title}</h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="prose prose-sm md:prose-base max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: privacyData.content }}
              />
            </div>
          )}
          </div>
      </div>

    </div>
  )
}
