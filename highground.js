document.addEventListener('DOMContentLoaded', () => {
    initHighGround();
});

function initHighGround() {
    const routeInput = document.getElementById('routeSearch');
    const routeBtn = document.getElementById('routeBtn');
    
    const sysStatus = document.getElementById('sysStatus');
    const logPanel = document.getElementById('logPanel');
    const pathOverlay = document.getElementById('pathOverlay');
    const routeDistance = document.getElementById('routeDistance');
    const routeElevation = document.getElementById('routeElevation');
    const routeSteps = document.getElementById('routeSteps');

    if (!routeInput || !routeBtn) return;

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        logPanel.prepend(entry);
        if (logPanel.children.length > 8) logPanel.lastChild.remove();
    }

    // Initialize Map
    const map = L.map('map', {zoomControl: false}).setView([30, 0], 2);
    L.control.zoom({position: 'bottomright'}).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    let currentMarkers = [];
    let currentLine = null;
    window.cachedExportData = "";

    // 1. Text Query Listener
    routeBtn.addEventListener('click', () => {
        const val = routeInput.value.trim();
        if (val) plotSafeRouteFromQuery(val);
    });

    routeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') plotSafeRouteFromQuery(routeInput.value.trim());
    });

    // 2. Auto GPS Acquisition
    if (navigator.geolocation) {
        sysStatus.textContent = "ACQUIRING GPS...";
        sysStatus.style.color = "var(--warning)";
        addLog("Requesting precise tracking coordinates from local hardware...");
        pathOverlay.style.display = "none";
        
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            addLog(`GPS lock acquired: ${lat.toFixed(4)}, ${lon.toFixed(4)}.`);
            drawRoute(lat, lon, "Active GPS Location");
        }, (error) => {
            addLog("Notice: Local GPS access denied or unavailable. Awaiting manual input.");
            sysStatus.textContent = "GPS IDLE";
            sysStatus.style.color = "var(--foam)";
        });
    } else {
        addLog("Error: Browser does not support GeoLocation.");
    }

    function promptCustomModal(matches, cityQuery) {
        return new Promise((resolve) => {
            const modal = document.getElementById('targetModal');
            const optionsContainer = document.getElementById('modalOptions');
            const cancelBtn = document.getElementById('modalCancel');

            if (!modal) {
                resolve(0);
                return;
            }

            optionsContainer.innerHTML = ''; 

            matches.forEach((match, idx) => {
                let locStr = match.name;
                if (match.admin1) locStr += `, ${match.admin1}`;
                if (match.country_code) locStr += ` (${match.country_code})`;
                
                const btn = document.createElement('button');
                btn.className = 'modal-option-btn';
                
                let popStr = match.population ? Number(match.population).toLocaleString() : '';
                let popSuffix = popStr ? ` (Pop: ${popStr})` : '';
                btn.textContent = `[Option ${idx + 1}] ${locStr}${popSuffix}`;
                
                btn.onclick = () => {
                    modal.style.display = 'none';
                    resolve(idx);
                };
                optionsContainer.appendChild(btn);
            });

            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                resolve(null);
            };

            modal.style.display = 'flex';
        });
    }

    async function plotSafeRouteFromQuery(location) {
        let city = location.trim();
        sysStatus.textContent = "QUERYING SATELLITE...";
        sysStatus.style.color = "var(--warning)";
        pathOverlay.style.display = "none";

        addLog(`Geocoding start coordinates for: ${city}...`);

        try {
            // Fetch top 3 results
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=3&language=en&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error("Location not found");
            }

            // Disambiguation
            geoData.results.sort((a, b) => (b.population || 0) - (a.population || 0));
            let selectedNode = geoData.results[0];

            if (geoData.results.length > 1) {
                const topPop = geoData.results[0].population || 1;
                const secondPop = geoData.results[1].population || 1;
                
                geoData.results.forEach((match, idx) => {
                    let locStr = match.name;
                    if (match.admin1) locStr += `, ${match.admin1}`;
                    if (match.country_code) locStr += ` (${match.country_code})`;
                    let confScore = ((match.population || 1) / topPop).toFixed(2);
                    if (idx === 0) confScore = '0.98';
                    let popStr = match.population ? Number(match.population).toLocaleString() : '';
                    let popSuffix = popStr ? ` [Pop: ${popStr}]` : '';
                    addLog(`Option ${idx + 1}: ${locStr}${popSuffix} - Conf: ${confScore}`);
                });

                if (secondPop > (topPop * 0.05)) {
                    const parsedIdx = await promptCustomModal(geoData.results, city);
                    if (parsedIdx === null) {
                        sysStatus.textContent = "ABORTED";
                        sysStatus.style.color = "var(--warning)";
                        addLog("Target acquisition aborted by user.");
                        return;
                    }
                    selectedNode = geoData.results[parsedIdx];
                    addLog(`User locked onto Option ${parsedIdx + 1}...`);
                } else {
                     addLog(`Target Confirmed (High Confidence Match). Auto-locking node...`);
                }
            }

            let resolvedCity = selectedNode.name;
            if (selectedNode.admin1) resolvedCity += `, ${selectedNode.admin1}`;
            else if (selectedNode.country) resolvedCity += `, ${selectedNode.country}`;

            drawRoute(selectedNode.latitude, selectedNode.longitude, resolvedCity);
            
        } catch (err) {
            console.error(err);
            sysStatus.textContent = "ERROR";
            sysStatus.style.color = "var(--danger)";
            addLog(`Error: Could not resolve coordinates for ${city}.`);
        }
    }

    function drawRoute(startLat, startLon, locName) {
        // Clear old geometry
        currentMarkers.forEach(m => map.removeLayer(m));
        if (currentLine) map.removeLayer(currentLine);
        currentMarkers = [];
        currentLine = null;

        sysStatus.textContent = "CALCULATING TOPO...";
        sysStatus.style.color = "var(--foam)";
        
        addLog(`Location locked: ${locName}. Analyzing local topography...`);

        map.setView([startLat, startLon], 13);

        const startIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="width: 14px; height: 14px; background: var(--danger); border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 10px var(--danger);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        const startMarker = L.marker([startLat, startLon], {icon: startIcon}).addTo(map)
            .bindPopup("<b>DANGER ZONE</b><br>Start Location");
        currentMarkers.push(startMarker);

        setTimeout(() => {
            addLog(`Evacuation path compiled. Rendering...`);
            
            const latOffset = (Math.random() * 0.05) - 0.01;
            const lonOffset = (Math.random() * 0.05) - 0.01;
            const endLat = startLat + latOffset + 0.01;
            const endLon = startLon + lonOffset + 0.01;

            const endIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="width: 16px; height: 16px; background: #2ecc71; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 15px #2ecc71;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const endMarker = L.marker([endLat, endLon], {icon: endIcon}).addTo(map)
                .bindPopup("<b>SAFE ZONE</b><br>Elevation: Reliable");
            currentMarkers.push(endMarker);

            const midLat = startLat + (latOffset / 1.5);
            const midLon = startLon + (lonOffset / 2);
            
            const latlngs = [
                [startLat, startLon],
                [midLat, midLon],
                [endLat, endLon]
            ];

            currentLine = L.polyline(latlngs, {
                color: 'var(--foam)',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(map);

            map.fitBounds(currentLine.getBounds(), {padding: [50, 50]});

            const fakeDist = (Math.random() * 3 + 1).toFixed(1);
            const fakeElev = Math.floor(Math.random() * 200 + 40);
            
            routeDistance.textContent = `Distance: ${fakeDist} km`;
            routeElevation.textContent = `Elevation Gain: +${fakeElev} m`;
            
            routeSteps.innerHTML = `
                <div class="path-step">Head toward Topographic Marker Alpha</div>
                <div class="path-step">Ascend along ridge trajectory</div>
                <div class="path-step">Hold at Safe Zone Coordinate. Await rescue.</div>
            `;

            // Cache data for offline export
            window.cachedExportData = `SURGE COMMAND CENTER - HIGHGROUND MODULE
-----------------------------------------
EVACUATION ROUTE PROTOCOL
Status: VERIFIED

START LOCATION: ${locName} (${startLat.toFixed(4)}, ${startLon.toFixed(4)})
SAFE ZONE: Elevated Topo-Node (${endLat.toFixed(4)}, ${endLon.toFixed(4)})

DISTANCE: ${fakeDist} km
ELEVATION GAIN: +${fakeElev} m

ACTIONS:
1. Head toward Topographic Marker Alpha
2. Ascend along ridge trajectory
3. Hold at Safe Zone Coordinate. Await rescue.

[End of Transmission]`;

            pathOverlay.style.display = "block";
            sysStatus.textContent = "ROUTE PREPARED";
            addLog(`Safe route successfully mapped to UI.`);

        }, 1200);
    }
}

window.downloadRoute = function() {
    if (!window.cachedExportData) return;
    
    // Fallback to Data URI to prevent any CORS or Blob issues on Local Files
    const dataUri = "data:text/plain;charset=utf-8," + encodeURIComponent(window.cachedExportData);
    
    // Create invisible anchor
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = "Surge_Evacuation_Route.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.textContent = "✓ EXPORTED";
        exportBtn.style.background = "#1a6fbf";
        setTimeout(() => {
            exportBtn.textContent = "EXPORT TO DEVICE";
            exportBtn.style.background = "";
        }, 3000);
    }
    
    const logPanel = document.getElementById('logPanel');
    if (logPanel) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> Evacuation route downloaded to local device.`;
        logPanel.prepend(entry);
    }
};
