document.addEventListener('DOMContentLoaded', () => {
    initLifeLine();
});

function initLifeLine() {
    const output = document.getElementById('messageOutput');
    const customInput = document.getElementById('customMsg');
    const sendBtn = document.getElementById('sendBtn');
    const quickKeys = document.querySelectorAll('.key-btn');
    const queueCount = document.getElementById('queueCount');
    const logPanel = document.getElementById('logPanel');

    let queuedCount = 0;

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        logPanel.prepend(entry);
    }

    function sendMessage(text) {
        if (!text) return;

        const time = new Date().toTimeString().split(' ')[0];
        const msgDiv = document.createElement('div');
        msgDiv.className = 'msg-user';
        msgDiv.innerHTML = `
            <div>${text}</div>
            <div class="msg-status" id="status-${Date.now()}">PENDING SYNC...</div>
        `;
        output.appendChild(msgDiv);
        output.scrollTop = output.scrollHeight;

        queuedCount++;
        queueCount.textContent = queuedCount;
        addLog("Signal queued for transmission.");

        // Simulate delivery delay
        const statusEl = msgDiv.querySelector('.msg-status');
        setTimeout(() => {
            statusEl.textContent = "QUEUED ON SAT-A23";
            statusEl.style.color = "var(--foam)";
        }, 1500);

        setTimeout(() => {
            statusEl.textContent = "DELIVERED";
            statusEl.style.color = "#2ecc71";
            queuedCount--;
            queueCount.textContent = queuedCount;
            addLog("Signal delivery confirmed.");
        }, 6000 + Math.random() * 4000);
    }

    sendBtn.addEventListener('click', () => {
        sendMessage(customInput.value);
        customInput.value = '';
    });

    customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(customInput.value);
            customInput.value = '';
        }
    });

    quickKeys.forEach(btn => {
        btn.addEventListener('click', () => {
            sendMessage(btn.getAttribute('data-msg'));
        });
    });
}
