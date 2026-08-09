<template>
  <div class="doc-reader">
    <header class="doc-header">
      <span class="title">DocLoom</span>
      <span class="sub" v-if="currentSource"> · {{ currentSource.owner }}/{{ currentSource.repo }}{{ currentSource.path ? '/' + currentSource.path : '' }}</span>
      <div class="header-right">
        <el-checkbox
          v-model="searchScopeCurrent"
          :disabled="sourceId == null"
          @change="onScopeChange"
        >仅当前来源</el-checkbox>
        <el-input
          v-model="kw"
          class="search-input"
          placeholder="关键字检索文档…"
          clearable
          :prefix-icon="Search"
          @keyup.enter="onSearch"
        />
      </div>
    </header>
    <div class="doc-main">
      <aside class="doc-aside">
        <el-select v-model="sourceId" placeholder="选择文档来源" filterable class="source-select" @change="onSourceChange">
          <el-option v-for="s in sources" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <div class="tree-wrap">
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
              <span class="tree-node" :class="{ 'is-active': data.fileId != null && data.fileId === activeFileId }">
                {{ data.label }}
              </span>
            </template>
          </el-tree>
          <el-empty v-else description="暂无文档（来源未同步或为空）" :image-size="64" />
        </div>
      </aside>
      <section class="doc-section">
        <div class="file-path" v-if="view">{{ view.path }}</div>
        <DocViewer :view="view" />
      </section>
    </div>

    <el-drawer v-model="searchDrawer" title="检索结果" direction="rtl" size="460px" :close-on-click-modal="true">
      <div v-loading="searching" class="search-body">
        <el-empty v-if="!searching && !searchHits.length" description="无命中" :image-size="56" />
        <div
          v-for="(hit, i) in searchHits"
          :key="(hit.docFileId ?? '') + '_' + i"
          class="hit-item"
          @click="openHit(hit)"
        >
          <div class="hit-name">{{ hit.name }}</div>
          <div class="hit-meta">{{ hit.sourceName }} · {{ hit.path }}</div>
          <div class="hit-frag" v-if="hit.fragment" v-html="safeFrag(hit.fragment)"></div>
        </div>
        <div v-if="searchTotal > searchPageSize" class="search-pager">
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
// 默认 false = 检索全部公开来源；勾选后仅检索当前选中来源
const searchScopeCurrent = ref(false);

const treeProps = { label: 'label', children: 'children' };

interface TreeNode {
  label: string;
  path: string;
  fileId?: number | string;
  children?: TreeNode[];
}

onMounted(async () => {
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

async function onSearch() {
  if (!kw.value || !kw.value.trim()) {
    searchHits.value = [];
    searchTotal.value = 0;
    searchDrawer.value = true;
    return;
  }
  searchPageNum.value = 1;
  await doSearch();
}

async function onPageChange(p: number) {
  searchPageNum.value = p;
  await doSearch();
}

async function onScopeChange() {
  // 切换检索范围后，若已有查询词则立即重搜
  if (kw.value && kw.value.trim()) {
    searchPageNum.value = 1;
    await doSearch();
  }
}

async function doSearch() {
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
.doc-reader {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}
.doc-header {
  height: 52px;
  flex: 0 0 52px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}
.doc-header .title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
.doc-header .sub {
  color: #909399;
  font-size: 13px;
  margin-left: 4px;
}
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.search-input {
  width: 260px;
}
.doc-main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.doc-aside {
  flex: 0 0 300px;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}
.source-select {
  margin: 12px;
}
.tree-wrap {
  flex: 1 1 auto;
  overflow: auto;
  padding: 4px 8px 16px;
}
.doc-section {
  flex: 1 1 auto;
  overflow: auto;
  min-width: 0;
}
.file-path {
  padding: 10px 28px;
  font-size: 12px;
  color: #909399;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.tree-node {
  font-size: 14px;
  color: #303133;
  user-select: none;
}
.tree-node.is-active {
  color: #409eff;
  font-weight: 600;
}
.search-body {
  min-height: 120px;
}
.hit-item {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.hit-item:hover {
  background: #f5f7fa;
}
.hit-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}
.hit-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.hit-frag {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
.hit-frag :deep(mark) {
  background: #fff3bf;
  color: #d48806;
  padding: 0 2px;
  border-radius: 2px;
}
.search-pager {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
</style>
