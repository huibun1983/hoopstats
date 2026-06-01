/**
 * HoopStats - 球员管理模块
 */

const PlayerManager = {
  // 球员位置选项
  POSITIONS: [
    { value: 'PG', label: '控球后卫', abbr: 'PG' },
    { value: 'SG', label: '得分后卫', abbr: 'SG' },
    { value: 'SF', label: '小前锋', abbr: 'SF' },
    { value: 'PF', label: '大前锋', abbr: 'PF' },
    { value: 'C', label: '中锋', abbr: 'C' }
  ],

  // 球员号码颜色
  NUMBER_COLORS: [
    '#FF4757', '#4895EF', '#00D4AA', '#FFB800', '#A855F7',
    '#FF6B35', '#00CED1', '#FF69B4', '#8B5CF6', '#14B8A6'
  ],

  /**
   * 渲染球员列表
   */
  render() {
    const players = DB.getPlayers();
    const teams = DB.getTeams();
    const container = document.getElementById('player-list');

    if (!container) return;

    // 统计卡片
    this.renderStats(players);

    if (players.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">暂无球员</div>
          <div class="empty-desc">添加球员到你的球队，开始记录数据</div>
          <button class="btn btn-primary" onclick="PlayerManager.showCreateModal()">
            <span>➕</span> 添加球员
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>球员</th>
              <th>球队</th>
              <th>位置</th>
              <th>号码</th>
              <th>身高/体重</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(player => {
              const team = teams.find(t => t.id === player.teamId);
              const position = this.POSITIONS.find(p => p.value === player.position);
              return `
                <tr>
                  <td>
                    <div class="flex items-center gap-md">
                      <div style="
                        width:40px;height:40px;border-radius:50%;
                        background:${player.color || '#4895EF'};
                        display:flex;align-items:center;justify-content:center;
                        font-weight:700;font-size:0.9rem;
                      ">
                        ${player.name ? player.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <div style="font-weight:600;">${player.name}</div>
                        <div style="font-size:0.8rem;color:var(--text-dim);">${player.phone || '未填手机'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge">${team ? team.icon + ' ' + team.name : '未分配'}</span>
                  </td>
                  <td>
                    <span class="badge badge-info">${position ? position.abbr : '-'}</span>
                  </td>
                  <td>
                    <span style="
                      display:inline-flex;align-items:center;justify-content:center;
                      width:32px;height:32px;border-radius:6px;
                      background:${this.NUMBER_COLORS[(player.number || 0) % 10]};
                      color:#fff;font-weight:700;font-size:0.85rem;
                    ">${player.number || '-'}</span>
                  </td>
                  <td>
                    <span class="text-secondary">
                      ${player.height ? player.height + 'cm' : '-'} / 
                      ${player.weight ? player.weight + 'kg' : '-'}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-sm">
                      <button class="btn btn-ghost btn-sm" onclick="PlayerManager.showCareerModal('${player.id}')">
                        📊 生涯
                      </button>
                      <button class="btn btn-ghost btn-sm" onclick="PlayerManager.showEditModal('${player.id}')">
                        ✏️ 编辑
                      </button>
                      <button class="btn btn-ghost btn-sm" onclick="PlayerManager.deletePlayer('${player.id}')">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * 渲染统计卡片
   */
  renderStats(players) {
    const statsContainer = document.getElementById('player-stats');
    if (!statsContainer) return;

    const teams = DB.getTeams();
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${players.length}</div>
        <div class="stat-label">球员总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏀</div>
        <div class="stat-value">${teams.length}</div>
        <div class="stat-label">所属球队</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏆</div>
        <div class="stat-value">${players.filter(p => (p.stats?.gamesPlayed || 0) > 0).length}</div>
        <div class="stat-label">有出场记录</div>
      </div>
    `;
  },

  /**
   * 获取球队球员列表
   */
  getTeamPlayers(teamId) {
    return DB.getPlayersByTeam(teamId);
  },

  /**
   * 显示创建模态框
   */
  showCreateModal(teamId = null) {
    const modal = document.getElementById('player-modal');
    const title = document.getElementById('player-modal-title');
    const form = document.getElementById('player-form');

    title.textContent = '添加球员';
    form.reset();
    form.dataset.playerId = '';

    // 填充球队下拉
    const teamSelect = document.getElementById('player-team');
    if (teamSelect) {
      const teams = DB.getTeams();
      teamSelect.innerHTML = `
        <option value="">选择球队</option>
        ${teams.map(t => `<option value="${t.id}" ${t.id === teamId ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
      `;
    }

    modal.classList.add('active');
  },

  /**
   * 显示编辑模态框
   */
  showEditModal(id) {
    const player = DB.getPlayers().find(p => p.id === id);
    if (!player) return;

    const modal = document.getElementById('player-modal');
    const title = document.getElementById('player-modal-title');
    const form = document.getElementById('player-form');

    title.textContent = '编辑球员';
    form.dataset.playerId = id;

    // 填充表单
    document.getElementById('player-name').value = player.name || '';
    document.getElementById('player-team').value = player.teamId || '';
    document.getElementById('player-position').value = player.position || '';
    document.getElementById('player-number').value = player.number || '';
    document.getElementById('player-height').value = player.height || '';
    document.getElementById('player-weight').value = player.weight || '';
    document.getElementById('player-phone').value = player.phone || '';

    modal.classList.add('active');
  },

  /**
   * 保存球员
   */
  savePlayer(e) {
    e.preventDefault();
    const form = document.getElementById('player-form');
    const playerId = form.dataset.playerId;

    const playerData = {
      name: document.getElementById('player-name').value.trim(),
      teamId: document.getElementById('player-team').value,
      position: document.getElementById('player-position').value,
      number: parseInt(document.getElementById('player-number').value) || null,
      height: parseInt(document.getElementById('player-height').value) || null,
      weight: parseInt(document.getElementById('player-weight').value) || null,
      phone: document.getElementById('player-phone').value.trim()
    };

    if (!playerData.name) {
      Toast.show('请输入球员姓名', 'error');
      return;
    }

    if (!playerData.teamId) {
      Toast.show('请选择所属球队', 'error');
      return;
    }

    // 设置随机颜色
    playerData.color = this.NUMBER_COLORS[(playerData.number || Math.floor(Math.random() * 10)) % 10];

    if (playerId) {
      const updated = DB.updatePlayer(playerId, playerData);
      if (updated) {
        Toast.show('球员信息已更新', 'success');
      }
    } else {
      const created = DB.addPlayer(playerData);
      if (created) {
        Toast.show('球员添加成功', 'success');
      }
    }

    this.closeModal();
    this.render();
  },

  /**
   * 删除球员
   */
  deletePlayer(id) {
    if (!confirm('确定要删除这名球员吗？')) return;

    if (DB.deletePlayer(id)) {
      Toast.show('球员已删除', 'success');
      this.render();
    }
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('player-modal').classList.remove('active');
  },

  /**
   * 获取球员生涯统计数据（跨所有已结束比赛）
   */
  getPlayerCareerStats(playerId) {
    const games = DB.getGames().filter(g => g.status === 'ended');
    const totals = {
      gamesPlayed: 0, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
      ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0
    };

    games.forEach(game => {
      const player = game.homePlayers?.find(p => p.id === playerId) ||
                     game.awayPlayers?.find(p => p.id === playerId);
      if (!player) return;

      const side = game.homePlayers?.find(p => p.id === playerId) ? 'home' : 'away';
      const teamEvents = game.events.filter(e => e.team === side && e.playerId === playerId);
      if (teamEvents.length === 0) return;

      totals.gamesPlayed++;

      teamEvents.forEach(e => {
        switch (e.action) {
          case '两分命中': totals.pts += 2; totals.fgm++; totals.fga++; break;
          case '两分不中': totals.fga++; break;
          case '三分命中': totals.pts += 3; totals.fg3m++; totals.fg3a++; break;
          case '三分不中': totals.fg3a++; break;
          case '罚球命中': totals.pts += 1; totals.ftm++; totals.fta++; break;
          case '罚球不中': totals.fta++; break;
          case '篮板': totals.reb++; break;
          case '助攻': totals.ast++; break;
          case '抢断': totals.stl++; break;
          case '盖帽': totals.blk++; break;
          case '失误': totals.tov++; break;
          case '犯规': totals.pf++; break;
        }
      });
    });

    if (totals.gamesPlayed === 0) return null;

    const g = totals.gamesPlayed;
    const calcPct = (made, att) => att > 0 ? (made / att * 100).toFixed(1) + '%' : '-';

    return {
      ...totals,
      ppg: (totals.pts / g).toFixed(1),
      rpg: (totals.reb / g).toFixed(1),
      apg: (totals.ast / g).toFixed(1),
      spg: (totals.stl / g).toFixed(1),
      bpg: (totals.blk / g).toFixed(1),
      fgPct: calcPct(totals.fgm, totals.fga),
      fg3Pct: calcPct(totals.fg3m, totals.fg3a),
      ftPct: calcPct(totals.ftm, totals.fta)
    };
  },

  /**
   * 显示球员生涯统计模态框
   */
  showCareerModal(playerId) {
    const player = DB.getPlayers().find(p => p.id === playerId);
    if (!player) return;

    const stats = this.getPlayerCareerStats(playerId);
    const teams = DB.getTeams();
    const team = teams.find(t => t.id === player.teamId);

    // 如果没有数据，显示空状态
    if (!stats) {
      this._showCareerEmpty(player, team);
      return;
    }

    let html = `
      <div class="career-header">
        <div class="career-player-info">
          <div class="career-avatar" style="background:${player.color || '#4895EF'}">
            ${player.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="career-player-name">${player.name}</div>
            <div class="career-player-meta">
              <span class="badge">#${player.number || '-'}</span>
              <span class="badge badge-info">${player.position || '-'}</span>
              <span class="badge">${team ? team.icon + ' ' + team.name : '未分配'}</span>
            </div>
          </div>
        </div>
        <div class="career-summary">
          <div class="career-summary-item">
            <div class="career-summary-val">${stats.gamesPlayed}</div>
            <div class="career-summary-label">出场</div>
          </div>
        </div>
      </div>

      <div class="career-grid">
        <div class="career-section">
          <div class="career-section-title">📊 场均数据</div>
          <div class="career-avg-grid">
            <div class="career-avg-item highlight"><div class="career-avg-val">${stats.ppg}</div><div class="career-avg-label">得分</div></div>
            <div class="career-avg-item"><div class="career-avg-val">${stats.rpg}</div><div class="career-avg-label">篮板</div></div>
            <div class="career-avg-item"><div class="career-avg-val">${stats.apg}</div><div class="career-avg-label">助攻</div></div>
            <div class="career-avg-item"><div class="career-avg-val">${stats.spg}</div><div class="career-avg-label">抢断</div></div>
            <div class="career-avg-item"><div class="career-avg-val">${stats.bpg}</div><div class="career-avg-label">盖帽</div></div>
          </div>
        </div>

        <div class="career-section">
          <div class="career-section-title">🎯 命中率</div>
          <div class="career-pct-grid">
            <div class="career-pct-item">
              <div class="career-pct-val">${stats.fgPct}</div>
              <div class="career-pct-label">投篮 ${stats.fgm}/${stats.fga}</div>
            </div>
            <div class="career-pct-item">
              <div class="career-pct-val">${stats.fg3Pct}</div>
              <div class="career-pct-label">三分 ${stats.fg3m}/${stats.fg3a}</div>
            </div>
            <div class="career-pct-item">
              <div class="career-pct-val">${stats.ftPct}</div>
              <div class="career-pct-label">罚球 ${stats.ftm}/${stats.fta}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="career-totals">
        <div class="career-section-title">📋 生涯总计</div>
        <div class="career-totals-grid">
          <div class="career-total-item"><span class="ct-label">总得分</span><span class="ct-val">${stats.pts}</span></div>
          <div class="career-total-item"><span class="ct-label">总篮板</span><span class="ct-val">${stats.reb}</span></div>
          <div class="career-total-item"><span class="ct-label">总助攻</span><span class="ct-val">${stats.ast}</span></div>
          <div class="career-total-item"><span class="ct-label">总抢断</span><span class="ct-val">${stats.stl}</span></div>
          <div class="career-total-item"><span class="ct-label">总盖帽</span><span class="ct-val">${stats.blk}</span></div>
          <div class="career-total-item"><span class="ct-label">总失误</span><span class="ct-val">${stats.tov}</span></div>
          <div class="career-total-item"><span class="ct-label">总犯规</span><span class="ct-val">${stats.pf}</span></div>
        </div>
      </div>
    `;

    document.getElementById('career-modal-body').innerHTML = html;
    document.getElementById('career-modal').classList.add('active');
  },

  /**
   * 显示无生涯数据空状态
   */
  _showCareerEmpty(player, team) {
    document.getElementById('career-modal-body').innerHTML = `
      <div class="career-header">
        <div class="career-player-info">
          <div class="career-avatar" style="background:${player.color || '#4895EF'}">
            ${player.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="career-player-name">${player.name}</div>
            <div class="career-player-meta">
              <span class="badge">#${player.number || '-'}</span>
              <span class="badge badge-info">${player.position || '-'}</span>
              <span class="badge">${team ? team.icon + ' ' + team.name : '未分配'}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="empty-state" style="padding:var(--space-xl);">
        <div class="empty-icon">📭</div>
        <div class="empty-title">暂无生涯数据</div>
        <div class="empty-desc">该球员尚未参与任何已结束的比赛</div>
      </div>
    `;
    document.getElementById('career-modal').classList.add('active');
  },

  closeCareerModal() {
    document.getElementById('career-modal').classList.remove('active');
  },

  /**
   * 显示批量导入模态框
   */
  showBatchImportModal() {
    const modal = document.getElementById('batch-import-modal');
    if (!modal) return;

    // 填充球队下拉
    const teamSelect = document.getElementById('batch-import-team');
    if (teamSelect) {
      const teams = DB.getTeams();
      teamSelect.innerHTML = `
        <option value="">选择球队（留空则按球队名列自动匹配）</option>
        ${teams.map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
      `;
    }

    // 清空内容
    const textarea = document.getElementById('batch-csv-text');
    if (textarea) textarea.value = '';
    const preview = document.getElementById('batch-preview');
    if (preview) preview.innerHTML = '';
    // 清空文件上传框（允许重复上传同一文件）
    const fileInput = document.getElementById('batch-csv-file');
    if (fileInput) fileInput.value = '';

    modal.classList.add('active');
  },

  /**
   * 关闭批量导入模态框
   */
  closeBatchImportModal() {
    document.getElementById('batch-import-modal').classList.remove('active');
  },

  /**
   * 解析 CSV 文本
   * 支持格式: name,team,position,number,height,weight,phone
   */
  parseCSV(text) {
    // 去掉 UTF-8 BOM（\uFEFF）
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.trim().split('\n');
    if (lines.length < 2) {
      return { error: 'CSV 至少需要 1 行表头 + 1 行数据' };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      // 跳过空行，同时保持行号与用户可见一致
      if (values.length === 0 || lines[i].trim() === '') continue;

      const row = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').trim();
      });

      // 验证必填字段（行号从 2 开始，因为第 1 行是表头）
      if (!row.name) {
        return { error: `❌ 第 ${i + 1} 行：缺少球员姓名` };
      }

      rows.push(row);
    }

    if (rows.length === 0) {
      return { error: '没有找到有效数据行' };
    }

    return { rows };
  },

  /**
   * 解析单个 CSV 行（处理引号包裹的字段）
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  },

  /**
   * 预览批量导入
   */
  previewBatchImport() {
    const csvText = document.getElementById('batch-csv-text').value;
    const selectedTeamId = document.getElementById('batch-import-team').value;
    const previewContainer = document.getElementById('batch-preview');

    if (!csvText.trim()) {
      previewContainer.innerHTML = '<div class="text-danger">请输入或粘贴 CSV 数据</div>';
      return;
    }

    const parseResult = this.parseCSV(csvText);
    if (parseResult.error) {
      previewContainer.innerHTML = `<div class="text-danger">❌ ${parseResult.error}</div>`;
      return;
    }

    const teams = DB.getTeams();
    const validRows = [];
    let errorCount = 0;

    parseResult.rows.forEach((row, idx) => {
      // 查找球队
      let teamId = row.team ? this.findTeamIdByName(row.team, teams) : null;

      // 如果指定了固定球队
      if (!teamId && selectedTeamId) {
        teamId = selectedTeamId;
      }

      const player = {
        name: row.name,
        teamId: teamId,
        position: (row.position || '').toUpperCase(),
        number: parseInt(row.number) || null,
        height: parseInt(row.height) || null,
        weight: parseInt(row.weight) || null,
        phone: row.phone || ''
      };

      // 验证
      let status = '✅';
      let statusClass = 'text-success';
      if (!player.teamId) {
        status = '⚠️ 未找到球队';
        statusClass = 'text-warning';
        errorCount++;
      }
      if (player.position && !['PG', 'SG', 'SF', 'PF', 'C', ''].includes(player.position)) {
        status = '⚠️ 位置无效';
        statusClass = 'text-warning';
        errorCount++;
      }

      validRows.push({ player, status, statusClass });
    });

    previewContainer.innerHTML = `
      <div style="margin-bottom:var(--space-md);">
        <span class="badge badge-success">${validRows.length} 条记录</span>
        ${errorCount > 0 ? `<span class="badge badge-warning">${errorCount} 条警告</span>` : ''}
      </div>
      <div class="table-container" style="max-height:300px;overflow-y:auto;">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>姓名</th>
              <th>球队</th>
              <th>位置</th>
              <th>号码</th>
              <th>身高</th>
              <th>体重</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${validRows.map(({ player, status, statusClass }) => {
              const team = teams.find(t => t.id === player.teamId);
              return `
                <tr>
                  <td>${player.name}</td>
                  <td>${team ? team.icon + ' ' + team.name : '<span class="text-danger">未分配</span>'}</td>
                  <td>${player.position || '-'}</td>
                  <td>${player.number || '-'}</td>
                  <td>${player.height ? player.height + 'cm' : '-'}</td>
                  <td>${player.weight ? player.weight + 'kg' : '-'}</td>
                  <td class="${statusClass}">${status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // 保存预览数据到表单
    document.getElementById('batch-import-form').dataset.preview = JSON.stringify(validRows.map(v => v.player));
  },

  /**
   * 根据球队名查找球队 ID
   */
  findTeamIdByName(name, teams) {
    const normalized = name.trim().toLowerCase();
    return teams.find(t =>
      t.name.toLowerCase() === normalized ||
      t.icon === normalized ||
      t.name.includes(normalized)
    )?.id || null;
  },

  /**
   * 执行批量导入
   */
  executeBatchImport() {
    const form = document.getElementById('batch-import-form');
    const previewData = form.dataset.preview;

    if (!previewData) {
      Toast.show('请先预览数据', 'error');
      return;
    }

    const players = JSON.parse(previewData);
    let successCount = 0;
    let skipCount = 0;

    players.forEach(playerData => {
      if (!playerData.teamId) {
        skipCount++;
        return;
      }

      // 设置颜色
      playerData.color = this.NUMBER_COLORS[(playerData.number || Math.floor(Math.random() * 10)) % 10];

      DB.addPlayer(playerData);
      successCount++;
    });

    this.closeBatchImportModal();
    Toast.show(`成功导入 ${successCount} 名球员${skipCount > 0 ? `，跳过 ${skipCount} 条` : ''}`, successCount > 0 ? 'success' : 'warning');
    this.render();
  },

  /**
   * 处理 CSV 文件上传
   */
  handleCSVFileUpload(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      Toast.show('请上传 CSV 格式文件', 'error');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      // 主动用 TextDecoder 显式解码 UTF-8（处理 BOM）
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const uint8 = new Uint8Array(content instanceof ArrayBuffer ? content : new TextEncoder().encode(content));
      const text = decoder.decode(uint8);

      const textarea = document.getElementById('batch-csv-text');
      if (textarea) textarea.value = text;
      this.previewBatchImport();

      // 清空 file input，允许再次上传同一文件
      fileInput.value = '';
    };
    reader.onerror = () => {
      Toast.show('文件读取失败', 'error');
      fileInput.value = '';
    };
    reader.readAsText(file);
  },

  /**
   * 导出球员为 CSV
   */
  exportPlayersCSV() {
    const players = DB.getPlayers();
    const teams = DB.getTeams();

    if (players.length === 0) {
      Toast.show('暂无球员数据可导出', 'error');
      return;
    }

    // CSV 表头（英文，与导入解析逻辑一致）
    const headers = ['name', 'team', 'position', 'number', 'height', 'weight', 'phone'];
    const headerLabels = ['姓名', '球队', '位置', '号码', '身高(cm)', '体重(kg)', '手机号码'];

    // 生成 CSV 行
    const rows = players.map(player => {
      const team = teams.find(t => t.id === player.teamId);
      return [
        this.escapeCSVValue(player.name),
        this.escapeCSVValue(team ? team.name : ''),
        player.position || '',
        player.number || '',
        player.height || '',
        player.weight || '',
        this.escapeCSVValue(player.phone || '')
      ].join(',');
    });

    // 组装完整 CSV（表头用英文字段名，导出后可直接导入）
    const csvContent = [headers.join(','), ...rows].join('\n');

    // 添加 BOM 以支持 Excel 打开中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 下载
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hoopstats_players_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    Toast.show(`已导出 ${players.length} 名球员`, 'success');
  },

  /**
   * 导出模板 CSV
   */
  exportTemplateCSV() {
    // 模板表头用英文（与导出数据格式一致，可直接导入）
    const headers = ['name', 'team', 'position', 'number', 'height', 'weight', 'phone'];
    const sampleRows = [
      '张三,广州华南虎,PG,23,185,80',
      '李四,广州华南虎,SG,8,180,75',
      '王五,深圳队,C,55,195,90'
    ];

    const csvContent = [headers.join(','), ...sampleRows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hoopstats_players_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    Toast.show('模板已下载', 'success');
  },

  /**
   * 转义 CSV 字段值
   */
  escapeCSVValue(value) {
    if (!value) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
};

// 导出
window.PlayerManager = PlayerManager;
