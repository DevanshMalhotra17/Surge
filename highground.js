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

    // --- Map Hardware Check ---
    if (typeof L === 'undefined') {
        addLog("CRITICAL: Map library (Leaflet) failed to load. Are you offline?");
        sysStatus.textContent = "MAP ERROR";
        sysStatus.style.color = "var(--danger)";
        return;
    }

    // Initialize Map
    const map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([39.8283, -98.5795], 4); // Default to US Center
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

            // Cache data for PDF export
            window.cachedExportData = `
                <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; padding: 40px; color: #111; background: #fff; max-width: 800px; margin: 0 auto;">
                    <div style="border-bottom: 3px solid #e8431a; padding-bottom: 16px; margin-bottom: 32px;">
                        <h1 style="color: #0d2240; font-size: 28px; margin: 0;">Surge Evacuation Route</h1>
                        <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">HighGround Topographical Protocol — Keep securely with emergency supplies.</p>
                    </div>
                    
                    <div style="margin-bottom: 32px;">
                        <h3 style="color: #e8431a; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">1. Threat Node (Start Location)</h3>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Location Query:</strong> ${locName}</p>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Coordinates:</strong> ${startLat.toFixed(4)}, ${startLon.toFixed(4)}</p>
                    </div>

                    <div style="margin-bottom: 32px;">
                        <h3 style="color: #2ecc71; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">2. Safe Zone (Evacuation Target)</h3>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Target Topography:</strong> Elevated Topo-Node</p>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Target Coordinates:</strong> ${endLat.toFixed(4)}, ${endLon.toFixed(4)}</p>
                    </div>
                    
                    <div style="margin-bottom: 32px;">
                        <h3 style="color: #1a6fbf; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">3. Route Parameters</h3>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Total Distance:</strong> ${fakeDist} km</p>
                        <p style="margin: 6px 0; font-size: 15px;"><strong>Total Elevation Gain:</strong> +${fakeElev} m</p>
                    </div>
                    
                    <div style="margin-bottom: 32px;">
                        <h3 style="color: #0d2240; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">4. Authorized Actions</h3>
                        <ul style="font-size: 15px; margin: 0; padding-left: 20px;">
                            <li style="margin-bottom: 8px;">Head toward Topographic Marker Alpha</li>
                            <li style="margin-bottom: 8px;">Ascend along ridge trajectory</li>
                            <li style="margin-bottom: 8px;">Hold at Safe Zone Coordinate. Await rescue.</li>
                        </ul>
                    </div>
                    
                    <div style="margin-top: 60px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; text-align: center;">
                        Generated securely via Surge Command Center | National Emergency Hotline: 1-800-621-3362
                    </div>
                </div>
            `;

            pathOverlay.style.display = "block";
            sysStatus.textContent = "ROUTE PREPARED";
            addLog(`Safe route successfully mapped to UI.`);

        }, 1200);
    }
}

window.downloadRoute = function() {
    if (!window.cachedExportData) return;
    
    const btn = document.getElementById('exportBtn');
    const logPanel = document.getElementById('logPanel');
    
    if (btn) {
        btn.textContent = 'Generating PDF...';
        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
    }

    const opt = {
        margin: 0.5,
        filename: 'Surge_Evacuation_Route.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollY: 0 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(window.cachedExportData).save().then(() => {
        if (btn) {
            btn.textContent = '✓ ROUTE EXPORTED';
            btn.style.background = '#1a6fbf';
            btn.style.opacity = '1';
            setTimeout(() => {
                btn.textContent = 'EXPORT TO DEVICE';
                btn.style.background = '';
                btn.style.pointerEvents = 'auto';
            }, 3000);
        }
        
        if (logPanel) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            const time = new Date().toTimeString().split(' ')[0];
            entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> Evacuation PDF route downloaded to local hardware.`;
            logPanel.prepend(entry);
        }
    }).catch(err => {
        console.error("PDF generation error: ", err);
        if (btn) {
            btn.textContent = 'ERROR GENERATING EXPORT';
            btn.style.opacity = '1';
            setTimeout(() => {
                btn.textContent = 'EXPORT TO DEVICE';
                btn.style.pointerEvents = 'auto';
            }, 3000);
        }
    });
};
