<template>
  <div class="dl-reader">
    <header class="dl-reader__head">
      <span class="dl-reader__brand">DocLoom</span>
      <div class="dl-search">
        <el-input
          ref="searchInputRef"
          v-model="kw"
          class="dl-search__input"
          :prefix-icon="Search"
          placeholder="搜索文档"
          @keyup.enter="onSearch"
        />
        <kbd class="dl-search__kbd" aria-hidden="true">Ctrl K</kbd>
      </div>
      <span class="dl-reader__path" v-if="currentSource">{{ currentSource.owner }}/{{ currentSource.repo }}{{ currentSource.path ? '/' + currentSource.path : '' }}</span>
    </header>
    <div class="dl-reader__main">
      <aside class="dl-warp">
        <el-select v-model="sourceId" placeholder="选择文档来源" filterable class="dl-source" @change="onSourceChange">
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
      <section class="dl-cloth-area">
        <div class="dl-weft" v-if="view">{{ view.path }}</div>
        <DocViewer :view="view" />
      </section>
    </div>

    <footer class="dl-reader__foot">
      <span>DocLoom</span>
    </footer>

    <el-drawer v-model="searchDrawer" title="检索结果" direction="rtl" size="460px" :close-on-click-modal="true">
      <div class="dl-search-toolbar">
        <el-switch v-model="searchScopeCurrent" :disabled="sourceId == null" style="--el-switch-on-color: var(--dl-accent)" @change="onScopeChange" />
        <span class="dl-search-toolbar__txt">仅当前来源</span>
      </div>
      <div v-loading="searching" class="dl-search-body">
        <el-empty v-if="!searching && !searchHits.length" description="无命中" :image-size="56" />
        <div
          v-for="(hit, i) in searchHits"
          :key="(hit.docFileId ?? '') + '_' + i"
          class="dl-hit"
          @click="openHit(hit)"
        >
          <div class="dl-hit__name">{{ hit.name }}</div>
          <div class="dl-hit__meta">{{ hit.sourceName }} · {{ hit.path }}</div>
          <div class="dl-hit__frag" v-if="hit.fragment" v-html="safeFrag(hit.fragment)"></div>
        </div>
        <div v-if="searchTotal > searchPageSize" class="dl-search-pager">
          <el-pagination
            background
            small
            layout="prev, pager, next"
            :total="searchTotal"
            :page-size="searchPageSize"
            :current-page="searchPageNum"
            @current-change="onPageChange"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { Search } from '@element-plus/icons-vue';
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

const kw = ref('');
const searchDrawer = ref(false);
const searching = ref(false);
const searchHits = ref<DocSearchHitVO[]>([]);
const searchTotal = ref(0);
const searchPageNum = ref(1);
const searchPageSize = ref(10);
const searchScopeCurrent = ref(false);
const searchInputRef = ref<any>(null);

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
  treeData.value = buildTree(res.data);
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
    await doSearch();
  }
}

async function onSearch() {
  if (!kw.value || !kw.value.trim()) {
    return;
  }
  searchPageNum.value = 1;
  await doSearch();
}

async function onPageChange(p: number) {
  searchPageNum.value = p;
  await doSearch();
}

/** Ctrl/⌘ + K：聚焦搜索框 */
function openSearch() {
  searchInputRef.value?.focus();
  searchInputRef.value?.select?.();
}
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openSearch();
  }
}async function doSearch() {
  searchDrawer.value = true;
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
  } catch {
    searchHits.value = [];
    searchTotal.value = 0;
  } finally {
    searching.value = false;
  }
}

async function openHit(hit: DocSearchHitVO) {
  searchDrawer.value = false;
  if (hit.sourceId != null && String(hit.sourceId) !== String(sourceId.value)) {
    sourceId.value = hit.sourceId;
    await loadSource(hit.sourceId);
  }
  if (hit.docFileId != null) {
    await selectFile(hit.docFileId);
  }
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
.dl-search {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, 40vw);
}
.dl-search__input {
  width: 100%;
}
.dl-search__input :deep(.el-input__wrapper) {
  background: var(--dl-cloth-2);
  box-shadow: 0 0 0 1px var(--dl-selvedge) inset;
  border-radius: var(--app-radius-md);
  padding-right: 60px;
}
.dl-search__input :deep(.el-input__wrapper.is-focus) {
  background: var(--dl-cloth);
  box-shadow: 0 0 0 1.5px var(--dl-accent) inset;
}
.dl-search__input :deep(.el-input__inner) {
  height: 38px;
  font-size: 14px;
}
.dl-search__input :deep(.el-input__prefix) {
  color: var(--dl-weft);
  margin-right: 4px;
}
.dl-search__kbd {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--dl-mono);
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border: 1px solid var(--dl-selvedge);
  border-radius: 5px;
  background: var(--dl-cloth);
  color: var(--dl-weft);
  pointer-events: none;
  white-space: nowrap;
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
  margin: 14px 14px 6px;
}
.dl-source :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--dl-selvedge) inset;
  border-radius: var(--app-radius-md);
}
.dl-warp__tree {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  padding: 8px 10px 24px;
}
.dl-warp__tree :deep(.el-tree) {
  background: transparent;
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
  padding: 9px 34px;
  font-family: var(--dl-mono);
  font-size: 12px;
  color: var(--dl-weft);
  border-bottom: 1px solid var(--dl-selvedge);
  background: transparent;
}

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

/* 检索抽屉 */
.dl-search-body {
  min-height: 120px;
}
.dl-search-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  padding: 0 4px 12px;
}
.dl-search-toolbar__txt {
  font-size: 13px;
  color: var(--dl-weft);
  user-select: none;
}
.dl-hit {
  padding: 12px 14px;
  border-bottom: 1px solid var(--dl-selvedge);
  cursor: pointer;
}
.dl-hit:hover {
  background: var(--dl-cloth-2);
}
.dl-hit__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--dl-link);
  margin-bottom: 4px;
}
.dl-hit__meta {
  font-family: var(--dl-mono);
  font-size: 12px;
  color: var(--dl-weft);
  margin-bottom: 6px;
  word-break: break-all;
}
.dl-hit__frag {
  font-size: 13px;
  color: var(--dl-weft);
  line-height: 1.6;
}
.dl-hit__frag :deep(mark) {
  background: rgba(142, 58, 43, 0.16);
  color: var(--dl-accent);
  padding: 0 2px;
  border-radius: 2px;
}
.dl-search-pager {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

@media (max-width: 860px) {
  .dl-warp {
    flex: 0 0 240px;
  }
  .dl-search {
    width: min(280px, 42vw);
  }
}
@media (max-width: 640px) {
  .dl-reader__path {
    display: none;
  }
  .dl-warp {
    display: none;
  }
  .dl-search {
    position: static;
    transform: none;
    width: auto;
    flex: 1 1 auto;
    margin: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
