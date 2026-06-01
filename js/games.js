/**
 * HoopStats - 比赛管理模块 ⭐核心
 * 包含实时记录功能和快捷键支持
 */

const GameManager = {
  // 当前比赛状态
  currentGame: null,
  currentTeam: 'home',  // 当前选中球队
  currentPlayer: null,  // 当前选中球员
  isPaused: false,
  timerInterval: null,
  gameTimer: 0, // 秒

  // Shot Clock（进攻时钟）
  shotClock: 24,          // 当前剩余秒数
  shotClockInterval: null, // 独立计时器
  shotClockRunning: false,

  period: 1,

  // 比赛规则配置
  gameSettings: {
    periods: 4,
    periodMinutes: 12,
    timeouts: 3,
    foulLimit: 5,
    shotClockSeconds: 24  // 进攻时钟初始秒数（0=不使用）
  },

  // 各队暂停/换人剩余次数
  teamResources: {
    home: { timeouts: 3, subs: 99 },
    away: { timeouts: 3, subs: 99 }
  },

  // 事件历史（用于撤销）
  eventHistory: [],

  // 换人选择状态
  subSelection: { out: null, in: null },

  // 统计面板状态
  currentStatsTab: 'regular',  // 当前统计标签
  selectedStatsPlayer: null,    // 选中的球员用于查看详情

  // 快捷键映射（默认配置）
  // 左手区：Q/W/E = 2分/3分/罚球命中，Z/X/C = 对应miss
  // 右手区：R/A/S/D/F = 篮板/助攻/抢断/失误/犯规
  KEYBINDINGS: {
    'q': 'fg2m',   // Q: 2分命中
    'z': 'fg2x',   // Z: 2分不中
    'w': 'fg3m',   // W: 3分命中
    'x': 'fg3x',   // X: 3分不中
    'e': 'ftm',    // E: 罚球命中
    'c': 'ftx',    // C: 罚球不中
    'r': 'reb',    // R: 篮板
    'a': 'ast',    // A: 助攻
    's': 'stl',    // S: 抢断
    'g': 'blk',    // G: 盖帽
    'd': 'tov',    // D: 失误
    'f': 'foul',   // F: 犯规
    't': 'timeout', // T: 请求暂停
    'y': 'sub',    // Y: 换人
    ' ': 'pause',  // 空格: 暂停/恢复
    'tab': 'switch', // Tab: 切换球队
    'backspace': 'undo', // 退格: 撤销
    'h': 'highlight' // H: 精彩时刻
  },

  // 动作说明
  ACTION_INFO: {
    'fg2m': { label: '2分命中', icon: '🎯', color: 'success' },
    'fg3m': { label: '3分命中', icon: '🎯', color: 'success' },
    'ftm': { label: '罚球命中', icon: '🎯', color: 'success' },
    'fg2x': { label: '2分不中', icon: '✖', color: 'danger' },
    'fg3x': { label: '3分不中', icon: '✖', color: 'danger' },
    'ftx': { label: '罚球不中', icon: '✖', color: 'danger' },
    'reb': { label: '篮板', icon: '📊', color: 'info' },
    'ast': { label: '助攻', icon: '🎯', color: 'info' },
    'stl': { label: '抢断', icon: '✋', color: 'warning' },
    'blk': { label: '盖帽', icon: '🛡', color: 'info' },
    'tov': { label: '失误', icon: '❌', color: 'warning' },
    'foul': { label: '犯规', icon: '🚨', color: 'danger' },
    'sub': { label: '换人', icon: '🔄', color: 'info' },
    'timeout': { label: '暂停', icon: '⏸', color: 'secondary' },
    'highlight': { label: '精彩时刻', icon: '⭐', color: 'warning' }
  },

  /**
   * 初始化
   */
  init() {
    this.loadKeybindings();
    this.bindKeyboard();
    this.render();
  },

  /**
   * 从localStorage加载自定义快捷键
   */
  loadKeybindings() {
    const saved = localStorage.getItem('hoopstats_keybindings');
    if (saved) {
      try {
        Object.assign(this.KEYBINDINGS, JSON.parse(saved));
      } catch (e) {
        console.error('[GameManager] Failed to load keybindings:', e);
      }
    }
  },

  /**
   * 保存自定义快捷键到localStorage
   */
  saveKeybindings() {
    localStorage.setItem('hoopstats_keybindings', JSON.stringify(this.KEYBINDINGS));
  },

  /**
   * 绑定键盘事件
   */
  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // 忽略输入框中的按键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // 检查是否在比赛页面
      const scorePage = document.getElementById('page-score');
      if (!scorePage || scorePage.classList.contains('hidden')) return;

      // 检查是否在换人模态框中
      const subModal = document.getElementById('sub-modal');
      if (subModal && subModal.classList.contains('active')) {
        // 换人模态框中：数字键选球员，Enter 确认，Escape 取消
        const key = e.key;
        if (key === 'Enter') {
          e.preventDefault();
          this.confirmSubstitution();
        } else if (key === 'Escape') {
          e.preventDefault();
          this.closeSubModal();
        } else if (/^[1-9]$/.test(key)) {
          e.preventDefault();
          this.handleSubKeySelect(parseInt(key));
        }
        return;
      }

      const key = e.key.toLowerCase();

      // 数字键 1-9：选择当前队球员
      if (/^[1-9]$/.test(key)) {
        e.preventDefault();
        this.selectPlayerByKey(parseInt(key));
        return;
      }

      const action = this.KEYBINDINGS[key];
      if (action) {
        e.preventDefault();
        this.handleAction(action);
      }
    });
  },

  /**
   * 处理动作
   */
  handleAction(action) {
    switch (action) {
      case 'pause':
        this.togglePause();
        break;
      case 'switch':
        this.switchTeam();
        break;
      case 'undo':
        this.undoLastAction();
        break;
      case 'timeout':
        this.requestTimeout();
        break;
      case 'sub':
        this.requestSubstitution();
        break;
      default:
        this.recordAction(action);
    }
  },

  /**
   * 切换当前球队（通过按钮点击）
   */
  switchTeamTo(side) {
    if (!this.currentGame) return;

    this.currentTeam = side;
    this.currentPlayer = null;
    this.updateTeamSelector();
    this.updateTeamSelectorDisplay();
    this.renderPlayerGrid(); // 重新渲染球员网格
    Toast.show(`已切换到${side === 'home' ? '主队' : '客队'}`, 'info');
  },

  /**
   * 切换当前球队
   */
  switchTeam() {
    this.currentTeam = this.currentTeam === 'home' ? 'away' : 'home';
    this.currentPlayer = null;
    this.updateTeamSelector();
    this.updateTeamSelectorDisplay();
    this.renderPlayerGrid(); // 重新渲染球员网格
    Toast.show(`已切换到${this.currentTeam === 'home' ? '主队' : '客队'}`, 'info');
  },

  /**
   * 更新球队选择器显示
   */
  updateTeamSelector() {
    const homeSelector = document.getElementById('team-selector-home');
    const awaySelector = document.getElementById('team-selector-away');

    if (homeSelector) {
      homeSelector.classList.toggle('active', this.currentTeam === 'home');
    }
    if (awaySelector) {
      awaySelector.classList.toggle('active', this.currentTeam === 'away');
    }

    // 更新当前球队指示器
    const indicator = document.getElementById('current-team-indicator');
    if (indicator) {
      indicator.textContent = this.currentTeam === 'home' ? '🏀 主队' : '🏀 客队';
    }
  },

  /**
   * 更新球队选择器详情显示
   */
  updateTeamSelectorDisplay() {
    if (!this.currentGame) return;

    const homeTeam = DB.getTeams().find(t => t.id === this.currentGame.homeTeamId);
    const awayTeam = DB.getTeams().find(t => t.id === this.currentGame.awayTeamId);

    const homeIcon = document.getElementById('home-selector-icon');
    const homeName = document.getElementById('home-selector-name');
    if (homeIcon) homeIcon.textContent = homeTeam?.icon || '🏀';
    if (homeName) homeName.textContent = homeTeam?.name || '主队';

    const awayIcon = document.getElementById('away-selector-icon');
    const awayName = document.getElementById('away-selector-name');
    if (awayIcon) awayIcon.textContent = awayTeam?.icon || '🏀';
    if (awayName) awayName.textContent = awayTeam?.name || '客队';

    // 更新暂停次数显示
    this.updateTimeoutPips();
  },

  /**
   * 更新暂停次数点显示
   */
  updateTimeoutPips() {
    const homePips = document.getElementById('home-timeout-pips');
    const awayPips = document.getElementById('away-timeout-pips');
    const totalTimeouts = this.gameSettings.timeouts;

    if (homePips) {
      const homeLeft = this.teamResources.home.timeouts;
      homePips.innerHTML = Array(totalTimeouts).fill(0).map((_, i) =>
        `<span class="timeout-pip ${i < homeLeft ? 'available' : 'used'}"></span>`
      ).join('');
    }

    if (awayPips) {
      const awayLeft = this.teamResources.away.timeouts;
      awayPips.innerHTML = Array(totalTimeouts).fill(0).map((_, i) =>
        `<span class="timeout-pip ${i < awayLeft ? 'available' : 'used'}"></span>`
      ).join('');
    }
  },

  /**
   * 渲染比赛列表
   */
  render() {
    const games = DB.getGames();
    const container = document.getElementById('game-list');

    if (!container) return;

    if (games.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <div class="empty-title">暂无比赛记录</div>
          <div class="empty-desc">创建一场比赛，开始记录精彩瞬间</div>
          <button class="btn btn-primary" onclick="GameManager.showCreateModal()">
            <span>🏀</span> 创建比赛
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = games.map(game => {
      const homeTeam = DB.getTeams().find(t => t.id === game.homeTeamId);
      const awayTeam = DB.getTeams().find(t => t.id === game.awayTeamId);
      const statusBadge = game.status === 'live'
        ? '<span class="badge badge-success">● 直播中</span>'
        : '<span class="badge badge-info">✓ 已结束</span>';

      return `
        <div class="card" onclick="GameManager.resumeGame('${game.id}')" style="cursor:pointer;">
          <div class="card-header">
            <div class="flex items-center gap-md">
              <span style="font-size:0.9rem;color:var(--text-dim);">
                ${new Date(game.date).toLocaleDateString('zh-CN')}
                ${game.location ? '· ' + game.location : ''}
              </span>
              ${statusBadge}
            </div>
            <div class="flex gap-sm">
              ${game.status === 'live' ? `
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();GameManager.endGame('${game.id}')">
                  结束比赛
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();GameManager.deleteGame('${game.id}')">
                🗑️
              </button>
            </div>
          </div>
          <div class="score-section" style="background:transparent;padding:0;">
            <div class="team-score">
              <div style="font-size:1.5rem;">${homeTeam?.icon || '🏀'}</div>
              <div style="font-weight:600;">${homeTeam?.name || '主队'}</div>
              <div class="score-value home">${game.homeScore || 0}</div>
            </div>
            <div class="score-divider">:</div>
            <div class="team-score">
              <div style="font-size:1.5rem;">${awayTeam?.icon || '🏀'}</div>
              <div style="font-weight:600;">${awayTeam?.name || '客队'}</div>
              <div class="score-value away">${game.awayScore || 0}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * 显示创建比赛模态框
   */
  showCreateModal() {
    const teams = DB.getTeams();

    if (teams.length < 2) {
      Toast.show('需要至少2支球队才能创建比赛', 'error');
      return;
    }

    const modal = document.getElementById('game-modal');
    const form = document.getElementById('game-form');

    form.reset();
    form.dataset.gameId = '';

    // 填充球队下拉
    const homeSelect = document.getElementById('game-home-team');
    const awaySelect = document.getElementById('game-away-team');

    const options = teams.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('');

    homeSelect.innerHTML = options;
    awaySelect.innerHTML = options;

    // 设置默认选项
    if (teams.length >= 2) {
      homeSelect.value = teams[0].id;
      awaySelect.value = teams[1].id;
    }

    // 设置默认日期
    document.getElementById('game-date').value = new Date().toISOString().split('T')[0];

    // 加载球员阵容
    this.loadTeamPlayers('home');
    this.loadTeamPlayers('away');

    modal.classList.add('active');
  },

  /**
   * 加载球队球员到阵容选择器
   */
  loadTeamPlayers(side) {
    const teamSelect = document.getElementById(`game-${side}-team`);
    const teamId = teamSelect?.value;
    const container = document.getElementById('lineup-selection');

    if (!teamId || !container) return;

    const players = DB.getPlayersByTeam(teamId);
    const team = DB.getTeams().find(t => t.id === teamId);

    // 找到对应的阵容区域
    let lineupDiv = container.querySelector(`[data-lineup="${side}"]`);
    if (!lineupDiv) {
      // 首次创建
      const homeDiv = container.querySelector('[data-lineup="home"]');
      const awayDiv = container.querySelector('[data-lineup="away"]');

      if (side === 'home' && !homeDiv) {
        const div = document.createElement('div');
        div.className = 'lineup-team';
        div.dataset.lineup = 'home';
        div.dataset.side = 'home';
        container.insertBefore(div, container.firstChild);
        lineupDiv = div;
      } else if (side === 'away' && !awayDiv) {
        const div = document.createElement('div');
        div.className = 'lineup-team';
        div.dataset.lineup = 'away';
        div.dataset.side = 'away';
        container.appendChild(div);
        lineupDiv = div;
      } else {
        lineupDiv = side === 'home' ? homeDiv : awayDiv;
      }
    }

    if (!lineupDiv) return;

    // 更新阵容显示
    lineupDiv.innerHTML = `
      <div class="lineup-team-header">
        <div class="lineup-team-name">
          <span style="font-size:1.25rem;">${team?.icon || '🏀'}</span>
          <span>${team?.name || side}</span>
        </div>
        <div class="lineup-starter-count">首发: <span id="starter-count-${side}">0</span>/5</div>
      </div>
      <div class="lineup-player-list">
        ${players.length === 0 ? '<div class="text-secondary text-sm">该球队暂无球员</div>' : players.map(p => `
          <div class="lineup-player-item ${this.isStarterSelected(side, p.id) ? 'starter' : ''}"
               data-player-id="${p.id}"
               data-side="${side}"
               onclick="GameManager.toggleLineupPlayer(this)">
            <div class="lineup-player-checkbox">
              ${this.isStarterSelected(side, p.id) ? '✓' : ''}
            </div>
            <div class="lineup-player-number">${p.number || '-'}</div>
            <div class="lineup-player-name">${p.name}</div>
            <div class="lineup-player-pos">${p.position || ''}</div>
          </div>
        `).join('')}
      </div>
    `;

    // 更新首发计数
    this.updateStarterCount(side);
  },

  // 存储选择的首发球员
  lineupSelection: { home: [], away: [] },

  /**
   * 切换阵容球员选择
   */
  toggleLineupPlayer(el) {
    const playerId = el.dataset.playerId;
    const side = el.dataset.side;

    if (!this.lineupSelection[side]) {
      this.lineupSelection[side] = [];
    }

    const idx = this.lineupSelection[side].indexOf(playerId);

    if (idx > -1) {
      // 取消选择
      this.lineupSelection[side].splice(idx, 1);
      el.classList.remove('starter');
      el.querySelector('.lineup-player-checkbox').textContent = '';
    } else {
      // 选择（最多5人首发）
      if (this.lineupSelection[side].length >= 5) {
        Toast.show('首发阵容最多5人', 'warning');
        return;
      }
      this.lineupSelection[side].push(playerId);
      el.classList.add('starter');
      el.querySelector('.lineup-player-checkbox').textContent = '✓';
    }

    this.updateStarterCount(side);
  },

  /**
   * 检查球员是否已选为首发
   */
  isStarterSelected(side, playerId) {
    return this.lineupSelection[side]?.includes(playerId) || false;
  },

  /**
   * 更新首发计数
   */
  updateStarterCount(side) {
    const countEl = document.getElementById(`starter-count-${side}`);
    if (countEl) {
      const count = this.lineupSelection[side]?.length || 0;
      countEl.textContent = count;
    }
  },

  /**
   * 创建新比赛
   */
  createGame(e) {
    e.preventDefault();

    const homeTeamId = document.getElementById('game-home-team').value;
    const awayTeamId = document.getElementById('game-away-team').value;
    const gameDate = document.getElementById('game-date').value;
    const gameLocation = document.getElementById('game-location').value;
    const periods = parseInt(document.getElementById('game-periods').value);
    const periodMinutes = parseInt(document.getElementById('game-period-minutes').value);
    const timeouts = parseInt(document.getElementById('game-timeouts').value);
    const foulLimit = parseInt(document.getElementById('game-foul-limit').value);
    const shotClockSeconds = parseInt(document.getElementById('game-shot-clock')?.value || '24');

    if (homeTeamId === awayTeamId) {
      Toast.show('主队和客队不能相同', 'error');
      return;
    }

    // 验证首发阵容
    const homeStarters = this.lineupSelection.home || [];
    const awayStarters = this.lineupSelection.away || [];

    if (homeStarters.length === 0) {
      Toast.show('请选择主队首发阵容', 'error');
      return;
    }

    if (awayStarters.length === 0) {
      Toast.show('请选择客队首发阵容', 'error');
      return;
    }

    // 获取球员数据
    const homePlayers = DB.getPlayersByTeam(homeTeamId).map(p => ({
      ...p,
      onCourt: homeStarters.includes(p.id)
    }));

    const awayPlayers = DB.getPlayersByTeam(awayTeamId).map(p => ({
      ...p,
      onCourt: awayStarters.includes(p.id)
    }));

    const game = {
      homeTeamId,
      awayTeamId,
      date: gameDate || new Date().toISOString().split('T')[0],
      location: gameLocation || '',
      homeScore: 0,
      awayScore: 0,
      period: 1,
      status: 'pending',
      events: [],
      // 赛制设置
      settings: {
        periods,
        periodMinutes,
        timeouts,
        foulLimit,
        shotClockSeconds
      },
      // 球队资源
      resources: {
        home: { timeouts, subs: 99 },
        away: { timeouts, subs: 99 }
      },
      // 首发阵容
      homeStarters,
      awayStarters,
      homePlayers,
      awayPlayers
    };

    const created = DB.addGame(game);
    if (created) {
      Toast.show('比赛创建成功', 'success');
      this.closeModal();

      // 直接进入比赛
      this.resumeGame(created.id);
    }
  },

  /**
   * 恢复/继续比赛
   */
  resumeGame(id) {
    const game = DB.getGames().find(g => g.id === id);
    if (!game) return;

    this.currentGame = game;
    this.period = game.period || 1;
    // 倒计时：初始化为完整节时长
    this.gameTimer = this.gameSettings.periodMinutes * 60;
    this.isPaused = game.status === 'live';
    this.currentTeam = 'home';
    this.currentPlayer = null;
    this.eventHistory = [];

    // 恢复赛制设置
    if (game.settings) {
      this.gameSettings = { ...game.settings };
      // 重新计算倒计时初始值
      this.gameTimer = this.gameSettings.periodMinutes * 60;
    }

    // 初始化进攻时钟
    this.shotClock = this.gameSettings.shotClockSeconds || 24;
    this.shotClockRunning = false;

    // 恢复球队资源
    if (game.resources) {
      this.teamResources = { ...game.resources };
    }

    this.showGamePanel();
    this.updateDisplay();

    if (this.isPaused && !this.timerInterval) {
      this.startTimer();
    }
  },

  /**
   * 显示比赛面板
   */
  showGamePanel() {
    document.getElementById('page-games').classList.add('hidden');
    document.getElementById('page-score').classList.remove('hidden');
    this.renderGamePanel();
  },

  /**
   * 渲染比赛面板
   */
  renderGamePanel() {
    if (!this.currentGame) return;

    const homeTeam = DB.getTeams().find(t => t.id === this.currentGame.homeTeamId);
    const awayTeam = DB.getTeams().find(t => t.id === this.currentGame.awayTeamId);

    // 更新球队信息
    document.getElementById('home-team-name').textContent = homeTeam?.name || '主队';
    document.getElementById('home-team-icon').textContent = homeTeam?.icon || '🏀';
    document.getElementById('away-team-name').textContent = awayTeam?.name || '客队';
    document.getElementById('away-team-icon').textContent = awayTeam?.icon || '🏀';

    // 更新比分
    document.getElementById('home-score').textContent = this.currentGame.homeScore || 0;
    document.getElementById('away-score').textContent = this.currentGame.awayScore || 0;

    // 更新计时器
    this.updateTimerDisplay();

    // 显示球员网格
    const playersSection = document.querySelector('.players-section');
    if (playersSection) playersSection.style.display = 'block';

    // 渲染球员网格
    this.renderPlayerGrid();

    // 更新球队选择器
    this.updateTeamSelector();
    this.updateTeamSelectorDisplay();

    // 更新快捷键提示
    this.renderKeyHints();

    // 初始化统计面板
    this.initStatsPanel();

    // 更新控制按钮状态
    this.updateControlButtons();

    // BoxScore（比赛结束后显示）
    this.renderBoxScore();
  },

  /**
   * 渲染球员网格
   * 单球队模式：只显示当前选中球队的场上球员
   */
  renderPlayerGrid() {
    const singleTeamContainer = document.getElementById('single-team-players');
    if (!singleTeamContainer) return;

    const currentSide = this.currentTeam;
    const players = currentSide === 'home'
      ? this.currentGame.homePlayers
      : this.currentGame.awayPlayers;

    if (!players || players.length === 0) {
      singleTeamContainer.innerHTML = '<div class="text-center text-dim" style="padding:var(--space-lg);">暂无球员</div>';
      return;
    }

    const onCourt = players.filter(p => p.onCourt);
    const team = currentSide === 'home'
      ? DB.getTeams().find(t => t.id === this.currentGame.homeTeamId)
      : DB.getTeams().find(t => t.id === this.currentGame.awayTeamId);

    const teamIcon = team?.icon || '🏀';
    const teamName = team?.name || (currentSide === 'home' ? '主队' : '客队');
    const teamColor = currentSide === 'home' ? 'var(--color-info)' : 'var(--color-warning)';

    singleTeamContainer.innerHTML = `
      <div class="single-team-panel" style="border-left: 3px solid ${teamColor};">
        <div class="single-team-header">
          <span class="team-panel-icon">${teamIcon}</span>
          <span class="team-panel-name" style="color:${teamColor};">${teamName}</span>
          <span class="badge badge-success">场上 (${onCourt.length}/5)</span>
        </div>
        <div class="single-team-grid">
          ${onCourt.length === 0
            ? '<div class="text-dim">暂无场上球员</div>'
            : onCourt.map((p, i) => `
                <div class="player-card ${this.currentPlayer?.id === p.id ? 'selected' : ''} active-team"
                     onclick="GameManager.selectPlayer('${p.id}', '${currentSide}')"
                     data-player-id="${p.id}">
                  <div class="player-key">${i + 1}</div>
                  <div class="player-num">${p.number || '-'}</div>
                  <div class="player-name">${p.name}</div>
                </div>
              `).join('')
          }
        </div>
        <div class="single-team-hint">
          数字键 1-${onCourt.length} 快速选人 · 点击球员卡片选择
        </div>
      </div>
    `;

    // 更新球队选择状态
    this.updateTeamSelector();
  },

  /**
   * 选择球员
   */
  selectPlayer(playerId, side) {
    // 如果点击的是对方球队的球员，自动切换球队
    if (side !== this.currentTeam) {
      this.currentTeam = side;
      this.updateTeamSelector();
    }

    const players = side === 'home' ? this.currentGame.homePlayers : this.currentGame.awayPlayers;
    const player = players.find(p => p.id === playerId);

    this.currentPlayer = player;

    // 更新选中状态
    document.querySelectorAll('.player-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.playerId === playerId);
    });

    const playerName = player?.name || '未知';
    Toast.show(`已选 ${playerName}`, 'info');
  },

  /**
   * 通过数字键选择球员（键盘快捷键）
   * 场上 1-5，替补 6-9
   */
  selectPlayerByKey(key) {
    if (!this.currentGame) return;

    const players = this.currentTeam === 'home'
      ? this.currentGame.homePlayers
      : this.currentGame.awayPlayers;

    const onCourt = players.filter(p => p.onCourt);
    const onBench = players.filter(p => !p.onCourt);

    let selectedPlayer = null;

    if (key >= 1 && key <= 5) {
      // 场上球员：1-5
      const idx = key - 1;
      if (idx < onCourt.length) {
        selectedPlayer = onCourt[idx];
      }
    } else if (key >= 6 && key <= 9) {
      // 替补球员：6-9
      const idx = key - 5 - 1;
      if (idx < onBench.length) {
        selectedPlayer = onBench[idx];
      }
    }

    if (selectedPlayer) {
      this.selectPlayer(selectedPlayer.id, this.currentTeam);
    } else {
      Toast.show(`键 ${key} 无对应球员`, 'warning');
    }
  },

  /**
   * 显示换人模态框
   */
  showSubstitutionModal() {
    const team = this.currentTeam;
    const players = team === 'home'
      ? this.currentGame.homePlayers
      : this.currentGame.awayPlayers;

    const onCourt = players.filter(p => p.onCourt);
    const onBench = players.filter(p => !p.onCourt);

    if (onCourt.length === 0 || onBench.length === 0) {
      Toast.show('无法换人：场上或替补无人', 'warning');
      return;
    }

    this.subSelection = { out: null, in: null };

    // 渲染离场列表（场上球员）
    const outList = document.getElementById('sub-out-list');
    outList.innerHTML = onCourt.map((p, i) => `
      <div class="sub-player-item" onclick="GameManager.selectSubPlayer('out', '${p.id}')"
           data-sub-out="${p.id}">
        <div class="sub-player-radio"><span></span></div>
        <div class="sub-player-num" style="background:${p.color || '#4895EF'};">${p.number || '-'}</div>
        <div class="sub-player-info">
          <div class="sub-player-name">${p.name}</div>
          <div class="sub-player-pos">${p.position || ''}</div>
        </div>
        <div class="sub-player-key">${i + 1}</div>
      </div>
    `).join('');

    // 渲染入场列表（替补球员）
    const inList = document.getElementById('sub-in-list');
    inList.innerHTML = onBench.map((p, i) => `
      <div class="sub-player-item" onclick="GameManager.selectSubPlayer('in', '${p.id}')"
           data-sub-in="${p.id}">
        <div class="sub-player-radio"><span></span></div>
        <div class="sub-player-num" style="background:${p.color || '#4895EF'};">${p.number || '-'}</div>
        <div class="sub-player-info">
          <div class="sub-player-name">${p.name}</div>
          <div class="sub-player-pos">${p.position || ''}</div>
        </div>
        <div class="sub-player-key">${i + 1}</div>
      </div>
    `).join('');

    // 禁用确认按钮
    const confirmBtn = document.getElementById('sub-confirm-btn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '✅ 确认换人';
    }

    document.getElementById('sub-modal').classList.add('active');
  },

  /**
   * 选择换人球员
   */
  selectSubPlayer(type, playerId) {
    this.subSelection[type] = playerId;

    // 更新 UI
    document.querySelectorAll('.sub-player-item').forEach(el => {
      const isOut = el.dataset.subOut !== undefined;
      const id = isOut ? el.dataset.subOut : el.dataset.subIn;
      const isSelected = this.subSelection[isOut ? 'out' : 'in'] === id;
      el.classList.toggle('selected', isSelected);
    });

    // 更新确认按钮
    const confirmBtn = document.getElementById('sub-confirm-btn');
    if (confirmBtn) {
      const ready = this.subSelection.out && this.subSelection.in;
      confirmBtn.disabled = !ready;
      if (ready) {
        const outPlayer = this.getPlayerById(this.subSelection.out);
        const inPlayer = this.getPlayerById(this.subSelection.in);
        confirmBtn.textContent = `✅ ${outPlayer?.name} → ${inPlayer?.name}`;
      } else {
        confirmBtn.textContent = '✅ 确认换人';
      }
    }
  },

  /**
   * 换人模态框中键盘选人（1-9）
   */
  handleSubKeySelect(key) {
    const outList = document.getElementById('sub-out-list');
    const inList = document.getElementById('sub-in-list');

    const outItems = Array.from(outList.querySelectorAll('.sub-player-item'));
    const inItems = Array.from(inList.querySelectorAll('.sub-player-item'));

    // 场上球员用 1-5，替补用 1-5（各自独立编号）
    if (key >= 1 && key <= 5) {
      if (key <= outItems.length) {
        const el = outItems[key - 1];
        const playerId = el.dataset.subOut;
        this.selectSubPlayer('out', playerId);
      }
      // Enter 时确认默认选中的第一项（如果只选了离场）
      if (key <= inItems.length && this.subSelection.out && !this.subSelection.in) {
        const el = inItems[key - 1];
        const playerId = el.dataset.subIn;
        this.selectSubPlayer('in', playerId);
        this.confirmSubstitution();
      }
    }
  },

  /**
   * 辅助：根据 ID 获取球员对象
   */
  getPlayerById(playerId) {
    const homePlayers = this.currentGame.homePlayers || [];
    const awayPlayers = this.currentGame.awayPlayers || [];
    return [...homePlayers, ...awayPlayers].find(p => p.id === playerId);
  },

  /**
   * 确认换人
   */
  confirmSubstitution() {
    if (!this.subSelection.out || !this.subSelection.in) {
      Toast.show('请选择离场和入场球员', 'warning');
      return;
    }

    const team = this.currentTeam;
    const players = team === 'home'
      ? this.currentGame.homePlayers
      : this.currentGame.awayPlayers;

    const playerOut = players.find(p => p.id === this.subSelection.out);
    const playerIn = players.find(p => p.id === this.subSelection.in);

    if (!playerOut || !playerIn) {
      Toast.show('球员选择错误', 'error');
      return;
    }

    // 执行换人
    playerOut.onCourt = false;
    playerIn.onCourt = true;
    this.teamResources[team].subs--;

    // 记录事件
    this.addEvent(team, null, `换人 ${playerOut.name} → ${playerIn.name}`, '🔄', 'info');

    Toast.show(`换人: ${playerOut.name} → ${playerIn.name}`, 'success');

    this.closeSubModal();
    this.renderPlayerGrid();
    this.updateControlButtons();
  },

  /**
   * 关闭换人模态框
   */
  closeSubModal() {
    document.getElementById('sub-modal').classList.remove('active');
    this.subSelection = { out: null, in: null };
  },

  /**
   * 换人（旧方法，改为弹出模态框）
   */
  requestSubstitution() {
    this.showSubstitutionModal();
  },

  /**
   * 渲染快捷键提示
   */
  renderKeyHints() {
    const container = document.getElementById('key-hints');
    if (!container) return;

    const hints = [
      { key: 'Q', action: '2分命中', color: 'success' },
      { key: 'Z', action: '2分miss', color: 'danger' },
      { key: 'W', action: '3分命中', color: 'success' },
      { key: 'X', action: '3分miss', color: 'danger' },
      { key: 'E', action: '罚球命中', color: 'success' },
      { key: 'C', action: '罚球miss', color: 'danger' },
      { key: 'R', action: '篮板', color: 'info' },
      { key: 'A', action: '助攻', color: 'info' },
      { key: 'S', action: '抢断', color: 'warning' },
      { key: 'G', action: '盖帽', color: 'info' },
      { key: 'D', action: '失误', color: 'warning' },
      { key: 'F', action: '犯规', color: 'danger' },
      { key: 'Tab', action: '切换', color: 'secondary' },
      { key: 'T', action: '暂停', color: 'secondary' },
      { key: 'Y', action: '换人', color: 'secondary' },
      { key: '␣', action: '计时', color: 'secondary' },
      { key: '⌫', action: '撤销', color: 'secondary' }
    ];

    container.innerHTML = hints.map(h => `
      <span class="badge badge-${h.color}">${h.key} ${h.action}</span>
    `).join('');
  },

  /**
   * 更新控制按钮状态
   */
  updateControlButtons() {
    // 更新暂停按钮
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '▶ 恢复' : '⏸ 暂停';
      pauseBtn.classList.toggle('active', this.isPaused);
    }

    // 更新资源显示
    const homeTimeoutPips = document.getElementById('home-timeout-pips');
    const awayTimeoutPips = document.getElementById('away-timeout-pips');

    if (homeTimeoutPips) {
      const homeLeft = this.teamResources.home.timeouts;
      homeTimeoutPips.innerHTML = Array(this.gameSettings.timeouts).fill(0).map((_, i) =>
        `<span class="timeout-pip ${i < homeLeft ? 'available' : 'used'}"></span>`
      ).join('');
    }

    if (awayTimeoutPips) {
      const awayLeft = this.teamResources.away.timeouts;
      awayTimeoutPips.innerHTML = Array(this.gameSettings.timeouts).fill(0).map((_, i) =>
        `<span class="timeout-pip ${i < awayLeft ? 'available' : 'used'}"></span>`
      ).join('');
    }

    // 更新暂停/换人按钮可用状态
    const timeoutBtn = document.getElementById('timeout-btn');
    const subBtn = document.getElementById('sub-btn');

    if (timeoutBtn) {
      const teamTimeout = this.currentTeam === 'home' ? this.teamResources.home.timeouts : this.teamResources.away.timeouts;
      timeoutBtn.disabled = teamTimeout <= 0;
      timeoutBtn.style.opacity = teamTimeout <= 0 ? '0.5' : '1';
    }

    if (subBtn) {
      const teamSubs = this.currentTeam === 'home' ? this.teamResources.home.subs : this.teamResources.away.subs;
      subBtn.disabled = teamSubs <= 0;
      subBtn.style.opacity = teamSubs <= 0 ? '0.5' : '1';
    }
  },

  /**
   * 更新显示
   */
  updateDisplay() {
    if (!this.currentGame) return;

    document.getElementById('home-score').textContent = this.currentGame.homeScore || 0;
    document.getElementById('away-score').textContent = this.currentGame.awayScore || 0;
    document.getElementById('period-display').textContent = `第 ${this.period} 节`;
    document.getElementById('pause-indicator').textContent = this.isPaused ? '⏸ 已暂停' : '▶ 比赛中';

    // 更新计时器按钮
    const timerBtn = document.getElementById('timer-main-btn');
    if (timerBtn) {
      timerBtn.textContent = this.isPaused ? '▶ 开始' : '⏸ 暂停';
    }

    // 更新比分横条上的犯规、暂停、进攻时钟
    this.updateTeamFoulDisplay();
    this.updateTimeoutsDisplay();
    this.updateShotClockDisplay();

    this.updateControlButtons();
  },

  /**
   * 开始计时器
   */
  startTimer() {
    if (this.timerInterval) return;

    this.isPaused = false;
    this.updateDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.gameTimer--; // 倒计时：递减

        // 节结束时处理（倒计时到0）
        if (this.gameTimer <= 0) {
          this.gameTimer = 0;
          this.endPeriod();
        }

        this.updateTimerDisplay();
      }
    }, 1000);

    // 同时启动进攻时钟
    this.startShotClock();
  },

  /**
   * 启动进攻时钟（独立计时器）
   */
  startShotClock() {
    if (this.gameSettings.shotClockSeconds <= 0) return; // 不使用进攻时钟
    if (this.shotClockInterval) clearInterval(this.shotClockInterval);

    this.shotClockRunning = true;
    this.shotClockInterval = setInterval(() => {
      if (!this.isPaused && this.shotClockRunning) {
        this.shotClock--;
        if (this.shotClock <= 0) {
          this.shotClock = 0;
          this.onShotClockExpired();
        }
        this.updateShotClockDisplay();
      }
    }, 1000);
  },

  /**
   * 重置进攻时钟（得分/换球权后）
   */
  resetShotClock(seconds = null) {
    if (this.gameSettings.shotClockSeconds <= 0) return;
    this.shotClock = seconds !== null ? seconds : this.gameSettings.shotClockSeconds;
    this.updateShotClockDisplay();
  },

  /**
   * 进攻时钟归零处理
   */
  onShotClockExpired() {
    Toast.show('⏱ 进攻时钟归零！', 'warning');
    // 自动重置为24秒（等待裁判处理）
    this.resetShotClock();
  },

  /**
   * 更新比分横条的队伍犯规次数
   */
  updateTeamFoulDisplay() {
    if (!this.currentGame) return;

    // 从事件中统计各队犯规次数
    const events = this.currentGame.events || [];
    const homeFouls = events.filter(e => e.team === 'home' && e.type === '犯规').length;
    const awayFouls = events.filter(e => e.team === 'away' && e.type === '犯规').length;

    const homeFoulEl = document.getElementById('home-team-fouls');
    const awayFoulEl = document.getElementById('away-team-fouls');
    if (homeFoulEl) homeFoulEl.textContent = homeFouls;
    if (awayFoulEl) awayFoulEl.textContent = awayFouls;

    // 超过罚球阈值时高亮警告
    const foulLimit = this.gameSettings.foulLimit || 5;
    const homeBadge = document.getElementById('home-foul-badge');
    const awayBadge = document.getElementById('away-foul-badge');
    if (homeBadge) {
      homeBadge.style.background = homeFouls >= foulLimit ? 'rgba(255,71,87,0.3)' : '';
      homeBadge.style.fontWeight = homeFouls >= foulLimit ? '700' : '';
    }
    if (awayBadge) {
      awayBadge.style.background = awayFouls >= foulLimit ? 'rgba(255,71,87,0.3)' : '';
      awayBadge.style.fontWeight = awayFouls >= foulLimit ? '700' : '';
    }
  },

  /**
   * 更新比分横条的暂停剩余次数
   */
  updateTimeoutsDisplay() {
    const homeTO = this.teamResources?.home?.timeouts ?? this.gameSettings.timeouts ?? 3;
    const awayTO = this.teamResources?.away?.timeouts ?? this.gameSettings.timeouts ?? 3;

    const homeEl = document.getElementById('home-timeouts-left');
    const awayEl = document.getElementById('away-timeouts-left');
    if (homeEl) homeEl.textContent = homeTO;
    if (awayEl) awayEl.textContent = awayTO;
  },

  /**
   * 更新进攻时钟显示
   */
  updateShotClockDisplay() {
    const el = document.getElementById('shot-clock-display');
    if (!el) return;

    if (this.gameSettings.shotClockSeconds <= 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    el.textContent = this.shotClock;

    // 颜色：<=5秒变红并闪烁
    if (this.shotClock <= 5) {
      el.classList.add('urgent');
    } else if (this.shotClock <= 10) {
      el.classList.add('warning');
      el.classList.remove('urgent');
    } else {
      el.classList.remove('urgent', 'warning');
    }
  },

  /**
   * 结束一节
   */
  endPeriod() {
    if (this.period >= this.gameSettings.periods) {
      this.endGame();
      return;
    }

    this.period++;
    // 倒计时：重置为完整节时长
    this.gameTimer = this.gameSettings.periodMinutes * 60;
    // 重置进攻时钟
    this.resetShotClock();

    // 重置暂停次数（每节新暂停机会）
    Toast.show(`第 ${this.period} 节开始`, 'info');
    this.updateDisplay();
  },

  /**
   * 更新计时器显示
   */
  updateTimerDisplay() {
    const minutes = Math.floor(this.gameTimer / 60);
    const seconds = this.gameTimer % 60;
    const timerEl = document.getElementById('game-timer');
    if (timerEl) {
      timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      // 倒计时低于1分钟时变红提示
      timerEl.style.color = this.gameTimer <= 60 ? 'var(--color-danger)' : 'var(--text-primary)';
    }
  },

  /**
   * 切换暂停状态
   */
  togglePause() {
    if (!this.currentGame) return;

    if (!this.timerInterval) {
      this.startTimer();
      return;
    }

    this.isPaused = !this.isPaused;

    this.updateDisplay();
    Toast.show(this.isPaused ? '比赛已暂停' : '比赛已恢复', 'info');

    // 更新数据库
    DB.updateGame(this.currentGame.id, {
      status: this.isPaused ? 'paused' : 'live'
    });
  },

  /**
   * 记录动作
   */
  recordAction(action) {
    if (!this.currentGame) {
      Toast.show('请先创建或选择比赛', 'error');
      return;
    }

    if (!this.currentPlayer && ['reb', 'ast', 'stl', 'blk', 'tov', 'foul'].includes(action)) {
      Toast.show('请先选择球员', 'error');
      return;
    }

    const team = this.currentTeam;
    const player = this.currentPlayer;

    // 保存到历史（用于撤销）—— eventId 稍后由 addEvent 填充
    const historyEntry = {
      action,
      team,
      player: player ? { ...player } : null,
      scoreDelta: 0,
      eventId: null,  // 将在 addEvent 后设置
      timestamp: Date.now()
    };
    this.eventHistory.push(historyEntry);

    // 根据动作更新数据
    let scoreDelta = 0;
    switch (action) {
      case 'fg2m':
        scoreDelta = 2;
        if (team === 'home') this.currentGame.homeScore += 2;
        else this.currentGame.awayScore += 2;
        this.addEvent(team, player, '2分命中', '+2分', 'success');
        this.resetShotClock(); // 得分后重置进攻时钟
        break;
      case 'fg3m':
        scoreDelta = 3;
        if (team === 'home') this.currentGame.homeScore += 3;
        else this.currentGame.awayScore += 3;
        this.addEvent(team, player, '3分命中', '+3分', 'success');
        this.resetShotClock(); // 得分后重置进攻时钟
        break;
      case 'ftm':
        scoreDelta = 1;
        if (team === 'home') this.currentGame.homeScore += 1;
        else this.currentGame.awayScore += 1;
        this.addEvent(team, player, '罚球命中', '+1分', 'success');
        this.resetShotClock(); // 得分后重置进攻时钟
        break;
      case 'fg2x':
        this.addEvent(team, player, '2分不中', 'MISS', 'danger');
        break;
      case 'fg3x':
        this.addEvent(team, player, '3分不中', 'MISS', 'danger');
        break;
      case 'ftx':
        this.addEvent(team, player, '罚球不中', 'MISS', 'danger');
        break;
      case 'reb':
        this.addEvent(team, player, '篮板', '📊', 'info');
        break;
      case 'ast':
        this.addEvent(team, player, '助攻', '🎯', 'info');
        break;
      case 'stl':
        this.addEvent(team, player, '抢断', '✋', 'warning');
        this.resetShotClock(); // 换球权后重置进攻时钟
        break;
      case 'blk':
        this.addEvent(team, player, '盖帽', '🛡', 'info');
        break;
      case 'tov':
        this.addEvent(team, player, '失误', '❌', 'warning');
        this.resetShotClock(); // 换球权后重置进攻时钟
        break;
      case 'foul':
        this.addEvent(team, player, '犯规', '🚨', 'danger');
        this.updateTeamFoulDisplay(); // 更新犯规计数显示
        break;
      case 'highlight':
        this.addEvent(team, player, '精彩时刻', '⭐', 'warning');
        break;
    }

    // 更新历史记录的分值变化 + 事件ID（用于撤销匹配）
    if (this.eventHistory.length > 0) {
      this.eventHistory[this.eventHistory.length - 1].scoreDelta = scoreDelta;
      // 从 events 数组中取最新事件 ID 存储到历史记录
      const events = this.currentGame.events || [];
      if (events.length > 0) {
        this.eventHistory[this.eventHistory.length - 1].eventId = events[events.length - 1].id;
      }
    }

    // 更新显示
    this.updateDisplay();
    this.animateButton(action);

    // 保存到数据库
    DB.updateGame(this.currentGame.id, {
      homeScore: this.currentGame.homeScore,
      awayScore: this.currentGame.awayScore,
      period: this.period,
      gameTimer: this.gameTimer,
      events: this.currentGame.events
    });
  },

  /**
   * 添加事件记录
   */
  addEvent(team, player, action, symbol, colorClass) {
    const event = {
      id: Date.now(),
      team,
      playerId: player?.id || null,
      playerName: player?.name || null,
      action,
      symbol,
      colorClass,
      timer: this.gameTimer,
      period: this.period,
      timestamp: new Date().toISOString()
    };

    this.currentGame.events = this.currentGame.events || [];
    this.currentGame.events.push(event);

    this.renderEvents();
    this.updateStatsPanel(); // 更新统计面板
  },

  /**
   * 撤销上一动作
   */
  undoLastAction() {
    if (this.eventHistory.length === 0) {
      Toast.show('没有可撤销的动作', 'warning');
      return;
    }

    const lastEvent = this.eventHistory.pop();
    const events = this.currentGame.events;

    // 找到并移除最后一个事件（使用存储的 eventId 匹配）
    const matchId = lastEvent.eventId || lastEvent.id;  // 兼容旧数据
    const eventIndex = events.findIndex(e => e.id === matchId);
    if (eventIndex > -1) {
      events.splice(eventIndex, 1);
    }

    // 恢复分数
    if (lastEvent.scoreDelta > 0) {
      if (lastEvent.team === 'home') {
        this.currentGame.homeScore -= lastEvent.scoreDelta;
      } else {
        this.currentGame.awayScore -= lastEvent.scoreDelta;
      }
    }

    // 更新显示
    this.updateDisplay();
    this.renderEvents();
    this.updateStatsPanel(); // 更新统计面板

    // 保存
    DB.updateGame(this.currentGame.id, {
      homeScore: this.currentGame.homeScore,
      awayScore: this.currentGame.awayScore,
      events: this.currentGame.events
    });

    Toast.show(`已撤销: ${lastEvent.action}`, 'info');
  },

  /**
   * 渲染事件列表
   */
  renderEvents() {
    const container = document.getElementById('event-list');
    if (!container || !this.currentGame.events) return;

    const events = this.currentGame.events.slice(-20).reverse();
    container.innerHTML = events.map(e => `
      <div class="event-item">
        <span class="event-timer">${Math.floor(e.timer / 60)}:${(e.timer % 60).toString().padStart(2, '0')}</span>
        <span class="event-team badge badge-${e.colorClass}">${e.team === 'home' ? '主' : '客'}</span>
        <span class="event-player">${e.playerName || ''}</span>
        <span class="event-action">${e.symbol} ${e.action}</span>
      </div>
    `).join('');
  },

  /**
   * 按钮点击动画
   */
  animateButton(action) {
    const buttonMap = {
      'fg2m': 'btn-fg2m',
      'fg2x': 'btn-fg2x',
      'fg3m': 'btn-fg3m',
      'fg3x': 'btn-fg3x',
      'ftm': 'btn-ftm',
      'ftx': 'btn-ftx',
      'reb': 'btn-reb',
      'ast': 'btn-ast',
      'stl': 'btn-stl',
      'blk': 'btn-blk',
      'tov': 'btn-tov',
      'foul': 'btn-foul',
      'highlight': 'btn-highlight'
    };

    const btn = document.getElementById(buttonMap[action]);
    if (btn) {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 150);
    }
  },

  /**
   * 请求暂停
   */
  requestTimeout() {
    const team = this.currentTeam;
    if (this.teamResources[team].timeouts <= 0) {
      Toast.show('本队已无暂停机会', 'warning');
      return;
    }

    this.teamResources[team].timeouts--;
    const teamLabel = team === 'home' ? '主队' : '客队';
    Toast.show(`${teamLabel}暂停 (剩余 ${this.teamResources[team].timeouts} 次)`, 'info');
    this.updateControlButtons();
    this.updateTimeoutsDisplay(); // 实时刷新比分横条暂停次数

    // 记录暂停事件
    this.addEvent(team, null, '暂停', '⏸', 'secondary');
  },

  /**
   * 结束比赛
   */
  endGame(id = null) {
    const gameId = id || (this.currentGame ? this.currentGame.id : null);
    if (!gameId) return;

    if (!confirm('确定要结束这场比赛吗？')) return;

    // 停止计时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.shotClockInterval) {
      clearInterval(this.shotClockInterval);
      this.shotClockInterval = null;
    }
    this.shotClockRunning = false;

    // 更新比赛状态
    const game = DB.getGames().find(g => g.id === gameId);
    if (game) {
      game.status = 'ended';

      // 更新球队战绩
      const homeTeam = DB.getTeams().find(t => t.id === game.homeTeamId);
      const awayTeam = DB.getTeams().find(t => t.id === game.awayTeamId);

      if (homeTeam) {
        homeTeam.gamesPlayed = (homeTeam.gamesPlayed || 0) + 1;
        if (game.homeScore > game.awayScore) {
          homeTeam.wins = (homeTeam.wins || 0) + 1;
        } else {
          homeTeam.losses = (homeTeam.losses || 0) + 1;
        }
        DB.updateTeam(homeTeam.id, homeTeam);
      }

      if (awayTeam) {
        awayTeam.gamesPlayed = (awayTeam.gamesPlayed || 0) + 1;
        if (game.awayScore > game.homeScore) {
          awayTeam.wins = (awayTeam.wins || 0) + 1;
        } else {
          awayTeam.losses = (awayTeam.losses || 0) + 1;
        }
        DB.updateTeam(awayTeam.id, awayTeam);
      }

      DB.updateGame(gameId, game);
    }

    this.currentGame = null;
    Toast.show('比赛已结束', 'success');

    document.getElementById('page-score').classList.add('hidden');
    document.getElementById('page-games').classList.remove('hidden');
    this.render();
  },

  /**
   * 返回比赛列表
   */
  backToList() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.shotClockInterval) {
      clearInterval(this.shotClockInterval);
      this.shotClockInterval = null;
    }
    this.shotClockRunning = false;

    // 隐藏球员网格
    const playersSection = document.querySelector('.players-section');
    if (playersSection) playersSection.style.display = 'none';

    document.getElementById('page-score').classList.add('hidden');
    document.getElementById('page-games').classList.remove('hidden');
    this.render();
  },

  /**
   * 删除比赛
   */
  deleteGame(id) {
    if (!confirm('确定要删除这场比赛记录吗？')) return;

    if (DB.deleteGame(id)) {
      Toast.show('比赛已删除', 'success');
      this.render();
    }
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('game-modal').classList.remove('active');
    // 重置阵容选择
    this.lineupSelection = { home: [], away: [] };
  },

  // ==================== 比赛数据统计面板 ====================

  /**
   * 初始化统计面板
   */
  initStatsPanel() {
    if (!this.currentGame) return;
    this.renderStatsPlayers();
    this.switchStatsTab('regular');
  },

  /**
   * 渲染两侧球员列表
   */
  renderStatsPlayers() {
    const homeContainer = document.getElementById('stats-home-player-items');
    const awayContainer = document.getElementById('stats-away-player-items');
    if (!homeContainer || !awayContainer) return;

    const homePlayers = this.currentGame.homePlayers || [];
    const awayPlayers = this.currentGame.awayPlayers || [];

    const renderPlayerList = (players, container, team) => {
      container.innerHTML = players.map(p => `
        <div class="stats-player-item ${this.selectedStatsPlayer?.id === p.id ? 'active' : ''}"
             onclick="GameManager.selectStatsPlayer('${p.id}', '${team}')"
             data-player-id="${p.id}">
          <span class="player-num">#${p.number || '-'}</span>
          <span class="player-name">${p.name}</span>
        </div>
      `).join('');
    };

    renderPlayerList(homePlayers, homeContainer, 'home');
    renderPlayerList(awayPlayers, awayContainer, 'away');
  },

  /**
   * 切换统计标签页
   */
  switchStatsTab(tab) {
    this.currentStatsTab = tab;
    this.selectedStatsPlayer = null;

    document.querySelectorAll('.stats-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    this.renderStatsContent();
  },

  /**
   * 选择统计球员
   */
  selectStatsPlayer(playerId, team) {
    if (!this.currentGame) return;

    const players = team === 'home'
      ? this.currentGame.homePlayers
      : this.currentGame.awayPlayers;
    const player = players.find(p => p.id === playerId);

    if (!player) return;

    this.selectedStatsPlayer = player;
    this.renderStatsPlayers();
    this.renderStatsContent();
  },

  /**
   * 关闭球员详情
   */
  closePlayerDetail() {
    this.selectedStatsPlayer = null;
    this.renderStatsPlayers();
    this.renderStatsContent();
  },

  /**
   * 获取球队统计数据
   */
  getTeamStats(team) {
    if (!this.currentGame) return {};

    const events = this.currentGame.events || [];

    return {
      points: events.filter(e => e.type === 'score' && e.team === team)
        .reduce((sum, e) => sum + (e.points || 0), 0),
      rebounds: events.filter(e => e.type === 'reb' && e.team === team).length,
      assists: events.filter(e => e.type === 'ast' && e.team === team).length,
      steals: events.filter(e => e.type === 'stl' && e.team === team).length,
      blocks: events.filter(e => e.type === 'blk' && e.team === team).length,
      turnovers: events.filter(e => e.type === 'tov' && e.team === team).length,
      fouls: events.filter(e => e.type === 'foul' && e.team === team).length,
      fg2m: events.filter(e => e.type === 'fg2m' && e.team === team).length,
      fg2a: events.filter(e => (e.type === 'fg2m' || e.type === 'fg2x') && e.team === team).length,
      fg3m: events.filter(e => e.type === 'fg3m' && e.team === team).length,
      fg3a: events.filter(e => (e.type === 'fg3m' || e.type === 'fg3x') && e.team === team).length,
      ftm: events.filter(e => e.type === 'ftm' && e.team === team).length,
      fta: events.filter(e => (e.type === 'ftm' || e.type === 'ftx') && e.team === team).length,
    };
  },

  /**
   * 获取球员统计数据
   */
  getPlayerStats(playerId) {
    if (!this.currentGame) return {};

    const events = this.currentGame.events || [];

    return {
      points: events.filter(e => e.playerId === playerId && e.type === 'score')
        .reduce((sum, e) => sum + (e.points || 0), 0),
      rebounds: events.filter(e => e.playerId === playerId && e.type === 'reb').length,
      assists: events.filter(e => e.playerId === playerId && e.type === 'ast').length,
      steals: events.filter(e => e.playerId === playerId && e.type === 'stl').length,
      blocks: events.filter(e => e.playerId === playerId && e.type === 'blk').length,
      turnovers: events.filter(e => e.playerId === playerId && e.type === 'tov').length,
      fouls: events.filter(e => e.playerId === playerId && e.type === 'foul').length,
      fg2m: events.filter(e => e.playerId === playerId && e.type === 'fg2m').length,
      fg2a: events.filter(e => e.playerId === playerId && (e.type === 'fg2m' || e.type === 'fg2x')).length,
      fg3m: events.filter(e => e.playerId === playerId && e.type === 'fg3m').length,
      fg3a: events.filter(e => e.playerId === playerId && (e.type === 'fg3m' || e.type === 'fg3x')).length,
      ftm: events.filter(e => e.playerId === playerId && e.type === 'ftm').length,
      fta: events.filter(e => e.playerId === playerId && (e.type === 'ftm' || e.type === 'ftx')).length,
      highlights: events.filter(e => e.playerId === playerId && e.type === 'highlight').length,
    };
  },

  /**
   * 渲染统计内容
   */
  renderStatsContent() {
    const display = document.getElementById('stats-display');
    if (!display) return;

    if (!this.currentGame) {
      display.innerHTML = '<div class="text-center text-dim">暂无比赛数据</div>';
      return;
    }

    if (this.selectedStatsPlayer) {
      this.renderPlayerDetail();
      return;
    }

    switch (this.currentStatsTab) {
      case 'regular': this.renderTeamComparison(); break;
      case 'shooting': this.renderShootingStats(); break;
      case 'advanced': this.renderAdvancedStats(); break;
      case 'prediction': this.renderPrediction(); break;
      default: this.renderTeamComparison();
    }
  },

  /**
   * 渲染球队对比（常规数据）
   */
  renderTeamComparison() {
    const display = document.getElementById('stats-display');
    const homeStats = this.getTeamStats('home');
    const awayStats = this.getTeamStats('away');

    const rows = [
      { label: '得分', home: homeStats.points, away: awayStats.points },
      { label: '篮板', home: homeStats.rebounds, away: awayStats.rebounds },
      { label: '助攻', home: homeStats.assists, away: awayStats.assists },
      { label: '抢断', home: homeStats.steals, away: awayStats.steals },
      { label: '盖帽', home: homeStats.blocks, away: awayStats.blocks },
      { label: '失误', home: homeStats.turnovers, away: awayStats.turnovers },
      { label: '犯规', home: homeStats.fouls, away: awayStats.fouls },
    ];

    display.innerHTML = `
      <div class="stats-team-comparison">
        ${rows.map(row => `
          <div class="stats-comparison-row">
            <span class="home-value">${row.home}</span>
            <span class="stat-name">${row.label}</span>
            <span class="away-value">${row.away}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * 渲染投篮数据
   */
  renderShootingStats() {
    const display = document.getElementById('stats-display');
    const homeStats = this.getTeamStats('home');
    const awayStats = this.getTeamStats('away');

    const calcPct = (m, a) => a > 0 ? ((m / a) * 100).toFixed(1) : '0.0';

    display.innerHTML = `
      <div class="shooting-grid">
        <div class="shooting-card">
          <div class="card-title">🏀 主队投篮</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(homeStats.fg2m + homeStats.fg3m, homeStats.fg2a + homeStats.fg3a)}%</span>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(homeStats.fg2m + homeStats.fg3m, homeStats.fg2a + homeStats.fg3a)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${homeStats.fg2m + homeStats.fg3m}/${homeStats.fg2a + homeStats.fg3a}</span></div>
        </div>
        <div class="shooting-card">
          <div class="card-title">🏀 客队投篮</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(awayStats.fg2m + awayStats.fg3m, awayStats.fg2a + awayStats.fg3a)}%</span>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(awayStats.fg2m + awayStats.fg3m, awayStats.fg2a + awayStats.fg3a)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${awayStats.fg2m + awayStats.fg3m}/${awayStats.fg2a + awayStats.fg3a}</span></div>
        </div>
        <div class="shooting-card">
          <div class="card-title">🎯 主队三分</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(homeStats.fg3m, homeStats.fg3a)}%</span>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(homeStats.fg3m, homeStats.fg3a)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${homeStats.fg3m}/${homeStats.fg3a}</span></div>
        </div>
        <div class="shooting-card">
          <div class="card-title">🎯 客队三分</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(awayStats.fg3m, awayStats.fg3a)}%</div>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(awayStats.fg3m, awayStats.fg3a)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${awayStats.fg3m}/${awayStats.fg3a}</span></div>
        </div>
        <div class="shooting-card">
          <div class="card-title">🔵 主队罚球</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(homeStats.ftm, homeStats.fta)}%</span>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(homeStats.ftm, homeStats.fta)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${homeStats.ftm}/${homeStats.fta}</span></div>
        </div>
        <div class="shooting-card">
          <div class="card-title">🔵 客队罚球</div>
          <div class="shooting-chart">
            <span class="shooting-percent">${calcPct(awayStats.ftm, awayStats.fta)}%</span>
            <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${calcPct(awayStats.ftm, awayStats.fta)}%"></div></div>
          </div>
          <div class="shooting-details"><span>${awayStats.ftm}/${awayStats.fta}</span></div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染进阶数据
   */
  renderAdvancedStats() {
    const display = document.getElementById('stats-display');
    const homeStats = this.getTeamStats('home');
    const awayStats = this.getTeamStats('away');

    display.innerHTML = `
      <div class="advanced-grid">
        <div class="advanced-card"><div class="stat-value">${homeStats.assists}</div><div class="stat-label">主队 助攻</div></div>
        <div class="advanced-card"><div class="stat-value">${awayStats.assists}</div><div class="stat-label">客队 助攻</div></div>
        <div class="advanced-card"><div class="stat-value">${homeStats.steals + homeStats.blocks}</div><div class="stat-label">主队 抢断+盖帽</div></div>
        <div class="advanced-card"><div class="stat-value">${awayStats.steals + awayStats.blocks}</div><div class="stat-label">客队 抢断+盖帽</div></div>
        <div class="advanced-card"><div class="stat-value">${homeStats.fg2m + homeStats.fg3m + homeStats.ftm}</div><div class="stat-label">主队 总命中</div></div>
        <div class="advanced-card"><div class="stat-value">${awayStats.fg2m + awayStats.fg3m + awayStats.ftm}</div><div class="stat-label">客队 总命中</div></div>
      </div>
    `;
  },

  /**
   * 渲染比赛预测
   */
  renderPrediction() {
    const display = document.getElementById('stats-display');
    const homeStats = this.getTeamStats('home');
    const awayStats = this.getTeamStats('away');

    const homeTeam = DB.getTeams().find(t => t.id === this.currentGame.homeTeamId);
    const awayTeam = DB.getTeams().find(t => t.id === this.currentGame.awayTeamId);
    const homeName = homeTeam?.name || '主队';
    const awayName = awayTeam?.name || '客队';

    const total = homeStats.points + awayStats.points;
    let homeProb = 50;
    if (total > 0) {
      const diff = homeStats.points - awayStats.points;
      const leadBonus = diff > 0 ? Math.min(diff * 3, 30) : Math.max(diff * 3, -30);
      homeProb = Math.max(5, Math.min(95, (homeStats.points / total) * 100 + leadBonus));
    }

    display.innerHTML = `
      <div class="stats-prediction">
        <div class="prediction-title">🏆 比赛预测</div>
        <div class="prediction-bar">
          <div class="prediction-team home"><div class="team-name">${homeName}</div><div class="win-rate">${Math.round(homeProb)}%</div></div>
          <div class="prediction-bar-container">
            <div class="prediction-bar-fill home" style="width:${homeProb}%"></div>
            <div class="prediction-bar-fill away" style="width:${100 - homeProb}%"></div>
          </div>
          <div class="prediction-team away"><div class="team-name">${awayName}</div><div class="win-rate">${Math.round(100 - homeProb)}%</div></div>
        </div>
        <p style="color:var(--text-dim);font-size:0.8rem;margin-top:var(--space-md);">基于当前比赛数据进行的简单预测，仅供参考</p>
      </div>
    `;
  },

  /**
   * 渲染球员详情
   */
  renderPlayerDetail() {
    const display = document.getElementById('stats-display');
    const stats = this.getPlayerStats(this.selectedStatsPlayer.id);
    const player = this.selectedStatsPlayer;

    const getPct = (m, a) => a > 0 ? ((m / a) * 100).toFixed(1) : '0.0';
    const fgPct = getPct(stats.fg2m + stats.fg3m, stats.fg2a + stats.fg3a);

    display.innerHTML = `
      <div class="stats-player-detail">
        <div class="stats-player-detail-header">
          <div class="player-avatar">${player.name.charAt(0)}</div>
          <div class="player-info">
            <div class="name">${player.name}</div>
            <div class="team">${player.team || (this.currentTeam === 'home' ? '主队' : '客队')}</div>
            <div class="position">#${player.number || '-'} · ${player.position || '-'}</div>
          </div>
          <button class="close-btn" onclick="GameManager.closePlayerDetail()">✕</button>
        </div>
        <div class="stats-player-stats">
          <div class="stat-item"><div class="stat-value">${stats.points}</div><div class="stat-label">得分</div></div>
          <div class="stat-item"><div class="stat-value">${stats.rebounds}</div><div class="stat-label">篮板</div></div>
          <div class="stat-item"><div class="stat-value">${stats.assists}</div><div class="stat-label">助攻</div></div>
          <div class="stat-item"><div class="stat-value">${stats.steals}</div><div class="stat-label">抢断</div></div>
          <div class="stat-item"><div class="stat-value">${stats.blocks}</div><div class="stat-label">盖帽</div></div>
          <div class="stat-item"><div class="stat-value">${stats.turnovers}</div><div class="stat-label">失误</div></div>
        </div>
        <div style="margin-top:var(--space-lg);">
          <div style="font-weight:600;font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--space-md);">投篮数据</div>
          <div class="shooting-grid">
            <div class="shooting-card">
              <div class="card-title">投篮</div>
              <div class="shooting-chart">
                <span class="shooting-percent">${fgPct}%</span>
                <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${fgPct}%"></div></div>
              </div>
              <div class="shooting-details"><span>${stats.fg2m + stats.fg3m}/${stats.fg2a + stats.fg3a}</span></div>
            </div>
            <div class="shooting-card">
              <div class="card-title">三分</div>
              <div class="shooting-chart">
                <span class="shooting-percent">${getPct(stats.fg3m, stats.fg3a)}%</span>
                <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${getPct(stats.fg3m, stats.fg3a)}%"></div></div>
              </div>
              <div class="shooting-details"><span>${stats.fg3m}/${stats.fg3a}</span></div>
            </div>
            <div class="shooting-card">
              <div class="card-title">罚球</div>
              <div class="shooting-chart">
                <span class="shooting-percent">${getPct(stats.ftm, stats.fta)}%</span>
                <div class="shooting-bar"><div class="shooting-bar-fill" style="width:${getPct(stats.ftm, stats.fta)}%"></div></div>
              </div>
              <div class="shooting-details"><span>${stats.ftm}/${stats.fta}</span></div>
            </div>
            <div class="shooting-card">
              <div class="card-title">精彩时刻</div>
              <div class="stat-value" style="font-size:1.8rem;">${stats.highlights}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 更新统计面板
   */
  updateStatsPanel() {
    if (!this.currentGame) return;
    this.renderStatsPlayers();
    this.renderStatsContent();
  },

  /**
   * 计算 BoxScore —— 从比赛事件中聚合每球员统计
   * @returns {{ home: [], away: [] }} 主客队球员统计数组
   */
  calcBoxScore() {
    if (!this.currentGame) return { home: [], away: [] };

    const game = this.currentGame;
    const events = game.events || [];
    const score = {};

    // 初始化所有参赛球员的统计
    const allPlayers = [
      ...(game.homePlayers || []).map(p => ({ ...p, team: 'home' })),
      ...(game.awayPlayers || []).map(p => ({ ...p, team: 'away' }))
    ];

    allPlayers.forEach(p => {
      score[p.id] = {
        id: p.id,
        name: p.name,
        team: p.team,
        number: p.number || '',
        pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
        ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0,
        blk: 0, tov: 0, pf: 0, min: 0
      };
    });

    // 遍历事件累加统计
    events.forEach(e => {
      const pid = e.playerId;
      if (!pid || !score[pid]) return;

      const s = score[pid];
      switch (e.action) {
        case '2分命中': s.pts += 2; s.fgm += 1; s.fga += 1; break;
        case '2分不中': s.fga += 1; break;
        case '3分命中': s.pts += 3; s.fgm += 1; s.fga += 1; s.fg3m += 1; s.fg3a += 1; break;
        case '3分不中': s.fga += 1; s.fg3a += 1; break;
        case '罚球命中': s.pts += 1; s.ftm += 1; s.fta += 1; break;
        case '罚球不中': s.fta += 1; break;
        case '篮板': s.reb += 1; break;
        case '助攻': s.ast += 1; break;
        case '抢断': s.stl += 1; break;
        case '盖帽': s.blk += 1; break;
        case '失误': s.tov += 1; break;
        case '犯规': s.pf += 1; break;
      }
    });

    // 按团队分组、按得分降序排列
    const home = allPlayers
      .filter(p => p.team === 'home')
      .map(p => score[p.id])
      .filter(s => s && (s.pts > 0 || s.reb > 0 || s.ast > 0 || s.pf > 0)) // 至少有一项统计
      .sort((a, b) => b.pts - a.pts);

    const away = allPlayers
      .filter(p => p.team === 'away')
      .map(p => score[p.id])
      .filter(s => s && (s.pts > 0 || s.reb > 0 || s.ast > 0 || s.pf > 0))
      .sort((a, b) => b.pts - a.pts);

    return { home, away };
  },

  /**
   * 渲染 BoxScore 表格
   */
  renderBoxScore() {
    const card = document.getElementById('boxscore-card');
    const content = document.getElementById('boxscore-content');
    if (!card || !content) return;

    // 仅已结束的比赛显示 BoxScore
    if (!this.currentGame || this.currentGame.status !== 'ended') {
      card.style.display = 'none';
      return;
    }

    const { home, away } = this.calcBoxScore();
    const hasData = home.length > 0 || away.length > 0;

    if (!hasData) {
      card.style.display = 'none';
      return;
    }

    card.style.display = '';

    // 顶部表头缩写
    const headers = ['#', '球员', 'PTS', 'FG', '3P', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'];
    const cols = ['number', 'name', 'pts', 'fg', 'fg3', 'ft', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'];

    const renderTeamTable = (teamLabel, players, teamClass) => {
      if (players.length === 0) return '';
      return `
        <div class="stats-team-header ${teamClass}">${teamLabel}</div>
        <div class="boxscore-table-wrap">
          <table class="boxscore-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${players.map(p => `
                <tr>
                  <td class="bs-num">${p.number}</td>
                  <td class="bs-name">${p.name}</td>
                  <td class="bs-highlight">${p.pts}</td>
                  <td>${p.fgm}-${p.fga}</td>
                  <td>${p.fg3m}-${p.fg3a}</td>
                  <td>${p.ftm}-${p.fta}</td>
                  <td>${p.reb}</td>
                  <td>${p.ast}</td>
                  <td>${p.stl}</td>
                  <td>${p.blk}</td>
                  <td>${p.tov}</td>
                  <td>${p.pf}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    const homeTeamName = (() => {
      const t = DB.getTeams().find(t => t.id === this.currentGame.homeTeamId);
      return t ? `🏀 ${t.name}` : '🏀 主队';
    })();
    const awayTeamName = (() => {
      const t = DB.getTeams().find(t => t.id === this.currentGame.awayTeamId);
      return t ? `🏀 ${t.name}` : '🏀 客队';
    })();

    content.innerHTML = `
      ${renderTeamTable(homeTeamName, home, 'home')}
      ${renderTeamTable(awayTeamName, away, 'away')}
    `;
  },
};

// 导出
window.GameManager = GameManager;
