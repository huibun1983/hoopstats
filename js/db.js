/**
 * HoopStats - 数据存储模块
 * 使用 localStorage 实现本地数据持久化
 */

const DB = {
  // 数据键前缀
  PREFIX: 'hoopstats_',

  // 存储键
  KEYS: {
    TEAMS: 'teams',
    PLAYERS: 'players',
    GAMES: 'games',
    SETTINGS: 'settings'
  },

  /**
   * 获取数据
   */
  get(key) {
    try {
      const data = localStorage.getItem(this.PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`[DB] Error getting ${key}:`, e);
      return null;
    }
  },

  /**
   * 设置数据
   */
  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[DB] Error setting ${key}:`, e);
      return false;
    }
  },

  /**
   * 删除数据
   */
  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
      return true;
    } catch (e) {
      console.error(`[DB] Error removing ${key}:`, e);
      return false;
    }
  },

  /**
   * 生成唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * 获取球队列表
   */
  getTeams() {
    return this.get(this.KEYS.TEAMS) || [];
  },

  /**
   * 保存球队列表
   */
  saveTeams(teams) {
    return this.set(this.KEYS.TEAMS, teams);
  },

  /**
   * 添加球队
   */
  addTeam(team) {
    const teams = this.getTeams();
    team.id = this.generateId();
    team.createdAt = new Date().toISOString();
    team.updatedAt = team.createdAt;
    teams.push(team);
    return this.saveTeams(teams) ? team : null;
  },

  /**
   * 更新球队
   */
  updateTeam(id, updates) {
    const teams = this.getTeams();
    const index = teams.findIndex(t => t.id === id);
    if (index !== -1) {
      teams[index] = { ...teams[index], ...updates, updatedAt: new Date().toISOString() };
      return this.saveTeams(teams) ? teams[index] : null;
    }
    return null;
  },

  /**
   * 删除球队
   */
  deleteTeam(id) {
    const teams = this.getTeams();
    const filtered = teams.filter(t => t.id !== id);
    return this.saveTeams(filtered);
  },

  /**
   * 获取球员列表
   */
  getPlayers() {
    return this.get(this.KEYS.PLAYERS) || [];
  },

  /**
   * 保存球员列表
   */
  savePlayers(players) {
    return this.set(this.KEYS.PLAYERS, players);
  },

  /**
   * 添加球员
   */
  addPlayer(player) {
    const players = this.getPlayers();
    player.id = this.generateId();
    player.createdAt = new Date().toISOString();
    player.updatedAt = player.createdAt;
    players.push(player);
    return this.savePlayers(players) ? player : null;
  },

  /**
   * 更新球员
   */
  updatePlayer(id, updates) {
    const players = this.getPlayers();
    const index = players.findIndex(p => p.id === id);
    if (index !== -1) {
      players[index] = { ...players[index], ...updates, updatedAt: new Date().toISOString() };
      return this.savePlayers(players) ? players[index] : null;
    }
    return null;
  },

  /**
   * 删除球员
   */
  deletePlayer(id) {
    const players = this.getPlayers();
    const filtered = players.filter(p => p.id !== id);
    return this.savePlayers(filtered);
  },

  /**
   * 获取某球队的球员
   */
  getPlayersByTeam(teamId) {
    const players = this.getPlayers();
    return players.filter(p => p.teamId === teamId);
  },

  /**
   * 获取比赛列表
   */
  getGames() {
    return this.get(this.KEYS.GAMES) || [];
  },

  /**
   * 保存比赛列表
   */
  saveGames(games) {
    return this.set(this.KEYS.GAMES, games);
  },

  /**
   * 添加比赛
   */
  addGame(game) {
    const games = this.getGames();
    game.id = this.generateId();
    game.createdAt = new Date().toISOString();
    game.updatedAt = game.createdAt;
    games.push(game);
    return this.saveGames(games) ? game : null;
  },

  /**
   * 更新比赛
   */
  updateGame(id, updates) {
    const games = this.getGames();
    const index = games.findIndex(g => g.id === id);
    if (index !== -1) {
      games[index] = { ...games[index], ...updates, updatedAt: new Date().toISOString() };
      return this.saveGames(games) ? games[index] : null;
    }
    return null;
  },

  /**
   * 删除比赛
   */
  deleteGame(id) {
    const games = this.getGames();
    const filtered = games.filter(g => g.id !== id);
    return this.saveGames(filtered);
  },

  /**
   * 清空所有数据（用于测试）
   */
  clearAll() {
    Object.values(this.KEYS).forEach(key => this.remove(key));
  }
};

// 导出
window.DB = DB;
