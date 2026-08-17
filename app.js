const categories = ["证件", "电子", "衣物", "日用", "药品", "学习", "其他"];
const themesStorageKey = "shopping-list-themes-v1";
let themes = loadThemes();
let activeThemeId = localStorage.getItem("active-shopping-theme") || themes[0]?.id || "";
if (!themes.some(theme => theme.id === activeThemeId)) activeThemeId = themes[0]?.id || "";
let items = activeTheme()?.items || [];
let activeCategory = "全部";
let hideBought = false;

const list = document.querySelector("#shoppingList");
const tabs = document.querySelector("#categoryTabs");
const dialog = document.querySelector("#itemDialog");
const form = document.querySelector("#itemForm");

function loadThemes() {
  const saved = localStorage.getItem(themesStorageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) { /* start with a blank page */ }
  }
  return [];
}

function activeTheme() { return themes.find(theme => theme.id === activeThemeId) || themes[0] || null; }
function saveItems() {
  const theme = activeTheme();
  if (theme) theme.items = items;
  localStorage.setItem(themesStorageKey, JSON.stringify(themes));
  if (activeThemeId) localStorage.setItem("active-shopping-theme", activeThemeId);
  else localStorage.removeItem("active-shopping-theme");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function renderTabs() {
  tabs.innerHTML = ["全部", ...categories].map(category =>
    `<button class="tab ${category === activeCategory ? "active" : ""}" data-category="${category}">${category}</button>`
  ).join("");
}

function renderThemes() {
  const theme = activeTheme();
  document.querySelector("#activeThemeName").textContent = theme?.name || "添加主题";
  document.querySelector("h1").textContent = theme ? (theme.name.endsWith("清单") ? theme.name : `${theme.name}清单`) : "还没有主题";
  document.querySelector("#themeMenu").innerHTML = themes.map(candidate => `
    <div class="theme-option" data-theme-id="${candidate.id}">
      <button class="theme-option-name ${candidate.id === activeThemeId ? "active" : ""}" data-theme-action="switch">${escapeHtml(candidate.name)}</button>
      <button class="theme-icon-action" data-theme-action="rename">改名</button>
      <button class="theme-icon-action delete" data-theme-action="delete">删除</button>
    </div>`).join("");
}

function visibleItems() {
  const query = document.querySelector("#searchInput").value.trim().toLowerCase();
  return items.filter(item =>
    (activeCategory === "全部" || item.category === activeCategory) &&
    (!hideBought || !item.bought) &&
    (!query || `${item.name} ${item.note} ${item.category}`.toLowerCase().includes(query))
  ).sort((a, b) => Number(a.bought) - Number(b.bought));
}

function render() {
  renderThemes();
  renderTabs();
  const hasTheme = Boolean(activeTheme());
  ["#smartImportButton", "#addButtonTop", "#floatingAddButton", ".progress-card", ".controls", "#categoryTabs"].forEach(selector => {
    document.querySelector(selector).hidden = !hasTheme;
  });
  const visible = visibleItems();
  list.innerHTML = visible.map(item => `
    <article class="item ${item.bought ? "bought" : ""}" data-id="${item.id}">
      <button class="check" data-action="toggle" aria-label="${item.bought ? "标记为未购买" : "标记为已购买"}">✓</button>
      <div><p class="item-name">${escapeHtml(item.name)}</p><p class="item-meta">${escapeHtml(item.category)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</p></div>
      <span class="quantity">× ${item.quantity}</span>
      <div class="item-actions"><button class="text-action" data-action="edit">编辑</button><button class="text-action delete" data-action="delete">删除</button></div>
    </article>`).join("");
  const emptyState = document.querySelector("#emptyState");
  emptyState.hidden = hasTheme && visible.length > 0;
  emptyState.querySelector("h2").textContent = hasTheme ? "这里已经收拾妥当" : "从一个主题开始";
  emptyState.querySelector("p").textContent = hasTheme ? "换个分类看看，或者添加一件新物品。" : "点击上方“＋ 主题”，建立你的第一张清单。";
  const bought = items.filter(item => item.bought).length;
  const percent = items.length ? Math.round(bought / items.length * 100) : 0;
  document.querySelector("#progressPercent").textContent = `${percent}%`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
  document.querySelector("#progressText").textContent = percent === 100 && items.length ? "准备完成" : "行前准备进度";
  document.querySelector("#progressDetail").textContent = items.length ? `已购买 ${bought} 件 · 还剩 ${items.length - bought} 件` : "还没有物品";
}

function openDialog(item) {
  form.reset();
  document.querySelector("#editingId").value = item?.id || "";
  document.querySelector("#dialogTitle").textContent = item ? "编辑物品" : "添加物品";
  document.querySelector("#itemName").value = item?.name || "";
  document.querySelector("#itemQuantity").value = item?.quantity || 1;
  document.querySelector("#itemCategory").value = item?.category || "日用";
  document.querySelector("#itemNote").value = item?.note || "";
  dialog.showModal();
  setTimeout(() => document.querySelector("#itemName").focus(), 80);
}

const importDialog = document.querySelector("#importDialog");
const importForm = document.querySelector("#importForm");
const importText = document.querySelector("#importText");
let pendingImportItems = [];

const categoryKeywords = {
  "证件": ["护照", "签证", "身份证", "驾照", "材料", "证件", "录取信", "i-20", "照片"],
  "电子": ["电脑", "手机", "平板", "充电", "插头", "转换", "耳机", "相机", "电池", "数据线", "硬盘"],
  "衣物": ["衣", "裤", "鞋", "袜", "帽", "外套", "内衣", "正装", "围巾"],
  "药品": ["药", "创可贴", "口罩", "体温计", "绷带", "维生素"],
  "学习": ["书", "笔", "文具", "本子", "计算器", "文件夹"],
  "日用": ["牙", "毛巾", "眼镜", "洗", "雨伞", "水杯", "床", "枕", "收纳", "行李箱"],
};

function guessCategory(name) {
  const text = name.toLowerCase();
  return Object.entries(categoryKeywords).find(([, words]) => words.some(word => text.includes(word)))?.[0] || "其他";
}

function parseImportText(rawText) {
  const result = [];
  let sectionCategory = "";
  rawText.split(/\r?\n/).forEach(rawLine => {
    let line = rawLine.trim();
    if (!line) return;
    const sectionName = line.replace(/[：:]$/, "").trim();
    if (categories.includes(sectionName) && /[：:]$/.test(line)) { sectionCategory = sectionName; return; }
    const bought = /^(?:☑|✅|✔|✓|\s*[-*•]?\s*\[[xX]\])/.test(line);
    line = line
      .replace(/^(?:☐|☑|□|✅|✔|✓|\s*[-*•]?\s*\[[ xX]\])\s*/, "")
      .replace(/^\s*(?:[-*•·]|\d+[.、)）])\s*/, "")
      .trim();
    let quantity = 1;
    const quantityMatch = line.match(/(?:[×xX*]\s*(\d+)|(\d+)\s*(?:个|件|套|盒|包|瓶|本|双|份|支|台|条|张))\s*$/);
    if (quantityMatch) {
      quantity = Number(quantityMatch[1] || quantityMatch[2]) || 1;
      line = line.slice(0, quantityMatch.index).trim();
    }
    if (!line) return;
    result.push({
      id: crypto.randomUUID?.() || `${Date.now()}-${result.length}`,
      name: line.slice(0, 40), quantity, category: sectionCategory || guessCategory(line), note: "", bought,
    });
  });
  return result;
}

function renderImportPreview() {
  pendingImportItems = parseImportText(importText.value);
  const preview = document.querySelector("#importPreview");
  document.querySelector("#confirmImportButton").disabled = pendingImportItems.length === 0;
  if (!pendingImportItems.length) {
    preview.textContent = importText.value.trim() ? "没有识别到可导入的物品，请尝试每行写一件。" : "粘贴内容后，这里会显示识别结果。";
    return;
  }
  preview.innerHTML = `<strong>识别到 ${pendingImportItems.length} 件物品</strong><div class="import-preview-list">${pendingImportItems.map(item => `
    <div class="import-preview-item"><span>${item.bought ? "✓ " : ""}${escapeHtml(item.name)}</span><span class="import-preview-meta">${escapeHtml(item.category)} · ×${item.quantity}</span></div>`).join("")}</div>`;
}

function openImportDialog() {
  importForm.reset();
  pendingImportItems = [];
  renderImportPreview();
  importDialog.showModal();
  setTimeout(() => importText.focus(), 80);
}

document.querySelector("#itemCategory").innerHTML = categories.map(category => `<option>${category}</option>`).join("");
document.querySelector("#dateLabel").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
document.querySelectorAll("#addButtonTop, #floatingAddButton").forEach(button => button.addEventListener("click", () => activeTheme() ? openDialog() : openThemeDialog()));
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#smartImportButton").addEventListener("click", openImportDialog);
document.querySelector("#closeImportDialog").addEventListener("click", () => importDialog.close());
importText.addEventListener("input", renderImportPreview);
importForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!pendingImportItems.length || !activeTheme()) return;
  items = [...pendingImportItems, ...items];
  saveItems();
  importDialog.close();
  render();
});
importDialog.addEventListener("click", event => { if (event.target === importDialog) importDialog.close(); });
document.querySelector("#searchInput").addEventListener("input", render);
document.querySelector("#hideBoughtButton").addEventListener("click", event => {
  hideBought = !hideBought;
  event.currentTarget.setAttribute("aria-pressed", String(hideBought));
  render();
});
tabs.addEventListener("click", event => {
  const category = event.target.dataset.category;
  if (category) { activeCategory = category; render(); }
});
list.addEventListener("click", event => {
  const action = event.target.dataset.action;
  const article = event.target.closest(".item");
  if (!action || !article) return;
  const item = items.find(candidate => candidate.id === article.dataset.id);
  if (action === "toggle") item.bought = !item.bought;
  if (action === "edit") return openDialog(item);
  if (action === "delete" && !confirm(`删除“${item.name}”？`)) return;
  if (action === "delete") items = items.filter(candidate => candidate.id !== item.id);
  saveItems(); render();
});
form.addEventListener("submit", event => {
  event.preventDefault();
  const id = document.querySelector("#editingId").value;
  const values = {
    name: document.querySelector("#itemName").value.trim(),
    quantity: Number(document.querySelector("#itemQuantity").value),
    category: document.querySelector("#itemCategory").value,
    note: document.querySelector("#itemNote").value.trim(),
  };
  if (!values.name) return;
  if (id) Object.assign(items.find(item => item.id === id), values);
  else items.unshift({ id: crypto.randomUUID?.() || String(Date.now()), ...values, bought: false });
  saveItems(); dialog.close(); render();
});
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
render();

const themeMenu = document.querySelector("#themeMenu");
const themeDialog = document.querySelector("#themeDialog");
const themeForm = document.querySelector("#themeForm");
document.querySelector("#themeMenuButton").addEventListener("click", event => {
  const willOpen = themeMenu.hidden;
  themeMenu.hidden = !willOpen;
  event.currentTarget.setAttribute("aria-expanded", String(willOpen));
});
document.querySelector("#addThemeButton").addEventListener("click", () => openThemeDialog());
document.querySelector("#closeThemeDialog").addEventListener("click", () => themeDialog.close());

function openThemeDialog(theme) {
  themeForm.reset();
  document.querySelector("#editingThemeId").value = theme?.id || "";
  document.querySelector("#themeDialogTitle").textContent = theme ? "主题改名" : "新建主题";
  document.querySelector("#themeNameInput").value = theme?.name || "";
  themeMenu.hidden = true;
  document.querySelector("#themeMenuButton").setAttribute("aria-expanded", "false");
  themeDialog.showModal();
  setTimeout(() => document.querySelector("#themeNameInput").focus(), 80);
}

themeMenu.addEventListener("click", event => {
  const action = event.target.dataset.themeAction;
  const row = event.target.closest("[data-theme-id]");
  if (!action || !row) return;
  const theme = themes.find(candidate => candidate.id === row.dataset.themeId);
  if (action === "switch") {
    activeThemeId = theme.id;
    items = theme.items;
    activeCategory = "全部";
    themeMenu.hidden = true;
    saveItems(); render();
  }
  if (action === "rename") openThemeDialog(theme);
  if (action === "delete") {
    if (!confirm(`删除主题“${theme.name}”及其中的所有物品？`)) return;
    themes = themes.filter(candidate => candidate.id !== theme.id);
    if (activeThemeId === theme.id) activeThemeId = themes[0]?.id || "";
    items = activeTheme()?.items || [];
    saveItems(); render();
  }
});

themeForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = document.querySelector("#themeNameInput").value.trim();
  const editingId = document.querySelector("#editingThemeId").value;
  if (!name) return;
  if (editingId) {
    themes.find(theme => theme.id === editingId).name = name;
  } else {
    const newTheme = { id: crypto.randomUUID?.() || `theme-${Date.now()}`, name, items: [] };
    themes.push(newTheme);
    activeThemeId = newTheme.id;
    items = newTheme.items;
    activeCategory = "全部";
  }
  saveItems(); themeDialog.close(); render();
});

document.addEventListener("click", event => {
  if (!event.target.closest(".theme-switcher")) {
    themeMenu.hidden = true;
    document.querySelector("#themeMenuButton").setAttribute("aria-expanded", "false");
  }
});
