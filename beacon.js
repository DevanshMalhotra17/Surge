document.addEventListener('DOMContentLoaded', () => {
    initBeacon();
});

function initBeacon() {
    const sosToggle = document.getElementById('sosToggle');
    const strobeOverlay = document.getElementById('strobeOverlay');
    const stopStrobeBtn = document.getElementById('stopStrobeBtn');
    const beaconStatus = document.getElementById('beaconStatus');
    const logPanel = document.getElementById('logPanel');

    let audioCtx = null;
    let oscillator = null;
    let gainNode = null;
    
    let strobeInterval = null;
    let sosPulseTimeout = null;
    
    let isSOSActive = false;

    // Load logs from storage
    const savedLogs = JSON.parse(localStorage.getItem('surge_beacon_logs')) || [];
    savedLogs.slice().reverse().forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = log;
        logPanel.appendChild(entry);
    });

    function addLog(msg) {
        const time = new Date().toTimeString().split(' ')[0];
        const logHtml = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = logHtml;
        logPanel.prepend(entry);

        // Persist Logs
        const logs = JSON.parse(localStorage.getItem('surge_beacon_logs')) || [];
        logs.push(logHtml);
        if (logs.length > 20) logs.shift();
        localStorage.setItem('surge_beacon_logs', JSON.stringify(logs));

        if (logPanel.children.length > 8) logPanel.lastChild.remove();
    }

    // --- Audio Logic ---
    function startWhistle() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        oscillator = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(3000, audioCtx.currentTime); // 3kHz survival whistle
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05); // Smooth fade in
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
    }

    function stopWhistle() {
        if (gainNode) {
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
            setTimeout(() => {
                if (oscillator) oscillator.stop();
                oscillator = null;
            }, 60);
        }
    }

    // --- Strobe Logic ---
    function startStrobe(mode = 'white') {
        strobeOverlay.classList.add('active');
        let step = 0;
        
        strobeInterval = setInterval(() => {
            // mode 'sos' is red-only pulsing for contrast, 'dual' (the new strobe only) will flip
            strobeOverlay.classList.remove('flash-red', 'flash-white');
            
            if (mode === 'sos') {
                if (step === 0) strobeOverlay.classList.add('flash-red');
                step = (step + 1) % 2;
            } else {
                // Dual Cycle: Red -> Clear -> White -> Clear
                if (step === 0) strobeOverlay.classList.add('flash-red');
                if (step === 2) strobeOverlay.classList.add('flash-white');
                step = (step + 1) % 4;
            }
        }, 100); 
    }

    function stopStrobe() {
        clearInterval(strobeInterval);
        strobeOverlay.classList.remove('active', 'flash-red', 'flash-white');
    }

    // --- SOS Pattern Logic ---
    // Morse SOS: ... --- ... (3 short, 3 long, 3 short)
    const morsePattern = [
        200, 200, 200, 200, 200, // S (dot, space, dot, space, dot)
        600, // char gap
        600, 200, 600, 200, 600, // O (dash, space, dash, space, dash)
        600, // char gap
        200, 200, 200, 200, 200, // S
        1500 // word gap
    ];

    let patternIdx = 0;
    function pulseSOS() {
        if (!isSOSActive) return;

        const duration = morsePattern[patternIdx];
        const isBeep = patternIdx % 2 === 0;

        if (isBeep) {
            startWhistle();
            strobeOverlay.classList.add('active', 'flash-red');
        } else {
            stopWhistle();
            strobeOverlay.classList.remove('flash-red');
        }

        patternIdx = (patternIdx + 1) % morsePattern.length;
        sosPulseTimeout = setTimeout(pulseSOS, duration);
    }

    function stopAll() {
        isSOSActive = false;
        
        sosToggle.classList.remove('active');
        
        stopWhistle();
        stopStrobe();
        clearTimeout(sosPulseTimeout);
        
        beaconStatus.textContent = "READY / LISTENING";
        beaconStatus.style.color = "";
        patternIdx = 0;
    }

    stopStrobeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAll();
        addLog("Emergency signal manually terminated.");
    });

    // --- Event Listeners ---
    sosToggle.addEventListener('click', () => {
        if (isSOSActive) {
            stopAll();
            addLog("SOS Signal Deactivated.");
        } else {
            stopAll();
            isSOSActive = true;
            sosToggle.classList.add('active');
            beaconStatus.textContent = "BROADCASTING SOS";
            beaconStatus.style.color = "var(--danger)";
            addLog("SOS signal started. Keep screen visible to the sky.");
            pulseSOS();
        }
    });
}
