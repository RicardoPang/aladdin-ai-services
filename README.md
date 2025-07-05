# Aladdin AI Services

### 从零到1实现

#### 1. NestJS架构

本项目基于NestJS框架构建，采用模块化设计，主要包含以下模块：

- **AppModule**：应用程序的根模块，整合所有子模块
- **DatabaseModule**：数据库连接和管理模块
- **AgentsModule**：Agent管理模块
- **JobsModule**：任务管理模块
- **MatchingModule**：智能任务匹配模块

项目实现了完整的MVC架构，每个功能模块都包含Controller、Service和DTO层，确保了代码的清晰分离和可维护性。

#### 2. AWS Aurora PostgreSQL集成

项目成功集成了AWS Aurora PostgreSQL数据库，同时支持开发环境使用本地PostgreSQL：

- **环境隔离**：通过`.env.development`和`.env.production`配置文件区分开发和生产环境
- **数据库保活机制**：实现了`AuroraWarmupService`服务，通过定时任务保持数据库连接活跃，防止AWS Aurora自动休眠
- **连接池管理**：优化了数据库连接池配置，提高了系统稳定性和性能
- **安全凭证管理**：通过`.db-credentials.json`文件和`get-db-url.js`脚本安全管理数据库凭证，避免敏感信息泄露

#### 3. Prisma ORM数据库管理

采用Prisma ORM进行数据库操作，实现了：

- **类型安全**：利用Prisma生成的TypeScript类型定义，确保数据库操作的类型安全
- **模型定义**：通过`schema.prisma`文件定义数据库模型和关系
- **数据迁移**：支持数据库结构的版本控制和迁移
- **多Schema支持**：通过Prisma的`multiSchema`特性支持PostgreSQL的Schema隔离

#### 4. 数据库模型设计

设计了完整的数据库模型，包括：

- **Agent模型**：存储AI代理的信息，包括名称、地址、描述、分类等
- **Job模型**：存储任务信息，包括标题、描述、预算、截止日期等
- **JobDistributionRecord模型**：记录任务分发信息
- **JobDistributionAgent模型**：记录任务分发给Agent的详细信息和执行状态
- **Category模型**：存储分类信息

模型之间建立了合理的关联关系，支持复杂的业务查询需求。

#### 5. 全局异常处理和响应格式统一

实现了全局异常处理和响应格式统一：

- **HttpExceptionFilter**：捕获并处理HTTP异常，提供统一的错误响应格式
- **TransformInterceptor**：拦截所有响应，统一转换为标准格式，包含状态码、消息和时间戳
- **ValidationPipe**：全局验证管道，自动验证请求数据的合法性

#### 6. 智能任务匹配系统

实现了基于分类和标签的智能任务匹配系统：

- **多维度匹配算法**：基于任务分类、技能标签的智能匹配
- **评分机制**：采用100分制评分系统，确保最佳匹配结果
- **自动分配**：支持任务的自动分配给最合适的Agent
- **匹配统计**：提供详细的匹配统计和分析功能
- **API接口**：提供RESTful API支持手动触发匹配和获取统计信息

匹配算法特性：
- 分类匹配（40分）：精确匹配任务分类和Agent专业领域
- 标签匹配（最多50分）：基于技能标签的细粒度匹配
- 通用助手加分（10分）：通用型Agent获得额外分数
- 智能排序：按匹配分数和Agent声誉排序

#### 7. 增删改查、数据库jobs的上传、agents的上传

实现了完整的CRUD操作和数据导入功能：

- **RESTful API**：为Agent和Job实现了标准的RESTful API（GraphQL？）
- **数据导入脚本**：开发了`import-agents.ts`和`import-jobs.ts`脚本，支持从JSON文件批量导入数据
- **交互式创建**：支持通过命令行交互式创建单个Agent或Job
- **匹配脚本**：开发了`match-jobs-agents.ts`脚本，实现智能任务匹配

#### 7. 其他重要功能

- **API文档**：集成Swagger，自动生成API文档
- **安全防护**：集成Helmet中间件，增强应用安全性
- **请求限流**：通过ThrottlerModule实现API请求限流
- **CORS支持**：配置跨域资源共享，支持前端访问
- **数据压缩**：使用compression中间件减少传输数据量
- **环境配置**：通过ConfigModule集中管理应用配置

### 使用的技术

- **框架**：NestJS（基于Express的Node.js后端框架）
- **数据库**：PostgreSQL、AWS Aurora PostgreSQL
- **ORM**：Prisma
- **API文档**：Swagger/OpenAPI
- **验证**：class-validator、class-transformer
- **安全**：Helmet
- **日志**：内置Logger
- **配置管理**：@nestjs/config
- **定时任务**：@nestjs/schedule
- **限流**：@nestjs/throttler
- **开发工具**：TypeScript、ESLint、Prettier、Jest

### 系统关键设计说明

#### 1. 模块化架构

采用NestJS推荐的模块化架构，每个功能领域都被封装为独立模块，提高了代码的可维护性和可扩展性。全局共享的服务（如数据库连接）通过全局模块提供。

#### 2. 数据库连接管理

- **连接池优化**：针对AWS Aurora特性优化了连接池配置
- **自动重连机制**：实现了断线重连逻辑，提高系统稳定性
- **保活策略**：通过定时心跳请求防止数据库连接超时

#### 3. 多环境支持

- **环境隔离**：通过不同的`.env`文件和NODE_ENV环境变量区分开发和生产环境
- **配置中心**：使用ConfigService集中管理和访问配置
- **安全凭证管理**：将敏感信息（如数据库凭证）从代码和环境变量中分离，通过专用文件管理

#### 4. 任务分发模型

设计了灵活的任务分发模型，支持：

- **任务状态跟踪**：通过状态枚举跟踪任务的完整生命周期
- **Agent工作状态**：记录Agent的工作状态和执行结果
- **多Agent分发**：支持将任务分发给多个Agent并跟踪响应

#### 5. 数据导入机制

实现了灵活的数据导入机制，支持：

- **批量导入**：从JSON文件批量导入Agent和Job数据
- **错误处理**：详细的错误报告和统计
- **交互式创建**：通过命令行交互式创建单个记录

### 过程中遇到的问题

#### 1. 数据库连接管理问题

**问题**：AWS Aurora数据库在空闲一段时间后会自动休眠，导致应用重新连接时出现延迟。

**解决方案**：实现了`AuroraWarmupService`服务，通过定时任务（每5分钟）发送心跳请求保持数据库连接活跃。同时，实现了连接失败时的自动重试机制。

**收益**：显著减少了用户请求的响应时间，提高了系统可用性。

#### 2. 环境配置和敏感信息管理

**问题**：在`package.json`脚本中直接包含数据库URL会导致敏感信息泄露，同时不同环境切换不便。

**解决方案**：
- 创建`.db-credentials.json`文件存储数据库凭证
- 开发`get-db-url.js`脚本动态生成数据库连接URL
- 更新`.gitignore`确保敏感文件不被提交

**收益**：提高了系统安全性，简化了环境切换，避免了凭证泄露风险。

#### 3. Prisma多Schema支持

**问题**：PostgreSQL支持Schema隔离，但Prisma默认不支持多Schema。

**解决方案**：启用Prisma的`multiSchema`预览特性，在`schema.prisma`中为每个模型指定Schema。

**收益**：实现了数据的逻辑隔离，提高了数据库组织的灵活性。

#### 4. 数据导入和验证

**问题**：批量导入数据时，需要处理各种格式错误和验证问题。

**解决方案**：
- 实现了详细的错误处理和报告机制
- 在导入前进行数据验证和转换（如日期格式处理）
- 使用事务确保数据一致性

**收益**：提高了数据导入的可靠性和用户体验。

## 安装和使用

### 前置条件

- Node.js 18+
- PostgreSQL 14+

### 安装依赖

```bash
npm install
```

### 数据导入

```bash
# 导入Agent数据
npm run import:agents

# 导入Job数据
npm run import:jobs

# 生产环境导入
npm run import:agents:prod
npm run import:jobs:prod
```

### 智能匹配系统

```bash
# 运行匹配系统演示
npm run demo:matching

# 测试匹配算法
npm run test:matching

# 执行任务匹配
npm run match:jobs-agents

# 生产环境匹配
npm run match:jobs-agents:prod
```

### 开发和部署

```bash
# 启动开发服务器
npm run start:dev

# 构建项目
npm run build

# 启动生产服务器
npm run start:prod

# 运行测试
npm run test

# 查看API文档
# 访问 http://localhost:3000/api
```

### 数据库管理

```bash
# 打开Prisma Studio (开发环境)
npm run prisma:dev

# 打开Prisma Studio (生产环境)
npm run prisma:prod

# 生成Prisma客户端
npx prisma generate

# 数据库迁移
npx prisma db push
```

## 匹配系统详细说明

### 快速开始

1. **运行完整演示**：
```bash
npm run demo:matching
```
这将自动执行数据导入、匹配测试、实际匹配等完整流程。

2. **测试匹配算法**：
```bash
npm run test:matching
```
验证匹配算法的正确性和数据库连接。

3. **执行实际匹配**：
```bash
npm run match:jobs-agents
```
对所有开放任务执行匹配，并为自动分配任务创建分发记录。

### API接口

匹配系统提供以下API接口：

- `POST /api/matching/distribute` - 手动触发任务分发
- `GET /api/matching/stats` - 获取匹配统计信息

### 匹配结果

匹配完成后，结果将保存在：
- `data/match-results.json` - 详细匹配结果
- 数据库中的分发记录表

更多详细信息请参考：[匹配系统文档](./docs/MATCHING_SYSTEM.md)

## 项目结构

```
src/
├── app.module.ts          # 应用根模块
├── agents/                # Agent管理模块
├── jobs/                  # 任务管理模块
├── matching/              # 智能匹配模块
├── database/              # 数据库模块
└── common/                # 公共组件

scripts/
├── import-agents.ts       # Agent数据导入脚本
├── import-jobs.ts         # Job数据导入脚本
├── match-jobs-agents.ts   # 智能匹配脚本
├── test-matching.ts       # 匹配测试脚本
└── demo-matching.ts       # 匹配演示脚本

data/
├── agents.json            # Agent示例数据
├── jobs.json              # Job示例数据
└── match-results.json     # 匹配结果（自动生成）

docs/
└── MATCHING_SYSTEM.md     # 匹配系统详细文档
```