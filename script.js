let SIZE = 6; 
const tileTypes = [
    { txt: "①", color: "#e63946" }, { txt: "②", color: "#3a86ff" }, { txt: "③", color: "#8338ec" },
    { txt: "④", color: "#ff006e" }, { txt: "⑤", color: "#fb5607" }, { txt: "⑥", color: "#ffbe0b" },
    { txt: "⑦", color: "#06d6a0" }, { txt: "⑧", color: "#118ab2" }, { txt: "⑨", color: "#4a5759" },
    { txt: "⑩", color: "#2a9d8f" }, { txt: "⑪", color: "#e76f51" }, { txt: "⑫", color: "#a8dadc" },
    { txt: "🍎", color: "#ff4d6d" }, { txt: "💎", color: "#00b4d8" }, { txt: "🌟", color: "#ffb703" },
    { txt: "🍀", color: "#38b000" }, { txt: "🔥", color: "#ff4a00" }, { txt: "👾", color: "#a2d2ff" },
    { txt: "🐱", color: "#ffb5a7" }, { txt: "🐼", color: "#f0f0f0" }, { txt: "🚀", color: "#90e0ef" },
    { txt: "👻", color: "#e0aaff" }, { txt: "🍕", color: "#ffb703" }, { txt: "🍩", color: "#ff85a1" },
    { txt: "🌍", color: "#48cae4" }, { txt: "🏁", color: "#ffffff" }, { txt: "👑", color: "#ffbe0b" }
];

let blocks = [];
let selected = null;

let currentScore = 0;
let highScore = 0; 
let timeLeft = 120;
let timerId = null;
let isGameOver = false;
let isPaused = false; 

// 🌟 初期のゲーム起動時は定位置でスタンバイ
let rotX = 60;   
let rotZ = -45;  
let skipStageRotationOnce = false;

// 🌟 【Web Audio API】効果音用の音声回路
let audioCtx = null;

const soundBank = {
    select: null,
    clear: null,
    error: null,
    timeup: null,
    start: null,
    countdown: null,
};

// 🎵 【BGMシステム】
const bgmList = ["sounds/bgm_1.mp3", "sounds/bgm_2.mp3", "sounds/bgm_3.mp3"];
let currentActiveBGM = null; 
let isSoundEnabled =
    localStorage.getItem("cube_sound_enabled") !== "false";
function playRandomBGM() {
    if (!isSoundEnabled) return;
    
    try {
        if (currentActiveBGM) {
            currentActiveBGM.pause();
            currentActiveBGM = null;
        }

        let randomTrack = bgmList[Math.floor(Math.random() * bgmList.length)];
        currentActiveBGM = new Audio(randomTrack);
        currentActiveBGM.loop = true;
        currentActiveBGM.volume = 0.20; 

        currentActiveBGM.play().catch(e => console.log("BGM再生ブロック回避:", e));
    } catch(e) {
        console.log("BGMシャッフルエラー:", e);
    }
}

function debugLog(text) {
    const el = document.getElementById("debug-text");
    if (el) el.innerText = text;
}

function playWebAudio(bufferName) {
    if (!isSoundEnabled) return;

    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const bufferObj = soundBank[bufferName];
    if (!audioCtx || !bufferObj) return;

    try {
        let bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = bufferObj;
        bufferSource.connect(audioCtx.destination); 
        bufferSource.start(0);
    } catch (e) {
        console.log("Web Audio再生エラー:", e);
    }
}

function playCountdownBeep() {
    if (!isSoundEnabled) return;

    initAudioSystem();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime + 0.01;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
}

function playCountdownFastBeep() {
    if (!isSoundEnabled) return;

    initAudioSystem();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime + 0.01;

    for (let i = 0; i < 2; i++) {
        const t = now + i * 0.16;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(1600, t);

        gain.gain.setValueAtTime(0.30, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.1);
    }
}

async function loadSoundToBuffer(fileName) {
    if (!audioCtx) return null;
    let soundUrl = "sounds/" + fileName;
    try {
        let response = await fetch(soundUrl);
        let arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (err) {
        console.log(fileName + " のロード失敗:", err);
        return null;
    }
}

let isAudioLoading = false;

function initAudioSystem() {
    if (isAudioLoading) return;

    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!audioCtx) {
            audioCtx = new AudioContext();
        }

        isAudioLoading = true;

        loadSoundToBuffer("select_1.mp3").then(buf => {
            if (buf) soundBank.select = buf;
        });

        loadSoundToBuffer("clear_1.mp3").then(buf => {
            if (buf) soundBank.clear = buf;
        });

        loadSoundToBuffer("error_1.mp3").then(buf => {
            if (buf) soundBank.error = buf;
        });

        loadSoundToBuffer("timeup_1.mp3").then(buf => {
            if (buf) soundBank.timeup = buf;
        });

        loadSoundToBuffer("start_1.mp3").then(buf => {
            if (buf) soundBank.start = buf;
        });

    } catch(e) {
        console.log("Web Audio初期化失敗:", e);
    }
}

function getDynamicSizes() {
    const isPC = window.innerWidth >= 960;
    let dynamicCubeSize = 35;
    if (SIZE === 5) {
        dynamicCubeSize = isPC ? 48 : 40;
    } else {
        dynamicCubeSize = isPC ? 40 : 35;
    }
    const offset = (SIZE - 1) * dynamicCubeSize / 2;
    const halfSize = dynamicCubeSize / 2;
    return { dynamicCubeSize, offset, halfSize };
}

function loadHighScore() {
    const savedScore = localStorage.getItem(`egebro_highscore_sz${SIZE}`);
    if (savedScore !== null) {
        highScore = parseInt(savedScore, 10);
    } else {
        highScore = 0;
    }
    document.getElementById("best-score").innerText = highScore;
}

function updateScoreDisplay(scoreValue) {
    currentScore = scoreValue;
    document.getElementById("score").innerText = currentScore;
    
    if (currentScore > highScore) {
        highScore = currentScore;
        document.getElementById("best-score").innerText = highScore;
        localStorage.setItem(`egebro_highscore_sz${SIZE}`, highScore); 
    }
}

function createTilePool(totalRequired) {
    const pool = [];

    for (let i = 0; i < totalRequired; i++) {
        const t = tileTypes[i % tileTypes.length];
        pool.push({ ...t });
    }

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
    }

    return pool;
}

function resetGameState() {
    blocks = [];
    selected = null;
    isGameOver = false;
    isPaused = false;
}

function clearStage(stage) {
    while (stage.firstChild) {
        stage.removeChild(stage.firstChild);
    }
}

function hidePauseOverlay() {
    const pauseOverlay = document.getElementById("pause-overlay");

    if (pauseOverlay) {
        pauseOverlay.style.display = "none";
        pauseOverlay.style.opacity = "0";
    }
}

function resetGameUI() {
    updateScoreDisplay(0);
    loadHighScore();

    document.getElementById("status").innerText =
        "1つ目のブロックを選んでください";

    document.getElementById("status").style.color = "#38bdf8";
}

function startGameTimer() {
    timeLeft = 120;
    updateTimerUI();

    clearInterval(timerId);
    timerId = setInterval(countdown, 1000);
}

function createCubeElement(dynamicCubeSize) {
    const cube = document.createElement("div");
    cube.className = "cube";

    cube.style.width = dynamicCubeSize + "px";
    cube.style.height = dynamicCubeSize + "px";

    return cube;
}

function createBlockData(tile, cube, x, y, z) {
    return {
        txt: tile.txt,
        color: tile.color,
        element: cube,
        active: true,
        hasFaces: false,
        x,
        y,
        z
    };
}

function isInnerCube(x, y, z) {
    const hasLeft = x > 0;
    const hasRight = x < SIZE - 1;
    const hasFront = y > 0;
    const hasBack = y < SIZE - 1;
    const hasBottom = z > 0;
    const hasTop = z < SIZE - 1;

    return (
        hasLeft &&
        hasRight &&
        hasFront &&
        hasBack &&
        hasBottom &&
        hasTop
    );
}

function createBlocks(pool, fragment, dynamicCubeSize, offset, halfSize) {
    let index = 0;

    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            for (let z = 0; z < SIZE; z++) {

                const tile = pool[index++];
                const cube = createCubeElement(dynamicCubeSize);

                updateCubePosition(
                    cube,
                    x,
                    y,
                    z,
                    offset,
                    dynamicCubeSize
                );

                const blockData =
                    createBlockData(tile, cube, x, y, z);

                cube.addEventListener("click", (e) => {
                    e.stopPropagation();
                    handleClick(blockData);
                });

                if (isInnerCube(x, y, z)) {
                    cube.style.display = "none";
                } else {
                    createFacesForCube(
                        blockData,
                        halfSize,
                        dynamicCubeSize
                    );
                }

                fragment.appendChild(cube);
                blocks.push(blockData);
            }
        }
    }
}

function applyInitialStageRotation() {
    if (!skipStageRotationOnce) {
        updateStageRotation();
    }

    skipStageRotationOnce = false;
}

function initGame() {

    const stage = document.getElementById("stage");
    if (!stage) return;

    clearStage(stage);
    resetGameState();
    hidePauseOverlay();
    resetGameUI();
    startGameTimer();

    const totalRequired = SIZE * SIZE * SIZE;
    const pool = createTilePool(totalRequired);

    const {
        dynamicCubeSize,
        offset,
        halfSize
    } = getDynamicSizes();

    const fragment = document.createDocumentFragment();

    createBlocks(
        pool,
        fragment,
        dynamicCubeSize,
        offset,
        halfSize
    );

    stage.appendChild(fragment);

    updateCount();
    applyInitialStageRotation();
}
    
function createFacesForCube(b, halfSize, dynamicCubeSize) {
        if (b.hasFaces) return; 
        
        const faces = [
            { name: 'top', style: `transform: translateZ(${halfSize}px);` },
            { name: 'bottom', style: `transform: rotateX(180deg) translateZ(${halfSize}px);` },
            { name: 'front', style: `transform: rotateX(-90deg) translateZ(${halfSize}px);` },
            { name: 'back', style: `transform: rotateX(90deg) translateZ(${halfSize}px);` },
            { name: 'right', style: `transform: rotateY(90deg) translateZ(${halfSize}px);` },
            { name: 'left', style: `transform: rotateY(-90deg) translateZ(${halfSize}px);` }
        ];
    
        faces.forEach(f => {
            const face = document.createElement("div");
            face.className = `face ${f.name}`;
            face.style.cssText = f.style;
            
            face.style.width = dynamicCubeSize + "px";
            face.style.height = dynamicCubeSize + "px";
            
            face.style.backgroundColor = b.color;
            face.innerText = b.txt;
            
            const windowIsPC = window.innerWidth >= 960;
            face.style.fontSize = windowIsPC ? (SIZE === 5 ? "26px" : "22px") : (SIZE === 5 ? "22px" : "18px");
            
            if (b.txt.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/) || b.txt.length > 2 || b.txt.charCodeAt(0) > 255) {
                face.style.fontSize = windowIsPC ? "16px" : "14px"; 
            }
            b.element.appendChild(face);
        });
        b.hasFaces = true;
}

function updateCubePosition(cube, x, y, z, offset, dynamicCubeSize) {
    const px = (x * dynamicCubeSize) - offset;
    const py = (y * dynamicCubeSize) - offset;
    const pz = (z * dynamicCubeSize) - offset;

    cube.style.transform =
        `translate3d(${px}px, ${py}px, ${pz}px)`;
}

/*gptにより追加*/
function playStageIntroAnimation(stage) {
    if (!stage) return;

    const fromTransform = "rotateX(0deg) rotateZ(0deg)";
    const toTransform = "rotateX(60deg) rotateZ(-45deg)";

    stage.style.transition = "none";
    stage.style.transform = fromTransform;

    // Safari / iPhone Chrome 対策：レイアウト確定
    stage.offsetWidth;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIOS && stage.animate) {
        const anim = stage.animate(
            [
                { transform: fromTransform },
                { transform: toTransform }
            ],
            {
                duration: 500,
                easing: "ease-out",
                fill: "forwards"
            }
        );

        anim.onfinish = () => {
            rotX = 60;
            rotZ = -45;
            stage.style.transition = "transform 0.5s ease-out";
            stage.style.transform = toTransform;
        };
    } else {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                rotX = 60;
                rotZ = -45;
                stage.style.transition = "transform 0.5s ease-out";
                stage.style.transform = toTransform;
            });
        });
    }
}

function updateSoundButtonUI() {
    const btn = document.getElementById("sound-toggle-btn");
    if (!btn) return;

    btn.innerText = isSoundEnabled ? "🔊" : "🔇";
    btn.setAttribute(
        "aria-label",
        isSoundEnabled ? "サウンドON" : "サウンドOFF"
    );
}

function stopAllSounds() {
    try {
        if (currentActiveBGM) {
            currentActiveBGM.pause();
            // nullにしない。ミュート解除時に続きから再生するため
        }
    } catch (e) {}

    // WebAudioは止めたいが、AudioContextはsuspendしない
    // iPhoneで復帰が重くなることがあるため
}

function showTimeUpOverlay() {
    const overlay = document.getElementById("timeup-overlay");
    const scoreEl = document.getElementById("timeup-score");
    const stage = document.getElementById("stage");

    if (scoreEl) {
        scoreEl.innerText = currentScore;
    }

    if (overlay) {
        overlay.style.display = "flex";
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
            fadeFromBlack();
        });
    }
}

function showClearOverlay(finalScore, timeBonus, clearBonus) {
    const overlay = document.getElementById("clear-overlay");
    const scoreEl = document.getElementById("clear-score");
    const timeBonusEl = document.getElementById("clear-time-bonus");
    const clearBonusEl = document.getElementById("clear-clear-bonus");
    const rankEl = document.getElementById("clear-rank");
const recordEl = document.getElementById("clear-new-record");

    if (scoreEl) scoreEl.innerText = finalScore;
    if (timeBonusEl) timeBonusEl.innerText = timeBonus;
    if (clearBonusEl) clearBonusEl.innerText = clearBonus;
    
    if (rankEl) rankEl.innerText = "★★★";
if (recordEl) recordEl.innerText = "";
    

    if (overlay) {
        overlay.style.display = "flex";
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
            fadeFromBlack();
        });
    }
}

function fadeToBlack(callback) {
    const fade = document.getElementById("screen-fade");

    if (!fade) {
        if (callback) callback();
        return;
    }

    fade.style.opacity = "1";

    setTimeout(() => {
        if (callback) callback();
    }, 350);
}



function fadeFromBlack() {
    const fade = document.getElementById("screen-fade");

    if (!fade) return;

    requestAnimationFrame(() => {
        fade.style.opacity = "0";
    });
}

function returnToTitle() {
    playWebAudio("select");

    const overlay = document.getElementById("timeup-overlay");
    const clearOverlay = document.getElementById("clear-overlay");
    const pauseOverlay = document.getElementById("pause-overlay");
    const startOverlay = document.getElementById("start-overlay");
    const stage = document.getElementById("stage");

    setTimeout(() => {
        try {
            if (currentActiveBGM) {
                currentActiveBGM.pause();
                currentActiveBGM.currentTime = 0;
                currentActiveBGM = null;
            }
        } catch(e) {}

        fadeToBlack(() => {
            clearInterval(timerId);
            isGameOver = true;
            isPaused = false;

            if (overlay) {
                overlay.style.opacity = "0";
                overlay.style.display = "none";
            }

            if (clearOverlay) {
                clearOverlay.style.opacity = "0";
                clearOverlay.style.display = "none";
            }

            if (pauseOverlay) {
                pauseOverlay.style.opacity = "0";
                pauseOverlay.style.display = "none";
            }

            blocks = [];
            selected = null;

            rotX = 60;
            rotZ = -45;

            if (stage) {
                stage.innerHTML = "";
                stage.style.transition = "none";
                stage.style.opacity = "1";
                stage.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
            }

            document.body.classList.remove("game-started");

            if (startOverlay) {
                startOverlay.style.display = "flex";
                startOverlay.style.opacity = "1";
            }

            fadeFromBlack();
        });
    }, 200);
}

async function shareResult(resultType) {
    playWebAudio("select");

    const label = resultType === "clear" ? "CLEAR!" : "TIME UP";

    const shareText =
        `CUBE dev ${label}\n` +
        `SCORE: ${currentScore} pt\n` +
        `BEST: ${highScore} pt\n` +
        `#CUBEdev`;

    const shareData = {
        title: "CUBE dev",
        text: shareText,
        url: location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (e) {
            console.log("共有キャンセル:", e);
        }
    } else {
        const xUrl =
            "https://twitter.com/intent/tweet?text=" +
            encodeURIComponent(shareText) +
            "&url=" +
            encodeURIComponent(location.href);

        window.open(xUrl, "_blank");
    }
}

function setupShareButtons() {

    const timeupShareBtn =
        document.getElementById("timeup-share-btn");

    if (timeupShareBtn) {
        timeupShareBtn.addEventListener("click", () => {
            shareResult("timeup");
        });
    }

    const clearShareBtn =
        document.getElementById("clear-share-btn");

    if (clearShareBtn) {
        clearShareBtn.addEventListener("click", () => {
            shareResult("clear");
        });
    }
}

function setupSoundButtons() {

    const soundBtn =
        document.getElementById("sound-toggle-btn");

    if (soundBtn) {
        soundBtn.addEventListener("click", async () => {

            isSoundEnabled = !isSoundEnabled;

            localStorage.setItem(
                "cube_sound_enabled",
                isSoundEnabled
            );

            if (!isSoundEnabled) {

                stopAllSounds();

            } else {

                initAudioSystem();

                try {

                    if (
                        audioCtx &&
                        audioCtx.state === "suspended"
                    ) {
                        await audioCtx.resume();
                    }

                    if (
                        document.body.classList.contains("game-started") &&
                        !isPaused &&
                        !isGameOver
                    ) {
                        if (currentActiveBGM) {
                            await currentActiveBGM.play();
                        } else {
                            playRandomBGM();
                        }
                    }

                } catch (e) {
                    console.log("BGM再開失敗:", e);
                }
            }

            updateSoundButtonUI();
        });
    }
}

function setupTimeupButtons() {

    const timeupRetryBtn =
        document.getElementById("timeup-retry-btn");

    if (timeupRetryBtn) {
        timeupRetryBtn.addEventListener("click", () => {
            playWebAudio("select");

            fadeToBlack(() => {
                const overlay =
                    document.getElementById("timeup-overlay");

                if (overlay) {
                    overlay.style.opacity = "0";
                    overlay.style.display = "none";
                }

                rotX = 0;
                rotZ = 0;

                initGame();

                const stage = document.getElementById("stage");

                if (stage) {
                    stage.style.transition = "none";
                    stage.style.transform =
                        "rotateX(0deg) rotateZ(0deg)";
                    stage.offsetWidth;
                }

                fadeFromBlack();

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (stage) {
                            rotX = 60;
                            rotZ = -45;
                            stage.style.transition =
                                "transform 0.5s ease-out";
                            stage.style.transform =
                                `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
                        }
                    });
                });
            });
        });
    }

    const timeupTitleBtn =
        document.getElementById("timeup-title-btn");

    if (timeupTitleBtn) {
        timeupTitleBtn.addEventListener("click", returnToTitle);
    }
}

function setupClearButtons() {

    const clearTestBtn =
        document.getElementById("clear-test-btn");

    if (clearTestBtn) {
        clearTestBtn.addEventListener("click", () => {
            const timeBonus = timeLeft * 2000;
            const clearBonus = SIZE === 5 ? 43750 : 75600;
            const finalScore =
                currentScore + clearBonus + timeBonus;

            fadeToBlack(() => {
                showClearOverlay(
                    finalScore,
                    timeBonus,
                    clearBonus
                );
            });
        });
    }

    const clearRetryBtn =
        document.getElementById("clear-retry-btn");

    if (clearRetryBtn) {
        clearRetryBtn.addEventListener("click", () => {
            playWebAudio("select");

            fadeToBlack(() => {
                const overlay =
                    document.getElementById("clear-overlay");

                if (overlay) {
                    overlay.style.opacity = "0";
                    overlay.style.display = "none";
                }

                rotX = 0;
                rotZ = 0;

                initGame();

                const stage = document.getElementById("stage");

                if (stage) {
                    stage.style.transition = "none";
                    stage.style.transform =
                        "rotateX(0deg) rotateZ(0deg)";
                    stage.offsetWidth;
                }

                fadeFromBlack();

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (stage) {
                            rotX = 60;
                            rotZ = -45;
                            stage.style.transition =
                                "transform 0.5s ease-out";
                            stage.style.transform =
                                `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
                        }
                    });
                });
            });
        });
    }

    const clearTitleBtn =
        document.getElementById("clear-title-btn");

    if (clearTitleBtn) {
        clearTitleBtn.addEventListener("click", returnToTitle);
    }
}

function setupGameButtons() {
    document.getElementById("to-title-btn").addEventListener(
        "click",
        returnToTitle
    );

    document.getElementById("reset-btn").addEventListener("click", () => {
        initAudioSystem();
        playWebAudio("select");

        initGame();

        requestAnimationFrame(() => {
            playRandomBGM();
        });
    });
}

function setupRotationButtons() {
    document.getElementById("rot-z-btn").addEventListener(
        "click",
        handleRotateZButtonClick
    );

    document.getElementById("rot-y-btn").addEventListener(
        "click",
        handleRotateYButtonClick
    );
}

function handleRotateZButtonClick() {
    initAudioSystem();

    if (isGameOver || isPaused) return;

    playWebAudio("select");
    triggerResizeAndRefresh();
}

function handleRotateYButtonClick() {
    initAudioSystem();

    if (isGameOver || isPaused) return;

    playWebAudio("select");

    rotateCubeAroundY();
}

function rotateCubeAroundY() {
    const { dynamicCubeSize, offset } = getDynamicSizes();

    const visibleBlocks = getVisibleBlocks();

    blocks.forEach(b => {
        const oldY = b.y;
        b.y = b.z;
        b.z = (SIZE - 1) - oldY;
    });

    visibleBlocks.forEach(b => {
        updateCubePosition(
            b.element,
            b.x,
            b.y,
            b.z,
            offset,
            dynamicCubeSize
        );
    });
}

function getVisibleBlocks() {
    return blocks.filter(b =>
        b.active &&
        b.element.style.display !== "none"
    );
}

function setupPauseButtons() {
    document.getElementById("pause-btn").addEventListener("click", () => {
        initAudioSystem();
        playWebAudio("select");
        togglePause();
    });

    document.getElementById("resume-btn").addEventListener("click", () => {
        initAudioSystem();
        playWebAudio("select");
        togglePause();
    });
}

function selectDifficulty(size) {
    initAudioSystem();

    debugLog(
        "select=" + !!soundBank.select +
        " / audio=" + (audioCtx ? audioCtx.state : "none")
    );

    playWebAudio("select");

    SIZE = size;

    document.getElementById("diff-easy-btn")
        .classList.toggle("active", size === 5);

    document.getElementById("diff-normal-btn")
        .classList.toggle("active", size === 6);

    loadHighScore();
}

async function enterMobileFullscreenIfNeeded() {
    const isIOS =
        /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const isMobileSize = window.innerWidth < 960;

    if (isIOS || !isMobileSize) return;

    const docEl = document.documentElement;

    try {
        if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
        }
    } catch (err) {
        console.log("フルスクリーン拒否");
    }

    try {
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock("landscape");
        }
    } catch (err) {
        console.log("向きロック拒否");
    }
}

function resetStageRotation(stage) {
    rotX = 0;
    rotZ = 0;

    if (!stage) return;

    stage.style.transition = "none";
    stage.style.transform =
        "rotateX(0deg) rotateZ(0deg)";
}

function animateStageToDefaultAngle(stage) {
    if (!stage) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            rotX = 60;
            rotZ = -45;

            stage.style.transition =
                "transform 0.5s ease-out";

            stage.style.transform =
                `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
        });
    });
}

function initializeGameFromTitle() {
    skipStageRotationOnce = true;
    initGame();
}

function startGameAfterTitleOverlay(overlay) {
    overlay.style.display = "none";

    initializeGameFromTitle();

    const newStage = document.getElementById("stage");

    resetStageRotation(newStage);

    if (newStage) {
        newStage.offsetWidth;
        animateStageToDefaultAngle(newStage);
    }
}

function playStartSequence() {
    initAudioSystem();
    playWebAudio("start");
    playRandomBGM();
}

function hideTitleOverlay(overlay) {
    document.body.classList.add("game-started");

    if (!overlay) return;

    overlay.style.opacity = "0";
}

function startGameAfterTitleFade(overlay) {
    setTimeout(() => {
        startGameAfterTitleOverlay(overlay);
    }, 500);
}

async function startFromTitle() {
    playStartSequence();

    const stage = document.getElementById("stage");
    const overlay = document.getElementById("start-overlay");

    hideTitleOverlay(overlay);

    await enterMobileFullscreenIfNeeded();

    resetStageRotation(stage);

    startGameAfterTitleFade(overlay);
}

function setupDifficultyButtons() {
    document.getElementById("diff-easy-btn")
        .addEventListener("click", () => {
            selectDifficulty(5);
        });

    document.getElementById("diff-normal-btn")
        .addEventListener("click", () => {
            selectDifficulty(6);
        });
}

function setupStartButton() {
    document.getElementById("actual-start-btn")
        .addEventListener("click", startFromTitle);
}

function setupTitleButtons() {
    setupDifficultyButtons();
    setupStartButton();
}

function setupEvents() {
    setupShareButtons();
    setupSoundButtons();
    setupTimeupButtons();
    setupClearButtons();

    setupRotationButtons();
    setupGameButtons();
    setupPauseButtons();

    setupTitleButtons();
}

function togglePause() {
    if (isGameOver) return;
    const pauseOverlay = document.getElementById("pause-overlay");
    if (!pauseOverlay) return;

    if (!isPaused) {
        isPaused = true;
        clearInterval(timerId); 
        pauseOverlay.style.display = "flex";
        setTimeout(() => pauseOverlay.style.opacity = "1", 10);
        try { if(currentActiveBGM) currentActiveBGM.pause(); } catch(e){} 
    } else {
        isPaused = false;
        pauseOverlay.style.opacity = "0";
        setTimeout(() => pauseOverlay.style.display = "none", 400);
        clearInterval(timerId);
        timerId = setInterval(countdown, 1000);
        try { if(currentActiveBGM) currentActiveBGM.play(); } catch(e){} 
    }
}

/*gpt提案、左右回転の改善*/
function triggerResizeAndRefresh() {

    const { dynamicCubeSize, offset } = getDynamicSizes();

    const visibleBlocks = blocks.filter(b =>
        b.active &&
        b.element.style.display !== "none"
    );

    // まず論理座標だけ更新
    blocks.forEach(b => {
        const oldX = b.x;
        b.x = b.y;
        b.y = (SIZE - 1) - oldX;
    });

    // DOM更新は次フレームに回す
    requestAnimationFrame(() => {
        visibleBlocks.forEach(b => {
            updateCubePosition(
                b.element,
                b.x,
                b.y,
                b.z,
                offset,
                dynamicCubeSize
            );
        });
    });
}

function refreshFaceSizes(b, halfSize) {
    if(b.hasFaces) {
        b.element.querySelectorAll('.face.top').forEach(el => el.style.transform = `translateZ(${halfSize}px)`);
        b.element.querySelectorAll('.face.bottom').forEach(el => el.style.transform = `rotateX(180deg) translateZ(${halfSize}px)`);
        b.element.querySelectorAll('.face.front').forEach(el => el.style.transform = `rotateX(-90deg) translateZ(${halfSize}px)`);
        b.element.querySelectorAll('.face.back').forEach(el => el.style.transform = `rotateX(90deg) translateZ(${halfSize}px)`);
        b.element.querySelectorAll('.face.right').forEach(el => el.style.transform = `rotateY(90deg) translateZ(${halfSize}px)`);
        b.element.querySelectorAll('.face.left').forEach(el => el.style.transform = `rotateY(-90deg) translateZ(${halfSize}px)`);
    }
}

function updateStageRotation() {
    const stage = document.getElementById("stage");
    if(stage) stage.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
}

function countdown() {
    if (isGameOver || isPaused) return;

    timeLeft--;
    updateTimerUI();

    // 🔔 カウントダウン音
    if (timeLeft <= 5 && timeLeft >= 3) {
        playCountdownBeep();
    }

    if (timeLeft <= 2 && timeLeft >= 1) {
        playCountdownFastBeep();
    }

    if (timeLeft <= 0) {
        clearInterval(timerId);
        isGameOver = true;

        document.getElementById("status").innerText = "⏱️ タイムアップ！";
        document.getElementById("status").style.color = "#ff4444";

        // BGMは止めない
        playWebAudio("timeup");

        fadeToBlack(() => {
            showTimeUpOverlay();
        });
    }
}

function updateTimerUI() {
    document.getElementById("timer-text").innerText = `残り時間 ${timeLeft} 秒`;
    const percentage = (timeLeft / 120) * 100;
    const bar = document.getElementById("timer-bar");
    if(bar) bar.style.width = `${percentage}%`;
}

function isSelectable(b) {
    let hasLeft = false, hasRight = false, hasFront = false, hasBack = false;
    const findBlock = (x, y, z) => blocks.find(o => o.active && o.x === x && o.y === y && o.z === z);
    if (findBlock(b.x - 1, b.y, b.z)) hasLeft = true;
    if (findBlock(b.x + 1, b.y, b.z)) hasRight = true;
    if (findBlock(b.x, b.y - 1, b.z)) hasFront = true;
    if (findBlock(b.x, b.y + 1, b.z)) hasBack = true;
    let openSides = 0;
    if (!hasLeft) openSides++; if (!hasRight) openSides++; if (!hasFront) openSides++; if (!hasBack) openSides++;
    return (openSides >= 2);
}

function isExposed(b) {
    const findBlock = (x, y, z) => blocks.find(o => o.active && o.x === x && o.y === y && o.z === z);
    let openSides = 0;
    if (!findBlock(b.x - 1, b.y, b.z)) openSides++; if (!findBlock(b.x + 1, b.y, b.z)) openSides++;
    if (!findBlock(b.x, b.y - 1, b.z)) openSides++; if (!findBlock(b.x, b.y + 1, b.z)) openSides++;
    if (!findBlock(b.x, b.y, b.z - 1)) openSides++; if (!findBlock(b.x, b.y, b.z + 1)) openSides++; 
    return (openSides > 0); 
}

function showNotSelectableMessage(status) {
    status.innerText =
        "周囲に挟まれています（空きが1面以下なので選べません）";

    status.style.color = "#ff5722";
}

function clearSelection(block, status) {
    block.element.classList.remove("selected");

    selected = null;

    status.innerText = "選択を解除しました";
    status.style.color = "#ffeb3b";
}

function selectFirstBlock(block, status) {
    selected = block;
    block.element.classList.add("selected");

    status.innerText = "2つ目の同じ数字を選んでください";
    status.style.color = "#ffeb3b";
}

function clearMatchedBlocks(firstBlock, secondBlock, status) {
    firstBlock.active = false;
    secondBlock.active = false;

    firstBlock.element.style.display = "none";
    secondBlock.element.style.display = "none";

    selected = null;

    updateScoreDisplay(currentScore + 700);

    status.innerText = "消去成功！(+700pt)";
    status.style.color = "#4caf50";

    playWebAudio("clear");

    revealExposedBlocks();

    updateCount();
}

function revealExposedBlocks() {
    const {
        halfSize,
        dynamicCubeSize,
        offset
    } = getDynamicSizes();

    blocks.forEach(o => {
        if (
            o.active &&
            o.element.style.display === "none" &&
            isExposed(o)
        ) {
            updateCubePosition(
                o.element,
                o.x,
                o.y,
                o.z,
                offset,
                dynamicCubeSize
            );

            createFacesForCube(
                o,
                halfSize,
                dynamicCubeSize
            );

            o.element.style.display = "block";
        }
    });
}

function selectDifferentBlock(block, status) {
    selected.element.classList.remove("selected");

    selected = block;
    block.element.classList.add("selected");

    status.innerText = "数字が違います！";
    status.style.color = "#ff5722";
}

function validateBlockSelection(block, status) {

    if (!isSelectable(block)) {
        playWebAudio("error");
        showNotSelectableMessage(status);
        return false;
    }

    if (selected !== block) {
        playWebAudio("select");
    }

    return true;
}

function handleClick(b) {

    if (isGameOver || isPaused || !b.active) return;

    const status = document.getElementById("status");

    if (!validateBlockSelection(b, status)) {
        return;
    }

    if (selected === null) {
        selectFirstBlock(b, status);

    } else if (selected === b) {
        clearSelection(b, status);

    } else if (selected.txt === b.txt) {
        clearMatchedBlocks(selected, b, status);

    } else {
        selectDifferentBlock(b, status);
    }
}

function updateCount() {
    let count = blocks.filter(b => b.active).length;
    document.getElementById("count").innerText = count;
    if (count === 0) {
        clearInterval(timerId);
        isGameOver = true;
    
        const timeBonus = timeLeft * 2000;
        const clearBonus = SIZE === 5 ? 43750 : 75600;
        const finalScore = currentScore + clearBonus + timeBonus;
    
        updateScoreDisplay(finalScore);
    
        document.getElementById("status").innerText = "🎉 全クリア達成!!";
        document.getElementById("status").style.color = "#4caf50";
    
        playWebAudio("clear");
    
        fadeToBlack(() => {
            showClearOverlay(
                finalScore,
                timeBonus,
                clearBonus
            );
        });
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        try { if(currentActiveBGM) currentActiveBGM.pause(); } catch(e){}
    } else {
        if (document.body.classList.contains("game-started") && !isPaused && !isGameOver) {
            try { if(currentActiveBGM) currentActiveBGM.play().catch(e => console.log(e)); } catch(e){}
        }
    }
});

initAudioSystem();

loadHighScore();
updateSoundButtonUI();

setTimeout(() => {
    setupEvents();
}, 300);
