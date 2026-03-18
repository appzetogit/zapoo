import OrderSettlement from '../models/OrderSettlement.js';
import AdminWallet from '../../admin/models/AdminWallet.js';
import AuditLog from '../../admin/models/AuditLog.js';
import Order from '../models/Order.js';
import { creditRestaurantWallet, creditDeliveryWallet } from './settlementService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hold funds in escrow when order is placed
 */
export const holdEscrow = async (orderId, userId, amount) => {
  try {
    let settlement = await OrderSettlement.findOne({ orderId });
    if (!settlement) {
      settlement = await OrderSettlement.findOrCreateByOrderId(orderId);
    }

    settlement.escrowStatus = 'held';
    settlement.escrowAmount = amount;
    settlement.escrowHeldAt = new Date();
    await settlement.save();

    await creditAdminEscrowHold(settlement, amount);

    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'escrow_hold',
      actionType: 'create',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: amount,
        type: 'escrow_hold',
        status: 'success',
        orderId: orderId
      },
      description: `Escrow held for order ${settlement.orderNumber}`
    });

    return settlement;
  } catch (error) {
    console.error('Error holding escrow:', error);
    throw new Error(`Failed to hold escrow: ${error.message}`);
  }
};

/**
 * Release escrow after delivery and mark settlement windows
 */
export const releaseEscrow = async (orderId) => {
  try {
    const settlement = await OrderSettlement.findOne({ orderId });
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    if (settlement.escrowStatus !== 'held') {
      throw new Error(`Escrow not in held status. Current status: ${settlement.escrowStatus}`);
    }

    const now = new Date();
    settlement.escrowStatus = 'released';
    settlement.escrowReleasedAt = now;
    settlement.settlementStatus = 'completed';

    settlement.restaurantEarning.status = 'pending';
    settlement.restaurantSettled = false;
    settlement.deliveryPartnerEarning.status = 'pending';
    settlement.deliveryPartnerSettled = false;

    settlement.settlementWindows = {
      restaurantEligibleAt: new Date(now.getTime() + (3 * DAY_MS)),
      deliveryPartnerEligibleAt: new Date(now.getTime() + (7 * DAY_MS))
    };

    // Auto-credit wallets so balances are visible immediately (payout still manual via withdrawal)
    await creditRestaurantWallet(settlement);
    await creditDeliveryWallet(settlement);

    await creditAdminWallet(
      settlement.orderId,
      settlement.adminEarning,
      settlement.orderNumber,
      settlement.restaurantId
    );

    settlement.adminEarning.status = 'credited';
    settlement.adminEarning.creditedAt = now;
    settlement.adminSettled = true;

    await settlement.save();

    // Reduce escrow for prepaid orders; COD escrow is reduced on cash deposit
    let paymentMethod = null;
    try {
      const order = await Order.findById(orderId).select('payment.method').lean();
      paymentMethod = order?.payment?.method || null;
    } catch (_) {}
    const isCash = paymentMethod === 'cash' || paymentMethod === 'cod';
    if (!isCash) {
      await creditAdminEscrowRelease(settlement, settlement.escrowAmount);
    }

    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'escrow_release',
      actionType: 'settle',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: settlement.escrowAmount,
        type: 'escrow_release',
        status: 'success',
        orderId: orderId
      },
      description: `Escrow released for order ${settlement.orderNumber}. Restaurant settlement: +3 days, Delivery settlement: weekly`
    });

    return settlement;
  } catch (error) {
    console.error('Error releasing escrow:', error);
    throw new Error(`Failed to release escrow: ${error.message}`);
  }
};

/**
 * Credit admin wallet
 */
const creditAdminWallet = async (orderId, adminEarning, orderNumber, restaurantId) => {
  try {
    const wallet = await AdminWallet.findOrCreate();

    if (adminEarning.platformFee > 0) {
      wallet.addTransaction({
        amount: adminEarning.platformFee,
        type: 'platform_fee',
        status: 'Completed',
        description: `Platform fee from order ${orderNumber}`,
        orderId: orderId
      });
    }

    const adminDeliveryCost = Number(adminEarning.adminDeliveryCost ?? adminEarning.deliveryFee ?? 0);
    if (adminDeliveryCost > 0) {
      wallet.addTransaction({
        amount: adminDeliveryCost,
        type: 'delivery_fee',
        status: 'Completed',
        description: `Admin delivery cost from order ${orderNumber}`,
        orderId: orderId
      });
    }

    if (adminEarning.gst > 0) {
      wallet.addTransaction({
        amount: adminEarning.gst,
        type: 'gst',
        status: 'Completed',
        description: `GST from order ${orderNumber}`,
        orderId: orderId
      });
    }

    if (adminEarning.recommendedItemFee > 0) {
      wallet.addTransaction({
        amount: adminEarning.recommendedItemFee,
        type: 'recommended_item_fee',
        status: 'Completed',
        description: `Fee for recommended items in order ${orderNumber}`,
        orderId: orderId,
        restaurantId: restaurantId
      });
    }

    await wallet.save();

    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'admin_wallet_credit',
      actionType: 'credit',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: adminEarning.totalEarning,
        type: 'platform_earning',
        status: 'success',
        orderId: orderId,
        walletType: 'admin'
      },
      description: `Admin wallet credited for order ${orderNumber}`
    });
  } catch (error) {
    console.error('Error crediting admin wallet:', error);
    throw error;
  }
};

const creditAdminEscrowHold = async (settlement, amount) => {
  try {
    const wallet = await AdminWallet.findOrCreate();
    const alreadyHeld = wallet.transactions?.some(
      (t) => t.type === 'escrow_hold' && t.orderId && String(t.orderId) === String(settlement.orderId)
    );
    if (alreadyHeld) {
      return;
    }
    wallet.addTransaction({
      amount,
      type: 'escrow_hold',
      status: 'Completed',
      description: `Escrow hold for order ${settlement.orderNumber}`,
      orderId: settlement.orderId,
      restaurantId: settlement.restaurantId
    });
    await wallet.save();
  } catch (error) {
    console.error('Error crediting admin escrow hold:', error);
  }
};

const creditAdminEscrowRelease = async (settlement, amount) => {
  try {
    if (!amount || amount <= 0) return;
    const wallet = await AdminWallet.findOrCreate();
    const alreadyReleased = wallet.transactions?.some(
      (t) => t.type === 'escrow_release' && t.orderId && String(t.orderId) === String(settlement.orderId)
    );
    if (alreadyReleased) {
      return;
    }
    wallet.addTransaction({
      amount,
      type: 'escrow_release',
      status: 'Completed',
      description: `Escrow release for order ${settlement.orderNumber}`,
      orderId: settlement.orderId,
      restaurantId: settlement.restaurantId
    });
    await wallet.save();
  } catch (error) {
    console.error('Error crediting admin escrow release:', error);
  }
};
