/* ══════════════════════════════════════════
   SURGE GLOBAL SCRIPT — Core Interactions
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initScrollInteractions();
    initMobileMenu();
    initParticles();
    initScrollReveal();
});

// ── CUSTOM CURSOR ──
function initCursor() {
    const cursor = document.getElementById('cursor');
    const ring = document.getElementById('cursorRing');
    if (!cursor || !ring) return;

    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
    });

    (function animRing() {
        rx += (mx - rx) * 0.14; ry += (my - ry) * 0.14;
        ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
        requestAnimationFrame(animRing);
    })();

    // Cursor hover effects on interactive elements
    const links = document.querySelectorAll('a, button, .check-item, .app-tile, .form-input, .form-select');
    links.forEach(link => {
        link.addEventListener('mouseenter', () => {
            cursor.style.transform = 'translate(-50%,-50%) scale(2.5)';
            cursor.style.background = 'rgba(94, 184, 255, 0.4)';
            ring.style.width = '50px'; ring.style.height = '50px';
            ring.style.opacity = '0.8';
        });
        link.addEventListener('mouseleave', () => {
            cursor.style.transform = 'translate(-50%,-50%) scale(1)';
            cursor.style.background = 'var(--foam)';
            ring.style.width = '36px'; ring.style.height = '36px';
            ring.style.opacity = '0.5';
        });
    });
}

// ── SCROLL BAR ──
function initScrollInteractions() {
    const bar = document.getElementById('scrollBar');
    if (!bar) return;

    window.addEventListener('scroll', () => {
        const sc = document.body.scrollHeight - window.innerHeight;
        if (sc > 0) {
            const pct = window.scrollY / sc * 100;
            bar.style.width = pct + '%';
        }
    });
}

// ── MOBILE MENU ──
function initMobileMenu() {
    const navToggle = document.getElementById('navToggle');
    const navTabs = document.getElementById('navTabs');
    if (!navToggle || !navTabs) return;

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('open');
        navTabs.classList.toggle('open');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            navToggle.classList.remove('open');
            navTabs.classList.remove('open');
        });
    });
}

// ── PARTICLES ──
function initParticles() {
    const pCont = document.getElementById('particles');
    if (!pCont) return;

    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `
            left:${Math.random() * 100}%;
            bottom:${Math.random() * 30}%;
            --dur:${6 + Math.random() * 10}s;
            --delay:${Math.random() * 8}s;
            --drift:${(Math.random() - 0.5) * 60}px;
            width:${1 + Math.random() * 2}px; height:${1 + Math.random() * 2}px;
        `;
        pCont.appendChild(p);
    }
}

// ── SCROLL REVEAL ──
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length === 0) return;

    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
            }
        });
    }, { threshold: 0.12 });

    reveals.forEach(r => obs.observe(r));
}
