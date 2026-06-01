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
    return post;
  },

  /** 更新帖子 */
  updatePost(id, updates) {
    const posts = this.getPosts();
    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) {
      posts[idx] = { ...posts[idx], ...updates, updatedAt: new Date().toISOString() };
      this.savePosts(posts);
      return posts[idx];
    }
    return null;
  },

  /** 删除帖子 */
  deletePost(id) {
    const posts = this.getPosts();
    this.savePosts(posts.filter(p => p.id !== id));
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

    if (posts.length === 0) {
      container.innerHTML = `
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

    container.innerHTML = posts.map(post => {
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
  }
};

window.BlogManager = BlogManager;
