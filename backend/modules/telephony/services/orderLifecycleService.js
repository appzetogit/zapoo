import { releaseNumberForOrder } from "./numberPoolService.js";

export const handleOrderDelivered = async (orderId) => {
  if (!orderId) return;
  await releaseNumberForOrder(orderId);
};

