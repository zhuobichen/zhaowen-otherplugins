# Collection Tags — 在文献列表里显示所属分类

Zotero 插件。在条目列表的**创建者右侧**新增一列「分类」，把每篇文献所属的集合显示成彩色标签。

```
标题                              | 创建者        | 分类                  | 年份
Effects of using different expo…  | Wang, Chunlu | 健康与暴露影响         | 2021
A comparison of statistical and…  | Berrocal,V.  | 产品互比与选择敏感性   | 2020
Residual corrective diffusion m…  | Mardani,M.   | 深度学习               | 2025
```

## 为什么需要它

Zotero 的集合（collection）行为像标签——一篇文章可以同时属于多个集合，但列表里只显示标题和元数据，
看不出它被分到了哪。要看分类得点开右侧面板，逐条翻。

这个插件把那层信息提到列表里，一眼可见。

## 行为

| 特性 | 说明 |
|---|---|
| **只显示叶子集合** | `方法`、`应用` 这类父级是分组容器，本身不装文章；显示它们没有信息量，代码自动跳过 |
| **颜色稳定** | 每个集合的颜色由它的 key 哈希派生（12 个等距色相），跨机器、跨会话一致，**不存任何状态** |
| **按名称排序** | 同一篇文章的标签顺序固定，便于扫读 |
| **缓存** | 集合表缓存 3 秒，滚动列表时不会反复重建 |
| **只读** | 不修改任何数据；卸载后无残留（列通过 `pluginID` 自动注销） |

## 安装

1. 下载 [`dist/collection-tags-1.0.0.xpi`](dist/collection-tags-1.0.0.xpi)
2. Zotero → 工具 → 插件 → 右上角齿轮 → **Install Add-on From File...**
3. 选择下载的 `.xpi`
4. 重启 Zotero

**如果列没出现**：右键表头 → 勾选 **分类**。

## 兼容性

- Zotero 7 / 8 / 9 / 10（`strict_min_version: 7.0`, `strict_max_version: 10.*`）
- 实测环境：Zotero 10.0.8 (Windows)

## 构建

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

产物在 `dist/collection-tags-<version>.xpi`。脚本从 `manifest.json` 读版本号，
只打包 `manifest.json` / `bootstrap.js` / `chrome/`，不含 `dist`、`.git` 和构建脚本。

## 技术说明

用 Zotero 官方插件 API `Zotero.ItemTreeManager.registerColumn`：

```js
Zotero.ItemTreeManager.registerColumn({
  dataKey: "collectionTags",
  label: "分类",
  pluginID: "collection-tags@zhuobichen.github.io",
  dataProvider: (item) => /* 返回集合名 */,
  renderCell: (index, data, column, isFirstColumn, doc) => /* 返回 DOM */,
});
```

关键约束（写插件时踩过或查文档确认的）：

- **`dataProvider` 每行调用一次**，必须是 O(1) 量级。不要在里面遍历整个集合树——
  集合表单独缓存，`dataProvider` 只走 `item.getCollections()`。
- **`renderCell` 是唯一能建 DOM 的地方**，且必须用传入的 `doc` 参数，
  不要 `document.createElement`（多窗口下会拿错文档）。
- **`dataKey` 会被 `pluginID` 加前缀**，注册返回的才是真实 key，注销要用返回值。
- **父集合 `parentID` 方言不一**：`Zotero.Collections` 对象上是 `parentID`，
  SQLite 里是 `parentCollectionID`，别混。
- **`item.getCollections()` 返回集合 ID 数组**，不是对象。

## 卸载

Zotero → 工具 → 插件 → 找到 Collection Tags → 移除 → 重启。
列会自动注销，不需要手动清理任何配置。

## 许可

MIT
