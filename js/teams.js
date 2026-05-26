/**
 * HoopStats - 球队管理模块
 */

const TeamManager = {
  // 球队颜色选项
  COLORS: [
    { name: '红队', value: '#FF4757', icon: '🔴' },
    { name: '蓝队', value: '#4895EF', icon: '🔵' },
    { name: '绿队', value: '#00D4AA', icon: '🟢' },
    { name: '黄队', value: '#FFB800', icon: '🟡' },
    { name: '紫队', value: '#A855F7', icon: '🟣' },
    { name: '橙队', value: '#FF6B35', icon: '🟠' },
    { name: '白队', value: '#FFFFFF', icon: '⚪' },
    { name: '黑队', value: '#1A1A2E', icon: '⚫' }
  ],

  /**
   * 渲染球队列表
   */
  render() {
    const teams = DB.getTeams();
    const container = document.getElementById('team-list');

    if (!container) return;

    if (teams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏀</div>
          <div class="empty-title">暂无球队</div>
          <div class="empty-desc">创建你的第一支球队，开始篮球之旅</div>
          <button class="btn btn-primary" onclick="TeamManager.showCreateModal()">
            <span>➕</span> 创建球队
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = teams.map(team => `
      <div class="card" data-team-id="${team.id}">
        <div class="card-header">
          <div class="flex items-center gap-md">
            <span style="font-size:2rem;">${team.icon || '🏀'}</span>
            <div>
              <div class="card-title">${team.name}</div>
              <div class="text-secondary" style="font-size:0.85rem;">
                ${DB.getPlayersByTeam(team.id).length} 名球员 · ${team.city || '未设置城市'}
              </div>
            </div>
          </div>
          <div class="flex gap-sm">
            <button class="btn btn-ghost btn-icon" onclick="TeamManager.showEditModal('${team.id}')" title="编辑">
              ✏️
            </button>
            <button class="btn btn-ghost btn-icon" onclick="TeamManager.deleteTeam('${team.id}')" title="删除">
              🗑️
            </button>
          </div>
        </div>
        <div class="mt-md">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span class="badge">📍 ${team.city || '未设置'}</span>
            <span class="badge">👥 ${team.memberCount || 0} 人</span>
            <span class="badge badge-info">胜 ${team.wins || 0}</span>
            <span class="badge badge-danger">负 ${team.losses || 0}</span>
          </div>
        </div>
      </div>
    `).join('');
  },

  /**
   * 显示创建模态框
   */
  showCreateModal() {
    const modal = document.getElementById('team-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('team-form');

    title.textContent = '创建球队';
    form.reset();
    form.dataset.teamId = '';

    // 渲染颜色选项
    const colorSelect = document.getElementById('team-color');
    if (colorSelect) {
      colorSelect.innerHTML = this.COLORS.map(c =>
        `<option value="${c.value}" data-icon="${c.icon}">${c.icon} ${c.name}</option>`
      ).join('');
    }

    modal.classList.add('active');
  },

  /**
   * 显示编辑模态框
   */
  showEditModal(id) {
    const team = DB.getTeams().find(t => t.id === id);
    if (!team) return;

    const modal = document.getElementById('team-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('team-form');

    title.textContent = '编辑球队';
    form.dataset.teamId = id;

    // 填充表单
    document.getElementById('team-name').value = team.name || '';
    document.getElementById('team-city').value = team.city || '';
    document.getElementById('team-color').value = team.color || this.COLORS[0].value;
    document.getElementById('team-founded').value = team.founded || '';
    document.getElementById('team-description').value = team.description || '';

    modal.classList.add('active');
  },

  /**
   * 保存球队
   */
  saveTeam(e) {
    e.preventDefault();
    const form = document.getElementById('team-form');
    const teamId = form.dataset.teamId;

    const teamData = {
      name: document.getElementById('team-name').value.trim(),
      city: document.getElementById('team-city').value.trim(),
      color: document.getElementById('team-color').value,
      founded: document.getElementById('team-founded').value,
      description: document.getElementById('team-description').value.trim()
    };

    // 获取颜色名称和图标
    const selectedColor = this.COLORS.find(c => c.value === teamData.color);
    teamData.icon = selectedColor ? selectedColor.icon : '🏀';
    teamData.colorName = selectedColor ? selectedColor.name : '默认';

    if (!teamData.name) {
      this.showToast('请输入球队名称', 'error');
      return;
    }

    if (teamId) {
      // 更新
      const updated = DB.updateTeam(teamId, teamData);
      if (updated) {
        this.showToast('球队更新成功', 'success');
      }
    } else {
      // 创建
      const created = DB.addTeam(teamData);
      if (created) {
        this.showToast('球队创建成功', 'success');
      }
    }

    this.closeModal();
    this.render();
  },

  /**
   * 删除球队
   */
  deleteTeam(id) {
    if (!confirm('确定要删除这支球队吗？球队下的球员也会被删除。')) return;

    // 删除球队下的球员
    const players = DB.getPlayersByTeam(id);
    players.forEach(p => DB.deletePlayer(p.id));

    // 删除球队
    if (DB.deleteTeam(id)) {
      this.showToast('球队已删除', 'success');
      this.render();
    }
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('team-modal').classList.remove('active');
  },

  /**
   * 显示 Toast 通知
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  /**
   * 创建 Toast 容器
   */
  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }
};

// 导出
window.TeamManager = TeamManager;
