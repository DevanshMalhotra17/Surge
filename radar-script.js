/* ══════════════════════════════════════════
   SURGE INTEL MODULE — Real API Data & AI Assessment
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initIntelApp();
});

function initIntelApp() {
    // UI Elements
    const cityInput = document.getElementById('citySearch');
    const searchBtn = document.getElementById('searchBtn');
    const sysStatus = document.getElementById('sysStatus');
    const nodeName = document.getElementById('nodeName');
    const nodeCoords = document.getElementById('nodeCoords');
    const logPanel = document.getElementById('logPanel');

    // Intel Dashboard Elements
    const intelDashboard = document.getElementById('intelDashboard');
    const idleState = document.getElementById('idleState');

    // Data Nodes
    const intelWeather = document.getElementById('intelWeather');
    const intelRain = document.getElementById('intelRain');
    const intelFloodStatus = document.getElementById('intelFloodStatus');
    const intelDischarge = document.getElementById('intelDischarge');
    const aiReviewText = document.getElementById('aiReviewText');

    if (!cityInput || !searchBtn) return;

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        logPanel.prepend(entry);
        if (logPanel.children.length > 8) logPanel.lastChild.remove();
    }

    addLog("Initializing Global Sentinel Node...");
    addLog("Standing by for location input...");

    searchBtn.addEventListener('click', () => {
        const val = cityInput.value.trim();
        if (val) processLocation(val);
    });

    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processLocation(cityInput.value.trim());
    });

    // WMO Weather Codes mapping
    const weatherCodes = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
        61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Slight snow", 75: "Heavy snow", 80: "Rain showers", 82: "Violent rain showers",
        95: "Thunderstorm", 99: "Heavy thunderstorm"
    };

    async function processLocation(location) {
        let city = location.trim();
        sysStatus.textContent = "QUERYING...";
        sysStatus.style.color = "var(--warning)";
        nodeName.textContent = city.toUpperCase();

        idleState.style.display = "none";
        intelDashboard.style.display = "none";

        addLog(`Geocoding coordinates for: ${city}...`);

        try {
            // 1. Geocode via Open-Meteo (Fetch Top 3 for disambiguation)
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=3&language=en&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error("Location not found");
            }

            // Sort results by population descending for highest cultural relevance
            geoData.results.sort((a, b) => (b.population || 0) - (a.population || 0));

            // Disambiguation Logging & Confidence Engine
            let selectedNode = geoData.results[0];

            if (geoData.results.length > 1) {
                const topPop = geoData.results[0].population || 1;
                const secondPop = geoData.results[1].population || 1;

                // Print all options to terminal
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

                // Ask user to pick via custom HTML modal if populations are somewhat competitive
                if (secondPop > (topPop * 0.05)) {
                    const parsedIdx = await promptCustomModal(geoData.results, city);

                    if (parsedIdx === null) {
                        sysStatus.textContent = "ABORTED";
                        sysStatus.style.color = "var(--warning)";
                        addLog("Target acquisition aborted by user.");
                        return; // Exit
                    }

                    selectedNode = geoData.results[parsedIdx];
                    addLog(`User locked onto Option ${parsedIdx + 1}...`);
                } else {
                    addLog(`Target Confirmed (High Confidence Match). Auto-locking node...`);
                }
            }

            const locInfo = selectedNode;
            const lat = locInfo.latitude;
            const lon = locInfo.longitude;

            // Build highly specific location name
            let resolvedCity = locInfo.name;
            if (locInfo.admin1) resolvedCity += `, ${locInfo.admin1}`;
            else if (locInfo.country) resolvedCity += `, ${locInfo.country}`;

            city = resolvedCity;
            nodeName.textContent = city.toUpperCase();

            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            nodeCoords.textContent = `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;

            addLog(`Node target established: ${city}. Fetching active model data...`);

            // 2. Fetch Weather Data (Current Rain / Weather Code)
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,weather_code&hourly=precipitation_probability,precipitation`);
            if (!weatherRes.ok) throw new Error("Weather API unreachable");
            const weatherData = await weatherRes.json();

            // 3. Fetch Flood Data (River discharge)
            const floodRes = await fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_median`);
            let floodData = null;
            if (floodRes.ok) {
                floodData = await floodRes.json();
            }

            // Sync Data to Dashboard UI
            sysStatus.textContent = "ONLINE";
            sysStatus.style.color = "var(--foam)";

            updateDashboard(city, weatherData, floodData);

        } catch (err) {
            console.error(err);
            sysStatus.textContent = "ERROR";
            sysStatus.style.color = "var(--danger)";
            addLog(`Error: Could not resolve data for ${city}.`);
            idleState.style.display = "flex";
        }
    }

    function updateDashboard(city, weather, flood) {
        intelDashboard.style.display = "flex";

        // WEATHER LOGIC
        const currWeather = weather.current;
        const code = currWeather.weather_code;
        const condition = weatherCodes[code] || "Variable";
        const prec = currWeather.precipitation; // mm

        intelWeather.textContent = condition;

        // Display logic for trace amounts correctly
        let rainText = `${prec.toFixed(1)} mm/h precipitation`;
        if (prec === 0 && condition.toLowerCase().includes("rain")) {
            rainText = "Trace precipitation (< 0.1 mm/h)";
        } else if (prec === 0 && condition.toLowerCase().includes("snow")) {
            rainText = "Trace snow (< 0.1 mm/h)";
        } else if (prec === 0 && condition.toLowerCase().includes("drizzle")) {
            rainText = "Trace drizzle (< 0.1 mm/h)";
        }
        intelRain.textContent = rainText;

        // Reset colors
        intelWeather.className = "intel-value";
        if (prec > 5 || [65, 82, 95, 99].includes(code)) {
            intelWeather.classList.add("danger");
            addLog("CRITICAL: Severe weather conditions detected.");
        } else if (prec > 1 || [61, 63, 80].includes(code)) {
            intelWeather.classList.add("warning");
            addLog("WARNING: Active precipitation monitored.");
        } else {
            addLog("Note: Weather parameters stable.");
        }

        // FLOOD LOGIC
        let fStatus = "NORMAL";
        let fDischargeTxt = "Data unavailable";
        let isHighRisk = false;

        if (flood && flood.daily && flood.daily.river_discharge && flood.daily.river_discharge.length > 0) {
            // Check the current day's discharge or forecast
            const discharges = flood.daily.river_discharge;
            const medians = flood.daily.river_discharge_median;

            // Just take the first valid data point for simple analysis
            for (let i = 0; i < discharges.length; i++) {
                if (discharges[i] !== null && medians[i] !== null) {
                    const currentD = discharges[i];
                    const medianD = medians[i];

                    fDischargeTxt = `Discharge: ${currentD.toFixed(2)} m³/s (Norm: ${medianD.toFixed(2)})`;

                    if (currentD > medianD * 2) {
                        fStatus = "ELEVATED";
                        isHighRisk = true;
                    }
                    if (currentD > medianD * 4) {
                        fStatus = "CRITICAL";
                        isHighRisk = true;
                    }
                    break;
                }
            }
        }

        intelFloodStatus.textContent = fStatus;
        intelDischarge.textContent = fDischargeTxt;

        intelFloodStatus.className = "intel-value";
        if (fStatus === "ELEVATED") {
            intelFloodStatus.classList.add("warning");
            addLog("NOTICE: Local river discharge metrics are elevated.");
        } else if (fStatus === "CRITICAL") {
            intelFloodStatus.classList.add("danger");
            addLog("ALERT: Overwhelming river discharge detected!");
        }

        // RISK SCORE CALCULATION
        const probs = weather.hourly.precipitation_probability;
        const maxProb = probs.slice(0, 12).reduce((a, b) => Math.max(a, b), 0); // next 12 hours

        let riskScore = 1;
        if (prec > 0.5) riskScore += 1;
        if (prec > 2.0) riskScore += 2;
        if (prec > 5.0) riskScore += 3;

        if (fStatus === "ELEVATED") riskScore += 3;
        if (fStatus === "CRITICAL") riskScore += 5;

        if (maxProb > 40) riskScore += 1;
        if (maxProb > 80) riskScore += 2;

        riskScore = Math.min(10, Math.max(1, riskScore)); // Clamp between 1-10

        const intelRiskScore = document.getElementById('intelRiskScore');
        if (intelRiskScore) {
            intelRiskScore.textContent = `${riskScore} / 10`;
            intelRiskScore.className = "intel-value";
            if (riskScore >= 7) intelRiskScore.classList.add("danger");
            else if (riskScore >= 4) intelRiskScore.classList.add("warning");
        }

        // TRIGGER AI GENERATION
        generateAiReview(city, condition, prec, fStatus, fDischargeTxt, isHighRisk, weather, riskScore);
    }

    let typeInterval = null;

    async function generateAiReview(city, condition, rain, floodStatus, dischargeTxt, isHighRisk, weather, computedRisk) {
        const probs = weather.hourly.precipitation_probability;
        const maxProb = probs.slice(0, 12).reduce((a, b) => Math.max(a, b), 0); // next 12 hours

        let groqApiKey = '';

        // Only attempt to fetch env.txt if NOT running from the local filesystem to prevent jarring red CORS errors.
        if (window.location.protocol !== 'file:') {
            try {
                const envRes = await fetch('env.txt');
                if (envRes.ok) {
                    const envText = await envRes.text();
                    const match = envText.match(/GROQ_API_KEY\s*=\s*['"]?([^'"\n\r]+)['"]?/);
                    if (match) {
                        groqApiKey = match[1].trim();
                    }
                }
            } catch (e) {
                console.log("Could not load env.txt file from server.");
            }
        } else {
            console.log("Running locally via file://. Bypassing env.txt fetch to keep console clean.");
        }

        // Extremely robust fallback for static sites
        // Direct authentication via local storage (prevents GH Push Protection errors)
        groqApiKey = localStorage.getItem('GROQ_API_KEY') || '';
        
        if (!groqApiKey) {
            // If missing, we revert to the prompt to keep the key out of the source code
            const manualKey = prompt("SECURITY ALERT: GitHub Push Protection active.\n\nPlease paste your Groq API Key here. It will be saved locally in your browser only, NOT in the code:");
            if (manualKey) {
                groqApiKey = manualKey.trim();
                localStorage.setItem('GROQ_API_KEY', groqApiKey);
            }
        }

        if (groqApiKey) {
            aiTypewriterUpdate("Establishing secure link to Grok Neural Network...\nAnalyzing local telemetry...");

            try {
                const groqPrompt = `You are 'Grok', an internal data-platform AI for Surge Command Center. Provide a highly objective analytical assessment for ${city}. \nCurrent weather: ${condition}, ${rain.toFixed(1)} mm/h precipitation. \nFlood sensor: ${floodStatus} state (${dischargeTxt}). \nNext 12 hours max rain probability: ${maxProb}%. \nSystem computed Threat Level: ${computedRisk}/10. \nStart your response exactly with: "[SYSTEM ANALYSIS: ${city.toUpperCase()}]\n\n" \nWrite entirely in an objective internal reporting tone. Do NOT address "residents" or "citizens". Use cold, technical phrasing like "System parameters indicate..." or "Mitigation status: Routine". If Threat Level is high, recommend "operational readiness" or "infrastructure action".\nIMPORTANT FORMATTING: Do NOT put blank lines between every single sentence. Group your assessment into exactly 3 sections:\n1. Parameters (Combine weather and flood readings into one paragraph)\n\n2. Key Metrics (A succinct bulleted list)\n\n3. Conclusion (Combine Threat Level and operational recommendation into one paragraph)\nSeparate these 3 sections with exactly one blank line.`;

                const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${groqApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "user", content: groqPrompt }]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    let aiText = data.choices[0].message.content;
                    aiTypewriterUpdate(aiText);
                    return; // Exit if Groq call is successful
                } else {
                    const errorText = await response.text();
                    console.error("Groq API 400 Error. Fallback running. Details:", errorText);
                }
            } catch (err) {
                console.error("Groq Fetch Error:", err);
            }
        }

        // --- Fallback Heuristic Engine ---
        let reviewTemplate = `[SYSTEM ANALYSIS: ${city.toUpperCase()}]\n\n`;
        reviewTemplate += `Executing heuristic review based on live atmospheric and hydrological datasets...\n\n`;

        reviewTemplate += `Observation: Current weather presents as "${condition}" with exactly ${rain.toFixed(1)} mm/h precipitation. Flood sensors report a "${floodStatus}" state (${dischargeTxt}). Over the next 12 hours, extreme precipitation probability peaks at ${maxProb}%.\n\n`;

        if (rain > 5 || floodStatus === "CRITICAL") {
            reviewTemplate += `ASSESSMENT & DIRECTIVE: Immediate action required. The combination of intense atmospheric precipitation and abnormal river discharge puts this sector at HIGH risk of flash flooding. \n\nSuggested Protocol:\n1. Move to HighGround immediately.\n2. Secure all necessary supplies in The Vault.\n3. Keep FlashBeacon ready.\nEvacuation protocols strongly advised.`;
        } else if (rain > 0.5 || floodStatus === "ELEVATED" || maxProb > 50) {
            reviewTemplate += `ASSESSMENT & DIRECTIVE: Use Caution. Conditions are currently manageable, but elevated hydrologic markers combined with a ${maxProb}% chance of upcoming rain indicate a building threat capable of overwhelming local drainage infrastructure.\n\nSuggested Protocol:\n1. Continuously monitor the Surge Intel stream.\n2. Prepare LifeLine systems in case of grid failure.\n3. Avoid subterranean environments.`;
        } else {
            reviewTemplate += `ASSESSMENT & DIRECTIVE: Sector is Stable. Current data telemetry shows no immediate hydrological anomalies. Drainage systems are operating within the standard median flow. Continue normal operations while maintaining standard situational awareness.`;
        }

        aiTypewriterUpdate(reviewTemplate);
    }

    function aiTypewriterUpdate(text) {
        clearInterval(typeInterval);
        aiReviewText.innerHTML = "";
        aiReviewText.classList.add('typing-cursor');

        let i = 0;

        typeInterval = setInterval(() => {
            aiReviewText.textContent = text.substring(0, i);
            i++;
            if (i > text.length) {
                clearInterval(typeInterval);
                aiReviewText.classList.remove('typing-cursor');
            }
        }, 15); // AI Typing speed
    }

    function promptCustomModal(matches, cityQuery) {
        return new Promise((resolve) => {
            const modal = document.getElementById('targetModal');
            const optionsContainer = document.getElementById('modalOptions');
            const cancelBtn = document.getElementById('modalCancel');

            if (!modal) {
                resolve(0); // Safely fallback to first option if HTML missing
                return;
            }

            optionsContainer.innerHTML = ''; // Clear old buttons

            // Populate the modal with exactly 3 buttons
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

            // Display the modal over the UI
            modal.style.display = 'flex';
        });
    }
}
