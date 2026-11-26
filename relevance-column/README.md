# Relevance Column

Zotero 插件：加一列 `Relevance`，显示库里每一篇文献**相对我那篇论文**的相关度分数（由 `paper-relevance` skill 用 TypeSafe Jev 的 Score 原语算出）。

列**默认不显示**——右键条目列表表头 → 勾选 `Relevance` 才会出现。这是刻意的：不想让一个实验性的分数列打扰正常使用。

## 单元格长什么样

```
已引用：  88.8  c0.64 Cite★
未引用：  30.5  c0.35    ★
```

| 元素 | 含义 |
| --- | --- |
| `88.8` | 归一化到 0–100 的相关度期望分数（越低越灰，≥40 琥珀，≥60 绿） |
| 虚线边框 | `判定 = 待定`，即 confidence 没过门槛，这个分数**不可采信** |
| `c0.64` | confidence。**只作门槛，不乘进分数**（Jev 官方：乘算属于双重计算） |
| `Cite` | 该文献已出现在正文参考文献里（按 DOI 匹配） |
| 红色 `★` | 图例：这列的数字是「相对我那篇论文」的相关度，不是文献之间的互相关。只要这行有分数就画 |

悬停分数气泡可以看到 rubric id + sha256 + 判定 + 引用状态。

## 安装 / 更新

```powershell
cd relevance-column
./build.ps1          # 产出 ../dist/relevance-column-<version>.xpi
```

然后把 xpi 装进 Zotero：**工具 → 插件 → 齿轮 → Install Add-on From File**。

> 不要把 xpi 直接拷进 `profile/extensions/` 就以为装好了。Zotero 只认 `extensions.json` 里已登记的条目，往目录里丢文件不会被发现；手工改那个 JSON 还可能触发重写、把别的插件条目清掉。详见下面的坑。

## 配置

`config.json`（和 `bootstrap.js` 同目录）：

```json
{ "csv": "E:\\...\\audit\\relevance\\scores_ALL_rubric-rel-5lvl-zh-v1.csv" }
```

CSV 需要这些列（其余列忽略）：`key`、`score_normalized`、`confidence`、`decision`、`already_cited`、`rubric_sha256`、`rubric_id`、`rubric_version`。

改完分数后：条目右键 `Reload Relevance Scores`，或重启 Zotero。

## 版本

- **1.0.1** — 右下角徽标 `Cite ★`：`Cite` 只在已引用时出现；红星每行都有，作为「相对本文」的图例。徽标是行内元素（`align-self:flex-end` 贴底），不是绝对定位，所以列拉宽了也不会和分数分开。manifest 兼容范围放宽到 `7.0` / `10.*`。
- **1.0.0** — 首版：分数气泡 + confidence + 行内 `★` 表示已引用。

## 踩过的坑

**1. Zotero 的插件注册表很脆。** 把新 xpi 拷进 `profile/extensions/` 并手改 `extensions.json` 的 `version`，重启后 Zotero 重写了注册表，丢掉了 6 个插件条目、还删了两个 xpi。正确做法是走「工具 → 插件」安装。恢复时用 `[System.Text.Encoding]::UTF8` 显式读写 `extensions.json`，照抄一个能正常加载的条目改 `id`/`version`/`path`/`rootURI`/`syncGUID`/`targetApplications`。

**2. 别用 `Compress-Archive` 打包 xpi。** Windows 上它会写反斜杠作为 zip 条目分隔符，不符合 ZIP 规范（`nsIZipReader.getEntry` 是按正斜杠查的）。`build.ps1` 手工 `CreateEntry` 并统一转成正斜杠。

**3. `renderCell` 里的 TDZ 陷阱。** `cited` 是 `const`，如果在声明之前就用它算 `padding-right`，会抛 `Cannot access 'cited' before initialization`，整列渲染成空白。padding 必须在解析完 `parts` 之后再设。

**4. 非 ASCII 列标题会被吃。** 注册列时 `label` 只能给 ASCII（`Relevance`），中文会被 mangled；单元格内容可以是中文。

**5. 列必须给 `width`。** 只给 `flex` 会渲染成零宽。

## 相关

- 打分逻辑：`paper-relevance` skill（`~/.agents/skills/paper-relevance/`）
- 同仓库的其它插件：`collection-tags`、`litmap`
