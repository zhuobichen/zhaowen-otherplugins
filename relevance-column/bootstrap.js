/* Relevance Column — hidden-by-default Zotero column showing paper-relevance scores.
 *
 * Design (learned from collection-tags bootstrap.js, which documents these traps):
 *   - A registered column is NOT auto-shown. It appears in the column picker
 *     (right-click the item-tree header) and the user opts in. We deliberately
 *     do NOT force hidden=false — "default hidden until allowed" is the spec.
 *   - Non-ASCII column LABELS get mangled ("相关度" arrives as "{"), so the
 *     label is ASCII ("Relevance"); cell content may be Chinese.
 *   - Register through Zotero.ItemTreeManager.registerColumn only. Never write
 *     _columns, _columnPrefs or treePrefs.json (that corrupts the header).
 *   - width is required; flex-only renders at zero width.
 *
 * Data source: a paper-relevance CSV (scores_<rubric>_<UTC>.csv) with columns
 *   score_normalized, confidence, decision, already_cited, rubric_sha256, key.
 * Matched by Zotero item key. Each cell shows the score pill + a small
 * confidence mark, then a bottom-right badge: `Cite` when the item is already
 * cited by the manuscript, plus a red star that is always there as a legend
 * ("this number is relevance to my paper, not item-to-item similarity").
 * Hovering the pill shows the full rubric fingerprint (version-binding for audit).
 *
 * Config is a JSON file next to this plugin (config.json):
 *   { "csv": "<path>" }
 * Reload via the item context menu "Reload Relevance Scores" or restart Zotero.
 */
"use strict";

const PLUGIN_ID = "relevance-column@zhuobichen.github.io";
const LABEL = "Relevance";
const DATA_KEY = "relevanceScore";
const LOG_PATH = "E:\\CodeProject\\zotero-collection-tags\\relevance-column\\_relevance_log.txt";
const CONFIG_PATH = "E:\\CodeProject\\zotero-collection-tags\\relevance-column\\config.json";

let registered = false;
let scoreMap = new Map();   // key -> {score, conf, decision, cited, sha, rubricId}
let metaInfo = null;        // {rubric_id, sha256, csv, loadedAt}

function log(line) {
  try {
    const f = Zotero.File.pathToFile(LOG_PATH);
    // putContents() overwrites — its options argument does not support "append",
    // so read the tail, prepend it, and write the whole thing back. Bounded so the
    // file cannot grow without limit across years of restarts.
    let prev = "";
    try { if (f.exists()) prev = Zotero.File.getContents(f) || ""; } catch (e) { prev = ""; }
    if (prev.length > 128000) prev = prev.slice(-64000);
    Zotero.File.putContents(f, prev + new Date().toISOString() + " " + line + "\n");
  } catch (e) { /* logging must never break the plugin */ }
}

/* ---- CSV: minimal RFC4180-ish parser (handles quotes + escaped quotes) ---- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function loadScores() {
  scoreMap = new Map();
  metaInfo = null;
  let cfg = {};
  try {
    cfg = JSON.parse(await Zotero.File.getContentsAsync(CONFIG_PATH));
  } catch (e) {
    log("config missing/invalid, using default CSV path: " + e);
  }
  const csvPath = cfg.csv ||
    "E:\\CodeProject\\Agent_Papers\\projects\\O3_DataFusion_Policy\\audit\\relevance\\scores_rel-5lvl-zh-v1_20261126T075845Z.csv";
  let text;
  try {
    text = await Zotero.File.getContentsAsync(csvPath);
  } catch (e) {
    log("cannot read CSV: " + csvPath + " " + e);
    return;
  }
  const rows = parseCSV(text);
  if (!rows.length) return;
  const head = rows[0].map((h) => h.trim());
  const col = (name) => head.indexOf(name);
  const iKey = col("key"), iScore = col("score_normalized"), iConf = col("confidence");
  const iDec = col("decision"), iCited = col("already_cited"), iSha = col("rubric_sha256");
  const iRub = col("rubric_id"), iVer = col("rubric_version");
  if (iKey < 0 || iScore < 0) { log("CSV missing key/score_normalized columns"); return; }
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const key = (row[iKey] || "").trim();
    if (!key) continue;
    scoreMap.set(key, {
      score: parseFloat(row[iScore] || "0"),
      conf: iConf >= 0 ? parseFloat(row[iConf] || "0") : 0,
      decision: iDec >= 0 ? row[iDec] : "",
      cited: iCited >= 0 ? String(row[iCited]).toLowerCase() === "true" : false,
      sha: iSha >= 0 ? row[iSha] : "",
      rubricId: iRub >= 0 ? row[iRub] : "",
      version: iVer >= 0 ? row[iVer] : "",
    });
  }
  const first = scoreMap.values().next().value;
  metaInfo = { csv: csvPath, rubric_id: first ? first.rubricId : "", sha256: first ? first.sha : "",
               loadedAt: new Date().toISOString() };
  log(`loaded ${scoreMap.size} scores from ${csvPath} rubric=${metaInfo.rubric_id} sha=${metaInfo.sha256.slice(0,12)}`);
}

function dataProvider(item) {
  try {
    const key = item && item.key;
    if (!key) return "";
    const r = scoreMap.get(key);
    if (!r) return "";
    // Sortable: score first (zero-padded), then confidence; visible text is stripped by renderCell.
    const s = Number.isFinite(r.score) ? r.score : 0;
    const c = Number.isFinite(r.conf) ? r.conf : 0;
    return String(Math.round(s * 10)).padStart(4, "0") + "|" + s.toFixed(1) + "|" + c.toFixed(2) + "|" +
      (r.decision || "") + "|" + (r.cited ? "cited" : "uncited") + "|" + r.sha;
  } catch (e) { return ""; }
}

function renderCell(index, data, column, isFirstColumn, doc) {
  const document = doc || Zotero.getMainWindow().document;
  const cell = document.createElement("span");
  cell.className = "cell " + (column && column.className ? column.className : "");
  // position:relative kept for safety; the badge below is inline (not absolute)
  // so it hugs the score instead of floating at the far right of a wide column.
  cell.style.cssText = "display:inline-flex;align-items:center;gap:4px;overflow:hidden;white-space:nowrap;" +
    "position:relative;padding-right:0;";
  if (!data) return cell;
  const parts = String(data).split("|");
  const score = parts[1] || "", conf = parts[2] || "", decision = parts[3] || "", cited = parts[4] || "", sha = parts[5] || "";

  // Score pill colour: >=60 green-ish, >=40 amber, else grey; low confidence dashed border.
  let bg = "#EEF2F6", ink = "#334155", edge = "#CBD5E1";
  const s = parseFloat(score);
  if (s >= 60) { bg = "#E7F5EC"; ink = "#166534"; edge = "#86EFAC"; }
  else if (s >= 40) { bg = "#FFF4DC"; ink = "#92400E"; edge = "#FCD34D"; }
  const dashed = decision && decision.indexOf("待定") >= 0;
  const isCited = cited === "cited";

  const pill = document.createElement("span");
  pill.textContent = score;
  pill.style.cssText = [
    "display:inline-block", "padding:1px 6px", "border-radius:9px",
    "font-size:0.82em", "line-height:15px", "font-weight:600",
    "color:" + ink, "background:" + bg,
    "border:1px " + (dashed ? "dashed" : "solid") + " " + edge,
    "white-space:nowrap",
  ].join(";");
  pill.title = "相对本文（baseline manuscript）的相关度\nrubric " +
    (metaInfo ? metaInfo.rubric_id : "?") + " sha256=" + sha +
    (decision ? "\n判定：" + decision : "") + "\n" +
    (isCited ? "已引用：该文献出现在正文参考文献中（按 DOI 匹配）" : "未引用：正文参考文献里没有它");
  cell.appendChild(pill);

  if (conf) {
    const c = document.createElement("span");
    c.textContent = "c" + conf;
    c.style.cssText = "font-size:0.72em;color:#94A3B8;";
    c.title = "confidence（只作门槛，不乘进分数）";
    cell.appendChild(c);
  }
  // 紧跟分数的徽标：`Cite` 只在已引用时出现，右侧常驻一颗小红星。
  // 红星是图例——这列的数字是「相对我那篇论文」的相关度，不是文献间的互相关；
  // 只要这一行有分数就画。用 align-self:flex-end 贴到底部，视觉上窝在分数右下角。
  const badge = document.createElement("span");
  badge.style.cssText = "display:inline-flex;align-items:baseline;gap:1px;line-height:1;" +
    "align-self:flex-end;margin-left:-1px;margin-bottom:0;pointer-events:none;";
  if (isCited) {
    const ct = document.createElement("span");
    ct.textContent = "Cite";
    ct.style.cssText = "font-size:0.58em;font-weight:700;letter-spacing:0.02em;color:#DC2626;";
    badge.appendChild(ct);
  }
  const star = document.createElement("span");
  star.textContent = "★";
  star.style.cssText = "font-size:0.58em;color:#DC2626;";
  badge.appendChild(star);
  cell.appendChild(badge);
  return cell;
}

async function ensureColumn() {
  if (registered) return true;
  try {
    const key = await Zotero.ItemTreeManager.registerColumn({
      dataKey: DATA_KEY,
      label: LABEL,
      pluginID: PLUGIN_ID,
      enabledTreeIDs: ["main"],
      flex: 0,
      width: "110",
      fixedWidth: false,
      minWidth: 70,
      showInColumnPicker: true,
      columnPickerSubMenu: true,
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider,
      renderCell: (i, d, c, f, doc) => renderCell(i, d, c, f, doc),
    });
    registered = true;
    log("registered column: " + key);
    return true;
  } catch (e) {
    log("register failed: " + e);
    return false;
  }
}

function installReloadMenu(win) {
  try {
    const doc = win.document;
    const popup = doc.getElementById("zotero-itemmenu");
    if (!popup) return;
    const mi = doc.createXULElement("menuitem");
    mi.setAttribute("label", "Reload Relevance Scores");
    mi.className = "relevance-reload-item";
    mi.addEventListener("command", async () => {
      await loadScores();
      const tree = win.ZoteroPane && win.ZoteroPane.itemsView;
      if (tree && typeof tree.rebuildTree === "function") tree.rebuildTree();
    });
    popup.appendChild(mi);
    popup.addEventListener("popuphidden", () => mi.remove(), { once: true });
  } catch (e) { log("menu install failed: " + e); }
}

async function startup({ id, version }, reason) {
  log("startup v" + version);
  await loadScores();
  await ensureColumn();
  const win = Zotero.getMainWindow();
  if (win) installReloadMenu(win);
}

function shutdown({ id, version }, reason) {
  log("shutdown " + reason);
}

function install() {}
function uninstall() {}

var bootstrap = { startup, shutdown, install, uninstall };
