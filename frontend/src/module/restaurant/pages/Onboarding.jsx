import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, Sparkles, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadAPI, api, subscriptionAPI } from "@/lib/api";
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { determineStepToShow } from "../utils/onboardingUtils";
import { toast } from "sonner";
import { useCompanyName } from "@/lib/hooks/useCompanyName";
const cuisinesOptions = ["North Indian", "South Indian", "Chinese", "Pizza", "Burgers", "Bakery", "Cafe"];
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ONBOARDING_STORAGE_KEY = "restaurant_onboarding_data";

// Helper functions for localStorage
const saveOnboardingToLocalStorage = (step1, step2, step3, step4, currentStep) => {
  try {
    // Convert File objects to a serializable format (we'll store file names/paths if available)
    const serializableStep2 = {
      ...step2,
      menuImages: step2.menuImages.map(file => {
        if (file instanceof File) {
          return {
            name: file.name,
            size: file.size,
            type: file.type
          };
        }
        return file;
      }),
      profileImage: step2.profileImage instanceof File ? {
        name: step2.profileImage.name,
        size: step2.profileImage.size,
        type: step2.profileImage.type
      } : step2.profileImage
    };
    const serializableStep3 = {
      ...step3,
      panImage: step3.panImage instanceof File ? {
        name: step3.panImage.name,
        size: step3.panImage.size,
        type: step3.panImage.type
      } : step3.panImage,
      gstImage: step3.gstImage instanceof File ? {
        name: step3.gstImage.name,
        size: step3.gstImage.size,
        type: step3.gstImage.type
      } : step3.gstImage,
      fssaiImage: step3.fssaiImage instanceof File ? {
        name: step3.fssaiImage.name,
        size: step3.fssaiImage.size,
        type: step3.fssaiImage.type
      } : step3.fssaiImage
    };
    const dataToSave = {
      step1,
      step2: serializableStep2,
      step3: serializableStep3,
      step4: step4 || {},
      currentStep,
      timestamp: Date.now()
    };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error("Failed to save onboarding data to localStorage:", error);
  }
};
const loadOnboardingFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load onboarding data from localStorage:", error);
  }
  return null;
};
const clearOnboardingFromLocalStorage = () => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear onboarding data from localStorage:", error);
  }
};

// Helper function to convert "HH:mm" string to Date object
const stringToTime = timeString => {
  if (!timeString || !timeString.includes(":")) {
    return null; // Return null so the picker shows empty/placeholder
  }
  const [hours, minutes] = timeString.split(":").map(Number);
  return new Date(2000, 0, 1, hours || 10, minutes || 0);
};

// Helper function to convert Date object to "HH:mm" string
const timeToString = date => {
  if (!date) return "";
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};
function TimeSelector({
  label,
  value,
  onChange
}) {
  const timeValue = stringToTime(value);
  const handleTimeChange = newValue => {
    if (newValue) {
      const timeString = timeToString(newValue);
      onChange(timeString);
    }
  };
  return <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
    <div className="flex items-center gap-2 mb-2">
      <Clock className="w-4 h-4 text-gray-800" />
      <span className="text-xs font-medium text-gray-900">{label}</span>
    </div>
    <MobileTimePicker value={timeValue} onChange={handleTimeChange} slotProps={{
      textField: {
        variant: "outlined",
        size: "small",
        placeholder: "00:00",
        sx: {
          "& .MuiOutlinedInput-root": {
            height: "36px",
            fontSize: "12px",
            backgroundColor: "white",
            "& fieldset": {
              borderColor: "#e5e7eb"
            },
            "&:hover fieldset": {
              borderColor: "#d1d5db"
            },
            "&.Mui-focused fieldset": {
              borderColor: "#2563eb"
            }
          },
          "& .MuiInputBase-input": {
            padding: "8px 12px",
            fontSize: "12px"
          }
        }
      }
    }} format="hh:mm a" />
  </div>;
}
export default function RestaurantOnboarding() {
  const companyName = useCompanyName();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTrialOffer, setShowTrialOffer] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState("");
  const [step1, setStep1] = useState({
    restaurantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    location: {
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      landmark: ""
    }
  });
  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "",
    closingTime: "",
    openDays: []
  });
  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: ""
  });
  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "",
    featuredDish: "",
    featuredPrice: "",
    offer: ""
  });

  // Load from localStorage on mount and check URL parameter
  useEffect(() => {
    // Check if step is specified in URL (from OTP login redirect)
    const stepParam = searchParams.get("step");
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 3) {
        setStep(stepNum);
      }
    }
    const localData = loadOnboardingFromLocalStorage();
    if (localData) {
      if (localData.step1) {
        setStep1({
          restaurantName: localData.step1.restaurantName || "",
          ownerName: localData.step1.ownerName || "",
          ownerEmail: localData.step1.ownerEmail || "",
          ownerPhone: localData.step1.ownerPhone || "",
          primaryContactNumber: localData.step1.primaryContactNumber || "",
          location: {
            addressLine1: localData.step1.location?.addressLine1 || "",
            addressLine2: localData.step1.location?.addressLine2 || "",
            area: localData.step1.location?.area || "",
            city: localData.step1.location?.city || "",
            landmark: localData.step1.location?.landmark || ""
          }
        });
      }
      if (localData.step2) {
        setStep2({
          menuImages: localData.step2.menuImages || [],
          profileImage: localData.step2.profileImage || null,
          cuisines: localData.step2.cuisines || [],
          openingTime: localData.step2.openingTime || "",
          closingTime: localData.step2.closingTime || "",
          openDays: localData.step2.openDays || []
        });
      }
      if (localData.step3) {
        setStep3({
          panNumber: localData.step3.panNumber || "",
          nameOnPan: localData.step3.nameOnPan || "",
          panImage: localData.step3.panImage || null,
          gstRegistered: localData.step3.gstRegistered || false,
          gstNumber: localData.step3.gstNumber || "",
          gstLegalName: localData.step3.gstLegalName || "",
          gstAddress: localData.step3.gstAddress || "",
          gstImage: localData.step3.gstImage || null,
          fssaiNumber: localData.step3.fssaiNumber || "",
          fssaiExpiry: localData.step3.fssaiExpiry || "",
          fssaiImage: localData.step3.fssaiImage || null,
          accountNumber: localData.step3.accountNumber || "",
          confirmAccountNumber: localData.step3.confirmAccountNumber || "",
          ifscCode: localData.step3.ifscCode || "",
          accountHolderName: localData.step3.accountHolderName || "",
          accountType: localData.step3.accountType || ""
        });
      }
      if (localData.step4) {
        setStep4({
          estimatedDeliveryTime: localData.step4.estimatedDeliveryTime || "",
          featuredDish: localData.step4.featuredDish || "",
          featuredPrice: localData.step4.featuredPrice || "",
          offer: localData.step4.offer || ""
        });
      }
      // Only set step from localStorage if URL doesn't have a step parameter
      if (localData.currentStep && !stepParam) {
        setStep(localData.currentStep);
      }
    }
  }, [searchParams]);

  // Save to localStorage whenever step data changes
  useEffect(() => {
    saveOnboardingToLocalStorage(step1, step2, step3, step4, step);
  }, [step1, step2, step3, step4, step]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get("/restaurant/onboarding");
        const data = res?.data?.data?.onboarding;
        if (data) {
          if (data.step1) {
            setStep1(prev => ({
              restaurantName: data.step1.restaurantName || "",
              ownerName: data.step1.ownerName || "",
              ownerEmail: data.step1.ownerEmail || "",
              ownerPhone: data.step1.ownerPhone || "",
              primaryContactNumber: data.step1.primaryContactNumber || "",
              location: {
                addressLine1: data.step1.location?.addressLine1 || "",
                addressLine2: data.step1.location?.addressLine2 || "",
                area: data.step1.location?.area || "",
                city: data.step1.location?.city || "",
                landmark: data.step1.location?.landmark || ""
              }
            }));
          }
          if (data.step2) {
            setStep2({
              // Load menu images from URLs if available
              menuImages: data.step2.menuImageUrls || [],
              // Load profile image URL if available
              profileImage: data.step2.profileImageUrl || null,
              cuisines: data.step2.cuisines || [],
              openingTime: data.step2.deliveryTimings?.openingTime || "",
              closingTime: data.step2.deliveryTimings?.closingTime || "",
              openDays: data.step2.openDays || []
            });
          }
          if (data.step3) {
            setStep3({
              panNumber: data.step3.pan?.panNumber || "",
              nameOnPan: data.step3.pan?.nameOnPan || "",
              panImage: null,
              // Don't load images from API, user needs to re-upload
              gstRegistered: data.step3.gst?.isRegistered || false,
              gstNumber: data.step3.gst?.gstNumber || "",
              gstLegalName: data.step3.gst?.legalName || "",
              gstAddress: data.step3.gst?.address || "",
              gstImage: null,
              // Don't load images from API, user needs to re-upload
              fssaiNumber: data.step3.fssai?.registrationNumber || "",
              fssaiExpiry: data.step3.fssai?.expiryDate ? data.step3.fssai.expiryDate.slice(0, 10) : "",
              fssaiImage: null,
              // Don't load images from API, user needs to re-upload
              accountNumber: data.step3.bank?.accountNumber || "",
              confirmAccountNumber: data.step3.bank?.accountNumber || "",
              ifscCode: data.step3.bank?.ifscCode || "",
              accountHolderName: data.step3.bank?.accountHolderName || "",
              accountType: data.step3.bank?.accountType || ""
            });
          }
          if (data.step4) {
            setStep4({
              estimatedDeliveryTime: data.step4.estimatedDeliveryTime || "",
              featuredDish: data.step4.featuredDish || "",
              featuredPrice: data.step4.featuredPrice || "",
              offer: data.step4.offer || ""
            });
          }

          // Determine which step to show based on completeness
          const stepToShow = determineStepToShow(data);
          setStep(stepToShow);
        }
      } catch (err) {
        // Handle error gracefully - if it's a 401 (unauthorized), the user might need to login again
        // Otherwise, just continue with empty onboarding data
        if (err?.response?.status === 401) {
          console.error("Authentication error fetching onboarding:", err);
          // Don't show error to user, they can still fill the form
          // The error might be because restaurant is not yet active (pending verification)
        } else {
          console.error("Error fetching onboarding data:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  const handleUpload = async (file, folder) => {
    try {
      const res = await uploadAPI.uploadMedia(file, {
        folder
      });
      const d = res?.data?.data || res?.data;
      return {
        url: d.url,
        publicId: d.publicId
      };
    } catch (err) {
      // Provide more informative error message for upload failures
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image";
      console.error("Upload error:", errorMsg, err);
      throw new Error(`Image upload failed: ${errorMsg}`);
    }
  };

  // Validation functions for each step
  const validateStep1 = () => {
    const errors = [];

    // Name regex: Only letters, spaces, and hyphens
    const nameRegex = /^[a-zA-Z\s\-]+$/;
    // Indian phone regex: 10 digits starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!step1.restaurantName?.trim()) {
      errors.push("Restaurant name is required");
    } else if (!nameRegex.test(step1.restaurantName.trim())) {
      errors.push("Restaurant name can only contain letters, spaces, and hyphens");
    }

    if (!step1.ownerName?.trim()) {
      errors.push("Owner name is required");
    } else if (!nameRegex.test(step1.ownerName.trim())) {
      errors.push("Owner name can only contain letters, spaces, and hyphens");
    }

    if (!step1.ownerEmail?.trim()) {
      errors.push("Owner email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.ownerEmail)) {
      errors.push("Please enter a valid email address");
    }

    if (!step1.ownerPhone?.trim()) {
      errors.push("Owner phone number is required");
    } else {
      const cleanPhone = step1.ownerPhone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        errors.push("Owner phone number must be 10 digits");
      } else if (!/^[6-9]/.test(cleanPhone)) {
        errors.push("Owner phone number must be a valid Indian mobile number");
      }
    }

    if (!step1.primaryContactNumber?.trim()) {
      errors.push("Primary contact number is required");
    } else {
      const cleanPhone = step1.primaryContactNumber.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        errors.push("Primary contact number must be 10 digits");
      } else if (!/^[6-9]/.test(cleanPhone)) {
        errors.push("Primary contact number must be a valid Indian mobile number");
      }
    }

    if (!step1.location?.area?.trim()) {
      errors.push("Area/Sector/Locality is required");
    }
    if (!step1.location?.city?.trim()) {
      errors.push("City is required");
    }
    return errors;
  };

  const handleStep1Change = (field, value) => {
    let sanitizedValue = value;

    // Restriction rules
    if (field === "restaurantName" || field === "ownerName") {
      // Allow only letters, spaces, and hyphens
      sanitizedValue = value.replace(/[^a-zA-Z\s\-]/g, "");
    } else if (field === "ownerPhone" || field === "primaryContactNumber") {
      // Allow only digits and limit to 10
      sanitizedValue = value.replace(/\D/g, "").slice(0, 10);
    }

    setStep1(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
  };
  const validateStep2 = () => {
    const errors = [];

    // Check menu images - must have at least one File or existing URL
    const hasMenuImages = step2.menuImages && step2.menuImages.length > 0;
    if (!hasMenuImages) {
      errors.push("At least one menu image is required");
    } else {
      // Verify that menu images are either File objects or have valid URLs
      const validMenuImages = step2.menuImages.filter(img => {
        if (img instanceof File) return true;
        if (img?.url && typeof img.url === 'string') return true;
        if (typeof img === 'string' && img.startsWith('http')) return true;
        return false;
      });
      if (validMenuImages.length === 0) {
        errors.push("Please upload at least one valid menu image");
      }
    }

    // Check profile image - must be a File or existing URL
    if (!step2.profileImage) {
      errors.push("Restaurant profile image is required");
    } else {
      // Verify profile image is either a File or has a valid URL
      const isValidProfileImage = step2.profileImage instanceof File || step2.profileImage?.url && typeof step2.profileImage.url === 'string' || typeof step2.profileImage === 'string' && step2.profileImage.startsWith('http');
      if (!isValidProfileImage) {
        errors.push("Please upload a valid restaurant profile image");
      }
    }
    if (!step2.cuisines || step2.cuisines.length === 0) {
      errors.push("Please select at least one cuisine");
    }
    if (!step2.openingTime?.trim()) {
      errors.push("Opening time is required");
    }
    if (!step2.closingTime?.trim()) {
      errors.push("Closing time is required");
    }
    if (!step2.openDays || step2.openDays.length === 0) {
      errors.push("Please select at least one open day");
    }
    return errors;
  };
  const validateStep4 = () => {
    const errors = [];
    if (!step4.estimatedDeliveryTime || !step4.estimatedDeliveryTime.trim()) {
      errors.push("Estimated delivery time is required");
    }
    if (!step4.featuredDish || !step4.featuredDish.trim()) {
      errors.push("Featured dish name is required");
    }
    if (!step4.featuredPrice || step4.featuredPrice === "" || isNaN(parseFloat(step4.featuredPrice)) || parseFloat(step4.featuredPrice) <= 0) {
      errors.push("Featured dish price is required and must be greater than 0");
    }
    if (!step4.offer || !step4.offer.trim()) {
      errors.push("Special offer/promotion is required");
    }
    return errors;
  };
  const validateStep3 = () => {
    const errors = [];
    if (!step3.panNumber?.trim()) {
      errors.push("PAN number is required");
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(step3.panNumber.toUpperCase())) {
      errors.push("Invalid PAN format (e.g., ABCDE1234F)");
    }
    if (!step3.nameOnPan?.trim()) {
      errors.push("Name on PAN is required");
    }
    // Validate PAN image - must be a File or existing URL
    if (!step3.panImage) {
      errors.push("PAN image is required");
    } else {
      const isValidPanImage = step3.panImage instanceof File || step3.panImage?.url && typeof step3.panImage.url === 'string' || typeof step3.panImage === 'string' && step3.panImage.startsWith('http');
      if (!isValidPanImage) {
        errors.push("Please upload a valid PAN image");
      }
    }
    if (!step3.fssaiNumber?.trim()) {
      errors.push("FSSAI number is required");
    } else if (!/^\d{14}$/.test(step3.fssaiNumber)) {
      errors.push("FSSAI number must be exactly 14 digits");
    }
    if (!step3.fssaiExpiry?.trim()) {
      errors.push("FSSAI expiry date is required");
    } else {
      const selectedDate = new Date(step3.fssaiExpiry);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare dates only

      if (selectedDate <= today) {
        errors.push("FSSAI license must be valid (expiry date must be in the future)");
      }
    }
    // Validate FSSAI image - must be a File or existing URL
    if (!step3.fssaiImage) {
      errors.push("FSSAI image is required");
    } else {
      const isValidFssaiImage = step3.fssaiImage instanceof File || step3.fssaiImage?.url && typeof step3.fssaiImage.url === 'string' || typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('http');
      if (!isValidFssaiImage) {
        errors.push("Please upload a valid FSSAI image");
      }
    }

    // Validate GST details if GST registered
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) {
        errors.push("GST number is required when GST registered");
      } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(step3.gstNumber.toUpperCase())) {
        errors.push("Invalid GST number format");
      }
      if (!step3.gstLegalName?.trim()) {
        errors.push("GST legal name is required when GST registered");
      }
      if (!step3.gstAddress?.trim()) {
        errors.push("GST registered address is required when GST registered");
      }
      // Validate GST image if GST registered
      if (!step3.gstImage) {
        errors.push("GST image is required when GST registered");
      } else {
        const isValidGstImage = step3.gstImage instanceof File || step3.gstImage?.url && typeof step3.gstImage.url === 'string' || typeof step3.gstImage === 'string' && step3.gstImage.startsWith('http');
        if (!isValidGstImage) {
          errors.push("Please upload a valid GST image");
        }
      }
    }
    if (!step3.accountNumber?.trim()) {
      errors.push("Account number is required");
    } else if (!/^\d{9,18}$/.test(step3.accountNumber)) {
      errors.push("Account number must be between 9 and 18 digits");
    }
    if (!step3.confirmAccountNumber?.trim()) {
      errors.push("Please confirm your account number");
    }
    if (step3.accountNumber && step3.confirmAccountNumber && step3.accountNumber !== step3.confirmAccountNumber) {
      errors.push("Account number and confirmation do not match");
    }
    if (!step3.ifscCode?.trim()) {
      errors.push("IFSC code is required");
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(step3.ifscCode.toUpperCase())) {
      errors.push("Invalid IFSC code format");
    }
    if (!step3.accountHolderName?.trim()) {
      errors.push("Account holder name is required");
    }
    if (!step3.accountType?.trim()) {
      errors.push("Account type is required");
    }
    return errors;
  };


  const handleNext = async () => {
    setError("");

    // Validate current step before proceeding
    let validationErrors = [];
    if (step === 1) {
      validationErrors = validateStep1();
    } else if (step === 2) {
      validationErrors = validateStep2();
    } else if (step === 3) {
      validationErrors = validateStep3();
    } else if (step === 4) {
      validationErrors = validateStep4();
    }
    if (validationErrors.length > 0) {
      // Show error toast for each validation error
      validationErrors.forEach((error, index) => {
        setTimeout(() => {
          toast.error(error, {
            duration: 4000
          });
        }, index * 100);
      });
      return;
    }
    setSaving(true);
    try {
      if (step === 1) {
        const payload = {
          step1,
          completedSteps: 1
        };
        await api.put("/restaurant/onboarding", payload);
        setStep(2);
      } else if (step === 2) {
        const menuUploads = [];
        // Upload menu images if they are File objects
        for (const file of step2.menuImages.filter(f => f instanceof File)) {
          try {
            const uploaded = await handleUpload(file, "appzeto/restaurant/menu");
            // Verify upload was successful and has valid URL
            if (!uploaded || !uploaded.url) {
              throw new Error(`Failed to upload menu image: ${file.name}`);
            }
            menuUploads.push(uploaded);
          } catch (uploadError) {
            console.error('Menu image upload error:', uploadError);
            throw new Error(`Failed to upload menu image: ${uploadError.message}`);
          }
        }
        // If menuImages already have URLs (from previous save), include them
        const existingMenuUrls = step2.menuImages.filter(img => !(img instanceof File) && (img?.url || typeof img === 'string' && img.startsWith('http')));
        const allMenuUrls = [...existingMenuUrls, ...menuUploads];

        // Verify we have at least one menu image
        if (allMenuUrls.length === 0) {
          throw new Error('At least one menu image must be uploaded');
        }

        // Upload profile image if it's a File object
        let profileUpload = null;
        if (step2.profileImage instanceof File) {
          try {
            profileUpload = await handleUpload(step2.profileImage, "appzeto/restaurant/profile");
            // Verify upload was successful and has valid URL
            if (!profileUpload || !profileUpload.url) {
              throw new Error('Failed to upload profile image');
            }
          } catch (uploadError) {
            console.error('Profile image upload error:', uploadError);
            throw new Error(`Failed to upload profile image: ${uploadError.message}`);
          }
        } else if (step2.profileImage?.url) {
          // If profileImage already has a URL (from previous save), use it
          profileUpload = step2.profileImage;
        } else if (typeof step2.profileImage === 'string' && step2.profileImage.startsWith('http')) {
          // If it's a direct URL string
          profileUpload = {
            url: step2.profileImage
          };
        }

        // Verify profile image is present
        if (!profileUpload || !profileUpload.url) {
          throw new Error('Profile image must be uploaded');
        }
        const payload = {
          step2: {
            menuImageUrls: allMenuUrls.length > 0 ? allMenuUrls : [],
            profileImageUrl: profileUpload,
            cuisines: step2.cuisines || [],
            deliveryTimings: {
              openingTime: step2.openingTime || "",
              closingTime: step2.closingTime || ""
            },
            openDays: step2.openDays || []
          },
          completedSteps: 2
        };
        const response = await api.put("/restaurant/onboarding", payload);
        // Verify response is successful
        if (!response || !response.data) {
          throw new Error('Invalid response from server');
        }

        // After step2, also update restaurant schema with step2 data
        // This ensures data is saved immediately, not just in onboarding subdocument
        if (response?.data?.data?.restaurant) { }

        // Only proceed to step 3 if save was successful
        if (response?.data?.data?.onboarding || response?.data?.data) {
          setStep(3);
        } else {
          throw new Error('Failed to save step2 data');
        }
      } else if (step === 3) {
        // Upload PAN image if it's a File object
        let panImageUpload = null;
        if (step3.panImage instanceof File) {
          try {
            panImageUpload = await handleUpload(step3.panImage, "appzeto/restaurant/pan");
            // Verify upload was successful and has valid URL
            if (!panImageUpload || !panImageUpload.url) {
              throw new Error('Failed to upload PAN image');
            }
          } catch (uploadError) {
            console.error('PAN image upload error:', uploadError);
            throw new Error(`Failed to upload PAN image: ${uploadError.message}`);
          }
        } else if (step3.panImage?.url) {
          // If panImage already has a URL (from previous save), use it
          panImageUpload = step3.panImage;
        } else if (typeof step3.panImage === 'string' && step3.panImage.startsWith('http')) {
          // If it's a direct URL string
          panImageUpload = {
            url: step3.panImage
          };
        }

        // Verify PAN image is present
        if (!panImageUpload || !panImageUpload.url) {
          throw new Error('PAN image must be uploaded');
        }

        // Upload GST image if it's a File object (only if GST registered)
        let gstImageUpload = null;
        if (step3.gstRegistered) {
          if (step3.gstImage instanceof File) {
            try {
              gstImageUpload = await handleUpload(step3.gstImage, "appzeto/restaurant/gst");
              // Verify upload was successful and has valid URL
              if (!gstImageUpload || !gstImageUpload.url) {
                throw new Error('Failed to upload GST image');
              }
            } catch (uploadError) {
              console.error('GST image upload error:', uploadError);
              throw new Error(`Failed to upload GST image: ${uploadError.message}`);
            }
          } else if (step3.gstImage?.url) {
            // If gstImage already has a URL (from previous save), use it
            gstImageUpload = step3.gstImage;
          } else if (typeof step3.gstImage === 'string' && step3.gstImage.startsWith('http')) {
            // If it's a direct URL string
            gstImageUpload = {
              url: step3.gstImage
            };
          }

          // Verify GST image is present if GST registered
          if (!gstImageUpload || !gstImageUpload.url) {
            throw new Error('GST image must be uploaded when GST registered');
          }
        }

        // Upload FSSAI image if it's a File object
        let fssaiImageUpload = null;
        if (step3.fssaiImage instanceof File) {
          try {
            fssaiImageUpload = await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai");
            // Verify upload was successful and has valid URL
            if (!fssaiImageUpload || !fssaiImageUpload.url) {
              throw new Error('Failed to upload FSSAI image');
            }
          } catch (uploadError) {
            console.error('FSSAI image upload error:', uploadError);
            throw new Error(`Failed to upload FSSAI image: ${uploadError.message}`);
          }
        } else if (step3.fssaiImage?.url) {
          // If fssaiImage already has a URL (from previous save), use it
          fssaiImageUpload = step3.fssaiImage;
        } else if (typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('http')) {
          // If it's a direct URL string
          fssaiImageUpload = {
            url: step3.fssaiImage
          };
        }

        // Verify FSSAI image is present
        if (!fssaiImageUpload || !fssaiImageUpload.url) {
          throw new Error('FSSAI image must be uploaded');
        }
        const payload = {
          step3: {
            pan: {
              panNumber: step3.panNumber || "",
              nameOnPan: step3.nameOnPan || "",
              image: panImageUpload
            },
            gst: {
              isRegistered: step3.gstRegistered || false,
              gstNumber: step3.gstNumber || "",
              legalName: step3.gstLegalName || "",
              address: step3.gstAddress || "",
              image: gstImageUpload
            },
            fssai: {
              registrationNumber: step3.fssaiNumber || "",
              expiryDate: step3.fssaiExpiry || null,
              image: fssaiImageUpload
            },
            bank: {
              accountNumber: step3.accountNumber || "",
              ifscCode: step3.ifscCode || "",
              accountHolderName: step3.accountHolderName || "",
              accountType: step3.accountType || ""
            }
          },
          completedSteps: 3
        };
        const response = await api.put("/restaurant/onboarding", payload);
        if (response?.data?.data?.onboarding) { }
        setStep(4);
      } else if (step === 4) {
        const payload = {
          step4: {
            estimatedDeliveryTime: step4.estimatedDeliveryTime,
            featuredDish: step4.featuredDish,
            featuredPrice: parseFloat(step4.featuredPrice) || 249,
            offer: step4.offer
          },
          completedSteps: 4
        };
        const response = await api.put("/restaurant/onboarding", payload);
        // Verify response is successful
        if (!response || !response.data) {
          throw new Error('Invalid response from server');
        }

        // Clear localStorage when onboarding is complete
        clearOnboardingFromLocalStorage();

        // Show trial offer after completing all steps
        setShowTrialOffer(true);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to save onboarding data";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };
  const proceedAfterOnboarding = () => {
    navigate("/restaurant", {
      replace: true
    });
  };
  const handleClaimTrial = async () => {
    setTrialLoading(true);
    setTrialError("");
    try {
      await subscriptionAPI.claimTrial();
      proceedAfterOnboarding();
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to activate free trial.";
      setTrialError(message);
    } finally {
      setTrialLoading(false);
    }
  };
  const handleSkipTrial = () => {
    proceedAfterOnboarding();
  };
  const toggleCuisine = cuisine => {
    setStep2(prev => {
      const exists = prev.cuisines.includes(cuisine);
      if (exists) {
        return {
          ...prev,
          cuisines: prev.cuisines.filter(c => c !== cuisine)
        };
      }
      if (prev.cuisines.length >= 3) return prev;
      return {
        ...prev,
        cuisines: [...prev.cuisines, cuisine]
      };
    });
  };
  const removeMenuImage = index => {
    setStep2(prev => ({
      ...prev,
      menuImages: prev.menuImages.filter((_, i) => i !== index)
    }));
  };
  const removeProfileImage = () => {
    setStep2(prev => ({
      ...prev,
      profileImage: null
    }));
  };
  const toggleDay = day => {
    setStep2(prev => {
      const exists = prev.openDays.includes(day);
      if (exists) {
        return {
          ...prev,
          openDays: prev.openDays.filter(d => d !== day)
        };
      }
      return {
        ...prev,
        openDays: [...prev.openDays, day]
      };
    });
  };
  const renderStep1 = () => <div className="space-y-6">
    <section className="bg-white p-4 sm:p-6 rounded-md">
      <h2 className="text-lg font-semibold text-blue-600 mb-4">Restaurant information</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">Restaurant name*</Label>
          <Input value={step1.restaurantName || ""} onChange={e => handleStep1Change("restaurantName", e.target.value)} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="e.g. The Grand Kitchen" />
        </div>
      </div>
    </section>

    <section className="bg-white p-4 sm:p-6 rounded-md">
      <h2 className="text-lg font-semibold text-blue-600 mb-4">Owner details</h2>
      <p className="text-sm text-gray-600 mb-4">
        These details will be used for all business communications and updates.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">Full name*</Label>
          <Input value={step1.ownerName || ""} onChange={e => handleStep1Change("ownerName", e.target.value)} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Owner full name" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Email address*</Label>
          <Input type="email" value={step1.ownerEmail || ""} onChange={e => setStep1({
            ...step1,
            ownerEmail: e.target.value
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="owner@email.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">Phone number*</Label>
          <Input value={step1.ownerPhone || ""} onChange={e => handleStep1Change("ownerPhone", e.target.value)} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="+91 98XXXXXX" />
        </div>
      </div>
    </section>

    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">Restaurant contact & location</h2>
      <div>
        <Label className="text-xs text-gray-700">Primary contact number*</Label>
        <Input value={step1.primaryContactNumber || ""} onChange={e => handleStep1Change("primaryContactNumber", e.target.value)} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Restaurant's primary contact number" />
        <p className="text-[11px] text-gray-500 mt-1">
          Customers, delivery partners and {companyName} may call on this number for order
          support.
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Add your restaurant's location for order pick-up.
        </p>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-gray-700">Area / Sector / Locality*</Label>
            <Input value={step1.location?.area || ""} onChange={e => setStep1({
              ...step1,
              location: {
                ...step1.location,
                area: e.target.value
              }
            })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Area / Sector / Locality" />
          </div>
          <div>
            <Label className="text-xs text-gray-700">City*</Label>
            <Input value={step1.location?.city || ""} onChange={e => setStep1({
              ...step1,
              location: {
                ...step1.location,
                city: e.target.value
              }
            })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="City" />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Shop no. / building no. (optional)</Label>
            <Input value={step1.location?.addressLine1 || ""} onChange={e => setStep1({
              ...step1,
              location: {
                ...step1.location,
                addressLine1: e.target.value
              }
            })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Shop no. / building no." />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Floor / tower (optional)</Label>
            <Input value={step1.location?.addressLine2 || ""} onChange={e => setStep1({
              ...step1,
              location: {
                ...step1.location,
                addressLine2: e.target.value
              }
            })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Floor / tower" />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Nearby landmark (optional)</Label>
            <Input value={step1.location?.landmark || ""} onChange={e => setStep1({
              ...step1,
              location: {
                ...step1.location,
                landmark: e.target.value
              }
            })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Nearby landmark" />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-1">
          Please ensure that this address is the same as mentioned on your FSSAI license.
        </p>
      </div>
    </section>
  </div>;
  const renderStep2 = () => <div className="space-y-6">
    {/* Images section */}
    <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
      <h2 className="text-lg font-semibold text-blue-600">Menu & photos</h2>
      <p className="text-xs text-gray-500">
        Add clear photos of your printed menu and a primary profile image. This helps customers
        understand what you serve.
      </p>

      {/* Menu images */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Menu images*</Label>
        <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3 flex items-center justify-between flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-white flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-gray-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-900">Upload menu images</span>
              <span className="text-[11px] text-gray-500">
                JPG, PNG, WebP • You can select multiple files
              </span>
            </div>
          </div>
          <label htmlFor="menuImagesInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black  border border-black text-xs font-medium cursor-pointer     w-full items-center">
            <Upload className="w-4.5 h-4.5" />
            <span>{step2.menuImages.length > 0 ? "Add more images" : "Choose files"}</span>
          </label>
          <input id="menuImagesInput" type="file" multiple accept="image/*" className="hidden" onChange={e => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            setStep2(prev => ({
              ...prev,
              menuImages: [...(prev.menuImages || []), ...files] // Append new files to existing ones
            }));
            // Reset input to allow selecting same file again
            e.target.value = '';
          }} />
        </div>
        {step2.menuImages.length > 0 && (
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={() => setStep2(prev => ({ ...prev, menuImages: [] }))}
              className="text-[11px] text-red-600 hover:text-red-700 font-medium underline"
            >
              Clear all menu images
            </button>
          </div>
        )}

        {/* Menu image previews */}
        {!!step2.menuImages.length && <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {step2.menuImages.map((file, idx) => {
            // Handle both File objects and URL objects
            let imageUrl = null;
            let imageName = `Image ${idx + 1}`;
            if (file instanceof File) {
              imageUrl = URL.createObjectURL(file);
              imageName = file.name;
            } else if (file?.url) {
              // If it's an object with url property (from backend)
              imageUrl = file.url;
              imageName = file.name || `Image ${idx + 1}`;
            } else if (typeof file === 'string') {
              // If it's a direct URL string
              imageUrl = file;
            }
            return <div key={idx} className="relative aspect-[4/5] rounded-md overflow-hidden bg-gray-100 group">
              {imageUrl ? <img src={imageUrl} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-500 px-2 text-center">
                Preview unavailable
              </div>}
              <button
                type="button"
                onClick={() => removeMenuImage(idx)}
                className="absolute top-1 right-1 h-6 w-6 bg-red-500/90 rounded-full flex items-center justify-center text-white shadow-md hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                <p className="text-[10px] text-white truncate">
                  {imageName}
                </p>
              </div>
            </div>;
          })}
        </div>}
      </div>

      {/* Profile image */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Restaurant profile image</Label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
            {step2.profileImage ? (() => {
              let imageSrc = null;
              if (step2.profileImage instanceof File) {
                imageSrc = URL.createObjectURL(step2.profileImage);
              } else if (step2.profileImage?.url) {
                imageSrc = step2.profileImage.url;
              } else if (typeof step2.profileImage === 'string') {
                imageSrc = step2.profileImage;
              }
              return imageSrc ? <img src={imageSrc} alt="Restaurant profile" className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-gray-400" />;
            })() : <ImageIcon className="w-8 h-8 text-gray-400" />}
          </div>

          <div className="flex-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3 flex items-center justify-between flex-col gap-3">
            <div className="flex items-center gap-3 w-full">
              <div className="h-10 w-10 rounded-md bg-white flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-900">Upload profile image*</span>
                <span className="text-[11px] text-gray-500">
                  Visible to customers on your listing
                </span>
              </div>
            </div>
            <label htmlFor="profileImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium cursor-pointer w-full">
              <Upload className="w-4.5 h-4.5" />
              <span>{step2.profileImage ? "Change photo" : "Choose file"}</span>
            </label>
            <input id="profileImageInput" type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0] || null;
              if (file) {
                setStep2(prev => ({
                  ...prev,
                  profileImage: file
                }));
              }
              e.target.value = '';
            }} />
          </div>
        </div>
        {step2.profileImage && (
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={removeProfileImage}
              className="text-[11px] text-red-600 hover:text-red-700 font-medium underline"
            >
              Remove profile photo
            </button>
          </div>
        )}
      </div>
    </section>

    {/* Operational details */}
    <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
      {/* Cuisines */}
      <div>
        <Label className="text-xs text-gray-700">Select cuisines (up to 3)*</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {cuisinesOptions.map(cuisine => {
            const active = step2.cuisines.includes(cuisine);
            return <button key={cuisine} type="button" onClick={() => toggleCuisine(cuisine)} className={`px-3 py-1.5 text-xs rounded-full ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {cuisine}
            </button>;
          })}
        </div>
      </div>

      {/* Timings with popover time selectors */}
      <div className="space-y-3">
        <Label className="text-xs text-gray-700">Delivery timings*</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TimeSelector label="Opening time" value={step2.openingTime || ""} onChange={val => setStep2({
            ...step2,
            openingTime: val || ""
          })} />
          <TimeSelector label="Closing time" value={step2.closingTime || ""} onChange={val => setStep2({
            ...step2,
            closingTime: val || ""
          })} />
        </div>
      </div>

      {/* Open days in a calendar-like grid */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-700 flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-gray-800" />
          <span>Open days*</span>
        </Label>
        <p className="text-[11px] text-gray-500">
          Select the days your restaurant accepts delivery orders.
        </p>
        <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
          {daysOfWeek.map(day => {
            const active = step2.openDays.includes(day);
            return <button key={day} type="button" onClick={() => toggleDay(day)} className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {day.charAt(0)}
            </button>;
          })}
        </div>
      </div>
    </section>
  </div>;
  const renderStep3 = () => <div className="space-y-6">
    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">PAN details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">PAN number*</Label>
          <Input placeholder='ASDFG1234H' value={step3.panNumber || ""} onChange={e => setStep3({
            ...step3,
            panNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" maxLength={10} />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Name on PAN*</Label>
          <Input placeholder='Name as per PAN' value={step3.nameOnPan || ""} onChange={e => setStep3({
            ...step3,
            nameOnPan: e.target.value
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-700">PAN image*</Label>
        <Input type="file" accept="image/*" onChange={e => setStep3({
          ...step3,
          panImage: e.target.files?.[0] || null
        })} className="mt-1 bg-white text-sm text-black" />
      </div>
    </section>

    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">GST details</h2>
      <div className="flex gap-4 items-center text-sm">
        <span className="text-gray-700">GST registered?</span>
        <button type="button" onClick={() => setStep3({
          ...step3,
          gstRegistered: true
        })} className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
          Yes
        </button>
        <button type="button" onClick={() => setStep3({
          ...step3,
          gstRegistered: false
        })} className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
          No
        </button>
      </div>
      {step3.gstRegistered && <div className="space-y-4">
        <div>
          <Label className="text-xs text-gray-700">GST number*</Label>
          <Input value={step3.gstNumber || ""} onChange={e => setStep3({
            ...step3,
            gstNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="GST number" maxLength={15} />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Legal name*</Label>
          <Input value={step3.gstLegalName || ""} onChange={e => setStep3({
            ...step3,
            gstLegalName: e.target.value
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Legal name" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Registered address*</Label>
          <Input value={step3.gstAddress || ""} onChange={e => setStep3({
            ...step3,
            gstAddress: e.target.value
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Registered address" />
        </div>
        <div>
          <Label className="text-xs text-gray-700">GST certificate image*</Label>
          <Input type="file" accept="image/*" onChange={e => setStep3({
            ...step3,
            gstImage: e.target.files?.[0] || null
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" />
        </div>
      </div>}
    </section>

    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">FSSAI details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">FSSAI registration number*</Label>
          <Input value={step3.fssaiNumber || ""} onChange={e => setStep3({
            ...step3,
            fssaiNumber: e.target.value.replace(/\D/g, "").slice(0, 14)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="FSSAI number" maxLength={14} />
        </div>
        <div>
          <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date*</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50">
                <span className={step3.fssaiExpiry ? "text-gray-900" : "text-gray-500"}>
                  {step3.fssaiExpiry ? new Date(step3.fssaiExpiry).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  }) : "Select expiry date"}
                </span>
                <CalendarIcon className="w-4 h-4 text-gray-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={step3.fssaiExpiry ? new Date(step3.fssaiExpiry) : undefined}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date <= today;
                }}
                onSelect={date => {
                  if (date) {
                    const formattedDate = date.toISOString().split("T")[0];
                    setStep3({
                      ...step3,
                      fssaiExpiry: formattedDate
                    });
                  }
                }} initialFocus className="rounded-md border border-gray-200" />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-700">FSSAI license image*</Label>
        <Input type="file" accept="image/*" onChange={e => setStep3({
          ...step3,
          fssaiImage: e.target.files?.[0] || null
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" />
      </div>
    </section>

    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">Bank account details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">Account number*</Label>
          <Input value={step3.accountNumber || ""} onChange={e => setStep3({
            ...step3,
            accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Account number" maxLength={18} />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Re-enter account number*</Label>
          <Input value={step3.confirmAccountNumber || ""} onChange={e => setStep3({
            ...step3,
            confirmAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 18)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Re-enter account number" maxLength={18} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">IFSC code*</Label>
          <Input value={step3.ifscCode || ""} onChange={e => setStep3({
            ...step3,
            ifscCode: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="SBIN0000123" maxLength={11} />
        </div>
        <div>
          <Label className="text-xs text-gray-700">Account type*</Label>
          <Input value={step3.accountType || ""} onChange={e => setStep3({
            ...step3,
            accountType: e.target.value
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Account type (savings / current)" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-700">Account holder name*</Label>
        <Input value={step3.accountHolderName || ""} onChange={e => setStep3({
          ...step3,
          accountHolderName: e.target.value
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Account holder name" />
      </div>
    </section>
  </div>;
  const renderStep4 = () => <div className="space-y-6">
    <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
      <h2 className="text-lg font-semibold text-blue-600">Restaurant Display Information</h2>
      <p className="text-sm text-gray-600">
        Add information that will be displayed to customers on the home page
      </p>      <div>
        <Label className="text-xs text-gray-700">Estimated Delivery Time*</Label>
        <Input value={step4.estimatedDeliveryTime || ""} onChange={e => setStep4({
          ...step4,
          estimatedDeliveryTime: e.target.value
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="e.g. 30-40 mins" />
      </div>
      <div>
        <Label className="text-xs text-gray-700">Featured Dish Name*</Label>
        <Input value={step4.featuredDish || ""} onChange={e => setStep4({
          ...step4,
          featuredDish: e.target.value
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="Name of your popular dish" />
      </div>
      <div>
        <Label className="text-xs text-gray-700">Featured Dish Price (₹)*</Label>
        <Input type="number" value={step4.featuredPrice || ""} onChange={e => setStep4({
          ...step4,
          featuredPrice: e.target.value
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="0.00" />
      </div>
      <div>
        <Label className="text-xs text-gray-700">Special Offer/Promotion*</Label>
        <Input value={step4.offer || ""} onChange={e => setStep4({
          ...step4,
          offer: e.target.value
        })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="e.g. 20% off on first order" />
      </div>
    </section>
  </div>;
  const renderStep = () => {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    if (step === 3) return renderStep3();
    return renderStep4();
  };
  return <LocalizationProvider dateAdapter={AdapterDateFns}>
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="text-sm font-semibold text-blue-600">Restaurant onboarding</div>
        <div className="flex items-center gap-3">

          <div className="text-xs text-gray-600">
            Step {step} of 4
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {loading ? <p className="text-sm text-gray-600">Loading...</p> : renderStep()}
      </main>

      {error && <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">
        {error}
      </div>}

      <footer className="px-4 sm:px-6 py-3 bg-white">
        <div className="flex justify-between items-center">
          <Button variant="ghost" disabled={step === 1 || saving} onClick={() => setStep(s => Math.max(1, s - 1))} className="text-sm text-gray-700 bg-transparent">
            Back
          </Button>
          <Button onClick={handleNext} disabled={saving} className="text-sm bg-blue-600 text-white px-6 hover:bg-blue-700">
            {step === 4 ? saving ? "Saving..." : "Finish" : saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </footer>

      {showTrialOffer && <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="text-lg font-bold text-gray-900">Get 1 month free</div>
            <p className="mt-2 text-sm text-gray-600">
              Activate your free Growth plan for 30 days. You can use all advanced analytics without paying.
            </p>
            {trialError && <p className="mt-3 text-xs text-red-600">{trialError}</p>}
            <Button onClick={handleClaimTrial} disabled={trialLoading} className="mt-5 w-full h-11 rounded-lg font-bold text-sm bg-gray-900 hover:bg-black text-white">
              {trialLoading ? "Activating..." : "Get 1 month free"}
            </Button>
            <button type="button" onClick={handleSkipTrial} className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-700">
              Maybe later
            </button>
          </div>
        </div>}
    </div>
  </LocalizationProvider>;
}
