document.addEventListener('DOMContentLoaded', () => {
    initBeacon();
});

function initBeacon() {
    const sosToggle = document.getElementById('sosToggle');
    const strobeToggle = document.getElementById('strobeOnly');
    const audioToggle = document.getElementById('audioOnly');
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
    let isStrobeOnly = false;
    let isAudioOnly = false;

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        logPanel.prepend(entry);
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
        isStrobeOnly = false;
        isAudioOnly = false;
        
        sosToggle.classList.remove('active');
        strobeToggle.classList.remove('active');
        audioToggle.classList.remove('active');
        
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

    strobeToggle.addEventListener('click', () => {
        if (isStrobeOnly) {
            stopAll();
            addLog("Visual signal stopped.");
        } else {
            stopAll();
            isStrobeOnly = true;
            strobeToggle.classList.add('active');
            beaconStatus.textContent = "RED / WHITE STROBE";
            beaconStatus.style.color = "var(--foam)";
            addLog("Visual rescue signal active (Dual Phase).");
            startStrobe('dual');
        }
    });

    audioToggle.addEventListener('click', () => {
        if (isAudioOnly) {
            stopAll();
            addLog("Audio signal stopped.");
        } else {
            stopAll();
            isAudioOnly = true;
            audioToggle.classList.add('active');
            beaconStatus.textContent = "RESCUE WHISTLE ACTIVE";
            beaconStatus.style.color = "var(--foam)";
            addLog("High-pitch survival whistle active.");
            startWhistle();
        }
    });
}
