// Literature map for Zotero: builds a self-contained HTML with four 2-D views.
//
// No imports at module scope (a throwaway import kills the whole bootstrap),
// registration happens before the first await, and file writing uses
// nsIFileOutputStream because that is the only path that survives here.

var CollectionTags_placeholder;

const PLUGIN_ID = "litmap@zhuobichen.github.io";
const PLUGIN_REF = "litmap";
const TEMPLATE = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>\u6587\u732e\u5730\u56fe \u00b7 Literature Atlas</title>\n<style>\n  :root{\n    --paper:#f7f4ee;\n    --paper-2:#fffdf9;\n    --ink:#17181c;\n    --ink-2:#4a4d55;\n    --ink-3:#8a8d96;\n    --rule:#dfd9cd;\n    --rule-soft:#ece6da;\n    --method:#2f4a6d;\n    --application:#a63d2a;\n    --none:#8d8f96;\n    --ochre:#b8863b;\n    --serif:\"Songti SC\",\"Noto Serif SC\",\"Source Han Serif SC\",Georgia,\"Times New Roman\",serif;\n    --sans:\"Inter Tight\",\"Helvetica Neue\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif;\n    --mono:\"JetBrains Mono\",ui-monospace,\"SF Mono\",Consolas,monospace;\n  }\n  *{box-sizing:border-box}\n  html,body{margin:0;padding:0}\n  body{\n    background:var(--paper);\n    color:var(--ink);\n    font:14px/1.6 var(--sans);\n    -webkit-font-smoothing:antialiased;\n    background-image:\n      linear-gradient(to right, rgba(23,24,28,.028) 1px, transparent 1px),\n      linear-gradient(to bottom, rgba(23,24,28,.028) 1px, transparent 1px);\n    background-size:46px 46px;\n    background-position:-1px -1px;\n    min-height:100vh;\n  }\n  .masthead{\n    border-bottom:1px solid var(--ink);\n    padding:26px 42px 0;\n    position:relative;\n  }\n  .kicker{\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.22em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    margin-bottom:14px;\n  }\n  h1{\n    font-family:var(--serif);\n    font-weight:500;\n    font-size:clamp(30px,4.2vw,52px);\n    line-height:1.02;\n    letter-spacing:-.018em;\n    margin:0 0 6px;\n  }\n  h1 em{font-style:italic;color:var(--application)}\n  .dek{\n    font-family:var(--serif);\n    font-size:15.5px;\n    font-style:italic;\n    color:var(--ink-2);\n    margin:0 0 22px;\n    max-width:70ch;\n  }\n  .figures{\n    display:flex;\n    gap:38px;\n    padding:15px 0 17px;\n    border-top:1px solid var(--rule);\n    flex-wrap:wrap;\n  }\n  .fig{display:flex;flex-direction:column;gap:1px}\n  .fig b{\n    font-family:var(--serif);\n    font-size:23px;\n    font-weight:500;\n    line-height:1.1;\n    font-variant-numeric:tabular-nums;\n    letter-spacing:-.015em;\n  }\n  .fig span{\n    font-family:var(--mono);\n    font-size:9.5px;\n    letter-spacing:.16em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n  }\n  nav{\n    display:flex;\n    gap:0;\n    padding:0 42px;\n    border-bottom:1px solid var(--rule);\n    background:rgba(255,253,249,.55);\n    position:sticky;\n    top:0;\n    z-index:20;\n    backdrop-filter:blur(9px);\n  }\n  nav button{\n    appearance:none;\n    border:0;\n    background:none;\n    padding:15px 22px 13px;\n    margin:0;\n    font-family:var(--sans);\n    font-size:12.5px;\n    font-weight:500;\n    letter-spacing:.055em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    cursor:pointer;\n    border-bottom:2px solid transparent;\n    margin-bottom:-1px;\n    transition:color .16s ease,border-color .16s ease;\n    position:relative;\n  }\n  nav button:hover{color:var(--ink)}\n  nav button.on{color:var(--ink);border-bottom-color:var(--application)}\n  nav button:focus-visible{outline:2px solid var(--method);outline-offset:-4px}\n  main{padding:0 42px 72px}\n  .panel{display:none}\n  .panel.on{display:block}\n  .sheet{\n    background:var(--paper-2);\n    border:1px solid var(--rule);\n    border-radius:2px;\n    box-shadow:0 1px 0 var(--rule-soft),0 14px 34px -26px rgba(23,24,28,.34);\n    margin-top:26px;\n    position:relative;\n  }\n  .bar{\n    display:flex;\n    gap:20px;\n    align-items:center;\n    flex-wrap:wrap;\n    padding:13px 20px;\n    border-bottom:1px solid var(--rule-soft);\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.06em;\n    text-transform:uppercase;\n    color:var(--ink-3);\n    position:relative;\n    z-index:1;\n  }\n  .bar label{\n    display:inline-flex;\n    gap:7px;\n    align-items:center;\n    cursor:pointer;\n    color:var(--ink-2);\n    text-transform:none;\n    letter-spacing:.01em;\n    font-family:var(--sans);\n    font-size:12.5px;\n    user-select:none;\n  }\n  .bar input[type=checkbox]{\n    appearance:none;\n    width:14px;height:14px;\n    border:1px solid var(--ink-3);\n    border-radius:2px;\n    background:var(--paper-2);\n    cursor:pointer;\n    position:relative;\n    transition:background .13s ease,border-color .13s ease;\n  }\n  .bar input[type=checkbox]:checked{background:var(--ink);border-color:var(--ink)}\n  .bar input[type=checkbox]:checked::after{\n    content:\"\";\n    position:absolute;\n    left:4px;top:1px;\n    width:4px;height:8px;\n    border:solid var(--paper-2);\n    border-width:0 1.6px 1.6px 0;\n    transform:rotate(42deg);\n  }\n  .bar .stat{margin-left:auto;color:var(--ink-2);font-variant-numeric:tabular-nums}\n  canvas{display:block;width:100%;position:relative;z-index:1;cursor:crosshair}\n  .caption{\n    padding:13px 20px 16px;\n    border-top:1px solid var(--rule-soft);\n    font-family:var(--serif);\n    font-size:12.8px;\n    line-height:1.62;\n    color:var(--ink-2);\n    max-width:96ch;\n    position:relative;\n    z-index:1;\n  }\n  .caption b{font-weight:600;color:var(--ink);font-style:normal}\n  .legend{\n    display:flex;\n    gap:18px;\n    flex-wrap:wrap;\n    padding:13px 20px;\n    border-top:1px solid var(--rule-soft);\n    font-family:var(--mono);\n    font-size:10.5px;\n    letter-spacing:.04em;\n    color:var(--ink-2);\n    position:relative;\n    z-index:1;\n  }\n  .legend span{display:inline-flex;align-items:center;gap:6px}\n  .legend i{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}\n  .legend .lg-note{\n    color:var(--ink-3);\n    font-style:italic;\n    font-family:var(--serif);\n    letter-spacing:0;\n    font-size:11.5px;\n  }\n  #tip{\n    position:fixed;\n    pointer-events:none;\n    background:var(--ink);\n    color:var(--paper);\n    font-family:var(--sans);\n    font-size:12.5px;\n    line-height:1.5;\n    padding:9px 12px;\n    border-radius:2px;\n    max-width:360px;\n    opacity:0;\n    transform:translateY(3px);\n    transition:opacity .13s ease,transform .13s ease;\n    z-index:60;\n    box-shadow:0 10px 26px -12px rgba(0,0,0,.5);\n  }\n  #tip.on{opacity:1;transform:translateY(0)}\n  #tip b{font-family:var(--serif);font-weight:500;font-size:13.5px}\n  @keyframes rise{\n    from{opacity:0;transform:translateY(11px)}\n    to{opacity:1;transform:translateY(0)}\n  }\n  .masthead>*{animation:rise .62s cubic-bezier(.22,.68,.28,1) both}\n  .masthead>*:nth-child(1){animation-delay:.02s}\n  .masthead>*:nth-child(2){animation-delay:.08s}\n  .masthead>*:nth-child(3){animation-delay:.14s}\n  .masthead>*:nth-child(4){animation-delay:.20s}\n  nav{animation:rise .62s cubic-bezier(.22,.68,.28,1) .26s both}\n  .panel.on .sheet{animation:rise .5s cubic-bezier(.22,.68,.28,1) both}\n  @media (prefers-reduced-motion:reduce){\n    *{animation:none!important;transition:none!important}\n  }\n  @media (max-width:760px){\n    .masthead{padding:20px 20px 0}\n    nav{padding:0 20px;overflow-x:auto}\n    main{padding:0 20px 48px}\n    .figures{gap:24px}\n  }\n</style>\n</head>\n<body>\n\n<header class=\"masthead\">\n  <div class=\"kicker\">Zotero Library \u00b7 Generated Atlas</div>\n  <h1>\u6587\u732e\u5730\u56fe<em>.</em></h1>\n  <p class=\"dek\">\u56db\u4e2a\u89c6\u89d2\u8bfb\u540c\u4e00\u4e2a\u6587\u732e\u5e93\uff1a\u8c01\u5f15\u7528\u4e86\u8c01\u3001\u4e3b\u9898\u5982\u4f55\u805a\u62e2\u3001\u65b9\u6cd5\u5728\u65f6\u95f4\u4e0a\u600e\u6837\u94fa\u5f00\u3001\u7814\u7a76\u843d\u5728\u54ea\u91cc\u3002</p>\n  <div class=\"figures\" id=\"figures\"></div>\n</header>\n\n<nav>\n  <button data-tab=\"rel\" class=\"on\">\u5f15\u7528\u7f51\u7edc</button>\n  <button data-tab=\"sem\">\u8bed\u4e49\u5730\u56fe</button>\n  <button data-tab=\"tim\">\u65f6\u95f4 \u00d7 \u5206\u7c7b</button>\n  <button data-tab=\"geo\">\u5730\u7406\u5206\u5e03</button>\n</nav>\n\n<main>\n  <section class=\"panel on\" id=\"p-rel\">\n    <div class=\"sheet\">\n      <div class=\"bar\">\n        <label><input type=\"checkbox\" id=\"relLabels\"> \u663e\u793a\u6807\u9898</label>\n        <label><input type=\"checkbox\" id=\"relIsolated\"> \u542b\u5b64\u7acb\u6587\u732e</label>\n        <span class=\"stat\" id=\"relStat\"></span>\n      </div>\n      <canvas id=\"c-rel\" height=\"660\"></canvas>\n      <div class=\"legend\" id=\"relLegend\"></div>\n      <div class=\"caption\">\u8fb9\u8868\u793a<b>\u672c\u5e93\u5185\u90e8\u7684\u5f15\u7528\u5173\u7cfb</b>\uff0c\u6765\u81ea OpenCitations COCI\u3002\u7bad\u5934 A \u2192 B \u610f\u4e3a A \u5f15\u7528\u4e86 B\uff1b\u53ea\u6709\u4e24\u7aef\u90fd\u5728\u5e93\u5185\u624d\u753b\u7ebf\uff0c\u56e0\u6b64\u6bcf\u6761\u8fb9\u90fd\u662f\u53ef\u6838\u5b9e\u7684\u5f15\u7528\uff0c\u800c\u975e\u63a8\u65ad\u7684\u76f8\u4f3c\u5ea6\u3002\u70b9\u7684\u5927\u5c0f\u662f\u8be5\u6587\u732e\u5728\u7f51\u7edc\u4e2d\u7684\u8fde\u63a5\u6570\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-sem\">\n    <div class=\"sheet\">\n      <div class=\"bar\">\n        <label><input type=\"checkbox\" id=\"semLabels\"> \u663e\u793a\u6807\u9898</label>\n        <span class=\"stat\" id=\"semStat\"></span>\n      </div>\n      <canvas id=\"c-sem\" height=\"660\"></canvas>\n      <div class=\"legend\" id=\"semLegend\"></div>\n      <div class=\"caption\">\u7528\u6807\u9898\u4e0e\u7b14\u8bb0\u7684 <b>TF-IDF \u5411\u91cf</b>\u505a\u4e8c\u7ef4\u6301\u6295\u5f71\uff0c\u8ddd\u79bb\u8fd1\u8868\u793a\u7528\u8bcd\u76f8\u4f3c\u3002\u8fd9\u662f\u57fa\u4e8e\u6587\u672c\u7684\u63cf\u8ff0\u6027\u5e03\u5c40\uff0c\u4e0d\u662f\u5f15\u7528\u5173\u7cfb\uff1b\u4e3b\u9898\u63a5\u8fd1\u7684\u6587\u732e\u4f1a\u81ea\u7136\u805a\u62e2\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-tim\">\n    <div class=\"sheet\">\n      <div class=\"bar\"><span class=\"stat\" id=\"timStat\"></span></div>\n      <canvas id=\"c-tim\" height=\"640\"></canvas>\n      <div class=\"caption\">\u6a2a\u8f74\u5e74\u4efd\u3001\u7eb5\u8f74\u5206\u7c7b\u3002\u70b9\u7684\u5927\u5c0f\u6309<b>\u5f15\u7528\u6570</b>\u7f29\u653e\uff0c\u53ef\u4ee5\u770b\u51fa\u6bcf\u4e2a\u5b50\u7c7b\u7684\u65f6\u95f4\u8986\u76d6\u8303\u56f4\u4e0e\u6838\u5fc3\u6587\u732e\u3002</div>\n    </div>\n  </section>\n\n  <section class=\"panel\" id=\"p-geo\">\n    <div class=\"sheet\">\n      <div class=\"bar\"><span class=\"stat\" id=\"geoStat\"></span></div>\n      <canvas id=\"c-geo\" height=\"640\"></canvas>\n      <div class=\"legend\" id=\"geoLegend\"></div>\n      <div class=\"caption\">\u7814\u7a76\u533a\u57df\u7531\u6807\u9898\u4e0e\u7b14\u8bb0\u4e2d\u7684<b>\u5730\u540d\u8bc6\u522b</b>\uff0c\u4e00\u7bc7\u6587\u732e\u53ef\u80fd\u5c5e\u4e8e\u591a\u4e2a\u533a\u57df\u3002\u7eaf\u65b9\u6cd5\u8bba\u6587\u901a\u5e38\u6ca1\u6709\u7814\u7a76\u533a\u57df\uff0c\u56e0\u6b64\u4e0d\u51fa\u73b0\u5728\u5730\u56fe\u4e0a\u3002</div>\n    </div>\n  </section>\n</main>\n<div id=\"tip\"></div>\n\n<script>\n\nconst DATA = __DATA__;\nconst WORLD = @@WORLD@@;\nconst items = DATA.items, edges = DATA.edges;\nconst tip = document.getElementById('tip');\n\n// ---------- shared helpers ----------\nconst METHOD = new Set(['\u7edf\u8ba1\u5730\u7edf\u8ba1','\u673a\u5668\u5b66\u4e60','\u6df1\u5ea6\u5b66\u4e60','\u6570\u636e\u540c\u5316\u4e0e\u96c6\u5408']);\nfunction familyOf(c){ return !c ? 'none' : (METHOD.has(c) ? 'method' : 'application'); }\nconst COLORS = {\n  method:'#2f4a6d', application:'#a63d2a', none:'#8d8f96'\n};\nconst SUBS = [...new Set(items.map(i=>i.collection).filter(Boolean))]\n  .sort((a,b)=>{\n    const order=['\u7edf\u8ba1\u5730\u7edf\u8ba1','\u673a\u5668\u5b66\u4e60','\u6df1\u5ea6\u5b66\u4e60','\u6570\u636e\u540c\u5316\u4e0e\u96c6\u5408',\n                 '\u4ea7\u54c1\u4e92\u6bd4\u4e0e\u9009\u62e9\u654f\u611f\u6027','\u957f\u671f\u8d8b\u52bf\u4e0e\u65ad\u70b9','\u5065\u5eb7\u4e0e\u66b4\u9732\u5f71\u54cd','\u6570\u636e\u8c31\u7cfb\u4e0e\u9a8c\u8bc1\u65b9\u6cd5'];\n    return order.indexOf(a)-order.indexOf(b);\n  });\n\nfunction fitCanvas(cv){\n  const dpr = window.devicePixelRatio || 1;\n  const w = cv.clientWidth, h = parseInt(cv.getAttribute('height'),10);\n  cv.width = w*dpr; cv.height = h*dpr;\n  const ctx = cv.getContext('2d');\n  ctx.setTransform(dpr,0,0,dpr,0,0);\n  return {ctx, w, h};\n}\nfunction showTip(evt, html){\n  tip.innerHTML = html; tip.classList.add('on');\n  tip.style.left = Math.min(evt.clientX+14, innerWidth-350)+'px';\n  tip.style.top  = Math.min(evt.clientY+14, innerHeight-90)+'px';\n}\nfunction hideTip(){ tip.classList.remove('on'); }\nfunction esc(s){ return (s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }\n\ndocument.querySelectorAll('nav button').forEach(b=>{\n  b.onclick = ()=>{\n    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on'));\n    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));\n    b.classList.add('on');\n    document.getElementById('p-'+b.dataset.tab).classList.add('on');\n    draw[b.dataset.tab]();\n  };\n});\n\n// ---------- 1. relationship graph (force-directed) ----------\nlet relState = null;\nfunction layoutRelation(includeIsolated){\n  // Only items that take part in at least one in-library citation are laid\n  // out. Isolated nodes have no spring pulling them in, so repulsion drives\n  // them to the frame and they read as a meaningless border.\n  const degree = new Map(items.map(it=>[it.key,0]));\n  const linkPairs = [];\n  for (const e of edges){\n    if (degree.has(e.source) && degree.has(e.target) && e.source!==e.target){\n      linkPairs.push([e.source, e.target]);\n      degree.set(e.source, degree.get(e.source)+1);\n      degree.set(e.target, degree.get(e.target)+1);\n    }\n  }\n  const keep = items.filter(it=>includeIsolated || degree.get(it.key) > 0);\n  const nodes = keep.map(it=>({it, x:0, y:0, deg:degree.get(it.key)}));\n  const idx = new Map(nodes.map((nd,i)=>[nd.it.key,i]));\n  const links = linkPairs.filter(([a,b])=>idx.has(a)&&idx.has(b))\n    .map(([a,b])=>({a:idx.get(a), b:idx.get(b)}));\n  const isolated = items.length - nodes.length;\n\n  // Fruchterman-Reingold in a fixed square world, then scaled to the canvas.\n  const n = nodes.length, W = 1000, H = 1000;\n  const k = Math.sqrt((W*H)/Math.max(n,1)) * 0.72;\n  // Seed on a sunflower spiral so no two nodes start coincident.\n  const g = Math.PI*(3-Math.sqrt(5));\n  nodes.forEach((nd,i)=>{\n    const r = Math.sqrt((i+0.5)/n) * Math.min(W,H)*0.46;\n    const a = i*g;\n    nd.x = W/2 + r*Math.cos(a);\n    nd.y = H/2 + r*Math.sin(a);\n  });\n  let temp = W*0.10;\n  const ITER = 420;\n  for (let step=0; step<ITER; step++){\n    const disp = nodes.map(()=>({x:0,y:0}));\n    // repulsion: k^2/d\n    for (let i=0;i<n;i++){\n      for (let j=i+1;j<n;j++){\n        let dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;\n        let d=Math.sqrt(dx*dx+dy*dy);\n        if (d < 0.01){ d=0.01; dx=0.01*(i-j); dy=0.01*(i+j); }\n        const f = (k*k)/d;\n        const ux=dx/d, uy=dy/d;\n        disp[i].x += ux*f; disp[i].y += uy*f;\n        disp[j].x -= ux*f; disp[j].y -= uy*f;\n      }\n    }\n    // attraction: d^2/k, weighted so hub edges do not dominate\n    for (const l of links){\n      const A=nodes[l.a], B=nodes[l.b];\n      let dx=A.x-B.x, dy=A.y-B.y;\n      let d=Math.sqrt(dx*dx+dy*dy);\n      if (d < 0.01) d=0.01;\n      const f = (d*d)/k;\n      const ux=dx/d, uy=dy/d;\n      disp[l.a].x -= ux*f; disp[l.a].y -= uy*f;\n      disp[l.b].x += ux*f; disp[l.b].y += uy*f;\n    }\n    // gravity towards centre keeps disconnected items from drifting away\n    for (let i=0;i<n;i++){\n      const dx = nodes[i].x - W/2, dy = nodes[i].y - H/2;\n      disp[i].x -= dx*0.012; disp[i].y -= dy*0.012;\n    }\n    // apply with temperature limit\n    for (let i=0;i<n;i++){\n      const d = Math.sqrt(disp[i].x*disp[i].x + disp[i].y*disp[i].y);\n      if (d > 0){\n        const lim = Math.min(d, temp);\n        nodes[i].x += disp[i].x/d*lim;\n        nodes[i].y += disp[i].y/d*lim;\n      }\n      nodes[i].x = Math.max(10, Math.min(W-10, nodes[i].x));\n      nodes[i].y = Math.max(10, Math.min(H-10, nodes[i].y));\n    }\n    temp = Math.max(temp*0.985, 0.6);\n  }\n  return {nodes, links, isolated};\n}\nfunction drawRel(){\n  const cv = document.getElementById('c-rel');\n  const inc = document.getElementById('relIsolated') && document.getElementById('relIsolated').checked;\n  if (!relState || relState.includeIsolated !== inc) relState = layoutRelation(inc), relState.includeIsolated = inc;\n  const {ctx,w,h} = fitCanvas(cv);\n  if (!relState.bounds){\n    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;\n    for (const nd of relState.nodes){\n      x0=Math.min(x0,nd.x);x1=Math.max(x1,nd.x);\n      y0=Math.min(y0,nd.y);y1=Math.max(y1,nd.y);\n    }\n    relState.bounds = {x0,x1,y0,y1};\n  }\n  const b=relState.bounds;\n  const pad=54;\n  const sx=(w-pad*2)/Math.max(1,b.x1-b.x0), sy=(h-pad*2)/Math.max(1,b.y1-b.y0);\n  const s=Math.min(sx,sy), cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2;\n  const px=x=>(x-cx)*s+w/2, py=y=>(y-cy)*s+h/2;\n\n  ctx.clearRect(0,0,w,h);\n  ctx.lineWidth=1;\n  for (const l of relState.links){\n    const A=relState.nodes[l.a], B=relState.nodes[l.b];\n    ctx.strokeStyle='rgba(47,74,109,.20)';\n    ctx.beginPath(); ctx.moveTo(px(A.x),py(A.y)); ctx.lineTo(px(B.x),py(B.y)); ctx.stroke();\n  }\n  const labels = document.getElementById('relLabels').checked;\n  for (const nd of relState.nodes){\n    const it=nd.it, r=4.2+Math.min(nd.deg,6)*1.15;\n    ctx.beginPath(); ctx.arc(px(nd.x),py(nd.y),r,0,7);\n    ctx.fillStyle = COLORS[familyOf(it.collection)] || COLORS.none;\n    ctx.globalAlpha = nd.deg ? 1 : .42;\n    ctx.fill(); ctx.globalAlpha = 1;\n    if (labels && nd.deg){\n      ctx.fillStyle='#5a5d66'; ctx.font='10px Georgia,serif';\n      ctx.fillText(it.title.slice(0,26), px(nd.x)+r+3, py(nd.y)+3);\n    }\n  }\n  relState.proj = {px,py};\n  document.getElementById('relStat').textContent =\n    `${relState.nodes.length} \u7bc7\u6709\u5f15\u7528\u5173\u7cfb \u00b7 ${relState.links.length} \u6761\u8fb9` +\n    (relState.isolated ? ` \u00b7 ${relState.isolated} \u7bc7\u5b64\u7acb\u672a\u663e\u793a` : '');\n  // legend\n  const lg=document.getElementById('relLegend');\n  lg.innerHTML = `<span><i style=\"background:${COLORS.method}\"></i>\u65b9\u6cd5\u7c7b</span>\n    <span><i style=\"background:${COLORS.application}\"></i>\u5e94\u7528\u7c7b</span>\n    <span><i style=\"background:${COLORS.none}\"></i>\u65e0\u5206\u7c7b</span>\n    <span>\u70b9\u7684\u5927\u5c0f = \u5728\u8be5\u7f51\u7edc\u4e2d\u7684\u8fde\u63a5\u6570</span>`;\n}\ndocument.getElementById('relLabels').onchange = drawRel;\ndocument.getElementById('relIsolated').onchange = drawRel;\ndocument.getElementById('c-rel').addEventListener('mousemove', ev=>{\n  if (!relState?.proj) return;\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  let best=null, bd=144;\n  for (const nd of relState.nodes){\n    const dx=relState.proj.px(nd.x)-mx, dy=relState.proj.py(nd.y)-my;\n    const d=dx*dx+dy*dy;\n    if (d<bd){ bd=d; best=nd; }\n  }\n  if (best){\n    showTip(evt, `<b>${esc(best.it.title).slice(0,80)}</b><br>\n      ${best.it.year||'\u2014'} \u00b7 ${esc(best.it.collection)||'\u672a\u5206\u7c7b'}<br>\n      \u8fde\u63a5 ${best.deg} \u6761${best.it.cited!=null?' \u00b7 \u88ab\u5f15 '+best.it.cited:''}`);\n  } else hideTip();\n});\ndocument.getElementById('c-rel').addEventListener('mouseleave', hideTip);\n\n// ---------- 2. semantic map (TF-IDF + 2-D projection) ----------\nconst STOP = new Set(('the a an and or of to in for on with by from as at is are was were be been being '\n +'this that these those it its their our we they which such can may not no than then there here '\n +'using used use based via between among during over under more most less least also both each per '\n +'study paper result results show shows shown found however therefore thus while where when what how '\n +'\u6570\u636e \u6a21\u578b \u65b9\u6cd5 \u7814\u7a76 \u7ed3\u679c \u5206\u6790 \u8868\u660e \u63d0\u51fa \u901a\u8fc7 \u4ee5\u53ca \u53ef\u4ee5 \u8fdb\u884c \u4e00\u4e2a \u6211\u4eec \u4ed6\u4eec \u8fd9\u4e2a \u8fd9\u4e9b').split(/\\s+/));\nlet semState=null;\nfunction tokenize(s){\n  const out=[];\n  const en=(s||'').toLowerCase().match(/[a-z][a-z\\-]{2,}/g)||[];\n  out.push(...en.filter(w=>!STOP.has(w)));\n  const zh=(s||'').match(/[\\u4e00-\\u9fa5]{2,4}/g)||[];\n  out.push(...zh);\n  return out;\n}\nfunction buildSemantic(){\n  const docs = items.map(it=>tokenize(it.title+' '+(it.text||'')));\n  const df=new Map();\n  docs.forEach(toks=>{\n    for (const t of new Set(toks)) df.set(t,(df.get(t)||0)+1);\n  });\n  const N=docs.length;\n  // keep terms appearing in 2..40% of docs\n  const vocab=[...df.entries()].filter(([t,n])=>n>=2 && n<=N*0.4)\n    .sort((a,b)=>b[1]-a[1]).slice(0,420).map(x=>x[0]);\n  const vidx=new Map(vocab.map((t,i)=>[t,i]));\n  const vecs=docs.map(toks=>{\n    const v=new Float32Array(vocab.length);\n    const tf=new Map();\n    toks.forEach(t=>{ if(vidx.has(t)) tf.set(t,(tf.get(t)||0)+1); });\n    for (const [t,c] of tf){\n      const i=vidx.get(t);\n      v[i]=(1+Math.log(c))*Math.log(N/df.get(t));\n    }\n    let norm=0; for (let i=0;i<v.length;i++) norm+=v[i]*v[i];\n    norm=Math.sqrt(norm)||1;\n    for (let i=0;i<v.length;i++) v[i]/=norm;\n    return v;\n  });\n  // Project onto the top-2 principal directions via power iteration on XtX.\n  function powerIter(X, exclude){\n    const d=X[0].length;\n    let v=new Float32Array(d).map(()=>Math.random()-0.5);\n    for (let iter=0; iter<64; iter++){\n      const nv=new Float32Array(d);\n      for (const row of X){\n        let dot=0;\n        for (let i=0;i<d;i++) dot+=row[i]*v[i];\n        for (let i=0;i<d;i++) nv[i]+=row[i]*dot;\n      }\n      if (exclude) for (let i=0;i<d;i++) nv[i]-=exclude[i]*exclude.lambda;\n      let n=0; for (let i=0;i<d;i++) n+=nv[i]*nv[i];\n      n=Math.sqrt(n)||1;\n      for (let i=0;i<d;i++) v[i]=nv[i]/n;\n    }\n    let lambda=0;\n    for (const row of X){\n      let dot=0; for (let i=0;i<d;i++) dot+=row[i]*v[i];\n      lambda+=dot*dot;\n    }\n    return {v, lambda};\n  }\n  const pc1=powerIter(vecs,null);\n  // deflate for pc2\n  const v1=pc1.v.slice();\n  const X2=vecs.map(row=>{\n    let dot=0; for (let i=0;i<row.length;i++) dot+=row[i]*v1[i];\n    const out=new Float32Array(row.length);\n    for (let i=0;i<row.length;i++) out[i]=row[i]-dot*v1[i];\n    return out;\n  });\n  const pc2=powerIter(X2,null);\n  const xs=[], ys=[];\n  for (const row of vecs){\n    let a=0,b=0;\n    for (let i=0;i<row.length;i++){ a+=row[i]*pc1.v[i]; b+=row[i]*pc2.v[i]; }\n    xs.push(a); ys.push(b);\n  }\n  semState={xs,ys,vocab:vocab.length};\n  return semState;\n}\nfunction drawSem(){\n  const cv=document.getElementById('c-sem');\n  if (!semState) buildSemantic();\n  const {ctx,w,h}=fitCanvas(cv);\n  const xs=semState.xs, ys=semState.ys;\n  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);\n  const pad=56, sx=(w-pad*2)/Math.max(1e-6,x1-x0), sy=(h-pad*2)/Math.max(1e-6,y1-y0);\n  const s=Math.min(sx,sy), cx=(x0+x1)/2, cy=(y0+y1)/2;\n  const px=x=>(x-cx)*s+w/2, py=y=>(y-cy)*s+h/2;\n  ctx.clearRect(0,0,w,h);\n  const labels=document.getElementById('semLabels').checked;\n  items.forEach((it,i)=>{\n    const r=3.6+Math.min(it.cited||0,400)/120;\n    ctx.beginPath(); ctx.arc(px(xs[i]),py(ys[i]),Math.min(r,9),0,7);\n    ctx.fillStyle=COLORS[familyOf(it.collection)]||COLORS.none;\n    ctx.globalAlpha=.86; ctx.fill(); ctx.globalAlpha=1;\n    if (labels){\n      ctx.fillStyle='#5a5d66'; ctx.font='9.5px Georgia,serif';\n      ctx.fillText(it.title.slice(0,22), px(xs[i])+5, py(ys[i])+3);\n    }\n  });\n  semState.proj={px,py};\n  document.getElementById('semStat').textContent =\n    `${items.length} \u7bc7 \u00b7 ${semState.vocab} \u4e2a\u7279\u5f81\u8bcd \u00b7 TF-IDF \u4e8c\u7ef4\u6301\u6295\u5f71`;\n  document.getElementById('semLegend').innerHTML =\n    `<span><i style=\"background:${COLORS.method}\"></i>\u65b9\u6cd5\u7c7b</span>\n     <span><i style=\"background:${COLORS.application}\"></i>\u5e94\u7528\u7c7b</span>\n     <span>\u8ddd\u79bb\u8fd1 = \u6807\u9898\u4e0e\u7b14\u8bb0\u7528\u8bcd\u76f8\u4f3c</span>`;\n}\ndocument.getElementById('semLabels').onchange = drawSem;\ndocument.getElementById('c-sem').addEventListener('mousemove', ev=>{\n  if (!semState?.proj) return;\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  let best=-1,bd=196;\n  items.forEach((_,i)=>{\n    const dx=semState.proj.px(semState.xs[i])-mx, dy=semState.proj.py(semState.ys[i])-my;\n    const d=dx*dx+dy*dy;\n    if (d<bd){bd=d;best=i;}\n  });\n  if (best>=0){\n    const it=items[best];\n    showTip(evt, `<b>${esc(it.title).slice(0,80)}</b><br>${it.year||'\u2014'} \u00b7 ${esc(it.collection)||'\u672a\u5206\u7c7b'}`);\n  } else hideTip();\n});\ndocument.getElementById('c-sem').addEventListener('mouseleave', hideTip);\n\n// ---------- 3. time x category ----------\nfunction drawTim(){\n  const cv=document.getElementById('c-tim');\n  const {ctx,w,h}=fitCanvas(cv);\n  const years=items.map(i=>i.year).filter(Boolean);\n  const y0=Math.min(...years), y1=Math.max(...years);\n  const left=128, right=26, top=26, bottom=38;\n  const rows=SUBS.concat(items.some(i=>!i.collection)?['(\u672a\u5206\u7c7b)']:[]).reverse();\n  const rowH=(h-top-bottom)/rows.length;\n  const px=y=>left+(y-y0)/Math.max(1,(y1-y0))*(w-left-right);\n  ctx.clearRect(0,0,w,h);\n  // x grid\n  ctx.strokeStyle='#ece6da'; ctx.fillStyle='#8a8d96'; ctx.font='11px Georgia,serif';\n  for (let y=y0; y<=y1; y+=(y1-y0>28?5:2)){\n    const x=px(y);\n    ctx.beginPath(); ctx.moveTo(x,top-6); ctx.lineTo(x,h-bottom); ctx.stroke();\n    ctx.fillText(String(y), x-11, h-bottom+16);\n  }\n  rows.forEach((name,ri)=>{\n    const cy=top+rowH*ri+rowH/2;\n    ctx.fillStyle='#3b3e46'; ctx.font='11.5px Georgia,serif';\n    ctx.textAlign='right';\n    ctx.fillText(name.length>12?name.slice(0,11)+'\u2026':name, left-10, cy+4);\n    ctx.textAlign='left';\n    ctx.strokeStyle='#f2ede2';\n    ctx.beginPath(); ctx.moveTo(left,cy); ctx.lineTo(w-right,cy); ctx.stroke();\n    items.filter(it=>(it.collection||'(\u672a\u5206\u7c7b)')===name && it.year).forEach(it=>{\n      const x=px(it.year);\n      const jitter=(Math.random()-0.5)*rowH*0.62;\n      const r=2.6+Math.min(it.cited||0,400)/150;\n      ctx.beginPath(); ctx.arc(x,cy+jitter,Math.min(r,7),0,7);\n      ctx.fillStyle=COLORS[familyOf(it.collection)]||COLORS.none;\n      ctx.globalAlpha=.8; ctx.fill(); ctx.globalAlpha=1;\n    });\n  });\n  document.getElementById('timStat').textContent = `${y0}\u2013${y1} \u00b7 ${rows.length} \u4e2a\u5206\u7c7b`;\n}\ndocument.getElementById('c-tim').addEventListener('mousemove', ev=>{\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  const h=parseInt(cv.getAttribute('height'),10);\n  const left=128,right=26,top=26,bottom=38;\n  const rows=SUBS.concat(items.some(i=>!i.collection)?['(\u672a\u5206\u7c7b)']:[]).reverse();\n  const rowH=(h-top-bottom)/rows.length;\n  const ri=Math.floor((my-top)/rowH);\n  if (ri<0||ri>=rows.length) return hideTip();\n  const name=rows[ri];\n  const list=items.filter(it=>(it.collection||'(\u672a\u5206\u7c7b)')===name);\n  showTip(evt, `<b>${esc(name)}</b><br>${list.length} \u7bc7<br>\n    \u5e74\u4efd ${Math.min(...list.map(i=>i.year||9999))}\u2013${Math.max(...list.map(i=>i.year||0))}<br>\n    <span style=\"opacity:.7\">\u9f20\u6807\u6240\u5728\u884c\u7684\u5206\u7c7b\u5408\u8ba1</span>`);\n});\ndocument.getElementById('c-geo-tip');\ndocument.getElementById('c-tim').addEventListener('mouseleave', hideTip);\n\n// ---------- 4. geographic distribution (lon/lat bubble map) ----------\n// Approximate centroids for the regions the lexicon can recognise.\nconst REGION_XY = {\n  'CONUS':[-98,39], '\u4e2d\u56fd':[105,35], '\u4eac\u6d25\u5180':[116.5,39.5], '\u957f\u4e09\u89d2':[120,31],\n  '\u73e0\u4e09\u89d2':[113.5,23], '\u6c7e\u6e2d\u5e73\u539f':[108.6,34.6], '\u6b27\u6d32':[10,50], '\u82f1\u56fd/\u7231\u5c14\u5170':[-2.5,54],\n  '\u5370\u5ea6':[78,22], '\u4e1c\u5357\u4e9a':[110,5], '\u97e9\u56fd/\u65e5\u672c':[128,36], '\u52a0\u62ff\u5927':[-106,56],\n  '\u610f\u5927\u5229':[12.5,42.5], '\u4e2d\u4e1c':[45,30], '\u6fb3\u6d32':[134,-25],\n  '\u975e\u6d32':[20,5], '\u5357\u7f8e':[-60,-15]\n};\nfunction drawGeo(){\n  const cv=document.getElementById('c-geo');\n  const {ctx,w,h}=fitCanvas(cv);\n  const counts=new Map();\n  for (const it of items){\n    for (const r of (it.regions||[])) counts.set(r,(counts.get(r)||0)+1);\n  }\n  const maxN=Math.max(1,...counts.values());\n  // world window: lon -180..180, lat 80..-60\n  const LON0=-180, LON1=180, LAT0=78, LAT1=-58;\n  const pad=30;\n  const sx=(w-pad*2)/(LON1-LON0), sy=(h-pad*2)/(LAT0-LAT1);\n  const px=lon=>pad+(lon-LON0)*sx, py=lat=>pad+(LAT0-lat)*sy;\n\n  ctx.clearRect(0,0,w,h);\n  // graticule\n  ctx.strokeStyle='#f0ebe0'; ctx.fillStyle='#a8a49a'; ctx.font='9.5px Georgia,serif';\n  for (let lon=-180; lon<=180; lon+=30){\n    ctx.beginPath(); ctx.moveTo(px(lon),py(LAT0)); ctx.lineTo(px(lon),py(LAT1)); ctx.stroke();\n  }\n  for (let lat=-60; lat<=78; lat+=30){\n    ctx.beginPath(); ctx.moveTo(px(LON0),py(lat)); ctx.lineTo(px(LON1),py(lat)); ctx.stroke();\n    ctx.fillText(lat+'\u00b0', pad-22, py(lat)+3);\n  }\n  // Real country outlines from Natural Earth 110m, projected the same way as\n  // the bubbles: equirectangular, so lon/lat map linearly to x/y.\n  ctx.fillStyle='#f1ede4';\n  ctx.strokeStyle='#ddd6c7';\n  ctx.lineWidth=.7;\n  for (const [zh, en, rings] of WORLD){\n    ctx.beginPath();\n    for (const ring of rings){\n      for (let i=0;i<ring.length;i+=2){\n        const X=px(ring[i]), Y=py(ring[i+1]);\n        i===0 ? ctx.moveTo(X,Y) : ctx.lineTo(X,Y);\n      }\n      ctx.closePath();\n    }\n    ctx.fill('evenodd');\n  }\n  ctx.strokeStyle='#ddd6c7';\n  for (const [zh, en, rings] of WORLD){\n    ctx.beginPath();\n    for (const ring of rings){\n      for (let i=0;i<ring.length;i+=2){\n        const X=px(ring[i]), Y=py(ring[i+1]);\n        i===0 ? ctx.moveTo(X,Y) : ctx.lineTo(X,Y);\n      }\n      ctx.closePath();\n    }\n    ctx.stroke();\n  }\n  // bubbles\n  const rows=[...counts.entries()].filter(([n])=>REGION_XY[n])\n    .sort((a,b)=>b[1]-a[1]);\n  const placed=[];\n  ctx.font='600 11px Georgia,serif';\n  for (const [name,n] of rows){\n    const [lon,lat]=REGION_XY[name];\n    const r=6+Math.sqrt(n/maxN)*30;\n    const cx=px(lon), cy=py(lat);\n    ctx.beginPath(); ctx.arc(cx,cy,r,0,7);\n    ctx.fillStyle='rgba(47,74,109,.20)'; ctx.fill();\n    ctx.strokeStyle='rgba(47,74,109,.72)'; ctx.lineWidth=1.3; ctx.stroke();\n\n    // Place the label in the first direction that does not collide with an\n    // already placed one; East Asia packs six regions into ~10 degrees, so\n    // a fixed \"above\" position overlaps badly.\n    const text=`${name} ${n}`;\n    const tw=ctx.measureText(text).width, th=12;\n    const cands=[\n      [cx-tw/2, cy-r-6-th],\n      [cx-tw/2, cy+r+2],\n      [cx+r+5, cy-th/2],\n      [cx-r-5-tw, cy-th/2],\n      [cx-tw/2, cy-r-20-th],\n      [cx-tw/2, cy+r+16],\n    ];\n    let pick=null;\n    for (const [lx,ly] of cands){\n      const box={x:lx-2, y:ly-2, w:tw+4, h:th+4};\n      const hit=placed.some(p=>!(box.x+box.w<p.x||p.x+p.w<box.x||\n                                 box.y+box.h<p.y||p.y+p.h<box.y));\n      if (!hit){ pick={lx,ly,box}; break; }\n    }\n    if (!pick) continue;             // no room: the legend below still lists it\n    placed.push(pick.box);\n    // leader line when the label had to move away from the bubble\n    const lyc=pick.ly+th/2;\n    const far=Math.abs(pick.lx+tw/2-cx)>r+8 || Math.abs(lyc-cy)>r+10;\n    if (far){\n      ctx.strokeStyle='rgba(47,74,109,.32)'; ctx.lineWidth=.9;\n      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(pick.lx+tw/2,lyc); ctx.stroke();\n    }\n    ctx.fillStyle='#23262d'; ctx.textAlign='left';\n    ctx.fillText(text, pick.lx, pick.ly+th-2);\n  }\n  geoState={rows,proj:{px,py,r:n=>6+Math.sqrt(n/maxN)*30}};\n  const lg=document.getElementById('geoLegend');\n  if (lg){\n    lg.innerHTML = rows.map(([name,n])=>{\n      const fam = '';\n      return `<span style=\"color:#3b3e46\">${esc(name)} <b style=\"font-variant-numeric:tabular-nums\">${n}</b></span>`;\n    }).join('') + '<span style=\"opacity:.65\">\u6c14\u6ce1\u6309\u6587\u732e\u6570\u7f29\u653e</span>';\n  }\n  const none=items.filter(i=>!(i.regions||[]).length).length;\n  document.getElementById('geoStat').textContent =\n    `${rows.length} \u4e2a\u533a\u57df \u00b7 ${none} \u7bc7\u672a\u8bc6\u522b\u51fa\u533a\u57df\uff08\u5730\u56fe\u4e0a\u4e0d\u663e\u793a\uff09`;\n}\nlet geoState=null;\ndocument.getElementById('c-geo').addEventListener('mousemove', ev=>{\n  if (!geoState) return;\n  const cv=ev.currentTarget, rect=cv.getBoundingClientRect();\n  const mx=ev.clientX-rect.left, my=ev.clientY-rect.top;\n  let hit=null;\n  for (const [name,n] of geoState.rows){\n    const [lon,lat]=REGION_XY[name];\n    const dx=geoState.proj.px(lon)-mx, dy=geoState.proj.py(lat)-my;\n    if (dx*dx+dy*dy <= Math.pow(geoState.proj.r(n),2)){ hit=[name,n]; break; }\n  }\n  if (hit){\n    const list=items.filter(i=>(i.regions||[]).includes(hit[0]));\n    const subs={};\n    list.forEach(i=>{ const c=i.collection||'\u672a\u5206\u7c7b'; subs[c]=(subs[c]||0)+1; });\n    const top=Object.entries(subs).sort((a,b)=>b[1]-a[1]).slice(0,4)\n      .map(([k,v])=>`${esc(k)} ${v}`).join(' \u00b7 ');\n    showTip(evt, `<b>${esc(hit[0])}</b><br>${hit[1]} \u7bc7<br><span style=\"opacity:.75\">${top}</span>`);\n  } else hideTip();\n});\ndocument.getElementById('c-geo').addEventListener('mouseleave', hideTip);\n\nif (!CanvasRenderingContext2D.prototype.roundRect){\n  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){\n    this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r);\n    this.arcTo(x+w,y+h,x,y+h,r); this.arcTo(x,y+h,x,y,r);\n    this.arcTo(x,y,x+w,y,r); this.closePath(); return this;\n  };\n}\n\n// ---------- boot ----------\nconst draw = {rel:drawRel, sem:drawSem, tim:drawTim, geo:drawGeo};\n\n// Masthead figures: the headline numbers, computed once from the payload.\n(function fillFigures(){\n  const years = items.map(i=>i.year).filter(Boolean);\n  const span = years.length ? `${Math.min(...years)}\u2013${Math.max(...years)}` : '\u2014';\n  const withDoi = items.filter(i=>i.doi).length;\n  const dead = items.filter(i=>!i.collection).length;\n  const figs = [\n    [items.length, '\u6587\u732e'],\n    [SUBS.length, '\u5206\u7c7b'],\n    [edges.length, '\u5e93\u5185\u5f15\u7528'],\n    [span, '\u5e74\u4efd\u8de8\u5ea6'],\n    [withDoi, '\u6709 DOI'],\n  ];\n  document.getElementById('figures').innerHTML = figs.map(([v,k])=>\n    `<div class=\"fig\"><b>${v}</b><span>${k}</span></div>`).join('');\n})();\n\ndrawRel();\nwindow.addEventListener('resize', ()=>{ relState=null; drawRel(); });\n</script>\n</body>\n</html>\n";
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
    var uri = _rootURI + "content/world.json";
    var text = Zotero.File.getContentsFromURL(uri);
    WORLD_CACHE = JSON.parse(text);
    log("world loaded: " + WORLD_CACHE.length + " countries");
  } catch (e) {
    log("world load failed: " + e);
    WORLD_CACHE = [];
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

async function generate(win, forceRefresh) {
  var progress = new Zotero.ProgressWindow({ closeOnClick: false });
  progress.changeHeadline("文献地图");
  progress.show();
  progress.addDescription("正在读取文献库…");
  progress.show();

  try {
    var items = await collectItems();
    log("items " + items.length);
    progress.addDescription("正在获取引用关系（已缓存的直接复用）…");
    progress.show();
    var edges = await buildEdges(items, progress, forceRefresh);
    tagRegions(items);
    log("edges " + edges.length);

    var payload = { items: items, edges: edges };
    var html = TEMPLATE
      .replace("__DATA__", JSON.stringify(payload))
      .replace("@@WORLD@@", JSON.stringify(worldData()));

    var dir = Services.dirsvc.get("Docs", Components.interfaces.nsIFile);
    var path = dir.path + "\\文献地图.html";
    writeFile(path, html);
    log("wrote " + path);

    progress.changeHeadline("文献地图已生成");
    progress.addDescription(items.length + " 篇 · " + edges.length + " 条引用边");
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

function installMenu(win) {
  var doc = win.document;
  var popup = findToolsPopup(doc);
  if (!popup) return false;
  if (popup.querySelectorAll(".litmap-item").length >= 2) return true;

  function makeItem(label, force) {
    var mi = doc.createXULElement("menuitem");
    mi.className = "menuitem-iconic litmap-item";
    mi.setAttribute("label", label);
    mi.addEventListener("command", function () { generate(win, force); });
    return mi;
  }

  var sep = popup.querySelector("menuseparator");
  var anchor = sep && sep.parentNode === popup ? sep : null;
  function place(el) {
    if (anchor) popup.insertBefore(el, anchor);
    else popup.appendChild(el);
  }

  // Incremental by default; the full rebuild is a separate entry so the common
  // case never pays for a re-download.
  place(makeItem("生成文献地图（增量）", false));
  place(makeItem("重新构建文献地图（清空引用缓存）", true));

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
    log("autorun flag found");
    Zotero.getMainWindow().setTimeout(function () {
      generate(Zotero.getMainWindow(), false);
    }, 2500);
  } catch (e) { log("autorun failed: " + e); }
}

function install() {}
function uninstall() {}
