"use strict";

// GitHub Pages preview: the existing UI uses the same API contract, backed by
// this browser's storage. Nothing here is shared with other visitors.
(() => {
  const key = "taf-schedule-preview-v1";
  const realFetch = window.fetch.bind(window);
  const day = 86400000;
  const chinaToday = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date()).map(part => [part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const addDays = (date, offset) => new Date(Date.parse(date + "T00:00:00Z") + offset*day).toISOString().slice(0,10);
  const now = () => new Date().toISOString();
  const clone = value => structuredClone(value);
  const error = (status, message) => { throw {status,message}; };
  const seed = () => {
    const today = chinaToday();
    const entries = [];
    const project = (id, brand, name, skuQuantity, assetQuantity, shift, rounds=2) => {
      entries.push({id,kind:"project",version:1,brand,name,skuQuantity,assetQuantity,
        status:"制作中",r1LeadDays:3,roundGapDays:3});
      for(let n=1;n<=rounds;n++) entries.push({id:`${id}-r${n}`,kind:"node",version:1,
        project:id,name:`R${n}`,type:`R${n}`,date:addDays(today,shift+(n-1)*5),status:"未开始"});
      entries.push({id:`${id}-psd`,kind:"node",version:1,project:id,name:"PSD 交付",
        type:"delivery",date:addDays(today,shift+rounds*5),status:"未开始"});
    };
    project("demo-one","示例品牌 A","晨光礼盒 · 琥珀色",3,8,-4,3);
    project("demo-two","示例品牌 A","旅行装系列 · 蓝色",2,6,3,2);
    project("demo-three","示例品牌 B","节日包装 · 红色",4,12,-1,2);
    entries.push({id:"demo-client",kind:"node",version:1,project:"demo-one",name:"客户确认构图",
      type:"client",round:"R2",date:addDays(today,4),status:"待反馈"});
    entries.push({id:"demo-note",kind:"note",version:1,project:"demo-one",name:"首轮视觉方向确认",
      type:"进展",date:addDays(today,-2),status:"制作中",memo:"示例记录，可直接编辑或新增。"});
    entries.push({id:"demo-revision",kind:"revision",version:1,project:"demo-three",name:"第一轮修改",
      sku:"节日包装",actual:addDays(today,-1),status:"修改中"});
    return {entries,batches:[],changes:[],seq:1};
  };
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key)) || seed(); }
    catch { return seed(); }
  };
  const persist = value => {
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch { error(507,"浏览器本地空间不足，请先导出数据备份或减少图片大小。"); }
  };
  const history = (s,id) => s.changes.filter(change=>change.entry_id===id).slice(-30).reverse();
  const save = (s,input,batch) => {
    if (!input || typeof input.id!=="string" || !input.id || typeof input.name!=="string" || !input.name.trim())
      error(400,"请填写有效的名称和记录 ID");
    const index=s.entries.findIndex(item=>item.id===input.id);
    const before=index<0?null:s.entries[index];
    if ((before?.version||0)!==(input.version||0)) error(409,"记录已有更新，请刷新后核对再保存。");
    if (input.kind!=="project" && !["brand","palette"].includes(input.kind) &&
        !s.entries.some(item=>item.kind==="project" && item.id===input.project))
      error(400,"请先建立所属项目");
    const after={...input,version:++s.seq};
    if(index<0) s.entries.push(after); else s.entries[index]=after;
    s.changes.push({entry_id:after.id,actor:"预览访客",time:now(),
      before:JSON.stringify(before),after:JSON.stringify(after),batch:batch||null});
    return after;
  };
  const remove = (s,item) => {
    const index=s.entries.findIndex(entry=>entry.id===item.id);
    if(index<0 || s.entries[index].version!==item.version) error(409,"记录已有更新，请刷新后核对。");
    const before=s.entries.splice(index,1)[0];
    s.changes.push({entry_id:item.id,actor:"预览访客",time:now(),
      before:JSON.stringify(before),after:"null",batch:null});
  };
  const handle = (path,body) => {
    const s=read();
    if(path==="state") return {entries:s.entries,batches:s.batches,today:chinaToday(),allowAnonymousEdits:true};
    if(path.startsWith("history/")) return history(s,path.slice(8));
    if(path==="login") error(401,"预览版使用本地编辑，无需登录");
    let result;
    if(path==="entry") result=save(s,body);
    else if(path==="project-plan") {
      const project=save(s,body.project);
      for(const node of [...body.nodes,...(body.sideNodes||[])]) save(s,node);
      result={project,count:body.nodes.length+(body.sideNodes||[]).length};
    } else if(path==="project-plan-edit") {
      const project=save(s,body.project);
      const nodes=[...body.nodes,...(body.sideNodes||[])];
      const removed=[...body.removed,...(body.removedSideNodes||[])];
      for(const node of nodes) save(s,node);
      for(const node of removed) remove(s,node);
      result={project,updated:nodes.length,removed:removed.length};
    } else if(path==="project-delete") {
      const project=s.entries.find(item=>item.id===body.id && item.kind==="project");
      if(!project || project.version!==body.version) error(409,"项目已有更新，请刷新后重试。");
      if(body.confirmName!==project.name) error(400,"请输入正确项目名称确认删除");
      const members=s.entries.filter(item=>item.project===body.id);
      if(members.length!==(body.members||[]).length || members.some(item=>
        !body.members.some(expected=>expected.id===item.id && expected.version===item.version)))
        error(409,"项目下的记录已有更新，请刷新后重试。");
      for(const item of [...members,project]) remove(s,item);
      result={deleted:members.length+1};
    } else if(path==="import") {
      if(s.batches.some(batch=>batch.id===body.id)) return {count:0,duplicate:true};
      if(!Array.isArray(body.entries) || !body.entries.length) error(400,"导入批次缺少记录");
      for(const item of [...body.entries].sort((a,b)=>(a.kind!=="project")-(b.kind!=="project")))
        save(s,item,body.id);
      s.batches.unshift({id:body.id,time:now(),undone:0});
      result={count:body.entries.length,duplicate:false};
    } else if(path==="undo") {
      const batch=s.batches.find(item=>item.id===body.id && !item.undone);
      if(!batch) error(400,"批次不存在或已撤销");
      const changes=s.changes.filter(change=>change.batch===body.id).reverse();
      for(const change of changes) {
        const after=JSON.parse(change.after);
        const current=s.entries.find(item=>item.id===after.id);
        if(!current || current.version!==after.version) error(409,"该批次已有后续编辑，请逐条处理。");
        const before=JSON.parse(change.before);
        if(before) save(s,{...before,version:after.version});
        else remove(s,after);
      }
      batch.undone=1;
      result={count:changes.length};
    } else error(404,"接口不存在");
    persist(s);
    return result;
  };
  window.fetch = async (input, init={}) => {
    const url=new URL(typeof input==="string"?input:input.url,location.href);
    if(!url.pathname.startsWith("/api/")) return realFetch(input,init);
    try {
      const path=url.pathname.slice(5);
      const payload=init.body?JSON.parse(init.body):undefined;
      if(path==="export-xlsx") {
        return new Response(window.previewXlsx(payload),{status:200,headers:{
          "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
      }
      const result=handle(path,payload);
      return new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json"}});
    } catch(cause) {
      return new Response(JSON.stringify({error:cause.message||"操作失败"}),{
        status:cause.status||500,headers:{"Content-Type":"application/json"}});
    }
  };
  document.addEventListener("DOMContentLoaded",()=>{
    const button=document.createElement("button");
    button.type="button";
    button.textContent="导出本机数据";
    button.title="保存当前浏览器中的项目与记录";
    button.onclick=()=>{
      const s=read();
      const entries=s.entries.map(({version,...entry})=>entry);
      const blob=new Blob([JSON.stringify({id:"preview-export-"+Date.now(),entries},null,2)],
        {type:"application/json"});
      const link=document.createElement("a");
      link.href=URL.createObjectURL(blob);
      link.download="TA-F-预览数据-"+chinaToday()+".json";
      link.click();
      setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    };
    document.querySelector(".workspace-head .actions")?.prepend(button);
  });
})();
