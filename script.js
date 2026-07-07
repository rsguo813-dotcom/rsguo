import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction,
  serverTimestamp,
  off,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

const cells = Array.from(document.querySelectorAll(".cell"));
const statusText = document.querySelector("#status");
const playerBadge = document.querySelector("#player-badge");
const startButton = document.querySelector("#start-game");
const restartButton = document.querySelector("#restart-game");
const endButton = document.querySelector("#end-game");
const modeSelect = document.querySelector("#mode-select");
const onlinePanel = document.querySelector("#online-panel");
const roomCodeInput = document.querySelector("#room-code");
const createRoomButton = document.querySelector("#create-room");
const joinRoomButton = document.querySelector("#join-room");
const onlineStatus = document.querySelector("#online-status");
const scoreX = document.querySelector("#score-x");
const scoreO = document.querySelector("#score-o");
const scoreDraw = document.querySelector("#score-draw");

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const text = {
  waiting: "選擇模式後按「開始」",
  connectFirst: "請先建立或加入線上房間",
  firebaseMissing: "請先在 firebase-config.js 填入 Firebase 設定",
  turn: (player) => `輪到玩家 ${player}`,
  localTurn: (player) => `同機雙人：玩家 ${player} 下棋`,
  computerTurn: "電腦思考中...",
  onlineTurn: (player) => `網路對戰：輪到玩家 ${player}`,
  waitOpponent: "房間已建立，等待玩家 O 加入",
  win: (player) => `玩家 ${player} 獲勝！`,
  draw: "平手，再來一局！",
  ended: "遊戲已結束，按「開始」再玩一局",
};

let state = createFreshState(false);
let mode = "computer";
let firebaseApp = null;
let database = null;

let online = {
  connected: false,
  room: "",
  player: "",
  roomRef: null,
  busy: false,
};

function createFreshState(started = true, scores = { X: 0, O: 0, draw: 0 }) {
  return {
    board: Array(9).fill(""),
    currentPlayer: "X",
    roundOver: !started,
    started,
    scores,
    players: { X: false, O: false },
    updatedAt: Date.now(),
  };
}

function render() {
  const winningLine = getWinningLine(state.board);
  cells.forEach((cell, index) => {
    const value = state.board[index];
    cell.textContent = value;
    cell.disabled = !canPlayCell(index);
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.classList.toggle("win", Boolean(winningLine?.includes(index)));
  });

  scoreX.textContent = state.scores.X;
  scoreO.textContent = state.scores.O;
  scoreDraw.textContent = state.scores.draw;
  playerBadge.textContent = getPlayerBadge();
  onlinePanel.hidden = mode !== "online";
}

function getPlayerBadge() {
  if (mode === "computer") return "你是 X，電腦是 O";
  if (mode === "local") return "同一台裝置輪流操作";
  if (!online.connected) return "尚未連線";
  return `你是 ${online.player}，房間 ${online.room}`;
}

function getWinningLine(board) {
  return winningLines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

function canPlayCell(index) {
  if (!state.started || state.roundOver || state.board[index]) return false;
  if (mode === "computer") return state.currentPlayer === "X";
  if (mode === "online") {
    return online.connected && state.players.O && !online.busy && state.currentPlayer === online.player;
  }
  return true;
}

function setStatusForTurn() {
  if (!state.started) {
    statusText.textContent = text.waiting;
    return;
  }

  if (mode === "computer" && state.currentPlayer === "O") {
    statusText.textContent = text.computerTurn;
  } else if (mode === "local") {
    statusText.textContent = text.localTurn(state.currentPlayer);
  } else if (mode === "online") {
    statusText.textContent = state.players.O ? text.onlineTurn(state.currentPlayer) : text.waitOpponent;
  } else {
    statusText.textContent = text.turn(state.currentPlayer);
  }
}

async function startGame(resetScore = false) {
  if (mode === "online") {
    if (!online.connected) {
      statusText.textContent = text.connectFirst;
      return;
    }
    await restartOnlineRound(resetScore);
    return;
  }

  state = createFreshState(true, resetScore ? { X: 0, O: 0, draw: 0 } : state.scores);
  setStatusForTurn();
  render();
}

async function endGame() {
  if (mode === "online" && online.connected) {
    await update(online.roomRef, {
      board: Array(9).fill(""),
      roundOver: true,
      started: false,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  state.started = false;
  state.roundOver = true;
  state.board = Array(9).fill("");
  statusText.textContent = text.ended;
  render();
}

function handleMove(index) {
  if (!canPlayCell(index)) return;

  if (mode === "online") {
    playOnlineMove(index);
    return;
  }

  playMove(index);
}

function playMove(index) {
  if (state.board[index] || state.roundOver) return;

  state.board[index] = state.currentPlayer;
  const result = getRoundResult(state.board);
  if (result) {
    finishRound(result);
    return;
  }

  state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
  setStatusForTurn();
  render();

  if (mode === "computer" && state.currentPlayer === "O") {
    window.setTimeout(playComputerMove, 420);
  }
}

function getRoundResult(board) {
  const winningLine = getWinningLine(board);
  if (winningLine) return { winner: board[winningLine[0]], winningLine };
  if (board.every(Boolean)) return { winner: "draw", winningLine: null };
  return null;
}

function finishRound(result) {
  state.roundOver = true;
  if (result.winner === "draw") {
    state.scores.draw += 1;
    statusText.textContent = text.draw;
  } else {
    state.scores[result.winner] += 1;
    statusText.textContent = text.win(result.winner);
  }
  render();
}

function playComputerMove() {
  if (state.roundOver || mode !== "computer") return;
  const move = findBestComputerMove();
  if (move >= 0) playMove(move);
}

function findBestComputerMove() {
  return findWinningMove("O") ?? findWinningMove("X") ?? pickFirstOpen([4, 0, 2, 6, 8, 1, 3, 5, 7]);
}

function findWinningMove(player) {
  for (const [a, b, c] of winningLines) {
    const line = [state.board[a], state.board[b], state.board[c]];
    const emptyCount = line.filter((value) => !value).length;
    const playerCount = line.filter((value) => value === player).length;
    if (emptyCount === 1 && playerCount === 2) {
      return [a, b, c].find((index) => !state.board[index]);
    }
  }
  return null;
}

function pickFirstOpen(indexes) {
  return indexes.find((index) => !state.board[index]) ?? -1;
}

function updateMode() {
  mode = modeSelect.value;
  disconnectOnline();
  state = createFreshState(false);
  statusText.textContent = mode === "online" ? "建立或加入房間後開始" : text.waiting;
  onlineStatus.textContent = getFirebaseReady()
    ? "玩家 A 建立房間並分享房號，玩家 B 輸入房號加入。"
    : text.firebaseMissing;
  render();
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeRoom(value) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
}

function getFirebaseReady() {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.databaseURL && firebaseConfig?.projectId);
}

function getDatabaseInstance() {
  if (!getFirebaseReady()) {
    onlineStatus.textContent = text.firebaseMissing;
    return null;
  }

  if (!database) {
    firebaseApp = firebaseApp || initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
  }

  return database;
}

async function createRoom() {
  const db = getDatabaseInstance();
  if (!db) return;

  const room = normalizeRoom(roomCodeInput.value || makeRoomCode());
  roomCodeInput.value = room;
  const nextRoomRef = ref(db, `rooms/${room}`);
  const snapshot = await get(nextRoomRef);

  if (snapshot.exists()) {
    onlineStatus.textContent = "這個房號已存在，請換一個或清空後自動產生。";
    return;
  }

  await set(nextRoomRef, {
    ...createFreshState(true),
    players: { X: true, O: false },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  connectToRoom(room, "X", nextRoomRef);
  onlineStatus.textContent = `房間 ${room} 已建立，請把房號給玩家 B。`;
}

async function joinRoom() {
  const db = getDatabaseInstance();
  if (!db) return;

  const room = normalizeRoom(roomCodeInput.value);
  if (!room) {
    onlineStatus.textContent = "請輸入房間代碼。";
    return;
  }

  const nextRoomRef = ref(db, `rooms/${room}`);
  const snapshot = await get(nextRoomRef);
  if (!snapshot.exists()) {
    onlineStatus.textContent = "找不到房間，請確認玩家 A 已建立房間。";
    return;
  }

  const roomState = snapshot.val();
  if (roomState.players?.O) {
    onlineStatus.textContent = "房間已滿，請建立新的房間。";
    return;
  }

  await update(nextRoomRef, {
    "players/O": true,
    updatedAt: serverTimestamp(),
  });

  connectToRoom(room, "O", nextRoomRef);
  onlineStatus.textContent = `已加入房間 ${room}，你是玩家 O。`;
}

function connectToRoom(room, player, nextRoomRef) {
  disconnectOnline();
  online = {
    connected: true,
    room,
    player,
    roomRef: nextRoomRef,
    busy: false,
  };

  onValue(online.roomRef, (snapshot) => {
    const nextState = snapshot.val();
    if (!nextState) {
      onlineStatus.textContent = "房間已不存在。";
      disconnectOnline();
      return;
    }
    applyOnlineState(nextState);
  });

  render();
}

function disconnectOnline() {
  if (online.roomRef) off(online.roomRef);
  online = {
    connected: false,
    room: "",
    player: "",
    roomRef: null,
    busy: false,
  };
}

async function restartOnlineRound(resetScore) {
  if (!online.roomRef || online.busy) return;
  online.busy = true;
  render();

  try {
    await runTransaction(online.roomRef, (room) => {
      if (!room) return room;
      return {
        ...room,
        ...createFreshState(true, resetScore ? { X: 0, O: 0, draw: 0 } : room.scores),
        players: room.players,
        createdAt: room.createdAt,
        updatedAt: Date.now(),
      };
    });
  } finally {
    online.busy = false;
    render();
  }
}

async function playOnlineMove(index) {
  if (!online.roomRef || online.busy) return;
  online.busy = true;
  render();

  try {
    await runTransaction(online.roomRef, (room) => {
      if (!room || !room.started || room.roundOver) return room;
      if (room.currentPlayer !== online.player || room.board[index]) return room;

      const board = [...room.board];
      const scores = { ...room.scores };
      board[index] = online.player;

      const result = getRoundResult(board);
      let roundOver = false;
      let currentPlayer = online.player === "X" ? "O" : "X";

      if (result?.winner === "draw") {
        scores.draw += 1;
        roundOver = true;
        currentPlayer = online.player;
      } else if (result?.winner) {
        scores[result.winner] += 1;
        roundOver = true;
        currentPlayer = online.player;
      }

      return {
        ...room,
        board,
        scores,
        currentPlayer,
        roundOver,
        updatedAt: Date.now(),
      };
    });
  } finally {
    online.busy = false;
    render();
  }
}

function applyOnlineState(nextState) {
  state = {
    board: nextState.board || Array(9).fill(""),
    currentPlayer: nextState.currentPlayer || "X",
    roundOver: Boolean(nextState.roundOver),
    started: Boolean(nextState.started),
    scores: nextState.scores || { X: 0, O: 0, draw: 0 },
    players: nextState.players || { X: false, O: false },
    updatedAt: nextState.updatedAt || Date.now(),
  };

  if (!state.started) {
    statusText.textContent = text.ended;
  } else if (!state.players.O) {
    statusText.textContent = text.waitOpponent;
  } else if (state.roundOver) {
    const result = getRoundResult(state.board);
    statusText.textContent = result?.winner === "draw" ? text.draw : text.win(result?.winner);
  } else {
    setStatusForTurn();
  }

  render();
}

cells.forEach((cell, index) => {
  cell.addEventListener("click", () => handleMove(index));
});

startButton.addEventListener("click", () => startGame(true));
restartButton.addEventListener("click", () => startGame(false));
endButton.addEventListener("click", endGame);
modeSelect.addEventListener("change", updateMode);
createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);

render();
