<template>
  <div class="dl-reader">
    <header class="dl-reader__head">
      <button class="dl-mobile-menu" title="目录" @click="mobileNav = true" aria-label="打开目录">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <span class="dl-reader__brand">DocLoom</span>
      <button class="dl-search-trigger" type="button" @click="openPalette" aria-label="搜索文档">
        <svg class="dl-search-trigger__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <span class="dl-search-trigger__txt">搜索文档</span>
        <kbd class="dl-search-trigger__kbd" aria-hidden="true">Ctrl K</kbd>
      </button>
      <span class="dl-reader__path" v-if="currentSource">{{ currentSource.owner }}/{{ currentSource.repo }}{{ currentSource.path ? '/' + currentSource.path : '' }}</span>
      <button class="dl-theme-btn" :title="isDark ? '切换浅色' : '切换深色'" aria-label="切换主题" @click="toggleDark">
        <svg v-if="isDark" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      </button>
    </header>
    <div class="dl-reader__main">
      <aside class="dl-warp" :class="{ 'is-mobile-open': mobileNav }">
        <el-select v-model="sourceId" placeholder="选择文档来源" filterable popper-class="dl-source-popper" class="dl-source" @change="onSourceChange">
          <template #prefix><svg-icon icon-class="documentation" class="dl-source__icon" /></template>
          <el-option v-for="s in sources" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <div class="dl-warp__tree">
          <el-tree
            v-if="treeData.length"
            :data="treeData"
            node-key="path"
            :props="treeProps"
            :default-expand-all="true"
            :expand-on-click-node="true"
            draggable
            :allow-drop="allowTreeDrop"
            @node-drop="onTreeDrop"
            @node-click="onNodeClick"
          >
            <template #default="{ data }">
              <span class="dl-warp__node" :class="{ 'is-active': data.fileId != null && data.fileId === activeFileId }" :title="data.label">
                {{ data.label }}
              </span>
            </template>
          </el-tree>
          <el-empty v-else description="暂无文档（来源未同步或为空）" :image-size="64" />
        </div>
      </aside>
      <section class="dl-cloth-area" ref="clothAreaRef">
        <div class="dl-weft" v-if="view">
          <span class="dl-weft__path">{{ view.path }}</span>
          <a v-if="editUrl" class="dl-weft__edit" :href="editUrl" target="_blank" rel="noopener">在 GitHub 编辑</a>
        </div>
        <DocViewer :view="view" @toc="onToc" />
      </section>
      <aside class="dl-toc" v-if="toc.length">
        <div class="dl-toc__title">本页目录</div>
        <ul class="dl-toc__list">
          <li
            v-for="t in toc"
            :key="t.id"
            :class="['dl-toc__item', 'dl-toc__l' + t.level, { 'is-active': activeId === t.id }]"
            :title="t.text"
            @click="goHeading(t.id)"
          >{{ t.text }}</li>
        </ul>
      </aside>
    </div>

    <div class="dl-mobile-backdrop" v-if="mobileNav" @click="mobileNav = false"></div>

    <footer class="dl-reader__foot">
      <span>DocLoom</span>
    </footer>

    <Teleport to="body">
      <Transition name="dl-cp">
        <div v-if="paletteOpen" class="dl-cp" @click.self="closePalette">
          <div class="dl-cp__panel" role="dialog" aria-label="搜索文档">
            <div class="dl-cp__inputbar">
              <svg class="dl-cp__input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input
                ref="paletteInputRef"
                v-model="kw"
                class="dl-cp__input"
                type="text"
                placeholder="搜索文档标题或正文…"
                @keydown="onPaletteKey"
                @input="onPaletteInput"
              />
            </div>
            <div ref="paletteResultsRef" class="dl-cp__results">
              <div v-if="searching" class="dl-cp__state">检索中…</div>
              <div v-else-if="!kw.trim()" class="dl-cp__state">输入关键词搜索文档</div>
              <div v-else-if="!searchHits.length" class="dl-cp__state">无命中</div>
              <ul v-else class="dl-cp__list">
                <li
                  v-for="(hit, i) in searchHits"
                  :key="(hit.docFileId ?? '') + '_' + i"
                  :class="['dl-cp__item', { 'is-active': i === activeHitIndex }]"
                  @click="openHit(hit)"
                  @mouseenter="activeHitIndex = i"
                >
                  <div class="dl-cp__item-name">{{ hit.name }}</div>
                  <div class="dl-cp__item-meta">{{ hit.sourceName }} · {{ hit.path }}</div>
                  <div class="dl-cp__item-frag" v-if="hit.fragment" v-html="safeFrag(hit.fragment)"></div>
                </li>
              </ul>
            </div>
            <div class="dl-cp__footer">
              <div class="dl-cp__scope">
                <el-switch v-model="searchScopeCurrent" :disabled="sourceId == null" style="--el-switch-on-color: var(--dl-accent)" @change="onScopeChange" />
                <span class="dl-cp__scope-txt">仅当前来源</span>
              </div>
              <div class="dl-cp__hint">
                <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
                <span><kbd>↵</kbd> 打开</span>
                <span><kbd>Esc</kbd> 关闭</span>
                <span v-if="searchTotal > searchPageSize" class="dl-cp__page">第 {{ searchPageNum }} / {{ Math.ceil(searchTotal / searchPageSize) }} 页 · 共 {{ searchTotal }}</span>
                <span v-else-if="searchTotal" class="dl-cp__page">共 {{ searchTotal }} 条</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import DOMPurify from 'dompurify';
import { listPublicSources, listPublicFiles, viewPublicFile, searchPublic } from '@/api/doc/public';
import type { PublicSourceVO, PublicFileVO, DocFileViewVO, DocSearchHitVO } from '@/api/doc/public';
import DocViewer from '../components/DocViewer.vue';

const route = useRoute();
const router = useRouter();

const sources = ref<PublicSourceVO[]>([]);
const sourceId = ref<number | string | null>(null);
const currentSource = ref<PublicSourceVO | null>(null);
const treeData = ref<TreeNode[]>([]);
const activeFileId = ref<number | string | null>(null);
const view = ref<DocFileViewVO | null>(null);

const toc = ref<{ id: string; level: number; text: string }[]>([]);
const activeId = ref('');
const clothAreaRef = ref<HTMLElement | null>(null);
let tocObserver: IntersectionObserver | null = null;

const isDark = useDark({ storageKey: 'useDarkKey' });
const editUrl = computed(() => {
  const s = currentSource.value;
  const v = view.value;
  if (!s || !v?.path) return '';
  return `https://github.com/${s.owner}/${s.repo}/edit/${s.branch}/${v.path}`;
});

const kw = ref('');
const paletteOpen = ref(false);
const searching = ref(false);
const searchHits = ref<DocSearchHitVO[]>([]);
const searchTotal = ref(0);
const searchPageNum = ref(1);
const searchPageSize = ref(10);
const searchScopeCurrent = ref(false);
const activeHitIndex = ref(0);
const paletteInputRef = ref<HTMLInputElement | null>(null);
const paletteResultsRef = ref<HTMLElement | null>(null);
const mobileNav = ref(false);

// 输入即搜：200ms 防抖，无需回车
const debouncedSearch = useDebounceFn(() => doSearch(0), 200);

const treeProps = { label: 'label', children: 'children' };

interface TreeNode {
  label: string;
  path: string;
  fileId?: number | string;
  children?: TreeNode[];
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown);
  try {
    const res = await listPublicSources();
    sources.value = res.data;
  } catch {
    sources.value = [];
  }
  const s = route.query.s;
  if (s) {
    sourceId.value = s as string | number;
  } else if (sources.value.length) {
    sourceId.value = sources.value[0].id;
  }
  if (sourceId.value != null) {
    await loadSource(sourceId.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  tocObserver?.disconnect();
  document.title = import.meta.env.VITE_APP_TITLE;
});

async function onSourceChange(id: any) {
  if (id == null) {
    return;
  }
  await loadSource(id);
}

async function loadSource(id: number | string) {
  currentSource.value = sources.value.find((s) => s.id === id) || null;
  router.replace({ query: { s: String(id) } });
  const res = await listPublicFiles(id);
  treeData.value = applyTreeOrder(buildTree(res.data), loadTreeOrder(id));
  activeFileId.value = null;
  view.value = null;
  const f = route.query.f;
  let target: number | string | null = f ? (f as string | number) : null;
  if (target == null) {
    const first = firstFile(treeData.value);
    target = first?.fileId ?? null;
  }
  if (target != null) {
    await selectFile(target);
  }
}

async function onNodeClick(data: TreeNode) {
  if (data.fileId != null) {
    await selectFile(data.fileId);
    mobileNav.value = false;
  }
}

async function selectFile(fileId: number | string) {
  activeFileId.value = fileId;
  router.replace({ query: { s: String(sourceId.value ?? ''), f: String(fileId) } });
  try {
    const res = await viewPublicFile(fileId);
    view.value = res.data;
  } catch {
    view.value = null;
  }
}

async function onScopeChange() {
  // 切换检索范围后，若已有查询词则立即重搜
  if (kw.value && kw.value.trim()) {
    searchPageNum.value = 1;
    await doSearch(0);
  }
}

/** 打开命令面板并聚焦输入；若已有查询词则补搜一次 */
async function openPalette() {
  paletteOpen.value = true;
  await nextTick();
  paletteInputRef.value?.focus();
  paletteInputRef.value?.select?.();
  if (kw.value && kw.value.trim()) {
    debouncedSearch();
  }
}
function closePalette() {
  paletteOpen.value = false;
}

/** 输入即触发防抖检索；空词清空结果 */
function onPaletteInput() {
  searchPageNum.value = 1;
  if (!kw.value || !kw.value.trim()) {
    searchHits.value = [];
    searchTotal.value = 0;
    activeHitIndex.value = 0;
    return;
  }
  debouncedSearch();
}

/** 命令面板键盘：↑↓ 导航（末条下翻页/首条上翻页）/ 回车打开 / Esc 关闭 */
function onPaletteKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!searchHits.value.length) return;
    if (activeHitIndex.value < searchHits.value.length - 1) {
      activeHitIndex.value++;
      scrollActiveIntoView();
    } else if (searchPageNum.value * searchPageSize.value < searchTotal.value) {
      searchPageNum.value++;
      doSearch(0);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!searchHits.value.length) return;
    if (activeHitIndex.value > 0) {
      activeHitIndex.value--;
      scrollActiveIntoView();
    } else if (searchPageNum.value > 1) {
      searchPageNum.value--;
      doSearch(Infinity);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const hit = searchHits.value[activeHitIndex.value];
    if (hit) openHit(hit);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    paletteResultsRef.value?.querySelector('.dl-cp__item.is-active')?.scrollIntoView({ block: 'nearest' });
  });
}

/** Ctrl/⌘ + K：开关命令面板 */
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    if (paletteOpen.value) closePalette();
    else openPalette();
  }
}
function toggleDark() {
  isDark.value = !isDark.value;
}
watch(
  view,
  (v) => {
    document.title = v?.path ? `DocLoom · ${v.path.split('/').pop()}` : 'DocLoom';
  },
  { immediate: true }
);async function doSearch(targetIndex = 0) {
  searching.value = true;
  try {
    const res = await searchPublic({
      kw: kw.value.trim(),
      sourceId: searchScopeCurrent.value ? (sourceId.value ?? undefined) : undefined,
      pageNum: searchPageNum.value,
      pageSize: searchPageSize.value
    });
    searchHits.value = res.rows || [];
    searchTotal.value = res.total || 0;
    activeHitIndex.value = Math.min(
      targetIndex === Infinity ? searchHits.value.length - 1 : targetIndex,
      Math.max(0, searchHits.value.length - 1)
    );
    scrollActiveIntoView();
  } catch {
    searchHits.value = [];
    searchTotal.value = 0;
    activeHitIndex.value = 0;
  } finally {
    searching.value = false;
  }
}

async function openHit(hit: DocSearchHitVO) {
  closePalette();
  if (hit.sourceId != null && String(hit.sourceId) !== String(sourceId.value)) {
    sourceId.value = hit.sourceId;
    await loadSource(hit.sourceId);
  }
  if (hit.docFileId != null) {
    await selectFile(hit.docFileId);
  }
  mobileNav.value = false;
}

/** DocViewer 上报的标题列表 */
function onToc(list: { id: string; level: number; text: string }[]) {
  toc.value = list;
  activeId.value = list[0]?.id ?? '';
  nextTick(setupSpy);
}
/** scroll-spy:依标题可见性高亮当前节 */
function setupSpy() {
  tocObserver?.disconnect();
  if (!clothAreaRef.value || !toc.value.length) return;
  const visible = new Map<string, number>();
  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const id = (e.target as HTMLElement).id;
        if (e.isIntersecting) visible.set(id, e.intersectionRatio);
        else visible.delete(id);
      });
      let best = '';
      let bestTop = Infinity;
      visible.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) {
            bestTop = top;
            best = id;
          }
        }
      });
      if (best) activeId.value = best;
    },
    { root: clothAreaRef.value, rootMargin: '0px 0px -75% 0px', threshold: [0, 0.5, 1] }
  );
  toc.value.forEach((t) => {
    const el = document.getElementById(t.id);
    if (el) tocObserver.observe(el);
  });
}
/** 点击 TOC 项滚动到对应标题 */
function goHeading(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function safeFrag(f: string): string {
  return f ? DOMPurify.sanitize(f, { ALLOWED_TAGS: ['mark'] }) : '';
}

function firstFile(nodes: TreeNode[]): TreeNode | null {
  for (const n of nodes) {
    if (n.fileId != null) return n;
    if (n.children) {
      const f = firstFile(n.children);
      if (f) return f;
    }
  }
  return null;
}

function buildTree(files: PublicFileVO[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();
  for (const f of files) {
    const parts = (f.path || '').split('/').filter((p) => p.length > 0);
    let curArr = root;
    let curPath = '';
    parts.forEach((seg, i) => {
      curPath = curPath ? `${curPath}/${seg}` : seg;
      const isFile = i === parts.length - 1;
      let node = map.get(curPath);
      if (!node) {
        node = { label: seg, path: curPath, children: isFile ? undefined : [] };
        if (isFile) node.fileId = f.id;
        map.set(curPath, node);
        curArr.push(node);
      }
      if (!isFile && node.children) {
        curArr = node.children;
      }
    });
  }
  return root;
}

const TREE_ORDER_KEY = 'docloom-tree-order';

/** 读取本机保存的某来源目录顺序（DFS 路径序列），无则 null */
function loadTreeOrder(id: number | string): string[] | null {
  try {
    const all = JSON.parse(localStorage.getItem(TREE_ORDER_KEY) || '{}');
    const arr = all[String(id)];
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/** 保存某来源目录顺序到 localStorage，按来源隔离 */
function saveTreeOrder(id: number | string, paths: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(TREE_ORDER_KEY) || '{}');
    all[String(id)] = paths;
    localStorage.setItem(TREE_ORDER_KEY, JSON.stringify(all));
  } catch {
    // localStorage 不可用或已满：忽略，不影响拖动本身
  }
}

/** 深度优先拍平当前显示顺序的路径序列，用于持久化 */
function flattenTreeOrder(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (arr: TreeNode[]) => {
    arr.forEach((n) => {
      out.push(n.path);
      if (n.children) walk(n.children);
    });
  };
  walk(nodes);
  return out;
}

/** 按保存顺序重排各兄弟组；未记录项稳定追加在后（新文件不丢） */
function applyTreeOrder(nodes: TreeNode[], ordered: string[] | null): TreeNode[] {
  if (!ordered || !ordered.length) return nodes;
  const idx = new Map<string, number>();
  ordered.forEach((p, i) => idx.set(p, i));
  const sortGroup = (arr: TreeNode[]) => {
    arr.sort((a, b) => {
      const ia = idx.has(a.path) ? idx.get(a.path)! : Infinity;
      const ib = idx.has(b.path) ? idx.get(b.path)! : Infinity;
      return ia - ib;
    });
    arr.forEach((n) => n.children && sortGroup(n.children));
  };
  sortGroup(nodes);
  return nodes;
}

/** 拖拽放置约束：仅同父级 before/after 排序，禁止 inner 改换父子关系 */
function allowTreeDrop(draggingNode: any, dropNode: any, type: string): boolean {
  if (type === 'inner') return false;
  return draggingNode.parent === dropNode.parent;
}

/** 拖拽完成：el-tree 已就地改写 treeData，落盘新顺序 */
function onTreeDrop() {
  if (sourceId.value == null) return;
  saveTreeOrder(sourceId.value, flattenTreeOrder(treeData.value));
}
</script>

<style scoped>
.dl-reader {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--dl-cloth);
  font-family: var(--dl-body);
  color: var(--dl-link);
}
.dl-reader__head {
  flex: 0 0 auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 54px;
  padding: 0 22px;
  border-bottom: 1px solid var(--dl-selvedge);
  background: var(--dl-cloth);
}
.dl-reader__brand {
  font-family: var(--dl-display);
  font-weight: 600;
  font-size: 19px;
  letter-spacing: -0.01em;
  color: var(--dl-link);
}
.dl-reader__path {
  margin-left: auto;
  font-family: var(--dl-mono);
  font-size: 12px;
  color: var(--dl-weft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 30%;
}
.dl-theme-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dl-selvedge);
  border-radius: var(--app-radius-sm);
  background: var(--dl-cloth-2);
  color: var(--dl-weft);
  cursor: pointer;
}
.dl-theme-btn:hover {
  color: var(--dl-accent);
  border-color: var(--dl-accent);
}
.dl-search-trigger {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: min(360px, 38vw);
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--dl-selvedge);
  border-radius: var(--app-radius-md);
  background: var(--dl-cloth-2);
  color: var(--dl-weft);
  cursor: pointer;
  font-family: var(--dl-body);
  font-size: 14px;
  text-align: left;
}
.dl-search-trigger:hover {
  border-color: var(--dl-accent);
  color: var(--dl-link);
}
.dl-search-trigger__icon {
  flex-shrink: 0;
}
.dl-search-trigger__txt {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-search-trigger__kbd {
  flex-shrink: 0;
  font-family: var(--dl-mono);
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border: 1px solid var(--dl-selvedge);
  border-radius: 5px;
  background: var(--dl-cloth);
  color: var(--dl-weft);
}

.dl-reader__main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.dl-warp {
  flex: 0 0 300px;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--dl-selvedge);
  background: var(--dl-cloth-2);
}
.dl-source {
  margin: 12px 12px 8px;
  --el-color-primary: var(--dl-accent);
}
.dl-source :deep(.el-select__wrapper) {
  background: var(--dl-cloth);
  box-shadow: 0 0 0 1px var(--dl-selvedge) inset;
  border-radius: var(--app-radius-md);
  padding: 2px 10px;
  min-height: 40px;
}
.dl-source :deep(.el-select__wrapper:hover),
.dl-source :deep(.el-select__wrapper:focus-within) {
  box-shadow: 0 0 0 1.5px var(--dl-accent) inset;
}
.dl-source :deep(.el-select__selected-item) {
  font-family: var(--dl-display);
  font-weight: 600;
  font-size: 15px;
  color: var(--dl-link);
}
.dl-source :deep(.el-select__placeholder) {
  font-family: var(--dl-body);
  font-weight: 400;
  font-size: 14px;
  color: var(--dl-weft);
}
.dl-source__icon {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  color: var(--dl-accent);
}
.dl-source :deep(.el-select__caret) {
  color: var(--dl-weft);
}
.dl-warp__tree {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--dl-selvedge) transparent;
  padding: 8px 10px 24px;
}
.dl-warp__tree::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.dl-warp__tree::-webkit-scrollbar-thumb {
  background: var(--dl-selvedge);
  border-radius: 4px;
}
.dl-warp__tree::-webkit-scrollbar-thumb:hover {
  background: var(--dl-weft);
}
.dl-warp__tree::-webkit-scrollbar-track {
  background: transparent;
}
.dl-warp__tree :deep(.el-tree) {
  background: transparent;
  overflow-x: hidden;
  --el-tree-node-hover-bg-color: transparent;
}
.dl-warp__tree :deep(.el-tree-node__content) {
  height: 34px;
}
.dl-warp__node {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 4px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--dl-link);
  user-select: none;
}
.dl-warp__node:hover {
  color: var(--dl-accent);
}
.dl-warp__node.is-active {
  color: var(--dl-accent);
  font-weight: 600;
}

.dl-cloth-area {
  flex: 1 1 auto;
  overflow: auto;
  min-width: 0;
  background: var(--dl-cloth);
}
.dl-weft {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 34px;
  font-family: var(--dl-mono);
  font-size: 12px;
  color: var(--dl-weft);
  border-bottom: 1px solid var(--dl-selvedge);
  background: transparent;
}
.dl-weft__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-weft__edit {
  flex-shrink: 0;
  color: var(--dl-accent);
  text-decoration: none;
}
.dl-weft__edit:hover {
  text-decoration: underline;
}

.dl-toc {
  flex: 0 0 220px;
  overflow-y: auto;
  padding: 16px 14px 24px;
  border-left: 1px solid var(--dl-selvedge);
  background: var(--dl-cloth);
}
.dl-toc__title {
  font-family: var(--dl-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--dl-weft);
  margin: 0 0 10px;
  padding-left: 2px;
}
.dl-toc__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dl-toc__item {
  font-size: 13px;
  line-height: 1.45;
  color: var(--dl-weft);
  cursor: pointer;
  padding: 3px 0 3px 12px;
  margin: 2px 0;
  border-left: 2px solid transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-toc__item:hover {
  color: var(--dl-link);
}
.dl-toc__item.is-active {
  color: var(--dl-accent);
  font-weight: 600;
  border-left-color: var(--dl-accent);
}
.dl-toc__l1 { padding-left: 12px; }
.dl-toc__l2 { padding-left: 24px; }
.dl-toc__l3 { padding-left: 36px; }
.dl-toc__l4 { padding-left: 48px; }

.dl-reader__foot {
  flex: 0 0 auto;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dl-cloth-2);
  border-top: 1px solid var(--dl-selvedge);
  color: var(--dl-weft);
  font-size: 12px;
}

/* 命令面板 */
.dl-cp {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  background: rgba(21, 20, 15, 0.45);
  backdrop-filter: blur(2px);
}
.dl-cp__panel {
  width: min(640px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dl-selvedge);
  border-radius: var(--app-radius-md);
  background: var(--dl-cloth);
  box-shadow: var(--app-shadow-lg, 0 16px 48px rgba(0, 0, 0, 0.28));
  overflow: hidden;
}
.dl-cp__inputbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--dl-selvedge);
}
.dl-cp__input-icon {
  flex-shrink: 0;
  color: var(--dl-weft);
}
.dl-cp__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-family: var(--dl-body);
  font-size: 15px;
  color: var(--dl-link);
}
.dl-cp__input::placeholder {
  color: var(--dl-weft);
}
.dl-cp__results {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--dl-selvedge) transparent;
  min-height: 80px;
}
.dl-cp__results::-webkit-scrollbar {
  width: 8px;
}
.dl-cp__results::-webkit-scrollbar-thumb {
  background: var(--dl-selvedge);
  border-radius: 4px;
}
.dl-cp__results::-webkit-scrollbar-track {
  background: transparent;
}
.dl-cp__state {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--dl-weft);
}
.dl-cp__list {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.dl-cp__item {
  padding: 10px 12px;
  border-radius: var(--app-radius-sm);
  cursor: pointer;
}
.dl-cp__item.is-active {
  background: var(--dl-cloth-2);
}
.dl-cp__item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--dl-link);
  margin-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-cp__item.is-active .dl-cp__item-name {
  color: var(--dl-accent);
}
.dl-cp__item-meta {
  font-family: var(--dl-mono);
  font-size: 12px;
  color: var(--dl-weft);
  margin-bottom: 4px;
  word-break: break-all;
}
.dl-cp__item-frag {
  font-size: 13px;
  color: var(--dl-weft);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dl-cp__item-frag :deep(mark) {
  background: rgba(142, 58, 43, 0.16);
  color: var(--dl-accent);
  padding: 0 2px;
  border-radius: 2px;
}
.dl-cp__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--dl-selvedge);
  background: var(--dl-cloth-2);
}
.dl-cp__scope {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dl-cp__scope-txt {
  font-size: 12px;
  color: var(--dl-weft);
  user-select: none;
}
.dl-cp__hint {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--dl-weft);
}
.dl-cp__hint kbd {
  font-family: var(--dl-mono);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid var(--dl-selvedge);
  border-radius: 4px;
  background: var(--dl-cloth);
  color: var(--dl-link);
}
.dl-cp__hint span + span {
  margin-left: 0;
}
.dl-cp__page {
  margin-left: auto;
}
.dl-cp-enter-active,
.dl-cp-leave-active {
  transition: opacity 0.15s ease;
}
.dl-cp-enter-from,
.dl-cp-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .dl-toc {
    display: none;
  }
}
@media (max-width: 860px) {
  .dl-warp {
    flex: 0 0 240px;
  }
  .dl-search-trigger {
    width: min(280px, 42vw);
  }
}
.dl-mobile-menu,
.dl-mobile-backdrop {
  display: none;
}

@media (max-width: 640px) {
  .dl-reader__path {
    display: none;
  }
  .dl-search-trigger {
    position: static;
    transform: none;
    width: auto;
    flex: 1 1 auto;
    margin: 0;
  }
  .dl-mobile-menu {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--dl-selvedge);
    border-radius: var(--app-radius-sm);
    background: var(--dl-cloth-2);
    color: var(--dl-weft);
    cursor: pointer;
  }
  .dl-mobile-menu:hover {
    color: var(--dl-accent);
    border-color: var(--dl-accent);
  }
  .dl-warp {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: 82%;
    max-width: 300px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--app-shadow-md);
  }
  .dl-warp.is-mobile-open {
    transform: translateX(0);
  }
  .dl-mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 90;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>

<!-- popper 被 teleport 到 body，scoped 够不到，单独全局块覆盖蓝色选中项 -->
<style>
.dl-source-popper.el-popper {
  --el-color-primary: var(--dl-accent);
  --el-color-primary-light-9: rgba(142, 58, 43, 0.08);
}
.dl-source-popper .el-select-dropdown__item.is-selected,
.dl-source-popper .el-select-dropdown__item.selected {
  color: var(--dl-accent);
  font-weight: 600;
}
.dl-source-popper .el-select-dropdown__item.is-selected.is-hovering,
.dl-source-popper .el-select-dropdown__item.selected:hover {
  background-color: rgba(142, 58, 43, 0.08);
}
</style>
