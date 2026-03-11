import mongoose from 'mongoose';

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

const DELIVERY_SLAB_MARGIN_KM = 0.2;
const roundKm = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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
  // Get all active rules sorted by minDistance (ascending)
  const rules = await this.find(buildActiveRulesQuery(tier)).sort({ minDistance: 1 });

  if (!rules || rules.length === 0) {
    throw new Error('No commission rules found');
  }

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
        perKmApplied: false,
        slabShiftKm: DELIVERY_SLAB_MARGIN_KM
      }
    };
  }

  // Delivery partner slabs are shifted by +0.2 km (Option A)
  // Example: 0-4 -> 0-4.2, 4-6 -> 4.2-6.2
  const shiftedRules = rules.map((rule, index) => {
    const originalMin = Number(rule.minDistance || 0);
    const originalMax = rule.maxDistance === null || rule.maxDistance === undefined
      ? null
      : Number(rule.maxDistance);

    return {
      rule,
      index,
      effectiveMin: index === 0 ? originalMin : roundKm(originalMin + DELIVERY_SLAB_MARGIN_KM),
      effectiveMax: originalMax === null ? null : roundKm(originalMax + DELIVERY_SLAB_MARGIN_KM)
    };
  });

  const baseRuleEntry = shiftedRules.find((entry) => Number(entry.rule.minDistance) === 0) || shiftedRules[0];

  let applicableRuleEntry = null;
  for (const entry of shiftedRules) {
    const lowerBoundOk = entry.index === 0
      ? normalizedDistance >= entry.effectiveMin
      : normalizedDistance > entry.effectiveMin;
    const upperBoundOk = entry.effectiveMax === null || normalizedDistance <= entry.effectiveMax;

    if (lowerBoundOk && upperBoundOk) {
      applicableRuleEntry = entry;
      break;
    }
  }

  if (!applicableRuleEntry) {
    applicableRuleEntry = shiftedRules[shiftedRules.length - 1] || baseRuleEntry;
  }

  const inBaseSlab = normalizedDistance >= baseRuleEntry.effectiveMin &&
    (baseRuleEntry.effectiveMax === null || normalizedDistance <= baseRuleEntry.effectiveMax);

  const appliedEntry = inBaseSlab ? baseRuleEntry : applicableRuleEntry;
  const appliedRule = appliedEntry.rule;

  // Payout rule:
  // - Base slab: fixed base payout
  // - Non-base slabs: full distance * slab per-km
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
      commissionPerKm: appliedRule.commissionPerKm,
      distanceCommission,
      perKmApplied: !inBaseSlab,
      slabShiftKm: DELIVERY_SLAB_MARGIN_KM
    }
  };
};

const DeliveryBoyCommission = mongoose.model('DeliveryBoyCommission', deliveryBoyCommissionSchema);

export default DeliveryBoyCommission;



