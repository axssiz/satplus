"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export type MapPoint = { id: string; lat: number; lng: number; title: string; href: string };

const icon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--primary);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function StoresMap({ points }: { points: MapPoint[] }) {
  const center: [number, number] = [points[0].lat, points[0].lng];
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-72 w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
          <Popup>
            <a href={p.href}>{p.title}</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
