import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDeliveryNotifications } from '@food/hooks/useDeliveryNotifications';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { NewOrderModal } from '@/modules/DeliveryV2/components/modals/NewOrderModal';
import { deliveryAPI } from '@food/api';
import {
  clearPendingOffer,
  enrichOrderWithOfferMeta,
  getOrderOfferKey,
  isRecoverableDeliveryOffer,
  ordersReferToSameOffer,
  savePendingOffer,
} from '@food/utils/deliveryOfferStorage';

const DeliveryNotificationContext = createContext(null);

export const useDeliveryNotificationContext = () => useContext(DeliveryNotificationContext);

const normalizeOrderFromApi = (order = {}) => ({
  ...order,
  orderMongoId: order.orderMongoId || order._id,
  orderId: order.orderId || order._id,
  restaurantName:
    order.restaurantName ||
    order.restaurantId?.name ||
    order.restaurant_name,
  restaurantAddress:
    order.restaurantAddress ||
    order.restaurantId?.address ||
    order.restaurantId?.location?.formattedAddress ||
    order.restaurantId?.location?.address,
  pickupDistanceKm:
    order.pickupDistanceKm ||
    (typeof order.pickupDistance === 'string'
      ? Number.parseFloat(order.pickupDistance)
      : order.assignmentInfo?.distance),
});

export function DeliveryNotificationProvider({ children }) {
  const navigate = useNavigate();
  const notifications = useDeliveryNotifications();
  const {
    newOrder,
    clearNewOrder,
    orderTaken,
    clearOrderTaken,
    stopNotificationSound,
    orderStatusUpdate,
    clearOrderStatusUpdate,
    deliveryPartnerId,
  } = notifications;

  const { acceptOrder } = useOrderManager();
  const { activeOrder } = useDeliveryStore();

  const [incomingOrder, setIncomingOrder] = useState(null);
  const [isModalMinimized, setIsModalMinimized] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const presentingKeyRef = useRef(null);
  const validatedKeysRef = useRef(new Set());

  const dismissOffer = useCallback(
    (orderData = null) => {
      stopNotificationSound();
      presentingKeyRef.current = null;
      setIncomingOrder(null);
      setIsModalMinimized(false);
      clearNewOrder();
      clearPendingOffer(orderData);
    },
    [clearNewOrder, stopNotificationSound]
  );

  const validateAndSetOffer = useCallback(
    async (rawOrder, { playAlert = true, source = 'recovery' } = {}) => {
      const seed = enrichOrderWithOfferMeta(rawOrder, source);
      const orderKey = getOrderOfferKey(seed);
      if (!orderKey) return false;
      if (activeOrder) return false;
      if (presentingKeyRef.current === orderKey && incomingOrder) return true;

      const lookupId = seed.orderMongoId || seed.orderId || seed._id || orderKey;
      try {
        const response = await deliveryAPI.getOrderDetails(lookupId);
        const apiOrder = response?.data?.data?.order || response?.data?.data;
        if (!apiOrder || !isRecoverableDeliveryOffer(apiOrder, deliveryPartnerId)) {
          clearPendingOffer(seed);
          return false;
        }

        const normalized = enrichOrderWithOfferMeta(
          normalizeOrderFromApi(apiOrder),
          source
        );

        presentingKeyRef.current = getOrderOfferKey(normalized);
        savePendingOffer(normalized);
        setIncomingOrder(normalized);
        setIsModalMinimized(false);

        if (playAlert) {
          notifications.playNotificationSound(normalized);
          notifications.startAlertLoop?.(notifications.playNotificationSound);
        }

        return true;
      } catch (error) {
        const status = error?.response?.status;
        if (status === 403 || status === 404) {
          clearPendingOffer(seed);
        }
        return false;
      }
    },
    [activeOrder, deliveryPartnerId, incomingOrder, notifications]
  );

  useEffect(() => {
    if (!newOrder) return;
    if (activeOrder) {
      clearNewOrder();
      return;
    }

    const key = getOrderOfferKey(newOrder);
    if (!key || presentingKeyRef.current === key) return;

    void validateAndSetOffer(newOrder, { playAlert: false, source: newOrder?.source || 'socket' });
  }, [newOrder, activeOrder, clearNewOrder, validateAndSetOffer]);

  useEffect(() => {
    if (!orderTaken) return;

    if (incomingOrder && ordersReferToSameOffer(orderTaken, incomingOrder)) {
      toast.info('Order already accepted by another delivery partner.');
      dismissOffer(incomingOrder);
    }
    clearOrderTaken();
  }, [orderTaken, incomingOrder, dismissOffer, clearOrderTaken]);

  useEffect(() => {
    if (!orderStatusUpdate) return;
    const status = String(orderStatusUpdate.status || '').toLowerCase();

    if (
      ['cancelled', 'deleted'].includes(status) &&
      incomingOrder &&
      ordersReferToSameOffer(orderStatusUpdate, incomingOrder)
    ) {
      toast.error('Order cancelled');
      dismissOffer(incomingOrder);
    }
    clearOrderStatusUpdate();
  }, [orderStatusUpdate, incomingOrder, dismissOffer, clearOrderStatusUpdate]);

  useEffect(() => {
    if (activeOrder && incomingOrder) {
      dismissOffer(incomingOrder);
    }
  }, [activeOrder, incomingOrder, dismissOffer]);

  useEffect(() => {
    if (!incomingOrder) return;
    const key = getOrderOfferKey(incomingOrder);
    if (!key || validatedKeysRef.current.has(key)) return;
    validatedKeysRef.current.add(key);

    const revalidate = async () => {
      const lookupId = incomingOrder.orderMongoId || incomingOrder.orderId || key;
      try {
        const response = await deliveryAPI.getOrderDetails(lookupId);
        const apiOrder = response?.data?.data?.order || response?.data?.data;
        if (!apiOrder || !isRecoverableDeliveryOffer(apiOrder, deliveryPartnerId)) {
          dismissOffer(incomingOrder);
        }
      } catch (error) {
        const status = error?.response?.status;
        if (status === 403 || status === 404) {
          dismissOffer(incomingOrder);
        }
      }
    };

    void revalidate();
  }, [incomingOrder, deliveryPartnerId, dismissOffer]);

  const handleAccept = useCallback(
    async (order) => {
      if (isAccepting) return;
      setIsAccepting(true);
      try {
        await acceptOrder(order);
        dismissOffer(order);
        navigate('/food/delivery/feed', { replace: false });
      } catch (error) {
        const message = error?.response?.data?.message || error?.message || '';
        if (
          message.toLowerCase().includes('another delivery') ||
          message.toLowerCase().includes('assigned to another') ||
          error?.response?.status === 403
        ) {
          toast.info('Order already accepted by another delivery partner.');
          dismissOffer(order);
        }
      } finally {
        setIsAccepting(false);
      }
    },
    [acceptOrder, dismissOffer, isAccepting, navigate]
  );

  const handleReject = useCallback(
    async (order) => {
      const orderId = order?.orderMongoId || order?.orderId || order?._id;
      if (orderId) {
        try {
          await deliveryAPI.rejectOrder(orderId);
        } catch (error) {
          const status = error?.response?.status;
          if (status !== 400 && status !== 403) {
            console.warn('[DeliveryOffer] reject failed:', error?.message || error);
          }
        }
      }
      dismissOffer(order);
    },
    [dismissOffer]
  );

  const contextValue = {
    ...notifications,
    incomingOrder,
    isModalMinimized,
    setIsModalMinimized,
    dismissOffer,
    validateAndSetOffer,
  };

  return (
    <DeliveryNotificationContext.Provider value={contextValue}>
      {children}
      <AnimatePresence>
        {incomingOrder && !isModalMinimized && !activeOrder && (
          <NewOrderModal
            key={getOrderOfferKey(incomingOrder)}
            order={incomingOrder}
            onAccept={handleAccept}
            onReject={() => handleReject(incomingOrder)}
            onMinimize={() => setIsModalMinimized(true)}
            isAccepting={isAccepting}
          />
        )}
      </AnimatePresence>

      {isModalMinimized && incomingOrder && !activeOrder && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-[100px] inset-x-0 z-[1400] px-6 pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => setIsModalMinimized(false)}
            className="w-full bg-gray-900/90 text-white rounded-2xl py-4 flex items-center justify-between px-6 shadow-2xl backdrop-blur-md border border-white/10"
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Order Pending</span>
              <span className="text-xs font-bold uppercase tracking-wider">Tap to open accept panel</span>
            </div>
            <div className="bg-orange-500 p-2 rounded-xl text-white">
              <Plus className="w-5 h-5" />
            </div>
          </button>
        </motion.div>
      )}
    </DeliveryNotificationContext.Provider>
  );
}

export default DeliveryNotificationProvider;
