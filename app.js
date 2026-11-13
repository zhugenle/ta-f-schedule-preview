"use strict";

const $ = (selector) => document.querySelector(selector);
const statuses = ["待确认", "未开始", "制作中", "待反馈", "修改中", "已完成", "已交付", "暂停", "已取消", "已归档"];
const projectStatuses = ["待确认", "制作中", "暂停", "已完成", "已归档"];
const kinds = {brand:"品牌颜色", palette:"图例颜色", project:"项目", node:"排期节点", note:"工作记录", sku:"SKU 开工", asset:"资产开工", revision:"修改轮次"};
const savedRange = localStorage.getItem("taf-timeline-range-v2");
const view = {project:"", brand:"", tab:"timeline", scale:"day", range:savedRange === "surrounding" ? "surrounding" : "month", zone:"Asia/Shanghai", month:"", status:"", folded:new Set(), collapsedBrands:new Set()};
const day = 86400000;
let data = {entries:[], batches:[], today:""};
let drawerSequence = 0;
let editorAuth = null;
let loginPending = null;
let allowAnonymousEdits = false;
const escape = (value = "") => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const find = (id) => data.entries.find((entry) => entry.id === id);
const projects = () => data.entries.filter((entry) => entry.kind === "project");
const defaultBrandColors = {SDJ:"#315fcd",ITC:"#7754cb",SUAVE:"#248f70",APA:"#1684aa"};
const fallbackBrandColors = ["#315fcd","#7754cb","#248f70","#1684aa","#b7526f","#a66b26"];
const defaultBrandColor = (brand) => defaultBrandColors[brand] || fallbackBrandColors[[...brand].reduce((sum,char)=>sum+char.charCodeAt(0),0)%fallbackBrandColors.length];
const brandSetting = (brand) => data.entries.find((entry)=>entry.kind==="brand" && entry.brand===brand);
const brandColor = (brand) => brandSetting(brand)?.color || defaultBrandColor(brand);
const paletteSlots = {psd:{name:"PSD",color:"#ffb454"},work:{name:"内部节点",color:"#3b8478"},client:{name:"客户节点",color:"#e13b83"},today:{name:"今天",color:"#3c7bff"}};
const paletteSetting = (slot) => data.entries.find((entry)=>entry.kind==="palette" && entry.type===slot);
const paletteColor = (slot) => paletteSetting(slot)?.color || paletteSlots[slot].color;
const mixWhite = (color, amount) => "#" + [1,3,5].map((offset) => Math.round(parseInt(color.slice(offset,offset+2),16)*(1-amount)+255*amount).toString(16).padStart(2,"0")).join("");
const roundTint = (number) => .86*(1-Math.exp(-(number-1)*.36));
const matchesProjectStatus = (project) => view.tab !== "timeline" || !view.status ||
  (project.status || "待确认") === view.status;
const visibleProjects = () => projects().filter((p) =>
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
const openButton = (entry, name = entry.name) => '<button type="button" data-open="' + escape(entry.id) + '" title="' + escape(name) + '">' + escape(name) + '</button>';
const projectThumb = (project) => project.image ? '<img class="project-thumb" src="' + escape(project.image) + '" alt="" loading="lazy">' : '';
const projectQuantity = (value) => Number.isInteger(value) && value > 0 ? String(value) : "待填";
const projectStatus = (project) => project.status || "待确认";
const sheetHeaders = ["日期（广州）","品牌","项目","节点类型","Task","Notes","状态","SKU","计划资产","缩略图"];
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
const projectInfo = (project) => '<span class="project-info"><span class="project-title">' + escape(project.name) +
  '</span><small class="project-counts"><span class="project-status">' + escape(projectStatus(project)) + '</span> · SKU ' + projectQuantity(project.skuQuantity) + ' · 资产 ' +
  projectQuantity(project.assetQuantity) + '</small></span>';

const basicToken = (username,password) => btoa(Array.from(new TextEncoder().encode(username + ":" + password),
  (byte) => String.fromCharCode(byte)).join(""));

function updateAuth() {
  const button = $("#auth-status");
  button.hidden = !editorAuth && !allowAnonymousEdits;
  button.textContent = editorAuth ? editorAuth.username + " · 退出编辑" : "账号登录（可选）";
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
      "登录后修改会记录你的账号；也可以关闭弹窗，继续免登录调试。" :
      "查看排期无需登录。修改内容时请使用你的团队账号。";
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
        if (!response.ok) throw new Error("账号或密码错误");
        const result = await response.json();
        if (!dialog.open) return;
        editorAuth = {username:result.username,token};
        updateAuth();
        finish(true);
      } catch (error) {
        if (!dialog.open) return;
        errorBox.textContent = error.message;
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
  if (payload !== undefined && !await ensureAuth()) throw new Error("已取消登录");
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
  if (!response.ok) throw new Error(result.error || "无法完成请求");
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
  if (view.project && !find(view.project)) view.project = "";
  render();
}

function render() {
  const project = find(view.project);
  if (view.tab === "notes") view.tab = "timeline";
  const currentBrand = project?.brand || view.brand;
  $("#scope").textContent = project ? [project.brand, projectStatus(project), `SKU ${projectQuantity(project.skuQuantity)}`, `交付资产 ${projectQuantity(project.assetQuantity)}`].join(" · ") : "";
  $("#heading").textContent = view.tab === "stats" ? (currentBrand ? currentBrand + " · 品牌统计" : "全部品牌统计") :
    project?.name || (view.brand ? view.brand + " · 项目" : "全部项目");
  $("#edit-project").hidden = !project;
  $("#month").value = view.month;
  $("#status-filter").value = view.status;
  $("#timeline-controls").hidden = view.tab !== "timeline";
  $("#add-entry").hidden = view.tab !== "stats";
  $("#add-entry").textContent = view.tab === "stats" ? "录入统计明细" : "";
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
  const group = new Map();
  for (const item of projects().filter((p) =>
    (p.status !== "已归档" || p.id === view.project || (view.tab === "timeline" && view.status === "已归档")) &&
    matchesProjectStatus(p))) {
    if (!group.has(item.brand)) group.set(item.brand, []);
    group.get(item.brand).push(item);
  }
  const projectButton = (item) => '<button class="project-link" data-project="' + escape(item.id) + '" aria-current="' +
    (item.id === view.project) + '" title="' + escape(item.name) + '">' + projectThumb(item) + projectInfo(item) + '</button>';
  const projectScroll = $("#projects").scrollTop;
  $("#projects").innerHTML = '<button class="all-projects" data-project="" aria-current="' +
    (!view.project && !view.brand) + '">全部项目</button>' + [...group].map(([brand, items], index) => {
    const collapsed = view.collapsedBrands.has(brand);
    const id = "brand-projects-" + index;
    return '<div class="brand-group"><div class="brand-header"><button class="brand-button" data-brand="' + escape(brand) + '" aria-current="' +
      (!view.project && view.brand === brand) + '"><span>' + escape(brand) + '</span><small>' + items.length +
      '</small></button><button type="button" class="brand-color-edit" data-brand-color="' + escape(brand) +
      '" aria-label="设置 ' + escape(brand) + ' 品牌色" title="设置品牌色" style="--brand-color:' + brandColor(brand) +
      '"><span aria-hidden="true"></span></button><button type="button" class="brand-toggle" data-toggle-brand="' + escape(brand) +
      '" aria-label="' + (collapsed ? '展开 ' : '收起 ') + escape(brand) + ' 项目" aria-controls="' + id +
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
    if (view.scale === "day") label = date === 1 ? month + "月1日" : date + "日";
    else if (view.scale === "week" && (i === 0 || weekday === 1)) {
      span = Math.min(count-i,weekday === 1 ? 7 : (8-weekday)%7);
      const last = new Date(time+(span-1)*day);
      label = month + "/" + date + "–" + (last.getUTCMonth()+1) + "/" + last.getUTCDate();
    } else if (view.scale === "month" && (i === 0 || date === 1)) {
      const next = new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,1));
      span = Math.min(count-i,Math.round((+next-time)/day));
      label = current.getUTCFullYear() + "年" + month + "月";
    }
    cells.push({column:i+1, date:iso(time), weekend:weekday===0 || weekday===6,
      label,span});
  }
  return cells;
}

function nodeType(entry) {
  if (entry.type) return /^(?:R[1-9]\d?|client|client-delivery|delivery|work|other)$/.test(entry.type) ? entry.type : "other";
  const delivery = /^(?:(?:客户|分层)\s*)?PSD\b/i.test(entry.name);
  if (/客户|feedback|greenlight/i.test(entry.name)) return delivery ? "client-delivery" : "client";
  return entry.name.match(/^(R[1-9]\d?)(?:\s*[:：]|$)/i)?.[1].toUpperCase() ||
    (delivery ? "delivery" : "other");
}
const isClient = (entry) => ["client","client-delivery"].includes(nodeType(entry));
const roundNumber = (type) => Number(type.match(/^R([1-9]\d?)$/)?.[1] || 0);
const phaseColor = (label,brand) => {
  if (label === "PSD") return paletteColor("psd");
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
  return moment.date + (moment.time ? " " + moment.time : view.zone === "America/New_York" ? "（按日期前移一天）" : "");
};
const todayInZone = () => {
  if (view.zone === "Asia/Shanghai") return data.today;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).map((part) => [part.type,part.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
};

function productSchedule(nodes, project) {
  const groups = new Map();
  const customers = [];
  const unassigned = [];
  for (const entry of nodes) {
    const type = nodeType(entry);
    if (type === "client") {
      customers.push(entry);
    } else if (type === "work") {
      unassigned.push(entry);
    } else if (roundNumber(type) || type === "delivery" || type === "client-delivery") {
      const label = roundNumber(type) ? type : "PSD";
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
    const number = label==="PSD" ? latest : roundNumber(label)-1;
    const previousLabel = number ? "R"+number : "";
    const previous = previousLabel ? active(previousLabel) : [];
    const end = current.length===1 ? timelineDate(current[0]) : "";
    const start = label==="R1" && end ? workdaysBefore(end,r1LeadDays(project)) :
      previous.length===1 ? timelineDate(previous[0]) : "";
    const issue = !current.length ? "已取消" : current.length>1 || previous.length>1 ? "节点待核对" :
      !end ? "日期待补齐" : !start ? (previousLabel || "制作轮次")+" 日期待补齐" :
      end<start ? "日期顺序待核对" : "";
    return {label,entries,current,previous,start,end,issue};
  });
  const clientRound = (entry) => entry.name.match(/^(R[1-9]\d?)\b/i)?.[1].toUpperCase();
  for (const entry of customers) {
    const label = clientRound(entry);
    const phase = label ? phases.find((item) => item.label === label) : phases.find((item) =>
      !item.issue && timelineDate(entry)>item.start && timelineDate(entry)<=item.end);
    if (phase) (phase.customers ??= []).push(entry);
    else unassigned.push(entry);
  }
  return {phases, unassigned, customers};
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
  const row = (label,lane,classes="") => '<div class="chart-row ' + classes +
    '"><div class="chart-label">' + label + '</div><div class="lane">' + lane + '</div></div>';
  const column = (date) => 1 + Math.round((stamp(date)-start)/day);
  const complete = (phase) => !phase.issue && phase.end>phase.start &&
    stamp(phase.start)<end && stamp(phase.end)>=start;
  const phaseAction = (project,phase) => ' data-phase="' + phase.label + '" data-phase-project="' + escape(project.id) + '"';
  const bar = (project,phase) => {
    const first = column(phase.start), last = column(phase.end);
    const left = Math.max(1,first), right = 1 + Math.min(cells.length,last);
    const dates = phase.start + " 至 " + phase.end;
    return '<button class="phase-bar' + (["已完成","已交付"].includes(phase.current[0]?.status) ? " done":"") +
      '" aria-label="' + phase.label + ' · ' + dates + '" title="' + dates + '"' + phaseAction(project,phase) +
      ' style="grid-column:' + left + '/' + right + ';--phase-color:' + phaseColor(phase.label,project.brand) +
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
      const key = date + (isClient(entry) ? "/client" : "/production");
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(entry);
    }
    return [...byDate.values()].map((group) => {
      const [entry] = group;
      const date = timelineDate(entry);
      const client = isClient(entry);
      const psd = group.some((item) => ["delivery","client-delivery"].includes(nodeType(item)));
      const tone = psd ? phaseColor("PSD") : !client && phaseColor(nodeType(entry),find(entry.project)?.brand);
      const label = momentLabel(entry) + " · " + group.map((item) => item.name + (item.status ? " · "+item.status : "")).join("；");
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
    const {phases,unassigned,customers} = productSchedule(nodes.filter((entry) => entry.project === project.id),project);
    const renderable = phases.map((phase) => {
      const own = phase.entries;
      const span = own.includes(phase.current[0]) && complete(phase) ? bar(project,phase) : "";
      const endpoints = own.filter((entry) => phase.label==="PSD" || !span || entry!==phase.current[0]);
      const points = markers([...endpoints, ...(phase.customers || [])]);
      return {phase,span,points,endpoints};
    }).filter(({span,points}) => span || points);
    const standalone = markers(unassigned);
    if (!renderable.length && !standalone && !overview) return "";
    const compact = overview || view.folded.has(project.id);
    const summary = renderable.map(({span}) => span).join("") + (compact ? markers([...new Set([
      ...unassigned, ...customers, ...renderable.flatMap(({endpoints}) => endpoints)
    ])]) : standalone);
    if (overview) {
      const label = projectThumb(project) + '<button data-project="' + escape(project.id) + '" title="' + escape(project.name) + '">' +
        projectInfo(project) + '</button>';
      return row(label,ticks + summary,"group-row overview-row");
    }
    const color = /^#[0-9a-f]{6}$/i.test(project.type || "") ? '<span class="source-swatch" style="background:' +
      project.type + '" title="来源表底色"></span>' : "";
    const groupLabel = '<button class="fold" data-fold="' + escape(project.id) + '" aria-expanded="' + !compact +
      '" aria-label="' + (compact ? "展开 " : "折叠 ") + escape(project.name) + '">' + (compact ? "▸" : "▾") + '</button>' +
      color + projectThumb(project) + '<button type="button" data-open="' + escape(project.id) + '" title="' +
      escape(project.name) + '">' + projectInfo(project) + '</button>';
    const phaseRows = renderable.map(({phase,span,points}) => {
      const dates = phase.issue ? "" : phase.start.slice(5) + " – " + phase.end.slice(5);
      const label = '<button' + phaseAction(project,phase) + '>' + phase.label + '</button>' +
        (phase.issue ? '<small class="phase-issue">' + escape(phase.issue) + '</small>' : '<span class="row-date">' + dates + '</span>');
      return row(label,ticks + span + points,"phase-row");
    }).join("");
    return row(groupLabel, ticks + summary, "group-row") + (compact ? "" : phaseRows);
  }).join("");
  const units = {day:"60px",week:"24px",month:"max(10px, calc((100cqw - var(--label) - 2px) / var(--weighted-days)))"};
  const legendRounds = [...new Set(nodes.map(nodeType).filter(roundNumber))].sort((a,b) => roundNumber(a)-roundNumber(b));
  const legendBrand = find(view.project)?.brand || view.brand;
  const legend = (legendBrand ? legendRounds.map((label) => '<span><i class="phase-swatch" aria-hidden="true" style="background:' +
    phaseColor(label,legendBrand) + '"></i>' + label + '</span>').join("") :
    '<span>R1–RX 按品牌色逐轮变浅</span>') + '<button type="button" data-palette="psd" title="修改 PSD 颜色" aria-label="修改 PSD 颜色"><i class="phase-swatch psd-swatch" aria-hidden="true" style="background:' +
    paletteColor("psd") + '"></i>PSD</button>';
  const remaining = (name,entries) => entries.length ? '<details class="panel unscheduled"><summary>' + name + ' · ' + entries.length +
    '</summary><div class="stack">' + entries.map((entry) => openButton(entry)).join("") + '</div></details>' : "";
  return '<div class="panel"><div class="section-head"><h2>项目时间轴 · ' + (view.zone === "Asia/Shanghai" ? "广州" : "纽约") + '</h2><div class="legend">' + legend +
    '<button type="button" data-palette="work" title="修改内部节点颜色" aria-label="修改内部节点颜色"><b aria-hidden="true" style="color:' + paletteColor("work") + '">◆</b>内部节点</button>' +
    '<button type="button" data-palette="client" title="修改客户节点颜色" aria-label="修改客户节点颜色"><b aria-hidden="true" style="color:' + paletteColor("client") + '">●</b>客户节点</button>' +
    '<button type="button" data-palette="today" title="修改今天线颜色" aria-label="修改今天线颜色"><b aria-hidden="true" style="color:' + paletteColor("today") + '">│</b>今天</button></div></div>' +
    (view.zone === "America/New_York" ? '<p class="zone-note">纽约时间：已填时刻的节点按时区换算；仅有日期的节点显示为广州日期前一天。</p>' : '') +
    (rows ? '<div class="chart" tabindex="0" aria-label="可滚动的甘特图" data-anchor-month="' + view.month +
      '" data-scale="' + view.scale + '" data-range="' + view.range + '"><div class="chart-inner" style="--weighted-days:' + weightedDays +
      ';--unit:' + units[view.scale] + ';--columns:' + columns + '">' + row(overview ? "项目" : "产品 / 轮次",header,"chart-header") + rows + row('',ticks,'chart-fill') + '</div></div>'
      : '<p class="empty">这个月没有符合条件的排期。可切换月份，或在项目中设置排期节点。</p>') + '</div>' +
    remaining("未排期",unscheduled) + remaining("待整理排期",other);
}

function table(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' + headers.map((head) => "<th scope=\"col\">" + escape(head) + "</th>").join("") +
    '</tr></thead><tbody>' + rows.map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join("") + '</tbody></table></div>';
}

function sheetRecords() {
  const nodes = scoped().filter((entry) => entry.kind === "node" && inMonth(phaseDate(entry)));
  const colors = sheetProjectColors();
  return nodes.map((entry) => {
    const project = find(entry.project);
    const date = phaseDate(entry);
    const sourceStyle = sourceStyleFor(entry);
    const color = colors.get(entry.project) || sheetFallbackColors[0];
    const sourceColumns = ["B","D","D","C","E","G","F","F","F","E"];
    const textColors = sourceColumns.map((column) => sourceStyle?.[column]?.text || "#000000");
    const boldCells = sourceColumns.map((column) => Boolean(sourceStyle?.[column]?.bold));
    const strikeCells = sourceColumns.map((column) => Boolean(sourceStyle?.[column]?.strike));
    const cellColors = sheetHeaders.map(() => color);
    if (sourceStyle?.G?.background && sourceStyle.G.background.toLowerCase() !== color.toLowerCase()) {
      cellColors[5] = sourceStyle.G.background;
    }
    const type = nodeType(entry);
    const category = type === "client" || type === "client-delivery" ? "客户" :
      type === "work" ? "内部" : type === "delivery" ? "PSD" : roundNumber(type) ? type : "其他";
    return {entry,project,date,color,cellColors,textColors,boldCells,strikeCells,cells:[sheetDateLabel(date,entry.time),
      project?.brand || "",project?.name || "",category,entry.name,entry.memo || "",
      entry.status || "待确认",projectQuantity(project?.skuQuantity),projectQuantity(project?.assetQuantity),""]};
  }).sort((a,b) => a.date.localeCompare(b.date) || (a.entry.time || "").localeCompare(b.entry.time || "") ||
    a.cells[1].localeCompare(b.cells[1]) ||
    a.cells[2].localeCompare(b.cells[2]));
}

function sheetRows(records = sheetRecords()) {
  const rows = [];
  let previous = "";
  for (const record of records) {
    if (record.date !== previous) {
      const start = previous ? stamp(previous) + day : stamp(record.date);
      for (let cursor = start; cursor <= stamp(record.date); cursor += day) {
        const weekday = new Date(cursor).getUTCDay();
        if (weekday === 6 || (!previous && weekday === 0)) {
          rows.push({kind:"weekend",cells:sheetHeaders.map(() => "")});
        }
      }
      previous = record.date;
    }
    rows.push({kind:"node",...record});
  }
  return rows;
}

function sheetView() {
  const records = sheetRecords();
  const body = sheetRows(records).map((row) => row.kind === "weekend" ?
    '<tr class="sheet-weekend" aria-label="周末留白"><td colspan="' + sheetHeaders.length + '"></td></tr>' :
    '<tr class="sheet-project-row" style="--sheet-project:' + row.color + '">' +
    row.cells.map((cell,index) => '<td style="background-color:' + row.cellColors[index] +
      ';color:' + row.textColors[index] + (row.boldCells[index] ? ';font-weight:700' : '') +
      (row.strikeCells[index] ? ';text-decoration:line-through' : '') + '"' +
      (index === 0 ? ' title="' + escape(row.date) + '"' : '') + '>' +
      (index === 9 ? (row.project?.image ? '<img class="sheet-thumb" src="' + escape(row.project.image) + '" alt="' + escape(row.project.name) + '" loading="lazy">' : '') :
      index === 4 ? openButton(row.entry,cell) : index === 5 && cell.length > 60 ?
        '<details class="sheet-note"><summary title="展开完整备注">' + escape(cell.slice(0,60)) +
        '…</summary><p>' + escape(cell) + '</p></details>' : escape(cell)) + '</td>').join("") +
    '</tr>').join("");
  return '<div class="panel sheet-panel"><div class="section-head sheet-head"><div><h2>' + escape(view.month) +
    ' 排期表单</h2><p class="hint">按日期排序 · 日期以广州为准 · 共 ' + records.length +
    ' 个节点</p></div><div class="sheet-actions"><button type="button" data-copy-sheet>复制到 Google 表格</button>' +
    '<button type="button" class="primary" data-export-xlsx>下载 Excel</button></div></div>' +
    (records.length ? '<div class="table-wrap"><table class="schedule-sheet"><thead><tr>' + sheetHeaders.map((header) =>
      '<th scope="col">' + escape(header) + '</th>').join("") + '</tr></thead><tbody>' + body + '</tbody></table></div>' :
      '<p class="empty">当前月份没有排期节点。选择其他月份，或进入项目编辑排期。</p>') + '</div>';
}

async function exportSheetXlsx() {
  const sheet = sheetRows();
  const rows = sheet.map(({cells}) => cells);
  const rowMeta = sheet.map((row) => row.kind === "weekend" ? {kind:"weekend"} :
    {kind:"node",date:row.date,time:row.entry.time || "",color:row.color,
      cellColors:row.cellColors,textColors:row.textColors,boldCells:row.boldCells,strikeCells:row.strikeCells});
  const response = await fetch("/api/export-xlsx",{method:"POST",credentials:"omit",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({headers:sheetHeaders,rows,rowMeta})});
  if (!response.ok) throw new Error((await response.json()).error || "Excel 导出失败");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "TA-F-排期-" + view.month + ".xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),60000);
}

async function copyToGoogleSheet() {
  const sheet = sheetRows();
  const clipboardCell = (cell) => {
    const value = String(cell).replace(/\t/g," ").replace(/\r?\n/g," / ");
    return /^[=+\-@]/.test(value) ? "'" + value : value;
  };
  const lines = [sheetHeaders,...sheet.map(({cells}) => cells)];
  const tsv = lines.map((row) => row.map(clipboardCell).join("\t")).join("\n");
  const html = '<table><thead><tr>' + sheetHeaders.map((cell) =>
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
  notify("已复制表单。打开 Google 表格后，在 A1 粘贴即可；若底色未保留，可导入下载的 Excel。");
}

function notes() {
  const entries = scoped().filter((entry) =>
    (entry.kind === "note" && (!entry.date || inMonth(entry.date))) ||
    (entry.kind === "revision" && (!entry.actual || inMonth(entry.actual)))).sort((a,b) =>
      (b.actual || b.date || "").localeCompare(a.actual || a.date || ""));
  return '<div class="panel"><div class="section-head"><h2>项目记录</h2></div>' +
    (entries.length ? table(["发生日期","项目","类型","内容"],entries.map((entry) => [
      escape(entry.actual || entry.date || "日期待确认"), escape(find(entry.project)?.name || ""),
      escape(entry.type || kinds[entry.kind]), openButton(entry) + (entry.memo ? "<p>" + escape(entry.memo) + "</p>" : "")
    ])) : '<p class="empty">这个月还没有记录。可添加进展、反馈、修改或交付记录。</p>') + '</div>';
}

function metrics(entries) {
  const started = entries.filter((entry) => inMonth(entry.actual) && ["sku","asset","revision"].includes(entry.kind));
  const sku = new Map();
  for (const entry of started.filter((entry) => entry.kind === "sku")) {
    const key = JSON.stringify([entry.project, entry.sku.trim().toLowerCase()]);
    if (!sku.has(key)) sku.set(key, []);
    sku.get(key).push(entry);
  }
  for (const project of projects().filter((p) => p.status !== "已归档")) {
    const r1 = entries.filter((entry) => entry.kind === "node" && entry.project === project.id &&
      nodeType(entry) === "R1" && entry.status !== "已取消" && inMonth(phaseDate(entry)));
    if (r1.length !== 1) continue;
    const recorded = [...sku.values()].filter((items) => items[0].project === project.id).length;
    const remainingQuantity = Math.max(0,(project.skuQuantity || 1)-recorded);
    if (!remainingQuantity) continue;
    sku.set(JSON.stringify([project.id,"__r1_default__"]), [{...project, project:project.id, name:project.name + " · R1 开工",
      actual:workdaysBefore(phaseDate(r1[0]),r1LeadDays(project)), r1Date:phaseDate(r1[0]), remainingQuantity}]);
  }
  const asset = started.filter((entry) => entry.kind === "asset");
  const firstR4 = new Map();
  for (const entry of entries.filter((item) => item.kind === "node" && item.status !== "已取消" && roundNumber(nodeType(item)) >= 4)) {
    const project = find(entry.project);
    const date = phaseDate(entry);
    if (!project || project.status === "已归档" || !date) continue;
    const previous = firstR4.get(project.id);
    if (!previous || date < previous.date) firstR4.set(project.id,{project:project.id,name:project.name,brand:project.brand,date,round:nodeType(entry)});
  }
  const r4Projects = [...firstR4.values()].filter((item) => inMonth(item.date));
  const pending = entries.filter((entry) => (["sku","asset","revision"].includes(entry.kind) && !entry.actual) ||
    (entry.kind==="node" && entry.source && !entry.actual && inMonth(entry.date) && entry.status==="待确认"));
  const skuCount = [...sku.values()].reduce((sum,items) => sum + (items[0].remainingQuantity || 1),0);
  return {sku,asset,r4Projects,pending, values:[skuCount,asset.reduce((sum,entry)=>sum+entry.quantity,0),r4Projects.length,pending.length]};
}

const metricNames = ["新开工 SKU","新开工图片 / 资产","达到 R4 的项目","待确认条目"];

function stats() {
  const brand = find(view.project)?.brand || view.brand;
  const active = projects().filter((p) => p.status !== "已归档" && (!brand || p.brand === brand));
  const ids = new Set(active.map((p) => p.id));
  const entries = data.entries.filter((entry) => entry.kind !== "project" && ids.has(entry.project));
  const total = metrics(entries);
  const brands = [...new Set(active.map((p) => p.brand))];
  const rows = brands.map((name) => {
    const brandIds = new Set(active.filter((p) => p.brand === name).map((p) => p.id));
    return [escape(name), ...metrics(entries.filter((entry) => brandIds.has(entry.project))).values.map(escape)];
  });
  const products = new Map();
  for (const items of total.sku.values()) {
    const entry = items[0];
    if (!products.has(entry.project)) products.set(entry.project,[]);
    products.get(entry.project).push(entry);
  }
  const productRows = [...products].sort((a,b) =>
    (a[1][0].actual || "").localeCompare(b[1][0].actual || "") || (find(a[0])?.name || "").localeCompare(find(b[0])?.name || ""));
  const productTable = productRows.length ? table(["品牌","产品项目","SKU","计划交付资产","制作起始","依据"], productRows.map(([id,items]) => {
    const project = find(id);
    const inferred = items.find((entry) => entry.kind === "project");
    const recorded = items.filter((entry) => entry.kind === "sku");
    const count = recorded.length + (inferred?.remainingQuantity || 0);
    const skuLabel = inferred ? count + " 个（" + (recorded.length ? recorded.length + " 已录入，" : "") + inferred.remainingQuantity + " 个待补明细）" :
      count + " 个：" + recorded.map((entry) => entry.sku).join("、");
    const actual = items.map((entry) => entry.actual).filter(Boolean).sort()[0] || "";
    return [escape(project?.brand), '<button data-product-project="' + escape(id) + '">' + escape(project?.name) + '</button>',
      escape(skuLabel), escape(project?.assetQuantity || "待填写"), escape(actual),
      escape(inferred ? "R1 节点 " + inferred.r1Date + " 前 " + r1LeadDays(project) + " 个工作日" : "SKU 开工记录")];
  })) : '<p class="empty">本月暂无新开工产品。</p>';
  return '<div class="panel"><div class="section-head"><h2>' + escape(view.month) + ' 月度统计</h2></div>' +
    '<div class="stats-line">' + metricNames.map((name,i) => '<button data-metric="' + i + '">' + name + '<strong>' + total.values[i] + '</strong></button>').join("") + '</div>' +
    '<p class="hint stats-note">按品牌汇总。项目的 R1 节点落在本月时，按设置的 SKU 数量计入新开工；未设置时至少计 1 个。已录入 SKU 明细按实际开工的不同 SKU 计数。新开工资产按实际记录统计；项目首次排期达到 R4 或更高轮次时，计入对应月份，每个项目只计 1 次。</p>' +
    (rows.length ? table(["品牌", ...metricNames], rows) : '<p class="empty">新建项目后即可录入统计明细。</p>') +
    '<section class="stat-products" aria-label="本月新开工产品"><h3>本月新开工产品 <span>' + productRows.length + '</span></h3>' + productTable + '</section></div>';
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
    return '<a href="sources/' + escape(value.split("/").pop()) + '" target="_blank" rel="noopener noreferrer">查看来源截图</a>';
  }
  try {
    const url = new URL(value);
    if (["https:","http:"].includes(url.protocol)) return '<a href="' + escape(url.href) + '" target="_blank" rel="noopener noreferrer">查看来源</a>';
  } catch {}
  return escape(value);
}

function imageField(image = "") {
  return '<div class="project-image-field"><span class="project-image-heading">项目图片（可选）</span>' +
    '<div class="project-image-panel' + (image ? ' has-image' : '') + '"><label class="image-upload">' +
    '<input class="project-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="项目图片（可选）">' +
    '<img class="image-preview" src="' + escape(image) + '" alt="项目图片预览"' + (image ? '' : ' hidden') + '>' +
    '<span class="image-upload-action">' + (image ? "更换图片" : "上传图片") + '</span></label>' +
    '<button type="button" class="remove-image" aria-label="删除项目图片"' + (image ? '' : ' hidden') + '>删除</button></div></div>';
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
      if (file.size > 12_000_000) throw new Error("原图请小于 12 MB");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,240,240);
      bitmap.close();
      current = canvas.toDataURL("image/jpeg",.78);
      if (current.length > 335_000) throw new Error("图片压缩后仍过大，请换一张图片");
      image.src = current;
      image.hidden = false;
      panel.classList.add("has-image");
      remove.hidden = false;
      form.querySelector(".image-upload-action").textContent = "更换图片";
    } catch (error) {
      input.value = "";
      const box = form.querySelector(".form-error");
      box.textContent = "无法读取图片：" + error.message;
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
    form.querySelector(".image-upload-action").textContent = "上传图片";
  };
  return () => current;
}

function createProject() {
  const brandOptions = [...new Set(projects().map((project) => project.brand))]
    .map((brand) => '<option value="' + escape(brand) + '"></option>').join("");
  const firstDate = currentGuangzhouDate();
  const secondDate = workdaysAfter(firstDate,3);
  const projectId = crypto.randomUUID();
  const initialNodes = [{type:"R1",name:"R1",date:firstDate},
    {type:"R2",name:"R2",date:secondDate},
    {type:"delivery",name:"PSD 交付",date:workdaysAfter(secondDate,3)}];
  drawer("新建项目", '<form class="editor project-form" id="project-form">' +
    '<section class="form-section"><div class="project-identity"><div class="project-identity-fields">' + field("项目名称","name","","text",true) +
    '<label>品牌<input name="brand" list="brand-options" value="' + escape(view.brand || find(view.project)?.brand || "") +
    '" required></label><datalist id="brand-options">' + brandOptions + '</datalist></div>' + imageField() + '</div>' +
    '<div class="pair">' + field("SKU 数量","skuQuantity",1,"number",true) +
    field("计划交付资产数量","assetQuantity",1,"number",true) + '</div></section>' +
    projectPlanSection({id:projectId,r1LeadDays:3,roundGapDays:3},initialNodes) +
    '<p class="form-error" role="alert" hidden></p><button class="primary" type="submit">创建项目</button></form>');
  const form = $("#project-form");
  const selectedImage = bindProjectImage(form);
  const collectProjectPlan = bindProjectPlan(form,{id:projectId});
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    errorBox.hidden = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      const {nodes,sideNodes} = collectProjectPlan();
      const dates = nodes.map((node)=>node.date);
      const normalized = values.name.trim().replace(/\s+/g," ").toLowerCase();
      if (projects().some((project) => project.status !== "已归档" && project.name.trim().replace(/\s+/g," ").toLowerCase() === normalized)) {
        throw new Error("这个产品已有项目，请在现有项目中添加节点");
      }
      const project = {id:projectId,kind:"project",name:values.name.trim(),brand:values.brand.trim(),status:"制作中",
        skuQuantity:Number(values.skuQuantity),assetQuantity:Number(values.assetQuantity),
        r1LeadDays:Number(values.r1LeadDays),roundGapDays:Number(values.roundGapDays),image:selectedImage()};
      button.disabled = true;
      await api("project-plan",{project,nodes,sideNodes});
      view.project=projectId;
      view.brand="";
      view.tab="timeline";
      view.month=dates[0]?.slice(0,7) || currentGuangzhouDate().slice(0,7);
      $("#drawer").close();
      await refresh();
      notify(nodes.length ? "项目与排期已创建" : "项目已创建，可稍后添加排期");
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
  const namedRound = entry.name.match(/^(R[1-9]\d?)(?=\b|[.．])/i)?.[1].toUpperCase();
  if (types.has(namedRound)) return namedRound;
  const rounds = plans.filter((node)=>roundNumber(nodeType(node)));
  if (!rounds.length) return types.has("delivery") ? "delivery" : "";
  return nodeType(rounds.find((node)=>entry.date && entry.date <= node.date) || rounds.at(-1));
}

function projectSideRow(entry, label) {
  const original = entry.id && entry.name !== label ? '<small class="plan-side-original" title="' + escape(entry.name) + '">' + escape(entry.name) + '</small>' : "";
  const client = nodeType(entry) !== "work";
  const marker = '<span class="plan-side-marker" aria-hidden="true" style="color:' + paletteColor(client ? "client" : "work") + '">' + (client ? "●" : "◆") + '</span>';
  return '<div class="plan-side-node" data-side-id="' + escape(entry.id || "") + '" data-side-type="' + escape(nodeType(entry)) + '" data-side-auto="' + (!entry.id || entry.name === label ? "1" : "0") + '">' +
    '<div class="plan-side-heading"><span class="plan-side-title">' + marker + '<span class="plan-side-label" data-side-label>' + escape(label) + '</span></span>' + original + '</div>' +
    '<input type="date" data-side-date aria-label="' + escape(label) + '日期" value="' + escape(entry.date || "") + '" required>' +
    '<button type="button" class="plan-action" data-remove-side aria-label="移除' + escape(label) + '">移除</button></div>';
}

function refreshSideLabels(row) {
  let internal = 0;
  for (const side of row.querySelectorAll(".plan-side-node")) {
    const label = side.dataset.sideType === "client" ? row.dataset.planType + "客户反馈" :
      row.dataset.planType + "." + (++internal) + "内部反馈";
    side.querySelector("[data-side-label]").textContent = label;
    side.querySelector("[data-side-date]").setAttribute("aria-label",label + "日期");
    side.querySelector("[data-remove-side]").setAttribute("aria-label","移除" + label);
  }
}

function projectPlanRow(entry) {
  const type = nodeType(entry);
  const label = type === "delivery" ? "PSD" : type;
  const dateLabel = label + (type === "delivery" ? " 交付日期" : " 节点日期");
  const sideNodes = entry.id ? projectPlanSideNodes(entry.project).filter((node)=>sidePlanType(node,entry.project)===type) : [];
  let internal = 0;
  const sideRows = sideNodes.map((node)=>projectSideRow(node,nodeType(node) !== "work" ? label + "客户反馈" :
    label + "." + (++internal) + "内部反馈")).join("");
  const detail = entry.id && entry.name !== label && entry.name !== "PSD 交付" ?
    '<small class="plan-node-name" title="' + escape(entry.name) + '">' + escape(entry.name) + '</small>' : "";
  return '<div class="plan-node' + (type === "delivery" ? ' plan-node-delivery' : '') + '" data-plan-type="' + escape(type) + '" data-plan-id="' + escape(entry.id || "") +
    '"><div class="plan-node-head"><strong>' + dateLabel + '</strong><div class="plan-node-tools">' +
    (type === "delivery" ? "" : '<button type="button" class="plan-action" data-add-side="client">+ 客户节点</button>' +
      '<button type="button" class="plan-action" data-add-side="work">+ 内部节点</button>') +
    '<button type="button" class="plan-action" data-remove-plan>移除</button></div></div>' +
    detail + '<label><input type="date" aria-label="' + dateLabel + '" data-plan-date value="' + escape(entry.date || "") +
    '" required></label><div class="plan-side-list"' + (sideRows ? "" : " hidden") + '>' + sideRows + '</div></div>';
}

function projectPlanSection(project, initialNodes) {
  return '<section class="form-section project-plan-section"><div class="form-section-head"><h3>排期节点</h3>' +
    '<div class="plan-actions"><button type="button" class="plan-action" id="add-plan-round">+ 添加轮次</button>' +
    '<button type="button" class="plan-action" id="add-plan-psd">+ 添加交付日</button></div></div>' +
    '<div class="plan-defaults"><label class="round-gap">R1 提前 <input name="r1LeadDays" type="number" min="1" max="30" value="' +
    r1LeadDays(project) + '" required> 工作日</label>' +
    '<label class="round-gap">新增轮次默认间隔 <input name="roundGapDays" type="number" min="1" max="30" value="' +
    roundGapDays(project) + '" required> 工作日</label></div>' +
    '<p class="hint">日期以广州为准。R1 从节点前设定的工作日开始；后续轮次从上一节点开始。PSD 交付日可按需添加或移除。</p>' +
    '<div class="project-plan-list" id="project-plan-list">' + (initialNodes || projectPlanNodes(project.id)).map(projectPlanRow).join("") +
    '</div>' + projectUnassignedSideSection(project.id) + '</section>';
}

function projectUnassignedSideSection(projectId) {
  const nodes = projectPlanSideNodes(projectId).filter((node)=>!sidePlanType(node,projectId));
  let internal = 0;
  return '<div class="plan-unassigned"' + (nodes.length ? "" : " hidden") + '><strong>其他时间节点</strong>' +
    '<div class="plan-side-list" data-unassigned-side>' + nodes.map((node)=>projectSideRow(node,
      nodeType(node) === "work" ? "内部节点 " + (++internal) : "客户节点")).join("") + '</div></div>';
}

function bindProjectPlan(form, project) {
  const list = form.querySelector("#project-plan-list");
  const gapInput = form.elements.namedItem("roundGapDays");
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
        next ? workdaysBefore(next,Number(gapInput.value)) : currentGuangzhouDate()});
    if (nextRow) nextRow.before(node.content);
    else list.append(node.content);
    list.querySelector('[data-plan-type="R' + number + '"] [data-plan-date]').focus();
    updateButtons();
  };
  form.querySelector("#add-plan-psd").onclick = () => {
    if (!gapInput.reportValidity()) return;
    const previous = [...list.children].filter((row)=>roundNumber(row.dataset.planType))
      .at(-1)?.querySelector("[data-plan-date]").value;
    list.insertAdjacentHTML("beforeend",projectPlanRow({type:"delivery",name:"PSD 交付",
      date:previous ? workdaysAfter(previous,Number(gapInput.value)) : currentGuangzhouDate()}));
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
      row.querySelector(".plan-side-list").insertAdjacentHTML("beforeend",projectSideRow({
        type,date:roundDate ? iso(stamp(roundDate) + (type === "client" ? day : -day)) : ""
      },""));
      row.querySelector(".plan-side-list").hidden = false;
      refreshSideLabels(row);
      row.querySelector(".plan-side-list").lastElementChild.querySelector("[data-side-date]").focus();
    } else if (event.target.closest("[data-remove-side]")) {
      event.target.closest(".plan-side-node").remove();
      refreshSideLabels(row);
      row.querySelector(".plan-side-list").hidden = !row.querySelector(".plan-side-node");
    } else if (event.target.closest("[data-remove-plan]")) {
      const unassigned = form.querySelector("[data-unassigned-side]");
      unassigned.append(...row.querySelectorAll(".plan-side-node"));
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
      if (!date) throw new Error("请填写 " + (type === "delivery" ? "PSD 交付" : type) + " 日期");
      if (old && old.date === date && nodeType(old) === type) continue;
      const name = old && /^R\d+$/.test(old.name) && roundNumber(type) ? type : old?.name;
      nodes.push(old ? {...old,date,type,name} : {id:crypto.randomUUID(),kind:"node",project:project.id,
        name:type === "delivery" ? "PSD 交付" : type,type,date,status:"未开始"});
    }
    for (const side of form.querySelectorAll(".plan-side-node")) {
      const old = side.dataset.sideId ? find(side.dataset.sideId) : null;
      const name = side.dataset.sideAuto === "1" ? side.querySelector("[data-side-label]").textContent : old?.name || side.querySelector("[data-side-label]").textContent;
      const date = side.querySelector("[data-side-date]").value;
      if (!name || !date) throw new Error("请填写客户／内部节点的名称和日期");
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
      throw new Error("请按 R1、后续轮次、PSD 的顺序设置节点日期");
    return {nodes,removed,sideNodes,removedSideNodes};
  };
}

function edit(kind, entry = {}, readOnly = false) {
  if (kind === "node") {
    const project = find(entry.project || view.project);
    if (project) return edit("project",project,readOnly);
    notify("请先选择项目，再编辑排期节点。");
    return;
  }
  if (kind !== "project" && !projects().length) {
    notify("请先新建项目，再添加排期或记录。");
    return createProject();
  }
  let fields = kind === "project" ?
    '<div class="project-identity"><div class="project-identity-fields">' + field("项目名称","name",entry.name,"text",true) +
    field("品牌","brand",entry.brand,"text",true) + '</div>' + imageField(entry.image) + '</div>' :
    field("名称","name",entry.name,"text",true);
  if (kind === "project") {
    fields += '<div class="pair">' + field("SKU 数量","skuQuantity",entry.skuQuantity ?? "","number") +
      field("计划交付资产数量","assetQuantity",entry.assetQuantity ?? "","number") + '</div>';
    fields += select("项目状态","status",["待确认","制作中","暂停","已完成","已归档"].map((s)=>[s,s]),entry.status || "待确认");
    if (entry.id) fields += projectPlanSection(entry);
  } else {
    fields += select("项目","project",projects().filter((p)=>p.status!=="已归档" || p.id===entry.project).map((p)=>[p.id,p.name]),entry.project || view.project);
  }
  if (kind === "note") {
    fields += select("记录类型","type",["进展","反馈","交付"].map((s)=>[s,s]),entry.type || "进展");
    fields += field("发生日期","date",entry.date ?? data.today,"date");
  } else if (["sku","asset","revision"].includes(kind)) {
    fields += field(kind==="revision" ? "修改实际开始日期" : "实际首次开工日期","actual",entry.actual,"date");
    if (["sku","asset","revision"].includes(kind)) fields += field("SKU 编码 / 稳定名称","sku",entry.sku,"text",kind==="sku");
    if (kind === "asset") fields += field("图片 / 资产数量","quantity",entry.quantity,"number",true);
    if (kind === "revision") fields += field("实际完成日期","end",entry.end,"date");
  }
  fields += '<label>备注<textarea name="memo" rows="4">' + escape(entry.memo) + '</textarea></label>';
  if (entry.source) fields += '<p class="hint">' + sourceLink(entry.source) + '</p>';
  const linkedCount = kind === "project" && entry.id ? data.entries.filter((item)=>item.project===entry.id).length : 0;
  const deleteControls = kind === "project" && entry.id && !readOnly ?
    '<button type="button" class="delete-project-trigger" id="delete-project">删除项目</button>' +
    '<section class="delete-project-confirm" id="delete-project-confirm" hidden><strong>确认删除 ' + escape(entry.name) + '？</strong>' +
    '<p>项目及其 ' + linkedCount + ' 条关联节点、记录和统计明细将被删除，无法在看板中恢复。请输入项目名称确认。</p>' +
    '<input id="delete-project-name" type="text" autocomplete="off" aria-label="输入项目名称确认删除" placeholder="' + escape(entry.name) + '">' +
    '<div class="delete-project-actions"><button type="button" id="cancel-project-delete">取消</button>' +
    '<button type="button" id="confirm-project-delete" disabled>确认删除</button></div></section>' : "";
  const topSave = kind === "project" && !!entry.id && !readOnly;
  const seq = drawer((entry.id ? (readOnly ? "查看" : "编辑") : "新增") + kinds[kind],
    '<form class="editor" id="editor">' + fields + '<p class="form-error" role="alert" hidden></p>' + (topSave ? '' : '<button class="primary" type="submit">保存</button>') +
    deleteControls + '</form>' +
    (entry.id ? '<details class="history"><summary>变更历史</summary><div id="history"></div></details>' : ""), {topSave});
  const editor = $("#editor");
  const selectedImage = kind === "project" ? bindProjectImage(editor,entry.image || "") : null;
  const collectProjectPlan = kind === "project" && entry.id && !readOnly ? bindProjectPlan(editor,entry) : null;
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
        notify("项目及其 " + members.length + " 条关联记录已删除");
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
    action.textContent = "登录后编辑";
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
      for (const key of ["skuQuantity","assetQuantity"]) {
        if (values[key]) values[key] = Number(values[key]);
        else delete values[key];
      }
      values.r1LeadDays = Number(values.r1LeadDays);
      if (entry.id) values.roundGapDays = Number(values.roundGapDays);
      values.image = selectedImage();
    }
    button.disabled = true;
    form.querySelector(".form-error").hidden = true;
    try {
      const productName = (name) => name.trim().replace(/\s+/g," ").toLowerCase();
      if (kind === "project" && values.status !== "已归档" && projects().some((project) =>
        project.id !== entry.id && project.status !== "已归档" && productName(project.name) === productName(values.name))) {
        throw new Error("这个产品已有项目，请在现有项目中添加节点");
      }
      const projectData = {...entry,...values,kind,id:entry.id || crypto.randomUUID()};
      const plan = collectProjectPlan ? collectProjectPlan() : null;
      const result = plan ? await api("project-plan-edit",{project:projectData,...plan}) : await api("entry",projectData);
      const saved = plan ? result.project : result;
      if (kind === "project") view.project = saved.id;
      $("#drawer").close();
      await refresh();
      notify("已保存");
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
      const labels = {name:"名称",brand:"品牌",project:"项目",sku:"SKU",status:"状态",type:"轮次 / 类型",memo:"备注",date:"日期",time:"广州时间",start:"计划开始",end:"结束",actual:"实际日期",quantity:"数量",skuQuantity:"SKU 数量",assetQuantity:"交付资产数量",r1LeadDays:"R1 提前工作日",roundGapDays:"轮次默认间隔工作日"};
      $("#history").innerHTML = history.map((change) => {
        const before = JSON.parse(change.before);
        const after = JSON.parse(change.after);
        const changes = before && after ? Object.entries(labels).filter(([key]) => before[key] !== after[key])
          .map(([key,label]) => label + "：" + (before[key] || "空") + " → " + (after[key] || "空")).join("；") :
          after ? "创建记录" : "撤销导入";
        return '<p><strong>' + escape(change.actor) + '</strong> <span class="muted">' +
          escape(change.time.slice(0,16).replace("T"," ")) + '</span><br>' + escape(changes || "保存记录") + '</p>';
      }).join("") || '<p class="hint">暂无变更。</p>';
    }).catch((error) => {
      if (seq === drawerSequence && $("#history")) $("#history").textContent = error.message;
    });
  }
}

function editBrandColor(brand) {
  const setting = brandSetting(brand);
  const initial = brandColor(brand);
  drawer(brand + " · 品牌色", '<form class="editor" id="brand-color-form"><label>R1 主色<input name="color" type="color" value="' +
    initial + '"></label><div class="brand-color-preview" id="brand-color-preview"></div>' +
    '<p class="hint">R1 使用主色，后续轮次逐渐变浅。PSD 与其他节点颜色可在图例中设置。</p>' +
    '<p class="form-error" role="alert" hidden></p><button class="primary" type="submit">保存品牌色</button></form>');
  const form = $("#brand-color-form");
  const colorInput = form.elements.namedItem("color");
  const preview = () => {
    const tones = [1,2,3,4].map((round) => '<span style="background:' +
      mixWhite(colorInput.value,roundTint(round)) + '">R' + round + '</span>').join("");
    $("#brand-color-preview").innerHTML = tones + '<span class="psd" style="background:' + paletteColor("psd") + ';color:' + colorInk(paletteColor("psd")) + '">PSD</span>';
  };
  colorInput.addEventListener("input",preview);
  preview();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    button.disabled = true;
    errorBox.hidden = true;
    try {
      await api("entry",{...setting,id:setting?.id || crypto.randomUUID(),kind:"brand",name:brand,brand,color:colorInput.value});
      $("#drawer").close();
      await refresh();
      notify(brand + " 品牌色已更新");
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
  const setting = paletteSetting(slot);
  drawer(item.name + " · 图例颜色", '<form class="editor" id="palette-color-form"><label>' + item.name +
    ' 颜色<input name="color" type="color" value="' + paletteColor(slot) + '"></label>' +
    '<div class="palette-color-preview"><span id="palette-color-preview"></span><span>' + item.name + '</span></div>' +
    '<p class="hint">此颜色应用于所有品牌的时间轴，团队成员会看到相同的设置。</p>' +
    '<p class="form-error" role="alert" hidden></p><div class="palette-color-actions"><button type="button" id="palette-reset">恢复默认色</button>' +
    '<button class="primary" type="submit">保存颜色</button></div></form>');
  const form = $("#palette-color-form");
  const colorInput = form.elements.namedItem("color");
  const preview = () => { $("#palette-color-preview").style.background = colorInput.value; };
  colorInput.addEventListener("input",preview);
  $("#palette-reset").addEventListener("click",() => { colorInput.value=item.color; preview(); });
  preview();
  form.addEventListener("submit",async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector(".form-error");
    button.disabled = true;
    errorBox.hidden = true;
    try {
      await api("entry",{...setting,id:setting?.id || crypto.randomUUID(),kind:"palette",type:slot,name:item.name,color:colorInput.value});
      $("#drawer").close();
      await refresh();
      notify(item.name + "颜色已更新");
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function importDrawer() {
  drawer("导入记录", '<form id="import-form" class="editor"><label>选择整理后的 JSON 批次<input type="file" accept=".json,application/json" required></label>' +
    '<p class="hint">选择由助手整理的批次文件。核对预览后提交。</p><div id="import-preview"></div><p class="form-error" role="alert" hidden></p>' +
    '<button type="submit" class="primary" disabled>确认导入</button></form>' +
    '<div class="batch-list"><h2>导入历史</h2>' + data.batches.map((batch) => '<div class="batch"><span>' + escape(batch.id) +
      '<br><small>' + escape(batch.time.slice(0,10)) + '</small></span>' +
      (batch.undone ? "<span>已撤销</span>" : '<button data-undo="' + escape(batch.id) + '">撤销</button>') + '</div>').join("") + '</div>');
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
      if (input.files[0].size > 4000000) throw new Error("批次文件超过 4 MB");
      const result = JSON.parse(await input.files[0].text());
      if (selection !== token) return;
      if (!result?.id || !Array.isArray(result.entries) || !result.entries.length ||
          result.entries.some((item)=> !item?.id || !kinds[item.kind] || !item.name)) throw new Error("批次缺少有效记录");
      batch = result;
      const counts = Object.entries(kinds).map(([kind,label]) =>
        label + " " + result.entries.filter((item) => item.kind === kind).length);
      form.querySelector("#import-preview").innerHTML = '<p>' + escape(counts.join(" · ")) +
        '</p><details><summary>查看批次内容</summary><ul>' + result.entries.map((item) => '<li>' +
        escape(kinds[item.kind] + " · " + item.name + (item.actual || item.date ? " · " + (item.actual || item.date) : "")) +
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
      notify(result.duplicate ? "这个批次已处理。" : "已导入 " + result.count + " 条记录");
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
  const brand = find(view.project)?.brand || view.brand;
  const ids = new Set(projects().filter((p) => p.status !== "已归档" && (!brand || p.brand === brand)).map((p) => p.id));
  const {sku,asset,r4Projects,pending} = metrics(data.entries.filter((entry) => entry.kind !== "project" && ids.has(entry.project)));
  const items = [[...sku.values()].flat(),asset,r4Projects,pending][index];
  drawer(metricNames[index], '<p class="hint">' + escape(view.month) + ' · ' + escape(brand || "全部品牌") +
    '</p><div class="stack">' +
    (items.length ? items.map((entry) => index === 2 ? openButton(find(entry.project),entry.name + " · " + entry.round + " · " + entry.date) :
      openButton(entry,entry.name + " · " + find(entry.project)?.name +
      (entry.quantity ? " · " + entry.quantity : "") + (entry.actual ? " · " + entry.actual : " · 待确认"))).join("") :
      '<p class="hint">暂无符合条件的记录。</p>') + '</div>');
}

function changeMonth(delta) {
  const date = new Date(stamp(view.month + "-01"));
  date.setUTCMonth(date.getUTCMonth()+delta);
  view.month = date.toISOString().slice(0,7);
  render();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const target = button.dataset;
  if ("exportXlsx" in target) {
    button.disabled = true;
    try { await exportSheetXlsx(); } catch (error) { notify(error.message,true); }
    finally { button.disabled = false; }
    return;
  }
  if ("copySheet" in target) {
    try { await copyToGoogleSheet(); } catch (error) { notify("复制失败：" + error.message,true); }
    return;
  }
  if ("project" in target) {view.project=target.project; view.brand=""; render();}
  if ("brand" in target) {view.brand=target.brand; view.project=""; render();}
  if ("brandColor" in target) withEditor(() => editBrandColor(target.brandColor));
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
  if (target.undo && confirm("撤销此导入批次？")) {
    try {
      await api("undo",{id:target.undo});
      await refresh();
      importDrawer();
      notify("已撤销导入");
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
$("#status-filter").insertAdjacentHTML("beforeend",projectStatuses.map((s)=>'<option>'+s+'</option>').join(""));
$("#status-filter").onchange = (event) => {
  view.status=event.target.value;
  if (view.project && !matchesProjectStatus(find(view.project))) view.project="";
  render();
};
$("#auth-status").onclick = () => {
  if (editorAuth) {
    editorAuth = null;
    updateAuth();
    notify(allowAnonymousEdits ? "已退出账号，仍可匿名调试。" : "已退出编辑模式");
  } else {
    ensureAuth(true);
  }
};
$("#projects").addEventListener("scroll",updateProjectScrollHint,{passive:true});
window.addEventListener("resize",updateProjectScrollHint);
$("#add-project").onclick = () => withEditor(createProject);
$("#add-project-main").onclick = () => withEditor(createProject);
$("#edit-project").onclick = () => withEditor(() => edit("project",find(view.project)));
$("#import-open").onclick = importDrawer;
$("#add-entry").onclick = () => withEditor(() => {
  if (view.tab === "timeline") return;
  const types = view.tab === "notes" ? ["note","revision"] : ["sku","asset","revision"];
  drawer(view.tab==="notes" ? "添加记录" : "录入统计明细",'<div class="stack">' +
    types.map((kind)=>'<button data-kind="'+kind+'">'+kinds[kind]+'</button>').join("")+'</div>');
});
refresh().catch((error)=>notify(error.message,true));
