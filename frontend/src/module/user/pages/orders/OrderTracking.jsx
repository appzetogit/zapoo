import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Share2, RefreshCw, Phone, ChevronRight, MapPin, Home as HomeIcon, MessageSquare, X, Check, Shield, Receipt, CircleSlash, Loader2 } from "lucide-react";
import AnimatedPage from "../../components/AnimatedPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useOrders } from "../../context/OrdersContext";
import { useProfile } from "../../context/ProfileContext";
import { useLocation as useUserLocation } from "../../hooks/useLocation";
import DeliveryTrackingMap from "../../components/DeliveryTrackingMap";
import { orderAPI, restaurantAPI, userAPI, telephonyAPI } from "@/lib/api";
import circleIcon from "@/assets/circleicon.png";
import { useTranslation } from "react-i18next";

const hasOrderBeenPickedUp = apiOrder => {
  const deliveryStatus = apiOrder?.deliveryState?.status;
  const currentPhase = apiOrder?.deliveryState?.currentPhase;

  return apiOrder?.status === 'out_for_delivery' ||
    deliveryStatus === 'reached_pickup' ||
    deliveryStatus === 'order_confirmed' ||
    deliveryStatus === 'en_route_to_delivery' ||
    currentPhase === 'at_pickup' ||
    currentPhase === 'en_route_to_delivery' ||
    currentPhase === 'at_delivery' ||
    currentPhase === 'completed' ||
    Boolean(apiOrder?.deliveryState?.reachedPickupAt) ||
    Boolean(apiOrder?.deliveryState?.orderIdConfirmedAt);
};

const deriveTrackingUiStatus = apiOrder => {
  if (!apiOrder) return 'placed';
  if (apiOrder.status === 'cancelled' || apiOrder.status === 'refunded') return 'cancelled';
  if (apiOrder.status === 'delivered') return 'delivered';
  if (hasOrderBeenPickedUp(apiOrder)) return 'pickup';
  if (apiOrder.status === 'ready') return 'ready';
  if (apiOrder.status === 'preparing') return 'preparing';
  return 'placed';
};

const isOrderCancelable = (apiOrder) => {
  if (!apiOrder) return false;
  const status = String(apiOrder.status || '').toLowerCase().trim();
  const paymentMethod = String(apiOrder?.payment?.method || apiOrder?.paymentMethod || '').toLowerCase().trim();
  const isCod = paymentMethod === 'cash' || paymentMethod === 'cod' || paymentMethod === 'cash on delivery';
  if (isCod && status === 'preparing') return false;
  return !['cancelled', 'delivered', 'ready', 'out_for_delivery', 'refunded', 'failed'].includes(status);
};

const normalizeEntityId = (value) => {
  if (!value && value !== 0) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
};

const normalizePhoneNumber = (value) => (value ? String(value).replace(/[^\d+]/g, "") : "");

const isLocationPlaceholder = (value, translatedPlaceholder) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  const placeholders = new Set(["select location", String(translatedPlaceholder || "").trim().toLowerCase()]);
  return placeholders.has(normalized);
};

// Animated checkmark component
const AnimatedCheckmark = ({
  delay = 0
}) => <motion.svg width="80" height="80" viewBox="0 0 80 80" initial="hidden" animate="visible" className="mx-auto">
    <motion.circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth="4" initial={{
    pathLength: 0,
    opacity: 0
  }} animate={{
    pathLength: 1,
    opacity: 1
  }} transition={{
    duration: 0.5,
    delay,
    ease: "easeOut"
  }} />
    <motion.path d="M24 40 L35 51 L56 30" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{
    pathLength: 0,
    opacity: 0
  }} animate={{
    pathLength: 1,
    opacity: 1
  }} transition={{
    duration: 0.4,
    delay: delay + 0.4,
    ease: "easeOut"
  }} />
  </motion.svg>;

// Real Delivery Map Component with User Live Location
const DeliveryMap = ({
  orderId,
  order,
  isVisible
}) => {
  const { t } = useTranslation();
  const {
    location: userLocation
  } = useUserLocation(); // Get user's live location

  // Get coordinates from order or use defaults (Indore)
  const getRestaurantCoords = () => {
    // Try multiple sources for restaurant coordinates
    let coords = null;

    // Priority 1: restaurantLocation.coordinates (already extracted in transformed order)
    if (order?.restaurantLocation?.coordinates && Array.isArray(order.restaurantLocation.coordinates) && order.restaurantLocation.coordinates.length >= 2) {
      coords = order.restaurantLocation.coordinates;
    }
    // Priority 2: restaurantId.location.coordinates (if restaurantId is populated)
    else if (order?.restaurantId?.location?.coordinates && Array.isArray(order.restaurantId.location.coordinates) && order.restaurantId.location.coordinates.length >= 2) {
      coords = order.restaurantId.location.coordinates;
    }
    // Priority 3: restaurantId.location with latitude/longitude
    else if (order?.restaurantId?.location?.latitude && order?.restaurantId?.location?.longitude) {
      coords = [order.restaurantId.location.longitude, order.restaurantId.location.latitude];
    }
    if (coords && coords.length >= 2) {
      // GeoJSON format is [longitude, latitude]
      const result = {
        lat: coords[1],
        // Latitude is second element
        lng: coords[0] // Longitude is first element
      };
      return result;
    }
    console.warn('⚠️ Restaurant coordinates not found, using default Indore coordinates');
    // Default Indore coordinates
    return {
      lat: 22.7196,
      lng: 75.8577
    };
  };
  const getCustomerCoords = () => {
    if (order?.address?.coordinates) {
      return {
        lat: order.address.coordinates[1],
        lng: order.address.coordinates[0]
      };
    }
    // Default Indore coordinates
    return {
      lat: 22.7196,
      lng: 75.8577
    };
  };

  // Get user's live location coordinates
  const getUserLiveCoords = () => {
    if (userLocation?.latitude && userLocation?.longitude) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      };
    }
    return null;
  };
  const restaurantCoords = getRestaurantCoords();
  const customerCoords = getCustomerCoords();
  const userLiveCoords = getUserLiveCoords();

  // Delivery boy data
  const deliveryBoyData = order?.deliveryPartner ? {
    name: order.deliveryPartner.name || t("user.orderTracking.deliveryPartner"),
    avatar: order.deliveryPartner.avatar || null
  } : null;
  if (!isVisible || !orderId || !order) {
    return <motion.div className="relative h-64 bg-gradient-to-b from-gray-100 to-gray-200" initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 0.5
    }} />;
  }
  return <motion.div className="relative h-64 w-full" initial={{
    opacity: 0
  }} animate={{
    opacity: 1
  }} transition={{
    duration: 0.5
  }}>
      <DeliveryTrackingMap orderId={orderId} restaurantCoords={restaurantCoords} customerCoords={customerCoords} userLiveCoords={userLiveCoords} userLocationAccuracy={userLocation?.accuracy} deliveryBoyData={deliveryBoyData} order={order} />
    </motion.div>;
};

// Section item component
const SectionItem = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  showArrow = true,
  rightContent,
  subtitleClassName = "truncate"
}) => <motion.button onClick={onClick} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0" whileTap={{
  scale: 0.99
}}>
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className={`text-sm text-gray-500 ${subtitleClassName}`}>{subtitle}</p>}
    </div>
    {rightContent || showArrow && <ChevronRight className="w-5 h-5 text-gray-400" />}
  </motion.button>;
export default function OrderTracking() {
  const { t } = useTranslation();
  const {
    orderId
  } = useParams();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const {
    getOrderById
  } = useOrders();
  const {
    userProfile,
    updateUserProfile,
    getDefaultAddress
  } = useProfile();

  // State for order data
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState('placed');
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [editablePhone, setEditablePhone] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [showInstructionsDialog, setShowInstructionsDialog] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [isCallingRestaurant, setIsCallingRestaurant] = useState(false);
  const defaultAddress = getDefaultAddress();
  const customerName = order?.userName || order?.userId?.fullName || order?.userId?.name || userProfile?.fullName || userProfile?.name || t("user.orderTracking.customer");
  const customerPhone = order?.userPhone || order?.userId?.phone || userProfile?.phone || defaultAddress?.phone || "";
  const currentDeliveryInstructions = order?.address?.deliveryInstructions || "";
  useEffect(() => {
    if (!showPhoneDialog) return;
    setEditablePhone(customerPhone || "");
  }, [customerPhone, showPhoneDialog]);

  useEffect(() => {
    if (!showInstructionsDialog) return;
    setDeliveryInstructions(currentDeliveryInstructions);
  }, [currentDeliveryInstructions, showInstructionsDialog]);

  // Poll for order updates (especially when delivery partner accepts)
  // Only poll if delivery partner is not yet assigned to avoid unnecessary updates
  useEffect(() => {
    if (!orderId || !order) return;

    // Skip polling if delivery partner is already assigned and accepted
    const currentDeliveryStatus = order?.deliveryState?.status;
    const currentPhase = order?.deliveryState?.currentPhase;
    const hasDeliveryPartner = currentDeliveryStatus === 'accepted' || currentPhase === 'en_route_to_pickup' || currentPhase === 'at_pickup' || currentPhase === 'en_route_to_delivery';

    // If delivery partner is assigned, reduce polling frequency to 30 seconds
    // If not assigned, poll every 5 seconds to detect assignment
    const pollInterval = hasDeliveryPartner ? 30000 : 5000;
    const interval = setInterval(async () => {
      try {
        const response = await orderAPI.getOrderDetails(orderId);
        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order;

          // Check if delivery state changed (e.g., status became 'accepted')
          const newDeliveryStatus = apiOrder.deliveryState?.status;
          const newPhase = apiOrder.deliveryState?.currentPhase;
          const newOrderStatus = apiOrder.status;
          const currentOrderStatus = order?.status;

          // Check if order was cancelled/refunded
          if ((newOrderStatus === 'cancelled' || newOrderStatus === 'refunded') && currentOrderStatus !== newOrderStatus) {
            setOrderStatus('cancelled');
          }

          // Only update if status actually changed
          if (newDeliveryStatus === 'accepted' || newDeliveryStatus !== currentDeliveryStatus || newPhase !== currentPhase || newOrderStatus !== currentOrderStatus) {
            // Re-fetch and update order (same logic as initial fetch)
            let restaurantCoords = null;
            if (apiOrder.restaurantId?.location?.coordinates && Array.isArray(apiOrder.restaurantId.location.coordinates) && apiOrder.restaurantId.location.coordinates.length >= 2) {
              restaurantCoords = apiOrder.restaurantId.location.coordinates;
            } else if (typeof apiOrder.restaurantId === 'string') {
              try {
                const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
                if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                  const restaurant = restaurantResponse.data.data.restaurant;
                  if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                    restaurantCoords = restaurant.location.coordinates;
                  }
                }
              } catch (err) {
                console.error('❌ Error fetching restaurant details:', err);
              }
            }
            const transformedOrder = {
              ...apiOrder,
              restaurantLocation: restaurantCoords ? {
                coordinates: restaurantCoords
              } : order.restaurantLocation,
              deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
              assignmentInfo: apiOrder.assignmentInfo || null,
              deliveryState: apiOrder.deliveryState || null
            };
            setOrder(transformedOrder);
            setOrderStatus(deriveTrackingUiStatus(apiOrder));
          }
        }
      } catch (err) {
        console.error('Error polling order updates:', err);
      }
    }, pollInterval);
    return () => clearInterval(interval);
  }, [orderId, order?.deliveryState?.status, order?.deliveryState?.currentPhase]);

  // Fetch order from API if not found in context
  useEffect(() => {
    const fetchOrder = async () => {
      // First try to get from context (localStorage)
      const contextOrder = getOrderById(orderId);
      if (contextOrder) {
        // Ensure restaurant location is available in context order
        if (!contextOrder.restaurantLocation?.coordinates && contextOrder.restaurantId?.location?.coordinates) {
          contextOrder.restaurantLocation = {
            coordinates: contextOrder.restaurantId.location.coordinates
          };
        }
        // Also ensure restaurantId is present
        if (!contextOrder.restaurantId && contextOrder.restaurant) {}
        setOrder(contextOrder);
        setLoading(false);
        return;
      }

      // If not in context, fetch from API
      try {
        setLoading(true);
        setError(null);
        const response = await orderAPI.getOrderDetails(orderId);
        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order;

          // Log full API response structure for debugging

          // Extract restaurant location coordinates with multiple fallbacks
          let restaurantCoords = null;

          // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
          if (apiOrder.restaurantId?.location?.coordinates && Array.isArray(apiOrder.restaurantId.location.coordinates) && apiOrder.restaurantId.location.coordinates.length >= 2) {
            restaurantCoords = apiOrder.restaurantId.location.coordinates;
          }
          // Priority 2: restaurantId.location with latitude/longitude properties
          else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
            restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
          }
          // Priority 3: Check if restaurantId is a string ID and fetch restaurant details
          else if (typeof apiOrder.restaurantId === 'string') {
            try {
              const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
              if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                const restaurant = restaurantResponse.data.data.restaurant;
                if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                  restaurantCoords = restaurant.location.coordinates;
                }
              }
            } catch (err) {
              console.error('❌ Error fetching restaurant details:', err);
            }
          }
          // Priority 4: Check nested restaurant data
          else if (apiOrder.restaurant?.location?.coordinates) {
            restaurantCoords = apiOrder.restaurant.location.coordinates;
          }
          // Transform API order to match component structure
          const transformedOrder = {
            id: apiOrder.orderId || apiOrder._id,
            restaurant: apiOrder.restaurantName || t("user.orderTracking.restaurant"),
            restaurantId: apiOrder.restaurantId || null,
            // Include restaurantId for location access
            userId: apiOrder.userId || null,
            // Include user data for phone number
            userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
            userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
            address: {
              street: apiOrder.address?.street || '',
              city: apiOrder.address?.city || '',
              state: apiOrder.address?.state || '',
              zipCode: apiOrder.address?.zipCode || '',
              additionalDetails: apiOrder.address?.additionalDetails || '',
              formattedAddress: apiOrder.address?.formattedAddress || (apiOrder.address?.street && apiOrder.address?.city ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}` : apiOrder.address?.city || ''),
              coordinates: apiOrder.address?.location?.coordinates || null
            },
            restaurantLocation: {
              coordinates: restaurantCoords
            },
            items: apiOrder.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price
            })) || [],
            total: apiOrder.pricing?.total || 0,
            status: apiOrder.status || 'pending',
            deliveryPartner: apiOrder.deliveryPartnerId ? {
              name: apiOrder.deliveryPartnerId.name || t("user.orderTracking.deliveryPartner"),
              avatar: null
            } : null,
            deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
            assignmentInfo: apiOrder.assignmentInfo || null,
            tracking: apiOrder.tracking || {},
            deliveryState: apiOrder.deliveryState || null
          };
          setOrder(transformedOrder);
          setOrderStatus(deriveTrackingUiStatus(apiOrder));
        } else {
          throw new Error(t("user.orderTracking.orderNotFound"));
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError(err.response?.data?.message || err.message || t("user.orderTracking.failedToFetchOrder"));
      } finally {
        setLoading(false);
      }
    };
    if (orderId) {
      fetchOrder();
    }
  }, [orderId, getOrderById]);

  // Simulate order status progression
  useEffect(() => {
    if (confirmed) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false);
      }, 3000);
      return () => clearTimeout(timer1);
    }
  }, [confirmed]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEstimatedTime(prev => Math.max(0, prev - 1));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Listen for order status updates from socket (e.g., "Delivery partner on the way")
  useEffect(() => {
    const handleOrderStatusNotification = event => {
      const {
        message,
        title,
        status,
        estimatedDeliveryTime
      } = event.detail;
      // Update order status in UI
      if (status === 'out_for_delivery') {
        setOrderStatus('on_way');
      }

      // Show notification toast
      if (message) {
        toast.success(message, {
          duration: 5000,
          icon: '🏍️',
          position: 'top-center',
          description: estimatedDeliveryTime ? t("user.orderTracking.estimatedDeliveryInMins", { mins: Math.round(estimatedDeliveryTime / 60) }) : undefined
        });

        // Optional: Vibrate device if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    };

    // Listen for custom event from DeliveryTrackingMap
    window.addEventListener('orderStatusNotification', handleOrderStatusNotification);
    return () => {
      window.removeEventListener('orderStatusNotification', handleOrderStatusNotification);
    };
  }, []);
  const handleCancelOrder = () => {
    // Check if order can be cancelled (only Razorpay orders that aren't delivered/cancelled)
    if (!order) return;
    if (order.status === 'cancelled') {
      toast.error(t("user.orderTracking.toast.orderAlreadyCancelled"));
      return;
    }
    if (order.status === 'delivered') {
      toast.error(t("user.orderTracking.toast.cannotCancelDelivered"));
      return;
    }
    if (order.status === 'ready') {
      toast.error("Order cannot be cancelled after preparation is complete.");
      return;
    }
    if (order.status === 'out_for_delivery') {
      toast.error("Order cannot be cancelled once it is out for delivery.");
      return;
    }
    const paymentMethod = String(order?.payment?.method || order?.paymentMethod || '').toLowerCase().trim();
    const isCod = paymentMethod === 'cash' || paymentMethod === 'cod' || paymentMethod === 'cash on delivery';
    if (isCod && order.status === 'preparing') {
      toast.error("COD order cannot be cancelled once preparation has started.");
      return;
    }

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    setShowCancelDialog(true);
  };

  const handleCallRestaurantMasked = async () => {
    if (!order) return;

    if (order.status === "cancelled" || order.status === "delivered") {
      toast.error(t("user.orderTracking.toast.callsNotAllowed"));
      return;
    }

    const businessOrderId = order.id || order.orderId || orderId;

    if (!businessOrderId) {
      toast.error(t("user.orderTracking.toast.orderIdNotAvailable"));
      return;
    }

    try {
      // DEBUG: trace the masked-call button click for restaurant calls from the tracking screen
      console.log("[MASKING][FRONTEND][CLICK]", {
        screen: "OrderTracking",
        targetRole: "restaurant",
        orderId: businessOrderId,
        timestamp: new Date(),
      });
      setIsCallingRestaurant(true);
      await telephonyAPI.initiateMaskedCall({
        orderId: businessOrderId,
        targetRole: "restaurant",
      });
      toast.success(t("user.orderTracking.toast.callConnectingToRestaurant"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("user.orderTracking.toast.failedToInitiateMaskedCall"));
    } finally {
      setIsCallingRestaurant(false);
    }
  };
  const handleSavePhone = async () => {
    const trimmedPhone = editablePhone.trim();
    try {
      setIsSavingPhone(true);
      await userAPI.updateProfile({
        phone: trimmedPhone
      });
      updateUserProfile({
        phone: trimmedPhone || null
      });
      setOrder(prev => prev ? {
        ...prev,
        userPhone: trimmedPhone || null
      } : prev);
      toast.success(t("user.orderTracking.toast.customerNumberUpdated"));
      setShowPhoneDialog(false);
    } catch (error) {
      console.error("Error updating customer number:", error);
      toast.error(error?.response?.data?.message || t("user.orderTracking.toast.failedToUpdateCustomerNumber"));
    } finally {
      setIsSavingPhone(false);
    }
  };
  const handleSaveDeliveryInstructions = async () => {
    try {
      setIsSavingInstructions(true);
      const trimmedInstructions = deliveryInstructions.trim();
      await orderAPI.updateDeliveryInstructions(orderId, trimmedInstructions);
      setOrder(prev => prev ? {
        ...prev,
        address: {
          ...(prev.address || {}),
          deliveryInstructions: trimmedInstructions
        }
      } : prev);
      toast.success(trimmedInstructions ? t("user.orderTracking.toast.deliveryInstructionsUpdated") : t("user.orderTracking.toast.deliveryInstructionsCleared"));
      setShowInstructionsDialog(false);
    } catch (error) {
      console.error("Error updating delivery instructions:", error);
      toast.error(error?.response?.data?.message || t("user.orderTracking.toast.failedToUpdateDeliveryInstructions"));
    } finally {
      setIsSavingInstructions(false);
    }
  };
  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error(t("user.orderTracking.toast.provideCancellationReason"));
      return;
    }
    setIsCancelling(true);
    try {
      const response = await orderAPI.cancelOrder(orderId, cancellationReason.trim());
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message || (paymentMethod === 'cash' || paymentMethod === 'cod' ? t("user.orderTracking.toast.orderCancelledNoRefund") : t("user.orderTracking.toast.orderCancelledRefundInitiated"));
        toast.success(successMessage);
        setShowCancelDialog(false);
        setCancellationReason("");
        // Refresh order data
        const orderResponse = await orderAPI.getOrderDetails(orderId);
        if (orderResponse.data?.success && orderResponse.data.data?.order) {
          const apiOrder = orderResponse.data.data.order;
          setOrder(apiOrder);
          setOrderStatus(deriveTrackingUiStatus(apiOrder));
        }
      } else {
        toast.error(response.data?.message || t("user.orderTracking.toast.failedToCancelOrder"));
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(error.response?.data?.message || t("user.orderTracking.toast.failedToCancelOrder"));
    } finally {
      setIsCancelling(false);
    }
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await orderAPI.getOrderDetails(orderId);
      if (response.data?.success && response.data.data?.order) {
        const apiOrder = response.data.data.order;

        // Extract restaurant location coordinates with multiple fallbacks
        let restaurantCoords = null;

        // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
        if (apiOrder.restaurantId?.location?.coordinates && Array.isArray(apiOrder.restaurantId.location.coordinates) && apiOrder.restaurantId.location.coordinates.length >= 2) {
          restaurantCoords = apiOrder.restaurantId.location.coordinates;
        }
        // Priority 2: restaurantId.location with latitude/longitude properties
        else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
          restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
        }
        // Priority 3: Check nested restaurant data
        else if (apiOrder.restaurant?.location?.coordinates) {
          restaurantCoords = apiOrder.restaurant.location.coordinates;
        }
        // Priority 4: Check if restaurantId is a string ID and fetch restaurant details
        else if (typeof apiOrder.restaurantId === 'string') {
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              const restaurant = restaurantResponse.data.data.restaurant;
              if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                restaurantCoords = restaurant.location.coordinates;
              }
            }
          } catch (err) {
            console.error('❌ Error fetching restaurant details:', err);
          }
        }
        const transformedOrder = {
          id: apiOrder.orderId || apiOrder._id,
          restaurant: apiOrder.restaurantName || t("user.orderTracking.restaurant"),
          restaurantId: apiOrder.restaurantId || null,
          // Include restaurantId for location access
          userId: apiOrder.userId || null,
          // Include user data for phone number
          userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
          userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
          address: {
            street: apiOrder.address?.street || '',
            city: apiOrder.address?.city || '',
            state: apiOrder.address?.state || '',
            zipCode: apiOrder.address?.zipCode || '',
            additionalDetails: apiOrder.address?.additionalDetails || '',
            formattedAddress: apiOrder.address?.formattedAddress || (apiOrder.address?.street && apiOrder.address?.city ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}` : apiOrder.address?.city || ''),
            coordinates: apiOrder.address?.location?.coordinates || null
          },
          restaurantLocation: {
            coordinates: restaurantCoords
          },
          items: apiOrder.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })) || [],
          total: apiOrder.pricing?.total || 0,
          status: apiOrder.status || 'pending',
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || t("user.orderTracking.deliveryPartner"),
            avatar: null
          } : null,
          deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
          assignmentInfo: apiOrder.assignmentInfo || null,
          tracking: apiOrder.tracking || {},
          deliveryState: apiOrder.deliveryState || null
        };
        setOrder(transformedOrder);
        setOrderStatus(deriveTrackingUiStatus(apiOrder));
      }
    } catch (err) {
      console.error('Error refreshing order:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Loading state
  if (loading) {
    return <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">{t("user.orderTracking.loadingOrderDetails")}</p>
        </div>
      </AnimatedPage>;
  }

  // Error state
  if (error || !order) {
    return <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">{t("user.orderTracking.orderNotFound")}</h1>
          <p className="text-gray-600 mb-6">{error || t("user.orderTracking.orderNotFoundDescription")}</p>
          <Link to="/user/orders">
            <Button>{t("user.orderTracking.backToOrders")}</Button>
          </Link>
        </div>
      </AnimatedPage>;
  }
  const statusConfig = {
    placed: {
      title: t("user.orderTracking.status.placed.title"),
      subtitle: t("user.orderTracking.status.placed.subtitle"),
      color: "bg-green-700"
    },
    preparing: {
      title: t("user.orderTracking.status.preparing.title"),
      subtitle: t("user.orderTracking.status.preparing.subtitle", { mins: estimatedTime }),
      color: "bg-green-700"
    },
    ready: {
      title: t("user.orderTracking.status.ready.title"),
      subtitle: t("user.orderTracking.status.ready.subtitle"),
      color: "bg-green-700"
    },
    pickup: {
      title: t("user.orderTracking.status.pickup.title"),
      subtitle: t("user.orderTracking.status.pickup.subtitle", { mins: estimatedTime }),
      color: "bg-green-700"
    },
    delivered: {
      title: t("user.orderTracking.status.delivered.title"),
      subtitle: t("user.orderTracking.status.delivered.subtitle"),
      color: "bg-green-600"
    },
    cancelled: {
      title: t("user.orderTracking.status.cancelled.title"),
      subtitle: t("user.orderTracking.status.cancelled.subtitle"),
      color: "bg-red-600"
    }
  };
  const currentStatus = statusConfig[orderStatus] || statusConfig.placed;
  return <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center">
            <motion.div initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} transition={{
          delay: 0.2,
          type: "spring"
        }} className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1 initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.9
          }} className="text-2xl font-bold text-gray-900 mt-6">
                {t("user.orderTracking.orderConfirmed")}
              </motion.h1>
              <motion.p initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 1.1
          }} className="text-gray-600 mt-2">
                {t("user.orderTracking.orderPlacedSuccessfully")}
              </motion.p>
              <motion.div initial={{
            opacity: 0
          }} animate={{
            opacity: 1
          }} transition={{
            delay: 1.5
          }} className="mt-8">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">{t("user.orderTracking.loadingOrderDetails")}</p>
              </motion.div>
            </motion.div>
          </motion.div>}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div className={`${currentStatus.color} text-white sticky top-0 z-40`} initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }}>
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/user/orders">
            <motion.button className="w-10 h-10 flex items-center justify-center" whileTap={{
            scale: 0.9
          }}>
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.restaurant}</h2>
          <motion.button className="w-10 h-10 flex items-center justify-center" whileTap={{
          scale: 0.9
        }}>
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1 className="text-2xl font-bold mb-3" key={currentStatus.title} initial={{
          opacity: 0,
          y: -10
        }} animate={{
          opacity: 1,
          y: 0
        }}>
            {currentStatus.title}
          </motion.h1>
          
          {/* Status pill */}
          <motion.div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2" initial={{
          scale: 0.9,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} transition={{
          delay: 0.2
        }}>
            <span className="text-sm">{currentStatus.subtitle}</span>
            {orderStatus === 'preparing' && <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-green-200">{t("user.orderTracking.onTime")}</span>
              </>}
            <motion.button onClick={handleRefresh} className="ml-1" animate={{
            rotate: isRefreshing ? 360 : 0
          }} transition={{
            duration: 0.5
          }}>
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      <DeliveryMap orderId={orderId} order={order} isVisible={!showConfirmation && order !== null} />

      {/* Scrollable Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">
        {/* Food Cooking Status - Show until delivery partner accepts pickup */}
        {(() => {
        const hasAcceptedPickup = hasOrderBeenPickedUp(order);
        const isReadyForPickup = order?.status === 'ready' && !hasAcceptedPickup;

        if (isReadyForPickup) {
          return <motion.div className="bg-white rounded-xl p-4 shadow-sm" initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.3
          }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center overflow-hidden">
                    <img src={circleIcon} alt={t("user.orderTracking.orderReadyAlt")} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-semibold text-gray-900">{t("user.orderTracking.orderReadyForPickup")}</p>
                </div>
              </motion.div>;
        }

        // Show "Food is Cooking" until the delivery partner actually picks up the order
        if (!hasAcceptedPickup) {
          return <motion.div className="bg-white rounded-xl p-4 shadow-sm" initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.3
          }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
                    <img src={circleIcon} alt={t("user.orderTracking.foodCookingAlt")} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-semibold text-gray-900">{t("user.orderTracking.foodIsCooking")}</p>
                </div>
              </motion.div>;
        }

        // Don't show card if delivery partner has accepted pickup
        return null;
      })()}

        {/* Delivery Partner Safety */}
        <motion.button className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.6
      }} whileTap={{
        scale: 0.99
      }}>
          <Shield className="w-6 h-6 text-gray-600" />
          <span className="flex-1 text-left font-medium text-gray-900">
            {t("user.orderTracking.learnSafety")}
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </motion.button>

        {/* Delivery Details Banner */}
        <motion.div className="bg-yellow-50 rounded-xl p-4 text-center" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.65
      }}>
          <p className="text-yellow-800 font-medium">
            {t("user.orderTracking.deliveryDetailsBanner")}
          </p>
        </motion.div>

        {/* Contact & Address Section */}
        <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.7
      }}>
          <SectionItem icon={Phone} title={customerName} subtitle={customerPhone || t("user.orderTracking.phoneNumberUnavailable")} onClick={() => setShowPhoneDialog(true)} rightContent={<span className="text-green-600 font-medium text-sm">{t("user.orderTracking.edit")}</span>} />
          <SectionItem icon={HomeIcon} title={t("user.orderTracking.deliveryAtLocation")} subtitle={(() => {
          // Priority 1: Use order address formattedAddress (live location address)
          if (order?.address?.formattedAddress && !isLocationPlaceholder(order.address.formattedAddress, t("user.locationDisplay.selectLocation"))) {
            return order.address.formattedAddress;
          }

          // Priority 2: Build full address from order address parts
          if (order?.address) {
            const orderAddressParts = [];
            if (order.address.street) orderAddressParts.push(order.address.street);
            if (order.address.additionalDetails) orderAddressParts.push(order.address.additionalDetails);
            if (order.address.city) orderAddressParts.push(order.address.city);
            if (order.address.state) orderAddressParts.push(order.address.state);
            if (order.address.zipCode) orderAddressParts.push(order.address.zipCode);
            if (orderAddressParts.length > 0) {
              return orderAddressParts.join(', ');
            }
          }

          // Priority 3: Use defaultAddress formattedAddress (live location address)
          if (defaultAddress?.formattedAddress && !isLocationPlaceholder(defaultAddress.formattedAddress, t("user.locationDisplay.selectLocation"))) {
            return defaultAddress.formattedAddress;
          }

          // Priority 4: Build full address from defaultAddress parts
          if (defaultAddress) {
            const defaultAddressParts = [];
            if (defaultAddress.street) defaultAddressParts.push(defaultAddress.street);
            if (defaultAddress.additionalDetails) defaultAddressParts.push(defaultAddress.additionalDetails);
            if (defaultAddress.city) defaultAddressParts.push(defaultAddress.city);
            if (defaultAddress.state) defaultAddressParts.push(defaultAddress.state);
            if (defaultAddress.zipCode) defaultAddressParts.push(defaultAddress.zipCode);
            if (defaultAddressParts.length > 0) {
              return defaultAddressParts.join(', ');
            }
          }
          return t("user.orderTracking.addDeliveryAddress");
        })()} showArrow={false} subtitleClassName="whitespace-normal break-words leading-5" />
          <SectionItem icon={MessageSquare} title={t("user.orderTracking.addDeliveryInstructions")} subtitle={currentDeliveryInstructions || t("user.orderTracking.helpDeliveryPartner")} onClick={() => setShowInstructionsDialog(true)} subtitleClassName={currentDeliveryInstructions ? "whitespace-normal break-words leading-5" : "truncate"} />
        </motion.div>

        {/* Restaurant Section */}
        <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.75
      }}>
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🍔</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{order.restaurant}</p>
              <p className="text-sm text-gray-500">{order.address?.city || t("user.orderTracking.localArea")}</p>
            </div>
            <motion.button
              type="button"
              onClick={handleCallRestaurantMasked}
              disabled={isCallingRestaurant || order.status === "cancelled" || order.status === "delivered"}
              className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{
                scale: 0.9
              }}
            >
              {isCallingRestaurant ? (
                <Loader2 className="w-5 h-5 text-green-700 animate-spin" />
              ) : (
                <Phone className="w-5 h-5 text-green-700" />
              )}
            </motion.button>
          </div>

          {/* Order Items */}
          <div className="p-4 border-b border-dashed border-gray-200">
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{t("user.orderTracking.orderNumber", { id: order?.id || order?.orderId || t("user.orderTracking.na") })}</p>
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                      </span>
                      <span>{item.quantity} x {item.name}</span>
                    </div>)}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {/* Help Section */}
        {isOrderCancelable(order) && <motion.div className="bg-white rounded-xl shadow-sm overflow-hidden" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.8
      }}>
          <SectionItem icon={CircleSlash} title={t("user.orderTracking.cancelOrder")} subtitle="" onClick={handleCancelOrder} />
        </motion.div>}

      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent className="w-[92%] max-w-[360px] overflow-hidden rounded-[24px] border-0 p-0 shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-full [&>button]:border [&>button]:border-green-100 [&>button]:bg-white [&>button]:text-gray-500 [&>button]:opacity-100">
          <div className="h-1.5 w-full bg-green-600" />
          <div className="px-5 pb-5 pt-4">
            <DialogHeader className="space-y-1 border-b border-green-50 pb-4 text-left">
              <DialogTitle className="text-lg font-semibold text-gray-900">
              {t("user.orderTracking.editCustomerNumber")}
              </DialogTitle>
              <p className="pr-8 text-sm leading-5 text-gray-500">
                {t("user.orderTracking.editCustomerNumberDesc")}
              </p>
            </DialogHeader>
            <div className="space-y-2 pt-4">
              <label className="block text-sm font-medium text-gray-700">
                {t("user.orderTracking.phoneNumber")}
              </label>
              <div className="rounded-2xl border border-green-100 bg-green-50/50 p-2">
                <input
                  type="tel"
                  value={editablePhone}
                  onChange={e => setEditablePhone(e.target.value)}
                  placeholder={t("user.orderTracking.enterPhoneNumber")}
                  className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  disabled={isSavingPhone}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl border-gray-200 text-gray-700" onClick={() => setShowPhoneDialog(false)} disabled={isSavingPhone}>
                {t("common.cancel")}
              </Button>
              <Button type="button" className="h-11 flex-1 rounded-xl bg-green-600 text-white shadow-sm hover:bg-green-700" onClick={handleSavePhone} disabled={isSavingPhone}>
                {isSavingPhone ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstructionsDialog} onOpenChange={setShowInstructionsDialog}>
        <DialogContent className="w-[92%] max-w-[380px] overflow-hidden rounded-[24px] border-0 p-0 shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-full [&>button]:border [&>button]:border-green-100 [&>button]:bg-white [&>button]:text-gray-500 [&>button]:opacity-100">
          <div className="h-1.5 w-full bg-green-600" />
          <div className="px-5 pb-5 pt-4">
            <DialogHeader className="space-y-1 border-b border-green-50 pb-4 text-left">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {t("user.orderTracking.deliveryInstructions")}
              </DialogTitle>
              <p className="pr-8 text-sm leading-5 text-gray-500">
                {t("user.orderTracking.deliveryInstructionsDesc")}
              </p>
            </DialogHeader>
            <div className="space-y-2 pt-4">
              <label className="block text-sm font-medium text-gray-700">
                {t("user.orderTracking.instructions")}
              </label>
              <div className="rounded-2xl border border-green-100 bg-green-50/50 p-2">
                <Textarea
                  value={deliveryInstructions}
                  onChange={e => setDeliveryInstructions(e.target.value)}
                  placeholder={t("user.orderTracking.instructionsPlaceholder")}
                  className="min-h-[120px] w-full resize-none rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  disabled={isSavingInstructions}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl border-gray-200 text-gray-700" onClick={() => setShowInstructionsDialog(false)} disabled={isSavingInstructions}>
                {t("common.cancel")}
              </Button>
              <Button type="button" className="h-11 flex-1 rounded-xl bg-green-600 text-white shadow-sm hover:bg-green-700" onClick={handleSaveDeliveryInstructions} disabled={isSavingInstructions}>
                {isSavingInstructions ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {t("user.orderTracking.cancelOrder")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-6 px-2">
            <div className="space-y-2 w-full">
              <Textarea value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} placeholder={t("user.orderTracking.cancellationReasonPlaceholder")} className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200" disabled={isCancelling} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => {
              setShowCancelDialog(false);
              setCancellationReason("");
            }} disabled={isCancelling} className="flex-1">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleConfirmCancel} disabled={isCancelling || !cancellationReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {isCancelling ? <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("user.orderTracking.cancelling")}
                  </> : t("user.orderTracking.confirmCancellation")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}
