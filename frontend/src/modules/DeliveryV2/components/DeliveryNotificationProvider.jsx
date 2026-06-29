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
import { normalizeDeliveryOfferOrder } from '@food/utils/normalizeDeliveryOfferOrder';
import {
  getCancellationToastMessage,
  isCancelledOrderStatusUpdate,
  orderCancellationAffects,
} from '@food/utils/deliveryCancelUtils';

const DeliveryNotificationContext = createContext(null);

export const useDeliveryNotificationContext = () => useContext(DeliveryNotificationContext);

const normalizeOrderFromApi = (order = {}, seed = {}) =>
  normalizeDeliveryOfferOrder({
    ...seed,
    ...order,
    restaurantId: order.restaurantId || seed.restaurantId,
    address: order.address || seed.address,
    estimatedEarnings: order.estimatedEarnings ?? seed.estimatedEarnings,
    earnings: order.earnings ?? seed.earnings,
    pickupDistance: order.pickupDistance ?? seed.pickupDistance,
    deliveryDistance: order.deliveryDistance ?? seed.deliveryDistance,
    pickupDistanceKm: order.pickupDistanceKm ?? seed.pickupDistanceKm,
    distanceKm: order.distanceKm ?? seed.distanceKm,
    deliveryDistanceRaw: order.deliveryDistanceRaw ?? seed.deliveryDistanceRaw,
    restaurantLocation: order.restaurantLocation || seed.restaurantLocation,
    customerLocation: order.customerLocation || seed.customerLocation,
    restaurantAddress: order.restaurantAddress || seed.restaurantAddress,
    customerAddress: order.customerAddress || seed.customerAddress,
    restaurantLat: order.restaurantLat ?? seed.restaurantLat,
    restaurantLng: order.restaurantLng ?? seed.restaurantLng,
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

  const { acceptOrder, resetTrip } = useOrderManager();
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
          normalizeOrderFromApi(apiOrder, seed),
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

    void validateAndSetOffer(newOrder, { playAlert: true, source: newOrder?.source || 'socket' });
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

    if (!isCancelledOrderStatusUpdate(orderStatusUpdate)) {
      clearOrderStatusUpdate();
      return;
    }

    const { affectsAny } = orderCancellationAffects(
      orderStatusUpdate,
      incomingOrder,
      activeOrder
    );

    if (affectsAny) {
      if (incomingOrder && ordersReferToSameOffer(orderStatusUpdate, incomingOrder)) {
        dismissOffer(incomingOrder);
      }
      if (activeOrder && ordersReferToSameOffer(orderStatusUpdate, activeOrder)) {
        stopNotificationSound();
        resetTrip();
      }
      clearPendingOffer(orderStatusUpdate);
      toast.error(getCancellationToastMessage(orderStatusUpdate.cancelledBy));
    }

    clearOrderStatusUpdate();
  }, [
    orderStatusUpdate,
    incomingOrder,
    activeOrder,
    dismissOffer,
    resetTrip,
    stopNotificationSound,
    clearOrderStatusUpdate,
  ]);

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
            onReject={handleReject}
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
