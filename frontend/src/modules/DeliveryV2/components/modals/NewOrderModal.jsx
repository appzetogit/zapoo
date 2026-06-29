import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, FastForward, Clock, Phone, ChefHat, ChevronDown } from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { getHaversineDistance, calculateETA } from '@/modules/DeliveryV2/utils/geo';
import { getRemainingAcceptanceSeconds } from '@food/utils/deliveryOfferStorage';
import { normalizeDeliveryOfferOrder } from '@food/utils/normalizeDeliveryOfferOrder';

const ACCEPT_COUNTDOWN_SECONDS = 30;

const parseKmValue = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
 * Matches the Zomato/Swiggy style Green Header + White Card.
 */
export const NewOrderModal = ({ order, onAccept, onReject, onMinimize, isAccepting = false }) => {
  const { riderLocation } = useDeliveryStore();
  const normalizedOrder = useMemo(() => normalizeDeliveryOfferOrder(order), [order]);
  const [timeLeft, setTimeLeft] = useState(ACCEPT_COUNTDOWN_SECONDS);
  const onRejectRef = useRef(onReject);
  onRejectRef.current = onReject;
  const orderRef = useRef(normalizedOrder);
  orderRef.current = normalizedOrder;

  const orderKey =
    normalizedOrder?.orderMongoId ||
    normalizedOrder?.orderId ||
    normalizedOrder?._id ||
    normalizedOrder?.id ||
    'order';

  useEffect(() => {
    const remaining = getRemainingAcceptanceSeconds(orderRef.current);
    const starting =
      remaining > 0 ? Math.min(ACCEPT_COUNTDOWN_SECONDS, remaining) : ACCEPT_COUNTDOWN_SECONDS;
    setTimeLeft(starting);

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          onRejectRef.current?.(orderRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderKey]);

  const { distanceKm, etaMins } = useMemo(() => {
    if (!normalizedOrder) return { distanceKm: null, etaMins: null };

    const rawDist =
      parseKmValue(normalizedOrder.pickupDistanceKm) ??
      parseKmValue(normalizedOrder.distanceKm) ??
      parseKmValue(normalizedOrder.deliveryDistanceRaw) ??
      parseKmValue(normalizedOrder.pickupDistance) ??
      parseKmValue(normalizedOrder.deliveryDistance);

    const rawEta =
      normalizedOrder.estimatedTime ||
      normalizedOrder.estimatedDeliveryTime ||
      normalizedOrder.duration ||
      normalizedOrder.eta;

    if (rawDist != null) {
      return {
        distanceKm: Number(rawDist).toFixed(1),
        etaMins:
          rawEta && Number(rawEta) > 0
            ? Math.ceil(Number(rawEta))
            : Math.ceil((rawDist * 1000) / 416) + 5,
      };
    }

    const rest = normalizedOrder.restaurantLocation || normalizedOrder.restaurantId?.location || {};
    const resLat = parseFloat(
      normalizedOrder.restaurant_lat ||
        normalizedOrder.restaurantLat ||
        rest.latitude ||
        rest.lat
    );
    const resLng = parseFloat(
      normalizedOrder.restaurant_lng ||
        normalizedOrder.restaurantLng ||
        rest.longitude ||
        rest.lng
    );

    if (riderLocation && !Number.isNaN(resLat) && !Number.isNaN(resLng)) {
      const distM = getHaversineDistance(
        riderLocation.lat,
        riderLocation.lng,
        resLat,
        resLng
      );
      const km = distM / 1000;
      const mins = Math.ceil(distM / 416) + (normalizedOrder.prepTime || 5);

      return {
        distanceKm: km.toFixed(1),
        etaMins: mins,
      };
    }

    return { distanceKm: '??', etaMins: normalizedOrder.prepTime || 15 };
  }, [normalizedOrder, riderLocation]);

  if (!normalizedOrder) return null;

  const resolveRiderEarning = (payload) => {
    if (!payload) return 0;
    const estimated = payload.estimatedEarnings || payload.earnings;
    if (typeof estimated === 'number' && Number.isFinite(estimated)) return estimated;
    if (estimated && typeof estimated === 'object') {
      const total = Number(estimated.totalEarning);
      if (Number.isFinite(total) && total > 0) return total;
      const base = Number(estimated.basePayout || estimated.breakdown?.basePayout || 0);
      const distancePart = Number(estimated.distanceCommission || estimated.breakdown?.distanceCommission || 0);
      const combined = base + distancePart;
      if (Number.isFinite(combined) && combined > 0) return combined;
    }
    const direct =
      Number(payload.riderEarning) ||
      Number(payload.deliveryEarning) ||
      Number(payload.earningAmount) ||
      Number(payload.amount) ||
      Number(payload.totalEarning);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const legacyPercent = Number(payload.orderAmount) > 0 ? Number(payload.orderAmount) * 0.1 : 0;
    return Number.isFinite(legacyPercent) ? legacyPercent : 0;
  };

  const earnings = resolveRiderEarning(normalizedOrder);
  const orderNumber = normalizedOrder.orderId || normalizedOrder.order_id || normalizedOrder._id || '—';
  const restaurantName = normalizedOrder.restaurantName || normalizedOrder.restaurant_name || (normalizedOrder.restaurantId?.name) || 'Restaurant';
  const restaurantAddress = normalizedOrder.restaurantAddress || normalizedOrder.restaurant_address || (normalizedOrder.restaurantId?.location?.address) || 'Address not available';
  const deliveryAddress = (normalizedOrder?.deliveryAddress && typeof normalizedOrder.deliveryAddress === 'object') ? normalizedOrder.deliveryAddress : {};

  const normalizeLocation = (loc) => {
    if (!loc) return null;
    if (Array.isArray(loc?.location?.coordinates) && loc.location.coordinates.length >= 2) {
      const lng = Number(loc.location.coordinates[0]);
      const lat = Number(loc.location.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, address: loc.address || loc.formattedAddress || '' };
    }
    if (Array.isArray(loc?.coordinates) && loc.coordinates.length >= 2) {
      const lng = Number(loc.coordinates[0]);
      const lat = Number(loc.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, address: loc.address || loc.formattedAddress || '' };
    }
    const lat = Number(loc.lat ?? loc.latitude);
    const lng = Number(loc.lng ?? loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, address: loc.address || loc.formattedAddress || '' };
    }
    return null;
  };

  const geoCoords =
    Array.isArray(deliveryAddress?.location?.coordinates) &&
    deliveryAddress.location.coordinates.length >= 2
      ? {
          lng: deliveryAddress.location.coordinates[0],
          lat: deliveryAddress.location.coordinates[1],
        }
      : null;

  const customerLocation = normalizeLocation(normalizedOrder.customerLocation) || normalizeLocation(normalizedOrder.deliveryLocation) || normalizeLocation(geoCoords) || null;

  const isCoordinateOnlyText = (value) => {
    const text = String(value || '').trim();
    if (!text) return false;
    // Matches: "22.7176, 75.8719" / "Lat 22.7176, Lng 75.8719"
    return /^((lat\s*)?-?\d+(\.\d+)?\s*,\s*(lng\s*)?-?\d+(\.\d+)?)$/i.test(text);
  };

  const addressPartsFromSchema = [
    deliveryAddress.street,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const rawCustomerAddress =
    normalizedOrder.customerAddress ||
    normalizedOrder.customer_address ||
    normalizedOrder?.customerLocation?.address ||
    normalizedOrder?.customerLocation?.formattedAddress ||
    normalizedOrder?.deliveryAddress?.address ||
    normalizedOrder?.deliveryAddress?.formattedAddress ||
    (typeof normalizedOrder?.deliveryAddress === 'string' ? normalizedOrder.deliveryAddress : '') ||
    (addressPartsFromSchema.length ? addressPartsFromSchema.join(', ') : '');

  const customerAddress =
    !isCoordinateOnlyText(rawCustomerAddress) && String(rawCustomerAddress || '').trim()
      ? String(rawCustomerAddress).trim()
      : 'Location not available';

  const mapsLink =
    customerLocation?.lat != null && customerLocation?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          `${customerLocation.lat},${customerLocation.lng}`,
        )}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1500] bg-black/60 backdrop-blur-sm flex items-end justify-center"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-t-[3.5rem] shadow-[0_-25px_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] relative overflow-hidden"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center py-3 bg-white relative z-20">
          <button 
            onClick={onMinimize} 
            className="w-12 h-1.5 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors active:scale-95"
            aria-label="Minimize"
          />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Header Ribbon (Compact Premium) */}
          <div className="bg-linear-to-br from-emerald-500 via-green-500 to-emerald-600 px-6 py-5 flex justify-between items-center text-white">
            <div>
              <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mb-1">New Order Request</p>
              <p className="text-white/70 text-[10px] font-bold tracking-widest mb-1">#{orderNumber}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold opacity-80">₹</span>
                <h2 className="text-4xl font-black tracking-tighter">{Number(earnings || 0).toFixed(2)}</h2>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2 text-white flex flex-col items-center min-w-[80px]">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Expires</span>
              <span className="font-black text-2xl tabular-nums leading-none">{timeLeft}s</span>
            </div>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Direct Summary Metrics (Horizontal Compact Row) */}
            <div className="flex gap-2">
               <div className="flex-1 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-500">
                    <Clock className="w-5 h-5" />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">EST. Time</span>
                    <span className="text-sm font-black text-gray-900 tracking-tight leading-none">{etaMins} MINS</span>
                 </div>
               </div>
               <div className="flex-1 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                 <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-500">
                    <MapPin className="w-5 h-5" />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">Distance</span>
                    <span className="text-sm font-black text-gray-900 tracking-tight leading-none">{distanceKm} KM</span>
                 </div>
               </div>
            </div>

            {/* Delivery Locations (Tighter Timeline) */}
            <div className="bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
              <div className="flex gap-4 relative">
                <div className="flex flex-col items-center py-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                  <div className="flex-1 w-0.5 border-l-2 border-dashed border-gray-200 my-1" />
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20" />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 mb-0.5">Restaurant Pickup</h4>
                    <h3 className="text-gray-950 font-black text-lg leading-tight mb-0.5 line-clamp-1">{restaurantName}</h3>
                    <p className="text-gray-500 text-[11px] font-bold line-clamp-1">{restaurantAddress}</p>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600 mb-0.5">Customer Drop</h4>
                       {mapsLink && (
                        <a href={mapsLink} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
                          Open Map
                        </a>
                      )}
                    </div>
                    <h3 className="text-gray-950 font-black text-lg leading-tight mb-0.5">Delivery Location</h3>
                    <p className="text-gray-500 text-[11px] font-bold line-clamp-1">{customerAddress}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Area (Fixed / Non-Scrolling Footer) */}
        <div className="px-6 pb-8 pt-2 space-y-4 bg-white">
          <ActionSlider 
            label="Slide to Accept" 
            onConfirm={() => onAccept(normalizedOrder)} 
            color="bg-emerald-600"
            successLabel="Order Accepted ✓"
            disabled={isAccepting}
          />

          <button 
            onClick={() => onReject(normalizedOrder)}
            className="w-full text-gray-400 font-black text-[11px] uppercase tracking-[0.2em] hover:text-red-500 transition-colors active:scale-95 py-2"
          >
            Pass this task
          </button>
        </div>
      </motion.div>
    </motion.div>

  );
};
