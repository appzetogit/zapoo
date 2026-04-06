import axios from "axios";

const {
  EXOTEL_SID,
  EXOTEL_AUTH_TOKEN,
  EXOTEL_SUBDOMAIN,
} = process.env;

const getBaseUrl = () => {
  const subdomain = EXOTEL_SUBDOMAIN || "api";
  return `https://${subdomain}.exotel.com/v1/Accounts/${EXOTEL_SID}`;
};

const getAuthConfig = () => {
  if (!EXOTEL_SID || !EXOTEL_AUTH_TOKEN) {
    throw new Error("Exotel credentials are not configured");
  }
  return {
    auth: {
      username: EXOTEL_SID,
      password: EXOTEL_AUTH_TOKEN,
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

export const generateHangupXML = (reason = "routing_failed") => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup reason="${reason}"/>
</Response>`;
};

// Generate Exotel XML response for passthru call
export const generatePassthruXML = ({ toPhone, callerId } = {}) => {
  const formattedToPhone = formatIndianNumber(toPhone);
  if (!formattedToPhone) {
    return generateHangupXML("invalid_recipient");
  }

  const formattedCallerId = formatIndianNumber(callerId) || formattedToPhone;
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

// Legacy method - kept for backward compatibility if needed
export const initiateMaskedCall = async ({
  fromPhone,
  toPhone,
  virtualNumber,
  orderId,
}) => {
  if (!fromPhone || !toPhone || !virtualNumber || !orderId) {
    throw new Error("Missing required parameters for Exotel call");
  }

  const url = `${getBaseUrl()}/Calls/connect`;

  const payload = new URLSearchParams({
    From: fromPhone,
    To: toPhone,
    CallerId: virtualNumber,
    CallType: "trans",
    TimeOut: "30",
    TimeLimit: "600",
    CustomField: String(orderId),
    StatusCallback: `${process.env.EXOTEL_STATUS_CALLBACK_BASE_URL || "https://example.com"}/api/telephony/status-callback`,
    StatusCallbackEvents: "answered,terminal",
  }).toString();

  try {
    const response = await axios.post(url, payload, {
      ...getAuthConfig(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = response.data || {};
    const callSid =
      data.Call && (data.Call.Sid || data.Call.sid)
        ? data.Call.Sid || data.Call.sid
        : undefined;

    if (!callSid) {
      throw new Error("Exotel response missing Call SID");
    }

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

    console.error("Exotel call failure:", {
      url,
      statusCode,
      responseData,
      message,
    });

    const wrappedError = new Error(message);
    wrappedError.name = "ExotelCallError";
    throw wrappedError;
  }
};

