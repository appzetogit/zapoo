import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { setAuthData } from "@/lib/utils/auth"
import { Button } from "@/components/ui/button"
import { restaurantAPI } from "@/lib/api"
import { firebaseAuth, googleProvider } from "@/lib/firebase"
import { useCompanyName } from "@/lib/hooks/useCompanyName"
import { determineStepToShow } from "@/module/restaurant/utils/onboardingUtils"

export default function RestaurantLogin() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
  })
  const [touched, setTouched] = useState({
    phone: false,
    email: false,
  })
  const [isSending, setIsSending] = useState(false)
  const [apiError, setApiError] = useState("")

  // Phone number validation
  const validatePhone = (phone) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    // Remove any non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length !== 10) {
      return "Indian phone number must be 10 digits"
    }
    // Check if it starts with valid Indian mobile prefixes
    const firstDigit = digitsOnly[0]
    if (!["6", "7", "8", "9"].includes(firstDigit)) {
      return "Invalid Indian mobile number"
    }

    return ""
  }

  const handleSendOTP = async () => {
    // Mark all fields as touched
    setTouched({ phone: true })
    setApiError("")

    // Validate
    const phoneError = validatePhone(formData.phone)

    if (phoneError) {
      setErrors({ phone: phoneError })
      return
    }

    // Clear errors if validation passes
    setErrors({ phone: "" })

    // Build full phone in E.164-ish format (e.g. +91xxxxxxxxxx)
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for login
      await restaurantAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      // Extract backend error message if available
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  // Email validation
  const validateEmail = (email) => {
    if (!email || email.trim() === "") {
      return "Email is required"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Enter a valid email address"
    }

    return ""
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    const newFormData = {
      ...formData,
      email: value,
    }
    setFormData(newFormData)

    // Validate if field has been touched
    if (touched.email) {
      const error = validateEmail(value)
      setErrors({ ...errors, email: error })
    }
  }

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    const error = validateEmail(formData.email)
    setErrors({ ...errors, email: error })
  }

  const handleEmailLogin = () => {
    setLoginMethod("email")
  }

  const normalizeEmailErrorMessage = (message) => {
    if (!message) return "Enter a valid email address"

    const normalized = String(message).trim().toLowerCase()
    if (
      normalized === "validation error" ||
      normalized.includes("must be a valid email") ||
      normalized.includes("please enter a valid email address")
    ) {
      return "Enter a valid email address"
    }

    return message
  }

  const handleSendEmailOTP = async () => {
    // Mark email field as touched
    setTouched({ ...touched, email: true })
    setApiError("")

    // Validate
    const emailError = validateEmail(formData.email)

    if (emailError) {
      setErrors({ ...errors, email: emailError })
      return
    }

    // Clear errors if validation passes
    setErrors({ ...errors, email: "" })

    try {
      setIsSending(true)

      // Call backend API to send OTP via email
      await restaurantAPI.sendOTP(null, "login", formData.email)

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "email",
        email: formData.email,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      const message = normalizeEmailErrorMessage(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      )
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handleGoogleLogin = async () => {
    setApiError("")
    setIsSending(true)

    const navigatePostGoogleLogin = (restaurant) => {
      const onboardingStep = determineStepToShow(restaurant?.onboarding)
      if (onboardingStep) {
        navigate(`/restaurant/onboarding?step=${onboardingStep}`, { replace: true })
        return
      }
      navigate("/restaurant", { replace: true })
    }

    try {
      const isFlutterBridgeAvailable =
        typeof window !== "undefined" &&
        window.flutter_inappwebview &&
        typeof window.flutter_inappwebview.callHandler === "function"

      if (isFlutterBridgeAvailable) {
        const result = await window.flutter_inappwebview.callHandler("nativeGoogleSignIn")

        if (result?.success && (result.idToken || result.accessToken)) {
          const response = await restaurantAPI.googleNativeLogin({
            idToken: result.idToken || null,
            accessToken: result.accessToken || null,
          })
          const data = response?.data?.data || {}

          const accessToken = data.accessToken
          const restaurant = data.restaurant

          if (!accessToken || !restaurant) {
            throw new Error("Invalid response from server")
          }

          setAuthData("restaurant", accessToken, restaurant)
          sessionStorage.setItem(
            "restaurantAuthData",
            JSON.stringify({
              method: "email",
              email: restaurant?.ownerEmail || restaurant?.email || "",
            })
          )
          localStorage.setItem("restaurant_auth_mode", "email")
          window.dispatchEvent(new Event("restaurantAuthChanged"))
          navigatePostGoogleLogin(restaurant)
          return
        }

        if (result?.success === false) {
          setIsSending(false)
          setApiError("Google sign-in was cancelled.")
          return
        }

        throw new Error("Flutter Google sign-in did not return a valid token")
      }

      const { signInWithPopup } = await import("firebase/auth")

      // Sign in with Google using Firebase Auth
      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const user = result.user

      // Get Firebase ID token
      const idToken = await user.getIdToken()

      // Call backend to login/register via Firebase Google
      const response = await restaurantAPI.firebaseGoogleLogin(idToken)
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const restaurant = data.restaurant

      if (!accessToken || !restaurant) {
        throw new Error("Invalid response from server")
      }

      // Store auth data for restaurant module using utility function
      setAuthData("restaurant", accessToken, restaurant)
      sessionStorage.setItem(
        "restaurantAuthData",
        JSON.stringify({
          method: "email",
          email: restaurant?.ownerEmail || restaurant?.email || "",
        })
      )
      localStorage.setItem("restaurant_auth_mode", "email")

      // Notify any listeners that auth state has changed
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Route exactly like OTP flow: incomplete onboarding -> onboarding, else home
      navigatePostGoogleLogin(restaurant)
    } catch (error) {
      console.error("Firebase Google login error:", error)
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to login with Google. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, "")

    // Limit to 10 digits for India or 15 for international
    const maxLength = 10;
    if (value.length > maxLength) return;

    const newFormData = {
      ...formData,
      phone: value,
    }
    setFormData(newFormData)

    // Real-time validation
    const error = validatePhone(value)
    setErrors({ ...errors, phone: error })

    // Mark as touched when user starts typing
    if (!touched.phone && value.length > 0) {
      setTouched({ ...touched, phone: true })
    }
  }

  const handlePhoneBlur = () => {
    // Mark as touched on blur if not already touched
    if (!touched.phone) {
      setTouched({ ...touched, phone: true })
    }
    // Re-validate on blur
    const error = validatePhone(formData.phone)
    setErrors({ ...errors, phone: error })
  }

  const isValidPhone = !errors.phone && formData.phone.trim().length > 0
  const isValidEmail = !errors.email && formData.email.trim().length > 0

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Header with Back Button */}
      <div className="relative flex items-center justify-center py-4 px-4 mt-2">

        <button
          onClick={() => navigate("/restaurant/welcome")}
          className="absolute left-4 top-4"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
      </div>

      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-8 px-6">
        {/* Appzeto Logo */}
        <div>
          <h1
            className="text-5xl italic md:text-6xl tracking-[0.2em] font-extrabold text-blue-600 transform scale-x-110 origin-center inline-block"
            style={{
              WebkitTextStroke: "0.5px #2563eb",
              textStroke: "0.5px #2563eb"
            }}
          >

            {companyName.toLowerCase()}
          </h1>
        </div>

        {/* Restaurant Partner Badge */}
        <div className="">
          <span className="text-blue-500 font-light text-sm tracking-wide block text-center">
            — restaurant partner —
          </span>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 py-4">
          {/* Instruction Text */}
          <div className="text-center">
            <p className="text-base text-gray-700 leading-relaxed">
              {loginMethod === "email"
                ? "Enter your registered email and we will send an OTP to continue"
                : "Enter your registered phone number and we will send an OTP to continue"
              }
            </p>
          </div>

          {/* Phone Number Input */}
          {loginMethod === "phone" && (
            <div className="space-y-4">
              <div className="flex gap-2 items-stretch w-full">
                {/* Country Code */}
                <div className="w-[100px] h-12 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center shrink-0" style={{ height: '48px' }}>
                  <span className="text-sm font-medium text-gray-900">+91</span>
                </div>

                {/* Phone Number Input */}
                <div className="flex-1 flex flex-col">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg min-w-0 bg-white ${errors.phone && formData.phone.length > 0
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    style={{ height: '48px' }}
                  />
                  {errors.phone && formData.phone.length > 0 && (
                    <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendOTP}
                disabled={!isValidPhone || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidPhone && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          {/* Email Input */}
          {loginMethod === "email" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg bg-white ${errors.email && formData.email.length > 0
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                  style={{ height: '48px' }}
                />
                {errors.email && formData.email.length > 0 && (
                  <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>
                )}
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendEmailOTP}
                disabled={!isValidEmail || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidEmail && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          {/* OR Separator */}
          <div className="relative flex items-center py-4">
            <div className="flex-1 border-t border-gray-500"></div>
            <span className="px-4 text-sm font-medium text-gray-600">OR</span>
            <div className="flex-1 border-t border-gray-500"></div>
          </div>

          {/* Alternative Login Options */}
          <div className="space-y-3">
            {/* Login with Email Button */}
            <Button
              onClick={() => {
                if (loginMethod === "phone") {
                  handleEmailLogin()
                } else {
                  setLoginMethod("phone")
                }
              }}
              variant="outline"
              className="w-full h-12 rounded-lg border border-gray- hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3"
            >
              {loginMethod === "email" ? <Phone className="w-5 h-5 mr-auto text-blue-600" /> : <Mail className="w-5 h-5 mr-auto text-blue-600" />}
              <span className="mr-auto text-gray-900">
                {loginMethod === "phone" ? "Login with Email" : "Back to Phone"}
              </span>
            </Button>

            {/* Login with Google Button */}
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full h-12 rounded-lg border border-gray- hover:border-gray-400 hover:bg-gray-50 text-gray-900 font-semibold text-base flex items-center justify-center gap-3"
            >
              {/* Google Logo SVG */}
              <svg className="w-5 h-5 mr-auto" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="mr-auto text-gray-900">Login with Google</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Section - Terms and Conditions */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto">
          <p className="text-xs text-center text-blue-500 leading-relaxed">
            By continuing, you agree to our
          </p>
          <div className="text-xs text-center text-blue-500 underline mt-1 flex flex-wrap justify-center gap-x-2 gap-y-1">
            <Link to="/restaurant/legal/terms">Terms of Service</Link>
            <span>|</span>
            <Link to="/restaurant/legal/privacy">Privacy</Link>
            <span>|</span>
            <Link to="/restaurant/support">Support</Link>
            <span>|</span>
            <Link to="/restaurant/legal/code-of-conduct">Code of Conduct</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
