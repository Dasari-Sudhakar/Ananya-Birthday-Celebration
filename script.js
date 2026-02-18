// ========================================
// GLOBAL STATE
// ========================================
let currentPhotoIndex  = 0;
let currentVideoIndex  = 0;
let photos             = [];
let videos             = [];
let photoTimers        = [];
let fireworksInterval  = null;
let fireworksIntensity = 1;
let fireworksParticles = [];
let fireworksCtx;
let experienceStarted  = false;   // gate: only start after user tap

// DOM
const netflixIntro   = document.getElementById('netflix-intro');
const mainContent    = document.getElementById('main-content');
const photoSlideshow = document.getElementById('photo-slideshow');
const currentPhoto   = document.getElementById('current-photo');
const videoPlayer    = document.getElementById('video-player');
const photoMusic     = document.getElementById('photo-music');
const popupModal     = document.getElementById('popup-modal');
const finalWish      = document.getElementById('final-wish');
const endingScreen   = document.getElementById('ending-screen');
const fireworksCanvas= document.getElementById('fireworks-canvas');
const frameWrapper   = document.getElementById('frameWrapper');
const photoIndexEl   = document.getElementById('photo-index');
const progressBar    = document.getElementById('progress-bar');
const tapPrompt      = document.getElementById('tap-prompt');

// ========================================
// CUSTOM CURSOR
// ========================================
const cursor     = document.getElementById('cursor');
const cursorRing = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
});

(function animateCursor() {
    rx += (mx - rx) * 0.1;
    ry += (my - ry) * 0.1;
    cursorRing.style.left = rx + 'px';
    cursorRing.style.top  = ry + 'px';
    requestAnimationFrame(animateCursor);
})();

// ========================================
// SHOW / HIDE OVERLAYS
// ========================================
function showOverlay(el, display = 'flex') {
    el.style.display = display;
    el.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
    }));
}

function hideOverlay(el, duration = 1200, cb = null) {
    el.style.opacity = '0';
    setTimeout(() => {
        el.style.display = 'none';
        if (cb) cb();
    }, duration);
}

// ========================================
// DYNAMIC FRAME
// ========================================
const PORTRAIT_W  = 420;
const LANDSCAPE_W = 680;
const SQUARE_W    = 520;
const MAX_H       = 0.78;

function applyFrameAspect(w, h) {
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;
    const ratio = w / h;
    let baseW;
    if      (ratio > 1.15) baseW = LANDSCAPE_W;
    else if (ratio < 0.87) baseW = PORTRAIT_W;
    else                   baseW = SQUARE_W;

    const maxByH  = (MAX_H * vh) * ratio;
    const finalW  = Math.min(baseW, maxByH, vw * 0.9);
    frameWrapper.style.width       = finalW + 'px';
    frameWrapper.style.aspectRatio = `${w} / ${h}`;
}

// ========================================
// INIT — show intro, wait for tap to unlock
// audio context, THEN start everything
// ========================================
window.addEventListener('load', () => {
    // Show tap-to-start prompt after intro fades
    setTimeout(() => netflixIntro.classList.add('fade-out'), 8000);
    setTimeout(() => {
        netflixIntro.style.display = 'none';
        // Show tap prompt instead of starting immediately
        showOverlay(tapPrompt, 'flex');
    }, 10000);
});

// ---- TAP / CLICK to unlock audio ----
function userStarted() {
    if (experienceStarted) return;
    experienceStarted = true;

    hideOverlay(tapPrompt, 800, () => {
        mainContent.classList.remove('hidden');
        requestAnimationFrame(() => requestAnimationFrame(() =>
            mainContent.classList.add('visible')
        ));
        playIntroSound();
        startExperience();
    });
}

// ========================================
// INTRO SOUND
// ========================================
function playIntroSound() {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(860, ctx.currentTime + 2.2);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2.2);
    } catch(e) {}
}

// ========================================
// EXPERIENCE START
// ========================================
function startExperience() {
    initFireworks();
    startConfetti();

    // Music — now safe because user just tapped
    photoMusic.volume = 0;
    photoMusic.loop   = true;
    photoMusic.play()
        .then(() => fadeInMusic(2500))
        .catch(err => console.warn('Music blocked:', err));

    loadPhotos();
}

// ========================================
// MUSIC HELPERS
// ========================================
function fadeInMusic(dur = 2000) {
    const steps = 40, interval = dur / steps;
    let s = 0;
    const t = setInterval(() => {
        photoMusic.volume = Math.min(1, ++s / steps);
        if (s >= steps) clearInterval(t);
    }, interval);
}

function fadeOutMusic(dur = 2000, cb = null) {
    if (photoMusic.paused) { cb && cb(); return; }
    const steps = 40, interval = dur / steps;
    const start = photoMusic.volume;
    let s = 0;
    const t = setInterval(() => {
        photoMusic.volume = Math.max(0, start * (1 - ++s / steps));
        if (s >= steps) {
            photoMusic.pause();
            photoMusic.currentTime = 0;
            clearInterval(t);
            cb && cb();
        }
    }, interval);
}

function stopMusicNow() {
    photoMusic.pause();
    photoMusic.currentTime = 0;
}

// ========================================
// PROGRESS BAR
// ========================================
function startProgress(duration) {
    if (!progressBar) return;
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    requestAnimationFrame(() => {
        progressBar.style.transition = `width ${duration}ms linear`;
        progressBar.style.width = '100%';
    });
}

function resetProgress() {
    if (!progressBar) return;
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
}

// ========================================
// PHOTO SLIDESHOW
// ========================================
function loadPhotos() {
    for (let i = 1; i <= 20; i++) photos.push(`photo${i}.jpeg`);
    applyFrameAspect(9, 16);
    showPhoto(0);
}

function showPhoto(index) {
    currentPhotoIndex = index;

    if (index >= photos.length) {
        resetProgress();
        fadeOutMusic(2000, () => {
            photoSlideshow.style.opacity = '0';
            setTimeout(() => { photoSlideshow.style.display = 'none'; }, 600);
            setTimeout(showPopup, 700);
        });
        return;
    }

    if (photoIndexEl) photoIndexEl.textContent = `${index + 1} / ${photos.length}`;

    currentPhoto.style.opacity = '0';
    currentPhoto.src = photos[index];

    currentPhoto.onload = () => {
        const nw = currentPhoto.naturalWidth  || 1;
        const nh = currentPhoto.naturalHeight || 1;
        applyFrameAspect(nw, nh);
        setTimeout(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                currentPhoto.style.opacity = '1';
            }));
        }, 80);
        startProgress(3000);
    };

    const hold = setTimeout(() => {
        currentPhoto.style.opacity = '0';
        resetProgress();
        const next = setTimeout(() => showPhoto(index + 1), 700);
        photoTimers.push(next);
    }, 3000);
    photoTimers.push(hold);
}

// ========================================
// POPUP
// ========================================
function showPopup() {
    showOverlay(popupModal, 'flex');
    setTimeout(() => hideOverlay(popupModal, 1400, loadAndPlayVideos), 10000);
}

// ========================================
// VIDEOS — music always stopped before play
// ========================================
function loadAndPlayVideos() {
    stopMusicNow();   // hard stop — no crossfade needed here
    for (let i = 1; i <= 6; i++) videos.push(`video${i}.mp4`);
    playVideo(0);
}

function playVideo(index) {
    currentVideoIndex = index;
    if (index >= videos.length) {
        videoPlayer.classList.add('hidden');
        showFinalWish();
        return;
    }

    photoSlideshow.style.display = 'none';
    videoPlayer.classList.remove('hidden');
    videoPlayer.muted  = false;
    videoPlayer.volume = 1;
    videoPlayer.src    = videos[index];
    videoPlayer.load();

    // Since user already tapped, play should work with sound
    videoPlayer.play().catch(() => {
        // Fallback: muted if still blocked (rare)
        videoPlayer.muted = true;
        videoPlayer.play().catch(() => {});
    });

    videoPlayer.onended = () => playVideo(index + 1);
}

// ========================================
// FINAL WISH
// ========================================
function showFinalWish() {
    showOverlay(finalWish, 'flex');
    setTimeout(() => hideOverlay(finalWish, 2500, playFinalVideo), 5000);
}

function playFinalVideo() {
    videoPlayer.classList.remove('hidden');
    videoPlayer.muted  = false;
    videoPlayer.volume = 1;
    videoPlayer.src    = 'finalwish.mp4';
    videoPlayer.load();
    videoPlayer.play().catch(() => {
        videoPlayer.muted = true;
        videoPlayer.play().catch(() => {});
    });
    videoPlayer.onended = () => showEndingScreen();
}

// ========================================
// ENDING SCREEN
// ========================================
function showEndingScreen() {
    videoPlayer.classList.add('hidden');
    intensifyFireworks();
    showOverlay(endingScreen, 'flex');
}

// ========================================
// RESTART — full clean reset without reload
// ========================================
function restartExperience() {
    // Stop all media
    stopMusicNow();
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.classList.add('hidden');

    // Clear all photo timers
    photoTimers.forEach(t => clearTimeout(t));
    photoTimers = [];

    // Reset state
    currentPhotoIndex  = 0;
    currentVideoIndex  = 0;
    photos             = [];
    videos             = [];
    fireworksIntensity = 1;
    fireworksParticles = [];
    clearInterval(fireworksInterval);

    // Hide all screens
    hideOverlay(endingScreen, 0);
    hideOverlay(finalWish,    0);
    hideOverlay(popupModal,   0);

    // Reset slideshow
    photoSlideshow.style.display   = '';
    photoSlideshow.style.opacity   = '1';
    currentPhoto.src               = '';
    currentPhoto.style.opacity     = '0';
    resetProgress();
    applyFrameAspect(9, 16);

    // Restart fireworks and confetti (already running, just reset intensity)
    fireworksInterval = setInterval(launchFirework, 1100);

    // Re-kick music and photos
    photoMusic.volume = 0;
    photoMusic.loop   = true;
    photoMusic.play()
        .then(() => fadeInMusic(2500))
        .catch(() => {});

    loadPhotos();
}

// ========================================
// FIREWORKS
// ========================================
function initFireworks() {
    fireworksCanvas.width  = window.innerWidth;
    fireworksCanvas.height = window.innerHeight;
    fireworksCtx = fireworksCanvas.getContext('2d');
    fireworksInterval = setInterval(launchFirework, 1100);
    drawFireworks();
}

function launchFirework() {
    const palette = [
        '#c9a96e','#e8d5a3','#d4b896',
        '#a09070','#ffffff','#e0d0b8',
        '#b8a888','#c8b090'
    ];
    const x     = 0.1 * fireworksCanvas.width + Math.random() * 0.8 * fireworksCanvas.width;
    const y     = Math.random() * fireworksCanvas.height * 0.55;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const count = Math.round(38 * fireworksIntensity);

    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1.8 + Math.random() * 4;
        fireworksParticles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color, alpha: 1,
            size: 1 + Math.random() * 2
        });
    }
    const specks = Math.round(12 * fireworksIntensity);
    for (let i = 0; i < specks; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.4 + Math.random() * 2;
        fireworksParticles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            color: '#ffffff', alpha: 0.7,
            size: 0.6 + Math.random() * 0.9
        });
    }
}

function drawFireworks() {
    fireworksCtx.fillStyle = 'rgba(0,0,0,0.18)';
    fireworksCtx.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);

    fireworksParticles = fireworksParticles.filter(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.038;
        p.vx *= 0.985;
        p.alpha -= 0.016;
        if (p.alpha > 0) {
            fireworksCtx.save();
            fireworksCtx.globalAlpha = p.alpha;
            fireworksCtx.fillStyle   = p.color;
            fireworksCtx.shadowColor = p.color;
            fireworksCtx.shadowBlur  = p.size * 2.5;
            fireworksCtx.beginPath();
            fireworksCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            fireworksCtx.fill();
            fireworksCtx.restore();
            return true;
        }
        return false;
    });
    requestAnimationFrame(drawFireworks);
}

function intensifyFireworks() {
    fireworksIntensity = 3;
    clearInterval(fireworksInterval);
    fireworksInterval = setInterval(launchFirework, 220);
}

window.addEventListener('resize', () => {
    fireworksCanvas.width  = window.innerWidth;
    fireworksCanvas.height = window.innerHeight;
});

// ========================================
// CONFETTI
// ========================================
function startConfetti() {
    const L = document.getElementById('confetti-left');
    const R = document.getElementById('confetti-right');
    setInterval(() => { makeConfetti(L); makeConfetti(R); }, 220);
}

function makeConfetti(container) {
    const tones = [
        '#c9a96e88','#e8d5a366','#b8a09066',
        '#d4c4a855','#a09878aa','#ffffff44'
    ];
    const el = document.createElement('div');
    el.className = 'confetti';
    const size  = 4 + Math.random() * 6;
    const dur   = 3 + Math.random() * 3;
    const delay = Math.random() * 0.6;
    el.style.cssText = `
        background: ${tones[Math.floor(Math.random() * tones.length)]};
        width: ${Math.random() > 0.45 ? size * 0.45 : size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        animation-duration: ${dur}s;
        animation-delay: ${delay}s;
        border-radius: ${Math.random() > 0.5 ? '50%' : '1px'};
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 200);
}

// ========================================
// ERROR HANDLING
// ========================================
currentPhoto.onerror = () => {
    currentPhoto.style.opacity = '0';
    setTimeout(() => showPhoto(currentPhotoIndex + 1), 300);
};
videoPlayer.onerror = () => playVideo(currentVideoIndex + 1);