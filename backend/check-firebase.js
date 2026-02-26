import { getDb, initializeFirebaseRealtime } from './config/firebaseConfig.js';

async function checkFirebaseData() {
    try {
        console.log('🔄 Connecting to Firebase...');
        initializeFirebaseRealtime();
        const db = getDb();

        console.log('\n--- Checking Delivery Boys ---');
        const boysSnapshot = await db.ref('delivery_boys').once('value');
        const boysData = boysSnapshot.val();

        if (boysData) {
            console.log(`✅ Found ${Object.keys(boysData).length} delivery boys in Firebase:`);
            Object.entries(boysData).forEach(([boyId, data]) => {
                console.log(`  - Boy ID: ${boyId}`);
                console.log(`    Status: ${data.status}`);
                console.log(`    Location: [${data.lat}, ${data.lng}]`);
                console.log(`    Last Updated: ${new Date(data.last_updated).toLocaleString()}`);
            });
        } else {
            console.log('ℹ️ No delivery boys found in Firebase currently. (This is normal if no one is online/has updated location)');
        }

        console.log('\n--- Checking Active Orders ---');
        const ordersSnapshot = await db.ref('active_orders').once('value');
        const ordersData = ordersSnapshot.val();

        if (ordersData) {
            console.log(`✅ Found ${Object.keys(ordersData).length} active orders in Firebase:`);
            Object.entries(ordersData).forEach(([orderId, data]) => {
                console.log(`  - Order ID: ${orderId}`);
                console.log(`    Delivery Boy Location: [${data.boy_lat}, ${data.boy_lng}]`);
                console.log(`    Has Route to Pickup: ${!!data.routeToPickup}`);
                console.log(`    Has Route to Delivery: ${!!data.routeToDelivery}`);
                console.log(`    Last Updated: ${new Date(data.last_updated).toLocaleString()}`);
            });
        } else {
            console.log('ℹ️ No active orders found in Firebase currently. (This is normal if there are no ongoing deliveries)');
        }

    } catch (error) {
        console.error('❌ Error reading from Firebase:', error);
    } finally {
        process.exit(0);
    }
}

checkFirebaseData();
