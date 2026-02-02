# 2048游戏 - 鸿蒙版 (HarmonyOS)

一个经典的2048益智游戏，使用**ArkTS**开发的鸿蒙原生应用。

## 🎮 游戏特色

### 核心玩法
- **经典2048规则**：滑动合并相同数字
- **流畅手势操作**：支持四个方向滑动
- **精美UI设计**：还原经典2048配色
- **动画效果**：方块出现动画，流畅体验
- **震动反馈**：操作时的触觉反馈
- **本地存储**：自动保存最高分

### 🌟 功能亮点

1. **完整游戏逻辑**
   - 四方向滑动控制
   - 自动合并相同数字
   - 智能检测游戏结束
   - 赢得游戏检测（达到2048）

2. **美观界面**
   - 经典配色方案
   - 不同数值不同颜色
   - 流畅动画过渡
   - 响应式布局

3. **用户体验**
   - 震动反馈
   - 分数统计
   - 最高分记录
   - 游戏结束提示

## 📱 技术栈

- **开发语言**：ArkTS
- **UI框架**：ArkUI
- **API版本**：HarmonyOS SDK 11+
- **使用组件**：
  - `@ohos.promptAction`：提示消息
  - `@ohos.vibrator`：震动反馈
  - `AppStorage`：数据持久化

## 🎯 游戏规则

1. **基础规则**
   - 使用滑动手势移动所有方块
   - 相同数字的方块会合并成一个
   - 每次移动后会随机出现一个新方块(2或4)

2. **胜利条件**
   - 合并出2048方块即获胜
   - 可选择继续挑战更高分

3. **失败条件**
   - 无法移动且无法合并时游戏结束

## 🚀 如何运行

### 环境要求
1. **DevEco Studio** 4.0 或更高版本
2. **HarmonyOS SDK** API 11 或更高版本
3. **鸿蒙设备** 或 **模拟器**

### 运行步骤

1. **打开项目**
   ```bash
   # 打开 DevEco Studio
   # 选择 Open Project
   # 导航到: c:/Users/Chuan/CodeBuddy/20260201020813/harmonyos
   ```

2. **配置SDK**
   - File → Project Structure
   - 确认 Compile SDK Version: 11
   - 确认 Compatible SDK Version: 11

3. **连接设备**
   - 连接鸿蒙手机或启动模拟器
   - 确保设备已开启开发者模式

4. **运行应用**
   - 点击工具栏的 Run 按钮（绿色三角）
   - 或使用快捷键 `Shift + F10`

## 📂 项目结构

```
harmonyos/
├── AppScope/                      # 应用级配置
│   ├── app.json5                 # 应用配置
│   └── resources/                # 应用资源
│       └── base/
│           └── element/
│               └── string.json   # 应用字符串
├── entry/                         # 主模块
│   ├── src/
│   │   └── main/
│   │       ├── ets/
│   │       │   ├── entryability/
│   │       │   │   └── EntryAbility.ets  # 入口Ability
│   │       │   └── pages/
│   │       │       └── Index.ets         # 游戏主页面
│   │       └── resources/        # 模块资源
│   │           └── base/
│   │               ├── element/
│   │               │   ├── string.json   # 字符串资源
│   │               │   └── color.json    # 颜色资源
│   │               └── profile/
│   │                   └── main_pages.json  # 页面路由
│   ├── module.json5              # 模块配置
│   └── hvigorfile.ts             # 模块构建配置
├── build-profile.json5           # 构建配置
├── hvigorfile.ts                 # 项目构建配置
├── oh-package.json5              # 包管理配置
└── README.md                     # 说明文档
```

## 🎨 核心代码说明

### 游戏状态管理
```typescript
@State grid: number[][]           // 游戏网格
@State score: number              // 当前分数
@State bestScore: number          // 最高分
@State gameOver: boolean          // 游戏结束标志
@State won: boolean               // 胜利标志
```

### 核心方法
- `initGame()`：初始化游戏
- `addRandomTile()`：添加随机方块
- `move(direction)`：移动方块并合并
- `checkGameOver()`：检查游戏是否结束
- `getTileColor(value)`：获取方块颜色

### 手势识别
```typescript
SwipeGesture({ direction: SwipeDirection.All })
  .onAction((event: GestureEvent) => {
    // 根据角度判断滑动方向
    // 45-135: 向下
    // 135-225: 向左
    // 225-315: 向上
    // 其他: 向右
  })
```

## 🎯 游戏特性

### 颜色方案
- **空格**：#cdc1b4
- **2**：#eee4da
- **4**：#ede0c8
- **8**：#f2b179
- **16**：#f59563
- **32**：#f67c5f
- **64**：#f65e3b
- **128+**：渐变金色

### 动画效果
- **方块出现**：透明度+缩放动画
- **数字变化**：平滑过渡
- **游戏结束**：遮罩渐显

### 反馈系统
- **震动**：每次移动50ms震动
- **提示**：Toast消息提示
- **音效**：（可扩展）

## 🔧 自定义配置

### 修改网格大小
```typescript
private gridSize: number = 4;  // 改为5则是5x5网格
```

### 修改方块大小
```typescript
private cellSize: number = 80;  // 方块尺寸
private cellGap: number = 10;   // 方块间距
```

### 修改胜利条件
```typescript
if (row[j] * 2 === 2048 && !this.won) {
  // 改为4096则需要合成更大的数字
}
```

## 📊 性能优化

1. **状态管理**：使用 `@State` 实现响应式更新
2. **数据持久化**：使用 `AppStorage` 本地存储
3. **动画优化**：仅在必要时触发动画
4. **内存管理**：及时清理不需要的对象

## 🐛 已知问题

- 无

## 📝 更新日志

### v1.0.0 (2025-02-01)
- ✅ 完整的2048游戏逻辑
- ✅ 四方向滑动控制
- ✅ 精美UI和动画
- ✅ 震动反馈
- ✅ 最高分记录
- ✅ 游戏结束检测

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🎮 快速开始

1. 打开 DevEco Studio
2. 导入项目目录
3. 连接鸿蒙设备
4. 点击运行
5. 开始游戏！

祝你玩得开心！🎉
