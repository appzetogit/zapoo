import axios from "axios";

const {
  EXOTEL_SID,
  EXOTEL_API_KEY,
  EXOTEL_API_TOKEN,
  EXOTEL_AUTH_TOKEN,
  EXOTEL_SUBDOMAIN,
} = process.env;

const getBaseUrl = () => {
  const { sid, subdomain } = getExotelConfig();
  const normalizedSubdomain = subdomain
    .replace(/^https?:\/\//i, "")
    .replace(/\.exotel\.com$/i, "")
    .replace(/\/+$/g, "");

  return `https://${normalizedSubdomain}.exotel.com/v1/Accounts/${sid}`;
};

const getAuthConfig = () => {
  const accountSid = EXOTEL_SID;
  const apiKey = EXOTEL_API_KEY || EXOTEL_SID;
  const apiToken = EXOTEL_API_TOKEN || EXOTEL_AUTH_TOKEN;

  if (!accountSid || !apiKey || !apiToken) {
    throw new Error("Exotel credentials are not configured");
  }

  return {
    auth: {
      username: apiKey,
      password: apiToken,
    },
  };
};

// Normalize phone number: remove +, spaces, dashes
const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/[\s\-+]/g, "").slice(-10);
};

const formatIndianNumber = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) {
    return null;
  }

  return `+91${normalized}`;
};

const extractCallSid = (data) => {
  if (!data) return undefined;

  if (typeof data === "object") {
    return (
      data?.Call?.Sid ||
      data?.Call?.sid ||
      data?.call?.Sid ||
      data?.call?.sid ||
      data?.call_sid ||
      data?.sid ||
      undefined
    );
  }

  const text = String(data);

  try {
    const parsed = JSON.parse(text);
    return extractCallSid(parsed);
  } catch {
    // ignore JSON parse errors and try XML extraction below
  }

  return (
    text.match(/<Sid>\s*([^<]+)\s*<\/Sid>/i)?.[1] ||
    text.match(/"call_sid"\s*:\s*"([^"]+)"/i)?.[1] ||
    text.match(/"Sid"\s*:\s*"([^"]+)"/i)?.[1] ||
    undefined
  );
};

export const generateHangupXML = (reason = "routing_failed") => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup reason="${reason}"/>
</Response>`;
};

// Generate Exotel XML response for passthru call
export const generatePassthruXML = ({ toPhone, callerId, fallbackPhone } = {}) => {
  const formattedToPhone =
    formatIndianNumber(toPhone) ||
    formatIndianNumber(fallbackPhone) ||
    formatIndianNumber(process.env.EXOTEL_SAFE_NUMBER) ||
    formatIndianNumber(process.env.EXOTEL_SUPPORT_NUMBER) ||
    formatIndianNumber(process.env.EXOTEL_VIRTUAL_NUMBER);

  const formattedCallerId =
    formatIndianNumber(callerId) ||
    formatIndianNumber(fallbackPhone) ||
    formatIndianNumber(process.env.EXOTEL_SAFE_NUMBER) ||
    formattedToPhone;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeLimit="600" timeout="30" callerId="${formattedCallerId}">
    <Number>${formattedToPhone}</Number>
  </Dial>
</Response>`;
};

// Generate XML for unavailable status
export const generateUnavailableXML = (reason = "routing_failed") => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://zapoo.co.in/audio/unavailable.mp3</Play>
  <Hangup reason="${reason}"/>
</Response>`;
};

export const initiateBridgeCall = async ({
  fromPhone,
  toPhone,
  virtualNumber,
  orderId,
}) => {
  if (!fromPhone || !toPhone || !virtualNumber || !orderId) {
    throw new Error("Missing required parameters for Exotel bridge call");
  }

  const url = `${getBaseUrl()}/Calls/connect.json`;
  const payload = new URLSearchParams({
    From: fromPhone,
    To: toPhone,
    CallerId: virtualNumber,
    CallType: "trans",
    TimeOut: "30",
    TimeLimit: "600",
    CustomField: String(orderId),
    StatusCallback:
      `${process.env.EXOTEL_STATUS_CALLBACK_BASE_URL || "https://example.com"}/api/telephony/exotel-callback`,
    StatusCallbackContentType: "application/json",
    "StatusCallbackEvents[0]": "terminal",
    "StatusCallbackEvents[1]": "answered",
  }).toString();

  try {
    // DEBUG: trace the credential shape being used for Exotel auth without exposing secrets
    console.log("[MASKING][EXOTEL][AUTH]", {
      accountSid: EXOTEL_SID,
      hasApiKey: Boolean(EXOTEL_API_KEY || EXOTEL_SID),
      hasApiToken: Boolean(EXOTEL_API_TOKEN || EXOTEL_AUTH_TOKEN),
      subdomain: EXOTEL_SUBDOMAIN || "api",
      timestamp: new Date(),
    });

    // DEBUG: trace the outbound Exotel bridge request without exposing credentials
    console.log("[MASKING][EXOTEL][REQUEST]", {
      url,
      fromPhone,
      toPhone,
      virtualNumber,
      orderId,
      statusCallback:
        `${process.env.EXOTEL_STATUS_CALLBACK_BASE_URL || "https://example.com"}/api/telephony/exotel-callback`,
      timestamp: new Date(),
    });

    const response = await axios.post(url, payload, {
      ...getAuthConfig(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = response.data || {};
    const callSid = extractCallSid(data);

    if (!callSid) {
      console.error("[MASKING][EXOTEL][RAW_RESPONSE_NO_SID]", {
        url,
        data,
        dataType: typeof data,
        timestamp: new Date(),
      });
      throw new Error("Exotel response missing Call SID");
    }

    // DEBUG: trace the Exotel bridge response returned for the outbound call request
    console.log("[MASKING][EXOTEL][RESPONSE]", {
      url,
      callSid,
      raw: data,
      timestamp: new Date(),
    });

    return {
      callSid,
      raw: data,
    };
  } catch (error) {
    const responseData = error.response?.data;
    const statusCode = error.response?.status;
    const message = responseData
      ? `Exotel HTTP ${statusCode}: ${JSON.stringify(responseData)}`
      : error.message || "Exotel error";

    console.error("Exotel bridge call failure:", {
      url,
      statusCode,
      responseData,
      message,
    });

    // DEBUG: trace the exact Exotel bridge failure payload before bubbling the error upward
    console.error("[MASKING][EXOTEL][ERROR]", {
      url,
      statusCode,
      responseData,
      message,
      timestamp: new Date(),
    });

    const wrappedError = new Error(message);
    wrappedError.name = "ExotelBridgeCallError";
    throw wrappedError;
  }
};
