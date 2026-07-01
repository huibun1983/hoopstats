/**
 * HoopStats - 个人博客模块
 * 篮球心得/战报/技巧分享，支持点赞和评论
 */

const BlogManager = {
  CATEGORIES: [
    { value: '心得', label: '🏀 篮球心得' },
    { value: '战报', label: '📋 赛事战报' },
    { value: '技巧', label: '💡 技术分享' },
    { value: '其他', label: '📝 其他' }
  ],

  /** 获取所有帖子 */
  getPosts() {
    const raw = localStorage.getItem('hoopstats_posts');
    return raw ? JSON.parse(raw) : [];
  },

  /** 保存帖子 */
  savePosts(posts) {
    localStorage.setItem('hoopstats_posts', JSON.stringify(posts));
  },

  /** 添加帖子 */
  addPost(post) {
    const posts = this.getPosts();
    post.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    post.likes = 0;
    post.likedBy = [];
    post.comments = [];
    post.createdAt = new Date().toISOString();
    post.updatedAt = post.createdAt;
    posts.unshift(post);
    this.savePosts(posts);
    this.syncToCloud();
    return post;
  },

  /** 更新帖子 */
  updatePost(id, updates) {
    const posts = this.getPosts();
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) {
      posts[idx] = { ...posts[idx], ...updates, updatedAt: new Date().toISOString() };
      this.savePosts(posts);
      this.syncToCloud();
      return posts[idx];
    }
    return null;
  },

  /** 删除帖子 */
  deletePost(id) {
    const posts = this.getPosts();
    this.savePosts(posts.filter(p => p.id !== id));
    this.syncToCloud();
  },

  /** 点赞/取消点赞 */
  toggleLike(postId) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    const userId = typeof Auth !== 'undefined' && Auth.getUser() ? Auth.getUser().id : 'anon_' + Date.now();
    const idx = (post.likedBy || []).indexOf(userId);

    if (idx === -1) {
      post.likedBy.push(userId);
      post.likes = (post.likes || 0) + 1;
    } else {
      post.likedBy.splice(idx, 1);
      post.likes = Math.max(0, (post.likes || 0) - 1);
    }
    this.savePosts(posts);
    this.syncToCloud();
    return post;
  },

  /** 添加评论 */
  addComment(postId, content) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    const user = typeof Auth !== 'undefined' && Auth.getUser() ? Auth.getUser() : null;
    const comment = {
      id: Date.now().toString(36),
      authorId: user ? user.id : 'anon',
      authorName: user ? (user.nickname || user.email || '匿名') : '匿名用户',
      content: content,
      createdAt: new Date().toISOString()
    };
    post.comments.push(comment);
    this.savePosts(posts);
    this.syncToCloud();
    return comment;
  },

  /** 格式化时间 */
  formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  /** 渲染博客列表 */
  render() {
    const posts = this.getPosts();
    const container = document.getElementById('blog-list');

    if (!container) return;

    // S4: 渲染未分享比赛战报入口
    const reportBannerHtml = this._buildGameReportBanner();

    if (posts.length === 0) {
      container.innerHTML = `
        ${reportBannerHtml}
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-title">暂无博文</div>
          <div class="empty-desc">分享你的篮球心得、赛事战报或技术技巧</div>
          <button class="btn btn-primary" onclick="BlogManager.showCreateModal()">
            <span>✍️</span> 写文章
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = reportBannerHtml + posts.map(post => {
      const category = this.CATEGORIES.find(c => c.value === post.category);
      return `
        <div class="card blog-card" onclick="BlogManager.showDetail('${post.id}')">
          <div class="blog-card-header">
            <div class="blog-card-meta">
              ${category ? `<span class="badge badge-info">${category.label}</span>` : ''}
              <span class="text-dim" style="font-size:0.8rem;">${this.formatTime(post.createdAt)}</span>
            </div>
          </div>
          <h3 class="blog-card-title">${this._escape(post.title)}</h3>
          <p class="blog-card-excerpt">${this._truncate(post.content, 120)}</p>
          <div class="blog-card-footer">
            <div class="blog-card-author">
              <span style="font-size:0.85rem;">👤 ${this._escape(post.authorName || '匿名')}</span>
            </div>
            <div class="blog-card-stats">
              <span class="blog-stat">❤️ ${post.likes || 0}</span>
              <span class="blog-stat">💬 ${post.comments ? post.comments.length : 0}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * 构建最近已完赛比赛的快速分享战报横幅 HTML
   * @returns {string} HTML 字符串
   */
  _buildGameReportBanner() {
    if (typeof DB === 'undefined') return '';
    const allGames = DB.getGames ? DB.getGames() : [];
    const endedGames = allGames
      .filter(g => g.status === 'ended')
      .slice(0, 3);  // 最近3场
    if (endedGames.length === 0) return '';

    const teams = DB.getTeams ? DB.getTeams() : [];

    const itemsHtml = endedGames.map(game => {
      const homeTeam = teams.find(t => t.id === game.homeTeamId);
      const awayTeam = teams.find(t => t.id === game.awayTeamId);
      const homeName = homeTeam?.name || '主队';
      const awayName = awayTeam?.name || '客队';
      const label = `${homeName} ${game.homeScore || 0} - ${game.awayScore || 0} ${awayName}`;
      return `
        <div class="report-game-item" onclick="BlogManager.shareGameReport('${game.id}')">
          <span>${label}</span>
          <span class="badge badge-success">已结束</span>
          <button class="btn btn-xs btn-outline" onclick="event.stopPropagation();BlogManager.shareGameReport('${game.id}')">✍️ 发布战报</button>
        </div>`;
    }).join('');

    return `
      <div class="game-report-banner" id="game-report-banner">
        <div class="report-banner-title">📢 你有未分享的比赛战报</div>
        <div class="report-game-list">${itemsHtml}</div>
      </div>`;
  },

  /**
   * 打开写文章弹窗并预填写战报内容
   * @param {string} gameId 比赛 ID
   */
  shareGameReport(gameId) {
    if (typeof DB === 'undefined') return;
    const game = (DB.getGames ? DB.getGames() : []).find(g => g.id === gameId);
    if (!game) return;

    const teams = DB.getTeams ? DB.getTeams() : [];
    const homeTeam = teams.find(t => t.id === game.homeTeamId);
    const awayTeam = teams.find(t => t.id === game.awayTeamId);
    const homeName = homeTeam?.name || '主队';
    const awayName = awayTeam?.name || '客队';
    const homeScore = game.homeScore || 0;
    const awayScore = game.awayScore || 0;

    // 简化版投篮数据计算
    const events = game.events || [];
    const homePids = new Set((game.homePlayers || []).map(p => p.id));
    const awayPids = new Set((game.awayPlayers || []).map(p => p.id));
    let homeFgm = 0, homeFga = 0, awayFgm = 0, awayFga = 0;
    const playerPts = {};
    events.forEach(ev => {
      const pid = ev.playerId;
      if (!pid) return;
      const isHome = homePids.has(pid);
      const isAway = awayPids.has(pid);
      if (ev.action === '2分命中') {
        if (isHome) { homeFgm++; homeFga++; } else if (isAway) { awayFgm++; awayFga++; }
        playerPts[pid] = (playerPts[pid] || 0) + 2;
      } else if (ev.action === '3分命中') {
        if (isHome) { homeFgm++; homeFga++; } else if (isAway) { awayFgm++; awayFga++; }
        playerPts[pid] = (playerPts[pid] || 0) + 3;
      } else if (ev.action === '罚球命中') {
        playerPts[pid] = (playerPts[pid] || 0) + 1;
      } else if (ev.action === '2分不中') {
        if (isHome) { homeFga++; } else if (isAway) { awayFga++; }
      } else if (ev.action === '3分不中') {
        if (isHome) { homeFga++; } else if (isAway) { awayFga++; }
      }
    });

    const homeFgPct = homeFga > 0 ? (homeFgm / homeFga * 100).toFixed(1) : '0.0';
    const awayFgPct = awayFga > 0 ? (awayFgm / awayFga * 100).toFixed(1) : '0.0';

    // 找出首席得分球员
    const allPlayers = [...(game.homePlayers || []), ...(game.awayPlayers || [])];
    let topPlayer = null, topPts = 0;
    allPlayers.forEach(p => {
      if ((playerPts[p.id] || 0) > topPts) {
        topPts = playerPts[p.id];
        topPlayer = p;
      }
    });

    const dateStr = new Date(game.date).toLocaleDateString('zh-CN');
    const title = `${homeName} ${homeScore}-${awayScore} ${awayName} 赛后复盘`;
    const content = [
      `📅 比赛日期：${dateStr}`,
      `🏆 最终比分：${homeName} ${homeScore} - ${awayScore} ${awayName}`,
      '',
      `📊 投篮数据`,
      `• ${homeName}：FG ${homeFgm}/${homeFga}（${homeFgPct}%）`,
      `• ${awayName}：FG ${awayFgm}/${awayFga}（${awayFgPct}%）`,
      '',
      topPlayer ? `⭐ 首席得分：${topPlayer.name} ${topPts} 分` : '',
      '',
      `✍️ 赛后感想：`,
      `（在这里写下你的比赛感想...）`
    ].filter(Boolean).join('\n');

    // 打开创建弹窗并预填内容
    this.showCreateModal();
    setTimeout(() => {
      const titleEl = document.getElementById('blog-title');
      const contentEl = document.getElementById('blog-content');
      const catEl = document.getElementById('blog-category');
      if (titleEl) titleEl.value = title;
      if (contentEl) contentEl.value = content;
      if (catEl) {
        // 设置为「赛事战报」分类
        for (let i = 0; i < catEl.options.length; i++) {
          if (catEl.options[i].value === '战报') {
            catEl.selectedIndex = i;
            break;
          }
        }
      }
    }, 50);
  },

  /** 渲染帖子详情（模态框） */
  showDetail(postId) {
    const posts = this.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const body = document.getElementById('blog-detail-body');
    const category = this.CATEGORIES.find(c => c.value === post.category);

    body.innerHTML = `
      <div class="blog-detail-header">
        <h2 class="blog-detail-title">${this._escape(post.title)}</h2>
        <div class="blog-detail-meta">
          <span class="badge badge-info">${category ? category.label : '📝 其他'}</span>
          <span>👤 ${this._escape(post.authorName || '匿名')}</span>
          <span class="text-dim">${this.formatTime(post.createdAt)}</span>
        </div>
      </div>
      <div class="blog-detail-content">${this._renderContent(post.content)}</div>
      <div class="blog-detail-actions">
        <button class="btn btn-ghost btn-sm" onclick="BlogManager.toggleLikeDetail('${post.id}')">
          ❤️ <span id="blog-like-count-${post.id}">${post.likes || 0}</span> 赞
        </button>
        <button class="btn btn-ghost btn-sm ${post.authorId === this._getCurrentUserId() ? '' : 'hidden'}"
                onclick="BlogManager.deletePostConfirm('${post.id}')">
          🗑️ 删除
        </button>
      </div>

      <div class="blog-comments-section">
        <h4 class="blog-comments-title">💬 评论 (${post.comments ? post.comments.length : 0})</h4>
        <div class="blog-comments-list">
          ${post.comments && post.comments.length > 0 ? post.comments.map(c => `
            <div class="blog-comment">
              <div class="blog-comment-header">
                <span class="blog-comment-author">${this._escape(c.authorName)}</span>
                <span class="text-dim" style="font-size:0.75rem;">${this.formatTime(c.createdAt)}</span>
              </div>
              <div class="blog-comment-body">${this._escape(c.content)}</div>
            </div>
          `).join('') : '<div class="text-dim" style="text-align:center;padding:var(--space-lg);">暂无评论</div>'}
        </div>
        <div class="blog-comment-form">
          <textarea id="blog-comment-input" class="form-input" rows="2" placeholder="写下你的评论..."></textarea>
          <button class="btn btn-primary btn-sm" onclick="BlogManager.submitComment('${post.id}')">发表评论</button>
        </div>
      </div>
    `;

    document.getElementById('blog-detail-modal').classList.add('active');
  },

  closeDetail() {
    document.getElementById('blog-detail-modal').classList.remove('active');
  },

  /** 详情页点赞 */
  toggleLikeDetail(postId) {
    const post = this.toggleLike(postId);
    if (post) {
      const el = document.getElementById('blog-like-count-' + postId);
      if (el) el.textContent = post.likes;
    }
  },

  /** 提交评论 */
  submitComment(postId) {
    const input = document.getElementById('blog-comment-input');
    const content = input.value.trim();
    if (!content) {
      Toast.show('请输入评论内容', 'error');
      return;
    }
    this.addComment(postId, content);
    input.value = '';
    this.showDetail(postId); // 刷新详情
    Toast.show('评论已发表', 'success');
  },

  /** 确认删除 */
  deletePostConfirm(postId) {
    if (!confirm('确定要删除这篇文章吗？')) return;
    this.deletePost(postId);
    this.closeDetail();
    this.render();
    Toast.show('文章已删除', 'success');
  },

  /** 显示创建模态框 */
  showCreateModal() {
    const form = document.getElementById('blog-form');
    form.reset();
    form.dataset.postId = '';

    // 预设当前用户
    const user = typeof Auth !== 'undefined' && Auth.getUser() ? Auth.getUser() : null;
    document.getElementById('blog-author').value = user ? (user.nickname || user.email || '') : '';

    // 渲染分类
    const catSelect = document.getElementById('blog-category');
    catSelect.innerHTML = this.CATEGORIES.map(c =>
      `<option value="${c.value}">${c.label}</option>`
    ).join('');

    document.getElementById('blog-create-modal').classList.add('active');
  },

  closeCreateModal() {
    document.getElementById('blog-create-modal').classList.remove('active');
  },

  /** 保存帖子 */
  savePost(e) {
    e.preventDefault();
    const form = document.getElementById('blog-form');

    const title = document.getElementById('blog-title').value.trim();
    const content = document.getElementById('blog-content').value.trim();
    const category = document.getElementById('blog-category').value;
    let authorName = document.getElementById('blog-author').value.trim();

    if (!title) { Toast.show('请输入标题', 'error'); return; }
    if (!content) { Toast.show('请输入内容', 'error'); return; }
    if (!authorName) authorName = '匿名用户';

    const user = typeof Auth !== 'undefined' && Auth.getUser() ? Auth.getUser() : null;
    const postData = {
      title, content, category,
      authorId: user ? user.id : null,
      authorName
    };

    const created = this.addPost(postData);
    if (created) {
      Toast.show('文章发表成功', 'success');
    }
    this.closeCreateModal();
    this.render();
  },

  /** HTML 转义 */
  _escape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /** 截断文本 */
  _truncate(text, maxLen) {
    if (!text) return '';
    const plain = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
    return plain.length > maxLen ? plain.substring(0, maxLen) + '...' : plain;
  },

  /** 渲染内容（简单换行处理） */
  _renderContent(content) {
    if (!content) return '';
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${this._escape(line)}</p>`)
      .join('');
  },

  /** 获取当前用户ID */
  _getCurrentUserId() {
    if (typeof Auth !== 'undefined' && Auth.getUser()) {
      return Auth.getUser().id;
    }
    return null;
  },

  // ========== 云端同步 ==========

  /** API 基地址 */
  _getApiBase() {
    return typeof Auth !== 'undefined' ? Auth.API_BASE : 'https://api.statstalking.com';
  },

  /** 获取当前 JWT Token */
  _getToken() {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      return Auth.getToken();
    }
    return null;
  },

  /** 同步博客数据到云端（静默） */
  async syncToCloud() {
    const token = this._getToken();
    if (!token) return; // 未登录，不同步

    try {
      const posts = this.getPosts();
      const res = await fetch(`${this._getApiBase()}/data/blogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ data: posts, source: 'local' })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) console.log('[BlogSync] ✅ 云端同步成功');
      }
    } catch (err) {
      console.log('[BlogSync] ⚠️ 同步失败（网络问题，数据仍在本地）:', err.message);
    }
  },

  /** 从云端拉取博客数据并合并 */
  async pullFromCloud() {
    const token = this._getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${this._getApiBase()}/data/blogs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const result = await res.json();
      if (!result.data) return null;

      const cloudPosts = result.data;
      const localPosts = this.getPosts();
      const localMap = {};
      localPosts.forEach(p => { localMap[p.id] = p; });

      // 合并策略：云端数据覆盖本地（云端版本更新）
      let merged = [...cloudPosts];
      // 添加云端没有但本地有的帖子
      cloudPosts.forEach(cp => {
        if (localMap[cp.id]) {
          const localTime = new Date(localMap[cp.id].updatedAt || localMap[cp.id].createdAt).getTime();
          const cloudTime = new Date(cp.updatedAt || cp.createdAt).getTime();
          // 如果本地版本更新，保留本地版本
          if (localTime > cloudTime) {
            const idx = merged.findIndex(p => p.id === cp.id);
            if (idx !== -1) merged[idx] = localMap[cp.id];
          }
        }
      });
      localPosts.forEach(lp => {
        if (!merged.find(p => p.id === lp.id)) merged.push(lp);
      });

      this.savePosts(merged);
      console.log('[BlogSync] 📥 云端拉取成功，共', merged.length, '条');
      return merged;
    } catch (err) {
      console.log('[BlogSync] ⚠️ 拉取失败:', err.message);
      return null;
    }
  },

  /** 初始化：加载时自动从云端拉取 */
  async init() {
    const token = this._getToken();
    if (token) {
      await this.pullFromCloud();
    }
    this.render();
  }
};

window.BlogManager = BlogManager;
