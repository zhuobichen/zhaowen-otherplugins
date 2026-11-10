# Collection Tags — 在文献列表里显示所属分类

Zotero 插件。在条目列表的**创建者右侧**新增一列 **Category**，把每篇文献所属的集合显示成彩色层级标签。

```
标题                                 | 创建者       | Category                        | 年份
Effects of using different exposu…   | Wang, C.     | 应用 › 健康与暴露影响            | 2021
A comparison of statistical and m…   | Berrocal, V. | 应用 › 产品互比与选择敏感性      | 2020
Residual corrective diffusion mod…   | Mardani, M.  | 方法 › 深度学习                 | 2025
```

## 为什么需要它

Zotero 的集合（collection）行为像标签——一篇文章可以同时属于多个集合，但列表里只看得到标题和元数据，
看不出它被分到了哪。要看分类得点开右侧面板，逐条翻。这个插件把那层信息提到列表里，一眼可见。

## 设计

| 特性 | 说明 |
|---|---|
| **层级显示** | 一级（方法 / 应用）+ 子类两段胶囊，如 `方法 › 统计地统计` |
| **一级一色** | 方法 = Nature 深蓝 `#3C5488`，应用 = Nature 朱红 `#E64B35`。同一级下所有子类共用该色，不靠分辨相近色判断归属 |
| **层级靠样式** | 一级实心淡底、子类同色描边，不看颜色也能读层级 |
| **只显示叶子集合** | `方法`、`应用` 这类父级是分组容器，本身不装文章，代码自动跳过 |
| **只读** | 不改任何数据；卸载后列自动注销 |

配色取自 Nature (NPG) 系列，即 `ggsci::pal_npg`，多数期刊配图用的就是这套。

## 安装

1. 下载 [`dist/collection-tags-13.0.0.xpi`](dist/collection-tags-13.0.0.xpi)
2. Zotero → 工具 → 插件 → 右上角齿轮 → **Install Add-on From File...**
3. 选择下载的 `.xpi`，重启 Zotero

列默认可见。若被隐藏，右键表头 → 勾选 **Category**。

## 兼容性

- Zotero 7 / 8 / 9 / 10（`strict_min_version: 7.0`, `strict_max_version: 10.*`）
- 实测环境：Zotero 10.0.8 (Windows)

## 构建

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

产物在 `dist/collection-tags-<version>.xpi`。脚本从 `manifest.json` 读版本号，
只打包 `manifest.json` / `bootstrap.js` / `chrome/`。

## 另一个脚本：把集合同步成原生标签

`sync_collections_to_tags.py` 是独立于插件的工具，给不想装插件、或想用 Zotero 原生标签
筛选功能的情况用。它把集合归属写成 `分类/方法/统计地统计` 形式的标签：

```powershell
# 需要先关闭 Zotero（数据库独占锁）
python sync_collections_to_tags.py            # 只看差异
python sync_collections_to_tags.py --apply    # 写入
```

幂等、单向：只增删以 `分类/` 开头的标签，不碰用户自己的标签。

---

# 开发笔记：在 Zotero 10.0.8 上让自定义列真正显示出来

这一节记录的是**实测踩到的每一个坑**，按痛苦程度排序。如果你也在写 Zotero 插件、发现
`registerColumn` 返回了 key 但列就是不出现，先看这里。

## 1. 注册必须在 `startup()` 的第一行，且不能先 await 任何东西

这是最关键的一条。Zotero 的条目树在初始化时**读 `treePrefs.json` 并把无法解析的条目直接丢弃**。
如果你的 `registerColumn` 晚于树加载 prefs（比如放在定时器里，哪怕只晚 300ms），
树找不到列定义，就把 prefs 里的条目扔掉，`_columnPrefs` 里永远没有你的列，列永远不显示。

```js
async function startup({ id, version }, reason) {
  await ensureColumn();   // ← 第一件事，不要先 await initializationPromise
  // 其余初始化放后面
}
```

`await Zotero.initializationPromise` 尤其危险：它可能耗时到错过窗口，且**本插件实测收不到
`onMainWindowLoad` 回调**，不能依赖它。

## 2. `.xpi` 内部的代码无法用 URL 加载

四种官方写法全部失败（Zotero 10.0.8，插件为已安装的 .xpi）：

| 方式 | 结果 |
|---|---|
| `Services.scriptloader.loadSubScript("jar:file:///…xpi!/x.js")` | `Error opening input stream (invalid filename?)` |
| `NetUtil.asyncFetch(...)` | 挂起，不 resolve 也不 reject |
| `ChromeUtils.importESModule("jar:file:///…")` | `System modules must be loaded from a trusted scheme` |
| `ChromeUtils.importESModule("chrome://…")` | `Failed to load`（`registerChrome` 传 manifest URI 未生效） |

**结论：全部代码写在 `bootstrap.js` 里**，那是 Zotero 保证会执行的文件。

## 3. 模块作用域不能有任何 import

```js
// 这样写会静默杀死整个 bootstrap：
const { IOUtils } = ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
```

插件在管理界面**显示为「已启用」，但一行代码都不执行**，没有任何报错。所有 import 必须在函数内。

同理，写文件只能用 `nsIFileOutputStream`：

```js
const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
file.initWithPath(path);
const stream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
stream.init(file, 0x02 | 0x08 | 0x10, 0o644, 0);   // 追加要去掉 0x10 并 seek 到末尾
const bytes = new TextEncoder().encode(text);      // 不编码会把中文写成乱码
stream.write(String.fromCharCode.apply(null, Array.from(bytes)), bytes.length);
```

`nsIScriptableUnicodeConverter.convertToInputStream` 在本版本不存在；
`IOUtils.writeUTF8` 也不可用。

## 4. `dataProvider` 的数据靠 `Zotero.Collections.get(id)` 逐个取

枚举库会漏：

```js
// 不可靠：返回的集合数偏少，列渲染为空
Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID)
Zotero.Libraries.getAll()

// 可靠：
for (const id of item.getCollections()) {
  const c = Zotero.Collections.get(id);
}
```

## 5. 判断「父级容器」用 `hasChildCollections`

父集合不装文章，显示它只是重复子类名：

```js
const isContainer = typeof c.hasChildCollections === "function"
  ? c.hasChildCollections()
  : !!c.hasChildCollections;
if (isContainer) continue;
```

子类的父名通过 `c.parentID` 再取一次 `Zotero.Collections.get(parentID)`。

## 6. 列必须显式给 `width`

只写 `flex` 的列宽度为 0，看不见。`flex: 0` + `width: "230"` 才行。

## 7. 非 ASCII 的 `label` 会被打乱

`label: "分类"` 到达树里变成 `"{"`。列标题必须用 ASCII（本项目用 `Category`）；
`dataProvider` 返回的**内容**不受影响，中文正常。

## 8. 想默认可见，要写 `treePrefs.json` 且 `hidden: false`

注册的列默认 `hidden: true`，只出现在右键列选择器里。要默认显示，需要
`%PROFILE%\treePrefs.json` 的 `item-tree-main-default` 下有对应条目：

```json
"collection-tags\\@zhuobichen\\.github\\.io-collectionTags": {
  "dataKey": "collection-tags\\@zhuobichen\\.github\\.io-collectionTags",
  "ordinal": 2,
  "hidden": false,
  "width": 230
}
```

**注意 key 里的转义**：Zotero 把 `@` 和 `.` 转义成 `\@` 和 `\.`。
用未转义的 key 写进去会被静默忽略——这一条排查了很久。

写成 `hidden: false` 只有在第 1 条（早期注册）成立时才安全：否则树解析不到列定义，
`dataProvider` 为空，渲染时抛错并连带丢掉后面的列（表现为 `hasAttachment` 列消失）。

## 9. 定时器要挂在 window 上，否则会被 GC

```js
// 会被回收，回调永远不触发
const t = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
t.initWithCallback({ notify() { … } }, 8000, Ci.nsITimer.TYPE_ONE_SHOT);

// 可靠
Zotero.getMainWindow().setTimeout(() => { … }, 8000);
```

轮询类定时器要存在模块级变量里（`let pollTimer`），局部 `const` 同样会被回收。

## 10. 别手动改 `_columns` / `_columnPrefs`

调试期间试过直接 `tree._columns.push(...)`、改写 `_columnPrefs`、调
`_storeColumnPrefs()` / `_loadColumnPrefsFromFile()` / `refreshColumns()`。结论：

- `_columns` 每次从 prefs 重建，手动 push 的条目下一轮就消失
- `_storeColumnPrefs()` 在本版本会抛 `right-hand side of 'in' should be an object`
- 唯一有效的是 `tree._writeColumnPrefsToFile()`，但它写的位置与 `treePrefs.json`
  的可见性判定不完全一致

**结论：只用官方 API + 第 8 条写一次 `treePrefs.json`。** 其余都是徒劳。

## 11. 安装：手动放 .xpi 不会触发注册

把 `.xpi` 复制进 `%PROFILE%\extensions\` **不会**让 Zotero 认识它——`extensions.json`
不会更新，管理界面看不到。必须同时往 `extensions.json` 的 `addons` 数组追加完整条目
（`targetApplications`、`rootURI`、`location: "app-profile"` 等，字段可从打包的 manifest 生成）。

更省事的办法：Zotero → 工具 → 插件 → 齿轮 → Install Add-on From File。

## 12. `strict_min_version` 太老会不加载

写 `7.0` 时插件不启动；对齐可用插件（如 zoplicate）的 `8.999` / `10.0.*` 才正常。

---

## 卸载

Zotero → 工具 → 插件 → Collection Tags → 移除 → 重启。
列通过 `pluginID` 自动注销，无需手工清理。

## 许可

MIT
