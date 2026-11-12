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

## 地理底图

用 Natural Earth 110m 的真实国界，不是手描的方块。`compact_world.py` 把原始
819 KB 的 GeoJSON 压到 125 KB：只留几何、坐标取两位小数（赤道附近约 1 km，
已经细于 1440 px 画布能表达的分辨率）、去掉南极洲、环编码成扁平的
`[lon,lat,lon,lat,...]` 数组。等距圆柱投影，与气泡用同一套坐标变换。

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
