import { useEffect, useRef, useState, type ReactNode } from "react";

import { awsEnv } from "../../config/env";
import type { GeoPoint } from "../../domain/types";

export interface GoogleTourismMapItem {
  id: string;
  label: string;
  location: GeoPoint;
  order?: number;
}

interface GoogleTourismMapProps<T extends GoogleTourismMapItem> {
  items: readonly T[];
  current?: GeoPoint | null;
  selectedId?: string;
  onSelect: (item: T) => void;
  ariaLabel: string;
  className: string;
  fallback: ReactNode;
}

declare global {
  interface Window {
    google?: any;
    __ehimeGoogleMapsReady?: () => void;
  }
}

let loader: Promise<any> | null = null;
function loadGoogleMaps(key: string): Promise<any> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    window.__ehimeGoogleMapsReady = () => resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker&loading=async&callback=__ehimeGoogleMapsReady`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps JavaScript API failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    loader = null;
    throw error;
  });
  return loader;
}

export function GoogleTourismMap<T extends GoogleTourismMapItem>({
  items,
  current,
  selectedId,
  onSelect,
  ariaLabel,
  className,
  fallback,
}: GoogleTourismMapProps<T>): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = awsEnv.googleMapsBrowserApiKey;

  useEffect(() => {
    if (!key || !hostRef.current) return;
    let cancelled = false;
    const markers: any[] = [];
    let line: any = null;

    void loadGoogleMaps(key).then((google) => {
      if (cancelled || !hostRef.current) return;
      const map = new google.maps.Map(hostRef.current, {
        center: { lat: 33.84, lng: 132.77 },
        zoom: 9,
        mapId: awsEnv.googleMapsMapId ?? "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
      });
      const bounds = new google.maps.LatLngBounds();
      items.forEach((item) => {
        bounds.extend(item.location);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `google-tourism-marker${selectedId === item.id ? " google-tourism-marker--selected" : ""}`;
        button.textContent = item.order ? String(item.order) : "•";
        button.setAttribute("aria-label", item.label);
        button.addEventListener("click", () => onSelect(item));
        markers.push(new google.maps.marker.AdvancedMarkerElement({
          map,
          position: item.location,
          title: item.label,
          content: button,
        }));
      });
      if (current) bounds.extend(current);
      if (items.length > 0 || current) map.fitBounds(bounds, 56);

      const route = items.filter((item) => item.order).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (route.length > 1) {
        line = new google.maps.Polyline({
          map,
          path: route.map((item) => item.location),
          strokeColor: "#e87524",
          strokeOpacity: 0.9,
          strokeWeight: 5,
          geodesic: true,
        });
      }
    }).catch((error) => {
      console.error("[GoogleTourismMap] Google Maps unavailable", error);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      markers.forEach((marker) => { marker.map = null; });
      line?.setMap(null);
    };
  }, [key, items, current, selectedId, onSelect]);

  if (!key || failed) return <>{fallback}</>;
  return <div ref={hostRef} className={`${className} google-tourism-map`} role="group" aria-label={ariaLabel} />;
}