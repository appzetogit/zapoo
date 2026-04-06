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

