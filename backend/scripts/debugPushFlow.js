import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import DeviceToken from '../modules/notification/models/DeviceToken.js';
import { sendNotificationToUser } from '../modules/notification/utils/pushNotificationHelper.js';

dotenv.config();

const roleUserIdMap = {
  user: process.env.DEBUG_PUSH_USER_ID || '',
  restaurant: process.env.DEBUG_PUSH_RESTAURANT_ID || '',
  delivery: process.env.DEBUG_PUSH_DELIVERY_ID || '',
  admin: process.env.DEBUG_PUSH_ADMIN_ID || '',
};

async function printTokenStats() {
  const stats = await DeviceToken.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n[DEBUG-PUSH] Active DeviceToken count by role');
  if (!stats.length) {
    console.log('[DEBUG-PUSH] No active tokens found');
    return;
  }
  for (const row of stats) {
    console.log(`[DEBUG-PUSH] role=${row._id} count=${row.count}`);
  }
}

async function sendRoleTest(role, userId) {
  if (!userId) {
    console.log(`[DEBUG-PUSH] Skip role=${role} (no DEBUG_PUSH_${role.toUpperCase()}_ID set)`);
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.log(`[DEBUG-PUSH] Skip role=${role} invalid ObjectId: ${userId}`);
    return;
  }

  console.log(`[DEBUG-PUSH] Sending role test for role=${role} userId=${userId}`);
  await sendNotificationToUser(
    userId,
    role,
    'Debug Push Test',
    `Debug event push for ${role} at ${new Date().toISOString()}`,
    {
      type: 'debug_flow_test',
      clickUrl: '/',
      notificationId: `debug_${role}_${Date.now()}`
    }
  );
}

async function run() {
  await connectDB();
  await printTokenStats();

  for (const [role, userId] of Object.entries(roleUserIdMap)) {
    await sendRoleTest(role, userId);
  }
}

run()
  .then(async () => {
    await mongoose.connection.close();
    console.log('[DEBUG-PUSH] Done');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[DEBUG-PUSH] Failed:', err);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  });
