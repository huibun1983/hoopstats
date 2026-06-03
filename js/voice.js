/**
 * VoiceManager - 语音录入比赛事件模块
 * 使用 Web Speech API 实现中文语音命令识别
 * 所有事件通过 GameManager.recordAction() 统一入口
 * v1.0 - 2026-06-01
 */
const VoiceManager = {
  /** 浏览器兼容性检查 */
  SpeechRecognition: null,
  recognition: null,
  isSupported: false,
  isListening: false,
  mode: 'push', // 'push' = 长按说话 | 'hold' = 快捷键V激活

  /** 动作词 → 动作码映射 */
  ACTION_PATTERNS: [
    // [正则, 动作码, 示例短语]
    // 命中优先匹配（避免 "三分"被"两分"误匹配）
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[Voice] 浏览器不支持 SpeechRecognition API');

      // Firefox / 微信等完全没有API的浏览器
      const ua = navigator.userAgent;
      const reason = ua.includes('Firefox') ? 'Firefox 不支持 Web Speech API'
        : ua.includes('MicroMessenger') ? '微信内置浏览器不支持语音'
        : '浏览器不支持语音识别 API';

      this.SpeechRecognition = null;
      this.isSupported = false;
      this._unsupportedReason = reason;
      this._createUI();
      return;
    }

    this.SpeechRecognition = SpeechRecognition;

    // 快速探针：尝试创建实例，检查是否立即抛异常
    try {
      const probe = new SpeechRecognition();
      probe.abort(); // 立即销毁，不做实际请求
    } catch (e) {
      console.error('[Voice] 创建 SpeechRecognition 实例失败:', e.message);
      this.isSupported = false;
      this._unsupportedReason = 'API 创建失败: ' + e.message;
      this._createUI();
      return;
    }

    this.isSupported = true;
    this._unsupportedReason = null;
    this._createUI();
    this._bindEvents();
    console.log('[Voice] 初始化完成，语音录入就绪');
  },

  /** 创建语音识别实例 */
  _createRecognition() {
    const r = new this.SpeechRecognition();
    r.lang = 'zh-CN';
    r.interimResults = false; // 只取最终结果，减少噪音
    r.maxAlternatives = 3;    // 取3个备选用于模糊匹配
    r.continuous = false;     // 单次识别，松手即停

    r.onstart = () => {
      this.isListening = true;
      this._updateUIState('listening');
      console.log('[Voice] 开始监听...');
    };

    r.onresult = (event) => {
      const results = [];
      for (let i = 0; i < event.results.length; i++) {
        const alt = event.results[i];
        for (let j = 0; j < alt.length; j++) {
          results.push({
            transcript: alt[j].transcript,
            confidence: alt[j].confidence
          });
        }
      }
      // 按置信度降序排列
      results.sort((a, b) => b.confidence - a.confidence);
      this._handleResults(results);
    };

    r.onerror = (event) => {
      console.warn('[Voice] 识别错误:', event.error);
      this.isListening = false;

      if (event.error === 'no-speech') {
        Toast.show('未检测到语音，请重试', 'warning');
      } else if (event.error === 'aborted') {
        // 用户主动停止，正常
      } else if (event.error === 'not-allowed') {
        Toast.show('麦克风权限被拒绝，请在浏览器设置中开启', 'error');
      } else {
        Toast.show('语音识别出错: ' + event.error, 'error');
      }
      this._updateUIState('idle');
    };

    r.onend = () => {
      this.isListening = false;
      if (this._uiState !== 'processing') {
        this._updateUIState('idle');
      }
    };

    return r;
  },

  /** 开始监听 */
  startListening() {
    if (!this.isSupported) {
      // Chrome 可用时不应走到这里，走到这步说明真的是不支持的浏览器
      const ua = navigator.userAgent;
      if (ua.includes('Chrome') && !ua.includes('Edge')) {
        Toast.show('Chrome 语音服务连接失败，请检查: ①是否用 localhost 访问 ②麦克风权限', 'error');
      } else if (ua.includes('Firefox')) {
        Toast.show('Firefox 不支持语音识别，请使用 Chrome 或 Edge', 'warning');
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        Toast.show('Safari 需 HTTPS + 首次手动授权，点击地址栏🔒→允许麦克风', 'warning');
      } else {
        Toast.show('当前浏览器不支持语音识别，请使用 Chrome 浏览器打开', 'warning');
      }
      return false;
    }

    if (this.isListening) return false;

    // 检查是否在比赛页面
    const scorePage = document.getElementById('page-score');
    if (!scorePage || scorePage.classList.contains('hidden')) {
      Toast.show('请先进入比赛记分页面', 'warning');
      return false;
    }

    try {
      this.recognition = this._createRecognition();
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('[Voice] 启动失败:', e);
      Toast.show('语音启动失败，请稍后重试', 'error');
      return false;
    }
  },

  /** 停止监听并识别 */
  stopListening() {
    if (this.recognition && this.isListening) {
      this._updateUIState('processing');
      this.recognition.stop();
    }
  },

  /** 处理识别结果 */
  _handleResults(results) {
    if (results.length === 0) {
      Toast.show('未识别到语音，请重说', 'warning');
      this._updateUIState('idle');
      return;
    }

    const best = results[0];
    const text = best.transcript.trim();
    const confidence = best.confidence;

    console.log(`[Voice] 识别: "${text}" (置信度: ${(confidence * 100).toFixed(0)}%)`);
    if (results.length > 1) {
      console.log('[Voice] 备选:', results.slice(1).map(r => `"${r.transcript}"(${(r.confidence*100).toFixed(0)}%)`).join(', '));
    }

    const parsed = this.parseCommand(text, results);

    if (!parsed) {
      this._updateUIState('idle');
      return;
    }

    // 置信度过低 → 提示重录
    if (confidence < 0.5) {
      Toast.show('未听清，请重说一次', 'warning');
      this._updateUIState('idle');
      return;
    }

    // 执行动作
    this._executeCommand(parsed, confidence);
  },

  /** 解析语音文本为命令 */
  parseCommand(text, allResults) {
    const cleaned = text.replace(/[，。！？、\s]+/g, '').trim();
    if (!cleaned) return null;

    // 1. 尝试匹配动作词
    let actionCode = null;
    let matchedPhrase = '';

    for (const [pattern, code, example] of this.ACTION_PATTERNS) {
      const match = cleaned.match(pattern);
      if (match) {
        actionCode = code;
        matchedPhrase = match[0];
        break;
      }
    }

    // 2. 如果没匹配到动作，搜索备选结果
    if (!actionCode && allResults && allResults.length > 1) {
      for (let i = 1; i < Math.min(allResults.length, 3); i++) {
        const altText = allResults[i].transcript.replace(/[，。！？、\s]+/g, '');
        for (const [pattern, code] of this.ACTION_PATTERNS) {
          if (altText.match(pattern)) {
            actionCode = code;
            matchedPhrase = altText.match(pattern)[0];
            console.log(`[Voice] 从备选结果匹配到动作: "${altText}" → ${code}`);
            break;
          }
        }
        if (actionCode) break;
      }
    }

    if (!actionCode) {
      // 特殊命令：切换球队、换人
      if (/切[换到]?[主客]队|主队|客队/.test(cleaned)) {
        const switchTo = /客队|客场/.test(cleaned) ? 'away' : 'home';
        return { action: 'switch', switchTo };
      }

      Toast.show(`未识别到篮球动作: "${text}"`, 'warning');
      return null;
    }

    // 3. 提取球员名（动作词之前的部分）
    let playerHint = cleaned.replace(matchedPhrase, '').trim();
    // 去掉常见的前缀词
    playerHint = playerHint.replace(/^(主队|客队|的|给|让|了)/, '');

    return {
      action: actionCode,
      playerHint: playerHint || null,
      rawText: text
    };
  },

  /** 模糊匹配当前队球员 */
  fuzzyMatchPlayer(hint, teamId) {
    if (!hint) return null;

    const teams = DB.getTeams();
    const players = DB.getPlayers().filter(p => p.teamId === teamId);
    if (players.length === 0) return null;

    // 精确匹配姓名
    let match = players.find(p => p.name === hint);
    if (match) return match;

    // 球衣号码匹配
    const numMatch = hint.match(/^(\d{1,2})号?$/);
    if (numMatch) {
      match = players.find(p => String(p.number) === numMatch[1]);
      if (match) return match;
    }

    // 姓名包含匹配（如 "张三" 匹配 "说张三三分命中"）
    match = players.find(p => hint.includes(p.name) || p.name.includes(hint));
    if (match) return match;

    // 音近匹配（Levenshtein距离 < 2）
    for (const p of players) {
      const dist = this._levenshtein(hint, p.name);
      if (dist <= 1) return p;
    }

    return null;
  },

  /** 执行解析后的命令 */
  _executeCommand(parsed, confidence) {
    const { action, playerHint } = parsed;

    // 特殊命令：切换球队
    if (action === 'switch') {
      GameManager.switchTeamTo(parsed.switchTo);
      this._updateUIState('idle');
      return;
    }

    // 撤销
    if (action === 'undo') {
      GameManager.undoLastAction();
      this._updateUIState('idle');
      return;
    }

    // 暂停
    if (action === 'timeout') {
      GameManager.requestTimeout();
      this._updateUIState('idle');
      return;
    }

    // 球员匹配
    const teamId = GameManager.currentGame
      ? (GameManager.currentTeam === 'home'
        ? GameManager.currentGame.homeTeamId
        : GameManager.currentGame.awayTeamId)
      : null;

    let player = null;
    if (playerHint) {
      player = this.fuzzyMatchPlayer(playerHint, teamId);
      if (!player) {
        // 未匹配到球员
        if (confidence < 0.7) {
          Toast.show(`未找到球员"${playerHint}"，请选择球员后重试`, 'warning');
        } else {
          Toast.show(`未找到球员"${playerHint}"，将记录为无名球员`, 'info');
        }
      }
    }

    // 检查是否需要球员的动作（得分/投篮类）
    const needsPlayer = ['fg2m', 'fg2x', 'fg3m', 'fg3x', 'ftm', 'ftx',
                         'reb', 'ast', 'stl', 'blk', 'tov', 'foul', 'highlight'];
    if (!player && needsPlayer.includes(action)) {
      // 使用当前已选中的球员（键盘先选的）
      if (GameManager.currentPlayer) {
        player = GameManager.currentPlayer;
      } else if (['reb', 'ast', 'stl', 'blk', 'tov', 'foul'].includes(action)) {
        Toast.show('请先选择球员（说球员名 + 动作）', 'error');
        this._updateUIState('idle');
        return;
      }
      // 得分/投篮类允许无球员（可能是随队统计）
    }

    // 如果匹配到了球员但非当前选中的，先切换
    if (player && GameManager.currentPlayer?.id !== player.id) {
      GameManager.currentPlayer = player;
      GameManager.renderPlayerGrid();
      console.log(`[Voice] 自动选中球员: ${player.name} #${player.number}`);
    }

    // 调用统一入口，传入 source
    GameManager.recordAction(action, 'voice');
    this._updateUIState('confirmed');
    setTimeout(() => this._updateUIState('idle'), 800);
  },

  /** Levenshtein距离 */
  _levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
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

  /** 创建语音按钮UI */
  _createUI() {
    const scorePage = document.getElementById('page-score');
    if (!scorePage) return;

    // 按钮
    const btn = document.createElement('button');
    btn.id = 'voice-btn';
    btn.className = 'voice-btn voice-idle';
    btn.title = '语音录入 (长按说话)';
    btn.innerHTML = '<span class="voice-icon">🎤</span>';
    btn.setAttribute('aria-label', '语音录入比赛事件');

    // 状态文字指示器
    const indicator = document.createElement('span');
    indicator.id = 'voice-indicator';
    indicator.className = 'voice-indicator';
    indicator.textContent = '语音录入';

    // 提示浮层
    const tooltip = document.createElement('div');
    tooltip.id = 'voice-tooltip';
    tooltip.textContent = '按住说话，松手识别';

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
      const reason = this._unsupportedReason || '语音识别不可用';
      btn.title = reason;
      indicator.textContent = '不可用';

      // 点击禁用按钮时显示详细诊断
      btn.addEventListener('click', () => {
        const ua = navigator.userAgent;
        let detail = `原因: ${reason}\n`;
        detail += `浏览器: ${ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : '未知'}\n`;
        if (ua.includes('Chrome')) {
          detail += '\nChrome 需要访问 Google 语音服务器。\n若在中国大陆，可能需要科学上网。\n未来版本将支持讯飞离线方案。';
        }
        Toast.show(detail.split('\n')[0], 'error');
        console.warn('[Voice]', detail);
      });
    }
  },

  /** 绑定交互事件 */
  _bindEvents() {
    if (!this.isSupported || !this._btn) return;

    // 长按说话 (touch + mouse)
    let pressTimer = null;
    let isPressing = false;

    const onPressStart = (e) => {
      e.preventDefault();
      isPressing = true;
      this._btn.classList.add('voice-pressing');

      // 300ms 后开始监听（防止误触）
      pressTimer = setTimeout(() => {
        if (isPressing) {
          this.startListening();
        }
      }, 300);
    };

    const onPressEnd = (e) => {
      e.preventDefault();
      isPressing = false;
      this._btn.classList.remove('voice-pressing');
      clearTimeout(pressTimer);

      if (this.isListening) {
        this.stopListening();
      }
    };

    this._btn.addEventListener('mousedown', onPressStart);
    this._btn.addEventListener('mouseup', onPressEnd);
    this._btn.addEventListener('mouseleave', () => {
      if (isPressing) onPressEnd(new Event('mouseup'));
    });
    this._btn.addEventListener('touchstart', onPressStart, { passive: false });
    this._btn.addEventListener('touchend', onPressEnd, { passive: false });

    // 键盘快捷键 V (按住说话)
    document.addEventListener('keydown', (e) => {
      const scorePage = document.getElementById('page-score');
      if (!scorePage || scorePage.classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key.toLowerCase() === 'v' && !e.repeat) {
        this.mode = 'hold';
        this.startListening();
        this._btn?.classList.add('voice-pressing');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'v' && this.isListening) {
        this.stopListening();
        this._btn?.classList.remove('voice-pressing');
      }
    });
  },

  /** 更新按钮UI状态 */
  _updateUIState(state) {
    this._uiState = state;
    if (!this._btn) return;

    // 清除所有状态类
    this._btn.classList.remove('voice-idle', 'voice-listening', 'voice-processing', 'voice-confirmed');
    this._btn.classList.add('voice-' + state);

    const states = {
      idle:    { icon: '🎤', text: '语音录入', title: '语音录入 (长按说话)' },
      listening: { icon: '🎙️', text: '正在听...', title: '正在收听...松开结束' },
      processing: { icon: '⏳', text: '识别中...', title: '正在识别...' },
      confirmed: { icon: '✅', text: '已记录', title: '事件已记录' },
    };

    const s = states[state] || states.idle;
    this._btn.querySelector('.voice-icon').textContent = s.icon;
    this._btn.title = s.title;
    if (this._indicator) this._indicator.textContent = s.text;
  }
};
