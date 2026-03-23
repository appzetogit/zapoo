import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { X, Search, Clock, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { useLocation } from "../hooks/useLocation"
import { useZone } from "../hooks/useZone"
import {
  getSearchUnavailableLabel,
  isRestaurantDeliverableNow,
} from "../utils/restaurantAvailability"

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images"

// Recent search suggestions
const recentSuggestions = [
  "Biryani", "Cake", "Chhole Bhature", "Chicken Tanduri", "Donuts", "Dosa", "French Fries", "Idli"
]

// Categories matching the home page browse section - only unique categories
const categories = [
  { id: 1, name: "Biryani", image: foodImages[0] },
  { id: 2, name: "Cake", image: foodImages[1] },
  { id: 3, name: "Chhole Bhature", image: foodImages[2] },
  { id: 4, name: "Chicken Tanduri", image: foodImages[3] },
  { id: 5, name: "Donuts", image: foodImages[4] },
  { id: 6, name: "Dosa", image: foodImages[5] },
  { id: 7, name: "French Fries", image: foodImages[6] },
  { id: 8, name: "Idli", image: foodImages[7] },
  { id: 9, name: "Momos", image: foodImages[8] },
  { id: 10, name: "Samosa", image: foodImages[9] },
  { id: 11, name: "Starters", image: foodImages[10] },
]

// Use only unique categories (no duplicates)
const allFoodsWithWhiteBg = categories

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

  const restaurantId = restaurant.restaurantId || restaurant._id
  const slug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-")
  const image =
    restaurant.profileImage?.url ||
    (Array.isArray(restaurant.coverImages) && restaurant.coverImages[0]?.url) ||
    foodImages[0]

  return {
    id: restaurantId,
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
  const inputRef = useRef(null)
  const [filteredFoods, setFilteredFoods] = useState(allFoodsWithWhiteBg)
  const [restaurantMatches, setRestaurantMatches] = useState([])
  const [restaurantLoading, setRestaurantLoading] = useState(false)
  const { location } = useLocation()
  const { zoneId, isOutOfService } = useZone(location)

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

  useEffect(() => {
    if (searchValue.trim() === "") {
      setFilteredFoods(allFoodsWithWhiteBg)
    } else {
      const filtered = allFoodsWithWhiteBg.filter((food) =>
        food.name.toLowerCase().includes(searchValue.toLowerCase())
      )
      setFilteredFoods(filtered)
    }
  }, [searchValue])

  // Live restaurant name / cuisine suggestions (same broad list as /user/search — includes out-of-range & inactive)
  useEffect(() => {
    if (!isOpen) return
    const q = searchValue.trim()
    if (q.length < 1) {
      setRestaurantMatches([])
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
        const transformed = list
          .filter((r) => restaurantMatchesQuery(r, q))
          .map((r) => transformRestaurantForOverlay(r, userLat, userLng))
        setRestaurantMatches(transformed)
      } catch {
        setRestaurantMatches([])
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
    userHasLocation,
    location?.latitude,
    location?.longitude,
  ])

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion)
    inputRef.current?.focus()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      navigate(`/user/search?q=${encodeURIComponent(searchValue.trim())}`)
      onClose()
      onSearchChange("")
    }
  }

  const handleFoodClick = (food) => {
    navigate(`/user/search?q=${encodeURIComponent(food.name)}`)
    onClose()
    onSearchChange("")
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
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                className="pl-12 pr-4 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {/* Suggestions Row */}
        <div
          className="mb-6"
          style={{
            animation: 'slideDown 0.3s ease-out 0.1s both'
          }}
        >
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary-orange" />
            Recent Searches
          </h3>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            {recentSuggestions.slice(0, 8).map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 text-gray-700 dark:text-gray-300 hover:text-primary-orange dark:hover:text-orange-400 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md"
                style={{
                  animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both`
                }}
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary-orange flex-shrink-0" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live restaurant matches (typing) */}
        {searchValue.trim().length > 0 && (
          <div className="mb-8" style={{ animation: "fadeIn 0.25s ease-out both" }}>
            <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary-orange" />
              Restaurants
              {restaurantLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </h3>
            {!restaurantLoading && restaurantMatches.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No matching restaurant names in your area.</p>
            )}
            <ul className="space-y-2">
              {restaurantMatches.map((r) => {
                const deliverable = isRestaurantDeliverableNow(r, { userHasLocation })
                const reason = !deliverable
                  ? getSearchUnavailableLabel(r, { distanceInKm: r.distanceInKm, userHasLocation })
                  : null
                const slug = r.slug || r.name?.toLowerCase().replace(/\s+/g, "-")
                return (
                  <li key={String(r.id)}>
                    <Link
                      to={`/user/restaurants/${slug}`}
                      onClick={() => {
                        onClose()
                        onSearchChange("")
                      }}
                      className={`flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#141414] p-3 hover:border-orange-200 dark:hover:border-orange-900 transition-colors ${
                        !deliverable ? "grayscale opacity-80" : ""
                      }`}
                    >
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
                        {reason && (
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-500 line-clamp-2 mt-0.5">
                            {reason}
                          </p>
                        )}
                        {deliverable && r.distanceInKm != null && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {r.distanceInKm >= 1
                              ? `${r.distanceInKm.toFixed(1)} km away`
                              : `${Math.round(r.distanceInKm * 1000)} m away`}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Food Grid */}
        <div
          style={{
            animation: 'fadeIn 0.3s ease-out 0.2s both'
          }}
        >
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
            {searchValue.trim() === ""
              ? "All Dishes"
              : `Dishes & categories (${filteredFoods.length})`}
          </h3>
          {(() => {
            const typed = searchValue.trim().length > 0
            const totalHits = filteredFoods.length + restaurantMatches.length
            const showEmpty =
              typed && !restaurantLoading && totalHits === 0

            if (showEmpty) {
              return (
                <div className="text-center py-12 sm:py-16">
                  <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">
                    No results found for "{searchValue}"
                  </p>
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mt-2">
                    Try a different search term
                  </p>
                </div>
              )
            }

            if (filteredFoods.length === 0 && typed) {
              return null
            }

            if (filteredFoods.length === 0) {
              return null
            }

            return (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                {filteredFoods.map((food, index) => (
                  <div
                    key={food.id}
                    className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group"
                    style={{
                      animation: `slideUp 0.3s ease-out ${0.25 + 0.05 * (index % 12)}s both`,
                    }}
                    onClick={() => handleFoodClick(food)}
                  >
                    <div className="relative w-full aspect-square rounded-full overflow-hidden transition-all duration-200 shadow-md group-hover:shadow-lg bg-white dark:bg-[#1a1a1a] p-1 sm:p-1.5">
                      <img
                        src={food.image}
                        alt={food.name}
                        className="w-full h-full object-cover rounded-full"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = foodImages[0]
                        }}
                      />
                    </div>
                    <div className="px-1 sm:px-2 text-center">
                      <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary-orange dark:group-hover:text-orange-400 transition-colors line-clamp-2">
                        {food.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
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

