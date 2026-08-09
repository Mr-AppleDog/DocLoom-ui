import request from '@/utils/request';
import { DocSourceForm, DocSourceQuery, DocSourceTestVO, DocSourceVO } from './types';
import { AxiosPromise } from 'axios';

// 查询文档来源列表
export function listSource(query: DocSourceQuery): AxiosPromise<DocSourceVO[]> {
  return request({
    url: '/doc/source/list',
    method: 'get',
    params: query
  });
}

// 查询文档来源详细
export function getSource(id: string | number): AxiosPromise<DocSourceVO> {
  return request({
    url: '/doc/source/' + id,
    method: 'get'
  });
}

// 新增文档来源
export function addSource(data: DocSourceForm) {
  return request({
    url: '/doc/source',
    method: 'post',
    data: data
  });
}

// 修改文档来源
export function updateSource(data: DocSourceForm) {
  return request({
    url: '/doc/source',
    method: 'put',
    data: data
  });
}

// 删除文档来源
export function delSource(id: string | number | Array<string | number>) {
  return request({
    url: '/doc/source/' + id,
    method: 'delete'
  });
}

// 连通性校验：校验仓库/分支/路径可达并统计候选文件数
export function testSource(data: DocSourceForm): AxiosPromise<DocSourceTestVO> {
  return request({
    url: '/doc/source/test',
    method: 'post',
    data: data
  });
}

// 触发同步（异步：立即返回提交信息，后台执行；进度经 getSource 轮询来源状态）
export function syncSource(sourceId: string | number): AxiosPromise<string> {
  return request({
    url: '/doc/sync/' + sourceId,
    method: 'post'
  });
}
