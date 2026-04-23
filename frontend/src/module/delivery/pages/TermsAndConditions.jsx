import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function TermsAndConditions() {
  const [loading, setLoading] = useState(true)
  const [termsData, setTermsData] = useState({
    title: "Terms and Conditions",
    content: "<p>Loading...</p>"
  })

  useEffect(() => {
    const fetchTermsData = async () => {
      try {
        setLoading(true)
        const response = await api.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC, {
          params: { module: "delivery" }
        })
        if (response.data.success) {
          setTermsData(response.data.data)
        }
      } catch (error) {
        console.error("Error fetching delivery terms:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTermsData()
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Main Content */}
      <div className="w-full px-4 py-6 pb-24 md:pb-6">
        <div className="w-full max-w-none">
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-gray-900 font-bold text-xl md:text-2xl">{termsData.title}</h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="prose prose-sm md:prose-base max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: termsData.content }}
              />
            </div>
          )}
          </div>
      </div>

    </div>
  )
}
