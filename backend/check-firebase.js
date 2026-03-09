import { getDb, initializeFirebaseRealtime } from './config/firebaseConfig.js';
async function checkFirebaseData() {
  try {
    initializeFirebaseRealtime();
    const db = getDb();
    const boysSnapshot = await db.ref('delivery_boys').once('value');
    const boysData = boysSnapshot.val();
    if (boysData) {
      Object.entries(boysData).forEach(([boyId, data]) => {});
    } else {}
    const ordersSnapshot = await db.ref('active_orders').once('value');
    const ordersData = ordersSnapshot.val();
    if (ordersData) {
      Object.entries(ordersData).forEach(([orderId, data]) => {});
    } else {}
  } catch (error) {
    console.error('❌ Error reading from Firebase:', error);
  } finally {
    process.exit(0);
  }
}
checkFirebaseData();