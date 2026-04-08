import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import {
  ArrowLeft,
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  Upload,
  Image as ImageIcon
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getRestaurantData, updateRestaurantData } from "../utils/restaurantManagement"
import { useTranslation } from "react-i18next"

export default function EditRestaurantPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeLanguage, setActiveLanguage] = useState("english")

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
  // Load restaurant data from localStorage
  const [formData, setFormData] = useState(() => {
    const savedData = getRestaurantData()
    return {
      restaurantName: savedData.restaurantName || {
        english: "Hungry Puppets",
        bengali: "",
        arabic: "",
        spanish: ""
      },
      phoneNumber: savedData.phoneNumber || "+101747410000",
      address: savedData.address || "House: 00, Road: 00, Test City",
      logo: savedData.logo || null,
      cover: savedData.cover || null,
      metaTitle: savedData.metaTitle || "Hungry Puppets Restaurant: Where Fla",
      metaDescription: savedData.metaDescription || "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Restaurant. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
      metaImage: savedData.metaImage || null
    }
  })

  // Reload data when component mounts or data changes
  useEffect(() => {
    const refreshData = () => {
      const savedData = getRestaurantData()
      setFormData({
        restaurantName: savedData.restaurantName || {
          english: "Hungry Puppets",
          bengali: "",
          arabic: "",
          spanish: ""
        },
        phoneNumber: savedData.phoneNumber || "+101747410000",
        address: savedData.address || "House: 00, Road: 00, Test City",
        logo: savedData.logo || null,
        cover: savedData.cover || null,
        metaTitle: savedData.metaTitle || "Hungry Puppets Restaurant: Where Fla",
        metaDescription: savedData.metaDescription || "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Restaurant. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
        metaImage: savedData.metaImage || null
      })
    }

    refreshData()

    window.addEventListener('restaurantDataUpdated', refreshData)
    window.addEventListener('storage', refreshData)

    return () => {
      window.removeEventListener('restaurantDataUpdated', refreshData)
      window.removeEventListener('storage', refreshData)
    }
  }, [])

  const languages = [
    { id: "english", label: t("restaurant.editRestaurant.languages.english") },
    { id: "bengali", label: t("restaurant.editRestaurant.languages.bengali") },
    { id: "arabic", label: t("restaurant.editRestaurant.languages.arabic") },
    { id: "spanish", label: t("restaurant.editRestaurant.languages.spanish") }
  ]

  const handleInputChange = (field, value) => {
    if (field === "restaurantName") {
      setFormData(prev => ({
        ...prev,
        restaurantName: {
          ...prev.restaurantName,
          [activeLanguage]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleImageUpload = (field, file) => {
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.restaurantName.english || !formData.address || !formData.phoneNumber) {
      alert(t("restaurant.editRestaurant.alerts.requiredFields"))
      return
    }

    // Save restaurant data to localStorage
    try {
      updateRestaurantData(formData)
      // Navigate back to restaurant home
      navigate("/restaurant")
    } catch (error) {
      console.error("Error saving restaurant data:", error)
      alert(t("restaurant.editRestaurant.alerts.saveFailed"))
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/restaurant")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
            aria-label={t("restaurant.editRestaurant.aria.back")}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">{t("restaurant.editRestaurant.title")}</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Restaurant Name */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">{t("restaurant.editRestaurant.fields.restaurantName")}</h2>

              {/* Language Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setActiveLanguage(lang.id)}
                    className={`flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${activeLanguage === lang.id
                        ? "text-blue-600 border-blue-600"
                        : "text-gray-600 border-transparent hover:text-gray-900"
                      }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.editRestaurant.fields.restaurantNameWithLang", { language: languages.find(l => l.id === activeLanguage)?.label.split(" - ")[0] })}
                </label>
                <input
                  type="text"
                  value={formData.restaurantName[activeLanguage]}
                  onChange={(e) => handleInputChange("restaurantName", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  placeholder={t("restaurant.editRestaurant.placeholders.restaurantName")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">{t("restaurant.editRestaurant.fields.contact")}</h2>

              {/* Phone Number */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.editRestaurant.fields.phoneNumber")} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50">
                    <span className="text-lg">🇺🇸</span>
                    <span className="text-sm text-gray-700">+1</span>
                  </div>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder={t("restaurant.editRestaurant.placeholders.phoneNumber")}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.editRestaurant.fields.address")}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  placeholder={t("restaurant.editRestaurant.placeholders.address")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Logo */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                {t("restaurant.editRestaurant.fields.restaurantLogo")}<span className="text-red-500">*</span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mb-4">
                {t("restaurant.editRestaurant.hints.logo")}
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[150px]">
                {formData.logo ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                    <img
                      src={formData.logo}
                      alt={t("restaurant.editRestaurant.fields.restaurantLogo")}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo: null }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("logo", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">{t("restaurant.editRestaurant.actions.uploadLogo")}</span>
                    </label>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Cover */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                {t("restaurant.editRestaurant.fields.restaurantCover")}<span className="text-red-500">*</span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mb-4">
                {t("restaurant.editRestaurant.hints.cover")}
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px]">
                {formData.cover ? (
                  <div className="relative w-full rounded-lg overflow-hidden">
                    <img
                      src={formData.cover}
                      alt={t("restaurant.editRestaurant.fields.restaurantCover")}
                      className="w-full h-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cover: null }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("cover", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">{t("restaurant.editRestaurant.actions.uploadCover")}</span>
                    </label>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meta Data */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">{t("restaurant.editRestaurant.fields.metaData")}</h2>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.editRestaurant.fields.title")}
                </label>
                <input
                  type="text"
                  value={formData.metaTitle}
                  onChange={(e) => handleInputChange("metaTitle", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  placeholder={t("restaurant.editRestaurant.placeholders.metaTitle")}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.editRestaurant.fields.description")}
                </label>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => handleInputChange("metaDescription", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none resize-none"
                  placeholder={t("restaurant.editRestaurant.placeholders.metaDescription")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Meta Image */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">{t("restaurant.editRestaurant.fields.metaImage")}</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[150px]">
                {formData.metaImage ? (
                  <div className="relative w-full rounded-lg overflow-hidden">
                    <img
                      src={formData.metaImage}
                      alt={t("restaurant.editRestaurant.fields.metaImage")}
                      className="w-full h-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, metaImage: null }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("metaImage", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">{t("restaurant.editRestaurant.actions.uploadMetaImage")}</span>
                    </label>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Update Button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 md:mx-0 md:border-0 md:p-0 md:mt-6">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-base md:text-lg"
            >
              {t("restaurant.editRestaurant.actions.update")}
            </Button>
          </div>
        </form>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
    </div>
  )
}
