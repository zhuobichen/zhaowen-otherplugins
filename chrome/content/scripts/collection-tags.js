/**
 * Collection Tags — show an item's collections as coloured tags in the item tree.
 *
 * Zotero collections behave like tags: one item can sit in many. This column
 * makes that visible at a glance without opening the right-hand pane.
 *
 * Design notes
 * ------------
 * - Only LEAF collections are shown by default. A parent collection that holds
 *   sub-collections is a grouping container and usually holds no items itself;
 *   showing it would just repeat the child name.
 * - Each collection gets a stable colour derived from its key, so the same
 *   collection looks the same on every machine and across sessions without
 *   storing any state.
 * - The data provider runs once per visible row, so it must stay cheap: it only
 *   walks the item's own collection memberships, never the whole tree.
 */

if (!Zotero.CollectionTags) {
  Zotero.CollectionTags = {
    id: null,
    version: null,
    rootURI: null,
    initialized: false,
    columnKey: null,
    _collectionCache: null,
    _cacheTime: 0,
  };
}

Zotero.CollectionTags.hooks = {
  onStartup: async function () {
    const plugin = Zotero.CollectionTags;
    plugin.id = "collection-tags@zhuobichen.github.io";

    try {
      // Seed the collection cache so the first paint is not empty.
      plugin.buildCollectionCache();

      plugin.columnKey = await Zotero.ItemTreeManager.registerColumn({
        dataKey: "collectionTags",
        label: "分类",
        pluginID: plugin.id,
        enabledTreeIDs: ["main"],
        // Let the column absorb spare width; tags can be long.
        flex: 0.5,
        minWidth: 90,
        showInColumnPicker: true,
        columnPickerSubMenu: true,
        zoteroPersist: ["width", "hidden", "sortDirection"],
        dataProvider: function (item) {
          return Zotero.CollectionTags.getTagsForItem(item);
        },
        renderCell: function (index, data, column, isFirstColumn, doc) {
          return Zotero.CollectionTags.renderCell(index, data, column, doc);
        },
      });

      plugin.initialized = true;
      Zotero.debug("[CollectionTags] column registered: " + plugin.columnKey);
    } catch (e) {
      Zotero.debug("[CollectionTags] startup failed: " + e);
      Zotero.logError(e);
    }
  },

  onMainWindowLoad: function (window) {},

  onMainWindowUnload: function (window) {},

  onShutdown: async function () {
    const plugin = Zotero.CollectionTags;
    if (plugin.columnKey) {
      try {
        Zotero.ItemTreeManager.unregisterColumn(plugin.columnKey);
      } catch (e) {
        Zotero.debug("[CollectionTags] unregister failed: " + e);
      }
      plugin.columnKey = null;
    }
    plugin.initialized = false;
  },
};

Zotero.CollectionTags.buildCollectionCache = function () {
  /**
   * Map collectionID -> {name, parentID, key, colour, isLeaf}.
   *
   * Rebuilt lazily: collections change far less often than the item tree
   * repaints, so caching for a few seconds avoids rebuilding on every scroll.
   */
  const plugin = Zotero.CollectionTags;
  const now = Date.now();
  if (plugin._collectionCache && now - plugin._cacheTime < 3000) {
    return plugin._collectionCache;
  }

  const cache = new Map();
  let collections;
  try {
    collections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID);
  } catch (e) {
    collections = [];
  }

  // First pass: name, parent, key.
  for (const collection of collections) {
    cache.set(collection.id, {
      id: collection.id,
      name: collection.name,
      parentID: collection.parentID || null,
      key: collection.key,
      colour: plugin.colourForKey(collection.key),
      isLeaf: true,
    });
  }

  // Second pass: a collection that has children is not a leaf.
  for (const entry of cache.values()) {
    if (entry.parentID && cache.has(entry.parentID)) {
      cache.get(entry.parentID).isLeaf = false;
    }
  }

  plugin._collectionCache = cache;
  plugin._cacheTime = now;
  return cache;
};

Zotero.CollectionTags.colourForKey = function (key) {
  /**
   * Stable colour from a collection key.
   *
   * A fixed hue ladder keeps adjacent hues distinguishable; lightness and
   * saturation are fixed so every tag has the same visual weight.
   */
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  // 12 evenly spaced hues is plenty before colours start to repeat visually.
  const hue = (hash % 12) * 30;
  return `hsl(${hue}, 62%, 42%)`;
};

Zotero.CollectionTags.getTagsForItem = function (item) {
  /**
   * Return the sorted, space-joined list of leaf collection names.
   *
   * Returning a plain string (not HTML) keeps sorting and the search index
   * behaving; the colour is applied in renderCell.
   */
  if (!item || item.isNote && item.isNote() || item.isAttachment && item.isAttachment()) {
    return "";
  }

  let membership;
  try {
    membership = item.getCollections();
  } catch (e) {
    return "";
  }
  if (!membership || !membership.length) {
    return "";
  }

  const cache = Zotero.CollectionTags.buildCollectionCache();
  const names = [];
  for (const id of membership) {
    const entry = cache.get(id);
    if (!entry) continue;
    if (!entry.isLeaf) continue; // skip grouping containers
    names.push(entry.name);
  }
  // Unique, then alphabetical so the same item always reads the same way.
  return Array.from(new Set(names)).sort().join(" · ");
};

Zotero.CollectionTags.renderCell = function (index, data, column, doc) {
  /**
   * Render one tag per collection as a coloured pill.
   *
   * The data provider returns names joined by " · " and the colour is looked up
   * again here, because renderCell is the only place that can build DOM.
   */
  const document = doc || Zotero.getMainWindow().document;
  const cell = document.createElement("div");
  cell.className = `cell ${column.className}`;
  cell.style.cssText =
    "display:flex;gap:4px;align-items:center;overflow:hidden;white-space:nowrap;";

  if (!data) {
    return cell;
  }

  const cache = Zotero.CollectionTags.buildCollectionCache();
  const byName = new Map();
  for (const entry of cache.values()) {
    if (entry.isLeaf) byName.set(entry.name, entry);
  }

  for (const name of data.split(" · ")) {
    const entry = byName.get(name);
    const tag = document.createElement("span");
    tag.textContent = name;
    tag.title = entry ? `集合：${name}` : name;
    const colour = entry ? entry.colour : "hsl(220, 8%, 45%)";
    tag.style.cssText = [
      "display:inline-block",
      "padding:0 5px",
      "border-radius:3px",
      "font-size:0.85em",
      "line-height:16px",
      `color:${colour}`,
      `border:1px solid ${colour}`,
      "background:transparent",
      "max-width:180px",
      "overflow:hidden",
      "text-overflow:ellipsis",
    ].join(";");
    cell.appendChild(tag);
  }
  return cell;
};
