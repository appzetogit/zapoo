/**
 * Whether an order can be admin-cancelled on the Food On The Way page.
 * Mirrors backend rules; also works if adminCancellable is missing from older API responses.
 */
export function canAdminCancelOrder(order) {
  if (!order) return false;
  if (order.adminCancellable === true) return true;

  const status = order.status || "";
  const isOutForDelivery =
    status === "out_for_delivery" || order.orderStatus === "Food On The Way";
  if (!isOutForDelivery) return false;

  const total = Number(order.totalAmount) || 0;
  const escrow = order.escrowStatus;
  const escrowReady =
    escrow === "held" || (escrow === "pending" && total > 0);

  const isCod = order.paymentType === "Cash on Delivery";
  const isPaid =
    order.paymentStatus === "Paid" ||
    String(order.payment?.status || "").toLowerCase() === "completed";

  const paymentOk = isPaid || isCod;
  if (!paymentOk) return false;

  if (escrow === "released" || escrow === "refunded") return false;
  if (escrowReady) return true;

  // API may omit escrowStatus on older backend builds — allow COD food-on-the-way.
  if ((escrow === null || escrow === undefined) && isCod) return true;

  return false;
}
