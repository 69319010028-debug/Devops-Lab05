const rows = 4;
const cols = 5;
const totalPieces = rows * cols;

const board = document.getElementById('board');
const tray = document.getElementById('pieceTray');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');

const pieces = [];
const slots = [];
let activeDrag = null;
let moves = 0;
let seconds = 0;
let timerId = null;
let started = false;
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playTone({ frequency = 440, duration = 0.09, type = 'triangle', gain = 0.04, slideTo = null }) {
  const context = initAudio();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function playButtonSound() {
  playTone({ frequency: 300, duration: 0.05, type: 'square', gain: 0.025, slideTo: 420 });
}

function playShuffleSound() {
  playTone({ frequency: 480, duration: 0.08, type: 'sawtooth', gain: 0.03, slideTo: 620 });
}

function playResetSound() {
  playTone({ frequency: 260, duration: 0.06, type: 'triangle', gain: 0.03, slideTo: 300 });
}

function playPiecePlacedSound() {
  playTone({ frequency: 440, duration: 0.08, type: 'triangle', gain: 0.04, slideTo: 560 });
}

function playWinSound() {
  playTone({ frequency: 520, duration: 0.12, type: 'triangle', gain: 0.05, slideTo: 700 });
  setTimeout(() => playTone({ frequency: 660, duration: 0.12, type: 'triangle', gain: 0.05, slideTo: 820 }), 100);
  setTimeout(() => playTone({ frequency: 820, duration: 0.16, type: 'sine', gain: 0.05, slideTo: 980 }), 200);
}

function formatTime(value) {
  const minutes = String(Math.floor(value / 60)).padStart(2, '0');
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function updateMoves() {
  movesEl.textContent = String(moves);
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function getSlotIndexFromPointer(event) {
  const rect = board.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x / rect.width) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y / rect.height) * rows)));
  return row * cols + col;
}

function createPuzzleShape(piece, row, col, index) {
  const top = row === 0 ? 'flat' : index % 2 === 0 ? 'out' : 'in';
  const right = col === cols - 1 ? 'flat' : index % 3 === 0 ? 'out' : 'in';
  const bottom = row === rows - 1 ? 'flat' : index % 2 === 1 ? 'out' : 'in';
  const left = col === 0 ? 'flat' : index % 3 === 1 ? 'out' : 'in';

  piece.style.clipPath = `polygon(
    0% 0%,
    100% 0%,
    100% 12%,
    ${right === 'out' ? '100% 18%, 86% 22%, 100% 30%, 100% 42%, 86% 46%, 100% 52%, 100% 68%, 86% 72%, 100% 80%, 100% 88%' : '100% 100%'},
    100% 100%,
    ${bottom === 'out' ? '82% 100%, 78% 82%, 70% 100%, 58% 100%, 52% 82%, 42% 100%, 30% 100%, 22% 82%, 12% 100%, 0% 100%' : '0% 100%'},
    0% 100%,
    ${left === 'out' ? '0% 82%, 14% 78%, 0% 70%, 0% 58%, 14% 52%, 0% 42%, 0% 30%, 14% 22%, 0% 18%, 0% 12%' : '0% 0%'},
    0% 0%
  )`;
}

function setSlotBackground(slot, index) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  slot.style.backgroundImage = "url('./porche.jpeg')";
  slot.style.backgroundSize = `${board.clientWidth}px ${board.clientHeight}px`;
  slot.style.backgroundPosition = `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`;
  slot.style.backgroundRepeat = 'no-repeat';
  slot.style.opacity = '0.55';
}

function buildSlots() {
  board.innerHTML = '';
  slots.length = 0;

  const rect = board.getBoundingClientRect();
  const cellWidth = rect.width / cols;
  const cellHeight = rect.height / rows;

  for (let i = 0; i < totalPieces; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = String(i);
    slot.style.width = `${cellWidth}px`;
    slot.style.height = `${cellHeight}px`;
    slot.style.left = `${col * cellWidth}px`;
    slot.style.top = `${row * cellHeight}px`;
    setSlotBackground(slot, i);
    board.appendChild(slot);
    slots.push(slot);
  }
}

function layoutTrayPieces() {
  const trayRect = tray.getBoundingClientRect();
  const cellWidth = trayRect.width / cols;
  const cellHeight = trayRect.height / rows;

  pieces.forEach((piece) => {
    if (piece.dataset.inBoard === 'true') return;
    const idx = Number(piece.dataset.index);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    piece.style.left = `${col * cellWidth + 4}px`;
    piece.style.top = `${row * cellHeight + 4}px`;
  });
}

function buildPieces() {
  tray.innerHTML = '';
  pieces.length = 0;

  const trayRect = tray.getBoundingClientRect();
  const cellWidth = trayRect.width / cols;
  const cellHeight = trayRect.height / rows;

  for (let i = 0; i < totalPieces; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const piece = document.createElement('div');
    piece.className = 'piece';
    piece.dataset.index = String(i);
    piece.dataset.correctIndex = String(i);
    piece.dataset.inBoard = 'false';
    piece.style.width = `${cellWidth}px`;
    piece.style.height = `${cellHeight}px`;
    piece.style.backgroundImage = "url('./porche.jpeg')";
    piece.style.backgroundSize = `${board.clientWidth}px ${board.clientHeight}px`;
    piece.style.backgroundPosition = `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`;
    piece.style.left = `${col * cellWidth + 4}px`;
    piece.style.top = `${row * cellHeight + 4}px`;

    createPuzzleShape(piece, row, col, i);

    piece.addEventListener('pointerdown', (event) => {
      if (piece.dataset.inBoard === 'true') return;
      activeDrag = {
        piece,
        offsetX: event.clientX - piece.getBoundingClientRect().left,
        offsetY: event.clientY - piece.getBoundingClientRect().top,
      };
      piece.setPointerCapture(event.pointerId);
      piece.style.zIndex = '50';
      document.body.style.userSelect = 'none';
    });

    tray.appendChild(piece);
    pieces.push(piece);
  }
}

function resetPuzzle() {
  stopTimer();
  started = false;
  seconds = 0;
  moves = 0;
  updateMoves();
  timerEl.textContent = formatTime(seconds);
  setStatus('พร้อมเล่น');
  playResetSound();

  pieces.forEach((piece) => {
    piece.dataset.inBoard = 'false';
    piece.style.zIndex = '2';
    tray.appendChild(piece);
  });

  layoutTrayPieces();
}

function shufflePuzzle() {
  stopTimer();
  started = false;
  seconds = 0;
  moves = 0;
  updateMoves();
  timerEl.textContent = formatTime(seconds);
  setStatus('ลากชิ้นภาพมาวางในช่องว่างที่ถูกต้อง');
  playShuffleSound();

  const shuffled = [...pieces].sort(() => Math.random() - 0.5);
  shuffled.forEach((piece, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    piece.dataset.inBoard = 'false';
    piece.style.zIndex = '2';
    piece.style.left = `${col * 22 + 8}px`;
    piece.style.top = `${row * 22 + 8}px`;
    tray.appendChild(piece);
  });

  started = true;
  startTimer();
  initAudio();
  playTone({ frequency: 440, duration: 0.08, type: 'square', gain: 0.03, slideTo: 520 });
}

function isSolved() {
  return pieces.every((piece) => piece.dataset.inBoard === 'true' && Number(piece.dataset.index) === Number(piece.dataset.correctIndex));
}

function handleWin() {
  stopTimer();
  playWinSound();
  setStatus('🎉 จบเกมแล้ว!');
}

function placePieceInBoard(piece, targetIndex) {
  const slot = slots[targetIndex];
  if (!slot) return;

  const boardRect = board.getBoundingClientRect();
  const cellWidth = boardRect.width / cols;
  const cellHeight = boardRect.height / rows;
  const row = Math.floor(targetIndex / cols);
  const col = targetIndex % cols;

  piece.dataset.inBoard = 'true';
  piece.style.left = `${col * cellWidth}px`;
  piece.style.top = `${row * cellHeight}px`;
  piece.style.zIndex = '20';
  board.appendChild(piece);

  if (Number(piece.dataset.index) === Number(piece.dataset.correctIndex)) {
    playPiecePlacedSound();
    if (isSolved()) handleWin();
  }
}

window.addEventListener('pointermove', (event) => {
  if (!activeDrag) return;
  const piece = activeDrag.piece;
  if (piece.dataset.inBoard === 'true') return;

  const parentRect = piece.parentElement.getBoundingClientRect();
  const x = event.clientX - parentRect.left - activeDrag.offsetX;
  const y = event.clientY - parentRect.top - activeDrag.offsetY;

  piece.style.left = `${Math.max(0, Math.min(x, parentRect.width - piece.offsetWidth))}px`;
  piece.style.top = `${Math.max(0, Math.min(y, parentRect.height - piece.offsetHeight))}px`;
});

window.addEventListener('pointerup', (event) => {
  if (!activeDrag) return;
  const piece = activeDrag.piece;
  const boardRect = board.getBoundingClientRect();
  const insideBoard =
    event.clientX >= boardRect.left &&
    event.clientX <= boardRect.right &&
    event.clientY >= boardRect.top &&
    event.clientY <= boardRect.bottom;

  if (insideBoard) {
    const targetIndex = getSlotIndexFromPointer(event);
    if (Number(piece.dataset.index) === Number(piece.dataset.correctIndex)) {
      placePieceInBoard(piece, targetIndex);
      moves += 1;
      updateMoves();
      setStatus('ถูกต้อง!');
    } else {
      setStatus('ผิดช่องนะครับ ลองหาช่องที่ถูกต้อง');
      piece.dataset.inBoard = 'false';
      piece.style.zIndex = '2';
      tray.appendChild(piece);
      layoutTrayPieces();
    }
  } else {
    piece.dataset.inBoard = 'false';
    piece.style.zIndex = '2';
    tray.appendChild(piece);
    layoutTrayPieces();
  }

  activeDrag = null;
  document.body.style.userSelect = '';
});

window.addEventListener('resize', () => {
  buildSlots();
  pieces.forEach((piece) => {
    if (piece.dataset.inBoard === 'true') {
      const index = Number(piece.dataset.index);
      const row = Math.floor(index / cols);
      const col = index % cols;
      piece.style.left = `${col * (board.clientWidth / cols)}px`;
      piece.style.top = `${row * (board.clientHeight / rows)}px`;
    } else {
      layoutTrayPieces();
    }
  });
});

shuffleBtn.addEventListener('click', () => {
  initAudio();
  playButtonSound();
  shufflePuzzle();
});

resetBtn.addEventListener('click', () => {
  initAudio();
  playButtonSound();
  resetPuzzle();
});

buildSlots();
buildPieces();
resetPuzzle();
