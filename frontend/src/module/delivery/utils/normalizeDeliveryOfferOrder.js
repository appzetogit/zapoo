const parseKmValue = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const locationFromRef = (ref) => {
  if (!ref || typeof ref !== 'object') return null;

  if (ref.lat != null || ref.latitude != null) {
    const lat = Number(ref.lat ?? ref.latitude);
    const lng = Number(ref.lng ?? ref.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        address: ref.address || ref.formattedAddress || '',
      };
    }
  }

  const geo = ref.location || ref;
  if (Array.isArray(geo?.coordinates) && geo.coordinates.length >= 2) {
    const lng = Number(geo.coordinates[0]);
    const lat = Number(geo.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        address: ref.formattedAddress || ref.address || geo.formattedAddress || geo.address || '',
      };
    }
  }

  if (geo?.latitude != null || geo?.lat != null) {
    const lat = Number(geo.latitude ?? geo.lat);
    const lng = Number(geo.longitude ?? geo.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        address: geo.formattedAddress || geo.address || ref.formattedAddress || ref.address || '',
      };
    }
  }

  return null;
};

const formatAddressText = (...parts) => {
  const text = parts
    .flatMap((part) => {
      if (!part) return [];
      if (typeof part === 'string') return [part.trim()];
      if (typeof part === 'object') {
        return [
          part.street,
          part.addressLine1,
          part.addressLine2,
          part.landmark,
          part.area,
          part.additionalDetails,
          part.formattedAddress,
          part.address,
          part.label,
          part.city,
          part.state,
          part.zipCode,
          part.pincode,
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
      }
      return [];
    })
    .filter(Boolean)
    .join(', ');

  return text || '';
};

const resolveEstimatedEarnings = (order = {}) => {
  if (order.estimatedEarnings) return order.estimatedEarnings;
  if (order.earnings) return order.earnings;

  const pricing = order.pricing || {};
  const candidates = [
    pricing.tentativeEarning,
    pricing.deliveryPartnerEarning,
    pricing.partnerEarning,
    pricing.riderEarning,
    pricing.pricingRevision?.partnerEarning,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') return candidate;
  }

  const direct = Number(
    pricing.riderEarning ||
      pricing.partnerEarning ||
      pricing.deliveryPartnerAmount ||
      pricing.basePayout
  );
  if (Number.isFinite(direct) && direct > 0) {
    return { totalEarning: direct };
  }

  return null;
};

/**
 * Normalize socket/API order payloads for the new-order modal.
 */
export const normalizeDeliveryOfferOrder = (order = {}) => {
  if (!order) return order;

  const restaurantRef =
    order.restaurantId && typeof order.restaurantId === 'object' ? order.restaurantId : null;
  const address = order.address || order.deliveryAddress || {};

  const restaurantLocation =
    locationFromRef(order.restaurantLocation) ||
    locationFromRef({
      lat: order.restaurant_lat ?? order.restaurantLat,
      lng: order.restaurant_lng ?? order.restaurantLng,
    }) ||
    locationFromRef(restaurantRef) ||
    locationFromRef(restaurantRef?.location);

  const customerLocation =
    locationFromRef(order.customerLocation) ||
    locationFromRef(order.deliveryLocation) ||
    locationFromRef(address) ||
    locationFromRef(address?.location);

  const restaurantAddress =
    formatAddressText(
      order.restaurantAddress,
      order.restaurant_address,
      restaurantLocation?.address,
      restaurantRef?.location,
      restaurantRef?.location?.formattedAddress,
      restaurantRef?.location?.address,
      restaurantRef?.address,
    ) || 'Address not available';

  const customerAddress =
    formatAddressText(
      order.customerAddress,
      order.customer_address,
      customerLocation?.address,
      address?.formattedAddress,
      address?.street,
      address?.additionalDetails,
      address?.city,
      address?.state,
      address?.zipCode,
      address?.pincode,
      typeof address === 'string' ? address : ''
    ) || 'Location not available';

  const pickupDistanceKm =
    parseKmValue(order.pickupDistanceKm) ??
    parseKmValue(order.pickupDistance) ??
    parseKmValue(order.assignmentInfo?.distance);

  const distanceKm =
    parseKmValue(order.distanceKm) ??
    parseKmValue(order.deliveryDistanceRaw) ??
    parseKmValue(order.deliveryDistance) ??
    parseKmValue(order.pricing?.distanceKm) ??
    parseKmValue(order.pricing?.distanceInKm) ??
    parseKmValue(order.pricing?.deliveryDistance);

  const estimatedEarnings = resolveEstimatedEarnings(order);

  return {
    ...order,
    orderMongoId: order.orderMongoId || order.mongoId || order._id,
    orderId: order.orderId || order._id,
    restaurantName:
      order.restaurantName ||
      order.restaurant_name ||
      restaurantRef?.name ||
      'Restaurant',
    restaurantAddress,
    restaurantLocation: restaurantLocation || order.restaurantLocation || null,
    customerLocation: customerLocation || order.customerLocation || null,
    deliveryAddress: typeof address === 'object' ? address : order.deliveryAddress,
    customerAddress,
    pickupDistanceKm,
    distanceKm,
    estimatedEarnings,
    estimatedTime:
      order.estimatedTime ||
      order.estimatedDeliveryTime ||
      order.duration ||
      order.eta ||
      null,
  };
};
