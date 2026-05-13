import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadAPI, api } from "@/lib/api";
import { clearModuleAuth } from "@/lib/utils/auth";
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { determineStepToShow } from "../utils/onboardingUtils";
import { toast } from "sonner";
import { useCompanyName } from "@/lib/hooks/useCompanyName";
const cuisinesOptions = ["North Indian", "South Indian", "Chinese", "Pizza", "Burgers", "Bakery", "Cafe"];
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ONBOARDING_STORAGE_KEY = "restaurant_onboarding_data";
const ONBOARDING_SESSION_KEY = "restaurant_onboarding_session";

// Helper functions for localStorage
const saveOnboardingToLocalStorage = (step1, step2, step3, currentStep) => {
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

const hasMeaningfulOnboardingDraft = data => {
  if (!data) return false;
  const serialized = JSON.stringify({
    step1: data.step1 || {},
    step2: data.step2 || {},
    step3: data.step3 || {}
  });
  return serialized !== JSON.stringify({
    step1: {},
    step2: {},
    step3: {}
  });
};

// Helper function to convert "HH:mm" string to Date object
const stringToTime = timeString => {
  if (!timeString || !timeString.includes(":")) {
    return null; // Return null so the picker shows empty/placeholder
  }
  const [hours, minutes] = timeString.split(":").map(Number);
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  const safeHours = Number.isFinite(parsedHours) ? Math.max(0, Math.min(23, parsedHours)) : 10;
  const safeMinutes = Number.isFinite(parsedMinutes) ? Math.max(0, Math.min(59, parsedMinutes)) : 0;
  return new Date(2000, 0, 1, safeHours, safeMinutes);
};

// Helper function to convert Date object to "HH:mm" string
const timeToString = date => {
  if (!date) return "";
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const readFileAsDataUrl = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const normalizeAlphabeticText = value => value.replace(/[^a-zA-Z\s]/g, "");

const isDataUrl = value =>
  typeof value === "string" && value.startsWith("data:");

const isHttpUrl = value =>
  typeof value === "string" && value.startsWith("http");

const isFlutterInAppWebViewAvailable = () =>
  typeof window !== "undefined" &&
  typeof window.flutter_inappwebview?.callHandler === "function";

const imageValueToFile = async (value, fallbackName) => {
  if (value instanceof File) {
    return value;
  }

  const dataUrl = value?.dataUrl || (isDataUrl(value) ? value : null);
  if (dataUrl) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const name = value?.name || fallbackName;
    const type = value?.type || blob.type || "image/jpeg";
    return new File([blob], name, { type });
  }

  return null;
};

const flutterBase64ToStoredImage = async (result, fallbackName) => {
  if (!result || result.success === false) {
    return null;
  }

  if (result.file instanceof File) {
    return buildStoredImage(result.file);
  }

  const base64 = result.base64 ? String(result.base64) : "";
  if (!base64) {
    return null;
  }

  const mimeType = result.mimeType || "image/jpeg";
  const normalizedBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const dataUrl = `data:${mimeType};base64,${normalizedBase64}`;

  return {
    name: result.fileName || fallbackName,
    size: null,
    type: mimeType,
    dataUrl,
    previewUrl: dataUrl
  };
};

const flutterResultToStoredImages = async (result, fallbackNamePrefix) => {
  if (!result || result.success === false) {
    return [];
  }

  const items = Array.isArray(result.files) && result.files.length ? result.files : [result];
  const storedImages = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const fallbackName =
      items.length > 1 ? `${fallbackNamePrefix}-${index + 1}.jpg` : fallbackNamePrefix;
    const storedImage = await flutterBase64ToStoredImage(item, fallbackName);
    if (storedImage) {
      storedImages.push(storedImage);
    }
  }

  return storedImages;
};

const normalizeRestoredImage = value => {
  if (!value || value instanceof File) return value;
  if (typeof value === "string") return value;

  const normalized = { ...value };
  const isBlobPreview =
    typeof normalized.previewUrl === "string" && normalized.previewUrl.startsWith("blob:");
  if (isBlobPreview) {
    if (normalized.dataUrl) {
      normalized.previewUrl = normalized.dataUrl;
    } else if (normalized.url) {
      normalized.previewUrl = normalized.url;
    } else {
      delete normalized.previewUrl;
    }
  }
  return normalized;
};

const getImagePreviewUrl = value => {
  if (value instanceof File) {
    return URL.createObjectURL(value);
  }
  if (value?.dataUrl) {
    return value.dataUrl;
  }
  if (value?.previewUrl) {
    if (typeof value.previewUrl === "string" && value.previewUrl.startsWith("blob:")) {
      return value?.url || null;
    }
    return value.previewUrl;
  }
  if (value?.url) {
    return value.url;
  }
  if (isDataUrl(value) || isHttpUrl(value)) {
    return value;
  }
  return null;
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isFssaiCalendarOpen, setIsFssaiCalendarOpen] = useState(false);
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
  const hasLocalDraftRef = useRef(false);
  const hasLocalStepRef = useRef(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  const normalizeStep = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    if (n < 1) return 1;
    if (n > 3) return 3;
    return Math.trunc(n);
  };

  const getPrefilledOwnerEmail = () => {
    try {
      const storedUserRaw = localStorage.getItem("restaurant_user");
      if (storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        const storedEmail =
          storedUser?.ownerEmail ||
          storedUser?.email ||
          storedUser?.contactEmail ||
          "";
        if (storedEmail) {
          return storedEmail;
        }
      }
    } catch (err) {
      console.error("Failed to read restaurant user email:", err);
    }

    try {
      const authDataRaw = sessionStorage.getItem("restaurantAuthData");
      if (authDataRaw) {
        const authData = JSON.parse(authDataRaw);
        return authData?.email || "";
      }
    } catch (err) {
      console.error("Failed to read restaurant auth email:", err);
    }

    return "";
  };

  const normalizeIndianPhone = (phone) => {
    if (!phone) return "";
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length <= 10) return digits;
    return digits.slice(-10);
  };

  const getPrefilledOwnerPhone = () => {
    try {
      const storedUserRaw = localStorage.getItem("restaurant_user");
      if (storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        const storedPhone =
          storedUser?.ownerPhone ||
          storedUser?.phone ||
          storedUser?.contactNumber ||
          "";
        if (storedPhone) {
          return normalizeIndianPhone(storedPhone);
        }
      }
    } catch (err) {
      console.error("Failed to read restaurant user phone:", err);
    }

    try {
      const authDataRaw = sessionStorage.getItem("restaurantAuthData");
      if (authDataRaw) {
        const authData = JSON.parse(authDataRaw);
        return normalizeIndianPhone(authData?.phone || "");
      }
    } catch (err) {
      console.error("Failed to read restaurant auth phone:", err);
    }

    return "";
  };

  const getRestaurantAuthMode = () => {
    try {
      const authDataRaw = sessionStorage.getItem("restaurantAuthData");
      if (authDataRaw) {
        const authData = JSON.parse(authDataRaw);
        if (authData?.method === "email" || authData?.method === "phone") {
          return authData.method;
        }
      }

      const storedMode = localStorage.getItem("restaurant_auth_mode");
      if (storedMode === "email" || storedMode === "phone") {
        return storedMode;
      }
    } catch (err) {
      console.error("Failed to determine restaurant auth mode:", err);
    }

    // Safe default: lock email field when explicit auth mode is unavailable.
    return "email";
  };

  const buildStoredImage = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl,
      previewUrl: URL.createObjectURL(file)
    };
  };

  const captureMenuImageFromCamera = async () => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openCamera", {
        source: "camera",
        accept: "image/*",
        multiple: false,
        quality: 0.8
      });
      const storedImage = await flutterBase64ToStoredImage(result, `menu-image-${Date.now()}.jpg`);
      if (!storedImage) return false;
      setStep2(prev => ({
        ...prev,
        menuImages: [...(prev.menuImages || []), storedImage]
      }));
      return true;
    } catch (error) {
      console.error("Failed to capture menu image from Flutter camera:", error);
      return false;
    }
  };

  const captureMenuImagesFromGallery = async () => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openGallery", {
        source: "gallery",
        accept: "image/*",
        multiple: true,
        quality: 0.8
      });
      const storedImages = await flutterResultToStoredImages(result, `menu-image-${Date.now()}`);
      if (!storedImages.length) return false;
      setStep2(prev => ({
        ...prev,
        menuImages: [...(prev.menuImages || []), ...storedImages]
      }));
      return true;
    } catch (error) {
      console.error("Failed to capture menu images from Flutter gallery:", error);
      return false;
    }
  };

  const captureSingleImageFromCamera = async (setter, fallbackName) => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openCamera", {
        source: "camera",
        accept: "image/*",
        multiple: false,
        quality: 0.8
      });
      const storedImage = await flutterBase64ToStoredImage(result, fallbackName);
      if (!storedImage) return false;
      setter(storedImage);
      return true;
    } catch (error) {
      console.error("Failed to capture image from Flutter camera:", error);
      return false;
    }
  };

  const captureSingleImageFromGallery = async (setter, fallbackName) => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openGallery", {
        source: "gallery",
        accept: "image/*",
        multiple: false,
        quality: 0.8
      });
      const storedImages = await flutterResultToStoredImages(result, fallbackName);
      const storedImage = storedImages[0];
      if (!storedImage) return false;
      setter(storedImage);
      return true;
    } catch (error) {
      console.error("Failed to capture image from Flutter gallery:", error);
      return false;
    }
  };

  const triggerNativeFilePicker = inputId => {
    if (typeof document === "undefined") return;
    document.getElementById(inputId)?.click();
  };

  const authMode = getRestaurantAuthMode();

  const exitToLoginFromOnboarding = useCallback(() => {
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
    clearModuleAuth("restaurant");
    navigate("/restaurant/login", { replace: true });
  }, [navigate]);

  const proceedAfterOnboarding = useCallback(() => {
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
    navigate("/restaurant", {
      replace: true
    });
  }, [navigate]);

  // Load from localStorage on mount and check URL parameter
  useEffect(() => {
    const hasOnboardingSession = sessionStorage.getItem(ONBOARDING_SESSION_KEY) === "1";
    if (!hasOnboardingSession) {
      clearOnboardingFromLocalStorage();
      clearModuleAuth("restaurant");
      navigate("/restaurant/login", { replace: true });
      return;
    }

    const stepParam = new URLSearchParams(window.location.search).get("step");
    const localData = loadOnboardingFromLocalStorage();
    if (localData) {
      hasLocalStepRef.current = Number.isFinite(Number(localData.currentStep));
      hasLocalDraftRef.current = hasMeaningfulOnboardingDraft(localData);
      if (localData.step1) {
        setStep1({
          restaurantName: localData.step1.restaurantName || "",
          ownerName: localData.step1.ownerName || "",
          ownerEmail: localData.step1.ownerEmail || "",
          ownerPhone: normalizeIndianPhone(localData.step1.ownerPhone || ""),
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
          menuImages: (localData.step2.menuImages || []).map(normalizeRestoredImage),
          profileImage: normalizeRestoredImage(localData.step2.profileImage) || null,
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
          panImage: normalizeRestoredImage(localData.step3.panImage) || null,
          gstRegistered: localData.step3.gstRegistered || false,
          gstNumber: localData.step3.gstNumber || "",
          gstLegalName: localData.step3.gstLegalName || "",
          gstAddress: localData.step3.gstAddress || "",
          gstImage: normalizeRestoredImage(localData.step3.gstImage) || null,
          fssaiNumber: localData.step3.fssaiNumber || "",
          fssaiExpiry: localData.step3.fssaiExpiry || "",
          fssaiImage: normalizeRestoredImage(localData.step3.fssaiImage) || null,
          accountNumber: localData.step3.accountNumber || "",
          confirmAccountNumber: localData.step3.confirmAccountNumber || "",
          ifscCode: localData.step3.ifscCode || "",
          accountHolderName: localData.step3.accountHolderName || "",
          accountType: localData.step3.accountType || ""
        });
      }
      // Always prioritize locally saved step on refresh.
      if (localData.currentStep) {
        setStep(normalizeStep(localData.currentStep));
      }
    } else if (stepParam) {
      // Use URL step only when no local draft exists.
      const stepNum = parseInt(stepParam, 10);
      if (stepNum >= 1 && stepNum <= 3) {
        setStep(stepNum);
      }
    }

    const prefilledOwnerEmail = getPrefilledOwnerEmail();
    if (prefilledOwnerEmail) {
      setStep1(prev => ({
        ...prev,
        ownerEmail: prev.ownerEmail || prefilledOwnerEmail
      }));
    }

    const prefilledOwnerPhone = getPrefilledOwnerPhone();
    if (prefilledOwnerPhone) {
      setStep1(prev => ({
        ...prev,
        ownerPhone: prev.ownerPhone || prefilledOwnerPhone
      }));
    }

    setIsBootstrapped(true);
  }, []);

  const handleBack = useCallback(() => {
    const effectiveStep = normalizeStep(step);
    if (effectiveStep > 1) {
      setStep(effectiveStep - 1);
    } else {
      clearOnboardingFromLocalStorage();
      exitToLoginFromOnboarding();
    }
  }, [step, exitToLoginFromOnboarding]);

  // Save to localStorage whenever step data changes
  useEffect(() => {
    if (!isBootstrapped) return;
    saveOnboardingToLocalStorage(step1, step2, step3, step);
  }, [isBootstrapped, step1, step2, step3, step]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // Keep URL step in sync with actual UI step.
  // Use push navigation so browser back can move between onboarding stages.
  useEffect(() => {
    const currentUrlStep = Number(new URLSearchParams(window.location.search).get("step"));
    const normalizedCurrentUrlStep =
      Number.isFinite(currentUrlStep) && currentUrlStep >= 1 && currentUrlStep <= 3
        ? Math.trunc(currentUrlStep)
        : null;
    const effectiveStep = normalizeStep(step);

    if (normalizedCurrentUrlStep === effectiveStep) return;

    navigate(`/restaurant/onboarding?step=${effectiveStep}`, { replace: false });
  }, [step, navigate]);

  useEffect(() => {
    const handleBrowserBack = () => {
      const currentPath = window.location.pathname || "";

      // If browser back tries to leave onboarding flow, force the expected exit:
      // step 1 back should always land on login.
      if (!currentPath.startsWith("/restaurant/onboarding")) {
        clearOnboardingFromLocalStorage();
        exitToLoginFromOnboarding();
        return;
      }

      // If still on onboarding route, derive stage from URL history entry.
      const stepParam = Number(new URLSearchParams(window.location.search).get("step"));
      const normalizedStepParam =
        Number.isFinite(stepParam) && stepParam >= 1 && stepParam <= 3
          ? Math.trunc(stepParam)
          : 1;
      setStep(normalizedStepParam);
    };

    window.addEventListener("popstate", handleBrowserBack);

    return () => {
      window.removeEventListener("popstate", handleBrowserBack);
    };
  }, [exitToLoginFromOnboarding]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get("/restaurant/onboarding");
        const payload = res?.data?.data || {};
        const data = payload?.onboarding;
        const baseRestaurantName = payload?.restaurantName || "";

        // If user has local step/draft state, don't let API step-computation override refresh state.
        if (hasLocalDraftRef.current || hasLocalStepRef.current) {
          // Don't overwrite data but still fetch to check if onboarding is complete
          // Only redirect if onboarding is complete
          if (data && determineStepToShow(data) === null) {
            clearOnboardingFromLocalStorage();
            proceedAfterOnboarding();
          }
          return;
        }

        if (data) {
          if (data.step1) {
            setStep1(prev => ({
              restaurantName: data.step1.restaurantName || prev.restaurantName || baseRestaurantName || "",
              ownerName: data.step1.ownerName || prev.ownerName || "",
              ownerEmail: data.step1.ownerEmail || prev.ownerEmail || getPrefilledOwnerEmail(),
              ownerPhone: normalizeIndianPhone(data.step1.ownerPhone || prev.ownerPhone || getPrefilledOwnerPhone()),
              primaryContactNumber: data.step1.primaryContactNumber || prev.primaryContactNumber || "",
              location: {
                addressLine1: data.step1.location?.addressLine1 || prev.location?.addressLine1 || "",
                addressLine2: data.step1.location?.addressLine2 || prev.location?.addressLine2 || "",
                area: data.step1.location?.area || prev.location?.area || "",
                city: data.step1.location?.city || prev.location?.city || "",
                landmark: data.step1.location?.landmark || prev.location?.landmark || ""
              }
            }));
          } else if (baseRestaurantName) {
            // If onboarding step1 not started yet, prefill restaurantName from registration
            setStep1(prev => ({
              ...prev,
              restaurantName: prev.restaurantName || baseRestaurantName
            }));
          }
          if (data.step2) {
            setStep2(prev => ({
              // Load menu images from URLs if available
              menuImages: data.step2.menuImageUrls?.length ? data.step2.menuImageUrls : prev.menuImages || [],
              // Load profile image URL if available
              profileImage: data.step2.profileImageUrl || prev.profileImage || null,
              cuisines: data.step2.cuisines?.length ? data.step2.cuisines : prev.cuisines || [],
              openingTime: data.step2.deliveryTimings?.openingTime || prev.openingTime || "",
              closingTime: data.step2.deliveryTimings?.closingTime || prev.closingTime || "",
              openDays: data.step2.openDays?.length ? data.step2.openDays : prev.openDays || []
            }));
          }
          if (data.step3) {
            setStep3(prev => ({
              panNumber: data.step3.pan?.panNumber || prev.panNumber || "",
              nameOnPan: data.step3.pan?.nameOnPan || prev.nameOnPan || "",
              panImage: prev.panImage || null,
              // Don't load images from API, user needs to re-upload
              gstRegistered: data.step3.gst?.isRegistered ?? prev.gstRegistered ?? false,
              gstNumber: data.step3.gst?.gstNumber || prev.gstNumber || "",
              gstLegalName: data.step3.gst?.legalName || prev.gstLegalName || "",
              gstAddress: data.step3.gst?.address || prev.gstAddress || "",
              gstImage: prev.gstImage || null,
              // Don't load images from API, user needs to re-upload
              fssaiNumber: data.step3.fssai?.registrationNumber || prev.fssaiNumber || "",
              fssaiExpiry: data.step3.fssai?.expiryDate ? data.step3.fssai.expiryDate.slice(0, 10) : prev.fssaiExpiry || "",
              fssaiImage: prev.fssaiImage || null,
              // Don't load images from API, user needs to re-upload
              accountNumber: data.step3.bank?.accountNumber || prev.accountNumber || "",
              confirmAccountNumber: data.step3.bank?.accountNumber || prev.confirmAccountNumber || "",
              ifscCode: data.step3.bank?.ifscCode || prev.ifscCode || "",
              accountHolderName: data.step3.bank?.accountHolderName || prev.accountHolderName || "",
              accountType: data.step3.bank?.accountType || prev.accountType || ""
            }));
          }
          // Determine which step to show based on completeness
          const stepToShow = determineStepToShow(data);
          if (stepToShow == null) {
            // Onboarding already complete (step 3 is final).
            clearOnboardingFromLocalStorage();
            proceedAfterOnboarding();
            return;
          } else {
            setStep(normalizeStep(stepToShow));
          }
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

  const handleLocationChange = (field, value) => {
    let sanitizedValue = value;
    if (field === "city") {
      sanitizedValue = normalizeAlphabeticText(value);
    }

    setStep1(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: sanitizedValue
      }
    }));
  };

  const handleMenuImagesChange = async files => {
    if (!files.length) return;
    const storedImages = await Promise.all(files.map(async file => buildStoredImage(file)));
    setStep2(prev => ({
      ...prev,
      menuImages: [...(prev.menuImages || []), ...storedImages]
    }));
  };

  const handleSingleImageChange = async (setter, file) => {
    if (!file) return;
    const storedImage = await buildStoredImage(file);
    setter(storedImage);
  };

  const canUseStoredImage = image =>
    image instanceof File ||
    Boolean(image?.dataUrl) ||
    Boolean(image?.url) ||
    isDataUrl(image) ||
    isHttpUrl(image);

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
        if (img?.dataUrl && typeof img.dataUrl === 'string') return true;
        if (img?.url && typeof img.url === 'string') return true;
        if (typeof img === 'string' && img.startsWith('http')) return true;
        if (typeof img === 'string' && img.startsWith('data:')) return true;
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
      const isValidProfileImage = canUseStoredImage(step2.profileImage);
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
      const isValidPanImage = canUseStoredImage(step3.panImage);
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
      const isValidFssaiImage = canUseStoredImage(step3.fssaiImage);
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
        const isValidGstImage = canUseStoredImage(step3.gstImage);
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
    const effectiveStep = normalizeStep(step);

    // Validate current step before proceeding
    let validationErrors = [];
    if (effectiveStep === 1) {
      validationErrors = validateStep1();
    } else if (effectiveStep === 2) {
      validationErrors = validateStep2();
    } else if (effectiveStep === 3) {
      validationErrors = validateStep3();
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
      if (effectiveStep === 1) {
        // Keep step1 local; persist to backend only on final submit.
        setStep(2);
      } else if (effectiveStep === 2) {
        const menuUploads = [];
        // Upload menu images if they are File objects
        for (let index = 0; index < step2.menuImages.length; index += 1) {
          const file = step2.menuImages[index];
          const uploadableFile = await imageValueToFile(file, `menu-image-${index + 1}.jpg`);
          if (!uploadableFile) continue;
          try {
            const uploaded = await handleUpload(uploadableFile, "appzeto/restaurant/menu");
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
        const existingMenuUrls = step2.menuImages.filter(img => {
          if (img instanceof File) return false;
          if (img?.dataUrl) return false;
          if (typeof img === 'string' && img.startsWith('data:')) return false;
          return Boolean(img?.url || (typeof img === 'string' && img.startsWith('http')));
        });
        const allMenuUrls = [...existingMenuUrls, ...menuUploads];

        // Verify we have at least one menu image
        if (allMenuUrls.length === 0) {
          throw new Error('At least one menu image must be uploaded');
        }

        // Upload profile image if it's a File object
        let profileUpload = null;
        if (step2.profileImage instanceof File || step2.profileImage?.dataUrl || typeof step2.profileImage === 'string' && step2.profileImage.startsWith('data:')) {
          try {
            const uploadableProfileImage = await imageValueToFile(step2.profileImage, "restaurant-profile.jpg");
            profileUpload = await handleUpload(uploadableProfileImage, "appzeto/restaurant/profile");
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
        // Keep step2 local; persist to backend only on final submit.
        // Store uploaded URLs locally so final payload can be sent once at completion.
        setStep2(prev => ({
          ...prev,
          menuImages: allMenuUrls.length > 0 ? allMenuUrls : [],
          profileImage: profileUpload,
          cuisines: prev.cuisines || [],
          openingTime: prev.openingTime || "",
          closingTime: prev.closingTime || "",
          openDays: prev.openDays || []
        }));
        setStep(3);
      } else if (effectiveStep === 3) {
        // Upload PAN image if it's a File object
        let panImageUpload = null;
        if (step3.panImage instanceof File || step3.panImage?.dataUrl || typeof step3.panImage === 'string' && step3.panImage.startsWith('data:')) {
          try {
            const uploadablePanImage = await imageValueToFile(step3.panImage, "pan-image.jpg");
            panImageUpload = await handleUpload(uploadablePanImage, "appzeto/restaurant/pan");
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
          if (step3.gstImage instanceof File || step3.gstImage?.dataUrl || typeof step3.gstImage === 'string' && step3.gstImage.startsWith('data:')) {
            try {
              const uploadableGstImage = await imageValueToFile(step3.gstImage, "gst-image.jpg");
              gstImageUpload = await handleUpload(uploadableGstImage, "appzeto/restaurant/gst");
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
        if (step3.fssaiImage instanceof File || step3.fssaiImage?.dataUrl || typeof step3.fssaiImage === 'string' && step3.fssaiImage.startsWith('data:')) {
          try {
            const uploadableFssaiImage = await imageValueToFile(step3.fssaiImage, "fssai-image.jpg");
            fssaiImageUpload = await handleUpload(uploadableFssaiImage, "appzeto/restaurant/fssai");
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
        const finalStep2MenuUrls = (step2.menuImages || []).filter(img => {
          if (img instanceof File) return false;
          if (img?.dataUrl) return false;
          if (typeof img === "string" && img.startsWith("data:")) return false;
          return Boolean(img?.url || (typeof img === "string" && img.startsWith("http")));
        });
        const finalStep2Profile =
          step2.profileImage?.url
            ? step2.profileImage
            : (typeof step2.profileImage === "string" && step2.profileImage.startsWith("http")
              ? { url: step2.profileImage }
              : null);

        if (!finalStep2MenuUrls.length) {
          throw new Error("At least one menu image must be uploaded");
        }
        if (!finalStep2Profile?.url) {
          throw new Error("Profile image must be uploaded");
        }

        const payload = {
          step1,
          step2: {
            menuImageUrls: finalStep2MenuUrls,
            profileImageUrl: finalStep2Profile,
            cuisines: step2.cuisines || [],
            deliveryTimings: {
              openingTime: step2.openingTime || "",
              closingTime: step2.closingTime || ""
            },
            openDays: step2.openDays || []
          },
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
        // Step 4 removed; onboarding completes after step 3.
        clearOnboardingFromLocalStorage();

        proceedAfterOnboarding();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to save onboarding data";
      setError(msg);
    } finally {
      setSaving(false);
    }
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
          <Input
            type="email"
            value={step1.ownerEmail || ""}
            readOnly={authMode === "email"}
            tabIndex={authMode === "email" ? -1 : 0}
            onChange={authMode === "email" ? undefined : e => handleStep1Change("ownerEmail", e.target.value)}
            className={`mt-1 text-sm text-black placeholder:text-gray-400 ${authMode === "email" ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
            placeholder="owner@email.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-700">Phone number*</Label>
          <Input
            value={step1.ownerPhone || ""}
            readOnly={authMode === "phone"}
            tabIndex={authMode === "phone" ? -1 : 0}
            onChange={authMode === "phone" ? undefined : e => handleStep1Change("ownerPhone", e.target.value)}
            className={`mt-1 text-sm text-black placeholder:text-gray-400 ${authMode === "phone" ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
            placeholder="+91 98XXXXXX"
          />
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
            <Input value={step1.location?.city || ""} onChange={e => handleLocationChange("city", e.target.value)} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" placeholder="City" />
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
          <button
            type="button"
            onClick={async () => {
              if (isFlutterInAppWebViewAvailable()) {
                const picked = await captureMenuImagesFromGallery();
                if (picked) return;
              }
              triggerNativeFilePicker("menuImagesInput");
            }}
            className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black  border border-black text-xs font-medium w-full items-center"
          >
            <Upload className="w-4.5 h-4.5" />
            <span>{step2.menuImages.length > 0 ? "Add more images" : "Choose files"}</span>
          </button>
          {isFlutterInAppWebViewAvailable() && (
            <button
              type="button"
              onClick={captureMenuImageFromCamera}
              className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-blue-600 text-white border border-blue-600 text-xs font-medium w-full"
            >
              <span>Take photo</span>
            </button>
          )}
          <input id="menuImagesInput" type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async e => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            await handleMenuImagesChange(files);
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
            const imageUrl = getImagePreviewUrl(file);
            const imageName = file?.name || `Image ${idx + 1}`;
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
              const imageSrc = getImagePreviewUrl(step2.profileImage);
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
            <button
              type="button"
              onClick={async () => {
                if (isFlutterInAppWebViewAvailable()) {
                  const picked = await captureSingleImageFromGallery(image => setStep2(prev => ({
                    ...prev,
                    profileImage: image
                  })), `restaurant-profile-${Date.now()}.jpg`);
                  if (picked) return;
                }
                triggerNativeFilePicker("profileImageInput");
              }}
              className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium w-full"
            >
              <Upload className="w-4.5 h-4.5" />
              <span>{step2.profileImage ? "Change photo" : "Choose file"}</span>
            </button>
            {isFlutterInAppWebViewAvailable() && (
              <button
                type="button"
                onClick={async () => {
                  await captureSingleImageFromCamera(image => setStep2(prev => ({
                    ...prev,
                    profileImage: image
                  })), `restaurant-profile-${Date.now()}.jpg`);
                }}
                className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-blue-600 text-white border border-blue-600 text-xs font-medium w-full"
              >
                <span>Take photo</span>
              </button>
            )}
            <input id="profileImageInput" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async e => {
              const file = e.target.files?.[0] || null;
              if (file) {
                await handleSingleImageChange(image => setStep2(prev => ({
                  ...prev,
                  profileImage: image
                })), file);
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
            nameOnPan: normalizeAlphabeticText(e.target.value)
          })} className="mt-1 bg-white text-sm text-black placeholder:text-gray-400" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-700">PAN image*</Label>
        {step3.panImage && (
          <div className="mt-2 mb-2 flex items-center gap-3">
            <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
              {getImagePreviewUrl(step3.panImage) ? (
                <img src={getImagePreviewUrl(step3.panImage)} alt="PAN preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">Preview</div>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate">
              {step3.panImage?.name || "PAN image selected"}
            </p>
          </div>
        )}
        {isFlutterInAppWebViewAvailable() && (
          <button
            type="button"
            onClick={async () => {
              await captureSingleImageFromCamera(image => setStep3(prev => ({
                ...prev,
                panImage: image
              })), `pan-image-${Date.now()}.jpg`);
            }}
            className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-blue-600 text-white border border-blue-600 text-xs font-medium w-full"
          >
            <span>Take photo</span>
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            if (isFlutterInAppWebViewAvailable()) {
              const picked = await captureSingleImageFromGallery(image => setStep3(prev => ({
                ...prev,
                panImage: image
              })), `pan-image-${Date.now()}.jpg`);
              if (picked) return;
            }
            triggerNativeFilePicker("panImageInput");
          }}
          className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium w-full"
        >
          <Upload className="w-4.5 h-4.5" />
          <span>{step3.panImage ? "Change file" : "Choose file"}</span>
        </button>
        <input id="panImageInput" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async e => {
          const file = e.target.files?.[0] || null;
          if (file) {
            await handleSingleImageChange(image => setStep3(prev => ({
              ...prev,
              panImage: image
            })), file);
          }
          e.target.value = '';
        }} />
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
            gstLegalName: normalizeAlphabeticText(e.target.value)
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
          {step3.gstImage && (
            <div className="mt-2 mb-2 flex items-center gap-3">
              <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                {getImagePreviewUrl(step3.gstImage) ? (
                  <img src={getImagePreviewUrl(step3.gstImage)} alt="GST preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">Preview</div>
                )}
              </div>
              <p className="text-xs text-gray-600 truncate">
                {step3.gstImage?.name || "GST image selected"}
              </p>
          </div>
        )}
          {isFlutterInAppWebViewAvailable() && (
            <button
              type="button"
              onClick={async () => {
                await captureSingleImageFromCamera(image => setStep3(prev => ({
                  ...prev,
                  gstImage: image
                })), `gst-image-${Date.now()}.jpg`);
              }}
              className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-blue-600 text-white border border-blue-600 text-xs font-medium w-full"
            >
              <span>Take photo</span>
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              if (isFlutterInAppWebViewAvailable()) {
                const picked = await captureSingleImageFromGallery(image => setStep3(prev => ({
                  ...prev,
                  gstImage: image
                })), `gst-image-${Date.now()}.jpg`);
                if (picked) return;
              }
              triggerNativeFilePicker("gstImageInput");
            }}
            className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium w-full"
          >
            <Upload className="w-4.5 h-4.5" />
            <span>{step3.gstImage ? "Change file" : "Choose file"}</span>
          </button>
          <input id="gstImageInput" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async e => {
            const file = e.target.files?.[0] || null;
            if (file) {
              await handleSingleImageChange(image => setStep3(prev => ({
                ...prev,
                gstImage: image
              })), file);
            }
            e.target.value = '';
          }} />
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
          <Popover open={isFssaiCalendarOpen} onOpenChange={setIsFssaiCalendarOpen}>
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
                    // Use local date parts to avoid timezone shift (previous-day bug).
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");
                    const formattedDate = `${year}-${month}-${day}`;
                    setStep3({
                      ...step3,
                      fssaiExpiry: formattedDate
                    });
                    setIsFssaiCalendarOpen(false);
                  }
                }} initialFocus className="rounded-md border border-gray-200" />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-700">FSSAI license image*</Label>
        {step3.fssaiImage && (
          <div className="mt-2 mb-2 flex items-center gap-3">
            <div className="h-16 w-16 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
              {getImagePreviewUrl(step3.fssaiImage) ? (
                <img src={getImagePreviewUrl(step3.fssaiImage)} alt="FSSAI preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">Preview</div>
              )}
            </div>
            <p className="text-xs text-gray-600 truncate">
              {step3.fssaiImage?.name || "FSSAI image selected"}
            </p>
          </div>
        )}
        {isFlutterInAppWebViewAvailable() && (
          <button
            type="button"
            onClick={async () => {
              await captureSingleImageFromCamera(image => setStep3(prev => ({
                ...prev,
                fssaiImage: image
              })), `fssai-image-${Date.now()}.jpg`);
            }}
            className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-blue-600 text-white border border-blue-600 text-xs font-medium w-full"
          >
            <span>Take photo</span>
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            if (isFlutterInAppWebViewAvailable()) {
              const picked = await captureSingleImageFromGallery(image => setStep3(prev => ({
                ...prev,
                fssaiImage: image
              })), `fssai-image-${Date.now()}.jpg`);
              if (picked) return;
            }
            triggerNativeFilePicker("fssaiImageInput");
          }}
          className="mt-1 inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border border-black text-xs font-medium w-full"
        >
          <Upload className="w-4.5 h-4.5" />
          <span>{step3.fssaiImage ? "Change file" : "Choose file"}</span>
        </button>
        <input id="fssaiImageInput" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async e => {
          const file = e.target.files?.[0] || null;
          if (file) {
            await handleSingleImageChange(image => setStep3(prev => ({
              ...prev,
              fssaiImage: image
            })), file);
          }
          e.target.value = '';
        }} />
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
  // Step 4 removed (display fields no longer required)
  const renderStep = () => {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    if (step === 3) return renderStep3();
    return renderStep3();
  };
  return <LocalizationProvider dateAdapter={AdapterDateFns}>
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="text-sm font-semibold text-blue-600">Restaurant onboarding</div>
        <div className="flex items-center gap-3">

          <div className="text-xs text-gray-600">
            Step {step} of 3
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
          <Button variant="ghost" disabled={saving} onClick={handleBack} className="text-sm text-gray-700 bg-transparent">
            Back
          </Button>
          <Button onClick={handleNext} disabled={saving} className="text-sm bg-blue-600 text-white px-6 hover:bg-blue-700">
            {step === 3 ? saving ? "Saving..." : "Finish" : saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </footer>

    </div>
  </LocalizationProvider>;
}
