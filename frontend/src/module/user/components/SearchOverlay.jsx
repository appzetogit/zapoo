import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, Link, useLocation as useRouterLocation } from "react-router-dom"
import { Search, Loader2, MapPin, ArrowLeft, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"
import { useProfile } from "../context/ProfileContext"
import { toast } from "sonner"
import {
  isOpenForDeliveryNow,
  isWithinDeliveryRangeKm,
} from "../utils/restaurantAvailability"

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images"


function restaurantMatchesQuery(restaurant, q) {
  const lower = q.trim().toLowerCase()
  if (!lower) return false
  if (restaurant.name?.toLowerCase().includes(lower)) return true
  const slug = (restaurant.slug || "").toLowerCase()
  if (slug.includes(lower.replace(/\s+/g, "-"))) return true
  if (Array.isArray(restaurant.cuisines)) {
    if (restaurant.cuisines.some((c) => String(c).toLowerCase().includes(lower))) return true
  }
  return false
}

function transformRestaurantForOverlay(restaurant, userLat, userLng) {
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }
  const restaurantLocation = restaurant.location
  const restaurantLat =
    restaurantLocation?.latitude ||
    (restaurantLocation?.coordinates && Array.isArray(restaurantLocation.coordinates)
      ? restaurantLocation.coordinates[1]
      : null)
  const restaurantLng =
    restaurantLocation?.longitude ||
    (restaurantLocation?.coordinates && Array.isArray(restaurantLocation.coordinates)
      ? restaurantLocation.coordinates[0]
      : null)

  let distanceInKm = null
  if (restaurant.distanceMeters != null && Number.isFinite(Number(restaurant.distanceMeters))) {
    distanceInKm = Number(restaurant.distanceMeters) / 1000
  } else if (
    userLat != null &&
    userLng != null &&
    restaurantLat != null &&
    restaurantLng != null &&
    !Number.isNaN(userLat) &&
    !Number.isNaN(userLng) &&
    !Number.isNaN(restaurantLat) &&
    !Number.isNaN(restaurantLng)
  ) {
    distanceInKm = calculateDistance(userLat, userLng, restaurantLat, restaurantLng)
  }

  const mongoId = restaurant?._id?.toString ? restaurant._id.toString() : restaurant?._id
  const restaurantId = restaurant.restaurantId || mongoId
  const rawRestaurantId = restaurant.restaurantId || null
  const slug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-")
  const image =
    restaurant.profileImage?.url ||
    (Array.isArray(restaurant.coverImages) && restaurant.coverImages[0]?.url) ||
    foodImages[0]

  return {
    id: restaurantId,
    mongoId,
    restaurantId: rawRestaurantId,
    name: restaurant.name,
    slug,
    image,
    distanceInKm,
    isActive: restaurant.isActive !== false,
    isAcceptingOrders: restaurant.isAcceptingOrders !== false,
    openDays: restaurant.openDays,
    deliveryTimings: restaurant.deliveryTimings,
    deliveryRange:
      restaurant.deliveryRange != null && Number.isFinite(Number(restaurant.deliveryRange))
        ? Number(restaurant.deliveryRange)
        : 5,
    location: restaurant.location,
  }
}

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const routerLocation = useRouterLocation()
  const inputRef = useRef(null)
  const [restaurantMatches, setRestaurantMatches] = useState([])
  const [allRestaurants, setAllRestaurants] = useState([])
  const [restaurantLoading, setRestaurantLoading] = useState(false)
  const { vegMode } = useProfile()
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)
  const isSpeechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  const userHasLocation = useMemo(
    () =>
      location?.latitude != null &&
      location?.longitude != null &&
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude)),
    [location?.latitude, location?.longitude]
  )

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (routerLocation.pathname.startsWith("/user/restaurants/")) {
      onClose()
    }
  }, [routerLocation.pathname, routerLocation.search, isOpen, onClose])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // Fallback: focus input so user can use keyboard mic (mobile) if available
      inputRef.current?.focus()
      toast.error("Voice search not supported here. Use the keyboard mic if available.")
      return
    }
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    if (window.location.protocol !== "https:" && !isLocalhost) {
      toast.error("Voice search requires HTTPS.")
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = "en-IN"
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => {
      toast("Listening...", {
        icon: <Mic className="w-4 h-4 text-orange-500 animate-pulse" />,
      })
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onSearchChange(transcript)
      if (transcript.trim()) {
        toast.success(`Searching for "${transcript}"`)
      }
    }
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error)
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please enable it in browser settings.")
      } else {
        toast.error("Could not hear you. Please try again.")
      }
    }
    recognition.start()
  }

  // Live restaurant name / cuisine suggestions (same broad list as /user/search — includes out-of-range & inactive)
  useEffect(() => {
    if (!isOpen) return
    const q = searchValue.trim()
    if (q.length < 1) {
      setRestaurantMatches([])
      setAllRestaurants([])
      setRestaurantLoading(false)
      return
    }
    const handle = setTimeout(async () => {
      try {
        setRestaurantLoading(true)
        const params = {
          includeBeyondDeliveryRange: "true",
          includeInactiveForSearch: "true",
          limit: 80,
        }
        const pureVegOnlySelected =
          vegMode === true &&
          (typeof window !== "undefined" && localStorage.getItem("userVegModeOption") === "pure-veg")
        if (pureVegOnlySelected) {
          params.pureVeg = "true"
        }
        if (zoneId) params.zoneId = zoneId
        // If user is currently out of service zone, avoid geo-filter lockout
        // and still allow explicit text search suggestions.
        if (userHasLocation && (!isOutOfService || zoneId)) {
          params.latitude = location.latitude
          params.longitude = location.longitude
        }
        const res = await restaurantAPI.getRestaurants(params)
        const list = res?.data?.data?.restaurants || []
        const userLat = userHasLocation ? Number(location.latitude) : null
        const userLng = userHasLocation ? Number(location.longitude) : null
        const transformed = list.map((r) => transformRestaurantForOverlay(r, userLat, userLng))
        setRestaurantMatches(transformed.filter((r) => restaurantMatchesQuery(r, q)))

        const eligibleForMenu = transformed.filter((r) => {
          const inRange = isWithinDeliveryRangeKm(r.distanceInKm, r.deliveryRange, { userHasLocation })
          const isOpen = isOpenForDeliveryNow({ openDays: r.openDays, deliveryTimings: r.deliveryTimings })
          return inRange && isOpen
        })

        // Fetch menus for dish suggestions (only eligible restaurants)
        const withMenus = await Promise.all(
          eligibleForMenu.map(async (r) => {
            try {
              const menuRes = await restaurantAPI.getMenuByRestaurantId(r.mongoId || r.restaurantId || r.id)
              const menu = menuRes?.data?.data?.menu || null
              return { ...r, menu }
            } catch {
              return { ...r, menu: null }
            }
          })
        )

        const menuMap = new Map(withMenus.map((r) => [String(r.id), r.menu]))
        setAllRestaurants(
          transformed.map((r) => ({
            ...r,
            menu: menuMap.get(String(r.id)) || null
          }))
        )
      } catch {
        setRestaurantMatches([])
        setAllRestaurants([])
      } finally {
        setRestaurantLoading(false)
      }
    }, 320)

    return () => clearTimeout(handle)
  }, [
    searchValue,
    isOpen,
    zoneId,
    isOutOfService,
    vegMode,
    userHasLocation,
    location?.latitude,
    location?.longitude,
  ])

  const matchingDishes = useMemo(() => {
    if (!searchValue.trim()) return []
    const lower = searchValue.toLowerCase()
    const results = []
    allRestaurants.forEach((restaurant) => {
      const inRange = isWithinDeliveryRangeKm(restaurant.distanceInKm, restaurant.deliveryRange, { userHasLocation })
      const isOpen = isOpenForDeliveryNow({
        openDays: restaurant.openDays,
        deliveryTimings: restaurant.deliveryTimings,
      })
      if (!inRange || !isOpen) return
      const menu = restaurant.menu
      if (!menu || !menu.sections) return
      menu.sections.forEach((section) => {
        if (!section.items) return
        section.items.forEach((item) => {
          const itemNameLower = (item.name || "").toLowerCase()
          const itemCategoryLower = (item.category || "").toLowerCase()
          if (itemNameLower.includes(lower) || itemCategoryLower.includes(lower)) {
            results.push({
              id: `${restaurant.id}-${item.id || item.name}`,
              name: item.name,
              image: item.image || restaurant.image,
              restaurantName: restaurant.name,
              restaurantSlug: restaurant.slug,
            })
          }
        })
        if (section.subsections) {
          section.subsections.forEach((sub) => {
            if (!sub.items) return
            sub.items.forEach((item) => {
              const itemNameLower = (item.name || "").toLowerCase()
              const itemCategoryLower = (item.category || "").toLowerCase()
              if (itemNameLower.includes(lower) || itemCategoryLower.includes(lower)) {
                results.push({
                  id: `${restaurant.id}-${item.id || item.name}`,
                  name: item.name,
                  image: item.image || restaurant.image,
                  restaurantName: restaurant.name,
                  restaurantSlug: restaurant.slug,
                })
              }
            })
          })
        }
      })
    })
    return results
  }, [searchValue, allRestaurants, userHasLocation])


  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/user/search?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }


  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                className="pl-12 pr-12 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                x-webkit-speech="true"
                speech="speech"
              />
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isSpeechSupported ? "hover:bg-gray-100 dark:hover:bg-gray-800" : "opacity-60"}`}
                aria-label="Voice search"
              >
                <Mic className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            {/* Removed top-right close button as requested */}
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {searchValue.trim().length > 0 && (
          <div className="mb-6" style={{ animation: "fadeIn 0.25s ease-out both" }}>
            <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary-orange" />
              Matching dishes & restaurants
              {restaurantLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </h3>

            <div className="space-y-3">
              {matchingDishes.map((item) => (
                <Link
                  key={item.id}
                  to={`/user/restaurants/${item.restaurantSlug}?dish=${encodeURIComponent(item.name)}`}
                  state={{ prefillDish: item.name }}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("prefillDish", item.name)
                    } catch {}
                    onClose()
                    onSearchChange("")
                  }}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#141414] hover:border-orange-200 dark:hover:border-orange-900 transition-colors">
                    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <img
                        src={item.image || foodImages[0]}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = foodImages[0]
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Dish · {item.restaurantName}</p>
                    </div>
                  </div>
                </Link>
              ))}

              {restaurantMatches.map((r) => {
                const inRange = isWithinDeliveryRangeKm(r.distanceInKm, r.deliveryRange, { userHasLocation })
                if (!inRange) return null
                const isClosed = !isOpenForDeliveryNow({ openDays: r.openDays, deliveryTimings: r.deliveryTimings })
                const slug = r.slug || r.name?.toLowerCase().replace(/\s+/g, "-")
                const content = (
                  <div className={`flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#141414] p-3 transition-colors ${
                    isClosed ? "grayscale opacity-80 cursor-not-allowed" : "hover:border-orange-200 dark:hover:border-orange-900"
                  }`}>
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800">
                      <img
                        src={r.image}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = foodImages[0]
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Restaurant</p>
                    </div>
                    {isClosed && (
                      <span className="text-[10px] font-semibold text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                        Closed
                      </span>
                    )}
                  </div>
                )
                return isClosed ? (
                  <div key={String(r.id)}>{content}</div>
                ) : (
                  <Link
                    key={String(r.id)}
                    to={`/user/restaurants/${slug}`}
                    onClick={() => {
                      onClose()
                      onSearchChange("")
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                )
              })}

              {matchingDishes.length === 0 && restaurantMatches.length === 0 && !restaurantLoading && (
                <div className="text-sm text-gray-500">No matches found.</div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
    </div>
  )
}
