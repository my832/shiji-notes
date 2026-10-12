'use strict';
const $ = id => document.getElementById(id);
const ICONS = {
 note:'<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10l6-6V5a2 2 0 0 0-2-2z"/><path d="M15 21v-6h6M7 8h10M7 12h6"/>',
 moon:'<path d="M20.5 13A8.7 8.7 0 0 1 11 3.5 8.8 8.8 0 1 0 20.5 13z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',chevron:'<path d="m7 10 5 5 5-5"/>',
 x:'<path d="m6 6 12 12M6 18 18 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',circle:'<circle cx="12" cy="12" r="8"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',pin:'<path d="m15 3 6 6-4 1-3 5-5-5 5-3zM9 10l-4 4 5 5 4-4M8 17l-5 5"/>',spark:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7z"/>',
 shield:'<path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6zM8 12l3 3 5-6"/>',grip:'<circle cx="8" cy="5" r=".7"/><circle cx="16" cy="5" r=".7"/><circle cx="8" cy="12" r=".7"/><circle cx="16" cy="12" r=".7"/><circle cx="8" cy="19" r=".7"/><circle cx="16" cy="19" r=".7"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 paperclip:'<path d="m9 12 6-6a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7l11-11M5 15l10-10"/>',file:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 13h8M8 17h5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2m4 0h2"/>',
 archive:'<path d="M4 8v13h16V8M3 3h18v5H3zM9 12h6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V3M7 8l5-5 5 5M4 16v5h16v-5"/>',up:'<path d="m6 13 6-6 6 6M12 7v13"/>',down:'<path d="m6 11 6 6 6-6M12 17V4"/>',edit:'<path d="m16 3 5 5-13 13H3v-5zM13 6l5 5"/>',move:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',restore:'<path d="M3 11a9 9 0 1 1 1 6M3 4v7h7M12 7v5l3 2"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.note}</svg>`; }
function hydrate(root=document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML=icon(el.dataset.icon); }); }
function escapeHtml(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const STATUS={normal:{name:'普通',color:'blue'},important:{name:'重要',color:'orange'},urgent:{name:'紧急',color:'red'},done:{name:'完成',color:'green'}};
const CAPACITY={flow:10,resident:5};
const native = typeof window.Native !== 'undefined';
const uid = () => 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const clone = v=>JSON.parse(JSON.stringify(v));
let state, draft=null, sheet=null, query='', filter='all', menuId=null, storageMode='archive', toastTimer, confirmAction=null, savingTimer;
function freshState(){
 const created=Date.now();
 return {version:1,theme:'system',notes:[
 {id:uid(),column:'flow',status:'normal',previousStatus:'normal',title:'记一件事',body:'点击编辑，添加图片或文件。',tags:['使用指南'],due:'',attachments:[],created,updated:created,location:'active'},
 {id:uid(),column:'flow',status:'important',previousStatus:'important',title:'重要事项',body:'按住 ⋮⋮ 拖动排序。',tags:['拖动排序'],due:'',attachments:[],created,updated:created,location:'active'},
 {id:uid(),column:'resident',status:'normal',previousStatus:'normal',title:'长期提醒',body:'常用资料或长期计划。',tags:['常驻'],due:'',attachments:[],created,updated:created,location:'active'}],draft:null};
}
function validAttachment(a){return a && typeof a.id==='string' && /^[a-zA-Z0-9_-]{1,90}$/.test(a.id) && typeof a.name==='string' && a.name.length<=250 && typeof a.mime==='string' && /^[a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+$/.test(a.mime) && Number.isFinite(a.size) && a.size>=0 && a.size<=20*1024*1024 && (!a.data || (typeof a.data==='string' && a.data.startsWith('data:')));}
function validateState(v){
 if(!v || v.version!==1 || !Array.isArray(v.notes) || v.notes.length>1000) throw Error('备份格式不正确');
 const ids=new Set();
 for(const n of v.notes){
  if(!n || typeof n.id!=='string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(n.id) || ids.has(n.id) || !CAPACITY[n.column] || !STATUS[n.status] || !['active','archive','trash'].includes(n.location)) throw Error('便签数据不正确');
  ids.add(n.id);
  if(typeof n.title!=='string' || n.title.length>80 || typeof n.body!=='string' || n.body.length>20000 || !Array.isArray(n.tags) || n.tags.length>12 || n.tags.some(t=>typeof t!=='string'||t.length>30) || !Array.isArray(n.attachments) || n.attachments.length>8 || !n.attachments.every(validAttachment)) throw Error('内容或附件格式不正确');
  n.due=typeof n.due==='string' && /^\d{4}-\d{2}-\d{2}$/.test(n.due)?n.due:'';
  if(!Number.isFinite(n.created)||!Number.isFinite(n.updated))throw Error('时间格式不正确');
  if(!STATUS[n.previousStatus]||n.previousStatus==='done') n.previousStatus='normal';
 }
 for(const col of Object.keys(CAPACITY))if(v.notes.filter(n=>n.location==='active'&&n.column===col).length>CAPACITY[col])throw Error('备份超过栏位数量限制');
 if(!['system','light','dark'].includes(v.theme))v.theme='system';
 if(v.draft && (!CAPACITY[v.draft.column]||!STATUS[v.draft.status]||typeof v.draft.title!=='string'||v.draft.title.length>80||typeof v.draft.body!=='string'||v.draft.body.length>20000||!Array.isArray(v.draft.attachments)||v.draft.attachments.length>8||!v.draft.attachments.every(validAttachment)))v.draft=null;
 return v;
}
function persist(){
 try{const json=JSON.stringify(state);if(native){if(!Native.saveState(json))throw Error('save');}else{localStorage.setItem('shiji-v1',json);} $('saveLabel').textContent='已保存到本机';return true;}catch(e){toast('保存失败：请检查手机剩余空间或备份后减少附件');return false;}
}
function mutate(fn, message){const before=clone(state);fn();if(!persist()){state=before;render();return false;}render();if(message)toast(message);return true;}
function loadState(){
 try { const raw=native?Native.loadState():localStorage.getItem('shiji-v1');state=raw?validateState(JSON.parse(raw)):freshState();if(!raw)persist(); }
 catch(e){state={version:1,theme:'system',notes:[],draft:null};toast('数据读取失败，请从备份恢复；未覆盖原有文件');}
 let migrated=false;state.notes.forEach(n=>{if(n.location==='active'&&n.status==='done'){n.location='archive';migrated=true;}});if(migrated)persist();applyTheme();render();
}
function active(col){return state.notes.filter(n=>n.location==='active'&&(!col||n.column===col));}
function switchPage(page){if(!CAPACITY[page])return;state.page=page;menuId=null;persist();render();}
function applyTheme(){const systemDark=native?Native.isSystemDark():matchMedia('(prefers-color-scheme: dark)').matches;const dark=state.theme==='dark'||(state.theme==='system'&&systemDark);document.documentElement.dataset.theme=dark?'dark':'light';$('themeToggle').innerHTML=icon(dark?'sun':'moon');if(native)Native.setTheme(dark);document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===state.theme));}
window.onNativeThemeChanged=()=>{if(state&&state.theme==='system')applyTheme();};
function setTheme(theme){mutate(()=>state.theme=theme);applyTheme();}
function matches(n){
 const haystack=[n.title,n.body,...n.tags,...n.attachments.map(a=>a.name)].join(' ').toLocaleLowerCase();
 return (!query||haystack.includes(query.toLocaleLowerCase())) && (filter==='all'||(filter==='pending'&&n.status!=='done')||(filter==='overdue'&&n.status!=='done'&&n.due&&n.due<today())||filter===n.status);
}
function source(a){return a.data || `https://app.local/attachments/${encodeURIComponent(a.id)}`;}
function sizeText(bytes){return bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':bytes>=1024?Math.ceil(bytes/1024)+' KB':bytes+' B';}
function dateLabel(n){if(!n.due)return '';if(n.due===today())return '今天截止';return n.due.slice(5).replace('-','/')+(n.due<today()&&n.status!=='done'?' · 已逾期':' 截止');}
function card(n){
 const s=STATUS[n.status],imgs=n.attachments.filter(a=>a.mime.startsWith('image/'));
 return `<article class="note-card" data-id="${n.id}" data-status="${n.status}" tabindex="0" aria-label="${escapeHtml(n.title||'无标题便签')}"><div class="card-top"><span class="status-label"><i class="status-dot ${s.color}"></i>${s.name}</span><div class="card-top-actions"><button class="icon-btn drag-handle" data-action="drag" aria-label="上下拖动排序">${icon('grip')}</button><button class="icon-btn" data-action="menu" aria-label="便签操作" aria-expanded="${menuId===n.id}">${icon('more')}</button></div></div><div class="card-click" data-action="edit"><h3>${escapeHtml(n.title||'无标题便签')}</h3>${n.body?`<p class="note-content">${escapeHtml(n.body)}</p>`:''}</div>${imgs.length?`<div class="note-images">${imgs.map(a=>`<button data-action="attachment" data-attachment="${a.id}" aria-label="查看图片 ${escapeHtml(a.name)}"><img src="${escapeHtml(source(a))}" alt="${escapeHtml(a.name)}" loading="lazy"></button>`).join('')}</div>`:''}${n.attachments.filter(a=>!a.mime.startsWith('image/')).map(a=>`<button class="file-chip" data-action="attachment" data-attachment="${a.id}">${icon('file')}<span>${escapeHtml(a.name)}</span><small>${sizeText(a.size)}</small></button>`).join('')}${n.tags.length?`<div class="tags">${n.tags.map(t=>`<button class="tag" data-action="tag" data-tag="${escapeHtml(t)}"># ${escapeHtml(t)}</button>`).join('')}</div>`:''}<div class="card-footer"><span class="due ${n.due&&n.due<today()&&n.status!=='done'?'overdue':''}">${n.due?icon('calendar'):''}${dateLabel(n)}</span><button class="complete-btn" data-action="complete" aria-label="${n.status==='done'?'恢复待办':'标记完成'}">${icon(n.status==='done'?'checkCircle':'circle')}${n.status==='done'?'恢复':'完成'}</button></div>${menuId===n.id?`<div class="card-menu">${[['edit','edit','编辑'],['top','pin','置顶'],['up','up','上移'],['down','down','下移'],['move','move',n.column==='flow'?'移入常驻':'移入流动'],['share','share','分享'],['archive','archive','归档'],['trash','trash','删除']].map(([a,i,t])=>`<button data-action="${a}" class="${a==='trash'?'danger':''}">${icon(i)}${t}</button>`).join('')}</div>`:''}</article>`;
}
function render(){
 if(!CAPACITY[state.page])state.page='flow';
 document.querySelectorAll('[data-page]').forEach(b=>{const selected=b.dataset.page===state.page;b.classList.toggle('selected',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
 document.querySelectorAll('.column').forEach(c=>{c.hidden=c.dataset.column!==state.page;});
 for(const col of Object.keys(CAPACITY)){
 const notes=active(col),visible=notes.filter(matches);$(`${col}Count`).textContent=`${notes.length} / ${CAPACITY[col]}`;$(`${col}TabCount`).textContent=`${notes.length}/${CAPACITY[col]}`;
 $(`${col}List`).innerHTML=visible.map(card).join('')||`<div class="empty-state">${icon(query||filter!=='all'?'search':col==='flow'?'note':'pin')}<p>${query||filter!=='all'?'没有匹配的便签':col==='flow'?'此刻，留一点空白':'给重要的事一个位置'}</p><small>${query||filter!=='all'?'试试其他关键词或状态':'点 + 开始记录'}</small></div>`;
 document.querySelectorAll(`[data-add="${col}"]`).forEach(b=>{b.disabled=notes.length>=CAPACITY[col];b.title=b.disabled?'已达到栏位上限':'';});
 }
 const notes=active(),done=notes.filter(n=>n.status==='done').length;
 $('progressTitle').textContent=notes.length===0?'今天，轻装上阵':done===notes.length?'都完成了，给自己一点掌声':done?'每完成一件，轻松一点':'今天的节奏，由你来安排';
 $('progressSub').textContent=notes.length?`${notes.length-done} 件待办 · ${notes.filter(n=>n.status==='urgent').length} 件紧急`:'从一张便签开始';
 $('progressCount').textContent=`${done} / ${notes.length}`;$('progressBar').style.width=(notes.length?done/notes.length*100:0)+'%';
 $('archiveCount').textContent=state.notes.filter(n=>n.location==='archive').length;$('trashCount').textContent=state.notes.filter(n=>n.location==='trash').length;
 $('clearSearch').hidden=!query;
 $('filterLabel').textContent=filterNames[filter];
 if(sheet==='storageSheet')renderStorage();
}
const filterNames={all:'全部',pending:'所有待办',normal:'普通待办',important:'重要待办',urgent:'紧急事项',overdue:'已逾期'};
function showSheet(id){
 if(sheet)$(sheet).hidden=true;sheet=id;$(id).hidden=false;$('overlay').hidden=false;document.body.classList.add('body-modal');if(native)Native.haptic();
 syncSystemBars();
}
function syncSystemBars(){if(native)Native.setSystemBarsMode(!$('imageViewer').hidden?2:sheet?1:0);}
function closeSheet(){if(sheet==='editor')saveDraft();if(sheet)$(sheet).hidden=true;sheet=null;$('overlay').hidden=true;document.body.classList.remove('body-modal');confirmAction=null;syncSystemBars();}
function confirmDialog(title,text,action,label='确认'){showSheet('confirmSheet');$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmOkay').textContent=label;confirmAction=action;}
function toast(message,undo){clearTimeout(toastTimer);$('toast').hidden=false;$('toast').textContent=message;if(undo){const b=document.createElement('button');b.textContent='撤销';b.onclick=()=>{undo();$('toast').hidden=true;};$('toast').appendChild(b);}toastTimer=setTimeout(()=>$('toast').hidden=true,undo?6500:3500);}
function openEditor(col='flow',id){
 const n=id?state.notes.find(n=>n.id===id):null;
 if(!n&&active(col).length>=CAPACITY[col]){toast(`这栏已满（${CAPACITY[col]} 条），归档一些再添加吧`);return;}
 if(n&&state.draft&&state.draft.editingId===id){draft=clone(state.draft);toast('已恢复上次未保存的修改');}else if(n)draft=clone(n);else if(state.draft&&!state.draft.editingId){draft=clone(state.draft);toast('已恢复上次未保存的草稿');}else draft={id:uid(),column:col,status:'normal',previousStatus:'normal',title:'',body:'',tags:[],due:'',attachments:[],created:Date.now(),updated:Date.now(),location:'active'};
 draft.editingId=id||null;
 $('editorHeading').textContent=id?'编辑便签':'新建便签';$('noteTitle').value=draft.title;$('noteBody').value=draft.body;$('noteTags').value=Array.isArray(draft.tags)?draft.tags.join(', '):'';$('noteDue').value=draft.due||'';
 updateEditorSelection();renderEditorAttachments();showSheet('editor');
}
function updateEditorSelection(){document.querySelectorAll('#columnSelect button').forEach(b=>b.classList.toggle('selected',b.dataset.value===draft.column));document.querySelectorAll('#statusSelect button').forEach(b=>b.classList.toggle('selected',b.dataset.value===draft.status));}
function collectDraft(){if(!draft)return;draft.title=$('noteTitle').value.trim();draft.body=$('noteBody').value;draft.tags=[...new Set($('noteTags').value.split(/[,，#\n]/).map(t=>t.trim().slice(0,30)).filter(Boolean))].slice(0,12);draft.due=$('noteDue').value;}
function saveDraft(){if(!draft)return;clearTimeout(savingTimer);collectDraft();state.draft=(draft.title||draft.body||draft.attachments.length)?clone(draft):null;persist();}
function saveNote(){
 collectDraft();if(!draft.title&&!draft.body.trim()&&!draft.attachments.length){toast('先写点内容，或者加个附件吧');return;}
 const others=active(draft.column).filter(n=>n.id!==draft.editingId);
 if(others.length>=CAPACITY[draft.column]&&draft.status!=='done'){toast(`这栏最多 ${CAPACITY[draft.column]} 条，请换一栏或先归档`);return;}
 const n=clone(draft);delete n.editingId;n.updated=Date.now();n.location=n.status==='done'?'archive':'active';if(n.status!=='done')n.previousStatus=n.status;
 const before=clone(state),existing=state.notes.findIndex(x=>x.id===n.id);if(existing>=0)state.notes[existing]=n;else state.notes.push(n);state.draft=null;
 if(!persist()){state=before;return;}
 draft=null;closeSheet();render();toast(existing>=0?'便签已更新':'便签已收好');
}
function renderEditorAttachments(){if(!draft)return;$('editorAttachments').innerHTML=draft.attachments.map(a=>`<div class="attachment-item">${a.mime.startsWith('image/')?`<img src="${escapeHtml(source(a))}" alt="${escapeHtml(a.name)}">`:icon('file')}<div><div class="attachment-name">${escapeHtml(a.name)}</div><small>${sizeText(a.size)}</small></div><button class="icon-btn" data-remove="${a.id}" aria-label="移除附件">${icon('x')}</button></div>`).join('');}
window.onNativeAttachment=function(a){if(sheet!=='editor'||!draft){toast('附件未添加，请重新打开便签');return;}if(!validAttachment(a)){toast('附件格式不支持');return;}if(draft.attachments.length>=8){toast('每张便签最多 8 个附件');return;}draft.attachments.push(a);renderEditorAttachments();saveDraft();};
window.nativeMessage=message=>toast(message);
window.onNativeImport=()=>{draft=null;closeSheet();loadState();toast('完整备份已恢复');};
window.onNativeBack=()=>{if(!$('imageViewer').hidden){$('imageViewer').hidden=true;return;}if(sheet){closeSheet();return;}if(menuId){menuId=null;render();return;}if(query||filter!=='all'){query='';filter='all';$('search').value='';render();return;}if(native)Native.exitApp();};
function openAttachment(n,id){const a=n.attachments.find(a=>a.id===id);if(!a)return;if(a.mime.startsWith('image/')){$('fullImage').src=source(a);$('imageCaption').textContent=a.name;$('imageViewer').hidden=false;}else if(native)Native.openAttachment(a.id,a.mime,a.name);else{const el=document.createElement('a');el.href=source(a);el.download=a.name;el.click();}}
function reorder(id,mode){const n=state.notes.find(n=>n.id===id),items=active(n.column),i=items.findIndex(x=>x.id===id),target=mode==='top'?0:mode==='up'?i-1:i+1;if(target<0||target>=items.length)return;mutate(()=>{const index=state.notes.indexOf(n);state.notes.splice(index,1);const anchor=state.notes.indexOf(items[target]);state.notes.splice(mode==='down'?anchor+1:anchor,0,n);},mode==='top'?'已移到栏内第一位':null);}
function relocate(id,location){
 const n=state.notes.find(n=>n.id===id);const before=clone(state);
 if(mutate(()=>{n.previousLocation=n.location;n.location=location;n.updated=Date.now();menuId=null;}))toast(location==='trash'?'已放入回收站':'已放入归档盒',()=>{const saved=state.notes.find(x=>x.id===id),original=before.notes.find(x=>x.id===id);if(active(original.column).length>=CAPACITY[original.column]){toast('原栏位已满，请先腾出位置');return;}mutate(()=>{Object.assign(saved,original);},'已撤销');});
}
function act(id,action,el){
 const n=state.notes.find(n=>n.id===id);if(!n)return;
 if(action==='edit'){menuId=null;openEditor(n.column,n.id);return;}
 if(action==='menu'){menuId=menuId===id?null:id;render();return;}
 if(action==='complete'){
  const original=clone(n);
  if(mutate(()=>{if(n.status!=='done')n.previousStatus=n.status;n.status='done';n.location='archive';n.previousLocation='active';n.updated=Date.now();menuId=null;}))toast('已完成',()=>{if(active(original.column).length>=CAPACITY[original.column]){toast('原分页已满');return;}const current=state.notes.find(x=>x.id===id);if(current)mutate(()=>Object.assign(current,original),'已撤销');});
  return;
 }
 if(['top','up','down'].includes(action)){reorder(id,action);return;}
 if(action==='move'){const col=n.column==='flow'?'resident':'flow';if(active(col).length>=CAPACITY[col]){toast(`目标栏已满（${CAPACITY[col]} 条）`);return;}mutate(()=>{n.column=col;menuId=null;},'已移到'+(col==='flow'?'流动便签':'常驻便签'));return;}
 if(action==='archive'||action==='trash'){relocate(id,action);return;}
 if(action==='attachment'){openAttachment(n,el.dataset.attachment);return;}
 if(action==='tag'){query=el.dataset.tag;$('search').value=query;render();return;}
 if(action==='share'){const text=(n.title+'\n\n'+n.body+(n.tags.length?'\n\n'+n.tags.map(t=>'#'+t).join(' '):'')).trim();if(native)Native.shareText(text);else if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>toast('便签文字已复制')).catch(()=>toast('请打开编辑复制文字'));}}
}
function renderStorage(){const items=state.notes.filter(n=>n.location===storageMode);$('storageBulk').hidden=storageMode!=='trash';$('restoreAll').disabled=!items.length;$('deleteAll').disabled=!items.length;$('storageTitle').textContent=storageMode==='archive'?'归档盒':'回收站';$('storageList').innerHTML=items.map(n=>`<div class="storage-card" data-id="${n.id}" data-status="${n.status}"><h3>${escapeHtml(n.title||'无标题便签')}</h3><p>${escapeHtml(n.body)}</p><div class="storage-actions"><button class="text-btn" data-storage="restore">${icon('restore')}恢复</button>${storageMode==='trash'?`<button class="text-btn danger" data-storage="delete">${icon('trash')}永久删除</button>`:`<button class="text-btn danger" data-storage="trash">${icon('trash')}删除</button>`}<small>${n.attachments.length} 个附件</small></div></div>`).join('')||`<div class="empty-state">${icon(storageMode==='archive'?'archive':'trash')}<p>${storageMode==='archive'?'还没有归档的便签':'回收站是空的'}</p><small>留点空间，给新的可能</small></div>`;}
function openStorage(mode){storageMode=mode;showSheet('storageSheet');renderStorage();}
function restoreAllTrash(){
 let restored=0,remaining=0;
 const items=state.notes.filter(n=>n.location==='trash');if(!items.length)return;
 if(!mutate(()=>{items.forEach(n=>{const target=n.previousLocation==='archive'?'archive':'active';if(target==='active'&&active(n.column).length>=CAPACITY[n.column]){remaining++;return;}n.location=target;if(target==='active'&&n.status==='done')n.status=n.previousStatus||'normal';n.updated=Date.now();restored++;});}))return;
 toast(remaining?`已恢复 ${restored} 条，${remaining} 条因分页已满暂留回收站`:`已恢复 ${restored} 条`);
}
function deleteAllTrash(){
 const count=state.notes.filter(n=>n.location==='trash').length;if(!count)return;
 confirmDialog('删除全部？',`永久删除回收站中的 ${count} 条便签及其附件，无法恢复。`,()=>{mutate(()=>state.notes=state.notes.filter(n=>n.location!=='trash'),'回收站已清空');openStorage('trash');},'删除全部');
}
function restoreNote(id){const n=state.notes.find(n=>n.id===id);const target=n.previousLocation==='archive'&&storageMode==='trash'?'archive':'active';if(target==='active'&&active(n.column).length>=CAPACITY[n.column]){toast(`原栏已满（${CAPACITY[n.column]} 条），请先腾出位置`);return;}mutate(()=>{n.location=target;if(target==='active'&&n.status==='done')n.status=n.previousStatus||'normal';n.updated=Date.now();},'便签已恢复'+(target==='archive'?'到归档盒':''));}
function showFilters(){$('filterOptions').innerHTML=Object.entries(filterNames).map(([v,t])=>`<button data-filter="${v}" class="${filter===v?'selected':''}">${STATUS[v]?`<i class="status-dot ${STATUS[v].color}"></i>`:icon(v==='overdue'?'calendar':v==='all'?'layers':'circle')}${t}${filter===v?icon('check'):''}</button>`).join('');showSheet('filterSheet');}
async function browserAttach(files){for(const f of files){if(draft.attachments.length>=8){toast('每张便签最多 8 个附件');break;}if(f.size>20*1024*1024){toast(f.name+' 超过 20 MB');continue;}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});window.onNativeAttachment({id:uid(),name:f.name.slice(0,250),mime:f.type||'application/octet-stream',size:f.size,data});}}
function exportBackup(){if(native){Native.exportBackup();return;}const b=new Blob([JSON.stringify(state)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=`拾记备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出');}
function importBackup(){if(native){closeSheet();Native.importBackup();return;}$('backupFile').click();}
function setupDrag(){
 let dragging=null,scrollTimer=null;
 document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-action="drag"]');if(!handle||e.button!==0)return;const el=handle.closest('.note-card');dragging={el,id:el.dataset.id,column:el.closest('.column').dataset.column,startY:e.clientY,lastY:e.clientY,moved:false,pointer:e.pointerId,handle};handle.setPointerCapture(e.pointerId);e.preventDefault();});
 document.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.pointer)return;const d=dragging;d.lastY=e.clientY;if(!d.moved&&Math.abs(e.clientY-d.startY)<6)return;d.moved=true;d.el.classList.add('dragging');e.preventDefault();const siblings=[...d.el.parentElement.querySelectorAll('.note-card')].filter(el=>el!==d.el);const target=siblings.find(el=>e.clientY<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);if(target)d.el.parentElement.insertBefore(d.el,target);else d.el.parentElement.appendChild(d.el);if(!scrollTimer)scrollTimer=setInterval(()=>{if(!dragging)return;const y=dragging.lastY;if(y<95)window.scrollBy(0,-12);else if(y>innerHeight-90)window.scrollBy(0,12);},30);},{passive:false});
 function finish(e){if(!dragging||e.pointerId!==dragging.pointer)return;const d=dragging;dragging=null;clearInterval(scrollTimer);scrollTimer=null;d.el.classList.remove('dragging');if(!d.moved)return;const domIds=[...d.el.parentElement.querySelectorAll('.note-card')].map(el=>el.dataset.id);mutate(()=>{const visibleIds=new Set(domIds),arr=domIds.map(id=>state.notes.find(n=>n.id===id));let i=0;state.notes=state.notes.map(n=>visibleIds.has(n.id)?arr[i++]:n);},'顺序已保存');if(native)Native.haptic();}
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
}
hydrate();
new MutationObserver(syncSystemBars).observe($('imageViewer'),{attributes:true,attributeFilter:['hidden']});
const now=new Date();$('monthLabel').textContent=now.toLocaleDateString('zh-CN',{month:'long'});$('dayLabel').textContent=now.getDate();$('weekLabel').textContent=now.toLocaleDateString('zh-CN',{weekday:'long'});
loadState();setupDrag();
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openEditor(b.dataset.add));
$('quickAdd').onclick=()=>openEditor(state.page||'flow');
document.querySelectorAll('[data-page]').forEach(b=>{b.onclick=()=>switchPage(b.dataset.page);b.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();switchPage(state.page==='flow'?'resident':'flow');document.querySelector('[data-page="'+state.page+'"]').focus();}};});
$('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('settingsBtn').onclick=()=>showSheet('menuSheet');
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
const systemThemeQuery=matchMedia('(prefers-color-scheme: dark)');
const systemThemeListener=()=>{if(state.theme==='system')applyTheme();};
if(systemThemeQuery.addEventListener)systemThemeQuery.addEventListener('change',systemThemeListener);else systemThemeQuery.addListener(systemThemeListener);
$('search').oninput=e=>{query=e.target.value.trim();render();};$('clearSearch').onclick=()=>{query='';$('search').value='';render();};$('filterBtn').onclick=showFilters;
$('filterOptions').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;closeSheet();render();}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheet);$('overlay').onclick=closeSheet;
$('columnSelect').onclick=e=>{const b=e.target.closest('[data-value]');if(b){draft.column=b.dataset.value;updateEditorSelection();saveDraft();}};
$('statusSelect').onclick=e=>{const b=e.target.closest('[data-value]');if(b){if(b.dataset.value==='done'&&draft.status!=='done')draft.previousStatus=draft.status;draft.status=b.dataset.value;updateEditorSelection();saveDraft();}};
['noteTitle','noteBody','noteTags','noteDue'].forEach(id=>$(id).addEventListener('input',()=>{clearTimeout(savingTimer);savingTimer=setTimeout(saveDraft,500);}));
$('saveNote').onclick=saveNote;
$('attachBtn').onclick=()=>{if(draft.attachments.length>=8){toast('每张便签最多 8 个附件');return;}if(native)Native.pickAttachment(8-draft.attachments.length);else $('browserFile').click();};
$('browserFile').onchange=async e=>{try{await browserAttach([...e.target.files]);}catch(err){toast('附件读取失败');}e.target.value='';};
$('editorAttachments').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){draft.attachments=draft.attachments.filter(a=>a.id!==b.dataset.remove);renderEditorAttachments();saveDraft();}};
document.querySelector('.board').onclick=e=>{const b=e.target.closest('[data-action]'),n=e.target.closest('.note-card');if(b&&n&&b.dataset.action!=='drag')act(n.dataset.id,b.dataset.action,b);};
document.querySelector('.board').onkeydown=e=>{if(e.target.classList.contains('note-card')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();act(e.target.dataset.id,'edit',e.target);}};
$('archiveView').onclick=()=>openStorage('archive');$('trashView').onclick=()=>openStorage('trash');
$('restoreAll').onclick=restoreAllTrash;$('deleteAll').onclick=deleteAllTrash;
$('archiveDone').onclick=()=>{const done=active().filter(n=>n.status==='done');if(!done.length){toast('还没有已完成的便签');return;}mutate(()=>done.forEach(n=>{n.location='archive';n.updated=Date.now();}),`已归档 ${done.length} 张完成的便签`);};
$('storageList').onclick=e=>{const b=e.target.closest('[data-storage]'),n=e.target.closest('[data-id]');if(!b||!n)return;const id=n.dataset.id;if(b.dataset.storage==='restore')restoreNote(id);else if(b.dataset.storage==='trash'){mutate(()=>{const item=state.notes.find(x=>x.id===id);item.previousLocation='archive';item.location='trash';},'已放入回收站');}else confirmDialog('永久删除这张便签？','便签及其附件将无法恢复。',()=>{mutate(()=>state.notes=state.notes.filter(n=>n.id!==id),'已永久删除');openStorage('trash');},'永久删除');};
$('exportBtn').onclick=exportBackup;$('importBtn').onclick=importBackup;
$('backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>100*1024*1024)throw Error('备份文件太大');const incoming=validateState(JSON.parse(await f.text()));confirmDialog('恢复这份备份？',`包含 ${incoming.notes.length} 张便签。当前便签和附件将被替换，建议先导出备份。`,()=>{const before=state;state=incoming;if(!persist()){state=before;return;}draft=null;closeSheet();applyTheme();render();toast('备份已恢复');},'恢复备份');}catch(err){toast('无法恢复：'+err.message);}e.target.value='';};
$('confirmCancel').onclick=closeSheet;$('confirmOkay').onclick=()=>{const fn=confirmAction;closeSheet();if(fn)fn();};
$('closeImage').onclick=()=>$('imageViewer').hidden=true;
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.onNativeBack();if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&sheet==='editor')saveNote();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sheet==='editor')saveDraft();});
window.addEventListener('pagehide',()=>{if(sheet==='editor')saveDraft();});
window.ShijiTest={getState:()=>clone(state),validateState,active,openEditor,act};
