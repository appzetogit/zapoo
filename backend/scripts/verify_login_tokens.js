import mongoose from 'mongoose';
import fetch from 'node-fetch'; // assuming node 18+ has fetch natively, but we'll use native fetch or dynamically import if needed

const MONGO_URI = 'mongodb+srv://zapoostartup_db_user:GOqwOFq0f0ZNsbDl@cluster0.lthhweh.mongodb.net/?appName=Cluster0';
const BASE_URL = 'http://localhost:5000/api';

const PHONE = '7974161582';
const OTP = '110211';

// We'll simulate passing these tokens during login
const USER_FCM_TOKEN = 'test_fcm_token_user_123';
const RESTAURANT_FCM_TOKEN = 'test_fcm_token_restaurant_123';
const DELIVERY_FCM_TOKEN = 'test_fcm_token_delivery_123';

async function performLogin(role, sendUrl, verifyUrl, fcmToken) {
  console.log(`\n--- Testing ${role.toUpperCase()} Login ---`);
  try {
    // 1. Send OTP
    console.log(`1. Sending OTP to ${PHONE}...`);
    const sendRes = await fetch(`${BASE_URL}${sendUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE, purpose: 'login' })
    });
    
    if (!sendRes.ok) {
      console.error(`Failed to send OTP for ${role}`, await sendRes.text());
      return null;
    }

    // 2. Verify OTP
    console.log(`2. Verifying OTP with token: ${fcmToken}...`);
    const payload = {
      phone: PHONE,
      otp: OTP,
      name: `Test ${role}`,
      fcmToken: fcmToken,
      platform: 'app' // specifying app so it saves to fcmTokenApp
    };
    
    const verifyRes = await fetch(`${BASE_URL}${verifyUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      console.error(`Failed to verify OTP for ${role}`, verifyData);
      return null;
    }
    
    // Extract ID safely depending on the API's response structure
    const extractedId = verifyData.data?.user?.id || verifyData.data?.user?._id || verifyData.data?.restaurant?._id || verifyData.data?.restaurant?.id || verifyData.data?._id;
    
    if (!extractedId) {
       console.error(`Could not find ID in response for ${role}:`, JSON.stringify(verifyData));
       return null;
    }

    console.log(`✅ Login successful for ${role}. User ID:`, extractedId);
    return extractedId;
  } catch (err) {
    console.error(`Error during ${role} login:`, err.message);
    return null;
  }
}

async function verifyTokenInDB(collectionName, userId, expectedToken) {
  const db = mongoose.connection.db;
  const collection = db.collection(collectionName);
  
  const user = await collection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  if (!user) {
    console.error(`❌ User not found in ${collectionName}`);
    return;
  }
  
  console.log(`3. Verifying DB record in ${collectionName}...`);
  console.log(`   Fetched from DB:`, { fcmTokenWeb: user.fcmTokenWeb, fcmTokenMobile: user.fcmTokenMobile });
  
  // fcmTokenWeb and fcmTokenMobile are now arrays
  const hasTokenWeb = Array.isArray(user.fcmTokenWeb) && user.fcmTokenWeb.includes(expectedToken);
  const hasTokenMobile = Array.isArray(user.fcmTokenMobile) && user.fcmTokenMobile.includes(expectedToken);
  
  if (hasTokenWeb || hasTokenMobile) {
    console.log(`✅ Token successfully stored in DB for ${collectionName}!`);
    console.log(`   - fcmTokenWeb count: ${user.fcmTokenWeb ? user.fcmTokenWeb.length : 0}`);
    console.log(`   - fcmTokenMobile count: ${user.fcmTokenMobile ? user.fcmTokenMobile.length : 0}`);
  } else {
    console.error(`❌ Token NOT found in arrays for ${collectionName}.`);
  }
  
  // Also check DeviceToken collection - should NOT be there anymore for newly registered/verified devices using the new arrays.
  const deviceTokenCollection = db.collection('devicetokens');
  const deviceTokens = await deviceTokenCollection.find({ userId: new mongoose.Types.ObjectId(userId) }).toArray();
  const foundInDeviceToken = deviceTokens.some(dt => dt.deviceToken === expectedToken);
  
  if (foundInDeviceToken) {
    console.log(`❌ Token incorrectly stored in DeviceToken collection (should be deprecated)!`);
  } else {
    console.log(`✅ Token correctly NOT found in deprecated DeviceToken collection.`);
  }
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. User
    const userId = await performLogin('user', '/auth/send-otp', '/auth/verify-otp', USER_FCM_TOKEN);
    if (userId) await verifyTokenInDB('users', userId, USER_FCM_TOKEN);

    // 2. Restaurant
    const restId = await performLogin('restaurant', '/restaurant/auth/send-otp', '/restaurant/auth/verify-otp', RESTAURANT_FCM_TOKEN);
    if (restId) await verifyTokenInDB('restaurants', restId, RESTAURANT_FCM_TOKEN);

    // 3. Delivery
    const delId = await performLogin('delivery', '/delivery/auth/send-otp', '/delivery/auth/verify-otp', DELIVERY_FCM_TOKEN);
    if (delId) await verifyTokenInDB('deliveries', delId, DELIVERY_FCM_TOKEN);

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB. Done.');
  }
}

main();
