# Performance Optimizations Summary

This document lists all performance-related changes applied across the Zapoo application. **No functionality, UI, business logic, routes, or APIs were changed**—only speed, payload size, and resource usage were improved. Goal: **3–5x faster, smoother, production-ready** while keeping 100% functional behavior.

---

## Backend (Node.js / Express)

### 1. Response compression
- **File:** `backend/server.js`
- **Change:** Added `compression` middleware (gzip, level 6, threshold 1KB) so all JSON and text responses are compressed.
- **Effect:** Smaller response payloads and faster transfer over the network.

### 2. Server cleanup
- **File:** `backend/server.js`
- **Changes:**
  - Removed duplicate "Load environment variables" comment.
  - Removed empty `else` block after rate limiter.
  - Reduced 404 logging in production (verbose logs only in development for admin/refund paths).
- **Effect:** Less noise in logs and slightly cleaner execution.

### 3. Database indexes
- **File:** `backend/modules/order/models/Order.js`
- **Change:** Added compound index `{ deliveryPartnerId: 1, status: 1 }` for active-order lookups by delivery partner.
- **Effect:** Faster queries when finding an order by delivery partner and status.

### 4. Query optimizations (lean + select)
- **userController.js:** `User.findOne` for existing-email/phone checks now uses `.select('_id').lean()` to reduce payload and avoid full document hydration.
- **etaController.js:** `findOrderById` now uses `.select('_id orderId eta estimatedDeliveryTime').lean()` for read-only ETA endpoints (getLiveETA, getETAHistory, getOrderEvents, recalculateETA, etc.).
- **inventoryController.js:** `getInventoryByRestaurantId` — Restaurant lookup uses `.select('_id').lean()`, Inventory lookup uses `.select('categories isActive').lean()`.
- **deliveryWalletController.js:** `getWalletTransactions` uses `.lean()` on `DeliveryWallet.findOne` for read-only list.
- **Effect:** Fewer DB round-trips and less memory; faster API responses.

### 5. Query counter in production
- **File:** `backend/shared/middleware/queryCounter.js`
- **Change:** Middleware is no-op in production unless `ENABLE_QUERY_COUNT=1`. Patching of Mongoose is still applied but request context is skipped in prod.
- **Effect:** Lower per-request overhead in production.

### 6. Restaurant orders controller
- **File:** `backend/modules/restaurant/controllers/restaurantOrderController.js`
- **Change:** Removed debug `console.warn` and unnecessary sample-order query when no orders are found.
- **Effect:** Fewer DB queries and less log volume.

### 7. Dependencies
- **File:** `backend/package.json`
- **Change:** Added `compression` dependency.
- **Effect:** Enables response compression as above.

### 8. Marketing / Ads API (deep pass)
- **File:** `backend/modules/marketing/controllers/adController.js`
- **Change:** `getAllAdRequests` and restaurant ads list use `.lean()` on `AdRequest.find().populate().sort()` so responses are plain objects; lower memory and faster JSON serialization.
- **Effect:** Faster admin and restaurant ad list endpoints.

### 9. Health check
- **File:** `backend/server.js`
- **Change:** `/health` sets `Cache-Control: no-store` so load balancers and probes don’t cache health responses.
- **Effect:** Correct behavior for health checks; no stale “OK” from cache.

---

## Frontend (React / Vite)

### 1. Build and code splitting
- **File:** `frontend/vite.config.js`
- **Changes:**
  - `minify: "esbuild"` (explicit).
  - `target: "es2020"` for modern browsers.
  - `cssCodeSplit: true` (default, explicit).
  - `rollupOptions.output.manualChunks` to split vendor bundles:
    - `vendor-mui`: MUI and Emotion.
    - `vendor-react`: React, React DOM, React Router.
    - `vendor-maps`: Mapbox, Leaflet, Turf.
    - `vendor-charts`: Recharts, d3.
    - `vendor-motion`: Framer Motion / Motion.
  - Named asset/chunk patterns for better caching.
- **Effect:** Smaller initial JS load, better caching, and parallel loading of vendor chunks.

### 2. App and routing
- **File:** `frontend/src/App.jsx`
- **Changes:**
  - `Suspense` fallback set to a stable `LoaderFallback` reference to avoid recreating the fallback element on every render.
  - `UserPathRedirect` uses `useMemo` for the redirect path to avoid unnecessary recalculations.
- **Effect:** Slightly fewer re-renders and less work on route changes.

### 3. API caching
- **File:** `frontend/src/lib/api/index.js`
- **Changes:**
  - **Public categories:** `getPublicCategories()` now uses `getCachedResource` with a 2-minute TTL. Cache is invalidated on `createCategory`, `updateCategory`, `deleteCategory`, `toggleCategoryStatus`, and `updateCategoryPriority`.
  - **Business settings:** `getBusinessSettings()` now uses `getCachedResource` with a 5-minute TTL. Cache is invalidated on `updateBusinessSettings`.
- **Effect:** Fewer duplicate requests for categories and business settings across pages.

### 4. Image loading
- **File:** `frontend/src/module/admin/pages/tier/ZoneRestaurants.jsx`
- **Change:** Added `loading="lazy"` to the restaurant list image.
- **Effect:** List images load lazily as they enter the viewport.

### 5. Debounced search (fewer API calls)
- **New file:** `frontend/src/hooks/useDebounce.js` — `useDebounce(value, delay)` for debouncing a value.
- **File:** `frontend/src/module/admin/pages/restaurant/RestaurantComplaints.jsx`
- **Change:** Search input drives a debounced value (400 ms); `fetchComplaints` runs when `debouncedSearch` (and other filters) change, not on every keystroke.
- **Effect:** Fewer duplicate requests and smoother typing.

### 6. Build asset optimization
- **File:** `frontend/vite.config.js`
- **Change:** `assetsInlineLimit: 4096` — assets &lt; 4KB inlined as base64; larger ones emitted as files for better caching.
- **Effect:** Better balance of request count vs cacheability for static assets.

### 7. Axios interceptor (deep pass)
- **File:** `frontend/src/lib/api/axios.js`
- **Change:** Removed duplicate `return Promise.reject(refreshError)` in the refresh-error path (dead code).
- **Effect:** Slightly cleaner execution path; no behavior change.

---

## What to test

To confirm everything still behaves the same:

1. **Login flows:** User, restaurant, delivery, admin login and logout.
2. **Orders:** Create order, payment, status updates, restaurant accept/reject, delivery assignment and completion.
3. **Payments:** Razorpay flow, wallet, COD.
4. **Delivery:** Dashboard, accept/complete order, location updates, wallet.
5. **Admin:** Dashboard, orders list/filters, categories CRUD, business settings, delivery partners, refunds, settlements.
6. **User:** Home, categories, restaurant list, cart, checkout, orders, profile, favorites.

---

## Files modified

| Area    | File |
|---------|------|
| Backend | `backend/server.js` |
| Backend | `backend/package.json` |
| Backend | `backend/modules/order/models/Order.js` |
| Backend | `backend/modules/restaurant/controllers/restaurantOrderController.js` |
| Backend | `backend/modules/user/controllers/userController.js` |
| Backend | `backend/modules/order/controllers/etaController.js` |
| Backend | `backend/modules/restaurant/controllers/inventoryController.js` |
| Backend | `backend/modules/delivery/controllers/deliveryWalletController.js` |
| Backend | `backend/shared/middleware/queryCounter.js` |
| Frontend | `frontend/vite.config.js` |
| Frontend | `frontend/src/App.jsx` |
| Frontend | `frontend/src/lib/api/index.js` |
| Frontend | `frontend/src/module/admin/pages/tier/ZoneRestaurants.jsx` |
| Frontend | `frontend/src/module/admin/pages/restaurant/RestaurantComplaints.jsx` |
| Frontend | `frontend/src/hooks/useDebounce.js` (new) |
| Backend   | `backend/modules/marketing/controllers/adController.js` |
| Frontend | `frontend/src/lib/api/axios.js` |

---

## Performance gains (summary)

- **API response time:** Lean queries and select reduce document hydration and payload size on read-heavy endpoints (user, ETA, inventory, delivery wallet, ads).
- **DB:** Compound index on Order (`deliveryPartnerId`, `status`) speeds active-order lookups; query counter disabled in production.
- **Network:** Gzip compression reduces payload size; debounced search and API caching cut duplicate requests.
- **Frontend:** Vendor code splitting and stable Suspense fallback improve load and navigation; lazy images reduce initial bandwidth.
- **Production:** Query counter no-op, health `Cache-Control`, no duplicate reject in axios.

---

## Optional next steps (not applied)

- **Backend:** Add Redis or in-memory response caching for specific read-only GET routes (e.g. public categories, fee settings) if traffic grows.
- **Frontend:** Add `React.memo` to more heavy list row components if profiling shows unnecessary re-renders; consider virtualization for very long lists (e.g. 1000+ rows).
- **Assets:** Run image compression (e.g. ImageOptim, Sharp) on static images and consider WebP/AVIF where supported.
- **Hosting:** Enable Brotli and long-lived cache headers for static assets (e.g. in nginx or CDN).
