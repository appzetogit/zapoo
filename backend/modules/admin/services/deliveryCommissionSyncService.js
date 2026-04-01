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

  const docs = activeSlabs
    .sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0))
    .map((slab) => {
      const isBase = slab.isBaseSlab === true;
      const minDistance = Number(slab.minKm || 0);
      const maxDistance =
        slab.maxKm === null || slab.maxKm === undefined
          ? null
          : Number(slab.maxKm);

      return {
        name: `${tierName.toUpperCase()} ${slab.minKm}-${slab.maxKm ?? "∞"}km`,
        minDistance,
        maxDistance,
        commissionPerKm: isBase ? 0 : Number(slab.adminPerKmRate || 0),
        basePayout: isBase ? basePay : 0,
        status: true,
        tier: tierName,
        metadata: {
          syncedFromTier: true,
          syncedAt: new Date(),
          syncedBy: adminId || null,
          isBaseSlab: isBase,
          adminPerKmRate: Number(slab.adminPerKmRate || 0),
        },
      };
    });

  if (docs.length === 0) {
    return;
  }

  // Replace existing rules for this tier
  await DeliveryBoyCommission.deleteMany({ tier: tierName });
  await DeliveryBoyCommission.insertMany(docs);
};
