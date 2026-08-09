<template>
  <div class="doc-reader">
    <header class="doc-header">
      <span class="title">DocLoom</span>
      <span class="sub" v-if="currentSource"> · {{ currentSource.owner }}/{{ currentSource.repo }}{{ currentSource.path ? '/' + currentSource.path : '' }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { listPublicSources, listPublicFiles, viewPublicFile } from '@/api/doc/public';
import type { PublicSourceVO, PublicFileVO, DocFileViewVO } from '@/api/doc/public';
import DocViewer from '../components/DocViewer.vue';

const route = useRoute();
const router = useRouter();

const sources = ref<PublicSourceVO[]>([]);
const sourceId = ref<number | string | null>(null);
const currentSource = ref<PublicSourceVO | null>(null);
const treeData = ref<TreeNode[]>([]);
const activeFileId = ref<number | string | null>(null);
const view = ref<DocFileViewVO | null>(null);

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
</style>
