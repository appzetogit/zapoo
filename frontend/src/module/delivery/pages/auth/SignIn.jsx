import { useState } from "react"
import BackgroundVideo from "@/assets/Food_Delivery_Background_Video_Generation.mp4"
import { useNavigate } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deliveryAPI } from "@/lib/api"
import { useCompanyName } from "@/lib/hooks/useCompanyName"

// Common country codes
const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[0] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length < 7) {
      return "Phone number must be at least 7 digits"
    }

    // India-specific validation
    if (countryCode === "+91") {
      if (digitsOnly.length !== 10) {
        return "Indian phone number must be 10 digits"
      }
      const firstDigit = digitsOnly[0]
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number"
      }
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/delivery/otp")
    } catch (err) {
      console.error("Send OTP Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP. Please try again."
      setError(message)
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, "")
    setFormData({
      ...formData,
      phone: value,
    })
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="relative max-h-screen h-screen overflow-hidden">
      <video
        autoPlay
        loop
        muted
        className="absolute top-0 left-0 w-full h-full object-cover"
      >
        <source src={BackgroundVideo} type="video/mp4" />
      </video>
      <div className="relative z-10 flex flex-col h-full bg-black/50">
        {/* Top Section - Logo and Badge */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          {/* Appzeto Logo */}
          <div>
            <h1 className="text-7xl text-[#DC2626] font-extrabold italic lowercase tracking-tight">
              {companyName.toLowerCase()}
            </h1>
          </div>

          {/* Delivery Partner Text */}
          <div className="mt-1">
            <span className="text-[#DC2626] font-medium text-xl italic  tracking-wide">
              --Delivery Partner--
            </span>
          </div>
        </div>

        {/* Main Content - Form Section */}
        <div className="flex-1 flex flex-col mt-6 px-6">
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Sign In Heading */}
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-white">
                Sign in to your account
              </h2>
              <p className="text-base text-gray-200">
                Login or create an account
              </p>
            </div>

            {/* Mobile Number Input */}
            <div className="space-y-2 w-full">
              <div className="flex gap-2 items-stretch w-full">
                <Select
                  value={formData.countryCode}
                  onValueChange={handleCountryCodeChange}
                >
                  <SelectTrigger className="w-[100px] !h-12 border-white/50 bg-black/30 text-white rounded-lg flex items-center shrink-0 focus:ring-0 focus:ring-offset-0 [&_svg]:!text-white [&_svg]:!opacity-100" size="default">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span className="text-white font-bold">{selectedCountry.country === "IN" ? "IN" : selectedCountry.flag}</span>
                        <span className="text-white font-bold">{selectedCountry.code}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto bg-black border-white/20 text-white z-[100]">
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code} className="text-white focus:bg-white/20 focus:text-white hover:bg-white/20 cursor-pointer">
                        <span className="flex items-center gap-2">
                          <span className="text-white font-bold">{country.country === "IN" ? "IN" : country.flag}</span>
                          <span className="text-white font-bold">{country.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter mobile number"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  autoComplete="off"
                  autoFocus={false}
                  className={`flex-1 h-12 px-4 bg-black/30 text-white placeholder:text-white focus:outline-none text-base border rounded-lg min-w-0 ${error ? "border-red-500" : "border-white/50"
                    }`}
                />
              </div>

              {/* Hint Text */}
              <p className="text-sm text-white">
                Enter a valid 10 digit mobile number
              </p>

              {error && (
                <p className="text-sm text-red-500">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section - Continue Button and Terms */}
        <div className="px-6 pb-8 pt-4">
          <div className="w-full max-w-md mx-auto space-y-4">
            {/* Continue Button */}
            <button
              onClick={handleSendOTP}
              disabled={!isValid || isSending}
              className={`w-full py-4 rounded-lg font-bold text-base transition-colors ${isValid && !isSending
                ? "bg-[#DC2626] hover:bg-[#C52222] active:bg-[#B31F1F] text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {isSending ? "Sending OTP..." : "Continue"}
            </button>

            {/* Terms and Conditions */}
            <p className="text-xs text-center text-white px-4">
              By continuing, you agree to our{" "}
              <a href="#" className="text-[#DC2626] hover:underline">
                Terms and Conditions
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

