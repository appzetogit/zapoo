import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import Order from '../modules/order/models/Order.js';
import DeliveryWallet from '../modules/delivery/models/DeliveryWallet.js';
import DeliveryBoyCommission from '../modules/admin/models/DeliveryBoyCommission.js';
import OrderSettlement from '../modules/order/models/OrderSettlement.js';

dotenv.config();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: false,
    since: null,
    until: null,
    limit: 0
  };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    if (arg.startsWith('--since=')) opts.since = arg.split('=')[1];
    if (arg.startsWith('--until=')) opts.until = arg.split('=')[1];
    if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
  }
  return opts;
};

const buildQuery = (opts) => {
  const deliveredStatuses = ['delivered', 'completed'];
  const deliveredPhases = ['completed', 'delivered'];
  const query = {
    deliveryPartnerId: { $exists: true, $ne: null },
    $or: [
      { status: { $in: deliveredStatuses } },
      { 'deliveryState.currentPhase': { $in: deliveredPhases } },
      { 'deliveryState.status': 'delivered' }
    ]
  };
  if (opts.since || opts.until) {
    query.createdAt = {};
    if (opts.since) query.createdAt.$gte = new Date(opts.since);
    if (opts.until) query.createdAt.$lte = new Date(opts.until);
  }
  return query;
};

const safeToString = (val) => (val && val.toString ? val.toString() : String(val || ''));

const getDistanceKm = (order) => {
  if (order?.deliveryState?.routeToDelivery?.distance) return Number(order.deliveryState.routeToDelivery.distance) || 0;
  if (order?.assignmentInfo?.distance) return Number(order.assignmentInfo.distance) || 0;
  return 0;
};

const getEarningsAmount = async (order) => {
  const settlement = await OrderSettlement.findOne({ orderId: order._id }).lean();
  const settlementEarning = Number(settlement?.deliveryPartnerEarning?.totalEarning) || 0;
  if (settlementEarning > 0) {
    return { amount: settlementEarning, source: 'settlement' };
  }

  const distance = getDistanceKm(order);
  if (distance > 0) {
    try {
      const commissionResult = await DeliveryBoyCommission.calculateCommission(distance);
      const commission = Number(commissionResult?.commission) || 0;
      if (commission > 0) {
        return { amount: commission, source: 'commission' };
      }
    } catch {
      // ignore commission errors, fallback to delivery fee
    }
  }

  const fallback = Number(order?.pricing?.deliveryFee) || 0;
  return { amount: fallback, source: 'delivery_fee' };
};

const hasExistingPaymentTx = (wallet, orderId) => {
  const orderIdStr = safeToString(orderId);
  return (wallet.transactions || []).some(
    (t) => t?.type === 'payment' && t?.orderId && safeToString(t.orderId) === orderIdStr
  );
};

const main = async () => {
  const opts = parseArgs();
  await connectDB();

  const query = buildQuery(opts);
  let cursor = Order.find(query).sort({ createdAt: 1 });
  if (opts.limit && opts.limit > 0) {
    cursor = cursor.limit(opts.limit);
  }
  const orderCursor = cursor.cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let zeroEarning = 0;

  for await (const order of orderCursor) {
    scanned += 1;
    const deliveryId = order?.deliveryPartnerId;
    if (!deliveryId) {
      skipped += 1;
      continue;
    }

    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(deliveryId);
    if (hasExistingPaymentTx(wallet, order._id)) {
      skipped += 1;
      continue;
    }

    const { amount, source } = await getEarningsAmount(order);
    if (!amount || amount <= 0) {
      zeroEarning += 1;
      continue;
    }

    if (!opts.dryRun) {
      wallet.addTransaction({
        amount,
        type: 'payment',
        status: 'Completed',
        description: `Backfill delivery earnings for Order #${order.orderId || safeToString(order._id)}`,
        orderId: order._id,
        paymentCollected: false,
        metadata: { source }
      });
      await wallet.save();
    }

    updated += 1;
    if (updated % 100 === 0) {
      console.log(`Processed: ${updated} updates (scanned ${scanned})`);
    }
  }

  console.log('Backfill complete:', {
    dryRun: opts.dryRun,
    scanned,
    updated,
    skipped,
    zeroEarning
  });

  await mongoose.connection.close();
};

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
