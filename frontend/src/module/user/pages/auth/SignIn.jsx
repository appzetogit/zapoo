  import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Phone, AlertCircle, Loader2 } from "lucide-react";
import AnimatedPage from "../../components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { authAPI } from "@/lib/api";
import { firebaseAuth, googleProvider, ensureFirebaseInitialized } from "@/lib/firebase";
import { setAuthData } from "@/lib/utils/auth";
import loginBanner from "@/assets/loginbanner.png";
import { useTranslation } from "react-i18next";

const GOOGLE_REDIRECT_PENDING_KEY = "user_google_redirect_pending";

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSignUp = searchParams.get("mode") === "signup";
  const [authMethod, setAuthMethod] = useState("phone"); // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
    name: "",
    rememberMe: false
  });
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
    name: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const redirectHandledRef = useRef(false);

  // Helper function to process signed-in user
  const processSignedInUser = async (user, source = "unknown") => {
    if (redirectHandledRef.current) {
      return;
    }
    redirectHandledRef.current = true;
    setIsLoading(true);
    setApiError("");
    try {
      const idToken = await user.getIdToken();
      const response = await authAPI.firebaseGoogleLogin(idToken, "user");
      const data = response?.data?.data || {};
      if (data?.needsOtpRegistration && data?.email) {
        await authAPI.sendOTP(null, "login", data.email);
        sessionStorage.setItem("userAuthData", JSON.stringify({
          method: "email",
          email: data.email,
          isSignUp: false,
          module: "user"
        }));
        navigate("/user/auth/otp", { replace: true });
        return;
      }

      const accessToken = data.accessToken;
      const appUser = data.user;
      if (accessToken && appUser) {
        setAuthData("user", accessToken, appUser);
        window.dispatchEvent(new Event("userAuthChanged"));

        // Clear any URL hash or params
        const hasHash = window.location.hash.length > 0;
        const hasQueryParams = window.location.search.length > 0;
        if (hasHash || hasQueryParams) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        navigate("/user", {
          replace: true
        });
      } else {
        console.error(`❌ Invalid backend response from ${source}`);
        redirectHandledRef.current = false;
        setIsLoading(false);
        setApiError(t("user.auth.signIn.errors.invalidServerResponse"));
      }
    } catch (error) {
      console.error(`❌ Error processing user from ${source}:`, error);
      console.error("Error details:", {
        code: error?.code,
        message: error?.message,
        response: error?.response?.data
      });
      redirectHandledRef.current = false;
      setIsLoading(false);
      let errorMessage = t("user.auth.signIn.errors.failedToCompleteSignIn");
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      setApiError(errorMessage);
    }
  };

  // Handle Firebase redirect result on component mount and URL changes
  useEffect(() => {
    const isRedirectPending =
      typeof window !== "undefined" &&
      sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === "1";

    // Don't auto-login from stale Firebase session unless a redirect flow is in progress.
    if (!isRedirectPending) {
      setIsLoading(false);
      return;
    }

    // Prevent multiple calls
    if (redirectHandledRef.current) {
      return;
    }
    const handleRedirectResult = async () => {
      try {
        // Check if we're coming back from a redirect (URL might have hash or params)
        const currentUrl = window.location.href;
        const hasHash = window.location.hash.length > 0;
        const hasQueryParams = window.location.search.length > 0;
        const {
          getRedirectResult,
          onAuthStateChanged
        } = await import("firebase/auth");

        // Ensure Firebase is initialized
        ensureFirebaseInitialized();

        // Check current user immediately (before getRedirectResult)
        const immediateUser = firebaseAuth.currentUser;
        // First, try to get redirect result (non-blocking with timeout)
        // Note: getRedirectResult returns null if there's no redirect result (normal on first load)
        // We use a short timeout to avoid hanging, and rely on auth state listener as primary method
        let result = null;
        try {
          // Use a short timeout (3 seconds) - if it hangs, auth state listener will handle it
          result = await Promise.race([getRedirectResult(firebaseAuth), new Promise(resolve => setTimeout(() => {
            resolve(null);
          }, 3000))]);
          if (result !== null) { } else { }
        } catch (redirectError) {
          // Don't throw - auth state listener will handle sign-in
          result = null;
        }
        if (result && result.user) {
          // Process redirect result
          await processSignedInUser(result.user, "redirect-result");
          sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
        } else {
          // No redirect result - check if user is already signed in
          const currentUser = firebaseAuth.currentUser;
          if (currentUser && !redirectHandledRef.current) {
            // Process current user
            await processSignedInUser(currentUser, "current-user-check");
            sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
          } else {
            // No redirect result - this is normal on first load

            sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("❌ Google sign-in redirect error:", error);
        console.error("Error details:", {
          code: error?.code,
          message: error?.message,
          stack: error?.stack
        });
        redirectHandledRef.current = false;

        // Show error to user
        const errorCode = error?.code || "";
        const errorMessage = error?.message || "";

        // Don't show error for "no redirect result" - this is normal when page first loads
        if (errorCode === "auth/no-auth-event" || errorCode === "auth/popup-closed-by-user") {
          // These are expected cases, don't show error

          sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
          setIsLoading(false);
          return;
        }

        // Handle backend errors (500, etc.)
        let message = t("user.auth.signIn.errors.googleSignInFailed");
        if (error?.response) {
          // Axios error with response
          const status = error.response.status;
          const responseData = error.response.data || {};
          if (status === 500) {
            message = responseData.message || responseData.error || t("user.auth.signIn.errors.serverError");
          } else if (status === 400 || status === 401) {
            message = responseData.message || responseData.error || t("user.auth.signIn.errors.authenticationFailed");
          } else {
            message = responseData.message || responseData.error || errorMessage || message;
          }
        } else if (errorMessage) {
          message = errorMessage;
        } else if (errorCode) {
          // Firebase auth error codes
          if (errorCode === "auth/network-request-failed") {
            message = t("user.auth.signIn.errors.networkError");
          } else if (errorCode === "auth/invalid-credential") {
            message = t("user.auth.signIn.errors.invalidCredentials");
          } else {
            message = errorMessage || message;
          }
        }
        setApiError(message);
        sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
        setIsLoading(false);
      }
    };

    // Helper function to process signed-in user
    const processSignedInUser = async (user, source = "unknown") => {
      if (redirectHandledRef.current) {
        return;
      }
      redirectHandledRef.current = true;
      setIsLoading(true);
      setApiError("");
      try {
        const idToken = await user.getIdToken();
        const response = await authAPI.firebaseGoogleLogin(idToken, "user");
        const data = response?.data?.data || {};
        const accessToken = data.accessToken;
        const appUser = data.user;
        if (accessToken && appUser) {
          setAuthData("user", accessToken, appUser);
          window.dispatchEvent(new Event("userAuthChanged"));

          // Clear any URL hash or params
          const hasHash = window.location.hash.length > 0;
          const hasQueryParams = window.location.search.length > 0;
          if (hasHash || hasQueryParams) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          navigate("/user", {
            replace: true
          });
        } else {
          console.error(`❌ Invalid backend response from ${source}`);
          redirectHandledRef.current = false;
          setIsLoading(false);
          setApiError(t("user.auth.signIn.errors.invalidServerResponse"));
        }
      } catch (error) {
        console.error(`❌ Error processing user from ${source}:`, error);
        console.error("Error details:", {
          code: error?.code,
          message: error?.message,
          response: error?.response?.data
        });
        redirectHandledRef.current = false;
        setIsLoading(false);
        let errorMessage = t("user.auth.signIn.errors.failedToCompleteSignIn");
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        setApiError(errorMessage);
      }
    };

    // Set up auth state listener FIRST (before getRedirectResult)
    // This ensures we catch auth state changes immediately
    let unsubscribe = null;
    const setupAuthListener = async () => {
      try {
        const {
          onAuthStateChanged
        } = await import("firebase/auth");
        ensureFirebaseInitialized();
        unsubscribe = onAuthStateChanged(firebaseAuth, async user => {
          // If user signed in and we haven't handled it yet
          if (user && !redirectHandledRef.current) {
            await processSignedInUser(user, "auth-state-listener");
          } else if (!user) {
            // User signed out

            redirectHandledRef.current = false;
          } else if (user && redirectHandledRef.current) { }
        });
      } catch (error) {
        console.error("❌ Error setting up auth state listener:", error);
      }
    };

    // Set up auth listener first, then check redirect result
    setupAuthListener();

    // Also check current user immediately (in case redirect already completed)
    const checkCurrentUser = async () => {
      try {
        ensureFirebaseInitialized();
        const currentUser = firebaseAuth.currentUser;
        if (currentUser && !redirectHandledRef.current) {
          await processSignedInUser(currentUser, "immediate-check");
        }
      } catch (error) {
        console.error("❌ Error checking current user:", error);
      }
    };

    // Check current user immediately
    checkCurrentUser();

    // Small delay to ensure Firebase is ready, then check redirect result
    const timer = setTimeout(() => {
      handleRedirectResult();
    }, 500);
    return () => {
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [navigate, searchParams, t]);

  const validateEmail = email => {
    if (!email.trim()) {
      return t("user.auth.signIn.validation.emailRequired");
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email.trim())) {
      return t("user.auth.signIn.validation.emailInvalid");
    }
    return "";
  };
  const validatePhone = phone => {
    if (!phone.trim()) {
      return t("user.auth.signIn.validation.phoneRequired");
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return t("user.auth.signIn.validation.phone10Digits");
    }
    return "";
  };
  const validateName = name => {
    if (!name.trim()) {
      return t("user.auth.signIn.validation.nameRequired");
    }
    if (name.trim().length < 2) {
      return t("user.auth.signIn.validation.nameMin");
    }
    if (name.trim().length > 50) {
      return t("user.auth.signIn.validation.nameMax");
    }
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(name.trim())) {
      return "Name can only contain letters and spaces";
    }
    return "";
  };

  // Handle changes for email/phone/name fields
const sanitizeNameInput = (value) => value.replace(/[^a-zA-Z\s]/g, "")

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // Allow only digits
      const cleaned = value.replace(/\D/g, "");
      // India-only flow: 10 digits max
      const maxLength = 10;
      const restrictedValue = cleaned.slice(0, maxLength);

      setFormData({
        ...formData,
        [name]: restrictedValue
      });
      setErrors({
        ...errors,
        phone: validatePhone(restrictedValue)
      });
    } else {
      const sanitizedValue = name === "name" ? sanitizeNameInput(value) : value
      setFormData({
        ...formData,
        [name]: sanitizedValue
      });

      // Real-time validation
      if (name === "email") {
        setErrors({
          ...errors,
          email: validateEmail(value)
        });
      } else if (name === "name") {
        setErrors({
          ...errors,
          name: validateName(sanitizedValue)
        });
      }
    }
  };

  // Backwards-compatible alias for existing JSX handlers
  const handleChange = handleInputChange;
  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true);
    setApiError("");

    // Validate based on auth method
    let hasErrors = false;
    const newErrors = {
      phone: "",
      email: "",
      name: ""
    };
    if (authMethod === "phone") {
      const phoneError = validatePhone(formData.phone);
      newErrors.phone = phoneError;
      if (phoneError) hasErrors = true;
    } else {
      const emailError = validateEmail(formData.email);
      newErrors.email = emailError;
      if (emailError) hasErrors = true;
    }

    // Validate name for sign up
    if (isSignUp) {
      const nameError = validateName(formData.name);
      newErrors.name = nameError;
      if (nameError) hasErrors = true;
    }
    setErrors(newErrors);
    if (hasErrors) {
      setIsLoading(false);
      return;
    }
    try {
      const purpose = isSignUp ? "register" : "login";
      const fullPhone = authMethod === "phone" ? `${formData.countryCode} ${formData.phone}`.trim() : null;
      const email = authMethod === "email" ? formData.email.trim() : null;

      // Call backend to send OTP
      await authAPI.sendOTP(fullPhone, purpose, email);

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: authMethod,
        phone: fullPhone,
        email: email,
        name: isSignUp ? formData.name.trim() : null,
        isSignUp,
        module: "user"
      };
      sessionStorage.setItem("userAuthData", JSON.stringify(authData));

      // Navigate to OTP page
      navigate("/user/auth/otp");
    } catch (error) {
      const response = error?.response?.data;
      if (response?.errors && Array.isArray(response.errors)) {
        const emailError = response.errors.find(err => err.field === 'email');
        if (emailError) {
          setErrors(prev => ({
            ...prev,
            email: t("user.auth.signIn.validation.emailInvalid")
          }));
          setApiError("");
          setIsLoading(false);
          return;
        }
      }
      const message = response?.message || response?.error || t("user.auth.signIn.errors.failedToSendOtp");
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setApiError("");
    setIsLoading(true);
    redirectHandledRef.current = false; // Reset flag when starting new sign-in

    try {
      // Ensure Firebase is initialized before use
      ensureFirebaseInitialized();

      // Validate Firebase Auth instance
      if (!firebaseAuth) {
        throw new Error(t("user.auth.signIn.errors.firebaseNotInitialized"));
      }

      const isFlutterBridgeAvailable =
        typeof window !== "undefined" &&
        window.flutter_inappwebview &&
        typeof window.flutter_inappwebview.callHandler === "function";

      if (isFlutterBridgeAvailable) {
        try {
          const result = await window.flutter_inappwebview.callHandler("nativeGoogleSignIn");

          if (result?.success && (result.idToken || result.accessToken)) {
            const response = await authAPI.googleNativeLogin({
              idToken: result.idToken || null,
              accessToken: result.accessToken || null,
              role: "user",
            });

            const data = response?.data?.data || {};
            if (data?.needsOtpRegistration && data?.email) {
              await authAPI.sendOTP(null, "login", data.email);
              sessionStorage.setItem("userAuthData", JSON.stringify({
                method: "email",
                email: data.email,
                isSignUp: false,
                module: "user"
              }));
              navigate("/user/auth/otp", { replace: true });
              return;
            }

            if (data.accessToken && data.user) {
              setAuthData("user", data.accessToken, data.user);
              window.dispatchEvent(new Event("userAuthChanged"));
              if (window.location.hash.length > 0 || window.location.search.length > 0) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              navigate("/user", { replace: true });
              return;
            }
            throw new Error("Native Google login completed but backend response was invalid.");
          }

          if (result?.success === false) {
            setIsLoading(false);
            setApiError("Google sign-in was cancelled.");
            return;
          }

          throw new Error("Flutter Google sign-in did not return a valid token.");
        } catch (bridgeError) {
          console.error("Flutter Google sign-in bridge error:", bridgeError);
          setIsLoading(false);
          setApiError(bridgeError?.message || "Flutter Google sign-in failed. Please try again.");
          return;
        }
      }

      const {
        signInWithPopup,
        signInWithRedirect
      } = await import("firebase/auth");
      const providerWithPrompt = googleProvider;
      providerWithPrompt.setCustomParameters({
        prompt: "select_account"
      });

      // Prefer popup flow on desktop (more reliable than redirect result races).
      // Keep redirect as fallback when popup is blocked.
      const result = await signInWithPopup(firebaseAuth, providerWithPrompt);
      if (result?.user) {
        await processSignedInUser(result.user, "popup");
        return;
      }

      // Extremely rare fallback: if popup returns no user, try redirect.
      sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
      await signInWithRedirect(firebaseAuth, providerWithPrompt);
    } catch (error) {
      // If popup was blocked/cancelled by browser policy, fallback to redirect.
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        try {
          const {
            signInWithRedirect
          } = await import("firebase/auth");
          const providerWithPrompt = googleProvider;
          providerWithPrompt.setCustomParameters({
            prompt: "select_account"
          });
          sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
          await signInWithRedirect(firebaseAuth, providerWithPrompt);
          return;
        } catch (redirectError) {
          error = redirectError;
        }
      }

      console.error("❌ Google sign-in redirect error:", error);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
      setIsLoading(false);
      redirectHandledRef.current = false;
      const errorCode = error?.code || "";
      const errorMessage = error?.message || "";
      let message = t("user.auth.signIn.errors.googleSignInFailed");
      if (errorCode === "auth/configuration-not-found") {
        message = t("user.auth.signIn.errors.firebaseConfiguration", {
          domain: window.location.hostname
        });
      } else if (errorCode === "auth/popup-blocked") {
        message = t("user.auth.signIn.errors.popupBlocked");
      } else if (errorCode === "auth/popup-closed-by-user") {
        message = t("user.auth.signIn.errors.signInCancelled");
      } else if (errorCode === "auth/network-request-failed") {
        message = t("user.auth.signIn.errors.networkError");
      } else if (errorMessage) {
        message = errorMessage;
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.error) {
        message = error.response.data.error;
      }
      setApiError(message);
      sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    }
  };
  const toggleMode = () => {
    const newMode = isSignUp ? "signin" : "signup";
    navigate(`/user/auth/sign-in?mode=${newMode}`, {
      replace: true
    });
    // Reset form
    setFormData({
      phone: "",
      countryCode: "+91",
      email: "",
      name: "",
      rememberMe: false
    });
    setErrors({
      phone: "",
      email: "",
      name: ""
    });
  };
  const handleLoginMethodChange = () => {
    setAuthMethod(authMethod === "email" ? "phone" : "email");
  };
  return <AnimatedPage className="max-h-screen flex flex-col bg-white dark:bg-[#0a0a0a] overflow-hidden !pb-0 md:flex-row md:overflow-hidden">

    {/* Mobile: Top Section - Banner Image */}
    {/* Desktop: Left Section - Banner Image */}
    <div className="relative md:hidden w-full shrink-0" style={{
      height: "45vh",
      minHeight: "300px"
    }}>
      <img src={loginBanner} alt={t("user.auth.signIn.bannerAlt")} className="w-full h-full object-cover object-center" />
    </div>

    <div className="relative hidden md:block w-full shrink-0 md:w-1/2 md:h-screen md:sticky md:top-0">
      <img src={loginBanner} alt={t("user.auth.signIn.bannerAlt")} className="w-full h-full object-cover object-center" />
      {/* Overlay gradient for better text readability on desktop */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
    </div>

    {/* Mobile: Bottom Section - White Login Form */}
    {/* Desktop: Right Section - Login Form */}
    <div className="bg-white dark:bg-[#1a1a1a] p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 overflow-y-auto md:w-1/2 md:flex md:items-center md:justify-center md:h-screen">
      <div className="max-w-md lg:max-w-lg xl:max-w-xl mx-auto space-y-6 md:space-y-8 lg:space-y-10 w-full">
        {/* Heading */}
        <div className="text-center space-y-2 md:space-y-3">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-white leading-tight">
            {t("user.auth.signIn.title")}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400">
            {t("user.auth.signIn.subtitle")}
          </p>
        </div>

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {/* Name field for sign up - hidden by default, shown only when needed */}
          {isSignUp && <div className="space-y-2">
            <Input id="name" name="name" placeholder={t("user.auth.signIn.placeholders.fullName")} value={formData.name} onChange={handleChange} className={`text-base md:text-lg h-12 md:h-14 bg-white dark:bg-[#1a1a1a] text-black dark:text-white ${errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-700"} transition-colors`} aria-invalid={errors.name ? "true" : "false"} />
            {errors.name && <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{errors.name}</span>
            </div>}
          </div>}

          {/* Phone Number Input */}
          {authMethod === "phone" && <div className="space-y-2">
            <div className="flex gap-2 items-stretch">
              <div className="w-[100px] md:w-[120px] !h-12 md:!h-14 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-black dark:text-white rounded-lg flex items-center justify-center text-sm md:text-base font-medium">
                +91
              </div>
              <Input id="phone" name="phone" type="tel" placeholder={t("user.auth.signIn.placeholders.phoneNumber")} value={formData.phone} onChange={handleChange} className={`flex-1 h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.phone ? "border-red-500" : ""} transition-colors`} aria-invalid={errors.phone ? "true" : "false"} />
            </div>
            {errors.phone && <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{errors.phone}</span>
            </div>}
            {apiError && authMethod === "phone" && <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{apiError}</span>
            </div>}
          </div>}

          {/* Email Input */}
          {authMethod === "email" && <div className="space-y-2">
            <Input id="email" name="email" type="email" placeholder={t("user.auth.signIn.placeholders.email")} value={formData.email} onChange={handleChange} className={`w-full h-12 md:h-14 text-base md:text-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-white border-gray-300 dark:border-gray-700 rounded-lg ${errors.email ? "border-red-500" : ""} transition-colors`} aria-invalid={errors.email ? "true" : "false"} />
            {errors.email && <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{errors.email}</span>
            </div>}
            {apiError && authMethod === "email" && <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{apiError}</span>
            </div>}
            <button type="button" onClick={() => {
              setAuthMethod("phone");
              setApiError("");
            }} className="text-xs text-[#E23744] hover:underline text-left">
              {t("user.auth.signIn.usePhoneInstead")}
            </button>
          </div>}

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox id="rememberMe" checked={formData.rememberMe} onCheckedChange={checked => setFormData({
              ...formData,
              rememberMe: checked
            })} className="w-4 h-4 border-2 border-gray-300 rounded data-[state=checked]:bg-[#E23744] data-[state=checked]:border-[#E23744] flex items-center justify-center" />
            <label htmlFor="rememberMe" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              {t("user.auth.signIn.rememberMe")}
            </label>
          </div>

          {/* Continue Button */}
          <Button type="submit" className="w-full h-12 md:h-14 bg-[#D32F2F] hover:bg-[#b71c1c] text-white font-bold text-base md:text-lg rounded-lg transition-all hover:shadow-lg active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isSignUp ? t("user.auth.signIn.creatingAccount") : t("user.auth.signIn.signingIn")}
            </> : t("user.auth.signIn.continue")}
          </Button>
        </form>

        {/* Or Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-[#1a1a1a] px-2 text-sm text-gray-500 dark:text-gray-400">
              {t("user.auth.signIn.or")}
            </span>
          </div>
        </div>

        {/* Social Login Icons */}
        <div className="flex justify-center gap-4 md:gap-6">
          {/* Google Login */}
          <button type="button" onClick={handleGoogleSignIn} className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:shadow-md active:scale-95" aria-label={t("user.auth.signIn.signInWithGoogle")}>
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </button>

          {/* Email Login */}
          <button type="button" onClick={handleLoginMethodChange} className="w-12 h-12 md:w-14 md:h-14 rounded-full border border-[#E23744] flex items-center justify-center hover:bg-[#d32f3d] transition-all hover:shadow-md active:scale-95 bg-[#E23744]" aria-label={t("user.auth.signIn.signInWithEmail")}>
            {authMethod == "phone" ? <Mail className="h-5 w-5 md:h-6 md:w-6 text-white" /> : <Phone className="h-5 w-5 md:h-6 md:w-6 text-white" />}
          </button>
        </div>

        {/* Legal Disclaimer */}
        <div className="text-center text-xs md:text-sm text-gray-500 dark:text-gray-400 pt-4 md:pt-6">
          <p className="mb-1 md:mb-2">
            {t("user.auth.signIn.disclaimer")}
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Link to="/profile/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{t("user.auth.signIn.termsOfService")}</Link>
            <span>•</span>
            <Link to="/profile/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{t("user.auth.signIn.privacyPolicy")}</Link>
            <span>•</span>
            <Link to="/support" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Support</Link>
            <span>•</span>
            <Link to="/profile/content-policy" className="underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{t("user.auth.signIn.contentPolicy")}</Link>
          </div>
        </div>
      </div>
    </div>
  </AnimatedPage>;
}
