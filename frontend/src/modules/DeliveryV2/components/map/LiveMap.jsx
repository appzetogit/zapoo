import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleMap, 
  Marker, 
  DirectionsService, 
  Polygon,
  Polyline,
  OverlayView
} from '@react-google-maps/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { zoneAPI } from '@food/api';
import { RIDER_BIKE_SVG } from './map.icons';
import bikeLogo from '@/assets/bikelogo.png';

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
const FALLBACK_CENTER = { lat: 22.7196, lng: 75.8577 }; // Indore fallback to avoid gray map on first load

export const LiveMap = ({ onMapClick, onMapLoad, onPathReceived, onPolylineReceived, zoom = 12 }) => {
  const { riderLocation, activeOrder, tripStatus } = useDeliveryStore();
  const [mapsReady, setMapsReady] = useState(
    Boolean(window.google?.maps?.Map && window.google?.maps?.geometry)
  );

  const [directions, setDirections] = useState(null);
  const [map, setMapInternal] = useState(null);
  const [zones, setZones] = useState([]);
  const [lastDirectionsAt, setLastDirectionsAt] = useState(0);
  const [riderIconFallback, setRiderIconFallback] = useState(false);
  const [localGpsRiderLocation, setLocalGpsRiderLocation] = useState(null);

  useEffect(() => {
    if (mapsReady) return undefined;
    let cancelled = false;
    const checkReady = () => {
      if (cancelled) return;
      const ready = Boolean(window.google?.maps?.Map && window.google?.maps?.geometry);
      if (ready) {
        console.log('🗺️ [PolylineDebug][MapReady] Google Maps + geometry loaded');
        setMapsReady(true);
      }
    };
    checkReady();
    const interval = window.setInterval(checkReady, 350);
    window.addEventListener('google-maps-ready', checkReady);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('google-maps-ready', checkReady);
    };
  }, [mapsReady]);

  useEffect(() => {
    if (mapsReady) return undefined;

    let cancelled = false;
    const checkReady = () => {
      if (cancelled) return;
      const ready = Boolean(window.google?.maps?.Map && window.google?.maps?.geometry);
      if (ready) {
        setMapsReady(true);
      }
    };

    checkReady();
    const interval = window.setInterval(checkReady, 350);
    window.addEventListener('google-maps-ready', checkReady);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('google-maps-ready', checkReady);
    };
  }, [mapsReady]);

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
    mapInstance.setCenter(mapCenter);
    // WebView-safe: force a resize pass after mount so tiles render reliably
    window.setTimeout(() => {
      if (window.google?.maps && mapInstance) {
        window.google.maps.event.trigger(mapInstance, 'resize');
        mapInstance.setCenter(mapCenter);
      }
    }, 100);
    if (onMapLoad) onMapLoad(mapInstance);
  };

  useEffect(() => {
    if (!activeOrder || tripStatus === 'COMPLETED' || tripStatus === 'IDLE') {
      setLastDirectionsAt(0);
      setDirections(null);
    }
  }, [tripStatus, activeOrder?._id, activeOrder]);

  const readPoint = useCallback((rawLoc) => {
    if (!rawLoc) return null;
    if (Array.isArray(rawLoc?.coordinates) && rawLoc.coordinates.length >= 2) {
      const lat = Number(rawLoc.coordinates[1]);
      const lng = Number(rawLoc.coordinates[0]);
      return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
    }
    const lat = Number(rawLoc.lat ?? rawLoc.latitude);
    const lng = Number(rawLoc.lng ?? rawLoc.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }, []);

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    const isPickupLeg = tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP';
    if (isPickupLeg) {
      return (
        readPoint(activeOrder.restaurantLocation) ||
        readPoint(activeOrder.restaurant?.location) ||
        readPoint(activeOrder.restaurantId?.location) ||
        readPoint(activeOrder.restaurant) ||
        readPoint(activeOrder.restaurantId)
      );
    }
    return (
      readPoint(activeOrder.customerLocation) ||
      readPoint(activeOrder.deliveryAddress?.location) ||
      readPoint(activeOrder.address?.location) ||
      readPoint(activeOrder.address) ||
      readPoint(activeOrder.deliveryAddress)
    );
  }, [activeOrder, tripStatus, readPoint]);

  const parsedRiderLocation = useMemo(() => {
    if (!riderLocation) return null;
    const lat = parseFloat(riderLocation.lat || riderLocation.latitude);
    const lng = parseFloat(riderLocation.lng || riderLocation.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng, heading: parseFloat(riderLocation.heading || 0) } : null;
  }, [riderLocation]);

  const effectiveRiderLocation = parsedRiderLocation || localGpsRiderLocation;
  const mapCenter = effectiveRiderLocation || targetLocation || FALLBACK_CENTER;

  useEffect(() => {
    console.log('🧭 [PolylineDebug][Inputs]', {
      mapsReady,
      tripStatus,
      orderId: activeOrder?.orderId || activeOrder?._id || null,
      riderStore: riderLocation || null,
      riderParsed: parsedRiderLocation || null,
      riderFallbackGps: localGpsRiderLocation || null,
      riderEffective: effectiveRiderLocation || null,
      targetLocation: targetLocation || null
    });
  }, [mapsReady, tripStatus, activeOrder?._id, activeOrder?.orderId, riderLocation, parsedRiderLocation, localGpsRiderLocation, effectiveRiderLocation, targetLocation]);

  useEffect(() => {
    if (parsedRiderLocation || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        const heading = pos?.coords?.heading || 0;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLocalGpsRiderLocation({ lat, lng, heading });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [parsedRiderLocation]);

  useEffect(() => { if (map) map.setZoom(zoom); }, [zoom, map]);

  useEffect(() => {
    if (!map || !mapCenter) return;
    map.setCenter(mapCenter);
  }, [map, mapCenter]);

  const shouldUpdateRoute = useMemo(() => {
    const now = Date.now();
    if (!directions) return true;
    let throttleMs = 20000;
    if (effectiveRiderLocation && targetLocation && window.google) {
      try {
        const p1 = new window.google.maps.LatLng(effectiveRiderLocation.lat, effectiveRiderLocation.lng);
        const p2 = new window.google.maps.LatLng(targetLocation.lat, targetLocation.lng);
        const dist = window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        if (dist > 2000) throttleMs = 60000;
        else if (dist > 500) throttleMs = 20000;
        else throttleMs = 5000;
      } catch (e) {}
    }
    return (now - lastDirectionsAt) >= throttleMs;
  }, [lastDirectionsAt, directions, effectiveRiderLocation, targetLocation]);

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

  const directionsCallback = useCallback((result, status) => {
    console.log('🧭 [PolylineDebug][DirectionsCallback]', {
      status,
      hasResult: Boolean(result),
      routeCount: result?.routes?.length || 0
    });
    if (status === 'OK' && result) {
      setDirections(result);
      setLastDirectionsAt(Date.now());
      const encodedPolyline = result.routes[0]?.overview_polyline;
      console.log('🧭 [PolylineDebug][DirectionsOK]', {
        hasOverviewPath: Boolean(result?.routes?.[0]?.overview_path?.length),
        overviewPathPoints: result?.routes?.[0]?.overview_path?.length || 0,
        hasEncodedPolyline: Boolean(encodedPolyline)
      });
      if (encodedPolyline && onPolylineReceived) onPolylineReceived(encodedPolyline);
    }
  }, [onPolylineReceived]);

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

  const riderIconSrc = useMemo(() => {
    if (!riderIconFallback) return bikeLogo;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(RIDER_BIKE_SVG)}`;
  }, [riderIconFallback]);

  const lastCenteredPosRef = useRef(null);
  useEffect(() => {
    if (map && effectiveRiderLocation) {
      if (!lastCenteredPosRef.current) {
        map.panTo(effectiveRiderLocation);
        lastCenteredPosRef.current = effectiveRiderLocation;
        return;
      }
      const dist = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(effectiveRiderLocation.lat, effectiveRiderLocation.lng),
        new window.google.maps.LatLng(lastCenteredPosRef.current.lat, lastCenteredPosRef.current.lng)
      );
      if (dist > 30) {
        map.panTo(effectiveRiderLocation);
        lastCenteredPosRef.current = effectiveRiderLocation;
      }
    }
  }, [map, effectiveRiderLocation]);

  const remainingPath = useMemo(() => {
    if (!directions || !effectiveRiderLocation) return [];
    const fullPath = directions.routes[0].overview_path;
    let closestIndex = 0;
    let minDist = Infinity;
    const rPos = new window.google.maps.LatLng(effectiveRiderLocation.lat, effectiveRiderLocation.lng);
    for (let i = 0; i < fullPath.length; i++) {
       const d = window.google.maps.geometry.spherical.computeDistanceBetween(rPos, fullPath[i]);
       if (d < minDist) { minDist = d; closestIndex = i; }
    }
    return [{ lat: effectiveRiderLocation.lat, lng: effectiveRiderLocation.lng }, ...fullPath.slice(closestIndex + 1)];
  }, [directions, effectiveRiderLocation]);

  useEffect(() => {
    console.log('🧭 [PolylineDebug][RenderCheck]', {
      hasDirectionsServiceOptions: Boolean(effectiveRiderLocation && targetLocation),
      shouldUpdateRoute,
      hasDirections: Boolean(directions),
      remainingPathPoints: remainingPath.length
    });
  }, [effectiveRiderLocation, targetLocation, shouldUpdateRoute, directions, remainingPath.length]);

  if (!mapsReady) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  const directionsServiceOptions = (effectiveRiderLocation && targetLocation) ? {
    origin: effectiveRiderLocation,
    destination: targetLocation,
    travelMode: 'DRIVING',
  } : null;

  return (
    <div className="absolute inset-0 z-0 text-gray-900 overflow-hidden flex flex-col">
      <GoogleMap
        onLoad={handleMapLoad}
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        defaultCenter={FALLBACK_CENTER}
        zoom={14}
        onClick={(e) => onMapClick?.(e.latLng.lat(), e.latLng.lng())}
        options={mapOptions}
      >
        {directionsServiceOptions && shouldUpdateRoute && (
          <DirectionsService options={directionsServiceOptions} callback={directionsCallback} />
        )}

        {remainingPath.length > 0 && (
          <Polyline path={remainingPath} options={{ strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 6, zIndex: 10 }} />
        )}

        {directions && (
          <Polyline path={directions.routes[0].overview_path} options={{ strokeColor: '#94a3b8', strokeOpacity: 0, strokeWeight: 4, zIndex: 1, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.3, scale: 3, strokeWeight: 4, strokeColor: '#64748b' }, offset: '0', repeat: '15px' }] }} />
        )}

        {effectiveRiderLocation && (
          <OverlayView position={effectiveRiderLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div style={{ transform: `translate(-50%, -50%) rotate(${effectiveRiderLocation.heading || 0}deg)`, transition: 'transform 0.5s linear' }} className="relative w-[72px] h-[72px]">
              <img
                src={riderIconSrc}
                alt="Rider"
                className="w-full h-full object-contain"
                onError={() => setRiderIconFallback(true)}
              />
            </div>
          </OverlayView>
        )}

        {targetLocation && (
          <Marker position={targetLocation} icon={{ url: (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') ? restaurantMarkerUrl : customerMarkerUrl, scaledSize: new window.google.maps.Size(44, 44), anchor: new window.google.maps.Point(22, 22) }} />
        )}

        {zones.map((zone) => (
          <Polygon key={zone._id} paths={zone.paths} options={{ fillColor: "#22c55e", fillOpacity: 0.1, strokeColor: "#22c55e", strokeOpacity: 0.4, strokeWeight: 2, zIndex: 1 }} />
        ))}
      </GoogleMap>
    </div>
  );
};

export default LiveMap;
