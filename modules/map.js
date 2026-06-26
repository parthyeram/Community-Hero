// map module (map.js)

let mainMap = null;
let markerClusterGroup = null;
let currentMarkers = [];
let temporaryMarker = null;
let mapClickListener = null;

// Helper to determine status color
function getStatusColor(status) {
    switch (status) {
        case 'Resolved': return 'var(--success)';    // Green
        case 'In Progress': return 'var(--warning)'; // Yellow
        case 'Verified': return '#f97316';           // Orange
        case 'Open':
        default: return 'var(--danger)';             // Red
    }
}

// Helper to get Category Emoji/Icon
function getCategoryIconHtml(category, status) {
    const color = getStatusColor(status);
    let icon = "📍";
    switch (category) {
        case 'Pothole': icon = "🕳️"; break;
        case 'Water Leakage': icon = "💧"; break;
        case 'Streetlight Damage': icon = "💡"; break;
        case 'Waste Management': icon = "🗑️"; break;
        case 'Road Damage': icon = "🛣️"; break;
        case 'Public Safety': icon = "⚠️"; break;
        case 'Infrastructure Damage': icon = "🏢"; break;
    }
    return `<div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: transform 0.2s;">${icon}</div>`;
}

export function initMap(elementId, center = [20.5937, 78.9629], zoom = 5) {
    if (mainMap) {
        mainMap.off();
        mainMap.remove();
    }

    mainMap = L.map(elementId, {
        scrollWheelZoom: true,
        fadeAnimation: true
    }).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mainMap);

    // Initialize marker cluster group if Leaflet.markercluster plugin is available
    if (typeof L.markerClusterGroup === 'function') {
        markerClusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 40
        });
        mainMap.addLayer(markerClusterGroup);
    }

    console.log("Leaflet Map initialized.");
    return mainMap;
}

export function bindMapClick(callback) {
    if (!mainMap) return;

    if (mapClickListener) {
        mainMap.off('click', mapClickListener);
    }

    mapClickListener = (e) => {
        const { lat, lng } = e.latlng;
        
        if (temporaryMarker) {
            mainMap.removeLayer(temporaryMarker);
        }

        temporaryMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'temp-marker-icon',
                html: `<div style="background-color: var(--primary); width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px var(--primary); animation: pulse 1.5s infinite;"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(mainMap);

        callback(lat, lng);
    };

    mainMap.on('click', mapClickListener);
}

export function clearTemporaryMarker() {
    if (mainMap && temporaryMarker) {
        mainMap.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
}

export function setCenter(lat, lng, zoom = 15) {
    if (mainMap) {
        mainMap.setView([lat, lng], zoom);
    }
}

export function renderIssuesOnMap(issues, onMarkerClick) {
    if (!mainMap) return;

    // Clear existing markers
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    } else {
        currentMarkers.forEach(m => mainMap.removeLayer(m));
    }
    currentMarkers = [];

    issues.forEach(issue => {
        const customIcon = L.divIcon({
            className: 'issue-map-marker',
            html: getCategoryIconHtml(issue.category, issue.status),
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });

        const marker = L.marker([issue.lat, issue.lng], { icon: customIcon });

        // Build premium pop-up card
        const popupContent = `
            <div style="font-family: 'Outfit', sans-serif; color: var(--text); padding: 0.5rem; max-width: 240px;">
                <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 20px; background: ${getStatusColor(issue.status)}; color: white; display: inline-block; margin-bottom: 0.5rem;">
                    ${issue.status}
                </span>
                <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 20px; background: rgba(255,255,255,0.1); color: var(--text-muted); display: inline-block; margin-bottom: 0.5rem; margin-left: 0.25rem;">
                    ${issue.severity}
                </span>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 0.25rem 0; color: white;">${issue.title}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.5rem 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${issue.description}
                </p>
                <div style="font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--accent);">By: ${issue.reporterName}</span>
                    <button class="map-view-details-btn" style="background: transparent; border: none; color: var(--primary); font-weight: 600; cursor: pointer; font-size: 0.75rem;" onclick="window.appViewDetails('${issue.id}')">Details &rarr;</button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        
        if (onMarkerClick) {
            marker.on('click', () => onMarkerClick(issue));
        }

        if (markerClusterGroup) {
            markerClusterGroup.addLayer(marker);
        } else {
            marker.addTo(mainMap);
        }
        currentMarkers.push(marker);
    });
}

// Search location name using OpenStreetMap Nominatim API (Free)
export async function searchLocation(queryText) {
    if (!queryText) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=1`;
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (!response.ok) {
            throw new Error("OSM Nominatim lookup failed");
        }
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }
    } catch (e) {
        console.error("OSM Geocoding Error:", e);
    }
    return null;
}

// Track live location markers across different maps (explorer vs. picker)
const liveMarkersMap = new Map();

export function showLiveLocation(mapInstance, lat, lng) {
    if (!mapInstance) return;

    if (liveMarkersMap.has(mapInstance)) {
        mapInstance.removeLayer(liveMarkersMap.get(mapInstance));
    }

    const liveIcon = L.divIcon({
        className: 'live-location-marker',
        html: `<div style="background-color: var(--accent); width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px var(--accent); animation: pulse 1.8s infinite;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const marker = L.marker([lat, lng], { icon: liveIcon })
        .addTo(mapInstance)
        .bindPopup("<b>Your Live Location</b>");

    liveMarkersMap.set(mapInstance, marker);
    mapInstance.setView([lat, lng], 14);
    marker.openPopup();
}

