import axios from "axios";

const {
  EXOTEL_SID,
  EXOTEL_AUTH_TOKEN,
  EXOTEL_SUBDOMAIN,
  EXOTEL_STATUS_CALLBACK_BASE_URL,
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

  const statusCallbackBase =
    EXOTEL_STATUS_CALLBACK_BASE_URL || "https://example.com";

  const payload = new URLSearchParams({
    From: fromPhone,
    To: toPhone,
    CallerId: virtualNumber,
    CallType: "trans",
    TimeOut: "30",
    TimeLimit: "600",
    CustomField: String(orderId),
    StatusCallback: `${statusCallbackBase}/api/telephony/exotel-callback`,
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
    const err = error.response?.data || error.message || "Exotel error";
    const wrappedError = new Error(
      typeof err === "string" ? err : JSON.stringify(err)
    );
    wrappedError.name = "ExotelCallError";
    throw wrappedError;
  }
};

