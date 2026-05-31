/**
 * HoopStats - 数据看板模块
 * 球队维度 + 个人维度双视角分析
 */

const Dashboard = {
  // 当前状态
  currentView: 'team',
  selectedTeamId: null,
  selectedPlayerId: null,
  charts: {},

  // 事件中文名 → 类型码映射 (addEvent 用中文 action 存储)
  ACTION_MAP: {
    '2分命中': 'fg2m', '3分命中': 'fg3m', '罚球命中': 'ftm',
    '2分不中': 'fg2x', '3分不中': 'fg3x', '罚球不中': 'ftx',
    '篮板': 'reb', '助攻': 'ast', '抢断': 'stl', '盖帽': 'blk',
    '失误': 'tov', '犯规': 'foul', '精彩时刻': 'highlight'
  },

  // 根据中文 action 字段解码事件类型
  decodeAction(actionText) {
    return this.ACTION_MAP[actionText] || null;
  },

  // ==================== 核心计算 ====================

  /**
   * 从比赛事件列表计算单个球员的累计数据
   */
  calcPlayerStats(playerId, games) {
    let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0, tov = 0, foul = 0;
    let fgm = 0, fga = 0, fg3m = 0, fg3a = 0, ftm = 0, fta = 0;
    let gp = 0, wins = 0;
    const gameStats = [];

    games.forEach(game => {
      // 确定该球员属于哪个队 (homeStarters=ID数组, homePlayers=对象数组)
      const homeIds = new Set([
        ...(game.homeStarters || []),
        ...(game.homePlayers || []).map(p => p.id)
      ]);
      const awayIds = new Set([
        ...(game.awayStarters || []),
        ...(game.awayPlayers || []).map(p => p.id)
      ]);
      const isHome = homeIds.has(playerId);
      const isAway = awayIds.has(playerId);
      if (!isHome && !isAway) return;

      const side = isHome ? 'home' : 'away';
      const events = (game.events || []).filter(e => e.playerId === playerId);
      if (events.length === 0) return;

      gp++;
      let gamePts = 0;

      events.forEach(e => {
        const type = e.type || this.decodeAction(e.action);
        switch (type) {
          case 'fg2m': pts += 2; gamePts += 2; fgm++; fga++; break;
          case 'fg2x': fga++; break;
          case 'fg3m': pts += 3; gamePts += 3; fg3m++; fg3a++; fgm++; fga++; break;
          case 'fg3x': fg3a++; fga++; break;
          case 'ftm':  pts += 1; gamePts += 1; ftm++; fta++; break;
          case 'ftx':  fta++; break;
          case 'reb': reb++; break;
          case 'ast': ast++; break;
          case 'stl': stl++; break;
          case 'blk': blk++; break;
          case 'tov': tov++; break;
          case 'foul': foul++; break;
        }
      });

      const hScore = game.homeScore || 0;
      const aScore = game.awayScore || 0;
      if ((side === 'home' && hScore > aScore) || (side === 'away' && aScore > hScore)) {
        wins++;
      }

      gameStats.push({ date: game.date || game.createdAt, pts: gamePts, side, gameId: game.id });
    });

    const fgPct = fga > 0 ? (fgm / fga * 100) : 0;
    const fg3Pct = fg3a > 0 ? (fg3m / fg3a * 100) : 0;
    const ftPct = fta > 0 ? (ftm / fta * 100) : 0;
    const misses = fga - fgm + fta - ftm;
    const per = gp > 0 ? ((pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 - tov * 1.5 - misses * 0.5) / gp).toFixed(1) : 0;

    return {
      gp, pts, reb, ast, stl, blk, tov, foul,
      fgm, fga, fgPct: fgPct.toFixed(1),
      fg3m, fg3a, fg3Pct: fg3Pct.toFixed(1),
      ftm, fta, ftPct: ftPct.toFixed(1),
      ppg: gp > 0 ? (pts / gp).toFixed(1) : 0,
      rpg: gp > 0 ? (reb / gp).toFixed(1) : 0,
      apg: gp > 0 ? (ast / gp).toFixed(1) : 0,
      spg: gp > 0 ? (stl / gp).toFixed(1) : 0,
      bpg: gp > 0 ? (blk / gp).toFixed(1) : 0,
      per, wins, losses: gp - wins, winPct: gp > 0 ? (wins / gp * 100).toFixed(0) : 0,
      gameStats: gameStats.sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  },

  // ==================== 球队维度 ====================

  calcTeamStats(teamId, games) {
    const teamGames = games.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
    const players = DB.getPlayers().filter(p => p.teamId === teamId);

    let wins = 0, totalPf = 0, totalPa = 0;
    const recentResults = [];

    teamGames.forEach(g => {
      let pf, pa, isWin;
      if (g.homeTeamId === teamId) {
        pf = g.homeScore || 0; pa = g.awayScore || 0;
        isWin = pf > pa;
      } else {
        pf = g.awayScore || 0; pa = g.homeScore || 0;
        isWin = pf > pa;
      }
      if (isWin) wins++;
      totalPf += pf; totalPa += pa;
      recentResults.push({ date: g.date || g.createdAt, pf, pa, isWin, gameId: g.id });
    });

    const gp = teamGames.length;
    recentResults.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 计算每个球员的数据
    const playerStats = players.map(p => {
      const stats = this.calcPlayerStats(p.id, teamGames);
      return { player: p, stats };
    }).filter(p => p.stats.gp > 0)
      .sort((a, b) => b.stats.pts - a.stats.pts);

    return {
      gp, wins, losses: gp - wins,
      winPct: gp > 0 ? (wins / gp * 100).toFixed(0) : 0,
      ppg: gp > 0 ? (totalPf / gp).toFixed(1) : 0,
      papg: gp > 0 ? (totalPa / gp).toFixed(1) : 0,
      diff: gp > 0 ? ((totalPf - totalPa) / gp).toFixed(1) : 0,
      totalPf, totalPa,
      recentResults: recentResults.slice(-6),
      playerStats
    };
  },

  // ==================== 渲染 ====================

  /**
   * 切换视角
   */
  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.dash-tab[data-view="${view}"]`)?.classList.add('active');
    document.getElementById('dash-team-view').style.display = view === 'team' ? '' : 'none';
    document.getElementById('dash-player-view').style.display = view === 'player' ? '' : 'none';

    if (view === 'team') {
      if (this.selectedTeamId) this.renderTeamView(this.selectedTeamId);
    } else {
      if (this.selectedPlayerId) this.renderPlayerView(this.selectedPlayerId);
    }
  },

  /**
   * 初始化
   */
  init() {
    const games = DB.getGames();
    const teams = DB.getTeams();
    document.getElementById('dash-data-summary').textContent =
      `${teams.length} 支球队 · ${DB.getPlayers().length} 名球员 · ${games.length} 场比赛`;

    if (teams.length === 0) {
      this.showEmpty('team');
      return;
    }
    this.selectedTeamId = teams[0].id;
    this.renderTeamSelector();
    this.renderTeamView(teams[0].id);

    // 同时初始化球员选择器数据
    this.renderPlayerSelector();
  },

  // ==================== 球队视图渲染 ====================

  renderTeamSelector() {
    const teams = DB.getTeams();
    const container = document.getElementById('team-pills');
    container.innerHTML = teams.map(t => `
      <button class="dash-pill ${t.id === this.selectedTeamId ? 'active' : ''}"
              onclick="Dashboard.selectTeam('${t.id}')">
        <span>${t.icon || '🏀'}</span> ${t.name}
      </button>
    `).join('');
  },

  selectTeam(teamId) {
    this.selectedTeamId = teamId;
    this.renderTeamSelector();
    this.renderTeamView(teamId);
  },

  showEmpty(view) {
    if (view === 'team') {
      document.getElementById('team-metrics').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">📊</div>
          <div class="empty-title">暂无数据</div>
          <div class="empty-desc">创建球队并记录比赛后，这里将展示数据看板</div>
        </div>`;
    } else {
      document.getElementById('player-metrics').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">👤</div>
          <div class="empty-title">暂无数据</div>
          <div class="empty-desc">添加球员并记录比赛后，这里将展示个人数据</div>
        </div>`;
    }
    Object.values(this.charts).forEach(c => c?.destroy());
    this.charts = {};
  },

  renderTeamView(teamId) {
    const teams = DB.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const stats = this.calcTeamStats(teamId, DB.getGames());
    document.getElementById('dash-data-summary').textContent =
      `${team.name} · ${stats.gp} 场比赛 · ${stats.playerStats.length} 名球员出场`;

    this.renderTeamMetrics(team, stats);
    this.renderTeamContribChart(team, stats);
    this.renderTeamFormChart(team, stats);
    this.renderTeamEfficiencyChart(team, stats);
    this.renderTeamPlayerTable(stats);
  },

  renderTeamMetrics(team, stats) {
    const winClass = parseFloat(stats.winPct) >= 50 ? 'metric-up' : 'metric-down';
    const diffClass = parseFloat(stats.diff) >= 0 ? 'metric-up' : 'metric-down';
    document.getElementById('team-metrics').innerHTML = `
      <div class="dash-metric-card">
        <div class="metric-label">总场次</div>
        <div class="metric-value">${stats.gp}</div>
        <div class="metric-icon">🏟️</div>
      </div>
      <div class="dash-metric-card ${winClass}">
        <div class="metric-label">胜率</div>
        <div class="metric-value">${stats.winPct}%</div>
        <div class="metric-sub">${stats.wins}胜${stats.losses}负</div>
        <div class="metric-icon">🏆</div>
      </div>
      <div class="dash-metric-card">
        <div class="metric-label">场均得分</div>
        <div class="metric-value">${stats.ppg}</div>
        <div class="metric-icon">🔥</div>
      </div>
      <div class="dash-metric-card ${diffClass}">
        <div class="metric-label">净胜分/场</div>
        <div class="metric-value">${parseFloat(stats.diff) >= 0 ? '+' : ''}${stats.diff}</div>
        <div class="metric-sub">场均失分 ${stats.papg}</div>
        <div class="metric-icon">⚖️</div>
      </div>
    `;
  },

  renderTeamContribChart(team, stats) {
    if (this.charts.teamContrib) this.charts.teamContrib.destroy();
    const top5 = stats.playerStats.slice(0, 5);
    if (top5.length === 0) return;

    const ctx = document.getElementById('chart-team-contrib');
    this.charts.teamContrib = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top5.map(p => p.player.name),
        datasets: [{
          label: '总得分',
          data: top5.map(p => p.stats.pts),
          backgroundColor: ['#FF6B35', '#FF8F5E', '#FFB088', '#FFD0B0', '#FFE8D8'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `总得分: ${ctx.raw} 分 (${top5[ctx.dataIndex].stats.gp}场)`
            }
          }
        },
        scales: {
          x: { grid: { color: '#2A3A50' }, ticks: { color: '#8B9AAB' } },
          y: { grid: { display: false }, ticks: { color: '#FFFFFF', font: { weight: '500' } } }
        }
      }
    });
  },

  renderTeamFormChart(team, stats) {
    if (this.charts.teamForm) this.charts.teamForm.destroy();
    const recent = stats.recentResults;
    if (recent.length === 0) return;

    const ctx = document.getElementById('chart-team-form');
    const colors = recent.map(r => r.isWin ? '#00D4AA' : '#FF4757');
    this.charts.teamForm = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: recent.map((_, i) => `#${i + 1}`),
        datasets: [
          {
            label: '己方得分',
            data: recent.map(r => r.pf),
            backgroundColor: '#4895EF',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: '对手得分',
            data: recent.map(r => r.pa),
            backgroundColor: '#FF4757',
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8B9AAB', usePointStyle: true, padding: 16 }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8B9AAB' } },
          y: { grid: { color: '#2A3A50' }, ticks: { color: '#8B9AAB' } }
        }
      }
    });
  },

  renderTeamEfficiencyChart(team, stats) {
    if (this.charts.teamEff) this.charts.teamEff.destroy();
    const ctx = document.getElementById('chart-team-efficiency');
    this.charts.teamEff = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['场均得分', '场均失分', '净胜分', '胜率%'],
        datasets: [{
          data: [parseFloat(stats.ppg), parseFloat(stats.papg), parseFloat(stats.diff), parseFloat(stats.winPct)],
          backgroundColor: ['#4895EF', '#FF4757', '#00D4AA', '#FFB800'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#FFFFFF', font: { size: 11 } } },
          y: { grid: { color: '#2A3A50' }, ticks: { color: '#8B9AAB' } }
        }
      }
    });
  },

  renderTeamPlayerTable(stats) {
    const players = stats.playerStats;
    if (players.length === 0) {
      document.getElementById('team-player-table').innerHTML =
        '<div class="text-center text-secondary" style="padding:var(--space-xl);">暂无球员出场记录</div>';
      return;
    }
    document.getElementById('team-player-table').innerHTML = `
      <table class="dash-table">
        <thead>
          <tr>
            <th>球员</th><th>场次</th><th>场均得分</th><th>篮板</th><th>助攻</th>
            <th>命中率</th><th>三分%</th><th>PER</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => `
            <tr onclick="Dashboard.selectPlayer('${p.player.id}')" style="cursor:pointer;">
              <td><span class="table-player-name">#${p.player.number || '-'} ${p.player.name}</span>
                <span class="table-player-pos">${p.player.position || ''}</span></td>
              <td>${p.stats.gp}</td>
              <td class="highlight">${p.stats.ppg}</td>
              <td>${p.stats.rpg}</td>
              <td>${p.stats.apg}</td>
              <td>${p.stats.fgPct}%</td>
              <td>${p.stats.fg3Pct}%</td>
              <td>${p.stats.per}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  // ==================== 个人视图渲染 ====================

  renderPlayerSelector() {
    const players = DB.getPlayers();
    const teams = DB.getTeams();
    const container = document.getElementById('player-pills');
    const games = DB.getGames();

    // 只显示有比赛记录的球员
    const activePlayers = players.filter(p => {
      return games.some(g => {
        const allIds = new Set([
          ...(g.homeStarters || []),
          ...(g.awayStarters || []),
          ...(g.homePlayers || []).map(x => x.id),
          ...(g.awayPlayers || []).map(x => x.id)
        ]);
        return allIds.has(p.id);
      });
    });

    if (activePlayers.length === 0) {
      container.innerHTML = '<span class="text-dim">暂无出场记录的球员</span>';
      return;
    }

    container.innerHTML = activePlayers.map(p => {
      const team = teams.find(t => t.id === p.teamId);
      return `
        <button class="dash-pill ${p.id === this.selectedPlayerId ? 'active' : ''}"
                onclick="Dashboard.selectPlayer('${p.id}')">
          <span>🏀</span> ${p.name}
          <span class="pill-team">${team?.name || ''}</span>
        </button>
      `;
    }).join('');
  },

  selectPlayer(playerId) {
    this.selectedPlayerId = playerId;
    this.renderPlayerSelector();
    this.switchView('player');
    this.renderPlayerView(playerId);
  },

  renderPlayerView(playerId) {
    const players = DB.getPlayers();
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const games = DB.getGames();
    const stats = this.calcPlayerStats(playerId, games);
    const team = DB.getTeams().find(t => t.id === player.teamId);

    document.getElementById('dash-data-summary').textContent =
      `${player.name} · ${team?.name || '未分配'} · ${stats.gp} 场`;

    this.renderPlayerProfile(player, stats, team);
    this.renderPlayerMetrics(player, stats);
    this.renderPlayerRadar(stats);
    this.renderPlayerShootingChart(stats);
    this.renderPlayerTrendChart(stats);
  },

  renderPlayerProfile(player, stats, team) {
    const initial = player.name.charAt(0);
    const perVal = parseFloat(stats.per);
    const perColor = perVal >= 20 ? '#00D4AA' : perVal >= 15 ? '#FFB800' : perVal >= 10 ? '#4895EF' : '#8B9AAB';
    document.getElementById('player-profile-card').innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-lg);">
        <div class="player-avatar">${initial}</div>
        <div>
          <div style="font-size:1.3rem;font-weight:600;font-family:'Oswald',sans-serif;">${player.name}</div>
          <div style="color:var(--text-dim);font-size:0.9rem;">
            ${team?.name || '自由球员'} · #${player.number || '-'} · ${player.position || '-'}
          </div>
          <div style="margin-top:4px;">
            <span class="per-badge" style="background:${perColor};">PER ${stats.per}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderPlayerMetrics(player, stats) {
    const players = DB.getPlayers().filter(p => p.teamId === player.teamId);
    const allStats = players.map(p => this.calcPlayerStats(p.id, DB.getGames())).filter(s => s.gp > 0);
    const rank = (field) => {
      const sorted = [...allStats].sort((a, b) => b[field] - a[field]);
      const idx = sorted.findIndex(s => s.pts === stats.pts && s.reb === stats.reb); // approximate match
      return allStats.length > 0 ? Math.min(idx + 1, allStats.length) : '-';
    };

    const metrics = [
      { label: '场均得分', value: stats.ppg, sub: `总 ${stats.pts} 分`, icon: '🔥' },
      { label: '场均篮板', value: stats.rpg, sub: `总 ${stats.reb}`, icon: '📊' },
      { label: '场均助攻', value: stats.apg, sub: `总 ${stats.ast}`, icon: '🎯' },
      { label: '投篮命中率', value: `${stats.fgPct}%`, sub: `${stats.fgm}/${stats.fga}`, icon: '🏀' },
      { label: '三分命中率', value: `${stats.fg3Pct}%`, sub: `${stats.fg3m}/${stats.fg3a}`, icon: '🎯' },
      { label: '抢断+盖帽', value: `${stats.spg}+${stats.bpg}`, sub: `总 ${stats.stl + stats.blk}`, icon: '🛡' },
    ];

    document.getElementById('player-metrics').innerHTML = metrics.map(m => `
      <div class="dash-metric-card">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
        <div class="metric-sub">${m.sub}</div>
        <div class="metric-icon">${m.icon}</div>
      </div>
    `).join('');
  },

  renderPlayerRadar(stats) {
    if (this.charts.playerRadar) this.charts.playerRadar.destroy();
    const ctx = document.getElementById('chart-player-radar');

    // 归一化到0-100: 得分/per 30/场, 篮板 15/场, 助攻 12/场, 防守(stl+blk) 5/场, 投篮% 60%, 稳定性(出场次数) 40场
    const scores = {
      scoring: Math.min(100, parseFloat(stats.ppg) / 30 * 100),
      rebound: Math.min(100, parseFloat(stats.rpg) / 15 * 100),
      assist: Math.min(100, parseFloat(stats.apg) / 12 * 100),
      defense: Math.min(100, (parseFloat(stats.spg) + parseFloat(stats.bpg)) / 5 * 100),
      shooting: Math.min(100, parseFloat(stats.fgPct) / 60 * 100),
      stability: Math.min(100, stats.gp / 40 * 100)
    };

    this.charts.playerRadar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['得分能力', '篮板', '助攻', '防守', '投篮效率', '稳定性'],
        datasets: [{
          label: stats.gp > 0 ? `${stats.ppg}分/场` : '无数据',
          data: [scores.scoring, scores.rebound, scores.assist, scores.defense, scores.shooting, scores.stability],
          backgroundColor: 'rgba(255, 107, 53, 0.2)',
          borderColor: '#FF6B35',
          borderWidth: 2,
          pointBackgroundColor: '#FF6B35',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            grid: { color: '#2A3A50' },
            angleLines: { color: '#2A3A50' },
            pointLabels: { color: '#8B9AAB', font: { size: 11 } }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  },

  renderPlayerShootingChart(stats) {
    if (this.charts.playerShooting) this.charts.playerShooting.destroy();
    const ctx = document.getElementById('chart-player-shooting');

    const fg2m = stats.fgm - stats.fg3m;
    const fg2x = stats.fga - stats.fg3a - fg2m;
    const labels = ['2分命中', '2分不中', '3分命中', '3分不中', '罚球命中', '罚球不中'];
    const data = [fg2m, fg2x, stats.fg3m, stats.fg3a - stats.fg3m, stats.ftm, stats.fta - stats.ftm];
    const bgColors = ['#00D4AA', '#FF6B35', '#4895EF', '#FFB800', '#A855F7', '#8B9AAB'];
    const hasData = data.some(d => d > 0);

    this.charts.playerShooting = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: hasData ? data : [1],
          backgroundColor: hasData ? bgColors : ['#2A3A50'],
          borderWidth: 2,
          borderColor: '#141D2B',
          hoverBorderColor: '#141D2B'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8B9AAB', padding: 12, usePointStyle: true, font: { size: 10 } }
          }
        }
      }
    });
  },

  renderPlayerTrendChart(stats) {
    if (this.charts.playerTrend) this.charts.playerTrend.destroy();
    const gameStats = stats.gameStats;
    if (gameStats.length === 0) return;

    const ctx = document.getElementById('chart-player-trend');
    const avgLine = parseFloat(stats.ppg);

    this.charts.playerTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: gameStats.map((_, i) => `#${i + 1}`),
        datasets: [
          {
            label: '得分',
            data: gameStats.map(g => g.pts),
            borderColor: '#FF6B35',
            backgroundColor: 'rgba(255, 107, 53, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#FF6B35',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            borderWidth: 2
          },
          {
            label: `场均 ${stats.ppg}`,
            data: gameStats.map(() => avgLine),
            borderColor: '#FFB800',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8B9AAB', usePointStyle: true, padding: 16 }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8B9AAB' } },
          y: {
            grid: { color: '#2A3A50' },
            ticks: { color: '#8B9AAB' },
            beginAtZero: true
          }
        }
      }
    });
  }
};

// 注意：SPA模式下不由DOMContentLoaded初始化
// 由 index.html 的 showPage('dashboard') 调用 Dashboard.init()
// 保留此文件仅用于定义 Dashboard 全局对象
