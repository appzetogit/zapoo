// Temporary verification script for telephony masking.
// Usage:
//   node verifyTelephonyFlow.js <ORDER_ID> <RESTAURANT_MONGO_ID> <DELIVERY_MONGO_ID> [CUSTOMER_MONGO_ID] [AUTH_TOKEN]
//
// Example:
//   node verifyTelephonyFlow.js ORD-1772188961478-820 69b437d4e95b2eebbe919b8c 69a1... 69c2... YOUR_TOKEN_HERE
//
// Assumptions:
// - Backend dev server is running.
// - Telephony routes are mounted under /api/telephony.
// - If you need auth headers, add them in the axios client config below.

import axios from "axios";

const [, , orderId, restaurantId, deliveryId, customerId, authToken] = process.argv;

if (!orderId || !restaurantId || !deliveryId) {
  console.error(
    "Usage: node verifyTelephonyFlow.js <ORDER_ID> <RESTAURANT_MONGO_ID> <DELIVERY_MONGO_ID> [CUSTOMER_MONGO_ID] [AUTH_TOKEN]"
  );
  process.exit(1);
}

const BASE_URL = process.env.ZAPOO_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: authToken || process.env.TEST_TOKEN ? {
    Authorization: `Bearer ${authToken || process.env.TEST_TOKEN}`,
  } : {},
});

async function initiateCall({ label, callerId, receiverId }) {
  console.log(
    `\n=== Initiating call: ${label} ===\norder_id=${orderId}\ncaller_user_id=${callerId}\nreceiver_user_id=${receiverId}`
  );

  const res = await client.post("/api/telephony/call", {
    order_id: orderId,
    caller_user_id: String(callerId),
    receiver_user_id: String(receiverId),
  });

  if (!res.data?.success) {
    throw new Error(`Call failed: ${JSON.stringify(res.data, null, 2)}`);
  }

  const data = res.data.data || {};
  const result = {
    call_sid: data.call_sid,
    virtual_number: data.virtual_number,
    direction: data.direction,
  };

  console.log("Response:", result);
  return result;
}

async function main() {
  try {
    console.log("Base URL:", BASE_URL);
    console.log("Order ID:", orderId);
    console.log("Restaurant Mongo ID:", restaurantId);
    console.log("Delivery Mongo ID:", deliveryId);
    if (customerId) {
      console.log("Customer Mongo ID:", customerId);
    }

    const rToD = await initiateCall({
      label: "Restaurant → Delivery Partner",
      callerId: restaurantId,
      receiverId: deliveryId,
    });

    const dToR = await initiateCall({
      label: "Delivery Partner → Restaurant",
      callerId: deliveryId,
      receiverId: restaurantId,
    });

    let calls = [rToD, dToR];

    if (customerId) {
      const rToC = await initiateCall({
        label: "Restaurant → Customer",
        callerId: restaurantId,
        receiverId: customerId,
      });

      const cToR = await initiateCall({
        label: "Customer → Restaurant",
        callerId: customerId,
        receiverId: restaurantId,
      });

      const cToD = await initiateCall({
        label: "Customer → Delivery Partner",
        callerId: customerId,
        receiverId: deliveryId,
      });

      const dToC = await initiateCall({
        label: "Delivery Partner → Customer",
        callerId: deliveryId,
        receiverId: customerId,
      });

      calls = [rToD, dToR, rToC, cToR, cToD, dToC];

      console.log("\n=== Verification summary ===");
      for (const call of calls) {
        console.log(`${call.direction}: ${call.virtual_number}`);
      }

      const uniqueNumbers = [...new Set(calls.map((c) => c.virtual_number).filter(Boolean))];
      if (uniqueNumbers.length === 1) {
        console.log(
          "✅ All tested directions used the SAME virtual number (shared city masking)."
        );
      } else {
        console.warn(
          "⚠ Different virtual numbers were returned across the tested directions. Check pool selection or Exotel setup."
        );
      }
    } else {
      console.log("\n=== Verification summary ===");
      console.log("Restaurant→DP virtual:", rToD.virtual_number);
      console.log("DP→Restaurant virtual:", dToR.virtual_number);

      if (rToD.virtual_number && rToD.virtual_number === dToR.virtual_number) {
        console.log(
          "✅ Both directions use the SAME virtual number (restaurant-delivery masking)."
        );
      } else {
        console.warn(
          "⚠ Virtual numbers differ between directions. Check allocation logic or existing pool data."
        );
      }
    }

    console.log("\nDone.");
  } catch (err) {
    if (err.response) {
      console.error(
        "\nRequest failed with status",
        err.response.status,
        "data:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error("\nError:", err.message);
    }
    process.exit(1);
  }
}

main();

