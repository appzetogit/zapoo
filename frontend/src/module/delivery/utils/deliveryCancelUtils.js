import { ordersReferToSameOffer } from './deliveryOfferStorage';

export const getCancellationToastMessage = (cancelledBy) => {
  const normalized = String(cancelledBy || '').toLowerCase();
  if (normalized === 'admin') return 'Cancelled by admin';
  if (normalized === 'restaurant') return 'Cancelled by restaurant';
  if (normalized === 'user') return 'Cancelled by user';
  return 'Order cancelled';
};

export const isCancelledOrderStatusUpdate = (statusUpdate) => {
  const status = String(statusUpdate?.status || '').toLowerCase();
  return ['cancelled', 'deleted'].includes(status);
};

export const orderCancellationAffects = (statusUpdate, ...orderRefs) => {
  if (!statusUpdate) {
    return { affectsAny: false, matches: [] };
  }

  const matches = (orderRefs || []).filter(
    (orderRef) => orderRef && ordersReferToSameOffer(statusUpdate, orderRef)
  );

  return {
    affectsAny: matches.length > 0,
    matches,
  };
};

export const isTripHistoryCancelledStatus = (status = '') => {
  return String(status || '').toLowerCase().includes('cancelled');
};
