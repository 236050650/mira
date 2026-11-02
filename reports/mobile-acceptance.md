# 移动端验收记录

日期：2026-07-27  
环境检查执行人：自动化开发会话

## 1. 环境探测结果

| 项 | 结果 |
|---|---|
| `adb` | 可用（`D:\platform-tools-latest-windows\platform-tools\adb.exe`） |
| `adb devices` | **无设备连接**（仅启动 daemon，列表为空） |
| Android SDK / emulator | **未发现**可用 emulator 路径与 AVD |
| iOS 模拟器 | Windows 环境 **不可用** |
| Expo CLI | 已安装（expo 0.24.x 可用） |

## 2. 验收结论（本机）

**环境阻塞、未验收**

不允许将未实际运行的移动端流程标记为通过。

代码侧已具备：

- Expo Router 页面：首页 / 发现 / 消息 / 我的 / 登录 / 角色详情 / 聊天 / 模型状态
- API 对接：登录、角色、会话、SSE 流式
- 聊天：发送、停止、重新生成

但本轮 **没有** 在 Android 模拟器、Android 真机或 iOS 真机上完成可重复录屏证据。

## 3. 可直接执行的验收步骤（有设备时）

### 3.1 启动

```bash
# 终端 1：API
cd D:\nebula\nebula-human\persona-app-demo
$env:USE_PGLITE="true"
$env:MODEL_MODE="local"   # 或 mock
npm run dev:api

# 终端 2：Expo
$env:EXPO_PUBLIC_MIRA_API_URL="http://10.0.2.2:4000"  # Android 模拟器访问宿主机
# 真机请改为电脑局域网 IP，例如 http://192.168.x.x:4000
npm run dev:mobile
```

### 3.2 录屏检查清单（每项需录屏或截图）

- [ ] 注册新邮箱并自动保持登录
- [ ] 首页可见霍去病主视觉与角色列表
- [ ] 发现页分类 + 搜索
- [ ] 角色详情 → 开始对话
- [ ] 发送消息出现流式回复
- [ ] 生成中可停止，已生成内容保留
- [ ] 重新生成不重复用户消息
- [ ] 返回消息列表后会话仍在
- [ ] 模型设置页可查看 Ollama / DeepSeek 状态
- [ ] 切换模型后历史消息仍可见
- [ ] 键盘弹出后输入框与发送按钮仍可用（无遮挡）
- [ ] 浅色/深色主题切换正常

### 3.3 Android 真机额外项

- [ ] 使用局域网 API 地址可连通
- [ ] 安全区/刘海不遮挡底部输入
- [ ] 应用切后台再回前台，已发送消息不丢失

### 3.4 iOS 额外项

- [ ] 灵动岛/刘海安全区
- [ ] SecureStore 刷新令牌重启后仍可恢复登录

## 4. 证据存放建议

```text
reports/mobile/
  android-core.mp4
  ios-core.mp4
  model-status.png
  keyboard-chat.png
```
