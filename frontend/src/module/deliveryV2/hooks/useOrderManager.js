import { useDeliveryStore } from '@/module/deliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const { 
    activeOrder, tripStatus, updateTripStatus, clearActiveOrder, setActiveOrder, riderLocation, setRiderLocation
  } = useDeliveryStore();

  const acceptOrder = async (order) => {
    const orderId = order?.orderId || order?._id || order?.id;
    if (!orderId) {
      toast.error('Invalid order data');
      return;
    }

    try {
      const response = await deliveryAPI.acceptOrder(orderId);
      
      if (response?.data?.success) {
        const fullOrder = response.data.data?.order || order;

        const toPoint = (raw) => {
          if (!raw) return null;
          if (Array.isArray(raw?.coordinates) && raw.coordinates.length >= 2) {
            const lng = Number(raw.coordinates[0]);
            const lat = Number(raw.coordinates[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
          }
          if (raw?.location && Array.isArray(raw.location.coordinates) && raw.location.coordinates.length >= 2) {
            const lng = Number(raw.location.coordinates[0]);
            const lat = Number(raw.location.coordinates[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
          }
          const lat = Number(raw?.lat ?? raw?.latitude);
          const lng = Number(raw?.lng ?? raw?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
          return null;
        };
        
        // Robustly determine locations from multiple possible formats (Populated API vs Socket)
        const getLoc = (ref, keysLat, keysLng) => {
          if (!ref) return null;
          // Handle nested populated objects
          if (ref.location) {
            // Handle GeoJSON format: location: { type: 'Point', coordinates: [lng, lat] }
            if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
              return {
                lat: ref.location.coordinates[1], // Latitude is second in GeoJSON [lng, lat]
                lng: ref.location.coordinates[0]  // Longitude is first
              };
            }
            // Handle standard object format: location: { latitude: 12.3, longitude: 45.6 }
            return {
              lat: ref.location.latitude || ref.location.lat,
              lng: ref.location.longitude || ref.location.lng
            };
          }
          // Handle flat objects or direct lat/lng keys
          for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
          return null;
        };

        console.log('[OrderManager] Raw Full Order Data:', fullOrder);

        const resLoc =
          toPoint(fullOrder.restaurantLocation) ||
          toPoint(fullOrder.restaurant_location) ||
          toPoint(fullOrder.restaurantId?.location) ||
          getLoc(fullOrder.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) || 
          getLoc(fullOrder, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);
                       
        const cusLoc =
          toPoint(fullOrder.customerLocation) ||
          toPoint(fullOrder.customer_location) ||
          toPoint(fullOrder.address?.location) ||
          toPoint(fullOrder.deliveryAddress?.location) ||
          getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) || 
          getLoc(fullOrder, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

        console.log('[OrderManager] Locations Mapped Result:', { resLoc, cusLoc });

        setActiveOrder({
          ...fullOrder,
          orderId: orderId,
          restaurantLocation: resLoc,
          customerLocation: cusLoc
        });

        // If live GPS hasn't arrived yet, seed rider location from accept API response.
        if (!riderLocation && fullOrder?.riderLocation?.lat != null && fullOrder?.riderLocation?.lng != null) {
          setRiderLocation({
            lat: Number(fullOrder.riderLocation.lat),
            lng: Number(fullOrder.riderLocation.lng),
            heading: Number(fullOrder.riderLocation.heading || 0)
          });
        }

        updateTripStatus('PICKING_UP');
        // toast.success('Order Accepted! Opening Map...');
      } else {
        toast.error(response?.data?.message || 'Order already taken or unavailable');
        throw new Error('Accept failed');
      }
    } catch (error) {
      console.error('Accept Order Error:', error);
      toast.error('Network error. Please try again.');
      throw error;
    }
  };

  /**
   * Mark "Reached Pickup" (Arrival at restaurant)
   */
  const reachPickup = async () => {
    const orderId = activeOrder?.orderId;
    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId);
      if (response?.data?.success) {
        updateTripStatus('REACHED_PICKUP');
        // toast.info('Arrived at Restaurant');
      } else {
        throw new Error('Confirm pickup failed');
      }
    } catch (error) {
      toast.error('Failed to update status');
      throw error;
    }
  };

  /**
   * Mark "Picked Up" (Confirm order ID & start delivery)
   */
  const pickUpOrder = async (billImageUrl) => {
    const orderId = activeOrder?.orderId;
    try {
      // confirmOrderId(orderId, confirmedOrderId, location, data)
      const response = await deliveryAPI.confirmOrderId(
        orderId, 
        activeOrder.displayOrderId || orderId, 
        riderLocation || {},
        { billImageUrl }
      );
      
      if (response?.data?.success) {
        updateTripStatus('PICKED_UP');
        // toast.success('Order Collected! Heading to Drop-off');
      } else {
        throw new Error('Confirm order ID failed');
      }
    } catch (error) {
      toast.error('Error confirming pickup');
      throw error;
    }
  };

  /**
   * Mark "Reached Drop" (Arrival at customer)
   */
  const reachDrop = async () => {
    const orderId = activeOrder?.orderId;
    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId);
      if (response?.data?.success) {
        updateTripStatus('REACHED_DROP');
        // toast.info('Arrived at Customer Location');
      } else {
        throw new Error('Confirm drop failed');
      }
    } catch (error) {
      toast.error('Failed to notify arrival');
      throw error;
    }
  };

  /**
   * Finalize Delivery with OTP Check
   */
  const completeDelivery = async (otp) => {
    const orderId = activeOrder?.orderId;
    try {
      // 1. Verify OTP first
      const verifyRes = await deliveryAPI.verifyDropOtp(orderId, otp);
      
      if (verifyRes?.data?.success) {
        let finalOrder = verifyRes.data?.data?.order || activeOrder;
        
        // 2. Mark as complete
        const completeRes = await deliveryAPI.completeDelivery(orderId, 5, '');
        if (completeRes.data?.success && completeRes.data?.data?.order) {
          const completionPayload = completeRes.data.data || {};
          const completionEarnings = completionPayload.earnings || {};
          finalOrder = {
            ...completionPayload.order,
            earnings: Number(completionEarnings.amount || 0),
            deliveryEarning: Number(completionEarnings.amount || 0),
            riderEarning: Number(completionEarnings.amount || 0),
            estimatedEarnings: completionEarnings.breakdown
              ? {
                  ...completionEarnings.breakdown,
                  totalEarning: Number(completionEarnings.amount || 0),
                }
              : completionPayload.order?.estimatedEarnings,
          };
        } else {
          toast.error(completeRes.data?.message || 'Failed to complete delivery on server');
          throw new Error('Complete call failed');
        }
        
        // Update local order state so Summary Modal shows 'delivered' status
        if (finalOrder) setActiveOrder(finalOrder);
        
        updateTripStatus('COMPLETED');
        // toast.success('Delivery Success!');
      } else {
        toast.error('Invalid OTP. Please check with customer.');
        throw new Error('Invalid OTP');
      }
    } catch (error) {
      console.error('Completion Error:', error);
      toast.error(error?.response?.data?.message || 'Verification failed');
      throw error;
    }
  };

  const resetTrip = () => {
    clearActiveOrder();
  };

  return {
    acceptOrder,
    reachPickup,
    pickUpOrder,
    reachDrop,
    completeDelivery,
    resetTrip,
  };
};
