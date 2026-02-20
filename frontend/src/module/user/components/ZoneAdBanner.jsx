import { useState, useEffect, useRef } from "react"
import { useZone } from "../hooks/useZone"
import { useLocation } from "../hooks/useLocation"
import api from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigate } from "react-router-dom"
import { ExternalLink } from "lucide-react"

export default function ZoneAdBanner() {
    const { location } = useLocation()
    const { zoneId, loading: zoneLoading } = useZone(location)
    const [ad, setAd] = useState(null)
    const [loading, setLoading] = useState(true)
    const impressionLogged = useRef(false)
    const navigate = useNavigate()

    useEffect(() => {
        const fetchAd = async () => {
            if (!zoneId) {
                setLoading(false)
                return
            }

            try {
                setLoading(true)
                // Fetch active ad for this zone
                // Expecting array of 1 from backend as per new logic
                const res = await api.get(`/marketing/ads/active/${zoneId}`)

                if (res.data.success && res.data.data && res.data.data.length > 0) {
                    setAd(res.data.data[0])
                } else {
                    setAd(null)
                }
            } catch (error) {
                console.error("Failed to fetch zone ad:", error)
                setAd(null)
            } finally {
                setLoading(false)
            }
        }

        fetchAd()
    }, [zoneId])

    // Track Impression
    useEffect(() => {
        if (ad && !impressionLogged.current) {
            const trackImpression = async () => {
                try {
                    await api.post(`/marketing/ads/${ad._id}/track`, { type: 'impression' })
                    impressionLogged.current = true
                } catch (err) {
                    console.error("Failed to track impression:", err)
                }
            }
            trackImpression()
        }
    }, [ad])

    const handleClick = async () => {
        if (!ad) return

        // Track Click
        try {
            await api.post(`/marketing/ads/${ad._id}/track`, { type: 'click' })
        } catch (err) {
            console.error("Failed to track click:", err)
        }

        // Navigate
        if (ad.redirectTarget === "menu" && ad.restaurant) {
            // Check if restaurant object is populated (it should be)
            const restaurantId = typeof ad.restaurant === 'object' ? ad.restaurant._id : ad.restaurant
            navigate(`/restaurant/${restaurantId}`)
        } else if (ad.redirectTarget.startsWith("http")) {
            window.open(ad.redirectTarget, "_blank")
        } else {
            // Default to restaurant page
            const restaurantId = typeof ad.restaurant === 'object' ? ad.restaurant._id : ad.restaurant
            navigate(`/restaurant/${restaurantId}`)
        }
    }

    if (zoneLoading || loading) {
        // Optional: Returns skeleton or null. Returns null to avoid layout shift if no ad.
        // But since this is a premium slot, a skeleton might be better if we expect an ad.
        // Given "only 1 banner", let's return null until loaded to keep it clean.
        return null
    }

    if (!ad) return null

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div
                onClick={handleClick}
                className="relative w-full aspect-[3/1] md:aspect-[4/1] lg:aspect-[5/1] overflow-hidden rounded-2xl cursor-pointer group shadow-sm hover:shadow-md transition-all"
            >
                <img
                    src={ad.bannerImage}
                    alt={ad.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <div className="text-white">
                        <h3 className="font-bold text-lg md:text-xl flex items-center gap-2">
                            {ad.title} <ExternalLink className="w-4 h-4 opacity-80" />
                        </h3>
                        {ad.restaurant && typeof ad.restaurant === 'object' && (
                            <p className="text-sm opacity-90">Sponsored by {ad.restaurant.name}</p>
                        )}
                        <p className="text-xs opacity-75 mt-1">Promoted</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
