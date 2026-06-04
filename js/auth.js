/**
 * HoopStats - 用户认证模块
 * Phase 2: 匿名即用 + 可选云同步
 * - 默认无需登录即可使用全部功能（数据存 localStorage）
 * - 顶部「☁ 同步」按钮触发注册/登录弹窗
 * - 登录成功后自动上传本地数据到云端 D1
 * API: api.statstalking.com (Cloudflare Workers + D1)
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
   * 更新导航栏显示（匿名/已登录状态）
   * 默认匿名模式：显示「☁ 同步」按钮
   * 已登录模式：显示用户头像 + 账号名
   */
  updateNavDisplay() {
    const user = this.getUser();
    const loggedIn = !!user;

    // 更新顶部导航用户区域
    const navUserArea = document.getElementById('nav-user-area');
    if (navUserArea) {
      if (loggedIn) {
        navUserArea.innerHTML = `
          <span class="nav-user-badge" title="${user.email}">
            <span class="nav-user-avatar">${(user.name || user.email)[0].toUpperCase()}</span>
            <span class="nav-user-name desk-only">${user.name || user.email}</span>
          </span>
          <button class="btn btn-sm btn-ghost" onclick="Auth.logout()" title="退出登录">退出</button>
        `;
      } else {
        navUserArea.innerHTML = `
          <button class="btn btn-sm btn-sync" onclick="Auth.showSyncModal()" title="同步数据到云端，可跨设备使用">
            <span class="sync-icon">☁</span>
            <span class="desk-only">同步数据</span>
          </button>
        `;
      }
    }

    // 更新底部导航用户区域（移动端）
    const bottomUserArea = document.getElementById('bottom-nav-user-area');
    if (bottomUserArea) {
      if (loggedIn) {
        bottomUserArea.innerHTML = `
          <a class="nav-link" onclick="Auth.logout()">
            <span class="nav-user-avatar nav-icon">${(user.name || user.email)[0].toUpperCase()}</span>
            <span class="nav-text">账号</span>
          </a>
        `;
      } else {
        bottomUserArea.innerHTML = `
          <a class="nav-link" onclick="Auth.showSyncModal()">
            <span class="nav-icon">☁</span>
            <span class="nav-text">同步</span>
          </a>
        `;
      }
    }
  },

  /**
   * 显示云同步弹窗（匿名用户触发登录/注册）
   * 说明为何需要账号：跨设备同步
   */
  showSyncModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    // 在 modal 顶部插入同步说明横幅
    const banner = document.getElementById('auth-sync-banner');
    if (banner) {
      banner.style.display = 'block';
    }

    this.showModal('login');
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

    if (title) title.textContent = mode === 'login' ? '☁ 登录以同步数据' : '☁ 注册并同步数据';
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
          const syncResult = await this.syncToCloud();
          if (window.Toast) {
            Toast.show(
              syncResult.synced > 0
                ? `✅ 登录成功，本地数据已同步到云端`
                : `✅ 登录成功，数据将自动云端备份`,
              'success'
            );
          }
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
