import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { setDeliverySignupPendingStep } from "@/lib/utils/auth"

const SIGNUP_STEP1_DRAFT_KEY = "delivery_signup_step1_draft";
const INDIAN_VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;
const BH_SERIES_VEHICLE_NUMBER_REGEX = /^\d{2}BH\d{4}[A-Z]{1,2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_FORM_DATA = {
  name: "",
  email: "",
  address: "",
  city: "",
  state: "",
  vehicleType: "bike",
  vehicleName: "",
  vehicleNumber: "",
  panNumber: "",
  aadharNumber: ""
};

const getInitialStep1FormData = () => {
  try {
    const raw = localStorage.getItem(SIGNUP_STEP1_DRAFT_KEY);
    if (!raw) return DEFAULT_FORM_DATA;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_FORM_DATA;
    return {
      ...DEFAULT_FORM_DATA,
      ...parsed
    };
  } catch {
    return DEFAULT_FORM_DATA;
  }
};

export default function SignupStep1() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(getInitialStep1FormData)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Persist step 1 form draft so refresh doesn't clear entered details.
  useEffect(() => {
    try {
      localStorage.setItem(SIGNUP_STEP1_DRAFT_KEY, JSON.stringify(formData));
    } catch {}
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target
    let newValue = value

    if (name === "aadharNumber") {
      // Allow only digits and limit to 12
      newValue = value.replace(/\D/g, "").slice(0, 12)
    } else if (name === "panNumber") {
      // Allow only alphanumeric and limit to 10
      newValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10)
    } else if (name === "vehicleNumber") {
      // Allow only alphanumeric, normalize to uppercase (e.g., MH12AB1234 / 22BH1234AA)
      newValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 13)
    } else if (name === "city" || name === "state") {
      // Allow only alphabets and spaces
      newValue = value.replace(/[^a-zA-Z\s]/g, "")
    }

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (formData.email && !EMAIL_REGEX.test(formData.email)) {
      newErrors.email = "Enter a valid email"
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    } else if (!/^[A-Za-z\s]+$/.test(formData.city.trim())) {
      newErrors.city = "City should contain only alphabets"
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required"
    } else if (!/^[A-Za-z\s]+$/.test(formData.state.trim())) {
      newErrors.state = "State should contain only alphabets"
    }

    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = "Vehicle number is required"
    } else {
      const normalizedVehicleNumber = formData.vehicleNumber
        .trim()
        .toUpperCase()
        .replace(/[\s-]/g, "");
      if (
        !INDIAN_VEHICLE_NUMBER_REGEX.test(normalizedVehicleNumber) &&
        !BH_SERIES_VEHICLE_NUMBER_REGEX.test(normalizedVehicleNumber)
      ) {
        newErrors.vehicleNumber = "Invalid vehicle number format (e.g., MH12AB1234)"
      }
    }

    if (!formData.panNumber.trim()) {
      newErrors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.toUpperCase())) {
      newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }

    if (!formData.aadharNumber.trim()) {
      newErrors.aadharNumber = "Aadhar number is required"
    } else if (!/^\d{12}$/.test(formData.aadharNumber.replace(/\s/g, ""))) {
      newErrors.aadharNumber = "Aadhar number must be 12 digits"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      if (formData.email && !EMAIL_REGEX.test(formData.email)) {
        toast.error("Enter a valid email")
      } else {
        toast.error("Please fill all required fields correctly")
      }
      return
    }

    setIsSubmitting(true)

    try {
      const response = await deliveryAPI.submitSignupDetails({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicleType: formData.vehicleType,
        vehicleName: formData.vehicleName.trim() || null,
        vehicleNumber: formData.vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, ""),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      })

      if (response?.data?.success) {
        setDeliverySignupPendingStep("documents");
        toast.success("Details saved successfully")
        navigate("/delivery/signup/documents")
      }
    } catch (error) {
      console.error("Error submitting signup details:", error)
      const message = error?.response?.data?.message || "Failed to save details. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Complete Your Profile</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Basic Details</h2>
          <p className="text-sm text-gray-600">Please provide your information to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="Enter your full name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="Enter your email"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="Enter your address"
            />
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                placeholder="State"
              />
            </div>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            >
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
            </select>
          </div>

          {/* Vehicle Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Name/Model (Optional)
            </label>
            <input
              type="text"
              name="vehicleName"
              value={formData.vehicleName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="e.g., Honda Activa"
            />
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="e.g., MH12AB1234"
            />
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] uppercase"
              placeholder="ABCDE1234F"
            />
          </div>

          {/* Aadhar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aadhar Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="aadharNumber"
              value={formData.aadharNumber}
              onChange={handleChange}
              maxLength={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              placeholder="1234 5678 9012"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#DC2626] hover:bg-[#C52222]"
              }`}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  )
}
