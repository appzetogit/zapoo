# API Audit Report

Generated on: 2026-03-11

## Scope

- Route inventory source: `backend/discovered_routes.json`
- Fresh benchmark source: `backend/benchmark_results_*.json`
- Server-side DB query count source: `backend/shared/middleware/queryCounter.js`
- Benchmark limitation: only `GET` routes were hit by `backend/scripts/benchmark_suite.js`

## 1. Total API Count

### Active discovered routes

- Total routes: **444**
- `GET`: **197**
- `POST`: **132**
- `PUT`: **48**
- `PATCH`: **38**
- `DELETE`: **29**

### Route distribution by module

- `admin`: **174**
- `restaurant`: **86**
- `delivery`: **41**
- `hero-banners`: **36**
- `user`: **20**
- `order`: **18**
- `notification`: **14**
- `marketing`: **13**
- `auth`: **11**
- `subscription`: **9**
- `location`: **2**
- Public single-route modules (`health`, `payment`, `menu`, `campaign`, `analytics`, `categories`, `fee-settings`, `env`, `about`, `business-settings`, `terms`, `privacy`, `refund`, `shipping`, `cancellation`, `feedback`, `feedback-experience`, `safety-emergency`, `zones`, `upload`): **1 each**

### Note on count mismatch

- `backend/all_routes.txt` has **446** lines.
- `backend/scripts/discover_routes.js` found **444** live Express routes.
- For practical testing, **444** is the reliable number.

## 2. Fresh Latency Benchmark

### Coverage

- Benchmarked routes: **161 GET endpoints**
- Success: **124**
- Failed: **37**
- Average latency across successful calls: **185.6 ms**
- P95 latency: **370 ms**

### Slowest successful endpoints

1. `GET /api/admin/restaurant-analytics/:restaurantId` -> **830 ms**, **27 DB queries**
2. `GET /api/admin/dashboard/stats` -> **587 ms**, **34 DB queries**
3. `GET /api/delivery/wallet/` -> **558 ms**, **19 DB queries**
4. `GET /api/admin/env-variables` -> **448 ms**, **4 DB queries**
5. `GET /api/delivery/wallet/stats` -> **436 ms**, **16 DB queries**
6. `GET /api/delivery/wallet/transactions` -> **423 ms**, **16 DB queries**
7. `GET /api/restaurant/auth/me` -> **409 ms**, **2 DB queries**
8. `GET /api/delivery/orders` -> **370 ms**, **14 DB queries**
9. `GET /api/delivery/location` -> **369 ms**, **14 DB queries**
10. `GET /api/delivery/trip-history` -> **367 ms**, **14 DB queries**

### Most DB-query-heavy endpoints

1. `GET /api/admin/orders/restaurant-report` -> **64 queries**, **259 ms**
2. `GET /api/admin/dashboard/stats` -> **34 queries**, **587 ms**
3. `GET /api/admin/restaurant-analytics/:restaurantId` -> **27 queries**, **830 ms**
4. `GET /api/restaurant/under-250` -> **24 queries**, **209 ms**
5. `GET /api/delivery/wallet/` -> **19 queries**, **558 ms**
6. `GET /api/delivery/dashboard` -> **18 queries**, **162 ms**
7. `GET /api/delivery/wallet/transactions` -> **16 queries**, **423 ms**
8. `GET /api/delivery/wallet/stats` -> **16 queries**, **436 ms**
9. `GET /api/delivery/orders/stats` -> **14 queries**, **365 ms**
10. `GET /api/delivery/orders` -> **14 queries**, **370 ms**

## 3. Failed Endpoints During Benchmark

### Likely sample-data or auth-context failures

- Many `404` results are on `/:id` endpoints and likely caused by invalid sample IDs in `backend/benchmark_samples.json`
- One `403` was returned for `GET /api/delivery/orders/:orderId`, which suggests ownership/authorization mismatch rather than route absence

### Real failures that need code review

- `GET /api/auth/google/user` -> `500`
- `GET /api/admin/tiers/zones/:zoneId/restaurants` -> `500`
- `GET /api/admin/audit-logs/entity/:entityType/:entityId` -> `500`
- `GET /api/admin/audit-logs/commission-changes` -> `500`
- `GET /api/auth/google/user/callback` -> `ERR`, trying to reach frontend callback on `127.0.0.1:5173`

### Parameter-validation failures

- `GET /api/delivery/zones/in-radius` -> `400`
- `GET /api/admin/settlements/restaurants/:restaurantId/report` -> `400`
- `GET /api/admin/settlements/delivery/:deliveryId/report` -> `400`

## 4. Unnecessary / Redundant Client Calls

These are code-level redundant or avoidable calls found in frontend usage. This is not a browser HAR count, but these are definite hotspots.

### A. Extra health check before every restaurant fetch

- File: `frontend/src/module/user/pages/Home.jsx`
- Lines: around the `fetchRestaurants` block
- Pattern:
  - `fetch(`${backendUrl}/health`)`
  - then `restaurantAPI.getRestaurants(params)`
- Impact:
  - Every filter change triggers **2 network calls** instead of 1
  - Initial home load also pays this extra call
- Why unnecessary:
  - Axios interceptor already handles API/network errors globally
  - Health check duplicates the actual business request

### B. Home page makes multiple parallel landing calls on first load

- File: `frontend/src/module/user/pages/Home.jsx`
- Calls:
  - `/categories/public`
  - `/hero-banners/landing/public`
  - `/hero-banners/public`
  - `/hero-banners/top-10/public`
  - `/restaurant/list` indirectly via `fetchRestaurants`
- Impact:
  - First render can easily hit **5 API calls**, or **6** when the extra `/health` check is counted
- Why partially unnecessary:
  - Some of this can be merged server-side into a single landing payload
  - At minimum, `/health` should be removed

### C. Profile provider always fires two APIs on auth mount

- File: `frontend/src/module/user/context/ProfileContext.jsx`
- Calls:
  - `authAPI.getCurrentUser()`
  - `userAPI.getAddresses()`
- Impact:
  - Every authenticated app mount triggers **2 user APIs**
  - Happens even though there is already localStorage hydration
- Why potentially unnecessary:
  - This can be collapsed into a single bootstrap/profile endpoint
  - Current 5-minute stale gate only prevents repeats after initial mount, not the dual-call pattern itself

### D. Same admin ads listing endpoint repeated across pages

- Files:
  - `frontend/src/module/admin/pages/marketing/RestaurantBanners.jsx`
  - `frontend/src/module/admin/pages/advertisement/AdRequests.jsx`
  - `frontend/src/module/admin/pages/advertisement/AdsList.jsx`
- Shared endpoint:
  - `GET /marketing/ads/all`
- Impact:
  - Moving across these screens refetches the same dataset repeatedly
- Why unnecessary:
  - This is a strong candidate for query caching or shared store reuse

### E. Same tier data refetched in multiple admin screens

- Files:
  - `frontend/src/module/admin/pages/AdminHome.jsx`
  - `frontend/src/module/admin/pages/advertisement/SlotConfiguration.jsx`
- Shared endpoint:
  - `GET /admin/tiers`
- Impact:
  - Tier metadata is small and stable but fetched repeatedly per screen mount
- Why unnecessary:
  - Good candidate for app-level cache or prefetch once in admin shell

### F. Business settings fetched from navbar-level mount

- Files:
  - `frontend/src/module/admin/components/AdminNavbar.jsx`
  - utility cache in `frontend/src/lib/utils/businessSettings.js`
- Shared endpoint:
  - `GET /business-settings/public`
- Impact:
  - In-memory cache helps only within the same loaded bundle lifecycle
  - Full reload or parallel shells can still re-hit the endpoint
- Why probably acceptable but still repeated:
  - Not critical, but should ideally live in a top-level app bootstrap cache

## 5. Priority Findings

### Highest backend optimization targets

- `GET /api/admin/orders/restaurant-report`
  - 64 DB queries is the clearest N+1 style signal in the benchmark
- `GET /api/admin/dashboard/stats`
  - 34 queries and 587 ms; dashboard aggregation should be collapsed server-side
- `GET /api/admin/restaurant-analytics/:restaurantId`
  - 27 queries and highest real latency
- Delivery wallet family:
  - `/api/delivery/wallet/`
  - `/api/delivery/wallet/transactions`
  - `/api/delivery/wallet/stats`
  - all are both slow and query-heavy
- Delivery operational endpoints:
  - `/api/delivery/orders`
  - `/api/delivery/orders/stats`
  - `/api/delivery/trip-history`
  - `/api/delivery/earnings`
  - `/api/delivery/location`
  - same 14-query pattern suggests shared repeated loaders

### Highest frontend waste targets

- Remove `GET /health` preflight from Home restaurant loading
- Consolidate landing page bootstrap APIs
- Cache `/marketing/ads/all` across admin pages
- Cache `/admin/tiers` across admin pages
- Consider a single `/user/bootstrap` endpoint returning profile + addresses

## 6. What Was Actually Tested

- Fresh route discovery was run successfully
- Fresh benchmark was run successfully against local backend on `http://localhost:5000`
- Benchmark script only measures `GET` routes
- Non-GET routes are counted in inventory, but their latency is still unmeasured

## 7. Recommended Next Step

If you want phase 2, the next useful pass is:

1. Add benchmark coverage for safe `POST/PUT/PATCH` routes with fixture payloads
2. Add frontend request logging or browser HAR capture to measure exact duplicate-call counts per screen
3. Refactor the 5 hotspot endpoints above and re-run the same benchmark for before/after numbers
