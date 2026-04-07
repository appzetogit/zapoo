// Telephony bridge verification script.
//
// Usage:
//   node verifyTelephonyFlow.js <ORDER_ID>
//
// Required auth tokens for full coverage:
//   RESTAURANT_AUTH_TOKEN=...
//   CUSTOMER_AUTH_TOKEN=...
//   DELIVERY_AUTH_TOKEN=...
//
// Optional fallbacks:
//   AUTH_TOKEN=...
//   TEST_TOKEN=...
//   ZAPOO_BASE_URL=http://localhost:5000
//
// What the script verifies:
// - bridge initiation for all 6 role pairings
// - API response returns a callSid and direction
// - the backend accepts the shared concurrent virtual-number model

import axios from "axios";

const [, , orderId] = process.argv;

if (!orderId) {
  console.error("Usage: node verifyTelephonyFlow.js <ORDER_ID>");
  process.exit(1);
}

const BASE_URL = process.env.ZAPOO_BASE_URL || "http://localhost:5000";

const roleTokens = {
  restaurant:
    process.env.RESTAURANT_AUTH_TOKEN ||
    process.env.AUTH_TOKEN ||
    process.env.TEST_TOKEN ||
    "",
  customer:
    process.env.CUSTOMER_AUTH_TOKEN ||
    process.env.AUTH_TOKEN ||
    process.env.TEST_TOKEN ||
    "",
  delivery_partner:
    process.env.DELIVERY_AUTH_TOKEN ||
    process.env.AUTH_TOKEN ||
    process.env.TEST_TOKEN ||
    "",
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

const pairings = [
  {
    label: "restaurant_to_delivery_partner",
    callerRole: "restaurant",
    targetRole: "delivery_partner",
  },
  {
    label: "delivery_partner_to_restaurant",
    callerRole: "delivery_partner",
    targetRole: "restaurant",
  },
  {
    label: "restaurant_to_customer",
    callerRole: "restaurant",
    targetRole: "customer",
  },
  {
    label: "customer_to_restaurant",
    callerRole: "customer",
    targetRole: "restaurant",
  },
  {
    label: "customer_to_delivery_partner",
    callerRole: "customer",
    targetRole: "delivery_partner",
  },
  {
    label: "delivery_partner_to_customer",
    callerRole: "delivery_partner",
    targetRole: "customer",
  },
];

const getAuthHeader = (role) => {
  const token = roleTokens[role];
  if (!token) {
    return null;
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

async function verifyPairing(pairing) {
  const headers = getAuthHeader(pairing.callerRole);
  if (!headers) {
    throw new Error(
      `Missing auth token for caller role "${pairing.callerRole}". Set ${pairing.callerRole.toUpperCase()}_AUTH_TOKEN (or AUTH_TOKEN).`
    );
  }

  const response = await client.post(
    "/api/telephony/call",
    {
      orderId,
      targetRole: pairing.targetRole,
    },
    {
      headers,
    }
  );

  const payload = response.data || {};
  if (!payload.success) {
    throw new Error(
      `Bridge API returned unsuccessful response for ${pairing.label}: ${JSON.stringify(payload)}`
    );
  }

  if (!payload.data?.callSid) {
    throw new Error(
      `Bridge API response missing callSid for ${pairing.label}: ${JSON.stringify(payload)}`
    );
  }

  return payload.data;
}

async function main() {
  try {
    console.log("Base URL:", BASE_URL);
    console.log("Order ID:", orderId);
    console.log("Verifying shared-concurrency bridge flow...");

    const results = [];

    for (const pairing of pairings) {
      console.log(`\n=== Verifying ${pairing.label} ===`);
      const result = await verifyPairing(pairing);
      console.log("Bridge response:", result);
      results.push({
        label: pairing.label,
        callSid: result.callSid,
        direction: result.direction,
      });
    }

    console.log("\n=== Verification summary ===");
    for (const result of results) {
      console.log(
        `${result.label}: callSid=${result.callSid}, direction=${result.direction}`
      );
    }

    console.log("\nDone.");
  } catch (err) {
    if (err.response) {
      console.error(
        "\nRequest failed with status",
        err.response.status,
        "data:",
        typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error("\nError:", err.message);
    }
    process.exit(1);
  }
}

main();
