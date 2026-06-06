import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { restaurantAPI } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { clearModuleAuth, isModuleAuthenticated } from "@/lib/utils/auth"
import { useCompanyName } from "@/lib/hooks/useCompanyName"
import { determineStepToShow } from "@/module/restaurant/utils/onboardingUtils"

const ONBOARDING_SESSION_KEY = "restaurant_onboarding_session"

const getStoredRestaurant = () => {
  try {
    const raw = localStorage.getItem("restaurant_user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function RestaurantRejected() {
  const navigate = useNavigate()
  const companyName = useCompanyName()
  const [restaurant, setRestaurant] = useState(() => getStoredRestaurant())
  const [isLoading, setIsLoading] = useState(true)

  const reason =
    typeof restaurant?.rejectionReason === "string" && restaurant.rejectionReason.trim()
      ? restaurant.rejectionReason.trim()
      : "Your onboarding details need to be corrected."
  const phone =
    typeof (restaurant?.ownerPhone || restaurant?.phone) === "string" &&
    (restaurant.ownerPhone || restaurant.phone).trim()
      ? (restaurant.ownerPhone || restaurant.phone).trim()
      : "N/A"
  const brandName =
    typeof companyName === "string" && companyName.trim()
      ? companyName.trim()
      : "Appzeto Food"

  useEffect(() => {
    if (!isModuleAuthenticated("restaurant")) {
      navigate("/restaurant/login", { replace: true })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const nextRestaurant = response?.data?.data?.restaurant || response?.data?.restaurant || null

        if (cancelled) return

        if (!nextRestaurant) {
          navigate("/restaurant/login", { replace: true })
          return
        }

        try {
          localStorage.setItem("restaurant_user", JSON.stringify(nextRestaurant))
        } catch {}

        if (!nextRestaurant.rejectionReason && !nextRestaurant.rejectedAt) {
          navigate("/restaurant", { replace: true })
          return
        }

        setRestaurant(nextRestaurant)
      } catch {
        if (!cancelled && !getStoredRestaurant()) {
          navigate("/restaurant/login", { replace: true })
          return
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const onboardingPath = useMemo(() => {
    const step = determineStepToShow(restaurant?.onboarding)
    return `/restaurant/onboarding?step=${step || 1}`
  }, [restaurant])

  const handleReviewAndResubmit = () => {
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, "1")
    sessionStorage.removeItem("restaurant_login_onboarding_bypass")
    navigate(onboardingPath, { replace: true })
  }

  const handleBackToLogin = () => {
    clearModuleAuth("restaurant")
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY)
    sessionStorage.removeItem("restaurant_login_onboarding_bypass")
    navigate("/restaurant/login", { replace: true })
  }

  if (isLoading && !restaurant) {
    return (
      <div className="min-h-screen bg-[#f8f5f3] flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-[#b10f42] font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f3f1] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-[340px] rounded-[30px] bg-white border border-[#efe7eb] shadow-[0_18px_45px_rgba(80,33,48,0.08)] px-5 py-6">
        <div className="flex justify-center mb-7">
          <svg
            width="228"
            height="46"
            viewBox="0 0 228 46"
            className="overflow-visible drop-shadow-[0_8px_14px_rgba(219,20,60,0.16)]"
            aria-hidden="true"
          >
            <polygon points="30,0 228,0 198,23 228,46 30,46 12,23" fill="#ea1d2c" />
            <polygon points="0,23 18,0 42,0 24,23 42,46 18,46" fill="#ea1d2c" />
            <polygon points="32,7 48,23 32,39 16,23" fill="#ffffff" />
            <line x1="26" y1="17" x2="38" y2="29" stroke="#ea1d2c" strokeWidth="3" strokeLinecap="round" />
            <line x1="38" y1="17" x2="26" y2="29" stroke="#ea1d2c" strokeWidth="3" strokeLinecap="round" />
            <text
              x="125"
              y="28"
              fill="#ffffff"
              textAnchor="middle"
              fontSize="15"
              fontWeight="800"
              letterSpacing="2.6"
              style={{ textTransform: "uppercase" }}
            >
              REJECTED
            </text>
          </svg>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-[18px] leading-tight font-extrabold text-[#201626] mb-3">Registration Rejected</h1>
          <p className="text-[13px] leading-7 text-[#666072]">
            Your restaurant registration has been rejected.
          </p>
        </div>

        <div className="rounded-[18px] border border-[#f5dde3] bg-[#fff8fa] px-4 py-4 mb-4">
          <p className="text-[11px] font-extrabold tracking-[0.2em] uppercase text-[#d11c49] mb-2">
            Reason For Rejection:
          </p>
          <p className="text-[14px] leading-6 text-[#2d1d29] break-words">{reason}</p>
        </div>

        <div className="rounded-[18px] border border-[#ebe7ec] bg-[#fcfbfc] px-4 py-4 mb-5">
          <p className="text-[15px] font-bold text-[#241a28] mb-2">What to do next</p>
          <p className="text-[14px] leading-7 text-[#686274] mb-3">
            Please review the reason above, update your details, and resubmit your onboarding form from the same account.
          </p>
          <p className="text-[14px] leading-6 text-[#7b7582]">Registered phone: {phone}</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleReviewAndResubmit}
            className="w-full h-12 rounded-[14px] bg-gradient-to-b from-[#c40e47] to-[#a70b3a] hover:from-[#b30d41] hover:to-[#980a35] text-white font-bold shadow-[0_12px_24px_rgba(185,12,66,0.24)]"
          >
            Review & Resubmit
          </Button>
          <button
            type="button"
            onClick={handleBackToLogin}
            className="w-full h-12 rounded-[14px] border border-[#e5dde3] bg-white text-[#2f2531] font-semibold flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to login</span>
          </button>
        </div>

        <p className="mt-5 text-center text-[9px] uppercase tracking-[0.34em] text-[#bcb4bd] font-extrabold">
          Fleet Security Network • {brandName.toUpperCase()}
        </p>
      </div>
    </div>
  )
}
