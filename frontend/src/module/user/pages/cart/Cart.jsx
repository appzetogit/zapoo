import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Percent, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import AnimatedPage from "../../components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "../../context/CartContext";
import { useProfile } from "../../context/ProfileContext";
import { useOrders } from "../../context/OrdersContext";
import { useLocation as useUserLocation } from "../../hooks/useLocation";
import { useZone } from "../../hooks/useZone";
import { orderAPI, restaurantAPI, adminAPI, userAPI, API_ENDPOINTS } from "@/lib/api";
import { useLocationSelector } from "../../components/UserLayout";
import { API_BASE_URL } from "@/lib/api/config";
import { initRazorpayPayment } from "@/lib/utils/razorpay";
import GstBreakdownDialog from "../../components/GstBreakdownDialog";
import { toast } from "sonner";
import { getCompanyNameAsync } from "@/lib/utils/businessSettings";
import { handleShare } from "@/lib/utils/share";
import DynamicEtaText from "../../components/DynamicEtaText";
import { useTranslation } from "react-i18next";

// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address, locationPlaceholder = "Select location") => {
  if (!address) return "";

  const isLocationPlaceholder = value => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return true;
    return normalized === "select location" || normalized === String(locationPlaceholder || "").trim().toLowerCase();
  };

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && !isLocationPlaceholder(address.formattedAddress)) {
    return address.formattedAddress;
  }

  // Priority 2: Build address from parts
  const addressParts = [];
  if (address.street) addressParts.push(address.street);
  if (address.additionalDetails) addressParts.push(address.additionalDetails);
  if (address.city) addressParts.push(address.city);
  if (address.state) addressParts.push(address.state);
  if (address.zipCode) addressParts.push(address.zipCode);
  if (addressParts.length > 0) {
    return addressParts.join(', ');
  }

  // Priority 3: Use address field if available
  if (address.address && !isLocationPlaceholder(address.address)) {
    return address.address;
  }
  return "";
};

/** Align with backend: coords as [lng, lat], also accept root-level lat/lng from saved addresses */
const normalizeDeliveryAddressForOrder = address => {
  if (!address || typeof address !== "object") return address;
  const copy = {
    ...address
  };
  let lng;
  let lat;
  const loc = copy.location;
  if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
    lng = Number(loc.coordinates[0]);
    lat = Number(loc.coordinates[1]);
  } else if (loc?.longitude != null && loc?.latitude != null) {
    lng = Number(loc.longitude);
    lat = Number(loc.latitude);
  } else if (copy.longitude != null && copy.latitude != null) {
    lng = Number(copy.longitude);
    lat = Number(copy.latitude);
  }
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    copy.location = {
      ...(typeof loc === "object" && loc ? loc : {}),
      type: loc?.type || "Point",
      coordinates: [lng, lat],
      longitude: lng,
      latitude: lat
    };
  }
  return copy;
};

const normalizeIndianPhoneForOrder = (phone = "") => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-10);
};

const isRestaurantCustomDeliveryPricingEnabled = restaurant => {
  const v = restaurant?.deliveryPricingConfig?.isEnabled;
  return v === true || v === "true" || v === 1 || v === "1";
};

const normalizeCouponSource = source => source === "admin" ? "admin" : "restaurant";

const getCouponIdentity = coupon => {
  if (!coupon?.code) return "";
  return `${normalizeCouponSource(coupon?.source)}:${String(coupon.code).trim().toUpperCase()}`;
};

const formatOrderEtaText = (order, fallbackText = "25-30 mins") => {
  if (!order || typeof order !== "object") return fallbackText;

  const formatted = String(order?.eta?.formatted || "").trim();
  if (formatted) return formatted;

  const etaMin = Number(order?.eta?.min);
  const etaMax = Number(order?.eta?.max);
  if (Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
    return `${etaMin}-${etaMax} mins`;
  }

  const estimatedDeliveryTime = Number(order?.estimatedDeliveryTime);
  if (Number.isFinite(estimatedDeliveryTime) && estimatedDeliveryTime > 0) {
    return `${estimatedDeliveryTime} mins`;
  }

  return fallbackText;
};

export default function Cart() {
  const { t } = useTranslation();
  const locationPlaceholderText = t("user.locationDisplay.selectLocation");
  const navigate = useNavigate();

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    console.error('❌ CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    // Return early with error message
    return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t("user.cart.error.title")}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t("user.cart.error.description")}
          </p>
          <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            {t("user.cart.error.goHome")}
          </button>
        </div>
      </div>;
  }
  const {
    cart,
    updateQuantity,
    addToCart,
    getCartCount,
    clearCart,
    cleanCartForRestaurant
  } = cartContext;
  const {
    getDefaultAddress,
    getDefaultPaymentMethod,
    addresses,
    paymentMethods,
    userProfile,
    vegMode
  } = useProfile();
  const {
    createOrder
  } = useOrders();
  const {
    location: currentLocation
  } = useUserLocation(); // Get live location address
  const {
    zoneId
  } = useZone(currentLocation); // Get user's zone

  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("razorpay"); // razorpay | cash | wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [deliveryFleet] = useState("standard");
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [sendCutlery, setSendCutlery] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showPlacingOrder, setShowPlacingOrder] = useState(false);
  const [orderProgress, setOrderProgress] = useState(0);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [placedOrderEtaText, setPlacedOrderEtaText] = useState("");
  const [showGstBreakdown, setShowGstBreakdown] = useState(false);
  const [showContactEditor, setShowContactEditor] = useState(false);
  const [orderContactName, setOrderContactName] = useState("");
  const [orderContactPhone, setOrderContactPhone] = useState("");
  const {
    openLocationSelector
  } = useLocationSelector();

  // Restaurant and pricing state
  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Addons state
  const [addons, setAddons] = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [availableAdminCoupons, setAvailableAdminCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Fee settings from database (used as fallback if pricing not available)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5
  });
  // Use backend pricing if available, otherwise fallback to database settings
  const subtotalForCoupons = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const customDeliveryOnForCoupons = isRestaurantCustomDeliveryPricingEnabled(restaurantData);
  const hasApiDeliveryFeeForCoupons = pricing != null && pricing.deliveryFee != null && Number.isFinite(Number(pricing.deliveryFee));
  let deliveryFeeForCoupons;
  if (hasApiDeliveryFeeForCoupons) {
    deliveryFeeForCoupons = Number(pricing.deliveryFee);
  } else if (appliedCoupon?.freeDelivery) {
    deliveryFeeForCoupons = 0;
  } else if (customDeliveryOnForCoupons) {
    // Do not use global free-delivery threshold for slab pricing â€” avoids false "FREE" when API is slow/errors
    deliveryFeeForCoupons = loadingPricing && !pricing ? null : Number(feeSettings.deliveryFee);
  } else if (subtotalForCoupons >= feeSettings.freeDeliveryThreshold) {
    deliveryFeeForCoupons = 0;
  } else {
    deliveryFeeForCoupons = Number(feeSettings.deliveryFee);
  }
  const deliveryFeeForTotalsForCoupons = deliveryFeeForCoupons != null ? deliveryFeeForCoupons : Number(feeSettings.deliveryFee);
  const platformFeeForCoupons = pricing?.platformFee ?? feeSettings.platformFee;
  const discountForCoupons = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotalForCoupons * 0.5) : 0);
  const taxableFoodAmountForCoupons = Math.max(subtotalForCoupons - discountForCoupons, 0);
  const gstChargesForCoupons = pricing?.tax ?? Math.round(((taxableFoodAmountForCoupons * 0.05) + (deliveryFeeForTotalsForCoupons * 0.18) + (platformFeeForCoupons * 0.18)) * 100) / 100;
  const totalBeforeDiscountForCoupons = subtotalForCoupons + deliveryFeeForTotalsForCoupons + platformFeeForCoupons + gstChargesForCoupons;
  const totalForCoupons = pricing?.total || totalBeforeDiscountForCoupons - discountForCoupons;
  const savingsForCoupons = pricing?.savings || discountForCoupons + (subtotalForCoupons > 500 ? 32 : 0);
  const cartCount = getCartCount();
  const savedAddress = getDefaultAddress();
  // Priority: Use live location if available, otherwise use saved address; always normalize coords for pricing API
  const defaultAddress = useMemo(() => {
    const normalizedCurrentFormatted = String(currentLocation?.formattedAddress || "").trim().toLowerCase();
    const normalizedPlaceholder = String(locationPlaceholderText || "").trim().toLowerCase();
    const hasLiveFormattedAddress = !!currentLocation?.formattedAddress && normalizedCurrentFormatted !== "select location" && normalizedCurrentFormatted !== normalizedPlaceholder;
    const merged = hasLiveFormattedAddress ? {
      ...savedAddress,
      formattedAddress: currentLocation.formattedAddress,
      address: currentLocation.address || currentLocation.formattedAddress,
      street: currentLocation.street || currentLocation.address,
      city: currentLocation.city,
      state: currentLocation.state,
      zipCode: currentLocation.postalCode,
      location: currentLocation.latitude && currentLocation.longitude ? {
        coordinates: [Number(currentLocation.longitude), Number(currentLocation.latitude)]
      } : savedAddress?.location
    } : savedAddress;
    return normalizeDeliveryAddressForOrder(merged);
  }, [savedAddress, currentLocation, locationPlaceholderText]);
  const defaultPayment = getDefaultPaymentMethod();

  useEffect(() => {
    setOrderContactName(prev => prev || userProfile?.name || "");
    setOrderContactPhone(prev => {
      if (prev) return prev;
      const fallbackPhone = userProfile?.phone || savedAddress?.phone || "";
      return normalizeIndianPhoneForOrder(fallbackPhone);
    });
  }, [savedAddress?.phone, userProfile?.name, userProfile?.phone]);
  const paymentOptions = [{
    value: "razorpay",
    label: t("user.cart.paymentOptions.razorpay.label"),
    description: t("user.cart.paymentOptions.razorpay.description"),
    accent: "bg-blue-600 text-white"
  }, {
    value: "wallet",
    label: t("user.cart.paymentOptions.wallet.label"),
    description: walletBalance > 0 ? t("user.cart.paymentOptions.wallet.balanceAvailable", { amount: walletBalance.toFixed(0) }) : t("user.cart.paymentOptions.wallet.description"),
    accent: "bg-emerald-100 text-emerald-700"
  }, {
    value: "cash",
    label: t("user.cart.paymentOptions.cash.label"),
    description: t("user.cart.paymentOptions.cash.description"),
    accent: "bg-orange-100 text-orange-700"
  }];
  const selectedPaymentOption = paymentOptions.find(option => option.value === selectedPaymentMethod) || paymentOptions[0];

  // Get restaurant ID from cart or restaurant data
  // Priority: restaurantData > cart[0].restaurantId
  // DO NOT use cart[0].restaurant as slug fallback - it creates wrong slugs
  const restaurantId = cart.length > 0 ? restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null : null;
  const etaItems = useMemo(() => {
    return (cart || []).map((it) => ({ itemId: it.itemId, quantity: it.quantity }));
  }, [cart]);

  // Stable restaurant ID for addons fetch (memoized to prevent dependency array issues)
  // Prefer restaurantData IDs (more reliable) over slug from cart
  const restaurantIdForAddons = useMemo(() => {
    // Only use restaurantData if it's loaded, otherwise wait
    if (restaurantData) {
      return restaurantData._id || restaurantData.restaurantId || null;
    }
    // If restaurantData is not loaded yet, return null to wait
    return null;
  }, [restaurantData]);

  const effectiveVegMode = useMemo(() => {
    if (vegMode === true) return true;
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userVegMode") === "true";
  }, [vegMode]);

  const isVegAddon = useCallback((addon) => {
    const normalizedFoodType = String(addon?.foodType || "").trim().toLowerCase();
    if (normalizedFoodType) {
      if (
        normalizedFoodType.includes("non") ||
        normalizedFoodType.includes("egg")
      ) {
        return false;
      }
      return normalizedFoodType === "veg" || normalizedFoodType === "vegetarian";
    }
    return addon?.isVeg === true;
  }, []);

  const filteredAddons = useMemo(() => {
    if (!Array.isArray(addons)) return [];
    if (!effectiveVegMode) return addons;

    return addons.filter(isVegAddon);
  }, [addons, effectiveVegMode, isVegAddon]);

  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;

      // Scroll window to top
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [showPlacingOrder, showOrderSuccess]);

  // Fetch restaurant data when cart has items
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (cart.length === 0) {
        setRestaurantData(null);
        return;
      }

      // If we already have restaurantData, don't fetch again
      if (restaurantData) {
        return;
      }
      setLoadingRestaurant(true);

      // Strategy 1: Try using restaurantId from cart if available
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const cartRestaurantName = cart[0].restaurant;
          const response = await restaurantAPI.getRestaurantById(cartRestaurantId);
          const data = response?.data?.data?.restaurant || response?.data?.restaurant;
          if (data) {
            // CRITICAL: Validate that fetched restaurant matches cart items
            const fetchedRestaurantId = data.restaurantId || data._id?.toString();
            const fetchedRestaurantName = data.name;

            // Check if restaurantId matches
            const restaurantIdMatches = fetchedRestaurantId === cartRestaurantId || data._id?.toString() === cartRestaurantId || data.restaurantId === cartRestaurantId;

            // Check if restaurant name matches (if available in cart)
            const restaurantNameMatches = !cartRestaurantName || fetchedRestaurantName?.toLowerCase().trim() === cartRestaurantName.toLowerCase().trim();
            if (!restaurantIdMatches) {
              console.error('❌ CRITICAL: Fetched restaurant ID does not match cart restaurantId!', {
                cartRestaurantId: cartRestaurantId,
                fetchedRestaurantId: fetchedRestaurantId,
                fetched_id: data._id?.toString(),
                fetched_restaurantId: data.restaurantId,
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Don't set restaurantData if IDs don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }
            if (!restaurantNameMatches) {
              console.warn('⚠️ WARNING: Restaurant name mismatch:', {
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Still proceed but log warning
            }
            setRestaurantData(data);
            setLoadingRestaurant(false);
            return;
          }
        } catch (error) {
          console.warn("⚠️ Failed to fetch by cart restaurantId, trying fallback...", error);
        }
      }

      // Strategy 2: If no restaurantId in cart, search by restaurant name
      if (cart[0]?.restaurant && !restaurantData) {
        try {
          const searchResponse = await restaurantAPI.getRestaurants({
            limit: 100
          });
          const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || [];
          // Try exact match first
          let matchingRestaurant = restaurants.find(r => r.name?.toLowerCase().trim() === cart[0].restaurant?.toLowerCase().trim());

          // If no exact match, try partial match
          if (!matchingRestaurant) {
            matchingRestaurant = restaurants.find(r => r.name?.toLowerCase().includes(cart[0].restaurant?.toLowerCase().trim()) || cart[0].restaurant?.toLowerCase().trim().includes(r.name?.toLowerCase()));
          }
          if (matchingRestaurant) {
            // CRITICAL: Validate that the found restaurant matches cart items
            const cartRestaurantName = cart[0]?.restaurant?.toLowerCase().trim();
            const foundRestaurantName = matchingRestaurant.name?.toLowerCase().trim();
            if (cartRestaurantName && foundRestaurantName && cartRestaurantName !== foundRestaurantName) {
              console.error("❌ CRITICAL: Restaurant name mismatch!", {
                cartRestaurantName: cart[0]?.restaurant,
                foundRestaurantName: matchingRestaurant.name,
                cartRestaurantId: cart[0]?.restaurantId,
                foundRestaurantId: matchingRestaurant.restaurantId || matchingRestaurant._id
              });
              // Don't set restaurantData if names don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }
            setRestaurantData(matchingRestaurant);
            setLoadingRestaurant(false);
            return;
          } else {
            console.warn("⚠️ Restaurant not found even by name search. Searched in", restaurants.length, "restaurants");
            if (restaurants.length > 0) {}
          }
        } catch (searchError) {
          console.warn("⚠️ Error searching restaurants by name:", searchError);
        }
      }

      // If all strategies fail, set to null
      setRestaurantData(null);
      setLoadingRestaurant(false);
    };
    fetchRestaurantData();
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant]);

  // Fetch approved addons for the restaurant
  useEffect(() => {
    const fetchAddonsWithId = async idToUse => {
      // Convert to string for validation
      const idString = String(idToUse);
      // Validate ID format (should be ObjectId or restaurantId format)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3;
      if (!isValidIdFormat) {
        console.warn("⚠️ Restaurant ID format invalid:", idString);
        setAddons([]);
        return;
      }
      try {
        setLoadingAddons(true);
        const response = await restaurantAPI.getAddonsByRestaurantId(idString);
        const data = response?.data?.data?.addons || response?.data?.addons || [];
        if (data.length === 0) {
          console.warn("⚠️ No addons returned from API. Response:", response?.data);
        } else {}
        setAddons(data);
      } catch (error) {
        // Log error for debugging
        console.error("❌ Addons fetch error:", {
          code: error.code,
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        });
        // Silently handle network errors and 404 errors
        // Network errors (ERR_NETWORK) happen when backend is not running - this is OK for development
        // 404 errors mean restaurant might not have addons or restaurant not found - also OK
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error fetching addons:", error);
        }
        // Continue with cart even if addons fetch fails
        setAddons([]);
      } finally {
        setLoadingAddons(false);
      }
    };
    const fetchAddons = async () => {
      if (cart.length === 0) {
        setAddons([]);
        return;
      }

      // Wait for restaurantData to be loaded (including fallback search)
      if (loadingRestaurant) {
        return;
      }

      // Must have restaurantData to fetch addons
      if (!restaurantData) {
        console.warn("⚠️ No restaurantData available for addons fetch");
        setAddons([]);
        return;
      }

      // Use restaurantData ID (most reliable)
      const idToUse = restaurantData._id || restaurantData.restaurantId;
      if (!idToUse) {
        console.warn("⚠️ No valid restaurant ID in restaurantData");
        setAddons([]);
        return;
      }
      fetchAddonsWithId(idToUse);
    };
    fetchAddons();
  }, [restaurantData, cart.length, loadingRestaurant]);

  // Fetch coupons for items in cart
  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !restaurantId) {
        setAvailableCoupons([]);
        return;
      }
      setLoadingCoupons(true);
      const allCoupons = [];
      const uniqueCouponCodes = new Set();

      // Fetch coupons for each item in cart
      for (const cartItem of cart) {
        if (!cartItem.id) {
          continue;
        }
        const couponRestaurantId = cartItem.restaurantId || restaurantId;
        if (!couponRestaurantId) {
          continue;
        }
        try {
          const response = await restaurantAPI.getCouponsByItemIdPublic(couponRestaurantId, cartItem.id);
          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons;
            // Add coupons, avoiding duplicates
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode);
                // Convert backend coupon format to frontend format
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: coupon.originalPrice - coupon.discountedPrice,
                  discountPercentage: coupon.discountPercentage,
                  minOrder: coupon.minOrderValue || 0,
                  description: t("user.cart.ui.saveWithCoupon", {
                    amount: coupon.originalPrice - coupon.discountedPrice,
                    code: coupon.couponCode
                  }),
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  source: "restaurant",
                  itemId: cartItem.id,
                  itemName: cartItem.name
                });
              }
            });
          }
        } catch (error) {
          console.error(`[CART-COUPONS] Error fetching coupons for item ${cartItem.id}:`, error);
        }
      }
      setAvailableCoupons(allCoupons);
      setLoadingCoupons(false);
    };
    fetchCouponsForCartItems();
  }, [cart, restaurantId, t]);

  const combinedAvailableCoupons = useMemo(() => {
    const merged = [];
    const seen = new Set();

    [...availableCoupons, ...availableAdminCoupons].forEach(coupon => {
      const code = coupon?.code;
      const mergeKey = getCouponIdentity(coupon);
      if (!code || seen.has(mergeKey)) return;
      seen.add(mergeKey);
      merged.push(coupon);
    });

    return merged;
  }, [availableAdminCoupons, availableCoupons]);

  const appliedCouponKey = useMemo(() => getCouponIdentity(appliedCoupon), [appliedCoupon]);

  const combinedOfferCards = useMemo(() => {
    return combinedAvailableCoupons
      .map(coupon => ({
        ...coupon,
        isEligible: subtotalForCoupons >= Number(coupon.minOrder || 0),
        normalizedSource: normalizeCouponSource(coupon?.source),
        isApplied: appliedCouponKey && getCouponIdentity(coupon) === appliedCouponKey,
      }))
      .sort((a, b) => {
        const aEligible = a.isEligible ? 1 : 0;
        const bEligible = b.isEligible ? 1 : 0;
        if (aEligible !== bEligible) return bEligible - aEligible;
        const aDiscount = Number(a.discount || 0);
        const bDiscount = Number(b.discount || 0);
        if (bDiscount !== aDiscount) return bDiscount - aDiscount;
        return String(a.code || "").localeCompare(String(b.code || ""));
      });
  }, [appliedCouponKey, combinedAvailableCoupons, subtotalForCoupons]);

  const recommendedCoupon = useMemo(() => {
    return combinedOfferCards.find(coupon => coupon.isEligible) || combinedOfferCards[0] || null;
  }, [combinedOfferCards]);

  const activeCouponCard = useMemo(() => {
    if (!appliedCoupon) return null;
    return combinedOfferCards.find(coupon => coupon.isApplied) || {
      ...appliedCoupon,
      isEligible: subtotalForCoupons >= Number(appliedCoupon?.minOrder || 0),
      normalizedSource: normalizeCouponSource(appliedCoupon?.source),
      isApplied: true
    };
  }, [appliedCoupon, combinedOfferCards, subtotalForCoupons]);

  const featuredCouponCard = activeCouponCard || recommendedCoupon;

  // Calculate pricing from backend whenever cart, address, or coupon changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (cart.length === 0 || !defaultAddress) {
        setPricing(null);
        return;
      }
      try {
        setLoadingPricing(true);
        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          // Price should already be in INR
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false,
          isRecommended: Boolean(item.isRecommended)
        }));
        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: appliedCoupon?.code || couponCode || null,
          deliveryFleet: deliveryFleet || 'standard'
        });
        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing);
          const nextAdminCoupons = (response.data.data.pricing.availableAdminCoupons || []).map(coupon => ({
            code: coupon.code,
            discount: coupon.discountPreview || 0,
            discountPercentage: coupon.discountType === "percentage" ? coupon.discountValue : 0,
            minOrder: coupon.minOrderValue || 0,
            description: coupon.description || `Save with '${coupon.code}'`,
            title: coupon.title,
            source: "admin"
          }));
          setAvailableAdminCoupons(nextAdminCoupons);

          // Update applied coupon if backend returns one
          if (response.data.data.pricing.appliedCoupon && !appliedCoupon) {
            const backendAppliedCoupon = response.data.data.pricing.appliedCoupon;
            const backendAppliedKey = getCouponIdentity(backendAppliedCoupon);
            const coupon = [...availableCoupons, ...nextAdminCoupons].find(c => getCouponIdentity(c) === backendAppliedKey) || [...availableCoupons, ...nextAdminCoupons].find(c => String(c.code || "").trim().toUpperCase() === String(backendAppliedCoupon.code || "").trim().toUpperCase());
            if (coupon) {
              setAppliedCoupon(coupon);
            } else if (backendAppliedCoupon?.code) {
              setAppliedCoupon({
                ...backendAppliedCoupon,
                source: normalizeCouponSource(backendAppliedCoupon?.source),
              });
            }
          }
        }
      } catch (error) {
        // Network errors or 404 errors - silently handle, fallback to frontend calculation
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error calculating pricing:", error);
        }
        // Fallback to frontend calculation if backend fails
        setPricing(null);
        setAvailableAdminCoupons([]);
      } finally {
        setLoadingPricing(false);
      }
    };
    calculatePricing();
  }, [cart, defaultAddress, appliedCoupon, couponCode, deliveryFleet, restaurantId, restaurantData, availableCoupons]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true);
        const response = await userAPI.getWallet();
        if (response?.data?.success && response?.data?.data?.wallet) {
          setWalletBalance(response.data.data.wallet.balance || 0);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        setWalletBalance(0);
      } finally {
        setIsLoadingWallet(false);
      }
    };
    fetchWalletBalance();
  }, []);

  // Fetch fee settings on mount
  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        const response = await adminAPI.getPublicFeeSettings();
        if (response.data.success && response.data.data.feeSettings) {
          setFeeSettings({
            deliveryFee: response.data.data.feeSettings.deliveryFee || 25,
            freeDeliveryThreshold: response.data.data.feeSettings.freeDeliveryThreshold || 149,
            platformFee: response.data.data.feeSettings.platformFee ?? 5,
            gstRate: response.data.data.feeSettings.gstRate || 5
          });
        }
      } catch (error) {
        console.error('Error fetching fee settings:', error);
        // Keep default values on error
      }
    };
    fetchFeeSettings();
  }, []);

  // Use backend pricing if available, otherwise fallback to database settings
  const subtotal = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const customDeliveryOn = isRestaurantCustomDeliveryPricingEnabled(restaurantData);
  const hasApiDeliveryFee = pricing != null && pricing.deliveryFee != null && Number.isFinite(Number(pricing.deliveryFee));
  let deliveryFee;
  if (hasApiDeliveryFee) {
    deliveryFee = Number(pricing.deliveryFee);
  } else if (appliedCoupon?.freeDelivery) {
    deliveryFee = 0;
  } else if (customDeliveryOn) {
    // Do not use global free-delivery threshold for slab pricing — avoids false "FREE" when API is slow/errors
    deliveryFee = loadingPricing && !pricing ? null : Number(feeSettings.deliveryFee);
  } else if (subtotal >= feeSettings.freeDeliveryThreshold) {
    deliveryFee = 0;
  } else {
    deliveryFee = Number(feeSettings.deliveryFee);
  }
  const deliveryFeeForTotals = deliveryFee != null ? deliveryFee : Number(feeSettings.deliveryFee);
  const platformFee = pricing?.platformFee ?? feeSettings.platformFee;
  const discount = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0);
  const taxableFoodAmount = Math.max(subtotal - discount, 0);
  const gstCharges = pricing?.tax ?? Math.round(((taxableFoodAmount * 0.05) + (deliveryFeeForTotals * 0.18) + (platformFee * 0.18)) * 100) / 100;
  const totalBeforeDiscount = subtotal + deliveryFeeForTotals + platformFee + gstCharges;
  const total = pricing?.total || totalBeforeDiscount - discount;
  const savings = pricing?.savings || discount + (subtotal > 500 ? 32 : 0);

  const pricingMeta = pricing?.pricingMeta;
  const deliveryPricingMisconfigured = Boolean(
    pricing &&
    Number(pricing.deliveryFee) === 0 &&
    !pricingMeta?.freeDeliveryReason &&
    Array.isArray(pricingMeta?.pricingDiagnostics) &&
    pricingMeta.pricingDiagnostics.length > 0
  );
  const deliveryPricingWarningMessage = deliveryPricingMisconfigured
    ? (pricingMeta?.pricingDiagnostics?.[0]?.message ||
      t("user.cart.ui.deliveryPricingWarning"))
    : '';

  // Restaurant name from data or cart
  const restaurantName = restaurantData?.name || cart[0]?.restaurant || t("user.cart.ui.restaurant");

  // Handler to select address by label (Home, Office, Other)
  const handleSelectAddressByLabel = async label => {
    try {
      // Find address with matching label
      const address = addresses.find(addr => addr.label === label);
      if (!address) {
        // Instead of error, open selector with this label
        openLocationSelector(label);
        return;
      }

      // Get coordinates from address location
      const coordinates = address.location?.coordinates || [];
      const longitude = coordinates[0];
      const latitude = coordinates[1];
      if (!latitude || !longitude) {
        toast.error(t("user.cart.toast.invalidCoordinates", { label }));
        return;
      }

      // Update location in backend
      await userAPI.updateLocation({
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: `${address.street}, ${address.city}`,
        city: address.city,
        state: address.state,
        area: address.additionalDetails || "",
        formattedAddress: address.additionalDetails ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}` : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`,
        postalCode: address.zipCode || undefined,
        skipLocationThrottle: true
      });

      // Update the location in localStorage
      const locationData = {
        city: address.city,
        state: address.state,
        address: `${address.street}, ${address.city}`,
        area: address.additionalDetails || "",
        zipCode: address.zipCode,
        latitude,
        longitude,
        formattedAddress: address.additionalDetails ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}` : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
      };
      localStorage.setItem("userLocation", JSON.stringify(locationData));
      toast.success(t("user.cart.toast.addressSelected", { label }));

      // Force page reload to update location
      window.location.reload();
    } catch (error) {
      console.error(`Error selecting ${label} address:`, error);
      toast.error(t("user.cart.toast.failedToSelectAddress", { label }));
    }
  };
  const handleApplyCoupon = async coupon => {
    if (subtotal >= coupon.minOrder) {
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);

      // Recalculate pricing with new coupon
      if (cart.length > 0 && defaultAddress) {
        try {
          const items = cart.map(item => ({
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            image: item.image,
            description: item.description,
            isVeg: item.isVeg !== false,
            isRecommended: Boolean(item.isRecommended)
          }));
          const response = await orderAPI.calculateOrder({
            items,
            restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
            deliveryAddress: defaultAddress,
            couponCode: coupon.code,
            deliveryFleet: deliveryFleet || 'standard'
          });
          if (response?.data?.success && response?.data?.data?.pricing) {
            setPricing(response.data.data.pricing);
          }
        } catch (error) {
          console.error("Error recalculating pricing:", error);
        }
      }
    }
  };
  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null);
    setCouponCode("");

    // Recalculate pricing without coupon
    if (cart.length > 0 && defaultAddress) {
      try {
        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false,
          isRecommended: Boolean(item.isRecommended)
        }));
        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: null,
          deliveryFleet: deliveryFleet || 'standard'
        });
        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing);
        }
      } catch (error) {
        console.error("Error recalculating pricing:", error);
      }
    }
  };
  const handlePlaceOrder = async () => {
    if (!defaultAddress) {
      alert(t("user.cart.toast.pleaseAddDeliveryAddress"));
      return;
    }
    if (cart.length === 0) {
      alert(t("user.cart.toast.cartEmpty"));
      return;
    }
    setIsPlacingOrder(true);
    setPlacedOrderEtaText("");

    // Use API_BASE_URL from config (supports both dev and production)

    try {
      // Ensure couponCode is included in pricing
      const orderPricing = pricing || {
        subtotal,
        deliveryFee: deliveryFeeForTotals,
        tax: gstCharges,
        platformFee,
        discount,
        total,
        couponCode: appliedCoupon?.code || null
      };

      // Add couponCode if not present but coupon is applied
      if (!orderPricing.couponCode && appliedCoupon?.code) {
        orderPricing.couponCode = appliedCoupon.code;
      }

      // Include all cart items (main items + addons)
      // Note: Addons are added as separate cart items when user clicks the + button
      const orderItems = cart.map(item => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg !== false,
        isRecommended: Boolean(item.isRecommended)
      }));
      // Check API base URL before making request (for debugging)
      const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
      // CRITICAL: Validate restaurant ID before placing order
      // Ensure we're using the correct restaurant from restaurantData (most reliable)
      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      const finalRestaurantName = restaurantData?.name || null;
      if (!finalRestaurantId) {
        console.error('❌ CRITICAL: Cannot place order - Restaurant ID is missing!');
        console.error('📋 Debug info:', {
          restaurantData: restaurantData ? {
            _id: restaurantData._id,
            restaurantId: restaurantData.restaurantId,
            name: restaurantData.name
          } : 'Not loaded',
          cartRestaurantId: restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });
        alert(t("user.cart.toast.restaurantInfoMissingWithRefresh"));
        setIsPlacingOrder(false);
        return;
      }

      // CRITICAL: Validate that ALL cart items belong to the SAME restaurant
      const cartRestaurantIds = cart.map(item => item.restaurantId).filter(Boolean).map(id => String(id).trim()); // Normalize to string and trim

      const cartRestaurantNames = cart.map(item => item.restaurant).filter(Boolean).map(name => name.trim().toLowerCase()); // Normalize names

      // Get unique values (after normalization)
      const uniqueRestaurantIds = [...new Set(cartRestaurantIds)];
      const uniqueRestaurantNames = [...new Set(cartRestaurantNames)];

      // Check if cart has items from multiple restaurants
      // Note: If restaurant names match, allow even if IDs differ (same restaurant, different ID format)
      if (uniqueRestaurantNames.length > 1) {
        // Different restaurant names = definitely different restaurants
        console.error('❌ CRITICAL ERROR: Cart contains items from multiple restaurants!', {
          restaurantIds: uniqueRestaurantIds,
          restaurantNames: uniqueRestaurantNames,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });

        // Automatically clean cart to keep items from the restaurant matching restaurantData
        if (finalRestaurantId && finalRestaurantName) {
          cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
          toast.error(t("user.cart.toast.itemsFromDifferentRestaurantsRemoved"));
        } else {
          // If restaurantData is not available, keep items from first restaurant in cart
          const firstRestaurantId = cart[0]?.restaurantId;
          const firstRestaurantName = cart[0]?.restaurant;
          if (firstRestaurantId && firstRestaurantName) {
            cleanCartForRestaurant(firstRestaurantId, firstRestaurantName);
            toast.error(t("user.cart.toast.itemsFromDifferentRestaurantsRemoved"));
          } else {
            toast.error(t("user.cart.toast.itemsFromDifferentRestaurants"));
          }
        }
        setIsPlacingOrder(false);
        return;
      }

      // If restaurant names match but IDs differ, that's OK (same restaurant, different ID format)
      // But log a warning in development
      if (uniqueRestaurantIds.length > 1 && uniqueRestaurantNames.length === 1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Cart items have different restaurant IDs but same name. This is OK if IDs are in different formats.', {
            restaurantIds: uniqueRestaurantIds,
            restaurantName: uniqueRestaurantNames[0]
          });
        }
      }

      // Validate that cart items' restaurantId matches the restaurantData
      if (cartRestaurantIds.length > 0) {
        const cartRestaurantId = cartRestaurantIds[0];

        // Check if cart restaurantId matches restaurantData
        const restaurantIdMatches = cartRestaurantId === finalRestaurantId || cartRestaurantId === restaurantData?._id?.toString() || cartRestaurantId === restaurantData?.restaurantId;
        if (!restaurantIdMatches) {
          console.error('❌ CRITICAL ERROR: Cart restaurantId does not match restaurantData!', {
            cartRestaurantId: cartRestaurantId,
            finalRestaurantId: finalRestaurantId,
            restaurantDataId: restaurantData?._id?.toString(),
            restaurantDataRestaurantId: restaurantData?.restaurantId,
            restaurantDataName: restaurantData?.name,
            cartRestaurantName: cartRestaurantNames[0]
          });
          alert(t("user.cart.toast.restaurantDataMismatchWithCart", { restaurant: cartRestaurantNames[0] || t("user.cart.ui.unknownRestaurant") }));
          setIsPlacingOrder(false);
          return;
        }
      }

      // Validate restaurant name matches
      if (cartRestaurantNames.length > 0 && finalRestaurantName) {
        const cartRestaurantName = cartRestaurantNames[0];
        if (cartRestaurantName.toLowerCase().trim() !== finalRestaurantName.toLowerCase().trim()) {
          console.error('❌ CRITICAL ERROR: Restaurant name mismatch!', {
            cartRestaurantName: cartRestaurantName,
            finalRestaurantName: finalRestaurantName
          });
          alert(t("user.cart.toast.restaurantNameMismatch", { cartRestaurantName, finalRestaurantName }));
          setIsPlacingOrder(false);
          return;
        }
      }

      // Log order details for debugging

      // FINAL VALIDATION: Double-check restaurantId before sending to backend
      const cartRestaurantId = cart[0]?.restaurantId;
      if (cartRestaurantId && cartRestaurantId !== finalRestaurantId && cartRestaurantId !== restaurantData?._id?.toString() && cartRestaurantId !== restaurantData?.restaurantId) {
        console.error('❌ CRITICAL: Final validation failed - restaurantId mismatch!', {
          cartRestaurantId: cartRestaurantId,
          finalRestaurantId: finalRestaurantId,
          restaurantDataId: restaurantData?._id?.toString(),
          restaurantDataRestaurantId: restaurantData?.restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          finalRestaurantName: finalRestaurantName
        });
        alert(t("user.cart.toast.restaurantInfoMismatchDetected"));
        setIsPlacingOrder(false);
        return;
      }
      const orderPayload = {
        items: orderItems,
        address: defaultAddress,
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        customerName: (orderContactName || userProfile?.name || "").trim(),
        customerPhone: normalizeIndianPhoneForOrder(orderContactPhone || userProfile?.phone || defaultAddress?.phone || ""),
        pricing: orderPricing,
        deliveryFleet: deliveryFleet || 'standard',
        note: note || "",
        sendCutlery: sendCutlery !== false,
        paymentMethod: selectedPaymentMethod,
        zoneId: zoneId // CRITICAL: Pass zoneId for strict zone validation
      };
      // Log final order details (including paymentMethod for COD debugging)

      // Check wallet balance if wallet payment selected
      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error(t("user.cart.toast.insufficientWalletBalance", { required: total.toFixed(0), available: walletBalance.toFixed(0) }));
        setIsPlacingOrder(false);
        return;
      }

      // Create order in backend
      const orderResponse = await orderAPI.createOrder(orderPayload);
      const {
        order,
        razorpay
      } = orderResponse.data.data;

      // Cash flow: order placed without online payment
      if (selectedPaymentMethod === "cash") {
        toast.success(t("user.cart.toast.orderPlacedCod"));
        setPlacedOrderId(order?.orderId || order?.id || null);
        setPlacedOrderEtaText(formatOrderEtaText(order, restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaLong")));
        setShowOrderSuccess(true);
        clearCart();
        setIsPlacingOrder(false);
        return;
      }

      // Wallet flow: order placed with wallet payment (already processed in backend)
      if (selectedPaymentMethod === "wallet") {
        toast.success(t("user.cart.toast.orderPlacedWallet"));
        setPlacedOrderId(order?.orderId || order?.id || null);
        setPlacedOrderEtaText(formatOrderEtaText(order, restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaLong")));
        setShowOrderSuccess(true);
        clearCart();
        setIsPlacingOrder(false);
        // Refresh wallet balance
        try {
          const walletResponse = await userAPI.getWallet();
          if (walletResponse?.data?.success && walletResponse?.data?.data?.wallet) {
            setWalletBalance(walletResponse.data.data.wallet.balance || 0);
          }
        } catch (error) {
          console.error("Error refreshing wallet balance:", error);
        }
        return;
      }
      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        console.error("❌ Razorpay initialization failed:", {
          razorpay,
          order
        });
        throw new Error(razorpay ? t("user.cart.toast.razorpayNotConfigured") : t("user.cart.toast.failedToInitializePayment"));
      }
      // Get user info for Razorpay prefill
      const userInfo = userProfile || {};
      const userPhone = normalizeIndianPhoneForOrder(orderContactPhone || userInfo.phone || defaultAddress?.phone || "");
      const userEmail = userInfo.email || "";
      const userName = (orderContactName || userInfo.name || "").trim();

      // Format phone number (remove non-digits, take last 10 digits)
      const formattedPhone = normalizeIndianPhoneForOrder(userPhone);
      // Get company name for Razorpay
      const companyName = await getCompanyNameAsync();

      // Initialize Razorpay payment
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: companyName,
        description: `Order ${order.orderId} - ₹${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order.orderId,
          userId: userInfo.id || "",
          restaurantId: restaurantId || "unknown"
        },
        handler: async response => {
          try {
            // Verify payment with backend
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            if (verifyResponse.data.success) {
              // Payment successful

              setPlacedOrderId(order.orderId);
              setPlacedOrderEtaText(formatOrderEtaText(order, restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaLong")));
              setShowOrderSuccess(true);
              clearCart();
              setIsPlacingOrder(false);
            } else {
              throw new Error(verifyResponse.data.message || t("user.cart.toast.paymentVerificationFailed"));
            }
          } catch (error) {
            console.error("❌ Payment verification error:", error);
            const errorMessage = error?.response?.data?.message || error?.message || t("user.cart.toast.paymentVerificationFailed");
            alert(errorMessage);
            setIsPlacingOrder(false);
          }
        },
        onError: error => {
          console.error("❌ Razorpay payment error:", error);
          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || t("user.cart.toast.paymentFailed");
            alert(errorMessage);
          }
          setIsPlacingOrder(false);
        },
        onClose: () => {
          setIsPlacingOrder(false);
        }
      });
    } catch (error) {
      console.error("❌ Order creation error:", error);
      let errorMessage = t("user.cart.toast.failedToCreateOrder");

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const backendUrl = API_BASE_URL.replace('/api', '');
        errorMessage = `Network Error: Cannot connect to backend server.\n\n` + `Expected backend URL: ${backendUrl}\n\n` + `Please check:\n` + `1. Backend server is running\n` + `2. Backend is accessible at ${backendUrl}\n` + `3. Check browser console (F12) for more details\n\n` + `If backend is not running, start it with:\n` + `cd appzetofood/backend && npm start`;
        console.error("🔴 Network Error Details:", {
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config?.baseURL + error.config?.url,
            method: error.config?.method
          },
          backendUrl: backendUrl,
          apiBaseUrl: API_BASE_URL
        });

        console.error("💡 Make sure backend server is running at:", backendUrl);
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = t("user.cart.toast.requestTimedOut");
      }
      // Handle other axios errors
      else if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      }
      // Handle other errors
      else if (error.message) {
        errorMessage = error.message;
      }
      alert(errorMessage);
      setIsPlacingOrder(false);
    }
  };
  const handleGoToOrders = () => {
    setShowOrderSuccess(false);
    setPlacedOrderEtaText("");
    navigate(`/user/orders/${placedOrderId}?confirmed=true`);
  };

  const handleCartShare = async () => {
    try {
      const companyName = await getCompanyNameAsync();
      const shareUrl = restaurantData?.slug
        ? `${window.location.origin}/user/restaurants/${restaurantData.slug}`
        : window.location.href;
      const shareText = `Check out ${restaurantName} on ${companyName}. ${shareUrl}`;

      const result = await handleShare({
        title: `${restaurantName} | ${companyName}`,
        text: shareText,
        url: shareUrl,
      });

      if (result.status === "copied") {
        toast.success("Link copied");
      } else if (result.status === "error") {
        toast.error("Unable to share right now");
      }
    } catch (error) {
      toast.error("Unable to share right now");
    }
  };

  // Empty cart state - but don't show if order success or placing order modal is active
  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link onClick={() => navigate(-1)}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="font-semibold text-gray-800 dark:text-white">{t("user.cart.ui.cart")}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">{t("user.cart.ui.yourCartIsEmpty")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">{t("user.cart.ui.emptyCartHint")}</p>
          <Link to="/">
            <Button className="bg-[#FF5200] hover:opacity-90 text-white">{t("user.cart.ui.browseRestaurants")}</Button>
          </Link>
        </div>
      </AnimatedPage>;
  }
  return <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Header - Sticky at top */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Link onClick={() => navigate(-1)}>
                <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0">
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Link>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
                <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                  <DynamicEtaText
                    restaurantId={restaurantId}
                    items={etaItems}
                    fallback={restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaShort")}
                  />{" "}
                  {t("user.cart.ui.to")} <span className="font-semibold">{t("user.cart.ui.location")}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? formatFullAddress(defaultAddress, locationPlaceholderText) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || t("user.cart.ui.selectAddress") : t("user.cart.ui.selectAddress")}</span>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" onClick={handleCartShare}>
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-40 md:pb-32">
        {/* Savings Banner */}
        {savings > 0 && <div className="bg-blue-100 dark:bg-blue-900/20 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm md:text-base font-medium text-blue-800 dark:text-blue-200">
                {t("user.cart.ui.youSavedOnOrder", { amount: savings })}
              </p>
            </div>
          </div>}

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-6">
            {/* Left Column - Cart Items and Details */}
            <div className="space-y-2 md:space-y-4">
              {/* Cart Items */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl mb-4 md:mb-0">
                <div className="space-y-3 md:space-y-4">
                  {cart.map(item => <div key={item.id} className="flex items-start gap-3 md:gap-4">
                      {/* Veg/Non-veg indicator */}
                      <div className={`w-4 h-4 md:w-5 md:h-5 border-2 ${item.isVeg !== false ? 'border-green-600' : 'border-red-600'} flex items-center justify-center mt-1 flex-shrink-0`}>
                        <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${item.isVeg !== false ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 leading-tight">{item.name}</p>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Quantity controls */}
                        <div className="flex items-center border border-[#FF5200] dark:border-[#FF5200] rounded">
                          <button className="px-2 md:px-3 py-1 text-[#FF5200] dark:text-[#FF5200] hover:bg-[#FF5200]/10 dark:hover:bg-[#FF5200]/20" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                            <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <span className="px-2 md:px-3 text-sm md:text-base font-semibold text-[#FF5200] dark:text-[#FF5200] min-w-[20px] md:min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button className="px-2 md:px-3 py-1 text-[#FF5200] dark:text-[#FF5200] hover:bg-[#FF5200]/10 dark:hover:bg-[#FF5200]/20" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                            <Plus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>

                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 min-w-[50px] md:min-w-[70px] text-right">
                          ₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}
                        </p>
                      </div>
                    </div>)}
                </div>

                {/* Add more items */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 mt-4 md:mt-6 text-[#FF5200] dark:text-[#FF5200]">
                  <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-sm md:text-base font-medium">{t("user.cart.ui.addMoreItems")}</span>
                </button>
              </div>


              {/* Note & Cutlery */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl flex flex-col sm:flex-row gap-2 md:gap-3">
                <button onClick={() => setShowNoteInput(!showNoteInput)} className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="truncate">{note || t("user.cart.ui.addNoteForRestaurant")}</span>
                </button>
                <button onClick={() => setSendCutlery(!sendCutlery)} className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300' : 'border-[#FF5200] dark:border-[#FF5200] text-[#FF5200] dark:text-[#FF5200] bg-[#FF5200]/10 dark:bg-[#FF5200]/20'}`}>
                  <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="whitespace-nowrap">{sendCutlery ? t("user.cart.ui.dontSendCutlery") : t("user.cart.ui.noCutlery")}</span>
                </button>
              </div>

              {/* Note Input */}
              {showNoteInput && <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t("user.cart.ui.notePlaceholder")} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-[#FF5200] dark:focus:border-[#FF5200] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100" />
                </div>}

              {/* Complete your meal section - Approved Addons */}
              {filteredAddons.length > 0 && <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-xs md:text-base">🍽️</span>
                    </div>
                    <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">{t("user.cart.ui.completeYourMealWith")}</span>
                  </div>
                  {loadingAddons ? <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2, 3].map(i => <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                          <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                        </div>)}
                    </div> : <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {filteredAddons.map(addon => <div key={addon.id} className="flex-shrink-0 w-28 md:w-36">
                          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg md:rounded-xl overflow-hidden">
                            <img src={addon.image || addon.images && addon.images[0] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"} alt={addon.name} className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl" onError={e => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop";
                    }} />
                            {addon.foodType && (
                              <div className="absolute top-1 md:top-2 left-1 md:left-2">
                                <div
                                  className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white dark:bg-[#0f0f0f] border flex items-center justify-center rounded ${
                                    addon.foodType === "Veg"
                                      ? "border-green-600 dark:border-green-500"
                                      : addon.foodType === "Egg"
                                      ? "border-yellow-600 dark:border-yellow-500"
                                      : "border-red-600 dark:border-red-500"
                                  }`}
                                >
                                  <div
                                    className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                                      addon.foodType === "Veg"
                                        ? "bg-green-600"
                                        : addon.foodType === "Egg"
                                        ? "bg-yellow-600"
                                        : "bg-red-600"
                                    }`}
                                  />
                                </div>
                              </div>
                            )}
                            <button onClick={() => {
                      // Use restaurant info from existing cart items to ensure format consistency
                      const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                      const cartRestaurantName = cart[0]?.restaurant || restaurantName;
                      if (!cartRestaurantId || !cartRestaurantName) {
                        console.error('❌ Cannot add addon: Missing restaurant information', {
                          cartRestaurantId,
                          cartRestaurantName,
                          restaurantId,
                          restaurantName,
                          cartItem: cart[0]
                        });
                        toast.error(t("user.cart.toast.restaurantInfoMissing"));
                        return;
                      }
                      addToCart({
                        id: addon.id,
                        name: addon.name,
                        price: addon.price,
                        image: addon.image || addon.images && addon.images[0] || "",
                        description: addon.description || "",
                        isVeg: addon.foodType === "Veg",
                        foodType: addon.foodType || "",
                        restaurant: cartRestaurantName,
                        restaurantId: cartRestaurantId
                      });
                    }} className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-white dark:bg-[#0f0f0f] border border-red-600 dark:border-red-500 rounded flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-600" />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                          {addon.description && <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{addon.description}</p>}
                          <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">₹{addon.price}</p>
                        </div>)}
                    </div>}
                </div>}

              {/* Coupon Section */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                {loadingCoupons ? <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">{t("user.cart.ui.loadingCoupons")}</p>
                  </div> : combinedOfferCards.length > 0 ? <div className="space-y-3 md:space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 md:gap-3">
                        <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                              {featuredCouponCard ? t("user.cart.ui.saveWithCoupon", { amount: featuredCouponCard.discount, code: featuredCouponCard.code }) : t("user.cart.ui.noCouponsAvailable")}
                            </p>
                            {appliedCoupon && <span className="inline-flex items-center rounded-full bg-[#FF5200]/10 px-2 py-0.5 text-[11px] md:text-xs font-medium text-[#FF5200] dark:bg-[#FF5200]/20 dark:text-[#FF5200]">
                                {t("user.cart.ui.couponApplied", { code: appliedCoupon.code })}
                              </span>}
                          </div>
                          {featuredCouponCard && <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{featuredCouponCard.description}</p>}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {appliedCoupon ? <button onClick={handleRemoveCoupon} className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">{t("user.cart.ui.remove")}</button> : featuredCouponCard ? <Button size="sm" variant="outline" className="h-7 md:h-8 text-xs md:text-sm border-[#FF5200] dark:border-[#FF5200] text-[#FF5200] dark:text-[#FF5200] hover:bg-[#FF5200]/10 dark:hover:bg-[#FF5200]/20" onClick={() => handleApplyCoupon(featuredCouponCard)} disabled={!featuredCouponCard.isEligible}>
                              {t("user.cart.ui.apply")}
                            </Button> : null}
                      </div>
                    </div>

                    <div className="border-t dark:border-gray-700 pt-3 md:pt-4">
                      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {combinedOfferCards.map(coupon => (
                          <div
                            key={getCouponIdentity(coupon) || coupon.code}
                            className={`min-w-[230px] max-w-[230px] rounded-lg border p-3 ${coupon.isApplied ? "border-[#FF5200] bg-[#FF5200]/5 dark:bg-[#FF5200]/10" : "border-gray-200 dark:border-gray-700"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{coupon.code}</p>
                                  {coupon.isApplied && (
                                    <span className="inline-flex items-center rounded-full bg-[#FF5200]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF5200] dark:bg-[#FF5200]/20 dark:text-[#FF5200]">
                                      {t("user.cart.ui.couponApplied", { code: coupon.code })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{coupon.description}</p>
                              </div>
                              <div className="shrink-0">
                                {coupon.isApplied ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-[#FF5200] dark:border-[#FF5200] text-[#FF5200] dark:text-[#FF5200] hover:bg-[#FF5200]/10 dark:hover:bg-[#FF5200]/20"
                                    onClick={handleRemoveCoupon}
                                  >
                                    {t("user.cart.ui.remove")}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-[#FF5200] dark:border-[#FF5200] text-[#FF5200] dark:text-[#FF5200] hover:bg-[#FF5200]/10 dark:hover:bg-[#FF5200]/20"
                                    onClick={() => handleApplyCoupon(coupon)}
                                    disabled={!coupon.isEligible}
                                  >
                                    {t("user.cart.ui.apply")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div> : <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">{t("user.cart.ui.noCouponsAvailable")}</p>
                  </div>}
              </div>

              {/* Delivery Time */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                      {t("user.cart.ui.deliveryIn")}{" "}
                      <span className="font-semibold">
                        <DynamicEtaText
                          restaurantId={restaurantId}
                          items={etaItems}
                          fallback={restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaShort")}
                        />
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div onClick={() => openLocationSelector()} className="flex items-center justify-between w-full text-left cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-lg">
                  <div className="flex items-center gap-3 md:gap-4 flex-1">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                        {t("user.cart.ui.deliveryAt")} <span className="font-semibold">{t("user.cart.ui.location")}</span>
                      </p>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {defaultAddress ? formatFullAddress(defaultAddress, locationPlaceholderText) || defaultAddress?.formattedAddress || defaultAddress?.address || t("user.cart.ui.addDeliveryAddress") : t("user.cart.ui.addDeliveryAddress")}
                      </p>
                      {/* Address Selection Buttons */}
                      <div className="flex gap-2 mt-2">
                        {["Home", "Office", "Other"].map(label => {
                        const isSelected = defaultAddress?.label?.toLowerCase() === label.toLowerCase();
                        return <button key={label} onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectAddressByLabel(label);
                        }} className={`text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 rounded-md border transition-colors ${isSelected ? 'border-[#FF5200] bg-orange-50 dark:bg-orange-900/20 text-[#FF5200] font-medium' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                              {t(`user.cart.addressLabel.${label.toLowerCase()}`)}
                            </button>;
                      })}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-4">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                      {(orderContactName || userProfile?.name || t("user.cart.ui.yourName")).trim() || t("user.cart.ui.yourName")},{" "}
                      <span className="font-medium">{orderContactPhone || normalizeIndianPhoneForOrder(userProfile?.phone) || t("user.cart.ui.phoneFallback")}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowContactEditor(prev => !prev)}
                    className="text-sm text-[#FF5200] font-medium hover:underline"
                  >
                    {showContactEditor ? t("user.cart.ui.done") : t("user.cart.ui.edit")}
                  </button>
                </div>

                {showContactEditor && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={orderContactName}
                      onChange={(e) => setOrderContactName(e.target.value)}
                      placeholder={t("user.cart.ui.customerNameForOrderPlaceholder")}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="tel"
                      value={orderContactPhone}
                      onChange={(e) => setOrderContactPhone(normalizeIndianPhoneForOrder(e.target.value))}
                      placeholder={t("user.cart.ui.customerPhoneForOrderPlaceholder")}
                      maxLength={10}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {t("user.cart.ui.contactUpdateNote")}
                    </p>
                  </div>
                )}
              </div>

              {/* Bill Details */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <button onClick={() => setShowBillDetails(!showBillDetails)} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 md:gap-4">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base text-gray-800 dark:text-gray-200">{t("user.cart.ui.totalBill")}</span>
                        <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">₹{total.toFixed(0)}</span>
                        {savings > 0 && <span className="text-xs md:text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 md:px-2 py-0.5 rounded font-medium">{t("user.cart.ui.youSavedAmount", { amount: savings })}</span>}
                      </div>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t("user.cart.ui.includingTaxesAndCharges")}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                </button>

                {showBillDetails && <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-dashed dark:border-gray-700 space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">{t("user.cart.ui.itemTotal")}</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">{t("user.cart.ui.deliveryFee")}</span>
                      <span className={deliveryFee === 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}>
                        {deliveryFee === null ? "…" : deliveryFee === 0 ? t("user.cart.ui.free") : `₹${deliveryFee}`}
                      </span>
                    </div>
                    {deliveryPricingMisconfigured && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                        {deliveryPricingWarningMessage}
                      </p>
                    )}
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">{t("user.cart.ui.platformFee")}</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{platformFee}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGstBreakdown(true)}
                      className="flex w-full items-center justify-between text-sm md:text-base text-left"
                    >
                      <span className="text-gray-600 dark:text-gray-400 underline underline-offset-4 decoration-dotted">
                        {t("user.cart.ui.gstGovTaxes")}
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">₹{gstCharges}</span>
                    </button>
                    {discount > 0 && <div className="flex justify-between text-sm md:text-base text-red-600 dark:text-red-400">
                        <span>{t("user.cart.ui.couponDiscount")}</span>
                        <span>-₹{discount}</span>
                      </div>}
                    <div className="flex justify-between text-sm md:text-base font-semibold pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span>{t("user.cart.ui.toPay")}</span>
                      <span>₹{total.toFixed(0)}</span>
                    </div>
                  </div>}
              </div>

            </div>

          </div>
        </div>
      </div>

      <GstBreakdownDialog
        open={showGstBreakdown}
        onOpenChange={setShowGstBreakdown}
        pricing={{
          subtotal,
          discount,
          deliveryFee: deliveryFeeForTotals,
          platformFee,
        }}
      />

      {/* Bottom Sticky - Place Order */}
      <div className="bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 shadow-lg z-30 flex-shrink-0 fixed bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="w-full max-w-md md:max-w-lg mx-auto">
              {/* Pay Using */}
              <div className="flex items-center justify-between gap-3 mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  <div className="leading-tight">
                    <p className="text-[11px] md:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t("user.cart.ui.payUsing")}
                    </p>
                    <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedPaymentMethod === "razorpay" ? t("user.cart.paymentOptions.razorpay.label") : selectedPaymentMethod === "wallet" ? t("user.cart.paymentOptions.wallet.label") : t("user.cart.paymentOptions.cash.label")}
                    </p>
                  </div>
                </div>

                <button type="button" onClick={() => setShowPaymentSheet(true)} className="min-w-[152px] rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left shadow-sm transition-all hover:border-green-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-green-700 dark:hover:bg-gray-950">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {selectedPaymentOption.label}
                      </p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                        {t("user.cart.ui.tapToChange")}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                  </div>
                </button>
              </div>

              <Button size="lg" onClick={handlePlaceOrder} disabled={isPlacingOrder || selectedPaymentMethod === "wallet" && walletBalance < total} className="w-full bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700 text-white px-6 md:px-10 h-14 md:h-16 rounded-lg md:rounded-xl text-base md:text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {(selectedPaymentMethod === "razorpay" || selectedPaymentMethod === "wallet") && <div className="text-left mr-3 md:mr-4">
                    <p className="text-sm md:text-base opacity-90">₹{total.toFixed(0)}</p>
                    <p className="text-xs md:text-sm opacity-75">{t("user.cart.ui.totalUpper")}</p>
                  </div>}
                <span className="font-bold text-base md:text-lg">
                  {isPlacingOrder ? t("user.cart.ui.processing") : selectedPaymentMethod === "razorpay" ? t("user.cart.ui.selectPayment") : selectedPaymentMethod === "wallet" ? walletBalance >= total ? t("user.cart.ui.placeOrder") : t("user.cart.ui.insufficientBalance") : t("user.cart.ui.placeOrder")}
                </span>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>


      <Dialog open={showPaymentSheet} onOpenChange={setShowPaymentSheet}>
        <DialogContent showCloseButton={false} className="left-0 right-0 top-auto bottom-0 z-[80] max-w-none translate-x-0 translate-y-0 rounded-t-[28px] rounded-b-none border-0 bg-white p-0 shadow-[0_-24px_60px_rgba(15,23,42,0.22)] sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] dark:bg-[#171717]">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="px-5 pb-5 pt-4">
            <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
              {t("user.cart.ui.choosePaymentMethod")}
            </DialogTitle>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("user.cart.ui.choosePaymentMethodDescription")}
            </p>

            <div className="mt-4 space-y-3">
              {paymentOptions.map(option => {
              const isActive = selectedPaymentMethod === option.value;
              return <button key={option.value} type="button" onClick={() => {
                setSelectedPaymentMethod(option.value);
                setShowPaymentSheet(false);
              }} className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? "border-green-600 bg-green-50 shadow-[0_12px_24px_rgba(22,163,74,0.12)] dark:border-green-500 dark:bg-green-950/40" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#111111] dark:hover:border-gray-600 dark:hover:bg-[#1a1a1a]"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${option.accent}`}>
                        {option.value === "wallet" ? <Wallet className="h-4 w-4" /> : option.value === "cash" ? <Building2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {option.label}
                          </p>
                          {isActive && <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
                              <Check className="h-3.5 w-3.5" />
                            </span>}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>;
            })}
            </div>

            <button type="button" onClick={() => setShowPaymentSheet(false)} className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#202020]">
              {t("common.cancel")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Placing Order Modal */}
      {showPlacingOrder && <div className="fixed inset-0 z-[60] h-screen w-screen overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-3xl shadow-2xl overflow-hidden" style={{
        animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
            <div className="px-6 py-8">
              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t("user.cart.ui.placingYourOrder")}</h2>

              {/* Payment Info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-[#0f0f0f] shadow-sm">
                  <CreditCard className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedPaymentMethod === "razorpay" ? t("user.cart.ui.payOnlineRazorpay", { amount: total.toFixed(2) }) : selectedPaymentMethod === "wallet" ? t("user.cart.ui.payFromWallet", { amount: total.toFixed(2) }) : t("user.cart.ui.payOnDeliveryCod")}
                  </p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <svg className="w-7 h-7 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{t("user.cart.ui.deliveringToLocation")}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {defaultAddress ? formatFullAddress(defaultAddress, locationPlaceholderText) || defaultAddress?.formattedAddress || defaultAddress?.address || t("user.cart.ui.address") : t("user.cart.ui.addAddress")}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {defaultAddress ? formatFullAddress(defaultAddress, locationPlaceholderText) || t("user.cart.ui.address") : t("user.cart.ui.address")}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative mb-6">
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-100 ease-linear" style={{
                width: `${orderProgress}%`,
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
              }} />
                </div>
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none" style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 1.5s infinite',
              width: `${orderProgress}%`
            }} />
              </div>

              {/* Cancel Button */}
              <button onClick={() => {
            setShowPlacingOrder(false);
            setIsPlacingOrder(false);
          }} className="w-full text-right">
                <span className="text-green-600 font-semibold text-base hover:text-green-700 transition-colors">
                  {t("common.cancel")}
                </span>
              </button>
            </div>
          </div>
        </div>}

      {/* Order Success Celebration Page */}
      <AnimatePresence>
        {showOrderSuccess && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-100 via-white to-emerald-100 flex flex-col items-center justify-center h-screen w-screen overflow-hidden">
            {/* Decorative Floating Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/30 rounded-full blur-[100px] animate-pulse" />

            {/* Confetti Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(50)].map((_, i) => {
                const left = Math.random() * 100;
                const drift = Math.random() * 40 - 20; // small horizontal drift in px
                const duration = 2 + Math.random() * 2;
                const delay = Math.random() * 5;
                const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                return (
                  <motion.div
                    key={i}
                    initial={{ y: -20, x: 0, rotate: 0 }}
                    animate={{ y: "110vh", x: drift, rotate: 360 }}
                    transition={{ duration, repeat: Infinity, ease: "linear", delay }}
                    className="absolute w-2 h-4 rounded-sm"
                    style={{ left: `${left}%`, backgroundColor: color }}
                  />
                );
              })}
            </div>

            <motion.div initial={{
          opacity: 0,
          scale: 0.9,
          y: 30
        }} animate={{
          opacity: 1,
          scale: 1,
          y: 0
        }} transition={{
          type: "spring",
          damping: 20,
          stiffness: 100,
          delay: 0.1
        }} className="relative z-10 w-[92%] max-w-lg bg-white/70 dark:bg-[#1a1a1a]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] flex flex-col items-center text-center">
              {/* Success Tick Circle */}
              <div className="relative mb-8 md:mb-10">
                <motion.div initial={{
              scale: 0,
              rotate: -45
            }} animate={{
              scale: 1,
              rotate: 0
            }} transition={{
              type: "spring",
              damping: 12,
              stiffness: 200,
              delay: 0.3
            }} className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-full flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(34,197,94,0.4)] relative z-10">
                  <Check className="w-12 h-12 md:w-16 md:h-16 text-white stroke-[3.5px]" />
                </motion.div>

                {/* Animated Rings */}
                {[...Array(3)].map((_, i) => <motion.div key={i} initial={{
              opacity: 0,
              scale: 0.8
            }} animate={{
              opacity: [0, 0.4, 0],
              scale: [1, 1.6, 2.2]
            }} transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: 0.5 + i * 0.8
            }} className="absolute inset-0 border-2 border-green-400 rounded-full" />)}

                {/* Sparkling dots */}
                {[...Array(8)].map((_, i) => <motion.div key={i} initial={{
              opacity: 0,
              scale: 0
            }} animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: [-20, -100],
              x: i % 2 === 0 ? 40 : -40
            }} transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2
            }} className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full" style={{
              transform: `rotate(${i * 45}deg)`
            }} />)}
              </div>

              {/* Order Placed Message (Merged) */}
              <div className="text-center mb-2">
                <h2 className="text-3xl md:text-5xl font-black text-[#FF5200] mb-3 tracking-tight">{t("user.cart.ui.orderPlaced")}</h2>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    {defaultAddress?.city || t("user.cart.ui.yourLocation")}
                  </h3>
                </div>
                <p className="text-base md:text-xl text-gray-600 dark:text-gray-300 font-medium mb-8 md:mb-10">{t("user.cart.ui.orderPreparedWithCare")}</p>
              </div>

              {/* Order Details Preview Card */}
              <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.6
          }} className="w-full bg-white/60 dark:bg-[#0f0f0f]/70 rounded-3xl p-5 mb-8 md:mb-10 border border-white/50 dark:border-white/10 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{t("user.cart.ui.deliveringTo")}</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate max-w-[120px] md:max-w-[160px]">
                      {defaultAddress?.formattedAddress?.split(',')[0] || defaultAddress?.city || t("user.cart.ui.yourLocation")}
                    </p>
                  </div>
                </div>

                <div className="h-10 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2" />

                <div className="text-right flex flex-col items-end">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{t("user.cart.ui.estimatedTime")}</p>
                  <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-100">
                    <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-sm">
                      {placedOrderEtaText || restaurantData?.estimatedDeliveryTime || t("user.cart.ui.defaultEtaLong")}
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.button whileHover={{
            scale: 1.02,
            backgroundColor: "rgba(17, 24, 39, 1)"
          }} whileTap={{
            scale: 0.98
          }} initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.7
          }} onClick={handleGoToOrders} className="w-full h-16 md:h-20 bg-gray-900 text-white rounded-[1.5rem] md:rounded-[2rem] font-black text-lg md:text-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:shadow-gray-300 transition-all flex items-center justify-center gap-3 group">
                {t("user.cart.ui.trackYourOrder")}
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
              </motion.button>

            </motion.div>
          </motion.div>}
      </AnimatePresence>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInBackdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUpBannerSmooth {
          from {
            transform: translateY(100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUpBanner {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmerBanner {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes checkMarkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes slideUpFull {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slideUpModal {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
    </div>;
}
