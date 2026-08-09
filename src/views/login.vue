<template>
  <div class="dl-login">
    <!-- 织布面板：签名元素（CSS 经纬交织） -->
    <aside class="dl-loom-panel">
      <div class="dl-loom-panel__inner">
        <span class="dl-brand__mark">DocLoom</span>
        <p class="dl-thesis">将散落各处的文档，<br />织成一张可检索的布。</p>
      </div>
      <div class="dl-loom-panel__foot">GitHub 拉取 · 渲染 · 全文检索</div>
    </aside>

    <!-- 表单侧 -->
    <main class="dl-form-side">
      <div class="dl-form-side__head">
        <div class="dl-brand dl-brand--sm">
          <span class="dl-brand__mark">DocLoom</span>
        </div>
        <lang-select />
      </div>

      <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
        <p class="dl-form-side__sub">{{ title }}</p>
        <el-form-item v-if="tenantEnabled" prop="tenantId">
          <el-select v-model="loginForm.tenantId" filterable :placeholder="proxy.$t('login.selectPlaceholder')" style="width: 100%">
            <el-option v-for="item in tenantList" :key="item.tenantId" :label="item.companyName" :value="item.tenantId"></el-option>
            <template #prefix><svg-icon icon-class="company" class="el-input__icon input-icon" /></template>
          </el-select>
        </el-form-item>
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" type="text" size="large" auto-complete="off" :placeholder="proxy.$t('login.username')">
            <template #prefix><svg-icon icon-class="user" class="el-input__icon input-icon" /></template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            size="large"
            auto-complete="off"
            :placeholder="proxy.$t('login.password')"
            @keyup.enter="handleLogin"
          >
            <template #prefix><svg-icon icon-class="password" class="el-input__icon input-icon" /></template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="captchaEnabled" prop="code">
          <el-input
            v-model="loginForm.code"
            size="large"
            auto-complete="off"
            :placeholder="proxy.$t('login.code')"
            style="width: 63%"
            @keyup.enter="handleLogin"
          >
            <template #prefix><svg-icon icon-class="validCode" class="el-input__icon input-icon" /></template>
          </el-input>
          <div class="login-code">
            <img :src="codeUrl" class="login-code-img" @click="getCode" />
          </div>
        </el-form-item>
        <el-checkbox v-model="loginForm.rememberMe" class="dl-remember">{{ proxy.$t('login.rememberPassword') }}</el-checkbox>
        <div class="dl-social">
          <el-button circle :title="proxy.$t('login.social.wechat')" @click="doSocialLogin('wechat')">
            <svg-icon icon-class="wechat" />
          </el-button>
          <el-button circle :title="proxy.$t('login.social.maxkey')" @click="doSocialLogin('maxkey')">
            <svg-icon icon-class="maxkey" />
          </el-button>
          <el-button circle :title="proxy.$t('login.social.topiam')" @click="doSocialLogin('topiam')">
            <svg-icon icon-class="topiam" />
          </el-button>
          <el-button circle :title="proxy.$t('login.social.gitee')" @click="doSocialLogin('gitee')">
            <svg-icon icon-class="gitee" />
          </el-button>
          <el-button circle :title="proxy.$t('login.social.github')" @click="doSocialLogin('github')">
            <svg-icon icon-class="github" />
          </el-button>
        </div>
        <el-form-item class="dl-submit-item">
          <el-button :loading="loading" size="large" type="primary" class="dl-submit" @click.prevent="handleLogin">
            <span v-if="!loading">{{ proxy.$t('login.login') }}</span>
            <span v-else>{{ proxy.$t('login.logging') }}</span>
          </el-button>
          <div v-if="register" class="dl-register">
            <router-link class="link-type" :to="'/register'">{{ proxy.$t('login.switchRegisterPage') }}</router-link>
          </div>
        </el-form-item>
      </el-form>

      <div class="el-login-footer">
        <span>Copyright © 2018-2026 疯狂的狮子Li All Rights Reserved.</span>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { getCodeImg, getTenantList } from '@/api/login';
import { authRouterUrl } from '@/api/system/social/auth';
import { useUserStore } from '@/store/modules/user';
import { LoginData, TenantVO } from '@/api/types';
import { to } from 'await-to-js';
import { HttpStatus } from '@/enums/RespEnum';
import { useI18n } from 'vue-i18n';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const title = import.meta.env.VITE_APP_TITLE;
const userStore = useUserStore();
const router = useRouter();
const { t } = useI18n();

const loginForm = ref<LoginData>({
  tenantId: '000000',
  username: 'admin',
  password: 'admin123',
  rememberMe: false,
  code: '',
  uuid: ''
} as LoginData);

const loginRules: ElFormRules = {
  tenantId: [{ required: true, trigger: 'blur', message: t('login.rule.tenantId.required') }],
  username: [{ required: true, trigger: 'blur', message: t('login.rule.username.required') }],
  password: [{ required: true, trigger: 'blur', message: t('login.rule.password.required') }],
  code: [{ required: true, trigger: 'change', message: t('login.rule.code.required') }]
};

const codeUrl = ref('');
const loading = ref(false);
// 验证码开关
const captchaEnabled = ref(true);
// 租户开关
const tenantEnabled = ref(true);

// 注册开关
const register = ref(false);
const redirect = ref('/');
const loginRef = ref<ElFormInstance>();
// 租户列表
const tenantList = ref<TenantVO[]>([]);

watch(
  () => router.currentRoute.value,
  (newRoute: any) => {
    redirect.value = newRoute.query && newRoute.query.redirect && decodeURIComponent(newRoute.query.redirect);
  },
  { immediate: true }
);

const handleLogin = () => {
  loginRef.value?.validate(async (valid: boolean, fields: any) => {
    if (valid) {
      loading.value = true;
      // 勾选了需要记住密码设置在 localStorage 中设置记住用户名和密码
      if (loginForm.value.rememberMe) {
        localStorage.setItem('tenantId', String(loginForm.value.tenantId));
        localStorage.setItem('username', String(loginForm.value.username));
        localStorage.setItem('password', String(loginForm.value.password));
        localStorage.setItem('rememberMe', String(loginForm.value.rememberMe));
      } else {
        // 否则移除
        localStorage.removeItem('tenantId');
        localStorage.removeItem('username');
        localStorage.removeItem('password');
        localStorage.removeItem('rememberMe');
      }
      // 调用action的登录方法
      const [err] = await to(userStore.login(loginForm.value));
      if (!err) {
        const redirectUrl = redirect.value || '/';
        await router.push(redirectUrl);
        loading.value = false;
      } else {
        loading.value = false;
        // 重新获取验证码
        if (captchaEnabled.value) {
          await getCode();
        }
      }
    } else {
      console.log('error submit!', fields);
    }
  });
};

/**
 * 获取验证码
 */
const getCode = async () => {
  const res = await getCodeImg();
  const { data } = res;
  captchaEnabled.value = data.captchaEnabled === undefined ? true : data.captchaEnabled;
  if (captchaEnabled.value) {
    // 刷新验证码时清空输入框
    loginForm.value.code = '';
    codeUrl.value = 'data:image/gif;base64,' + data.img;
    loginForm.value.uuid = data.uuid;
  }
};

const getLoginData = () => {
  const tenantId = localStorage.getItem('tenantId');
  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');
  const rememberMe = localStorage.getItem('rememberMe');
  loginForm.value = {
    tenantId: tenantId === null ? String(loginForm.value.tenantId) : tenantId,
    username: username === null ? String(loginForm.value.username) : username,
    password: password === null ? String(loginForm.value.password) : String(password),
    rememberMe: rememberMe === null ? false : Boolean(rememberMe)
  } as LoginData;
};

/**
 * 获取租户列表
 */
const initTenantList = async () => {
  const { data } = await getTenantList(false);
  tenantEnabled.value = data.tenantEnabled === undefined ? true : data.tenantEnabled;
  if (tenantEnabled.value) {
    tenantList.value = data.voList;
    if (tenantList.value != null && tenantList.value.length !== 0) {
      loginForm.value.tenantId = tenantList.value[0].tenantId;
    }
  }
};

/**
 * 第三方登录
 * @param type
 */
const doSocialLogin = (type: string) => {
  authRouterUrl(type, loginForm.value.tenantId).then((res: any) => {
    if (res.code === HttpStatus.SUCCESS) {
      // 获取授权地址跳转
      window.location.href = res.data;
    } else {
      ElMessage.error(res.msg);
    }
  });
};

onMounted(() => {
  getCode();
  initTenantList();
  getLoginData();
});
</script>

<style lang="scss" scoped>
.dl-login {
  display: grid;
  grid-template-columns: 1fr 480px;
  min-height: 100%;
  background: var(--dl-cloth);
  font-family: var(--dl-body);
  color: var(--dl-link);
}

/* —— 织布面板（签名） —— */
.dl-loom-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dl-loom);
}
.dl-loom-panel__inner {
  position: relative;
  z-index: 1;
  padding: 0 56px;
  max-width: 440px;
}
.dl-brand__mark {
  font-family: var(--dl-display);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}
.dl-loom-panel .dl-brand__mark {
  font-size: 46px;
  line-height: 1.1;
}
.dl-thesis {
  font-family: var(--dl-display);
  font-weight: 400;
  font-size: 21px;
  line-height: 1.55;
  color: rgba(232, 230, 223, 0.82);
  margin: 22px 0 0;
  max-width: 22ch;
}
.dl-loom-panel__foot {
  position: absolute;
  bottom: 26px;
  left: 56px;
  z-index: 1;
  font-size: 12px;
  color: rgba(232, 230, 223, 0.42);
}

/* —— 表单侧 —— */
.dl-form-side {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 40px 56px 0;
  background: var(--dl-cloth);
}
.dl-form-side__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dl-brand--sm .dl-brand__mark {
  font-size: 22px;
  color: var(--dl-link);
}
.dl-form-side__sub {
  margin: 4px 0 22px;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--dl-weft);
}

.login-form {
  width: 100%;
  max-width: 380px;
}
.login-form :deep(.el-input) {
  height: 44px;
  input {
    height: 44px;
  }
}
.login-form :deep(.el-input__wrapper) {
  background: var(--dl-cloth-2);
  box-shadow: 0 0 0 1px var(--dl-selvedge) inset;
  border-radius: var(--app-radius-md);
  transition: box-shadow 0.18s ease;
}
.login-form :deep(.el-input__wrapper.is-focus),
.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1.5px var(--dl-accent) inset;
}
.login-form :deep(.el-form-item__error) {
  color: #d16060;
}
.input-icon {
  height: 39px;
  width: 14px;
  margin-left: 2px;
  color: var(--dl-weft);
}
.dl-remember {
  margin: 0 0 22px;
  color: var(--dl-weft);
}
.dl-social {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.dl-social :deep(.el-button.is-circle) {
  background: var(--dl-cloth-2);
  border: 1px solid var(--dl-selvedge);
  color: var(--dl-weft);
}
.dl-social :deep(.el-button.is-circle:hover) {
  border-color: var(--dl-accent);
  color: var(--dl-accent);
}
.dl-submit-item {
  width: 100%;
  margin-bottom: 0;
}
.dl-submit {
  width: 100%;
  height: 46px;
  border-radius: var(--app-radius-md);
  --el-button-bg-color: var(--dl-accent);
  --el-button-border-color: var(--dl-accent);
  --el-button-hover-bg-color: #7a3225;
  --el-button-hover-border-color: #7a3225;
  --el-button-active-bg-color: #6b2b20;
  --el-button-active-border-color: #6b2b20;
  box-shadow: 0 2px 8px rgba(142, 58, 43, 0.18);
}
.dl-register {
  float: right;
  margin-top: 8px;
  font-size: 13px;
}
.link-type {
  color: var(--dl-accent);
}

.login-code {
  width: calc(37% - 10px);
  height: 44px;
  float: right;
  margin-left: 10px;
  box-sizing: border-box;
  border-radius: var(--app-radius-sm);
  overflow: hidden;
  background: var(--dl-cloth-2);
  border: 1px solid var(--dl-selvedge);
  img {
    cursor: pointer;
    vertical-align: middle;
    display: block;
    width: 100%;
    height: 44px;
    object-fit: cover;
  }
}
.login-code-img {
  height: 44px;
  padding-left: 0;
}

.el-login-footer {
  margin-top: auto;
  padding: 24px 0 22px;
  font-family: Arial, serif;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--dl-weft);
  opacity: 0.8;
}

/* —— 响应式：窄屏隐藏织布面板，表单居中 —— */
@media (max-width: 960px) {
  .dl-login {
    grid-template-columns: 1fr;
  }
  .dl-loom-panel {
    display: none;
  }
  .dl-form-side {
    padding: 36px 22px 0;
    align-items: center;
  }
  .dl-form-side__head,
  .login-form,
  .el-login-footer {
    width: 100%;
    max-width: 380px;
  }
}

:global(html.dark) {
  .dl-social :deep(.el-button.is-circle) {
    background: var(--dl-cloth-2);
    border-color: var(--dl-selvedge);
  }
  .el-login-footer {
    color: var(--dl-weft);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
