<template>
  <div class="doc-viewer">
    <div v-if="!view" class="doc-empty">请从左侧选择一篇文档</div>
    <template v-else>
      <div v-if="view.type === 'md'" class="markdown-body" v-html="rendered"></div>
      <div v-else-if="view.type === 'html'" class="html-body" v-html="rendered"></div>
      <pre v-else-if="view.type === 'text'" class="text-body">{{ view.raw }}</pre>
      <div v-else class="doc-unsupported">
        <el-empty description="该格式暂不支持在线预览（docx/doc/pdf 待 M2b Tika）" :image-size="80" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { computed } from 'vue';
import type { DocFileViewVO } from '@/api/doc/public';

const props = defineProps<{ view: DocFileViewVO | null }>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch {
        // ignore
      }
    }
    return `<pre class="hljs"><code>${escapeHtml(str)}</code></pre>`;
  }
});

const rendered = computed<string>(() => {
  const v = props.view;
  if (!v) return '';
  if (v.type === 'md') {
    return DOMPurify.sanitize(md.render(v.raw || ''));
  }
  if (v.type === 'html') {
    return DOMPurify.sanitize(v.html || '');
  }
  return '';
});
</script>

<style scoped>
.doc-viewer {
  padding: 8px 28px 48px;
}
.doc-empty,
.doc-unsupported {
  padding: 96px 0;
  text-align: center;
  color: #909399;
}
.text-body {
  white-space: pre-wrap;
  word-break: break-word;
  background: #fafafa;
  padding: 16px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
}
.doc-viewer :deep(.markdown-body),
.doc-viewer :deep(.html-body) {
  font-size: 15px;
  line-height: 1.75;
  color: #333;
  word-break: break-word;
}
.doc-viewer :deep(.markdown-body h1),
.doc-viewer :deep(.html-body h1) {
  font-size: 1.8em;
  margin: 0.8em 0 0.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
}
.doc-viewer :deep(.markdown-body h2),
.doc-viewer :deep(.html-body h2) {
  font-size: 1.5em;
  margin: 0.8em 0 0.4em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
}
.doc-viewer :deep(.markdown-body h3),
.doc-viewer :deep(.html-body h3) {
  font-size: 1.25em;
  margin: 0.7em 0 0.4em;
}
.doc-viewer :deep(.markdown-body p),
.doc-viewer :deep(.html-body p) {
  margin: 0.6em 0;
}
.doc-viewer :deep(.markdown-body ul),
.doc-viewer :deep(.markdown-body ol),
.doc-viewer :deep(.html-body ul),
.doc-viewer :deep(.html-body ol) {
  padding-left: 1.6em;
  margin: 0.6em 0;
}
.doc-viewer :deep(.markdown-body code),
.doc-viewer :deep(.html-body code) {
  background: rgba(175, 184, 193, 0.2);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}
.doc-viewer :deep(.markdown-body pre),
.doc-viewer :deep(.html-body pre) {
  background: #f6f8fa;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.8em 0;
}
.doc-viewer :deep(.markdown-body pre code),
.doc-viewer :deep(.html-body pre code) {
  background: transparent;
  padding: 0;
  font-size: 13px;
}
.doc-viewer :deep(.markdown-body table),
.doc-viewer :deep(.html-body table) {
  border-collapse: collapse;
  margin: 0.8em 0;
}
.doc-viewer :deep(.markdown-body th),
.doc-viewer :deep(.markdown-body td),
.doc-viewer :deep(.html-body th),
.doc-viewer :deep(.html-body td) {
  border: 1px solid #dcdfe6;
  padding: 6px 12px;
}
.doc-viewer :deep(.markdown-body blockquote),
.doc-viewer :deep(.html-body blockquote) {
  border-left: 4px solid #dfe2e5;
  padding: 0 1em;
  color: #6a737d;
  margin: 0.8em 0;
}
.doc-viewer :deep(.markdown-body a),
.doc-viewer :deep(.html-body a) {
  color: #409eff;
  text-decoration: none;
}
.doc-viewer :deep(.markdown-body img),
.doc-viewer :deep(.html-body img) {
  max-width: 100%;
}
</style>
