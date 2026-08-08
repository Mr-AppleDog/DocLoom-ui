# 构建阶段(node 20, 完整版带构建工具,避免原生依赖编译失败)
FROM node:20 AS build
WORKDIR /app
# 淘宝 npm 镜像,国内装依赖快
RUN npm config set registry https://registry.npmmirror.com
# plus-ui .gitignore 忽略 lock 文件,无 lock -> 用 npm install
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# 生产构建 -> dist/
RUN npm run build:prod

# 运行阶段: nginx 托管静态资源 + 反代 /prod-api 到后端
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
