import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../context/OrdersContext';
import { orderAPI } from '@/lib/api';

const TERMINAL_STATUSES = new Set([
  'delivered',
  'cancelled',
  'completed',
  'refunded',
  'failed',
  'payment_failed',
  'rejected'
]);

const getOrderPrimaryStatus = (order) => String(order?.status || order?.originalStatus || order?.deliveryState?.status || '').toLowerCase().trim();

const getOrderIdentityKey = (order) => {
  return String(
    order?.orderId ||
    order?.id ||
    order?._id ||
    order?.payment?.razorpayOrderId ||
    order?.razorpayOrderId ||
    ''
  ).trim();
};

const getEstimatedMinutesFromOrder = (order) => {
  const etaMax = Number(order?.eta?.max);
  if (Number.isFinite(etaMax) && etaMax > 0) return etaMax;

  const etaMin = Number(order?.eta?.min);
  if (Number.isFinite(etaMin) && etaMin > 0) return etaMin;

  const estimatedDeliveryTime = Number(order?.estimatedDeliveryTime ?? order?.estimatedTime ?? order?.estimated_delivery_time);
  if (Number.isFinite(estimatedDeliveryTime) && estimatedDeliveryTime > 0) return estimatedDeliveryTime;

  return 35;
};

const mergeOrdersWithApiPrecedence = (contextOrders = [], apiOrders = []) => {
  const mergedMap = new Map();
  contextOrders.forEach((order) => {
    const key = getOrderIdentityKey(order);
    if (key) mergedMap.set(key, order);
  });
  apiOrders.forEach((order) => {
    const key = getOrderIdentityKey(order);
    if (key) mergedMap.set(key, order);
  });
  return Array.from(mergedMap.values()).sort((a, b) => {
    const aTime = new Date(a?.createdAt || a?.orderDate || a?.created_at || 0).getTime();
    const bTime = new Date(b?.createdAt || b?.orderDate || b?.created_at || 0).getTime();
    return bTime - aTime;
  });
};

export default function OrderTrackingCard() {
  const navigate = useNavigate();
  const {
    orders: contextOrders
  } = useOrders();
  const [activeOrder, setActiveOrder] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);

  // Fetch orders from API (optional - only if endpoint exists)
  // For now, we'll rely primarily on localStorage orders from OrdersContext
  useEffect(() => {
    // Only try API if user is authenticated
    const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken');
    if (!userToken) {
      // No token, skip API call
      return;
    }
    const fetchOrders = async () => {
      try {
        const response = await orderAPI.getOrders({
          limit: 10,
          page: 1
        });
        if (response?.data?.success && response?.data?.data?.orders) {
          setApiOrders(response.data.data.orders);
        } else if (response?.data?.orders) {
          setApiOrders(response.data.orders);
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          setApiOrders(response.data.data);
        }
      } catch (error) {
        // Silently fail - don't show error if API fails, just use context orders
        // Only log if it's not a 404 (endpoint doesn't exist)
        if (error?.response?.status !== 404) {
          console.warn('Could not fetch orders from API for tracking card, using context orders only:', error?.response?.status || error?.message);
        }
        setApiOrders([]);
      }
    };

    // Try once on mount, but don't retry if it fails
    fetchOrders();
  }, []);

  // Get active order (not delivered) - check both context and API orders
  useEffect(() => {
    const mergedOrders = mergeOrdersWithApiPrecedence(contextOrders, apiOrders);
    const active = mergedOrders.find((order) => {
      const status = getOrderPrimaryStatus(order);
      return Boolean(status) && !TERMINAL_STATUSES.has(status);
    });
    if (active) {
      setActiveOrder(active);
      // Calculate estimated delivery time
      const orderTime = new Date(active.createdAt || active.orderDate || active.created_at || active.date || Date.now());
      const estimatedMinutes = getEstimatedMinutesFromOrder(active);
      const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
      const remaining = Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
      setTimeRemaining(remaining);
    } else {
      setActiveOrder(null);
      setTimeRemaining(null);
    }
  }, [contextOrders, apiOrders]);

  // Countdown timer
  useEffect(() => {
    if (!activeOrder || timeRemaining === null) return;

    // Update more frequently when time is running out (every second if <= 1 minute, otherwise every minute)
    const updateInterval = timeRemaining <= 1 ? 1000 : 60000;
    const interval = setInterval(() => {
      const mergedOrders = mergeOrdersWithApiPrecedence(contextOrders, apiOrders);
      const activeOrderKey = getOrderIdentityKey(activeOrder);
      const currentActive = mergedOrders.find((order) => getOrderIdentityKey(order) === activeOrderKey);
      if (!currentActive) {
        setActiveOrder(null);
        setTimeRemaining(null);
        return;
      }
      const status = getOrderPrimaryStatus(currentActive);
      if (!status || TERMINAL_STATUSES.has(status)) {
        setActiveOrder(null);
        setTimeRemaining(null);
        return;
      }
      const orderTime = new Date(currentActive.createdAt || currentActive.orderDate || currentActive.created_at || Date.now());
      const estimatedMinutes = getEstimatedMinutesFromOrder(currentActive);
      const deliveryTime = new Date(orderTime.getTime() + estimatedMinutes * 60000);
      const remaining = Math.max(0, Math.floor((deliveryTime - new Date()) / 60000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        setActiveOrder(null);
        setTimeRemaining(null);
      }
    }, updateInterval);
    return () => clearInterval(interval);
  }, [activeOrder, timeRemaining, contextOrders, apiOrders]);

  // Listen for order updates from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      // When storage changes, the OrdersContext will update automatically
      // No need to fetch from API again - just rely on context orders
      // This prevents unnecessary API calls and errors
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('orderStatusUpdated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('orderStatusUpdated', handleStorageChange);
    };
  }, []);

  // Debug: Log when component renders
  useEffect(() => {}, [activeOrder, timeRemaining, contextOrders.length, apiOrders.length]);
  if (!activeOrder) {
    return null;
  }

  // Check if order is delivered or time remaining is 0 - hide card
  const orderStatus = getOrderPrimaryStatus(activeOrder) || 'preparing';
  if (TERMINAL_STATUSES.has(orderStatus) || timeRemaining === 0) {
    return null;
  }
  const restaurantName = activeOrder.restaurant || activeOrder.restaurantName || activeOrder.restaurantName || 'Restaurant';
  const statusText = orderStatus === 'preparing' || orderStatus === 'confirmed' || orderStatus === 'pending' ? 'Preparing your order' : orderStatus === 'out_for_delivery' || orderStatus === 'outfordelivery' || orderStatus === 'on_way' ? 'On the way' : 'Preparing your order';
  return <AnimatePresence>
      <motion.div initial={{
      y: 100,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} exit={{
      y: 100,
      opacity: 0
    }} transition={{
      type: "spring",
      damping: 25,
      stiffness: 200
    }} className="fixed bottom-20 left-4 right-4 z-[60] md:hidden" onClick={() => navigate(`/user/orders/${activeOrder.id || activeOrder._id}`)}>
        <div className="bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-3">
            {/* Left Side - Icon and Text */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{restaurantName}</p>
                <div className="flex items-center gap-1">
                  <p className="text-gray-300 text-xs truncate">{statusText}</p>
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Right Side - Time Pill */}
            <div className="bg-green-600 rounded-lg px-3 py-2 flex-shrink-0">
              <p className="text-white text-[10px] font-medium uppercase leading-tight">arriving in</p>
              <p className="text-white text-sm font-bold leading-tight">
                {timeRemaining !== null ? `${timeRemaining} mins` : '-- mins'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>;
}
