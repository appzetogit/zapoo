import mongoose from 'mongoose';
import Tier from './Tier.js';

const deliveryBoyCommissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    minDistance: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Minimum distance must be 0 or greater'
      }
    },
    maxDistance: {
      type: Number,
      default: null, // null means unlimited
      validate: {
        validator: function(value) {
          // Allow null (unlimited)
          if (value === null || value === undefined) return true;
          // If value is provided, it must be greater than minDistance
          if (this.minDistance !== undefined && this.minDistance !== null) {
            return parseFloat(value) > parseFloat(this.minDistance);
          }
          return true;
        },
        message: 'Maximum distance must be greater than minimum distance'
      }
    },
    commissionPerKm: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Commission per km must be 0 or greater'
      }
    },
    basePayout: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Base payout must be 0 or greater'
      }
    },
    // Tier key this rule belongs to (e.g. basic / mid / premium)
    tier: {
      type: String,
      default: 'default',
      index: true,
      trim: true
    },
    status: {
      type: Boolean,
      default: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes
deliveryBoyCommissionSchema.index({ minDistance: 1, maxDistance: 1 });
deliveryBoyCommissionSchema.index({ status: 1 });
deliveryBoyCommissionSchema.index({ createdAt: -1 });

// Method to check if a distance falls within this commission range
deliveryBoyCommissionSchema.methods.isDistanceInRange = function(distance) {
  if (distance < this.minDistance) return false;
  if (this.maxDistance !== null && distance > this.maxDistance) return false;
  return true;
};

// Helper to build the base query for active rules, optionally filtered by tier
const buildActiveRulesQuery = (tier) => {
  const query = { status: true };
  if (tier) {
    query.tier = tier;
  }
  return query;
};

const buildRuleEntries = (items, minKey, maxKey) =>
  items.map((item, index) => {
    const originalMin = Number(item[minKey] || 0);
    const originalMax = item[maxKey] === null || item[maxKey] === undefined
      ? null
      : Number(item[maxKey]);

    return {
      rule: item,
      index,
      effectiveMin: originalMin,
      effectiveMax: originalMax
    };
  });

const resolveCommissionFromEntries = (entries, normalizedDistance) => {
  const baseRuleEntry =
    entries.find((entry) => entry.rule.isBaseSlab === true) ||
    entries.find((entry) => Number(entry.rule.minDistance) === 0) ||
    entries[0];

  let applicableRuleEntry = null;
  for (const entry of entries) {
    const lowerBoundOk = normalizedDistance >= entry.effectiveMin;
    const upperBoundOk = entry.effectiveMax === null || normalizedDistance <= entry.effectiveMax;

    if (lowerBoundOk && upperBoundOk) {
      applicableRuleEntry = entry;
      break;
    }
  }

  if (!applicableRuleEntry) {
    applicableRuleEntry = entries[entries.length - 1] || baseRuleEntry;
  }

  const inBaseSlab = normalizedDistance >= baseRuleEntry.effectiveMin &&
    (baseRuleEntry.effectiveMax === null || normalizedDistance <= baseRuleEntry.effectiveMax);

  const appliedEntry = inBaseSlab ? baseRuleEntry : applicableRuleEntry;
  const appliedRule = appliedEntry.rule;

  let basePayout = 0;
  let distanceCommission = 0;

  if (inBaseSlab) {
    basePayout = Number(baseRuleEntry.rule.basePayout || 0);
  } else {
    distanceCommission = normalizedDistance * Number(appliedRule.commissionPerKm || 0);
  }

  const commission = basePayout + distanceCommission;

  return {
    rule: appliedRule,
    commission: Math.round(commission * 100) / 100,
    breakdown: {
      basePayout,
      distance: normalizedDistance,
      minDistance: appliedEntry.effectiveMin,
      maxDistance: appliedEntry.effectiveMax,
      commissionPerKm: Number(appliedRule.commissionPerKm || 0),
      distanceCommission,
      perKmApplied: !inBaseSlab
    }
  };
};

// Static method to find applicable commission rule for a distance
// Optionally filters by tier (string); if not provided, uses all active rules.
deliveryBoyCommissionSchema.statics.findApplicableRule = async function(distance, tier = null) {
  const rules = await this.find(buildActiveRulesQuery(tier)).sort({ minDistance: 1 });
  
  for (const rule of rules) {
    if (rule.isDistanceInRange(distance)) {
      return rule;
    }
  }
  
  // If no exact match, find the nearest rule
  // For distances less than minimum, return the first rule
  // For distances greater than maximum, return the last rule (or unlimited rule)
  const firstRule = rules[0];
  const lastRule = rules[rules.length - 1];
  
  if (distance < firstRule.minDistance) {
    return firstRule;
  }
  
  // Find unlimited rule (maxDistance === null)
  const unlimitedRule = rules.find(r => r.maxDistance === null);
  if (unlimitedRule && distance > unlimitedRule.minDistance) {
    return unlimitedRule;
  }
  
  // Return last rule as fallback
  return lastRule || firstRule;
};

// Static method to calculate commission for a given distance
// Optionally filters by tier (string); if not provided, uses all active rules.
deliveryBoyCommissionSchema.statics.calculateCommission = async function(distance, tier = null) {
  const normalizedDistance = Math.max(0, Number(distance) || 0);

  // Explicit rule: exact 0 km is excluded from payout range.
  if (normalizedDistance === 0) {
    return {
      rule: null,
      commission: 0,
      breakdown: {
        basePayout: 0,
        distance: 0,
        minDistance: 0,
        maxDistance: 0,
        commissionPerKm: 0,
        distanceCommission: 0,
        perKmApplied: false
      }
    };
  }

  if (tier) {
    const tierDoc = await Tier.findOne({ name: tier })
      .select('name deliveryPricing.basePay deliveryPricing.baseFee deliveryPricing.distanceSlabs')
      .lean();

    const tierSlabs = Array.isArray(tierDoc?.deliveryPricing?.distanceSlabs)
      ? tierDoc.deliveryPricing.distanceSlabs.filter((slab) => slab && slab.isActive !== false)
      : [];

    if (tierSlabs.length > 0) {
      const basePay = Number(tierDoc?.deliveryPricing?.basePay || tierDoc?.deliveryPricing?.baseFee || 0);
      const tierRules = tierSlabs
        .sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0))
        .map((slab) => ({
          name: `${tierDoc?.name || tier} ${slab.minKm}-${slab.maxKm ?? '∞'}km`,
          minDistance: Number(slab.minKm || 0),
          maxDistance: slab.maxKm === null || slab.maxKm === undefined ? null : Number(slab.maxKm),
          commissionPerKm: slab.isBaseSlab === true ? 0 : Number(slab.adminPerKmRate || 0),
          basePayout: slab.isBaseSlab === true ? basePay : 0,
          tier: tierDoc?.name || tier,
          isBaseSlab: slab.isBaseSlab === true,
          metadata: {
            source: 'tier_distance_slab',
            slabId: slab._id?.toString?.() || null,
            adminPerKmRate: Number(slab.adminPerKmRate || 0)
          }
        }));

      const tierRuleEntries = buildRuleEntries(tierRules, 'minDistance', 'maxDistance');
      return resolveCommissionFromEntries(tierRuleEntries, normalizedDistance);
    }
  }

  // Fallback to synced commission rows when tier slabs are unavailable
  const rules = await this.find(buildActiveRulesQuery(tier)).sort({ minDistance: 1 });

  if (!rules || rules.length === 0) {
    throw new Error('No commission rules found');
  }

  const ruleEntries = buildRuleEntries(rules, 'minDistance', 'maxDistance');
  return resolveCommissionFromEntries(ruleEntries, normalizedDistance);
};

const DeliveryBoyCommission = mongoose.model('DeliveryBoyCommission', deliveryBoyCommissionSchema);

export default DeliveryBoyCommission;


