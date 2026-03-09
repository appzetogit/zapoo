const roundCurrency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isInRange = (value, min, max) => {
  if (value < min) return false;
  if (max === null || max === undefined) return true;
  return value <= max;
};
const findOrderValueSlab = (orderValueSlabs, subtotal) => {
  if (!Array.isArray(orderValueSlabs) || orderValueSlabs.length === 0) return null;
  const sortedSlabs = [...orderValueSlabs].sort((a, b) => Number(a.minOrderValue || 0) - Number(b.minOrderValue || 0));
  return sortedSlabs.find(slab => isInRange(subtotal, Number(slab.minOrderValue || 0), slab.maxOrderValue === null || slab.maxOrderValue === undefined ? null : Number(slab.maxOrderValue))) || null;
};
const findDistanceSlab = (distanceSlabs, distanceKm) => {
  const activeSlabs = (distanceSlabs || []).filter(slab => slab.isActive !== false);
  if (activeSlabs.length === 0) return null;
  const sortedSlabs = [...activeSlabs].sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0));
  return sortedSlabs.find(slab => isInRange(distanceKm, Number(slab.minKm || 0), slab.maxKm === null || slab.maxKm === undefined ? null : Number(slab.maxKm))) || sortedSlabs[sortedSlabs.length - 1] || null;
};
const findBaseDistanceSlab = distanceSlabs => {
  const activeSlabs = (distanceSlabs || []).filter(slab => slab.isActive !== false);
  return activeSlabs.find(slab => slab.isBaseSlab === true) || activeSlabs[0] || null;
};
const calculateRestaurantCustomerDeliveryFee = ({
  subtotal,
  distanceKm,
  restaurant,
  matchedDistanceSlab
}) => {
  const config = restaurant?.deliveryPricingConfig;
  if (!config?.isEnabled) return {
    customerDeliveryFee: 0
  };
  const matchedOrderValueSlab = findOrderValueSlab(config.orderValueSlabs, subtotal);
  if (!matchedOrderValueSlab || !matchedDistanceSlab) {
    return {
      customerDeliveryFee: 0
    };
  }
  const matchedRateRule = (config.customerDeliveryRates || []).find(rate => String(rate.distanceSlabId) === String(matchedDistanceSlab._id) && String(rate.orderValueSlabId) === String(matchedOrderValueSlab._id));
  const customerPerKmRate = Number(matchedRateRule?.perKmRate || 0);
  return {
    customerDeliveryFee: roundCurrency(distanceKm * customerPerKmRate)
  };
};

// Test Scenarios
const runTests = () => {
  const globalSlabs = [{
    _id: 'global-1',
    minKm: 0,
    maxKm: 5,
    isActive: true
  }];
  const tierSlabs = [{
    _id: 'tier-1',
    minKm: 0,
    maxKm: 5,
    isActive: true
  }];
  const restaurant = {
    deliveryPricingConfig: {
      isEnabled: true,
      orderValueSlabs: [{
        _id: 'ov-1',
        minOrderValue: 0,
        maxOrderValue: 1000
      }],
      customerDeliveryRates: [{
        distanceSlabId: 'tier-1',
        orderValueSlabId: 'ov-1',
        perKmRate: 10
      }, {
        distanceSlabId: 'global-1',
        orderValueSlabId: 'ov-1',
        perKmRate: 50
      } // Should NOT be used
      ]
    }
  };

  // Scenario 1: Tier has slabs (My code: distanceSlabs = tierDistanceSlabs)
  let distanceSlabs = tierSlabs;
  let matchedDistanceSlab = findDistanceSlab(distanceSlabs, 2) || findBaseDistanceSlab(distanceSlabs);
  let result = calculateRestaurantCustomerDeliveryFee({
    subtotal: 100,
    distanceKm: 2,
    restaurant,
    matchedDistanceSlab
  });
  // Scenario 2: Tier has NO slabs (My code: distanceSlabs = [])
  distanceSlabs = []; // Logic I implemented
  matchedDistanceSlab = findDistanceSlab(distanceSlabs, 2) || findBaseDistanceSlab(distanceSlabs);
  result = calculateRestaurantCustomerDeliveryFee({
    subtotal: 100,
    distanceKm: 2,
    restaurant,
    matchedDistanceSlab
  });
  // Scenario 3: No Tier assigned (My code: distanceSlabs = [])
  distanceSlabs = [];
  matchedDistanceSlab = findDistanceSlab(distanceSlabs, 2) || findBaseDistanceSlab(distanceSlabs);
  result = calculateRestaurantCustomerDeliveryFee({
    subtotal: 100,
    distanceKm: 2,
    restaurant,
    matchedDistanceSlab
  });
};
runTests();