'use client';

import { useEffect, useRef } from 'react';
import type { LocationInfo, ServerInfo } from '@/lib/engine/types';

/**
 * NetworkMap — a dark, ambient Leaflet map showing the user's location and
 * nearby synthetic server nodes with animated connection paths.
 *
 * Leaflet is loaded dynamically (client-only) to keep it out of the SSR bundle
 * and the initial critical path.
 */

interface NetworkMapProps {
  location: LocationInfo | null;
  nodes: ServerInfo[];
  className?: string;
}

export default function NetworkMap({ location, nodes, className }: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      // Inject Leaflet CSS once.
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current || mapRef.current) return;

      const center: [number, number] = location
        ? [location.lat, location.lng]
        : [26.7271, 88.3953];

      const map = L.map(containerRef.current, {
        center,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // User location marker — pulsing aurora dot.
      if (location) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:18px;height:18px">
            <div style="position:absolute;inset:0;border-radius:50%;background:#5ee7e0;box-shadow:0 0 14px #5ee7e0"></div>
            <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid #5ee7e0;opacity:.5;animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite"></div>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker(center, { icon: userIcon }).addTo(map);
      }

      // Server nodes + connection lines.
      nodes.forEach((node, i) => {
        if (i === 0) return; // skip the local edge (same as user)
        const nodeIcon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#9d8cff;box-shadow:0 0 10px #9d8cff;border:1px solid rgba(255,255,255,.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([node.lat, node.lng], { icon: nodeIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui;color:#11141e"><strong>${node.label}</strong><br/>${node.distanceKm ?? '–'} km away</div>`,
          );

        L.polyline([center, [node.lat, node.lng]], {
          color: '#5ee7e0',
          weight: 1,
          opacity: 0.35,
          dashArray: '4 8',
        }).addTo(map);
      });

      // Keyframes for the pulsing marker.
      if (!document.getElementById('map-ping-style')) {
        const style = document.createElement('style');
        style.id = 'map-ping-style';
        style.textContent = `@keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}`;
        document.head.appendChild(style);
      }

      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [location, nodes]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-3xl overflow-hidden ${className ?? ''}`}
      style={{ minHeight: 280 }}
    />
  );
}
