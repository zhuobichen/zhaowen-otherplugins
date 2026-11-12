// Literature map for Zotero: builds a self-contained HTML with four 2-D views.
//
// No imports at module scope (a throwaway import kills the whole bootstrap),
// registration happens before the first await, and file writing uses
// nsIFileOutputStream because that is the only path that survives here.

var CollectionTags_placeholder;

const PLUGIN_ID = "litmap@zhuobichen.github.io";
const PLUGIN_REF = "litmap";
const TEMPLATE = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>\u6587\u732e\u5730\u56fe \u00b7 Literature Atlas</title>\n<style>\n  :root{\n    --paper:#f7f4ee;\n    --paper-2:#fffdf9;\n    --ink:#17181c;\n    --ink-2:#4a4d55;\n    --ink-3:#8a8d96;\n    --rule:#dfd9cd;\n    --rule-soft:#ece6da;\n    --method:#2f4a6d;\n    --application:#a63d2a;\n    --none:#8d8f96;\n    --ochre:#b8863b;\n    --serif:\"Songti SC\",\"Noto Serif SC\",\"Source Han Serif SC\",Georgia,\"Times New Roman\",serif;\n    --sans:\"Inter Tight\",\"Helvetica Neue\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif;\n    --mono:\"JetBrains Mono\",ui-monospace,\"SF Mono\",Consolas,monospace;\n  }\n  *{box-sizing:border-box}\n  html,body{margin:0;padding:0}\n  body{\n    background:var(--paper);\n    color:var(--ink);\n    font:14px/1.6 var(--sans);\n    -webkit-font-smoothing:antialiased;\n    background-image:\n      linear-gradient(to right, rgba(23,24,28,.028) 1px, transparent 1px),\n      linear-gradient(to bottom, rgba(23,24,28,.028) 1px, transparent 1px);\n    background-size:46px 46px;\n    background-position:-1px -1px;\n    min-height:100vh;\n  }\n  .masthead{\n    border-bottom:1px solid var(--ink);\n    padding:26px 42px 0;\n    position:relative;\n  }\n  .kicker{\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.22em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    margin-bottom:14px;\n  }\n  h1{\n    font-family:var(--serif);\n    font-weight:500;\n    font-size:clamp(30px,4.2vw,52px);\n    line-height:1.02;\n    letter-spacing:-.018em;\n    margin:0 0 6px;\n  }\n  h1 em{font-style:italic;color:var(--application)}\n  .dek{\n    font-family:var(--serif);\n    font-size:15.5px;\n    font-style:italic;\n    color:var(--ink-2);\n    margin:0 0 22px;\n    max-width:70ch;\n  }\n  .figures{\n    display:flex;\n    gap:38px;\n    padding:15px 0 17px;\n    border-top:1px solid var(--rule);\n    flex-wrap:wrap;\n  }\n  .fig{display:flex;flex-direction:column;gap:1px}\n  .fig b{\n    font-family:var(--serif);\n    font-size:23px;\n    font-weight:500;\n    line-height:1.1;\n    font-variant-numeric:tabular-nums;\n    letter-spacing:-.015em;\n  }\n  .fig span{\n    font-family:var(--mono);\n    font-size:9.5px;\n    letter-spacing:.16em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n  }\n  nav{\n    display:flex;\n    gap:0;\n    padding:0 42px;\n    border-bottom:1px solid var(--rule);\n    background:rgba(255,253,249,.55);\n    position:sticky;\n    top:0;\n    z-index:20;\n    backdrop-filter:blur(9px);\n  }\n  nav button{\n    appearance:none;\n    border:0;\n    background:none;\n    padding:15px 22px 13px;\n    margin:0;\n    font-family:var(--sans);\n    font-size:12.5px;\n    font-weight:500;\n    letter-spacing:.055em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    cursor:pointer;\n    border-bottom:2px solid transparent;\n    margin-bottom:-1px;\n    transition:color .16s ease,border-color .16s ease;\n    position:relative;\n  }\n  nav button:hover{color:var(--ink)}\n  nav button.on{color:var(--ink);border-bottom-color:var(--application)}\n  nav button:focus-visible{outline:2px solid var(--method);outline-offset:-4px}\n  main{padding:0 42px 72px}\n  .panel{display:none}\n  .panel.on{display:block}\n  .sheet{\n    background:var(--paper-2);\n    border:1px solid var(--rule);\n    border-radius:2px;\n    box-shadow:0 1px 0 var(--rule-soft),0 14px 34px -26px rgba(23,24,28,.34);\n    margin-top:26px;\n    position:relative;\n  }\n  .bar{\n    display:flex;\n    gap:20px;\n    align-items:center;\n    flex-wrap:wrap;\n    padding:13px 20px;\n    border-bottom:1px solid var(--rule-soft);\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.06em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    position:relative;\n    z-index:1;\n  }\n  .bar label{\n    display:inline-flex;\n    gap:7px;\n    align-items:center;\n    cursor:pointer;\n    color:var(--ink-2);\n    text-transform:none;\n    letter-spacing:.01em;\n    font-family:var(--sans);\n    font-size:12.5px;\n    user-select:none;\n  }\n  .bar input[type=checkbox]{\n    appearance:none;\n    width:14px;height:14px;\n    border:1px solid var(--ink-3);\n    border-radius:2px;\n    background:var(--paper-2);\n    cursor:pointer;\n    position:relative;\n    transition:background .13s ease,border-color .13s ease;\n  }\n  .bar input[type=checkbox]:checked{background:var(--ink);border-color:var(--ink)}\n  .bar input[type=checkbox]:checked::after{\n    content:\"\";\n    position:absolute;\n    left:4px;top:1px;\n    width:4px;height:8px;\n    border:solid var(--paper-2);\n    border-width:0 1.6px 1.6px 0;\n    transform:rotate(42deg);\n  }\n  .bar .stat{margin-left:auto;color:var(--ink-2);font-variant-numeric:tabular-nums}\n  canvas{display:block;width:100%;position:relative;z-index:1;cursor:crosshair;\n  height:calc(var(--cvh,0.46) * 100vw);min-height:420px;max-height:78vh}\n  .caption{\n    padding:13px 20px 16px;\n    border-top:1px solid var(--rule-soft);\n    font-family:var(--serif);\n    font-size:12.8px;\n    line-height:1.62;\n    color:var(--ink-2);\n    max-width:96ch;\n    position:relative;\n    z-index:1;\n  }\n  .caption b{font-weight:600;color:var(--ink);font-style:normal}\n  .legend{\n    display:flex;\n    gap:18px;\n    flex-wrap:wrap;\n    padding:13px 20px;\n    border-top:1px solid var(--rule-soft);\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.04em;\n    color:var(--ink-2);\n    position:relative;\n    z-index:1;\n  }\n  .legend span{display:inline-flex;align-items:center;gap:6px}\n  .legend i{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}\n  .legend .lg-note{\n    color:var(--ink-3);\n    font-style:italic;\n    font-family:var(--serif);\n    letter-spacing:0;\n    font-size:11.5px;\n  }\n  /* ---- selection panel ---- */\n  #relPanel{display:none;border-top:1px solid var(--rule);background:var(--paper-2);\n    position:relative;z-index:1;animation:rise .32s cubic-bezier(.22,.68,.28,1) both}\n  #relPanel.on{display:block}\n  .rp-head{padding:15px 20px 12px;border-bottom:1px solid var(--rule-soft);position:relative}\n  .rp-title{font-family:var(--serif);font-size:15.5px;line-height:1.35;color:var(--ink);\n    padding-right:34px;max-width:92ch}\n  .rp-meta{margin-top:5px;font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;\n    color:var(--ink-3)}\n  .rp-close{position:absolute;top:12px;right:16px;width:24px;height:24px;\n    border:1px solid var(--rule);background:var(--paper-2);border-radius:2px;\n    font-size:15px;line-height:1;color:var(--ink-2);cursor:pointer}\n  .rp-close:hover{background:var(--paper);color:var(--ink)}\n  .rp-cols{display:grid;grid-template-columns:1fr 1fr;gap:0}\n  .rp-col{padding:14px 20px 16px}\n  .rp-col + .rp-col{border-left:1px solid var(--rule-soft)}\n  .rp-col h4{margin:0 0 9px;font-family:var(--sans);font-size:11px;font-weight:600;\n    letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)}\n  .rp-col h4 b{font-family:var(--serif);font-size:14px;color:var(--ink);margin-left:2px}\n  .rp-hint{text-transform:none;letter-spacing:0;font-weight:400;font-family:var(--serif);\n    font-style:italic;color:var(--ink-3);margin-left:5px}\n  .rp-col ul{list-style:none;margin:0;padding:0;max-height:224px;overflow-y:auto}\n  .rp-col li{display:flex;gap:7px;align-items:baseline;padding:5px 6px;margin:0 -6px;\n    border-radius:2px;font-size:12.5px;line-height:1.45;color:var(--ink-2);cursor:pointer}\n  .rp-col li:hover{background:var(--paper);color:var(--ink)}\n  .rk{color:var(--application);flex:0 0 auto;font-family:var(--mono);font-size:11px}\n  .ry{color:var(--ink-3);flex:0 0 auto;font-family:var(--mono);font-size:10.5px;\n    font-variant-numeric:tabular-nums}\n  .rt{flex:1 1 auto}\n  .rp-empty{margin:0;font-family:var(--serif);font-style:italic;font-size:12.5px;\n    color:var(--ink-3)}\n  .rp-foot{padding:10px 20px 14px;border-top:1px solid var(--rule-soft)}\n  .rp-foot a{font-family:var(--mono);font-size:10.5px;color:var(--method);\n    text-decoration:none;word-break:break-all}\n  .rp-foot a:hover{text-decoration:underline}\n\n  #tip{\n    position:fixed;\n    pointer-events:none;\n    background:var(--ink);\n    color:var(--paper);\n    font-family:var(--sans);\n    font-size:12.5px;\n    line-height:1.5;\n    padding:9px 12px;\n    border-radius:2px;\n    max-width:360px;\n    opacity:0;\n    transform:translateY(3px);\n    transition:opacity .13s ease,transform .13s ease;\n    z-index:60;\n    box-shadow:0 10px 26px -12px rgba(0,0,0,.5);\n  }\n  #tip.on{opacity:1;transform:translateY(0)}\n  #tip b{font-family:var(--serif);font-weight:500;font-size:13.5px}\n  @keyframes rise{\n    from{opacity:0;transform:translateY(11px)}\n    to{opacity:1;transform:translateY(0)}\n  }\n  .masthead>*{animation:rise .62s cubic-bezier(.22,.68,.28,1) both}\n  .masthead>*:nth-child(1){animation-delay:.02s}\n  .masthead>*:nth-child(2){animation-delay:.08s}\n  .masthead>*:nth-child(3){animation-delay:.14s}\n  .masthead>*:nth-child(4){animation-delay:.20s}\n  nav{animation:rise .62s cubic-bezier(.22,.68,.28,1) .26s both}\n  .panel.on .sheet{animation:rise .5s cubic-bezier(.22,.68,.28,1) both}\n  @media (prefers-reduced-motion:reduce){\n    *{animation:none!important;transition:none!important}\n  }\n  @media (max-width:760px){\n    .masthead{padding:20px 20px 0}\n    nav{padding:0 20px;overflow-x:auto}\n    main{padding:0 20px 48px}\n    .figures{gap:24px}\n  }\n</style>\n</head>\n<body>\n\n<header class=\"masthead\">\n  <div class=\"kicker\">Zotero Library \u00b7 Generated Atlas</div>\n  <h1>\u6587\u732e\u5730\u56fe<em>.</em></h1>\n  <p class=\"dek\">\u56db\u4e2a\u89c6\u89d2\u8bfb\u540c\u4e00\u4e2a\u6587\u732e\u5e93\uff1a\u8c01\u5f15\u7528\u4e86\u8c01\u3001\u4e3b\u9898\u5982\u4f55\u805a\u62e2\u3001\u65b9\u6cd5\u5728\u65f6\u95f4\u4e0a\u600e\u6837\u94fa\u5f00\u3001\u7814\u7a76\u843d\u5728\u54ea\u91cc\u3002</p>\n  <div class=\"figures\" id=\"figures\"></div>\n</header>\n\n<nav>\n  <button data-tab=\"rel\" class=\"on\">\u5f15\u7528\u7f51\u7edc</button>\n  <button data-tab=\"sem\">\u8bed\u4e49\u5730\u56fe</button>\n  <button data-tab=\"tim\">\u65f6\u95f4 \u00d7 \u5206\u7c7b</button>\n  <button data-tab=\"geo\">\u5730\u7406\u5206\u5e03</button>\n</nav>\n\n<main>\n  <section class=\"panel on\" id=\"p-rel\">\n    <div class=\"sheet\">\n      <div class=\"bar\">\n        <label><input type=\"checkbox\" id=\"relLabels\"> \u663e\u793a\u6807\u9898</label>\n        <label><input type=\"checkbox\" id=\"relIsolated\"> \u542b\u5b64\u7acb\u6587\u732e</label>\n        <span class=\"stat\" id=\"relStat\"></span>\n      </div>\n      <canvas id=\"c-rel\" style=\"--cvh:0.46\"></canvas>\n      <div id=\"relPanel\"></div>\n  <div class=\"legend\" id=\"relLegend\"></div>\n      <div class=\"caption\">\u8fb9\u8868\u793a<b>\u672c\u5e93\u5185\u90e8\u7684\u5f15\u7528\u5173\u7cfb</b>\uff0c\u6765\u81ea OpenCitations COCI\u3002\u7bad\u5934 A \u2192 B \u610f\u4e3a A \u5f15\u7528\u4e86 B\uff1b\u53ea\u6709\u4e24\u7aef\u90fd\u5728\u5e93\u5185\u624d\u753b\u7ebf\uff0c\u56e0\u6b64\u6bcf\u6761\u8fb9\u90fd\u662f\u53ef\u6838\u5b9e\u7684\u5f15\u7528\uff0c\u800c\u975e\u63a8\u65ad\u7684\u76f8\u4f3c\u5ea6\u3002\u70b9\u7684\u5927\u5c0f\u662f\u8be5\u6587\u732e\u5728\u7f51\u7edc\u4e2d\u7684\u8fde\u63a5\u6570\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-sem\">\n    <div class=\"sheet\">\n      <div class=\"bar\">\n        <label><input type=\"checkbox\" id=\"semLabels\"> \u663e\u793a\u6807\u9898</label>\n        <span class=\"stat\" id=\"semStat\"></span>\n      </div>\n      <canvas id=\"c-sem\" style=\"--cvh:0.46\"></canvas>\n      <div class=\"legend\" id=\"semLegend\"></div>\n      <div class=\"caption\">\u7528\u6807\u9898\u4e0e\u7b14\u8bb0\u7684 <b>TF-IDF \u5411\u91cf</b>\u505a\u4e8c\u7ef4\u6301\u6295\u5f71\uff0c\u8ddd\u79bb\u8fd1\u8868\u793a\u7528\u8bcd\u76f8\u4f3c\u3002\u8fd9\u662f\u57fa\u4e8e\u6587\u672c\u7684\u63cf\u8ff0\u6027\u5e03\u5c40\uff0c\u4e0d\u662f\u5f15\u7528\u5173\u7cfb\uff1b\u4e3b\u9898\u63a5\u8fd1\u7684\u6587\u732e\u4f1a\u81ea\u7136\u805a\u62e2\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-tim\">\n    <div class=\"sheet\">\n      <div class=\"bar\"><span class=\"stat\" id=\"timStat\"></span></div>\n      <canvas id=\"c-tim\" style=\"--cvh:0.44\"></canvas>\n      <div class=\"caption\">\u6a2a\u8f74\u5e74\u4efd\u3001\u7eb5\u8f74\u5206\u7c7b\u3002\u70b9\u7684\u5927\u5c0f\u6309<b>\u5f15\u7528\u6570</b>\u7f29\u653e\uff0c\u53ef\u4ee5\u770b\u51fa\u6bcf\u4e2a\u5b50\u7c7b\u7684\u65f6\u95f4\u8986\u76d6\u8303\u56f4\u4e0e\u6838\u5fc3\u6587\u732e\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-geo\">\n    <div class=\"sheet\">\n      <div class=\"bar\"><span class=\"stat\" id=\"geoStat\"></span></div>\n      <canvas id=\"c-geo\" style=\"--cvh:0.44\"></canvas>\n      <div class=\"legend\" id=\"geoLegend\"></div>\n      <div class=\"caption\">\u7814\u7a76\u533a\u57df\u7531\u6807\u9898\u4e0e\u7b14\u8bb0\u4e2d\u7684<b>\u5730\u540d\u8bc6\u522b</b>\uff0c\u4e00\u7bc7\u6587\u732e\u53ef\u80fd\u5c5e\u4e8e\u591a\u4e2a\u533a\u57df\u3002\u6709\u6587\u732e\u7684\u533a\u57df\u4f1a<b>\u52a0\u7c97\u5176\u884c\u653f\u8fb9\u754c</b>\uff0c\u8f6e\u5ed3\u5185\u7684\u6570\u5b57\u662f\u8be5\u533a\u57df\u7684\u6587\u732e\u6570\uff1b\u4e2d\u56fd\u5b50\u533a\u57df\u7528\u6696\u8272\u53e0\u5728\u56fd\u5185\u8f6e\u5ed3\u4e4b\u4e0a\u3002\u7eaf\u65b9\u6cd5\u8bba\u6587\u6ca1\u6709\u7814\u7a76\u533a\u57df\uff0c\u56e0\u6b64\u4e0d\u4e0a\u56fe\u3002</div>\n    </div>\n  </section>\n</main>\n<div id=\"tip\"></div>\n\n<script>\n\nconst DATA = __DATA__;\nconst GEO = @@WORLD@@;\nconst items = DATA.items, edges = DATA.edges;\nconst tip = document.getElementById('tip');\n\n// ---------- shared helpers ----------\nconst METHOD = new Set(['\u7edf\u8ba1\u5730\u7edf\u8ba1','\u673a\u5668\u5b66\u4e60','\u6df1\u5ea6\u5b66\u4e60','\u6570\u636e\u540c\u5316\u4e0e\u96c6\u5408']);\nfunction familyOf(c){ return !c ? 'none' : (METHOD.has(c) ? 'method' : 'application'); }\nconst COLORS = {\n  method:'#2f4a6d', application:'#a63d2a', none:'#8d8f96'\n};\nconst SUBS = [...new Set(items.map(i=>i.collection).filter(Boolean))]\n  .sort((a,b)=>{\n    const order=['\u7edf\u8ba1\u5730\u7edf\u8ba1','\u673a\u5668\u5b66\u4e60','\u6df1\u5ea6\u5b66\u4e60','\u6570\u636e\u540c\u5316\u4e0e\u96c6\u5408',\n                 '\u4ea7\u54c1\u4e92\u6bd4\u4e0e\u9009\u62e9\u654f\u611f\u6027','\u957f\u671f\u8d8b\u52bf\u4e0e\u65ad\u70b9','\u5065\u5eb7\u4e0e\u66b4\u9732\u5f71\u54cd','\u6570\u636e\u8c31\u7cfb\u4e0e\u9a8c\u8bc1\u65b9\u6cd5'];\n    return order.indexOf(a)-order.indexOf(b);\n  });\n\n// A canvas needs its backing store to match its CSS box times the device pixel\n// ratio. Reading only clientWidth once meant the drawing kept its old scale\n// after browser zoom, and the hard-coded height attribute stopped the canvas\n// from growing with the window.\nfunction fitCanvas(cv){\n  const dpr = window.devicePixelRatio || 1;\n  const rect = cv.getBoundingClientRect();\n  const w = Math.max(1, Math.round(rect.width));\n  const h = Math.max(1, Math.round(rect.height));\n  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);\n  if (cv.width !== bw || cv.height !== bh) {\n    cv.width = bw;\n    cv.height = bh;\n  }\n  const ctx = cv.getContext('2d');\n  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);\n  return {ctx, w, h};\n}\n\n// Greedy wrap to at most maxLines; the last line is ellipsized if it still\n// overflows. Used for the selected node so its title can be read in full.\nfunction wrapText(ctx, text, maxWidth, maxLines) {\n  const words = text.split(/\\s+/);\n  const lines = [];\n  let cur = '';\n  for (let i = 0; i < words.length; i++) {\n    const cand = cur ? cur + ' ' + words[i] : words[i];\n    if (ctx.measureText(cand).width <= maxWidth || !cur) {\n      cur = cand;\n    } else {\n      lines.push(cur);\n      cur = words[i];\n      if (lines.length === maxLines - 1) {\n        // last allowed line: absorb the rest then ellipsize\n        cur = [cur].concat(words.slice(i)).join(' ');\n        break;\n      }\n    }\n  }\n  if (cur) lines.push(cur);\n  const out = lines.slice(0, maxLines);\n  if (out.length === maxLines) {\n    const last = out[maxLines - 1];\n    if (ctx.measureText(last).width > maxWidth || lines.length > maxLines) {\n      out[maxLines - 1] = clipText(ctx, last, maxWidth);\n    }\n  }\n  return out.filter(Boolean);\n}\n\n// Trim to the width that is actually free, with a real ellipsis. A hard slice\n// without one reads like the title itself is short.\nfunction clipText(ctx, text, maxWidth) {\n  if (maxWidth <= 12) return '';\n  if (ctx.measureText(text).width <= maxWidth) return text;\n  const ell = '\u2026';\n  let lo = 0, hi = text.length;\n  while (lo < hi) {\n    const mid = Math.ceil((lo + hi) / 2);\n    if (ctx.measureText(text.slice(0, mid) + ell).width <= maxWidth) lo = mid;\n    else hi = mid - 1;\n  }\n  return lo > 0 ? text.slice(0, lo) + ell : '';\n}\n\nfunction showTip(evt, html){\n  tip.innerHTML = html; tip.classList.add('on');\n  tip.style.left = Math.min(evt.clientX+14, innerWidth-350)+'px';\n  tip.style.top  = Math.min(evt.clientY+14, innerHeight-90)+'px';\n}\nfunction hideTip(){ tip.classList.remove('on'); }\nfunction esc(s){ return (s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }\n\ndocument.querySelectorAll('nav button').forEach(b=>{\n  b.onclick = ()=>{\n    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on'));\n    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));\n    b.classList.add('on');\n    document.getElementById('p-'+b.dataset.tab).classList.add('on');\n    draw[b.dataset.tab]();\n  };\n});\n\n// ---------- 1. relationship graph (force-directed) ----------\nlet relState = null;\nfunction layoutRelation(includeIsolated){\n  // Only items that take part in at least one in-library citation are laid\n  // out. Isolated nodes have no spring pulling them in, so repulsion drives\n  // them to the frame and they read as a meaningless border.\n  const degree = new Map(items.map(it=>[it.key,0]));\n  const linkPairs = [];\n  for (const e of edges){\n    if (degree.has(e.source) && degree.has(e.target) && e.source!==e.target){\n      linkPairs.push([e.source, e.target]);\n      degree.set(e.source, degree.get(e.source)+1);\n      degree.set(e.target, degree.get(e.target)+1);\n    }\n  }\n  const keep = items.filter(it=>includeIsolated || degree.get(it.key) > 0);\n  const nodes = keep.map(it=>({it, x:0, y:0, deg:degree.get(it.key)}));\n  const idx = new Map(nodes.map((nd,i)=>[nd.it.key,i]));\n  const links = linkPairs.filter(([a,b])=>idx.has(a)&&idx.has(b))\n    .map(([a,b])=>({a:idx.get(a), b:idx.get(b)}));\n  const isolated = items.length - nodes.length;\n\n  // Fruchterman-Reingold in a fixed square world, then scaled to the canvas.\n  const n = nodes.length, W = 1000, H = 1000;\n  const k = Math.sqrt((W*H)/Math.max(n,1)) * 0.72;\n  // Seed on a sunflower spiral so no two nodes start coincident.\n  const g = Math.PI*(3-Math.sqrt(5));\n  nodes.forEach((nd,i)=>{\n    const r = Math.sqrt((i+0.5)/n) * Math.min(W,H)*0.46;\n    const a = i*g;\n    nd.x = W/2 + r*Math.cos(a);\n    nd.y = H/2 + r*Math.sin(a);\n  });\n  let temp = W*0.10;\n  const ITER = 420;\n  for (let step=0; step<ITER; step++){\n    const disp = nodes.map(()=>({x:0,y:0}));\n    // repulsion: k^2/d\n    for (let i=0;i<n;i++){\n      for (let j=i+1;j<n;j++){\n        let dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;\n        let d=Math.sqrt(dx*dx+dy*dy);\n        if (d < 0.01){ d=0.01; dx=0.01*(i-j); dy=0.01*(i+j); }\n        const f = (k*k)/d;\n        const ux=dx/d, uy=dy/d;\n        disp[i].x += ux*f; disp[i].y += uy*f;\n        disp[j].x -= ux*f; disp[j].y -= uy*f;\n      }\n    }\n    // attraction: d^2/k, weighted so hub edges do not dominate\n    for (const l of links){\n      const A=nodes[l.a], B=nodes[l.b];\n      let dx=A.x-B.x, dy=A.y-B.y;\n      let d=Math.sqrt(dx*dx+dy*dy);\n      if (d < 0.01) d=0.01;\n      const f = (d*d)/k;\n      const ux=dx/d, uy=dy/d;\n      disp[l.a].x -= ux*f; disp[l.a].y -= uy*f;\n      disp[l.b].x += ux*f; disp[l.b].y += uy*f;\n    }\n    // gravity towards centre keeps disconnected items from drifting away\n    for (let i=0;i<n;i++){\n      const dx = nodes[i].x - W/2, dy = nodes[i].y - H/2;\n      disp[i].x -= dx*0.012; disp[i].y -= dy*0.012;\n    }\n    // apply with temperature limit\n    for (let i=0;i<n;i++){\n      const d = Math.sqrt(disp[i].x*disp[i].x + disp[i].y*disp[i].y);\n      if (d > 0){\n        const lim = Math.min(d, temp);\n        nodes[i].x += disp[i].x/d*lim;\n        nodes[i].y += disp[i].y/d*lim;\n      }\n      nodes[i].x = Math.max(10, Math.min(W-10, nodes[i].x));\n      nodes[i].y = Math.max(10, Math.min(H-10, nodes[i].y));\n    }\n    temp = Math.max(temp*0.985, 0.6);\n  }\n  // Key -> neighbour key set, so selection highlighting is O(deg) not O(edges).\n  const nbrOf = new Map();\n  for (const nd of nodes) nbrOf.set(nd.it.key, new Set());\n  for (const l of links){\n    nbrOf.get(nodes[l.a].it.key).add(nodes[l.b].it.key);\n    nbrOf.get(nodes[l.b].it.key).add(nodes[l.a].it.key);\n  }\n  return {nodes, links, isolated, nbrOf, selected: null};\n}\nfunction drawRel(){\n  const cv = document.getElementById('c-rel');\n  const inc = document.getElementById('relIsolated') && document.getElementById('relIsolated').checked;\n  if (!relState || relState.includeIsolated !== inc) relState = layoutRelation(inc), relState.includeIsolated = inc;\n  const {ctx,w,h} = fitCanvas(cv);\n  if (!relState.bounds){\n    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;\n    for (const nd of relState.nodes){\n      x0=Math.min(x0,nd.x);x1=Math.max(x1,nd.x);\n      y0=Math.min(y0,nd.y);y1=Math.max(y1,nd.y);\n    }\n    relState.bounds = {x0,x1,y0,y1};\n  }\n  const b=relState.bounds;\n  const pad=54;\n  const sx=(w-pad*2)/Math.max(1,b.x1-b.x0), sy=(h-pad*2)/Math.max(1,b.y1-b.y0);\n  const s=Math.min(sx,sy), cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2;\n  const px=x=>(x-cx)*s+w/2, py=y=>(y-cy)*s+h/2;\n\n  const sel = relState.selected;\n  const nbrs = sel ? (relState.nbrOf.get(sel) || new Set()) : null;\n\n  ctx.clearRect(0,0,w,h);\n\n  // edges: dim unless they touch the selection\n  ctx.lineWidth=1;\n  for (const l of relState.links){\n    const A=relState.nodes[l.a], B=relState.nodes[l.b];\n    const touch = sel && (A.it.key===sel || B.it.key===sel);\n    ctx.strokeStyle = sel\n      ? (touch ? 'rgba(31,53,87,.75)' : 'rgba(47,74,109,.06)')\n      : 'rgba(47,74,109,.20)';\n    ctx.lineWidth = touch ? 1.8 : 1;\n    ctx.beginPath(); ctx.moveTo(px(A.x),py(A.y)); ctx.lineTo(px(B.x),py(B.y)); ctx.stroke();\n  }\n  ctx.lineWidth = 1;\n\n  const labels = document.getElementById('relLabels').checked;\n  // draw faded nodes first so the highlighted ones sit on top\n  const order = relState.nodes.slice().sort((a,c)=>{\n    const ra = sel ? (a.it.key===sel ? 2 : (nbrs.has(a.it.key) ? 1 : 0)) : 1;\n    const rc = sel ? (c.it.key===sel ? 2 : (nbrs.has(c.it.key) ? 1 : 0)) : 1;\n    return ra-rc;\n  });\n  for (const nd of order){\n    const it=nd.it;\n    const isSel  = sel && it.key===sel;\n    const isNbr  = sel && nbrs.has(it.key);\n    const dim    = sel && !isSel && !isNbr;\n    const r = 4.2+Math.min(nd.deg,6)*1.15 + (isSel ? 3 : 0);\n\n    if (isSel){\n      // halo so the selected node is unmistakable even in a dense cluster\n      ctx.beginPath(); ctx.arc(px(nd.x),py(nd.y),r+7,0,7);\n      ctx.fillStyle='rgba(166,61,42,.18)'; ctx.fill();\n    }\n    ctx.beginPath(); ctx.arc(px(nd.x),py(nd.y),r,0,7);\n    ctx.fillStyle = COLORS[familyOf(it.collection)] || COLORS.none;\n    ctx.globalAlpha = dim ? .16 : (nd.deg ? 1 : .42);\n    ctx.fill();\n    ctx.globalAlpha = 1;\n    if (isSel){\n      ctx.strokeStyle='#a63d2a'; ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=1;\n    }\n\n    if ((labels && nd.deg && !dim) || isSel){\n      ctx.fillStyle = dim ? 'rgba(90,93,102,.25)' : '#5a5d66';\n      ctx.font = (isSel ? '600 11px' : '10px') + ' Georgia,serif';\n      const X = px(nd.x) + r + 4, Y = py(nd.y) + 3;\n      const room = w - (px(nd.x) + r + 8);\n      if (isSel){\n        // The selected node gets its whole title: wrap to as many lines as the\n        // canvas side allows (up to 3), and only ellipsize what still overflows.\n        const lines = wrapText(ctx, it.title, Math.max(120, Math.min(room, 360)), 4);\n        lines.forEach((ln, k)=> ctx.fillText(ln, X, Y + k*13));\n      } else {\n        const txt = clipText(ctx, it.title, Math.min(room, 300));\n        if (txt) ctx.fillText(txt, X, Y);\n      }\n    }\n  }\n  relState.proj = {px,py};\n\n  document.getElementById('relStat').textContent =\n    `${relState.nodes.length} \u7bc7\u6709\u5f15\u7528\u5173\u7cfb \u00b7 ${relState.links.length} \u6761\u8fb9` +\n    (relState.isolated ? ` \u00b7 ${relState.isolated} \u7bc7\u5b64\u7acb\u672a\u663e\u793a` : '') +\n    (sel ? ` \u00b7 \u5df2\u9009 1 \u7bc7` : ' \u00b7 \u70b9\u51fb\u8282\u70b9\u67e5\u770b\u90bb\u5c45');\n\n  const lg=document.getElementById('relLegend');\n  lg.innerHTML = `<span><i style=\"background:${COLORS.method}\"></i>\u65b9\u6cd5\u7c7b</span>\n    <span><i style=\"background:${COLORS.application}\"></i>\u5e94\u7528\u7c7b</span>\n    <span><i style=\"background:${COLORS.none}\"></i>\u65e0\u5206\u7c7b</span>\n    <span>\u70b9\u7684\u5927\u5c0f = \u8fde\u63a5\u6570</span>\n    <span class=\"lg-note\">\u70b9\u51fb\u8282\u70b9\u67e5\u770b\u5b83\u5f15\u7528\u4e86\u8c01\u3001\u88ab\u8c01\u5f15\u7528\uff1b\u70b9\u7a7a\u767d\u5904\u6216\u6309 Esc \u53d6\u6d88</span>`;\n\n  renderRelPanel();\n}\n\n// ---------------------------------------------------------------- panel ----\n// Who cites the selection, and what it cites. Direction matters in a citation\n// graph, so the two are listed separately instead of as one neighbour set.\nfunction renderRelPanel(){\n  const box = document.getElementById('relPanel');\n  if (!box) return;\n  const sel = relState && relState.selected;\n  if (!sel){\n    box.classList.remove('on');\n    box.innerHTML = '';\n    return;\n  }\n  const node = relState.nodes.find(n=>n.it.key===sel);\n  if (!node) { box.classList.remove('on'); return; }\n  const it = node.it;\n\n  const into = [];   // papers that cite this one\n  const out = [];    // papers this one cites\n  for (const l of relState.links){\n    const A=relState.nodes[l.a].it.key, B=relState.nodes[l.b].it.key;\n    if (B===sel) into.push(relState.nodes[l.a].it);\n    else if (A===sel) out.push(relState.nodes[l.b].it);\n  }\n  const byYear = (a,b)=>(a.year||0)-(b.year||0);\n  into.sort(byYear); out.sort(byYear);\n\n  const row = (x, mark) => `\n    <li data-key=\"${x.key}\">\n      <span class=\"rk\">${mark}</span>\n      <span class=\"ry\">${x.year||'\u2014'}</span>\n      <span class=\"rt\">${esc(x.title)}</span>\n    </li>`;\n\n  box.innerHTML = `\n    <div class=\"rp-head\">\n      <div class=\"rp-title\">${esc(it.title)}</div>\n      <div class=\"rp-meta\">\n        ${it.year||'\u2014'} \u00b7 ${esc(it.collection)||'\u672a\u5206\u7c7b'}\n        ${it.cited!=null?' \u00b7 \u88ab\u5f15 '+it.cited:''}\n        \u00b7 \u8fde\u63a5 ${node.deg}\n      </div>\n      <button class=\"rp-close\" title=\"\u53d6\u6d88\u9009\u62e9\uff08Esc\uff09\">\u00d7</button>\n    </div>\n    <div class=\"rp-cols\">\n      <div class=\"rp-col\">\n        <h4>\u88ab\u5f15 <b>${into.length}</b> <span class=\"rp-hint\">\u672c\u6587\u5e93\u5185\u5f15\u7528\u5b83\u7684</span></h4>\n        ${into.length ? `<ul>${into.map(x=>row(x,'\u2190')).join('')}</ul>`\n                      : '<p class=\"rp-empty\">\u5e93\u5185\u6682\u65e0\u5176\u4ed6\u6587\u732e\u5f15\u7528\u5b83</p>'}\n      </div>\n      <div class=\"rp-col\">\n        <h4>\u5f15\u7528 <b>${out.length}</b> <span class=\"rp-hint\">\u5b83\u5f15\u7528\u7684\u5e93\u5185\u6587\u732e</span></h4>\n        ${out.length ? `<ul>${out.map(x=>row(x,'\u2192')).join('')}</ul>`\n                     : '<p class=\"rp-empty\">\u5b83\u6ca1\u6709\u5f15\u7528\u5e93\u5185\u5176\u4ed6\u6587\u732e</p>'}\n      </div>\n    </div>\n    <div class=\"rp-foot\">\n      ${it.doi ? `<a href=\"https://doi.org/${encodeURIComponent(it.doi)}\"\n                   target=\"_blank\" rel=\"noopener\">DOI ${esc(it.doi)}</a>` : ''}\n    </div>`;\n  box.classList.add('on');\n\n  box.querySelector('.rp-close').onclick = ()=>{ relState.selected=null; drawRel(); };\n  // Clicking a neighbour in the list walks to it.\n  box.querySelectorAll('li[data-key]').forEach(li=>{\n    li.onclick = ()=>{\n      relState.selected = li.dataset.key;\n      drawRel();\n      const p = relState.proj;\n      const n = relState.nodes.find(x=>x.it.key===relState.selected);\n      if (n && p) log_sel(n);\n    };\n  });\n}\nfunction log_sel(){ /* placeholder: panel scroll reset is handled below */ }\n\n// ------------------------------------------------------------- handlers ----\nfunction relNearest(ev){\n  if (!relState?.proj) return null;\n  const rect = ev.currentTarget.getBoundingClientRect();\n  const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;\n  let best=null, bd=196;   // 14 px\n  for (const nd of relState.nodes){\n    const dx = relState.proj.px(nd.x)-mx, dy = relState.proj.py(nd.y)-my;\n    const d = dx*dx+dy*dy;\n    if (d<bd){ bd=d; best=nd; }\n  }\n  return best;\n}\n\ndocument.getElementById('relLabels').onchange = drawRel;\ndocument.getElementById('relIsolated').onchange = ()=>{ relState.selected = null; drawRel(); };\n\ndocument.getElementById('c-rel').addEventListener('mousemove', ev=>{\n  const nd = relNearest(ev);\n  ev.currentTarget.style.cursor = nd ? 'pointer' : 'crosshair';\n  if (!nd){ hideTip(); return; }\n  const sel = relState.selected;\n  const isNbr = sel && relState.nbrOf.get(sel)?.has(nd.it.key);\n  showTip(ev, `<b>${esc(nd.it.title).slice(0,80)}</b><br>\n    ${nd.it.year||'\u2014'} \u00b7 ${esc(nd.it.collection)||'\u672a\u5206\u7c7b'}<br>\n    \u8fde\u63a5 ${nd.deg} \u6761${nd.it.cited!=null?' \u00b7 \u88ab\u5f15 '+nd.it.cited:''}\n    ${isNbr?'<br><span style=\"opacity:.7\">\u4e0e\u9009\u4e2d\u6587\u732e\u76f4\u63a5\u76f8\u8fde</span>':''}\n    <br><span style=\"opacity:.6\">\u70b9\u51fb\u67e5\u770b\u90bb\u5c45</span>`);\n});\n\ndocument.getElementById('c-rel').addEventListener('mouseleave', hideTip);\n\ndocument.getElementById('c-rel').addEventListener('click', ev=>{\n  const nd = relNearest(ev);\n  if (!nd){\n    if (relState.selected){ relState.selected = null; drawRel(); }\n    return;\n  }\n  // Clicking the selection again clears it, so the graph is one click to undo.\n  relState.selected = (relState.selected === nd.it.key) ? null : nd.it.key;\n  drawRel();\n});\n\ndocument.addEventListener('keydown', ev=>{\n  if (ev.key === 'Escape' && relState && relState.selected){\n    relState.selected = null; drawRel();\n  }\n});\n\n// ---------- 2. semantic map (TF-IDF + 2-D projection) ----------\nconst STOP = new Set(('the a an and or of to in for on with by from as at is are was were be been being '\n +'this that these those it its their our we they which such can may not no than then there here '\n +'using used use based via between among during over under more most less least also both each per '\n +'study paper result results show shows shown found however therefore thus while where when what how '\n +'\u6570\u636e \u6a21\u578b \u65b9\u6cd5 \u7814\u7a76 \u7ed3\u679c \u5206\u6790 \u8868\u660e \u63d0\u51fa \u901a\u8fc7 \u4ee5\u53ca \u53ef\u4ee5 \u8fdb\u884c \u4e00\u4e2a \u6211\u4eec \u4ed6\u4eec \u8fd9\u4e2a \u8fd9\u4e9b').split(/\\s+/));\nlet semState=null;\nfunction tokenize(s){\n  const out=[];\n  const en=(s||'').toLowerCase().match(/[a-z][a-z\\-]{2,}/g)||[];\n  out.push(...en.filter(w=>!STOP.has(w)));\n  const zh=(s||'').match(/[\\u4e00-\\u9fa5]{2,4}/g)||[];\n  out.push(...zh);\n  return out;\n}\nfunction buildSemantic(){\n  const docs = items.map(it=>tokenize(it.title+' '+(it.text||'')));\n  const df=new Map();\n  docs.forEach(toks=>{\n    for (const t of new Set(toks)) df.set(t,(df.get(t)||0)+1);\n  });\n  const N=docs.length;\n  // keep terms appearing in 2..40% of docs\n  const vocab=[...df.entries()].filter(([t,n])=>n>=2 && n<=N*0.4)\n    .sort((a,b)=>b[1]-a[1]).slice(0,420).map(x=>x[0]);\n  const vidx=new Map(vocab.map((t,i)=>[t,i]));\n  const vecs=docs.map(toks=>{\n    const v=new Float32Array(vocab.length);\n    const tf=new Map();\n    toks.forEach(t=>{ if(vidx.has(t)) tf.set(t,(tf.get(t)||0)+1); });\n    for (const [t,c] of tf){\n      const i=vidx.get(t);\n      v[i]=(1+Math.log(c))*Math.log(N/df.get(t));\n    }\n    let norm=0; for (let i=0;i<v.length;i++) norm+=v[i]*v[i];\n    norm=Math.sqrt(norm)||1;\n    for (let i=0;i<v.length;i++) v[i]/=norm;\n    return v;\n  });\n  // Project onto the top-2 principal directions via power iteration on XtX.\n  function powerIter(X, exclude){\n    const d=X[0].length;\n    let v=new Float32Array(d).map(()=>Math.random()-0.5);\n    for (let iter=0; iter<64; iter++){\n      const nv=new Float32Array(d);\n      for (const row of X){\n        let dot=0;\n        for (let i=0;i<d;i++) dot+=row[i]*v[i];\n        for (let i=0;i<d;i++) nv[i]+=row[i]*dot;\n      }\n      if (exclude) for (let i=0;i<d;i++) nv[i]-=exclude[i]*exclude.lambda;\n      let n=0; for (let i=0;i<d;i++) n+=nv[i]*nv[i];\n      n=Math.sqrt(n)||1;\n      for (let i=0;i<d;i++) v[i]=nv[i]/n;\n    }\n    let lambda=0;\n    for (const row of X){\n      let dot=0; for (let i=0;i<d;i++) dot+=row[i]*v[i];\n      lambda+=dot*dot;\n    }\n    return {v, lambda};\n  }\n  const pc1=powerIter(vecs,null);\n  // deflate for pc2\n  const v1=pc1.v.slice();\n  const X2=vecs.map(row=>{\n    let dot=0; for (let i=0;i<row.length;i++) dot+=row[i]*v1[i];\n    const out=new Float32Array(row.length);\n    for (let i=0;i<row.length;i++) out[i]=row[i]-dot*v1[i];\n    return out;\n  });\n  const pc2=powerIter(X2,null);\n  const xs=[], ys=[];\n  for (const row of vecs){\n    let a=0,b=0;\n    for (let i=0;i<row.length;i++){ a+=row[i]*pc1.v[i]; b+=row[i]*pc2.v[i]; }\n    xs.push(a); ys.push(b);\n  }\n  semState={xs,ys,vocab:vocab.length};\n  return semState;\n}\nfunction drawSem(){\n  const cv=document.getElementById('c-sem');\n  if (!semState) buildSemantic();\n  const {ctx,w,h}=fitCanvas(cv);\n  const xs=semState.xs, ys=semState.ys;\n  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);\n  const pad=56, sx=(w-pad*2)/Math.max(1e-6,x1-x0), sy=(h-pad*2)/Math.max(1e-6,y1-y0);\n  const s=Math.min(sx,sy), cx=(x0+x1)/2, cy=(y0+y1)/2;\n  const px=x=>(x-cx)*s+w/2, py=y=>(y-cy)*s+h/2;\n  ctx.clearRect(0,0,w,h);\n  const labels=document.getElementById('semLabels').checked;\n  items.forEach((it,i)=>{\n    const r=3.6+Math.min(it.cited||0,400)/120;\n    ctx.beginPath(); ctx.arc(px(xs[i]),py(ys[i]),Math.min(r,9),0,7);\n    ctx.fillStyle=COLORS[familyOf(it.collection)]||COLORS.none;\n    ctx.globalAlpha=.86; ctx.fill(); ctx.globalAlpha=1;\n    if (labels){\n      ctx.fillStyle='#5a5d66'; ctx.font='9.5px Georgia,serif';\n      const room = w - (px(xs[i]) + 10);\n      const txt = clipText(ctx, it.title, Math.min(room, 240));\n      if (txt) ctx.fillText(txt, px(xs[i])+5, py(ys[i])+3);\n    }\n  });\n  semState.proj={px,py};\n  document.getElementById('semStat').textContent =\n    `${items.length} \u7bc7 \u00b7 ${semState.vocab} \u4e2a\u7279\u5f81\u8bcd \u00b7 TF-IDF \u4e8c\u7ef4\u6301\u6295\u5f71`;\n  document.getElementById('semLegend').innerHTML =\n    `<span><i style=\"background:${COLORS.method}\"></i>\u65b9\u6cd5\u7c7b</span>\n     <span><i style=\"background:${COLORS.application}\"></i>\u5e94\u7528\u7c7b</span>\n     <span>\u8ddd\u79bb\u8fd1 = \u6807\u9898\u4e0e\u7b14\u8bb0\u7528\u8bcd\u76f8\u4f3c</span>`;\n}\ndocument.getElementById('semLabels').onchange = drawSem;\ndocument.getElementById('c-sem').addEventListener('mousemove', ev=>{\n  if (!semState?.proj) return;\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  let best=-1,bd=196;\n  items.forEach((_,i)=>{\n    const dx=semState.proj.px(semState.xs[i])-mx, dy=semState.proj.py(semState.ys[i])-my;\n    const d=dx*dx+dy*dy;\n    if (d<bd){bd=d;best=i;}\n  });\n  if (best>=0){\n    const it=items[best];\n    showTip(evt, `<b>${esc(it.title).slice(0,80)}</b><br>${it.year||'\u2014'} \u00b7 ${esc(it.collection)||'\u672a\u5206\u7c7b'}`);\n  } else hideTip();\n});\ndocument.getElementById('c-sem').addEventListener('mouseleave', hideTip);\n\n// ---------- 3. time x category ----------\nfunction drawTim(){\n  const cv=document.getElementById('c-tim');\n  const {ctx,w,h}=fitCanvas(cv);\n  const years=items.map(i=>i.year).filter(Boolean);\n  const y0=Math.min(...years), y1=Math.max(...years);\n  const left=128, right=26, top=26, bottom=38;\n  const rows=SUBS.concat(items.some(i=>!i.collection)?['(\u672a\u5206\u7c7b)']:[]).reverse();\n  const rowH=(h-top-bottom)/rows.length;\n  const px=y=>left+(y-y0)/Math.max(1,(y1-y0))*(w-left-right);\n  ctx.clearRect(0,0,w,h);\n  // x grid\n  ctx.strokeStyle='#ece6da'; ctx.fillStyle='#8a8d96'; ctx.font='11px Georgia,serif';\n  for (let y=y0; y<=y1; y+=(y1-y0>28?5:2)){\n    const x=px(y);\n    ctx.beginPath(); ctx.moveTo(x,top-6); ctx.lineTo(x,h-bottom); ctx.stroke();\n    ctx.fillText(String(y), x-11, h-bottom+16);\n  }\n  rows.forEach((name,ri)=>{\n    const cy=top+rowH*ri+rowH/2;\n    ctx.fillStyle='#3b3e46'; ctx.font='11.5px Georgia,serif';\n    ctx.textAlign='right';\n    ctx.fillText(clipText(ctx, name, left - 22), left-10, cy+4);\n    ctx.textAlign='left';\n    ctx.strokeStyle='#f2ede2';\n    ctx.beginPath(); ctx.moveTo(left,cy); ctx.lineTo(w-right,cy); ctx.stroke();\n    items.filter(it=>(it.collection||'(\u672a\u5206\u7c7b)')===name && it.year).forEach(it=>{\n      const x=px(it.year);\n      const jitter=(Math.random()-0.5)*rowH*0.62;\n      const r=2.6+Math.min(it.cited||0,400)/150;\n      ctx.beginPath(); ctx.arc(x,cy+jitter,Math.min(r,7),0,7);\n      ctx.fillStyle=COLORS[familyOf(it.collection)]||COLORS.none;\n      ctx.globalAlpha=.8; ctx.fill(); ctx.globalAlpha=1;\n    });\n  });\n  document.getElementById('timStat').textContent = `${y0}\u2013${y1} \u00b7 ${rows.length} \u4e2a\u5206\u7c7b`;\n}\ndocument.getElementById('c-tim').addEventListener('mousemove', ev=>{\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  const h=parseInt(cv.getAttribute('height'),10);\n  const left=128,right=26,top=26,bottom=38;\n  const rows=SUBS.concat(items.some(i=>!i.collection)?['(\u672a\u5206\u7c7b)']:[]).reverse();\n  const rowH=(h-top-bottom)/rows.length;\n  const ri=Math.floor((my-top)/rowH);\n  if (ri<0||ri>=rows.length) return hideTip();\n  const name=rows[ri];\n  const list=items.filter(it=>(it.collection||'(\u672a\u5206\u7c7b)')===name);\n  showTip(evt, `<b>${esc(name)}</b><br>${list.length} \u7bc7<br>\n    \u5e74\u4efd ${Math.min(...list.map(i=>i.year||9999))}\u2013${Math.max(...list.map(i=>i.year||0))}<br>\n    <span style=\"opacity:.7\">\u9f20\u6807\u6240\u5728\u884c\u7684\u5206\u7c7b\u5408\u8ba1</span>`);\n});\ndocument.getElementById('c-geo-tip');\ndocument.getElementById('c-tim').addEventListener('mouseleave', hideTip);\n\n// ---------- 4. geographic distribution ----------\n// Each region is drawn as its own administrative outline, thickened and tinted,\n// with the study count written inside. A bubble would only say \"somewhere near\n// here\"; an outline says \"this is the area studied\".\nconst REGION_STYLE = {\n  // The fill has to read as a COLOUR, not as a slightly darker grey. Blending\n  // navy #1f3557 at 28% over the beige base gives rgb(184,188,191): the blue\n  // channel leads red by only 7, which the eye reads as neutral grey -- the\n  // map looked uncoloured even though the fill was there. NPG blue #3C5488 at\n  // 55% gives rgb(140,152,178), a lead of 38, which is unmistakably blue.\n  country:  { stroke: '#1f3557', fill: 'rgba(60,84,136,.55)',  width: 2.8 },\n  province: { stroke: '#8f2f1c', fill: 'rgba(143,47,28,.42)',  width: 3.6 },\n};\n\nfunction ringArea(ring) {\n  let a = 0;\n  const n = ring.length / 2;\n  for (let i = 0; i < n; i++) {\n    const j = (i + 1) % n;\n    a += ring[2 * i] * ring[2 * j + 1] - ring[2 * j] * ring[2 * i + 1];\n  }\n  return Math.abs(a / 2);\n}\n\nfunction ringCentroid(ring) {\n  let a = 0, cx = 0, cy = 0;\n  const n = ring.length / 2;\n  for (let i = 0; i < n; i++) {\n    const j = (i + 1) % n;\n    const x0 = ring[2 * i], y0 = ring[2 * i + 1];\n    const x1 = ring[2 * j], y1 = ring[2 * j + 1];\n    const cross = x0 * y1 - x1 * y0;\n    a += cross;\n    cx += (x0 + x1) * cross;\n    cy += (y0 + y1) * cross;\n  }\n  if (Math.abs(a) < 1e-9) {\n    let sx = 0, sy = 0;\n    for (let i = 0; i < n; i++) { sx += ring[2 * i]; sy += ring[2 * i + 1]; }\n    return [sx / n, sy / n];\n  }\n  a *= 0.5;\n  return [cx / (6 * a), cy / (6 * a)];\n}\n\n// Largest ring of a shape set -- the mainland, not an outlying island.\nfunction mainRing(rings) {\n  let best = null, bestArea = 0;\n  for (const r of rings) {\n    const a = ringArea(r);\n    if (a > bestArea) { bestArea = a; best = r; }\n  }\n  return best;\n}\n\nfunction traceRings(ctx, rings, px, py) {\n  ctx.beginPath();\n  for (const ring of rings) {\n    for (let i = 0; i < ring.length; i += 2) {\n      const X = px(ring[i]), Y = py(ring[i + 1]);\n      i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);\n    }\n    ctx.closePath();\n  }\n}\n\nlet geoState = null;\n\nfunction drawGeo() {\n  const cv = document.getElementById('c-geo');\n  const { ctx, w, h } = fitCanvas(cv);\n  const counts = new Map();\n  for (const it of items) {\n    for (const r of (it.regions || [])) counts.set(r, (counts.get(r) || 0) + 1);\n  }\n\n  const LON0 = -180, LON1 = 180, LAT0 = 78, LAT1 = -58;\n  const pad = 28;\n  const sx = (w - pad * 2) / (LON1 - LON0);\n  const sy = (h - pad * 2) / (LAT0 - LAT1);\n  const px = lon => pad + (lon - LON0) * sx;\n  const py = lat => pad + (LAT0 - lat) * sy;\n\n  ctx.clearRect(0, 0, w, h);\n\n  // graticule\n  ctx.strokeStyle = '#f2ede2';\n  ctx.fillStyle = '#a8a49a';\n  ctx.font = '9.5px Georgia,serif';\n  for (let lon = -180; lon <= 180; lon += 30) {\n    ctx.beginPath(); ctx.moveTo(px(lon), py(LAT0)); ctx.lineTo(px(lon), py(LAT1)); ctx.stroke();\n  }\n  for (let lat = -60; lat <= 78; lat += 30) {\n    ctx.beginPath(); ctx.moveTo(px(LON0), py(lat)); ctx.lineTo(px(LON1), py(lat)); ctx.stroke();\n    ctx.fillText(lat + '\u00b0', pad - 20, py(lat) + 3);\n  }\n\n  // base map\n  ctx.fillStyle = '#f4f1e8';\n  ctx.strokeStyle = '#e7e0d2';\n  ctx.lineWidth = 0.55;\n  for (const name in GEO.countries) {\n    traceRings(ctx, GEO.countries[name], px, py);\n    ctx.fill('evenodd');\n    ctx.stroke();\n  }\n\n  // highlighted regions: countries first, then provinces on top so the\n  // sub-national areas stay legible inside \u4e2d\u56fd\n  const regions = GEO.regions;\n  const order = [];\n  for (const name in regions) if (regions[name].countries) order.push([name, 'country']);\n  for (const name in regions) if (regions[name].provinces) order.push([name, 'province']);\n\n  const placed = [];\n  for (const [name, level] of order) {\n    const n = counts.get(name) || 0;\n    if (!n) continue;\n    const spec = regions[name];\n    const rings = [];\n    const anchors = [];\n    for (const c of (spec.countries || [])) {\n      const rs = GEO.countries[c] || [];\n      if (!rs.length) continue;\n      for (const r of rs) rings.push(r);\n      const mr = mainRing(rs);\n      if (mr) anchors.push(ringCentroid(mr));\n    }\n    for (const p of (spec.provinces || [])) {\n      const rs = GEO.provinces[p] || [];\n      if (!rs.length) continue;\n      for (const r of rs) rings.push(r);\n      const mr = mainRing(rs);\n      if (mr) anchors.push(ringCentroid(mr));\n    }\n    if (!rings.length || !anchors.length) continue;\n\n    const st = REGION_STYLE[level];\n\n    // Colour exactly what was studied: a paper tagged \u975e\u6d32 studied Africa, so\n    // the continent is filled. What it must NOT do is draw every member's\n    // border -- that turned each continent into a dark mesh that read the same\n    // as the un-highlighted countries. Broad regions therefore fill only;\n    // single countries and provinces also get the thick boundary, because\n    // theirs is a single contour worth following.\n    const memberCount = (spec.countries || []).length + (spec.provinces || []).length;\n    const isBroadRegion = level === 'country' && memberCount > 3;\n\n    ctx.lineJoin = 'round';\n    traceRings(ctx, rings, px, py);\n    ctx.fillStyle = st.fill;\n    ctx.fill('evenodd');\n\n    if (!isBroadRegion) {\n      ctx.strokeStyle = st.stroke;\n      ctx.globalAlpha = 0.20;\n      ctx.lineWidth = st.width * 3.4;\n      ctx.stroke();\n      ctx.globalAlpha = 1;\n      ctx.lineWidth = st.width;\n      ctx.stroke();\n    }\n\n    // Mean of member centroids, so a union (\u6b27\u6d32, \u975e\u6d32) lands in its middle\n    // instead of on whichever member happens to be largest.\n    let ax = 0, ay = 0;\n    for (const a of anchors) { ax += a[0]; ay += a[1]; }\n    ax /= anchors.length;\n    ay /= anchors.length;\n\n    const text = String(n);\n    ctx.font = '700 14px Georgia,serif';\n    ctx.textAlign = 'center';\n    ctx.textBaseline = 'middle';\n    // East Asia packs six regions into a few degrees, so a label that lands on\n    // top of an already placed one is nudged until it clears.\n    const tw = ctx.measureText(text).width;\n    let X = px(ax), Y = py(ay);\n    const offsets = [[0,0],[0,-15],[0,15],[16,-8],[-16,-8],[16,9],[-16,9],[0,-28],[0,28]];\n    for (const [dx,dy] of offsets){\n      const box = { x: X+dx-tw/2-3, y: Y+dy-9, w: tw+6, h: 18 };\n      const hit = placed.some(q =>\n        !(box.x+box.w < q.bx || q.bx+q.bw < box.x ||\n          box.y+box.h < q.by || q.by+q.bh < box.y));\n      if (!hit){ X += dx; Y += dy; placed.box = box; break; }\n    }\n    // A small chip keeps the number legible even on top of a dark outline.\n    const cw = tw + 9, chh = 15;\n    ctx.beginPath();\n    ctx.rect(X - cw/2, Y - chh/2, cw, chh);\n    ctx.fillStyle = 'rgba(255,253,249,.96)';\n    ctx.fill();\n    ctx.strokeStyle = st.stroke;\n    ctx.lineWidth = 1;\n    ctx.globalAlpha = 0.55;\n    // Dashed border marks a broad-region total, which is a different claim\n    // from \"this country was studied\".\n    if (isBroadRegion) ctx.setLineDash([2.5, 2.5]);\n    ctx.stroke();\n    ctx.setLineDash([]);\n    ctx.globalAlpha = 1;\n    ctx.fillStyle = st.stroke;\n    ctx.fillText(text, X, Y);\n    placed.push({ name, n, level, x: X, y: Y,\n      bx: X-tw/2-3, by: Y-9, bw: tw+6, bh: 18 });\n  }\n  ctx.textAlign = 'left';\n  ctx.textBaseline = 'alphabetic';\n\n  geoState = { placed };\n\n  const lg = document.getElementById('geoLegend');\n  if (lg) {\n    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);\n    lg.innerHTML =\n      `<span><i style=\"background:${REGION_STYLE.country.stroke}\"></i>\u56fd\u5bb6 / \u533a\u57df</span>` +\n      `<span><i style=\"background:${REGION_STYLE.province.stroke}\"></i>\u4e2d\u56fd\u5b50\u533a\u57df</span>` +\n      rows.map(([nm, k]) =>\n        `<span style=\"color:#3b3e46\">${esc(nm)} <b style=\"font-variant-numeric:tabular-nums\">${k}</b></span>`\n      ).join('') +\n      `<span class=\"lg-note\">\u8f6e\u5ed3\u5185\u6570\u5b57 = \u8be5\u533a\u57df\u7684\u6587\u732e\u6570</span>`;\n  }\n\n  const none = items.filter(i => !(i.regions || []).length).length;\n  document.getElementById('geoStat').textContent =\n    `${counts.size} \u4e2a\u533a\u57df \u00b7 ${none} \u7bc7\u672a\u8bc6\u522b\u51fa\u533a\u57df\uff08\u4e0d\u4e0a\u56fe\uff09`;\n}\n\ndocument.getElementById('c-geo').addEventListener('mousemove', ev => {\n  if (!geoState) return;\n  const rect = ev.currentTarget.getBoundingClientRect();\n  const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;\n  let best = null, bd = 900;   // 30 px\n  for (const p of geoState.placed) {\n    const dx = p.x - mx, dy = p.y - my, d = dx * dx + dy * dy;\n    if (d < bd) { bd = d; best = p; }\n  }\n  if (best) {\n    const list = items.filter(i => (i.regions || []).includes(best.name));\n    const subs = {};\n    list.forEach(i => {\n      const c = i.collection || '\u672a\u5206\u7c7b';\n      subs[c] = (subs[c] || 0) + 1;\n    });\n    const top = Object.entries(subs).sort((a, b) => b[1] - a[1]).slice(0, 4)\n      .map(([k, v]) => `${esc(k)} ${v}`).join(' \u00b7 ');\n    showTip(evt, `<b>${esc(best.name)}</b> \u00b7 ${best.n} \u7bc7<br>` +\n      `<span style=\"opacity:.75\">${top}</span>`);\n  } else hideTip();\n});\ndocument.getElementById('c-geo').addEventListener('mouseleave', hideTip);\n\nif (!CanvasRenderingContext2D.prototype.roundRect){\n  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){\n    this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r);\n    this.arcTo(x+w,y+h,x,y+h,r); this.arcTo(x,y+h,x,y,r);\n    this.arcTo(x,y,x+w,y,r); this.closePath(); return this;\n  };\n}\n\n// ---------- boot ----------\nconst draw = {rel:drawRel, sem:drawSem, tim:drawTim, geo:drawGeo};\n\n// Masthead figures: the headline numbers, computed once from the payload.\n(function fillFigures(){\n  const years = items.map(i=>i.year).filter(Boolean);\n  const span = years.length ? `${Math.min(...years)}\u2013${Math.max(...years)}` : '\u2014';\n  const withDoi = items.filter(i=>i.doi).length;\n  const dead = items.filter(i=>!i.collection).length;\n  const figs = [\n    [items.length, '\u6587\u732e'],\n    [SUBS.length, '\u5206\u7c7b'],\n    [edges.length, '\u5e93\u5185\u5f15\u7528'],\n    [span, '\u5e74\u4efd\u8de8\u5ea6'],\n    [withDoi, '\u6709 DOI'],\n  ];\n  document.getElementById('figures').innerHTML = figs.map(([v,k])=>\n    `<div class=\"fig\"><b>${v}</b><span>${k}</span></div>`).join('');\n})();\n\ndrawRel();\n// Window resize and browser zoom both invalidate the backing store. Zoom\n// changes devicePixelRatio without changing the layout box, so resize alone is\n// not enough -- watch the ratio too.\nfunction redrawAll(){\n  const active = document.querySelector('.panel.on');\n  const id = active ? active.id.replace('p-','') : 'rel';\n  if (id === 'rel'){ drawRel(); }\n  else if (id === 'sem'){ drawSem(); }\n  else if (id === 'tim'){ drawTim(); }\n  else if (id === 'geo'){ drawGeo(); }\n}\nlet _lastDpr = window.devicePixelRatio || 1;\nfunction watchDpr(){\n  const now = window.devicePixelRatio || 1;\n  if (now !== _lastDpr){ _lastDpr = now; redrawAll(); }\n  requestAnimationFrame(watchDpr);\n}\nwindow.addEventListener('resize', ()=>{ relState=null; redrawAll(); });\nif (window.ResizeObserver){\n  const ro = new ResizeObserver(()=>{ relState=null; redrawAll(); });\n  document.querySelectorAll('canvas').forEach(c=>ro.observe(c));\n}\nrequestAnimationFrame(watchDpr);\n</script>\n</body>\n</html>\n";
// Country outlines as a JSON string, parsed once at first use. Writing it as
// an array literal means ~126 KB of bare numbers the JS parser must chew on;
// a string plus JSON.parse is both smaller to emit and harder to corrupt.
// Country outlines live in content/world.json, read once at build time.
// Inlining 126 KB here made bootstrap.js 305 KB and the add-on loader refused
// to evaluate it at all: no startup, no log, no menu, no error message.
var WORLD_CACHE = null;
function worldData() {
  if (WORLD_CACHE) return WORLD_CACHE;
  // content/world.json is inside the zipped .xpi. XMLHttpRequest cannot open a
  // jar: URI and nsIZipReader wants an init() before open(), so drive the
  // reader through a Zotero helper that already handles both.
  try {
    var uri = _rootURI + "content/regions.json";
    var text = Zotero.File.getContentsFromURL(uri);
    WORLD_CACHE = JSON.parse(text);
    log("regions loaded: " + Object.keys(WORLD_CACHE.countries).length + " countries, " + Object.keys(WORLD_CACHE.regions).length + " regions");
  } catch (e) {
    log("regions load failed: " + e);
    WORLD_CACHE = { countries: {}, provinces: {}, regions: {} };
  }
  return WORLD_CACHE;
}

var LOG_PATH = "E:\\CodeProject\\其余工程\\_litmap_log.txt";

function log(msg) {
  try {
    var file = Zotero.File.pathToFile(LOG_PATH);
    var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);
    stream.init(file, 0x02 | 0x08 | 0x10, 0o666, 0);
    var bytes = new TextEncoder().encode("[LitMap] " + msg + "\n");
    var chunk = 4096;
    for (var i = 0; i < bytes.length; i += chunk) {
      var sl = bytes.subarray(i, Math.min(i + chunk, bytes.length));
      stream.write(String.fromCharCode.apply(null, sl), sl.length);
    }
    stream.close();
  } catch (e) { /* ignore */ }
}

function addonData() {
  return {
    id: PLUGIN_ID,
    version: "1.0.0",
    rootURI: _rootURI,
  };
}
var _rootURI = "";

// ---------------------------------------------------------------- data ----
async function collectItems() {
  var libraryID = Zotero.Libraries.userLibraryID;
  var all = await Zotero.Items.getAll(libraryID, true, false);
  var out = [];
  for (var item of all) {
    if (!item.isRegularItem()) continue;
    if (item.deleted) continue;
    var year = null;
    var date = item.getField("date") || "";
    var m = date.match(/(?:19|20)\d{2}/);
    if (m) year = parseInt(m[0], 10);

    var cols = [];
    for (var cid of item.getCollections()) {
      var col = Zotero.Collections.get(cid);
      if (col && col.parentID) cols.push(col.name);
    }

    var noteText = "";
    for (var nid of item.getNotes()) {
      var n = Zotero.Items.get(nid);
      if (n) { noteText = n.getNote(); break; }
    }

    var extra = item.getField("extra") || "";
    var cited = extra.match(/Citations:\s*(\d+)/);

    out.push({
      key: item.key,
      title: item.getField("title") || "",
      year: year,
      doi: (item.getField("DOI") || "").toLowerCase().trim(),
      collection: cols[0] || "",
      type: Zotero.ItemTypes.getName(item.itemTypeID),
      cited: cited ? parseInt(cited[1], 10) : null,
      text: (plainText(item.getField("abstractNote")) + " " +
             plainText(noteText)).trim().slice(0, 1600),
    });
  }
  return out;
}

function plainText(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

// Region lexicon, mirrored from the Python builder.
var REGIONS = {
  "CONUS": ["\\bconus\\b", "contiguous united states", "continental united states",
            "\\bu\\.?s\\.?\\b", "united states", "\\busa\\b", "american"],
  "中国": ["\\bchina\\b", "chinese", "中国", "全国"],
  "京津冀": ["beijing", "tianjin", "hebei", "北京", "京津冀"],
  "长三角": ["yangtze river delta", "yangtze", "长三角"],
  "珠三角": ["pearl river delta", "prd\\b", "珠三角"],
  "汾渭平原": ["fenwei", "fenwei plain", "汾渭"],
  "欧洲": ["\\beurope\\b", "european", "欧洲"],
  "英国/爱尔兰": ["\\buk\\b", "britain", "england", "ireland", "dublin", "london"],
  "印度": ["\\bindia\\b", "delhi", "印度"],
  "东南亚": ["jakarta", "malaysia", "taiwan", "kuala lumpur", "thailand",
             "vietnam", "东南亚"],
  "韩国/日本": ["korea", "\\bjapan\\b", "seoul", "tokyo"],
  "加拿大": ["canada", "quebec", "ontario", "加拿大"],
  "意大利": ["italy", "italian", "lombardy", "po valley", "意大利"],
  "中东": ["iran", "iraq", "saudi", "middle east", "伊朗"],
  "澳洲": ["australia", "new zealand", "澳洲"],
  "非洲": ["africa", "非洲"],
  "南美": ["brazil", "south america", "巴西"],
};

function tagRegions(items) {
  for (var it of items) {
    var blob = (it.title + " " + it.text).toLowerCase();
    var hits = [];
    for (var name in REGIONS) {
      for (var pat of REGIONS[name]) {
        if (new RegExp(pat, "i").test(blob)) { hits.push(name); break; }
      }
    }
    it.regions = hits;
  }
}

// Citation references are cached on disk. The link between two fixed papers
// never changes, so only never-seen DOIs need asking again; a build after adding
// three papers costs three requests instead of 264.
//
// The TF-IDF projection is deliberately not cached: IDF is global, so one new
// paper shifts term weights everywhere and the layout legitimately moves. It
// takes milliseconds to recompute.
var CITE_CACHE_FILE = "litmap_citations_cache.json";

function citationCacheFile() {
  try {
    var ds = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties);
    var dir = ds.get("ProfD", Components.interfaces.nsIFile);
    dir.append(CITE_CACHE_FILE);
    return dir;
  } catch (e) { return null; }
}

// Reading through an input stream: Zotero.File has no synchronous reader in
// this build (getContentsFromFile is absent), and an async fetch would make the
// cache load race with the build.
function readFileText(path) {
  var file = Zotero.File.pathToFile(path);
  if (!file.exists()) return null;
  var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Components.interfaces.nsIFileInputStream);
  stream.init(file, 0x01, 0, 0);
  var conv = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
    .createInstance(Components.interfaces.nsIConverterInputStream);
  conv.init(stream, "UTF-8", 0, Components.interfaces.nsIConverterInputStream
    .DEFAULT_REPLACEMENT_CHARACTER);
  var out = "";
  var chunk = {};
  var remaining = file.fileSize;
  while (remaining > 0) {
    var read = conv.readString(Math.min(remaining, 65536), chunk);
    if (read === 0) break;
    out += chunk.value;
    remaining -= read;
  }
  conv.close();
  stream.close();
  return out;
}

function loadCitationCache() {
  var out = { version: 1, refs: {} };
  try {
    var f = citationCacheFile();
    if (!f || !f.exists()) return out;
    var data = readFileText(f.path);
    if (!data) return out;
    var parsed = JSON.parse(data);
    if (parsed && parsed.version === 1 && parsed.refs) return parsed;
  } catch (e) {
    log("cache read failed, starting empty: " + e);
  }
  return out;
}

function saveCitationCache(cache) {
  try {
    var f = citationCacheFile();
    if (!f) return;
    writeFile(f.path, JSON.stringify(cache));
  } catch (e) {
    log("cache write failed: " + e);
  }
}

async function fetchReferences(doi) {
  try {
    var url = "https://opencitations.net/index/coci/api/v1/references/" +
              encodeURIComponent(doi);
    var xhr = await Zotero.HTTP.request("GET", url, { timeout: 30000,
      responseType: "json", headers: { Accept: "application/json" } });
    var data = xhr.response || [];
    return data.map(function (r) { return (r.cited || "").toLowerCase(); })
               .filter(Boolean);
  } catch (e) {
    return null;   // null means "failed", distinct from "no references"
  }
}

async function buildEdges(items, progress, forceRefresh) {
  var byDoi = {};
  for (var it of items) { if (it.doi) byDoi[it.doi] = it.key; }
  var dois = Object.keys(byDoi);

  var cache = loadCitationCache();
  if (forceRefresh) cache = { version: 1, refs: {} };

  var missing = [];
  var reused = 0;
  for (var doi of dois) {
    if (Object.prototype.hasOwnProperty.call(cache.refs, doi)) reused++;
    else missing.push(doi);
  }
  log("cache: " + reused + " reused, " + missing.length + " to fetch");

  var CONC = 4;
  var done = 0;
  while (done < missing.length) {
    var batch = missing.slice(done, done + CONC);
    var results = await Promise.all(batch.map(fetchReferences));
    batch.forEach(function (d, k) {
      var refs = results[k];
      // Only store a real answer. A null is a transient failure, so leaving it
      // out of the cache means the next build retries instead of remembering a
      //空白 as fact.
      if (refs !== null) cache.refs[d] = refs;
    });
    done += CONC;
    if (progress) {
      progress.changeHeadline("文献地图 · 引用关系 " +
        Math.min(done, missing.length) + "/" + missing.length +
        (reused ? "（复用缓存 " + reused + "）" : ""));
    }
  }
  if (missing.length) saveCitationCache(cache);

  var edges = [];
  var seen = {};
  for (var doi2 in cache.refs) {
    var src = byDoi[doi2];
    if (!src) continue;
    for (var r of cache.refs[doi2]) {
      var dst = byDoi[r];
      if (dst && dst !== src && !seen[src + "->" + dst]) {
        seen[src + "->" + dst] = 1;
        edges.push({ source: src, target: dst });
      }
    }
  }
  log("edges " + edges.length + " (from " + Object.keys(cache.refs).length + " cached DOIs)");
  return edges;
}

// ---------------------------------------------------------------- write ---
// String.fromCharCode.apply() throws RangeError once the argument list gets
// large, and a ~600 KB HTML file is far past that limit, so bytes are written
// in fixed-size chunks.
function writeBytes(stream, bytes) {
  var CHUNK = 8192;
  for (var i = 0; i < bytes.length; i += CHUNK) {
    var slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    stream.write(String.fromCharCode.apply(null, slice), slice.length);
  }
}

function writeFile(path, text) {
  var file = Zotero.File.pathToFile(path);
  if (file.exists()) file.remove(false);
  var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
    .createInstance(Components.interfaces.nsIFileOutputStream);
  stream.init(file, 0x02 | 0x08 | 0x10, 0o666, 0);
  writeBytes(stream, new TextEncoder().encode(text));
  stream.close();
  return file;
}

// ------------------------------------------------------------ fast open ----
// With this on, "打开或生成" never touches the library: it launches the existing
// HTML immediately. The cost is that a changed library is no longer detected,
// which is the trade the user asked for -- opening stays instant, rebuilding
// stays manual.
var FAST_OPEN_PREF = "extensions.zotero.litmap.fastOpen";

function getFastOpen() {
  try { return Zotero.Prefs.get(FAST_OPEN_PREF, true) === true; }
  catch (e) { return false; }
}

function setFastOpen(value) {
  try { Zotero.Prefs.set(FAST_OPEN_PREF, value, true); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- cache ----
// The generated HTML is a pure function of the library payload, so it can be
// keyed by a hash of that payload. If the hash is unchanged there is nothing to
// rebuild and the existing file is reused -- which also keeps its mtime stable.
function stateFile() {
  try {
    var ds = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties);
    var dir = ds.get("ProfD", Components.interfaces.nsIFile);
    dir.append("litmap_state.json");
    return dir;
  } catch (e) { return null; }
}

function readState() {
  try {
    var f = stateFile();
    if (!f || !f.exists()) return null;
    var text = Zotero.File.getContentsFromURL("file:///" +
      f.path.replace(/\\/g, "/"));
    return JSON.parse(text);
  } catch (e) { return null; }
}

function writeState(obj) {
  try {
    var f = stateFile();
    if (!f) return;
    writeFile(f.path, JSON.stringify(obj));
  } catch (e) { log("state write failed: " + e); }
}

// djb2 over the serialised payload. 548 KB hashes in single-digit ms, far
// cheaper than re-emitting and re-writing 578 KB of HTML for nothing.
function fingerprint(str) {
  var h = 5381;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16) + "-" + str.length.toString(16);
}

async function generate(win, forceRefresh, clearCitations) {
  var dir = Services.dirsvc.get("Docs", Components.interfaces.nsIFile);
  var path = dir.path + "\\文献地图.html";
  var outFile = Zotero.File.pathToFile(path);

  // Fast path: open the existing file without reading anything. Reached only
  // for the first menu item (no rebuild requested) and only when a map exists.
  if (!forceRefresh && getFastOpen() && outFile.exists()) {
    log("fast open, no library read");
    Zotero.launchURL("file:///" + path.replace(/\\/g, "/"));
    return;
  }

  var progress = new Zotero.ProgressWindow({ closeOnClick: false });
  progress.changeHeadline("文献地图");
  progress.show();
  progress.addDescription("正在读取文献库…");
  progress.show();

  var t0 = Date.now();
  try {
    var items = await collectItems();
    var tRead = Date.now() - t0;
    log("items " + items.length + " (" + tRead + " ms)");

    progress.addDescription("正在获取引用关系（已缓存的直接复用）…");
    progress.show();
    var edges = await buildEdges(items, progress, clearCitations);
    var tEdges = Date.now() - t0 - tRead;
    tagRegions(items);
    log("edges " + edges.length + " (" + tEdges + " ms)");

    var payload = { items: items, edges: edges };
    var payloadJson = JSON.stringify(payload);
    var fp = fingerprint(payloadJson);

    var prev = readState();
    var haveCache = outFile.exists();

    // Rebuilding is an explicit user action, never an automatic response to a
    // changed library. If a map already exists it is opened as-is; a stale hint
    // is shown so the user can decide whether to rebuild, but nothing is
    // rewritten behind their back.
    if (!forceRefresh && haveCache) {
      var stale = !prev || prev.fingerprint !== fp;
      var builtAt = prev && prev.builtAt
        ? new Date(prev.builtAt).toLocaleString() : "未知";
      log("cache hit (" + fp + (stale ? ", library changed since " + builtAt
          : ", up to date") + "), opening without rebuild");
      var msOpen = Date.now() - t0;
      progress.changeHeadline(stale ? "文献地图已打开（库有变化）" : "文献地图已打开");
      progress.addDescription(stale
        ? "上次构建 " + builtAt + "，如要更新请用「重新构建文献地图」"
        : items.length + " 篇 · " + edges.length + " 条边 · " + msOpen + " ms");
      progress.show();
      progress.startCloseTimer(stale ? 7000 : 4000);
      Zotero.launchURL("file:///" + path.replace(/\\/g, "/"));
      return;
    }

    var html = TEMPLATE
      .replace("__DATA__", payloadJson)
      .replace("@@WORLD@@", JSON.stringify(worldData()));
    var tRender = Date.now() - t0 - tRead - tEdges;
    writeFile(path, html);
    var total2 = Date.now() - t0;
    log("wrote " + path + " (render " + tRender + " ms, total " + total2 + " ms)");

    writeState({
      fingerprint: fp,
      builtAt: new Date().toISOString(),
      itemCount: items.length,
      edgeCount: edges.length,
    });

    progress.changeHeadline("文献地图已生成");
    progress.addDescription(items.length + " 篇 · " + edges.length +
      " 条引用边 · " + total2 + " ms");
    progress.show();
    progress.startCloseTimer(4000);

    Zotero.launchURL("file:///" + path.replace(/\\/g, "/"));
  } catch (e) {
    log("generate failed: " + e + "\n" + (e && e.stack));
    progress.changeHeadline("生成失败");
    progress.addDescription(String(e).slice(0, 120));
    progress.show();
    progress.startCloseTimer(6000);
  }
}

// ---------------------------------------------------------------- menu ----
// The map describes the whole library, so it belongs in the Tools menu rather
// than the per-item context menu.
var menuInstalled = false;

function findToolsPopup(doc) {
  var ids = ["menu_ToolsPopup", "menu_toolsPopup", "tools-menu-popup"];
  for (var id of ids) {
    var el = doc.getElementById(id);
    if (el) return el;
  }
  // Fall back to any menupopup hanging off a menuitem labelled 工具 / Tools.
  var items = doc.querySelectorAll("menubar > menu, menu");
  for (var m of items) {
    var label = m.getAttribute("label") || "";
    if (/工具|Tools/i.test(label)) {
      var pop = m.querySelector("menupopup");
      if (pop) return pop;
    }
  }
  return null;
}

// Remove and re-add every entry so labels pick up pref changes.
function refreshMenu(win) {
  try {
    var popup = findToolsPopup(win.document);
    if (popup) {
      var stale = popup.querySelectorAll(".litmap-item");
      for (var i = stale.length - 1; i >= 0; i--) stale[i].remove();
    }
    menuInstalled = false;
    installMenu(win);
  } catch (e) { log("refreshMenu failed: " + e); }
}

function installMenu(win) {
  var doc = win.document;
  var popup = findToolsPopup(doc);
  if (!popup) return false;
  if (popup.querySelectorAll(".litmap-item").length >= 4) return true;

  var sep = popup.querySelector("menuseparator");
  var anchor = sep && sep.parentNode === popup ? sep : null;
  function place(el) {
    if (anchor) popup.insertBefore(el, anchor);
    else popup.appendChild(el);
  }

  // Three levels, each an explicit user choice. Re-reading the library and
  // discarding the citation cache are separate decisions because only the last
  // one costs real time (264 DOIs ~ 170 s).
  function makeItem3(label, rebuild, clearCit) {
    var mi = doc.createXULElement("menuitem");
    mi.className = "menuitem-iconic litmap-item";
    mi.setAttribute("label", label);
    mi.addEventListener("command", function () { generate(win, rebuild, clearCit); });
    return mi;
  }
  place(makeItem3("打开或生成文献地图", false, false));
  place(makeItem3("重新构建文献地图", true, false));
  place(makeItem3("清空引用缓存并重查", true, true));

  // Toggle for the instant-open mode. Rebuilt in place so the label always
  // reflects the stored preference.
  var toggle = doc.createXULElement("menuitem");
  toggle.className = "menuitem-iconic litmap-item";
  toggle.setAttribute("label", "快速打开（不读库）：" +
    (getFastOpen() ? "开" : "关"));
  toggle.addEventListener("command", function () {
    setFastOpen(!getFastOpen());
    log("fastOpen -> " + getFastOpen());
    refreshMenu(win);
  });
  place(toggle);

  log("menu inserted into " + (popup.id || popup.tagName));
  return true;
}

var pollTimer = null;

function poll() {
  try {
    var win = Zotero.getMainWindow();
    if (win && win.document && win.document.readyState === "complete") {
      if (!menuInstalled && installMenu(win)) {
        menuInstalled = true;
        log("menu installed");
      }
    }
  } catch (e) { /* keep polling */ }
  try {
    pollTimer = Zotero.getMainWindow().setTimeout(poll, 1500);
  } catch (e) { /* window gone */ }
}

// ---------------------------------------------------------------- boot ----
function startup(data, reason) {
  try {
    _rootURI = data.rootURI;
    log("startup " + data.version);
    poll();
    maybeAutorun();
  } catch (e) {
    log("startup failed: " + e + "\n" + (e && e.stack));
  }
}

function shutdown(data, reason) {
  try {
    if (pollTimer) Zotero.getMainWindow().clearTimeout(pollTimer);
  } catch (e) { /* ignore */ }
  try {
    var win = Zotero.getMainWindow();
    var el = win.document.querySelector(".litmap-item");
    if (el) el.remove();
  } catch (e) { /* ignore */ }
  log("shutdown");
}

// Self-test hook: if a flag file exists, run generate() once at startup so the
// pipeline can be exercised without clicking. Harmless when the flag is absent.
function maybeAutorun() {
  try {
    var ds = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties);
    var f = ds.get("TmpD", Components.interfaces.nsIFile);
    f.append("litmap_autorun.flag");
    if (!f.exists()) return;
    // The flag's contents select the mode, so all three menu paths can be
    // exercised without clicking: "open", "rebuild", "recache".
    var mode = "";
    try {
      var text = Zotero.File.getContentsFromURL("file:///" +
        f.path.replace(/\\/g, "/"));
      mode = (text || "").trim();
    } catch (e) { /* empty flag == open */ }
    log("autorun flag found, mode=" + (mode || "open"));
    var rebuild = (mode === "rebuild" || mode === "recache");
    var recache = (mode === "recache");
    Zotero.getMainWindow().setTimeout(function () {
      generate(Zotero.getMainWindow(), rebuild, recache);
    }, 2500);
  } catch (e) { log("autorun failed: " + e); }
}

function install() {}
function uninstall() {}
