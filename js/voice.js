/**
 * VoiceManager - 语音录入比赛事件模块 v2.0
 * 使用腾讯云 ASR (SentenceRecognition) — 国内可达，全浏览器兼容
 * 所有事件通过 GameManager.recordAction() 统一入口
 *
 * 架构: MediaRecorder → Worker /api/asr → 腾讯云 → parseCommand → recordAction
 */
const VoiceManager = {
  /** ASR 引擎实例 */
  asr: null,
  isSupported: false,
  _unsupportedReason: '',

  /** 动作词 → 动作码映射 */
  ACTION_PATTERNS: [
    [/三分(命中|进了|中的|中啦)/, 'fg3m', '三分命中'],
    [/三分(不中|没中|没进|没沾|打铁)/, 'fg3x', '三分不中'],
    [/两分(命中|进了|中的|中啦)/, 'fg2m', '两分命中'],
    [/两分(不中|没中|没进|没沾|打铁)/, 'fg2x', '两分不中'],
    [/(上篮|中投|跳投|抛投|篮下)(命中|进了|中的|中啦)/, 'fg2m', '上篮命中'],
    [/(上篮|中投|跳投|抛投|篮下)(不中|没中|没进|没沾)/, 'fg2x', '上篮不中'],
    [/罚球(命中|进了|中的|中啦)/, 'ftm', '罚球命中'],
    [/罚球(不中|没中|没进|没沾)/, 'ftx', '罚球不中'],
    [/罚进/, 'ftm', '罚进'],
    [/罚丢|罚失/, 'ftx', '罚丢'],
    [/篮板|抢篮板|摘下篮板|前场篮板|后场篮板/, 'reb', '篮板'],
    [/助攻|妙传|好传/, 'ast', '助攻'],
    [/抢断|断球|抄截|盗球/, 'stl', '抢断'],
    [/盖帽|大帽|封盖|火锅|扇了/, 'blk', '盖帽'],
    [/失误|丢球|出界|走步|二运|回场/, 'tov', '失误'],
    [/犯规|打手|推人|阻挡|拉人|进攻犯规|防守犯规/, 'foul', '犯规'],
    [/精彩|好球|漂亮|暴扣|灌篮|扣篮/, 'highlight', '精彩时刻'],
    [/暂停|timeout|Time/i, 'timeout', '暂停'],
    [/撤销|撤回|取消|不算/, 'undo', '撤销'],
  ],

  /** 初始化 */
  init() {
    // 检查浏览器是否支持录音
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      console.warn('[Voice] 浏览器不支持录音 API');
      this.isSupported = false;

      const ua = navigator.userAgent;
      this._unsupportedReason = ua.includes('Firefox')
        ? 'Firefox 缺少录音权限，请在设置中开启'
        : ua.includes('MicroMessenger')
          ? '微信内置浏览器不支持录音，请用系统浏览器打开'
          : '浏览器不支持录音功能，请使用 Chrome/Edge/Safari';

      this._createUI();
      return;
    }

    // 创建 AsrEngine 实例
    try {
      this.asr = new AsrEngine({
        apiUrl: 'https://api.statstalking.com/api/asr',
        maxDuration: 15000, // 最长15秒
      });
    } catch (e) {
      console.error('[Voice] AsrEngine 初始化失败:', e);
      this.isSupported = false;
      this._unsupportedReason = 'ASR 引擎初始化失败';
      this._createUI();
      return;
    }

    this.isSupported = true;
    this._unsupportedReason = null;
    this._createUI();
    this._bindEvents();
    console.log('[Voice] 初始化完成，使用腾讯云 ASR');
  },

  /** 开始监听（通过 AsrEngine 录音） */
  async startListening() {
    if (!this.isSupported) {
      const ua = navigator.userAgent;
      if (ua.includes('Chrome')) {
        Toast.show('录音功能异常：请检查浏览器麦克风权限设置', 'error');
      } else if (ua.includes('Firefox')) {
        Toast.show('Firefox 请检查浏览器隐私设置 → 麦克风权限', 'warning');
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        Toast.show('Safari 需 HTTPS，请在地址栏左侧开启麦克风权限', 'warning');
      } else {
        Toast.show('当前浏览器不支持录音，请使用 Chrome 浏览器打开', 'warning');
      }
      return false;
    }

    if (!this.asr || this.asr.isRecording) return false;

    // 检查是否在比赛页面
    const scorePage = document.getElementById('page-score');
    if (!scorePage || scorePage.classList.contains('hidden')) {
      Toast.show('请先进入比赛记分页面', 'warning');
      return false;
    }

    this._updateUIState('listening');

    const success = await this.asr.start((result) => {
      // ASR 回调
      if (result.error) {
        this._handleASRError(result);
      } else if (result.text) {
        this._handleASRText(result.text);
      }
    });

    if (!success) {
      this._updateUIState('idle');
    }
    return success;
  },

  /** 停止录音并识别 */
  stopListening() {
    if (this.asr && this.asr.isRecording) {
      this._updateUIState('processing');
      this.asr.stop();
    }
  },

  /** 处理 ASR 识别文本 */
  _handleASRText(text) {
    if (!text) {
      this._updateUIState('idle');
      Toast.show('未识别到语音，请重试', 'warning');
      return;
    }

    console.log(`[Voice] ASR结果: "${text}"`);
    const parsed = this.parseCommand(text);

    if (!parsed) {
      this._updateUIState('idle');
      return;
    }

    this._executeCommand(parsed, 0.95);
  },

  /** 处理 ASR 错误 */
  _handleASRError(result) {
    console.error('[Voice] ASR 错误:', result.error, result.message);
    this._updateUIState('idle');

    const errorMap = {
      'UNSUPPORTED': '浏览器不支持录音',
      'MIC_DENIED': '麦克风权限被拒绝，请在浏览器设置中开启',
      'RECORDER_FAIL': '录音启动失败，请重试',
      'NO_AUDIO': '未录到音频，请靠近麦克风说话',
      'TOO_LARGE': '录音时间过长（>60秒）',
      'UPLOAD_FAIL': '网络连接失败，请检查网络后重试',
      'ASR_FAIL': '语音识别失败，请重说一次',
    };

    Toast.show(errorMap[result.error] || (result.message || '录音失败'), 'error');
  },

  /** 解析语音文本为命令 */
  parseCommand(text, allResults) {
    const cleaned = text.replace(/[，。！？、\s]+/g, '').trim();
    if (!cleaned) return null;

    let actionCode = null;
    let matchedPhrase = '';

    for (const [pattern, code] of this.ACTION_PATTERNS) {
      const match = cleaned.match(pattern);
      if (match) {
        actionCode = code;
        matchedPhrase = match[0];
        break;
      }
    }

    if (!actionCode) {
      // 特殊命令
      if (/切[换到]?[主客]队|主队|客队/.test(cleaned)) {
        const switchTo = /客队|客场/.test(cleaned) ? 'away' : 'home';
        return { action: 'switch', switchTo };
      }

      Toast.show(`未识别到篮球动作: "${text}"`, 'warning');
      return null;
    }

    let playerHint = cleaned.replace(matchedPhrase, '').trim();
    playerHint = playerHint.replace(/^(主队|客队|的|给|让|了)/, '');

    return { action: actionCode, playerHint: playerHint || null, rawText: text };
  },

  /** 模糊匹配当前队球员 */
  fuzzyMatchPlayer(hint, teamId) {
    if (!hint) return null;

    const players = DB.getPlayers().filter(p => p.teamId === teamId);
    if (players.length === 0) return null;

    let match = players.find(p => p.name === hint);
    if (match) return match;

    const numMatch = hint.match(/^(\d{1,2})号?$/);
    if (numMatch) {
      match = players.find(p => String(p.number) === numMatch[1]);
      if (match) return match;
    }

    match = players.find(p => hint.includes(p.name) || p.name.includes(hint));
    if (match) return match;

    for (const p of players) {
      const dist = this._levenshtein(hint, p.name);
      if (dist <= 1) return p;
    }

    return null;
  },

  /** 执行解析后的命令 */
  _executeCommand(parsed, confidence) {
    const { action, playerHint } = parsed;

    if (action === 'switch') {
      GameManager.switchTeamTo(parsed.switchTo);
      this._updateUIState('confirmed');
      setTimeout(() => this._updateUIState('idle'), 800);
      return;
    }

    if (action === 'undo') {
      GameManager.undoLastAction();
      this._updateUIState('confirmed');
      setTimeout(() => this._updateUIState('idle'), 800);
      return;
    }

    if (action === 'timeout') {
      GameManager.requestTimeout();
      this._updateUIState('confirmed');
      setTimeout(() => this._updateUIState('idle'), 800);
      return;
    }

    const teamId = GameManager.currentGame
      ? (GameManager.currentTeam === 'home'
        ? GameManager.currentGame.homeTeamId
        : GameManager.currentGame.awayTeamId)
      : null;

    let player = null;
    if (playerHint) {
      player = this.fuzzyMatchPlayer(playerHint, teamId);
      if (!player && confidence >= 0.7) {
        Toast.show(`未找到球员"${playerHint}"，将记录无名事件`, 'info');
      }
    }

    const needsPlayer = ['fg2m', 'fg2x', 'fg3m', 'fg3x', 'ftm', 'ftx',
                         'reb', 'ast', 'stl', 'blk', 'tov', 'foul', 'highlight'];
    if (!player && needsPlayer.includes(action)) {
      if (GameManager.currentPlayer) {
        player = GameManager.currentPlayer;
      } else if (['reb', 'ast', 'stl', 'blk', 'tov', 'foul'].includes(action)) {
        Toast.show('请先选择球员（说球员名 + 动作）', 'error');
        this._updateUIState('idle');
        return;
      }
    }

    if (player && GameManager.currentPlayer?.id !== player.id) {
      GameManager.currentPlayer = player;
      GameManager.renderPlayerGrid();
      console.log(`[Voice] 选中球员: ${player.name} #${player.number}`);
    }

    GameManager.recordAction(action, 'voice');

    // 显示确认状态
    const playerName = player ? `#${player.name}` : '';
    const actionLabels = {
      fg2m: '两分命中', fg2x: '两分不中', fg3m: '三分命中', fg3x: '三分不中',
      ftm: '罚球命中', ftx: '罚球不中', reb: '篮板', ast: '助攻',
      stl: '抢断', blk: '盖帽', tov: '失误', foul: '犯规', highlight: '精彩时刻'
    };
    const label = actionLabels[action] || action;
    Toast.show(`🎤 ${playerName} ${label}`, 'success');

    this._updateUIState('confirmed');
    setTimeout(() => this._updateUIState('idle'), 1000);
  },

  _levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1)
        );
      }
    }
    return matrix[b.length][a.length];
  },

  // ========== UI ==========

  _uiState: 'idle',
  _btn: null,
  _indicator: null,
  _tooltip: null,

  _createUI() {
    const scorePage = document.getElementById('page-score');
    if (!scorePage) return;

    // 清除旧元素
    const old = scorePage.querySelector('.voice-wrapper');
    if (old) old.remove();

    const btn = document.createElement('button');
    btn.id = 'voice-btn';
    btn.className = 'voice-btn voice-idle';
    btn.title = '语音录入 (长按说话 / 按 V 键)';
    btn.innerHTML = '<span class="voice-icon">🎤</span>';
    btn.setAttribute('aria-label', '语音录入比赛事件');

    const indicator = document.createElement('span');
    indicator.id = 'voice-indicator';
    indicator.className = 'voice-indicator';
    indicator.textContent = '语音录入';

    const tooltip = document.createElement('div');
    tooltip.id = 'voice-tooltip';
    tooltip.textContent = '按住说话 / 按V键';

    const wrapper = document.createElement('div');
    wrapper.className = 'voice-wrapper';
    wrapper.appendChild(btn);
    wrapper.appendChild(indicator);
    wrapper.appendChild(tooltip);
    scorePage.appendChild(wrapper);

    this._btn = btn;
    this._indicator = indicator;
    this._tooltip = tooltip;

    if (!this.isSupported) {
      btn.classList.add('voice-disabled');
      btn.title = this._unsupportedReason || '语音识别不可用';
      indicator.textContent = '不可用';

      btn.addEventListener('click', () => {
        const ua = navigator.userAgent;
        let msg = this._unsupportedReason || '语音识别不可用';
        Toast.show(msg, 'error');
        console.warn('[Voice]', msg, 'UA:', ua);
      });
    }
  },

  _bindEvents() {
    if (!this.isSupported || !this._btn) return;

    let isPressing = false;

    const onPressStart = (e) => {
      e.preventDefault();
      isPressing = true;
      this._btn.classList.add('voice-pressing');
      this.startListening();
    };

    const onPressEnd = (e) => {
      e.preventDefault();
      isPressing = false;
      this._btn.classList.remove('voice-pressing');
      if (this.asr?.isRecording) {
        this.stopListening();
      }
    };

    this._btn.addEventListener('mousedown', onPressStart);
    this._btn.addEventListener('mouseup', onPressEnd);
    this._btn.addEventListener('mouseleave', () => { if (isPressing) onPressEnd(new Event('mouseup')); });
    this._btn.addEventListener('touchstart', onPressStart, { passive: false });
    this._btn.addEventListener('touchend', onPressEnd, { passive: false });

    // 键盘快捷键 V — 按住说话
    document.addEventListener('keydown', (e) => {
      const scorePage = document.getElementById('page-score');
      if (!scorePage || scorePage.classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        e.stopPropagation();
        this._btn?.classList.add('voice-pressing');
        this.startListening();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        e.stopPropagation();
        this._btn?.classList.remove('voice-pressing');
        if (this.asr?.isRecording) {
          this.stopListening();
        }
      }
    });
  },

  _updateUIState(state) {
    this._uiState = state;
    if (!this._btn) return;

    this._btn.classList.remove('voice-idle', 'voice-listening', 'voice-processing', 'voice-confirmed');
    this._btn.classList.add('voice-' + state);

    const states = {
      idle:    { icon: '🎤', text: '语音录入', title: '语音录入 (长按说话 / V键)' },
      listening: { icon: '🎙️', text: '正在听...', title: '正在录音...松开结束' },
      processing: { icon: '⏳', text: '识别中...', title: '正在识别...' },
      confirmed: { icon: '✅', text: '已记录', title: '事件已记录' },
    };

    const s = states[state] || states.idle;
    this._btn.querySelector('.voice-icon').textContent = s.icon;
    this._btn.title = s.title;
    if (this._indicator) this._indicator.textContent = s.text;
  }
};
