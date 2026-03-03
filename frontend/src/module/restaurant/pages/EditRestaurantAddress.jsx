import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const ADDRESS_STORAGE_KEY = "restaurant_address"

// Default coordinates for Indore (can be updated based on actual location)
const DEFAULT_LAT = 22.7196
const DEFAULT_LNG = 75.8577

export default function EditRestaurantAddress() {
  const navigate = useNavigate()
  const [address, setAddress] = useState("")
  const [restaurantName, setRestaurantName] = useState("")
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lat, setLat] = useState(DEFAULT_LAT)
  const [lng, setLng] = useState(DEFAULT_LNG)
  const [addressFields, setAddressFields] = useState({
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    landmark: ""
  })

  // Format address from location object
  const formatAddress = (loc) => {
    if (!loc) return ""
    const parts = []
    if (loc.addressLine1) parts.push(loc.addressLine1.trim())
    if (loc.addressLine2) parts.push(loc.addressLine2.trim())
    if (loc.area) parts.push(loc.area.trim())
    if (loc.city) {
      const city = loc.city.trim()
      if (!loc.area || !loc.area.includes(city)) {
        parts.push(city)
      }
    }
    if (loc.landmark) parts.push(loc.landmark.trim())
    return parts.join(", ") || ""
  }

  // Fetch restaurant data from backend
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantName(data.name || "")
          if (data.location) {
            setLocation(data.location)
            setAddressFields({
              addressLine1: data.location.addressLine1 || "",
              addressLine2: data.location.addressLine2 || "",
              area: data.location.area || "",
              city: data.location.city || "",
              landmark: data.location.landmark || ""
            })
            const formatted = formatAddress(data.location)
            setAddress(formatted)
            // Set coordinates if available
            if (data.location.latitude && data.location.longitude) {
              setLat(data.location.latitude)
              setLng(data.location.longitude)
            }
          } else {
            // Fallback to localStorage
            try {
              const savedAddress = localStorage.getItem(ADDRESS_STORAGE_KEY)
              if (savedAddress) {
                setAddress(savedAddress)
              }
            } catch (error) {
              console.error("Error loading address from storage:", error)
            }
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant data:", error)
        }
        // Fallback to localStorage
        try {
          const savedAddress = localStorage.getItem(ADDRESS_STORAGE_KEY)
          if (savedAddress) {
            setAddress(savedAddress)
          }
          // Try to get restaurant name from localStorage, but prefer empty string over hardcoded value
          const savedName = localStorage.getItem("restaurant_name") ||
            localStorage.getItem("restaurantName") ||
            ""
          setRestaurantName(savedName)
        } catch (e) {
          console.error("Error loading from localStorage:", e)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()

    // Listen for address updates
    const handleAddressUpdate = () => {
      fetchRestaurantData()
    }

    window.addEventListener("addressUpdated", handleAddressUpdate)
    return () => window.removeEventListener("addressUpdated", handleAddressUpdate)
  }, [])

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

  // Handle opening Google Maps app
  const handleViewOnMap = () => {
    // Create Google Maps URL for the restaurant location
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

    // Try to open in Google Maps app (mobile) or web
    window.open(googleMapsUrl, "_blank")
  }

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    const updatedFields = {
      ...addressFields,
      [name]: value
    }
    setAddressFields(updatedFields)
    setAddress(formatAddress(updatedFields))
  }

  // Removed handleUpdateClick as it's no longer needed

  // Handle Proceed to update (Now used directly by the main Update button)
  const handleSaveAddress = async () => {
    try {
      setLoading(true)

      const finalFormattedAddress = formatAddress(addressFields)

      // Update location with both manual fields and map coordinates
      const updatedLocation = {
        ...location,
        ...addressFields,
        latitude: lat,
        longitude: lng,
        coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
        formattedAddress: finalFormattedAddress || address
      }

      const response = await restaurantAPI.updateProfile({ location: updatedLocation })

      if (response?.data?.success || response?.data?.data?.restaurant) {
        setLocation(updatedLocation)
        setAddress(finalFormattedAddress)
        window.dispatchEvent(new Event("addressUpdated"))
        toast.success("Address updated successfully!")
        navigate(-1)
      } else {
        throw new Error("Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating address:", error)
      toast.error(error.response?.data?.message || error.message || "Failed to update address")
    } finally {
      setLoading(false)
    }
  }

  // Get simplified address for navbar (last two parts: area, city)
  const getSimplifiedAddress = (fullAddress) => {
    const parts = fullAddress.split(",").map(p => p.trim())
    if (parts.length >= 2) {
      // Return last two parts (e.g., "By Pass Road (South), Indore")
      return parts.slice(-2).join(", ")
    }
    return fullAddress
  }

  const simplifiedAddress = getSimplifiedAddress(address)

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-[60] flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-base font-bold text-gray-900 truncate">{restaurantName}</h1>
            <ChevronDown className="w-4 h-4 text-gray-900 shrink-0" />
          </div>
          <p className="text-xs text-gray-600 truncate">{simplifiedAddress}</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Map Section - Takes flexible remaining space */}
        <div className="flex-1 min-h-[180px] md:min-h-[200px] relative overflow-hidden bg-gray-50">
          {/* Google Maps Embed */}
          <iframe
            src={`https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
          />

          {/* Custom Marker Tooltip Overlay */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
            {/* Tooltip */}
            <div className="bg-black text-white px-3 py-2 rounded-lg mb-2 whitespace-nowrap shadow-lg">
              <p className="text-xs font-semibold">Your outlet location</p>
              <p className="text-[10px] text-gray-300">Orders will be picked up from here</p>
            </div>
            {/* Marker Pin */}
            <div className="w-6 h-6 bg-black rounded-full border-2 border-white shadow-lg mx-auto"></div>
          </div>
        </div>

        {/* Address Details Section - Stays below map in flex flow but can scroll */}
        <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-4 pt-6 pb-2 z-20 shrink-0 border-t border-gray-100 mobile-address-container">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-4">Outlet address</h2>

          {/* Manual Address Entry - Integrated and scrollable if height is tight */}
          <div
            className="max-h-[40vh] md:max-h-[35vh] overflow-y-auto pr-1 space-y-4 mb-4 custom-scrollbar"
            style={{ touchAction: 'pan-y' }}
            data-lenis-prevent
          >
            <div className="relative z-50">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Building / Street</label>
              <input
                type="text"
                name="addressLine1"
                value={addressFields.addressLine1}
                onChange={handleInputChange}
                placeholder="Building name, street etc."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
              />
            </div>

            <div className="relative z-50">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Floor / Suite (Optional)</label>
              <input
                type="text"
                name="addressLine2"
                value={addressFields.addressLine2}
                onChange={handleInputChange}
                placeholder="Floor, suite, subunit etc."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative z-50">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Area</label>
                <input
                  type="text"
                  name="area"
                  value={addressFields.area}
                  onChange={handleInputChange}
                  placeholder="Area / Locality"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="relative z-50">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">City</label>
                <input
                  type="text"
                  name="city"
                  value={addressFields.city}
                  onChange={handleInputChange}
                  placeholder="City"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
            </div>

            <div className="relative z-50">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Landmark</label>
              <input
                type="text"
                name="landmark"
                value={addressFields.landmark}
                onChange={handleInputChange}
                placeholder="Famous nearby place"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Update Button */}
          <div className="pb-4 pt-2">
            <button
              onClick={handleSaveAddress}
              disabled={loading}
              className="w-full bg-black text-white font-semibold py-4 text-base rounded-xl flex items-center justify-center gap-2 hover:bg-gray-900 active:scale-[0.98] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg shadow-black/10"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Updating Details..." : "Save Address"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
