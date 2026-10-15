/**
 * Naija Whot Online — Client
 * Premium real-time 2-player experience
 */

(() => {
  'use strict';

  // ========== STATE ==========
  const state = {
    username: localStorage.getItem('whot_username') || '',
    socket: null,
    screen: 'login',
    game: null,
    selectedCardId: null,
    soundEnabled: localStorage.getItem('whot_sound') !== 'false',
    pendingWhotCardId: null,
    timerInterval: null,
    challengeFrom: null
  };

  // ========== DOM ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    login: $('#screen-login'),
    lobby: $('#screen-lobby'),
    game: $('#screen-game')
  };

  // ========== SHAPE SVGs ==========
  const SHAPE_SVG = {
    circle: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" class="shape-circle"/></svg>`,
    triangle: `<svg viewBox="0 0 40 40"><polygon points="20,6 34,32 6,32" class="shape-triangle"/></svg>`,
    cross: `<svg viewBox="0 0 40 40"><path d="M16 6h8v10h10v8H24v10h-8V24H6v-8h10V6z" class="shape-cross"/></svg>`,
    square: `<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" rx="2" class="shape-square"/></svg>`,
    star: `<svg viewBox="0 0 40 40"><polygon points="20,4 24.5,15 36,15.5 27,23 30,34 20,27.5 10,34 13,23 4,15.5 15.5,15" class="shape-star"/></svg>`,
    whot: `<span class="whot-text">WHOT</span>`
  };

  const REACTIONS = [
    { emoji: '😂', text: 'LOL' },
    { emoji: '😲', text: 'Ehn?!' },
    { emoji: '🔥', text: 'Fire' },
    { emoji: '👏', text: 'Well played' },
    { emoji: '😭', text: 'Wahala' },
    { emoji: '😤', text: 'I vex' },
    { emoji: '🙏', text: 'Abeg' },
    { emoji: '👈', text: 'Na you sabi' }
  ];

  // ========== AUDIO (Web Audio API — no assets) ==========
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function playTone(freq, duration, type = 'sine', gain = 0.08) {
    if (!state.soundEnabled) return;
    try {
      ensureAudio();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function sfxPlay() { playTone(420, 0.08, 'triangle', 0.06); }
  function sfxDraw() { playTone(280, 0.12, 'sine', 0.05); }
  function sfxWin() { playTone(520, 0.15, 'sine', 0.07); setTimeout(() => playTone(680, 0.2, 'sine', 0.07), 120); }
  function sfxClick() { playTone(600, 0.04, 'square', 0.03); }
  function sfxError() { playTone(180, 0.15, 'sawtooth', 0.04); }
  function sfxReaction() { playTone(800, 0.06, 'sine', 0.05); }

  // ========== HELPERS ==========
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name]?.classList.remove('hidden');
    state.screen = name;
  }

  function toast(msg, ms = 2500) {
    const el = $('#toast');
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, 0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, 10px)';
    }, ms);
  }

  function sysMsg(msg) {
    const el = $('#sys-msg');
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0.5'; }, 4000);
  }

  function renderCard(card, opts = {}) {
    const div = document.createElement('div');
    div.className = 'card' + (opts.disabled ? ' disabled' : '') + (opts.playable ? ' playable' : '') + (opts.selected ? ' selected' : '');
    div.dataset.id = card.id;

    if (card.number === 20) {
      div.innerHTML = `
        <div class="card-face whot">
          <span class="card-num top">20</span>
          <div class="card-shape">${SHAPE_SVG.whot}</div>
          <span class="card-num bottom">20</span>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="card-face">
          <span class="card-num top">${card.number}</span>
          <div class="card-shape">${SHAPE_SVG[card.shape] || ''}</div>
          <span class="card-num bottom">${card.number}</span>
        </div>`;
    }
    return div;
  }

  function isPlayable(card, game) {
    if (!game || !game.isMyTurn) return false;
    if (game.pendingPenalty > 0) {
      if (game.penaltyType === '2' && card.number === 2) return true;
      if (game.penaltyType === '5' && card.number === 5) return true;
      return false;
    }
    if (card.number === 20) return true;
    const top = game.tableTop;
    if (game.requiredShape) return card.shape === game.requiredShape;
    if (!top) return true;
    return card.shape === top.shape || card.number === top.number;
  }

  // ========== RENDER GAME ==========
  function renderGame() {
    const g = state.game;
    if (!g) return;

    // Opponent
    $('#opp-name').textContent = g.opponentUsername;
    $('#opp-status').textContent = g.opponentConnected ? 'Connected' : 'Reconnecting...';
    $('#opp-status').className = 'text-xs ' + (g.opponentConnected ? 'text-white/40' : 'text-red-400');

    // Opp hand backs
    const oppHand = $('#opp-hand');
    oppHand.innerHTML = '';
    for (let i = 0; i < g.opponentHandCount; i++) {
      const back = document.createElement('div');
      back.className = 'card-back';
      back.style.width = 'var(--card-w)';
      back.style.height = 'var(--card-h)';
      oppHand.appendChild(back);
    }

    // Market
    $('#market-count').textContent = g.marketCount;

    // Table top
    const tableEl = $('#table-card');
    tableEl.innerHTML = '';
    if (g.tableTop) {
      const c = renderCard(g.tableTop);
      c.style.cursor = 'default';
      tableEl.appendChild(c);
    }

    // Required shape
    const req = $('#required-shape');
    if (g.requiredShape) {
      req.innerHTML = `Call: <strong class="text-amber">${g.requiredShape.toUpperCase()}</strong>`;
    } else {
      req.textContent = '';
    }

    // Penalty
    const pen = $('#penalty-banner');
    if (g.pendingPenalty > 0 && g.isMyTurn) {
      pen.classList.remove('hidden');
      $('#penalty-count').textContent = g.pendingPenalty;
    } else {
      pen.classList.add('hidden');
    }

    // Turn indicator
    const turnEl = $('#turn-indicator');
    if (g.gameOver) {
      turnEl.textContent = 'Game Over';
      turnEl.className = 'text-xs font-medium px-3 py-1 rounded-full bg-white/10';
    } else if (g.isMyTurn) {
      turnEl.textContent = 'Your Turn';
      turnEl.className = 'text-xs font-medium px-3 py-1 rounded-full bg-amber/20 text-amber';
    } else {
      turnEl.textContent = `${g.opponentUsername}'s Turn`;
      turnEl.className = 'text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-white/50';
    }

    // My hand
    const handEl = $('#my-hand');
    handEl.innerHTML = '';
    g.myHand.forEach((card, i) => {
      const playable = isPlayable(card, g);
      const selected = state.selectedCardId === card.id;
      const el = renderCard(card, { playable, selected, disabled: !g.isMyTurn });
      el.style.animationDelay = `${i * 0.03}s`;
      el.addEventListener('click', () => onCardClick(card));
      handEl.appendChild(el);
    });

    // Timer
    updateTimerUI();
  }

  function updateTimerUI() {
    const g = state.game;
    const container = $('#timer-container');
    const bar = $('#timer-bar');
    if (!g || g.gameOver || !g.turnDeadline || !g.isMyTurn) {
      container.classList.add('hidden');
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
      return;
    }
    container.classList.remove('hidden');

    const tick = () => {
      const left = Math.max(0, g.turnDeadline - Date.now());
      const pct = (left / 20000) * 100;
      bar.style.width = pct + '%';
      if (pct < 25) bar.classList.add('critical');
      else bar.classList.remove('critical');
      if (left <= 0 && state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
    };
    tick();
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(tick, 100);
  }

  // ========== CARD INTERACTION ==========
  function onCardClick(card) {
    const g = state.game;
    if (!g || !g.isMyTurn || g.gameOver) return;

    if (!isPlayable(card, g)) {
      sfxError();
      toast('Cannot play that card');
      return;
    }

    if (card.number === 20) {
      // Show shape picker
      state.pendingWhotCardId = card.id;
      showWhotPicker();
      return;
    }

    playCard(card.id, null);
  }

  function playCard(cardId, chosenShape) {
    sfxPlay();
    state.socket.emit('playCard', { cardId, chosenShape }, (res) => {
      if (!res?.ok) {
        sfxError();
        toast(res?.error || 'Invalid move');
      }
      state.selectedCardId = null;
      state.pendingWhotCardId = null;
      hideWhotPicker();
    });
  }

  function showWhotPicker() {
    const overlay = $('#overlay-whot');
    const picker = $('#shape-picker');
    picker.innerHTML = '';
    ['circle', 'triangle', 'cross', 'square', 'star'].forEach(shape => {
      const btn = document.createElement('button');
      btn.className = 'shape-pick-btn';
      btn.innerHTML = SHAPE_SVG[shape];
      btn.title = shape;
      btn.addEventListener('click', () => {
        sfxClick();
        playCard(state.pendingWhotCardId, shape);
      });
      picker.appendChild(btn);
    });
    overlay.classList.remove('hidden');
  }

  function hideWhotPicker() {
    $('#overlay-whot').classList.add('hidden');
  }

  // ========== REACTIONS ==========
  function initReactionTray() {
    const tray = $('#reaction-tray');
    tray.innerHTML = '';
    REACTIONS.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'reaction-btn';
      btn.textContent = r.emoji;
      btn.title = r.text;
      btn.addEventListener('click', () => {
        sfxReaction();
        state.socket.emit('sendReaction', { emoji: r.emoji, text: r.text });
        showFloatingReaction(r.emoji, true);
      });
      tray.appendChild(btn);
    });
  }

  function showFloatingReaction(emoji, isMe = false) {
    const el = $('#reaction-float');
    el.textContent = emoji;
    el.style.opacity = '1';
    el.style.left = isMe ? '60%' : '40%';
    el.style.top = isMe ? '60%' : '30%';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -80%) scale(1.4)';
    }, 80);
    setTimeout(() => {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.5)';
      setTimeout(() => { el.style.transition = ''; }, 50);
    }, 900);
  }

  // ========== SOCKET ==========
  function connect() {
    const socket = io({ autoConnect: true, reconnection: true, reconnectionAttempts: 10 });
    state.socket = socket;

    socket.on('connect', () => {
      console.log('Connected', socket.id);
      if (state.username) {
        // Try reconnect with username
        socket.emit('reconnectUser', { username: state.username }, (res) => {
          if (res?.ok) {
            if (res.inGame && res.state) {
              state.game = res.state;
              showScreen('game');
              renderGame();
              toast('Reconnected to game!');
            } else {
              socket.emit('setUsername', { username: state.username }, () => {});
              if (state.screen !== 'game') showScreen('lobby');
            }
          }
        });
      }
    });

    socket.on('onlineCount', (n) => {
      $('#online-count').textContent = n;
      $('#lobby-online').textContent = n;
    });

    socket.on('challengeIncoming', ({ from }) => {
      state.challengeFrom = from;
      $('#challenger-name').textContent = from;
      $('#overlay-challenge').classList.remove('hidden');
      sfxClick();
    });

    socket.on('challengeDeclined', ({ by }) => {
      toast(`${by} declined your challenge`);
      $('#challenge-status').textContent = '';
    });

    socket.on('gameStart', (gameState) => {
      state.game = gameState;
      showScreen('game');
      renderGame();
      $('#overlay-challenge').classList.add('hidden');
      toast('Game started! Good luck');
      sfxPlay();
    });

    socket.on('gameState', (gameState) => {
      state.game = gameState;
      renderGame();
    });

    socket.on('systemMessage', (msg) => {
      sysMsg(msg);
    });

    socket.on('reaction', ({ from, emoji, text }) => {
      if (from !== state.username) {
        showFloatingReaction(emoji, false);
        sfxReaction();
      }
    });

    socket.on('gameOver', ({ winner, scores, loserHand }) => {
      const won = winner === state.username;
      $('#go-emoji').textContent = won ? '🏆' : '😔';
      $('#go-title').textContent = won ? 'You Win!' : 'You Lost';
      $('#go-subtitle').textContent = won
        ? `You emptied your hand first`
        : `${winner} won the round`;
      const scoresHtml = Object.entries(scores)
        .map(([u, s]) => `<div>${u}: <span class="text-amber">${s} pts</span></div>`)
        .join('');
      $('#go-scores').innerHTML = scoresHtml;
      $('#overlay-gameover').classList.remove('hidden');
      if (won) sfxWin();
      else sfxError();
    });

    socket.on('rematchRequest', ({ from }) => {
      toast(`${from} wants a rematch!`);
    });

    socket.on('disconnect', () => {
      toast('Disconnected — reconnecting...', 4000);
    });
  }

  // ========== UI BINDINGS ==========
  function initUI() {
    // Login
    const input = $('#username-input');
    if (state.username) input.value = state.username;

    $('#btn-set-username').addEventListener('click', () => {
      const name = input.value.trim();
      if (name.length < 2) {
        $('#login-error').textContent = 'Username must be at least 2 characters';
        $('#login-error').classList.remove('hidden');
        return;
      }
      state.socket.emit('setUsername', { username: name }, (res) => {
        if (res?.ok) {
          state.username = res.username;
          localStorage.setItem('whot_username', res.username);
          $('#lobby-username').textContent = res.username;
          $('#login-error').classList.add('hidden');
          showScreen('lobby');
          refreshOnlineList();
          sfxClick();
        } else {
          $('#login-error').textContent = res?.error || 'Error';
          $('#login-error').classList.remove('hidden');
          sfxError();
        }
      });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#btn-set-username').click();
    });

    // Challenge
    $('#btn-challenge').addEventListener('click', () => {
      const target = $('#challenge-input').value.trim();
      if (!target) return;
      $('#challenge-status').textContent = 'Sending...';
      state.socket.emit('challenge', { targetUsername: target }, (res) => {
        if (res?.ok) {
          $('#challenge-status').textContent = res.message;
          toast(`Challenge sent to ${target}`);
        } else {
          $('#challenge-status').textContent = res?.error || 'Failed';
          sfxError();
        }
      });
    });

    $('#challenge-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#btn-challenge').click();
    });

    // Accept / Decline
    $('#btn-accept').addEventListener('click', () => {
      if (!state.challengeFrom) return;
      state.socket.emit('acceptChallenge', { fromUsername: state.challengeFrom }, (res) => {
        if (!res?.ok) toast(res?.error || 'Could not accept');
        $('#overlay-challenge').classList.add('hidden');
        state.challengeFrom = null;
      });
    });

    $('#btn-decline').addEventListener('click', () => {
      if (state.challengeFrom) {
        state.socket.emit('declineChallenge', { fromUsername: state.challengeFrom });
      }
      $('#overlay-challenge').classList.add('hidden');
      state.challengeFrom = null;
    });

    // Draw
    $('#btn-draw').addEventListener('click', () => {
      if (!state.game?.isMyTurn) return;
      sfxDraw();
      state.socket.emit('drawFromMarket', (res) => {
        if (!res?.ok) toast(res?.error || 'Cannot draw');
      });
    });

    $('#market-pile').addEventListener('click', () => {
      $('#btn-draw').click();
    });

    // Leave
    $('#btn-leave').addEventListener('click', () => {
      if (confirm('Leave the game? You will forfeit.')) {
        state.socket.emit('leaveGame');
        state.game = null;
        showScreen('lobby');
        $('#overlay-gameover').classList.add('hidden');
      }
    });

    // Game over buttons
    $('#btn-rematch').addEventListener('click', () => {
      state.socket.emit('requestRematch');
      state.socket.emit('acceptRematch'); // optimistic both accept for simplicity
      $('#overlay-gameover').classList.add('hidden');
      toast('Starting rematch...');
    });

    $('#btn-lobby').addEventListener('click', () => {
      state.socket.emit('leaveGame');
      state.game = null;
      showScreen('lobby');
      $('#overlay-gameover').classList.add('hidden');
      refreshOnlineList();
    });

    // Sound toggle
    $('#btn-sound').addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('whot_sound', state.soundEnabled);
      $('#btn-sound').textContent = state.soundEnabled ? '🔊' : '🔇';
      sfxClick();
    });
    $('#btn-sound').textContent = state.soundEnabled ? '🔊' : '🔇';

    initReactionTray();

    // Periodic online list refresh
    setInterval(refreshOnlineList, 8000);
  }

  function refreshOnlineList() {
    if (state.screen !== 'lobby' || !state.socket?.connected) return;
    state.socket.emit('getOnlineUsers', (list) => {
      const el = $('#online-list');
      if (!list || list.length === 0) {
        el.innerHTML = '<span class="text-white/30 text-sm">No other players online</span>';
        return;
      }
      el.innerHTML = '';
      list.forEach(uname => {
        const chip = document.createElement('button');
        chip.className = 'user-chip';
        chip.textContent = uname;
        chip.addEventListener('click', () => {
          $('#challenge-input').value = uname;
          $('#btn-challenge').click();
        });
        el.appendChild(chip);
      });
    });
  }

  // ========== BOOT ==========
  function boot() {
    connect();
    initUI();
    if (state.username) {
      // Will set on connect
      showScreen('login');
      $('#username-input').value = state.username;
    } else {
      showScreen('login');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
