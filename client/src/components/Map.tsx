/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";
import { MapPin, Search, Navigation, Crosshair, Route as RouteIcon, X } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    L?: any;
  }
}

interface MarkerData {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  phone?: string;
  hours?: Array<{ label: string; value: string }>;
  isMain?: boolean;
}

interface MapViewProps {
  markers?: MarkerData[];
  className?: string;
  // Legacy Google Maps props (for backward compatibility)
  options?: any;
  onMapReady?: (map: any) => void;
  initialCenter?: any;
  initialZoom?: any;
}

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}

export interface LiveDeliveryMapProps {
  destinationLat?: number;
  destinationLng?: number;
  destinationAddress?: string;
  driverLat?: number;
  driverLng?: number;
  onRouteCalculated?: (distance: number, duration: number) => void;
  className?: string;
}

export interface MultiDriverMapProps {
  activeOrders: any[];
  focusedOrderId?: number | null;
  className?: string;
}

// ─── Module-level Leaflet loader (loads only once) ───
let leafletPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    // Check if Leaflet is already loaded
    if (window.L) {
      resolve();
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.onload = () => {
      // Load Leaflet JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Leaflet"));
      document.head.appendChild(script);
    };
    link.onerror = () => reject(new Error("Failed to load Leaflet CSS"));
    document.head.appendChild(link);
  });

  return leafletPromise;
}

// ─── Utility: Haversine distance calculation ───
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Utility: Bearing calculation ───
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ─── Utility: Extract city name from address ───
function extractCityFromAddress(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim());
  return parts[Math.max(0, parts.length - 2)] || parts[parts.length - 1] || "";
}

// ─── Utility: Fetch boundary polygon from Nominatim ───
async function fetchCityBoundary(cityName: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1&limit=1`
    );
    if (!response.ok) throw new Error("Nominatim fetch failed");
    const data = await response.json();
    if (data.length > 0 && data[0].geojson) {
      return data[0].geojson;
    }
  } catch (error) {
    console.warn("Failed to fetch city boundary:", error);
  }
  return null;
}

// ─── Utility: Fetch route from OSRM ───
async function fetchOSRMRoute(lat1: number, lng1: number, lat2: number, lng2: number) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    console.log("🔗 Fetching single route from OSRM");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error("❌ OSRM HTTP error:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code !== "Ok") {
      console.warn("⚠️ OSRM error code:", data.code, data.message);
      return null;
    }
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      if (!route.geometry) {
        console.warn("⚠️ Route has no geometry");
        return null;
      }
      return {
        geometry: route.geometry,
        distance: route.legs?.[0]?.distance || 0,
        duration: route.legs?.[0]?.duration || 0,
      };
    }
    
    console.warn("⚠️ No routes in OSRM response");
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn("⚠️ OSRM fetch timeout");
    } else {
      console.warn("❌ Failed to fetch OSRM route:", error);
    }
  }
  return null;
}

// ─── Utility: Fetch multiple alternative routes from OSRM ───
async function fetchOSRMAlternativeRoutes(lat1: number, lng1: number, lat2: number, lng2: number) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson&alternatives=true&steps=true`;
    console.log("🔗 Fetching alternative routes from OSRM");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error("❌ OSRM HTTP error:", response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    console.log("📡 OSRM Response code:", data.code);
    
    if (data.code !== "Ok") {
      console.warn("⚠️ OSRM returned error code:", data.code, data.message);
      return [];
    }
    
    if (data.routes && data.routes.length > 0) {
      const routes = data.routes.map((route: any, idx: number) => {
        if (!route.geometry) {
          console.warn(`⚠️ Route ${idx} has no geometry`);
          return null;
        }
        return {
          id: idx,
          geometry: route.geometry,
          distance: route.legs?.[0]?.distance || 0,
          duration: route.legs?.[0]?.duration || 0,
          summary: route.legs?.[0]?.summary || "",
          steps: route.legs?.[0]?.steps || []
        };
      }).filter((r: any) => r !== null);
      
      console.log(`✅ Fetched ${routes.length} valid routes`);
      return routes;
    }
    
    console.warn("⚠️ OSRM returned no routes");
    return [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn("⚠️ OSRM fetch timeout (10s)");
    } else {
      console.error("❌ Failed to fetch OSRM alternative routes:", error);
    }
  }
  return [];
}

// ─── COLOR PALETTE FOR ROUTE VISUALIZATION ───
const routeColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B88B",
  "#ABEBC6",
];

// ─── MAPVIEW COMPONENT ───
export function MapView({ markers = [], className, options, onMapReady, initialCenter, initialZoom }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const boundaryLayerRef = useRef<any>(null);
  const allRoutesRef = useRef<any[]>([]);
  const showAllRoutesRef = useRef(false);
  const infoBoxRef = useRef<HTMLDivElement>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const init = usePersistFn(async () => {
    try {
      console.log("[MapView DEBUG] init() called with", markers.length, "markers, mapContainer ref:", !!mapContainer.current);
      await loadLeaflet();

      // Safety check: gracefully return if the component unmounted while loading
      if (!mapContainer.current) {
        console.warn("[MapView DEBUG] mapContainer was unmounted, early return");
        return;
      }
      if (!window.L) {
        console.error("[MapView DEBUG] Leaflet not loaded after loadLeaflet()");
        return;
      }

      console.log("[MapView DEBUG] Leaflet loaded successfully, Leaflet version:", window.L.version);

      // Clear existing markers if map already initialized
      if (mapRef.current) {
        markersRef.current.forEach((marker) => {
          if (mapRef.current) mapRef.current.removeLayer(marker);
        });
        markersRef.current = [];
      } else {
        // Initialize map with OpenStreetMap tiles (Modern, clean design, reliable)
        mapRef.current = window.L.map(mapContainer.current, { zoomControl: false }).setView([0, 0], 6);
        window.L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          className: 'map-tiles-light',
        }).addTo(mapRef.current);

        // Add recenter button
        addRecenterButton();

        // Add "Show All Routes" toggle button
        addRoutesToggleButton();
      }

      // Add markers for each branch
      const bounds = window.L.latLngBounds([]);
      console.log("[MapView DEBUG] Adding", markers.length, "markers to map");
      markers.forEach((marker, idx) => {
        console.log("[MapView DEBUG] Adding marker", idx, ":", marker.title, "at", marker.lat, marker.lng);
        const isMain = marker.isMain ?? false;

        // Create custom div marker
        const customHtmlMarker = window.L.divIcon({
          html: `
            <div class="flex flex-col items-center justify-end group cursor-pointer drop-shadow-md" style="transform: translate(-50%, -100%);">
              <div class="bg-white text-foreground px-4 py-2.5 rounded-2xl text-xs font-bold shadow-[0_12px_28px_rgba(0,0,0,0.15)] whitespace-nowrap flex items-center gap-2 transition-all group-hover:scale-110 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.2)] border border-border/50 ${isMain ? 'bg-gradient-to-r from-[var(--brand)] to-blue-600 text-white border-[var(--brand)]' : 'bg-white'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isMain ? 'text-white' : 'text-[var(--brand)]'}"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${marker.title}
              </div>
              <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] transition-all group-hover:scale-110 origin-top" style="border-top-color: ${isMain ? 'var(--brand)' : 'white'};"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          className: "custom-marker-overflow-visible",
        });

        const markerObj = window.L.marker([marker.lat, marker.lng], {
          icon: customHtmlMarker,
          title: marker.title,
        }).addTo(mapRef.current);

        // Store marker reference
        markersRef.current.push(markerObj);

        // Click handler for branch routing
        markerObj.on("click", async () => {
          await handleBranchMarkerClick(marker);
        });

        bounds.extend([marker.lat, marker.lng]);
      });

      // Auto-frame map based on number of markers
      console.log("[MapView DEBUG] Setting up map view - markers.length:", markers.length);
      if (markers.length === 1) {
        console.log("[MapView DEBUG] Setting view to single marker:", markers[0].lat, markers[0].lng);
        mapRef.current.setView([markers[0].lat, markers[0].lng], 14);
      } else if (markers.length > 1) {
        console.log("[MapView DEBUG] Fitting bounds with multiple markers");
        mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      } else {
        console.warn("[MapView DEBUG] No markers to display");
      }

      // Fix partial grey tile rendering when map container initializes with hidden dimensions
      setTimeout(() => {
        if (mapRef.current) {
          console.log("[MapView DEBUG] Calling invalidateSize()");
          mapRef.current.invalidateSize();
        }
      }, 250);
    } catch (error) {
      console.error("[MapView DEBUG] Map initialization error:", error);
      toast.error("Failed to load map");
    }
  });

  const handleBranchMarkerClick = usePersistFn(async (marker: MarkerData) => {
    try {
      // Get user location
      const userLocation = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            resolve(userLocationRef.current);
          },
          () => {
            reject(new Error("Geolocation denied"));
          },
          { enableHighAccuracy: true }
        );
      });

      if (!mapRef.current) return;

      // Clear previous route
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      // Fetch route from user to branch
      const routeData = await fetchOSRMRoute(userLocation.lat, userLocation.lng, marker.lat, marker.lng);

      if (!mapRef.current) return;

      if (routeData) {
        // Premium dual-layer route line
        const coords = routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        const outline = window.L.polyline(coords, { color: "#ffffff", weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' });
        const inner = window.L.polyline(coords, { color: "#3b82f6", weight: 4, opacity: 1, lineJoin: 'round', lineCap: 'round' });
        routeLayerRef.current = window.L.layerGroup([outline, inner]).addTo(mapRef.current);

        // Fit bounds to show route
        mapRef.current.fitBounds(window.L.latLngBounds(coords), { padding: [50, 50] });

        // Show popup with branch info and route details
        const distanceKm = (routeData.distance / 1000).toFixed(1);
        const durationMin = Math.round(routeData.duration / 60);

        const popupContent = `
          <div class="p-5 min-w-[240px] bg-card text-foreground rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-border relative">
            <h3 class="font-bold text-sm mb-1 pr-4">${marker.title}</h3>
            ${marker.address ? `<p class="text-xs text-muted-foreground mb-3 leading-relaxed">${marker.address}</p>` : ""}
            <div class="space-y-1.5 mt-3 pt-3 border-t border-border">
              <div class="flex items-center justify-between text-xs"><span class="text-muted-foreground">Distance</span><span class="font-bold">${distanceKm} km</span></div>
              <div class="flex items-center justify-between text-xs"><span class="text-muted-foreground">Est. Time</span><span class="font-bold text-[var(--brand)]">~${durationMin} min</span></div>
            </div>
            <button onclick="window.dispatchEvent(new CustomEvent('clearRoute'))" class="mt-4 w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl text-xs font-bold transition-all active:scale-95 border border-border">
              Clear Route
            </button>
          </div>
        `;

        const popup = window.L.popup().setContent(popupContent).setLatLng([marker.lat, marker.lng]);
        mapRef.current.openPopup(popup);
      } else {
        // Fallback: draw straight dashed line
        routeLayerRef.current = window.L.polyline([[userLocation.lat, userLocation.lng], [marker.lat, marker.lng]], {
          color: "#94a3b8",
          weight: 4,
          opacity: 0.8,
          dashArray: "5, 5",
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapRef.current);

        const distanceKm = haversineDistance(userLocation.lat, userLocation.lng, marker.lat, marker.lng).toFixed(1);
        const popupContent = `
          <div class="p-5 min-w-[240px] bg-card text-foreground rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-border">
            <h3 class="font-bold text-sm mb-1 pr-4">${marker.title}</h3>
            <p class="text-xs text-muted-foreground mb-3 leading-relaxed">Distance: ${distanceKm} km (approx)</p>
            <button onclick="window.dispatchEvent(new CustomEvent('clearRoute'))" class="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl text-xs font-bold transition-all active:scale-95 border border-border">
              Clear Route
            </button>
          </div>
        `;

        const popup = window.L.popup().setContent(popupContent).setLatLng([marker.lat, marker.lng]);
        mapRef.current.openPopup(popup);
      }

      // Fetch and draw city boundary
      const cityName = extractCityFromAddress(marker.address || "");
      if (cityName) {
        const boundary = await fetchCityBoundary(cityName);
        if (!mapRef.current) return;

        if (boundary && boundaryLayerRef.current) {
          mapRef.current.removeLayer(boundaryLayerRef.current);
        }
        if (boundary) {
          boundaryLayerRef.current = window.L.geoJSON(boundary, {
            style: {
              color: "#6366f1",
              weight: 2,
              opacity: 1,
              fillColor: "#6366f1",
              fillOpacity: 0.1,
            },
          }).addTo(mapRef.current);
        }
      }
    } catch (error) {
      console.warn("Error handling branch marker click:", error);
      if (error instanceof Error && error.message === "Geolocation denied") {
        toast.error("Please enable geolocation to use this feature");
      }
    }
  });

  const routeToNearestBranch = usePersistFn(async (lat: number, lng: number, isUserLocation: boolean) => {
    if (!mapRef.current) return;

    // Update or add marker (blue for user, orange for searched location)
    if (userMarkerRef.current) {
      mapRef.current.removeLayer(userMarkerRef.current);
    }

    userMarkerRef.current = window.L.circleMarker([lat, lng], {
      radius: 7,
      fillColor: isUserLocation ? "#3b82f6" : "#8b5cf6",
      color: "#ffffff",
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(mapRef.current);

    // Find nearest branch
    if (!markers || markers.length === 0) return;
    let nearestBranch = markers[0];
    let minDist = haversineDistance(lat, lng, markers[0].lat, markers[0].lng);

    for (const marker of markers) {
      const dist = haversineDistance(lat, lng, marker.lat, marker.lng);
      if (dist < minDist) {
        minDist = dist;
        nearestBranch = marker;
      }
    }

    // Draw route to nearest branch
    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const routeData = await fetchOSRMRoute(lat, lng, nearestBranch.lat, nearestBranch.lng);

    if (!mapRef.current) return;

    if (routeData) {
      const coords = routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      const outline = window.L.polyline(coords, { color: "#ffffff", weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' });
      const inner = window.L.polyline(coords, { color: "#3b82f6", weight: 4, opacity: 1, lineJoin: 'round', lineCap: 'round' });
      routeLayerRef.current = window.L.layerGroup([outline, inner]).addTo(mapRef.current);
      mapRef.current.fitBounds(window.L.latLngBounds(coords), { padding: [50, 50] });
      
      const distanceKm = (routeData.distance / 1000).toFixed(1);
      const durationMin = Math.round(routeData.duration / 60);
      showInfoBox(nearestBranch.title, parseFloat(distanceKm), durationMin);
    } else {
      routeLayerRef.current = window.L.polyline([[lat, lng], [nearestBranch.lat, nearestBranch.lng]], { 
        color: "#94a3b8", weight: 4, opacity: 0.8, dashArray: "8, 8", lineJoin: 'round', lineCap: 'round' 
      }).addTo(mapRef.current);

      const bounds = window.L.latLngBounds([[lat, lng], [nearestBranch.lat, nearestBranch.lng]]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      const distanceKm = haversineDistance(lat, lng, nearestBranch.lat, nearestBranch.lng);
      const durationMin = Math.round((distanceKm / 40) * 60);
      showInfoBox(nearestBranch.title, parseFloat(distanceKm.toFixed(1)), durationMin);
    }
  });

  const addRecenterButton = usePersistFn(() => {
    const recenterBtn = window.L.Control.extend({
      options: {
        position: "bottomright",
      },
      onAdd: (map: any) => {
        const container = window.L.DomUtil.create("div");
        container.innerHTML = `
          <div role="button" tabindex="0" aria-label="Go to nearest branch" class="bg-background/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer active:scale-95 group" style="width: 44px; height: 44px; margin-right: 16px; margin-bottom: 24px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground group-hover:text-foreground transition-colors"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          </div>
        `;

        const btn = container.firstElementChild as HTMLElement;
        if (btn) {
          btn.title = "Go to nearest branch";

          window.L.DomEvent.on(btn, "click", async () => {
            try {
              const userLocation = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    resolve(userLocationRef.current);
                  },
                  () => {
                    reject(new Error("Geolocation denied"));
                  },
                  { enableHighAccuracy: true }
                );
              });

              await routeToNearestBranch(userLocation.lat, userLocation.lng, true);
            } catch (error) {
              console.warn("Error in recenter:", error);
              if (error instanceof Error && error.message === "Geolocation denied") {
                toast.error("Please enable geolocation to use this feature");
              }
            }
          });
        }

        return container;
      },
    });

    new recenterBtn().addTo(mapRef.current);
  });

  const showInfoBox = usePersistFn((branchName: string, distanceKm: number, durationMin: number) => {
    if (!infoBoxRef.current) {
      infoBoxRef.current = document.createElement("div");
      mapContainer.current?.appendChild(infoBoxRef.current);
    }

    infoBoxRef.current.style.cssText = `
      position: absolute;
      bottom: 130px;
      right: 16px;
      z-index: 1000;
      transition: all 0.3s ease;
    `;

    infoBoxRef.current.innerHTML = `
      <div class="p-4 min-w-[200px] bg-card text-foreground rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-border relative">
        <h3 class="font-bold text-sm mb-2 pr-4">${branchName}</h3>
        <div class="space-y-1.5 pt-2 border-t border-border">
          <div class="flex items-center justify-between text-xs"><span class="text-muted-foreground">Distance</span><span class="font-bold">${distanceKm} km</span></div>
          <div class="flex items-center justify-between text-xs"><span class="text-muted-foreground">Est. Time</span><span class="font-bold text-[var(--brand)]">~${durationMin} min</span></div>
        </div>
      </div>
    `;

    setTimeout(() => {
      if (infoBoxRef.current) {
        infoBoxRef.current.style.display = "none";
      }
    }, 5000);
  });

  const addRoutesToggleButton = usePersistFn(() => {
    const toggleBtn = window.L.Control.extend({
      options: {
        position: "topright",
      },
      onAdd: (map: any) => {
        const container = window.L.DomUtil.create("div");
        container.innerHTML = `
          <div role="button" tabindex="0" aria-label="Toggle Routes" class="bg-background/95 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer active:scale-95 px-4 font-bold text-xs" style="height: 40px; margin-right: 16px; margin-top: 16px;">
            Show Routes
          </div>
        `;

        const btn = container.firstElementChild as HTMLElement;
        window.L.DomEvent.on(btn, "click", async (e: Event) => {
          e.preventDefault();
          showAllRoutesRef.current = !showAllRoutesRef.current;

          if (showAllRoutesRef.current) {
            // Draw all routes between branches
            btn.className = "bg-blue-600 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-blue-700 text-white hover:bg-blue-700 transition-colors flex items-center justify-center cursor-pointer active:scale-95 px-4 font-bold text-xs";
            btn.innerHTML = "Hide Routes";

            for (let i = 0; i < markers.length; i++) {
              for (let j = i + 1; j < markers.length; j++) {
                const routeData = await fetchOSRMRoute(markers[i].lat, markers[i].lng, markers[j].lat, markers[j].lng);
                if (!mapRef.current) return;

                const color = routeColors[(i + j) % routeColors.length];

                if (routeData) {
                  const coords = routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
                  const outline = window.L.polyline(coords, { color: "#ffffff", weight: 6, opacity: 0.5, lineJoin: 'round', lineCap: 'round' });
                  const inner = window.L.polyline(coords, { color: color, weight: 3, opacity: 0.8, lineJoin: 'round', lineCap: 'round' });
                  const routeLayer = window.L.layerGroup([outline, inner]).addTo(mapRef.current);
                  allRoutesRef.current.push(routeLayer);
                } else {
                  // Fallback: draw straight dashed line
                  const routeLayer = window.L.polyline([[markers[i].lat, markers[i].lng], [markers[j].lat, markers[j].lng]], {
                    color: color,
                    weight: 3,
                    opacity: 0.6,
                    dashArray: "5, 5",
                    lineJoin: 'round',
                    lineCap: 'round'
                  }).addTo(mapRef.current);
                  allRoutesRef.current.push(routeLayer);
                }
              }
            }

            toast.success("All branch routes displayed");
          } else {
            // Clear all routes
            btn.className = "bg-background/95 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer active:scale-95 px-4 font-bold text-xs";
            btn.innerHTML = "Show Routes";

            allRoutesRef.current.forEach((layer) => {
              mapRef.current.removeLayer(layer);
            });
            allRoutesRef.current = [];

            toast.success("Routes cleared");
          }
        });

        return container;
      },
    });

    new toggleBtn().addTo(mapRef.current);
  });

  // Handle clear route event
  useEffect(() => {
    const handleClearRoute = () => {
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      if (mapRef.current._popup) {
        mapRef.current.closePopup();
      }
    };

    window.addEventListener("clearRoute", handleClearRoute);
    return () => window.removeEventListener("clearRoute", handleClearRoute);
  }, []);

  // Add pulse animation to stylesheet
  useEffect(() => {
    if (!document.querySelector("style[data-pulse]")) {
      const style = document.createElement("style");
      style.setAttribute("data-pulse", "true");
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        await routeToNearestBranch(lat, lng, false);
      } else {
        toast.error("Location not found");
      }
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    init();

    return () => {
      if (mapRef.current) {
        markersRef.current.forEach((marker) => {
          if (mapRef.current) mapRef.current.removeLayer(marker);
        });
        if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
        if (boundaryLayerRef.current) mapRef.current.removeLayer(boundaryLayerRef.current);
        if (userMarkerRef.current) mapRef.current.removeLayer(userMarkerRef.current);
        allRoutesRef.current.forEach((layer) => {
          if (mapRef.current) mapRef.current.removeLayer(layer);
        });
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [init, markers]);

  if (markers.length === 0) {
    // Check if this is legacy Google Maps code being used
    if (options || onMapReady) {
      return (
        <div
          className={cn(
            "w-full h-[500px] bg-muted/20 flex flex-col items-center justify-center p-6 text-center border border-border rounded-lg",
            className
          )}
        >
          <MapPin className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
          <h3 className="font-semibold text-lg text-foreground">Map Component Updated</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            The map component now uses Leaflet.js. Please pass a <code className="bg-background px-1 py-0.5 rounded border border-border text-xs">markers</code> prop with branch locations.
          </p>
          <p className="text-xs text-muted-foreground mt-4">See Map.tsx for usage examples.</p>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-full h-[500px] bg-muted/20 flex flex-col items-center justify-center p-6 text-center border border-border rounded-lg",
          className
        )}
      >
        <MapPin className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
        <h3 className="font-semibold text-lg text-foreground">No Branches Available</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Add branch locations to display them on the map.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-[500px] rounded-lg overflow-hidden", className)}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
        <form onSubmit={handleSearch} className="flex w-full bg-background/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden border border-border transition-all focus-within:ring-2 focus-within:ring-[var(--brand)]/50">
          <Search className="w-5 h-5 text-muted-foreground ml-4 my-auto shrink-0" />
          <input
            type="text"
            placeholder="Find nearest branch..."
            className="flex-1 px-3 py-3.5 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <div className="pr-4 my-auto"><div className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div></div>}
        </form>
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

// ─── MULTI-DRIVER LIVE MAP COMPONENT ───
export function MultiDriverMap({ activeOrders, focusedOrderId, className }: MultiDriverMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersMapRef = useRef<Record<string, any>>({});
  const websocketsRef = useRef<WebSocket[]>([]);
  const prevLocsRef = useRef<Record<string, {lat: number, lng: number}>>({});
  const headingsRef = useRef<Record<string, number>>({});

  // Store a string of IDs so we don't recreate the map every time the array reference changes
  const activeOrderIds = activeOrders.map(o => o.id).sort().join(",");

  const updateDriverMarker = usePersistFn((order: any, lat: number, lng: number) => {
    if (!mapRef.current || !window.L) return;
    
    // Deduplicate markers: Group by driver rather than order ID
    const agentId = order.deliveryAgentId || order.id;
    let marker = markersMapRef.current[agentId];

    let currentHeading = headingsRef.current[agentId] || 0;
    const prev = prevLocsRef.current[agentId];
    if (prev && (Math.abs(prev.lat - lat) > 0.00001 || Math.abs(prev.lng - lng) > 0.00001)) {
      let newHeading = calculateBearing(prev.lat, prev.lng, lat, lng);
      let diff = newHeading - ((currentHeading % 360 + 360) % 360);
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      currentHeading += diff;
      headingsRef.current[agentId] = currentHeading;
    }
    prevLocsRef.current[agentId] = { lat, lng };

    if (!marker) {
      // Group all orders for this specific driver
      const ordersForDriver = activeOrders.filter(o => (o.deliveryAgentId || o.id) === agentId);
      const orderLabels = ordersForDriver.map(o => `ORD #${o.orderNumber}`).join("<br/>");
      
      const carIcon = window.L.divIcon({
        html: `
          <div class="flex flex-col items-center" style="transform: translate(-50%, -50%);">
            <div class="relative flex items-center justify-center w-12 h-12">
              <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-40" style="animation-duration: 2s;"></div>
              <div class="driver-icon-inner relative w-10 h-10 bg-white border border-border shadow-xl rounded-full flex items-center justify-center z-10 text-blue-600" style="transform: rotate(${currentHeading}deg); transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-45deg); margin-right: 2px; margin-top: 2px;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
              </div>
            </div>
            <div class="bg-white/95 backdrop-blur shadow-md text-[10px] font-bold px-2.5 py-1 rounded-xl border border-border mt-1 text-zinc-800 tracking-wide text-center leading-tight">
              ${orderLabels}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        className: "custom-marker",
      });
      marker = window.L.marker([lat, lng], { icon: carIcon }).addTo(mapRef.current);
      markersMapRef.current[agentId] = marker;

      // Auto-fit bounds as new drivers appear on the map (only if not focused on a specific driver)
      const allMarkers = Object.values(markersMapRef.current).map((m: any) => m.getLatLng());
      if (allMarkers.length > 0 && !focusedOrderId) {
        const bounds = window.L.latLngBounds(allMarkers);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } else {
      marker.setLatLng([lat, lng]);
      const el = marker.getElement();
      if (el) {
        const inner = el.querySelector('.driver-icon-inner') as HTMLElement;
        if (inner) {
          inner.style.transform = `rotate(${currentHeading}deg)`;
        }
      }
    }
  });

  // Fly to specific driver or fit bounds to all when focusedOrderId changes
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (focusedOrderId && markersMapRef.current[focusedOrderId]) {
      // Find the agent tracking this order
      const focusedOrder = activeOrders.find(o => o.id === focusedOrderId);
      const targetAgentId = focusedOrder?.deliveryAgentId || focusedOrderId;
      
      const marker = markersMapRef.current[targetAgentId];
      mapRef.current.flyTo(marker.getLatLng(), 16, { animate: true, duration: 1 });
      setTimeout(() => marker.openPopup(), 200);
    } else if (!focusedOrderId) {
      const allMarkers = Object.values(markersMapRef.current).map((m: any) => m.getLatLng());
      if (allMarkers.length > 0) {
        const bounds = window.L.latLngBounds(allMarkers);
        mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1 });
      }
    }
  }, [focusedOrderId, activeOrderIds]);

  const init = usePersistFn(async () => {
    try {
      await loadLeaflet();
      if (!mapContainer.current || !window.L) return;

      if (!mapRef.current) {
        mapRef.current = window.L.map(mapContainer.current, { zoomControl: false }).setView([-1.2921, 36.8219], 12);
        window.L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
          className: 'map-tiles-light',
        }).addTo(mapRef.current);
      }

      // Clear old connections to prevent duplicates
      websocketsRef.current.forEach(ws => ws.close());
      websocketsRef.current = [];

      // Clean up orphaned markers (if an order was marked 'delivered')
      const currentAgentIds = activeOrders.map(o => o.deliveryAgentId || o.id);
      Object.keys(markersMapRef.current).forEach(id => {
        if (!currentAgentIds.includes(parseInt(id))) {
          mapRef.current.removeLayer(markersMapRef.current[id]);
          delete markersMapRef.current[id];
        }
      });

      // Connect new websockets for active deliveries
      activeOrders.forEach(order => {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/delivery/${order.id}`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const loc = JSON.parse(event.data);
            if (loc.lat && loc.lng) {
              updateDriverMarker(order, parseFloat(loc.lat), parseFloat(loc.lng));
            }
          } catch(e) {}
        };

        websocketsRef.current.push(ws);
      });
    } catch (err) {
      console.error("Map init failed", err);
    }
  });

  useEffect(() => {
    init();
    return () => {
      websocketsRef.current.forEach(ws => ws.close());
      websocketsRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init, activeOrderIds]);

  return (
    <div className={cn("relative w-full h-[500px] rounded-lg overflow-hidden bg-muted/20 border border-border", className)}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

// ─── LIVE DELIVERY TRACKING MAP COMPONENT ───
export function LiveDeliveryMap({ destinationLat, destinationLng, destinationAddress, driverLat, driverLng, onRouteCalculated, className }: LiveDeliveryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLayersRef = useRef<any[]>([]);
  const [destLat, setDestLat] = useState(destinationLat || -1.2921); // Default to Nairobi if no destination
  const [destLng, setDestLng] = useState(destinationLng || 36.8219); // Default to Nairobi if no destination
  const prevDriverLocRef = useRef<{lat: number, lng: number} | null>(null);
  const driverHeadingRef = useRef<number>(0);
  const [routes, setRoutes] = useState<Array<{ id: number; geometry: any; distance: number; duration: number; summary: string; steps?: any[] }>>([]);
  const [selectedRouteId, setSelectedRouteId] = useState(0);
  const [showDirections, setShowDirections] = useState(false);

  useEffect(() => {
    // If coordinates are not provided but address is, geocode the address
    if (destinationAddress && (!destinationLat || !destinationLng)) {
      console.log("🌍 Original address for geocoding:", destinationAddress);

      // Step 1: Clean the address aggressively
      const cleanAddress = (addr: string): string => {
        if (!addr) return "";
        // Remove undefined, null strings
        let cleaned = addr.replace(/\b(undefined|null|na|n\/a)\b/gi, '')
          // Remove extra whitespace between words
          .replace(/\s+/g, ' ')
          // Remove duplicate commas and spaces
          .replace(/,\s*,/g, ',')
          .replace(/,\s+/g, ', ')
          // Remove leading/trailing whitespace and commas
          .replace(/(^,\s*)|(,\s*$)/g, '')
          .trim();
        
        // Filter out empty parts between commas
        const parts = cleaned.split(',').map(p => p.trim()).filter(p => p.length > 0);
        return parts.join(', ');
      };

      const attemptGeocode = async (addressStr: string, label: string = "") => {
        if (!addressStr || addressStr.length < 2) {
          console.warn(`⚠️ Skipping geocode (${label}): address too short - "${addressStr}"`);
          return null;
        }
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&limit=3&countrycodes=ke`;
          console.log(`🔍 Attempting geocode (${label}):`, addressStr);
          const res = await fetch(url);
          const data = await res.json();
          if (data && data.length > 0 && data[0].lat && data[0].lon) {
            const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            console.log(`✅ Geocoded (${label}):`, { address: addressStr, ...result });
            return result;
          }
          console.warn(`⚠️ No geocoding results (${label}):`, addressStr);
        } catch (e) {
          console.warn(`❌ Geocoding fetch error (${label}):`, e);
        }
        return null;
      };

      const runGeocoding = async () => {
        const cleanAddr = cleanAddress(destinationAddress);
        console.log("✨ Cleaned address:", cleanAddr);

        if (!cleanAddr) {
          console.error("❌ Address is empty after cleaning");
          setDestLat(-1.2921);
          setDestLng(36.8219);
          return;
        }

        // Try progressively shorter address versions
        let result = null;
        const addressParts = cleanAddr.split(',').map(p => p.trim()).filter(p => p.length > 0);
        
        // Attempt 1: Full address
        result = await attemptGeocode(cleanAddr, "Full");
        if (result) {
          setDestLat(result.lat);
          setDestLng(result.lng);
          return;
        }

        // Attempt 2: Without the first part (street address)
        if (addressParts.length > 1) {
          const withoutStreet = addressParts.slice(1).join(', ');
          result = await attemptGeocode(withoutStreet, "Without street");
          if (result) {
            setDestLat(result.lat);
            setDestLng(result.lng);
            return;
          }
        }

        // Attempt 3: Just city and country (last two parts)
        if (addressParts.length >= 2) {
          const cityCountry = addressParts.slice(-2).join(', ');
          result = await attemptGeocode(cityCountry, "City-Country");
          if (result) {
            setDestLat(result.lat);
            setDestLng(result.lng);
            return;
          }
        }

        // Attempt 4: Just city (last non-empty part)
        if (addressParts.length > 0) {
          const city = addressParts[addressParts.length - 1];
          result = await attemptGeocode(city, "City only");
          if (result) {
            setDestLat(result.lat);
            setDestLng(result.lng);
            return;
          }
        }

        // Attempt 5: Middle part (likely county if format is: street, county, city, country)
        if (addressParts.length >= 3) {
          const county = addressParts[addressParts.length - 2];
          result = await attemptGeocode(county, "County");
          if (result) {
            setDestLat(result.lat);
            setDestLng(result.lng);
            return;
          }
        }

        // All attempts failed - fallback to Kenya coordinates
        console.warn("⚠⚠⚠ All geocoding attempts failed, using Nairobi fallback");
        setDestLat(-1.2921);
        setDestLng(36.8219);
      };

      runGeocoding();
    } else if (destinationLat && destinationLng) {
      // Use provided coordinates
      setDestLat(destinationLat);
      setDestLng(destinationLng);
    }
  }, [destinationLat, destinationLng, destinationAddress]);

  const init = usePersistFn(async () => {
    try {
      await loadLeaflet();

      if (!mapContainer.current || !window.L) return;

      if (!mapRef.current) {
        // Start with destination center
        const initialCenter = [destLat, destLng];
        const initialZoom = driverLat && driverLng ? 14 : 13;
        
        mapRef.current = window.L.map(mapContainer.current, { zoomControl: false }).setView(initialCenter, initialZoom);
        window.L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current);
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          className: 'map-tiles-light',
        }).addTo(mapRef.current);

        console.log("🗺️ Map initialized at:", initialCenter);
        
        // Small delay to ensure map is fully ready before updating driver/routes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!mapRef.current) return;

      // Premium Destination Marker (Home Icon) - Modern Professional Design
      if (!destinationMarkerRef.current) {
        const addressLabel = destinationAddress 
          ? `<div class="bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg mb-2 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis border border-zinc-700">${destinationAddress.split(',')[0]}</div>`
          : `<div class="bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg mb-2 whitespace-nowrap border border-zinc-700">Delivery Destination</div>`;

        const destIcon = window.L.divIcon({
          html: `
            <div class="flex flex-col items-center" style="transform: translate(-50%, -100%);">
              ${addressLabel}
              <div class="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.25)] border-3 border-white z-10" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              </div>
              <div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px]" style="border-top-color: #2563eb; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); margin-top: -1px;"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          className: "custom-marker-overflow-visible",
        });
        destinationMarkerRef.current = window.L.marker([destLat, destLng], { icon: destIcon }).addTo(mapRef.current);
        console.log("🏠 Destination marker added at:", destLat, destLng);
      } else if (destinationMarkerRef.current && mapRef.current) {
        destinationMarkerRef.current.setLatLng([destLat, destLng]);
      }

      // Only call updateDriverAndRoute if we have valid coordinates and map is ready
      if (mapRef.current && destLat && destLng && !isNaN(destLat) && !isNaN(destLng)) {
        console.log("✅ Map fully initialized, updating driver and routes");
        await updateDriverAndRoute();
      }
    } catch (error) {
      console.error("❌ Failed to init LiveDeliveryMap:", error);
    }
  });

  // Update destination marker position when destination changes
  useEffect(() => {
    if (destinationMarkerRef.current && mapRef.current && destLat && destLng) {
      const addressLabel = destinationAddress 
        ? `<div class="bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg mb-2 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis border border-zinc-700">${destinationAddress.split(',')[0]}</div>`
        : `<div class="bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg mb-2 whitespace-nowrap border border-zinc-700">Delivery Destination</div>`;

      const destIcon = window.L.divIcon({
        html: `
          <div class="flex flex-col items-center" style="transform: translate(-50%, -100%);">
            ${addressLabel}
            <div class="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.25)] border-3 border-white z-10" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </div>
            <div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px]" style="border-top-color: #2563eb; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); margin-top: -1px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        className: "custom-marker-overflow-visible",
      });

      destinationMarkerRef.current.setLatLng([destLat, destLng]);
      destinationMarkerRef.current.setIcon(destIcon);
      
      // Center the map onto the destination if there's no driver location yet
      if (!driverMarkerRef.current) {
        mapRef.current.flyTo([destLat, destLng], 14, { animate: true, duration: 1.5 });
      }
      console.log("🏠 Destination marker updated to:", { destLat, destLng });
    }
  }, [destLat, destLng, destinationAddress]);

  const updateDriverAndRoute = usePersistFn(async () => {
    if (!mapRef.current || !window.L) {
      console.warn("⚠️ Map not ready for driver update");
      return;
    }

    // Validate destination coordinates
    if (!destLat || !destLng || isNaN(destLat) || isNaN(destLng)) {
      console.warn("⚠️ Invalid destination coordinates:", { destLat, destLng });
      return;
    }

    console.log("📍 updateDriverAndRoute called. Driver:", { driverLat, driverLng }, "Destination:", { destLat, destLng });

    // Update destination marker position
    if (destinationMarkerRef.current) {
      try {
        destinationMarkerRef.current.setLatLng([destLat, destLng]);
      } catch (e) {
        console.error("❌ Failed to update destination marker:", e);
      }
    }

    // Handle driver marker and routes
    if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
      console.log("✅ Driver location available:", { driverLat, driverLng });
      
      // Calculate heading based on previous location
      let currentHeading = driverHeadingRef.current;
      if (prevDriverLocRef.current) {
        const p = prevDriverLocRef.current;
        if (Math.abs(p.lat - driverLat) > 0.00001 || Math.abs(p.lng - driverLng) > 0.00001) {
          let newHeading = calculateBearing(p.lat, p.lng, driverLat, driverLng);
          let diff = newHeading - ((currentHeading % 360 + 360) % 360);
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          currentHeading += diff;
          driverHeadingRef.current = currentHeading;
        }
      }
      prevDriverLocRef.current = { lat: driverLat, lng: driverLng };

      // Update or create driver marker (Car Icon) - Modern Professional Design
      if (!driverMarkerRef.current) {
        const carIcon = window.L.divIcon({
          html: `
            <div class="flex flex-col items-center" style="transform: translate(-50%, -50%); transition: all 0.3s ease;">
              <div class="relative flex items-center justify-center w-14 h-14">
                <div class="absolute inset-0 bg-green-400 rounded-full animate-pulse opacity-30" style="animation-duration: 2s;"></div>
                <div class="driver-icon-inner relative w-12 h-12 bg-white border-3 border-white shadow-[0_10px_28px_rgba(0,0,0,0.3)] rounded-full flex items-center justify-center z-10 text-green-600" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; transform: rotate(${currentHeading}deg); transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-45deg); margin-right: 2px; margin-top: 2px;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          className: "custom-marker-overflow-visible",
        });
        driverMarkerRef.current = window.L.marker([driverLat, driverLng], { icon: carIcon }).addTo(mapRef.current);
        console.log("🚗 Driver marker created");
      } else {
        // Smoothly move marker to new location
        try {
          driverMarkerRef.current.setLatLng([driverLat, driverLng]);
          
          const el = driverMarkerRef.current.getElement();
          if (el) {
            const inner = el.querySelector('.driver-icon-inner') as HTMLElement;
            if (inner) {
              inner.style.transform = `rotate(${currentHeading}deg)`;
            }
          }
          console.log("🚗 Driver marker moved to:", { driverLat, driverLng });
        } catch (e) {
          console.error("❌ Failed to update driver marker:", e);
        }
      }

      // Fetch Alternative Routes with validation
      try {
        console.log("🔄 Fetching routes from", { driverLat, driverLng }, "to", { destLat, destLng });
        const altRoutes = await fetchOSRMAlternativeRoutes(driverLat, driverLng, destLat, destLng);
        
        if (!mapRef.current) return;

        console.log("🛣️ Routes fetched:", altRoutes.length, "options");
        setRoutes(altRoutes);

        // Clear previous route layers
        routeLayersRef.current.forEach(layer => {
          try {
            if (mapRef.current) mapRef.current.removeLayer(layer);
          } catch (e) {
            console.warn("Failed to remove layer:", e);
          }
        });
        routeLayersRef.current = [];

        if (altRoutes.length > 0) {
          // Render all routes but highlight selected one
          const routeColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316"];
          
          altRoutes.forEach((route, idx) => {
            try {
              // Validate route geometry exists and has coordinates
              if (!route || !route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length === 0) {
                console.warn(`⚠️ Route ${idx} has invalid geometry, skipping`);
                return;
              }

              const isSelected = idx === selectedRouteId;
              const color = isSelected ? "#3b82f6" : "#94a3b8"; // Bright blue for active, Slate for alternative
              const outlineColor = isSelected ? "#1e40af" : "#64748b"; // Dark blue border
              const weight = isSelected ? 7 : 5;
              const outlineWeight = isSelected ? 11 : 8;
              const opacity = isSelected ? 1 : 0.75;

              // Convert coordinates and validate
              let coords;
              try {
                // OSRM returns GeoJSON LineString coordinates as [lng, lat], map directly to Leaflet [lat, lng]
                coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
              } catch (e) {
                console.warn(`⚠️ Route ${idx} coordinate conversion failed, skipping:`, e);
                return;
              }

              if (!coords || coords.length === 0 || coords.some((c: any) => !c || isNaN(c[0]) || isNaN(c[1]))) {
                console.warn(`⚠️ Route ${idx} has invalid coordinates after conversion, skipping`);
                return;
              }

              const outline = window.L.polyline(coords, { color: outlineColor, weight: outlineWeight, opacity: opacity, lineJoin: 'round', lineCap: 'round' });
              const line = window.L.polyline(coords, { color: color, weight: weight, opacity: opacity, lineJoin: 'round', lineCap: 'round' });
              const layerElements: any[] = [outline, line];

              // Add beautiful directional chevrons for the selected route
              if (isSelected && route.steps && route.steps.length > 0) {
                route.steps.forEach((step: any) => {
                  // Only add a chevron if the step is long enough (prevents clustering at intersections)
                  if (step.distance > 30 && step.maneuver && step.maneuver.location) {
                    const lat = step.maneuver.location[1];
                    const lng = step.maneuver.location[0];
                    const bearing = step.maneuver.bearing_after || 0;
                    
                    const chevronIcon = window.L.divIcon({
                      html: `
                        <div style="transform: rotate(${bearing}deg); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));">
                            <polyline points="4 14 12 6 20 14"></polyline>
                          </svg>
                        </div>
                      `,
                      className: "",
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    });
                    
                    const chevron = window.L.marker([lat, lng], { icon: chevronIcon, interactive: false });
                    layerElements.push(chevron);
                  }
                });
              }

              const layer = window.L.layerGroup(layerElements).addTo(mapRef.current);
              routeLayersRef.current.push(layer, outline, line);
            } catch (e) {
              console.warn(`⚠️ Error processing route ${idx}:`, e);
            }
          });

          // Fit bounds to show all routes
          if (routeLayersRef.current.length > 0) {
            const bounds = window.L.latLngBounds([[driverLat, driverLng], [destLat, destLng]]);
            mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });

            // Callback for selected route
            const selectedRoute = altRoutes[selectedRouteId] || altRoutes[0];
            if (onRouteCalculated && selectedRoute) {
              onRouteCalculated(selectedRoute.distance, selectedRoute.duration);
            }
          }
        } else {
          console.warn("⚠️ No routes returned from OSRM");
          // Fallback: draw straight directional line
          const outline = window.L.polyline([[driverLat, driverLng], [destLat, destLng]], { color: "#1e40af", weight: 11, opacity: 0.8, lineJoin: 'round', lineCap: 'round' });
          const line = window.L.polyline([[driverLat, driverLng], [destLat, destLng]], { color: "#3b82f6", weight: 7, opacity: 1, lineJoin: 'round', lineCap: 'round' });
          
          // Add a single chevron in the middle
          const bearing = calculateBearing(driverLat, driverLng, destLat, destLng);
          const midLat = (driverLat + destLat) / 2;
          const midLng = (driverLng + destLng) / 2;
          
          const chevronIcon = window.L.divIcon({
            html: `
              <div style="transform: rotate(${bearing}deg); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));">
                  <polyline points="4 14 12 6 20 14"></polyline>
                </svg>
              </div>
            `,
            className: "",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          const chevron = window.L.marker([midLat, midLng], { icon: chevronIcon, interactive: false });
          
          const layer = window.L.layerGroup([outline, line, chevron]).addTo(mapRef.current);
          routeLayersRef.current.push(layer, outline, line);
          
          if (onRouteCalculated) {
            const dist = haversineDistance(driverLat, driverLng, destLat, destLng) * 1000;
            onRouteCalculated(dist, (dist / 40000) * 3600);
          }

          const bounds = window.L.latLngBounds([[driverLat, driverLng], [destLat, destLng]]);
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      } catch (error) {
        console.error("❌ Error fetching routes:", error);
      }
    } else {
      console.log("⚠️ Waiting for driver location...");
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    updateDriverAndRoute();
  }, [driverLat, driverLng, destLat, destLng, selectedRouteId, updateDriverAndRoute]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDistance = (meters: number) => {
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
  };

  const getInstruction = (step: any) => {
    const type = step.maneuver?.type;
    const modifier = step.maneuver?.modifier;
    const name = step.name ? `onto ${step.name}` : "";
    if (type === "depart") return `Head ${modifier || "straight"} ${name}`;
    if (type === "arrive") return `You have arrived at your destination`;
    if (type === "turn") return `Turn ${modifier || ""} ${name}`;
    if (type === "roundabout") return `Take the roundabout ${name}`;
    return `Continue ${name}`;
  };

  return (
    <div className={cn("relative w-full h-[400px] rounded-lg overflow-hidden bg-muted/20 border border-border", className)}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Turn-by-Turn Directions Panel */}
      {showDirections && routes.length > 0 && routes[selectedRouteId]?.steps && (
        <div className="absolute top-4 left-4 z-[1000] w-72 max-h-[80%] bg-background/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4">
          <div className="p-3.5 border-b border-border bg-muted/50 flex justify-between items-center sticky top-0 z-10">
            <h4 className="font-bold text-sm flex items-center gap-2"><RouteIcon className="w-4 h-4 text-[var(--brand)]"/> Directions</h4>
            <button onClick={() => setShowDirections(false)} aria-label="Close directions" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-background/80"><X className="w-4 h-4"/></button>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {routes[selectedRouteId].steps!.map((step: any, i: number) => {
               if (step.distance === 0 && i !== routes[selectedRouteId].steps!.length - 1) return null; // Skip empty intermediate steps
               return (
                <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5 shrink-0 bg-muted w-6 h-6 rounded-full flex items-center justify-center border border-border/50 text-foreground shadow-sm">
                    <Navigation className="w-3 h-3" style={{ transform: `rotate(${step.maneuver?.bearing_after || 0}deg)`}} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground/90">{getInstruction(step)}</p>
                    {step.distance > 0 && <p className="text-xs text-muted-foreground font-semibold mt-1 tracking-wide">{formatDistance(step.distance)}</p>}
                  </div>
                </div>
               );
            })}
          </div>
        </div>
      )}

      {/* Route Options Cards - Bottom */}
      {routes.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] flex gap-2 overflow-x-auto pb-2">
          {routes.map((route, idx) => {
            const isSelected = idx === selectedRouteId;
            const routeColors = ["bg-blue-600", "bg-purple-600", "bg-pink-600", "bg-orange-600"];
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRouteId(idx)}
                className={`flex-shrink-0 px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all cursor-pointer border-2 ${
                  isSelected
                    ? `${routeColors[idx % routeColors.length]} text-white border-white shadow-lg scale-105`
                    : "bg-white/90 text-zinc-900 border-white/50 hover:bg-white hover:scale-105 backdrop-blur-sm"
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className="font-bold">{formatDuration(route.duration)}</div>
                  <div className="text-xs opacity-75">{formatDistance(route.distance)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Floating Map Controls */}
      {driverLat && driverLng && (
        <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (mapRef.current) {
                mapRef.current.flyTo([driverLat, driverLng], 16, { animate: true });
              }
            }}
            className="bg-background/95 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border hover:bg-muted transition-all active:scale-95 text-foreground flex items-center justify-center group"
            title="Center on Driver"
            aria-label="Center on Driver"
          >
            <Crosshair className="w-5 h-5 text-[var(--brand)] group-hover:scale-110 transition-transform" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (mapRef.current) {
                const bounds = window.L.latLngBounds([[driverLat, driverLng], [destLat, destLng]]);
                mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
              }
            }}
            className="bg-background/95 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border hover:bg-muted transition-all active:scale-95 text-foreground flex items-center justify-center group"
            title="Show Full Route"
            aria-label="Show Full Route"
          >
            <Navigation className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <button
            type="button"
            onClick={(e) => { 
              e.preventDefault(); 
              setShowDirections(!showDirections); 
              if (!showDirections && mapRef.current) {
                const bounds = window.L.latLngBounds([[driverLat, driverLng], [destLat, destLng]]);
                mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
              }
            }}
            className={`backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border transition-all active:scale-95 flex items-center justify-center group ${showDirections ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-background/95 border-border hover:bg-muted text-foreground'}`}
            title="Toggle Turn-by-Turn Directions"
            aria-label="Toggle Turn-by-Turn Directions"
            aria-expanded={showDirections}
          >
            <RouteIcon className={`w-5 h-5 transition-transform group-hover:scale-110 ${showDirections ? 'text-blue-600' : 'text-blue-500'}`} />
          </button>
        </div>
      )}

      {(!driverLat || !driverLng) && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border text-sm font-medium text-foreground flex items-center gap-3 transition-all">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          Waiting for driver location...
        </div>
      )}
    </div>
  );
}

// ─── MAPPICKER COMPONENT ───
export function MapPicker({ lat = -1.2921, lng = 36.8219, onPick, className }: MapPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const searchLat = parseFloat(data[0].lat);
        const searchLng = parseFloat(data[0].lon);
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([searchLat, searchLng], 15);
          markerRef.current.setLatLng([searchLat, searchLng]);
          onPick(searchLat, searchLng);
        }
      } else {
        toast.error("Location not found");
      }
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const init = usePersistFn(async () => {
    try {
      await loadLeaflet();

      if (!mapContainer.current || !window.L) {
        console.error("Map container not found or Leaflet not loaded");
        return;
      }

      mapRef.current = window.L.map(mapContainer.current, { zoomControl: false }).setView([lat, lng], 15);
      window.L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Add draggable marker
      const pickerIcon = window.L.divIcon({
        html: `
          <div class="flex flex-col items-center drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)] cursor-pointer" style="transform: translate(-50%, -100%);">
            <div class="bg-[var(--brand)] w-10 h-10 rounded-full rounded-br-none -rotate-45 flex items-center justify-center border-[3px] border-white z-10 transition-transform active:scale-95 hover:scale-105">
              <div class="w-3 h-3 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        className: "custom-marker-overflow-visible",
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      markerRef.current = window.L.marker([lat, lng], { icon: pickerIcon, draggable: true }).addTo(mapRef.current);

      const handleMarkerMove = () => {
        const pos = markerRef.current.getLatLng();
        onPick(pos.lat, pos.lng);
      };

      markerRef.current.on("dragend", handleMarkerMove);

      // Click on map to place marker
      mapRef.current.on("click", (e: any) => {
        markerRef.current.setLatLng(e.latlng);
        onPick(e.latlng.lat, e.latlng.lng);
      });
    } catch (error) {
      console.error("Failed to initialize map picker:", error);
      toast.error("Failed to load map");
    }
  });

  useEffect(() => {
    init();

    return () => {
      if (mapRef.current) {
        if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [init]);

  return (
    <div className={cn("relative w-full h-[400px] rounded-lg overflow-hidden", className)}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-md">
        <form onSubmit={handleSearch} className="flex w-full bg-background/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden border border-border transition-all focus-within:ring-2 focus-within:ring-[var(--brand)]/50">
          <Search className="w-5 h-5 text-muted-foreground ml-4 my-auto shrink-0" />
          <input
            type="text"
            placeholder="Search to drop pin..."
            className="flex-1 px-3 py-3.5 bg-transparent text-sm font-medium focus:outline-none placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <div className="pr-4 my-auto"><div className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div></div>}
        </form>
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
