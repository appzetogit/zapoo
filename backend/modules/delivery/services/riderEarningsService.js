import DeliveryBoyCommission from '../../admin/models/DeliveryBoyCommission.js';

const DEFAULT_EMERGENCY_BASE_PAYOUT = 20;

const roundCurrency = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const resolveEmergencyBasePayout = () => {
  const envValue = Number(process.env.DELIVERY_EMERGENCY_BASE_PAY);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return roundCurrency(envValue);
  }
  return DEFAULT_EMERGENCY_BASE_PAYOUT;
};

export const calculateRiderEarning = async ({
  distanceKm,
  tierName = null,
  context = 'unknown',
}) => {
  const normalizedDistance = Math.max(0, Number(distanceKm) || 0);

  if (!tierName) {
    console.warn(`[rider-earnings] tier unresolved for context=${context}`);
  }
  if (!(normalizedDistance > 0)) {
    console.warn(
      `[rider-earnings] distance missing/zero for context=${context}; emergency payout path may be used`
    );
  }

  try {
    const commissionResult = await DeliveryBoyCommission.calculateCommission(
      normalizedDistance,
      tierName
    );
    const amount = roundCurrency(commissionResult?.commission || 0);
    if (!(amount > 0)) {
      throw new Error('non-positive commission result');
    }

    const breakdown = commissionResult?.breakdown || {};
    return {
      amount,
      source: 'commission',
      usedEmergencyFallback: false,
      fallbackReason: null,
      reconciliationRequired: false,
      breakdown: {
        basePayout: roundCurrency(breakdown.basePayout || 0),
        distance: roundCurrency(normalizedDistance),
        commissionPerKm: roundCurrency(breakdown.commissionPerKm || 0),
        distanceCommission: roundCurrency(breakdown.distanceCommission || 0),
        minDistance: breakdown.minDistance ?? 0,
        maxDistance: breakdown.maxDistance ?? null,
        perKmApplied: Boolean(breakdown.perKmApplied),
        slabShiftKm: breakdown.slabShiftKm ?? null,
        totalEarning: amount,
      },
    };
  } catch (error) {
    const emergencyAmount = resolveEmergencyBasePayout();
    console.error(
      `[rider-earnings] commission rule missing/failed for context=${context}: ${error.message}`
    );
    console.warn(
      `[rider-earnings] emergency base fallback applied for context=${context}: INR ${emergencyAmount}`
    );

    return {
      amount: emergencyAmount,
      source: 'emergency_base',
      usedEmergencyFallback: true,
      fallbackReason: error.message || 'commission_calculation_failed',
      reconciliationRequired: true,
      breakdown: {
        basePayout: emergencyAmount,
        distance: roundCurrency(normalizedDistance),
        commissionPerKm: 0,
        distanceCommission: 0,
        minDistance: 0,
        maxDistance: null,
        perKmApplied: false,
        slabShiftKm: null,
        totalEarning: emergencyAmount,
      },
    };
  }
};

