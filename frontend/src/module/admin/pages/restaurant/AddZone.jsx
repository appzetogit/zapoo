import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, ArrowLeft, Save, X, Hand, Shapes, Search } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { getGoogleMapsApiKey } from "@/lib/utils/googleMapsApiKey";

const MIN_POINTS = 3;

// Order points by angle around their centroid so polygon edges never self-intersect,
// while KEEPING every clicked point (unlike a convex hull).
const orderPointsRadially = (pts) => {
  const points = pts
    .map(p => ({
      lat: typeof p.lat === 'function' ? p.lat() : p.lat,
      lng: typeof p.lng === 'function' ? p.lng() : p.lng,
    }))
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

  if (points.length < 3) return points;

  const cx = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lat, 0) / points.length;

  return [...points].sort((a, b) =>
    Math.atan2(a.lat - cy, a.lng - cx) - Math.atan2(b.lat - cy, b.lng - cx)
  );
};

// Helper: poll a predicate up to timeoutMs
const waitFor = async (predicate, timeoutMs = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return predicate();
};

export default function AddZone() {
  const navigate = useNavigate();
  const {
    id
  } = useParams();
  const isEditMode = !!id && !window.location.pathname.includes('/view/');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonRef = useRef(null);
  const pathMarkersRef = useRef([]);
  const mapClickListenerRef = useRef(null);
  const drawPointsRef = useRef([]);   // raw clicked LatLngs
  const isDrawingRef = useRef(false);  // ref for click closure
  const existingZonesPolygonsRef = useRef([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [mapLoading, setMapLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    country: "India",
    zoneName: "",
    unit: "kilometer",
    deliveryPricing: {
      baseFee: 0,
      freeDeliveryThreshold: 0,
      isOverridden: false
    }
  });
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [existingZones, setExistingZones] = useState([]);
  const autocompleteInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    fetchExistingZones();
    loadGoogleMaps();
    if (isEditMode && id) {
      fetchZone();
    }
  }, [id, isEditMode]);

  // Center map on India when country is selected
  useEffect(() => {
    if (formData.country === "India" && mapInstanceRef.current && (!isEditMode || coordinates.length < 3)) {
      const indiaCenter = {
        lat: 20.5937,
        lng: 78.9629
      };
      mapInstanceRef.current.setCenter(indiaCenter);
      mapInstanceRef.current.setZoom(5);
    }
  }, [formData.country, isEditMode, coordinates.length]);

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
          mapInstanceRef.current.setCenter(location);
          mapInstanceRef.current.setZoom(15); // Zoom in when location is selected

          // Set the search input value
          setLocationSearch(place.formatted_address || place.name || "");
        }
      });
      autocompleteRef.current = autocomplete;
    }
  }, [mapLoading]);

  // Draw existing polygon when in edit mode and coordinates are loaded
  useEffect(() => {
    if (isEditMode && !isDrawing && coordinates.length >= 3 && mapInstanceRef.current && window.google && !mapLoading) {
      if (polygonRef.current) return; // Already rendered, don't recreate on user edits!
      setTimeout(() => {
        if (mapInstanceRef.current && window.google && !polygonRef.current) {
          // Ensure drawing mode is off when editing existing polygon
          isDrawingRef.current = false;
          setIsDrawing(false);
          drawEditablePolygon(window.google, mapInstanceRef.current, coordinates);

          // Fit map boundaries to the polygon coordinates
          const bounds = new window.google.maps.LatLngBounds();
          coordinates.forEach(c => {
            bounds.extend(new window.google.maps.LatLng(c.latitude || c.lat, c.longitude || c.lng));
          });
          mapInstanceRef.current.fitBounds(bounds);
        }
      }, 500);
    }
  }, [isEditMode, isDrawing, coordinates.length, mapLoading]);

  // Cleanup map click listener on unmount
  useEffect(() => {
    return () => {
      if (mapClickListenerRef.current && window.google) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
      }
    };
  }, []);

  const fetchExistingZones = async () => {
    try {
      const response = await adminAPI.getZones({
        limit: 1000
      });
      if (response.data?.success && response.data.data?.zones) {
        // Filter out the current zone if in edit mode
        const zones = isEditMode && id ? response.data.data.zones.filter(zone => zone._id !== id) : response.data.data.zones;
        setExistingZones(zones);
      }
    } catch (error) {
      console.error("Error fetching existing zones:", error);
      setExistingZones([]);
    }
  };

  const fetchZone = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getZoneById(id);
      if (response.data?.success && response.data.data?.zone) {
        const zoneData = response.data.data.zone;
        setFormData({
          country: zoneData.country || "India",
          zoneName: zoneData.name || zoneData.zoneName || "",
          unit: zoneData.unit || "kilometer",
          deliveryPricing: {
            baseFee: zoneData.deliveryPricing?.baseFee || 0,
            freeDeliveryThreshold: zoneData.deliveryPricing?.freeDeliveryThreshold || 0,
            isOverridden: zoneData.deliveryPricing?.isOverridden || false
          }
        });
        if (zoneData.coordinates && zoneData.coordinates.length > 0) {
          setCoordinates(zoneData.coordinates);
        }
      }
    } catch (error) {
      console.error("Error fetching zone:", error);
      alert("Failed to load zone");
      navigate("/admin/zone-setup");
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleMaps = async () => {
    try {
      const apiKey = await getGoogleMapsApiKey();
      setGoogleMapsApiKey(apiKey || "loaded");

      const existingScript = Array.from(document.getElementsByTagName("script"))
        .find(s => s.src?.includes("maps.googleapis.com/maps/api/js"));

      if (!window.google?.maps && !existingScript) {
        if (apiKey) {
          await new Promise((resolve) => {
            const script = document.createElement("script");
            script.id = "google-maps-sdk";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
          });
        } else {
          setMapLoading(false);
          return;
        }
      }

      // Wait for google.maps to be ready
      const ready = await waitFor(() => !!window.google?.maps);
      if (!ready) {
        setMapLoading(false);
        return;
      }

      initializeMap(window.google);
    } catch (error) {
      console.error("Error loading Google Maps:", error);
      setMapLoading(false);
    }
  };

  const initializeMap = google => {
    if (!mapRef.current) return;

    // Initial location (India center)
    const initialLocation = {
      lat: 20.5937,
      lng: 78.9629
    };

    // Create map
    const map = new google.maps.Map(mapRef.current, {
      center: initialLocation,
      zoom: 5,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle?.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
        mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scrollwheel: true,
      gestureHandling: 'greedy',
      disableDoubleClickZoom: false,
      clickableIcons: false, // POI labels must NOT capture clicks while drawing
    });
    mapInstanceRef.current = map;

    // Map click listener (add a vertex per click)
    mapClickListenerRef.current = google.maps.event.addListener(map, 'click', (event) => {
      if (!isDrawingRef.current) return;
      // If we have an existing polygon and are just editing it, do NOT add new clicked points
      if (polygonRef.current && drawPointsRef.current.length === 0) {
        return;
      }
      drawPointsRef.current.push(event.latLng);
      renderDrawingPolygon(google, map);
    });

    setMapLoading(false);

    // If in edit mode and coordinates are already loaded, draw the polygon
    if (isEditMode && coordinates.length >= 3) {
      setTimeout(() => {
        if (mapInstanceRef.current && window.google) {
          isDrawingRef.current = false;
          setIsDrawing(false);
          drawEditablePolygon(window.google, mapInstanceRef.current, coordinates);
        }
      }, 500); // Small delay to ensure map is fully loaded
    }
  };

  // Draw existing zones on the map
  const drawExistingZonesOnMap = (google, map) => {
    if (!existingZones || existingZones.length === 0) return;

    // Clear previous existing zone polygons
    existingZonesPolygonsRef.current.forEach(polygon => {
      if (polygon) polygon.setMap(null);
    });
    existingZonesPolygonsRef.current = [];
    existingZones.forEach((zone) => {
      if (!zone.coordinates || zone.coordinates.length < 3) return;

      // Convert coordinates to LatLng array
      const path = zone.coordinates.map(coord => {
        const lat = typeof coord === 'object' ? coord.latitude || coord.lat : null;
        const lng = typeof coord === 'object' ? coord.longitude || coord.lng : null;
        if (lat === null || lng === null) return null;
        return new google.maps.LatLng(lat, lng);
      }).filter(Boolean);
      if (path.length < 3) return;

      // Create polygon for existing zone with different color (gray/blue)
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

      // Add info window on click
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

  // Redraw existing zones when zones data changes or map is ready
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && existingZones.length > 0 && window.google) {
      drawExistingZonesOnMap(window.google, mapInstanceRef.current);
    }
  }, [existingZones, mapLoading]);

  const renderVertexMarkers = (google, map, latLngs) => {
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = latLngs.map((latLng, i) => {
      const isFirst = i === 0 && latLngs.length >= 3;
      const marker = new google.maps.Marker({
        position: latLng,
        map,
        clickable: true,
        draggable: true, // Allow dragging markers during drawing mode
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFirst ? 10 : 8,
          fillColor: isFirst ? "#10b981" : "#9333ea", // green for first point to indicate closure
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        },
        zIndex: 1000,
        title: isFirst ? "Click to finish drawing, or drag to adjust" : `Point ${i + 1} (drag to adjust)`,
      });

      // Update the drawing polygon path dynamically as markers are dragged
      google.maps.event.addListener(marker, 'drag', () => {
        const newPos = marker.getPosition();
        drawPointsRef.current[i] = newPos;
        
        if (polygonRef.current) {
          const ordered = drawPointsRef.current.length >= 3
            ? orderPointsRadially(drawPointsRef.current)
            : drawPointsRef.current.map(p => ({ lat: p.lat(), lng: p.lng() }));
          polygonRef.current.setPath(ordered);
        }
      });

      // Update the coordinates state on drag end to sync state changes
      google.maps.event.addListener(marker, 'dragend', () => {
        const ordered = drawPointsRef.current.length >= 3
          ? orderPointsRadially(drawPointsRef.current)
          : drawPointsRef.current.map(p => ({ lat: p.lat(), lng: p.lng() }));
        setCoordinates(ordered.map(p => ({
          latitude: parseFloat(p.lat.toFixed(6)),
          longitude: parseFloat(p.lng.toFixed(6)),
        })));
      });

      if (isFirst) {
        google.maps.event.addListener(marker, 'click', () => {
          toggleDrawingMode();
        });
      }
      return marker;
    });
  };

  const renderDrawingPolygon = (google, map) => {
    const points = drawPointsRef.current;
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    const ordered = points.length >= 3
      ? orderPointsRadially(points)
      : points.map(p => ({ lat: p.lat(), lng: p.lng() }));

    if (ordered.length >= 2) {
      polygonRef.current = new google.maps.Polygon({
        paths: ordered,
        fillColor: "#9333ea",
        fillOpacity: 0.35,
        strokeColor: "#9333ea",
        strokeWeight: 2,
        clickable: false,
        editable: false,
        zIndex: 1,
      });
      polygonRef.current.setMap(map);
    }

    renderVertexMarkers(google, map, points);
    setCoordinates(ordered.map(p => ({
      latitude: parseFloat(p.lat.toFixed(6)),
      longitude: parseFloat(p.lng.toFixed(6)),
    })));
  };

  const finishDrawing = () => {
    const google = window.google, map = mapInstanceRef.current;
    if (!google || !map) return;

    const points = drawPointsRef.current;
    if (points.length < MIN_POINTS) {
      alert(`Please click at least ${MIN_POINTS} points on the map.`);
      return false;
    }

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = [];

    const ordered = orderPointsRadially(points);
    const coords = ordered.map(p => ({
      latitude: parseFloat(p.lat.toFixed(6)),
      longitude: parseFloat(p.lng.toFixed(6)),
    }));
    setCoordinates(coords);
    drawEditablePolygon(google, map, coords); // creates editable polygon + path listeners, NO markers
    return true;
  };

  // Editable polygon. On vertex drag/add/remove, sync coordinates from the path.
  const drawEditablePolygon = (google, map, coords) => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = [];

    const path = coords.map(c => new google.maps.LatLng(c.latitude || c.lat, c.longitude || c.lng));
    const polygon = new google.maps.Polygon({
      paths: path,
      strokeColor: "#9333ea",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: "#9333ea",
      fillOpacity: 0.35,
      editable: isDrawingRef.current, // Only editable when drawing/editing mode is active
      draggable: false,
      clickable: isDrawingRef.current, // Only clickable when drawing/editing mode is active
    });
    polygon.setMap(map);
    polygonRef.current = polygon;

    const sync = () => {
      const p = polygon.getPath();
      const out = [];
      p.forEach(ll => out.push({ latitude: parseFloat(ll.lat().toFixed(6)), longitude: parseFloat(ll.lng().toFixed(6)) }));
      setCoordinates(out);
    };
    const pp = polygon.getPath();
    google.maps.event.addListener(pp, 'set_at', sync);
    google.maps.event.addListener(pp, 'insert_at', sync);
    google.maps.event.addListener(pp, 'remove_at', sync);

    // Right-click a vertex to delete it
    google.maps.event.addListener(polygon, 'rightclick', (mev) => {
      if (mev.vertex !== undefined) {
        const pPath = polygon.getPath();
        if (pPath.getLength() > 3) {
          pPath.removeAt(mev.vertex);
        } else {
          alert("A polygon must have at least 3 points.");
        }
      }
    });
  };

  const toggleDrawingMode = () => {
    const google = window.google, map = mapInstanceRef.current;
    if (!google || !map) {
      alert("Map is still loading.");
      return;
    }

    if (isDrawingRef.current) {                       // FINISH
      // If they were drawing from scratch (clicking points on the map)
      if (drawPointsRef.current.length > 0) {
        if (finishDrawing() === false) return; // not enough points → stay in drawing mode
      }
      
      // Make the final polygon static (non-editable, non-clickable)
      if (polygonRef.current) {
        polygonRef.current.setOptions({ editable: false, clickable: false });
      }

      isDrawingRef.current = false;
      setIsDrawing(false);
      map.setOptions({ draggableCursor: null });
      existingZonesPolygonsRef.current.forEach(p => p?.setOptions?.({ clickable: true }));
    } else {                               // START
      if (polygonRef.current) {
        // Edit existing polygon
        polygonRef.current.setOptions({ editable: true, clickable: true });
        isDrawingRef.current = true;
        setIsDrawing(true);
      } else {
        // Start drawing a new polygon from scratch
        clearDrawing();
        drawPointsRef.current = [];
        isDrawingRef.current = true;
        setIsDrawing(true);
        map.setOptions({ draggableCursor: 'crosshair' });
      }
      // make other zones non-clickable so taps over them add points, not open info windows
      existingZonesPolygonsRef.current.forEach(p => p?.setOptions?.({ clickable: false }));
    }
  };

  const clearDrawing = () => {
    drawPointsRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    pathMarkersRef.current?.forEach(m => m.setMap(null));
    pathMarkersRef.current = [];
    setCoordinates([]);
  };
  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };
  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.zoneName) {
      alert("Please enter a zone name");
      return;
    }
    if (!formData.country) {
      alert("Please select a country");
      return;
    }
    if (coordinates.length < 3) {
      alert("Please draw at least 3 points on the map to create a zone");
      return;
    }
    try {
      setLoading(true);

      // Validate coordinates format
      if (!coordinates || coordinates.length < 3) {
        alert("Please draw at least 3 points on the map");
        setLoading(false);
        return;
      }

      // Ensure coordinates have correct format
      const validCoordinates = coordinates.map(coord => {
        if (typeof coord === 'object' && coord.latitude !== undefined && coord.longitude !== undefined) {
          return {
            latitude: parseFloat(coord.latitude),
            longitude: parseFloat(coord.longitude)
          };
        }
        return coord;
      });
      const zoneData = {
        name: formData.zoneName,
        zoneName: formData.zoneName,
        country: formData.country,
        unit: formData.unit || "kilometer",
        coordinates: validCoordinates,
        isActive: true,
        deliveryPricing: {
          ...formData.deliveryPricing,
          baseFee: Number(formData.deliveryPricing.baseFee) || 0,
          freeDeliveryThreshold: Number(formData.deliveryPricing.freeDeliveryThreshold) || 0
        }
      };
      if (isEditMode && id) {
        // Update existing zone
        await adminAPI.updateZone(id, zoneData);
        alert("Zone updated successfully!");
      } else {
        // Create new zone
        await adminAPI.createZone(zoneData);
        alert("Zone created successfully!");
      }
      navigate("/admin/zone-setup");
    } catch (error) {
      console.error("Error creating zone:", error);

      // Handle different types of errors
      let errorMessage = "Failed to create zone. Please try again.";
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
        // Network error - backend not running or CORS issue
        errorMessage = "Cannot connect to server. Please make sure the backend server is running.";
        console.error("Network error: Backend server might not be running");
      } else if (error.response) {
        // API error with response
        errorMessage = error.response.data?.message || error.response.data?.error || error.message || `Server error: ${error.response.status}`;
        console.error("API error:", error.response.data);
        console.error("Error status:", error.response.status);
      } else {
        // Other errors
        errorMessage = error.message || errorMessage;
      }
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-slate-50">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate("/admin/zone-setup")} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {isEditMode ? "Edit Zone" : "Add New Zone"}
              </h1>
              <p className="text-sm text-slate-600">
                {isEditMode ? "Update delivery zone for customer" : "Create a delivery zone for customer"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Form */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Zone Details</h2>

                <div className="space-y-4">
                  {/* Country Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <select value={formData.country} onChange={e => handleInputChange("country", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                      <option value="India">India</option>
                    </select>
                  </div>

                  {/* Zone Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Create Zone name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={formData.zoneName} onChange={e => handleInputChange("zoneName", e.target.value)} placeholder="Enter zone name" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>

                  {/* Select Unit */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Select Unit <span className="text-red-500">*</span>
                    </label>
                    <select value={formData.unit} onChange={e => handleInputChange("unit", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                      <option value="kilometer">Kilometers (km)</option>
                      <option value="miles">Miles (mi)</option>
                    </select>
                  </div>

                  {/* Delivery Pricing Section */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900">Delivery Pricing</h3>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="isOverridden" checked={formData.deliveryPricing.isOverridden} onChange={e => handleInputChange("deliveryPricing.isOverridden", e.target.checked)} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                        <label htmlFor="isOverridden" className="text-sm text-slate-700 font-medium cursor-pointer">
                          Override Tier Pricing
                        </label>
                      </div>
                    </div>

                    <div className={`space-y-4 ${!formData.deliveryPricing.isOverridden ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Base Delivery Fee (₹)
                        </label>
                        <input type="number" min="0" value={formData.deliveryPricing.baseFee} onChange={e => handleInputChange("deliveryPricing.baseFee", e.target.value)} onWheel={e => e.target.blur()} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]" disabled={!formData.deliveryPricing.isOverridden} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Free Delivery Threshold (₹)
                        </label>
                        <input type="number" min="0" value={formData.deliveryPricing.freeDeliveryThreshold} onChange={e => handleInputChange("deliveryPricing.freeDeliveryThreshold", e.target.value)} onWheel={e => e.target.blur()} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]" disabled={!formData.deliveryPricing.isOverridden} />
                      </div>
                      {!formData.deliveryPricing.isOverridden && <p className="text-xs text-slate-500 italic mt-2">
                          * Pricing is inherited from the assigned Tier based on zone area.
                        </p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Map */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Draw Zone on Map</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleDrawingMode} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isDrawing ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    <Shapes className="w-4 h-4" />
                    <span>{isDrawing ? "Finish Drawing" : (coordinates.length >= 3 ? "Edit Zone" : "Start Drawing")}</span>
                  </button>
                  {coordinates.length > 0 && <button type="button" onClick={clearDrawing} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors">
                      <X className="w-4 h-4" />
                      <span>Clear</span>
                    </button>}
                </div>
              </div>

              {isDrawing && (
                <p className="text-xs text-purple-700 font-medium mb-3">
                  {drawPointsRef.current.length > 0 
                    ? "Click on the map to add points (minimum 3 points), then click Finish Drawing."
                    : "Drag the points or the edges of the polygon to adjust the zone, then click Finish Drawing."}
                </p>
              )}

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input ref={autocompleteInputRef} type="text" placeholder="Search location on map..." value={locationSearch} onChange={e => setLocationSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {coordinates.length > 0 && <p className="text-xs text-slate-600 mt-2">
                    Points drawn: <strong>{coordinates.length}</strong>
                    {coordinates.length < 3 && <span className="text-red-600 ml-2">(Minimum 3 points required)</span>}
                  </p>}
              </div>

              <div className="relative" style={{
              height: "600px"
            }}>
                <div ref={mapRef} className="w-full h-full rounded-lg" />

                {mapLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading map...</p>
                    </div>
                  </div>}

                {!googleMapsApiKey && !mapLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="text-center p-6">
                      <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-sm text-slate-600">Google Maps API key not found</p>
                    </div>
                  </div>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => navigate("/admin/zone-setup")} className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || coordinates.length < 3 || !formData.zoneName || !formData.country} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </> : <>
                  <Save className="w-4 h-4" />
                  <span>Save Zone</span>
                </>}
            </button>
          </div>
        </form>
      </div>
    </div>;
}