import DeliveryBoyCommission from "../models/DeliveryBoyCommission.js";

/**
 * Sync tier delivery distance slabs into DeliveryBoyCommission rules.
 *
 * @param {Object} params
 * @param {string} params.tierName - Name/key of the tier (e.g. 'mid').
 * @param {Object} params.deliveryPricing - Tier.deliveryPricing object.
 * @param {string|Object} [params.adminId] - Admin _id performing the sync.
 */
export const syncCommissionRulesForTier = async ({
  tierName,
  deliveryPricing,
  adminId,
}) => {
  if (!tierName || !deliveryPricing) {
    return;
  }

  const distanceSlabs = Array.isArray(deliveryPricing.distanceSlabs)
    ? deliveryPricing.distanceSlabs
    : [];

  const activeSlabs = distanceSlabs.filter(
    (slab) => slab && slab.isActive !== false
  );

  // If no active slabs, just clear existing rules for this tier
  if (activeSlabs.length === 0) {
    await DeliveryBoyCommission.deleteMany({ tier: tierName });
    return;
  }

  const basePay = Number(deliveryPricing.basePay || deliveryPricing.baseFee || 0);

  // Fetch existing rules so that manual per‑km and base payout edits are preserved
  const existingRules = await DeliveryBoyCommission.find({ tier: tierName });
  const existingByRangeKey = new Map();
  existingRules.forEach((rule) => {
    const key = `${Number(rule.minDistance || 0)}-${rule.maxDistance === null || rule.maxDistance === undefined ? "null" : Number(rule.maxDistance)}`;
    existingByRangeKey.set(key, rule);
  });

  const docs = activeSlabs
    .sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0))
    .map((slab) => {
      const isBase = slab.isBaseSlab === true;
      const minDistance = Number(slab.minKm || 0);
      const maxDistance =
        slab.maxKm === null || slab.maxKm === undefined
          ? null
          : Number(slab.maxKm);

      const key = `${minDistance}-${maxDistance === null ? "null" : maxDistance}`;
      const existing = existingByRangeKey.get(key);

      return {
        name: `${tierName.toUpperCase()} ${slab.minKm}-${slab.maxKm ?? "∞"}km`,
        minDistance,
        maxDistance,
        // For existing ranges, keep whatever admin had set; for new ones, start from 0
        commissionPerKm: existing ? Number(existing.commissionPerKm || 0) : 0,
        // Same for base payout: keep manual value if present, otherwise derive from tier for base slab
        basePayout: existing
          ? Number(existing.basePayout || 0)
          : isBase
            ? basePay
            : 0,
        status: true,
        tier: tierName,
      };
    });

  if (docs.length === 0) {
    return;
  }

  // Replace existing rules for this tier
  await DeliveryBoyCommission.deleteMany({ tier: tierName });
  await DeliveryBoyCommission.insertMany(docs);
};

