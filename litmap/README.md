# Literature Map

在 Zotero 里生成一张**文献地图**：一个自包含的 HTML，四个二维视图，双击打开即可用，无需联网、无外部依赖。

菜单路径：**工具 → 生成文献地图**。面向全库，不需要先选中文献。生成的文件写到 `文档\文献地图.html` 并自动用浏览器打开。

## 四个视图

| 视图 | 看到什么 | 数据来源 |
|---|---|---|
| **引用网络** | 力导向图，边 = 库内两篇之间的引用 | OpenCitations COCI |
| **语义地图** | TF-IDF 二维持投影，距离近 = 用词相似 | 标题 + 笔记 + 摘要 |
| **时间 × 分类** | 横轴年份、纵轴分类，点大小按引用数 | Zotero 字段 |
| **地理分布** | 经度/纬度气泡图，气泡大小 = 该区域文献数 | 标题与笔记中的地名 |

颜色与 Zotero 里的分类列一致：`#3C5488` 方法类，`#E64B35` 应用类。

## 几个刻意的设计决定

**引用网络只画库内互引。** 边只在两端都在库内时出现，所以看到的每一条都是可核实的引用，不是相似度推断。孤立节点默认隐藏——它们没有弹簧拉住，会被斥力推到边框，读起来像无意义的方框。勾选「包含无引用关系的文献」可以看全貌。

**语义地图是描述性布局，不是引用关系。** 用标题和笔记的 TF-IDF 向量做二维持投影（幂迭代求前两个主方向），近邻表示用词相似。这能看出「方法派」和「应用派」的聚类，但不要当成知识图谱。

**地理标签靠正则。** 标题和笔记里出现的地名决定归属，一篇可能属于多个区域。识别不出区域的文献不显示在地图上，数量会在标题栏里写出来。

## 构建

```powershell
cd litmap
powershell -ExecutionPolicy Bypass -File .\build.ps1
# -> dist/litmap-1.0.0.xpi
```

`bootstrap.js` 里的 HTML 模板由 Python 生成（`_make_litmap_plugin.py` 在开发目录），模板是唯一真相来源，所以独立版和插件版不会漂移。仓里的 `render_standalone.py` 和 `data_from_sqlite.py` 是同一套逻辑的独立版本，用来在不启动 Zotero 的情况下调试。

## 踩过的坑

**`String.fromCharCode.apply(null, bytes)` 会炸。** 传入 600 KB 的 Uint8Array 时抛 `RangeError: too many arguments provided for a function call`，因为参数列表有长度上限。必须按 8192 字节分块写：

```js
function writeBytes(stream, bytes) {
  var CHUNK = 8192;
  for (var i = 0; i < bytes.length; i += CHUNK) {
    var slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    stream.write(String.fromCharCode.apply(null, slice), slice.length);
  }
}
```

**`Zotero.ProgressWindow` 没有 `update` 方法。** 只有 `changeHeadline` / `addDescription` / `show` / `startCloseTimer`。用 `progress.update(...)` 会抛 `TypeError: progress.update is not a function`。

**工具菜单的 popup id 是 `menu_ToolsPopup`。** 条目右键菜单是 `zotero-itemmenu`。这个功能面向全库，放工具菜单更合理。

**自测开关。** `startup()` 会检查 `%TEMP%\litmap_autorun.flag`，存在就在 2.5 秒后自动跑一次 `generate()`。这样整条流水线可以在不点菜单的情况下验证，平时没有这个文件就什么也不做。

## 输出示例

280 篇文献 → 126 篇有库内引用关系 / 281 条边 / 154 篇孤立；17 个研究区域；1968–2026 年跨度。

## 增量构建

引用关系缓存在 Zotero 配置目录的 `litmap_citations_cache.json`（约 240 KB）。
**工具**菜单有两个入口：

| 菜单项 | 做什么 |
|---|---|
| 生成文献地图（增量） | 只查没见过的 DOI，其余直接复用 |
| 重新构建文献地图（清空引用缓存） | 丢弃缓存重查全部 |

实测 264 个 DOI：首次 170 秒，第二次 **12 秒**（含 Zotero 启动），日志里是
`cache: 264 reused, 0 to fetch`。新增几篇文献只会多几次请求。

**什么可以缓存、什么不能。** 两篇固定论文之间的引用关系不会变，所以能永久缓存。
但 TF-IDF 投影不能缓存——IDF 是全局量，多一篇文献就会改变所有词的权重，二维布局
随之移动是正确的行为。好在它只要几毫秒，重新算是合理的。

**失败不写进缓存。** OpenCitations 超时或限流时返回 `null`，与「这篇没有参考文献」
（空数组）区分开。`null` 不入缓存，下次构建会重试，而不是把一次网络故障记成事实。

## 读取配置目录文件

`Zotero.File.getContentsFromFile` 在这个版本里**不存在**——调用会抛
`TypeError`，而异常被 try/catch 吞掉后表现为「缓存永远读不到、每次都全量重查」。
改用 `nsIFileInputStream` + `nsIConverterInputStream` 手动读 UTF-8：

```js
var stream = Cc["@mozilla.org/network/file-input-stream;1"]
  .createInstance(Ci.nsIFileInputStream);
stream.init(file, 0x01, 0, 0);
var conv = Cc["@mozilla.org/intl/converter-input-stream;1"]
  .createInstance(Ci.nsIConverterInputStream);
conv.init(stream, "UTF-8", 0, 0xFFFD);
```

不要用 `NetUtil.asyncFetch`：异步读取会和构建流程竞争，缓存还没读完就开始查了。

## 打包后的三个致命坑

**① zip 条目名必须用正斜杠。** .NET 的 `ZipFile.CreateFromDirectory` 在 Windows 上
写成 `content\world.json`（反斜杠），而 ZIP 规范和 `nsIZipReader.getEntry` 都用正
斜杠。`build.ps1` 改成用 `ZipArchive` 逐条 `CreateEntry`，手动把 `\` 换成 `/`。

**② `Zotero.File.getContentsFromFile` 和 `nsIZipReader` 都不好用。**
前者在这个版本不存在；后者的 `getInputStream` 即使 `getEntry` 成功也常报
`NS_ERROR_FILE_NOT_FOUND`。能读 jar: URI 内文件的只有：

```js
Zotero.File.getContentsFromURL(_rootURI + "content/world.json");
```

**③ 占位符名会和运行时的字符串字面量撞车。** 模板里写 `const WORLD = __WORLD__;`
同时代码里有 `.replace("__WORLD__", ...)`，Python 侧做 `shell.replace("__WORLD__", data)`
时会把**两处**都替换掉，`.replace` 那行被 126 KB 数据撑成
`.replace(""[[\"斐济\"...]]"")` —— 双重引号，语法错误。改用一个只有模板用的标记
（`@@WORLD@@`）就分开了。

**④ bootstrap.js 别塞大数组。** 把 126 KB 世界数据内联成 JS 数组字面量时文件
305 KB，加载器直接拒绝求值：没有启动、没有日志、没有菜单、没有任何报错。抽成
独立的 `content/world.json` 后降到 50 KB，一切正常。

## 缓存：只有用户点头才重建

菜单刻意分成三级，因为「重读文献库」和「丢弃引用缓存」是两件事，只有后者真的
费时间（264 个 DOI 约 170 秒）：

| 菜单项 | 读库 | 清引用缓存 | 重写 HTML |
|---|---|---|---|
| 打开或生成文献地图 | 有缓存则不读¹ | 否 | 否 |
| 重新构建文献地图 | 是 | 否 | 是 |
| 清空引用缓存并重查 | 是 | 是 | 是 |

**库变化不会触发自动重建。** 每次点第一项时会重读库并算指纹，若与上次记录不同，
只在进度窗口提示「上次构建 …，如要更新请用『重新构建文献地图』」，然后照旧打开
原有的 HTML，一个字节都不写。

这样做的理由：地图是给人看的快照，什么时候刷新应该由人决定，而不是检测到一点
改动就悄悄换掉文件。

### 指纹

`djb2` 扫一遍 `JSON.stringify(payload)`，548 KB 个位数毫秒。指纹连同 `builtAt` /
`itemCount` / `edgeCount` 存在配置目录的 `litmap_state.json`（约 100 字节）。

### 实测

```
无缓存        -> wrote ... (render 67 ms,  total 180 ms)
库已变化      -> cache hit (…, library changed since 2026/11/12 12:29:46),
                 opening without rebuild            # 文件 mtime 不动
强制重建      -> wrote ... (render 131 ms, total 196 ms)
```

三级时间拆开看：读库 40–45 ms、引用关系 11–29 ms（264 个 DOI 全命中）、渲染
67–131 ms。**真正的瓶颈早就被引用缓存解决了**（首次 170 秒 → 现在 0），HTML
缓存省下的那点时间只是附带效果。

¹ 取决于「快速打开（不读库）」开关，见下节。

### 快速打开（不读库）

第四项菜单是开关，状态直接写在标签里：`快速打开（不读库）：开 / 关`。

| 开关 | 点第一项时 | 代价 |
|---|---|---|
| 开 | 直接启动浏览器打开现有 HTML，**一个库字段都不读** | 不再提示「库已变化」，想更新只能自己选「重新构建」 |
| 关 | 读库 40–45 ms，算指纹，命中则打开并在进度窗口给出上次构建时间 | 多花几十毫秒 |

开关存在 `extensions.zotero.litmap.fastOpen`（默认关）。切换后菜单会当场重建，
标签立刻更新，不用重启。

实测：

```
关 -> items 280 (48 ms) … cache hit (…, up to date), opening without rebuild
开 -> fast open, no library read
```

**默认关**是有意的：默认行为应当保守，让「库变了」这件事至少被提示一次；确认
习惯之后再手动打开。
## 地理视图：加粗行政边界

不用气泡。气泡只说明「在这附近」，轮廓才说明「研究的就是这片」。有文献的区域会
加粗其行政边界并填充淡色，**轮廓内写上文献数**。

两级粒度，因为文献库本身就按两个层级打标签：

| 层级 | 例子 | 颜色 | 填充 | 边界 |
|---|---|---|---|---|
| 单国 / 小区 | 中国、CONUS、加拿大、印度、韩国/日本 | 藏青 `#1f3557` | `.28` | 2.8 px + 光晕 |
| 大洲级并集 | 欧洲 37、非洲 50、南美 12、中东 13、东南亚 10 | 藏青 `#1f3557` | `.28` | **只填充** |
| 中国子区域 | 京津冀、长三角、珠三角、汾渭平原 | 赭红 `#8f2f1c` | `.36` | 3.6 px + 光晕 |

### 数字加底牌

数字压在自己的深色边界上会糊掉，所以给它垫了一块 15 px 高的米白chip，边框用
区域色 55% 透明描一圈。

**填充和线宽都比「单独看时觉得合适」要重一档。** 第一版用了 `.13` 填充和 1.8 px
线宽，结果在地图上几乎看不出来——底图是米色 `#f4f1e8`，13% 的藏青叠上去只把
rgb 从 244 压到 218，肉眼在 1700 px 宽的画布上分辨不出。现在压到 185，同一个
像素点直接对比是 185 vs 244，一眼能分开。

笔画还额外描了一圈 3.4 倍宽的 20% 透明光晕，先铺底再压实线，缩略看也知道这块
是高亮区。

子区域画在国内轮廓之上，所以「中国 67」里能同时看到「京津冀 11」。

### 数据从哪来

- **国界** Natural Earth 110m（819 KB 原始 GeoJSON）
- **中国省级** 阿里 DataV `areas_v3/bound/100000_full.json`（569 KB，35 个省级单元）

`build_regions.py` 把两者合成 `content/regions.json`（202 KB）：坐标取两位小数、
丢掉少于 4 个点的碎屑、只保留用得到的 12 个省级单元。

**CONUS 要单独裁。** Natural Earth 的「United States of America」把阿拉斯加和夏威夷
放在同一条记录里，直接用会把标签丢到太平洋。按 bbox（lon -130..-66, lat 23..50.5）
过一遍环，只留本土那条。

### 标签位置怎么定

区域重心用鞋带公式按面积加权算，而且**取最大的那条环**——多岛屿国家的主体在大陆上，
不取最大环会被小岛带偏。

多成员区域（欧洲 37 国、非洲 50 国）用**各成员重心的平均**，而不是所有环的重心：
后者会被面积最大的国家吞掉，标签会落到法国或刚果而不是欧洲中间。

### 标签避让

东亚把六个区域压在几度经度内。标签先试原位，撞上已放置的矩形就按
`上 → 下 → 右上 → 左上 → 右下 → 左下 → 更上 → 更下` 逐个试。实测 17 个标签零重叠。
