import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import Lenis from "lenis"
import {
  ArrowLeft,
  Calendar,
  Megaphone,
  DollarSign,
  Edit
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { marketingAPI } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function AdDetailsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [adData, setAdData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Fetch true ad data
  useEffect(() => {
    const fetchAdDetails = async () => {
      try {
        setLoading(true)
        const res = await marketingAPI.getAdDetails(id)
        setAdData(res.data.data)
      } catch (error) {
        toast.error("Failed to load advertisement details")
        navigate("/restaurant/advertisements")
      } finally {
        setLoading(false)
      }
    }
    fetchAdDetails()
  }, [id, navigate])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Ads Details</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Ad ID and Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading ? (
            <div className="bg-white rounded-xl h-16 animate-pulse" />
          ) : (
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">
                    Ads ID #{adData?._id.slice(-8).toUpperCase()}
                  </h2>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${adData?.status === 'Active' ? 'bg-green-100 text-green-700' :
                    adData?.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                      adData?.status === 'Banner Pending' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {adData?.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Ad Information Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {loading ? (
            <div className="bg-white rounded-xl h-48 animate-pulse" />
          ) : (
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4 space-y-3">
                {/* Ads Created */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Calendar className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">Ads Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(adData?.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Calendar className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(adData?.startDate).toLocaleDateString()} - {new Date(adData?.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Ads Details */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">Target Zones</p>
                    <p className="text-sm font-bold text-gray-900">
                      {adData?.targetZones.map(z => z.name).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Redirect Target */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-0.5">Redirecting To</p>
                    <p className="text-sm font-bold text-gray-900 uppercase">{adData?.redirectTarget}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Ad Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {loading ? (
            <div className="bg-white rounded-xl h-32 animate-pulse" />
          ) : (
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">Title</h3>
                  <p className="text-sm text-gray-600">{adData?.title}</p>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">Description</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{adData?.description || 'No description provided'}</p>
                </div>

                {/* Admin Notes */}
                {adData?.notes && (
                  <div>
                    <h3 className="text-sm font-bold text-red-900 mb-1.5">Admin Feedback</h3>
                    <p className="text-sm text-red-600 italic bg-red-50 p-2 rounded">{adData.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Image Section Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {loading ? (
            <div className="bg-white rounded-xl h-64 animate-pulse" />
          ) : (
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-4 space-y-4">
                {/* Banner Image */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Campaign Banner</h3>
                  <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {adData?.status === 'Banner Pending' ? (
                      <div className="text-center p-6">
                        <Megaphone className="w-10 h-10 text-purple-500 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold text-gray-900">Banner Pending</p>
                        <p className="text-xs text-gray-500 mt-1">Admin will upload your banner shortly</p>
                      </div>
                    ) : (
                      <img
                        src={adData?.bannerImage}
                        alt="Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop`
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Metrics for active campaign */}
                {adData?.status === 'Active' && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t mt-4">
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-gray-500">Impressions</p>
                      <p className="font-bold text-gray-900">{adData.metrics?.impressions || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-gray-500">Clicks</p>
                      <p className="font-bold text-gray-900">{adData.metrics?.clicks || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-gray-500">CTR</p>
                      <p className="font-bold text-[#3B82F6]">
                        {adData.metrics?.impressions > 0
                          ? ((adData.metrics.clicks / adData.metrics.impressions) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Edit Ads Button - Fixed at Bottom */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6 z-50">
        <Button
          disabled={loading || adData?.status === 'Active'}
          onClick={() => {
            navigate(`/restaurant/advertisements/${adData?._id}/edit`)
          }}
          className="w-full bg-[#3B82F6] hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <Edit className="w-5 h-5" />
              <span>{adData?.status === 'Active' ? 'Active Campaigns cannot be edited' : 'Edit Ads'}</span>
            </>
          )}
        </Button>
      </div>

      {/* Bottom Navigation Bar */}
    </div>
  )
}

