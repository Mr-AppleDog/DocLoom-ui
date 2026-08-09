<template>
  <div class="doc-viewer">
    <div v-if="!view" class="doc-empty">从左侧选一篇文档开始阅读</div>
    <template v-else>
      <div v-if="view.type === 'md'" ref="containerRef" class="markdown-body" v-html="rendered"></div>
      <div v-else-if="view.type === 'html'" class="html-body" v-html="rendered"></div>
      <pre v-else-if="view.type === 'text'" class="text-body">{{ view.raw }}</pre>
      <div v-else class="doc-unsupported">
        <el-empty description="该格式暂不支持在线预览（docx / doc / pdf 等稍后支持）" :image-size="80" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import { computed, nextTick, ref, watch } from 'vue';
import type { DocFileViewVO } from '@/api/doc/public';

const props = defineProps<{ view: DocFileViewVO | null }>();
const emit = defineEmits(['toc']);

const containerRef = ref<HTMLElement | null>(null);

// mermaid 单例初始化：strict 自带 SVG 输出消毒，安全
mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });

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
    // mermaid 围栏：输出占位 div，渲染后由 mermaid.run 替换为 SVG
    if (lang === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(str)}</div>`;
    }
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

// 渲染结果变化后（文件切换），在 DOM 更新完跑 mermaid，并给代码块挂复制按钮
watch(rendered, () => {
  nextTick(async () => {
    if (!containerRef.value) return;
    const els = containerRef.value.querySelectorAll<HTMLElement>('.mermaid');
    if (els.length) {
      try {
        await mermaid.run({ nodes: Array.from(els) });
      } catch {
        // 单图语法错忽略，避免阻塞其他图与页面
      }
    }
    containerRef.value.querySelectorAll('pre').forEach(attachCopyButton);
    // 标题加锚点 id + 上报 TOC
    const heads = containerRef.value.querySelectorAll<HTMLElement>('h1, h2, h3, h4');
    const list: { id: string; level: number; text: string }[] = [];
    const used = new Set<string>();
    heads.forEach((h) => {
      const text = (h.textContent || '').trim();
      let id = text.toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
      let uid = id;
      let n = 2;
      while (used.has(uid)) uid = `${id}-${n++}`;
      used.add(uid);
      h.id = uid;
      list.push({ id: uid, level: Number(h.tagName.slice(1)), text });
    });
    emit('toc', list);
  });
});

/** 给代码块包一层 .dl-code 并挂复制按钮（已包装则跳过） */
function attachCopyButton(pre: HTMLPreElement) {
  if (pre.parentElement?.classList.contains('dl-code')) return;
  const fig = document.createElement('div');
  fig.className = 'dl-code';
  pre.parentNode?.insertBefore(fig, pre);
  fig.appendChild(pre);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dl-code__copy';
  btn.textContent = '复制';
  btn.addEventListener('click', () => copyCode(btn, pre));
  fig.appendChild(btn);
}

/** 复制代码块文本：优先剪贴板 API，失败回退选区 + execCommand */
async function copyCode(btn: HTMLButtonElement, pre: HTMLElement) {
  const text = (pre.innerText || '').replace(/\u00a0/g, ' ');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    try {
      document.execCommand('copy');
    } catch {
      // ignore
    }
    sel?.removeAllRanges();
  }
  btn.textContent = '已复制';
  window.setTimeout(() => {
    btn.textContent = '复制';
  }, 1500);
}
</script>

<style scoped>
.doc-viewer {
  padding: 28px clamp(20px, 5vw, 64px) 64px;
  font-family: var(--dl-body);
  color: var(--dl-link);
}
.doc-viewer :deep(.markdown-body),
.doc-viewer :deep(.html-body) {
  max-width: 760px;
  margin: 0 auto;
  font-size: 15.5px;
  line-height: 1.78;
  word-break: break-word;
}
.doc-viewer :deep(.markdown-body h1),
.doc-viewer :deep(.markdown-body h2),
.doc-viewer :deep(.markdown-body h3),
.doc-viewer :deep(.markdown-body h4),
.doc-viewer :deep(.html-body h1),
.doc-viewer :deep(.html-body h2),
.doc-viewer :deep(.html-body h3),
.doc-viewer :deep(.html-body h4) {
  scroll-margin-top: 16px;
}
.doc-empty,
.doc-unsupported {
  padding: 110px 24px;
  text-align: center;
  color: var(--dl-weft);
  font-size: 14px;
}
.text-body {
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 960px;
  margin: 0 auto;
  background: var(--dl-cloth-2);
  color: var(--dl-link);
  padding: 18px 20px;
  border: 1px solid var(--dl-selvedge);
  border-radius: var(--app-radius-md);
  font-family: var(--dl-mono);
  font-size: 13px;
  line-height: 1.65;
}

.doc-viewer :deep(.markdown-body h1),
.doc-viewer :deep(.html-body h1) {
  font-family: var(--dl-display);
  font-size: 1.95em;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 1.1em 0 0.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--dl-selvedge);
}
.doc-viewer :deep(.markdown-body h2),
.doc-viewer :deep(.html-body h2) {
  font-family: var(--dl-display);
  font-size: 1.5em;
  font-weight: 600;
  margin: 1.1em 0 0.45em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--dl-selvedge);
}
.doc-viewer :deep(.markdown-body h3),
.doc-viewer :deep(.html-body h3) {
  font-family: var(--dl-display);
  font-size: 1.2em;
  font-weight: 600;
  margin: 1em 0 0.4em;
}
.doc-viewer :deep(.markdown-body h4),
.doc-viewer :deep(.html-body h4) {
  font-size: 1em;
  font-weight: 600;
  margin: 1em 0 0.35em;
}
.doc-viewer :deep(.markdown-body p),
.doc-viewer :deep(.html-body p) {
  margin: 0.7em 0;
}
.doc-viewer :deep(.markdown-body ul),
.doc-viewer :deep(.markdown-body ol),
.doc-viewer :deep(.html-body ul),
.doc-viewer :deep(.html-body ol) {
  padding-left: 1.6em;
  margin: 0.7em 0;
}
.doc-viewer :deep(.markdown-body li),
.doc-viewer :deep(.html-body li) {
  margin: 0.25em 0;
}
.doc-viewer :deep(.markdown-body code),
.doc-viewer :deep(.html-body code) {
  background: var(--dl-cloth-2);
  color: var(--dl-link);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-family: var(--dl-mono);
  font-size: 0.88em;
}
.doc-viewer :deep(.markdown-body pre),
.doc-viewer :deep(.html-body pre) {
  border: 1px solid var(--dl-selvedge);
  padding: 14px 16px;
  border-radius: var(--app-radius-md);
  overflow-x: auto;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}
.doc-viewer :deep(.dl-code) {
  position: relative;
  margin: 1em 0;
}
.doc-viewer :deep(.dl-code__copy) {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  font-family: var(--dl-body);
  font-size: 12px;
  line-height: 1;
  padding: 5px 9px;
  border: 1px solid var(--dl-selvedge);
  border-radius: var(--app-radius-sm);
  background: var(--dl-cloth);
  color: var(--dl-weft);
  cursor: pointer;
  opacity: 0.75;
}
.doc-viewer :deep(.dl-code__copy:hover) {
  opacity: 1;
  color: var(--dl-accent);
  border-color: var(--dl-accent);
}
.doc-viewer :deep(.markdown-body pre code),
.doc-viewer :deep(.html-body pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 13px;
}
.doc-viewer :deep(.markdown-body table),
.doc-viewer :deep(.html-body table) {
  border-collapse: collapse;
  margin: 1em 0;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.doc-viewer :deep(.markdown-body th),
.doc-viewer :deep(.markdown-body td),
.doc-viewer :deep(.html-body th),
.doc-viewer :deep(.html-body td) {
  border: 1px solid var(--dl-selvedge);
  padding: 8px 13px;
  font-size: 14px;
}
.doc-viewer :deep(.markdown-body th),
.doc-viewer :deep(.html-body th) {
  background: var(--dl-cloth-2);
  font-weight: 600;
}
.doc-viewer :deep(.markdown-body blockquote),
.doc-viewer :deep(.html-body blockquote) {
  border-left: 3px solid var(--dl-accent);
  background: var(--dl-cloth-2);
  padding: 0.4em 1em;
  color: var(--dl-weft);
  margin: 1em 0;
}
.doc-viewer :deep(.markdown-body a),
.doc-viewer :deep(.html-body a) {
  color: var(--dl-accent);
  text-decoration: none;
  border-bottom: 1px solid rgba(142, 58, 43, 0.4);
}
.doc-viewer :deep(.markdown-body a:hover),
.doc-viewer :deep(.html-body a:hover) {
  border-bottom-color: var(--dl-accent);
}
.doc-viewer :deep(.markdown-body img),
.doc-viewer :deep(.html-body img) {
  max-width: 100%;
  border-radius: var(--app-radius-sm);
}
.doc-viewer :deep(.markdown-body hr),
.doc-viewer :deep(.html-body hr) {
  border: 0;
  border-top: 1px solid var(--dl-selvedge);
  margin: 1.6em 0;
}

@media (max-width: 640px) {
  .doc-viewer {
    padding: 18px 16px 48px;
  }
  .doc-viewer :deep(.markdown-body),
  .doc-viewer :deep(.html-body) {
    font-size: 15px;
  }
}
</style>
