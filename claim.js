document.addEventListener('DOMContentLoaded', () => {
    initClaimSync();
});

function initClaimSync() {
    const assessmentPanel = document.getElementById('assessmentPanel');
    const roomSelect = document.getElementById('roomSelect');
    const depthSelect = document.getElementById('depthSelect');
    const damageNotes = document.getElementById('damageNotes');
    const downloadReport = document.getElementById('downloadReport');
    const vCoords = document.getElementById('v-coords');
    const vHash = document.getElementById('v-hash');
    const logPanel = document.getElementById('logPanel');
    const cameraViewport = document.getElementById('cameraViewport');
    const canvas = document.getElementById('snapshotCanvas');
    const evidenceGallery = document.getElementById('evidenceGallery');
    const archivesList = document.getElementById('archivesList');
    const captureBtn = document.getElementById('captureBtn');

    let currentCoords = "LAT: --, LON: --";
    let auditData = JSON.parse(localStorage.getItem('surge_claim_evidence')) || []; 
    let archives = JSON.parse(localStorage.getItem('surge_claim_archives')) || [];
    let videoEl = null;

    // Load logs from storage
    const savedLogs = JSON.parse(localStorage.getItem('surge_claim_logs')) || [];
    savedLogs.slice().reverse().forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = log;
        logPanel.appendChild(entry);
    });

    // --- GPS Logic (Single Watcher) ---
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
            currentCoords = `LAT: ${pos.coords.latitude.toFixed(4)}, LON: ${pos.coords.longitude.toFixed(4)}`;
            vCoords.textContent = currentCoords;
        }, err => {
            console.log("GPS restricted");
        }, { 
            enableHighAccuracy: true,
            maximumAge: 5000 
        });
    }

    function addLog(msg) {
        const time = new Date().toTimeString().split(' ')[0];
        const logHtml = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = logHtml;
        logPanel.prepend(entry);
        
        // Persist Logs
        const logs = JSON.parse(localStorage.getItem('surge_claim_logs')) || [];
        logs.push(logHtml);
        if (logs.length > 20) logs.shift();
        localStorage.setItem('surge_claim_logs', JSON.stringify(logs));
        
        if (logPanel.children.length > 8) logPanel.lastChild.remove();
    }

    function generateHash() {
        return Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();
    }

    // --- The "Cool" Bake Logic ---
    function takeSnapshot() {
        if (!videoEl) return;
        
        const timestamp = new Date().toLocaleString();
        const secureID = generateHash();
        const room = roomSelect.value;
        const depth = depthSelect.value;
        
        // 1. Set canvas to internal video resolution
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // 2. Draw raw video frame
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        // 3. Bake "Cool Tool" UI onto the image
        ctx.strokeStyle = '#5eb8ff';
        ctx.lineWidth = 4;
        const pad = 40;
        const len = 60;
        
        // Brackets
        // Top-Left
        ctx.beginPath(); ctx.moveTo(pad, pad+len); ctx.lineTo(pad, pad); ctx.lineTo(pad+len, pad); ctx.stroke();
        // Top-Right
        ctx.beginPath(); ctx.moveTo(canvas.width-pad-len, pad); ctx.lineTo(canvas.width-pad, pad); ctx.lineTo(canvas.width-pad, pad+len); ctx.stroke();
        // Bottom-Left
        ctx.beginPath(); ctx.moveTo(pad, canvas.height-pad-len); ctx.lineTo(pad, canvas.height-pad); ctx.lineTo(pad+len, canvas.height-pad); ctx.stroke();
        // Bottom-Right
        ctx.beginPath(); ctx.moveTo(canvas.width-pad-len, canvas.height-pad); ctx.lineTo(canvas.width-pad, canvas.height-pad); ctx.lineTo(canvas.width-pad, canvas.height-pad-len); ctx.stroke();
        
        // Text Overlays
        ctx.fillStyle = '#5eb8ff';
        ctx.font = 'bold 24px Courier Prime, monospace';
        ctx.fillText(currentCoords, pad + 10, canvas.height - pad - 20);
        ctx.textAlign = 'right';
        ctx.fillText(`SECURE ID: ${secureID}`, canvas.width - pad - 10, canvas.height - pad - 20);
        ctx.textAlign = 'left';
        ctx.font = '18px Courier Prime, monospace';
        ctx.fillText(timestamp, pad + 10, pad + 30);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Visual flash
        const flash = document.createElement('div');
        flash.className = 'flash active';
        cameraViewport.appendChild(flash);
        setTimeout(() => flash.remove(), 400);

        // Save Data
        auditData.push({
            id: secureID,
            img: dataUrl,
            room: room,
            depth: depth,
            notes: damageNotes.value || "None",
            time: timestamp,
            loc: currentCoords
        });

        // UI Feedback
        assessmentPanel.style.display = 'block';
        vHash.textContent = `SECURE ID: ${secureID}`;
        
        renderGallery();
        localStorage.setItem('surge_claim_evidence', JSON.stringify(auditData));
        addLog(`Forensic evidence captured for ${room}.`);
    }

    function renderGallery() {
        evidenceGallery.innerHTML = '';
        if (auditData.length > 0) assessmentPanel.style.display = 'block';
        
        auditData.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'prev-box evidence-item';
            div.innerHTML = `
                <img src="${item.img}">
                <div class="evidence-tag">#${idx + 1}</div>
            `;
            evidenceGallery.appendChild(div);
        });
    }

    function renderArchives() {
        if (archives.length === 0) return;
        archivesList.innerHTML = '';
        archives.slice().reverse().forEach(session => {
            const entry = document.createElement('div');
            entry.style.cssText = "background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--foam);";
            entry.innerHTML = `
                <div>
                    <div style="font-size: 0.8rem; font-weight: bold; color: var(--foam);">${session.room} / ${session.count} Items</div>
                    <div style="font-size: 0.6rem; color: var(--muted);">${session.time}</div>
                </div>
                <div style="font-family: monospace; font-size: 0.7rem;">ID: ${session.masterId}</div>
            `;
            archivesList.appendChild(entry);
        });
    }

    renderGallery(); 
    renderArchives();

    captureBtn.addEventListener('click', takeSnapshot);

    // --- PDF Export Logic ---
    downloadReport.addEventListener('click', () => {
        const reportRoot = document.getElementById('pdfContent');
        reportRoot.innerHTML = ''; // Clear previous

        // Build Header
        const header = `
            <div style="border-bottom: 3px solid #0e4d92; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #0e4d92; margin: 0; font-family: 'Bebas Neue', sans-serif; letter-spacing: 2px;">SURGE FORENSIC AUDIT</h1>
                <p style="font-size: 12px; color: #666;">Generated: ${new Date().toLocaleString()} | Case ID: SRG-${Math.floor(Math.random()*9000+1000)}</p>
            </div>
        `;
        reportRoot.innerHTML += header;

        // Build Gallery in PDF
        auditData.forEach((item, idx) => {
            const section = `
                <div style="margin-bottom: 40px; page-break-inside: avoid;">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #f0f4f8; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                        <h3 style="margin:0; font-size: 14px; color: #0e4d92;">EVIDENCE ITEM #${idx+1} — ${item.room}</h3>
                        <span style="font-family: monospace; font-size: 10px;">ID: ${item.id}</span>
                    </div>
                    <img src="${item.img}" style="width: 100%; border: 1px solid #ddd; margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 12px;">
                        <div>
                            <strong>Metadata:</strong><br>
                            Loc: ${item.loc}<br>
                            Time: ${item.time}<br>
                            Depth: ${item.depth}
                        </div>
                        <div>
                            <strong>Notes:</strong><br>
                            ${item.notes}
                        </div>
                    </div>
                </div>
            `;
            reportRoot.innerHTML += section;
        });

        reportRoot.innerHTML += `<div style="text-align:center; font-size: 10px; color: #999; margin-top: 40px;">End of Forensic Report | Surge Command Center</div>`;

        pdfContent.style.display = 'block';

        const opt = {
            margin: 0.5,
            filename: `Surge_Evidence_Log.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 1.5 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(reportRoot).save().then(() => {
            pdfContent.style.display = 'none';
            
            // Archive this session
            const sessionRecord = {
                masterId: `SRG-${Math.floor(Math.random()*9000+1000)}`,
                time: new Date().toLocaleString(),
                room: roomSelect.value,
                count: auditData.length
            };
            archives.push(sessionRecord);
            localStorage.setItem('surge_claim_archives', JSON.stringify(archives));
            renderArchives();

            addLog("Full Evidence Log Exported and Archived.");
        });
    });

    // Real Camera initialization
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        videoEl = document.createElement('video');
        videoEl.setAttribute('autoplay', '');
        videoEl.setAttribute('muted', '');
        videoEl.setAttribute('playsinline', '');
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';

        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                const simText = cameraViewport.querySelector('.sim-text');
                if (simText) simText.style.display = 'none';
                
                const simView = cameraViewport.querySelector('.camera-sim');
                simView.innerHTML = '';
                simView.appendChild(videoEl);
                videoEl.srcObject = stream;
            })
            .catch(err => {
                addLog("Camera access restricted.");
            });
    }
}
