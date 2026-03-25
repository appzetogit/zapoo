import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Calendar,
  Upload,
  Layers,
  Info,
  CheckCircle2,
  Loader2,
  MapPin,
  Tag,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { marketingAPI } from "@/lib/api"

// Returns today's date in YYYY-MM-DD format
const todayStr = () => new Date().toISOString().split("T")[0]

export default function EditAdvertisementPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)

  const [myZone, setMyZone] = useState(null)
  const [zoneLoading, setZoneLoading] = useState(true)
  const [zoneError, setZoneError] = useState(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    redirectTarget: "menu",
    bannerImage: null,       // File object if new upload, null otherwise
    existingBannerUrl: null, // URL of existing banner from API
  })

  const [dateError, setDateError] = useState("")

  // Fetch the restaurant's zone
  useEffect(() => {
    const fetchMyZone = async () => {
      try {
        const res = await marketingAPI.getMyZone()
        setMyZone(res.data.data)
      } catch (error) {
        const msg = error.response?.data?.message || "Failed to fetch your zone info"
        setZoneError(msg)
        toast.error(msg)
      } finally {
        setZoneLoading(false)
      }
    }
    fetchMyZone()
  }, [])

  // Fetch existing ad data
  useEffect(() => {
    const fetchAd = async () => {
      try {
        setFetchLoading(true)
        const res = await marketingAPI.getAdDetails(id)
        const ad = res.data.data
        if (ad) {
          setFormData({
            title: ad.title || "",
            description: ad.description || "",
            startDate: ad.startDate ? ad.startDate.split("T")[0] : "",
            endDate: ad.endDate ? ad.endDate.split("T")[0] : "",
            redirectTarget: ad.redirectTarget || "menu",
            bannerImage: null,
            existingBannerUrl: ad.bannerImage?.url || null,
          })
        }
      } catch (error) {
        toast.error("Failed to load ad details")
        navigate("/restaurant/advertisements")
      } finally {
        setFetchLoading(false)
      }
    }
    if (id) fetchAd()
  }, [id])

  // ─── Date validation ────────────────────────────────────────────────────────
  const validateDates = (startDate, endDate) => {
    const today = todayStr()

    if (startDate && startDate < today) {
      return "Start date cannot be in the past."
    }
    if (endDate && startDate && endDate < startDate) {
      return "End date cannot be before start date."
    }
    if (endDate && endDate < today) {
      return "End date cannot be in the past."
    }
    return ""
  }

  const handleStartDateChange = (e) => {
    const val = e.target.value
    const err = validateDates(val, formData.endDate)
    setDateError(err)
    if (err) {
      toast.error(err)
      // Don't update the state — keep old value
      return
    }
    setFormData(f => ({ ...f, startDate: val }))
  }

  const handleEndDateChange = (e) => {
    const val = e.target.value
    const err = validateDates(formData.startDate, val)
    setDateError(err)
    if (err) {
      toast.error(err)
      return
    }
    setFormData(f => ({ ...f, endDate: val }))
  }
  // ────────────────────────────────────────────────────────────────────────────

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    return diffDays > 0 ? diffDays : 0
  }

  const totalPrice = useMemo(() => {
    if (!myZone) return 0
    const days = calculateDays()
    if (days <= 0) return 0
    return myZone.pricePerDay * days
  }, [myZone, formData.startDate, formData.endDate])

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Banner must be under 5MB")
        return
      }
      setFormData(prev => ({ ...prev, bannerImage: file }))
    }
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      toast.error("Please fill all required fields")
      return
    }
    if (!formData.bannerImage && !formData.existingBannerUrl) {
      toast.error("Please upload a banner image")
      return
    }
    if (!myZone) {
      toast.error("Zone information not available. Please try again.")
      return
    }
    const err = validateDates(formData.startDate, formData.endDate)
    if (err) {
      toast.error(err)
      return
    }

    setLoading(true)
    try {
      const data = new FormData()
      data.append("title", formData.title)
      data.append("description", formData.description)
      data.append("startDate", formData.startDate)
      data.append("endDate", formData.endDate)
      data.append("redirectTarget", formData.redirectTarget)
      data.append("targetZones[]", myZone._id)
      if (formData.bannerImage) {
        data.append("bannerImage", formData.bannerImage)
      }

      await marketingAPI.updateAdRequest(id, data)
      toast.success("Ad updated successfully!")
      navigate("/restaurant/advertisements")
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const days = calculateDays()
  const hasBanner = formData.bannerImage || formData.existingBannerUrl
  const canSubmit =
    !loading &&
    myZone &&
    formData.title &&
    hasBanner &&
    days > 0 &&
    !dateError

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-[#fef9f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fef9f5] pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-50 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-blue-50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Edit Promoted Listing</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">

        {/* Step 1: Banner & Campaign Info */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <Layers className="w-5 h-5" />
            <h2>Campaign Creatives</h2>
          </div>
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="relative group">
                <input type="file" id="banner" hidden onChange={handleFileUpload} accept="image/*" />
                <label
                  htmlFor="banner"
                  className={`flex flex-col items-center justify-center p-8 border-2 border-dashed transition-all cursor-pointer min-h-[160px]
                    ${hasBanner ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'}`}
                >
                  {formData.bannerImage ? (
                    <div className="text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-[#3B82F6] mx-auto" />
                      <p className="text-sm font-bold text-gray-900">{formData.bannerImage.name}</p>
                      <span className="text-xs text-[#3B82F6] underline">Change Image</span>
                    </div>
                  ) : formData.existingBannerUrl ? (
                    <div className="text-center space-y-2">
                      <img
                        src={formData.existingBannerUrl}
                        alt="Current banner"
                        className="w-full max-h-32 object-cover rounded-lg mb-2"
                      />
                      <span className="text-xs text-[#3B82F6] underline">Click to change banner</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6 text-[#3B82F6]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Upload Banner Image</p>
                        <p className="text-xs text-gray-500 mt-1">Recommended: 1200×600px (Max 5MB)</p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
              <div className="p-4 space-y-4">
                <Input
                  placeholder="Campaign Title (e.g. Weekend Feast Special)"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="font-semibold text-lg border-none focus-visible:ring-0 px-0 h-auto placeholder:text-gray-300"
                />
                <textarea
                  placeholder="Short catchy description..."
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm text-gray-600 border-none focus:ring-0 resize-none px-0 bg-transparent min-h-[60px]"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Step 2: Your Zone (auto-selected, read-only) */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <MapPin className="w-5 h-5" />
            <h2>Ad Placement Zone</h2>
          </div>

          {zoneLoading ? (
            <div className="h-20 bg-gray-100 animate-pulse rounded-xl" />
          ) : zoneError ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 mb-4">
              <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-blue-900 leading-relaxed">
                  You can only have <span className="font-bold">one active campaign</span> per zone at a time.
                </p>
                <p className="text-[10px] text-blue-700 font-medium opacity-80">
                  Please choose non-overlapping dates or wait for the current campaign to finish.
                </p>
              </div>
            </div>
          ) : myZone ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border-2 border-blue-400 p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base truncate">{myZone.name}</h3>
                  <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] bg-blue-50 px-2 py-0.5 rounded-full">
                    {myZone.tier}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    ₹{myZone.pricePerDay}/day
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Auto-selected</p>
                <p className="text-xs text-gray-500 mt-0.5">Your restaurant's zone</p>
              </div>
            </motion.div>
          ) : null}

          <p className="text-xs text-gray-400 px-1">
            Your ad will be shown to customers browsing restaurants in your zone.
          </p>
        </section>

        {/* Step 3: Campaign Duration */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <Calendar className="w-5 h-5" />
            <h2>Campaign Duration</h2>
          </div>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Start Date</label>
                  <div className="relative mt-1">
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={handleStartDateChange}
                      min={todayStr()}
                      className={`pl-10 ${dateError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">End Date</label>
                  <div className="relative mt-1">
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={handleEndDateChange}
                      min={formData.startDate || todayStr()}
                      className={`pl-10 ${dateError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Date error alert */}
              {dateError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">{dateError}</p>
                </motion.div>
              )}

              {/* Duration + cost summary */}
              {days > 0 && myZone && !dateError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-blue-50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="text-sm text-gray-700">
                    <span className="font-bold text-blue-700">{days} day{days > 1 ? 's' : ''}</span>
                    <span className="text-gray-500"> × ₹{myZone.pricePerDay}/day</span>
                  </div>
                  <div className="text-base font-black text-gray-900">
                    = ₹{totalPrice}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            Changes will be reviewed by our team. Once approved, the updated campaign will go live on the scheduled start date.
          </p>
        </div>
      </div>

      {/* Checkout Bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estimated Total</span>
            <div className="flex items-center text-xl font-black text-gray-900">
              <span className="text-lg mr-1">₹</span>
              {totalPrice}
            </div>
          </div>
          <Button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-[#3B82F6] hover:bg-blue-700 text-white px-8 h-12 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex-1 sm:flex-none disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>
      </div>

    </div>
  )
}
