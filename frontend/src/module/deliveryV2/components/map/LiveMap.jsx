import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleMap, 
  MarkerF, 
  Polygon,
  Polyline,
  useJsApiLoader,
  OverlayView,
  OverlayViewF
} from '@react-google-maps/api';
import { useDeliveryStore } from '@/module/deliveryV2/store/useDeliveryStore';
import { zoneAPI } from '@food/api';
import bikeLogo from '@/module/delivery/assets/bikelogo.png';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  inset: 0
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
  ]
};
const LIBRARIES = ['places', 'geometry'];

export const LiveMap = ({ onMapClick, onMapLoad, onPathReceived, onPolylineReceived, zoom = 12 }) => {
  const { riderLocation, activeOrder, tripStatus } = useDeliveryStore();
  const ROUTE_DEBUG = true;

  const parsePoint = useCallback((raw) => {
    if (!raw) return null;
    if (Array.isArray(raw?.coordinates) && raw.coordinates.length >= 2) {
      const lng = parseFloat(raw.coordinates[0]);
      const lat = parseFloat(raw.coordinates[1]);
      return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
    }
    const lat = parseFloat(raw.lat ?? raw.latitude);
    const lng = parseFloat(raw.lng ?? raw.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }, []);

  const resolveOrderLocation = useCallback((order, phase) => {
    if (!order) return null;

    const isPickupPhase = phase === 'PICKING_UP' || phase === 'REACHED_PICKUP';
    const candidateSources = isPickupPhase
      ? [
          order.restaurantLocation,
          order.restaurant_location,
          order.restaurantId?.location,
          order.restaurantId,
          order.restaurant?.location,
          order.restaurant,
          { lat: order.restaurant_lat ?? order.restaurantLat, lng: order.restaurant_lng ?? order.restaurantLng },
        ]
      : [
          order.customerLocation,
          order.customer_location,
          order.deliveryAddress?.location,
          order.deliveryAddress,
          order.customer?.location,
          order.customer,
          { lat: order.customer_lat ?? order.customerLat, lng: order.customer_lng ?? order.customerLng },
        ];

    for (const source of candidateSources) {
      const parsed = parsePoint(source);
      if (parsed) return parsed;
    }
    return null;
  }, [parsePoint]);
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  const [directions, setDirections] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [map, setMapInternal] = useState(null);
  const [zones, setZones] = useState([]);
  const [lastDirectionsAt, setLastDirectionsAt] = useState(0);
  const lastRouteAttemptRef = useRef(0);
  const routeRequestInFlightRef = useRef(false);

  const handleMapLoad = (mapInstance) => {
    mapInstance.setOptions({
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false
    });
    setMapInternal(mapInstance);
    if (ROUTE_DEBUG) console.log('[LiveMap][MapLoad] ready', { zoom, tripStatus });
    if (onMapLoad) onMapLoad(mapInstance);
  };

  useEffect(() => {
    if (!activeOrder || tripStatus === 'COMPLETED' || tripStatus === 'IDLE') {
      setLastDirectionsAt(0);
      setDirections(null);
      setRoutePath([]);
    }
  }, [tripStatus, activeOrder?._id, activeOrder]);

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    if (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') {
      return resolveOrderLocation(activeOrder, 'PICKING_UP');
    }
    if (tripStatus === 'PICKED_UP' || tripStatus === 'DELIVERING' || tripStatus === 'REACHED_DROP') {
      return resolveOrderLocation(activeOrder, 'PICKED_UP');
    }
    return null;
  }, [activeOrder, tripStatus, resolveOrderLocation]);

  const parsedRiderLocation = useMemo(() => {
    if (!riderLocation) return null;
    const lat = parseFloat(riderLocation.lat || riderLocation.latitude);
    const lng = parseFloat(riderLocation.lng || riderLocation.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng, heading: parseFloat(riderLocation.heading || 0) } : null;
  }, [riderLocation]);

  useEffect(() => { if (map) map.setZoom(zoom); }, [zoom, map]);

  useEffect(() => {
    if (!ROUTE_DEBUG) return;
    if (!isLoaded) {
      console.warn('[LiveMap][Reason] Google map script not loaded yet');
    }
    if (!activeOrder) {
      console.warn('[LiveMap][Reason] No activeOrder present');
    }
    if (activeOrder && !targetLocation) {
      console.warn('[LiveMap][Reason] targetLocation missing for current tripStatus', {
        tripStatus,
        hasRestaurantLocation: Boolean(activeOrder?.restaurantLocation),
        hasRestaurantLocationSnake: Boolean(activeOrder?.restaurant_location),
        hasCustomerLocation: Boolean(activeOrder?.customerLocation),
        hasCustomerLocationSnake: Boolean(activeOrder?.customer_location),
        hasRestaurantIdLocation: Boolean(activeOrder?.restaurantId?.location),
        hasDeliveryAddressLocation: Boolean(activeOrder?.deliveryAddress?.location),
      });
    }
    if (!parsedRiderLocation) {
      console.warn('[LiveMap][Reason] riderLocation missing/invalid');
    }
    if (!window?.google) {
      console.warn('[LiveMap][Reason] window.google unavailable');
    }
    console.log('[LiveMap][State]', {
      isLoaded,
      hasMap: Boolean(map),
      tripStatus,
      riderLocation: parsedRiderLocation,
      targetLocation,
      hasDirections: Boolean(directions),
      lastDirectionsAt,
    });
  }, [isLoaded, map, tripStatus, parsedRiderLocation, targetLocation, directions, lastDirectionsAt]);

  useEffect(() => {
    if (directions && onPathReceived) {
      const path = directions.routes[0]?.overview_path;
      if (path) {
        const simplePath = path.map(p => ({
          lat: typeof p.lat === 'function' ? p.lat() : (p.lat || p.latitude),
          lng: typeof p.lng === 'function' ? p.lng() : (p.lng || p.longitude)
        }));
        onPathReceived(simplePath);
      }
    }
  }, [directions, onPathReceived]);

  useEffect(() => {
    if (!isLoaded || !window.google || !parsedRiderLocation || !targetLocation) return;
    if (tripStatus === 'IDLE' || tripStatus === 'COMPLETED') return;

    const now = Date.now();
    const timeSinceAttempt = now - lastRouteAttemptRef.current;
    if (timeSinceAttempt < 8000) return;
    if (routeRequestInFlightRef.current) return;
    if (directions && now - lastDirectionsAt < 15000) return;

    lastRouteAttemptRef.current = now;
    routeRequestInFlightRef.current = true;
    if (ROUTE_DEBUG) {
      console.log('[LiveMap][Fallback route request]', {
        origin: parsedRiderLocation,
        destination: targetLocation,
        tripStatus,
      });
    }
    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: parsedRiderLocation,
        destination: targetLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        routeRequestInFlightRef.current = false;
        if (status === 'OK' && result) {
          setDirections(result);
          setLastDirectionsAt(Date.now());
          const overviewPath = result.routes?.[0]?.overview_path || [];
          const normalizedPath = overviewPath.map((p) => ({
            lat: typeof p.lat === 'function' ? p.lat() : Number(p.lat),
            lng: typeof p.lng === 'function' ? p.lng() : Number(p.lng),
          }));
          if (normalizedPath.length > 1) {
            setRoutePath(normalizedPath);
            if (onPathReceived) onPathReceived(normalizedPath);
          }
          const encodedPolyline = result.routes[0]?.overview_polyline;
          if (encodedPolyline && onPolylineReceived) onPolylineReceived(encodedPolyline);
          if (ROUTE_DEBUG) console.log('[LiveMap][Fallback route success]');
          return;
        }
        setDirections(null);
        setRoutePath([parsedRiderLocation, targetLocation]);
        if (onPathReceived) onPathReceived([parsedRiderLocation, targetLocation]);
        console.error('[LiveMap][Route fallback: straight line]', { status, origin: parsedRiderLocation, destination: targetLocation });
        if (ROUTE_DEBUG) console.warn('[LiveMap][Fallback route failed]', { status });
      }
    );
  }, [isLoaded, parsedRiderLocation, targetLocation, tripStatus, directions, lastDirectionsAt, onPolylineReceived, onPathReceived, ROUTE_DEBUG]);

  useEffect(() => {
    (async () => {
      try {
        const response = await zoneAPI.getPublicZones();
        if (response?.data?.success && response.data.data?.zones) {
          const formattedZones = response.data.data.zones.map(zone => ({
            ...zone,
            paths: (zone.coordinates || []).map(coord => ({ lat: coord.latitude, lng: coord.longitude }))
          })).filter(z => z.paths.length >= 3);
          setZones(formattedZones);
        }
      } catch (err) {}
    })();
  }, []);

  const restaurantMarkerUrl = useMemo(() => {
    if (!activeOrder) return 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
    return activeOrder.restaurantImage || activeOrder.restaurant?.logo || activeOrder.restaurant?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
  }, [activeOrder]);

  const customerMarkerUrl = useMemo(() => {
    if (!activeOrder) return 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
    return activeOrder.customerImage || activeOrder.user?.logo || activeOrder.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
  }, [activeOrder]);

  const lastCenteredPosRef = useRef(null);
  useEffect(() => {
    if (map && parsedRiderLocation) {
      if (!lastCenteredPosRef.current) {
        map.panTo(parsedRiderLocation);
        lastCenteredPosRef.current = parsedRiderLocation;
        return;
      }
      const dist = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng),
        new window.google.maps.LatLng(lastCenteredPosRef.current.lat, lastCenteredPosRef.current.lng)
      );
      if (dist > 30) {
        map.panTo(parsedRiderLocation);
        lastCenteredPosRef.current = parsedRiderLocation;
      }
    }
  }, [map, parsedRiderLocation]);

  const remainingPath = useMemo(() => {
    if (!parsedRiderLocation) return [];
    const fullPath = routePath;
    if (!Array.isArray(fullPath) || fullPath.length < 2) return [];
    // If geometry library is unavailable, render the full path directly.
    if (!window.google?.maps?.geometry?.spherical) {
      return fullPath;
    }
    let closestIndex = 0;
    let minDist = Infinity;
    const rPos = new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng);
    for (let i = 0; i < fullPath.length; i++) {
       const p = fullPath[i];
       if (!Number.isFinite(Number(p?.lat)) || !Number.isFinite(Number(p?.lng))) continue;
       const d = window.google.maps.geometry.spherical.computeDistanceBetween(
         rPos,
         new window.google.maps.LatLng(Number(p.lat), Number(p.lng))
       );
       if (d < minDist) { minDist = d; closestIndex = i; }
    }
    return [{ lat: parsedRiderLocation.lat, lng: parsedRiderLocation.lng }, ...fullPath.slice(closestIndex + 1)];
  }, [routePath, parsedRiderLocation]);

  useEffect(() => {
    if (!ROUTE_DEBUG) return;
    console.log('[LiveMap][RenderDebug]', {
      tripStatus,
      routePathPoints: Array.isArray(routePath) ? routePath.length : 0,
      remainingPathPoints: Array.isArray(remainingPath) ? remainingPath.length : 0,
      hasGeometryLib: Boolean(window.google?.maps?.geometry?.spherical),
      hasRider: Boolean(parsedRiderLocation),
      hasTarget: Boolean(targetLocation),
    });
  }, [routePath, remainingPath, tripStatus, parsedRiderLocation, targetLocation, ROUTE_DEBUG]);

  if (loadError) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-red-500 font-bold">Map Load Error</div>;
  if (!isLoaded) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (ROUTE_DEBUG && !(parsedRiderLocation && targetLocation)) {
    console.warn('[LiveMap][Reason] directionsServiceOptions unavailable', {
      hasOrigin: Boolean(parsedRiderLocation),
      hasDestination: Boolean(targetLocation),
      tripStatus,
    });
  }
  const mapCenter = parsedRiderLocation || targetLocation || { lat: 22.7196, lng: 75.8577 };
  const shouldRenderRoute = Boolean(activeOrder) && !['IDLE', 'COMPLETED'].includes(tripStatus);

  return (
    <div className="absolute inset-0 z-0 text-gray-900 overflow-hidden flex flex-col">
      <GoogleMap
        onLoad={handleMapLoad}
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={14}
        onClick={(e) => onMapClick?.(e.latLng.lat(), e.latLng.lng())}
        options={mapOptions}
      >
        {shouldRenderRoute && remainingPath.length > 0 && (
          <Polyline path={remainingPath} options={{ strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 6, zIndex: 10 }} />
        )}

        {shouldRenderRoute && directions && (
          <Polyline path={directions.routes[0].overview_path} options={{ strokeColor: '#94a3b8', strokeOpacity: 0, strokeWeight: 4, zIndex: 1, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.3, scale: 3, strokeWeight: 4, strokeColor: '#64748b' }, offset: '0', repeat: '15px' }] }} />
        )}

        {parsedRiderLocation && (
          <OverlayViewF
            position={parsedRiderLocation}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(width, height) => ({
              x: -(width / 2),
              y: -(height / 2),
            })}
          >
            <div
              style={{
                transform: `rotate(${parsedRiderLocation.heading || 0}deg)`,
                transition: 'transform 0.5s linear'
              }}
              className="relative w-[72px] h-[72px]"
            >
              <img
                src="/MapRider.png"
                alt="Rider"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = bikeLogo;
                }}
              />
            </div>
          </OverlayViewF>
        )}

        {targetLocation && (
          <MarkerF position={targetLocation} icon={{ url: (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') ? restaurantMarkerUrl : customerMarkerUrl, scaledSize: new window.google.maps.Size(44, 44), anchor: new window.google.maps.Point(22, 22) }} />
        )}

        {zones.map((zone) => (
          <Polygon key={zone._id} paths={zone.paths} options={{ fillColor: "#22c55e", fillOpacity: 0.1, strokeColor: "#22c55e", strokeOpacity: 0.4, strokeWeight: 2, zIndex: 1 }} />
        ))}
      </GoogleMap>
    </div>
  );
};

export default LiveMap;
