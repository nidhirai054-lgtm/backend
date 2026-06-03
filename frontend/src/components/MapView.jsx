import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const pickupIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#10b981;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">A</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const dropoffIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#ef4444;width:32px;height:32px;border-radius:50%;border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">B</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const FitBounds = ({ pickup, dropoff }) => {
  const map = useMap();
  
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    }
  }, [pickup, dropoff, map]);
  
  return null;
};

const MapView = ({ userLocation, drivers = [], pickup, dropoff }) => {
  const center = pickup 
    ? [pickup.lat, pickup.lng]
    : [userLocation?.lat || 12.9716, userLocation?.lng || 77.5946];

  // Guard against invalid coordinates
  if (!center[0] || !center[1] || isNaN(center[0]) || isNaN(center[1])) {
    return <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-400 text-sm">Loading map...</div>;
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Pickup marker */}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-emerald-600">Pickup</p>
                <p className="text-xs">{pickup.address}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Dropoff marker */}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-red-600">Dropoff</p>
                <p className="text-xs">{dropoff.address}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Line between pickup and dropoff */}
        {pickup && dropoff && (
          <Polyline
            positions={[
              [pickup.lat, pickup.lng],
              [dropoff.lat, dropoff.lng]
            ]}
            color="#10b981"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
        
        {/* User location (only if no pickup) */}
        {!pickup && userLocation?.lat && userLocation?.lng && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup><div className="text-sm font-bold">You are here</div></Popup>
          </Marker>
        )}
        
        {/* Drivers */}
        {drivers.map((driver, index) => (
          driver.lat && driver.lng ? (
            <Marker
              key={driver.id || index}
              position={[driver.lat, driver.lng]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(0,0,0,0.2);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              })}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{driver.name}</p>
                  <p className="text-gray-500">{driver.vehicle_type}</p>
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
        
        <FitBounds pickup={pickup} dropoff={dropoff} />
      </MapContainer>
    </div>
  );
};

export default MapView;