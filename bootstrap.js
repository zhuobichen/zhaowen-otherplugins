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

/** Tag that marks an item as important. */
const IMPORTANT_TAG = "\u25b2";

/**
 * Desired reading order for the taxonomy. Zotero's plugin API has no comparator
 * for custom columns -- the tree sorts by the string returned from
 * dataProvider -- so the order is encoded as a zero-padded rank prefix that
 * renderCell strips again. Anything not listed sorts last, alphabetically.
 */
const CATEGORY_ORDER = [
  "\u65b9\u6cd5" + SEPARATOR + "\u7edf\u8ba1\u5730\u7edf\u8ba1",
  "\u65b9\u6cd5" + SEPARATOR + "\u673a\u5668\u5b66\u4e60",
  "\u65b9\u6cd5" + SEPARATOR + "\u6df1\u5ea6\u5b66\u4e60",
  "\u65b9\u6cd5" + SEPARATOR + "\u6570\u636e\u540c\u5316\u4e0e\u96c6\u5408",
  "\u5e94\u7528" + SEPARATOR + "\u4ea7\u54c1\u4e92\u6bd4\u4e0e\u9009\u62e9\u654f\u611f\u6027",
  "\u5e94\u7528" + SEPARATOR + "\u957f\u671f\u8d8b\u52bf\u4e0e\u65ad\u70b9",
  "\u5e94\u7528" + SEPARATOR + "\u5065\u5eb7\u4e0e\u66b4\u9732\u5f71\u54cd",
  "\u5e94\u7528" + SEPARATOR + "\u6570\u636e\u8c31\u7cfb\u4e0e\u9a8c\u8bc1\u65b9\u6cd5",
  "\u672a\u5206\u7c7b" + SEPARATOR + "\u5f85\u4eba\u5de5\u5224\u5b9a",
  "\u5783\u573e\u7bb1",
];

/** Zero-padded rank so string sort matches CATEGORY_ORDER. */
function rankFor(entry) {
  const index = CATEGORY_ORDER.indexOf(entry);
  const rank = index >= 0 ? index + 1 : 99;
  return String(rank).padStart(2, "0");
}

/** Separates the hidden sort prefix from the visible text. */
const SORT_SEP = "\u001f";



function pathForItem(item) {
  // A standalone index note carries no collection, so it would sort as an
  // empty string and land among the literature. Give notes a synthetic
  // top-priority entry so they pin to the top of the list.
  try {
    if (item.isNote && item.isNote()) {
      return "00" + SORT_SEP + "\u2605 \u5206\u7c7b\u7d22\u5f15";
    }
  } catch (e) {
    // fall through to the collection logic
  }

  // Importance marker: a "\u25b2" tag renders as a red chip ahead of the
  // categories, so the user does not need a separate tag column.
  let important = false;
  try {
    const tagNames = (item.getTags() || []).map((t) => t.tag);
    important = tagNames.indexOf(IMPORTANT_TAG) >= 0;
  } catch (e) {
    important = false;
  }

  const parts = [];
  let ids = [];
  try {
    ids = item.getCollections() || [];
  } catch (e) {
    if (important) {
      return "01" + SORT_SEP + IMPORTANT_TAG;
    }
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
  const unique = Array.from(new Set(parts));
  // Order entries within the cell by taxonomy rank, then attach the rank so the
  // tree's own sort follows the same sequence.
  unique.sort((a, b) => rankFor(a).localeCompare(rankFor(b)) || a.localeCompare(b));
  const encoded = unique.map((e) => rankFor(e) + SORT_SEP + e);

  // The marker leads, so it survives the cell's width truncation.
  if (important) {
    encoded.unshift("01" + SORT_SEP + IMPORTANT_TAG);
  }
  return encoded.join(" | ");
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
  muted: "#4B5563",
};

const COOL = ["\u65b9\u6cd5"];
const WARM = ["\u5e94\u7528"];
const MUTED = ["\u672a\u5206\u7c7b", "\u5783\u573e\u7bb1", "\u2605 \u5206\u7c7b\u7d22\u5f15"];

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

  for (const raw of String(data).split(" | ")) {
    // Drop the hidden sort rank; everything after SORT_SEP is display text.
    const entry = raw.includes(SORT_SEP) ? raw.split(SORT_SEP)[1] : raw;
    const segments = entry.split(SEPARATOR);
    const group = segments.length > 1 ? segments[0] : "";
    const leaf = segments[segments.length - 1];
    // The importance marker gets its own treatment: a filled red chip.
    if (!group && leaf === IMPORTANT_TAG) {
      const flag = document.createElement("span");
      flag.textContent = IMPORTANT_TAG;
      flag.title = "\u91cd\u70b9";
      flag.style.cssText = [
        "display:inline-block",
        "padding:0 5px",
        "border-radius:3px",
        "font-size:0.8em",
        "line-height:15px",
        "font-weight:700",
        "color:#ffffff",
        "background:#C0392B",
        "border:1px solid #922B21",
        "white-space:nowrap",
      ].join(";");
      cell.appendChild(flag);
      continue;
    }

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
/** Per-window state for the hand-injected context-menu item. */
const menuState = {
  window: null,
  installed: false,
  popup: null,
  onShowing: null,
  onHidden: null,
};

/**
 * Attach a "toggle important" entry to the item context menu.
 *
 * The popup is found by id ("zotero-itemmenu"). Our element is appended on
 * popupshown and dropped on popuphidden, so it never lingers and cannot affect
 * the popup's own lifecycle.
 */
function installMenuItem(win) {
  if (!win || menuState.installed) return;
  const popup = win.document.getElementById("zotero-itemmenu");
  if (!popup) {
    log("item menu popup not found");
    return;
  }

  const onShowing = () => {
    try {
      // Remove any stale copy first.
      const old = popup.querySelector(".collection-tags-important-item");
      if (old) old.remove();

      const items = Zotero.getActiveZoteroPane().getSelectedItems() || [];
      const regular = items.filter((it) => {
        try {
          return !(typeof it.isRegularItem === "function"
            && !it.isRegularItem());
        } catch (e) {
          return false;
        }
      });
      if (!regular.length) return;

      const allMarked = regular.every((it) => {
        try {
          return (it.getTags() || []).some((t) => t.tag === IMPORTANT_TAG);
        } catch (e) {
          return false;
        }
      });

      const mi = win.document.createXULElement("menuitem");
      mi.className = "menuitem-iconic collection-tags-important-item";
      // Use a real <image> child with Zotero's own icon class, so padding and
      // vertical centring come from the menu item's native layout instead of
      // hand-tuned offsets. An inline data URI avoids resolving a chrome: path.
      // No child element: Zotero reparents members of a menuitem-iconic and a
      // child <image> ends up detached (parentNode === null), which is why the
      // icon was invisible. Paint the triangle as the item's own background
      // instead, and inset the label so the two do not overlap.
      const svg = "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
        + '<path d="M8 2 L14 13 L2 13 Z" fill="#C0392B"/>'
        + "</svg>");
      mi.style.backgroundImage = "url('" + svg + "')";
      mi.style.backgroundRepeat = "no-repeat";
      mi.style.backgroundPosition = "6px center";
      mi.style.backgroundSize = "11px 11px";
      mi.style.paddingInlineStart = "24px";
      mi.setAttribute(
        "label",
        allMarked
          ? "\u53d6\u6d88\u91cd\u70b9\u6807\u8bb0"
          : "\u6807\u8bb0\u4e3a\u91cd\u70b9"
      );
      mi.addEventListener("command", () => {
        try {
          for (const item of regular) {
            if (allMarked) {
              item.removeTag(IMPORTANT_TAG);
            } else {
              item.addTag(IMPORTANT_TAG);
            }
          }
          Promise.all(regular.map((it) => it.saveTx())).catch((e) => {
            log("saveTx failed: " + e);
          });
          log("toggled " + IMPORTANT_TAG + " on " + regular.length +
              " items, remove=" + allMarked);
        } catch (e) {
          log("toggle failed: " + e);
        }
      });
      // Place it before the first separator that follows the item-specific
      // actions, which lands it alongside "添加笔记 / 查找全文" rather than at
      // the very top (easy to miss) or buried in the plugin group at the end.
      const notes = popup.querySelector(
        "menuitem[id^='zotero-menuitem-add-note'], "
        + "menuitem.zotero-menuitem-attach-note");
      if (notes && notes.parentNode === popup) {
        popup.insertBefore(mi, notes.nextSibling);
      } else {
        // Fallback: after the first separator.
        const sep = popup.querySelector("menuseparator");
        if (sep && sep.parentNode === popup) {
          popup.insertBefore(mi, sep.nextSibling);
        } else {
          popup.appendChild(mi);
        }
      }
    } catch (e) {
      log("onShowing failed: " + e);
    }
  };

  const onHidden = () => {
    try {
      const old = popup.querySelector(".collection-tags-important-item");
      if (old) old.remove();
    } catch (e) {
      log("onHidden failed: " + e);
    }
  };

  popup.addEventListener("popupshown", onShowing);
  popup.addEventListener("popuphidden", onHidden);
  menuState.window = win;
  menuState.popup = popup;
  menuState.onShowing = onShowing;
  menuState.onHidden = onHidden;
  menuState.installed = true;
  log("menu item listeners installed");
}

function uninstallMenuItem() {
  try {
    if (menuState.popup) {
      if (menuState.onShowing) {
        menuState.popup.removeEventListener("popupshown", menuState.onShowing);
      }
      if (menuState.onHidden) {
        menuState.popup.removeEventListener("popuphidden", menuState.onHidden);
      }
    }
  } catch (e) {
    log("uninstallMenuItem failed: " + e);
  }
  menuState.window = null;
  menuState.popup = null;
  menuState.onShowing = null;
  menuState.onHidden = null;
  menuState.installed = false;
}

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

  // Context-menu item injected by hand.
  //
  // Zotero.MenuManager cannot be used here: it has no label field, and its
  // l10nID path leaves the <menuitem> pending so the whole item context menu
  // stops opening (all four combinations were tried on 10.0.8). Instead listen
  // for popupshown on the item menu, append our own <menuitem>, and remove it
  // again on popuphidden. Nothing is registered with MenuManager, so nothing
  // can wedge the popup.
  //
  // The listeners are installed from onMainWindowLoad, and guarded so a second
  // window or a reload does not double-add them.
  menuState.window = null;
  menuState.installed = false;

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
        // Install the context-menu entry now that the window exists.
        // onMainWindowLoad never fires for this add-on.
        if (!menuState.installed) {
          installMenuItem(win);
        }
        pollTimer.cancel();
        log("ready after " + ticks + " ticks, menuInstalled=" +
            menuState.installed);
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
  uninstallMenuItem();
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
