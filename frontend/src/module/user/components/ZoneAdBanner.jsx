import { useState, useEffect, useRef } from "react"
import { useZone } from "../hooks/useZone"
import { useLocation } from "../hooks/useLocation"
import api from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigate } from "react-router-dom"
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Fallback ads to show when no active ads are available for the zone
const FALLBACK_ADS = [
    {
        _id: "fallback-1",
        title: "Delicious Meals Delivered Fast",
        bannerImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop",
        redirectTarget: "home",
        description: "Explore the best tastes around you"
    },
    {
        _id: "fallback-2",
        title: "Get 20% OFF on Your First Order",
        bannerImage: "https://images.unsplash.com/photo-1543353071-873f17a7a088?w=1200&h=400&fit=crop",
        redirectTarget: "gourmet",
        description: "Special deals for new users"
    },
    {
        _id: "fallback-3",
        title: "Explore Top Rated Restaurants",
        bannerImage: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&h=400&fit=crop",
        redirectTarget: "top-10",
        description: "Hand-picked favorites for you"
    }
]

export default function ZoneAdBanner() {
    const { location } = useLocation()
    const { zoneId, loading: zoneLoading } = useZone(location)
    const [ads, setAds] = useState([])
    const [currentSlide, setCurrentSlide] = useState(0)
    const [loading, setLoading] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const impressionsLogged = useRef(new Set())
    const touchStartXRef = useRef(0)
    const touchStartYRef = useRef(0)
    const didSwipeRef = useRef(false)
    const navigate = useNavigate()

    useEffect(() => {
        const fetchAds = async () => {
            const hasCoords = location?.latitude != null && location?.longitude != null

            if (!zoneId && !hasCoords) {
                setLoading(false)
                setAds(FALLBACK_ADS)
                return
            }

            try {
                setLoading(true)
                const params = {}
                if (hasCoords) {
                    params.latitude = location.latitude
                    params.longitude = location.longitude
                }

                const endpoint = zoneId
                    ? `/marketing/ads/active/${zoneId}`
                    : '/marketing/ads/nearby'

                const res = await api.get(endpoint, { params })

                if (res.data.success && res.data.data && res.data.data.length > 0) {
                    setAds(res.data.data)
                } else {
                    setAds(FALLBACK_ADS)
                }
            } catch (error) {
                console.error("Failed to fetch ads:", error)
                setAds(FALLBACK_ADS)
            } finally {
                setLoading(false)
            }
        }

        fetchAds()
    }, [zoneId, location?.latitude, location?.longitude])

    // Auto-slide logic
    useEffect(() => {
        if (ads.length <= 1 || isPaused) return

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % ads.length)
        }, 5000)

        return () => clearInterval(timer)
    }, [ads.length, isPaused])

    // Keep slide index valid when ads length changes (prevents undefined currentAd).
    useEffect(() => {
        if (ads.length === 0) {
            setCurrentSlide(0)
            return
        }
        setCurrentSlide((prev) => (prev >= ads.length ? 0 : prev))
    }, [ads.length])

    // Track Impression for current slide
    useEffect(() => {
        const currentAd = ads[currentSlide]
        const currentAdId = typeof currentAd?._id === "string" ? currentAd._id : ""
        const isTrackableAd = currentAd && currentAdId && !currentAdId.startsWith('fallback-') && currentAd.source !== 'challenge'
        if (isTrackableAd && !impressionsLogged.current.has(currentAd._id)) {
            const trackImpression = async () => {
                try {
                    await api.post(`/marketing/ads/${currentAd._id}/track`, { type: 'impression' })
                    impressionsLogged.current.add(currentAd._id)
                } catch (err) {
                    console.error("Failed to track impression:", err)
                }
            }
            trackImpression()
        }
    }, [currentSlide, ads])

    const handleClick = async (ad) => {
        if (!ad) return

        // Track Click for paid ads
        const adId = typeof ad?._id === "string" ? ad._id : ""
        if (adId && !adId.startsWith('fallback-') && ad.source !== 'challenge') {
            try {
                await api.post(`/marketing/ads/${adId}/track`, { type: 'click' })
            } catch (err) {
                console.error("Failed to track click:", err)
            }
        }

        // Navigate based on redirect target
        if (ad.redirectTarget === "menu" && ad.restaurant) {
            const restaurantId = typeof ad.restaurant === 'object' ? ad.restaurant._id : ad.restaurant
            navigate(`/restaurants/${restaurantId}`)
        } else if (ad.redirectTarget === "gourmet") {
            navigate("/user/gourmet")
        } else if (ad.redirectTarget === "top-10") {
            navigate("/user/top-10")
        } else if (ad.redirectTarget?.startsWith("http")) {
            window.open(ad.redirectTarget, "_blank")
        } else if (ad.restaurant) {
            const restaurantId = typeof ad.restaurant === 'object' ? ad.restaurant._id : ad.restaurant
            navigate(`/restaurants/${restaurantId}`)
        }
    }

    if (zoneLoading || loading) {
        return (
            <div className="w-full py-3">
                <Skeleton className="w-full aspect-[3/1] md:aspect-[4/1] lg:aspect-[5/1] rounded-2xl" />
            </div>
        )
    }

    if (ads.length === 0) return null

    const nextSlide = (e) => {
        e.stopPropagation()
        setCurrentSlide((prev) => (prev + 1) % ads.length)
    }

    const prevSlide = (e) => {
        e.stopPropagation()
        setCurrentSlide((prev) => (prev - 1 + ads.length) % ads.length)
    }

    const currentAd = ads[currentSlide] || ads[0]
    if (!currentAd) return null
    const SWIPE_THRESHOLD = 40

    const handleTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return
        const touch = e.touches[0]
        touchStartXRef.current = touch.clientX
        touchStartYRef.current = touch.clientY
        didSwipeRef.current = false
        setIsPaused(true)
    }

    const handleTouchEnd = (e) => {
        if (!e.changedTouches || e.changedTouches.length === 0) {
            setIsPaused(false)
            return
        }
        const touch = e.changedTouches[0]
        const deltaX = touch.clientX - touchStartXRef.current
        const deltaY = touch.clientY - touchStartYRef.current

        // Only treat as swipe when horizontal intent is clear.
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
            didSwipeRef.current = true
            setCurrentSlide((prev) => {
                if (deltaX < 0) return (prev + 1) % ads.length
                return (prev - 1 + ads.length) % ads.length
            })
        }
        setIsPaused(false)
    }

    return (
        <div className="w-full py-3">
            <div
                className="relative w-full aspect-[3/1] md:aspect-[4/1] lg:aspect-[5/1] overflow-hidden rounded-2xl cursor-pointer group shadow-sm hover:shadow-md transition-all bg-gray-100"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                    if (didSwipeRef.current) {
                        didSwipeRef.current = false
                        return
                    }
                    handleClick(currentAd)
                }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0"
                    >
                        <img
                            src={typeof currentAd?.bannerImage === "string" ? currentAd.bannerImage : currentAd?.bannerImage?.url}
                            alt={currentAd.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Overlay Content */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                            <div className="text-white max-w-lg">
                                <h3 className="font-bold text-lg md:text-2xl lg:text-3xl flex items-center gap-2 mb-1">
                                    {currentAd.title} <ExternalLink className="w-4 h-4 md:w-5 md:h-5 opacity-80" />
                                </h3>
                                {currentAd.restaurant && typeof currentAd.restaurant === 'object' && (
                                    <p className="text-sm md:text-base opacity-90 mb-1 font-medium">Sponsored by {currentAd.restaurant.name}</p>
                                )}
                                <p className="text-xs md:text-sm opacity-80 line-clamp-1">{currentAd.description || "Promoted Content"}</p>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows - Only show if multiple ads */}
                {ads.length > 1 && (
                    <>
                        <button
                            onClick={prevSlide}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                        <button
                            onClick={nextSlide}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                        </button>

                        {/* Indicators */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                            {ads.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setCurrentSlide(idx)
                                    }}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Status Badge */}
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full border border-white/20 z-10">
                    {currentAd?._id?.startsWith('fallback-') ? 'SUGGESTED' : currentAd?.source === 'challenge' ? 'FREE REWARD' : 'AD'}
                </div>
            </div>
        </div>
    )
}
