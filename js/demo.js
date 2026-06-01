/**
 * HoopStats - 样例数据注入模块
 * 首次加载时自动创建演示数据，让用户直观体验各功能
 */

const DemoData = {
  DEMO_KEY: 'hoopstats_demo_seeded',

  /** 检查是否已注入 */
  isSeeded() {
    return localStorage.getItem(this.DEMO_KEY) === '1';
  },

  /** 标记已注入 */
  markSeeded() {
    localStorage.setItem(this.DEMO_KEY, '1');
  },

  /** 生成固定ID（可预测，方便演示） */
  fid(prefix) {
    return 'demo_' + prefix + '_' + Math.random().toString(36).substr(2, 5);
  },

  /** 是否已有用户数据 */
  hasExistingData() {
    const hasTeams = localStorage.getItem('hoopstats_teams');
    const hasPlayers = localStorage.getItem('hoopstats_players');
    return (hasTeams && hasTeams !== '[]') || (hasPlayers && hasPlayers !== '[]');
  },

  /** 主入口：注入所有样例数据 */
  seed() {
    if (this.isSeeded()) return false;  // 已注入过
    if (this.hasExistingData()) {
      console.log('[Demo] 检测到现有用户数据，跳过样例数据注入');
      this.markSeeded();
      return false;
    }

    console.log('[Demo] 首次加载，正在注入样例数据...');

    const teams = this.seedTeams();
    const players = this.seedPlayers(teams);
    this.seedGames(teams, players);
    this.seedBlogs();

    this.markSeeded();
    console.log('[Demo] 样例数据注入完成！球队 x' + teams.length + ' 球员 x' + players.length);
    return true;
  },

  /** 注入球队 */
  seedTeams() {
    const teams = [
      {
        id: this.fid('team'),
        name: '广州华南虎',
        city: '广州',
        color: '#FF4757',
        icon: '🔴',
        colorName: '红队',
        founded: '2024',
        description: '广州本土篮球劲旅，以快攻和三分著称',
        memberCount: 8,
        wins: 12,
        losses: 5,
        creatorId: 'demo_admin',
        admins: [],
        createdAt: '2026-03-15T08:00:00.000Z',
        updatedAt: '2026-05-28T20:30:00.000Z'
      },
      {
        id: this.fid('team'),
        name: '深圳飓风队',
        city: '深圳',
        color: '#4895EF',
        icon: '🔵',
        colorName: '蓝队',
        founded: '2024',
        description: '深圳速度型球队，防守凶悍，内线优势明显',
        memberCount: 7,
        wins: 9,
        losses: 8,
        creatorId: 'demo_admin',
        admins: [],
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-05-28T21:00:00.000Z'
      }
    ];

    DB.set(DB.KEYS.TEAMS, teams);
    return teams;
  },

  /** 注入球员 */
  seedPlayers(teams) {
    const gz = teams[0];  // 广州华南虎
    const sz = teams[1];  // 深圳飓风

    const players = [
      // === 广州华南虎 ===
      { id: this.fid('p1'), name: '陈志强', teamId: gz.id, position: 'PG', number: 7,  height: 183, weight: 78,  phone: '13800001001', color: '#FF4757', createdAt: '2026-03-15T08:10:00.000Z' },
      { id: this.fid('p2'), name: '李铭浩', teamId: gz.id, position: 'SG', number: 23, height: 191, weight: 85,  phone: '13800001002', color: '#4895EF', createdAt: '2026-03-15T08:11:00.000Z' },
      { id: this.fid('p3'), name: '张伟杰', teamId: gz.id, position: 'SF', number: 34, height: 198, weight: 92,  phone: '13800001003', color: '#00D4AA', createdAt: '2026-03-15T08:12:00.000Z' },
      { id: this.fid('p4'), name: '刘明辉', teamId: gz.id, position: 'PF', number: 12, height: 203, weight: 100, phone: '13800001004', color: '#FFB800', createdAt: '2026-03-16T09:00:00.000Z' },
      { id: this.fid('p5'), name: '王浩然', teamId: gz.id, position: 'C',  number: 55, height: 210, weight: 110, phone: '13800001005', color: '#A855F7', createdAt: '2026-03-16T09:01:00.000Z' },
      { id: this.fid('p6'), name: '赵天宇', teamId: gz.id, position: 'SG', number: 8,  height: 188, weight: 82,  phone: '13800001006', color: '#FF6B35', createdAt: '2026-03-16T09:02:00.000Z' },
      { id: this.fid('p7'), name: '黄思远', teamId: gz.id, position: 'SF', number: 21, height: 196, weight: 90,  phone: '13800001007', color: '#00CED1', createdAt: '2026-03-17T10:00:00.000Z' },

      // === 深圳飓风 ===
      { id: this.fid('p8'),  name: '林志豪', teamId: sz.id, position: 'PG', number: 3,  height: 185, weight: 79,  phone: '13900002001', color: '#4895EF', createdAt: '2026-03-20T10:10:00.000Z' },
      { id: this.fid('p9'),  name: '周子轩', teamId: sz.id, position: 'SG', number: 11, height: 193, weight: 87,  phone: '13900002002', color: '#FF4757', createdAt: '2026-03-20T10:11:00.000Z' },
      { id: this.fid('p10'), name: '吴浩然', teamId: sz.id, position: 'SF', number: 24, height: 200, weight: 95,  phone: '13900002003', color: '#FFB800', createdAt: '2026-03-20T10:12:00.000Z' },
      { id: this.fid('p11'), name: '郑俊杰', teamId: sz.id, position: 'PF', number: 15, height: 205, weight: 102, phone: '13900002004', color: '#A855F7', createdAt: '2026-03-21T11:00:00.000Z' },
      { id: this.fid('p12'), name: '孙大鹏', teamId: sz.id, position: 'C',  number: 33, height: 212, weight: 115, phone: '13900002005', color: '#00D4AA', createdAt: '2026-03-21T11:01:00.000Z' },
      { id: this.fid('p13'), name: '马晓飞', teamId: sz.id, position: 'PG', number: 5,  height: 180, weight: 76,  phone: '13900002006', color: '#FF6B35', createdAt: '2026-03-21T11:02:00.000Z' },
      { id: this.fid('p14'), name: '许志远', teamId: sz.id, position: 'PF', number: 42, height: 202, weight: 98,  phone: '13900002007', color: '#00CED1', createdAt: '2026-03-22T12:00:00.000Z' },
    ];

    DB.set(DB.KEYS.PLAYERS, players);
    return players;
  },

  /** 生成事件对象 */
  mkEvent(action, playerId, playerName, team, scoreDelta, timer, period) {
    const actionMap = {
      '两分命中': { icon: '🎯', color: 'success' },
      '两分不中': { icon: '✖',  color: 'danger' },
      '三分命中': { icon: '🎯', color: 'success' },
      '三分不中': { icon: '✖',  color: 'danger' },
      '罚球命中': { icon: '🎯', color: 'success' },
      '罚球不中': { icon: '✖',  color: 'danger' },
      '篮板':     { icon: '📊', color: 'info' },
      '助攻':     { icon: '🎯', color: 'info' },
      '抢断':     { icon: '✋', color: 'warning' },
      '盖帽':     { icon: '🛡', color: 'info' },
      '失误':     { icon: '❌', color: 'warning' },
      '犯规':     { icon: '🚨', color: 'danger' },
      '换人':     { icon: '🔄', color: 'info' },
      '暂停':     { icon: '⏸', color: 'secondary' },
      '精彩时刻': { icon: '⭐', color: 'warning' }
    };
    const info = actionMap[action] || { icon: '●', color: 'secondary' };
    return {
      id: this.fid('evt'),
      type: action,
      action,
      playerId,
      playerName,
      team,
      scoreDelta,
      period,
      timer,
      symbol: info.icon,
      colorClass: info.color,
      timestamp: new Date().toISOString()
    };
  },

  /** 注入比赛（含详细事件） */
  seedGames(teams, players) {
    const gz = teams[0];  // 广州华南虎
    const sz = teams[1];  // 深圳飓风

    // 获取各队球员（按ID查找）
    const gzp = players.filter(p => p.teamId === gz.id);
    const szp = players.filter(p => p.teamId === sz.id);

    // 首发：广州 5人，深圳 5人
    const gzStarters = gzp.slice(0, 5).map(p => p.id);
    const szStarters = szp.slice(0, 5).map(p => p.id);

    const now = new Date();

    // ========== 比赛1: 广州华南虎 78 - 75 深圳飓风 (激烈比赛) ==========
    const game1HomePlayers = gzp.map(p => ({ ...p, onCourt: gzStarters.includes(p.id) }));
    const game1AwayPlayers = szp.map(p => ({ ...p, onCourt: szStarters.includes(p.id) }));

    const game1Events = [];
    let homeScore = 0, awayScore = 0;

    // 用函数便捷添加得分事件
    const add = (team, action, p, delta = 0, timer = 600, period = 1) => {
      const side = team === 'home' ? 'home' : 'away';
      const effectiveAction = typeof action === 'string' ? action : action;
      game1Events.push(this.mkEvent(effectiveAction, p.id, p.name, side, delta, timer, period));
    };
    const H = (a, p, d, t, r) => add('home', a, p, d, t, r);
    const A = (a, p, d, t, r) => add('away', a, p, d, t, r);

    // --- 第1节 (12分钟 = 720秒 → 简化模拟) ---
    let sec = 720;  // Q1开始
    // 广州开局两分
    H('两分命中', gzp[0], 2, sec-=15); homeScore += 2;
    // 深圳回应三分
    A('三分命中', szp[1], 3, sec-=20); awayScore += 3;
    // 广州中投
    H('两分命中', gzp[1], 2, sec-=12); homeScore += 2;
    // 广州抢断
    H('抢断', gzp[2], 0, sec-=5);
    // 广州中锋补篮
    H('两分命中', gzp[4], 2, sec-=8); homeScore += 2;
    // 深圳中锋回应
    A('两分命中', szp[4], 2, sec-=10); awayScore += 2;
    // 深圳犯规
    A('犯规', szp[3], 0, sec-=3);
    // 广州罚球2中2
    H('罚球命中', gzp[0], 1, sec-=6); homeScore += 1;
    H('罚球命中', gzp[0], 1, sec-=5); homeScore += 1;
    // 深圳快攻
    A('两分命中', szp[0], 2, sec-=8); awayScore += 2;
    // 广州三分
    H('三分命中', gzp[1], 3, sec-=12); homeScore += 3;
    // 深圳中投
    A('两分命中', szp[2], 2, sec-=8); awayScore += 2;
    // 节结束前的篮板争夺
    H('篮板', gzp[4], 0, sec-=3);
    A('篮板', szp[4], 0, sec-=2);

    // --- 第2节 ---
    sec = 720;
    A('两分不中', szp[1], 0, sec-=15);
    H('篮板', gzp[3], 0, sec-=2);
    H('两分命中', gzp[3], 2, sec-=8); homeScore += 2;
    A('失误', szp[0], 0, sec-=5);
    H('抢断', gzp[0], 0, sec-=2);
    H('两分命中', gzp[0], 2, sec-=6); homeScore += 2;
    // 深圳暂停后回归
    A('三分命中', szp[1], 3, sec-=15); awayScore += 3;
    A('抢断', szp[3], 0, sec-=4);
    A('两分命中', szp[3], 2, sec-=8); awayScore += 2;
    H('两分不中', gzp[2], 0, sec-=10);
    A('篮板', szp[5], 0, sec-=2);
    H('犯规', gzp[4], 0, sec-=3);
    A('罚球命中', szp[2], 1, sec-=5); awayScore += 1;
    A('罚球不中', szp[2], 0, sec-=5);
    H('篮板', gzp[3], 0, sec-=2);
    H('精彩时刻', gzp[0], 0, sec-=8);  // 精彩一条龙快攻
    H('两分命中', gzp[0], 2, sec-=6); homeScore += 2;
    A('三分不中', szp[1], 0, sec-=5);
    H('篮板', gzp[4], 0, sec-=2);

    // --- 第3节 ---
    sec = 720;
    A('两分命中', szp[4], 2, sec-=10); awayScore += 2;
    H('三分命中', gzp[1], 3, sec-=15); homeScore += 3;
    A('失误', szp[0], 0, sec-=5);
    H('抢断', gzp[2], 0, sec-=2);
    H('两分命中', gzp[2], 2, sec-=7); homeScore += 2;
    A('犯规', szp[4], 0, sec-=3);
    H('罚球命中', gzp[2], 1, sec-=5); homeScore += 1;
    H('罚球不中', gzp[2], 0, sec-=5);
    A('篮板', szp[4], 0, sec-=2);
    // 互飚三分
    H('三分命中', gzp[1], 3, sec-=12); homeScore += 3;
    A('三分命中', szp[1], 3, sec-=10); awayScore += 3;
    H('三分不中', gzp[0], 0, sec-=8);
    A('篮板', szp[3], 0, sec-=2);
    A('两分命中', szp[3], 2, sec-=7); awayScore += 2;
    H('失误', gzp[4], 0, sec-=4);
    A('抢断', szp[0], 0, sec-=2);
    A('两分不中', szp[0], 0, sec-=6);
    H('篮板', gzp[3], 0, sec-=2);
    H('盖帽', gzp[4], 0, sec-=5);

    // --- 第4节 (关键时刻) ---
    sec = 720;
    H('两分命中', gzp[0], 2, sec-=12); homeScore += 2;
    A('两分命中', szp[2], 2, sec-=10); awayScore += 2;
    H('犯规', gzp[3], 0, sec-=3);
    A('罚球命中', szp[4], 1, sec-=5); awayScore += 1;
    A('罚球命中', szp[4], 1, sec-=5); awayScore += 1;
    H('两分不中', gzp[2], 0, sec-=10);
    A('篮板', szp[3], 0, sec-=2);
    A('失误', szp[3], 0, sec-=4);
    H('抢断', gzp[0], 0, sec-=2);
    H('三分命中', gzp[1], 3, sec-=15); homeScore += 3;  // 反超！
    A('犯规', szp[2], 0, sec-=3);
    H('罚球命中', gzp[3], 1, sec-=5); homeScore += 1;
    H('罚球命中', gzp[3], 1, sec-=5); homeScore += 1;
    // 深圳绝命三分不中
    A('三分不中', szp[1], 0, sec-=5);
    H('篮板', gzp[4], 0, sec-=2);
    // 广州领先3分，深圳犯规战术
    A('犯规', szp[0], 0, sec-=2);
    H('罚球命中', gzp[0], 1, sec-=3); homeScore += 1;
    H('罚球命中', gzp[0], 1, sec-=3); homeScore += 1;

    const game1 = {
      id: this.fid('g1'),
      homeTeamId: gz.id,
      awayTeamId: sz.id,
      date: '2026-05-15',
      location: '广州天河体育中心',
      homeScore,
      awayScore,
      period: 4,
      status: 'ended',
      events: game1Events,
      settings: { periods: 4, periodMinutes: 12, timeouts: 3, foulLimit: 5, shotClockSeconds: 24 },
      resources: { home: { timeouts: 1, subs: 95 }, away: { timeouts: 2, subs: 96 } },
      homeStarters: gzStarters,
      awayStarters: szStarters,
      homePlayers: game1HomePlayers,
      awayPlayers: game1AwayPlayers,
      createdAt: '2026-05-15T12:00:00.000Z',
      updatedAt: '2026-05-15T14:30:00.000Z'
    };

    // ========== 比赛2: 广州华南虎 92 - 68 深圳飓风 (广州大胜) ==========
    const game2HomePlayers = gzp.map(p => ({ ...p, onCourt: gzStarters.includes(p.id) }));
    const game2AwayPlayers = szp.map(p => ({ ...p, onCourt: szStarters.includes(p.id) }));

    const game2Events = [];
    let h2 = 0, a2 = 0;
    const H2 = (a, p, d, t, r) => { game2Events.push(this.mkEvent(a, p.id, p.name, 'home', d, t, r)); };
    const A2 = (a, p, d, t, r) => { game2Events.push(this.mkEvent(a, p.id, p.name, 'away', d, t, r)); };

    // Q1 - 广州强势开局
    sec = 720;
    H2('三分命中', gzp[1], 3, sec-=12); h2 += 3;
    A2('两分不中', szp[0], 0, sec-=8);
    H2('篮板', gzp[4], 0, sec-=2);
    H2('两分命中', gzp[0], 2, sec-=8); h2 += 2;
    H2('抢断', gzp[2], 0, sec-=5);
    H2('两分命中', gzp[2], 2, sec-=6); h2 += 2;
    A2('失误', szp[2], 0, sec-=4);
    H2('抢断', gzp[0], 0, sec-=2);
    H2('两分命中', gzp[0], 2, sec-=7); h2 += 2;
    A2('犯规', szp[3], 0, sec-=2);
    H2('罚球命中', gzp[4], 1, sec-=5); h2 += 1;
    H2('罚球不中', gzp[4], 0, sec-=5);
    A2('篮板', szp[4], 0, sec-=2);
    A2('两分命中', szp[4], 2, sec-=10); a2 += 2;
    H2('三分命中', gzp[1], 3, sec-=12); h2 += 3;
    A2('三分不中', szp[1], 0, sec-=8);

    // Q2
    sec = 720;
    H2('两分命中', gzp[4], 2, sec-=10); h2 += 2;
    H2('盖帽', gzp[4], 0, sec-=5);
    H2('篮板', gzp[3], 0, sec-=2);
    H2('两分命中', gzp[3], 2, sec-=8); h2 += 2;
    A2('犯规', szp[4], 0, sec-=3);
    H2('罚球命中', gzp[3], 1, sec-=5); h2 += 1;
    H2('罚球命中', gzp[3], 1, sec-=5); h2 += 1;
    A2('两分命中', szp[1], 2, sec-=12); a2 += 2;
    H2('三分不中', gzp[2], 0, sec-=8);
    A2('篮板', szp[3], 0, sec-=2);
    A2('三分命中', szp[0], 3, sec-=10); a2 += 3;
    // 广州替补上场
    H2('两分命中', gzp[5], 2, sec-=8); h2 += 2;  // 赵天宇替补出场
    H2('抢断', gzp[5], 0, sec-=5);
    H2('两分命中', gzp[5], 2, sec-=6); h2 += 2;
    A2('失误', szp[0], 0, sec-=4);

    // Q3
    sec = 720;
    H2('两分命中', gzp[0], 2, sec-=10); h2 += 2;
    A2('两分命中', szp[4], 2, sec-=8); a2 += 2;
    H2('三分命中', gzp[1], 3, sec-=15); h2 += 3;
    A2('两分不中', szp[2], 0, sec-=8);
    H2('篮板', gzp[3], 0, sec-=2);
    H2('两分不中', gzp[3], 0, sec-=6);
    A2('篮板', szp[4], 0, sec-=2);
    A2('两分命中', szp[2], 2, sec-=8); a2 += 2;
    H2('精彩时刻', gzp[1], 0, sec-=10);  // 空接暴扣
    H2('两分命中', gzp[1], 2, sec-=5); h2 += 2;
    H2('犯规', gzp[4], 0, sec-=3);
    A2('罚球命中', szp[3], 1, sec-=5); a2 += 1;
    A2('罚球命中', szp[3], 1, sec-=5); a2 += 1;
    H2('三分命中', gzp[5], 3, sec-=12); h2 += 3;  // 替补三分！

    // Q4 - 垃圾时间
    sec = 720;
    H2('两分命中', gzp[6], 2, sec-=8); h2 += 2;  // 黄思远得分
    A2('三分命中', szp[6], 3, sec-=12); a2 += 3; // 许志远回应
    H2('两分命中', gzp[0], 2, sec-=10); h2 += 2;
    A2('两分不中', szp[5], 0, sec-=6);
    H2('篮板', gzp[4], 0, sec-=2);
    H2('两分命中', gzp[6], 2, sec-=7); h2 += 2;
    H2('抢断', gzp[2], 0, sec-=5);
    H2('两分命中', gzp[2], 2, sec-=6); h2 += 2;

    const game2 = {
      id: this.fid('g2'),
      homeTeamId: gz.id,
      awayTeamId: sz.id,
      date: '2026-05-28',
      location: '深圳湾体育中心',
      homeScore: h2,
      awayScore: a2,
      period: 4,
      status: 'ended',
      events: game2Events,
      settings: { periods: 4, periodMinutes: 12, timeouts: 3, foulLimit: 5, shotClockSeconds: 24 },
      resources: { home: { timeouts: 2, subs: 94 }, away: { timeouts: 1, subs: 95 } },
      homeStarters: gzStarters,
      awayStarters: szStarters,
      homePlayers: game2HomePlayers,
      awayPlayers: game2AwayPlayers,
      createdAt: '2026-05-28T10:00:00.000Z',
      updatedAt: '2026-05-28T12:15:00.000Z'
    };

    DB.set(DB.KEYS.GAMES, [game1, game2]);

    // 更新球队战绩
    const updatedGz = { ...gz, wins: gz.wins + 2, losses: gz.losses };
    const updatedSz = { ...sz, wins: sz.wins, losses: sz.losses + 2 };
    const allTeams = [updatedGz, updatedSz];
    DB.set(DB.KEYS.TEAMS, allTeams);

    return [game1, game2];
  },

  /** 注入博客文章 */
  seedBlogs() {
    const posts = [
      {
        id: this.fid('post'),
        title: '业余篮球如何系统地提升命中率？',
        category: '技巧',
        content: `打了两年业余联赛，从最初的铁匠到现在成为队内二号得分手，我总结了几个提升命中率的实用方法。

**1. 固定投篮姿势**
不要频繁调整手型。找到最舒服的发力点，录视频回看矫正。我用三个月固定姿势，命中率从25%提到45%。

**2. 罚球线练习**
每天训练结束前罚50个球。刚开始罚球命中率不到50%，坚持一个月后稳定在75%以上。

**3. 体能训练不能少**
体能下降时投篮动作会变形。建议每周2次核心+腿部力量训练，比赛后半段命中率不会断崖下降。

**4. 心理暗示**
闭上眼睛想象球空心入网，这个技巧可能听起来玄学，但真的有效。`,
        author: { id: 'demo_admin', name: '陈志强' },
        likes: 24,
        likedBy: ['demo_admin', 'demo_u1', 'demo_u2'],
        comments: [
          { id: this.fid('cmt'), author: '李铭浩', content: '罚球练习那部分太真实了！我也是靠这个方法提升的', createdAt: '2026-05-16T10:00:00.000Z' },
          { id: this.fid('cmt'), author: '林志豪', content: '体能训练确实关键，我下半场打完基本动作全变形', createdAt: '2026-05-16T14:30:00.000Z' },
        ],
        createdAt: '2026-05-15T20:00:00.000Z',
        updatedAt: '2026-05-16T14:30:00.000Z'
      },
      {
        id: this.fid('post'),
        title: '广州华南虎 78-75 深圳飓风 赛后复盘',
        category: '战报',
        content: `一场打到最后一秒的精彩比赛！

**数据亮点**
- 广州队三分命中率38.5%，深圳队仅28.6%，这是胜负关键
- 广州队抢断12次，快攻得分22分，完全打出了"广东速度"
- 深圳队内线得分42分，篮板领先6个

**关键球回顾**
第四节还剩2分30秒，广州队落后3分。李铭浩右侧45度接球，迎着防守命中反超三分！这个球直接打崩了深圳队的心态。

**反思**
两队都有明显短板。广州队内线防守偏弱，深圳队外线命中率不稳定。下场比赛双方都需针对性调整。`,
        author: { id: 'demo_admin', name: '王教练' },
        likes: 18,
        likedBy: ['demo_admin', 'demo_u3'],
        comments: [
          { id: this.fid('cmt'), author: '周子轩', content: '我们三分确实太铁了，回去加练！', createdAt: '2026-05-16T08:30:00.000Z' },
          { id: this.fid('cmt'), author: '张伟杰', content: '那个反超三分我到现在还在回味 🔥', createdAt: '2026-05-16T09:15:00.000Z' },
          { id: this.fid('cmt'), author: '孙大鹏', content: '内线优势没转化为胜利，我们战术执行力还得加强', createdAt: '2026-05-16T11:00:00.000Z' },
        ],
        createdAt: '2026-05-15T22:30:00.000Z',
        updatedAt: '2026-05-16T11:00:00.000Z'
      },
      {
        id: this.fid('post'),
        title: '初学者的5个常见错误（附纠正方法）',
        category: '心得',
        content: `带新人打了半年球，发现这几个错误几乎所有初学者都会犯：

**1. 运球时低头看球**
纠正：练习盲运球，每天15分钟边走路边运球（注意安全）

**2. 投篮时身体前倾**
纠正：对着墙投篮，强迫身体保持垂直

**3. 防守时只看球不看人**
纠正：练习滑步防守，要求全程保持视线在对手腰上

**4. 传球太随意**
纠正：每次传球前数"一二"，给自己半秒决策时间

**5. 不会用非惯用手**
纠正：每天左手运球50次，左手投篮25次

篮球是肌肉记忆的运动，没有捷径。坚持练就对了。`,
        author: { id: 'demo_admin', name: '刘明辉' },
        likes: 32,
        likedBy: ['demo_admin', 'demo_u1', 'demo_u2', 'demo_u3', 'demo_u4'],
        comments: [
          { id: this.fid('cmt'), author: '马晓飞', content: '左手练了两个月终于能上场用，感谢分享！', createdAt: '2026-05-10T16:00:00.000Z' },
          { id: this.fid('cmt'), author: '黄思远', content: '防守看人不看球这条太重要了，新人必看', createdAt: '2026-05-11T07:45:00.000Z' },
        ],
        createdAt: '2026-05-08T18:00:00.000Z',
        updatedAt: '2026-05-11T07:45:00.000Z'
      }
    ];

    localStorage.setItem('hoopstats_posts', JSON.stringify(posts));
    return posts;
  }

};

// 全局导出
window.DemoData = DemoData;
