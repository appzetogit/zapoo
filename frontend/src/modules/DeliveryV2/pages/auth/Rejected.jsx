import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { deliveryAPI } from "@food/api"
import { Button } from "@food/components/ui/button"
import { clearModuleAuth, isModuleAuthenticated } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"

const getDeliverySignupStepFromUser = (user) => {
  if (!user || typeof user !== "object") return null

  const hasBasicDetails = Boolean(
    user?.name?.trim?.() &&
    user?.location?.addressLine1?.trim?.() &&
    user?.location?.city?.trim?.() &&
    user?.location?.state?.trim?.() &&
    user?.vehicle?.type &&
    user?.vehicle?.number?.trim?.() &&
    user?.documents?.pan?.number?.trim?.() &&
    user?.documents?.aadhar?.number?.trim?.()
  )

  if (!hasBasicDetails) return "details"

  const hasAllDocuments = Boolean(
    user?.profileImage?.url &&
    user?.documents?.aadhar?.document &&
    user?.documents?.pan?.document &&
    user?.documents?.drivingLicense?.document
  )

  return hasAllDocuments ? null : "documents"
}

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("delivery_user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const buildResumeSignupData = (delivery) => ({
  details: {
    name: delivery?.name || "",
    phone: String(delivery?.phone || "").replace(/\D/g, "").slice(-10),
    countryCode: "+91",
    ref: "",
    email: delivery?.email || "",
    address: delivery?.location?.addressLine1 || "",
    city: delivery?.location?.city || "",
    state: delivery?.location?.state || "",
    vehicleType: delivery?.vehicle?.type || "bike",
    vehicleName: delivery?.vehicle?.model || delivery?.vehicle?.brand || "",
    vehicleNumber: delivery?.vehicle?.number || "",
    drivingLicenseNumber: delivery?.documents?.drivingLicense?.number || "",
    panNumber: delivery?.documents?.pan?.number || "",
    aadharNumber: delivery?.documents?.aadhar?.number || ""
  },
  documents: {
    profilePhoto: delivery?.profileImage?.url
      ? { url: delivery.profileImage.url, publicId: delivery.profileImage.publicId || null }
      : null,
    aadharPhoto: delivery?.documents?.aadhar?.document
      ? { url: delivery.documents.aadhar.document, publicId: null }
      : null,
    panPhoto: delivery?.documents?.pan?.document
      ? { url: delivery.documents.pan.document, publicId: null }
      : null,
    drivingLicensePhoto: delivery?.documents?.drivingLicense?.document
      ? { url: delivery.documents.drivingLicense.document, publicId: null }
      : null
  }
})

export default function DeliveryRejected() {
  const navigate = useNavigate()
  const companyName = useCompanyName()
  const [profile, setProfile] = useState(() => getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  const reason =
    typeof profile?.rejectionReason === "string" && profile.rejectionReason.trim()
      ? profile.rejectionReason.trim()
      : "Your onboarding details need to be corrected."
  const phone =
    typeof profile?.phone === "string" && profile.phone.trim()
      ? profile.phone.trim()
      : "N/A"
  const brandName =
    typeof companyName === "string" && companyName.trim()
      ? companyName.trim()
      : "Appzeto Food"

  useEffect(() => {
    if (!isModuleAuthenticated("delivery")) {
      navigate("/food/delivery/login", { replace: true })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const response = await deliveryAPI.getProfile()
        const nextProfile = response?.data?.data?.profile || response?.data?.profile || null

        if (cancelled) return

        if (!nextProfile) {
          navigate("/food/delivery/login", { replace: true })
          return
        }

        try {
          localStorage.setItem("delivery_user", JSON.stringify(nextProfile))
        } catch {}

        if (nextProfile.status !== "blocked" && !nextProfile.rejectionReason) {
          navigate("/food/delivery", { replace: true })
          return
        }

        setProfile(nextProfile)
      } catch {
        if (!cancelled && !getStoredUser()) {
          navigate("/food/delivery/login", { replace: true })
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

  const nextSignupPath = useMemo(() => {
    const step = getDeliverySignupStepFromUser(profile) || "details"
    return step === "documents"
      ? "/food/delivery/signup/documents"
      : "/food/delivery/signup/details"
  }, [profile])

  const handleReviewAndResubmit = () => {
    const resumeSignupData = buildResumeSignupData(profile)
    sessionStorage.setItem("deliveryNeedsRegistration", "true")
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(resumeSignupData.details))
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(resumeSignupData.documents))
    navigate(nextSignupPath, { replace: true })
  }

  const handleBackToLogin = () => {
    clearModuleAuth("delivery")
    sessionStorage.removeItem("deliveryAuthData")
    sessionStorage.removeItem("deliveryPendingState")
    navigate("/food/delivery/login", { replace: true })
  }

  if (isLoading && !profile) {
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
            Your delivery partner registration has been rejected.
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
