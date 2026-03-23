import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Save, Loader2, ArrowLeft } from "lucide-react";
import RestaurantNavbar from "../components/RestaurantNavbar";
import { restaurantAPI, zoneAPI } from "@/lib/api";
import { getGoogleMapsApiKey } from "@/lib/utils/googleMapsApiKey";
import { API_BASE_URL } from "@/lib/api/config";
import { Loader } from "@googlemaps/js-api-loader";
import { toast } from "sonner";
export default function ZoneSetup() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const existingZonesPolygonsRef = useRef([]);
  const zonesFetchAttemptedRef = useRef(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [mapLoading, setMapLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [existingZones, setExistingZones] = useState([]);
  useEffect(() => {
    fetchRestaurantData();
    fetchExistingZones();
    loadGoogleMaps();
  }, []);

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        types: ['geocode', 'establishment'],
        componentRestrictions: {
          country: 'in'
        } // Restrict to India
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location;
          const lat = location.lat();
          const lng = location.lng();

          // Center map on selected location
          mapInstanceRef.current.setCenter(location);
          mapInstanceRef.current.setZoom(17); // Zoom in when location is selected

          // Set the search input value
          const address = place.formatted_address || place.name || "";
          setLocationSearch(address);
          setSelectedAddress(address);

          // Update marker position
          updateMarker(lat, lng, address);

          // Set selected location
          setSelectedLocation({
            lat,
            lng,
            address
          });
        }
      });
      autocompleteRef.current = autocomplete;
    }
  }, [mapLoading]);

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location;
      let lat = null;
      let lng = null;

      // Get coordinates from different possible structures
      if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        lng = location.coordinates[0];
        lat = location.coordinates[1];
      } else if (location.latitude && location.longitude) {
        lat = parseFloat(location.latitude);
        lng = parseFloat(location.longitude);
      }
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const locationObj = new window.google.maps.LatLng(lat, lng);
        mapInstanceRef.current.setCenter(locationObj);
        mapInstanceRef.current.setZoom(17);
        const address = location.formattedAddress || location.address || formatAddress(location) || "";
        setLocationSearch(address);
        setSelectedAddress(address);
        setSelectedLocation({
          lat,
          lng,
          address
        });
        updateMarker(lat, lng, address);
      }
    }
  }, [restaurantData, mapLoading]);
  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant();
      const data = response?.data?.data?.restaurant || response?.data?.restaurant;
      if (data) {
        setRestaurantData(data);
      }
    } catch (error) {
      console.error("Error fetching restaurant data:", error);
    }
  };
  const fetchExistingZones = async () => {
    try {
      console.log("[ZoneSetup] Fetching active zones...");
      const response = await zoneAPI.getActiveZones();
      const zonesPayload =
        response?.data?.data?.zones ||
        response?.data?.zones ||
        response?.data?.data ||
        [];
      if (response?.data?.success && Array.isArray(zonesPayload)) {
        setExistingZones(zonesPayload);
        console.log("[ZoneSetup] Active zones loaded:", zonesPayload.length);
      } else {
        console.warn("Zones response missing or invalid:", response?.data);
        setExistingZones([]);
      }
    } catch (error) {
      console.error("Error fetching existing zones:", error);
      setExistingZones([]);

      // Fallback: direct fetch (helps detect axios/baseURL issues)
      try {
        const res = await fetch(`${API_BASE_URL}/zones/active`);
        const data = await res.json();
        const fallbackZones =
          data?.data?.zones || data?.zones || data?.data || [];
        if (data?.success && Array.isArray(fallbackZones)) {
          setExistingZones(fallbackZones);
          console.log("[ZoneSetup] Active zones loaded via fallback:", fallbackZones.length);
        } else {
          console.warn("[ZoneSetup] Fallback zones response invalid:", data);
        }
      } catch (fallbackErr) {
        console.error("[ZoneSetup] Fallback fetch failed:", fallbackErr);
      }
    }
  };
  const loadGoogleMaps = async () => {
    try {
      // Fetch API key from database
      let apiKey = null;
      try {
        apiKey = await getGoogleMapsApiKey();
        if (!apiKey || apiKey.trim() === "") {
          console.error("❌ API key is empty or not found in database");
          setMapLoading(false);
          toast.error("Google Maps API key not found in database. Please contact administrator to add the API key in admin panel.");
          return;
        }
      } catch (apiKeyError) {
        console.error("❌ Error fetching API key from database:", apiKeyError);
        setMapLoading(false);
        toast.error("Failed to fetch Google Maps API key from database. Please check your connection or contact administrator.");
        return;
      }
      setGoogleMapsApiKey(apiKey);

      // Wait for Google Maps to be loaded from main.jsx if it's loading
      let retries = 0;
      const maxRetries = 100; // Wait up to 10 seconds

      while (!window.google && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      // Wait for mapRef to be available (retry mechanism)
      let refRetries = 0;
      const maxRefRetries = 50; // Wait up to 5 seconds for ref
      while (!mapRef.current && refRetries < maxRefRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        refRetries++;
      }
      if (!mapRef.current) {
        console.error("❌ mapRef.current is still null after waiting");
        setMapLoading(false);
        toast.error("Failed to initialize map container. Please refresh the page.");
        return;
      }

      // If Google Maps is already loaded, use it directly
      if (window.google && window.google.maps && window.google.maps.Map) {
        initializeMap(window.google);
        return;
      }

      // If Google Maps is not loaded yet and we have an API key, use Loader as fallback
      if (apiKey) {
        const loader = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["places"]
        });
        const google = await loader.load();
        // Prefer fully ready window.google if available
        let g = window.google?.maps?.Map ? window.google : google;
        // Wait briefly if Map constructor isn't ready yet
        if (!g?.maps?.Map) {
          let tries = 0;
          while ((!window.google?.maps?.Map) && tries < 15) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tries++;
          }
          g = window.google?.maps?.Map ? window.google : g;
        }
        if (!g?.maps?.Map) {
          console.error("❌ Google Maps API loaded but Map constructor missing");
          setMapLoading(false);
          toast.error("Failed to initialize map. Please refresh the page.");
          return;
        }
        initializeMap(g);
      } else {
        console.error("❌ No API key available");
        setMapLoading(false);
        toast.error("Google Maps API key not found. Please contact administrator.");
      }
    } catch (error) {
      console.error("❌ Error loading Google Maps:", error);
      setMapLoading(false);
      toast.error(`Failed to load Google Maps: ${error.message}. Please refresh the page or contact administrator.`);
    }
  };
  const initializeMap = google => {
    try {
      if (!mapRef.current) {
        console.error("❌ mapRef.current is null in initializeMap");
        setMapLoading(false);
        return;
      }
      if (!google?.maps?.Map) {
        console.error("❌ Google Maps API not ready (Map constructor missing)");
        setMapLoading(false);
        toast.error("Failed to initialize map. Please refresh the page.");
        return;
      }
      // Initial location (India center)
      const initialLocation = {
        lat: 20.5937,
        lng: 78.9629
      };

      // Create map
      const mapTypeControlStyle = google.maps.MapTypeControlStyle?.HORIZONTAL_BAR;
      const controlPositionTopRight = google.maps.ControlPosition?.TOP_RIGHT;
      const mapTypeIds = google.maps.MapTypeId
        ? [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        : undefined;

      const map = new google.maps.Map(mapRef.current, {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: mapTypeControlStyle,
          position: controlPositionTopRight,
          ...(mapTypeIds ? { mapTypeIds } : {})
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false
      });
      mapInstanceRef.current = map;
      // Add click listener to place marker
      map.addListener('click', event => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();

        // Reverse geocode to get address
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({
          location: {
            lat,
            lng
          }
        }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            const address = results[0].formatted_address;
            setLocationSearch(address);
            setSelectedAddress(address);
            setSelectedLocation({
              lat,
              lng,
              address
            });
            updateMarker(lat, lng, address);
          } else {
            // If geocoding fails, still allow pinning
            const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setLocationSearch(address);
            setSelectedAddress(address);
            setSelectedLocation({
              lat,
              lng,
              address
            });
            updateMarker(lat, lng, address);
          }
        });
      });
      setMapLoading(false);

      // Retry zone fetch after map is ready (ensures request happens)
      if (!zonesFetchAttemptedRef.current) {
        zonesFetchAttemptedRef.current = true;
        fetchExistingZones();
      }
    } catch (error) {
      console.error("❌ Error in initializeMap:", error);
      setMapLoading(false);
      toast.error("Failed to initialize map. Please refresh the page.");
    }
  };

  // Draw existing zones on the map
  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) return;

    // Clear previous polygons
    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null);
    });
    existingZonesPolygonsRef.current = [];

    existingZones.forEach(zone => {
      const rawCoords =
        (Array.isArray(zone?.coordinates) && zone.coordinates.length > 0)
          ? zone.coordinates
          : (Array.isArray(zone?.boundary?.coordinates?.[0])
              ? zone.boundary.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
              : []);

      if (!rawCoords || rawCoords.length < 3) return;

      const path = rawCoords.map(coord => {
        const rawLat = typeof coord === 'object' ? coord.latitude || coord.lat : null;
        const rawLng = typeof coord === 'object' ? coord.longitude || coord.lng : null;
        const lat = rawLat != null ? parseFloat(rawLat) : NaN;
        const lng = rawLng != null ? parseFloat(rawLng) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return new google.maps.LatLng(lat, lng);
      }).filter(Boolean);

      if (path.length < 3) return;

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        editable: false,
        draggable: false,
        clickable: true,
        zIndex: 0
      });

      polygon.setMap(map);
      existingZonesPolygonsRef.current.push(polygon);

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>${zone.name || zone.zoneName || 'Unnamed Zone'}</strong><br/>
            <small>Country: ${zone.country || 'N/A'}</small>
          </div>
        `
      });

      polygon.addListener('click', () => {
        infoWindow.setPosition(polygon.getPath().getAt(0));
        infoWindow.open(map);
      });
    });
  };

  // Redraw zones when data changes or map is ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current);
    }
  }, [existingZones, mapLoading]);
  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: {
        lat,
        lng
      },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    });

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    });
    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker);
    });

    // Update location when marker is dragged
    marker.addListener('dragend', event => {
      const newLat = event.latLng.lat();
      const newLng = event.latLng.lng();

      // Reverse geocode new position
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({
        location: {
          lat: newLat,
          lng: newLng
        }
      }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const newAddress = results[0].formatted_address;
          setLocationSearch(newAddress);
          setSelectedAddress(newAddress);
          setSelectedLocation({
            lat: newLat,
            lng: newLng,
            address: newAddress
          });
        } else {
          const newAddress = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
          setLocationSearch(newAddress);
          setSelectedAddress(newAddress);
          setSelectedLocation({
            lat: newLat,
            lng: newLng,
            address: newAddress
          });
        }
      });
    });
    markerRef.current = marker;
  };
  const formatAddress = location => {
    if (!location) return "";
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim();
    }
    if (location.address && location.address.trim() !== "") {
      return location.address.trim();
    }
    const parts = [];
    if (location.addressLine1) parts.push(location.addressLine1.trim());
    if (location.addressLine2) parts.push(location.addressLine2.trim());
    if (location.area) parts.push(location.area.trim());
    if (location.city) parts.push(location.city.trim());
    if (location.state) parts.push(location.state.trim());
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim());
    return parts.length > 0 ? parts.join(", ") : "";
  };
  const handleSaveLocation = async () => {
    if (!selectedLocation) {
      toast.error("Please select a location on the map first");
      return;
    }
    try {
      const {
        lat,
        lng,
        address
      } = selectedLocation;
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (!existingZones || existingZones.length === 0) {
        toast.error("No active delivery zones are available. Please contact administrator.");
        return;
      }

      if (!isLocationInAnyZone(latNum, lngNum, existingZones)) {
        toast.error("Selected location is outside all active zones. Please choose a location within a delivery zone.");
        return;
      }

      setSaving(true);

      // Update restaurant location
      const response = await restaurantAPI.updateProfile({
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat],
          // GeoJSON format: [longitude, latitude]
          formattedAddress: address
        }
      });
      if (response?.data?.data?.restaurant) {
        setRestaurantData(response.data.data.restaurant);
        toast.success("Location saved successfully!");
      } else {
        throw new Error("Failed to save location");
      }
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error(error.response?.data?.message || "Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isPointInZone = (lat, lng, zoneCoordinates) => {
    if (!zoneCoordinates || zoneCoordinates.length < 3) return false;
    let inside = false;
    for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
      const coordI = zoneCoordinates[i];
      const coordJ = zoneCoordinates[j];
      const xi = typeof coordI === 'object' ? coordI.latitude || coordI.lat : null;
      const yi = typeof coordI === 'object' ? coordI.longitude || coordI.lng : null;
      const xj = typeof coordJ === 'object' ? coordJ.latitude || coordJ.lat : null;
      const yj = typeof coordJ === 'object' ? coordJ.longitude || coordJ.lng : null;
      if (xi === null || yi === null || xj === null || yj === null) continue;
      const intersect = (yi > lng) !== (yj > lng) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isLocationInAnyZone = (lat, lng, zones) => {
    if (!zones || zones.length === 0) return false;
    return zones.some(zone => isPointInZone(lat, lng, zone.coordinates));
  };
  return <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zone Setup</h1>
              <p className="text-sm text-gray-600">Set your restaurant location on the map</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input ref={autocompleteInputRef} type="text" value={locationSearch} onChange={e => setLocationSearch(e.target.value)} placeholder="Search for your restaurant location..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <button onClick={handleSaveLocation} disabled={!selectedLocation || saving} className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
              {saving ? <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </> : <>
                  <Save className="w-5 h-5" />
                  <span>Save Location</span>
                </>}
            </button>
          </div>
          {selectedLocation && <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong> {selectedAddress}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to set your location:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Search for your location using the search bar above, or</li>
            <li>Click anywhere on the map to place a pin at that location</li>
            <li>You can drag the pin to adjust the exact position</li>
            <li>Click "Save Location" to save your restaurant location</li>
          </ul>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Always render the map div, show loading overlay on top */}
          <div ref={mapRef} className="w-full h-[600px]" style={{
          minHeight: '600px'
        }} />
          {mapLoading && <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-400 mt-2">If this takes too long, please refresh the page</p>
              </div>
            </div>}
        </div>
      </div>
    </div>;
}
