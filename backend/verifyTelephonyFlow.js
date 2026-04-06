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
// - verifies all 6 call pairings via /api/telephony/call
// - verifies inbound passthru XML via /api/telephony/passthru

import axios from "axios";

const [, , orderId, authToken] = process.argv;

if (!orderId) {
  console.error(
    "Usage: node verifyTelephonyFlow.js <ORDER_ID> [AUTH_TOKEN]"
  );
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
  return String(phone).replace(/[\s\-+]/g, "").slice(-10);
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
  const hangupReason = text.match(/<Hangup[^>]*reason="([^"]+)"/i)?.[1] || null;
  const dialNumber = text.match(/<Number>([^<]+)<\/Number>/i)?.[1] || null;
  const callerId = text.match(/callerId="([^"]+)"/i)?.[1] || null;

  return {
    text,
    hangupReason,
    dialNumber,
    callerId,
  };
};

async function fetchOrderContext() {
  const [orderRes, deliveryMeRes, virtualRes] = await Promise.all([
    client.get(`/api/delivery/orders/${encodeURIComponent(orderId)}`),
    process.env.DELIVERY_USER_ID && process.env.DELIVERY_PHONE
      ? Promise.resolve(null)
      : client.get("/api/delivery/me").catch(() => null),
    client.get("/api/telephony/virtual-numbers").catch(() => null),
  ]);

  const order = getResponsePayload(orderRes.data)?.order;
  if (!order) {
    throw new Error("Unable to resolve order details from /api/delivery/orders/:orderId");
  }

  const deliveryProfile = process.env.DELIVERY_USER_ID && process.env.DELIVERY_PHONE
    ? {
        _id: process.env.DELIVERY_USER_ID,
        phone: process.env.DELIVERY_PHONE,
      }
    : getResponsePayload(deliveryMeRes?.data)?.profile ||
      getResponsePayload(deliveryMeRes?.data)?.delivery ||
      getResponsePayload(deliveryMeRes?.data);

  const virtualNumbers = getResponsePayload(virtualRes?.data) || {};

  return { order, deliveryProfile, virtualNumbers };
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
      expectedDialRole: "delivery_partner",
    },
    {
      label: "delivery_partner_to_restaurant",
      callerRole: "delivery_partner",
      receiverRole: "restaurant",
      expectedDialRole: "restaurant",
    },
    {
      label: "restaurant_to_customer",
      callerRole: "restaurant",
      receiverRole: "customer",
      expectedDialRole: "customer",
    },
    {
      label: "customer_to_restaurant",
      callerRole: "customer",
      receiverRole: "restaurant",
      expectedDialRole: "restaurant",
    },
    {
      label: "customer_to_delivery_partner",
      callerRole: "customer",
      receiverRole: "delivery_partner",
      expectedDialRole: "delivery_partner",
    },
    {
      label: "delivery_partner_to_customer",
      callerRole: "delivery_partner",
      receiverRole: "customer",
      expectedDialRole: "customer",
    },
  ].map((pairing) => ({
    ...pairing,
    callerId: participants[pairing.callerRole].id,
    receiverId: participants[pairing.receiverRole].id,
    callerPhone: participants[pairing.callerRole].phone,
    receiverPhone: participants[pairing.receiverRole].phone,
  }));
}

async function verifyOutboundCall(pairing) {
  const res = await client.post("/api/telephony/call", {
    order_id: orderId,
    caller_user_id: pairing.callerId,
    receiver_user_id: pairing.receiverId,
  });

  if (!res.data?.success) {
    throw new Error(
      `Outbound call failed for ${pairing.label}: ${JSON.stringify(res.data, null, 2)}`
    );
  }

  const data = res.data.data || {};
  if (!data.call_sid || !data.virtual_number || !data.direction) {
    throw new Error(`Outbound call response incomplete for ${pairing.label}`);
  }

  return {
    callSid: data.call_sid,
    virtualNumber: data.virtual_number,
    direction: data.direction,
  };
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
  const expectedDial = `+91${normalizePhone(pairing.receiverPhone)}`;

  if (parsed.hangupReason) {
    throw new Error(
      `Passthru returned hangup for ${pairing.label}: ${parsed.hangupReason} ${parsed.text}`
    );
  }

  if (!parsed.dialNumber || parsed.dialNumber !== expectedDial) {
    throw new Error(
      `Passthru dial mismatch for ${pairing.label}: expected ${expectedDial}, got ${parsed.dialNumber || "null"}`
    );
  }

  return parsed;
}

async function main() {
  try {
    console.log("Base URL:", BASE_URL);
    console.log("Order ID:", orderId);

    const { order, deliveryProfile, virtualNumbers } = await fetchOrderContext();
    const participants = buildParticipants({ order, deliveryProfile });
    const pairings = buildPairings(participants);
    const configuredMaskingNumber =
      virtualNumbers.restaurant_call ||
      virtualNumbers.customer_call ||
      virtualNumbers.delivery_partner_call ||
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
      const outbound = await verifyOutboundCall(pairing);
      console.log("Outbound:", outbound);

      const passthru = await verifyPassthru(pairing, configuredMaskingNumber);
      console.log("Passthru XML:", passthru.text.replace(/\s+/g, " ").trim());

      results.push({
        label: pairing.label,
        outbound,
        passthru,
      });
    }

    console.log("\n=== Verification summary ===");
    for (const result of results) {
      console.log(
        `${result.label}: direction=${result.outbound.direction}, virtual=${result.outbound.virtualNumber}, dial=${result.passthru.dialNumber}`
      );
    }

    const outboundVirtualNumbers = [
      ...new Set(results.map((r) => r.outbound.virtualNumber).filter(Boolean)),
    ];
    if (outboundVirtualNumbers.length === 1) {
      console.log("✅ All pairings used the same configured Exotel masking number.");
    } else {
      console.warn("⚠ Pairings used different configured numbers:", outboundVirtualNumbers);
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
