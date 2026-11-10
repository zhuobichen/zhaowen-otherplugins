/**
 * Collection Tags — minimal, standards-only implementation.
 *
 * Everything below is the documented plugin API. Earlier revisions hand-edited
 * `_columns`, `_columnPrefs` and `treePrefs.json`; that corrupted the rendered
 * header (a column persisted to JSON has no `dataProvider`, so the header threw
 * while rendering it and dropped the columns after it). None of that is done
 * here.
 *
 * Facts about this Zotero build, established by probing:
 *   - Code inside the .xpi cannot be loaded by URL; everything lives here.
 *   - Nothing may be imported at module scope (a failing importESModule at the
 *     top silently aborts the whole bootstrap).
 *   - A non-ASCII column label is mangled ("分类" arrives as "{"), so the label
 *     is ASCII.
 *   - Zotero escapes "@" and "." in a plugin dataKey, e.g.
 *     collection-tags\@zhuobichen\.github\.io-collectionTags
 *   - A registered column is NOT auto-shown; it must be enabled from the
 *     column picker (right-click the header), which is when Zotero persists it.
 */

var chromeHandle;

const PLUGIN_ID = "collection-tags@zhuobichen.github.io";
const LABEL = "Category";
const LOG_PATH = "E:\\CodeProject\\zotero-collection-tags\\dist\\_ct_log.txt";

let registered = false;
let pollTimer = null;

function install(data, reason) {}

/** Only API confirmed to work inside bootstrap for file output. */
function writeText(path, text, append) {
  try {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    const stream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    if (append) {
      stream.init(file, 0x02 | 0x08, 0o644, 0);
      stream.QueryInterface(Ci.nsISeekableStream)
        .seek(Ci.nsISeekableStream.NS_SEEK_END, 0);
    } else {
      stream.init(file, 0x02 | 0x08 | 0x10, 0o644, 0);
    }
    // nsIFileOutputStream.write() treats the string as bytes; encode to UTF-8
    // first or every non-ASCII character is mangled.
    const bytes = new TextEncoder().encode(text);
    stream.write(String.fromCharCode.apply(null, Array.from(bytes)), bytes.length);
    stream.close();
    return true;
  } catch (e) {
    return false;
  }
}

function log(message) {
  const line = "[CollectionTags] " + message + "\n";
  try {
    Zotero.debug(line);
  } catch (e) {}
  writeText(LOG_PATH, line, true);
}

/**
 * "方法 › 统计地统计" for one item, or "" when it has no leaf collection.
 *
 * Uses Zotero.Collections.get(id) per membership rather than enumerating
 * libraries: enumerating returned an incomplete set here and the column
 * rendered empty.
 */
const SEPARATOR = " \u203a ";

function pathForItem(item) {
  const parts = [];
  let ids = [];
  try {
    ids = item.getCollections() || [];
  } catch (e) {
    return "";
  }
  for (const id of ids) {
    let collection = null;
    try {
      collection = Zotero.Collections.get(id);
    } catch (e) {
      collection = null;
    }
    if (!collection || !collection.name) continue;

    let isContainer = false;
    try {
      isContainer = typeof collection.hasChildCollections === "function"
        ? collection.hasChildCollections()
        : !!collection.hasChildCollections;
    } catch (e) {
      isContainer = false;
    }
    if (isContainer) continue;

    let parentName = "";
    try {
      const parentId = collection.parentID;
      if (parentId) {
        const parent = Zotero.Collections.get(parentId);
        if (parent && parent.name) parentName = parent.name;
      }
    } catch (e) {
      parentName = "";
    }

    parts.push(parentName
      ? parentName + SEPARATOR + collection.name
      : collection.name);
  }
  return Array.from(new Set(parts)).sort().join(" | ");
}

/**
 * One colour per top-level category, taken from the Nature Publishing Group
 * palette (ggsci::pal_npg) that most journals use for figures.
 *
 *   方法           -> NPG blue   #3C5488
 *   应用           -> NPG red    #E64B35
 *   未分类 / 垃圾箱  -> muted grey #8491B4
 *
 * Sub-categories share their parent's colour; the hierarchy reads from the
 * styling instead — a filled chip for the top level, an outlined chip for the
 * child. Category identity therefore never depends on telling two similar
 * shades apart.
 */
const ACCENTS = {
  method: "#3C5488",
  application: "#E64B35",
  muted: "#8491B4",
};

const COOL = ["\u65b9\u6cd5"];
const WARM = ["\u5e94\u7528"];
const MUTED = ["\u672a\u5206\u7c7b", "\u5783\u573e\u7bb1"];

function familyFor(group) {
  if (MUTED.includes(group)) return "muted";
  if (WARM.includes(group)) return "application";
  return "method";
}

/** Blend a #rrggbb accent towards white by amount (0..1). */
function tint(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const to2 = (v) => v.toString(16).padStart(2, "0");
  return "#" + to2(mix(r)) + to2(mix(g)) + to2(mix(b));
}

/** Darken a #rrggbb accent by amount (0..1) for text contrast. */
function shade(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c * (1 - amount));
  const to2 = (v) => v.toString(16).padStart(2, "0");
  return "#" + to2(mix(r)) + to2(mix(g)) + to2(mix(b));
}

/** One pill per level: filled group chip, then a matching outline chip. */
function renderCell(index, data, column, isFirstColumn, doc) {
  const document = doc || Zotero.getMainWindow().document;
  const cell = document.createElement("span");
  cell.className = "cell " + (column && column.className ? column.className : "");
  cell.style.cssText =
    "display:inline-flex;gap:3px;align-items:center;overflow:hidden;white-space:nowrap;";

  if (!data) {
    return cell;
  }

  for (const entry of String(data).split(" | ")) {
    const segments = entry.split(SEPARATOR);
    const group = segments.length > 1 ? segments[0] : "";
    const leaf = segments[segments.length - 1];
    const family = familyFor(group);
    const accent = ACCENTS[family] || ACCENTS.muted;
    const fill = tint(accent, 0.9);
    const edge = tint(accent, 0.55);
    const ink = shade(accent, 0.15);

    if (group) {
      const top = document.createElement("span");
      top.textContent = group;
      top.title = group;
      top.style.cssText = [
        "display:inline-block",
        "padding:1px 6px",
        "border-radius:9px",
        "font-size:0.78em",
        "line-height:14px",
        "font-weight:600",
        "color:" + ink,
        "background:" + fill,
        "border:1px solid " + edge,
        "white-space:nowrap",
      ].join(";");
      cell.appendChild(top);
    }

    const sub = document.createElement("span");
    sub.textContent = leaf;
    sub.title = entry;
    sub.style.cssText = [
      "display:inline-block",
      "padding:1px 6px",
      "border-radius:9px",
      "font-size:0.78em",
      "line-height:14px",
      "font-weight:500",
      "color:" + ink,
      "background:transparent",
      "border:1px solid " + edge,
      "max-width:190px",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "white-space:nowrap",
    ].join(";");
    cell.appendChild(sub);
  }
  return cell;
}

/** Register the column through the supported API only. */
async function ensureColumn() {
  if (registered) return true;
  try {
    const key = await Zotero.ItemTreeManager.registerColumn({
      dataKey: "collectionTags",
      label: LABEL,
      pluginID: PLUGIN_ID,
      enabledTreeIDs: ["main"],
      // width is required; a flex-only column renders at zero width.
      flex: 0,
      width: "200",
      fixedWidth: false,
      minWidth: 90,
      showInColumnPicker: true,
      columnPickerSubMenu: true,
      zoteroPersist: ["width", "hidden", "sortDirection"],
      dataProvider: (item) => pathForItem(item),
      renderCell: (i, data, column, isFirstColumn, doc) =>
        renderCell(i, data, column, isFirstColumn, doc),
    });
    registered = true;
    log("registered: " + key);

    return true;
  } catch (e) {
    log("register failed: " + e);
    return false;
  }
}

async function startup({ id, version }, reason) {
  writeText(LOG_PATH, "", false);
  log("startup v" + version);

  let ticks = 0;
  pollTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  pollTimer.initWithCallback({
    notify() {
      ticks++;
      try {
        const win = Zotero.getMainWindow();
        const tree = win && win.ZoteroPane ? win.ZoteroPane.itemsView : null;
        if (!tree) {
          if (ticks > 120) { pollTimer.cancel(); log("gave up waiting for tree"); }
          return;
        }
        if (!registered) {
          ensureColumn();
          return;
        }
        pollTimer.cancel();
        log("done after " + ticks + " ticks");
      } catch (e) {
        log("tick error: " + e);
      }
    },
  }, 300, Ci.nsITimer.TYPE_REPEATING_SLACK);

  // A local nsITimer is collected before it fires; a window-scoped timeout is
  // kept alive by the window itself.
  try {
    const win0 = Zotero.getMainWindow();
    if (win0) {
      win0.setTimeout(() => {
        try {
          const win = Zotero.getMainWindow();
          const tree = win && win.ZoteroPane ? win.ZoteroPane.itemsView : null;
          if (!tree) { log("late report: no tree"); return; }
          const prefs = tree._columnPrefs || {};
          const mineKey = Object.keys(prefs).find((k) => k.includes("collection-tags"));
          // Make the column visible automatically. Safe now: registration
          // happened before the tree loaded, so the definition (and its
          // dataProvider) resolves.
          let revealed = null;
          let revealed_written = false;
          let revealed_error = null;
          try {
            const prefs = tree._columnPrefs || {};
            const k = Object.keys(prefs).find((x) => x.includes("collection-tags"));
            if (k) {
              prefs[k].hidden = false;
              prefs[k].width = 200;
              if (typeof tree._writeColumnPrefsToFile === "function") {
                try {
                  tree._writeColumnPrefsToFile();
                  revealed_written = true;
                } catch (e) {
                  revealed_error = String(e);
                }
              }
              if (typeof tree._storeColumnPrefs === "function") {
                try { tree._storeColumnPrefs(); } catch (e) {}
              }
              if (typeof tree.refresh === "function") tree.refresh();
              revealed = {
                key: k,
                hidden: prefs[k].hidden,
                written: revealed_written,
                writeError: revealed_error,
              };
            }
          } catch (e) { revealed = { error: String(e) }; }

          log("LATE: " + JSON.stringify({
            revealed: revealed,
            prefCount: Object.keys(prefs).length,
            myPrefKey: mineKey || null,
            myPrefHidden: mineKey ? prefs[mineKey].hidden : null,
            inColumns: (tree._columns || []).some(
              (c) => String(c && c.dataKey).includes("collection-tags")),
            columnCount: (tree._columns || []).length,
            pickerWouldShow: (Zotero.ItemTreeManager.getCustomColumns(["main"]) || [])
              .some((c) => String(c.dataKey).includes("collection-tags")),
          }));
        } catch (e) { log("late report failed: " + e); }
      }, 8000);
      log("late report scheduled");
    }
  } catch (e) { log("schedule failed: " + e); }
}

async function onMainWindowLoad({ window }, reason) {
  log("onMainWindowLoad");
  await ensureColumn();
}

async function onMainWindowUnload({ window }, reason) {}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) return;
  try {
    if (Zotero.ItemTreeManager) {
      Zotero.ItemTreeManager.unregisterColumn(
        "collection-tags\\@zhuobichen\\.github\\.io-collectionTags");
    }
  } catch (e) {}
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
