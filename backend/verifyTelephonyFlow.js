// Telephony masking verification script.
//
// Usage:
//   node verifyTelephonyFlow.js <ORDER_ID> [AUTH_TOKEN]
//
// Optional env overrides:
//   ZAPOO_BASE_URL=http://localhost:5000
//   DELIVERY_PHONE=+91XXXXXXXXXX
//   DELIVERY_USER_ID=<mongo id>
//   RESTAURANT_PHONE=+91XXXXXXXXXX
//   RESTAURANT_USER_ID=<mongo id>
//   CUSTOMER_PHONE=+91XXXXXXXXXX
//   CUSTOMER_USER_ID=<mongo id>
//   EXOTEL_VIRTUAL_NUMBER=+91XXXXXXXXXX
//   EXOTEL_VIRTUAL_NUMBERS=+91XXXXXXXXXX,+91XXXXXXXXXX
//
// The script:
// - fetches the real order details
// - resolves restaurant/customer/delivery participants
// - verifies all 6 call pairings via /api/telephony/passthru
// - checks that Exotel receives valid Dial XML for each pairing

import axios from "axios";

const [, , orderId, authToken] = process.argv;

if (!orderId) {
  console.error("Usage: node verifyTelephonyFlow.js <ORDER_ID> [AUTH_TOKEN]");
  process.exit(1);
}

const BASE_URL = process.env.ZAPOO_BASE_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers:
    authToken || process.env.TEST_TOKEN
      ? {
          Authorization: `Bearer ${authToken || process.env.TEST_TOKEN}`,
        }
      : {},
});

const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "").slice(-10);
};

const e164 = (phone) => {
  const normalized = normalizePhone(phone);
  return normalized ? `+91${normalized}` : "";
};

const getResponsePayload = (data) => {
  if (!data) return null;
  return data.data || data.order || data.profile || data.delivery || data;
};

const extractPhone = (entity, fallbacks = []) => {
  const candidates = [
    entity?.phone,
    entity?.primaryContactNumber,
    entity?.ownerPhone,
    entity?.phoneNumber,
    entity?.mobile,
    ...fallbacks,
  ];

  for (const candidate of candidates) {
    if (candidate) return String(candidate).trim();
  }

  return "";
};

const parseXml = (xml) => {
  const text = String(xml || "");
  const dialNumber = text.match(/<Number>([^<]+)<\/Number>/i)?.[1] || null;
  const callerId = text.match(/callerId="([^"]+)"/i)?.[1] || null;
  return { text, dialNumber, callerId };
};

async function fetchOrderContext() {
  const [orderRes, deliveryMeRes] = await Promise.all([
    client.get(`/api/delivery/orders/${encodeURIComponent(orderId)}`),
    process.env.DELIVERY_USER_ID && process.env.DELIVERY_PHONE
      ? Promise.resolve(null)
      : client.get("/api/delivery/me").catch(() => null),
  ]);

  const order = getResponsePayload(orderRes.data)?.order;
  if (!order) {
    throw new Error("Unable to resolve order details from /api/delivery/orders/:orderId");
  }

  const deliveryProfile =
    process.env.DELIVERY_USER_ID && process.env.DELIVERY_PHONE
      ? {
          _id: process.env.DELIVERY_USER_ID,
          phone: process.env.DELIVERY_PHONE,
        }
      : getResponsePayload(deliveryMeRes?.data)?.profile ||
        getResponsePayload(deliveryMeRes?.data)?.delivery ||
        getResponsePayload(deliveryMeRes?.data);

  return { order, deliveryProfile };
}

function buildParticipants({ order, deliveryProfile }) {
  const restaurant = order.restaurantId || {};
  const customer = order.userId || {};

  const participants = {
    restaurant: {
      id: String(restaurant._id || order.restaurantId || process.env.RESTAURANT_USER_ID || ""),
      phone: extractPhone(restaurant, [process.env.RESTAURANT_PHONE]),
    },
    delivery_partner: {
      id: String(deliveryProfile?._id || process.env.DELIVERY_USER_ID || ""),
      phone: extractPhone(deliveryProfile, [process.env.DELIVERY_PHONE]),
    },
    customer: {
      id: String(customer._id || order.userId || process.env.CUSTOMER_USER_ID || ""),
      phone: extractPhone(customer, [process.env.CUSTOMER_PHONE]),
    },
  };

  const missing = Object.entries(participants)
    .filter(([, value]) => !value.id || !value.phone)
    .map(([role]) => role);

  if (missing.length) {
    throw new Error(`Missing participant data for: ${missing.join(", ")}`);
  }

  return participants;
}

function buildPairings(participants) {
  return [
    {
      label: "restaurant_to_delivery_partner",
      callerRole: "restaurant",
      receiverRole: "delivery_partner",
    },
    {
      label: "delivery_partner_to_restaurant",
      callerRole: "delivery_partner",
      receiverRole: "restaurant",
    },
    {
      label: "restaurant_to_customer",
      callerRole: "restaurant",
      receiverRole: "customer",
    },
    {
      label: "customer_to_restaurant",
      callerRole: "customer",
      receiverRole: "restaurant",
    },
    {
      label: "customer_to_delivery_partner",
      callerRole: "customer",
      receiverRole: "delivery_partner",
    },
    {
      label: "delivery_partner_to_customer",
      callerRole: "delivery_partner",
      receiverRole: "customer",
    },
  ].map((pairing) => ({
    ...pairing,
    callerId: participants[pairing.callerRole].id,
    receiverId: participants[pairing.receiverRole].id,
    callerPhone: participants[pairing.callerRole].phone,
    receiverPhone: participants[pairing.receiverRole].phone,
  }));
}

async function verifyPassthru(pairing, configuredMaskingNumber) {
  const callSid = `VERIFY-${pairing.label}-${Date.now()}`;
  const res = await client.get("/api/telephony/passthru", {
    params: {
      From: pairing.callerPhone,
      CallSid: callSid,
      CustomField: orderId,
      To: configuredMaskingNumber,
      Called: configuredMaskingNumber,
    },
    responseType: "text",
    transformResponse: [(data) => data],
  });

  const parsed = parseXml(res.data);
  const expectedDial = e164(pairing.receiverPhone);

  if (!parsed.dialNumber) {
    throw new Error(
      `Passthru did not return a <Number> for ${pairing.label}: ${parsed.text}`
    );
  }

  if (parsed.dialNumber !== expectedDial) {
    throw new Error(
      `Passthru dial mismatch for ${pairing.label}: expected ${expectedDial}, got ${parsed.dialNumber}`
    );
  }

  return parsed;
}

async function main() {
  try {
    console.log("Base URL:", BASE_URL);
    console.log("Order ID:", orderId);

    const { order, deliveryProfile } = await fetchOrderContext();
    const participants = buildParticipants({ order, deliveryProfile });
    const pairings = buildPairings(participants);
    const configuredMaskingNumber =
      process.env.EXOTEL_VIRTUAL_NUMBER ||
      process.env.EXOTEL_VIRTUAL_NUMBERS ||
      "";

    if (!configuredMaskingNumber) {
      throw new Error("Unable to resolve a configured Exotel masking number");
    }

    console.log("Configured Exotel masking number:", configuredMaskingNumber);
    console.log("Restaurant:", participants.restaurant);
    console.log("Delivery partner:", participants.delivery_partner);
    console.log("Customer:", participants.customer);

    const results = [];

    for (const pairing of pairings) {
      console.log(`\n=== Verifying ${pairing.label} ===`);
      const passthru = await verifyPassthru(pairing, configuredMaskingNumber);
      console.log("Passthru XML:", passthru.text.replace(/\s+/g, " ").trim());
      results.push({ label: pairing.label, passthru });
    }

    console.log("\n=== Verification summary ===");
    for (const result of results) {
      console.log(`${result.label}: dial=${result.passthru.dialNumber}`);
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
