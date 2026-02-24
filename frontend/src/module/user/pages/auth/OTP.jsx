import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { authAPI } from "@/lib/api"
import { setAuthData as setUserAuthData } from "@/lib/utils/auth"

export default function OTP() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const inputRefs = useRef([])

  useEffect(() => {
    // Redirect to home if already authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true"
    if (isAuthenticated) {
      navigate("/user", { replace: true })
      return
    }

    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      // No auth data, redirect to sign in
      navigate("/user/auth/sign-in", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    // Handle both phone and email
    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      // Extract and format phone number for display
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      if (phoneMatch) {
        const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`
        setContactInfo(formattedPhone)
      } else {
        setContactInfo(data.phone || "")
      }

      // OTP auto-fill removed - user must manually enter OTP
    }

    // Start resend timer (60 seconds)
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0] && !showNameInput) {
      inputRefs.current[0].focus()
    }
  }, [showNameInput])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered and we are in OTP step
    if (!showNameInput && newOtp.every((digit) => digit !== "") && newOtp.length === 6) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (otp[index]) {
        // If current input has value, clear it
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        // If current input is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (!showNameInput && digits.length === 6) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 6) {
      handleVerify(newOtp.join(""))
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) {
      // In name collection step, ignore OTP auto-submit
      return
    }

    const code = otpValue || otp.join("")

    if (code.length !== 6) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // First attempt: verify OTP for login/register with user role
      const response = await authAPI.verifyOTP(phone, code, purpose, null, email, "user")
      const data = response?.data?.data || {}

      // If backend tells us this is a new user, ask for name
      if (data.needsName) {
        setShowNameInput(true)
        setVerifiedOtp(code)
        setOtp(["", "", "", "", "", ""])
        setSuccess(false)
        setIsLoading(false)
        return
      }

      // Otherwise, OTP verified and user logged in/registered
      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      // Replace old token with new one (handles cross-module login)
      setUserAuthData("user", accessToken, user)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("/user")
      }, 500)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // Second call with name to auto-register and login
      const response = await authAPI.verifyOTP(phone, verifiedOtp, purpose, trimmedName, email, "user")
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      // Replace old token with new one (handles cross-module login)
      setUserAuthData("user", accessToken, user)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("/user")
      }, 500)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // Call backend to resend OTP
      await authAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }

    // Reset timer to 60 seconds
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setOtp(["", "", "", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  if (!authData) {
    return null
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#CB202D] flex flex-col">
      {/* Top Header Section (Zomato Red) */}
      <div className="relative pt-12 pb-16 px-6 text-center">
        {/* Back Button */}
        <button
          onClick={() => navigate("/user/auth/sign-in")}
          className="absolute left-6 top-6 p-2 hover:bg-white/10 rounded-full transition-colors"
          disabled={isLoading}
        >
          <ArrowLeft className="h-6 w-6 text-white" />
        </button>

        {/* Icon Area */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center p-6 border border-white/30">
            <div className="relative">
              <div className="w-12 h-16 border-2 border-white rounded-md flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-xl">
                <div className="w-full h-0.5 bg-white/50 rounded-full" />
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 bg-white rounded-full" />)}
                </div>
                <div className="w-full h-0.5 bg-white/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Title & Instructions */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {showNameInput ? "One last thing" : "OTP Verification"}
          </h1>
          <p className="text-white/80 text-sm max-w-[280px] mx-auto leading-relaxed">
            {showNameInput
              ? "Please tell us your name to complete your profile"
              : `Please enter the OTP sent to your ${contactType === "email" ? "email" : "mobile number"}`}
          </p>
        </div>
      </div>

      {/* Main Content White Card */}
      <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-t-[40px] shadow-2xl mt-[-20px] px-6 sm:px-8 md:px-12 pt-10 pb-12 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
                {error}
              </p>
            </div>
          )}

          {/* Contact Info Display */}
          {!showNameInput && (
            <div className="text-center mb-10">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Sent to</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">{contactInfo}</p>
            </div>
          )}

          {/* OTP Input Fields */}
          {!showNameInput && (
            <div className="space-y-12">
              <div className="flex justify-between gap-2 max-w-sm mx-auto">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={isLoading}
                    className="w-12 h-12 md:w-14 md:h-14 text-center text-2xl font-bold bg-white dark:bg-gray-800 border-2 border-red-200 ring-4 ring-red-50 rounded-xl outline-none transition-all text-gray-800 dark:text-white py-0 shadow-sm focus:border-[#CB202D] focus:ring-[#CB202D]/10 focus:scale-105"
                  />
                ))}
              </div>

              {/* Resend Section */}
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Didn't receive code?
                </p>
                {resendTimer > 0 ? (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-[#CB202D]">{resendTimer}s</span>
                    <span className="text-xs text-gray-400 font-medium">remaining</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-[#CB202D] hover:text-[#b51c1c] font-bold text-sm underline active:scale-95 transition-transform"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Name Input Step */}
          {showNameInput && (
            <div className="space-y-8 flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError("")
                    }}
                    disabled={isLoading}
                    placeholder="e.g. Rahul Sharma"
                    className={`w-full h-14 px-5 text-lg bg-gray-50 dark:bg-gray-800 border-2 ${nameError ? "border-red-500" : "border-gray-100 dark:border-gray-700"
                      } rounded-xl focus:border-[#CB202D] focus:ring-4 focus:ring-[#CB202D]/10 outline-none transition-all text-gray-800 dark:text-white`}
                  />
                  {nameError && (
                    <p className="text-xs text-red-500 font-medium ml-1">
                      {nameError}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-auto">
                <Button
                  onClick={handleSubmitName}
                  disabled={isLoading}
                  className="w-full h-14 bg-[#CB202D] hover:bg-[#b51c1c] text-white font-bold text-lg rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </div>
            </div>
          )}

          {!showNameInput && (
            <div className="mt-8 pt-4 text-center space-y-6">
              <Button
                onClick={() => handleVerify()}
                disabled={isLoading || otp.join("").length !== 6}
                className="w-full h-14 bg-[#CB202D] hover:bg-[#b51c1c] text-white font-bold text-lg rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98] disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none uppercase tracking-wide"
              >
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Submit"}
              </Button>

              <button
                onClick={() => navigate("/user/auth/sign-in")}
                className="block w-full text-sm text-gray-400 font-semibold hover:text-[#CB202D] transition-colors py-2"
              >
                Change Mobile Number
              </button>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}
