import { useState, useEffect, useRef } from "react";
import { locationAPI, userAPI } from "@/lib/api";
import { ref, set, get } from 'firebase/database';
import { realtimeDb } from '@/lib/firebaseConfig';

// Module-level geocode cache — shared across hook instances, survives re-renders
const _geocodeCache = new Map();
const GEOCODE_GRID_SIZE = 0.0013; // ~150m grid cell
const GEOCODE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let mapsApiErrorWarned = false;
let geocoderSourceLogged = false;

function _getGridKey(lat, lng) {
  return `${(Math.round(lat / GEOCODE_GRID_SIZE) * GEOCODE_GRID_SIZE).toFixed(4)}_${(Math.round(lng / GEOCODE_GRID_SIZE) * GEOCODE_GRID_SIZE).toFixed(4)}`;
}

function _getCachedGeocode(lat, lng) {
  const key = _getGridKey(lat, lng);
  const entry = _geocodeCache.get(key);
  if (entry && Date.now() - entry.ts < GEOCODE_CACHE_TTL) return entry.data;
  if (entry) _geocodeCache.delete(key);
  return null;
}

function _setCachedGeocode(lat, lng, data) {
  const key = _getGridKey(lat, lng);
  _geocodeCache.set(key, { data, ts: Date.now() });
  // Evict old entries when cache grows too large
  if (_geocodeCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of _geocodeCache) {
      if (now - v.ts > GEOCODE_CACHE_TTL) _geocodeCache.delete(k);
    }
  }
}

function _getUserId() {
  try {
    const userStr = localStorage.getItem('user_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?._id || user?.id || null;
    }
  } catch { /* ignore */ }
  return null;
}

function _syncLocationToFirebase(lat, lng) {
  const userId = _getUserId();
  if (!userId) return;
  set(ref(realtimeDb, `users/${userId}/location`), {
    lat, lng, timestamp: Date.now()
  }).catch(() => {});
}

export function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const watchIdRef = useRef(null);
  const updateTimerRef = useRef(null);
  const prevLocationCoordsRef = useRef({
    latitude: null,
    longitude: null
  });
  const lastGeocodedCoordsRef = useRef({ latitude: null, longitude: null });

  /* ===================== DB UPDATE (LIVE LOCATION TRACKING) ===================== */
  const updateLocationInDB = async locationData => {
    try {
      // Check if location has placeholder values - don't save placeholders
      const hasPlaceholder = locationData?.city === "Current Location" || locationData?.address === "Select location" || locationData?.formattedAddress === "Select location" || !locationData?.city && !locationData?.address && !locationData?.formattedAddress;
      if (hasPlaceholder) {
        return;
      }

      // Check if user is authenticated before trying to update DB
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken');
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        // User not logged in - skip DB update, just use localStorage

        return;
      }

      // Prepare complete location data for database storage
      const locationPayload = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address || "",
        city: locationData.city || "",
        state: locationData.state || "",
        area: locationData.area || "",
        formattedAddress: locationData.formattedAddress || locationData.address || ""
      };

      // Add optional fields if available
      if (locationData.accuracy !== undefined && locationData.accuracy !== null) {
        locationPayload.accuracy = locationData.accuracy;
      }
      if (locationData.postalCode) {
        locationPayload.postalCode = locationData.postalCode;
      }
      if (locationData.street) {
        locationPayload.street = locationData.street;
      }
      if (locationData.streetNumber) {
        locationPayload.streetNumber = locationData.streetNumber;
      }
      await userAPI.updateLocation(locationPayload);
    } catch (err) {
      // Only log non-network and non-auth errors
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("❌ DB location update error:", err);
      } else if (err.response?.status === 404 || err.response?.status === 401) {}
    }
  };

  // Google Places API removed - using OLA Maps only

  /* ===================== DIRECT REVERSE GEOCODE ===================== */
  const reverseGeocodeDirect = async (latitude, longitude) => {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000); // Faster timeout

      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`, {
        signal: controller.signal
      });
      const data = await res.json();
      return {
        city: data.city || data.locality || "Unknown City",
        state: data.principalSubdivision || "",
        country: data.countryName || "",
        area: data.subLocality || "",
        address: data.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        formattedAddress: data.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      };
    } catch {
      return {
        city: "Current Location",
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      };
    }
  };

  /* ===================== GOOGLE MAPS REVERSE GEOCODE ===================== */
  const reverseGeocodeWithGoogleMaps = async (latitude, longitude) => {
    // Check grid cache first — avoids an API call if the user is in the same ~50m area
    const cached = _getCachedGeocode(latitude, longitude);
    if (cached) return cached;

    try {
      const {
        getGoogleMapsApiKey
      } = await import('@/lib/utils/googleMapsApiKey.js');
      const GOOGLE_MAPS_API_KEY = await getGoogleMapsApiKey();
      if (!GOOGLE_MAPS_API_KEY) {
        return reverseGeocodeDirect(latitude, longitude);
      }

      // Fetching address...

      // Validate coordinates are in India range BEFORE fetching
      // India: Latitude 6.5° to 37.1° N, Longitude 68.7° to 97.4° E
      const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0;
      if (!isInIndiaRange || longitude < 0) {
        console.warn("⚠️ Coordinates are outside India range - skipping geocoding");
        console.warn("⚠️ Coordinates: Lat", latitude, "Lng", longitude);
        console.warn("⚠️ India Range: Lat 6.5-37.1, Lng 68.7-97.4 (must be positive/East)");
        throw new Error("Coordinates outside India range");
      }

      // Prefer JS Geocoder when Maps JS API is loaded (avoids REST restriction errors)
      if (window?.google?.maps?.Geocoder) {
        if (!geocoderSourceLogged) {
          console.info("🗺️ Reverse geocode using Google Maps JS Geocoder");
          geocoderSourceLogged = true;
        }
        const geocoder = new window.google.maps.Geocoder();
        const results = await new Promise((resolve, reject) => {
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (res, status) => {
              if (status === "OK" && res && res.length > 0) {
                resolve(res);
              } else {
                reject(new Error(`Google Maps Geocoder failed: ${status}`));
              }
            }
          );
        });

        const topResult = results[0];
        const addressComponents = topResult.address_components || [];
        const getComponent = (types) =>
          addressComponents.find(comp => types.some(t => comp.types.includes(t)))?.long_name || "";

        const city =
          getComponent(["locality"]) ||
          getComponent(["administrative_area_level_2"]) ||
          getComponent(["sublocality"]) ||
          "Unknown City";
        const state = getComponent(["administrative_area_level_1"]) || "";
        const country = getComponent(["country"]) || "";
        const area =
          getComponent(["sublocality", "sublocality_level_1", "neighborhood"]) || "";

        const locationResult = {
          city,
          state,
          country,
          area,
          address: topResult.formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          formattedAddress: topResult.formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        };

        _setCachedGeocode(latitude, longitude, locationResult);
        return locationResult;
      }

      // Use AbortController for proper timeout handling
      if (!geocoderSourceLogged) {
        console.info("🗺️ Reverse geocode using Google Maps REST API");
        geocoderSourceLogged = true;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 20000); // 20 seconds timeout (increased from 15)

      let data;
      try {
        // ZOMATO-STYLE: Use Geocoding API with proper parameters for EXACT location
        // language=en for English, region=in for India (helps with better results)
        // result_type: prioritize premise > street_address > establishment > point_of_interest for exact location
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=en&region=in&result_type=premise|street_address|establishment|point_of_interest|route|sublocality`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId); // Clear timeout if request completes

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        data = await response.json();
      } catch (error) {
        clearTimeout(timeoutId); // Clear timeout on error
        if (error.name === 'AbortError') {
          console.error("❌ Google Maps API request was aborted due to timeout");
          throw new Error("Google Maps API timeout");
        }
        throw error;
      }

      // Check if response is valid
      if (!data) {
        console.error("❌ Google Maps API returned null/undefined response");
        throw new Error("Google Maps API returned null response");
      }

      // Log full response for debugging
      // Response received

      // Check for API errors
      if (data.status === "REQUEST_DENIED") {
        console.error("❌❌❌ Google Maps API REQUEST_DENIED!");
        console.error("❌ Error message:", data.error_message);
        console.error("❌ Possible reasons:");
        console.error("   1. API key is invalid or missing");
        console.error("   2. Geocoding API is not enabled in Google Cloud Console");
        console.error("   3. Billing is not enabled");
        console.error("   4. API key restrictions are blocking the request");
        throw new Error(`Google Maps API REQUEST_DENIED: ${data.error_message || "Check API key and billing"}`);
      }
      if (data.status === "OVER_QUERY_LIMIT") {
        console.error("❌❌❌ Google Maps API OVER_QUERY_LIMIT!");
        console.error("❌ You have exceeded your quota. Check billing in Google Cloud Console");
        throw new Error("Google Maps API quota exceeded. Check billing.");
      }
      if (data.status === "ZERO_RESULTS") {
        console.warn("⚠️⚠️⚠️ Google Maps API ZERO_RESULTS!");
        console.warn("⚠️ No results found for these coordinates:", latitude, longitude);
        console.warn("⚠️ This might mean the coordinates are invalid or in an unmapped area");
        throw new Error("No address found for these coordinates");
      }
      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        console.error("❌ Google Maps Geocoding Error:", {
          status: data.status,
          error_message: data.error_message,
          results_count: data.results?.length || 0
        });
        throw new Error(`Invalid response from Google Maps API: ${data.status} - ${data.error_message || "No results"}`);
      }

      // ZOMATO-STYLE: Find the MOST PRECISE result with POI/premise
      // Filter India results first, then find most specific
      let exactResult = null;
      let bestResultIndex = 0;

      // First, filter India results only
      const indiaResults = data.results.filter(r => {
        const addressComponents = r.address_components || [];
        return addressComponents.some(ac => ac.types.includes('country') && (ac.short_name === 'IN' || ac.long_name === 'India'));
      });
      if (indiaResults.length === 0) {
        console.warn("⚠️ No India results found in geocoding response");
        // Check if first result is foreign
        const firstResult = data.results[0];
        const addressComponents = firstResult.address_components || [];
        const countryComponent = addressComponents.find(ac => ac.types.includes('country'));
        if (countryComponent && countryComponent.short_name !== 'IN' && countryComponent.long_name !== 'India') {
          console.error("❌ Address is from foreign country:", countryComponent.long_name);
          throw new Error("Address outside India");
        }
        // If no country info, use first result but log warning
        exactResult = data.results[0];
      } else {
        // Priority: Find result with premise/establishment/street_address (most specific)
        for (let i = 0; i < Math.min(5, indiaResults.length); i++) {
          const result = indiaResults[i];
          const types = result.types || [];
          const hasPremise = types.includes("premise") || result.address_components?.some(c => c.types.includes("premise"));
          const hasEstablishment = types.includes("establishment") || result.address_components?.some(c => c.types.includes("establishment"));
          const hasStreetAddress = types.includes("street_address") || result.address_components?.some(c => c.types.includes("street_address"));
          const hasPOI = types.includes("point_of_interest") || result.address_components?.some(c => c.types.includes("point_of_interest"));

          // Priority: premise > establishment > street_address > point_of_interest
          if (hasPremise || hasEstablishment || hasStreetAddress || hasPOI) {
            exactResult = result;
            bestResultIndex = i;
            break;
          }
        }

        // If no specific result found, use first India result
        if (!exactResult) {
          exactResult = indiaResults[0];
        }
      }
      const addressComponents = exactResult.address_components || [];
      const formattedAddress = exactResult.formatted_address || "";

      // Validate address is not foreign (additional check)
      const foreignPattern = /\b(USA|United States|Los Angeles|California|CA \d{5}|New York|NY|UK|United Kingdom|London|Canada|Australia|Singapore|Dubai)\b/i;
      if (foreignPattern.test(formattedAddress)) {
        console.error("❌ REJECTED: Address is from foreign country:", formattedAddress);
        throw new Error("Foreign address detected");
      }

      // Log detailed information about the selected result
      // Precise result selected

      // If formattedAddress is incomplete (only 2 parts = city, state), log warning
      const addressPartsCount = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0).length;
      if (addressPartsCount <= 2 && !addressComponents.some(c => c.types.includes("point_of_interest") || c.types.includes("premise"))) {
        console.warn("⚠️⚠️⚠️ Incomplete address detected - only city/state level");
        console.warn("⚠️ Address parts count:", addressPartsCount);
        console.warn("⚠️ This usually means:");
        console.warn("   1. GPS coordinates are not accurate (network-based location instead of GPS)");
        console.warn("   2. Location is on a road/street without specific building");
        console.warn("   3. Solution: Use mobile device for better GPS accuracy (enableHighAccuracy: true)");
      }

      // Log ALL results to see what Google is returning
      // Log results list silently

      // Selection finalized

      // Extract address components with priority order (Zomato style - EXACT LOCATION)
      let city = "";
      let state = "";
      let area = "";
      let street = "";
      let streetNumber = "";
      let premise = ""; // Building name (e.g., "Princess Center")
      let pointOfInterest = ""; // Shop/Cafe name (e.g., "Mama Loca Cafe")
      let sublocalityLevel1 = ""; // Area name (e.g., "New Palasia")
      let sublocalityLevel2 = ""; // Sub-area name
      let postalCode = ""; // Pincode (e.g., "452001")
      let floor = ""; // Floor number (e.g., "5th Floor")

      // 1. EXACT LOCATION EXTRACTION - Extract ALL components for complete address
      // Google Maps formatted_address format: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001, India"

      // Extract all address components systematically
      for (const component of addressComponents) {
        const types = component.types || [];
        const longName = component.long_name || "";
        const shortName = component.short_name || "";

        // Point of Interest (POI) - Cafe/Shop name (e.g., "Mama Loca Cafe")
        if (types.includes("point_of_interest") && !pointOfInterest) {
          pointOfInterest = longName;
        }

        // Premise - Building name (e.g., "Princess Center", "501 Princess Center")
        if (types.includes("premise") && !premise) {
          premise = longName;
        }

        // Subpremise - Floor/Unit (e.g., "5th Floor", "G-2")
        if (types.includes("subpremise")) {
          floor = longName;
        }

        // Street number (e.g., "501")
        if (types.includes("street_number") && !streetNumber) {
          streetNumber = longName;
        }

        // Route/Street name
        if (types.includes("route") && !street) {
          street = longName;
        }

        // Sublocality Level 1 - Area name (e.g., "New Palasia")
        if (types.includes("sublocality_level_1") && !sublocalityLevel1) {
          sublocalityLevel1 = longName;
        }

        // Sublocality Level 2 - Sub-area name
        if (types.includes("sublocality_level_2") && !sublocalityLevel2) {
          sublocalityLevel2 = longName;
        }

        // City (locality)
        if (types.includes("locality") && !city) {
          city = longName;
        } else if (types.includes("administrative_area_level_2") && !city) {
          city = longName;
        }

        // State
        if (types.includes("administrative_area_level_1") && !state) {
          state = longName;
        }

        // Postal Code (Pincode)
        if (types.includes("postal_code") && !postalCode) {
          postalCode = longName;
        }
      }

      // Extract main title from geocoding address_components
      // Priority: point_of_interest > premise > sublocality_level_1
      let mainTitle = "";
      const building = addressComponents.find(c => c.types.includes("point_of_interest") || c.types.includes("premise") || c.types.includes("sublocality_level_1"));
      if (building) {
        mainTitle = building.long_name;
      } else {
        mainTitle = "Location Found";
      }

      // Use mainTitle as mainLocation (Zomato-style)
      let mainLocation = mainTitle;

      // Set area from main location (Zomato priority order)
      if (mainLocation && mainLocation !== "Location Found") {
        area = mainLocation;
      } else if (pointOfInterest) {
        area = pointOfInterest;
        mainLocation = pointOfInterest;
      } else if (premise) {
        area = premise;
        mainLocation = premise;
      } else if (sublocalityLevel1) {
        area = sublocalityLevel1;
        mainLocation = sublocalityLevel1;
      } else {
        // Fallback: Use city if nothing else found
        area = city || "Location Found";
        mainLocation = city || "Location Found";
      }

      // 3. Build COMPLETE detailed address from extracted components
      // Format: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
      // Order: POI > Street Number + Premise > Floor > Sublocality > City > State + Pincode

      let completeAddressParts = [];

      // Add Point of Interest (Cafe/Shop name) - e.g., "Mama Loca Cafe"
      if (pointOfInterest && pointOfInterest.trim() !== "") {
        completeAddressParts.push(pointOfInterest);
      }

      // Add Street Number + Premise (Building) - e.g., "501 Princess Center"
      if (streetNumber && premise) {
        completeAddressParts.push(`${streetNumber} ${premise}`);
      } else if (premise && premise.trim() !== "") {
        completeAddressParts.push(premise);
      } else if (streetNumber && streetNumber.trim() !== "") {
        completeAddressParts.push(streetNumber);
      }

      // Add Floor/Subpremise - e.g., "5th Floor"
      if (floor && floor.trim() !== "") {
        completeAddressParts.push(floor);
      }

      // Add Sublocality Level 1 (Area) - e.g., "New Palasia"
      if (sublocalityLevel1 && sublocalityLevel1.trim() !== "") {
        completeAddressParts.push(sublocalityLevel1);
      }

      // Add City - e.g., "Indore"
      if (city && city.trim() !== "") {
        completeAddressParts.push(city);
      }

      // Add State + Pincode - e.g., "Madhya Pradesh 452001"
      if (state && state.trim() !== "") {
        if (postalCode && postalCode.trim() !== "") {
          completeAddressParts.push(`${state} ${postalCode}`);
        } else {
          completeAddressParts.push(state);
        }
      } else if (postalCode && postalCode.trim() !== "") {
        completeAddressParts.push(postalCode);
      }

      // Build complete formatted address
      // CRITICAL: Check if Google's formatted_address has complete details
      const formattedParts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
      const hasCompleteFormattedAddress = formattedParts.length >= 4;
      let completeFormattedAddress = formattedAddress; // Default to Google's formatted_address

      // If Google's formatted_address is complete (4+ parts), use it directly
      // Otherwise, try to build from components
      if (hasCompleteFormattedAddress) {
        completeFormattedAddress = formattedAddress;
      } else if (completeAddressParts.length > 0 && (pointOfInterest || premise)) {
        // Build from components if we have POI/premise
        completeFormattedAddress = completeAddressParts.join(', ');
      } else {
        // Google's formatted_address is incomplete - log warning
        console.warn("⚠️⚠️⚠️ Google's formatted_address is incomplete (only 2-3 parts):", formattedAddress);
        console.warn("⚠️ This usually means:");
        console.warn("   1. GPS coordinates are not accurate (network-based location)");
        console.warn("   2. Location is in a generic area without specific POI/premise");
        console.warn("   3. Try on mobile device for better GPS accuracy");
        completeFormattedAddress = formattedAddress; // Use what we have
      }

      // Build display address (for navbar) - ZOMATO-STYLE: Show exact landmark first
      // Format: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia"
      let displayAddressParts = [];

      // Priority 1: Use mainTitle/mainLocation (building/cafe name) - ZOMATO-STYLE
      // This is the exact Zomato approach - show "Mama Loca Cafe" as the main title
      if (mainLocation && mainLocation.trim() !== "" && mainLocation !== "Location Found") {
        displayAddressParts.push(mainLocation);
      } else if (pointOfInterest && pointOfInterest.trim() !== "") {
        // Fallback to pointOfInterest if mainLocation not set
        displayAddressParts.push(pointOfInterest);
      } else if (premise && premise.trim() !== "") {
        // Fallback to premise
        displayAddressParts.push(premise);
      }

      // Add building details if not already included in mainLocation
      if (premise && premise.trim() !== "" && premise !== mainLocation && premise !== pointOfInterest) {
        if (streetNumber && streetNumber.trim() !== "") {
          displayAddressParts.push(`${streetNumber} ${premise}`);
        } else {
          displayAddressParts.push(premise);
        }
      } else if (streetNumber && streetNumber.trim() !== "" && !mainLocation) {
        displayAddressParts.push(streetNumber);
      }

      // Add floor if available
      if (floor && floor.trim() !== "") {
        displayAddressParts.push(floor);
      }

      // Add sublocality if not already included
      if (sublocalityLevel1 && sublocalityLevel1.trim() !== "" && sublocalityLevel1 !== mainLocation) {
        displayAddressParts.push(sublocalityLevel1);
      }

      // If we couldn't build from components, extract from formatted_address (ZOMATO-STYLE)
      // formatted_address from results[0] usually has: "Mama Loca Cafe, 501 Princess Center, 5th Floor, New Palasia, Indore, Madhya Pradesh 452001"
      if (displayAddressParts.length === 0 && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);

        // Remove pincode, country, and city/state parts
        const filteredParts = parts.filter(part => {
          if (/^\d{6}$/.test(part)) return false; // Skip standalone pincode
          if (/\s+\d{6}$/.test(part)) {
            return part.replace(/\s+\d{6}$/, '').trim(); // Remove pincode from state
          }
          if (part.toLowerCase() === "india" || part.length > 25) return false;
          if (city && part.toLowerCase() === city.toLowerCase()) return false;
          if (state && part.toLowerCase().includes(state.toLowerCase())) return false;
          return true;
        });
        // Find city index
        let cityIndex = -1;
        if (city) {
          cityIndex = filteredParts.findIndex(part => part.toLowerCase() === city.toLowerCase());
        }
        if (cityIndex === -1) {
          const commonCities = ["Indore", "indore", "Bhopal", "bhopal", "Mumbai", "mumbai", "Delhi", "delhi"];
          cityIndex = filteredParts.findIndex(part => commonCities.some(c => part.toLowerCase() === c.toLowerCase()));
        }

        // Extract locality parts (everything before city) - this includes POI, building, floor, area
        if (cityIndex > 0) {
          displayAddressParts = filteredParts.slice(0, cityIndex);
        } else if (filteredParts.length >= 4) {
          // If city not found, take first 4 parts (usually POI, building, floor, area)
          displayAddressParts = filteredParts.slice(0, 4);
        } else if (filteredParts.length >= 3) {
          displayAddressParts = filteredParts.slice(0, 3);
        } else if (filteredParts.length >= 2) {
          displayAddressParts = filteredParts.slice(0, 2);
        } else if (filteredParts.length >= 1) {
          displayAddressParts = [filteredParts[0]];
        }
      }

      // Final display address - prioritize extracted parts, fallback to area/mainLocation
      const displayAddress = displayAddressParts.length > 0 ? displayAddressParts.join(', ') : mainLocation || area || city || "Select location";
      // Set area for backward compatibility
      if (!area) {
        if (sublocalityLevel1) {
          area = sublocalityLevel1;
        } else if (premise) {
          area = premise;
        } else if (pointOfInterest) {
          area = pointOfInterest;
        } else if (city) {
          area = city;
        } else {
          area = "Location Found";
        }
      }

      // Address extracted

      // Final validation: Ensure mainTitle/mainLocation is used properly
      if (mainTitle && mainTitle !== "Location Found") {
        // Exact building extracted
      } else {
        console.warn("⚠️⚠️⚠️ ZOMATO-STYLE WARNING: Could not extract exact building/cafe name");
        console.warn("⚠️ This might be due to:");
        console.warn("   1. Location is not at a specific building/cafe (e.g., on a road)");
        console.warn("   2. Google Maps doesn't have POI/premise data for this location");
        console.warn("   3. GPS accuracy is low (try on mobile device)");
      }

      const locationResult = {
        city: city || "Unknown City",
        state: state || "",
        area: area || city || "Location Found",
        address: displayAddress,
        formattedAddress: completeFormattedAddress,
        street: street || "",
        streetNumber: streetNumber || "",
        postalCode: postalCode || "",
        mainTitle: mainTitle !== "Location Found" ? mainTitle : null,
        pointOfInterest: pointOfInterest || null,
        premise: premise || null
      };

      _setCachedGeocode(latitude, longitude, locationResult);
      return locationResult;
    } catch (error) {
      if (!mapsApiErrorWarned) {
        console.error("❌ Google Maps Reverse Geocode Error:", error);
        console.error("❌ Error details:", {
          message: error.message,
          stack: error.stack,
          coordinates: { latitude, longitude }
        });
        if (error.message.includes("REQUEST_DENIED") || error.message.includes("OVER_QUERY_LIMIT")) {
          console.warn("⚠️ Google Maps API configuration issue (using fallback geocoder).");
        }
        mapsApiErrorWarned = true;
      }

      // Fallback on all errors to keep flow non-blocking
      if (!geocoderSourceLogged) {
        console.info("🗺️ Reverse geocode using fallback provider");
        geocoderSourceLogged = true;
      }
      console.warn("⚠️ Using fallback reverse geocoding...");
      return reverseGeocodeDirect(latitude, longitude);
    }
  };

  /* ===================== OLA MAPS REVERSE GEOCODE (DEPRECATED - KEPT FOR FALLBACK) ===================== */
  const reverseGeocodeWithOLAMaps = async (latitude, longitude) => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("OLA Maps API timeout")), 10000));
      const apiPromise = locationAPI.reverseGeocode(latitude, longitude);
      const res = await Promise.race([apiPromise, timeoutPromise]);

      // Log full response for debugging

      // Check if response is valid
      if (!res || !res.data) {
        throw new Error("Invalid response from OLA Maps API");
      }

      // Check if API call was successful
      if (res.data.success === false) {
        throw new Error(res.data.message || "OLA Maps API returned error");
      }

      // Backend returns: { success: true, data: { results: [{ formatted_address, address_components: { city, state, country, area } }] } }
      const backendData = res?.data?.data || {};

      // Debug: Check backend data structure

      // Handle different OLA Maps response structures
      // Backend processes OLA Maps response and returns: { results: [{ formatted_address, address_components: { city, state, area } }] }
      let result = null;
      if (backendData.results && Array.isArray(backendData.results) && backendData.results.length > 0) {
        result = backendData.results[0];
      } else if (backendData.result && Array.isArray(backendData.result) && backendData.result.length > 0) {
        result = backendData.result[0];
      } else if (backendData.results && !Array.isArray(backendData.results)) {
        result = backendData.results;
      } else {
        result = backendData;
      }
      if (!result) {
        console.warn("⚠️ No result found in backend data");
        result = {};
      }
      // Extract address_components - handle both object and array formats
      let addressComponents = {};
      if (result.address_components) {
        if (Array.isArray(result.address_components)) {
          // Google Maps style array
          result.address_components.forEach(comp => {
            const types = comp.types || [];
            if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('neighborhood') && !addressComponents.area) {
              addressComponents.area = comp.long_name || comp.short_name;
            } else if (types.includes('locality')) {
              addressComponents.city = comp.long_name || comp.short_name;
            } else if (types.includes('administrative_area_level_1')) {
              addressComponents.state = comp.long_name || comp.short_name;
            } else if (types.includes('country')) {
              addressComponents.country = comp.long_name || comp.short_name;
            }
          });
        } else {
          // Object format
          addressComponents = result.address_components;
        }
      } else if (result.components) {
        addressComponents = result.components;
      }
      // Extract address details - try multiple possible response structures
      let city = addressComponents?.city || result?.city || result?.locality || result?.address_components?.city || "";
      let state = addressComponents?.state || result?.state || result?.administrative_area_level_1 || result?.address_components?.state || "";
      let country = addressComponents?.country || result?.country || result?.country_name || result?.address_components?.country || "";
      let formattedAddress = result?.formatted_address || result?.formattedAddress || result?.address || "";

      // PRIORITY 1: Extract area from formatted_address FIRST (most reliable for Indian addresses)
      // Indian address format: "Area, City, State" e.g., "New Palasia, Indore, Madhya Pradesh"
      // ALWAYS try formatted_address FIRST - it's the most reliable source and preserves full names like "New Palasia"
      let area = "";
      if (formattedAddress) {
        const addressParts = formattedAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
        // ZOMATO-STYLE: If we have 3+ parts, first part is ALWAYS the area/locality
        // Format: "New Palasia, Indore, Madhya Pradesh" -> area = "New Palasia"
        if (addressParts.length >= 3) {
          const firstPart = addressParts[0];
          const secondPart = addressParts[1]; // Usually city
          const thirdPart = addressParts[2]; // Usually state

          // First part is the area (e.g., "New Palasia")
          // Second part is usually city (e.g., "Indore")
          // Third part is usually state (e.g., "Madhya Pradesh")
          if (firstPart && firstPart.length > 2 && firstPart.length < 50) {
            // Make sure first part is not the same as city or state
            const firstLower = firstPart.toLowerCase();
            const cityLower = (city || secondPart || "").toLowerCase();
            const stateLower = (state || thirdPart || "").toLowerCase();
            if (firstLower !== cityLower && firstLower !== stateLower && !firstPart.match(/^\d+/) &&
            // Not a number
            !firstPart.match(/^\d+\s*(km|m|meters?)$/i) &&
            // Not a distance
            !firstLower.includes("district") &&
            // Not a district name
            !firstLower.includes("city")) {
              // Not a city name
              area = firstPart;
              // Also update city if second part matches better
              if (secondPart && (!city || secondPart.toLowerCase() !== city.toLowerCase())) {
                city = secondPart;
              }
              // Also update state if third part matches better
              if (thirdPart && (!state || thirdPart.toLowerCase() !== state.toLowerCase())) {
                state = thirdPart;
              }
            }
          }
        } else if (addressParts.length === 2 && !area) {
          // Two parts: Could be "Area, City" or "City, State"
          const firstPart = addressParts[0];
          const secondPart = addressParts[1];

          // Check if first part is city (if we already have city name)
          const isFirstCity = city && firstPart.toLowerCase() === city.toLowerCase();

          // If first part is NOT the city, it's likely the area
          if (!isFirstCity && firstPart.length > 2 && firstPart.length < 50 && !firstPart.toLowerCase().includes("district") && !firstPart.toLowerCase().includes("city") && !firstPart.match(/^\d+/)) {
            area = firstPart;
            // Update city if second part exists
            if (secondPart && !city) {
              city = secondPart;
            }
          } else if (isFirstCity) {
            // First part is city, second part might be state
            // No area in this case, but update state if needed
            if (secondPart && !state) {
              state = secondPart;
            }
          }
        } else if (addressParts.length === 1 && !area) {
          // Single part - could be just city or area
          const singlePart = addressParts[0];
          if (singlePart && singlePart.length > 2 && singlePart.length < 50) {
            // If it doesn't match city exactly, it might be an area
            if (!city || singlePart.toLowerCase() !== city.toLowerCase()) {
              // Don't use as area if it looks like a city name (contains common city indicators)
              if (!singlePart.toLowerCase().includes("city") && !singlePart.toLowerCase().includes("district")) {}
            }
          }
        }
      }

      // PRIORITY 2: If still no area from formatted_address, try from address_components (fallback)
      // Note: address_components might have incomplete/truncated names like "Palacia" instead of "New Palasia"
      // So we ALWAYS prefer formatted_address extraction over address_components
      if (!area && addressComponents) {
        // Try all possible area fields (but exclude state and generic names!)
        const possibleAreaFields = [addressComponents.sublocality, addressComponents.sublocality_level_1, addressComponents.neighborhood, addressComponents.sublocality_level_2, addressComponents.locality, addressComponents.area // Check area last
        ].filter(field => {
          // Filter out invalid/generic area names
          if (!field) return false;
          const fieldLower = field.toLowerCase();
          return fieldLower !== state.toLowerCase() && fieldLower !== city.toLowerCase() && !fieldLower.includes("district") && !fieldLower.includes("city") && field.length > 3; // Minimum length
        });
        if (possibleAreaFields.length > 0) {
          const fallbackArea = possibleAreaFields[0];
          // CRITICAL: If formatted_address exists and has a different area, prefer formatted_address
          // This ensures "New Palasia" from formatted_address beats "Palacia" from address_components
          if (formattedAddress && formattedAddress.toLowerCase().includes(fallbackArea.toLowerCase())) {} else {
            area = fallbackArea;
          }
        }
      }

      // Also check address_components array structure (Google Maps style)
      if (!area && result?.address_components && Array.isArray(result.address_components)) {
        const components = result.address_components;
        // Find sublocality or neighborhood in the components array
        const sublocality = components.find(comp => comp.types?.includes('sublocality') || comp.types?.includes('sublocality_level_1') || comp.types?.includes('neighborhood'));
        if (sublocality?.long_name || sublocality?.short_name) {
          area = sublocality.long_name || sublocality.short_name;
        }
      }

      // FINAL FALLBACK: If area is still empty, force extract from formatted_address
      // This is the last resort - be very aggressive (ZOMATO-STYLE)
      // Even if formatted_address only has 2 parts (City, State), try to extract area
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const potentialArea = parts[0];
          // Very lenient check - if it's not obviously city/state, use it as area
          const potentialAreaLower = potentialArea.toLowerCase();
          const cityLower = (city || "").toLowerCase();
          const stateLower = (state || "").toLowerCase();
          if (potentialArea && potentialArea.length > 2 && potentialArea.length < 50 && !potentialArea.match(/^\d+/) && potentialAreaLower !== cityLower && potentialAreaLower !== stateLower && !potentialAreaLower.includes("district") && !potentialAreaLower.includes("city")) {
            area = potentialArea;
          }
        }
      }

      // Final validation and logging

      // CRITICAL: If formattedAddress has only 2 parts, OLA Maps didn't provide sublocality
      // Try to get more detailed location using coordinates-based search
      if (!area && formattedAddress) {
        const parts = formattedAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);

        // If we have 3+ parts, extract area from first part
        if (parts.length >= 3) {
          // ZOMATO PATTERN: "New Palasia, Indore, Madhya Pradesh"
          // First part = Area, Second = City, Third = State
          const potentialArea = parts[0];
          // Validate it's not state, city, or generic names
          const potentialAreaLower = potentialArea.toLowerCase();
          if (potentialAreaLower !== state.toLowerCase() && potentialAreaLower !== city.toLowerCase() && !potentialAreaLower.includes("district") && !potentialAreaLower.includes("city")) {
            area = potentialArea;
            if (!city && parts[1]) city = parts[1];
            if (!state && parts[2]) state = parts[2];
          }
        } else if (parts.length === 2) {
          // Only 2 parts: "Indore, Madhya Pradesh" - area is missing
          // OLA Maps API didn't provide sublocality
          console.warn("⚠️ Only 2 parts in address - OLA Maps didn't provide sublocality");
          // Try to extract from other fields in the response
          // Check if result has any other location fields
          if (result.locality && result.locality !== city) {
            area = result.locality;
          } else if (result.neighborhood) {
            area = result.neighborhood;
          } else {
            // Leave area empty - will show city instead
            area = "";
          }
        }
      }

      // FINAL VALIDATION: Never use state as area!
      if (area && state && area.toLowerCase() === state.toLowerCase()) {
        console.warn("⚠️⚠️⚠️ REJECTING area (same as state):", area);
        area = "";
      }

      // FINAL VALIDATION: Reject district names
      if (area && area.toLowerCase().includes("district")) {
        console.warn("⚠️⚠️⚠️ REJECTING area (contains district):", area);
        area = "";
      }

      // If we have a valid formatted address or city, return it
      if (formattedAddress || city) {
        const finalLocation = {
          city: city || "Unknown City",
          state: state || "",
          country: country || "",
          area: area || "",
          // Area is CRITICAL - must be extracted
          address: formattedAddress || `${city || "Current Location"}`,
          formattedAddress: formattedAddress || `${city || "Current Location"}`
        };
        return finalLocation;
      }

      // If no valid data, throw to trigger fallback
      throw new Error("No valid address data from OLA Maps");
    } catch (err) {
      console.warn("⚠️ Google Maps failed, trying direct geocoding:", err.message);
      // Fallback to direct reverse geocoding (no Google Maps dependency)
      try {
        return await reverseGeocodeWithGoogleMaps(latitude, longitude);
      } catch (fallbackErr) {
        // If all fail, return minimal location data
        console.error("❌ All reverse geocoding failed:", fallbackErr);
        return {
          city: "Current Location",
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        };
      }
    }
  };

  /* ===================== DB FETCH (Firebase RTDB first, then REST) ===================== */
  const fetchLocationFromDB = async () => {
    try {
      const userId = _getUserId();

      // --- Try Firebase RTDB first (instant, works offline) ---
      if (userId) {
        try {
          const snapshot = await get(ref(realtimeDb, `users/${userId}/location`));
          if (snapshot.exists()) {
            const { lat, lng, timestamp } = snapshot.val();
            const isRecent = timestamp && (Date.now() - timestamp < 30 * 60 * 1000);
            if (isRecent && lat && lng) {
              const isInIndiaRange = lat >= 6.5 && lat <= 37.1 && lng >= 68.7 && lng <= 97.4 && lng > 0;
              if (isInIndiaRange) {
                try {
                  const addr = await reverseGeocodeWithGoogleMaps(lat, lng);
                  return { ...addr, latitude: lat, longitude: lng };
                } catch {
                  return { latitude: lat, longitude: lng, city: "Current Location", area: "", state: "", address: "Select location", formattedAddress: "Select location" };
                }
              }
            }
          }
        } catch { /* Firebase read failed — fall through to REST */ }
      }

      // --- Fallback: REST API ---
      const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken');
      if (!userToken || userToken === 'null' || userToken === 'undefined') {
        return null;
      }
      const res = await userAPI.getLocation();
      const loc = res?.data?.data?.location;
      if (loc?.latitude && loc?.longitude) {
        const isInIndiaRange = loc.latitude >= 6.5 && loc.latitude <= 37.1 && loc.longitude >= 68.7 && loc.longitude <= 97.4 && loc.longitude > 0;
        if (!isInIndiaRange || loc.longitude < 0) {
          return { latitude: loc.latitude, longitude: loc.longitude, city: "Current Location", state: "", country: "", area: "", address: "Select location", formattedAddress: "Select location" };
        }
        try {
          const addr = await reverseGeocodeWithGoogleMaps(loc.latitude, loc.longitude);
          return { ...addr, latitude: loc.latitude, longitude: loc.longitude };
        } catch {
          return { latitude: loc.latitude, longitude: loc.longitude, city: "Current Location", area: "", state: "", address: "Select location", formattedAddress: "Select location" };
        }
      }
    } catch (err) {
      if (err.code !== "ERR_NETWORK" && err.response?.status !== 404 && err.response?.status !== 401) {
        console.error("DB location fetch error:", err);
      }
    }
    return null;
  };

  /* ===================== MAIN LOCATION ===================== */
  const getLocation = async (updateDB = true, forceFresh = false, showLoading = false) => {
    // If not forcing fresh, try DB first (faster)
    let dbLocation = !forceFresh ? await fetchLocationFromDB() : null;
    if (dbLocation && !forceFresh) {
      setLocation(dbLocation);
      if (showLoading) setLoading(false);
      return dbLocation;
    }
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      if (showLoading) setLoading(false);
      return dbLocation;
    }

    // Helper function to get position with retry mechanism
    const getPositionWithRetry = (options, retryCount = 0) => {
      return new Promise((resolve, reject) => {
        const isRetry = retryCount > 0;
        // Use cached location if available and not too old (faster response)
        // If forceFresh is true, don't use cache (maximumAge: 0)
        const cachedOptions = {
          ...options,
          maximumAge: forceFresh ? 0 : options.maximumAge || 60000 // If forceFresh, get fresh location
        };
        navigator.geolocation.getCurrentPosition(async pos => {
          try {
            const { latitude, longitude, accuracy } = pos.coords;
            const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0;

            // Set coordinates immediately so zone detection + restaurant fetch can start
            const coordOnlyLoc = {
              ...(location || {}),
              latitude,
              longitude,
              accuracy: accuracy || null
            };
            setLocation(coordOnlyLoc);
            setPermissionGranted(true);
            if (showLoading) setLoading(false);
            setError(null);
            _syncLocationToFirebase(latitude, longitude);

            if (!isInIndiaRange || longitude < 0) {
              resolve(coordOnlyLoc);
              return;
            }

            // Now geocode (may return from cache instantly)
            let addr;
            try {
              addr = await reverseGeocodeWithGoogleMaps(latitude, longitude);
            } catch {
              try { addr = await reverseGeocodeDirect(latitude, longitude); } catch { resolve(coordOnlyLoc); return; }
            }

            if (!addr || addr.city === "Current Location" || addr.address === "Select location") {
              resolve(coordOnlyLoc);
              return;
            }

            lastGeocodedCoordsRef.current = { latitude, longitude };

            let displayAddress = addr.address || "";
            const completeFormattedAddress = addr.formattedAddress || "";
            if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim())) {
              displayAddress = addr.area || addr.city || "Select location";
            }

            const finalLoc = {
              ...addr,
              latitude,
              longitude,
              accuracy: accuracy || null,
              address: displayAddress,
              formattedAddress: completeFormattedAddress || displayAddress
            };

            localStorage.setItem("userLocation", JSON.stringify(finalLoc));
            setLocation(finalLoc);

            if (updateDB) {
              updateLocationInDB(finalLoc).catch(() => {});
            }
            resolve(finalLoc);
          } catch (err) {
            console.error("Error processing location:", err);
            const { latitude, longitude } = pos.coords;
            const fallbackLoc = { ...(location || {}), latitude, longitude, city: "Current Location", area: "", state: "", address: "Select location", formattedAddress: "Select location" };
            setLocation(fallbackLoc);
            setPermissionGranted(true);
            if (showLoading) setLoading(false);
            resolve(fallbackLoc);
          }
        }, async err => {
          // If timeout and we haven't retried yet, try with lower accuracy
          if (err.code === 3 && retryCount === 0 && options.enableHighAccuracy) {
            console.warn("⏱️ High accuracy timeout, retrying with lower accuracy...");
            // Retry with lower accuracy - faster response (uses network-based location)
            getPositionWithRetry({
              enableHighAccuracy: false,
              timeout: 5000,
              // 5 seconds for lower accuracy (network-based is faster)
              maximumAge: 300000 // Allow 5 minute old cached location for instant response
            }, 1).then(resolve).catch(reject);
            return;
          }

          // Don't log timeout errors as errors - they're expected in some cases
          if (err.code === 3) {
            console.warn("⏱️ Geolocation timeout (code 3) - using fallback location");
          } else {
            console.error("❌ Geolocation error:", err.code, err.message);
          }
          // Try multiple fallback strategies
          try {
            // Strategy 1: Use DB location if available
            let fallback = dbLocation;
            if (!fallback) {
              fallback = await fetchLocationFromDB();
            }

            // Strategy 2: Use cached location from localStorage
            if (!fallback) {
              const stored = localStorage.getItem("userLocation");
              if (stored) {
                try {
                  fallback = JSON.parse(stored);
                } catch (parseErr) {
                  console.warn("⚠️ Failed to parse stored location:", parseErr);
                }
              }
            }
            if (fallback) {
              setLocation(fallback);
              // Don't set error for timeout when we have fallback
              if (err.code !== 3) {
                setError(err.message);
              }
              setPermissionGranted(true); // Still grant permission if we have location
              if (showLoading) setLoading(false);
              resolve(fallback);
            } else {
              // No fallback available - set a default location so UI doesn't hang
              console.warn("⚠️ No fallback location available, setting default");
              const defaultLocation = {
                city: "Select location",
                address: "Select location",
                formattedAddress: "Select location"
              };
              setLocation(defaultLocation);
              setError(err.code === 3 ? "Location request timed out. Please try again." : err.message);
              setPermissionGranted(false);
              if (showLoading) setLoading(false);
              resolve(defaultLocation); // Always resolve with something
            }
          } catch (fallbackErr) {
            console.warn("⚠️ Fallback retrieval failed:", fallbackErr);
            setLocation(null);
            setError(err.code === 3 ? "Location request timed out. Please try again." : err.message);
            setPermissionGranted(false);
            if (showLoading) setLoading(false);
            resolve(null);
          }
        }, options);
      });
    };

    // Try with high accuracy first
    // If forceFresh is true, don't use cached location (maximumAge: 0)
    // Otherwise, allow cached location for faster response
    return getPositionWithRetry({
      enableHighAccuracy: true,
      // Use GPS for exact location (highest accuracy)
      timeout: 15000,
      // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: forceFresh ? 0 : 60000 // If forceFresh, get fresh location. Otherwise allow 1 minute cache
    });
  };

  /* ===================== WATCH LOCATION ===================== */
  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      console.warn("⚠️ Geolocation not supported");
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    let retryCount = 0;
    const maxRetries = 2;
    const startWatch = options => {
      watchIdRef.current = navigator.geolocation.watchPosition(async pos => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          retryCount = 0;

          // --- Step 1: Immediately update coordinates in state ---
          // This triggers zone detection + restaurant/ad fetches without waiting for geocoding
          const coordThreshold = 0.0001; // ~10m
          const coordsChanged =
            !prevLocationCoordsRef.current.latitude ||
            !prevLocationCoordsRef.current.longitude ||
            Math.abs(prevLocationCoordsRef.current.latitude - latitude) > coordThreshold ||
            Math.abs(prevLocationCoordsRef.current.longitude - longitude) > coordThreshold;

          if (coordsChanged) {
            prevLocationCoordsRef.current = { latitude, longitude };

            setLocation(prev => {
              const updated = {
                ...(prev || {}),
                latitude,
                longitude,
                accuracy: accuracy || null
              };
              localStorage.setItem("userLocation", JSON.stringify(updated));
              return updated;
            });
            setPermissionGranted(true);
            setError(null);

            // Sync coordinates to Firebase RTDB (real-time location bus)
            _syncLocationToFirebase(latitude, longitude);
          }

          // --- Step 2: Geocode asynchronously only if moved ~150m from last geocoded position ---
          const geocodeThreshold = 0.0013; // ~150m — matches the grid cache cell size
          const needsGeocode =
            !lastGeocodedCoordsRef.current.latitude ||
            !lastGeocodedCoordsRef.current.longitude ||
            Math.abs(lastGeocodedCoordsRef.current.latitude - latitude) > geocodeThreshold ||
            Math.abs(lastGeocodedCoordsRef.current.longitude - longitude) > geocodeThreshold;

          if (needsGeocode) {
            const isInIndiaRange = latitude >= 6.5 && latitude <= 37.1 && longitude >= 68.7 && longitude <= 97.4 && longitude > 0;
            if (isInIndiaRange) {
              // Fire-and-forget — don't block the position callback
              (async () => {
                try {
                  let addr;
                  try {
                    addr = await reverseGeocodeWithGoogleMaps(latitude, longitude);
                  } catch {
                    try { addr = await reverseGeocodeDirect(latitude, longitude); } catch { return; }
                  }
                  if (!addr || addr.city === "Current Location" || addr.address === "Select location") return;

                  lastGeocodedCoordsRef.current = { latitude, longitude };

                  let displayAddress = addr.address || "";
                  let completeFormattedAddress = addr.formattedAddress || "";
                  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(displayAddress.trim())) {
                    displayAddress = addr.area || addr.city || "Select location";
                  }
                  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(completeFormattedAddress.trim()) || !completeFormattedAddress || completeFormattedAddress === "Select location") {
                    const parts = [addr.area, addr.city, addr.state].filter(Boolean);
                    completeFormattedAddress = parts.length ? parts.join(', ') : addr.city || "Select location";
                    displayAddress = addr.area || addr.city || displayAddress;
                  }

                  const mergedLoc = { ...addr, latitude, longitude, accuracy: accuracy || null, address: displayAddress, formattedAddress: completeFormattedAddress };
                  localStorage.setItem("userLocation", JSON.stringify(mergedLoc));
                  setLocation(mergedLoc);

                  // Debounce DB update
                  clearTimeout(updateTimerRef.current);
                  updateTimerRef.current = setTimeout(() => {
                    updateLocationInDB(mergedLoc).catch(() => {});
                  }, 5 * 60 * 1000);
                } catch { /* geocoding failed silently — coordinates already in state */ }
              })();
            }
          }
        } catch (err) {
          console.error("Error processing live location update:", err);
          const { latitude, longitude } = pos.coords;
          setLocation(prev => ({ ...(prev || {}), latitude, longitude, city: prev?.city || "Current Location", area: prev?.area || "", state: prev?.state || "", address: prev?.address || "Select location", formattedAddress: prev?.formattedAddress || "Select location" }));
          setPermissionGranted(true);
        }
      }, err => {
        // Don't log timeout errors for watchPosition (it's a background operation)
        // Only log non-timeout errors
        if (err.code !== 3) {
          console.warn("⚠️ Watch position error (non-timeout):", err.code, err.message);
        }

        // If timeout and we haven't exceeded max retries, retry with HIGH ACCURACY GPS
        // CRITICAL: Keep using GPS (not network-based) for accurate location
        // Network-based location won't give exact landmarks like "Mama Loca Cafe"
        if (err.code === 3 && retryCount < maxRetries) {
          retryCount++;
          // Clear current watch
          if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          // Retry with HIGH ACCURACY GPS (don't use network-based location)
          // Network-based location is less accurate and won't give exact landmarks
          setTimeout(() => {
            startWatch({
              enableHighAccuracy: true,
              // Keep using GPS (not network-based)
              timeout: 20000,
              // 20 seconds timeout (give GPS more time)
              maximumAge: 0 // Always get fresh GPS location
            });
          }, 3000); // 3 second delay before retry
          return;
        }

        // If all retries failed, silently continue - don't set error state for background watch
        // The watch will keep trying in background, user won't notice
        // Only set error for non-timeout errors that are critical
        if (err.code !== 3) {
          setError(err.message);
          setPermissionGranted(false);
        }

        // Don't clear the watch - let it keep trying in background
        // The user might move to a location with better GPS signal
      }, options);
    };

    // Start with HIGH ACCURACY GPS for live location tracking
    // CRITICAL: enableHighAccuracy: true forces GPS (not network-based) for accurate location
    // Network-based location won't give exact landmarks like "Mama Loca Cafe"
    startWatch({
      enableHighAccuracy: true,
      // CRITICAL: Use GPS (not network-based) for accurate location
      timeout: 15000,
      // 15 seconds timeout (gives GPS more time to get accurate fix)
      maximumAge: 0 // Always get fresh GPS location (no cache for live tracking)
    });
  };
  const stopWatchingLocation = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    clearTimeout(updateTimerRef.current);
  };

  /* ===================== INIT ===================== */
  useEffect(() => {
    // Load stored location first for IMMEDIATE display (no loading state)
    const stored = localStorage.getItem("userLocation");
    let shouldForceRefresh = false;
    let hasInitialLocation = false;
    if (stored) {
      try {
        const parsedLocation = JSON.parse(stored);

        // Show cached location immediately (even if incomplete) - better UX
        // We'll refresh in background but user sees something right away
        // BUT: Skip if it's just placeholder values ("Select location" or "Current Location")
        if (parsedLocation && (parsedLocation.latitude || parsedLocation.city) && parsedLocation.formattedAddress !== "Select location" && parsedLocation.city !== "Current Location") {
          setLocation(parsedLocation);
          setPermissionGranted(true);
          setLoading(false); // Set loading to false immediately
          hasInitialLocation = true;
          // Check if we should refresh in background for better address
          const hasCompleteAddress = parsedLocation?.formattedAddress && parsedLocation.formattedAddress !== "Select location" && !parsedLocation.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) && parsedLocation.formattedAddress.split(',').length >= 4;
          if (!hasCompleteAddress) {
            shouldForceRefresh = true;
          }
        } else {
          shouldForceRefresh = true;
        }
      } catch (err) {
        console.error("Failed to parse stored location:", err);
        shouldForceRefresh = true;
      }
    }

    // If no cached location, try DB
    if (!hasInitialLocation) {
      fetchLocationFromDB().then(dbLoc => {
        if (dbLoc && (dbLoc.latitude || dbLoc.city)) {
          setLocation(dbLoc);
          setPermissionGranted(true);
          setLoading(false);
          hasInitialLocation = true;
          // Check if we should refresh for better address
          const hasCompleteAddress = dbLoc?.formattedAddress && dbLoc.formattedAddress !== "Select location" && !dbLoc.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) && dbLoc.formattedAddress.split(',').length >= 4;
          if (!hasCompleteAddress) {
            shouldForceRefresh = true;
          }
        } else {
          // No location found - set loading to false and show fallback
          setLoading(false);
          shouldForceRefresh = true;
        }
      }).catch(() => {
        setLoading(false);
        shouldForceRefresh = true;
      });
    }

    // Always ensure loading is false after initial check
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(currentLoading => {
        if (currentLoading) {
          console.warn("⚠️ Loading timeout - setting loading to false");
          // Only set fallback if we still don't have a location
          setLocation(currentLocation => {
            if (!currentLocation || currentLocation.formattedAddress === "Select location" && !currentLocation.latitude && !currentLocation.city) {
              return {
                city: "Select location",
                address: "Select location",
                formattedAddress: "Select location"
              };
            }
            return currentLocation;
          });
        }
        return false;
      });
    }, 5000); // 5 second safety timeout (increased to allow background fetch to complete)

    // Don't set fallback immediately - wait for background fetch to complete
    // The background fetch will set the location, or we'll use the cached/DB location
    // Only set fallback if we have no location after all attempts

    // Request fresh location in BACKGROUND (non-blocking)
    // CRITICAL FIX: Only auto-request if permission is ALREADY granted
    // This prevents "Requests geolocation permission on page load" warning
    const checkPermissionAndStart = async () => {
      try {
        let permissionGranted = false;
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({
              name: 'geolocation'
            });
            if (result.state === 'granted') {
              permissionGranted = true;
            } else {}
          } catch (permErr) {
            console.warn("⚠️ Permission query failed:", permErr);
          }
        } else {}

        // If permission NOT granted, and we don't have a specific user request (this is page load),
        // we should SKIP automatic fetching/watching to allow the user to choose when to enable it.
        // UNLESS we already have a valid initial location from localStorage/DB, in which case we might want to refresh?
        // Actually, even then, we shouldn't prompt.
        if (!permissionGranted) {
          // If we have an initial location, we are fine (it's displayed).
          // If we don't, we show "Select Location".
          // In either case, we avoid the PROMPT.
          // Ensure loading is false so UI doesn't hang
          setLoading(false);
          return;
        }
        // Always fetch fresh location if we don't have a valid one
        // Check current location state to see if it's a placeholder
        const currentLocation = location;
        const hasPlaceholder = currentLocation && (currentLocation.formattedAddress === "Select location" || currentLocation.city === "Current Location");
        const shouldFetch = shouldForceRefresh || !hasInitialLocation || hasPlaceholder;
        if (shouldFetch) {
          getLocation(true, shouldForceRefresh) // forceFresh = true if cached location is incomplete
          .then(location => {
            if (location && location.formattedAddress !== "Select location" && location.city !== "Current Location") {
              // CRITICAL: Update state with fresh location so PageNavbar displays it
              setLocation(location);
              setPermissionGranted(true);
              // Start watching for live updates
              startWatchingLocation();
            } else {
              console.warn("⚠️ Location fetch returned placeholder, retrying...");
              // Retry after 2 seconds if we got placeholder
              setTimeout(() => {
                getLocation(true, true).then(retryLocation => {
                  if (retryLocation && retryLocation.formattedAddress !== "Select location" && retryLocation.city !== "Current Location") {
                    setLocation(retryLocation);
                    setPermissionGranted(true);
                    startWatchingLocation();
                  }
                }).catch(() => {
                  startWatchingLocation();
                });
              }, 2000);
            }
          }).catch(err => {
            console.warn("⚠️ Background location fetch failed (using cached):", err.message);
            // Still start watching in case permission is granted later
            startWatchingLocation();
          });
        } else {
          // We have a valid location, just start watching
          startWatchingLocation();
        }
      } catch (err) {
        console.error("Error in checkPermissionAndStart:", err);
        setLoading(false);
      }
    };

    // Only check permissions/start watching if we already have a saved location
    // This avoids "Requests geolocation permission on page load" warnings on fresh visits
    // New users must explicitly click "Use Current Location" first
    const hasStoredLocation = localStorage.getItem("userLocation");
    if (hasStoredLocation) {
      checkPermissionAndStart();
    } else {
      setLoading(false);
    }

    // Cleanup timeout and watcher
    return () => {
      clearTimeout(loadingTimeout);
      stopWatchingLocation();
    };
    return () => {
      stopWatchingLocation();
    };
  }, []);
  const requestLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      // Clear cached location to force fresh fetch
      localStorage.removeItem("userLocation");
      // Show loading, so pass showLoading = true
      // forceFresh = true, updateDB = true, showLoading = true
      // This ensures we get fresh GPS coordinates and reverse geocode with Google Maps
      const location = await getLocation(true, true, true);
      // Verify we got complete address (POI, building, floor, area, city, state, pincode)
      if (!location?.formattedAddress || location.formattedAddress === "Select location" || location.formattedAddress.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/) || location.formattedAddress.split(',').length < 4) {
        console.warn("⚠️⚠️⚠️ Location received but address is incomplete!");
        console.warn("⚠️ Address parts count:", location?.formattedAddress?.split(',').length || 0);
        console.warn("⚠️ This might be due to:");
        console.warn("   1. Google Maps API not enabled or billing not set up");
        console.warn("   2. Location permission not granted");
        console.warn("   3. GPS accuracy too low (try on mobile device)");
      } else {}

      // Restart watching for live updates
      startWatchingLocation();
      return location;
    } catch (err) {
      console.error("❌ Failed to request location:", err);
      setError(err.message || "Failed to get location");
      // Still try to start watching in case it works
      startWatchingLocation();
      throw err;
    } finally {
      setLoading(false);
    }
  };
  return {
    location,
    loading,
    error,
    permissionGranted,
    requestLocation,
    startWatchingLocation,
    stopWatchingLocation
  };
}
