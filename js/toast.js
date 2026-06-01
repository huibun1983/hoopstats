/**
 * HoopStats - 公共 Toast 通知模块
 * 消除 teams/players/games 中的重复 showToast 定义
 */

const Toast = {
  /**
   * 显示 Toast 通知
   * @param {string} message - 通知内容
   * @param {string} type - 类型: 'success' | 'error' | 'info' | 'warning'
   */
  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `
      <span>${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  info(msg)    { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// 导出
window.Toast = Toast;
