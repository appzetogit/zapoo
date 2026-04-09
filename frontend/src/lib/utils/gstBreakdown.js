const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const calculateCustomerGstBreakdown = ({
  subtotal = 0,
  discount = 0,
  deliveryFee = 0,
  platformFee = 0,
}) => {
  const taxableFoodAmount = Math.max(Number(subtotal || 0) - Number(discount || 0), 0);
  const foodGst = roundCurrency(taxableFoodAmount * 0.05);
  const deliveryGst = roundCurrency(Number(deliveryFee || 0) * 0.18);
  const platformGst = roundCurrency(Number(platformFee || 0) * 0.18);
  const total = roundCurrency(foodGst + deliveryGst + platformGst);

  return {
    taxableFoodAmount: roundCurrency(taxableFoodAmount),
    foodGst,
    deliveryGst,
    platformGst,
    total,
  };
};

