import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { determineStepToShow } from "../utils/onboardingUtils";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import { Printer, Volume2, VolumeX, ChevronDown, ChevronUp, Minus, Plus, X, AlertCircle, Loader2, Calendar, Clock, Users, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import BottomNavOrders from "../components/BottomNavOrders";
import RestaurantNavbar from "../components/RestaurantNavbar";
import notificationSound from "@/assets/audio/alert.mp3";
import { restaurantAPI, api, telephonyAPI } from "@/lib/api";
import { useRestaurantNotifications } from "../hooks/useRestaurantNotifications";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import SubscriptionRenewalPopup from "../components/SubscriptionRenewalPopup";
import SubscriptionExpiryBanner from "../components/SubscriptionExpiryBanner";
import useSubscriptionExpiryNotice from "../hooks/useSubscriptionExpiryNotice";
const STORAGE_KEY = "restaurant_online_status";
const ORDERS_FILTER_STORAGE_KEY = "restaurant_orders_active_filter";
const ONBOARDING_SESSION_KEY = "restaurant_onboarding_session";

// Top filter tabs
const filterTabs = [{
  id: "preparing",
  label: "Preparing"
}, {
  id: "ready",
  label: "Ready"
}, {
  id: "out-for-delivery",
  label: "Out for delivery"
}, {
  id: "completed",
  label: "Completed"
}, {
  id: "cancelled",
  label: "Cancelled"
}];

function Row({
  label,
  value,
  bold = false,
  valueClass = ""
}) {
  return <div className="flex items-center justify-between gap-3">
    <span className={`${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
    <span className={`${bold ? 'font-semibold text-gray-900' : 'text-gray-800'} ${valueClass}`}>{value}</span>
  </div>;
}

// Completed Orders List Component
function CompletedOrders({
  onSelectOrder
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders();
        if (!isMounted) return;
        if (response.data?.success && response.data.data?.orders) {
          const completedOrders = response.data.data.orders.filter(order => order.status === 'delivered' || order.status === 'completed');
          const transformedOrders = completedOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'delivered',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            deliveredAt: order.deliveredAt || order.updatedAt || order.createdAt,
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            amount: order.pricing?.total || order.total || 0
          }));
          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.deliveredAt);
            const dateB = new Date(b.deliveredAt);
            return dateB - dateA;
          });
          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching completed orders:', error);
        }
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };
    fetchOrders();
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders();
      }
    }, 10000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);
  if (loading) {
    return <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-[#3B82F6]">Completed orders</h2>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
      <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
    </div>;
  }
  return <div className="pt-4 pb-6">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-[#3B82F6]">
        Completed orders
      </h2>
      <span className="text-xs text-gray-500">{orders.length} total</span>
    </div>
    {orders.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">
      No completed orders yet
    </div> : <div>
      {orders.map(order => {
        const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A';
        return <div key={order.orderId || order.mongoId} className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
          <button type="button" onClick={() => onSelectOrder?.({
            orderId: order.orderId,
            mongoId: order.mongoId,
            status: 'Delivered',
            customerName: order.customerName,
            type: order.type,
            tableOrToken: order.tableOrToken,
            timePlaced: deliveredDate,
            itemsSummary: order.itemsSummary,
            amount: order.amount
          })} className="w-full text-left flex gap-3 items-stretch">
            <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
              {order.photoUrl ? <img src={order.photoUrl} alt={order.photoAlt} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                  {order.photoAlt}
                </span>
              </div>}
            </div>

            <div className="flex-1 flex flex-col justify-between min-h-[80px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-black leading-tight">
                    Order #{order.orderId}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {order.customerName}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-green-500 text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Delivered
                  </span>
                  <span className="text-[11px] text-gray-500 text-right">
                    {deliveredDate}
                  </span>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-xs text-gray-600 line-clamp-1">
                  {order.itemsSummary}
                </p>
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-gray-500">
                    {order.type}
                  </p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] text-gray-500">Amount</span>
                  <span className="text-xs font-medium text-black">
                    ₹{order.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>;
      })}
    </div>}
  </div>;
}

// Cancelled Orders List Component
function CancelledOrders({
  onSelectOrder,
  refreshKey = 0,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    const fetchOrders = async () => {
      try {
        const response = await restaurantAPI.getOrders({
          status: 'cancelled',
          limit: 200,
          page: 1,
        });
        if (!isMounted) return;
        if (response.data?.success && response.data.data?.orders) {
          const cancelledOrders = response.data.data.orders.filter(
            (order) => String(order.status || '').toLowerCase() === 'cancelled'
          );
          const transformedOrders = cancelledOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'cancelled',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            cancelledAt: order.cancelledAt || order.updatedAt || order.createdAt,
            cancelledBy: order.cancelledBy || 'unknown',
            cancellationReason: order.cancellationReason || 'No reason provided',
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            amount: order.pricing?.total || order.total || 0
          }));
          transformedOrders.sort((a, b) => {
            const dateA = new Date(a.cancelledAt);
            const dateB = new Date(b.cancelledAt);
            return dateB - dateA;
          });
          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching cancelled orders:', error);
        }
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };
    fetchOrders();
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders();
      }
    }, 10000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshKey]);
  if (loading) {
    return <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-[#3B82F6]">Cancelled orders</h2>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
      <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
    </div>;
  }
  const autoCancelOrder = orders.find(order => order.cancellationReason === 'Delivery partner unavailable');
  return <div className="pt-4 pb-6">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-[#3B82F6]">
        Cancelled orders
      </h2>
      <span className="text-xs text-gray-500">{orders.length} total</span>
    </div>
    {autoCancelOrder && <div className="mb-3 rounded-xl border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
      Delivery boy not assigned. Order cancelled due to unavailability.
    </div>}
    {orders.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">
      No cancelled orders yet
    </div> : <div>
      {orders.map(order => {
        const cancelledDate = order.cancelledAt ? new Date(order.cancelledAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A';
        const cancelledByText = order.cancelledBy === 'user' ? 'Cancelled by User' : order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant' : 'Cancelled';
        return <div key={order.orderId || order.mongoId} className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200">
          <button type="button" onClick={() => onSelectOrder?.({
            orderId: order.orderId,
            mongoId: order.mongoId,
            status: 'Cancelled',
            customerName: order.customerName,
            type: order.type,
            tableOrToken: order.tableOrToken,
            timePlaced: cancelledDate,
            itemsSummary: order.itemsSummary,
            amount: order.amount
          })} className="w-full text-left flex gap-3 items-stretch">
            <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
              {order.photoUrl ? <img src={order.photoUrl} alt={order.photoAlt} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
                <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
                  {order.photoAlt}
                </span>
              </div>}
            </div>

            <div className="flex-1 flex flex-col justify-between min-h-[80px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-black leading-tight">
                    Order #{order.orderId}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {order.customerName}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${order.cancelledBy === 'user' ? 'border-blue-500 text-blue-600' : 'border-red-500 text-red-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${order.cancelledBy === 'user' ? 'bg-blue-500' : 'bg-red-500'}`} />
                    {cancelledByText}
                  </span>
                  <span className="text-[11px] text-gray-500 text-right">
                    {cancelledDate}
                  </span>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-xs text-gray-600 line-clamp-1">
                  {order.itemsSummary}
                </p>
                {order.cancellationReason && <p className="text-[10px] text-red-600 mt-1 line-clamp-1">
                  Reason: {order.cancellationReason}
                </p>}
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-gray-500">
                    {order.type}
                  </p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[11px] text-gray-500">Amount</span>
                  <span className="text-xs font-medium text-black">
                    ₹{order.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>;
      })}
    </div>}
  </div>;
}
export default function OrdersMain() {
  const navigate = useNavigate();
  const expiryNotice = useSubscriptionExpiryNotice();
  const [activeFilter, setActiveFilter] = useState(() => {
    if (typeof window === "undefined") return "preparing";
    const savedFilter = window.sessionStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
    const isValidFilter = filterTabs.some(tab => tab.id === savedFilter);
    return isValidFilter ? savedFilter : "preparing";
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const contentRef = useRef(null);
  const filterBarRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const mouseStartX = useRef(0);
  const mouseEndX = useRef(0);
  const isMouseDown = useRef(false);

  // New order popup states
  const [showNewOrderPopup, setShowNewOrderPopup] = useState(false);
  const [popupOrder, setPopupOrder] = useState(null); // Store order for popup (from Socket.IO or API)
  const [isMuted, setIsMuted] = useState(false);
  const [prepTime, setPrepTime] = useState(11);
  const [countdown, setCountdown] = useState(240); // 4 minutes in seconds
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [ordersListVersion, setOrdersListVersion] = useState(0);
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const shownOrdersRef = useRef(new Set()); // Track orders already shown in popup
  const [restaurantStatus, setRestaurantStatus] = useState({
    isActive: null,
    rejectionReason: null,
    onboarding: null,
    isLoading: true,
    restaurantId: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(ORDERS_FILTER_STORAGE_KEY, activeFilter);
  }, [activeFilter]);

  // Restaurant notifications hook for real-time orders
  const {
    newOrder,
    lastOrderStatusUpdate,
    clearNewOrder,
    clearLastOrderStatusUpdate,
    isConnected
  } = useRestaurantNotifications();
  const rejectReasons = ["Restaurant is too busy", "Item not available", "Outside delivery area", "Kitchen closing soon", "Technical issue", "Other reason"];

  // Fetch restaurant verification status
  useEffect(() => {
    const fetchRestaurantStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant;
        if (restaurant) {
          setRestaurantStatus({
            isActive: restaurant.isActive,
            rejectionReason: restaurant.rejectionReason || null,
            onboarding: restaurant.onboarding || null,
            isLoading: false,
            restaurantId: restaurant.id || restaurant._id || restaurant.restaurantId || null,
          });

          // Keep onboarding routing aligned with shared 3-step utility logic.
          const incompleteStep = determineStepToShow(restaurant.onboarding);
          if (incompleteStep) {
            navigate(`/restaurant/onboarding?step=${incompleteStep}`, {
              replace: true
            });
            return;
          }
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant status:", error);
        }
        // Set loading to false so UI doesn't stay in loading state
        setRestaurantStatus(prev => ({
          ...prev,
          isLoading: false
        }));
      }
    };
    fetchRestaurantStatus();

    // Listen for restaurant profile updates
    const handleProfileRefresh = () => {
      fetchRestaurantStatus();
    };
    window.addEventListener('restaurantProfileRefresh', handleProfileRefresh);
    return () => {
      window.removeEventListener('restaurantProfileRefresh', handleProfileRefresh);
    };
  }, [navigate]);

  // Handle reverify (resubmit for approval)
  const handleReverify = async () => {
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, "1");
    navigate("/restaurant/onboarding?step=1", { replace: true });
  };

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
    };
  }, []);

  // Show new order popup when real order notification arrives from Socket.IO
  useEffect(() => {
    if (newOrder) {
      const orderId = newOrder.orderId || newOrder.orderMongoId;
      if (orderId && !shownOrdersRef.current.has(orderId)) {
        shownOrdersRef.current.add(orderId);
        setPopupOrder(newOrder);
        setShowNewOrderPopup(true);
        setCountdown(240); // Reset countdown to 4 minutes
      }
    }
  }, [newOrder]);

  // Auto-dismiss popup if order status changed to a terminal/non-actionable state.
  useEffect(() => {
    if (!lastOrderStatusUpdate) return;

    const normalizedUpdateStatus = String(lastOrderStatusUpdate.status || '').toLowerCase().trim();
    if (normalizedUpdateStatus === 'cancelled') {
      toast.info(lastOrderStatusUpdate.message || 'Order was cancelled and removed from pending requests.');
    } else if (lastOrderStatusUpdate.message) {
      toast.info(lastOrderStatusUpdate.message);
    }

    const activePopupOrder = popupOrder || newOrder;
    const activePopupOrderId = activePopupOrder?.orderId || activePopupOrder?.orderMongoId;
    if (!activePopupOrderId) {
      clearLastOrderStatusUpdate();
      return;
    }

    const updateOrderId = lastOrderStatusUpdate.orderId;
    const normalizedPopupStatus = String(lastOrderStatusUpdate.status || '').toLowerCase().trim();
    if (updateOrderId === activePopupOrderId && ['cancelled', 'ready', 'out_for_delivery', 'delivered', 'refunded', 'failed'].includes(normalizedPopupStatus)) {
      setShowNewOrderPopup(false);
      setShowRejectPopup(false);
      setPopupOrder(null);
      clearNewOrder();
      setRejectReason("");
      setCountdown(240);
      setPrepTime(11);
    }
    clearLastOrderStatusUpdate();
  }, [lastOrderStatusUpdate, popupOrder, newOrder, clearNewOrder, clearLastOrderStatusUpdate]);

  // Fallback: while popup is open, periodically verify latest order status and auto-dismiss if not actionable.
  useEffect(() => {
    if (!showNewOrderPopup) return;
    const activePopupOrder = popupOrder || newOrder;
    const activeOrderId = activePopupOrder?.orderMongoId || activePopupOrder?.orderId;
    if (!activeOrderId) return;

    const interval = setInterval(async () => {
      try {
        const latestOrderResponse = await restaurantAPI.getOrderById(activeOrderId);
        const latestOrder = latestOrderResponse?.data?.data?.order;
        const latestStatus = String(latestOrder?.status || '').toLowerCase().trim();
        if (!['pending', 'confirmed'].includes(latestStatus)) {
          setShowNewOrderPopup(false);
          setShowRejectPopup(false);
          setPopupOrder(null);
          clearNewOrder();
          setRejectReason("");
          setCountdown(240);
          setPrepTime(11);
        }
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          setShowNewOrderPopup(false);
          setShowRejectPopup(false);
          setPopupOrder(null);
          clearNewOrder();
          setRejectReason("");
          setCountdown(240);
          setPrepTime(11);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [showNewOrderPopup, popupOrder, newOrder, clearNewOrder]);

  // Track popup state with ref to avoid stale closures
  const showNewOrderPopupRef = useRef(showNewOrderPopup);
  const newOrderRef = useRef(newOrder);
  useEffect(() => {
    showNewOrderPopupRef.current = showNewOrderPopup;
  }, [showNewOrderPopup]);
  useEffect(() => {
    newOrderRef.current = newOrder;
  }, [newOrder]);

  // Check for confirmed orders that haven't been shown in popup yet (fallback if Socket.IO fails)
  useEffect(() => {
    const checkConfirmedOrders = async () => {
      // Skip if popup is already showing or Socket.IO order exists or if restaurant is not active
      if (showNewOrderPopupRef.current || newOrderRef.current || !restaurantStatus.isActive) return;
      try {
        const response = await restaurantAPI.getOrders();
        if (response.data?.success && response.data.data?.orders) {
          // Find actionable new orders that haven't been shown yet.
          // Accept flow supports both 'pending' and 'confirmed', so popup should appear for both.
          const pendingOrders = response.data.data.orders.filter(order =>
            ['pending', 'confirmed'].includes(String(order.status || '').toLowerCase()) &&
            !order.tracking?.confirmed?.status &&
            !order.tracking?.preparing?.status &&
            !shownOrdersRef.current.has(order.orderId || order._id)
          );

          // Show the most recent pending order in popup (double-check state)
          if (pendingOrders.length > 0 && !showNewOrderPopupRef.current && !newOrderRef.current) {
            const latestPendingOrder = pendingOrders[0];
            const orderId = latestPendingOrder.orderId || latestPendingOrder._id;

            // Transform order to match newOrder format (include payment so COD shows correctly)
            const orderForPopup = {
              orderId: latestPendingOrder.orderId,
              orderMongoId: latestPendingOrder._id,
              restaurantId: latestPendingOrder.restaurantId,
              restaurantName: latestPendingOrder.restaurantName,
              items: latestPendingOrder.items || [],
              total: latestPendingOrder.pricing?.total || 0,
              customerAddress: latestPendingOrder.address,
              status: latestPendingOrder.status,
              createdAt: latestPendingOrder.createdAt,
              estimatedDeliveryTime: latestPendingOrder.estimatedDeliveryTime || 30,
              note: latestPendingOrder.note || '',
              sendCutlery: latestPendingOrder.sendCutlery,
              paymentMethod: latestPendingOrder.paymentMethod ?? latestPendingOrder.payment?.method,
              payment: latestPendingOrder.payment
            };
            shownOrdersRef.current.add(orderId);
            setPopupOrder(orderForPopup);
            setShowNewOrderPopup(true);
            setCountdown(240);
          }
        }
      } catch (error) {
        // Don't log 401 errors - axios interceptor handles token refresh/redirect
        // Only log other errors (500, network errors, etc.)
        if (error.response?.status !== 401) {
          console.error('Error checking confirmed orders:', error);
        }
      }
    };

    // Check every 5 seconds for new confirmed orders (fallback mechanism)
    const interval = setInterval(checkConfirmedOrders, 5000);

    // Check immediately on mount
    checkConfirmedOrders();
    return () => clearInterval(interval);
  }, [restaurantStatus.isActive]); // Add isActive as dependency to re-run when status changes

  // Play audio when popup opens
  useEffect(() => {
    if (showNewOrderPopup && !isMuted) {
      if (audioRef.current) {
        audioRef.current.loop = true;
        audioRef.current.play().catch(err => { });
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [showNewOrderPopup, isMuted]);

  // Unlock audio on first user interaction (required by many browsers)
  useEffect(() => {
    const unlockAudio = () => {
      if (!audioRef.current || audioUnlockedRef.current) return;
      audioRef.current.muted = true;
      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.muted = false;
          audioUnlockedRef.current = true;
        }).catch(() => { });
      }
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (showNewOrderPopup && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [showNewOrderPopup, countdown]);

  useEffect(() => {
    if (!showNewOrderPopup) {
      setIsNoteExpanded(false);
    }
  }, [showNewOrderPopup]);

  // Format countdown time
  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToAccept = popupOrder || newOrder;

    // Accept order via API if we have a real order
    if (orderToAccept?.orderMongoId || orderToAccept?.orderId) {
      try {
        const orderId = orderToAccept.orderMongoId || orderToAccept.orderId;
        const latestOrderResponse = await restaurantAPI.getOrderById(orderId);
        const latestOrder = latestOrderResponse?.data?.data?.order;
        const latestStatus = String(latestOrder?.status || '').toLowerCase().trim();
        if (['cancelled', 'ready', 'out_for_delivery', 'delivered', 'refunded', 'failed'].includes(latestStatus)) {
          toast.error(`Order cannot be accepted. Current status: ${latestOrder?.status || latestStatus}`);
          setShowNewOrderPopup(false);
          setPopupOrder(null);
          clearNewOrder();
          setCountdown(240);
          setPrepTime(11);
          return;
        }
        const response = await restaurantAPI.acceptOrder(orderId, prepTime);
        toast.success('Order accepted successfully');
      } catch (error) {
        console.error('❌ Error accepting order:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to accept order. Please try again.';

        // Show specific error message
        if (error.response?.status === 400) {
          toast.error(errorMessage);
        } else if (error.response?.status === 404) {
          toast.error('Order not found. It may have been cancelled or already processed.');
        } else {
          toast.error(errorMessage);
        }
        return;
      }
    }
    setShowNewOrderPopup(false);
    setPopupOrder(null);
    clearNewOrder();
    setCountdown(240);
    setPrepTime(11);

    // Note: PreparingOrders component will automatically refresh orders via its own useEffect
    // No need to manually refresh here as the component polls every 10 seconds
  };

  // Handle reject order
  const handleRejectClick = () => {
    setShowRejectPopup(true);
  };
  const handleRejectConfirm = async () => {
    if (!rejectReason) return;

    // Use popupOrder (from Socket.IO or API fallback) or newOrder (from hook)
    const orderToReject = popupOrder || newOrder;

    // Reject order via API if we have a real order
    if (orderToReject?.orderMongoId || orderToReject?.orderId) {
      try {
        const orderId = orderToReject.orderMongoId || orderToReject.orderId;
        const latestOrderResponse = await restaurantAPI.getOrderById(orderId);
        const latestOrder = latestOrderResponse?.data?.data?.order;
        const latestStatus = String(latestOrder?.status || '').toLowerCase().trim();
        if (latestStatus === 'cancelled') {
          toast.success('Order rejected successfully');
          setShowRejectPopup(false);
          setShowNewOrderPopup(false);
          setPopupOrder(null);
          clearNewOrder();
          setRejectReason("");
          setCountdown(240);
          setPrepTime(11);
          return;
        }
        if (['ready', 'out_for_delivery', 'delivered', 'refunded', 'failed'].includes(latestStatus)) {
          toast.error(`Order cannot be rejected. Current status: ${latestOrder?.status || latestStatus}`);
          setShowRejectPopup(false);
          setShowNewOrderPopup(false);
          setPopupOrder(null);
          clearNewOrder();
          setRejectReason("");
          setCountdown(240);
          setPrepTime(11);
          return;
        }
        await restaurantAPI.rejectOrder(orderId, rejectReason);
        toast.success('Order rejected successfully');
        setOrdersListVersion((version) => version + 1);
        setActiveFilter('cancelled');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(ORDERS_FILTER_STORAGE_KEY, 'cancelled');
        }
      } catch (error) {
        console.error('❌ Error rejecting order:', error);
        const serverMessage = String(error?.response?.data?.message || '').toLowerCase();
        if (error?.response?.status === 400 && serverMessage.includes('current status: cancelled')) {
          toast.success('Order rejected successfully');
        } else {
          toast.error(error.response?.data?.message || 'Failed to reject order. Please try again.');
          return;
        }
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setShowRejectPopup(false);
    setShowNewOrderPopup(false);
    setPopupOrder(null);
    clearNewOrder();
    setRejectReason("");
    setCountdown(240);
    setPrepTime(11);
  };
  const handleRejectCancel = () => {
    setShowRejectPopup(false);
    setRejectReason("");
  };

  // Handle cancel order (for preparing orders)
  const handleCancelClick = order => {
    setOrderToCancel(order);
    setShowCancelPopup(true);
  };
  const handleCancelConfirm = async () => {
    if (!cancelReason.trim() || !orderToCancel) return;
    try {
      const orderId = orderToCancel.mongoId || orderToCancel.orderId;
      await restaurantAPI.rejectOrder(orderId, cancelReason.trim());
      toast.success('Order cancelled successfully');
      setShowCancelPopup(false);
      setOrderToCancel(null);
      setCancelReason("");
      setOrdersListVersion((version) => version + 1);
      setActiveFilter('cancelled');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ORDERS_FILTER_STORAGE_KEY, 'cancelled');
      }
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    }
  };
  const handleCancelPopupClose = () => {
    setShowCancelPopup(false);
    setOrderToCancel(null);
    setCancelReason("");
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      if (!isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => { });
      }
    }
  };

  // Handle PDF download
  const handlePrint = async () => {
    if (!newOrder) {
      console.warn('No order data available for PDF generation');
      return;
    }
    try {
      // Create new PDF document
      const doc = new jsPDF();

      // Set font
      doc.setFont('helvetica', 'bold');

      // Header
      doc.setFontSize(20);
      doc.text('Order Receipt', 105, 20, {
        align: 'center'
      });

      // Restaurant name
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(orderToPrint.restaurantName || 'Restaurant', 105, 30, {
        align: 'center'
      });

      // Order details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Order ID: ${orderToPrint.orderId || 'N/A'}`, 20, 45);
      doc.setFont('helvetica', 'normal');
      const orderDate = orderToPrint.createdAt ? new Date(orderToPrint.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : new Date().toLocaleString('en-GB');
      doc.text(`Date: ${orderDate}`, 20, 52);

      // Customer address
      if (orderToPrint.customerAddress) {
        doc.setFont('helvetica', 'bold');
        doc.text('Delivery Address:', 20, 62);
        doc.setFont('helvetica', 'normal');
        const addressText = [orderToPrint.customerAddress.street, orderToPrint.customerAddress.city, orderToPrint.customerAddress.state].filter(Boolean).join(', ') || 'Address not available';
        const addressLines = doc.splitTextToSize(addressText, 170);
        doc.text(addressLines, 20, 69);
      }

      // Items table
      let yPos = 85;
      if (orderToPrint.items && orderToPrint.items.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Items:', 20, yPos);
        yPos += 8;

        // Prepare table data
        const tableData = orderToPrint.items.map(item => [item.name || 'Item', item.quantity || 1, `₹${(item.price || 0).toFixed(2)}`, `₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`]);
        autoTable(doc, {
          startY: yPos,
          head: [['Item', 'Qty', 'Price', 'Total']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [0, 0, 0],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 9
          },
          columnStyles: {
            0: {
              cellWidth: 80
            },
            1: {
              cellWidth: 30,
              halign: 'center'
            },
            2: {
              cellWidth: 35,
              halign: 'right'
            },
            3: {
              cellWidth: 35,
              halign: 'right'
            }
          }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Total: ₹${(orderToPrint.total || 0).toFixed(2)}`, 20, yPos);

      // Payment status
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Payment Status: ${orderToPrint.status === 'confirmed' ? 'Paid' : 'Pending'}`, 20, yPos);

      // Estimated delivery time
      if (orderToPrint.estimatedDeliveryTime) {
        yPos += 8;
        doc.text(`Estimated Delivery: ${orderToPrint.estimatedDeliveryTime} minutes`, 20, yPos);
      }

      // Notes
      if (orderToPrint.note) {
        yPos += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Note:', 20, yPos);
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(orderToPrint.note, 170);
        doc.text(noteLines, 20, yPos + 7);
      }

      // Send cutlery
      if (orderToPrint.sendCutlery) {
        yPos += 15;
        doc.setFont('helvetica', 'normal');
        doc.text('✓ Send cutlery requested', 20, yPos);
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, 105, pageHeight - 10, {
        align: 'center'
      });

      // Download PDF
      const fileName = `Order-${orderToPrint.orderId || 'Receipt'}-${Date.now()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Handle swipe gestures with smooth animations
  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };
  const handleTouchMove = e => {
    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true;
      }
    }
    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = () => {
    if (!isSwiping.current) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      return;
    }
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    const swipeVelocity = Math.abs(swipeDistance);
    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = filterTabs.findIndex(tab => tab.id === activeFilter);
      let newIndex = currentIndex;
      if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
        // Swipe left - go to next filter (right side)
        newIndex = currentIndex + 1;
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous filter (left side)
        newIndex = currentIndex - 1;
      }
      if (newIndex !== currentIndex) {
        setIsTransitioning(true);

        // Smooth transition with animation
        setTimeout(() => {
          setActiveFilter(filterTabs[newIndex].id);
          scrollToFilter(newIndex);

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
        }, 50);
      }
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
  };

  // Scroll filter bar to show active button with smooth animation
  const scrollToFilter = index => {
    if (filterBarRef.current) {
      const buttons = filterBarRef.current.querySelectorAll('button');
      if (buttons[index]) {
        const button = buttons[index];
        const container = filterBarRef.current;
        const buttonLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  };

  // Scroll to active filter on change with smooth animation
  useEffect(() => {
    const index = filterTabs.findIndex(tab => tab.id === activeFilter);
    if (index >= 0) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToFilter(index);
      });
    }
  }, [activeFilter]);
  const formatMoney = value => `₹${Number(value || 0).toFixed(2)}`;

  const buildFinancialBreakdown = (order, settlement) => {
    const pricing = order?.pricing || {};
    const userPayment = settlement?.userPayment || {};
    const restaurantEarning = settlement?.restaurantEarning || {};
    const adminEarning = settlement?.adminEarning || {};

    const itemSubtotal = Number(userPayment.subtotal ?? pricing.subtotal ?? 0);
    const discount = Number(userPayment.discount ?? pricing.discount ?? 0);
    const userDeliveryFee = Number(userPayment.deliveryFee ?? pricing.deliveryFee ?? 0);
    const platformFee = Number(userPayment.platformFee ?? pricing.platformFee ?? 0);
    const userGst = Number(userPayment.gst ?? pricing.tax ?? 0);
    const userTotal = Number(userPayment.total ?? pricing.total ?? 0);

    const adminDeliveryCost = Number(restaurantEarning.adminDeliveryCost ?? pricing.adminDeliveryCost ?? 0);
    const adminDeliveryGst = Number(restaurantEarning.adminDeliveryGst ?? pricing.adminDeliveryGst ?? adminDeliveryCost * 0.18);
    const recommendedItemFee = Number(restaurantEarning.recommendedItemFee ?? pricing.internalRecommendedFee ?? 0);
    const adminPayableCore = Number(restaurantEarning.payableToAdmin ?? (adminDeliveryCost + adminDeliveryGst + platformFee + userGst));
    const adminReceivableTotal = Number(adminPayableCore + recommendedItemFee);
    const restaurantNet = Number(restaurantEarning.netEarning ?? Math.max(0, userTotal - adminReceivableTotal));
    const deliveryDistanceKm = Number(pricing.distanceKm ?? settlement?.calculationSnapshot?.pricingSnapshot?.distanceKm ?? 0);

    return {
      user: {
        itemSubtotal,
        discount,
        deliveryFee: userDeliveryFee,
        platformFee,
        gst: userGst,
        total: userTotal
      },
      admin: {
        adminDeliveryCost,
        adminDeliveryGst,
        platformFee,
        userCollectedGst: userGst,
        recommendedItemFee,
        payableExcludingRecommended: adminPayableCore,
        totalReceivable: adminReceivableTotal
      },
      restaurant: {
        netReceivable: restaurantNet
      },
      logistics: {
        distanceKm: deliveryDistanceKm,
        userDeliveryFee
      },
      adminWallet: {
        deliveryFee: Number(adminEarning.deliveryFee ?? adminEarning.adminDeliveryCost ?? adminDeliveryCost),
        gst: Number(adminEarning.gst ?? userGst + adminDeliveryGst),
        recommendedItemFee: Number(adminEarning.recommendedItemFee ?? recommendedItemFee)
      }
    };
  };

  const handleSelectOrder = async order => {
    if (!order || (!order.mongoId && !order.orderId)) {
      setIsSheetOpen(true);
      setIsSheetLoading(false);
      setSheetError("Order details unavailable");
      return;
    }
    setIsSheetOpen(true);
    setIsSheetLoading(true);
    setSheetError("");
    setSelectedOrder({
      ...order,
      _raw: null,
      settlement: null,
      breakdown: null
    });
    try {
      const id = order.mongoId || order.orderId;
      const response = await restaurantAPI.getOrderById(id);
      const orderData = response?.data?.data?.order || null;
      const settlementData = response?.data?.data?.settlement || null;
      if (!orderData) {
        throw new Error("Order details unavailable");
      }
      const breakdown = buildFinancialBreakdown(orderData, settlementData);
      setSelectedOrder({
        ...order,
        orderId: orderData.orderId || order.orderId,
        mongoId: orderData._id || order.mongoId,
        customerName: orderData?.userId?.name || order.customerName,
        payment: orderData.payment,
        paymentMethod: orderData.payment?.method || order.paymentMethod,
        status: orderData.status || order.status,
        timePlaced: order.timePlaced,
        amount: Number(orderData?.pricing?.total ?? order.amount ?? 0),
        itemsSummary: orderData?.items?.map(item => `${item.quantity}x ${item.name}`).join(", ") || order.itemsSummary,
        items: orderData.items || [],
        pricing: orderData.pricing || {},
        settlement: settlementData,
        breakdown,
        _raw: orderData
      });
    } catch (error) {
      setSheetError(error?.response?.data?.message || error.message || "Failed to load order breakdown");
    } finally {
      setIsSheetLoading(false);
    }
  };
  const renderContent = () => {
    // If restaurant is not active but onboarding is complete, don't show order lists
    // This prevents frequent 401 API errors from polling within these components
    if (!restaurantStatus.isActive && Number(restaurantStatus.onboarding?.completedSteps || 0) >= 3) {
      return null;
    }

    switch (activeFilter) {
      case "preparing":
        return (
          <PreparingOrders
            onSelectOrder={handleSelectOrder}
            onCancel={handleCancelClick}
            restaurantMongoId={restaurantStatus.restaurantId}
            refreshKey={ordersListVersion}
          />
        );
      case "ready":
        return <ReadyOrders onSelectOrder={handleSelectOrder} />;
      case "out-for-delivery":
        return (
          <OutForDeliveryOrders
            onSelectOrder={handleSelectOrder}
            restaurantMongoId={restaurantStatus.restaurantId}
          />
        );
      case "completed":
        return <CompletedOrders onSelectOrder={handleSelectOrder} />;
      case "cancelled":
        return <CancelledOrders onSelectOrder={handleSelectOrder} refreshKey={ordersListVersion} />;
      default:
        return <EmptyState />;
    }
  };
  return <div className="min-h-screen bg-background text-foreground flex flex-col">
    {/* Subscription renewal reminder popup */}
    <SubscriptionRenewalPopup />

    {/* Restaurant Navbar - Sticky at top */}
    <div className="sticky top-0 z-50 bg-background">
      <RestaurantNavbar showNotifications={false} />
    </div>

    {/* Top Filter Bar - Sticky below navbar */}
    <div className="sticky top-[50px] z-40 pb-2 bg-background">
      <div ref={filterBarRef} className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 py-2 mt-2" style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        {filterTabs.map((tab, index) => {
          const isActive = activeFilter === tab.id;
          return <motion.button key={tab.id} onClick={() => {
            if (!isTransitioning) {
              setIsTransitioning(true);
              setActiveFilter(tab.id);
              scrollToFilter(index);
              setTimeout(() => setIsTransitioning(false), 300);
            }
          }} className={`shrink-0 px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${isActive ? 'text-white' : 'bg-white text-black'}`} animate={{
            scale: isActive ? 1.05 : 1,
            opacity: isActive ? 1 : 0.7
          }} transition={{
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1]
          }} whileTap={{
            scale: 0.95
          }}>
            {isActive && <motion.div layoutId="activeFilterBackground" className="absolute inset-0 bg-[#3B82F6] rounded-full -z-10" initial={false} transition={{
              type: "spring",
              stiffness: 500,
              damping: 30
            }} />}
            <span className="relative z-10">{tab.label}</span>
          </motion.button>;
        })}
      </div>
    </div>

    {/* Content Area - Scrollable */}
    <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pb-24 content-scroll" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={e => {
      mouseStartX.current = e.clientX;
      mouseEndX.current = e.clientX;
      isMouseDown.current = true;
      isSwiping.current = false;
    }} onMouseMove={e => {
      if (isMouseDown.current) {
        if (!isSwiping.current) {
          const deltaX = Math.abs(e.clientX - mouseStartX.current);
          if (deltaX > 10) {
            isSwiping.current = true;
          }
        }
        if (isSwiping.current) {
          mouseEndX.current = e.clientX;
        }
      }
    }} onMouseUp={() => {
      if (isMouseDown.current && isSwiping.current) {
        const swipeDistance = mouseStartX.current - mouseEndX.current;
        const minSwipeDistance = 50;
        if (Math.abs(swipeDistance) > minSwipeDistance && !isTransitioning) {
          const currentIndex = filterTabs.findIndex(tab => tab.id === activeFilter);
          let newIndex = currentIndex;
          if (swipeDistance > 0 && currentIndex < filterTabs.length - 1) {
            newIndex = currentIndex + 1;
          } else if (swipeDistance < 0 && currentIndex > 0) {
            newIndex = currentIndex - 1;
          }
          if (newIndex !== currentIndex) {
            setIsTransitioning(true);
            setTimeout(() => {
              setActiveFilter(filterTabs[newIndex].id);
              scrollToFilter(newIndex);
              setTimeout(() => setIsTransitioning(false), 300);
            }, 50);
          }
        }
      }
      isMouseDown.current = false;
      isSwiping.current = false;
      mouseStartX.current = 0;
      mouseEndX.current = 0;
    }} onMouseLeave={() => {
      isMouseDown.current = false;
      isSwiping.current = false;
    }}>
      <style>{`
          .content-scroll::-webkit-scrollbar {
            display: none;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #999;
          }
        `}</style>

      {expiryNotice.isVisible && !expiryNotice.loading && <SubscriptionExpiryBanner daysLeft={expiryNotice.daysLeft} isExpired={expiryNotice.isExpired} type={expiryNotice.type} planName={expiryNotice.planName} onBuyNow={() => navigate("/restaurant/subscription")} />}

      {/* Verification Pending Card - Show if onboarding is complete (all 4 steps) and restaurant is not active */}
      {!restaurantStatus.isLoading && !restaurantStatus.isActive && Number(restaurantStatus.onboarding?.completedSteps || 0) >= 3 && <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.3,
        delay: 0.1
      }} className={`mt-4 mb-4 rounded-2xl shadow-sm px-6 py-4 ${restaurantStatus.rejectionReason ? 'bg-white border border-red-200' : 'bg-white border border-yellow-200'}`}>
        {restaurantStatus.rejectionReason ? <>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 rounded-full p-2 bg-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-600 mb-2">Denied Verification</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-red-800 mb-2">Reason for Rejection:</p>
                <div className="text-xs text-red-700 space-y-1">
                  {restaurantStatus.rejectionReason.split('\n').filter(line => line.trim()).length > 1 ? <ul className="space-y-1 list-disc list-inside">
                    {restaurantStatus.rejectionReason.split('\n').map((point, index) => point.trim() && <li key={index}>{point.trim()}</li>)}
                  </ul> : <p className="text-red-700">{restaurantStatus.rejectionReason}</p>}
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Please review the rejection reason, update your onboarding details, and resubmit for approval.
          </p>
          <button onClick={handleReverify} className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
            Review & Resubmit
          </button>
        </> : <>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Verification Done in 24 Hours</h3>
          <p className="text-sm text-gray-600">Your account is under verification. You'll be notified once approved.</p>
        </>}
      </motion.div>}

      <AnimatePresence mode="wait">
        <motion.div key={activeFilter} initial={{
          opacity: 0,
          x: 20
        }} animate={{
          opacity: 1,
          x: 0
        }} exit={{
          opacity: 0,
          x: -20
        }} transition={{
          duration: 0.3
        }}>
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>

    {/* Audio element */}
    <audio ref={audioRef} src={notificationSound} />

    {/* New Order Popup */}
    <AnimatePresence>
      {showNewOrderPopup && <>
        <motion.div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }}>
          <motion.div className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden h-[90vh] max-h-[90vh] flex flex-col" initial={{
            scale: 0.9,
            opacity: 0
          }} animate={{
            scale: 1,
            opacity: 1
          }} exit={{
            scale: 0.9,
            opacity: 0
          }} transition={{
            type: "spring",
            damping: 25,
            stiffness: 300
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 bg-white border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  {(popupOrder || newOrder)?.orderId || '#Order'}
                </h3>
                <p className="text-[13px] text-gray-500 font-semibold mt-0.5">
                  {(popupOrder || newOrder)?.restaurantName || 'Restaurant'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={toggleMute} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors group" aria-label={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <VolumeX className="w-[20px] h-[20px] text-gray-700 group-hover:text-black" /> : <Volume2 className="w-[20px] h-[20px] text-gray-700 group-hover:text-black" />}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
              {/* Item Summary and Date */}
              <div className="mb-6">
                <h4 className="text-[16px] font-extrabold text-gray-900 tracking-tight">
                  {(popupOrder || newOrder)?.items?.[0]?.name || 'New Order'}
                </h4>
                <p className="text-[13px] text-gray-500 font-medium mt-1">
                  {(popupOrder || newOrder)?.createdAt ? new Date((popupOrder || newOrder).createdAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).replace(',', '') : 'Just now'}
                </p>
              </div>

              {/* Details Accordion */}
              <div className="mb-2">
                <button onClick={() => setIsDetailsExpanded(!isDetailsExpanded)} className="w-full flex items-center justify-between py-3.5 group">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-bold text-gray-900">Details</span>
                    <span className="text-[13px] font-medium text-gray-500">
                      {(popupOrder || newOrder)?.items?.length || 0} item{(popupOrder || newOrder)?.items?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform duration-300 ${isDetailsExpanded ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDetailsExpanded && <motion.div initial={{
                    height: 0,
                    opacity: 0
                  }} animate={{
                    height: "auto",
                    opacity: 1
                  }} exit={{
                    height: 0,
                    opacity: 0
                  }} transition={{
                    duration: 0.25,
                    ease: "easeInOut"
                  }} className="overflow-hidden">
                    <div className="pb-5 space-y-4 pt-1">
                      {(popupOrder || newOrder)?.items?.map((item, index) => <div key={index} className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg !== false ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <p className="text-[14px] font-bold text-gray-900">
                            {item.quantity} x {item.name}
                          </p>
                        </div>
                        <p className="text-[14px] font-bold text-gray-900">
                          ₹{item.price * item.quantity}
                        </p>
                      </div>) || <p className="text-sm text-gray-500">No items</p>}
                    </div>
                  </motion.div>}
                </AnimatePresence>
              </div>

              {/* Send cutlery */}
              <div className="mb-6 p-4 bg-gray-50/70 rounded-xl border border-gray-100 flex items-center gap-3 mt-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-[14px] font-bold text-gray-600">Send cutlery</span>
              </div>

              {/* Customer note */}
              {String((popupOrder || newOrder)?.note || '').trim() && <div className="mb-6">
                <button onClick={() => setIsNoteExpanded(prev => !prev)} className="w-full p-4 bg-yellow-50/80 rounded-xl border border-yellow-100 flex items-start justify-between gap-3 text-left hover:bg-yellow-100/70 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <MessageSquare className="w-5 h-5 text-yellow-700 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-yellow-900">Note</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-yellow-700 shrink-0 transition-transform ${isNoteExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isNoteExpanded && <div className="mt-2 p-3 bg-white rounded-lg border border-yellow-100">
                  <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">
                    {String((popupOrder || newOrder)?.note || '').trim()}
                  </p>
                </div>}
              </div>}

              {/* Total bill */}
              <div className="mb-6 flex items-center justify-between py-5 border-y border-gray-100">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  <span className="text-[15px] font-extrabold text-gray-900">Total bill</span>
                </div>
                <span className="text-[18px] font-extrabold text-gray-950">
                  ₹{(popupOrder || newOrder)?.total || 0}
                </span>
              </div>

              {/* Payment method */}
              <div className="mb-6 flex items-center justify-between px-1">
                <span className="text-[14px] font-semibold text-gray-500">Payment</span>
                {(() => {
                  const raw = (popupOrder || newOrder)?.paymentMethod ?? (popupOrder || newOrder)?.payment?.method;
                  const m = raw != null ? String(raw).toLowerCase().trim() : '';
                  const isCod = m === 'cash' || m === 'cod' || m === 'cash on delivery';
                  return <span className={`text-[14px] font-extrabold ${isCod ? 'text-amber-600' : 'text-green-600'}`}>
                    {isCod ? 'Cash on Delivery' : 'Online'}
                  </span>;
                })()}
              </div>

              {/* Preparation time */}
              <div className="mb-7 flex items-center justify-between px-1">
                <span className="text-[14px] font-semibold text-gray-500">Preparation time</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setPrepTime(Math.max(1, prepTime - 1))} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-all">
                    <Minus className="w-4 h-4 text-gray-700" />
                  </button>
                  <span className="text-[15px] font-extrabold text-gray-950 min-w-[65px] text-center">
                    {prepTime} mins
                  </span>
                  <button onClick={() => setPrepTime(prepTime + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-all">
                    <Plus className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* Accept and Reject buttons */}
              <div className="space-y-4 px-1 sticky bottom-0 bg-white pt-3 pb-4">
                <div className="relative rounded-xl overflow-hidden shadow-lg shadow-blue-100">
                  <button onClick={handleAcceptOrder} className="w-full bg-[#1A68FF] text-white py-4 font-extrabold text-[15px] hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 relative z-10">
                    Accept ({formatTime(countdown)})
                  </button>
                  {/* Accept Loading Bar at bottom (matching screenshot style) */}
                  <div className="absolute bottom-0 left-0 h-1.5 bg-black/20 w-full z-20">
                    <motion.div className="h-full bg-black/40" initial={{
                      width: "100%"
                    }} animate={{
                      width: `${countdown / 240 * 100}%`
                    }} transition={{
                      duration: 1,
                      ease: "linear"
                    }} />
                  </div>
                </div>

                <button onClick={handleRejectClick} className="w-full bg-white border border-red-500 text-red-600 py-3.5 rounded-xl font-extrabold text-[15px] hover:bg-red-50 transition-colors">
                  Reject Order
                </button>
              </div>

            </div>
          </motion.div>
        </motion.div>
      </>}
    </AnimatePresence>

    {/* Reject Order Popup */}
    <AnimatePresence>
      {showRejectPopup && <>
        <motion.div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} onClick={handleRejectCancel}>
          <motion.div className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" initial={{
            scale: 0.9,
            opacity: 0
          }} animate={{
            scale: 1,
            opacity: 1
          }} exit={{
            scale: 0.9,
            opacity: 0
          }} transition={{
            type: "spring",
            damping: 25,
            stiffness: 300
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Reject Order {(popupOrder || newOrder)?.orderId || '#Order'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Please select a reason for rejecting this order</p>
            </div>

            {/* Content */}
            <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                {rejectReasons.map(reason => <button key={reason} onClick={() => setRejectReason(reason)} className={`w-full text-left p-4 rounded-lg border-2 transition-all ${rejectReason === reason ? "border-[#3B82F6] bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${rejectReason === reason ? "text-[#3B82F6]" : "text-gray-900"}`}>
                      {reason}
                    </span>
                    {rejectReason === reason && <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>}
                  </div>
                </button>)}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button onClick={handleRejectCancel} className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleRejectConfirm} disabled={!rejectReason} className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${rejectReason ? "!bg-[#3B82F6] !text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
                Confirm Rejection
              </button>
            </div>
          </motion.div>
        </motion.div>
      </>}
    </AnimatePresence>

    {/* Cancel Order Popup */}
    <AnimatePresence>
      {showCancelPopup && orderToCancel && <>
        <motion.div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} onClick={handleCancelPopupClose}>
          <motion.div className="w-[95%] max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" initial={{
            scale: 0.9,
            opacity: 0
          }} animate={{
            scale: 1,
            opacity: 1
          }} exit={{
            scale: 0.9,
            opacity: 0
          }} transition={{
            type: "spring",
            damping: 25,
            stiffness: 300
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Cancel Order {orderToCancel.orderId || '#Order'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Please provide a reason for cancelling this order</p>
            </div>

            {/* Content */}
            <div className="px-4 py-4">
              <div className="space-y-3">
                {rejectReasons.map(reason => <button key={reason} type="button" onClick={() => setCancelReason(reason)} className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${cancelReason === reason ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${cancelReason === reason ? "border-red-500 bg-red-500" : "border-gray-300"}`}>
                      {cancelReason === reason && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>}
                    </div>
                    <span className={`text-sm font-medium ${cancelReason === reason ? "text-red-700" : "text-gray-700"}`}>
                      {reason}
                    </span>
                  </div>
                </button>)}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button onClick={handleCancelPopupClose} className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCancelConfirm} disabled={!cancelReason} className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${cancelReason ? "!bg-red-600 !text-white hover:bg-red-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
                Confirm Cancellation
              </button>
            </div>
          </motion.div>
        </motion.div>
      </>}
    </AnimatePresence>

    {/* Bottom Sheet for Order Details */}
    <AnimatePresence>
      {isSheetOpen && selectedOrder && <motion.div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} onClick={() => setIsSheetOpen(false)}>
        <motion.div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-4 pb-6 shadow-lg max-h-[85vh] overflow-y-auto" initial={{
          y: 80
        }} animate={{
          y: 0
        }} exit={{
          y: 80
        }} transition={{
          duration: 0.25
        }} onClick={e => e.stopPropagation()}>
          {/* Drag handle */}
          <div className="flex justify-center mb-3">
            <div className="h-1 w-10 rounded-full bg-gray-300" />
          </div>

          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-black">
                Order #{selectedOrder.orderId}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedOrder.customerName}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {selectedOrder.type}
                {selectedOrder.tableOrToken ? ` • ${selectedOrder.tableOrToken}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${selectedOrder.status === "Ready" ? "border-green-500 text-green-600" : "border-gray-800 text-gray-900"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${selectedOrder.status === "Ready" ? "bg-green-500" : "bg-gray-800"}`} />
                {String(selectedOrder.status || "")}
              </span>
              <span className="text-[11px] text-gray-500">
                {selectedOrder.timePlaced}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100 my-3" />
          {isSheetLoading ? <div className="py-10 flex items-center justify-center text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading bill breakdown...
          </div> : <>
            {sheetError && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {sheetError}
            </div>}

            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1">Items</p>
              <p className="text-xs text-gray-600">{selectedOrder.itemsSummary}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-4">
              {selectedOrder.status !== 'ready' && selectedOrder.eta && <span>ETA: <span className="font-medium text-black">{selectedOrder.eta}</span></span>}
              {(() => {
                const raw = selectedOrder?.paymentMethod ?? selectedOrder?.payment?.method;
                const m = raw != null ? String(raw).toLowerCase().trim() : '';
                const isCod = m === 'cash' || m === 'cod' || m === 'cash on delivery';
                return <span>Payment: <span className={`font-medium ${isCod ? 'text-amber-600' : 'text-black'}`}>{isCod ? 'Cash on Delivery' : 'Paid online'}</span></span>;
              })()}
            </div>

            {selectedOrder?.breakdown && <div className="space-y-3 mb-4">
              <div className="rounded-xl border border-gray-100 bg-[#f8fafc] p-3">
                <p className="text-[11px] font-semibold text-gray-700 mb-2">Customer Bill</p>
                <div className="space-y-1.5 text-xs">
                  <Row label="Item subtotal" value={formatMoney(selectedOrder.breakdown.user.itemSubtotal)} />
                  <Row label="Discount" value={`- ${formatMoney(selectedOrder.breakdown.user.discount)}`} />
                  <Row label="Delivery fee (user)" value={formatMoney(selectedOrder.breakdown.user.deliveryFee)} />
                  <Row label="Platform fee" value={formatMoney(selectedOrder.breakdown.user.platformFee)} />
                  <Row label="GST (user bill)" value={formatMoney(selectedOrder.breakdown.user.gst)} />
                  <Row bold label="Total paid by user" value={formatMoney(selectedOrder.breakdown.user.total)} />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-[11px] font-semibold text-gray-700 mb-2">Admin Receivable</p>
                <div className="space-y-1.5 text-xs">
                  <Row label="Delivery cost to admin" value={formatMoney(selectedOrder.breakdown.admin.adminDeliveryCost)} />
                  <Row label="Delivery GST to admin (18%)" value={formatMoney(selectedOrder.breakdown.admin.adminDeliveryGst)} />
                  <Row label="Platform fee to admin" value={formatMoney(selectedOrder.breakdown.admin.platformFee)} />
                  <Row label="GST collected from user" value={formatMoney(selectedOrder.breakdown.admin.userCollectedGst)} />
                  <Row label="Recommended item charge" value={formatMoney(selectedOrder.breakdown.admin.recommendedItemFee)} />
                  <Row bold label="Total going to admin" value={formatMoney(selectedOrder.breakdown.admin.totalReceivable)} />
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-[11px] font-semibold text-blue-700 mb-2">Restaurant Payout</p>
                <div className="space-y-1.5 text-xs">
                  <Row bold label="Restaurant gets" value={formatMoney(selectedOrder.breakdown.restaurant.netReceivable)} valueClass="text-blue-700" />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-[11px] font-semibold text-gray-700 mb-2">Delivery Info</p>
                <div className="space-y-1.5 text-xs">
                  <Row label="Distance for this order" value={`${Number(selectedOrder.breakdown.logistics.distanceKm || 0).toFixed(2)} km`} />
                  <Row label="User delivery charge (distance based)" value={formatMoney(selectedOrder.breakdown.logistics.userDeliveryFee)} />
                </div>
              </div>
            </div>}
          </>}

          <button className="w-full bg-[#3B82F6] text-white py-2.5 rounded-xl text-sm font-medium" onClick={() => setIsSheetOpen(false)}>
            Close
          </button>
        </motion.div>
      </motion.div>}
    </AnimatePresence>

    {/* Bottom Navigation - Sticky */}
    <BottomNavOrders />
  </div>;
}

// Resend Notification Button Component
function ResendNotificationButton({
  orderId,
  mongoId,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const handleResend = async e => {
    e.stopPropagation(); // Prevent card click
    if (loading) return;
    try {
      setLoading(true);
      const id = mongoId || orderId;
      const response = await restaurantAPI.resendDeliveryNotification(id);
      if (response.data?.success) {
        toast.success(`Notification sent to ${response.data.data?.notifiedCount || 0} delivery partners`);
        // Soft refresh only (no full-page reload)
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      } else {
        toast.error(response.data?.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error resending notification:', error);
      toast.error(error.response?.data?.message || 'Failed to send notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return <button type="button" onClick={handleResend} disabled={loading} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Resend notification to delivery partners">
    {loading ? <>
      <Loader2 className="w-3 h-3 animate-spin" />
      <span>Sending...</span>
    </> : <>
      <Volume2 className="w-3 h-3" />
      <span>Resend</span>
    </>}
  </button>;
}

// Order Card Component
function OrderCard({
  orderId,
  mongoId,
  status,
  customerName,
  type,
  tableOrToken,
  timePlaced,
  eta,
  itemsSummary,
  photoUrl,
  photoAlt,
  deliveryPartnerId,
  deliveryAssigned,
  restaurantMongoId,
  onSelect,
  onCancel,
  onMarkReady,
}) {
  const displayStatus = status === "confirmed" ? "preparing" : status;
  const isReady = displayStatus === "ready" || displayStatus === "Ready";
  const isDeliveryAssigned = deliveryAssigned !== undefined ? Boolean(deliveryAssigned) : Boolean(deliveryPartnerId);
  const [isCallingDeliveryPartner, setIsCallingDeliveryPartner] = useState(false);

  const handleCallDeliveryPartner = async (e) => {
    e.stopPropagation();

    if (!deliveryPartnerId || !orderId) {
      toast.error("Unable to resolve delivery partner call");
      return;
    }

    try {
      // DEBUG: trace the masked-call button click for delivery-partner calls from the restaurant orders screen
      console.log("[MASKING][FRONTEND][CLICK]", {
        screen: "OrdersMain",
        targetRole: "delivery_partner",
        orderId,
        timestamp: new Date(),
      });
      setIsCallingDeliveryPartner(true);
      await telephonyAPI.initiateMaskedCall({
        orderId,
        targetRole: "delivery_partner",
      });
      toast.success("Call connecting to delivery partner");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to initiate masked call");
    } finally {
      setIsCallingDeliveryPartner(false);
    }
  };
  return <div className="w-full bg-white rounded-2xl p-4 mb-3 border border-gray-200 hover:border-gray-400 transition-colors relative">
    {/* Cancel button - for confirmed or preparing orders (Option A: until before ready) */}
    {['preparing', 'confirmed'].includes(status) && onCancel && <button type="button" onClick={e => {
      e.stopPropagation();
      onCancel({
        orderId,
        mongoId,
        customerName
      });
    }} className="absolute top-2 right-2 p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors z-10" title="Cancel Order">
      <X className="w-4 h-4" />
    </button>}
    <div onClick={() => onSelect?.({
      orderId,
      mongoId,
      status: displayStatus,
      customerName,
      type,
      tableOrToken,
      timePlaced,
      eta,
      itemsSummary
    })} className="w-full text-left flex gap-3 items-stretch cursor-pointer">
      {/* Photo */}
      <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 my-auto">
        {photoUrl ? <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center px-2">
          <span className="text-[11px] font-medium text-gray-500 text-center leading-tight">
            {photoAlt}
          </span>
        </div>}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between min-h-[80px]">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-black leading-tight">
              Order #{orderId}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {customerName}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${isReady ? "border-green-500 text-green-600" : "border-gray-800 text-gray-900"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-green-500" : "bg-gray-800"}`} />
              {displayStatus}
            </span>
            <span className="text-[11px] text-gray-500 text-right">
              {timePlaced}
            </span>
          </div>
        </div>

        {/* Middle row */}
        <div className="mt-2">
          <p className="text-xs text-gray-600 line-clamp-1">
            {itemsSummary}
          </p>
        </div>

        {/* Bottom row */}
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-gray-500">
              {type}
              {tableOrToken ? ` • ${tableOrToken}` : ""}
            </p>
            {/* Delivery Assignment Status (preparing/ready) */}
            {["preparing", "ready"].includes(displayStatus) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    isDeliveryAssigned
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-blue-100 text-blue-700 border border-blue-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isDeliveryAssigned ? "bg-green-500" : "bg-blue-500"
                    }`}
                  />
                  {isDeliveryAssigned ? "Assigned" : "Not Assigned"}
                </span>
                {!isDeliveryAssigned && displayStatus !== "preparing" && (
                  <ResendNotificationButton
                    orderId={orderId}
                    mongoId={mongoId}
                  />
                )}
              </div>
            )}

            {deliveryPartnerId && (
              <button
                type="button"
                onClick={handleCallDeliveryPartner}
                disabled={isCallingDeliveryPartner}
                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white hover:bg-green-700"
              >
                {isCallingDeliveryPartner ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                {isCallingDeliveryPartner ? "Calling..." : "Call delivery partner"}
              </button>
            )}
          </div>
          {/* Hide ETA for ready orders */}
          {displayStatus !== "ready" && eta && (
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] text-gray-500">ETA</span>
              <span className="text-xs font-medium text-black">{eta}</span>
            </div>
          )}
        </div>

        {/* Action row */}
        {(displayStatus === "preparing") && onMarkReady && (
          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkReady({ orderId, mongoId, status });
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
            >
              Mark as Ready
            </button>
          </div>
        )}
      </div>
    </div>
  </div>;
}

const isDeliveryAcceptedOrAssigned = (order) => {
  const stateStatus = String(order?.deliveryState?.status || "").toLowerCase();
  const acceptedStates = new Set(["accepted", "reached_pickup", "order_confirmed", "en_route_to_delivery", "delivered"]);
  return Boolean(order?.deliveryPartnerId || order?.assignmentInfo?.deliveryPartnerId || acceptedStates.has(stateStatus));
};

// Preparing Orders List
function PreparingOrders({
  onSelectOrder,
  onCancel,
  restaurantMongoId,
  refreshKey = 0,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingReadyIds, setMarkingReadyIds] = useState(new Set());

  const handleMarkReady = async ({ orderId, mongoId, status }) => {
    const id = mongoId || orderId;
    if (!id) return;
    if (markingReadyIds.has(id)) return;
    setMarkingReadyIds(prev => new Set(prev).add(id));
    try {
      if (status === 'confirmed') {
        await restaurantAPI.markOrderPreparing(id);
      }
      await restaurantAPI.markOrderReady(id);
      toast.success('Order marked as ready');
      setOrders(prev => prev.filter(o => (o.mongoId || o.orderId) !== id));
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to mark order ready';
      toast.error(msg);
    } finally {
      setMarkingReadyIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    let countdownIntervalId = null;
    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'preparing' status on frontend
        const response = await restaurantAPI.getOrders();
        if (!isMounted) return;
        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'preparing' or 'confirmed' (Accepted) status
          // 'confirmed' orders should appear in preparing list after acceptance
          // 'pending' orders should only appear in popup notification
          const preparingOrders = response.data.data.orders.filter(order => ['preparing', 'confirmed'].includes(order.status));
          const transformedOrders = preparingOrders.map(order => {
            const initialETA = order.estimatedDeliveryTime || 30; // in minutes
            const preparingTimestamp = order.tracking?.preparing?.timestamp ? new Date(order.tracking.preparing.timestamp) : new Date(order.createdAt); // Fallback to createdAt if preparing timestamp not available

            return {
              orderId: order.orderId || order._id,
              mongoId: order._id,
              status: order.status || 'preparing',
              customerName: order.userId?.name || 'Customer',
              type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
              tableOrToken: null,
              timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              initialETA,
              // Store initial ETA in minutes
              preparingTimestamp,
              // Store when order started preparing
              itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
              photoUrl: order.items?.[0]?.image || null,
              photoAlt: order.items?.[0]?.name || 'Order',
              deliveryPartnerId: order.deliveryPartnerId || null, // For call action
              deliveryAssigned: isDeliveryAcceptedOrAssigned(order)
            };
          });
          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors, 404, or 401 errors
        // 401 is handled by axios interceptor (token refresh/redirect)
        // 404 means no orders found (normal)
        // ERR_NETWORK means backend is down (expected in dev)
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404 && error.response?.status !== 401) {
          console.error('Error fetching preparing orders:', error);
        }
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };
    fetchOrders();

    // Refresh orders every 10 seconds
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders();
      }
    }, 10000);

    // Update countdown every second
    countdownIntervalId = setInterval(() => {
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
      }
    };
  }, [refreshKey]);

  // Track which orders have been marked as ready to avoid duplicate API calls
  const markedReadyOrdersRef = useRef(new Set());

  // Auto-mark orders as ready when ETA reaches 0
  useEffect(() => {
    if (!currentTime || orders.length === 0) return;
    const checkAndMarkReady = async () => {
      for (const order of orders) {
        const orderKey = order.mongoId || order.orderId;

        // Skip if already marked as ready
        if (markedReadyOrdersRef.current.has(orderKey)) {
          continue;
        }

        // Calculate remaining ETA
        const elapsedMs = currentTime - order.preparingTimestamp;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes);

        // If ETA has reached 0 (or slightly past), mark as ready
        if (remainingMinutes <= 0 && order.status === 'preparing') {
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const totalETASeconds = order.initialETA * 60;

          // Mark as ready when ETA time has elapsed (with 2 second buffer)
          if (elapsedSeconds >= totalETASeconds - 2) {
            try {
              markedReadyOrdersRef.current.add(orderKey); // Mark as processing
              await restaurantAPI.markOrderReady(order.mongoId || order.orderId);

              // Order will be removed from preparing list on next fetch
            } catch (error) {
              const status = error.response?.status;
              const msg = (error.response?.data?.message || error.message || '').toLowerCase();
              // If 400 and message says order cannot be marked ready (e.g. already ready),
              // treat as idempotent - backend cron or another client already marked it.
              if (status === 400 && (msg.includes('cannot be marked as ready') || msg.includes('current status'))) {
                // Keep in markedReadyOrdersRef so we don't retry; order will disappear on next fetch
              } else {
                console.error(`❌ Failed to auto-mark order ${order.orderId} as ready:`, error);
                markedReadyOrdersRef.current.delete(orderKey);
              }
              // Don't show error toast - it will retry on next check (for non-idempotent errors)
            }
          }
        }
      }
    };

    // Check every 2 seconds for orders that need to be marked ready
    const readyCheckInterval = setInterval(checkAndMarkReady, 2000);
    return () => {
      clearInterval(readyCheckInterval);
    };
  }, [currentTime, orders]);

  // Clear marked orders when orders list changes (orders moved to ready)
  useEffect(() => {
    const currentOrderKeys = new Set(orders.map(o => o.mongoId || o.orderId));
    // Remove keys that are no longer in the preparing orders list
    for (const key of markedReadyOrdersRef.current) {
      if (!currentOrderKeys.has(key)) {
        markedReadyOrdersRef.current.delete(key);
      }
    }
  }, [orders]);
  if (loading) {
    return <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-[#3B82F6]">Preparing orders</h2>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
      <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
    </div>;
  }
  return <div className="pt-4 pb-6">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-[#3B82F6]">
        Preparing orders
      </h2>
      <span className="text-xs text-gray-500">{orders.length} active</span>
    </div>
    {orders.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">
      No orders in preparation
    </div> : <div>
      {orders.map(order => {
        // Calculate remaining ETA (countdown)
        const elapsedMs = currentTime - order.preparingTimestamp;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = Math.max(0, order.initialETA - elapsedMinutes);

        // Format ETA display
        let etaDisplay = '';
        if (remainingMinutes <= 0) {
          const remainingSeconds = Math.max(0, Math.floor(order.initialETA * 60 - elapsedMs / 1000));
          if (remainingSeconds > 0) {
            etaDisplay = `${remainingSeconds} secs`;
          } else {
            etaDisplay = '0 mins';
          }
        } else {
          etaDisplay = `${remainingMinutes} mins`;
        }
        return (
          <OrderCard
            key={order.orderId || order.mongoId}
            orderId={order.orderId}
            mongoId={order.mongoId}
            status={order.status}
            customerName={order.customerName}
            type={order.type}
            tableOrToken={order.tableOrToken}
            timePlaced={order.timePlaced}
            eta={etaDisplay}
            itemsSummary={order.itemsSummary}
            photoUrl={order.photoUrl}
            photoAlt={order.photoAlt}
            deliveryPartnerId={order.deliveryPartnerId}
            restaurantMongoId={restaurantMongoId}
            onSelect={onSelectOrder}
            onCancel={onCancel}
            onMarkReady={handleMarkReady}
          />
        );
      })}
    </div>}
  </div>;
}

// Ready Orders List
function ReadyOrders({
  onSelectOrder
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'ready' status on frontend
        const response = await restaurantAPI.getOrders();
        if (!isMounted) return;
        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'ready' status
          const readyOrders = response.data.data.orders.filter(order => order.status === 'ready');
          const transformedOrders = readyOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'ready',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            eta: null,
            // Don't show ETA for ready orders
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            deliveryPartnerId: order.deliveryPartnerId || null,
            deliveryAssigned: isDeliveryAcceptedOrAssigned(order)
          }));
          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching ready orders:', error);
        }
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };
    fetchOrders();

    // Refresh every 10 seconds (reduced frequency to avoid spam if backend is down)
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders();
      }
    }, 10000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Empty dependency array is correct here - we want this to run once on mount

  if (loading) {
    return <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-[#3B82F6]">Ready for pickup</h2>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
      <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
    </div>;
  }
  return <div className="pt-4 pb-6">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-[#3B82F6]">
        Ready for pickup
      </h2>
      <span className="text-xs text-gray-500">{orders.length} active</span>
    </div>
    {orders.length === 0 ? <div className="text-center py-8 text-gray-500 text-sm">
      No orders ready for pickup
    </div> : <div>
      {orders.map(order => <OrderCard key={order.orderId || order.mongoId} {...order} onSelect={onSelectOrder} />)}
    </div>}
  </div>;
}

// Out for Delivery Orders List
const OutForDeliveryOrders = ({
  onSelectOrder,
  restaurantMongoId,
}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;
    const fetchOrders = async () => {
      try {
        // Fetch all orders and filter for 'out_for_delivery' status on frontend
        const response = await restaurantAPI.getOrders();
        if (!isMounted) return;
        if (response.data?.success && response.data.data?.orders) {
          // Filter orders with 'out_for_delivery' status
          const outForDeliveryOrders = response.data.data.orders.filter(order => order.status === 'out_for_delivery');
          const transformedOrders = outForDeliveryOrders.map(order => ({
            orderId: order.orderId || order._id,
            mongoId: order._id,
            status: order.status || 'out_for_delivery',
            customerName: order.userId?.name || 'Customer',
            type: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Express Delivery',
            tableOrToken: null,
            timePlaced: new Date(order.createdAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            eta: null,
            itemsSummary: order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'No items',
            photoUrl: order.items?.[0]?.image || null,
            photoAlt: order.items?.[0]?.name || 'Order',
            deliveryPartnerId: order.deliveryPartnerId || null,
            deliveryAssigned: isDeliveryAcceptedOrAssigned(order)
          }));
          if (isMounted) {
            setOrders(transformedOrders);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // Don't log network errors repeatedly - they're expected if backend is down
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error('Error fetching out for delivery orders:', error);
        }
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
      }
    };
    fetchOrders();

    // Refresh every 10 seconds
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchOrders();
      }
    }, 10000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Empty dependency array is correct here - we want this to run once on mount

  if (loading) {
    return <div className="pt-4 pb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-[#3B82F6]">Out for delivery</h2>
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
      </div>
      <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
    </div>;
  }
  return <div className="pt-4 pb-6">
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-base font-semibold text-[#3B82F6]">
        Out for delivery
      </h2>
      <span className="text-xs text-gray-500">{orders.length} active</span>
    </div>
    {orders.length === 0 ? (
      <div className="text-center py-8 text-gray-500 text-sm">
        No orders out for delivery
      </div>
    ) : (
      <div>
        {orders.map((order) => (
          <OrderCard
            key={order.orderId || order.mongoId}
            {...order}
            restaurantMongoId={restaurantMongoId}
            onSelect={onSelectOrder}
          />
        ))}
      </div>
    )}
  </div>;
};

// Empty State Component
function EmptyState({
  message = "Temporarily closed"
}) {
  return <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
    {/* Store Illustration */}
    <div className="mb-6">
      <svg width="200" height="200" viewBox="0 0 200 200" className="text-gray-300" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Storefront */}
        <rect x="40" y="80" width="120" height="80" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Awning */}
        <path d="M30 80 L100 50 L170 80" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Doors */}
        <rect x="60" y="100" width="30" height="60" stroke="currentColor" strokeWidth="2" fill="white" />
        <rect x="110" y="100" width="30" height="60" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Laptop */}
        <rect x="70" y="140" width="40" height="25" stroke="currentColor" strokeWidth="1.5" fill="white" />
        <text x="85" y="155" fontSize="8" fill="currentColor" textAnchor="middle">CLOSED</text>
        {/* Sign */}
        <rect x="80" y="170" width="40" height="20" stroke="currentColor" strokeWidth="1.5" fill="white" />
      </svg>
    </div>

    {/* Message */}
    <h2 className="text-lg font-semibold text-gray-600 mb-4 text-center">
      {message}
    </h2>

    {/* View Status Button */}
    <button className="bg-[#3B82F6] text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors">
      View status
    </button>
  </div>;
}
