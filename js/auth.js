/**
 * HoopStats - 用户认证模块
 * Phase 2: 注册/登录/用户状态管理
 * API: hoopstats-api.huibun.workers.dev (Cloudflare Workers + D1)
 */

const Auth = {
  // API配置
  API_BASE: 'https://api.statstalking.com',
  TOKEN_KEY: 'hoopstats_auth_token',
  USER_KEY: 'hoopstats_user',
  ANON_KEY: 'hoopstats_anonymous_id',

  /**
   * 初始化 —— 检查登录状态
   */
  init() {
    this.updateNavDisplay();
  },

  /**
   * 获取当前用户（已登录返回用户对象，否则返回null）
   */
  getUser() {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  /**
   * 获取JWT token
   */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * 是否已登录
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * 获取匿名ID（离线/未登录用户标识）
   */
  getAnonymousId() {
    let id = localStorage.getItem(this.ANON_KEY);
    if (!id) {
      id = 'anon_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(this.ANON_KEY, id);
    }
    return id;
  },

  /**
   * 保存登录态
   */
  saveSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  /**
   * 清除登录态（但不影响本地数据）
   */
  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  /**
   * 注册
   */
  async register(email, password, name) {
    try {
      const res = await fetch(`${this.API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注册失败');

      this.saveSession(data.token, data.user);
      this.updateNavDisplay();
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * 登录
   */
  async login(email, password) {
    try {
      const res = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');

      this.saveSession(data.token, data.user);
      this.updateNavDisplay();
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * 登出
   */
  logout() {
    if (confirm('确定要退出登录吗？本地数据不会丢失。')) {
      this.clearSession();
      this.updateNavDisplay();
    }
  },

  /**
   * 同步本地数据到云端（已登录时触发）
   */
  async syncToCloud() {
    if (!this.isLoggedIn()) return { synced: 0 };
    const token = this.getToken();
    let synced = 0;

    const syncEntity = async (key, endpoint) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          const res = await fetch(`${this.API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data, source: 'local' })
          });
          if (res.ok) synced++;
        }
      } catch (e) {
        console.warn(`[Auth] Sync ${key} failed:`, e);
      }
    };

    await Promise.all([
      syncEntity('hoopstats_teams', '/data/teams'),
      syncEntity('hoopstats_players', '/data/players'),
      syncEntity('hoopstats_games', '/data/games')
    ]);

    return { synced };
  },

  /**
   * 更新导航栏显示（登录/未登录状态）
   */
  updateNavDisplay() {
    const user = this.getUser();
    const loggedIn = !!user;

    // 更新顶部导航用户区域
    const navUserArea = document.getElementById('nav-user-area');
    if (navUserArea) {
      if (loggedIn) {
        navUserArea.innerHTML = `
          <span class="nav-user-badge" onclick="Auth.logout()" title="${user.email}">
            <span class="nav-user-avatar">${(user.name || user.email)[0].toUpperCase()}</span>
            <span class="nav-user-name desk-only">${user.name || user.email}</span>
          </span>
        `;
      } else {
        navUserArea.innerHTML = `
          <button class="btn btn-sm btn-outline" onclick="Auth.showModal('login')">登录</button>
          <button class="btn btn-sm btn-primary" onclick="Auth.showModal('register')">注册</button>
        `;
      }
    }

    // 更新底部导航用户区域（移动端）
    const bottomUserArea = document.getElementById('bottom-nav-user-area');
    if (bottomUserArea) {
      if (loggedIn) {
        bottomUserArea.innerHTML = `
          <a class="nav-link" onclick="Auth.logout()">
            <span class="nav-icon">👤</span>
            <span class="nav-text">退出</span>
          </a>
        `;
      } else {
        bottomUserArea.innerHTML = `
          <a class="nav-link" onclick="Auth.showModal('login')">
            <span class="nav-icon">🔑</span>
            <span class="nav-text">登录</span>
          </a>
        `;
      }
    }
  },

  /**
   * 显示登录/注册模态框
   */
  showModal(mode) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const title = document.getElementById('auth-modal-title');
    const form = document.getElementById('auth-form');
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchBtn = document.getElementById('auth-switch-btn');
    const nameGroup = document.getElementById('auth-name-group');

    if (title) title.textContent = mode === 'login' ? '🔑 登录' : '📝 注册';
    if (submitBtn) submitBtn.textContent = mode === 'login' ? '登录' : '注册';
    if (errorEl) errorEl.style.display = 'none';
    if (nameGroup) nameGroup.style.display = mode === 'register' ? '' : 'none';

    // 切换按钮
    if (switchBtn) {
      switchBtn.textContent = mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录';
      switchBtn.onclick = () => {
        const newMode = mode === 'login' ? 'register' : 'login';
        this.showModal(newMode);
      };
    }

    // 表单提交
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name')?.value.trim() || email.split('@')[0];

        if (!email || !password) {
          this.showError('请填写所有必填字段');
          return;
        }
        if (password.length < 6) {
          this.showError('密码至少6位');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '处理中...';

        const result = mode === 'login'
          ? await this.login(email, password)
          : await this.register(email, password, name);

        if (result.success) {
          modal.classList.remove('active');
          // 尝试同步本地数据到云端
          this.syncToCloud();
        } else {
          this.showError(result.error);
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'login' ? '登录' : '注册';
        }
      };
    }

    modal.classList.add('active');
  },

  /**
   * 显示错误消息
   */
  showError(msg) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  },

  /**
   * 关闭认证模态框
   */
  closeModal() {
    document.getElementById('auth-modal')?.classList.remove('active');
  }
};

window.Auth = Auth;
