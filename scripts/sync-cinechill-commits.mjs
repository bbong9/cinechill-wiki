#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_REPO = process.env.CINECHILL_REPO || 'Chill-lucky/CineChill';
const SOURCE_BRANCH = process.env.CINECHILL_BRANCH || '';
const SOURCE_TOKEN = process.env.CINECHILL_SOURCE_TOKEN || process.env.SOURCE_GITHUB_TOKEN || '';
const PAYLOAD_JSON = process.env.SYNC_PAYLOAD_JSON || '';
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const MAX_ENTRIES = Number(process.env.CINECHILL_SYNC_MAX_ENTRIES || 20);
const MAX_COMMITS_PER_ENTRY = Number(process.env.CINECHILL_SYNC_MAX_COMMITS_PER_ENTRY || 25);
const FALLBACK_FETCH_LIMIT = Number(process.env.CINECHILL_SYNC_FETCH_LIMIT || 12);

const STATE_FILE = 'cinechill/commit-feed.json';
const HOME_FILE = 'index.html';
const CHANGELOG_FILE = 'wiki/changelog.html';
const SEARCH_INDEX_FILE = 'cinechill/search-index.json';

const HOME_START = '<!-- AUTO_CINECHILL_COMMITS_HOME_START -->';
const HOME_END = '<!-- AUTO_CINECHILL_COMMITS_HOME_END -->';
const LOG_START = '<!-- AUTO_CINECHILL_COMMITS_LOG_START -->';
const LOG_END = '<!-- AUTO_CINECHILL_COMMITS_LOG_END -->';

const DISALLOWED_PUBLIC_PATTERN = new RegExp([
  'magnet:',
  'ed2k://',
  'torrent',
  'bt种子',
  '网盘',
  '提取码',
  '转存口令',
  'tg群',
  'telegram',
  '破解',
  '去drm',
  'drm[ -]?free',
  '资源站',
  '代理节点',
  '机场',
].join('|'), 'i');

const SECRET_PATTERN = new RegExp([
  'password',
  'passwd',
  'pwd=',
  'secret',
  'token',
  'cookie',
  'session',
  'private[ _-]?key',
  'api[ _-]?key',
  'access[ _-]?key',
  'refresh[ _-]?token',
  'authorization',
  'bearer\\s+',
  'ghp_[A-Za-z0-9_]+',
  'github_pat_[A-Za-z0-9_]+',
  'sk-[A-Za-z0-9_-]{16,}',
  'AKIA[0-9A-Z]{16}',
].join('|'), 'i');

function filePath(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(filePath(relativePath), 'utf8');
}

function writeText(relativePath, value) {
  if (DRY_RUN) return;
  fs.writeFileSync(filePath(relativePath), value);
}

function readJson(relativePath, fallback) {
  try {
    return JSON.parse(readText(relativePath));
  } catch {
    return fallback;
  }
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parsePayload() {
  if (!PAYLOAD_JSON || PAYLOAD_JSON === 'null') return null;
  try {
    const payload = JSON.parse(PAYLOAD_JSON);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (error) {
    console.warn(`WARN: SYNC_PAYLOAD_JSON is not valid JSON: ${error.message}`);
    return null;
  }
}

function stripRef(ref) {
  return String(ref || '').replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '');
}

function isAllZeroSha(value) {
  return /^0{7,40}$/.test(String(value || ''));
}

function shortSha(value) {
  return String(value || '').slice(0, 7);
}

function commitUrl(repo, sha) {
  return sha ? `https://github.com/${repo}/commit/${sha}` : `https://github.com/${repo}`;
}

function compareUrl(repo, before, after) {
  if (!before || !after || isAllZeroSha(before) || isAllZeroSha(after)) return '';
  return `https://github.com/${repo}/compare/${before}...${after}`;
}

function repoUrl(repo) {
  return `https://github.com/${repo}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, '`');
}

function stripHtml(value) {
  return decodeBasicEntities(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function formatDateTime(iso, options = {}) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function firstLine(message) {
  return String(message || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function classifyCommit(rawTitle) {
  const title = String(rawTitle || '').trim();
  const conventional = title.match(/^([a-z]+)(?:\([^)]+\))?(!)?:\s+/i);
  const type = conventional?.[1]?.toLowerCase() || '';
  if (['feat', 'feature'].includes(type)) return 'NEW';
  if (['fix', 'bugfix', 'hotfix'].includes(type)) return 'FIX';
  if (['docs', 'doc'].includes(type)) return 'DOC';
  if (['style', 'ui', 'ux'].includes(type)) return 'UI';
  if (['perf', 'performance'].includes(type)) return 'PERF';
  if (['refactor'].includes(type)) return 'REF';
  if (['test', 'tests'].includes(type)) return 'TEST';
  if (['ci', 'build', 'chore', 'ops', 'release'].includes(type)) return 'OPS';
  if (/修复|fix|bug|热修/i.test(title)) return 'FIX';
  if (/新增|增加|支持|feature/i.test(title)) return 'NEW';
  if (/文档|wiki|docs?/i.test(title)) return 'DOC';
  if (/样式|界面|布局|移动端|手机端|ui|ux/i.test(title)) return 'UI';
  return 'COM';
}

function removeConventionalPrefix(title) {
  return String(title || '').replace(/^[a-z]+(?:\([^)]+\))?(!)?:\s+/i, '').trim();
}

function sanitizeCommitTitle(message) {
  const raw = firstLine(message);
  if (!raw) return { title: '未填写提交说明', redacted: false };
  if (DISALLOWED_PUBLIC_PATTERN.test(raw)) {
    return { title: '提交说明包含不适合公开展示的内容，已脱敏处理', redacted: true };
  }
  if (SECRET_PATTERN.test(raw)) {
    return { title: '提交说明包含敏感配置或凭据线索，已脱敏处理', redacted: true };
  }
  const title = removeConventionalPrefix(raw).replace(/\s+/g, ' ').slice(0, 160);
  return { title: title || '未填写提交说明', redacted: false };
}

function normalizeCommit(commit, repo) {
  const sha = String(commit.id || commit.sha || commit.node_id || '').trim();
  const message = commit.message || commit.commit?.message || '';
  const { title, redacted } = sanitizeCommitTitle(message);
  const category = classifyCommit(firstLine(message));
  const author = commit.author?.name || commit.committer?.name || commit.commit?.author?.name || commit.author || '';
  const timestamp = commit.timestamp || commit.commit?.author?.date || commit.commit?.committer?.date || '';
  const url = commit.html_url || commit.url || commitUrl(repo, sha);
  return {
    sha,
    shortSha: shortSha(sha),
    title,
    category,
    author: String(author || '').slice(0, 80),
    timestamp,
    url,
    redacted,
  };
}

function normalizePayloadEntry(payload) {
  const repo = payload.source_repo || payload.repository?.full_name || SOURCE_REPO;
  const commits = Array.isArray(payload.commits) ? payload.commits.map((commit) => normalizeCommit(commit, repo)).filter((commit) => commit.sha || commit.title) : [];
  if (!commits.length) return null;

  const after = payload.after || payload.sha || commits[commits.length - 1]?.sha || '';
  const before = payload.before || '';
  const branch = payload.branch || stripRef(payload.ref) || SOURCE_BRANCH;
  const pushedAt = payload.pushed_at || payload.head_commit?.timestamp || commits[commits.length - 1]?.timestamp || new Date().toISOString();
  const totalCommits = Number(payload.total_commits || payload.total_commits_count || commits.length);
  const actor = payload.actor || payload.sender?.login || payload.pusher?.name || '';
  const compare = payload.compare || compareUrl(repo, before, after);

  return {
    id: `push-${after || `${Date.parse(pushedAt)}-${commits.length}`}`,
    type: 'push',
    sourceRepo: repo,
    branch,
    before,
    after,
    actor,
    pushedAt,
    compareUrl: compare,
    commitCount: commits.length,
    totalCommits: Number.isFinite(totalCommits) ? totalCommits : commits.length,
    commits: commits.slice(0, MAX_COMMITS_PER_ENTRY),
  };
}

async function fetchLatestCommitSnapshot(repo) {
  const url = new URL(`https://api.github.com/repos/${repo}/commits`);
  url.searchParams.set('per_page', String(FALLBACK_FETCH_LIMIT));
  if (SOURCE_BRANCH) url.searchParams.set('sha', SOURCE_BRANCH);

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cinechill-wiki-sync',
  };
  if (SOURCE_TOKEN) headers.Authorization = `Bearer ${SOURCE_TOKEN}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    console.warn(`WARN: unable to fetch ${repo} commits: HTTP ${response.status}. ${SOURCE_TOKEN ? 'Check CINECHILL_SOURCE_TOKEN permissions.' : 'Private repositories require CINECHILL_SOURCE_TOKEN.'}`);
    return null;
  }

  const data = await response.json();
  if (!Array.isArray(data) || !data.length) return null;
  const commits = data.map((commit) => normalizeCommit(commit, repo)).filter((commit) => commit.sha || commit.title);
  if (!commits.length) return null;
  const latest = commits[0];
  return {
    id: `snapshot-${latest.sha}`,
    type: 'snapshot',
    sourceRepo: repo,
    branch: SOURCE_BRANCH,
    before: '',
    after: latest.sha,
    actor: 'scheduled-sync',
    pushedAt: latest.timestamp || new Date().toISOString(),
    compareUrl: '',
    commitCount: commits.length,
    totalCommits: commits.length,
    commits: commits.slice(0, MAX_COMMITS_PER_ENTRY),
  };
}

function loadState() {
  const state = readJson(STATE_FILE, null);
  if (state && Array.isArray(state.entries)) {
    return {
      sourceRepo: state.sourceRepo || SOURCE_REPO,
      updatedAt: state.updatedAt || '',
      entries: state.entries,
    };
  }
  return {
    sourceRepo: SOURCE_REPO,
    updatedAt: '',
    entries: [],
  };
}

function entryHasAlreadySynced(state, entry) {
  if (!entry) return true;
  if (state.entries.some((item) => item.id === entry.id)) return true;
  if (entry.after && state.entries.some((item) => item.after === entry.after)) return true;
  const incomingShas = new Set(entry.commits.map((commit) => commit.sha).filter(Boolean));
  if (incomingShas.size && state.entries.some((item) => item.commits?.some((commit) => incomingShas.has(commit.sha)))) {
    return entry.type === 'snapshot';
  }
  return false;
}

function mergeEntry(state, entry) {
  if (!entry) return { state, changed: false };
  const existing = state.entries.filter((item) => item.id !== entry.id && item.after !== entry.after);
  const nextState = {
    sourceRepo: entry.sourceRepo || state.sourceRepo || SOURCE_REPO,
    updatedAt: new Date().toISOString(),
    entries: [entry, ...existing].slice(0, MAX_ENTRIES),
  };
  return { state: nextState, changed: true };
}

function badge(category) {
  const value = escapeHtml(category || 'COM');
  return `<span class="inline-new">${value}</span>`;
}

function renderCommitParagraph(commit, entry) {
  const parts = [];
  if (commit.url && commit.shortSha) parts.push(`<a href="${escapeAttr(commit.url)}"><code>${escapeHtml(commit.shortSha)}</code></a>`);
  if (commit.author) parts.push(escapeHtml(commit.author));
  if (commit.timestamp) parts.push(escapeHtml(formatDateTime(commit.timestamp)));
  if (entry.branch) parts.push(escapeHtml(entry.branch));
  return parts.join(' · ');
}

function renderHome(state) {
  const latest = state.entries[0];
  const latestCommits = latest?.commits?.slice(0, 3) || [];
  if (!latest || !latestCommits.length) {
    return `${HOME_START}
    <div class="recent-version">
      <span class="new-badge">SYNC</span>
      <div>
        <h2>CineChill 实时提交</h2>
        <time datetime="">等待首次同步</time>
      </div>
    </div>
    <div class="update-grid">
      <article class="update-column">
        <h3>${badge('INFO')}等待 CineChill push 事件</h3>
        <p><strong>状态：</strong>自动同步已预留位置。源仓库配置通知 workflow 后，最新 commit 摘要会自动显示在这里。</p>
      </article>
    </div>
  ${HOME_END}`;
  }

  const total = latest.totalCommits || latest.commitCount || latestCommits.length;
  const omitted = total > latestCommits.length ? `，另有 ${total - latestCommits.length} 条见完整日志` : '';
  const columns = latestCommits.map((commit) => `      <article class="update-column">
        <h3>${badge(commit.category)}${escapeHtml(commit.title)}</h3>
        <p><strong>提交：</strong>${renderCommitParagraph(commit, latest)}</p>
      </article>`).join('\n');

  return `${HOME_START}
    <div class="recent-version">
      <span class="new-badge">SYNC</span>
      <div>
        <h2>CineChill 实时提交</h2>
        <time datetime="${escapeAttr(latest.pushedAt || state.updatedAt)}">${escapeHtml(formatDateTime(latest.pushedAt || state.updatedAt))}</time>
      </div>
    </div>
    <div class="update-grid">
${columns}
    </div>
  ${HOME_END}`;
}

function renderEntry(entry, index) {
  const title = entry.type === 'snapshot'
    ? `最近提交快照 · ${entry.branch || SOURCE_BRANCH || '默认分支'}`
    : `${entry.branch || SOURCE_BRANCH || '默认分支'} 分支 push`;
  const compare = entry.compareUrl
    ? `<a href="${escapeAttr(entry.compareUrl)}">查看本次 diff</a>`
    : `<a href="${escapeAttr(repoUrl(entry.sourceRepo || SOURCE_REPO))}">查看源仓库</a>`;
  const meta = [
    entry.actor ? `触发人：${escapeHtml(entry.actor)}` : '',
    entry.pushedAt ? `时间：${escapeHtml(formatDateTime(entry.pushedAt))}` : '',
    `提交数：${escapeHtml(entry.totalCommits || entry.commitCount || entry.commits.length)}`,
  ].filter(Boolean).join(' · ');
  const commits = (entry.commits || []).map((commit) => `          <li>${badge(commit.category)} ${escapeHtml(commit.title)} ${commit.url && commit.shortSha ? `<a href="${escapeAttr(commit.url)}"><code>${escapeHtml(commit.shortSha)}</code></a>` : ''}${commit.author ? ` · ${escapeHtml(commit.author)}` : ''}</li>`).join('\n');
  const className = index === 0 ? 'card update-log-card' : 'card';
  return `    <section class="${className}">
      <h2>${escapeHtml(title)}</h2>
      <time datetime="${escapeAttr(entry.pushedAt || '')}">${escapeHtml(formatDateTime(entry.pushedAt))}</time>
      <div class="log-grid">
        <article class="update-column">
          <h3>${badge(entry.type === 'snapshot' ? 'SYNC' : 'PUSH')}提交摘要</h3>
          <p><strong>来源：</strong><a href="${escapeAttr(repoUrl(entry.sourceRepo || SOURCE_REPO))}">${escapeHtml(entry.sourceRepo || SOURCE_REPO)}</a> · ${compare}</p>
          <p><strong>元信息：</strong>${meta}</p>
          <ul>
${commits}
          </ul>
        </article>
      </div>
    </section>`;
}

function renderChangelog(state) {
  const entries = state.entries || [];
  if (!entries.length) {
    return `${LOG_START}
    <section class="card update-log-card">
      <div class="log-title-row">
        <span class="new-badge">AUTO</span>
        <div>
          <h2>CineChill 实时提交摘要</h2>
          <time datetime="">等待首次同步</time>
        </div>
      </div>
      <p><strong>状态：</strong>自动同步已启用占位。源仓库 <code>${escapeHtml(SOURCE_REPO)}</code> 配置 push 通知后，本区块会自动写入最近提交摘要。</p>
      <p><strong>公开边界：</strong>这里只展示 commit 首行摘要；包含凭据线索、敏感链接或不适合公开展示的说明会自动脱敏。</p>
    </section>
  ${LOG_END}`;
  }

  const entryHtml = entries.slice(0, MAX_ENTRIES).map(renderEntry).join('\n');
  return `${LOG_START}
    <section class="card update-log-card">
      <div class="log-title-row">
        <span class="new-badge">AUTO</span>
        <div>
          <h2>CineChill 实时提交摘要</h2>
          <time datetime="${escapeAttr(state.updatedAt)}">同步于 ${escapeHtml(formatDateTime(state.updatedAt))}</time>
        </div>
      </div>
      <p><strong>来源仓库：</strong><a href="${escapeAttr(repoUrl(state.sourceRepo || SOURCE_REPO))}">${escapeHtml(state.sourceRepo || SOURCE_REPO)}</a>。本区块由 GitHub Actions 在源仓库 push 后自动更新，只公开经过脱敏的 commit 首行摘要。</p>
      <p><strong>公开边界：</strong>如果提交说明包含凭据线索、敏感链接或不适合公开展示的内容，脚本会用脱敏提示替代原文。</p>
    </section>
${entryHtml}
  ${LOG_END}`;
}

function replaceMarkedBlock(relativePath, startMarker, endMarker, replacement) {
  const text = readText(relativePath);
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${relativePath} is missing ${startMarker}/${endMarker} markers`);
  }
  const next = `${text.slice(0, start)}${replacement}${text.slice(end + endMarker.length)}`;
  writeText(relativePath, next);
  return next !== text;
}


function removeAutoSyncHomeText(value) {
  return String(value || '')
    .replace(/SYNC CineChill 实时提交[\s\S]*?查看完整日志 →/g, ' ')
    .replace(/SYNC CineChill 实时提交[\s\S]*?本次同步 \d+ 条提交(?:，另有 \d+ 条见完整日志)? →/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function updateSearchIndex(state, changelogHtml, homeHtml) {
  const items = readJson(SEARCH_INDEX_FILE, []);
  if (!Array.isArray(items)) return false;
  const latest = state.entries?.[0]?.commits?.[0];
  const latestSummary = latest ? `CineChill 最近提交：${latest.title}` : 'CineChill 实时提交摘要会在源仓库 push 后自动同步。';
  let changed = false;
  const effectiveChangelogHtml = DRY_RUN ? changelogHtml : readText(CHANGELOG_FILE);
  const changelogText = stripHtml(effectiveChangelogHtml).slice(0, 12000);
  const homeText = stripHtml(homeHtml).slice(0, 4000);

  for (const item of items) {
    if (item.href === '/wiki/changelog.html' || item.href === 'wiki/changelog.html' || /\/wiki\/changelog\.html$/.test(item.href || '')) {
      if (item.excerpt !== latestSummary || item.text !== changelogText) {
        item.excerpt = latestSummary;
        item.text = changelogText;
        changed = true;
      }
    }
    if (item.href === '/' || item.href === '/cinechill-wiki/' || item.title === 'CineChill Wiki') {
      const baseText = removeAutoSyncHomeText(item.text);
      const nextText = `${homeText} ${baseText}`.replace(/\s+/g, ' ').trim().slice(0, 12000);
      if (item.text !== nextText) {
        item.text = nextText;
        changed = true;
      }
    }
  }

  if (changed) writeJson(SEARCH_INDEX_FILE, items);
  return changed;
}

async function main() {
  const payload = parsePayload();
  const state = loadState();
  let incoming = payload ? normalizePayloadEntry(payload) : null;

  if (!incoming && !payload) {
    incoming = await fetchLatestCommitSnapshot(SOURCE_REPO);
  }

  let nextState = state;
  let hasNewEntry = false;
  if (incoming && !entryHasAlreadySynced(state, incoming)) {
    const merged = mergeEntry(state, incoming);
    nextState = merged.state;
    hasNewEntry = merged.changed;
  }

  if (!nextState.entries.length && !hasNewEntry) {
    console.log('No CineChill commit data available; leaving existing wiki blocks unchanged.');
    return;
  }

  const homeHtml = renderHome(nextState);
  const changelogHtml = renderChangelog(nextState);

  const changes = [];
  if (hasNewEntry) {
    writeJson(STATE_FILE, nextState);
    changes.push(STATE_FILE);
  }
  if (replaceMarkedBlock(HOME_FILE, HOME_START, HOME_END, homeHtml)) changes.push(HOME_FILE);
  if (replaceMarkedBlock(CHANGELOG_FILE, LOG_START, LOG_END, changelogHtml)) changes.push(CHANGELOG_FILE);
  if (updateSearchIndex(nextState, changelogHtml, homeHtml)) changes.push(SEARCH_INDEX_FILE);

  const uniqueChanges = [...new Set(changes)];
  if (DRY_RUN) {
    console.log(`[dry-run] would update: ${uniqueChanges.join(', ') || 'nothing'}`);
  } else {
    console.log(`Updated: ${uniqueChanges.join(', ') || 'nothing'}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
