/* =========================================
   1. CONFIGURATION & SETUP
   ========================================= */
// 🛑 YOUR KEYS (Keep your existing working keys here!)
const SUPABASE_URL = "https://pdyqlszfeiqccuprgras.supabase.co";
const SUPABASE_KEY = "sb_publishable_io3DL7Qe_D9SbAB0-boPdw_AiJwUwx8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Music Library
const MUSIC_LIBRARY = {
    romantic: "music/romantic.mp3",
    peppy: "music/peppy.mp3",
    lofi: "music/lofi.mp3"
};

// Question Mapping
const QUESTION_LIBRARY = {
    valentine: "Will you be my Valentine?",
    prom: "Will you be my Prom Date?",
    date: "Will you go on a date with me?",
    marriage: "Will you marry me?",
    player2: "Will you be my Player 2?"
};

// GIF Library (Dynamic Cute GIFs)
const GIF_LIBRARY = {
    valentine: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2JiZDR0a3lvMDF4OGJyeXp4M3lzMnN5MnVudmZ6bWYzM3Z5YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/cLS1cfxvGOPVpf9g3y/giphy.gif", // Cute Bear
    prom: "https://media.giphy.com/media/l0HlCqV35hdEg2PN6/giphy.gif", // Dancing
    date: "https://media.giphy.com/media/26FLdmIp6wJr91J4k/giphy.gif", // Cat begging
    marriage: "https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif", // Ring
    player2: "https://media.giphy.com/media/TrDxCdtmdluP6/giphy.gif" // Mario/Gaming
};

let giftData = null;
let audio = document.getElementById('bg-music');

/* =========================================
   2. INITIALIZATION
   ========================================= */
window.addEventListener('DOMContentLoaded', async () => {
    // Start Floating Hearts immediately
    createHearts();

    const urlParams = new URLSearchParams(window.location.search);
    const giftId = urlParams.get('id');

    if (!giftId) {
        showError("No Gift ID found. Please check your link.");
        return;
    }

    const { data, error } = await supabaseClient
        .from('gifts')
        .select('*')
        .eq('id', giftId)
        .single();

    if (error || !data) {
        console.error("Error:", error);
        showError("Gift not found. It might have expired.");
        return;
    }

    giftData = data;
    setupEnvelope(data);

    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('envelope-layer').classList.remove('hidden');
});

function showError(msg) {
    document.getElementById('loading-screen').innerHTML = `<p>${msg}</p>`;
}

/* =========================================
   3. ENVELOPE LOGIC (SLOW & SMOOTH)
   ========================================= */
function setupEnvelope(data) {
    document.getElementById('envelope-name').innerText = data.recipient_name;
}

function openEnvelope() {
    const envelopeLayer = document.getElementById('envelope-layer');
    const envelope = document.querySelector('.envelope');

    // 1. Trigger Animation
    envelope.classList.add('open');

    // 2. Wait for SLOW animation (2.5 seconds total)
    setTimeout(() => {
        envelopeLayer.style.opacity = '0';

        // Reveal content & Play Music
        document.getElementById('main-content').classList.remove('hidden');
        renderGiftContent();
        playMusic();

        // Remove layer
        setTimeout(() => {
            envelopeLayer.classList.add('hidden');
        }, 1000);

    }, 2500); // Increased wait time for smooth effect
}

/* =========================================
   4. RENDER CONTENT
   ========================================= */
function renderGiftContent() {
    const data = giftData;

    // A. Music
    const songPath = MUSIC_LIBRARY[data.music_vibe] || MUSIC_LIBRARY['romantic'];
    document.getElementById('music-source').src = songPath;
    audio.load();

    // B. Question & GIF
    const questionText = QUESTION_LIBRARY[data.question_type] || data.question_type;
    document.getElementById('main-question').innerText = questionText;

    // Set the Dynamic GIF
    const gifUrl = GIF_LIBRARY[data.question_type] || GIF_LIBRARY['valentine'];
    // We need to insert the img tag if it doesn't exist or update it
    let gifImg = document.getElementById('gif-container');
    if (!gifImg) {
        // Create if missing
        gifImg = document.createElement('img');
        gifImg.id = 'gif-container';
        gifImg.style.width = '200px';
        gifImg.style.borderRadius = '10px';
        // Insert before buttons
        const btnContainer = document.querySelector('.buttons');
        btnContainer.parentNode.insertBefore(gifImg, btnContainer);
    }
    gifImg.src = gifUrl;

    // C. Timer
    if (data.start_date) {
        document.getElementById('counter-section').classList.remove('hidden');
        startTimer(data.start_date);
    }

    // D. Note
    if (data.love_note) {
        document.getElementById('note-section').classList.remove('hidden');
        typeWriter(data.love_note, 'typewriter-text');
    }

    // E. Gallery
    const gallery = document.getElementById('gallery-container');
    gallery.innerHTML = ''; 

    // 1. SAFE PARSING: Handle if Supabase gave us a String instead of a List
    let memoriesList = data.memories;
    if (typeof memoriesList === 'string') {
        try {
            memoriesList = JSON.parse(memoriesList);
        } catch (e) {
            console.error("Could not parse memories JSON:", e);
            memoriesList = [];
        }
    }

    // 2. FILTER & RENDER: Only show photos that actually have a URL
    if (memoriesList && Array.isArray(memoriesList) && memoriesList.length > 0) {
        
        // Filter out empty slots (where user didn't upload a photo)
        const validMemories = memoriesList.filter(m => m.url && m.url.trim() !== "");

        if (validMemories.length > 0) {
            validMemories.forEach((mem, index) => {
                const rot = index % 2 === 0 ? '-2deg' : '2deg';
                const html = `
                    <div class="memory-card" style="transform: rotate(${rot})">
                        <img src="${mem.url}" onclick="openLightbox(this)" alt="Memory">
                        <div class="caption">${mem.caption || ''}</div>
                    </div>
                `;
                gallery.innerHTML += html;
            });
        } else {
            // Case: List existed but all URLs were empty
            gallery.innerHTML = '<p>Just us, no photos needed. ❤️</p>';
        }
    } else {
        // Case: No list found
        gallery.innerHTML = '<p>Just us, no photos needed. ❤️</p>';
    }
}

/* =========================================
   5. VISUAL EFFECTS (HEARTS & TYPING)
   ========================================= */

function createHearts() {
    const heartBg = document.getElementById('heart-bg');
    if (!heartBg) {
        console.error("Heart background element not found!");
        return;
    }

    // Create 20 hearts
    for (let i = 0; i < 20; i++) {
        const heart = document.createElement('span');
        // Random styles for natural look
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.animationDuration = Math.random() * 5 + 5 + 's';
        heart.style.animationDelay = Math.random() * 5 + 's';
        heartBg.appendChild(heart);
    }
}

/* =========================================
   ANIMATED HAND TYPEWRITER (With Scribble)
   ========================================= */
function typeWriter(text, elementId, speed = 50) {
    let i = 0;
    const textField = document.getElementById('typed-text');
    const hand = document.getElementById('hand-cursor');
    
    // Reset
    textField.innerHTML = "";
    hand.classList.remove('hand-hidden');
    
    // START SCRIBBLING
    hand.classList.add('is-writing');
    
    function type() {
        if (i < text.length) {
            let char = text.charAt(i);
            if (char === '\n') char = '<br>';
            
            textField.innerHTML += char;
            
            // Optional: Pause scribbling on spaces for realism?
            // (Comment out the next 3 lines if you want constant shaking)
            if (char === ' ') {
                hand.classList.remove('is-writing');
            } else {
                hand.classList.add('is-writing');
            }

            i++;
            
            // Randomize typing speed for human feel
            const randomSpeed = Math.floor(Math.random() * (100 - 30 + 1) + 30);
            setTimeout(type, randomSpeed);
            
        } else {
            // STOP WRITING
            hand.classList.remove('is-writing');
            
            // Hide hand after a second
            setTimeout(() => {
                hand.classList.add('hand-hidden');
            }, 1000);
        }
    }
    
    type();
}
/* =========================================
   6. HELPERS (Timer, Lightbox, Music)
   ========================================= */
function startTimer(startDateStr) {
    const start = new Date(startDateStr).getTime();
    setInterval(() => {
        const now = new Date().getTime();
        const diff = now - start;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('timer').innerText = `${days} Days : ${hours} Hrs : ${mins} Mins`;
    }, 1000);
}

function openLightbox(img) {
    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    lbImg.src = img.src;
    lb.classList.add('active');
}
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

/* =========================================
   SMART MUSIC PLAYER (Fade In / Fade Out)
   ========================================= */
function playMusic() {
    const audio = document.getElementById('bg-music');

    // 1. Reset state
    audio.volume = 0;
    audio.currentTime = 0;

    // 2. Start Playing
    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(_ => {
            // 3. Fade In (0 to 1 over 2 seconds)
            fadeIn(audio);

            // 4. Watch for end of song to Fade Out
            monitorAudio(audio);
        })
            .catch(error => {
                console.log("Autoplay blocked. Waiting for interaction.");
            });
    }
}

function fadeIn(audio) {
    let fadePoint = 0;
    const fadeInterval = setInterval(() => {
        // Increase volume by 0.05 every 100ms
        if (fadePoint < 1.0) {
            fadePoint += 0.05;
            // Cap at 1.0
            audio.volume = Math.min(fadePoint, 1.0);
        } else {
            clearInterval(fadeInterval);
        }
    }, 100);
}

function fadeOut(audio) {
    let fadePoint = audio.volume;
    const fadeInterval = setInterval(() => {
        // Decrease volume
        if (fadePoint > 0) {
            fadePoint -= 0.05;
            audio.volume = Math.max(0, fadePoint);
        } else {
            clearInterval(fadeInterval);
            // Once silent, loop the song
            audio.currentTime = 0;
            audio.play();
            fadeIn(audio);
        }
    }, 100);
}

function monitorAudio(audio) {
    let isFadingOut = false;

    audio.addEventListener('timeupdate', () => {
        // If we are 4 seconds from the end, start fading out
        if ((audio.duration - audio.currentTime < 4) && !isFadingOut) {
            isFadingOut = true;
            fadeOut(audio);
        }

        // Reset flag if we jumped back to start
        if (audio.currentTime < 10) {
            isFadingOut = false;
        }
    });
}

/* =========================================
   7. PROPOSAL INTERACTION
   ========================================= */
const noBtn = document.getElementById('no-btn');
const yesBtn = document.querySelector('.btn-yes');
const rejectionTexts =
    [
        "Are you sure?",
        "Really sure?",
        "Think again!",
        "Last chance!",
        "Surely not?",
        "You might regret this!",
        "Give it another thought!",
        "I'm going to cry...",
        "This is breaking my heart ;(", "Pls? 🥺"
    ];

let clickCount = 0;

function rejectProposal() {
    clickCount++;
    if (clickCount < rejectionTexts.length) {
        noBtn.innerText = rejectionTexts[clickCount];
    } else {
        noBtn.style.display = 'none';
    }
    const currentSize = parseFloat(window.getComputedStyle(yesBtn).fontSize);
    yesBtn.style.fontSize = `${currentSize * 1.3}px`;
}

function acceptProposal() {
    document.querySelector('.buttons').style.display = 'none';
    document.getElementById('success-message').classList.remove('hidden');
    document.getElementById('main-question').innerText = "SHE SAID YES! ❤️";
    // Change GIF to Happy Bear
    const gifImg = document.getElementById('gif-container');
    if (gifImg) gifImg.src = "https://media.tenor.com/gUiu1zyxfzYAAAAi/bear-kiss-bear-kisses.gif";

    launchConfetti();
}

function launchConfetti() {
    for (let i = 0; i < 50; i++) {
        const heart = document.createElement('div');
        heart.innerHTML = '🎉';
        heart.style.position = 'fixed';
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.top = '-10vh';
        heart.style.fontSize = '2rem';
        heart.style.animation = `floatUp 3s ease-in forwards`;
        document.body.appendChild(heart);
    }
}