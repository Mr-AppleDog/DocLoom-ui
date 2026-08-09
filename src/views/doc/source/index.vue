<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-[10px]">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入来源名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="owner" prop="owner">
              <el-input v-model="queryParams.owner" placeholder="GitHub owner" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="仓库名" prop="repo">
              <el-input v-model="queryParams.repo" placeholder="仓库名" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="是否公开" prop="publicVisible">
              <el-select v-model="queryParams.publicVisible" placeholder="是否公开" clearable style="width: 140px">
                <el-option v-for="o in publicVisibleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="同步方式" prop="syncMode">
              <el-select v-model="queryParams.syncMode" placeholder="同步方式" clearable style="width: 140px">
                <el-option v-for="o in syncModeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10" class="mb8">
          <el-col :span="1.5">
            <el-button v-hasPermi="['doc:source:add']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['doc:source:edit']" type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['doc:source:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="sourceList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="名称" align="center" prop="name" :show-overflow-tooltip="true" />
        <el-table-column label="仓库" align="center" min-width="180">
          <template #default="scope">
            <span>{{ scope.row.owner }}/{{ scope.row.repo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分支" align="center" prop="branch" width="120" :show-overflow-tooltip="true" />
        <el-table-column label="路径" align="center" prop="path" min-width="140" :show-overflow-tooltip="true">
          <template #default="scope">
            <span>{{ scope.row.path || '/' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="公开" align="center" prop="publicVisible" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.publicVisible === '1' ? 'success' : 'info'">
              {{ labelOf(publicVisibleOptions, scope.row.publicVisible) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步" align="center" prop="syncMode" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.syncMode === '1' ? 'warning' : 'info'">
              {{ labelOf(syncModeOptions, scope.row.syncMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="文件数" align="center" prop="fileCount" width="80" />
        <el-table-column label="同步状态" align="center" prop="lastSyncStatus" width="90">
          <template #default="scope">
            <el-tooltip :content="scope.row.lastSyncMsg || '无同步信息'" placement="top" :disabled="!scope.row.lastSyncMsg">
              <el-tag :type="syncStatusTag(scope.row.lastSyncStatus)">
                {{ labelOf(syncStatusOptions, scope.row.lastSyncStatus) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="最近同步" align="center" prop="lastSyncTime" width="160">
          <template #default="scope">
            <span>{{ scope.row.lastSyncTime ? proxy?.parseTime(scope.row.lastSyncTime) : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="230" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button v-hasPermi="['doc:source:sync']" link type="warning" icon="Refresh" :loading="syncingId === scope.row.id" @click="handleSync(scope.row)">同步</el-button>
            <el-button v-hasPermi="['doc:source:test']" link type="primary" icon="Connection" @click="handleTestRow(scope.row)">测试</el-button>
            <el-button v-hasPermi="['doc:source:edit']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
            <el-button v-hasPermi="['doc:source:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
    </el-card>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="640px" append-to-body>
      <el-form ref="sourceFormRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="来源名称" prop="name">
              <el-input v-model="form.name" placeholder="如：RuoYi-Vue-Plus 文档" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="owner" prop="owner">
              <el-input v-model="form.owner" placeholder="如 dromara" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="仓库名" prop="repo">
              <el-input v-model="form.repo" placeholder="如 RuoYi-Vue-Plus" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分支" prop="branch">
              <el-input v-model="form.branch" placeholder="留空使用仓库默认分支" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="子路径" prop="path">
              <el-input v-model="form.path" placeholder="如 docs/，留空为根目录" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="GitHub Token" prop="githubToken">
              <el-input v-model="form.githubToken" type="password" show-password placeholder="可选，留空使用全局默认 / 编辑时留空保留原值" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="扩展名" prop="fileExts">
              <el-input v-model="form.fileExts" placeholder="逗号分隔，如 md,docx,doc,pdf,txt" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="大小上限(KB)" prop="maxFileSize">
              <el-input-number v-model="form.maxFileSize" :min="1" :step="1024" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否公开" prop="publicVisible">
              <el-select v-model="form.publicVisible">
                <el-option v-for="o in publicVisibleOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="同步方式" prop="syncMode">
              <el-select v-model="form.syncMode">
                <el-option v-for="o in syncModeOptions" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="定时表达式" prop="syncCron" v-if="form.syncMode === '1'">
              <el-input v-model="form.syncCron" placeholder="syncMode=定时 时填写" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="testLoading" @click="handleTest">连通性测试</el-button>
          <el-button @click="cancel">取 消</el-button>
          <el-button type="primary" @click="submitForm">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="DocSource" lang="ts">
import { listSource, getSource, delSource, addSource, updateSource, testSource, syncSource } from '@/api/doc/source';
import { DocSourceForm, DocSourceQuery, DocSourceTestVO, DocSourceVO } from '@/api/doc/source/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const sourceList = ref<DocSourceVO[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<number | string>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const testLoading = ref(false);
const syncingId = ref<number | string | null>(null);

const queryFormRef = ref<ElFormInstance>();
const sourceFormRef = ref<ElFormInstance>();
const dialog = reactive<DialogOption>({ visible: false, title: '' });

const publicVisibleOptions = [
  { label: '公开', value: '1' },
  { label: '私有', value: '0' }
];
const syncModeOptions = [
  { label: '手动', value: '0' },
  { label: '定时', value: '1' }
];
const syncStatusOptions = [
  { label: '失败', value: '0' },
  { label: '成功', value: '1' },
  { label: '进行中', value: '2' }
];

const labelOf = (opts: { label: string; value: string }[], v?: string) => {
  return opts.find((o) => o.value === v)?.label ?? v ?? '—';
};
const syncStatusTag = (v?: string) => (v === '1' ? 'success' : v === '2' ? 'warning' : 'danger');

const initFormData: DocSourceForm = {
  id: undefined,
  name: '',
  owner: '',
  repo: '',
  branch: 'main',
  path: '',
  githubToken: '',
  fileExts: 'md,docx,doc,pdf,txt',
  maxFileSize: 10240,
  publicVisible: '0',
  syncMode: '0',
  syncCron: '',
  remark: ''
};

const data = reactive<PageData<DocSourceForm, DocSourceQuery>>({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: '',
    owner: '',
    repo: '',
    publicVisible: '',
    syncMode: ''
  },
  rules: {
    name: [{ required: true, message: '来源名称不能为空', trigger: 'blur' }],
    owner: [{ required: true, message: '仓库 owner 不能为空', trigger: 'blur' }],
    repo: [{ required: true, message: '仓库名不能为空', trigger: 'blur' }]
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询列表 */
const getList = async () => {
  loading.value = true;
  const res = await listSource(queryParams.value);
  sourceList.value = res.rows;
  total.value = res.total;
  loading.value = false;
};
/** 取消 */
const cancel = () => {
  reset();
  dialog.visible = false;
};
/** 重置表单 */
const reset = () => {
  form.value = { ...initFormData };
  sourceFormRef.value?.resetFields();
};
/** 搜索 */
const handleQuery = () => {
  queryParams.value.pageNum = 1;
  getList();
};
/** 重置搜索 */
const resetQuery = () => {
  queryFormRef.value?.resetFields();
  handleQuery();
};
/** 多选 */
const handleSelectionChange = (selection: DocSourceVO[]) => {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
};
/** 新增 */
const handleAdd = () => {
  reset();
  dialog.visible = true;
  dialog.title = '新增文档来源';
};
/** 修改 */
const handleUpdate = async (row?: DocSourceVO) => {
  reset();
  const id = row?.id || ids.value[0];
  const res = await getSource(id);
  Object.assign(form.value, res.data);
  form.value.githubToken = '';
  dialog.visible = true;
  dialog.title = '修改文档来源';
};
/** 提交 */
const submitForm = () => {
  sourceFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      form.value.id ? await updateSource(form.value) : await addSource(form.value);
      proxy?.$modal.msgSuccess('操作成功');
      dialog.visible = false;
      await getList();
    }
  });
};
/** 删除 */
const handleDelete = async (row?: DocSourceVO) => {
  const delIds = row?.id || ids.value;
  await proxy?.$modal.confirm('是否确认删除文档来源编号为"' + delIds + '"的数据项？');
  await delSource(delIds);
  await getList();
  proxy?.$modal.msgSuccess('删除成功');
};
/** 触发同步 */
const handleSync = async (row: DocSourceVO) => {
  syncingId.value = row.id;
  try {
    const res = await syncSource(row.id);
    const r = res.data;
    if (r.lastSyncStatus === '1') {
      proxy?.$modal.msgSuccess('同步完成：' + (r.lastSyncMsg || '成功'));
    } else {
      proxy?.$modal.msgError('同步未完成：' + (r.lastSyncMsg || '失败'));
    }
    await getList();
  } finally {
    syncingId.value = null;
  }
};
/** 连通性测试（表单内） */
const handleTest = async () => {
  await sourceFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    testLoading.value = true;
    try {
      const res = await testSource(form.value);
      showTestResult(res.data);
    } finally {
      testLoading.value = false;
    }
  });
};
/** 连通性测试（行） */
const handleTestRow = async (row: DocSourceVO) => {
  // 行内测试：加载详情后用保存的 token 测试（编辑态留空会回退全局默认）
  const res = await getSource(row.id);
  const payload: DocSourceForm = { ...res.data, githubToken: '' } as DocSourceForm;
  testLoading.value = true;
  try {
    const r = await testSource(payload);
    showTestResult(r.data);
  } finally {
    testLoading.value = false;
  }
};
/** 展示测试结果 */
const showTestResult = (r: DocSourceTestVO) => {
  if (r.reachable) {
    proxy?.$modal.msgSuccess(`可达 ✓  分支：${r.branch}  候选文件：${r.fileCount}${r.truncated ? '（树被截断）' : ''}`);
  } else {
    proxy?.$modal.msgError(`不可达：${r.message || '未知原因'}`);
  }
};

onMounted(() => {
  getList();
});
</script>
