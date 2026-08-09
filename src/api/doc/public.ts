import request from '@/utils/request';
import { AxiosPromise } from 'axios';

export interface PublicSourceVO {
  id: number | string;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fileCount: number;
  remark: string;
}

export interface PublicFileVO {
  id: number | string;
  sourceId: number | string;
  path: string;
  name: string;
  ext: string;
  size: number;
  syncTime: string;
}

export interface DocFileViewVO {
  id: number | string;
  sourceId: number | string;
  path: string;
  name: string;
  ext: string;
  type: 'md' | 'html' | 'text' | 'unsupported';
  raw: string;
  html: string;
}

// 公开来源列表（匿名）
export function listPublicSources(): AxiosPromise<PublicSourceVO[]> {
  return request({
    url: '/doc/public/sources',
    method: 'get'
  });
}

// 某来源文档列表（扁平，前端构建树）
export function listPublicFiles(sourceId: string | number): AxiosPromise<PublicFileVO[]> {
  return request({
    url: '/doc/public/tree/' + sourceId,
    method: 'get'
  });
}

// 取文档渲染体
export function viewPublicFile(id: string | number): AxiosPromise<DocFileViewVO> {
  return request({
    url: '/doc/public/view/' + id,
    method: 'get'
  });
}

// 文档检索命中
export interface DocSearchHitVO {
  docFileId: number | string;
  sourceId: number | string;
  sourceName: string;
  path: string;
  name: string;
  ext: string;
  fragment: string;
  score: number | null;
}

// TableDataInfo 响应（后端按全局列表约定未用 R 包装，直接返回）
export interface TableResult<T> {
  rows: T[];
  total: number;
  code: number;
  msg: string;
}

export interface SearchPublicParams {
  kw: string;
  sourceId?: number | string;
  pageNum?: number;
  pageSize?: number;
}

// 公开检索（匿名；ES 不可用降级 MySQL LIKE；仅检索公开来源）
export function searchPublic(params: SearchPublicParams): Promise<TableResult<DocSearchHitVO>> {
  return request({
    url: '/doc/public/search',
    method: 'get',
    params
  }) as unknown as Promise<TableResult<DocSearchHitVO>>;
}
