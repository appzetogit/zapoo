import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Edit2, Camera, Trash2, Eye, X } from "lucide-react"
import BottomPopup from "../components/BottomPopup"
import { toast } from "sonner"
import { deliveryAPI, uploadAPI } from "@/lib/api"

const INDIAN_VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/
const BH_SERIES_VEHICLE_NUMBER_REGEX = /^\d{2}BH\d{4}[A-Z]{1,2}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/
const CITY_STATE_REGEX = /^[A-Za-z\s]{2,50}$/
const ZIP_CODE_REGEX = /^\d{6}$/
const WHATSAPP_STYLE_DEFAULT_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#ECEFF1"/><circle cx="200" cy="145" r="72" fill="#B0BEC5"/><path d="M55 360c14-74 72-122 145-122s131 48 145 122" fill="#B0BEC5"/></svg>`
)}`

const normalizeVehicleNumber = (value = "") => value.toUpperCase().replace(/[\s-]/g, "")

const isValidVehicleNumber = (value = "") => {
  const normalized = normalizeVehicleNumber(value)
  return INDIAN_VEHICLE_NUMBER_REGEX.test(normalized) || BH_SERIES_VEHICLE_NUMBER_REGEX.test(normalized)
}

export default function ProfileDetails() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [vehicleInput, setVehicleInput] = useState("")
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showBankDetailsPopup, setShowBankDetailsPopup] = useState(false)
  const [showPersonalDetailsPopup, setShowPersonalDetailsPopup] = useState(false)
  const [isUpdatingPersonalDetails, setIsUpdatingPersonalDetails] = useState(false)
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false)
  const [personalDetails, setPersonalDetails] = useState({
    name: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    zipCode: ""
  })
  const [personalDetailsErrors, setPersonalDetailsErrors] = useState({})
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  })
  const [bankDetailsErrors, setBankDetailsErrors] = useState({})
  const [isUpdatingBankDetails, setIsUpdatingBankDetails] = useState(false)
  const profilePhotoInputRef = useRef(null)

  // Note: All alternate phone related code has been removed

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          setVehicleNumber(profileData?.vehicle?.number || "")
          setVehicleInput(profileData?.vehicle?.number || "")
          // Set bank details
          setBankDetails({
            accountHolderName: profileData?.documents?.bankDetails?.accountHolderName || "",
            accountNumber: profileData?.documents?.bankDetails?.accountNumber || "",
            ifscCode: profileData?.documents?.bankDetails?.ifscCode || "",
            bankName: profileData?.documents?.bankDetails?.bankName || ""
          })
          setPersonalDetails({
            name: profileData?.name || "",
            email: profileData?.email || "",
            dateOfBirth: profileData?.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split("T")[0] : "",
            gender: profileData?.gender || "",
            addressLine1: profileData?.location?.addressLine1 || "",
            addressLine2: profileData?.location?.addressLine2 || "",
            area: profileData?.location?.area || "",
            city: profileData?.location?.city || "",
            state: profileData?.location?.state || "",
            zipCode: profileData?.location?.zipCode || ""
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)

        // More detailed error handling
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          toast.error("Cannot connect to server. Please check if backend is running.")
        } else if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.")
          // Optionally redirect to login
          setTimeout(() => {
            navigate("/delivery/sign-in", { replace: true })
          }, 2000)
        } else {
          toast.error(error?.response?.data?.message || "Failed to load profile data")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [navigate])

  const defaultProfileImage = WHATSAPP_STYLE_DEFAULT_AVATAR
  const profileImageUrl = profile?.profileImage?.url || defaultProfileImage

  const refreshProfile = async () => {
    const response = await deliveryAPI.getProfile()
    if (response?.data?.success && response?.data?.data?.profile) {
      const profileData = response.data.data.profile
      setProfile(profileData)
      setVehicleNumber(profileData?.vehicle?.number || "")
      setVehicleInput(profileData?.vehicle?.number || "")
      setBankDetails({
        accountHolderName: profileData?.documents?.bankDetails?.accountHolderName || "",
        accountNumber: profileData?.documents?.bankDetails?.accountNumber || "",
        ifscCode: profileData?.documents?.bankDetails?.ifscCode || "",
        bankName: profileData?.documents?.bankDetails?.bankName || ""
      })
      setPersonalDetails({
        name: profileData?.name || "",
        email: profileData?.email || "",
        dateOfBirth: profileData?.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split("T")[0] : "",
        gender: profileData?.gender || "",
        addressLine1: profileData?.location?.addressLine1 || "",
        addressLine2: profileData?.location?.addressLine2 || "",
        area: profileData?.location?.area || "",
        city: profileData?.location?.city || "",
        state: profileData?.location?.state || "",
        zipCode: profileData?.location?.zipCode || ""
      })
    }
  }

  const handleUpdateProfilePhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    try {
      setIsUploadingProfilePhoto(true)
      const uploadResponse = await uploadAPI.uploadMedia(file, {
        folder: "appzeto/delivery/profile"
      })

      const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.data?.secure_url
      const publicId = uploadResponse?.data?.data?.publicId || uploadResponse?.data?.data?.public_id || ""

      if (!imageUrl) {
        throw new Error("Failed to upload profile photo")
      }

      await deliveryAPI.updateProfile({
        profileImage: {
          url: imageUrl,
          publicId
        }
      })

      await refreshProfile()
      toast.success("Profile photo updated successfully")
    } catch (error) {
      console.error("Error updating profile photo:", error)
      toast.error(error?.response?.data?.message || "Failed to update profile photo")
    } finally {
      setIsUploadingProfilePhoto(false)
      if (profilePhotoInputRef.current) {
        profilePhotoInputRef.current.value = ""
      }
    }
  }

  const handleRemoveProfilePhoto = async () => {
    try {
      setIsUploadingProfilePhoto(true)
      await deliveryAPI.updateProfile({
        profileImage: {
          url: null,
          publicId: null
        }
      })
      await refreshProfile()
      toast.success("Profile photo removed successfully")
    } catch (error) {
      console.error("Error removing profile photo:", error)
      toast.error(error?.response?.data?.message || "Failed to remove profile photo")
    } finally {
      setIsUploadingProfilePhoto(false)
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
        <h1 className="text-lg font-medium">Profile</h1>
      </div>

      {/* Profile Picture Area */}
      <div className="relative w-full bg-gray-200 overflow-hidden flex items-center justify-center">
        <img
          src={profileImageUrl}
          alt="Profile"
          className="w-full h-auto max-h-96 object-contain"
          onError={(event) => {
            event.currentTarget.src = defaultProfileImage
          }}
        />
      </div>
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <input
          ref={profilePhotoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpdateProfilePhoto}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => profilePhotoInputRef.current?.click()}
            disabled={isUploadingProfilePhoto}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            <Camera className="w-4 h-4" />
            <span>{isUploadingProfilePhoto ? "Updating..." : "Update Photo"}</span>
          </button>
          <button
            onClick={handleRemoveProfilePhoto}
            disabled={isUploadingProfilePhoto}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isUploadingProfilePhoto ? "Removing..." : "Remove Photo"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Rider Details Section */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Rider details</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <p className="text-base text-gray-900">
                {loading ? "Loading..." : `${profile?.name || "N/A"} (${profile?.deliveryId || "N/A"})`}
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">City</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.city || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle type</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.vehicle?.type || "N/A"}
                </p>
              </div>
              <div className="p-2 px-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">Vehicle number</p>
                {vehicleNumber ? (
                  <div className="flex items-center gap-2">
                    <p className="text-base text-gray-900">{vehicleNumber}</p>
                    <button
                      onClick={() => {
                        setVehicleInput(vehicleNumber)
                        setShowVehiclePopup(true)
                      }}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#DC2626]" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setVehicleInput("")
                      setShowVehiclePopup(true)
                    }}
                    className="flex items-center gap-2 text-[#DC2626] font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">Documents</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            {/* Aadhar Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Aadhar Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.documents?.aadhar?.document ? "Uploaded" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.aadhar?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Aadhar Card",
                      url: profile.documents.aadhar.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>

            {/* PAN Card */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">PAN Card</p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.documents?.pan?.document ? "Uploaded" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.pan?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "PAN Card",
                      url: profile.documents.pan.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>

            {/* Driving License */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">Driving License</p>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.documents?.drivingLicense?.document ? "Uploaded" : "Not uploaded"}
                </p>
              </div>
              {profile?.documents?.drivingLicense?.document && (
                <button
                  onClick={() => {
                    setSelectedDocument({
                      name: "Driving License",
                      url: profile.documents.drivingLicense.document
                    })
                    setShowDocumentModal(true)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Eye className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Details Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900">Personal details</h2>
            <button
              onClick={() => {
                setPersonalDetailsErrors({})
                setShowPersonalDetailsPopup(true)
              }}
              className="text-[#DC2626] font-medium text-sm flex items-center gap-1 hover:text-[#B91C1C]"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Name</p>
                <p className="text-base text-gray-900">{profile?.name || "N/A"}</p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Phone</p>
                <p className="text-base text-gray-900">
                  {profile?.phone || "N/A"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Email</p>
                <p className="text-base text-gray-900">{profile?.email || "-"}</p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Date of Birth</p>
                <p className="text-base text-gray-900">
                  {profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-IN") : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Gender</p>
                <p className="text-base text-gray-900">
                  {profile?.gender ? String(profile.gender).replace(/-/g, " ") : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">City</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.city || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">State</p>
                <p className="text-base text-gray-900">
                  {profile?.location?.state || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Aadhar Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.aadhar?.number || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Status</p>
                <p className="text-base text-gray-900 capitalize">
                  {profile?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Bank details</h2>
            <button
              onClick={() => {
                setShowBankDetailsPopup(true)
                // Pre-fill form with existing data
                setBankDetails({
                  accountHolderName: profile?.documents?.bankDetails?.accountHolderName || "",
                  accountNumber: profile?.documents?.bankDetails?.accountNumber || "",
                  ifscCode: profile?.documents?.bankDetails?.ifscCode || "",
                  bankName: profile?.documents?.bankDetails?.bankName || ""
                })
                setBankDetailsErrors({})
              }}
              className="text-[#DC2626] font-medium text-sm flex items-center gap-1 hover:text-[#B91C1C]"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Holder Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountHolderName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Account Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.accountNumber
                    ? `****${profile.documents.bankDetails.accountNumber.slice(-4)}`
                    : "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">IFSC Code</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.ifscCode || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Bank Name</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.bankDetails?.bankName || "-"}
                </p>
              </div>
            </div>
            <div className="p-2 px-3 flex items-center justify-between">
              <div className="w-full align-center flex content-center justify-between">
                <p className="text-sm text-gray-900 mb-1">Pan Card Number</p>
                <p className="text-base text-gray-900">
                  {profile?.documents?.pan?.number || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Number Popup */}
      <BottomPopup
        isOpen={showVehiclePopup}
        onClose={() => setShowVehiclePopup(false)}
        title={vehicleNumber ? "Edit Vehicle Number" : "Add Vehicle Number"}
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="50vh"
      >
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={vehicleInput}
              onChange={(e) => setVehicleInput(e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").toUpperCase().slice(0, 13))}
              placeholder="Enter vehicle number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
              autoFocus
            />
          </div>
          <button
            onClick={async () => {
              const normalizedVehicleNumber = normalizeVehicleNumber(vehicleInput.trim())

              if (!normalizedVehicleNumber) {
                toast.error("Please enter a vehicle number")
                return
              }

              if (!isValidVehicleNumber(normalizedVehicleNumber)) {
                toast.error("Invalid vehicle number format (e.g., MH12AB1234 or 22BH1234AA)")
                return
              }

              try {
                await deliveryAPI.updateProfile({
                  vehicle: {
                    ...profile?.vehicle,
                    number: normalizedVehicleNumber
                  }
                })
                setVehicleNumber(normalizedVehicleNumber)
                setVehicleInput(normalizedVehicleNumber)
                setShowVehiclePopup(false)
                toast.success("Vehicle number updated successfully")
                // Refetch profile
                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating vehicle number:", error)
                toast.error(error?.response?.data?.message || "Failed to update vehicle number")
              }
            }}
            className="w-full bg-[#DC2626] text-white py-3 rounded-lg font-medium hover:bg-[#B91C1C] transition-colors"
          >
            {vehicleNumber ? "Update" : "Add"}
          </button>
        </div>
      </BottomPopup>

      {/* Personal Details Edit Popup */}
      <BottomPopup
        isOpen={showPersonalDetailsPopup}
        onClose={() => {
          setShowPersonalDetailsPopup(false)
          setPersonalDetailsErrors({})
        }}
        title="Edit Personal Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="85vh"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={personalDetails.name}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, name: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, name: "" }))
              }}
              placeholder="Enter full name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.name ? "border-red-500" : "border-gray-300"}`}
            />
            {personalDetailsErrors.name && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={personalDetails.email}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, email: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, email: "" }))
              }}
              placeholder="Enter email"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.email ? "border-red-500" : "border-gray-300"}`}
            />
            {personalDetailsErrors.email && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              value={personalDetails.dateOfBirth}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, dateOfBirth: e.target.value }))
                setPersonalDetailsErrors(prev => ({ ...prev, dateOfBirth: "" }))
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.dateOfBirth ? "border-red-500" : "border-gray-300"}`}
            />
            {personalDetailsErrors.dateOfBirth && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.dateOfBirth}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              value={personalDetails.gender}
              onChange={(e) => setPersonalDetails(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
            <input
              type="text"
              value={personalDetails.addressLine1}
              onChange={(e) => setPersonalDetails(prev => ({ ...prev, addressLine1: e.target.value }))}
              placeholder="Enter address line 1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={personalDetails.addressLine2}
              onChange={(e) => setPersonalDetails(prev => ({ ...prev, addressLine2: e.target.value }))}
              placeholder="Enter address line 2"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <input
              type="text"
              value={personalDetails.area}
              onChange={(e) => setPersonalDetails(prev => ({ ...prev, area: e.target.value }))}
              placeholder="Enter area"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={personalDetails.city}
                onChange={(e) => {
                  setPersonalDetails(prev => ({ ...prev, city: e.target.value }))
                  setPersonalDetailsErrors(prev => ({ ...prev, city: "" }))
                }}
                placeholder="City"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.city ? "border-red-500" : "border-gray-300"}`}
              />
              {personalDetailsErrors.city && (
                <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={personalDetails.state}
                onChange={(e) => {
                  setPersonalDetails(prev => ({ ...prev, state: e.target.value }))
                  setPersonalDetailsErrors(prev => ({ ...prev, state: "" }))
                }}
                placeholder="State"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.state ? "border-red-500" : "border-gray-300"}`}
              />
              {personalDetailsErrors.state && (
                <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.state}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
            <input
              type="text"
              value={personalDetails.zipCode}
              onChange={(e) => {
                setPersonalDetails(prev => ({ ...prev, zipCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))
                setPersonalDetailsErrors(prev => ({ ...prev, zipCode: "" }))
              }}
              placeholder="Enter ZIP code"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${personalDetailsErrors.zipCode ? "border-red-500" : "border-gray-300"}`}
            />
            {personalDetailsErrors.zipCode && (
              <p className="text-red-500 text-xs mt-1">{personalDetailsErrors.zipCode}</p>
            )}
          </div>

          <button
            onClick={async () => {
              const errors = {}
              const cleanedName = personalDetails.name.trim()
              const cleanedEmail = personalDetails.email.trim()
              const cleanedCity = personalDetails.city.trim()
              const cleanedState = personalDetails.state.trim()
              const cleanedZipCode = personalDetails.zipCode.trim()

              if (!cleanedName) {
                errors.name = "Name is required"
              } else if (!NAME_REGEX.test(cleanedName)) {
                errors.name = "Enter a valid full name"
              }

              if (cleanedEmail && !EMAIL_REGEX.test(cleanedEmail)) {
                errors.email = "Enter a valid email"
              }

              if (personalDetails.dateOfBirth) {
                const dob = new Date(personalDetails.dateOfBirth)
                const now = new Date()
                const eighteenYearsAgo = new Date()
                eighteenYearsAgo.setFullYear(now.getFullYear() - 18)

                if (Number.isNaN(dob.getTime())) {
                  errors.dateOfBirth = "Enter a valid date of birth"
                } else if (dob > now) {
                  errors.dateOfBirth = "Date of birth cannot be in the future"
                } else if (dob > eighteenYearsAgo) {
                  errors.dateOfBirth = "You must be at least 18 years old"
                }
              }

              if (cleanedCity && !CITY_STATE_REGEX.test(cleanedCity)) {
                errors.city = "City should contain only alphabets"
              }

              if (cleanedState && !CITY_STATE_REGEX.test(cleanedState)) {
                errors.state = "State should contain only alphabets"
              }

              if (cleanedZipCode && !ZIP_CODE_REGEX.test(cleanedZipCode)) {
                errors.zipCode = "ZIP code must be 6 digits"
              }

              if (Object.keys(errors).length > 0) {
                setPersonalDetailsErrors(errors)
                toast.error("Please correct highlighted fields")
                return
              }

              try {
                setIsUpdatingPersonalDetails(true)
                await deliveryAPI.updateProfile({
                  name: cleanedName,
                  email: cleanedEmail || null,
                  dateOfBirth: personalDetails.dateOfBirth || null,
                  gender: personalDetails.gender || null,
                  location: {
                    addressLine1: personalDetails.addressLine1.trim(),
                    addressLine2: personalDetails.addressLine2.trim(),
                    area: personalDetails.area.trim(),
                    city: cleanedCity,
                    state: cleanedState,
                    zipCode: cleanedZipCode
                  }
                })
                await refreshProfile()
                toast.success("Personal details updated successfully")
                setShowPersonalDetailsPopup(false)
              } catch (error) {
                console.error("Error updating personal details:", error)
                toast.error(error?.response?.data?.message || "Failed to update personal details")
              } finally {
                setIsUpdatingPersonalDetails(false)
              }
            }}
            disabled={isUpdatingPersonalDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingPersonalDetails ? "bg-gray-400 cursor-not-allowed" : "bg-[#DC2626] hover:bg-[#B91C1C]"}`}
          >
            {isUpdatingPersonalDetails ? "Updating..." : "Save Personal Details"}
          </button>
        </div>
      </BottomPopup>

      {/* Document Image Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDocumentModal(false)
                setSelectedDocument(null)
              }}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Document Title */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{selectedDocument.name}</h3>
            </div>

            {/* Document Image */}
            <div className="p-4">
              <img
                src={selectedDocument.url}
                alt={selectedDocument.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bank Details Edit Popup */}
      <BottomPopup
        isOpen={showBankDetailsPopup}
        onClose={() => {
          setShowBankDetailsPopup(false)
          setBankDetailsErrors({})
        }}
        title="Edit Bank Details"
        showCloseButton={true}
        closeOnBackdropClick={true}
        maxHeight="80vh"
      >
        <div className="space-y-4">
          {/* Account Holder Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Holder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountHolderName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, accountHolderName: "" }))
              }}
              placeholder="Enter account holder name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${bankDetailsErrors.accountHolderName ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.accountHolderName && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.accountHolderName}</p>
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only numbers
                setBankDetails(prev => ({ ...prev, accountNumber: value }))
                setBankDetailsErrors(prev => ({ ...prev, accountNumber: "" }))
              }}
              placeholder="Enter account number"
              maxLength={18}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${bankDetailsErrors.accountNumber ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.accountNumber && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.accountNumber}</p>
            )}
          </div>

          {/* IFSC Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.ifscCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') // Only uppercase letters and numbers
                setBankDetails(prev => ({ ...prev, ifscCode: value }))
                setBankDetailsErrors(prev => ({ ...prev, ifscCode: "" }))
              }}
              placeholder="Enter IFSC code"
              maxLength={11}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${bankDetailsErrors.ifscCode ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.ifscCode && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.ifscCode}</p>
            )}
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankDetails.bankName}
              onChange={(e) => {
                setBankDetails(prev => ({ ...prev, bankName: e.target.value }))
                setBankDetailsErrors(prev => ({ ...prev, bankName: "" }))
              }}
              placeholder="Enter bank name"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626] ${bankDetailsErrors.bankName ? "border-red-500" : "border-gray-300"
                }`}
            />
            {bankDetailsErrors.bankName && (
              <p className="text-red-500 text-xs mt-1">{bankDetailsErrors.bankName}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={async () => {
              // Validate
              const errors = {}
              if (!bankDetails.accountHolderName.trim()) {
                errors.accountHolderName = "Account holder name is required"
              }
              if (!bankDetails.accountNumber.trim()) {
                errors.accountNumber = "Account number is required"
              } else if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
                errors.accountNumber = "Account number must be between 9 and 18 digits"
              }
              if (!bankDetails.ifscCode.trim()) {
                errors.ifscCode = "IFSC code is required"
              } else if (bankDetails.ifscCode.length !== 11) {
                errors.ifscCode = "IFSC code must be 11 characters"
              }
              if (!bankDetails.bankName.trim()) {
                errors.bankName = "Bank name is required"
              }

              if (Object.keys(errors).length > 0) {
                setBankDetailsErrors(errors)
                toast.error("Please fill all required fields correctly")
                return
              }

              setIsUpdatingBankDetails(true)
              try {
                await deliveryAPI.updateProfile({
                  documents: {
                    ...profile?.documents,
                    bankDetails: {
                      accountHolderName: bankDetails.accountHolderName.trim(),
                      accountNumber: bankDetails.accountNumber.trim(),
                      ifscCode: bankDetails.ifscCode.trim(),
                      bankName: bankDetails.bankName.trim()
                    }
                  }
                })
                toast.success("Bank details updated successfully")
                setShowBankDetailsPopup(false)
                // Refetch profile
                const response = await deliveryAPI.getProfile()
                if (response?.data?.success && response?.data?.data?.profile) {
                  setProfile(response.data.data.profile)
                }
              } catch (error) {
                console.error("Error updating bank details:", error)
                toast.error(error?.response?.data?.message || "Failed to update bank details")
              } finally {
                setIsUpdatingBankDetails(false)
              }
            }}
            disabled={isUpdatingBankDetails}
            className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${isUpdatingBankDetails
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#DC2626] hover:bg-[#B91C1C]"
              }`}
          >
            {isUpdatingBankDetails ? "Updating..." : "Save Bank Details"}
          </button>
        </div>
      </BottomPopup>

    </div>
  )
}
