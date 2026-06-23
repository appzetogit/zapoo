const PENDING_OFFER_KEY = 'deliveryPendingOffer';
const DEDUPE_SESSION_PREFIX = 'delivery_offer_seen_';
export const DELIVERY_ASSIGNMENT_TIMEOUT_MS = 300000;

export const getOrderOfferKey = (orderData = {}) =>
  String(
    orderData?.orderMongoId ||
    orderData?.order_mongo_id ||
    orderData?.mongoId ||
    orderData?.orderId ||
    orderData?.order_id ||
    orderData?._id ||
    orderData?.id ||
    ''
  ).trim();

export const collectOrderOfferIds = (orderData = {}) => {
  const ids = [
    getOrderOfferKey(orderData),
    orderData?.orderMongoId,
    orderData?.order_mongo_id,
    orderData?.mongoId,
    orderData?.orderId,
    orderData?.order_id,
    orderData?._id,
    orderData?.id,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
};

export const ordersReferToSameOffer = (left = {}, right = {}) => {
  const leftIds = new Set(collectOrderOfferIds(left));
  const rightIds = collectOrderOfferIds(right);
  return rightIds.some((id) => leftIds.has(id));
};

export const computeOfferExpiresAt = (orderData = {}, fallbackMs = DELIVERY_ASSIGNMENT_TIMEOUT_MS) => {
  if (orderData?.offerExpiresAt) {
    const parsed = new Date(orderData.offerExpiresAt).getTime();
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  const assignmentInfo = orderData?.assignmentInfo || {};
  const notifiedAt =
    assignmentInfo.lastNotifiedAt ||
    assignmentInfo.broadcastNotifiedAt ||
    assignmentInfo.priorityNotifiedAt ||
    assignmentInfo.expandedNotifiedAt ||
    orderData?.timestamp ||
    orderData?.createdAt;

  if (notifiedAt) {
    const base = new Date(notifiedAt).getTime();
    if (Number.isFinite(base)) {
      return new Date(base + fallbackMs).toISOString();
    }
  }

  return new Date(Date.now() + fallbackMs).toISOString();
};

export const isOfferExpired = () => false;

export const getRemainingAcceptanceSeconds = (orderData = {}) => {
  const expiresAt = computeOfferExpiresAt(orderData);
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
};

export const savePendingOffer = (orderData = {}) => {
  const key = getOrderOfferKey(orderData);
  if (!key || typeof window === 'undefined') return;

  try {
    const payload = {
      orderKey: key,
      orderId: orderData?.orderId || orderData?.order_id || null,
      orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || orderData?.mongoId || orderData?._id || null,
      offerExpiresAt: computeOfferExpiresAt(orderData),
      savedAt: Date.now(),
      source: orderData?.source || 'unknown',
    };
    localStorage.setItem(PENDING_OFFER_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
};

export const readPendingOffer = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_OFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.orderKey) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingOffer = (orderData = null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!orderData) {
      localStorage.removeItem(PENDING_OFFER_KEY);
      return;
    }
    const pending = readPendingOffer();
    const key = getOrderOfferKey(orderData);
    if (!pending || !key || pending.orderKey === key) {
      localStorage.removeItem(PENDING_OFFER_KEY);
    }
  } catch {
    localStorage.removeItem(PENDING_OFFER_KEY);
  }
};

export const markOfferSeenInSession = (orderData = {}) => {
  const key = getOrderOfferKey(orderData);
  if (!key || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${DEDUPE_SESSION_PREFIX}${key}`, String(Date.now()));
  } catch {
    // ignore
  }
};

export const wasOfferSeenRecently = (orderData = {}, windowMs = 15000) => {
  const key = getOrderOfferKey(orderData);
  if (!key || typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(`${DEDUPE_SESSION_PREFIX}${key}`);
    if (!raw) return false;
    const seenAt = Number(raw);
    return Number.isFinite(seenAt) && Date.now() - seenAt < windowMs;
  } catch {
    return false;
  }
};

export const enrichOrderWithOfferMeta = (orderData = {}, source = 'socket') => {
  if (!orderData) return null;
  return {
    ...orderData,
    offerExpiresAt: computeOfferExpiresAt(orderData),
    source,
  };
};

export const isRecoverableDeliveryOffer = (order = {}, deliveryPartnerId = null) => {
  if (!order) return false;

  const status = String(order?.status || order?.orderStatus || '').toLowerCase();
  if (['cancelled', 'delivered', 'completed', 'deleted'].includes(status)) return false;

  const deliveryStateStatus = String(order?.deliveryState?.status || '').toLowerCase();
  if (['delivered', 'cancelled'].includes(deliveryStateStatus)) return false;

  const assignedPartnerId = String(
    order?.deliveryPartnerId?._id ||
    order?.deliveryPartnerId ||
    order?.assignmentInfo?.deliveryPartnerId ||
    ''
  );
  if (assignedPartnerId && deliveryPartnerId && assignedPartnerId !== String(deliveryPartnerId)) {
    return false;
  }

  const assignmentInfo = order?.assignmentInfo || {};
  const normalizedPartnerId = deliveryPartnerId ? String(deliveryPartnerId) : null;
  const notificationPhase = assignmentInfo.notificationPhase;

  if (notificationPhase === 'sequential') {
    const currentCandidateId = String(assignmentInfo.currentCandidateId || '');
    return !normalizedPartnerId || currentCandidateId === normalizedPartnerId;
  }

  const notifiedLists = [
    ...(assignmentInfo.broadcastDeliveryPartnerIds || []),
    ...(assignmentInfo.priorityDeliveryPartnerIds || []),
    ...(assignmentInfo.expandedDeliveryPartnerIds || []),
    assignmentInfo.currentCandidateId,
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  const rejectedLists = [
    ...(assignmentInfo.broadcastRejectedDeliveryPartnerIds || []),
    ...(assignmentInfo.rejectedDeliveryPartnerIds || []),
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  if (normalizedPartnerId && rejectedLists.includes(normalizedPartnerId)) return false;

  if (!assignedPartnerId) {
    if (normalizedPartnerId && notifiedLists.length > 0) {
      return notifiedLists.includes(normalizedPartnerId);
    }
    return ['confirmed', 'preparing', 'ready', 'ready_for_pickup'].includes(status);
  }

  return normalizedPartnerId ? assignedPartnerId === normalizedPartnerId : true;
};
