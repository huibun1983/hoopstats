# HoopStats 部署指南

## ✅ 已完成：GitHub 推送

- **仓库地址**：https://github.com/huibun1983/hoopstats
- **分支**：main
- **提交数**：2（初始 MVP + wrangler.toml 配置）
- **状态**：代码已成功推送

---

## 🔄 待完成：Cloudflare Pages 部署

### 方式一：GitHub 集成（推荐，自动部署）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单 → **Workers & Pages** → **Create** → **Pages** 选项卡
3. 选择 **Connect to Git**
4. 授权 Cloudflare 访问你的 GitHub（如已授权可跳过）
5. 选择仓库 **huibun1983/hoopstats**
6. 配置构建设置：
   - **Project name**：`hoopstats-pages`
   - **Production branch**：`main`
   - **Build command**：留空（纯静态站无需构建）
   - **Build output directory**：`.`（根目录，即 `/`）
   - **Framework preset**：None
7. 点击 **Save and Deploy**
8. 等待部署完成（通常 < 1 分钟）
9. 部署成功后，Cloudflare 会分配一个 `*.pages.dev` 域名

### 方式二：Wrangler CLI 直接部署

```bash
# 1. 登录 Cloudflare
npx wrangler login

# 2. 直接部署
cd /Users/huibun/WorkBuddy/20260414210912/projects/hoopstats
npx wrangler pages deploy . --project-name=hoopstats-pages
```

---

## 后续：自定义域名（可选）

部署成功后，可在 Cloudflare Pages 设置中添加自定义域名：
- Pages 项目 → Custom domains → Add domain
- 如域名已托管在 Cloudflare DNS，会自动配置 CNAME

---

## 自动部署机制

使用方式一（GitHub 集成）后，每次 `git push` 到 `main` 分支，Cloudflare 会自动触发重新部署。
