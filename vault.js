document.addEventListener('DOMContentLoaded', () => {
    initVault();
});

function initVault() {
    const supplyList = document.getElementById('supplyList');
    const readinessScore = document.getElementById('readinessScore');
    const addItemBtn = document.getElementById('addItemBtn');
    const itemModal = document.getElementById('itemModal');
    const closeModal = document.getElementById('closeModal');
    const saveItem = document.getElementById('saveItem');
    const logPanel = document.getElementById('logPanel');

    // Initial default items
    let supplies = JSON.parse(localStorage.getItem('surge_supplies')) || [
        { id: 1, name: "Canned Water (24pk)", exp: "2027-12-01" },
        { id: 2, name: "Heavy Duty Flashlight", exp: "2028-06-15" },
        { id: 3, name: "Alnico Batteries", exp: "2024-10-10" },
        { id: 4, name: "First Aid Trauma Kit", exp: "2025-05-20" }
    ];

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const time = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span style="color:var(--foam)">[${time}]</span> ${msg}`;
        logPanel.prepend(entry);
    }

    function calculateReadiness() {
        if (supplies.length === 0) {
            readinessScore.textContent = "0%";
            return;
        }
        const now = new Date();
        const valid = supplies.filter(item => new Date(item.exp) > now).length;
        const score = Math.round((valid / supplies.length) * 100);
        readinessScore.textContent = `${score}%`;
        readinessScore.style.color = score > 70 ? '#2ecc71' : score > 40 ? 'var(--warning)' : 'var(--danger)';
    }

    function renderSupplies() {
        supplyList.innerHTML = '';
        const now = new Date();

        supplies.sort((a, b) => new Date(a.exp) - new Date(b.exp)).forEach(item => {
            const expDate = new Date(item.exp);
            const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
            
            let statusClass = 'status-ok';
            let statusText = 'Good';

            if (diffDays < 0) {
                statusClass = 'status-expired';
                statusText = 'EXPIRED';
            } else if (diffDays < 30) {
                statusClass = 'status-expiring';
                statusText = 'EXPIRING SOON';
            }

            const el = document.createElement('div');
            el.className = 'supply-item';
            el.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-date">Expires: ${item.exp}</div>
                </div>
                <div style="display:flex; align-items:center; gap: 15px;">
                    <span class="item-status ${statusClass}">${statusText}</span>
                    <span class="delete-btn" onclick="deleteItem(${item.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                    </span>
                </div>
            `;
            supplyList.appendChild(el);
        });
        calculateReadiness();
        localStorage.setItem('surge_supplies', JSON.stringify(supplies));
    }

    window.deleteItem = (id) => {
        supplies = supplies.filter(s => s.id !== id);
        addLog("Item removed from manifest.");
        renderSupplies();
    };

    addItemBtn.addEventListener('click', () => {
        itemModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        itemModal.style.display = 'none';
    });

    saveItem.addEventListener('click', () => {
        const name = document.getElementById('itemName').value;
        const exp = document.getElementById('itemExp').value;

        if (name && exp) {
            supplies.push({
                id: Date.now(),
                name,
                exp
            });
            renderSupplies();
            itemModal.style.display = 'none';
            addLog(`New supply [${name}] added to vault.`);
            document.getElementById('itemName').value = '';
            document.getElementById('itemExp').value = '';
        }
    });

    renderSupplies();
}
