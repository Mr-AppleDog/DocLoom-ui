export interface DocSourceVO extends BaseEntity {
  id: number | string;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fileExts: string;
  maxFileSize: number;
  publicVisible: string;
  syncMode: string;
  syncCron: string;
  lastSyncStatus: string;
  lastSyncTime: string;
  fileCount: number;
  remark: string;
  // 注意：不含 githubToken，密钥不下发前端
}

export interface DocSourceForm {
  id: number | string | undefined;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  githubToken: string;
  fileExts: string;
  maxFileSize: number;
  publicVisible: string;
  syncMode: string;
  syncCron: string;
  remark: string;
}

export interface DocSourceQuery extends PageQuery {
  name?: string;
  owner?: string;
  repo?: string;
  publicVisible?: string;
  syncMode?: string;
}

export interface DocSourceTestVO {
  reachable: boolean;
  fileCount: number;
  truncated: boolean;
  branch: string;
  message: string;
}
