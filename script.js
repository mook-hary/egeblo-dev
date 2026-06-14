const DIFFICULTY = {
    TUTORIAL: 2,
    NORMAL: 4,
    HARD: 6,
    EXTRA: 8
};
let selectedDifficulty = DIFFICULTY.NORMAL;
let SIZE = selectedDifficulty;
let isTutorialMode = false;
let isExtraUnlocked =
    localStorage.getItem("cube_extra_unlocked")
    === "true";

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
let tutorialFirstMatchDone = false;

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
    if (!canPlayWebAudio(bufferName)) return;

    try {
        playSoundBuffer(bufferName);

    } catch (e) {
        console.log("Web Audio再生エラー:", e);
    }
}

function canPlayWebAudio(bufferName) {
    if (!isSoundEnabled) return false;

    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    return audioCtx && soundBank[bufferName];
}

function playSoundBuffer(bufferName) {
    const bufferSource =
        audioCtx.createBufferSource();

    bufferSource.buffer =
        soundBank[bufferName];

    bufferSource.connect(audioCtx.destination);

    bufferSource.start(0);
}

function playCountdownBeep() {
    if (!isSoundEnabled) return;

    initAudioSystem();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    playCountdownTone();
}

function playCountdownTone() {
    const now = audioCtx.currentTime + 0.01;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.15
    );

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

    playFastCountdownTone();
}

function playFastCountdownTone() {
    const now = audioCtx.currentTime + 0.01;

    for (let i = 0; i < 2; i++) {
        const t = now + i * 0.16;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(1600, t);

        gain.gain.setValueAtTime(0.30, t);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            t + 0.1
        );

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
        setupAudioContext();

        isAudioLoading = true;

        loadInitialSoundBuffers();

    } catch(e) {
        console.log("Web Audio初期化失敗:", e);
    }
}

function setupAudioContext() {
    window.AudioContext =
        window.AudioContext || window.webkitAudioContext;

    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

function loadInitialSoundBuffers() {
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
}

function getDynamicSizes() {
    const dynamicCubeSize = getCubeSizeByDevice();

    const offset =
        (SIZE - 1) * dynamicCubeSize / 2;

    const halfSize =
        dynamicCubeSize / 2;

    return {
        dynamicCubeSize,
        offset,
        halfSize
    };
}

function getCubeSizeByDevice() {
    const isPC = window.innerWidth >= 960;

    if (SIZE === 2) {
        return isPC ? 80 : 65;
    }

    if (SIZE === 4) {
        return isPC ? 56 : 46;
    }

    if (SIZE === 6) {
        return isPC ? 40 : 35;
    }

    if (SIZE === 8) {
        return isPC ? 30 : 26;
    }

    return isPC ? 40 : 35;
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

    if (isTutorialMode) {
        return;
    }

    currentScore = scoreValue;

    document.getElementById("score").innerText =
        currentScore;

    updateHighScoreIfNeeded();
}

function updateHighScoreIfNeeded() {
    if (currentScore <= highScore) return;

    highScore = currentScore;

    document.getElementById("best-score").innerText =
        highScore;

    localStorage.setItem(
        `egebro_highscore_sz${SIZE}`,
        highScore
    );
}

function createTilePool(totalRequired) {
    const pool = [];

    const pairCount = totalRequired / 2;

    for (let i = 0; i < pairCount; i++) {
        const tile =
            tileTypes[i % tileTypes.length];

        pool.push({ ...tile });
        pool.push({ ...tile });
    }

    shuffleTilePool(pool);

    return pool;
}

function shuffleTilePool(pool) {
    for (let i = pool.length - 1; i > 0; i--) {
        const j =
            Math.floor(Math.random() * (i + 1));

        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
    }
}

function resetGameState() {
    blocks = [];
    selected = null;
    isGameOver = false;
    isPaused = false;
    tutorialFirstMatchDone = false;
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
    if (isTutorialMode) {
        setElementText("score", "-");
        setElementText("best-score", "-");
    } else {
        updateScoreDisplay(0);
        loadHighScore();
    }

    if (isTutorialMode) {
        document.getElementById("status").innerText =
            "チュートリアル：同じ数字を2つ選んで消してみましょう";
    } else {
        document.getElementById("status").innerText =
            "1つ目のブロックを選んでください";
    }

    document.getElementById("status").style.color =
        "#38bdf8";
}

function startGameTimer() {
    clearInterval(timerId);

    if (isTutorialMode) {
        timeLeft = 999;
        updateTimerUI();
        return;
    }

    timeLeft = 120;
    updateTimerUI();

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

function setupCubeClick(cube, blockData) {
    cube.addEventListener("click", (e) => {
        e.stopPropagation();
        handleClick(blockData);
    });
}

function setupCubeVisibilityAndFaces(
    blockData,
    x,
    y,
    z,
    halfSize,
    dynamicCubeSize
) {
    const cube = blockData.element;

    if (isInnerCube(x, y, z)) {
        cube.style.display = "none";
        return;
    }

    createFacesForCube(
        blockData,
        halfSize,
        dynamicCubeSize
    );
}

function createSingleBlock(
    tile,
    x,
    y,
    z,
    dynamicCubeSize,
    offset,
    halfSize
) {
    const cube = createCubeElement(dynamicCubeSize);

    updateCubePosition(cube, x, y, z, offset, dynamicCubeSize);

    const blockData = createBlockData(tile, cube, x, y, z);

    setupCubeClick(cube, blockData);

    setupCubeVisibilityAndFaces(
        blockData,
        x,
        y,
        z,
        halfSize,
        dynamicCubeSize
    );

    return blockData;
}

function registerBlock(blockData, fragment) {
    fragment.appendChild(blockData.element);
    blocks.push(blockData);
}

function createBlocks(pool, fragment, dynamicCubeSize, offset, halfSize) {
    let index = 0;

    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
            for (let z = 0; z < SIZE; z++) {
                const tile = pool[index++];

                const blockData = createSingleBlock(
                    tile,
                    x,
                    y,
                    z,
                    dynamicCubeSize,
                    offset,
                    halfSize
                );

                registerBlock(blockData, fragment);
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

function setupNewGameStage() {
    const stage = document.getElementById("stage");
    if (!stage) return null;

    clearStage(stage);
    resetGameState();
    hidePauseOverlay();
    resetGameUI();
    startGameTimer();

    return stage;
}

function createInitialBlocksFragment() {
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

    return fragment;
}

function finalizeGameSetup(stage, fragment) {
    stage.appendChild(fragment);

    updateCount();
    applyInitialStageRotation();
}

function initGame() {
    const stage = setupNewGameStage();
    if (!stage) return;

    const fragment = createInitialBlocksFragment();

    finalizeGameSetup(stage, fragment);
}
    
function createFacesForCube(b, halfSize, dynamicCubeSize) {
    if (b.hasFaces) return;

    const faces = createFaceDefinitions(halfSize);

    faces.forEach(faceData => {
        const face = createCubeFaceElement(
            faceData,
            b,
            dynamicCubeSize
        );

        b.element.appendChild(face);
    });

    b.hasFaces = true;
}

function createFaceDefinitions(halfSize) {
    return [
        {
            name: "top",
            style: `transform: translateZ(${halfSize}px);`
        },
        {
            name: "bottom",
            style: `transform: rotateX(180deg) translateZ(${halfSize}px);`
        },
        {
            name: "front",
            style: `transform: rotateX(-90deg) translateZ(${halfSize}px);`
        },
        {
            name: "back",
            style: `transform: rotateX(90deg) translateZ(${halfSize}px);`
        },
        {
            name: "right",
            style: `transform: rotateY(90deg) translateZ(${halfSize}px);`
        },
        {
            name: "left",
            style: `transform: rotateY(-90deg) translateZ(${halfSize}px);`
        }
    ];
}

function createCubeFaceElement(faceData, blockData, dynamicCubeSize) {
    const face = document.createElement("div");

    face.className = `face ${faceData.name}`;
    face.style.cssText = faceData.style;

    face.style.width = dynamicCubeSize + "px";
    face.style.height = dynamicCubeSize + "px";

    face.style.backgroundColor = blockData.color;
    face.innerText = blockData.txt;

    const windowIsPC = window.innerWidth >= 960;

    face.style.fontSize =
        windowIsPC
            ? (SIZE === 5 ? "26px" : "22px")
            : (SIZE === 5 ? "22px" : "18px");

    if (
        blockData.txt.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/) ||
        blockData.txt.length > 2 ||
        blockData.txt.charCodeAt(0) > 255
    ) {
        face.style.fontSize = windowIsPC ? "16px" : "14px";
    }

    return face;
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

    prepareStageIntroAnimation(
        stage,
        fromTransform
    );

    if (shouldUseStageAnimate(stage)) {
        playStageIntroWithAnimate(
            stage,
            fromTransform,
            toTransform
        );
    } else {
        playStageIntroWithStyle(
            stage,
            toTransform
        );
    }
}

function prepareStageIntroAnimation(stage, fromTransform) {
    stage.style.transition = "none";
    stage.style.transform = fromTransform;

    stage.offsetWidth;
}

function shouldUseStageAnimate(stage) {
    const isIOS =
        /iPhone|iPad|iPod/i.test(navigator.userAgent);

    return isIOS && stage.animate;
}

function playStageIntroWithAnimate(
    stage,
    fromTransform,
    toTransform
) {
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
        setStageDefaultAngle(stage, toTransform);
    };
}

function playStageIntroWithStyle(stage, toTransform) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setStageDefaultAngle(stage, toTransform);
        });
    });
}

function setStageDefaultAngle(stage, toTransform) {
    rotX = 60;
    rotZ = -45;

    stage.style.transition =
        "transform 0.5s ease-out";

    stage.style.transform = toTransform;
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

function showClearOverlay(finalScore, timeBonus, clearBonus) {
    setClearOverlayValues(
        finalScore,
        timeBonus,
        clearBonus
    );

    showOverlayWithFade("clear-overlay");
}

function setClearOverlayValues(
    finalScore,
    timeBonus,
    clearBonus
) {
    setElementText(
        "clear-score",
        finalScore
    );

    setElementText(
        "clear-time-bonus",
        timeBonus
    );

    setElementText(
        "clear-clear-bonus",
        clearBonus
    );

    const rankEl =
        document.getElementById("clear-rank");

    const bonusArea =
        document.getElementById(
            "clear-bonus-area"
        );

    if (isTutorialMode) {

        if (bonusArea) {
            bonusArea.style.display = "none";
        }

        if (rankEl) {
            rankEl.style.display = "block";
            rankEl.innerText =
                "次はNORMALに挑戦！";
        }

    } else {

        if (bonusArea) {
            bonusArea.style.display = "block";
        }

        if (rankEl) {
            rankEl.style.display = "none";
        }
    }

    setElementText(
        "clear-new-record",
        ""
    );
}

function showTimeUpOverlay() {
    setElementText("timeup-score", currentScore);

    showOverlayWithFade("timeup-overlay");
}

function setElementText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.innerText = text;
    }
}

function showOverlayWithFade(id) {
    const overlay = document.getElementById(id);

    if (!overlay) return;

    overlay.style.display = "flex";

    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        fadeFromBlack();
    });
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

function stopCurrentBGM() {
    try {
        if (currentActiveBGM) {
            currentActiveBGM.pause();
            currentActiveBGM.currentTime = 0;
            currentActiveBGM = null;
        }
    } catch(e) {}
}

function hideGameOverlays() {
    const overlays = [
        "timeup-overlay",
        "clear-overlay",
        "pause-overlay"
    ];

    overlays.forEach(id => {
        const overlay = document.getElementById(id);

        if (overlay) {
            overlay.style.opacity = "0";
            overlay.style.display = "none";
        }
    });
}

function resetStageToTitle(stage) {
    rotX = 60;
    rotZ = -45;

    if (stage) {
        stage.innerHTML = "";
        stage.style.transition = "none";
        stage.style.opacity = "1";
        stage.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
    }
}

function showStartOverlay(startOverlay) {
    if (startOverlay) {
        startOverlay.style.display = "flex";
        startOverlay.style.opacity = "1";
    }
}

function resetGameSelectionState() {
    blocks = [];
    selected = null;
}

function resetGameFlags() {
    clearInterval(timerId);
    isGameOver = true;
    isPaused = false;
}

function resetGameStartedState() {
    document.body.classList.remove("game-started");
}

function restoreTitleScreen(stage, startOverlay) {
    resetGameFlags();

    hideGameOverlays();

    resetGameSelectionState();

    resetStageToTitle(stage);

    resetGameStartedState();

    resetTutorialModeForTitle();

    showStartOverlay(startOverlay);
}

function resetTutorialModeForTitle() {
    isTutorialMode = false;
    SIZE = selectedDifficulty;

    prepareTimerForSelectedMode();
    loadHighScore();
}

function returnToTitle() {
    playWebAudio("select");

    const startOverlay =
        document.getElementById("start-overlay");

    const stage =
        document.getElementById("stage");

    setTimeout(() => {
        stopCurrentBGM();

        fadeToBlack(() => {
            restoreTitleScreen(
                stage,
                startOverlay
            );

            fadeFromBlack();
        });
    }, 200);
}

async function shareResult(resultType) {
    playWebAudio("select");

    const shareData =
        createShareData(resultType);

    if (navigator.share) {
        await shareWithWebShareApi(
            shareData
        );
    } else {
        shareToX(shareData.text);
    }
}

function createShareData(resultType) {
    const label =
        resultType === "clear"
            ? "CLEAR!"
            : "TIME UP";

    const shareText =
        `CUBE dev ${label}\n` +
        `SCORE: ${currentScore} pt\n` +
        `BEST: ${highScore} pt\n` +
        `#CUBEdev`;

    return {
        title: "CUBE dev",
        text: shareText,
        url: location.href
    };
}

async function shareWithWebShareApi(shareData) {
    try {
        await navigator.share(shareData);

    } catch (e) {
        console.log("共有キャンセル:", e);
    }
}

function shareToX(shareText) {
    const xUrl =
        "https://twitter.com/intent/tweet?text=" +
        encodeURIComponent(shareText) +
        "&url=" +
        encodeURIComponent(location.href);

    window.open(xUrl, "_blank");
}

function setupShareButton(id, resultType) {
    addClickListener(id, () => {
        shareResult(resultType);
    });
}

function setupShareButtons() {
    setupShareButton(
        "timeup-share-btn",
        "timeup"
    );

    setupShareButton(
        "clear-share-btn",
        "clear"
    );
}

function setupSoundButtons() {
    const soundBtn =
        document.getElementById("sound-toggle-btn");

    if (!soundBtn) return;

    soundBtn.addEventListener(
        "click",
        handleSoundButtonClick
    );
}

async function handleSoundButtonClick() {
    toggleSoundEnabled();

    if (!isSoundEnabled) {
        stopAllSounds();
        updateSoundButtonUI();
        return;
    }

    await resumeSoundSystem();

    updateSoundButtonUI();
}

function toggleSoundEnabled() {
    isSoundEnabled = !isSoundEnabled;

    localStorage.setItem(
        "cube_sound_enabled",
        isSoundEnabled
    );
}

async function resumeSoundSystem() {
    initAudioSystem();

    try {
        await resumeAudioContextIfNeeded();
        await resumeBGMIfGameIsRunning();

    } catch (e) {
        console.log("BGM再開失敗:", e);
    }
}

async function resumeAudioContextIfNeeded() {
    if (
        audioCtx &&
        audioCtx.state === "suspended"
    ) {
        await audioCtx.resume();
    }
}

async function resumeBGMIfGameIsRunning() {
    if (!isGameRunning()) return;

    if (currentActiveBGM) {
        await currentActiveBGM.play();
    } else {
        playRandomBGM();
    }
}

function isGameRunning() {
    return (
        document.body.classList.contains("game-started") &&
        !isPaused &&
        !isGameOver
    );
}

function setupTimeupButtons() {
    addClickListener(
        "timeup-retry-btn",
        handleTimeupRetry
    );

    addClickListener(
        "timeup-title-btn",
        returnToTitle
    );
}

function restartGame() {
    resetStageRotationState();

    initGame();

    const stage = document.getElementById("stage");

    prepareStageIntroPosition(stage);

    fadeFromBlack();

    animateStageToDefaultAngle(stage);
}

function handleTimeupRetry() {
    playWebAudio("select");

    fadeToBlack(() => {
        hideTimeupOverlay();
        restartGame();
    });
}

function hideOverlay(id) {
    const overlay =
        document.getElementById(id);

    if (!overlay) return;

    overlay.style.opacity = "0";
    overlay.style.display = "none";
}

function hideTimeupOverlay() {
    hideOverlay("timeup-overlay");
}

function resetStageRotationState() {
    rotX = 0;
    rotZ = 0;
}

function prepareStageIntroPosition(stage) {
    if (!stage) return;

    stage.style.transition = "none";
    stage.style.transform =
        "rotateX(0deg) rotateZ(0deg)";

    stage.offsetWidth;
}

function addClickListener(id, handler) {
    const element = document.getElementById(id);

    if (element) {
        element.addEventListener("click", handler);
    }
}

function setupRotationButtons() {
    addClickListener(
        "rot-z-btn",
        handleRotateZButtonClick
    );

    addClickListener(
        "rot-y-btn",
        handleRotateYButtonClick
    );
}

function setupClearButtons() {
    addClickListener(
        "clear-test-btn",
        handleClearTest
    );

    addClickListener(
        "clear-retry-btn",
        handleClearRetry
    );

    addClickListener(
        "clear-title-btn",
        returnToTitle
    );
}

function handleClearTest() {
    const {
        finalScore,
        timeBonus,
        clearBonus
    } = calculateClearResult();

    fadeToBlack(() => {
        showClearOverlay(
            finalScore,
            timeBonus,
            clearBonus
        );
    });
}

function calculateClearResult() {

    if (isTutorialMode) {
        return {
            finalScore: 0,
            timeBonus: 0,
            clearBonus: 0
        };
    }

    const timeBonus = timeLeft * 2000;

    let clearBonus = 0;

    if (SIZE === DIFFICULTY.NORMAL) {
        clearBonus = 20000;
    } else if (SIZE === DIFFICULTY.HARD) {
        clearBonus = 75600;
    } else if (SIZE === DIFFICULTY.EXTRA) {
        clearBonus = 200000;
    }

    const finalScore =
        currentScore +
        clearBonus +
        timeBonus;

    return {
        finalScore,
        timeBonus,
        clearBonus
    };
}

function handleClearRetry() {
    playWebAudio("select");

    fadeToBlack(restartGameFromClear);
}

function restartGameFromClear() {
    hideClearOverlay();
    restartGame();
}

function hideClearOverlay() {
    hideOverlay("clear-overlay");
}

function handleResetButtonClick() {
    initAudioSystem();
    playWebAudio("select");

    restartGameFromReset();
}

function restartGameFromReset() {
    initGame();

    requestAnimationFrame(() => {
        playRandomBGM();
    });
}

function setupGameButtons() {
    addClickListener(
        "to-title-btn",
        returnToTitle
    );

    addClickListener(
        "reset-btn",
        handleResetButtonClick
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

    rotateBlockCoordinatesY();

    updateVisibleBlockPositions(
        visibleBlocks,
        offset,
        dynamicCubeSize
    );
}

function updateVisibleBlockPositions(
    visibleBlocks,
    offset,
    dynamicCubeSize
) {
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

function rotateBlockCoordinatesY() {
    blocks.forEach(b => {
        const oldY = b.y;
        b.y = b.z;
        b.z = (SIZE - 1) - oldY;
    });
}

function getVisibleBlocks() {
    return blocks.filter(b =>
        b.active &&
        b.element.style.display !== "none"
    );
}

function handlePauseButtonClick() {
    initAudioSystem();
    playWebAudio("select");
    togglePause();
}

function setupPauseButtons() {
    addClickListener(
        "pause-btn",
        handlePauseButtonClick
    );

    addClickListener(
        "resume-btn",
        handlePauseButtonClick
    );
}

function selectDifficulty(size) {
    prepareDifficultySelection();

    SIZE = size;
    isTutorialMode = false;
    selectedDifficulty = size;

    prepareTimerForSelectedMode();
    updateDifficultyButtons(size);
    loadHighScore();
}

function prepareTimerForSelectedMode() {
    if (isTutorialMode) {
        timeLeft = 999;
    } else {
        timeLeft = 120;
    }

    updateTimerUI();
}

function prepareDifficultySelection() {
    initAudioSystem();

    debugLog(
        "select=" + !!soundBank.select +
        " / audio=" +
        (audioCtx ? audioCtx.state : "none")
    );

    playWebAudio("select");
}

function updateDifficultyButtons(size) {
    document.getElementById(
        "diff-tutorial-btn"
    ).classList.toggle(
        "active",
        size === DIFFICULTY.TUTORIAL
    );

    document.getElementById(
        "diff-normal-btn"
    ).classList.toggle(
        "active",
        size === DIFFICULTY.NORMAL
    );

    document.getElementById(
        "diff-hard-btn"
    ).classList.toggle(
        "active",
        size === DIFFICULTY.HARD
    );

    document.getElementById(
        "diff-extra-btn"
    ).classList.toggle(
        "active",
        size === DIFFICULTY.EXTRA
    );
}

async function enterMobileFullscreenIfNeeded() {
    if (!shouldEnterMobileFullscreen()) {
        return;
    }

    await requestFullscreenIfAvailable();
    await lockLandscapeOrientationIfAvailable();
}

function shouldEnterMobileFullscreen() {
    const isIOS =
        /iPhone|iPad|iPod/i.test(
            navigator.userAgent
        );

    const isMobileSize =
        window.innerWidth < 960;

    return !isIOS && isMobileSize;
}

async function requestFullscreenIfAvailable() {
    const docEl = document.documentElement;

    try {
        if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();

        } else if (
            docEl.webkitRequestFullscreen
        ) {
            await docEl.webkitRequestFullscreen();
        }

    } catch (err) {
        console.log("フルスクリーン拒否");
    }
}

async function lockLandscapeOrientationIfAvailable() {
    try {
        if (
            screen.orientation &&
            screen.orientation.lock
        ) {
            await screen.orientation.lock(
                "landscape"
            );
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

    const stage =
        document.getElementById("stage");

    const overlay =
        document.getElementById("start-overlay");

    hideTitleOverlay(overlay);

    await enterMobileFullscreenIfNeeded();

    resetStageRotation(stage);

    startGameAfterTitleFade(overlay);
}

async function startTutorialFromTitle() {
    SIZE = DIFFICULTY.TUTORIAL;
    isTutorialMode = true;

    prepareTimerForSelectedMode();

    await startFromTitle();
}

function setupDifficultyButtons() {
    addClickListener(
        "diff-tutorial-btn",
        startTutorialFromTitle
    );

    addClickListener(
        "diff-normal-btn",
        () => selectDifficulty(DIFFICULTY.NORMAL)
    );

    addClickListener(
        "diff-hard-btn",
        () => selectDifficulty(DIFFICULTY.HARD)
    );

    addClickListener(
        "diff-extra-btn",
        () => selectDifficulty(DIFFICULTY.EXTRA)
    );
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

    const pauseOverlay =
        document.getElementById("pause-overlay");

    if (!pauseOverlay) return;

    if (!isPaused) {
        pauseGame(pauseOverlay);
    } else {
        resumeGame(pauseOverlay);
    }
}

function pauseGame(pauseOverlay) {
    isPaused = true;

    clearInterval(timerId);

    pauseOverlay.style.display = "flex";

    setTimeout(() => {
        pauseOverlay.style.opacity = "1";
    }, 10);

    try {
        if (currentActiveBGM) {
            currentActiveBGM.pause();
        }
    } catch (e) {}
}

function resumeGame(pauseOverlay) {
    isPaused = false;

    pauseOverlay.style.opacity = "0";

    setTimeout(() => {
        pauseOverlay.style.display = "none";
    }, 400);

    clearInterval(timerId);

    timerId = setInterval(countdown, 1000);

    try {
        if (currentActiveBGM) {
            currentActiveBGM.play();
        }
    } catch (e) {}
}

/*gpt提案、左右回転の改善*/
function triggerResizeAndRefresh() {
    const sizes = getDynamicSizes();

    const visibleBlocks = getVisibleBlocks();

    rotateBlockCoordinatesZ();

    updateVisibleBlockPositionsNextFrame(
        visibleBlocks,
        sizes
    );
}

function rotateBlockCoordinatesZ() {
    blocks.forEach(block => {
        const oldX = block.x;

        block.x = block.y;
        block.y = (SIZE - 1) - oldX;
    });
}

function updateVisibleBlockPositionsNextFrame(
    visibleBlocks,
    sizes
) {
    requestAnimationFrame(() => {
        visibleBlocks.forEach(block => {
            updateCubePosition(
                block.element,
                block.x,
                block.y,
                block.z,
                sizes.offset,
                sizes.dynamicCubeSize
            );
        });
    });
}

function updateStageRotation() {
    const stage = document.getElementById("stage");
    if(stage) stage.style.transform = `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
}

function countdown() {
    if (isGameOver || isPaused) return;

    timeLeft--;
    updateTimerUI();

    if (timeLeft <= 5 && timeLeft >= 3) {
        playCountdownBeep();
    }

    if (timeLeft <= 2 && timeLeft >= 1) {
        playCountdownFastBeep();
    }

    if (timeLeft <= 0) {
        handleTimeUp();
    }
}

function handleTimeUp() {
    clearInterval(timerId);

    isGameOver = true;

    document.getElementById("status").innerText =
        "⏱️ タイムアップ！";

    document.getElementById("status").style.color =
        "#ff4444";

    playWebAudio("timeup");

    fadeToBlack(() => {
        showTimeUpOverlay();
    });
}

function updateTimerUI() {
    if (isTutorialMode) {
        document.getElementById("timer-text").innerText =
            "チュートリアル";

        const bar = document.getElementById("timer-bar");

        if (bar) {
            bar.style.width = "100%";
        }

        return;
    }

    document.getElementById("timer-text").innerText =
        `残り時間 ${timeLeft} 秒`;

    const percentage = (timeLeft / 120) * 100;
    const bar = document.getElementById("timer-bar");

    if (bar) {
        bar.style.width = `${percentage}%`;
    }
}

function isSelectable(b) {
    const hasLeft = hasActiveBlockAt(b.x - 1, b.y, b.z);
    const hasRight = hasActiveBlockAt(b.x + 1, b.y, b.z);
    const hasFront = hasActiveBlockAt(b.x, b.y - 1, b.z);
    const hasBack = hasActiveBlockAt(b.x, b.y + 1, b.z);

    let openSides = 0;

    if (!hasLeft) openSides++;
    if (!hasRight) openSides++;
    if (!hasFront) openSides++;
    if (!hasBack) openSides++;

    return openSides >= 2;
}

function hasActiveBlockAt(x, y, z) {
    return blocks.some(o =>
        o.active &&
        o.x === x &&
        o.y === y &&
        o.z === z
    );
}

function isExposed(b) {
    let openSides = 0;

    if (!hasActiveBlockAt(b.x - 1, b.y, b.z)) openSides++;
    if (!hasActiveBlockAt(b.x + 1, b.y, b.z)) openSides++;
    if (!hasActiveBlockAt(b.x, b.y - 1, b.z)) openSides++;
    if (!hasActiveBlockAt(b.x, b.y + 1, b.z)) openSides++;
    if (!hasActiveBlockAt(b.x, b.y, b.z - 1)) openSides++;
    if (!hasActiveBlockAt(b.x, b.y, b.z + 1)) openSides++;

    return openSides > 0;
}

function showNotSelectableMessage(status) {
    if (isTutorialMode) {
        status.innerText =
            "このブロックはまだ選べません。左右前後のうち、2方向以上が空いているブロックを選びましょう";

        status.style.color =
            "#ffb703";

        return;
    }

    status.innerText =
        "周囲に挟まれています（空きが1面以下なので選べません）";

    status.style.color =
        "#ff5722";
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

    if (isTutorialMode) {
        status.innerText =
            "いいですね。同じ数字をもう1つ探して選びましょう";
    } else {
        status.innerText =
            "2つ目の同じ数字を選んでください";
    }

    status.style.color = "#ffeb3b";
}

function clearMatchedBlocks(
    firstBlock,
    secondBlock,
    status
) {
    deactivateMatchedBlocks(
        firstBlock,
        secondBlock
    );

    selected = null;

    updateScoreDisplay(
        currentScore + 700
    );

    if (
        isTutorialMode &&
        !tutorialFirstMatchDone
    ) {
        showTutorialFirstMatchMessage(status);
    } else {
        showMatchSuccessMessage(status);
    }

    playWebAudio("clear");

    revealExposedBlocks();

    updateCount();
}

function showTutorialFirstMatchMessage(status) {
    tutorialFirstMatchDone = true;

    status.innerText =
        "よくできました！次は回転ボタンで視点を変えてみましょう";

    status.style.color = "#4caf50";
}

function deactivateMatchedBlocks(
    firstBlock,
    secondBlock
) {
    firstBlock.active = false;
    secondBlock.active = false;

    firstBlock.element.style.display = "none";
    secondBlock.element.style.display = "none";
}

function showMatchSuccessMessage(status) {
    status.innerText =
        "消去成功！(+700pt)";

    status.style.color =
        "#4caf50";
}

function revealExposedBlocks() {
    const sizes = getDynamicSizes();

    blocks.forEach(block => {
        if (shouldRevealBlock(block)) {
            revealBlock(block, sizes);
        }
    });
}

function shouldRevealBlock(block) {
    return (
        block.active &&
        block.element.style.display === "none" &&
        isExposed(block)
    );
}

function revealBlock(block, sizes) {
    updateCubePosition(
        block.element,
        block.x,
        block.y,
        block.z,
        sizes.offset,
        sizes.dynamicCubeSize
    );

    createFacesForCube(
        block,
        sizes.halfSize,
        sizes.dynamicCubeSize
    );

    block.element.style.display = "block";
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

    handleBlockSelection(b, status);
}

function handleBlockSelection(b, status) {
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
    const count = getActiveBlockCount();

    document.getElementById("count").innerText = count;

    if (count === 0) {
        handleGameClear();
    }
}

function getActiveBlockCount() {
    return blocks.filter(b => b.active).length;
}

function handleGameClear() {
    clearInterval(timerId);

    isGameOver = true;

    const {
        finalScore,
        timeBonus,
        clearBonus
    } = calculateClearResult();

    updateScoreDisplay(finalScore);

    if (
    !isTutorialMode &&
    SIZE === DIFFICULTY.HARD
    ) {
        unlockExtraMode();
    }

    if (isTutorialMode) {
        document.getElementById("status").innerText =
            "🎉 チュートリアルクリア！";
    
    } else {
        document.getElementById("status").innerText =
            "🎉 全クリア達成!!";
    }
    
        document.getElementById("status").style.color =
        "#4caf50";

    playWebAudio("clear");

    fadeToBlack(() => {
        showClearOverlay(
            finalScore,
            timeBonus,
            clearBonus
        );
    });
}

document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
);

function unlockExtraMode() {
    if (isExtraUnlocked) return;

    isExtraUnlocked = true;

    localStorage.setItem(
        "cube_extra_unlocked",
        "true"
    );

    updateExtraButtonVisibility();
}

function handleVisibilityChange() {
    if (document.hidden) {
        pauseBGMForHiddenPage();
    } else {
        resumeBGMForVisiblePage();
    }
}

function pauseBGMForHiddenPage() {
    try {
        if (currentActiveBGM) {
            currentActiveBGM.pause();
        }
    } catch (e) {}
}

function resumeBGMForVisiblePage() {
    if (
        !document.body.classList.contains(
            "game-started"
        ) ||
        isPaused ||
        isGameOver
    ) {
        return;
    }

    try {
        if (currentActiveBGM) {
            currentActiveBGM.play()
                .catch(e => console.log(e));
        }
    } catch (e) {}
}

function updateExtraButtonVisibility() {
    const btn =
        document.getElementById("diff-extra-btn");

    if (!btn) return;

    btn.style.display =
        isExtraUnlocked ? "" : "none";
}

initializeApplication();

function initializeApplication() {
    initAudioSystem();

    loadHighScore();

    updateDifficultyButtons(selectedDifficulty);

    updateExtraButtonVisibility();

    updateSoundButtonUI();

    setTimeout(() => {
        setupEvents();
    }, 300);
}
