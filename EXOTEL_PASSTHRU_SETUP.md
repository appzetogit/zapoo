# Exotel Passthru Call Masking Setup Guide

## Overview

यह guide Exotel को passthru model के साथ configure करने के लिए है। इस model में:

- User अपने phone के native dialer से virtual number को call करेगा
- Exotel आपके backend को query करेगा कि उसे किसको connect करना चाहिए
- Backend dynamic routing response देगा XML में
- Exotel automatically उस person को connect करेगा

---

## Prerequisites

- Exotel account (https://my.exotel.com)
- Zapoo backend running on `https://zapoo.co.in` (or your domain)
- Backend passthru endpoint: `https://zapoo.co.in/api/telephony/passthru`
- At least one virtual/toll-free number from Exotel

---

## Step-by-Step Configuration

### 1. Login to Exotel Dashboard

```
https://my.exotel.com
```

---

### 2. Manage Virtual Numbers

1. Left sidebar में **"Phone Numbers"** या **"Virtual Numbers"** खोलें
2. यदि कोई number नहीं है, तो **"Buy Number"** करें
3. एक virtual/toll-free number लें (Example: `09999999999`)

---

### 3. Configure Incoming Settings

#### 3.1 Basic Settings
- **Number**: आपका virtual number चुनें
- **Status**: Active करें

#### 3.2 IVR/Passthru Configuration

1. **Request URL** (यह सबसे महत्वपूर्ण है):
   ```
   https://zapoo.co.in/api/telephony/passthru
   ```

2. **Request Method**: `POST`

3. **Request Additional Parameters** (optional):
   ```
   CustomField=<ORDER_ID>
   ```

4. **Expected Response**: XML format

#### 3.3 Status/Callback Configuration

1. **Status Callback URL**:
   ```
   https://zapoo.co.in/api/telephony/status-callback
   ```

2. **Status Callback Events**:
   - answered
   - terminal
   - in-progress (optional)

---

### 4. Exotel Parameter Mapping

जब कोई call करेगा, Exotel ये parameters भेजेगा:

| Parameter | Example | Use |
|-----------|---------|-----|
| `From` | `919876543210` | Caller का phone |
| `To` | `09999999999` | Virtual number जो call किया गया |
| `CallSid` | `abc123def456` | Unique call ID |
| `CallType` | `incoming` | Type of call |
| `CustomField` | `ORDER_123` | Order ID (if configured) |

**Backend को ये receive होंगे `req.body` में और routing decision लेगा।**

---

### 5. Backend Response Format

Backend को XML respond करना होगा:

#### Success Case (Route to customer):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeLimit="600" timeout="30" callerId="9876543210">
    <Number>9876543210</Number>
  </Dial>
</Response>
```

#### Failure Case (Hang up):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup reason="routing_failed"/>
</Response>
```

**Note**: `callerId` में आप virtual number या कोई masked number डाल सकते हैं।

---

## Test करें

### 1. Backend Server Check

Terminal से यह run करें:

```bash
# Backend server चल रहा है क्या?
curl https://zapoo.co.in/api/telephony/passthru -X POST -d "From=919876543210&CustomField=ORDER_001&CallSid=test123"
```

### 2. Simple Order Create करें

```bash
# Database में test order create करें
# इसमें restaurant, delivery partner, और customer सभी की correct phone हो
```

### 3. Real Call Test करें

1. अपने phone से virtual number को call करें
2. Exotel आपके backend को request भेजेगा
3. Backend logs में देखें कि:
   - Order found या नहीं?
   - Caller phone recognized या नहीं?
   - Recipient phone correctly routed हुआ या नहीं?

---

## Edge Cases Handled

Backend में ये सभी cases handle किए गए हैं:

| Scenario | Response | Reason |
|----------|----------|--------|
| Order not found | Hangup | Order doesn't exist |
| Order completed/cancelled | Hangup | Can't call on ended orders |
| Caller not in order | Hangup | Security - unauthorized caller |
| No recipient available | Hangup | Can't find who to route to |
| Missing required fields | Hangup | Invalid Exotel request |

---

## 3-Route Configuration

Backend में 3 automatic routing paths हैं:

### Route 1: Restaurant ↔ Delivery Partner
```
Restaurant calls → Virtual Number 1
Backend sees restaurantPhone → Finds deliveryPartner → Routes
```

### Route 2: Restaurant ↔ Customer
```
Restaurant calls → Virtual Number 1
Backend sees restaurantPhone → Finds customer → Routes
```

### Route 3: Delivery Partner ↔ Customer
```
Delivery Partner calls → Virtual Number 2 (separate)
Backend sees deliveryPhone → Finds customer → Routes
```

**अभी एक ही number से सभी के लिए automatic routing होता है।**
**अगर अलग numbers चाहिए तो Exotel में 3 different virtual numbers configure करें।**

---

## Database Tracking

हर incoming call के लिए `CallSession` में entry create होती है:

```javascript
{
  call_sid: "abc123def456",
  order_id: "ORDER_001",
  incoming_from: "919876543210",
  caller_role: "restaurant",
  receiver_role: "customer",
  direction: "restaurant_to_customer",
  status: "ringing" -> "answered" -> "completed",
  call_type: "inbound_passthru",
  routing_lookup_status: "resolved",
  duration: 65, // seconds
  started_at: Date,
  ended_at: Date
}
```

---

## Frontend Implementation

### Delivery Partner (AcceptedOrderDetails.jsx)

```jsx
// Call button करेगा:
<button onClick={() => window.location.href = "tel:+91XXXXXXXXXX"}>
  Call Restaurant
</button>
```

User के phone का native dialer खुलेगा और वह virtual number को dial करेगा।

---

## Troubleshooting

### ❌ Backend not receiving call?

1. **URL check करें**: Exact होना चाहिए `https://zapoo.co.in/api/telephony/passthru`
2. **Firewall**: Exotel को आपके server को access करना चाहिए
3. **Server running**: तुरंत check करें backend running है

### ❌ Call routing fail हो रहा है?

```bash
# Backend logs देखें:
tail -f backend.logs | grep "Passthru"
```

यह दिखेगा:
- Order found या नहीं
- Caller phone recognized या नहीं
- Recipient phone क्या select हुआ

### ❌ Call connect नहीं हो रहा?

1. **Recipient phone**: क्या order में सही phone है?
2. **Phone format**: क्या format correct है (10 digit)?
3. **Exotel balance**: क्या account में balance है?

---

## Environment Variables Required

```dotenv
EXOTEL_SID=zapoo1
EXOTEL_AUTH_TOKEN=683fc3e4f495982be4e2523f55ce6f840f37106340579126
EXOTEL_SUBDOMAIN=api
EXOTEL_STATUS_CALLBACK_BASE_URL=https://zapoo.co.in
```

---

## Production Considerations

1. **HTTPS Must**: Exotel को HTTPS URL चाहिए (HTTP काम नहीं करता)
2. **Rate Limits**: Exotel के rate limits का ध्यान रखें
3. **Error Handling**: सभी edge cases को log करें
4. **Database Cleanup**: पुरानी call records को archive करें
5. **Monitoring**: CallSession status को monitor करें

---

## Next Steps

1. ✅ Exotel में virtual number book करें
2. ✅ Request URL configure करें
3. ✅ Status Callback configure करें
4. ✅ Backend server को HTTPS पर run करें
5. ✅ Test order create करके real call करें
6. ✅ Logs monitor करें
7. ✅ Production में deploy करें

---

**Notes**:
- अभी एक ही virtual number से सभी routing automatic होता है
- अगर अलग virtual numbers चाहिए, तो Exotel में 3 separate numbers configure करें
- Call masking automatically हो जाता है Exotel backend में
