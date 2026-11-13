"use strict";

const $ = (selector) => document.querySelector(selector);
const statuses = ["待确认", "未开始", "制作中", "待反馈", "修改中", "已完成", "已交付", "暂停", "已取消", "已归档"];
const projectStatuses = ["待确认", "制作中", "暂停", "已完成", "已归档"];
const kinds = {brand:"品牌设置", palette:"图例颜色", project:"项目", node:"排期节点", note:"工作记录", sku:"SKU 开工", asset:"资产开工", revision:"修改轮次"};
const STATUS_EN = {"待确认":"Pending", "未开始":"Not Started", "制作中":"In Progress", "待反馈":"Awaiting Feedback", "修改中":"Revising", "已完成":"Completed", "已交付":"Delivered", "暂停":"On Hold", "已取消":"Cancelled", "已归档":"Archived"};
const KINDS_EN = {brand:"Brand Settings", palette:"Legend Color", project:"Project", node:"Schedule Node", note:"Work Log", sku:"SKU Start", asset:"Asset Start", revision:"Revision Round"};
const NOTE_TYPE_EN = {"进展":"Progress", "反馈":"Feedback", "交付":"Delivery"};
const EN_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SERVER_ERR_EN = {
  "账号或密码错误":"Incorrect username or password",
  "已取消登录":"Sign-in cancelled",
  "无法完成请求":"Request failed",
  "请登录后再修改":"Please sign in before making changes",
  "请使用本机地址访问":"Localhost access required",
  "记录已有更新，请刷新后核对再保存。":"Record was updated elsewhere. Refresh and review before saving.",
  "记录已有更新，请刷新后核对。":"Record was updated elsewhere. Please refresh.",
  "项目已有更新，请刷新后重试。":"Project was updated elsewhere. Please refresh and try again.",
  "项目下的记录已有更新，请刷新后重试。":"Project records changed. Please refresh and try again.",
  "品牌设置已有更新，请刷新后核对再保存。":"Brand settings changed elsewhere. Refresh before saving.",
  "该品牌简称已存在，请使用其他简称":"That brand short code already exists",
  "请填写品牌简称":"Please enter a brand short code",
  "品牌名称超出长度限制":"Brand name exceeds maximum length",
  "品牌颜色格式无效":"Invalid brand color format",
  "未找到该品牌下的项目，请刷新后重试":"No projects found under this brand. Please refresh.",
  "当前类别下这个产品已有项目，请在现有项目中添加节点":"A project with this name already exists in this category",
  "请先建立所属项目":"Please create the parent project first",
  "请输入正确项目名称确认删除":"Enter the exact project name to confirm deletion",
  "批次不存在或已撤销":"Batch not found or already undone",
  "该批次已有后续编辑，请从详情中逐条修正。":"This batch has newer edits; update entries individually.",
  "该批次已有后续编辑，请逐条处理。":"This batch has newer edits; update entries individually.",
  "浏览器本地空间不足，请先导出数据备份或减少图片大小。":"Browser storage is full. Export a backup or use smaller images."
};
const DEFAULT_CATEGORY = "digital-twins";
const ALL_CATEGORY_LABEL = "1mageAI";
const categories = {
  "digital-twins": {
    label:"Digital Twins", short:"DT", deliveryLabel:"PSD", deliveryLabelEn:"PSD",
    deliveryName:"PSD 交付", deliveryNameEn:"PSD Delivery",
    assetFieldLabel:"计划交付资产数量", assetFieldLabelEn:"Planned Deliverable Assets",
    assetInlineLabel:"资产", assetInlineLabelEn:"Assets",
    assetScopeLabel:"交付资产", assetScopeLabelEn:"Assets",
    assetSheetHeader:"计划资产", assetSheetHeaderEn:"Planned Assets",
    assetUnit:"张", assetUnitEn:"assets",
    startEntryLabel:"资产开工", startEntryLabelEn:"Asset Start",
    quantityFieldLabel:"图片 / 资产数量", quantityFieldLabelEn:"Image / Asset Qty",
    hasSku:true
  },
  "ai-image": {
    label:"AI Assets", short:"AI Assets", deliveryLabel:"终稿", deliveryLabelEn:"Final",
    deliveryName:"终稿交付", deliveryNameEn:"Final Delivery",
    assetFieldLabel:"计划交付张数", assetFieldLabelEn:"Planned Image Count",
    assetInlineLabel:"计划", assetInlineLabelEn:"Planned",
    assetScopeLabel:"计划张数", assetScopeLabelEn:"Planned",
    assetSheetHeader:"计划张数", assetSheetHeaderEn:"Planned Images",
    assetUnit:"张", assetUnitEn:"imgs",
    startEntryLabel:"AI Assets 开工", startEntryLabelEn:"AI Assets Start",
    quantityFieldLabel:"AI Assets 张数", quantityFieldLabelEn:"AI Assets Count",
    hasSku:false
  },
  "video": {
    label:"CGI Videos", short:"CGI Videos", deliveryLabel:"成片", deliveryLabelEn:"Master",
    deliveryName:"成片交付", deliveryNameEn:"Master Delivery",
    assetFieldLabel:"计划交付条数", assetFieldLabelEn:"Planned Video Count",
    assetInlineLabel:"计划", assetInlineLabelEn:"Planned",
    assetScopeLabel:"计划条数", assetScopeLabelEn:"Planned",
    assetSheetHeader:"计划条数", assetSheetHeaderEn:"Planned Videos",
    assetUnit:"条", assetUnitEn:"clips",
    startEntryLabel:"CGI Videos 开工", startEntryLabelEn:"CGI Videos Start",
    quantityFieldLabel:"CGI Videos 条数", quantityFieldLabelEn:"CGI Videos Count",
    hasSku:false
  }
};
const categoryOptions = Object.entries(categories).map(([key, meta]) => [key, meta.label]);
const savedRange = localStorage.getItem("taf-timeline-range-v2");
const savedCategory = localStorage.getItem("taf-project-category-v1");
const savedLang = localStorage.getItem("taf-ui-lang-v1");
const initialCategory = savedCategory === "" ? "" : (categories[savedCategory] ? savedCategory : DEFAULT_CATEGORY);
const view = {
  lang:savedLang === "en" ? "en" : "zh",
  mobileRailOpen:false,
  category:initialCategory, project:"", brand:"", tab:"timeline", scale:"day",
  range:savedRange === "surrounding" ? "surrounding" : "month", zone:"Asia/Shanghai", month:"", status:"",
  folded:new Set(), collapsedBrands:new Set()
};
const isEn = () => view.lang === "en";
const tr = (zh, en) => isEn() ? en : zh;
const tStatus = (value) => isEn() ? (STATUS_EN[value] || value) : value;
const kindLabel = (key) => isEn() ? (KINDS_EN[key] || key) : kinds[key];
const tNoteType = (value) => isEn() ? (NOTE_TYPE_EN[value] || value) : value;
const tError = (msg) => isEn() ? (SERVER_ERR_EN[msg] || msg) : msg;
const allCategoryLabel = () => ALL_CATEGORY_LABEL;
const projectCategory = (project) => categories[project?.category] ? project.category : DEFAULT_CATEGORY;
const categoryMeta = (categoryOrProject) => {
  const key = typeof categoryOrProject === "string" ? categoryOrProject : projectCategory(categoryOrProject);
  const raw = categories[key] || categories[DEFAULT_CATEGORY];
  if (!isEn()) return raw;
  return {
    ...raw,
    deliveryLabel:raw.deliveryLabelEn,
    deliveryName:raw.deliveryNameEn,
    assetFieldLabel:raw.assetFieldLabelEn,
    assetInlineLabel:raw.assetInlineLabelEn,
    assetScopeLabel:raw.assetScopeLabelEn,
    assetSheetHeader:raw.assetSheetHeaderEn,
    assetUnit:raw.assetUnitEn,
    startEntryLabel:raw.startEntryLabelEn,
    quantityFieldLabel:raw.quantityFieldLabelEn,
  };
};
const deliveryLabelFor = (categoryOrProject) => categoryMeta(categoryOrProject).deliveryLabel;
const deliveryNameFor = (categoryOrProject) => categoryMeta(categoryOrProject).deliveryName;
const isDeliveryLabel = (label) => ["PSD", "终稿", "成片", "Final", "Master"].includes(label);
const isAutoDeliveryName = (name) => /^(?:PSD(?:\s*(?:交付|Delivery))?|终稿(?:\s*交付)?|Final(?:\s*Delivery)?|成片(?:\s*交付)?|Master(?:\s*Delivery)?)$/i.test(name || "");
const day = 86400000;
let data = {entries:[], batches:[], today:""};
let drawerSequence = 0;
let editorAuth = null;
let loginPending = null;
let allowAnonymousEdits = false;
const escape = (value = "") => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const find = (id) => data.entries.find((entry) => entry.id === id);
const projects = () => data.entries.filter((entry) => entry.kind === "project");
const matchesCategory = (project) => !view.category || projectCategory(project) === view.category;
const categoryProjects = () => projects().filter(matchesCategory);
const defaultBrandColors = {SDJ:"#315fcd",ITC:"#7754cb",SUAVE:"#248f70",APA:"#1684aa"};
const fallbackBrandColors = ["#315fcd","#7754cb","#248f70","#1684aa","#b7526f","#a66b26"];
const COLOR_PRESETS = ["#315fcd","#7754cb","#1684aa","#248f70","#ffbb00","#ff7a00","#e13b83","#d94841"];
const defaultBrandColor = (brand) => defaultBrandColors[brand] || fallbackBrandColors[[...brand].reduce((sum,char)=>sum+char.charCodeAt(0),0)%fallbackBrandColors.length];
const brandSetting = (brand) => data.entries.find((entry)=>entry.kind==="brand" && entry.brand===brand);
const brandShort = (brand) => (brandSetting(brand)?.brand || brand || "").trim();
const brandFull = (brand) => (brandSetting(brand)?.fullName || "").trim() || brandShort(brand);
const brandDisplay = (brand, mode = "short") => {
  const short = brandShort(brand);
  const full = brandFull(brand);
  if (mode === "full") return full;
  if (mode === "both") return full && full !== short ? (isEn() ? `${full} (${short})` : `${full}（${short}）`) : short;
  return short;
};
const resolveBrandInput = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  const folded = trimmed.toLowerCase();
  for (const b of [...new Set(projects().map((p) => p.brand))]) {
    if (b.toLowerCase() === folded || brandFull(b).toLowerCase() === folded) return b;
  }
  return trimmed;
};
const brandDatalistOptions = () => [...new Set(projects().map((project) => project.brand))]
  .map((brand) => {
    const full = brandFull(brand);
    return '<option value="' + escape(brand) + '">' + (full !== brand ? escape(full) : '') + '</option>';
  }).join("");
const brandColor = (brand) => brandSetting(brand)?.color || defaultBrandColor(brand);
const paletteSlots = {
  psd:{name:"PSD",nameEn:"PSD",color:"#ffb454"},
  work:{name:"内部节点",nameEn:"Internal Nodes",color:"#3b8478"},
  client:{name:"客户节点",nameEn:"Client Nodes",color:"#e13b83"},
  today:{name:"今天",nameEn:"Today Line",color:"#3c7bff"}
};
const paletteSlotName = (slot) => isEn() ? paletteSlots[slot].nameEn : paletteSlots[slot].name;
const paletteSetting = (slot) => data.entries.find((entry)=>entry.kind==="palette" && entry.type===slot);
const paletteColor = (slot) => paletteSetting(slot)?.color || paletteSlots[slot].color;
const mixWhite = (color, amount) => "#" + [1,3,5].map((offset) => Math.round(parseInt(color.slice(offset,offset+2),16)*(1-amount)+255*amount).toString(16).padStart(2,"0")).join("");
const roundTint = (number) => .86*(1-Math.exp(-(number-1)*.36));
const matchesProjectStatus = (project) => view.tab !== "timeline" || !view.status ||
  (project.status || "待确认") === view.status;
const visibleProjects = () => categoryProjects().filter((p) =>
  (view.project ? p.id === view.project : (p.status !== "已归档" || (view.tab === "timeline" && view.status === "已归档")) &&
    (!view.brand || p.brand === view.brand)) && matchesProjectStatus(p));
const scoped = () => {
  const ids = new Set(visibleProjects().map((p) => p.id));
  return data.entries.filter((entry) => entry.kind !== "project" && ids.has(entry.project));
};
const iso = (time) => new Date(time).toISOString().slice(0,10);
const stamp = (date) => Date.parse(date + "T00:00:00Z");
const currentGuangzhouDate = (offset = 0) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map((part)=>[part.type,part.value]));
  return iso(stamp(parts.year + "-" + parts.month + "-" + parts.day) + offset*day);
};
const r1LeadDays = (project) => Number.isInteger(project?.r1LeadDays) ? project.r1LeadDays : 3;
const roundGapDays = (project) => Number.isInteger(project?.roundGapDays) ? project.roundGapDays : 3;
function workdaysBefore(date, count) {
  let time = stamp(date);
  for (let left=count; left>0;) {
    time -= day;
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return iso(time);
}
function workdaysAfter(date, count) {
  let time = stamp(date);
  for (let left=count; left>0;) {
    time += day;
    const weekday = new Date(time).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return iso(time);
}
const monthRange = () => {
  const start = stamp(view.month + "-01");
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth()+1);
  return [start, +next];
};
const timelineRange = () => {
  if (view.range === "month") return monthRange();
  const [monthStart] = monthRange();
  const start = new Date(monthStart);
  start.setUTCMonth(start.getUTCMonth()-1);
  const end = new Date(monthStart);
  end.setUTCMonth(end.getUTCMonth()+2);
  return [+start,+end];
};
const inMonth = (date) => Boolean(date && date.slice(0,7) === view.month);
const selected = (a,b) => a === b ? " selected" : "";
const displayEntryName = (entry, project = find(entry?.project)) => {
  const raw = entry?.name || "";
  if (!isEn()) return raw;
  if (isAutoDeliveryName(raw)) return deliveryNameFor(project);
  const clientMatch = raw.match(/^(R\d+|PSD|终稿|成片|Final|Master)\s*(?:客户反馈|Client Feedback)$/i);
  if (clientMatch) {
    const head = clientMatch[1] === "终稿" ? "Final" : clientMatch[1] === "成片" ? "Master" : clientMatch[1].toUpperCase();
    return head + " Client Feedback";
  }
  const workMatch = raw.match(/^(R\d+[.．]\d+)\s*(?:内部反馈|Internal(?: Feedback)?)$/i);
  if (workMatch) return workMatch[1].replace("．", ".").toUpperCase() + " Internal";
  return raw;
};
const openButton = (entry, name = displayEntryName(entry)) => '<button type="button" data-open="' + escape(entry.id) + '" title="' + escape(name) + '">' + escape(name) + '</button>';
const projectThumb = (project) => project.image ? '<img class="project-thumb" src="' + escape(project.image) + '" alt="" loading="lazy">' : '';
const projectQuantity = (value) => Number.isInteger(value) && value > 0 ? String(value) : tr("待填", "TBD");
const projectStatus = (project) => project.status || "待确认";
const projectStatusLabel = (project) => tStatus(projectStatus(project));
const sheetDateFormat = new Intl.DateTimeFormat("en-US",{timeZone:"UTC",weekday:"short",month:"short",day:"2-digit"});
const sheetFallbackColors = ["#DDE9F6","#E9DFF4","#D8EDE5","#F7E3CF","#F7DFE7","#E2E8F0","#F4E8C7","#DCEBEF","#E7E9D8","#E7DEFA","#F4DDD0","#DDE7D5","#EFDCE5","#DADFEB","#F1E5D5","#DBE9E8"];
const sheetDateLabel = (date,time) => sheetDateFormat.format(new Date(stamp(date))) + (time ? " " + time : "");
const sourceStyleFor = (entry) => {
  const source = entry?.source || "";
  const gid = source.match(/[?&#]gid=(\d+)/)?.[1];
  const row = source.match(/[?&#]range=[A-Z]+(\d+)/i)?.[1];
  return gid && row ? data.sourceStyles?.[gid + ":" + row] : null;
};
const sheetProjectColors = () => {
  const colors = new Map();
  const used = new Set();
  const sourceColors = new Map();
  for (const entry of data.entries.filter((item) => item.kind === "node")) {
    const color = sourceStyleFor(entry)?.E?.background;
    if (!/^#[0-9a-f]{6}$/i.test(color || "")) continue;
    if (!sourceColors.has(entry.project)) sourceColors.set(entry.project,new Map());
    const counts = sourceColors.get(entry.project);
    counts.set(color,(counts.get(color) || 0) + 1);
  }
  for (const project of projects().slice().sort((a,b) => a.id.localeCompare(b.id))) {
    const sources = sourceColors.get(project.id);
    let color = sources ? [...sources].sort((a,b) => b[1]-a[1])[0][0] : "";
    if (!color && /^#[0-9a-f]{6}$/i.test(project.type || "")) color = project.type;
    if (!color) {
      const hash = [...project.id].reduce((value,char) => (Math.imul(value,31) + char.codePointAt(0)) >>> 0,0);
      for (let offset = 0; offset < sheetFallbackColors.length; offset++) {
        const candidate = sheetFallbackColors[(hash + offset) % sheetFallbackColors.length];
        if (!used.has(candidate.toLowerCase())) { color = candidate; break; }
      }
      color ||= sheetFallbackColors[hash % sheetFallbackColors.length];
    }
    colors.set(project.id,color);
    used.add(color.toLowerCase());
  }
  return colors;
};
const projectCountSummary = (project) => {
  const meta = categoryMeta(project);
  if (meta.hasSku) return "SKU " + projectQuantity(project.skuQuantity) + " · " + meta.assetInlineLabel + " " + projectQuantity(project.assetQuantity);
  const count = Number.isInteger(project.assetQuantity) && project.assetQuantity > 0 ? project.assetQuantity + " " + meta.assetUnit : tr("待填", "TBD");
  return meta.assetInlineLabel + " " + count;
};
const projectInfo = (project) => '<span class="project-info"><span class="project-title">' + escape(project.name) +
  '</span><small class="project-counts">' + (!view.category ? '<span class="category-tag">' + escape(categoryMeta(project).short) + '</span> · ' : '') +
  '<span class="project-status">' + escape(projectStatusLabel(project)) + '</span> · ' + escape(projectCountSummary(project)) + '</small></span>';

const basicToken = (username,password) => btoa(Array.from(new TextEncoder().encode(username + ":" + password),
  (byte) => String.fromCharCode(byte)).join(""));

function updateAuth() {
  const button = $("#auth-status");
  button.hidden = !editorAuth && !allowAnonymousEdits;
  button.textContent = editorAuth ? editorAuth.username + tr(" · 退出编辑", " · Sign Out") : tr("账号登录（可选）", "Sign In (Optional)");
}

function ensureAuth(force = false) {
  if (editorAuth) return Promise.resolve(true);
  if (allowAnonymousEdits && !force) return Promise.resolve(true);
  if (loginPending) return loginPending;
  loginPending = new Promise((resolve) => {
    const dialog = $("#login-dialog");
    const form = $("#login-form");
    const errorBox = $("#login-error");
    const submit = form.querySelector('[type="submit"]');
    dialog.querySelector(".hint").textContent = allowAnonymousEdits ?
      tr("登录后修改会记录你的账号；也可以关闭弹窗，继续免登录调试。", "Sign in to record edits under your account, or close to continue anonymously.") :
      tr("查看排期无需登录。修改内容时请使用你的团队账号。", "Viewing requires no sign-in. Sign in with your team account to edit.");
    form.reset();
    errorBox.hidden = true;
    const finish = (accepted) => {
      if (dialog.open) dialog.close();
      loginPending = null;
      resolve(accepted);
    };
    dialog.oncancel = (event) => { event.preventDefault(); finish(false); };
    $("#cancel-login").onclick = () => finish(false);
    form.onsubmit = async (event) => {
      event.preventDefault();
      submit.disabled = true;
      errorBox.hidden = true;
      const username = form.elements.namedItem("username").value.trim();
      const password = form.elements.namedItem("password").value;
      try {
        const token = basicToken(username,password);
        const response = await fetch("/api/login", {method:"POST",credentials:"omit",
          headers:{Authorization:"Basic " + token}});
        if (!response.ok) throw new Error(tr("账号或密码错误", "Incorrect username or password"));
        const result = await response.json();
        if (!dialog.open) return;
        editorAuth = {username:result.username,token};
        updateAuth();
        finish(true);
      } catch (error) {
        if (!dialog.open) return;
        errorBox.textContent = tError(error.message);
        errorBox.hidden = false;
      } finally {
        submit.disabled = false;
      }
    };
    dialog.showModal();
    form.elements.namedItem("username").focus();
  });
  return loginPending;
}

async function withEditor(action) {
  if (await ensureAuth()) action();
}

async function api(path, payload, retry = true) {
  if (payload !== undefined && !await ensureAuth()) throw new Error(tr("已取消登录", "Sign-in cancelled"));
  const headers = {"Content-Type":"application/json"};
  if (editorAuth) headers.Authorization = "Basic " + editorAuth.token;
  const response = await fetch("/api/" + path, payload === undefined ? {} : {
    method:"POST",credentials:"omit",headers,body:JSON.stringify(payload)
  });
  if (response.status === 401 && payload !== undefined && retry) {
    editorAuth = null;
    updateAuth();
    return api(path,payload,false);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(tError(result.error || "无法完成请求"));
  return result;
}

function notify(message, error = false) {
  const box = $("#notice");
  box.textContent = message;
  box.hidden = !message;
  box.classList.toggle("error", error);
}

async function refresh() {
  data = await api("state");
  allowAnonymousEdits = data.allowAnonymousEdits === true;
  updateAuth();
  if (!view.month) view.month = data.today.slice(0,7);
  if (view.project && (!find(view.project) || !matchesCategory(find(view.project)))) view.project = "";
  if (view.brand && !categoryProjects().some((p) => p.brand === view.brand && p.status !== "已归档")) view.brand = "";
  render();
}

function setCategoryMenuOpen(open) {
  const menu = $("#category-menu");
  const trigger = $("#category-trigger");
  const next = typeof open === "boolean" ? open : !menu.classList.contains?.("open");
  menu.classList.toggle("open", next);
  trigger.setAttribute("aria-expanded", String(next));
}

function setMobileRailOpen(open) {
  const next = typeof open === "boolean" ? open : !view.mobileRailOpen;
  view.mobileRailOpen = next;
  $("#rail")?.classList.toggle("rail-open", next);
  document.body?.classList?.toggle("rail-drawer-open", next);
  const backdrop = $("#rail-backdrop");
  if (backdrop) backdrop.hidden = !next;
  $("#mobile-projects-btn")?.setAttribute("aria-expanded", String(next));
}

function setLang(lang) {
  view.lang = lang === "en" ? "en" : "zh";
  localStorage.setItem("taf-ui-lang-v1", view.lang);
  notify("");
  render();
}

function renderStaticI18n() {
  if (document.documentElement) document.documentElement.lang = isEn() ? "en" : "zh-CN";
  const langLabel = isEn() ? "中文" : "EN";
  const langAria = isEn() ? "切换到中文界面" : "Switch interface to English";
  for (const btn of [$("#lang-toggle"), $("#mobile-lang-toggle"), ...document.querySelectorAll("[data-lang-toggle]")]) {
    if (!btn) continue;
    btn.textContent = langLabel;
    btn.setAttribute("aria-label", langAria);
    btn.title = langAria;
  }
  $("#category-trigger")?.setAttribute("aria-label", tr("切换排期看板", "Switch schedule board"));
  $("#category-menu")?.setAttribute("aria-label", tr("排期类别", "Schedule categories"));
  const allCat = $("#all-category-option");
  if (allCat) allCat.textContent = allCategoryLabel();
  const railLabel = $("#rail-projects-label");
  if (railLabel) railLabel.textContent = tr("项目", "Projects");
  const drawerTitle = $("#rail-drawer-title");
  if (drawerTitle) drawerTitle.textContent = tr("项目列表", "Projects");
  $("#close-rail-drawer")?.setAttribute("aria-label", tr("关闭", "Close"));
  $("#add-project").textContent = tr("新建项目", "New Project");
  const addMobile = $("#add-project-mobile");
  if (addMobile) addMobile.textContent = tr("+ 新建项目", "+ New Project");
  $("#projects")?.setAttribute("aria-label", tr("项目列表", "Project list"));
  $("#import-open").textContent = tr("导入记录", "Import JSON");
  $("#edit-brand").textContent = tr("品牌设置", "Brand Settings");
  $("#edit-project").textContent = tr("编辑项目", "Edit Project");
  $("#add-project-main").textContent = tr("新建项目", "New Project");
  $("#view-tabs")?.setAttribute("aria-label", tr("工作区视图", "Workspace views"));
  for (const btn of document.querySelectorAll("[data-view]")) {
    const key = btn.dataset.view;
    btn.textContent = key === "timeline" ? tr("排期", "Timeline") : key === "sheet" ? tr("表单", "Sheet") : tr("统计", "Stats");
  }
  $("#view-toolbar")?.setAttribute("aria-label", tr("视图筛选", "View filters"));
  $("#prev")?.setAttribute("aria-label", tr("上个月", "Previous month"));
  $("#month")?.setAttribute("aria-label", tr("查看月份", "Select month"));
  $("#next")?.setAttribute("aria-label", tr("下个月", "Next month"));
  $("#today").textContent = tr("今天", "Today");
  const statusSelect = $("#status-filter");
  if (statusSelect && statusSelect.dataset.lang !== view.lang) {
    statusSelect.innerHTML = '<option value="">' + escape(tr("项目状态", "All Statuses")) + '</option>' +
      projectStatuses.map((s) => '<option value="' + escape(s) + '">' + escape(tStatus(s)) + '</option>').join("");
    statusSelect.dataset.lang = view.lang;
  }
  statusSelect?.setAttribute("aria-label", tr("按项目状态筛选", "Filter by project status"));
  const rangeLabel = $("#range-label");
  if (rangeLabel) rangeLabel.textContent = tr("范围", "Span");
  $("#range-switch")?.setAttribute("aria-label", tr("甘特图时间范围", "Timeline span"));
  for (const btn of document.querySelectorAll("[data-range]")) {
    const monthOnly = btn.dataset.range === "month";
    btn.textContent = monthOnly ? tr("本月", "Month") : tr("前后月", "3 Months");
    btn.title = monthOnly ? tr("只显示选中月份", "Show selected month only") : tr("显示上月、当月和下月", "Show previous, current, and next month");
  }
  $("#timezone-switch")?.setAttribute("aria-label", tr("排期显示时区", "Display timezone"));
  for (const btn of document.querySelectorAll("[data-zone]")) {
    btn.textContent = btn.dataset.zone === "Asia/Shanghai" ? tr("广州", "Guangzhou") : tr("纽约", "New York");
  }
  $("#scale-switch")?.setAttribute("aria-label", tr("时间尺度", "Time scale"));
  for (const btn of document.querySelectorAll("[data-scale]")) {
    const s = btn.dataset.scale;
    btn.textContent = s === "day" ? tr("日", "Day") : s === "week" ? tr("周", "Week") : tr("月", "Month");
  }
  $("#content")?.setAttribute("aria-label", tr("工作区内容", "Workspace content"));
  $("#drawer-save").textContent = tr("保存", "Save");
  $("#close-drawer").textContent = tr("关闭", "Close");
  const loginTitle = $("#login-title");
  if (loginTitle) loginTitle.textContent = tr("登录后编辑", "Sign In to Edit");
  const loginHint = $("#login-hint");
  if (loginHint) loginHint.textContent = tr("查看排期无需登录。修改内容时请使用你的团队账号。", "Viewing requires no sign-in. Sign in with your team account to edit.");
  const loginUser = $("#login-user-label");
  if (loginUser) loginUser.textContent = tr("账号", "Username");
  const loginPass = $("#login-pass-label");
  if (loginPass) loginPass.textContent = tr("密码", "Password");
  $("#cancel-login").textContent = tr("取消", "Cancel");
  const loginSubmit = $("#login-submit");
  if (loginSubmit) loginSubmit.textContent = tr("登录并继续", "Sign In");
  for (const banner of document.querySelectorAll("[data-preview-banner]")) {
    banner.textContent = tr(
      "当前案例快照 · 编辑保存在当前浏览器，不会同步给其他人。请定期使用“导出本机数据”备份。",
      "Local Preview Snapshot · Edits stay in this browser only and are not synced. Use \"Export Local Data\" regularly to back up."
    );
  }
  for (const btn of document.querySelectorAll("[data-preview-export]")) {
    btn.textContent = tr("导出本机数据", "Export Local Data");
    btn.title = tr("保存当前浏览器中的项目与记录", "Download projects and logs stored in this browser");
  }
}

function render() {
  renderStaticI18n();
  updateAuth();
  const project = find(view.project);
  if (view.tab === "notes") view.tab = "timeline";
  const currentBrand = project?.brand || view.brand;
  const projectScope = (item) => {
    const meta = categoryMeta(item);
    const qty = Number.isInteger(item.assetQuantity) && item.assetQuantity > 0 ?
      (meta.hasSku ? String(item.assetQuantity) : item.assetQuantity + " " + meta.assetUnit) : tr("待填", "TBD");
    return [meta.label, brandDisplay(item.brand, "full"), projectStatusLabel(item),
      ...(meta.hasSku ? [`SKU ${projectQuantity(item.skuQuantity)}`] : []),
      `${meta.assetScopeLabel} ${qty}`].join(" · ");
  };
  const currentCategoryTitle = view.category ? categoryMeta(view.category).label : allCategoryLabel();
  document.title = view.category ? currentCategoryTitle + " · 1mageAI" : currentCategoryTitle;
  $("#scope").textContent = project ? projectScope(project) :
    (view.brand && brandFull(view.brand) !== brandShort(view.brand) ? currentCategoryTitle + " · " + brandShort(view.brand) : currentCategoryTitle);
  $("#heading").textContent = view.tab === "stats" ?
    (currentBrand ? brandDisplay(currentBrand, "full") + tr(" · 品牌统计", " · Brand Stats") : tr("全部品牌统计", "All Brands · Stats")) :
    project?.name || (view.brand ? brandDisplay(view.brand, "full") + tr(" · 项目", " · Projects") : tr("全部项目", "All Projects"));
  $("#edit-brand").hidden = !(!project && view.brand);
  $("#edit-project").hidden = !project;
  $("#month").value = view.month;
  $("#status-filter").value = view.status;
  $("#timeline-controls").hidden = view.tab !== "timeline";
  $("#add-entry").hidden = view.tab !== "stats";
  $("#add-entry").textContent = view.tab === "stats" ? tr("录入统计明细", "Add Stat Entry") : "";
  $("#category-current").textContent = currentCategoryTitle;
  const activeAllProjects = projects().filter((p) => p.status !== "已归档");
  for (const badge of document.querySelectorAll("[data-category-count]")) {
    const key = badge.dataset.categoryCount;
    badge.textContent = String(key ? activeAllProjects.filter((p) => projectCategory(p) === key).length : activeAllProjects.length);
  }
  for (const button of document.querySelectorAll("[data-category]")) {
    button.setAttribute("aria-selected", String(button.dataset.category === view.category));
  }
  for (const button of document.querySelectorAll("[data-view]")) {
    if (button.dataset.view === view.tab) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  }
  for (const button of document.querySelectorAll("[data-scale]")) {
    button.setAttribute("aria-pressed", String(button.dataset.scale === view.scale));
  }
  for (const button of document.querySelectorAll("[data-range]")) {
    button.setAttribute("aria-pressed", String(button.dataset.range === view.range));
  }
  for (const button of document.querySelectorAll("[data-zone]")) {
    button.setAttribute("aria-pressed", String(button.dataset.zone === view.zone));
  }
  const filteredCategoryProjects = categoryProjects().filter((p) =>
    (p.status !== "已归档" || p.id === view.project || (view.tab === "timeline" && view.status === "已归档")) &&
    matchesProjectStatus(p));
  const mobileLabel = $("#mobile-projects-label");
  if (mobileLabel) mobileLabel.textContent = project ? brandShort(project.brand) : (view.brand ? brandShort(view.brand) : tr("项目", "Projects"));
  const mobileCount = $("#mobile-projects-count");
  if (mobileCount) mobileCount.textContent = String(filteredCategoryProjects.length);
  const group = new Map();
  for (const item of filteredCategoryProjects) {
    if (!group.has(item.brand)) group.set(item.brand, []);
    group.get(item.brand).push(item);
  }
  const projectButton = (item) => '<button class="project-link" data-project="' + escape(item.id) + '" aria-current="' +
    (item.id === view.project) + '" title="' + escape(item.name) + '">' + projectThumb(item) + projectInfo(item) + '</button>';
  const projectScroll = $("#projects").scrollTop;
  $("#projects").innerHTML = '<button class="all-projects" data-project="" aria-current="' +
    (!view.project && !view.brand) + '">' + escape(tr("全部项目", "All Projects")) + '</button>' + [...group].map(([brand, items], index) => {
    const collapsed = view.collapsedBrands.has(brand);
    const id = "brand-projects-" + index;
    const shortLabel = brandShort(brand);
    const fullHint = brandDisplay(brand, "both");
    const swatchColor = brandColor(brand);
    const editBrandAria = isEn() ? ("Edit brand name & color (" + fullHint + ")") : ("设置 " + fullHint + " 品牌名称与颜色");
    const editBrandTitle = isEn() ? ("Edit brand name & color (" + fullHint + ")") : ("编辑品牌名称与颜色（" + fullHint + "）");
    const toggleAria = isEn() ? ((collapsed ? "Expand " : "Collapse ") + shortLabel + " projects") : ((collapsed ? "展开 " : "收起 ") + shortLabel + " 项目");
    return '<div class="brand-group"><div class="brand-header"><button class="brand-button" data-brand="' + escape(brand) + '" aria-current="' +
      (!view.project && view.brand === brand) + '"' + (fullHint !== shortLabel ? ' title="' + escape(fullHint) + '"' : '') + '><span>' + escape(shortLabel) + '</span><small>' + items.length +
      '</small></button><button type="button" class="brand-color-edit" data-brand-color="' + escape(brand) +
      '" aria-label="' + escape(editBrandAria) + '" title="' + escape(editBrandTitle) + '" style="--brand-color:' + swatchColor + ';--brand-ink:' + colorInk(swatchColor) +
      '"><span aria-hidden="true"></span></button><button type="button" class="brand-toggle" data-toggle-brand="' + escape(brand) +
      '" aria-label="' + escape(toggleAria) + '" aria-controls="' + id +
      '" aria-expanded="' + !collapsed + '"><span aria-hidden="true">▾</span></button></div><div class="project-children" id="' +
      id + '"' + (collapsed ? ' hidden' : '') + '>' + items.map(projectButton).join("") + '</div></div>';
  }).join("");
  $("#projects").scrollTop = projectScroll;
  updateProjectScrollHint();
  const chart = $(".chart");
  const refocusChart = !chart || chart.dataset.anchorMonth !== view.month || chart.dataset.scale !== view.scale ||
    chart.dataset.range !== view.range;
  const scroll = chart ? [chart.scrollLeft, chart.scrollTop] : [0,0];
  $("#content").innerHTML = {timeline, sheet:sheetView, notes, stats}[view.tab]();
  for (const slot of ["work","client","today"]) $("#content").style.setProperty("--" + slot + "-color",paletteColor(slot));
  $("#content").setAttribute("aria-busy","false");
  const nextChart = $(".chart");
  if (nextChart && refocusChart) {
    const anchor = nextChart.querySelector('.chart-fill .tick[data-date="' + view.month + '-01"]');
    const x = anchor ? anchor.getBoundingClientRect().left - nextChart.getBoundingClientRect().left : 0;
    nextChart.scrollTo(Math.max(0,x - nextChart.clientWidth/2),scroll[1]);
  } else nextChart?.scrollTo(...scroll);
}

function updateProjectScrollHint() {
  const list = $("#projects");
  list.classList.toggle("has-more",list.scrollTop + list.clientHeight < list.scrollHeight - 3);
}

function chartCells(start, end) {
  const cells = [];
  const count = Math.round((end-start)/day);
  for (let i=0; i<count; i++) {
    const time = start + i*day;
    const current = new Date(time);
    const weekday = current.getUTCDay();
    const date = current.getUTCDate();
    const month = current.getUTCMonth()+1;
    let label = "", span = 1;
    if (view.scale === "day") label = isEn() ? (date === 1 ? EN_MONTHS_SHORT[month - 1] + " 1" : String(date)) : (date === 1 ? month + "月1日" : date + "日");
    else if (view.scale === "week" && (i === 0 || weekday === 1)) {
      span = Math.min(count-i,weekday === 1 ? 7 : (8-weekday)%7);
      const last = new Date(time+(span-1)*day);
      label = month + "/" + date + "–" + (last.getUTCMonth()+1) + "/" + last.getUTCDate();
    } else if (view.scale === "month" && (i === 0 || date === 1)) {
      const next = new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,1));
      span = Math.min(count-i,Math.round((+next-time)/day));
      label = isEn() ? (EN_MONTHS_SHORT[month - 1] + " " + current.getUTCFullYear()) : (current.getUTCFullYear() + "年" + month + "月");
    }
    cells.push({column:i+1, date:iso(time), weekend:weekday===0 || weekday===6,
      label,span});
  }
  return cells;
}

function nodeType(entry) {
  if (entry.type) return /^(?:R[1-9]\d?|client|client-delivery|delivery|work|other)$/.test(entry.type) ? entry.type : "other";
  const delivery = /^(?:(?:客户|分层|client)\s*)?(?:PSD\b|终稿|成片|Final\b|Master\b)/i.test(entry.name);
  if (/客户|client|feedback|greenlight/i.test(entry.name)) return delivery ? "client-delivery" : "client";
  return entry.name.match(/^(R[1-9]\d?)(?:\s*[:：]|$)/i)?.[1].toUpperCase() ||
    (delivery ? "delivery" : "other");
}
const isClient = (entry) => ["client","client-delivery"].includes(nodeType(entry));
const roundNumber = (type) => Number(type.match(/^R([1-9]\d?)$/)?.[1] || 0);
const phaseColor = (label,brand) => {
  if (isDeliveryLabel(label)) return paletteColor("psd");
  const number = roundNumber(label);
  return number ? mixWhite(brandColor(brand || "SDJ"),roundTint(number)) : "";
};
const colorInk = (color) => {
  if (!color) return "#ffffff";
  const channels = [1,3,5].map((offset)=>parseInt(color.slice(offset,offset+2),16)/255)
    .map((value)=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.34 ? "#202020" : "#ffffff";
};
const phaseInk = (label,brand) => colorInk(phaseColor(label,brand));
const phaseDate = (entry) => entry.date || (isClient(entry) ? "" :
  nodeType(entry) === "delivery" ? entry.end : entry.start) || "";
function timelineMoment(entry) {
  const date = phaseDate(entry);
  if (!date) return {date:"",time:""};
  if (view.zone === "Asia/Shanghai") return {date,time:entry.time || ""};
  if (!entry.time) return {date:iso(stamp(date)-day),time:""};
  const instant = new Date(date + "T" + entry.time + ":00+08:00");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(instant).map((part) => [part.type,part.value]));
  return {date:parts.year + "-" + parts.month + "-" + parts.day,time:parts.hour + ":" + parts.minute};
}
const timelineDate = (entry) => timelineMoment(entry).date;
const momentLabel = (entry) => {
  const moment = timelineMoment(entry);
  return moment.date + (moment.time ? " " + moment.time : view.zone === "America/New_York" ? tr("（按日期前移一天）", " (-1 day by date)") : "");
};
const todayInZone = () => {
  if (view.zone === "Asia/Shanghai") return data.today;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map((part) => [part.type,part.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
};

const compareFinite = (a,b) => a === b ? 0 : a < b ? -1 : 1;
function inferredSideRound(entry) {
  const sub = entry.name?.match(/^R(\d+)[.．]\d+/i);
  if (sub) return "R" + (Number(sub[1]) + 1);
  return entry.name?.match(/^(R[1-9]\d?)(?:$|(?=[^0-9.．]))/i)?.[1].toUpperCase() || "";
}
function sideInternalIndex(entry) {
  const match = entry.name?.match(/^R\d+[.．](\d+)/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
function compareSideNodes(a, b) {
  const aOrder = nodeType(a) === "work" ? 0 : 1;
  const bOrder = nodeType(b) === "work" ? 0 : 1;
  if (aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder === 0) {
    const indexDiff = compareFinite(sideInternalIndex(a), sideInternalIndex(b));
    if (indexDiff) return indexDiff;
  }
  return (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "");
}

function productSchedule(nodes, project) {
  const deliveryLabel = deliveryLabelFor(project);
  const groups = new Map();
  const customers = [];
  const works = [];
  const unassigned = [];
  for (const entry of nodes) {
    const type = nodeType(entry);
    if (type === "client") {
      customers.push(entry);
    } else if (type === "work") {
      works.push(entry);
    } else if (roundNumber(type) || type === "delivery" || type === "client-delivery") {
      const label = roundNumber(type) ? type : deliveryLabel;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(entry);
    }
  }
  const active = (label) => (groups.get(label) || []).filter((entry) => entry.status !== "已取消");
  const labels = [...groups.keys()].sort((a,b) => (roundNumber(a) || 100) - (roundNumber(b) || 100));
  const latest = Math.max(0,...labels.filter((label) => active(label).length).map(roundNumber));
  const phases = labels.map((label) => {
    const entries = groups.get(label);
    const current = active(label);
    const number = !roundNumber(label) ? latest : roundNumber(label)-1;
    const previousLabel = number ? "R"+number : "";
    const previous = previousLabel ? active(previousLabel) : [];
    const end = current.length===1 ? timelineDate(current[0]) : "";
    const start = label==="R1" && end ? workdaysBefore(end,r1LeadDays(project)) :
      previous.length===1 ? timelineDate(previous[0]) : "";
    const issue = !current.length ? tr("已取消", "Cancelled") :
      current.length>1 || previous.length>1 ? tr("节点待核对", "Check nodes") :
      !end ? tr("日期待补齐", "Date missing") :
      !start ? (previousLabel || tr("制作轮次", "Prior round")) + tr(" 日期待补齐", " date missing") :
      end<start ? tr("日期顺序待核对", "Check date order") : "";
    return {label,entries,current,previous,start,end,issue};
  });
  const sortedWorks = works.slice().sort(compareSideNodes);
  const sortedCustomers = customers.slice().sort(compareSideNodes);
  for (const entry of sortedWorks) {
    const label = entry.round || (/^R\d+[.．]\d+/i.test(entry.name || "") ? inferredSideRound(entry) : "");
    const phase = label ? phases.find((item) => item.label === label) : null;
    if (phase) (phase.works ??= []).push(entry);
    else unassigned.push(entry);
  }
  for (const entry of sortedCustomers) {
    const label = entry.round === "delivery" ? deliveryLabel : (entry.round || inferredSideRound(entry));
    const phase = label ? phases.find((item) => item.label === label) : phases.find((item) =>
      !item.issue && timelineDate(entry)>item.start && timelineDate(entry)<=item.end);
    if (phase) (phase.customers ??= []).push(entry);
    else unassigned.push(entry);
  }
  return {phases, unassigned, works:sortedWorks, customers:sortedCustomers};
}

const BAR_TIERS = [
  {maxWeight: 6, height: 16, tier: 1},
  {maxWeight: 15, height: 22, tier: 2},
  {maxWeight: 27, height: 28, tier: 3},
  {maxWeight: Number.POSITIVE_INFINITY, height: 36, tier: 4},
];
const CATEGORY_BAR_TIERS = {
  "digital-twins": BAR_TIERS,
  "ai-image": [
    {maxWeight: 2, height: 16, tier: 1},
    {maxWeight: 10, height: 22, tier: 2},
    {maxWeight: 20, height: 28, tier: 3},
    {maxWeight: Number.POSITIVE_INFINITY, height: 36, tier: 4},
  ],
  "video": [
    {maxWeight: 1, height: 16, tier: 1},
    {maxWeight: 3, height: 22, tier: 2},
    {maxWeight: 5, height: 28, tier: 3},
    {maxWeight: Number.POSITIVE_INFINITY, height: 36, tier: 4},
  ],
};
const BAR_HEIGHT_MIN = BAR_TIERS[0].height;
const BAR_HEIGHT_MAX = BAR_TIERS[BAR_TIERS.length - 1].height;

function projectWeight(project) {
  const category = projectCategory(project);
  const meta = categoryMeta(category);
  const plannedSku = meta.hasSku && Number.isInteger(project?.skuQuantity) && project.skuQuantity > 0 ? project.skuQuantity : 0;
  const recordedSku = meta.hasSku && project?.id ? new Set(data.entries.filter((entry) =>
    entry.kind === "sku" && entry.project === project.id && entry.sku).map((entry) => entry.sku.trim().toLowerCase())).size : 0;
  const plannedAsset = Number.isInteger(project?.assetQuantity) && project.assetQuantity > 0 ? project.assetQuantity : 0;
  const recordedAsset = project?.id ? data.entries.filter((entry) =>
    entry.kind === "asset" && entry.project === project.id && Number.isInteger(entry.quantity))
    .reduce((sum, entry) => sum + entry.quantity, 0) : 0;
  const sku = meta.hasSku ? Math.max(plannedSku, recordedSku) : 0;
  const asset = Math.max(plannedAsset, recordedAsset);
  return {category, sku, asset, weight: meta.hasSku ? sku * 3 + asset : asset};
}

function projectBarTier(project) {
  const {category, sku, asset, weight} = projectWeight(project);
  const tiers = CATEGORY_BAR_TIERS[category] || BAR_TIERS;
  const matched = tiers.find((item) => weight <= item.maxWeight) || tiers[tiers.length - 1];
  return {category, sku, asset, weight, tier: matched.tier, height: matched.height};
}

function projectBarHeight(project) {
  return projectBarTier(project).height;
}

function timeline() {
  const [start,end] = timelineRange();
  const overview = !view.project;
  const cells = chartCells(start,end);
  const weightedDays = cells.reduce((total, cell) => total + (cell.weekend ? .5 : 1), 0);
  const columns = cells.map((cell) => cell.weekend ? 'calc(var(--unit) / 2)' : 'var(--unit)').join(' ');
  const nodes = scoped().filter((entry) => entry.kind === "node");
  const unscheduled = nodes.filter((entry) => nodeType(entry)!=="other" && !timelineDate(entry));
  const other = nodes.filter((entry) => nodeType(entry)==="other" &&
    (!entry.date && !entry.start || stamp(timelineDate(entry))<end && stamp(timelineDate(entry))>=start));
  const ticks = cells.map((cell) => '<span class="tick' + (cell.weekend ? " weekend":"") +
    (cell.date===todayInZone() ? " today":"") + '" data-date="' + cell.date +
    '" style="grid-column:' + cell.column + '"></span>').join("");
  const header = cells.filter((cell) => cell.label).map((cell) =>
    '<span class="tick" style="grid-column:' + cell.column + '/span ' + cell.span + '">' + cell.label + '</span>').join("");
  const row = (label,lane,classes="",style="") => '<div class="chart-row ' + classes +
    '"' + (style ? ' style="' + style + '"' : '') + '><div class="chart-label">' + label + '</div><div class="lane">' + lane + '</div></div>';
  const column = (date) => 1 + Math.round((stamp(date)-start)/day);
  const complete = (phase) => !phase.issue && phase.end>phase.start &&
    stamp(phase.start)<end && stamp(phase.end)>=start;
  const phaseAction = (project,phase) => ' data-phase="' + phase.label + '" data-phase-project="' + escape(project.id) + '"';
  const bar = (project,phase) => {
    const first = column(phase.start), last = column(phase.end);
    const left = Math.max(1,first), right = 1 + Math.min(cells.length,last);
    const dates = phase.start + tr(" 至 ", " to ") + phase.end;
    const meta = categoryMeta(project);
    const {sku,asset} = projectWeight(project);
    const tbd = tr("待填", "TBD");
    const loadTitle = dates + (meta.hasSku ? " · SKU " + (sku || tbd) + " · " + meta.assetInlineLabel + " " + (asset || tbd) :
      " · " + meta.assetInlineLabel + " " + (asset ? asset + " " + meta.assetUnit : tbd));
    return '<button class="phase-bar' + (["已完成","已交付"].includes(phase.current[0]?.status) ? " done":"") +
      '" aria-label="' + phase.label + ' · ' + dates + '" title="' + escape(loadTitle) + '"' + phaseAction(project,phase) +
      ' style="grid-column:' + left + '/' + right + ';--bar-height:' + projectBarHeight(project) + 'px;--phase-color:' + phaseColor(phase.label,project.brand) +
      ';--phase-ink:' + phaseInk(phase.label,project.brand) + ';--trim-start:' +
      (first>=1 ? (cells[first-1]?.weekend ? 'calc(var(--unit) / 4)' : 'calc(var(--unit) / 2)') : '0px') +
      ';--trim-end:' + (last<=cells.length ? (cells[last-1]?.weekend ? 'calc(var(--unit) / 4)' : 'calc(var(--unit) / 2)') : '0px') + '">' +
      phase.label + '</button>';
  };
  const markers = (entries) => {
    const byDate = new Map();
    for (const entry of entries) {
      const date = timelineDate(entry);
      if (!date || stamp(date)<start || stamp(date)>=end) continue;
      const key = date + (isClient(entry) ? "/client" : nodeType(entry)==="work" ? "/work" : "/production");
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(entry);
    }
    return [...byDate.values()].map((group) => {
      const [entry] = group;
      const date = timelineDate(entry);
      const client = isClient(entry);
      const psd = group.some((item) => ["delivery","client-delivery"].includes(nodeType(item)));
      const proj = find(entry.project);
      const tone = psd ? phaseColor("PSD") : !client && phaseColor(nodeType(entry),proj?.brand);
      const sep = tr("；", "; ");
      const label = momentLabel(entry) + " · " + group.map((item) => displayEntryName(item, proj) + (item.status ? " · " + tStatus(item.status) : "")).join(sep);
      const action = group.length===1 ? ' data-open="' + escape(entry.id) + '"' :
        ' data-points="' + escape(group.map((item) => item.id).join(",")) + '"';
      return '<button class="timeline-marker' + (client ? " client-point" : nodeType(entry)==="work" ? " work-point" : " production-point") +
        (psd ? " psd-point" : "") + (group.length>1 ? " multiple" : "") + '" style="grid-column:' + column(date) +
        (tone ? ';--phase-color:' + tone : '') +
        '" aria-label="' + escape(label) + '" title="' + escape(label) + '"' + action + '>' +
        (group.length>1 ? group.length : "") + '</button>';
    }).join("");
  };
  const rows = visibleProjects().map((project) => {
    const {phases,unassigned,works,customers} = productSchedule(nodes.filter((entry) => entry.project === project.id),project);
    const renderable = phases.map((phase) => {
      const own = phase.entries;
      const span = own.includes(phase.current[0]) && complete(phase) ? bar(project,phase) : "";
      const endpoints = own.filter((entry) => !roundNumber(phase.label) || !span || entry!==phase.current[0]);
      const points = markers([...(phase.works || []), ...endpoints.filter((item) => !isClient(item)), ...endpoints.filter(isClient), ...(phase.customers || [])]);
      return {phase,span,points,endpoints};
    }).filter(({span,points}) => span || points);
    const standalone = markers([...unassigned.filter((item) => !isClient(item)), ...unassigned.filter(isClient)]);
    if (!renderable.length && !standalone && !overview) return "";
    const compact = overview || view.folded.has(project.id);
    const summary = renderable.map(({span}) => span).join("") + (compact ? markers([...new Set([
      ...works, ...unassigned.filter((item) => !isClient(item)),
      ...renderable.flatMap(({endpoints}) => endpoints.filter((item) => !isClient(item))),
      ...customers, ...unassigned.filter(isClient),
      ...renderable.flatMap(({endpoints}) => endpoints.filter(isClient))
    ])]) : standalone);
    const rowStyle = "--bar-height:" + projectBarHeight(project) + "px";
    if (overview) {
      const label = projectThumb(project) + '<button data-project="' + escape(project.id) + '" title="' + escape(project.name) + '">' +
        projectInfo(project) + '</button>';
      return row(label,ticks + summary,"group-row overview-row",rowStyle);
    }
    const color = /^#[0-9a-f]{6}$/i.test(project.type || "") ? '<span class="source-swatch" style="background:' +
      project.type + '" title="' + escape(tr("来源表底色", "Source sheet fill")) + '"></span>' : "";
    const foldAria = isEn() ? ((compact ? "Expand " : "Collapse ") + project.name) : ((compact ? "展开 " : "折叠 ") + project.name);
    const groupLabel = '<button class="fold" data-fold="' + escape(project.id) + '" aria-expanded="' + !compact +
      '" aria-label="' + escape(foldAria) + '">' + (compact ? "▸" : "▾") + '</button>' +
      color + projectThumb(project) + '<button type="button" data-open="' + escape(project.id) + '" title="' +
      escape(project.name) + '">' + projectInfo(project) + '</button>';
    const phaseRows = renderable.map(({phase,span,points}) => {
      const dates = phase.issue ? "" : phase.start.slice(5) + " – " + phase.end.slice(5);
      const label = '<button' + phaseAction(project,phase) + '>' + phase.label + '</button>' +
        (phase.issue ? '<small class="phase-issue">' + escape(phase.issue) + '</small>' : '<span class="row-date">' + dates + '</span>');
      return row(label,ticks + span + points,"phase-row",rowStyle);
    }).join("");
    return row(groupLabel, ticks + summary, "group-row", rowStyle) + (compact ? "" : phaseRows);
  }).join("");
  const units = {day:"var(--day-unit, 60px)",week:"var(--week-unit, 24px)",month:"max(10px, calc((100cqw - var(--label) - 2px) / var(--weighted-days)))"};
  const legendRounds = [...new Set(nodes.map(nodeType).filter(roundNumber))].sort((a,b) => roundNumber(a)-roundNumber(b));
  const currentProject = find(view.project);
  const legendBrand = currentProject?.brand || view.brand;
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const legendDelivery = effectiveCategory ? deliveryLabelFor(effectiveCategory) : tr("PSD / 终稿 / 成片", "PSD / Final / Master");
  const tierHeightsText = BAR_TIERS.map((item) => item.height).join("/") + "px";
  const legendTier = effectiveCategory === "ai-image" ?
    [tr("粗细 4 档（按张数）", "4-Tier Width (Imgs)"), tr("阶段条粗细按 AI Assets 张数划分为 4 档（" + tierHeightsText + "）：≤2 / 3–10 / 11–20 / ≥21 张", "Bar height scales across 4 tiers (" + tierHeightsText + ") by AI Assets count: ≤2 / 3–10 / 11–20 / ≥21 imgs")] :
    effectiveCategory === "video" ?
    [tr("粗细 4 档（按条数）", "4-Tier Width (Clips)"), tr("阶段条粗细按 CGI Videos 条数划分为 4 档（" + tierHeightsText + "）：≤1 / 2–3 / 4–5 / ≥6 条", "Bar height scales across 4 tiers (" + tierHeightsText + ") by CGI Videos count: ≤1 / 2–3 / 4–5 / ≥6 clips")] :
    effectiveCategory === "digital-twins" ?
    [tr("粗细 4 档（3×SKU+资产）", "4-Tier Width (3×SKU+Assets)"), tr("阶段条粗细按 3×SKU + 资产 划分为 4 档（" + tierHeightsText + "）：≤6 / 7–15 / 16–27 / ≥28", "Bar height scales across 4 tiers (" + tierHeightsText + ") by 3×SKU + Assets: ≤6 / 7–15 / 16–27 / ≥28")] :
    [tr("粗细 4 档（按类别体量）", "4-Tier Width (By Volume)"), tr("阶段条粗细划分为 4 档（" + tierHeightsText + "）：Digital Twins 按 3×SKU+资产，AI Assets 按张数（≤2/3–10/11–20/≥21），CGI Videos 按条数（≤1/2–3/4–5/≥6）", "4-tier bar height (" + tierHeightsText + "): Digital Twins by 3×SKU+Assets, AI Assets by images (≤2/3–10/11–20/≥21), CGI Videos by clips (≤1/2–3/4–5/≥6)")];
  const psdTitle = tr("修改交付节点颜色", "Customize delivery node color");
  const workTitle = tr("修改内部节点颜色", "Customize internal node color");
  const clientTitle = tr("修改客户节点颜色", "Customize client node color");
  const todayTitle = tr("修改今天线颜色", "Customize today line color");
  const legend = (legendBrand ? legendRounds.map((label) => '<span><i class="phase-swatch" aria-hidden="true" style="background:' +
    phaseColor(label,legendBrand) + '"></i>' + label + '</span>').join("") :
    '<span>' + tr("R1-Rn 按品牌色逐轮变浅", "R1-Rn lighter by round") + '</span>') + '<button type="button" data-palette="psd" title="' + psdTitle + '" aria-label="' + psdTitle + '"><i class="phase-swatch psd-swatch" aria-hidden="true" style="background:' +
    paletteColor("psd") + '"></i>' + escape(legendDelivery) + '</button>' +
    '<span title="' + escape(legendTier[1]) + '">' + escape(legendTier[0]) + '</span>';
  const remaining = (name,entries) => entries.length ? '<details class="panel unscheduled"><summary>' + name + ' · ' + entries.length +
    '</summary><div class="stack">' + entries.map((entry) => openButton(entry)).join("") + '</div></details>' : "";
  const zoneName = view.zone === "Asia/Shanghai" ? tr("广州", "Guangzhou") : tr("纽约", "New York");
  return '<div class="panel"><div class="section-head"><h2>' + tr("项目时间轴 · ", "Project Timeline · ") + zoneName + '</h2><div class="legend">' + legend +
    '<button type="button" data-palette="work" title="' + workTitle + '" aria-label="' + workTitle + '"><b aria-hidden="true" style="color:' + paletteColor("work") + '">◆</b>' + tr("内部节点", "Internal") + '</button>' +
    '<button type="button" data-palette="client" title="' + clientTitle + '" aria-label="' + clientTitle + '"><b aria-hidden="true" style="color:' + paletteColor("client") + '">●</b>' + tr("客户节点", "Client") + '</button>' +
    '<button type="button" data-palette="today" title="' + todayTitle + '" aria-label="' + todayTitle + '"><b aria-hidden="true" style="color:' + paletteColor("today") + '">│</b>' + tr("今天", "Today") + '</button></div></div>' +
    (view.zone === "America/New_York" ? '<p class="zone-note">' + tr("纽约时间：已填时刻的节点按时区换算；仅有日期的节点显示为广州日期前一天。", "New York time: timed nodes convert by timezone; date-only nodes appear 1 day before Guangzhou date.") + '</p>' : '') +
    (rows ? '<div class="chart" tabindex="0" aria-label="' + tr("可滚动的甘特图", "Scrollable Gantt chart") + '" data-anchor-month="' + view.month +
      '" data-scale="' + view.scale + '" data-range="' + view.range + '"><div class="chart-inner" style="--weighted-days:' + weightedDays +
      ';--unit:' + units[view.scale] + ';--columns:' + columns + '">' + row(overview ? tr("项目", "Project") : tr("产品 / 轮次", "Product / Phase"),header,"chart-header") + rows + row('',ticks,'chart-fill') + '</div></div>'
      : '<p class="empty">' + tr("这个月没有符合条件的排期。可切换月份，或在项目中设置排期节点。", "No matching schedules this month. Switch months or add schedule nodes to a project.") + '</p>') + '</div>' +
    remaining(tr("未排期", "Unscheduled"),unscheduled) + remaining(tr("待整理排期", "Other Nodes"),other);
}

function table(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' + headers.map((head) => "<th scope=\"col\">" + escape(head) + "</th>").join("") +
    '</tr></thead><tbody>' + rows.map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join("") + '</tbody></table></div>';
}

function sheetColumns() {
  const currentProject = find(view.project);
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const allCategories = !effectiveCategory;
  const meta = effectiveCategory ? categoryMeta(effectiveCategory) : null;
  const cols = [
    {key:"date", header:tr("日期（广州）", "Date (GZ)"), source:"B"},
    {key:"brand", header:tr("品牌", "Brand"), source:"D"},
  ];
  if (allCategories) cols.push({key:"category", header:tr("类别", "Category"), source:"D"});
  cols.push(
    {key:"project", header:tr("项目", "Project"), source:"D"},
    {key:"type", header:tr("节点类型", "Type"), source:"C"},
    {key:"task", header:"Task", source:"E"},
    {key:"notes", header:"Notes", source:"G"},
    {key:"status", header:tr("状态", "Status"), source:"F"},
  );
  if (allCategories || meta.hasSku) cols.push({key:"sku", header:"SKU", source:"F"});
  cols.push(
    {key:"asset", header:allCategories ? tr("计划数量", "Planned Qty") : meta.assetSheetHeader, source:"F"},
    {key:"thumb", header:tr("缩略图", "Thumb"), source:"E"},
  );
  return cols;
}

function sheetRecords() {
  const cols = sheetColumns();
  const currentProject = find(view.project);
  const allCategories = !(currentProject ? projectCategory(currentProject) : view.category);
  const notesIndex = cols.findIndex((col) => col.key === "notes");
  const nodes = scoped().filter((entry) => entry.kind === "node" && inMonth(phaseDate(entry)));
  const colors = sheetProjectColors();
  return nodes.map((entry) => {
    const project = find(entry.project);
    const meta = categoryMeta(project);
    const date = phaseDate(entry);
    const sourceStyle = sourceStyleFor(entry);
    const color = colors.get(entry.project) || sheetFallbackColors[0];
    const textColors = cols.map((col) => sourceStyle?.[col.source]?.text || "#000000");
    const boldCells = cols.map((col) => Boolean(sourceStyle?.[col.source]?.bold));
    const strikeCells = cols.map((col) => Boolean(sourceStyle?.[col.source]?.strike));
    const cellColors = cols.map(() => color);
    if (notesIndex >= 0 && sourceStyle?.G?.background && sourceStyle.G.background.toLowerCase() !== color.toLowerCase()) {
      cellColors[notesIndex] = sourceStyle.G.background;
    }
    const type = nodeType(entry);
    const nodeCategory = type === "client" || type === "client-delivery" ? tr("客户", "Client") :
      type === "work" ? tr("内部", "Internal") : type === "delivery" ? deliveryLabelFor(project) : roundNumber(type) ? type : tr("其他", "Other");
    const assetCell = Number.isInteger(project?.assetQuantity) && project.assetQuantity > 0 ?
      (allCategories ? project.assetQuantity + " " + meta.assetUnit : String(project.assetQuantity)) : tr("待填", "TBD");
    const byKey = {
      date:sheetDateLabel(date,entry.time),
      brand:brandShort(project?.brand || ""),
      category:meta.label,
      project:project?.name || "",
      type:nodeCategory,
      task:displayEntryName(entry, project),
      notes:entry.memo || "",
      status:tStatus(entry.status || "待确认"),
      sku:meta.hasSku ? projectQuantity(project?.skuQuantity) : "—",
      asset:assetCell,
      thumb:"",
    };
    return {entry,project,date,color,cellColors,textColors,boldCells,strikeCells,cells:cols.map((col) => byKey[col.key])};
  }).sort((a,b) => a.date.localeCompare(b.date) || (a.entry.time || "").localeCompare(b.entry.time || "") ||
    (a.project?.brand || "").localeCompare(b.project?.brand || "") ||
    (a.project?.name || "").localeCompare(b.project?.name || "") ||
    (nodeType(a.entry) === "work" ? 0 : isClient(a.entry) ? 2 : 1) - (nodeType(b.entry) === "work" ? 0 : isClient(b.entry) ? 2 : 1) ||
    compareFinite(sideInternalIndex(a.entry), sideInternalIndex(b.entry)) ||
    (roundNumber(nodeType(a.entry)) || 100) - (roundNumber(nodeType(b.entry)) || 100));
}

function sheetRows(records = sheetRecords(), cols = sheetColumns()) {
  const rows = [];
  let previous = "";
  for (const record of records) {
    if (record.date !== previous) {
      const start = previous ? stamp(previous) + day : stamp(record.date);
      for (let cursor = start; cursor <= stamp(record.date); cursor += day) {
        const weekday = new Date(cursor).getUTCDay();
        if (weekday === 6 || (!previous && weekday === 0)) {
          rows.push({kind:"weekend",cells:cols.map(() => "")});
        }
      }
      previous = record.date;
    }
    rows.push({kind:"node",...record});
  }
  return rows;
}

function sheetView() {
  const cols = sheetColumns();
  const records = sheetRecords();
  const body = sheetRows(records, cols).map((row) => row.kind === "weekend" ?
    '<tr class="sheet-weekend" aria-label="' + tr("周末留白", "Weekend spacer") + '"><td colspan="' + cols.length + '"></td></tr>' :
    '<tr class="sheet-project-row" style="--sheet-project:' + row.color + '">' +
    row.cells.map((cell,index) => {
      const colKey = cols[index].key;
      const cellTitle = colKey === "date" ? row.date :
        (colKey === "brand" && row.project?.brand && brandFull(row.project.brand) !== brandShort(row.project.brand) ? brandDisplay(row.project.brand, "both") : "");
      return '<td data-col="' + colKey + '" style="background-color:' + row.cellColors[index] +
        ';color:' + row.textColors[index] + (row.boldCells[index] ? ';font-weight:700' : '') +
        (row.strikeCells[index] ? ';text-decoration:line-through' : '') + '"' +
        (cellTitle ? ' title="' + escape(cellTitle) + '"' : '') + '>' +
        (colKey === "thumb" ? (row.project?.image ? '<img class="sheet-thumb" src="' + escape(row.project.image) + '" alt="' + escape(row.project.name) + '" loading="lazy">' : '') :
        colKey === "task" ? openButton(row.entry,cell) : colKey === "notes" && cell.length > 60 ?
          '<details class="sheet-note"><summary title="' + tr("展开完整备注", "Expand full notes") + '">' + escape(cell.slice(0,60)) +
          '…</summary><p>' + escape(cell) + '</p></details>' : escape(cell)) + '</td>';
    }).join("") +
    '</tr>').join("");
  const sheetSub = isEn() ? ("Sorted by date · Guangzhou time · " + records.length + " nodes") : ("按日期排序 · 日期以广州为准 · 共 " + records.length + " 个节点");
  return '<div class="panel sheet-panel"><div class="section-head sheet-head"><div><h2>' + escape(view.month) +
    tr(" 排期表单", " Schedule Sheet") + '</h2><p class="hint">' + escape(sheetSub) +
    '</p></div><div class="sheet-actions"><button type="button" data-copy-sheet>' + tr("复制到 Google 表格", "Copy to Google Sheets") + '</button>' +
    '<button type="button" class="primary" data-export-xlsx>' + tr("下载 Excel", "Download Excel") + '</button></div></div>' +
    (records.length ? '<div class="table-wrap"><table class="schedule-sheet"><thead><tr>' + cols.map((col) =>
      '<th scope="col" data-col="' + col.key + '">' + escape(col.header) + '</th>').join("") + '</tr></thead><tbody>' + body + '</tbody></table></div>' :
      '<p class="empty">' + tr("当前月份没有排期节点。选择其他月份，或进入项目编辑排期。", "No schedule nodes in this month. Switch months or open a project to edit schedules.") + '</p>') + '</div>';
}

async function exportSheetXlsx() {
  const cols = sheetColumns();
  const headers = cols.map((col) => col.header);
  const sheet = sheetRows(sheetRecords(), cols);
  const rows = sheet.map(({cells}) => cells);
  const rowMeta = sheet.map((row) => row.kind === "weekend" ? {kind:"weekend"} :
    {kind:"node",date:row.date,time:row.entry.time || "",color:row.color,
      cellColors:row.cellColors,textColors:row.textColors,boldCells:row.boldCells,strikeCells:row.strikeCells});
  const response = await fetch("/api/export-xlsx",{method:"POST",credentials:"omit",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({headers,rows,rowMeta})});
  if (!response.ok) throw new Error(tError((await response.json()).error || tr("Excel 导出失败", "Excel export failed")));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = (isEn() ? "1mageAI-Schedule-" : "1mageAI-排期-") + view.month + ".xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),60000);
}

async function copyToGoogleSheet() {
  const cols = sheetColumns();
  const headers = cols.map((col) => col.header);
  const sheet = sheetRows(sheetRecords(), cols);
  const clipboardCell = (cell) => {
    const value = String(cell).replace(/\t/g," ").replace(/\r?\n/g," / ");
    return /^[=+\-@]/.test(value) ? "'" + value : value;
  };
  const lines = [headers,...sheet.map(({cells}) => cells)];
  const tsv = lines.map((row) => row.map(clipboardCell).join("\t")).join("\n");
  const html = '<table><thead><tr>' + headers.map((cell) =>
    '<th style="background-color:#D0CECE;color:#000000">' + escape(cell) + '</th>').join("") +
    '</tr></thead><tbody>' + sheet.map((row) => '<tr>' + row.cells.map((cell,index) =>
      '<td' + (row.kind === "node" ? ' style="background-color:' + row.cellColors[index] +
        ';color:' + row.textColors[index] + (row.boldCells[index] ? ';font-weight:700' : '') +
        (row.strikeCells[index] ? ';text-decoration:line-through' : '') + '"' : '') + '>' +
      escape(clipboardCell(cell)) + '</td>').join("") + '</tr>').join("") + '</tbody></table>';
  if (navigator.clipboard.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain":new Blob([tsv],{type:"text/plain"}),
        "text/html":new Blob([html],{type:"text/html"})
      })]);
    } catch (_) { await navigator.clipboard.writeText(tsv); }
  } else await navigator.clipboard.writeText(tsv);
  window.open("https://sheets.new","_blank","noopener");
  notify(tr("已复制表单。打开 Google 表格后，在 A1 粘贴即可；若底色未保留，可导入下载的 Excel。", "Copied to clipboard. Paste into cell A1 in Google Sheets, or import the downloaded Excel file to keep cell fills."));
}

function notes() {
  const entries = scoped().filter((entry) =>
    (entry.kind === "note" && (!entry.date || inMonth(entry.date))) ||
    (entry.kind === "revision" && (!entry.actual || inMonth(entry.actual)))).sort((a,b) =>
      (b.actual || b.date || "").localeCompare(a.actual || a.date || ""));
  return '<div class="panel"><div class="section-head"><h2>' + tr("项目记录", "Project Logs") + '</h2></div>' +
    (entries.length ? table([tr("发生日期", "Date"), tr("项目", "Project"), tr("类型", "Type"), tr("内容", "Details")],entries.map((entry) => [
      escape(entry.actual || entry.date || tr("日期待确认", "Date TBD")), escape(find(entry.project)?.name || ""),
      escape(entry.type ? tNoteType(entry.type) : kindLabel(entry.kind)), openButton(entry) + (entry.memo ? "<p>" + escape(entry.memo) + "</p>" : "")
    ])) : '<p class="empty">' + tr("这个月还没有记录。可添加进展、反馈、修改或交付记录。", "No logs this month. Add progress, feedback, revision, or delivery records.") + '</p>') + '</div>';
}

function metrics(entries, activeProjects = categoryProjects().filter((p) => p.status !== "已归档")) {
  const activeMap = new Map(activeProjects.map((p) => [p.id, p]));
  const scopedEntries = entries.filter((entry) => activeMap.has(entry.project));
  const started = scopedEntries.filter((entry) => inMonth(entry.actual) && ["sku","asset","revision"].includes(entry.kind));
  const sku = new Map();
  const newProjects = new Map();
  for (const entry of started.filter((entry) => entry.kind === "sku")) {
    const project = activeMap.get(entry.project);
    if (!categoryMeta(project).hasSku) continue;
    const key = JSON.stringify([entry.project, entry.sku.trim().toLowerCase()]);
    if (!sku.has(key)) sku.set(key, []);
    sku.get(key).push(entry);
  }
  for (const project of activeProjects) {
    const r1 = scopedEntries.filter((entry) => entry.kind === "node" && entry.project === project.id &&
      nodeType(entry) === "R1" && entry.status !== "已取消" && inMonth(phaseDate(entry)));
    if (r1.length !== 1) continue;
    newProjects.set(project.id,{project,r1Date:phaseDate(r1[0])});
    if (!categoryMeta(project).hasSku) continue;
    const recorded = [...sku.values()].filter((items) => items[0].project === project.id).length;
    const remainingQuantity = Math.max(0,(project.skuQuantity || 1)-recorded);
    if (!remainingQuantity) continue;
    sku.set(JSON.stringify([project.id,"__r1_default__"]), [{...project, project:project.id, name:project.name + tr(" · R1 开工", " · R1 Start"),
      actual:workdaysBefore(phaseDate(r1[0]),r1LeadDays(project)), r1Date:phaseDate(r1[0]), remainingQuantity}]);
  }
  const asset = started.filter((entry) => entry.kind === "asset" && !newProjects.has(entry.project));
  for (const {project,r1Date} of newProjects.values()) {
    const recorded = started.filter((entry) => entry.kind === "asset" && entry.project === project.id);
    const recordedQuantity = recorded.reduce((sum,entry) => sum + entry.quantity,0);
    const plannedQuantity = Number.isInteger(project.assetQuantity) ? project.assetQuantity : 0;
    const quantity = Math.max(plannedQuantity,recordedQuantity);
    if (!quantity) continue;
    asset.push({...project,project:project.id,kind:"project",quantity,r1Date,
      actual:workdaysBefore(r1Date,r1LeadDays(project)),assetSource:recordedQuantity > plannedQuantity ? tr("实际记录", "Logged") : tr("R1 排期", "R1 Schedule")});
  }
  const firstR4 = new Map();
  for (const entry of scopedEntries.filter((item) => item.kind === "node" && item.status !== "已取消" && roundNumber(nodeType(item)) >= 4)) {
    const project = activeMap.get(entry.project);
    const date = phaseDate(entry);
    if (!project || project.status === "已归档" || !date) continue;
    const previous = firstR4.get(project.id);
    if (!previous || date < previous.date) firstR4.set(project.id,{project:project.id,name:project.name,brand:project.brand,date,round:nodeType(entry)});
  }
  const r4Projects = [...firstR4.values()].filter((item) => inMonth(item.date));
  const pending = scopedEntries.filter((entry) =>
    (["sku","asset","revision"].includes(entry.kind) && !entry.actual && (entry.kind !== "sku" || categoryMeta(activeMap.get(entry.project)).hasSku)) ||
    (entry.kind==="node" && entry.source && !entry.actual && inMonth(entry.date) && entry.status==="待确认"));
  const skuCount = [...sku.values()].reduce((sum,items) => sum + (items[0].remainingQuantity || 1),0);
  const assetByCategory = (cat) => asset.filter((entry) => projectCategory(activeMap.get(entry.project) || entry) === cat);
  const dtAsset = assetByCategory("digital-twins");
  const aiAsset = assetByCategory("ai-image");
  const videoAsset = assetByCategory("video");
  const sumQuantity = (items) => items.reduce((sum,entry) => sum + entry.quantity, 0);
  return {
    sku, asset, dtAsset, aiAsset, videoAsset, newProjects, started, r4Projects, pending,
    skuCount,
    dtAssetCount:sumQuantity(dtAsset),
    aiAssetCount:sumQuantity(aiAsset),
    videoAssetCount:sumQuantity(videoAsset),
    values:[skuCount,sumQuantity(asset),r4Projects.length,pending.length],
  };
}

function statsMetricDefs(effectiveCategory, m) {
  const r4Label = tr("达到 R4 的项目", "Reached R4+");
  const pendingLabel = tr("待确认条目", "Pending Items");
  if (effectiveCategory === "ai-image") {
    return [
      {name:tr("新开工 AI Assets（张）", "New AI Assets (imgs)"), value:m.aiAssetCount, items:m.aiAsset, kind:"asset", unit:tr("张", "imgs")},
      {name:r4Label, value:m.r4Projects.length, items:m.r4Projects, kind:"r4"},
      {name:pendingLabel, value:m.pending.length, items:m.pending, kind:"pending"},
    ];
  }
  if (effectiveCategory === "video") {
    return [
      {name:tr("新开工 CGI Videos（条）", "New CGI Videos (clips)"), value:m.videoAssetCount, items:m.videoAsset, kind:"asset", unit:tr("条", "clips")},
      {name:r4Label, value:m.r4Projects.length, items:m.r4Projects, kind:"r4"},
      {name:pendingLabel, value:m.pending.length, items:m.pending, kind:"pending"},
    ];
  }
  if (effectiveCategory === "digital-twins") {
    return [
      {name:tr("新开工 SKU", "New SKUs"), value:m.skuCount, items:[...m.sku.values()].flat(), kind:"sku"},
      {name:tr("新开工图片 / 资产", "New Assets"), value:m.dtAssetCount, items:m.dtAsset, kind:"asset", unit:tr("张", "assets")},
      {name:r4Label, value:m.r4Projects.length, items:m.r4Projects, kind:"r4"},
      {name:pendingLabel, value:m.pending.length, items:m.pending, kind:"pending"},
    ];
  }
  return [
    {name:tr("DT 新开工 SKU", "New DT SKUs"), value:m.skuCount, items:[...m.sku.values()].flat(), kind:"sku"},
    {name:tr("DT 新开工资产", "New DT Assets"), value:m.dtAssetCount, items:m.dtAsset, kind:"asset", unit:tr("张", "assets")},
    {name:tr("新开工 AI Assets（张）", "New AI Assets (imgs)"), value:m.aiAssetCount, items:m.aiAsset, kind:"asset", unit:tr("张", "imgs")},
    {name:tr("新开工 CGI Videos（条）", "New CGI Videos (clips)"), value:m.videoAssetCount, items:m.videoAsset, kind:"asset", unit:tr("条", "clips")},
    {name:r4Label, value:m.r4Projects.length, items:m.r4Projects, kind:"r4"},
    {name:pendingLabel, value:m.pending.length, items:m.pending, kind:"pending"},
  ];
}

function stats() {
  const currentProject = find(view.project);
  const brand = currentProject?.brand || view.brand;
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const active = categoryProjects().filter((p) => p.status !== "已归档" && (!brand || p.brand === brand));
  const ids = new Set(active.map((p) => p.id));
  const entries = data.entries.filter((entry) => entry.kind !== "project" && ids.has(entry.project));
  const total = metrics(entries, active);
  const defs = statsMetricDefs(effectiveCategory, total);
  const brands = [...new Set(active.map((p) => p.brand))];
  const rows = brands.map((name) => {
    const brandProjects = active.filter((p) => p.brand === name);
    const bm = metrics(entries, brandProjects);
    return [escape(brandDisplay(name, "both")), ...statsMetricDefs(effectiveCategory, bm).map((d) => escape(d.value))];
  });
  const tbd = tr("待填写", "TBD");
  const startedProjectIds = new Set([
    ...[...total.sku.values()].map((items) => items[0].project),
    ...total.newProjects.keys(),
    ...total.started.filter((entry) => entry.kind === "asset").map((entry) => entry.project),
  ]);
  const productSummaries = [...startedProjectIds].map((id) => {
    const project = find(id);
    const meta = categoryMeta(project);
    const newProj = total.newProjects.get(id);
    const skuItems = [...total.sku.values()].map((items) => items[0]).filter((entry) => entry.project === id);
    const assetItems = total.asset.filter((entry) => entry.project === id);
    const inferred = skuItems.find((entry) => entry.kind === "project");
    const recorded = skuItems.filter((entry) => entry.kind === "sku");
    const count = recorded.length + (inferred?.remainingQuantity || 0);
    const skuLabel = !meta.hasSku ? "—" : isEn() ? (
      inferred ? count + " (" + (recorded.length ? recorded.length + " logged, " : "") + inferred.remainingQuantity + " pending)" :
      count ? count + ": " + recorded.map((entry) => entry.sku).join(", ") : tbd
    ) : (
      inferred ? count + " 个（" + (recorded.length ? recorded.length + " 已录入，" : "") + inferred.remainingQuantity + " 个待补明细）" :
      count ? count + " 个：" + recorded.map((entry) => entry.sku).join("、") : tbd
    );
    const actual = [...skuItems, ...assetItems].map((entry) => entry.actual).filter(Boolean).sort()[0] ||
      (newProj ? workdaysBefore(newProj.r1Date, r1LeadDays(project)) : "");
    const basis = newProj ? (isEn() ? (r1LeadDays(project) + " workdays before R1 (" + newProj.r1Date + ")") : ("R1 节点 " + newProj.r1Date + " 前 " + r1LeadDays(project) + " 个工作日")) :
      skuItems.length ? tr("SKU 开工记录", "SKU start log") : tr("开工记录", "Start log");
    const assetCount = assetItems.reduce((sum, item) => sum + item.quantity, 0) || project?.assetQuantity;
    return {id, project, meta, skuLabel, assetCount, actual, basis};
  }).sort((a,b) => (a.actual || "").localeCompare(b.actual || "") || (a.project?.name || "").localeCompare(b.project?.name || ""));
  const isNoSkuCategory = effectiveCategory === "ai-image" || effectiveCategory === "video";
  const productHeaders = isNoSkuCategory ?
    [tr("品牌", "Brand"), tr("项目", "Project"), categoryMeta(effectiveCategory).assetFieldLabel, tr("制作起始", "Start Date"), tr("依据", "Basis")] :
    !effectiveCategory ? [tr("品牌", "Brand"), tr("类别", "Category"), tr("项目", "Project"), "SKU", tr("计划产出", "Planned Output"), tr("制作起始", "Start Date"), tr("依据", "Basis")] :
    [tr("品牌", "Brand"), tr("产品项目", "Product Project"), "SKU", tr("计划交付资产", "Planned Assets"), tr("制作起始", "Start Date"), tr("依据", "Basis")];
  const productTable = productSummaries.length ? table(productHeaders, productSummaries.map(({id, project, meta, skuLabel, assetCount, actual, basis}) => {
    const link = '<button data-product-project="' + escape(id) + '">' + escape(project?.name) + '</button>';
    const bShort = brandShort(project?.brand || "");
    const bBoth = brandDisplay(project?.brand || "", "both");
    const brandCell = bBoth !== bShort ? '<span title="' + escape(bBoth) + '">' + escape(bShort) + '</span>' : escape(bShort);
    if (isNoSkuCategory) {
      return [brandCell, link, escape(assetCount ? assetCount + " " + meta.assetUnit : tbd), escape(actual), escape(basis)];
    }
    if (!effectiveCategory) {
      return [brandCell, escape(meta.label), link, escape(skuLabel),
        escape(project?.assetQuantity ? project.assetQuantity + " " + meta.assetUnit : tbd), escape(actual), escape(basis)];
    }
    return [brandCell, link, escape(skuLabel), escape(project?.assetQuantity || tbd), escape(actual), escape(basis)];
  })) : '<p class="empty">' + tr("本月暂无新开工项目。", "No new projects started this month.") + '</p>';
  const noteText = isNoSkuCategory ?
    tr('按品牌汇总。项目的 R1 节点落在本月时，按设置的' + categoryMeta(effectiveCategory).assetFieldLabel + '计入新开工；已录入的开工记录用于补充实际数量，同一项目不重复计数。项目首次排期达到 R4 或更高轮次时，计入对应月份，每个项目只计 1 次。',
       'Grouped by brand. When R1 falls in this month, ' + categoryMeta(effectiveCategory).assetFieldLabel.toLowerCase() + ' counts as newly started; logged start entries supplement actual volume without double counting. Projects reaching R4+ are counted once in the first month they hit R4+.') :
    !effectiveCategory ?
    tr('跨类别按品牌汇总：Digital Twins 统计新开工 SKU 与资产，AI Assets 与 CGI Videos 分别按张数、条数独立统计，不混加不同单位。项目首次排期达到 R4 或更高轮次时，每个项目只计 1 次。',
       'Cross-category summary by brand: Digital Twins tracks SKUs & assets, AI Assets tracks images, and CGI Videos tracks clips separately without mixing units. Projects reaching R4+ count once.') :
    tr('按品牌汇总。项目的 R1 节点落在本月时，按设置的 SKU 与计划交付资产数量计入新开工；未设置 SKU 时至少计 1 个。已录入的 SKU 和资产记录用于补充实际数量，同一项目不重复计数。项目首次排期达到 R4 或更高轮次时，计入对应月份，每个项目只计 1 次。',
       'Grouped by brand. When R1 falls in this month, planned SKUs (min 1) and deliverable assets count as newly started; logged SKU and asset entries supplement actual volume without double counting. Projects reaching R4+ count once.');
  const sectionTitle = isNoSkuCategory || !effectiveCategory ? tr("本月新开工项目", "New Projects This Month") : tr("本月新开工产品", "New Products This Month");
  return '<div class="panel"><div class="section-head"><h2>' + escape(view.month) + tr(' 月度统计', ' Monthly Stats') + '</h2></div>' +
    '<div class="stats-line">' + defs.map((def,i) => '<button data-metric="' + i + '">' + escape(def.name) + '<strong>' + def.value + '</strong></button>').join("") + '</div>' +
    '<p class="hint stats-note">' + escape(noteText) + '</p>' +
    (rows.length ? table([tr("品牌", "Brand"), ...defs.map((d) => d.name)], rows) : '<p class="empty">' + tr("新建项目后即可录入统计明细。", "Create a project to log stat entries.") + '</p>') +
    '<section class="stat-products" aria-label="' + sectionTitle + '"><h3>' + sectionTitle + ' <span>' + productSummaries.length + '</span></h3>' + productTable + '</section></div>';
}

function drawer(title, html, options = {}) {
  drawerSequence += 1;
  $("#drawer-title").textContent = title;
  $("#drawer-save").hidden = !options.topSave;
  $("#drawer-body").innerHTML = html;
  if (!$("#drawer").open) $("#drawer").showModal();
  return drawerSequence;
}

function field(label,name,value="",type="text",required=false) {
  return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + escape(value) + '"' +
    (required ? " required" : "") + (type==="number" ? ' min="1" step="1"' : "") + '></label>';
}

function select(label,name,values,value) {
  return '<label>' + label + '<select name="' + name + '">' + values.map(([key,text]) =>
    '<option value="' + escape(key) + '"' + selected(key,value) + '>' + escape(text) + '</option>').join("") + '</select></label>';
}

function sourceLink(value) {
  if (/^imports\/sources\/(?:itc-taf-2026\.png|suave-taf-2026\.jpg|apa-taf-2026\.jpg)$/.test(value)) {
    return '<a href="sources/' + escape(value.split("/").pop()) + '" target="_blank" rel="noopener noreferrer">' + tr("查看来源截图", "View source screenshot") + '</a>';
  }
  try {
    const url = new URL(value);
    if (["https:","http:"].includes(url.protocol)) return '<a href="' + escape(url.href) + '" target="_blank" rel="noopener noreferrer">' + tr("查看来源", "View source") + '</a>';
  } catch {}
  return escape(value);
}

function imageField(image = "") {
  const heading = tr("项目图片（可选）", "Thumbnail (Optional)");
  return '<div class="project-image-field"><span class="project-image-heading">' + heading + '</span>' +
    '<div class="project-image-panel' + (image ? ' has-image' : '') + '"><label class="image-upload">' +
    '<input class="project-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="' + heading + '">' +
    '<img class="image-preview" src="' + escape(image) + '" alt="' + tr("项目图片预览", "Thumbnail preview") + '"' + (image ? '' : ' hidden') + '>' +
    '<span class="image-upload-action">' + (image ? tr("更换图片", "Change") : tr("上传图片", "Upload")) + '</span></label>' +
    '<button type="button" class="remove-image" aria-label="' + tr("删除项目图片", "Remove thumbnail") + '"' + (image ? '' : ' hidden') + '>' + tr("删除", "Remove") + '</button></div></div>';
}

function bindProjectImage(form, initialImage = "") {
  const input = form.querySelector(".project-image-input");
  const image = form.querySelector(".image-preview");
  const panel = form.querySelector(".project-image-panel");
  const remove = form.querySelector(".remove-image");
  let current = initialImage;
  input.addEventListener("change", async () => {
    if (!input.files?.[0]) return;
    try {
      const file = input.files[0];
      if (file.size > 12_000_000) throw new Error(tr("原图请小于 12 MB", "Original image must be under 12 MB"));
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,240,240);
      bitmap.close();
      current = canvas.toDataURL("image/jpeg",.78);
      if (current.length > 335_000) throw new Error(tr("图片压缩后仍过大，请换一张图片", "Compressed image is still too large; try another image"));
      image.src = current;
      image.hidden = false;
      panel.classList.add("has-image");
      remove.hidden = false;
      form.querySelector(".image-upload-action").textContent = tr("更换图片", "Change");
    } catch (error) {
      input.value = "";
      const box = form.querySelector(".form-error");
      box.textContent = tr("无法读取图片：", "Cannot read image: ") + error.message;
      box.hidden = false;
    }
  });
  remove.onclick = () => {
    current = "";
    input.value = "";
    image.removeAttribute("src");
    image.hidden = true;
    panel.classList.remove("has-image");
    remove.hidden = true;
    form.querySelector(".image-upload-action").textContent = tr("上传图片", "Upload");
  };
  return () => current;
}

function projectQuantityFields(skuValue = "", assetValue = "", category = DEFAULT_CATEGORY, required = false) {
  const meta = categoryMeta(category);
  return '<div class="pair' + (meta.hasSku ? '' : ' single-field') + '" data-quantity-pair>' +
    '<label data-sku-field' + (meta.hasSku ? '' : ' hidden') + '><span>' + tr("SKU 数量", "SKU Count") + '</span><input name="skuQuantity" type="number" min="1" step="1" value="' +
    escape(skuValue) + '"' + (required && meta.hasSku ? ' required' : '') + (meta.hasSku ? '' : ' disabled') + '></label>' +
    '<label data-asset-field><span data-asset-label>' + escape(meta.assetFieldLabel) + '</span><input name="assetQuantity" type="number" min="1" step="1" value="' +
    escape(assetValue) + '"' + (required ? ' required' : '') + '></label></div>';
}

const addDeliveryBtnLabel = (meta) => isEn() ? ("+ Add " + meta.deliveryLabel + " Date") : ("+ 添加" + (meta.deliveryLabel === "PSD" ? " PSD 交付日" : meta.deliveryLabel + "交付日"));
const planHintText = (meta) => isEn() ?
  ("Guangzhou time. R1 starts by its configured lead workdays; subsequent rounds start from the previous node. " + meta.deliveryName + " can be added or removed.") :
  ("日期以广州为准。R1 从节点前设定的工作日开始；后续轮次从上一节点开始。" + meta.deliveryName + "日可按需添加或移除。");

function bindProjectCategory(form, required = false) {
  const categorySelect = form.elements.namedItem("category");
  if (!categorySelect) return;
  const pair = form.querySelector("[data-quantity-pair]");
  const skuField = form.querySelector("[data-sku-field]");
  const skuInput = form.elements.namedItem("skuQuantity");
  const assetLabel = form.querySelector("[data-asset-label]");
  const sync = () => {
    const category = categorySelect.value || DEFAULT_CATEGORY;
    const meta = categoryMeta(category);
    if (pair && skuField && skuInput) {
      pair.classList.toggle("single-field", !meta.hasSku);
      skuField.hidden = !meta.hasSku;
      skuInput.disabled = !meta.hasSku;
      skuInput.required = required && meta.hasSku;
    }
    if (assetLabel) assetLabel.textContent = meta.assetFieldLabel;
    const addPsd = form.querySelector("#add-plan-psd");
    if (addPsd) addPsd.textContent = addDeliveryBtnLabel(meta);
    const planHint = form.querySelector("[data-plan-hint]");
    if (planHint) planHint.textContent = planHintText(meta);
    const deliveryRow = form.querySelector('.plan-node[data-plan-type="delivery"]');
    if (deliveryRow) {
      const dateLabel = meta.deliveryLabel + tr(" 交付日期", " Delivery Date");
      const strong = deliveryRow.querySelector(".plan-node-head strong");
      if (strong) strong.textContent = dateLabel;
      deliveryRow.querySelector("[data-plan-date]")?.setAttribute("aria-label", dateLabel);
      refreshSideLabels(deliveryRow, category);
    }
  };
  categorySelect.addEventListener("change", sync);
  sync();
}

function createProject() {
  const brandOptions = brandDatalistOptions();
  const defaultCategory = view.category || DEFAULT_CATEGORY;
  const firstDate = currentGuangzhouDate();
  const secondDate = workdaysAfter(firstDate,3);
  const projectId = crypto.randomUUID();
  const initialNodes = [{type:"R1",name:"R1",date:firstDate},
    {type:"R2",name:"R2",date:secondDate},
    {type:"delivery",name:deliveryNameFor(defaultCategory),date:workdaysAfter(secondDate,3)}];
  drawer(tr("新建项目", "New Project"), '<form class="editor project-form" id="project-form">' +
    '<section class="form-section"><div class="project-identity"><div class="project-identity-fields">' + field(tr("项目名称", "Project Name"),"name","","text",true) +
    '<label>' + tr("品牌", "Brand") + '<input name="brand" list="brand-options" value="' + escape(view.brand || find(view.project)?.brand || "") +
    '" required></label><datalist id="brand-options">' + brandOptions + '</datalist></div>' + imageField() + '</div>' +
    select(tr("项目类别", "Category"),"category",categoryOptions,defaultCategory) +
    projectQuantityFields(1,1,defaultCategory,true) + '</section>' +
    projectPlanSection({id:projectId,category:defaultCategory,r1LeadDays:3,roundGapDays:3},initialNodes) +
    '<p class="form-error" role="alert" hidden></p><button class="primary" type="submit">' + tr("创建项目", "Create Project") + '</button></form>');
  const form = $("#project-form");
  const selectedImage = bindProjectImage(form);
  const collectProjectPlan = bindProjectPlan(form,{id:projectId,category:defaultCategory});
  bindProjectCategory(form, true);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    errorBox.hidden = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      const targetCategory = values.category || DEFAULT_CATEGORY;
      const meta = categoryMeta(targetCategory);
      const {nodes,sideNodes} = collectProjectPlan();
      const dates = nodes.map((node)=>node.date);
      const normalized = values.name.trim().replace(/\s+/g," ").toLowerCase();
      if (projects().some((project) => project.status !== "已归档" &&
          projectCategory(project) === targetCategory &&
          project.name.trim().replace(/\s+/g," ").toLowerCase() === normalized)) {
        throw new Error(tr("当前类别下这个产品已有项目，请在现有项目中添加节点", "A project with this name already exists in this category"));
      }
      const project = {id:projectId,kind:"project",category:targetCategory,name:values.name.trim(),brand:resolveBrandInput(values.brand),status:"制作中",
        ...(meta.hasSku ? {skuQuantity:Number(values.skuQuantity)} : {}),
        assetQuantity:Number(values.assetQuantity),
        r1LeadDays:Number(values.r1LeadDays),roundGapDays:Number(values.roundGapDays),image:selectedImage()};
      button.disabled = true;
      await api("project-plan",{project,nodes,sideNodes});
      if (view.category && view.category !== targetCategory) {
        view.category = targetCategory;
        localStorage.setItem("taf-project-category-v1", view.category);
      }
      view.project=projectId;
      view.brand="";
      view.tab="timeline";
      view.month=dates[0]?.slice(0,7) || currentGuangzhouDate().slice(0,7);
      $("#drawer").close();
      await refresh();
      notify(nodes.length ? tr("项目与排期已创建", "Project and schedule created") : tr("项目已创建，可稍后添加排期", "Project created; you can add schedule nodes anytime"));
    } catch (error) {
      errorBox.hidden=false;
      errorBox.textContent=error.message;
    } finally {
      button.disabled=false;
    }
  });
}

function projectPlanNodes(projectId) {
  return data.entries.filter((entry) => entry.kind === "node" && entry.project === projectId &&
    (roundNumber(nodeType(entry)) || nodeType(entry) === "delivery"))
    .sort((a,b) => (roundNumber(nodeType(a)) || 100) - (roundNumber(nodeType(b)) || 100) ||
      (a.date || "").localeCompare(b.date || ""));
}

function projectPlanSideNodes(projectId) {
  return data.entries.filter((entry) => entry.kind === "node" && entry.project === projectId &&
    ["client","work","client-delivery"].includes(nodeType(entry)));
}

function sidePlanType(entry, projectId) {
  const plans = projectPlanNodes(projectId);
  const types = new Set(plans.map(nodeType));
  if (types.has(entry.round)) return entry.round;
  if (nodeType(entry) === "client-delivery" && types.has("delivery")) return "delivery";
  const namedRound = inferredSideRound(entry);
  if (types.has(namedRound)) return namedRound;
  const rounds = plans.filter((node)=>roundNumber(nodeType(node)));
  if (!rounds.length) return types.has("delivery") ? "delivery" : "";
  return nodeType(rounds.find((node)=>entry.date && entry.date <= node.date) || rounds.at(-1));
}

function sidePlanLabel(round, type, index = 1, category = DEFAULT_CATEGORY) {
  if (type !== "work") {
    const head = round === "delivery" ? deliveryLabelFor(category) : round;
    return isEn() ? (head + " Client Feedback") : (head + "客户反馈");
  }
  const number = roundNumber(round);
  const code = "R" + Math.max(0,number - 1) + "." + index;
  return isEn() ? (code + " Internal") : (code + "内部反馈");
}

function projectSideRow(entry, label) {
  const client = nodeType(entry) !== "work";
  const generated = !entry.id || entry.name === label ||
    (client ? /^(?:R\d+|PSD|终稿|成片|Final|Master)\s*(?:客户反馈|Client Feedback)$/i.test(entry.name) : /^R\d+[.．]\d+\s*(?:内部反馈|Internal(?: Feedback)?)$/i.test(entry.name));
  const original = entry.id && !generated ? '<small class="plan-side-original" title="' + escape(entry.name) + '">' + escape(entry.name) + '</small>' : "";
  const marker = '<span class="plan-side-marker" aria-hidden="true" style="color:' + paletteColor(client ? "client" : "work") + '">' + (client ? "●" : "◆") + '</span>';
  const dateAria = isEn() ? (label + " date") : (label + "日期");
  const remAria = isEn() ? ("Remove " + label) : ("移除" + label);
  return '<div class="plan-side-node" data-side-id="' + escape(entry.id || "") + '" data-side-type="' + escape(nodeType(entry)) + '" data-side-auto="' + (generated ? "1" : "0") + '">' +
    '<div class="plan-side-heading"><span class="plan-side-title">' + marker + '<span class="plan-side-label" data-side-label>' + escape(label) + '</span></span>' + original + '</div>' +
    '<input type="date" data-side-date aria-label="' + escape(dateAria) + '" value="' + escape(entry.date || "") + '" required>' +
    '<button type="button" class="plan-action" data-remove-side aria-label="' + escape(remAria) + '">' + tr("移除", "Remove") + '</button></div>';
}

function orderSideElements(list) {
  const sides = [...list.querySelectorAll(".plan-side-node")];
  list.append(...sides.filter((side)=>side.dataset.sideType === "work"),
    ...sides.filter((side)=>side.dataset.sideType !== "work"));
}

function refreshSideLabels(row, category = DEFAULT_CATEGORY) {
  const list = row.querySelector(".plan-side-list");
  orderSideElements(list);
  let internal = 0;
  for (const side of list.querySelectorAll(".plan-side-node")) {
    const label = sidePlanLabel(row.dataset.planType,side.dataset.sideType,
      side.dataset.sideType === "work" ? ++internal : 1, category);
    side.querySelector("[data-side-label]").textContent = label;
    side.querySelector("[data-side-date]").setAttribute("aria-label", isEn() ? (label + " date") : (label + "日期"));
    side.querySelector("[data-remove-side]").setAttribute("aria-label", isEn() ? ("Remove " + label) : ("移除" + label));
  }
}

function projectPlanRow(entry, category) {
  const resolvedCategory = typeof category === "string" && categories[category] ? category : projectCategory(find(entry.project));
  const type = nodeType(entry);
  const label = type === "delivery" ? deliveryLabelFor(resolvedCategory) : type;
  const dateLabel = label + (type === "delivery" ? tr(" 交付日期", " Delivery Date") : tr(" 节点日期", " Date"));
  const sideNodes = entry.id ? projectPlanSideNodes(entry.project).filter((node)=>sidePlanType(node,entry.project)===type)
    .sort(compareSideNodes) : [];
  let internal = 0;
  const sideRows = sideNodes.map((node)=>projectSideRow(node,sidePlanLabel(type,nodeType(node),
    nodeType(node) === "work" ? ++internal : 1, resolvedCategory))).join("");
  const detail = entry.id && entry.name !== label && !isAutoDeliveryName(entry.name) ?
    '<small class="plan-node-name" title="' + escape(entry.name) + '">' + escape(entry.name) + '</small>' : "";
  return '<div class="plan-node' + (type === "delivery" ? ' plan-node-delivery' : '') + '" data-plan-type="' + escape(type) + '" data-plan-id="' + escape(entry.id || "") +
    '"><div class="plan-node-head"><strong>' + dateLabel + '</strong><div class="plan-node-tools">' +
    (type === "delivery" ? "" : '<button type="button" class="plan-action" data-add-side="work">' + tr("+ 内部节点", "+ Internal") + '</button>' +
      '<button type="button" class="plan-action" data-add-side="client">' + tr("+ 客户节点", "+ Client") + '</button>') +
    '<button type="button" class="plan-action" data-remove-plan>' + tr("移除", "Remove") + '</button></div></div>' +
    detail + '<label><input type="date" aria-label="' + dateLabel + '" data-plan-date value="' + escape(entry.date || "") +
    '" required></label><div class="plan-side-list"' + (sideRows ? "" : " hidden") + '>' + sideRows + '</div></div>';
}

function projectPlanSection(project, initialNodes) {
  const category = projectCategory(project);
  const meta = categoryMeta(category);
  const addDeliveryText = addDeliveryBtnLabel(meta);
  return '<section class="form-section project-plan-section"><div class="form-section-head"><h3>' + tr("排期节点", "Schedule Nodes") + '</h3>' +
    '<div class="plan-actions"><button type="button" class="plan-action" id="add-plan-round">' + tr("+ 添加轮次", "+ Add Round") + '</button>' +
    '<button type="button" class="plan-action" id="add-plan-psd">' + escape(addDeliveryText) + '</button></div></div>' +
    '<div class="plan-defaults"><label class="round-gap">' + tr("R1 提前 ", "R1 lead ") + '<input name="r1LeadDays" type="number" min="1" max="30" value="' +
    r1LeadDays(project) + '" required>' + tr(" 工作日", " workdays") + '</label>' +
    '<label class="round-gap">' + tr("新增轮次默认间隔 ", "Default round gap ") + '<input name="roundGapDays" type="number" min="1" max="30" value="' +
    roundGapDays(project) + '" required>' + tr(" 工作日", " workdays") + '</label></div>' +
    '<p class="hint" data-plan-hint>' + escape(planHintText(meta)) + '</p>' +
    '<div class="project-plan-list" id="project-plan-list">' + (initialNodes || projectPlanNodes(project.id)).map((node) => projectPlanRow(node, category)).join("") +
    '</div>' + projectUnassignedSideSection(project.id) + '</section>';
}

function projectUnassignedSideSection(projectId) {
  const nodes = projectPlanSideNodes(projectId).filter((node)=>!sidePlanType(node,projectId)).sort(compareSideNodes);
  let internal = 0;
  return '<div class="plan-unassigned"' + (nodes.length ? "" : " hidden") + '><strong>' + tr("其他时间节点", "Unassigned Nodes") + '</strong>' +
    '<div class="plan-side-list" data-unassigned-side>' + nodes.map((node)=>projectSideRow(node,
      nodeType(node) === "work" ? tr("内部节点 ", "Internal ") + (++internal) : tr("客户节点", "Client"))) .join("") + '</div></div>';
}

function bindProjectPlan(form, project) {
  const list = form.querySelector("#project-plan-list");
  const gapInput = form.elements.namedItem("roundGapDays");
  const formCategory = () => form.elements.namedItem("category")?.value || projectCategory(project);
  const updateButtons = () => {
    const types = [...list.children].map((row) => row.dataset.planType);
    form.querySelector("#add-plan-round").disabled = types.filter((type)=>roundNumber(type)).length >= 99;
    form.querySelector("#add-plan-psd").disabled = types.includes("delivery");
  };
  form.querySelector("#add-plan-round").onclick = () => {
    if (!gapInput.reportValidity()) return;
    const used = new Set([...list.children].map((row)=>roundNumber(row.dataset.planType)));
    const number = Array.from({length:99},(_,index)=>index+1).find((value)=>!used.has(value));
    if (!number) return;
    const nextRow = [...list.children].find((row) => (roundNumber(row.dataset.planType) || 100) > number);
    const previous = [...list.children].filter((row) => roundNumber(row.dataset.planType) < number &&
      roundNumber(row.dataset.planType)).at(-1)?.querySelector("[data-plan-date]").value;
    const next = nextRow?.dataset.planType === "delivery" ? "" : nextRow?.querySelector("[data-plan-date]").value;
    const node = document.createElement("template");
    node.innerHTML = projectPlanRow({type:"R"+number,name:"R"+number,
      date:previous ? workdaysAfter(previous,Number(gapInput.value)) :
        next ? workdaysBefore(next,Number(gapInput.value)) : currentGuangzhouDate()}, formCategory());
    if (nextRow) nextRow.before(node.content);
    else list.append(node.content);
    list.querySelector('[data-plan-type="R' + number + '"] [data-plan-date]').focus();
    updateButtons();
  };
  form.querySelector("#add-plan-psd").onclick = () => {
    if (!gapInput.reportValidity()) return;
    const category = formCategory();
    const previous = [...list.children].filter((row)=>roundNumber(row.dataset.planType))
      .at(-1)?.querySelector("[data-plan-date]").value;
    list.insertAdjacentHTML("beforeend",projectPlanRow({type:"delivery",name:deliveryNameFor(category),
      date:previous ? workdaysAfter(previous,Number(gapInput.value)) : currentGuangzhouDate()}, category));
    list.lastElementChild.querySelector("[data-plan-date]").focus();
    updateButtons();
  };
  list.onclick = (event) => {
    const row = event.target.closest(".plan-node");
    if (!row) return;
    const addSide = event.target.closest("[data-add-side]");
    if (addSide) {
      const type = addSide.dataset.addSide;
      const roundDate = row.querySelector("[data-plan-date]").value;
      const sideList = row.querySelector(".plan-side-list");
      sideList.insertAdjacentHTML("beforeend",projectSideRow({
        type,date:roundDate ? iso(stamp(roundDate) + (type === "client" ? day : -day)) : ""
      },""));
      const added = sideList.lastElementChild;
      sideList.hidden = false;
      refreshSideLabels(row, formCategory());
      added.querySelector("[data-side-date]").focus();
    } else if (event.target.closest("[data-remove-side]")) {
      event.target.closest(".plan-side-node").remove();
      refreshSideLabels(row, formCategory());
      row.querySelector(".plan-side-list").hidden = !row.querySelector(".plan-side-node");
    } else if (event.target.closest("[data-remove-plan]")) {
      const unassigned = form.querySelector("[data-unassigned-side]");
      unassigned.append(...row.querySelectorAll(".plan-side-node"));
      orderSideElements(unassigned);
      unassigned.closest(".plan-unassigned").hidden = !unassigned.children.length;
      row.remove();
      updateButtons();
    }
  };
  const unassigned = form.querySelector("[data-unassigned-side]");
  unassigned.onclick = (event) => {
    const remove = event.target.closest("[data-remove-side]");
    if (!remove) return;
    remove.closest(".plan-side-node").remove();
    unassigned.closest(".plan-unassigned").hidden = !unassigned.children.length;
  };
  updateButtons();
  return () => {
    const category = formCategory();
    const defaultDelivery = deliveryNameFor(category);
    const rows = [...list.children];
    const present = new Set(rows.map((row)=>row.dataset.planId).filter(Boolean));
    const removed = projectPlanNodes(project.id).filter((node)=>!present.has(node.id))
      .map((node)=>({id:node.id,version:node.version}));
    const nodes = [];
    const sideNodes = [];
    for (const row of rows) {
      const old = row.dataset.planId ? find(row.dataset.planId) : null;
      const type = row.dataset.planType;
      const date = row.querySelector("[data-plan-date]").value;
      if (!date) throw new Error(isEn() ? ("Please enter a date for " + (type === "delivery" ? defaultDelivery : type)) : ("请填写 " + (type === "delivery" ? defaultDelivery : type) + " 日期"));
      const name = old ? (
        /^R\d+$/.test(old.name) && roundNumber(type) ? type :
        type === "delivery" && isAutoDeliveryName(old.name) ? defaultDelivery :
        old.name
      ) : (type === "delivery" ? defaultDelivery : type);
      if (old && old.date === date && nodeType(old) === type && old.name === name) continue;
      nodes.push(old ? {...old,date,type,name} : {id:crypto.randomUUID(),kind:"node",project:project.id,
        name,type,date,status:"未开始"});
    }
    for (const side of form.querySelectorAll(".plan-side-node")) {
      const old = side.dataset.sideId ? find(side.dataset.sideId) : null;
      const name = side.dataset.sideAuto === "1" ? side.querySelector("[data-side-label]").textContent : old?.name || side.querySelector("[data-side-label]").textContent;
      const date = side.querySelector("[data-side-date]").value;
      if (!name || !date) throw new Error(tr("请填写客户／内部节点的名称和日期", "Please enter a name and date for client/internal nodes"));
      const type = side.dataset.sideType;
      const round = side.closest(".plan-node")?.dataset.planType || "";
      if (old && old.name === name && old.date === date && nodeType(old) === type && (!old.round || old.round === round)) continue;
      sideNodes.push(old ? {...old,name,date,type,round} : {id:crypto.randomUUID(),kind:"node",project:project.id,
        name,date,type,round,status:"未开始"});
    }
    const presentSide = new Set([...form.querySelectorAll(".plan-side-node")].map((side)=>side.dataset.sideId).filter(Boolean));
    const removedSideNodes = projectPlanSideNodes(project.id).filter((node)=>!presentSide.has(node.id))
      .map((node)=>({id:node.id,version:node.version}));
    const dates = rows.map((row)=>row.querySelector("[data-plan-date]").value);
    if (dates.some((date,index)=>index && date <= dates[index-1]))
      throw new Error(isEn() ? ("Order node dates sequentially: R1, subsequent rounds, then " + deliveryLabelFor(category)) : ("请按 R1、后续轮次、" + deliveryLabelFor(category) + " 的顺序设置节点日期"));
    return {nodes,removed,sideNodes,removedSideNodes};
  };
}

function edit(kind, entry = {}, readOnly = false) {
  if (kind === "node") {
    const project = find(entry.project || view.project);
    if (project) return edit("project",project,readOnly);
    notify(tr("请先选择项目，再编辑排期节点。", "Select a project first to edit schedule nodes."));
    return;
  }
  const selectableProjects = kind === "sku" ?
    projects().filter((p) => categoryMeta(p).hasSku && (p.status !== "已归档" || p.id === entry.project)) :
    categoryProjects().filter((p) => p.status !== "已归档" || p.id === entry.project);
  if (kind !== "project" && !selectableProjects.length) {
    notify(kind === "sku" ? tr("当前类别无 Digital Twins 项目，请先新建对应项目。", "No Digital Twins projects yet; please create one first.") : tr("当前类别下还没有项目，请先新建项目。", "No projects in this category yet; please create one first."));
    return createProject();
  }
  const initialCategory = kind === "project" ? (entry.id ? projectCategory(entry) : (view.category || DEFAULT_CATEGORY)) :
    (find(entry.project || view.project) ? projectCategory(find(entry.project || view.project)) : view.category);
  const activeMeta = initialCategory ? categoryMeta(initialCategory) : null;
  let fields = kind === "project" ?
    '<div class="project-identity"><div class="project-identity-fields">' + field(tr("项目名称", "Project Name"),"name",entry.name,"text",true) +
    '<label>' + tr("品牌", "Brand") + '<input name="brand" list="edit-brand-options" value="' + escape(entry.brand || "") + '" required></label><datalist id="edit-brand-options">' + brandDatalistOptions() + '</datalist></div>' + imageField(entry.image) + '</div>' :
    field(tr("名称", "Name"),"name",entry.name,"text",true);
  if (kind === "project") {
    fields += '<div class="pair">' + select(tr("项目类别", "Category"),"category",categoryOptions,initialCategory) +
      select(tr("项目状态", "Status"),"status",projectStatuses.map((s)=>[s,tStatus(s)]),entry.status || "待确认") + '</div>';
    fields += projectQuantityFields(entry.skuQuantity ?? "", entry.assetQuantity ?? "", initialCategory, false);
    if (entry.id) fields += projectPlanSection(entry);
  } else {
    fields += select(tr("项目", "Project"),"project",selectableProjects.map((p)=>[p.id, !view.category ? "[" + categoryMeta(p).short + "] " + p.name : p.name]),entry.project || view.project);
  }
  if (kind === "note") {
    fields += select(tr("记录类型", "Log Type"),"type",["进展","反馈","交付"].map((s)=>[s,tNoteType(s)]),entry.type || "进展");
    fields += field(tr("发生日期", "Date"),"date",entry.date ?? data.today,"date");
  } else if (["sku","asset","revision"].includes(kind)) {
    fields += field(kind==="revision" ? tr("修改实际开始日期", "Actual Revision Start Date") : tr("实际首次开工日期", "Actual Start Date"),"actual",entry.actual,"date");
    const allowSkuField = kind === "sku" || !activeMeta || activeMeta.hasSku;
    if (allowSkuField) fields += field(tr("SKU 编码 / 稳定名称", "SKU Code / Identifier"),"sku",entry.sku,"text",kind==="sku");
    if (kind === "asset") {
      const qtyLabel = activeMeta ? activeMeta.quantityFieldLabel : tr("图片 / 资产数量", "Image / Asset Qty");
      fields += field(qtyLabel,"quantity",entry.quantity,"number",true);
    }
    if (kind === "revision") fields += field(tr("实际完成日期", "Actual Completion Date"),"end",entry.end,"date");
  }
  fields += '<label>' + tr("备注", "Notes") + '<textarea name="memo" rows="4">' + escape(entry.memo) + '</textarea></label>';
  if (entry.source) fields += '<p class="hint">' + sourceLink(entry.source) + '</p>';
  const linkedCount = kind === "project" && entry.id ? data.entries.filter((item)=>item.project===entry.id).length : 0;
  const confirmDeleteTitle = isEn() ? ("Delete " + entry.name + "?") : ("确认删除 " + entry.name + "？");
  const confirmDeleteDesc = isEn() ?
    ("This project and its " + linkedCount + " linked nodes, logs, and stat entries will be permanently removed. Type the exact project name to confirm.") :
    ("项目及其 " + linkedCount + " 条关联节点、记录和统计明细将被删除，无法在看板中恢复。请输入项目名称确认。");
  const deleteControls = kind === "project" && entry.id && !readOnly ?
    '<button type="button" class="delete-project-trigger" id="delete-project">' + tr("删除项目", "Delete Project") + '</button>' +
    '<section class="delete-project-confirm" id="delete-project-confirm" hidden><strong>' + escape(confirmDeleteTitle) + '</strong>' +
    '<p>' + escape(confirmDeleteDesc) + '</p>' +
    '<input id="delete-project-name" type="text" autocomplete="off" aria-label="' + tr("输入项目名称确认删除", "Type project name to confirm deletion") + '" placeholder="' + escape(entry.name) + '">' +
    '<div class="delete-project-actions"><button type="button" id="cancel-project-delete">' + tr("取消", "Cancel") + '</button>' +
    '<button type="button" id="confirm-project-delete" disabled>' + tr("确认删除", "Confirm Delete") + '</button></div></section>' : "";
  const topSave = kind === "project" && !!entry.id && !readOnly;
  const drawerKindLabel = kind === "asset" && activeMeta ? activeMeta.startEntryLabel : kindLabel(kind);
  const drawerVerb = entry.id ? (readOnly ? tr("查看", "View ") : tr("编辑", "Edit ")) : tr("新增", "New ");
  const seq = drawer(drawerVerb + drawerKindLabel,
    '<form class="editor" id="editor">' + fields + '<p class="form-error" role="alert" hidden></p>' + (topSave ? '' : '<button class="primary" type="submit">' + tr("保存", "Save") + '</button>') +
    deleteControls + '</form>' +
    (entry.id ? '<details class="history"><summary>' + tr("变更历史", "Change History") + '</summary><div id="history"></div></details>' : ""), {topSave});
  const editor = $("#editor");
  const selectedImage = kind === "project" ? bindProjectImage(editor,entry.image || "") : null;
  const collectProjectPlan = kind === "project" && entry.id && !readOnly ? bindProjectPlan(editor,entry) : null;
  if (kind === "project") bindProjectCategory(editor, false);
  if (deleteControls) {
    const confirmation = editor.querySelector("#delete-project-confirm");
    const nameInput = editor.querySelector("#delete-project-name");
    const confirmButton = editor.querySelector("#confirm-project-delete");
    editor.querySelector("#delete-project").onclick = () => {
      confirmation.hidden = false;
      nameInput.focus();
    };
    editor.querySelector("#cancel-project-delete").onclick = () => {
      confirmation.hidden = true;
      nameInput.value = "";
      confirmButton.disabled = true;
    };
    nameInput.oninput = () => { confirmButton.disabled = nameInput.value.trim() !== entry.name; };
    confirmButton.onclick = async () => {
      if (nameInput.value.trim() !== entry.name) return;
      confirmButton.disabled = true;
      const errorBox = editor.querySelector(".form-error");
      errorBox.hidden = true;
      try {
        const members = data.entries.filter((item)=>item.project===entry.id)
          .map((item)=>({id:item.id,version:item.version}));
        await api("project-delete",{id:entry.id,version:entry.version,confirmName:nameInput.value.trim(),members});
        $("#drawer").close();
        view.project = "";
        view.brand = "";
        await refresh();
        notify(isEn() ? ("Deleted project and " + members.length + " linked entries") : ("项目及其 " + members.length + " 条关联记录已删除"));
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
        confirmButton.disabled = false;
      }
    };
  }
  if (readOnly) {
    editor.querySelectorAll("input,select,textarea").forEach((control) => { control.disabled = true; });
    editor.querySelectorAll(".remove-image").forEach((button) => { button.hidden = true; });
    editor.querySelectorAll(".plan-action").forEach((button) => { button.hidden = true; });
    const action = editor.querySelector('button[type="submit"]');
    action.type = "button";
    action.textContent = tr("登录后编辑", "Sign In to Edit");
    action.onclick = () => withEditor(() => edit(kind,entry));
  }
  editor.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (readOnly) return;
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]') || $("#drawer-save");
    const values = Object.fromEntries(new FormData(form));
    if (kind === "asset") values.quantity = Number(values.quantity);
    if (kind === "project") {
      values.brand = resolveBrandInput(values.brand);
      values.category = values.category || projectCategory(entry);
      for (const key of ["skuQuantity","assetQuantity"]) {
        if (values[key]) values[key] = Number(values[key]);
        else delete values[key];
      }
      if (!categoryMeta(values.category).hasSku) delete values.skuQuantity;
      values.r1LeadDays = Number(values.r1LeadDays);
      if (entry.id) values.roundGapDays = Number(values.roundGapDays);
      values.image = selectedImage();
    }
    button.disabled = true;
    form.querySelector(".form-error").hidden = true;
    try {
      const productName = (name) => name.trim().replace(/\s+/g," ").toLowerCase();
      if (kind === "project" && values.status !== "已归档" && projects().some((project) =>
        project.id !== entry.id && project.status !== "已归档" &&
        projectCategory(project) === values.category &&
        productName(project.name) === productName(values.name))) {
        throw new Error(tr("当前类别下这个产品已有项目，请在现有项目中添加节点", "A project with this name already exists in this category"));
      }
      const projectData = {...entry,...values,kind,id:entry.id || crypto.randomUUID()};
      if (kind === "project") {
        if (!values.assetQuantity) delete projectData.assetQuantity;
        if (!categoryMeta(values.category).hasSku || !values.skuQuantity) delete projectData.skuQuantity;
      }
      const plan = collectProjectPlan ? collectProjectPlan() : null;
      const result = plan ? await api("project-plan-edit",{project:projectData,...plan}) : await api("entry",projectData);
      const saved = plan ? result.project : result;
      if (kind === "project") {
        if (view.category && view.category !== projectCategory(saved)) {
          view.category = projectCategory(saved);
          localStorage.setItem("taf-project-category-v1", view.category);
        }
        view.project = saved.id;
      }
      $("#drawer").close();
      await refresh();
      notify(tr("已保存", "Saved"));
    } catch (error) {
      const box = form.querySelector(".form-error");
      box.hidden = false;
      box.textContent = error.message;
      if (!$("#drawer").open) notify(error.message,true);
    } finally {
      button.disabled = false;
    }
  });
  if (entry.id) {
    api("history/" + entry.id).then((history) => {
      if (seq !== drawerSequence || !$("#history")) return;
      const labels = isEn() ?
        {name:"Name",brand:"Brand Code",fullName:"Full Name",color:"Color",category:"Category",project:"Project",sku:"SKU",status:"Status",type:"Round / Type",memo:"Notes",date:"Date",time:"GZ Time",start:"Planned Start",end:"End",actual:"Actual Date",quantity:"Quantity",skuQuantity:"SKU Count",assetQuantity:"Planned Qty",r1LeadDays:"R1 Lead Days",roundGapDays:"Round Gap Days"} :
        {name:"名称",brand:"品牌简称",fullName:"品牌全称",color:"颜色",category:"项目类别",project:"项目",sku:"SKU",status:"状态",type:"轮次 / 类型",memo:"备注",date:"日期",time:"广州时间",start:"计划开始",end:"结束",actual:"实际日期",quantity:"数量",skuQuantity:"SKU 数量",assetQuantity:"计划数量",r1LeadDays:"R1 提前工作日",roundGapDays:"轮次默认间隔工作日"};
      const displayVal = (key, val) => key === "category" ? (categories[val]?.label || val || "Digital Twins") :
        key === "status" && val ? tStatus(val) : (val || tr("空", "Empty"));
      const kvSep = tr("：", ": ");
      const itemSep = tr("；", "; ");
      $("#history").innerHTML = history.map((change) => {
        const before = JSON.parse(change.before);
        const after = JSON.parse(change.after);
        const changes = before && after ? Object.entries(labels).filter(([key]) => before[key] !== after[key])
          .map(([key,label]) => label + kvSep + displayVal(key, before[key]) + " → " + displayVal(key, after[key])).join(itemSep) :
          after ? tr("创建记录", "Created") : tr("撤销导入", "Undone import");
        return '<p><strong>' + escape(change.actor) + '</strong> <span class="muted">' +
          escape(change.time.slice(0,16).replace("T"," ")) + '</span><br>' + escape(changes || tr("保存记录", "Saved")) + '</p>';
      }).join("") || '<p class="hint">' + tr("暂无变更。", "No changes recorded.") + '</p>';
    }).catch((error) => {
      if (seq === drawerSequence && $("#history")) $("#history").textContent = error.message;
    });
  }
}

function colorPickerField(label, value, includeReset = true) {
  const normalized = (value || "#315fcd").toLowerCase();
  const hexAria = isEn() ? (label + " hex") : (label + "色值");
  const presetGroupAria = tr("快捷预设色", "Preset colors");
  const presetLabel = tr("预设色 ", "Preset ");
  return '<div class="color-field"><span class="color-field-label">' + escape(label) + '</span>' +
    '<div class="color-picker-row">' +
    '<input name="color" type="color" value="' + escape(normalized) + '" aria-label="' + escape(label) + '">' +
    '<input type="text" class="color-hex-input" data-color-hex value="' + escape(normalized.toUpperCase()) + '" maxlength="7" spellcheck="false" autocomplete="off" aria-label="' + escape(hexAria) + '">' +
    (includeReset ? '<button type="button" class="color-reset-btn" data-color-reset>' + tr("恢复默认色", "Reset Default") + '</button>' : '') +
    '</div><div class="color-swatches" role="group" aria-label="' + presetGroupAria + '">' +
    COLOR_PRESETS.map((preset) => '<button type="button" class="color-preset" data-color-preset="' + preset +
      '" aria-pressed="' + (preset === normalized) + '" aria-label="' + presetLabel + preset.toUpperCase() + '" title="' + preset.toUpperCase() +
      '" style="--preset:' + preset + '"></button>').join("") + '</div></div>';
}

function bindColorPicker(form, defaultColor, onChange) {
  const colorInput = form.elements.namedItem("color");
  const hexInput = form.querySelector("[data-color-hex]");
  const resetBtn = form.querySelector("[data-color-reset]");
  const presets = [...form.querySelectorAll("[data-color-preset]")];
  const syncUI = (hex, updateText = true) => {
    const clean = hex.toLowerCase();
    colorInput.value = clean;
    if (updateText && hexInput) hexInput.value = clean.toUpperCase();
    for (const btn of presets) btn.setAttribute("aria-pressed", String(btn.dataset.colorPreset === clean));
    onChange?.(clean);
  };
  colorInput.addEventListener("input", () => syncUI(colorInput.value));
  if (hexInput) {
    hexInput.addEventListener("input", () => {
      const raw = hexInput.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(raw)) syncUI(raw.startsWith("#") ? raw : "#" + raw, false);
    });
    hexInput.addEventListener("blur", () => {
      const raw = hexInput.value.trim();
      if (/^#?[0-9a-fA-F]{3}$/.test(raw)) {
        const chars = raw.replace("#", "");
        syncUI("#" + [...chars].map((c) => c + c).join(""));
      } else if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
        syncUI(raw.startsWith("#") ? raw : "#" + raw);
      } else {
        hexInput.value = colorInput.value.toUpperCase();
      }
    });
  }
  for (const btn of presets) btn.addEventListener("click", () => syncUI(btn.dataset.colorPreset));
  if (resetBtn) resetBtn.addEventListener("click", () => syncUI(typeof defaultColor === "function" ? defaultColor() : defaultColor));
  syncUI(colorInput.value);
  return () => colorInput.value.toLowerCase();
}

function editBrandColor(brand) {
  const setting = brandSetting(brand);
  const initialColor = brandColor(brand);
  const initialFull = setting?.fullName || "";
  const projectCount = projects().filter((p) => p.brand === brand).length;
  const deliveryText = view.category ? deliveryLabelFor(view.category) : tr("交付节点", "Delivery nodes");
  const brandHint1 = isEn() ?
    ("Short code appears in compact sidebars and sheet columns; Full Name appears in page headers and monthly stats. Renaming updates all " + projectCount + " projects under this brand.") :
    ("侧栏与排期表窄列显示简称，页面标题与月度统计优先展示全称。修改简称将同步更新该品牌下全部 " + projectCount + " 个项目。");
  const brandHint2 = isEn() ?
    ("R1 uses the primary color; later rounds lighten progressively. " + deliveryText + " and other marker colors can be set from the timeline legend.") :
    ("R1 使用主色，后续轮次逐渐变浅。" + deliveryText + "与其他节点颜色可在图例中设置。");
  drawer(brandDisplay(brand, "both") + tr(" · 品牌设置", " · Brand Settings"), '<form class="editor" id="brand-color-form">' +
    '<div class="pair">' +
    '<label>' + tr("品牌简称", "Short Code") + '<input name="brand" type="text" maxlength="40" value="' + escape(brand) + '" placeholder="' + tr("如 SDJ", "e.g. SDJ") + '" required></label>' +
    '<label>' + tr("品牌全称", "Full Name") + '<input name="fullName" type="text" maxlength="120" value="' + escape(initialFull) + '" placeholder="' + tr("选填，如 Sol de Janeiro", "Optional, e.g. Sol de Janeiro") + '"></label>' +
    '</div>' +
    '<p class="hint">' + escape(brandHint1) + '</p>' +
    colorPickerField(tr("R1 品牌主色", "R1 Brand Color"), initialColor, true) +
    '<div class="brand-color-preview" id="brand-color-preview"></div>' +
    '<p class="hint">' + escape(brandHint2) + '</p>' +
    '<p class="form-error" role="alert" hidden></p><button class="primary" type="submit">' + tr("保存品牌设置", "Save Brand Settings") + '</button></form>');
  const form = $("#brand-color-form");
  const shortInput = form.elements.namedItem("brand");
  const fullInput = form.elements.namedItem("fullName");
  const preview = (hex) => {
    const tones = [1,2,3,4].map((round) => {
      const bg = mixWhite(hex, roundTint(round));
      return '<span style="background:' + bg + ';color:' + colorInk(bg) + '">R' + round + '</span>';
    }).join("");
    $("#brand-color-preview").innerHTML = tones + '<span class="psd" style="background:' + paletteColor("psd") + ';color:' + colorInk(paletteColor("psd")) + '">' + escape(view.category ? deliveryLabelFor(view.category) : "PSD") + '</span>';
  };
  const getColor = bindColorPicker(form, () => defaultBrandColor(shortInput.value.trim() || brand), preview);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    const nextBrand = shortInput.value.trim();
    const nextFull = fullInput.value.trim();
    if (!nextBrand) {
      errorBox.hidden = false;
      errorBox.textContent = tr("请填写品牌简称", "Please enter a brand short code");
      return;
    }
    button.disabled = true;
    errorBox.hidden = true;
    try {
      const res = await api("brand-settings",{
        id:setting?.id || crypto.randomUUID(),
        version:setting?.version || 0,
        oldBrand:brand,
        brand:nextBrand,
        fullName:nextFull,
        color:getColor()
      });
      if (view.brand === brand) view.brand = nextBrand;
      if (view.collapsedBrands.has(brand) && nextBrand !== brand) {
        view.collapsedBrands.delete(brand);
        view.collapsedBrands.add(nextBrand);
      }
      $("#drawer").close();
      await refresh();
      notify(isEn() ?
        (brandDisplay(nextBrand, "both") + " brand settings updated" + (res.updatedProjects ? " (" + res.updatedProjects + " projects synced)" : "")) :
        (brandDisplay(nextBrand, "both") + " 品牌设置已更新" + (res.updatedProjects ? "（已同步 " + res.updatedProjects + " 个项目）" : "")));
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function editPaletteColor(slot) {
  const item = paletteSlots[slot];
  if (!item) return;
  const currentProject = find(view.project);
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const displayName = slot === "psd" ?
    (effectiveCategory ? deliveryLabelFor(effectiveCategory) : tr("交付节点（PSD / 终稿 / 成片）", "Delivery (PSD / Final / Master)")) :
    paletteSlotName(slot);
  const setting = paletteSetting(slot);
  drawer(displayName + tr(" · 图例颜色", " · Legend Color"), '<form class="editor" id="palette-color-form">' +
    colorPickerField(displayName + tr(" 颜色", " Color"), paletteColor(slot), true) +
    '<div class="palette-color-preview"><span id="palette-color-preview"></span><span>' + escape(displayName) + '</span></div>' +
    '<p class="hint">' + tr("此颜色应用于所有品牌的时间轴，团队成员会看到相同的设置。", "Applies across all brands on the timeline and syncs for all teammates.") + '</p>' +
    '<p class="form-error" role="alert" hidden></p>' +
    '<button class="primary" type="submit">' + tr("保存颜色", "Save Color") + '</button></form>');
  const form = $("#palette-color-form");
  const preview = (hex) => {
    const chip = $("#palette-color-preview");
    if (slot === "psd") {
      chip.style.background = hex;
      chip.style.color = colorInk(hex);
      chip.textContent = "";
    } else {
      chip.style.background = "transparent";
      chip.style.color = hex;
      chip.style.fontSize = "16px";
      chip.textContent = slot === "work" ? "◆" : slot === "client" ? "●" : "│";
    }
  };
  const getColor = bindColorPicker(form, item.color, preview);
  form.addEventListener("submit",async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    button.disabled = true;
    errorBox.hidden = true;
    try {
      await api("entry",{...setting,id:setting?.id || crypto.randomUUID(),kind:"palette",type:slot,name:item.name,color:getColor()});
      $("#drawer").close();
      await refresh();
      notify(isEn() ? (displayName + " color updated") : (displayName + "颜色已更新"));
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function importDrawer() {
  drawer(tr("导入记录", "Import JSON"), '<form id="import-form" class="editor"><label>' + tr("选择整理后的 JSON 批次", "Select Prepared JSON Batch") + '<input type="file" accept=".json,application/json" required></label>' +
    '<p class="hint">' + tr("选择由助手整理的批次文件。核对预览后提交。", "Choose a prepared batch JSON file, verify the preview, and submit.") + '</p><div id="import-preview"></div><p class="form-error" role="alert" hidden></p>' +
    '<button type="submit" class="primary" disabled>' + tr("确认导入", "Confirm Import") + '</button></form>' +
    '<div class="batch-list"><h2>' + tr("导入历史", "Import History") + '</h2>' + data.batches.map((batch) => '<div class="batch"><span>' + escape(batch.id) +
      '<br><small>' + escape(batch.time.slice(0,10)) + '</small></span>' +
      (batch.undone ? '<span>' + tr("已撤销", "Undone") + '</span>' : '<button data-undo="' + escape(batch.id) + '">' + tr("撤销", "Undo") + '</button>') + '</div>').join("") + '</div>');
  const form = $("#import-form");
  const input = form.querySelector("input");
  const submit = form.querySelector('button[type="submit"]');
  const errorBox = form.querySelector(".form-error");
  let batch = null;
  let selection = 0;
  input.addEventListener("change", async () => {
    const token = ++selection;
    submit.disabled = true;
    errorBox.hidden = true;
    form.querySelector("#import-preview").textContent = "";
    batch = null;
    try {
      if (!input.files.length) return;
      if (input.files[0].size > 4000000) throw new Error(tr("批次文件超过 4 MB", "Batch file exceeds 4 MB"));
      const result = JSON.parse(await input.files[0].text());
      if (selection !== token) return;
      if (!result?.id || !Array.isArray(result.entries) || !result.entries.length ||
          result.entries.some((item)=> !item?.id || !kinds[item.kind] || !item.name)) throw new Error(tr("批次缺少有效记录", "Batch contains invalid or empty records"));
      batch = result;
      const counts = Object.keys(kinds).map((kind) =>
        kindLabel(kind) + " " + result.entries.filter((item) => item.kind === kind).length);
      form.querySelector("#import-preview").innerHTML = '<p>' + escape(counts.join(" · ")) +
        '</p><details><summary>' + tr("查看批次内容", "Preview batch items") + '</summary><ul>' + result.entries.map((item) => '<li>' +
        escape(kindLabel(item.kind) + " · " + item.name + (item.actual || item.date ? " · " + (item.actual || item.date) : "")) +
        '</li>').join("") + '</ul></details>';
      submit.disabled = false;
    } catch (error) {
      if (selection === token) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!batch) return;
    submit.disabled = true;
    input.disabled = true;
    try {
      const result = await api("import",batch);
      $("#drawer").close();
      await refresh();
      notify(result.duplicate ? tr("这个批次已处理。", "This batch has already been imported.") : (isEn() ? ("Imported " + result.count + " records") : ("已导入 " + result.count + " 条记录")));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
      input.disabled = false;
    }
  });
}

function metricDrawer(index) {
  const currentProject = find(view.project);
  const brand = currentProject?.brand || view.brand;
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const active = categoryProjects().filter((p) => p.status !== "已归档" && (!brand || p.brand === brand));
  const ids = new Set(active.map((p) => p.id));
  const total = metrics(data.entries.filter((entry) => entry.kind !== "project" && ids.has(entry.project)), active);
  const def = statsMetricDefs(effectiveCategory, total)[index];
  if (!def) return;
  const items = def.items;
  drawer(def.name, '<p class="hint">' + escape(view.month) + ' · ' + escape(brand ? brandDisplay(brand, "both") : tr("全部品牌", "All Brands")) +
    '</p><div class="stack">' +
    (items.length ? items.map((entry) => def.kind === "r4" ? openButton(find(entry.project),entry.name + " · " + entry.round + " · " + entry.date) :
      def.kind === "asset" && entry.kind === "project" ? openButton(entry,entry.name + " · " + entry.quantity + " " + def.unit + " · " + entry.assetSource + " " + entry.r1Date) :
      openButton(entry,entry.name + " · " + find(entry.project)?.name +
      (entry.quantity ? " · " + entry.quantity + (def.unit ? " " + def.unit : "") : "") + (entry.actual ? " · " + entry.actual : tr(" · 待确认", " · Pending")))).join("") :
      '<p class="hint">' + tr("暂无符合条件的记录。", "No matching records.") + '</p>') + '</div>');
}

function changeMonth(delta) {
  const date = new Date(stamp(view.month + "-01"));
  date.setUTCMonth(date.getUTCMonth()+delta);
  view.month = date.toISOString().slice(0,7);
  render();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setCategoryMenuOpen(false);
    setMobileRailOpen(false);
  }
});

document.addEventListener("click", async (event) => {
  if (!event.target.closest?.("#category-dropdown")) setCategoryMenuOpen(false);
  if (event.target.id === "rail-backdrop") {
    setMobileRailOpen(false);
    return;
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "category-trigger") {
    setCategoryMenuOpen();
    return;
  }
  if (button.id === "mobile-projects-btn") {
    setCategoryMenuOpen(false);
    setMobileRailOpen();
    return;
  }
  if (button.id === "close-rail-drawer") {
    setMobileRailOpen(false);
    return;
  }
  const target = button.dataset;
  if ("langToggle" in target) {
    setLang(isEn() ? "zh" : "en");
    return;
  }
  if ("exportXlsx" in target) {
    button.disabled = true;
    try { await exportSheetXlsx(); } catch (error) { notify(error.message,true); }
    finally { button.disabled = false; }
    return;
  }
  if ("copySheet" in target) {
    try { await copyToGoogleSheet(); } catch (error) { notify(tr("复制失败：", "Copy failed: ") + error.message,true); }
    return;
  }
  if ("category" in target) {
    view.category = target.category;
    localStorage.setItem("taf-project-category-v1", view.category);
    if (view.project && !matchesCategory(find(view.project))) view.project = "";
    if (view.brand && !categoryProjects().some((p) => p.brand === view.brand && p.status !== "已归档")) view.brand = "";
    setCategoryMenuOpen(false);
    render();
    return;
  }
  if ("project" in target) {view.project=target.project; view.brand=""; setMobileRailOpen(false); render();}
  if ("brand" in target) {view.brand=target.brand; view.project=""; setMobileRailOpen(false); render();}
  if ("brandColor" in target) {setMobileRailOpen(false); withEditor(() => editBrandColor(target.brandColor));}
  if ("palette" in target) withEditor(() => editPaletteColor(target.palette));
  if ("toggleBrand" in target) {
    if (view.collapsedBrands.has(target.toggleBrand)) view.collapsedBrands.delete(target.toggleBrand);
    else view.collapsedBrands.add(target.toggleBrand);
    render();
  }
  if (target.productProject) {view.project=target.productProject; view.brand=""; view.tab="timeline"; render();}
  if (target.view) {view.tab=target.view; render();}
  if (target.scale) {view.scale=target.scale; render();}
  if (target.range) {view.range=target.range; localStorage.setItem("taf-timeline-range-v2",view.range); render();}
  if (target.zone) {view.zone=target.zone; render();}
  if (target.fold) {
    if (view.folded.has(target.fold)) view.folded.delete(target.fold);
    else view.folded.add(target.fold);
    render();
  }
  if (target.open) {
    const entry = find(target.open);
    if (entry) {
      const destination = entry.kind === "node" ? find(entry.project) : entry;
      if (destination) edit(destination.kind,destination,!editorAuth && !allowAnonymousEdits);
    }
  }
  if (target.phase) {
    const project = find(target.phaseProject);
    if (project) edit("project",project,!editorAuth && !allowAnonymousEdits);
  }
  if (target.points) {
    const entries = target.points.split(",").map(find).filter(Boolean);
    const project = find(entries[0]?.project);
    if (project) edit("project",project,!editorAuth && !allowAnonymousEdits);
  }
  if (target.metric) metricDrawer(Number(target.metric));
  if (target.kind) withEditor(() => edit(target.kind));
  if (target.undo && confirm(tr("撤销此导入批次？", "Undo this import batch?"))) {
    try {
      await api("undo",{id:target.undo});
      await refresh();
      importDrawer();
      notify(tr("已撤销导入", "Import batch undone"));
    } catch (error) {
      const p = document.createElement("p");
      p.className="form-error";
      p.setAttribute("role","alert");
      p.textContent=error.message;
      $("#drawer-body").prepend(p);
    }
  }
});

$("#close-drawer").onclick = () => $("#drawer").close();
$("#prev").onclick = () => changeMonth(-1);
$("#next").onclick = () => changeMonth(1);
$("#today").onclick = () => {
  view.month=todayInZone().slice(0,7);
  render();
  const chart = $(".chart");
  const todayTick = chart?.querySelector(".chart-fill .tick.today");
  if (!todayTick) return;
  const labelWidth = chart.querySelector(".chart-header .chart-label")?.getBoundingClientRect().width || 0;
  const targetX = labelWidth + (chart.clientWidth - labelWidth)/3;
  const lineX = todayTick.getBoundingClientRect().left - chart.getBoundingClientRect().left + chart.scrollLeft;
  chart.scrollTo({left:Math.max(0,lineX-targetX),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
};
$("#month").onchange = (event) => {
  if (/^\d{4}-\d{2}$/.test(event.target.value)) {
    view.month=event.target.value;
    render();
  }
};
$("#status-filter").onchange = (event) => {
  view.status=event.target.value;
  if (view.project && !matchesProjectStatus(find(view.project))) view.project="";
  render();
};
$("#auth-status").onclick = () => {
  if (editorAuth) {
    editorAuth = null;
    updateAuth();
    notify(allowAnonymousEdits ? tr("已退出账号，仍可匿名调试。", "Signed out; anonymous debugging remains enabled.") : tr("已退出编辑模式", "Signed out of edit mode"));
  } else {
    ensureAuth(true);
  }
};
$("#projects").addEventListener("scroll",updateProjectScrollHint,{passive:true});
window.addEventListener("resize", () => {
  updateProjectScrollHint();
  if (window.innerWidth > 760 && view.mobileRailOpen) setMobileRailOpen(false);
});
$("#add-project").onclick = () => { setMobileRailOpen(false); withEditor(createProject); };
const addProjectMobileBtn = $("#add-project-mobile");
if (addProjectMobileBtn) addProjectMobileBtn.onclick = () => { setMobileRailOpen(false); withEditor(createProject); };
$("#add-project-main").onclick = () => withEditor(createProject);
$("#edit-brand").onclick = () => { if (view.brand) withEditor(() => editBrandColor(view.brand)); };
$("#edit-project").onclick = () => withEditor(() => edit("project",find(view.project)));
$("#import-open").onclick = () => { setMobileRailOpen(false); importDrawer(); };
$("#add-entry").onclick = () => withEditor(() => {
  if (view.tab === "timeline") return;
  const currentProject = find(view.project);
  const effectiveCategory = currentProject ? projectCategory(currentProject) : view.category;
  const allowSku = !effectiveCategory || categoryMeta(effectiveCategory).hasSku;
  const types = view.tab === "notes" ? ["note","revision"] : allowSku ? ["sku","asset","revision"] : ["asset","revision"];
  const labels = Object.fromEntries(Object.keys(kinds).map((k) => [k, kindLabel(k)]));
  if (effectiveCategory) labels.asset = categoryMeta(effectiveCategory).startEntryLabel;
  drawer(view.tab==="notes" ? tr("添加记录", "Add Log") : tr("录入统计明细", "Add Stat Entry"),'<div class="stack">' +
    types.map((kind)=>'<button data-kind="'+kind+'">'+escape(labels[kind])+'</button>').join("")+'</div>');
});
renderStaticI18n();
refresh().catch((error)=>notify(error.message,true));
