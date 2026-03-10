# Restaurant deliveryRange – Verification & Affected Features

This document lists all features that use **restaurant deliveryRange** and how to verify they work.

---

## 1. Features affected by deliveryRange (summary)

| # | Feature | Backend | Frontend | How range is used |
|---|--------|---------|----------|--------------------|
| 1 | **Order placement (checkout)** | ✅ Hard block | N/A | 403 if distance > deliveryRange |
| 2 | **Delivery partner assignment** | ✅ maxDistance | N/A | Assignment respects deliveryRange |
| 3 | **Restaurant list (Home, Search, Category)** | ✅ Filter | ✅ Pass lat/lng | Only in-range restaurants returned |
| 4 | **Under ₹250 list** | ✅ Filter | ✅ Pass lat/lng | Only in-range restaurants returned |
| 5 | **Top 10 restaurants** | ✅ Filter | ✅ Pass lat/lng | Only in-range in list |
| 6 | **Gourmet restaurants** | ✅ Filter | ✅ Pass lat/lng | Only in-range in list |
| 7 | **Public offers page** | ✅ Filter | ✅ Pass lat/lng | Only in-range offers shown |
| 8 | **Zone ad banner (paid + challenge)** | ✅ Filter | ✅ Pass lat/lng | Only in-range ads shown |
| 9 | **Hero banners (home carousel)** | ✅ Filter | ✅ Pass lat/lng | Only banners with in-range linked restaurants |
| 10 | **Restaurant details page** | ✅ outOfRange flag | ✅ Badge + disabled CTA | Menu visible; order blocked if outOfRange |
| 11 | **Restaurant push notifications** | ✅ FCM target | N/A | Only users within deliveryRange notified |
| 12 | **Restaurant profile (OutletInfo)** | Read/update | Edit UI | Set deliveryRange (1–20 km, default 5) |

---

## 2. Backend verification (by file)

### 2.1 Order flow – hard enforcement
- **File:** `backend/modules/order/controllers/orderController.js`
- **Logic:** In `createOrder`, after resolving restaurant and address, `calculateDistance` is used; if `distance > (restaurant.deliveryRange || 5)` → **403** with message e.g. "This restaurant only delivers up to X km...".
- **Verify:** Place order with an address **beyond** the restaurant’s delivery range → expect 403. Within range → order created.

### 2.2 Delivery assignment
- **File:** `backend/modules/order/services/deliveryAssignmentService.js`
- **Logic:** `maxDistance` set from `restaurant.deliveryRange` for assigning delivery partners.
- **Verify:** Assignment and routing use that max distance; no need to change for range-only checks.

### 2.3 Restaurant list
- **File:** `backend/modules/restaurant/controllers/restaurantController.js` → `getRestaurants`
- **Logic:** Optional query `latitude`, `longitude`. If present and valid, filters restaurants with `distance <= (restaurant.deliveryRange ?? 5)` using `calculateDistance`.
- **Verify:** Call `GET /api/restaurant/list?latitude=X&longitude=Y` for a point **outside** a restaurant’s range → that restaurant not in response. Same point **inside** range → restaurant in response.

### 2.4 Under ₹250 list
- **File:** `backend/modules/restaurant/controllers/restaurantController.js` → `getRestaurantsWithDishesUnder250`
- **Logic:** Same optional `latitude`/`longitude` and same deliveryRange filter before processing.
- **Verify:** `GET /api/restaurant/under-250?latitude=X&longitude=Y` → only in-range restaurants with dishes under 250.

### 2.5 Restaurant by ID (details) – outOfRange
- **File:** `backend/modules/restaurant/controllers/restaurantController.js` → `getRestaurantById`
- **Logic:** Optional query `latitude`, `longitude`. If provided, computes distance and sets `outOfRange: true` in response when `distance > (restaurant.deliveryRange ?? 5)`. Response shape: `{ restaurant, outOfRange }`.
- **Verify:** `GET /api/restaurant/:id?latitude=X&longitude=Y` with (X,Y) **outside** range → `outOfRange: true`. Inside range → `outOfRange: false`.

### 2.6 Public offers
- **File:** `backend/modules/restaurant/controllers/offerController.js` → `getPublicOffers`
- **Logic:** Optional `latitude`/`longitude`; offers whose restaurant is beyond its deliveryRange are skipped.
- **Verify:** `GET /api/restaurant/offers/public?latitude=X&longitude=Y` → only offers from in-range restaurants.

### 2.7 Zone ads (paid + challenge)
- **File:** `backend/modules/marketing/controllers/adController.js` → `getActiveAdsByZone`
- **Logic:** Populates `restaurant` with `location` and `deliveryRange`. When `latitude`/`longitude` query present, both **paid ads** and **challenge banners** are filtered: only ads for restaurants with `distance <= (deliveryRange ?? 5)`.
- **Verify:** `GET /api/marketing/ads/active/:zoneId?latitude=X&longitude=Y` with (X,Y) outside a restaurant’s range → that restaurant’s ad not in response.

### 2.8 Hero banners (home carousel)
- **File:** `backend/modules/heroBanner/controllers/heroBannerController.js` → `getHeroBanners`
- **Logic:** Optional `latitude`/`longitude`. Banners with **linked restaurants** are kept only if at least one linked restaurant is within its deliveryRange. Banners with no linked restaurants are always returned.
- **Verify:** `GET /api/hero-banners/public?latitude=X&longitude=Y` → only banners that have at least one in-range linked restaurant (or no linked restaurants).

### 2.9 Top 10 / Gourmet
- **File:** `backend/modules/heroBanner/controllers/heroBannerController.js` → `getTop10Restaurants`, `getGourmetRestaurants`
- **Logic:** Optional `latitude`/`longitude`; filter by `distance <= (restaurant.deliveryRange || 5)`.
- **Verify:** `GET /api/hero-banners/top-10/public?latitude=X&longitude=Y` and same for gourmet → only in-range restaurants.

### 2.10 Push notifications
- **File:** `backend/modules/notification/controllers/notificationRequestController.js`
- **Logic:** Uses `restaurant.deliveryRange` (default 5) with `$nearSphere` and `maxDistance` to target users within range.
- **Verify:** Request a notification; only users within the restaurant’s deliveryRange receive it.

---

## 3. Frontend verification (by page/component)

### 3.1 Home
- **Restaurant list:** Passes `location.latitude` / `location.longitude` to `restaurantAPI.getRestaurants(params)`.
- **Hero banners:** Passes lat/lng to `api.get('/hero-banners/public', { params })`.
- **Top 10 block:** Passes lat/lng to `api.get('/hero-banners/top-10/public', { params })`.
- **Verify:** Set location **outside** a restaurant’s range → that restaurant and its hero/Top10 entries should disappear (or not appear) when location is set.

### 3.2 Top 10 page (`/user/top-10`)
- Passes `params.latitude` / `params.longitude` to `heroBannerAPI.getTop10Restaurants(params)` when `useLocation()` has coordinates.
- **Verify:** With location in/out of range, list updates accordingly.

### 3.3 Gourmet page (`/user/gourmet`)
- Same as Top 10 but for `heroBannerAPI.getGourmetRestaurants(params)`.
- **Verify:** Same as Top 10.

### 3.4 Offers page (`/user/offers`)
- Passes lat/lng to `restaurantAPI.getPublicOffers(params)`.
- **Verify:** Only offers from in-range restaurants when location is set.

### 3.5 Under ₹250 page (`/user/under-250`)
- Passes `latitude`/`longitude` in params to `restaurantAPI.getRestaurantsUnder250(params)`.
- **Verify:** Only in-range restaurants with dishes under 250.

### 3.6 Search / Category
- **SearchResults.jsx** and **CategoryPage.jsx** pass `latitude`/`longitude` to `restaurantAPI.getRestaurants(params)`.
- **Verify:** Search/category results respect range when location is available.

### 3.7 Zone ad banner (user home)
- **ZoneAdBanner.jsx** passes `location.latitude` / `location.longitude` to `api.get(\`/marketing/ads/active/${zoneId}\`, { params })`.
- **Verify:** Change location; ads for out-of-range restaurants should not appear.

### 3.8 Restaurant details (`/user/restaurants/:slug`)
- Calls `restaurantAPI.getRestaurantById(slug, { latitude, longitude })` when user location is available.
- If `outOfRange === true`: shows “Out of delivery range — change address to order” badge and disables the main “Menu” CTA; add-to-cart is blocked with a toast.
- **Verify:** Open a restaurant **outside** your delivery range (with location set) → badge and disabled CTA; add to cart shows toast. Open one **inside** range → normal ordering.

### 3.9 OutletInfo (restaurant dashboard)
- Reads and updates `deliveryRange` (1–20 km); no filtering logic here.
- **Verify:** Change delivery range and confirm it persists; then verify list/ads/checkout behaviour as above.

---

## 4. Quick manual test plan

1. **Setup:** One restaurant with `deliveryRange = 3` km and known coordinates.
2. **User A (within 3 km):**  
   - Sees restaurant in Home list, Top 10, Gourmet, Offers, Under 250 (if applicable).  
   - Sees its ads in ZoneAdBanner and hero if linked.  
   - Can open details and place order.
3. **User B (e.g. 5 km away):**  
   - Does **not** see restaurant in lists, Top 10, Gourmet, Offers, Under 250, or ads.  
   - Can still open `/user/restaurants/:slug` (e.g. via direct link) but sees “Out of delivery range” and cannot add to cart or use primary CTA.  
   - Checkout with that address returns 403.
4. **No location:** When frontend does **not** send lat/lng, backend returns unfiltered results (all active restaurants/offers/ads); details page does not set `outOfRange` from distance.

---

## 5. API contract summary

- **List/offers/ads/banners:** When `latitude` and `longitude` are sent, only in-range items are returned. When they are omitted, no distance filter is applied.
- **Restaurant by ID:** When `latitude` and `longitude` are sent, response includes `outOfRange: true` if user is beyond `deliveryRange`, and `outOfRange: false` otherwise. When omitted, `outOfRange` is false.
- **Checkout:** Always enforced; 403 if address is beyond restaurant’s deliveryRange regardless of how the user reached the page.

This completes the list of features changed and affected by **restaurant deliveryRange** and how to verify them.
