/* 我的電子衣櫃 — app logic (Supabase: auth + tables + private photo storage) */
const CATS=["背心","上衣","針織／開衫","外套","褲子","裙子","洋裝","鞋子","包包","配件"];
const COLORS=[["黑","#222326"],["灰","#8A8D93"],["白","#F4F4F2"],["藏藍","#2F3A56"],["咖啡","#6B4A36"],["米杏","#D9C9AD"],["粉","#E9BCC2"],["藍","#6F8FC7"],["綠","#7F9A7A"],["條紋","stripe"],["格紋","check"],["花色","multi"]];
const SEASONS=["春","夏","秋","冬"];
const FREQ=[["often","常穿"],["some","偶爾"],["never","不穿"]];
const ACTIONS=[["keep","保留"],["alter","要修改"],["wait","再觀察"],["give","送走"]];
const TABS=["closet","outfits","trends","todo","wish"];
const freqLabel=k=>(FREQ.find(f=>f[0]===k)||[,""])[1];

const cfg=window.WARDROBE_CONFIG||{};
let sb=null, uid=null;
const S={items:[],outfits:[],wish:[],trends:null,trendsErr:false,loaded:false,urls:{},cat:"全部",freq:"all",tab:"closet",lastLoad:0};

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
function h(tag,attrs,...kids){const el=document.createElement(tag);
  if(attrs)for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;
    if(k==="class")el.className=v;else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);
    else if(k==="text")el.textContent=v;else el.setAttribute(k,v===true?"":v);}
  for(const c of kids.flat()){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)));}
  return el;}
function photoSrc(p){if(!p)return null;if(/^(blob:|data:|https?:)/.test(p))return p;return S.urls[p]||null;}
function ph(p,emptyText,extraClass){const box=h("div",{class:"ph"+(extraClass?" "+extraClass:"")});const src=photoSrc(p);
  if(src)box.append(h("img",{src,alt:"",loading:"lazy"}));else box.append(h("span",{class:"ph-empty",text:emptyText||"還沒有照片"}));return box;}
function sw(name){const c=COLORS.find(x=>x[0]===name);const s=h("span",{class:"sw"});if(!c)return s;
  if(c[1]==="stripe")s.classList.add("stripe");else if(c[1]==="multi")s.classList.add("multi");else if(c[1]==="check")s.classList.add("check");else s.style.background=c[1];return s;}
let toastT;function toast(msg){document.querySelectorAll(".toast").forEach(t=>t.remove());const t=h("div",{class:"toast",role:"status",text:msg});document.body.append(t);clearTimeout(toastT);toastT=setTimeout(()=>t.remove(),3000);}
function errMsg(e){const m=String((e&&(e.message||e.error_description))||"");
  if(/JWT|not authenticated|401/i.test(m))return "登入過期了，請重新登入。";
  if(/exceeded|too large|413|Payload/i.test(m))return "照片太大了，換一張試試。";
  if(/row-level security|permission|403/i.test(m))return "沒有權限存這筆資料，請重新登入再試。";
  if(/Failed to fetch|NetworkError|network/i.test(m))return "網路好像斷了，連上之後再試一次。";
  return "沒有存成功，請再試一次。";}
async function q(p){const{data,error}=await p;if(error)throw error;return data;}
const ts=v=>v?Date.parse(v)||0:0;
const byNew=(a,b)=>(b.createdAt||0)-(a.createdAt||0);
function note(msg){const n=$("notice");n.replaceChildren();if(msg)n.append(h("div",{class:"notice",text:msg}));}

/* ---------- data ---------- */
const mapItem=r=>({id:r.id,name:r.name||"",cat:r.cat,colors:r.colors||[],seasons:r.seasons||[],freq:r.freq,reason:r.reason||"",action:r.action,note:r.note||"",photo:r.photo,createdAt:ts(r.created_at)});
const mapOutfit=r=>({id:r.id,name:r.name||"",itemIds:r.item_ids||[],note:r.note||"",photo:r.photo,createdAt:ts(r.created_at)});
const mapWish=r=>({id:r.id,text:r.text,done:!!r.done,createdAt:ts(r.created_at)});

async function loadAll(){
  try{
    const[a,b,c]=await Promise.all([q(sb.from("items").select("*")),q(sb.from("outfits").select("*")),q(sb.from("wishlist").select("*"))]);
    S.items=a.map(mapItem);S.outfits=b.map(mapOutfit);S.wish=c.map(mapWish);
    await signPhotos(true);S.loaded=true;S.lastLoad=Date.now();note("");
  }catch(e){S.loaded=true;note("讀不到衣櫃資料："+errMsg(e));}
  if(!document.querySelector(".scrim"))render();else renderHeader();
}
async function signPhotos(all){
  const paths=[...new Set([...S.items,...S.outfits].map(x=>x.photo).filter(p=>p&&!/^(blob:|data:|https?:)/.test(p)&&(all||!S.urls[p])))];
  if(!paths.length)return;
  try{const data=await q(sb.storage.from("photos").createSignedUrls(paths,60*60*6));
    data.forEach(d=>{if(d.signedUrl&&d.path)S.urls[d.path]=d.signedUrl;});}catch(e){}
}
async function loadTrends(){
  try{const r=await fetch("trends.json?v="+Date.now());if(!r.ok)throw 0;S.trends=await r.json();}catch(e){S.trendsErr=true;}
  if(S.tab==="trends"&&!document.querySelector(".scrim"))render();
}

/* ---------- photo ---------- */
async function compress(file){try{const bmp=await createImageBitmap(file,{imageOrientation:"from-image"});
  const max=1400,s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement("canvas");c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",.85));}catch(e){return file;}}
function newId(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));}
async function uploadPhoto(file){const blob=await compress(file);const ext=blob.type==="image/png"?"png":"jpg";
  const path=`${uid}/${newId()}.${ext}`;
  await q(sb.storage.from("photos").upload(path,blob,{contentType:blob.type||"image/jpeg",upsert:false}));
  S.urls[path]=URL.createObjectURL(blob);return path;}
async function dropPhoto(path){if(!path||/^(blob:|data:|https?:)/.test(path))return;try{await sb.storage.from("photos").remove([path]);}catch(e){}}
function photoField(current,onPick){
  let preview=ph(current,"還沒有照片");const wrap=h("div",{class:"photo-pick"});
  const input=h("input",{type:"file",accept:"image/*",id:"photo-input","aria-label":"選照片"});
  input.addEventListener("change",()=>{const f=input.files&&input.files[0];if(!f)return;
    const np=ph(URL.createObjectURL(f));preview.replaceWith(np);preview=np;onPick(f);});
  wrap.append(preview,h("div",{class:"acts"},h("span",{class:"btn ghost filebtn"},current?"換一張照片":"選照片",input),
    h("span",{class:"hint",text:"可以拍照或從相簿選，會自動壓縮。"})));
  return wrap;}

/* ---------- header ---------- */
function todoItems(){const alter=S.items.filter(i=>i.action==="alter"),give=S.items.filter(i=>i.action==="give"),
  undecided=S.items.filter(i=>i.freq==="never"&&!["alter","give","keep"].includes(i.action));return{alter,give,undecided,all:[...alter,...give,...undecided]};}
function renderHeader(){
  const it=S.items,c={often:0,some:0,never:0};it.forEach(i=>{if(c[i.freq]!=null)c[i.freq]++;});
  const sum=$("summary"),ratio=$("ratio");sum.replaceChildren();ratio.replaceChildren();
  if(!S.loaded)sum.append(h("span",{text:"正在打開衣櫃…"}));
  else{sum.append(h("span",null,"共 ",h("b",{text:it.length})," 件"),h("span",null,"常穿 ",h("b",{text:c.often})),h("span",null,"偶爾 ",h("b",{text:c.some})),h("span",null,"不穿 ",h("b",{text:c.never})));
    const tot=c.often+c.some+c.never;if(tot)[["often","--often"],["some","--some"],["never","--never"]].forEach(([k,v])=>{if(c[k])ratio.append(h("span",{style:`width:${c[k]/tot*100}%;background:var(${v})`}));});}
  $("n-closet").textContent=it.length||"";$("n-outfits").textContent=S.outfits.length||"";
  $("n-todo").textContent=todoItems().all.length||"";$("n-wish").textContent=S.wish.filter(w=>!w.done).length||"";
  document.querySelectorAll("#tabs a").forEach(a=>{if(a.dataset.tab===S.tab)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  const fab=$("fab");fab.hidden=!["closet","outfits","todo"].includes(S.tab);fab.textContent=S.tab==="outfits"?"＋ 新增搭配":"＋ 新增衣服";
}

/* ---------- views ---------- */
function render(){renderHeader();$("view").replaceChildren(({closet:viewCloset,outfits:viewOutfits,trends:viewTrends,todo:viewTodo,wish:viewWish}[S.tab])());}
function itemCard(i){const box=ph(i.photo);
  if(i.action==="alter")box.append(h("span",{class:"flag",text:"要修改"}));if(i.action==="give")box.append(h("span",{class:"flag",text:"送走"}));
  return h("button",{class:"card",type:"button",onclick:()=>openItem(i)},box,
    h("div",{class:"meta"},h("div",{class:"name",text:i.name||i.cat||"未命名"}),
      h("div",{class:"sub"},i.freq?h("span",{class:"pill "+i.freq,text:freqLabel(i.freq)}):null,h("span",{class:"dots"},(i.colors||[]).slice(0,4).map(sw)),h("span",{text:i.cat||""}))));}

function viewCloset(){
  const f=h("div",{class:"filters"});
  const catRow=h("div",{class:"chips",role:"group","aria-label":"類別"});
  ["全部",...CATS].forEach(c=>{const n=c==="全部"?S.items.length:S.items.filter(i=>i.cat===c).length;if(c!=="全部"&&!n&&S.cat!==c)return;
    catRow.append(h("button",{class:"chip",type:"button","aria-pressed":String(S.cat===c),onclick:()=>{S.cat=c;render();}},c,n?h("span",{style:"opacity:.7;font-size:12px",text:n}):null));});
  const fRow=h("div",{class:"chips",role:"group","aria-label":"穿著頻率"});
  [["all","全部頻率"],...FREQ].forEach(([k,l])=>fRow.append(h("button",{class:"chip",type:"button","aria-pressed":String(S.freq===k),onclick:()=>{S.freq=k;render();}},l)));
  f.append(catRow,fRow);
  if(!S.loaded)return h("div",null,f,h("p",{class:"hint",text:"正在讀取衣服…"}));
  if(!S.items.length)return h("div",{class:"empty"},h("h2",{text:"衣櫃還是空的"}),
    h("ol",null,h("li",null,h("b",{text:"把衣服平鋪或掛起來，"}),"整件入鏡拍一張，背景越素越好，白天靠窗光線最準。"),
      h("li",null,h("b",{text:"按右下角「新增衣服」，"}),"放上照片、選類別和顏色。"),
      h("li",null,h("b",{text:"標記常穿、偶爾或不穿。"}),"不穿的寫一句原因，之後會出現在「待處理」。")));
  const list=S.items.filter(i=>(S.cat==="全部"||i.cat===S.cat)&&(S.freq==="all"||i.freq===S.freq)).sort(byNew);
  return h("div",null,f,list.length?h("div",{class:"grid"},list.map(itemCard)):h("p",{class:"hint",text:"這個篩選條件下沒有衣服。"}));
}

function viewTodo(){
  if(!S.loaded)return h("p",{class:"hint",text:"正在讀取…"});
  const t=todoItems();
  if(!t.all.length)return h("div",{class:"empty"},h("h2",{text:"目前沒有要處理的衣服"}),h("p",{class:"hint",text:"把衣服標成「不穿」，或處理方式選「要修改」「送走」，就會出現在這裡。"}));
  const sec=(title,arr,why)=>arr.length?h("section",null,h("div",{class:"section-h"},h("h2",{text:title}),h("span",{text:arr.length+" 件"})),
    h("div",{class:"rows"},[...arr].sort(byNew).map(i=>h("button",{class:"row",type:"button",onclick:()=>openItem(i)},ph(i.photo," "),
      h("div",{class:"t"},h("div",{class:"name",text:i.name||i.cat||"未命名"}),h("div",{class:"why",text:why(i)})),
      i.freq?h("span",{class:"pill "+i.freq,text:freqLabel(i.freq)}):h("span"))))):null;
  return h("div",null,sec("要修改",t.alter,i=>i.reason||i.note||"例如改褲長、改裙長"),
    sec("要送走",t.give,i=>i.reason||"可以拿去二手店或捐出去"),
    sec("不穿，還沒決定",t.undecided,i=>i.reason?"原因："+i.reason:"還沒寫原因，點進去補一句"));
}

function viewOutfits(){
  if(!S.loaded)return h("p",{class:"hint",text:"正在讀取搭配…"});
  if(!S.outfits.length)return h("div",{class:"empty"},h("h2",{text:"還沒有存任何搭配"}),
    h("ol",null,h("li",null,"試出一套喜歡的，穿起來拍一張全身照。"),h("li",null,"按「新增搭配」，勾選這套用到的衣服。"),h("li",null,"早上不知道穿什麼，就來這裡翻。")));
  const map=new Map(S.items.map(i=>[i.id,i]));
  return h("div",{class:"rows",style:"gap:12px"},[...S.outfits].sort(byNew).map(o=>{const used=o.itemIds.map(id=>map.get(id)).filter(Boolean);
    return h("button",{class:"outfit",type:"button",onclick:()=>openOutfit(o)},ph(o.photo||(used[0]&&used[0].photo)," "),
      h("div",{class:"body"},h("div",{class:"name",text:o.name||"未命名搭配"}),
        used.length?h("div",{class:"strip"},used.map(i=>ph(i.photo," "))):h("div",{class:"hint",text:"還沒勾選衣服"}),
        o.note?h("div",{class:"note",text:o.note}):null));}));
}

/* trend matching: a piece is "owned" when an item has the same category and shares a color (no colors listed = any color) */
function matchPiece(p){const cats=[].concat(p.cat);return S.items.filter(i=>cats.includes(i.cat)&&(!p.colors||!p.colors.length||(i.colors||[]).some(c=>p.colors.includes(c))));}
function trendScore(t){const got=t.pieces.filter(p=>matchPiece(p).length).length;return{got,total:t.pieces.length};}
async function addWish(text,btn){if(S.wish.some(w=>!w.done&&w.text===text)){toast("已經在「要買的」清單裡了");return;}
  btn.disabled=true;try{const r=await q(sb.from("wishlist").insert({text}).select().single());S.wish.push(mapWish(r));btn.textContent="已加入";renderHeader();toast("加到「要買的」了");}
  catch(e){btn.disabled=false;toast(errMsg(e));}}
function viewTrends(){
  if(S.trendsErr)return h("div",{class:"empty"},h("h2",{text:"讀不到這個月的趨勢"}),h("p",{class:"hint",text:"請檢查網路後重新整理頁面。"}));
  if(!S.trends)return h("p",{class:"hint",text:"正在讀取這個月的趨勢…"});
  const T=S.trends;
  const sorted=[...T.trends].sort((a,b)=>{const A=trendScore(a),B=trendScore(b);return (B.got/B.total)-(A.got/A.total);});
  return h("div",null,
    h("div",{class:"trend-intro"},h("div",{class:"when",text:`${T.season}・${T.updated} 更新`}),h("p",{text:T.summary}),
      h("p",{class:"hint",text:S.items.length?"已經能用你衣櫃裡的衣服做出來的趨勢排在前面。":"衣櫃還沒有衣服，新增之後這裡會顯示哪些你已經有、還缺什麼。"})),
    sorted.map(t=>{const sc=trendScore(t);const cls=sc.got===sc.total?"full":sc.got?"part":"none";
      return h("article",{class:"trend"},
        h("div",{class:"trend-h"},h("h3",{text:t.title}),h("span",{class:"score "+cls,text:sc.got===sc.total?"你都有":`有 ${sc.got}／${sc.total}`})),
        h("p",{text:t.desc}),
        t.petite?h("div",{class:"tip",text:"小個子重點："+t.petite}):null,
        t.pieces.map(p=>{const own=matchPiece(p);const sleeping=own.filter(i=>i.freq==="never");
          return h("div",{class:"piece"},
            h("div",{class:"piece-h"},h("span",{text:p.label}),
              own.length?h("span",{class:"pill often",text:`有 ${own.length} 件`}):h("button",{class:"mini",type:"button",onclick:e=>addWish(p.label,e.currentTarget)},"＋ 加到要買的")),
            own.length?h("div",{class:"have"},own.map(i=>{const b=h("button",{type:"button",style:"border:0;padding:0;background:none",onclick:()=>openItem(i),"aria-label":i.name||i.cat},ph(i.photo," ",i.freq==="never"?"sleep":""));return b;})):null,
            sleeping.length?h("div",{class:"hint",text:`其中 ${sleeping.length} 件你標成「不穿」，試試照這個趨勢搭看看。`}):null);}));}),
    T.sources&&T.sources.length?h("div",{class:"src"},h("span",{text:"參考來源"}),T.sources.map(s=>h("a",{href:s.url,target:"_blank",rel:"noopener",text:s.title}))):null);
}

function viewWish(){
  const inp=h("input",{type:"text",id:"wish-input",placeholder:"例如：灰色短版開衫（XS）","aria-label":"要買的東西",maxlength:"80"});
  const btn=h("button",{class:"btn",type:"submit"},"加入");
  const form=h("form",{class:"wish-form",onsubmit:async e=>{e.preventDefault();const v=inp.value.trim();if(!v)return;btn.disabled=true;
    try{const r=await q(sb.from("wishlist").insert({text:v}).select().single());S.wish.push(mapWish(r));render();$("wish-input").focus();}
    catch(err){toast(errMsg(err));btn.disabled=false;}}},inp,btn);
  const list=[...S.wish].sort((a,b)=>(a.done-b.done)||byNew(a,b));
  return h("div",null,h("p",{class:"hint",style:"margin:4px 0 8px",text:"盤點完之後真正缺的單品記在這裡，逛街時照著買。"}),form,
    !S.loaded?h("p",{class:"hint",text:"正在讀取…"}):
    list.length?h("div",{class:"rows"},list.map(w=>h("div",{class:"wish"+(w.done?" done":"")},
      h("input",{type:"checkbox",id:"w-"+w.id,checked:w.done,"aria-label":"已買到",onchange:async e=>{const v=e.target.checked;
        try{await q(sb.from("wishlist").update({done:v}).eq("id",w.id));w.done=v;render();}catch(err){e.target.checked=!v;toast(errMsg(err));}}}),
      h("label",{class:"txt",for:"w-"+w.id,text:w.text}),
      h("button",{class:"x",type:"button","aria-label":"刪除",onclick:async()=>{try{await q(sb.from("wishlist").delete().eq("id",w.id));S.wish=S.wish.filter(x=>x.id!==w.id);render();}catch(err){toast(errMsg(err));}}},"×")))):
    h("p",{class:"hint",text:"清單是空的。也可以在「推薦」頁直接把缺的單品加進來。"}));
}

/* ---------- sheets ---------- */
function closeSheet(){const had=!!document.querySelector(".scrim");$("layer").replaceChildren();document.body.style.overflow="";if(had)render();}
function sheet(title,content,actions){const sc=h("div",{class:"scrim",onclick:e=>{if(e.target===sc)closeSheet();}});
  sc.append(h("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-label":title},h("h2",{text:title}),content,h("div",{class:"sheet-actions"},actions)));
  $("layer").replaceChildren(sc);document.body.style.overflow="hidden";}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();});
function chipGroup(label,options,value,multi,onChange,swatch){const box=h("div",{class:"chips wrap-row",role:"group","aria-label":label});let val=multi?[...(value||[])]:value;
  const draw=()=>{box.replaceChildren();options.forEach(o=>{const[k,l]=Array.isArray(o)?o:[o,o];const on=multi?val.includes(k):val===k;
    box.append(h("button",{class:"chip",type:"button","aria-pressed":String(on),onclick:()=>{if(multi)val=on?val.filter(x=>x!==k):[...val,k];else val=on?null:k;onChange(val);draw();}},swatch?sw(k):null,l));});};
  draw();return box;}
function field(label,el){return h("div",{class:"field"},h("span",{class:"lab",text:label}),el);}
function confirmDelete(btn,run){let armed=false;btn.addEventListener("click",async()=>{if(!armed){armed=true;btn.textContent="再按一次確認刪除";setTimeout(()=>{armed=false;btn.textContent="刪除";},3500);return;}btn.disabled=true;await run();});}

function openItem(item){
  const d=item?{...item}:{name:"",cat:S.cat!=="全部"?S.cat:null,colors:[],seasons:[],freq:null,reason:"",action:null,note:""};
  let file=null;
  const name=h("input",{type:"text",id:"f-name",value:d.name||"",placeholder:"例如：深灰寬褲、白色背心",maxlength:"40"});
  const reason=h("input",{type:"text",id:"f-reason",value:d.reason||"",placeholder:"例如：太長、會刺、不知道配什麼",maxlength:"60"});
  const reasonF=field("為什麼不穿？",reason);reasonF.hidden=d.freq!=="never";
  const noteEl=h("textarea",{id:"f-note",placeholder:"尺寸、哪裡買的、怎麼搭比較好看…"},d.note||"");
  const body=h("div",{style:"display:grid;gap:16px"},photoField(d.photo,f=>file=f),field("名稱",name),
    field("類別",chipGroup("類別",CATS,d.cat,false,v=>d.cat=v)),
    field("顏色（可複選）",chipGroup("顏色",COLORS.map(c=>c[0]),d.colors,true,v=>d.colors=v,true)),
    field("季節（可複選）",chipGroup("季節",SEASONS,d.seasons,true,v=>d.seasons=v)),
    field("多常穿？",chipGroup("穿著頻率",FREQ,d.freq,false,v=>{d.freq=v;reasonF.hidden=v!=="never";})),
    reasonF,field("處理方式",chipGroup("處理方式",ACTIONS,d.action,false,v=>d.action=v)),field("備註",noteEl));
  const save=h("button",{class:"btn",type:"button"},"儲存");const actions=[];
  if(item){const del=h("button",{class:"btn danger",type:"button"},"刪除");
    confirmDelete(del,async()=>{try{await q(sb.from("items").delete().eq("id",item.id));dropPhoto(item.photo);
      S.items=S.items.filter(i=>i.id!==item.id);closeSheet();toast("已刪除");}catch(e){toast(errMsg(e));del.disabled=false;}});actions.push(del);}
  actions.push(h("div",{class:"right"},h("button",{class:"btn ghost",type:"button",onclick:closeSheet},"取消"),save));
  save.addEventListener("click",async()=>{
    if(!d.cat&&!name.value.trim()&&!file&&!d.photo)return toast("至少選個類別或寫個名稱。");
    save.disabled=true;save.textContent=file?"上傳照片中…":"儲存中…";
    try{let photo=d.photo||null;if(file)photo=await uploadPhoto(file);
      const row={name:name.value.trim(),cat:d.cat||null,colors:d.colors||[],seasons:d.seasons||[],freq:d.freq||null,
        reason:d.freq==="never"?reason.value.trim():"",action:d.action||null,note:noteEl.value.trim(),photo,updated_at:new Date().toISOString()};
      if(item){const r=await q(sb.from("items").update(row).eq("id",item.id).select().single());
        if(file&&item.photo&&item.photo!==photo)dropPhoto(item.photo);S.items=S.items.map(i=>i.id===item.id?mapItem(r):i);}
      else{const r=await q(sb.from("items").insert(row).select().single());S.items.push(mapItem(r));}
      closeSheet();toast(item?"已更新":"已放進衣櫃");}
    catch(e){toast(errMsg(e));save.disabled=false;save.textContent="儲存";}});
  sheet(item?"編輯衣服":"新增衣服",body,actions);
}

function openOutfit(o){
  const d=o?{...o,itemIds:[...o.itemIds]}:{name:"",itemIds:[],note:""};let file=null;
  const name=h("input",{type:"text",id:"o-name",value:d.name||"",placeholder:"例如：灰開衫＋藏藍寬褲",maxlength:"40"});
  const noteEl=h("textarea",{id:"o-note",placeholder:"適合什麼場合、天氣幾度…"},d.note||"");
  const picks=h("div",{class:"pick-grid"});
  [...S.items].sort((a,b)=>CATS.indexOf(a.cat)-CATS.indexOf(b.cat)).forEach(i=>{
    const b=h("button",{class:"pick",type:"button","aria-pressed":String(d.itemIds.includes(i.id)),"aria-label":i.name||i.cat||"衣服"},ph(i.photo," "),h("span",{class:"cap",text:i.name||i.cat||""}));
    b.addEventListener("click",()=>{const on=d.itemIds.includes(i.id);d.itemIds=on?d.itemIds.filter(x=>x!==i.id):[...d.itemIds,i.id];b.setAttribute("aria-pressed",String(!on));});picks.append(b);});
  const body=h("div",{style:"display:grid;gap:16px"},photoField(d.photo,f=>file=f),field("搭配名稱",name),
    field("用到哪些衣服",S.items.length?picks:h("p",{class:"hint",text:"衣櫃裡還沒有衣服，先新增衣服再回來勾選。"})),field("備註",noteEl));
  const save=h("button",{class:"btn",type:"button"},"儲存");const actions=[];
  if(o){const del=h("button",{class:"btn danger",type:"button"},"刪除");
    confirmDelete(del,async()=>{try{await q(sb.from("outfits").delete().eq("id",o.id));dropPhoto(o.photo);
      S.outfits=S.outfits.filter(x=>x.id!==o.id);closeSheet();toast("已刪除");}catch(e){toast(errMsg(e));del.disabled=false;}});actions.push(del);}
  actions.push(h("div",{class:"right"},h("button",{class:"btn ghost",type:"button",onclick:closeSheet},"取消"),save));
  save.addEventListener("click",async()=>{save.disabled=true;save.textContent=file?"上傳照片中…":"儲存中…";
    try{let photo=d.photo||null;if(file)photo=await uploadPhoto(file);
      const row={name:name.value.trim(),item_ids:d.itemIds,note:noteEl.value.trim(),photo,updated_at:new Date().toISOString()};
      if(o){const r=await q(sb.from("outfits").update(row).eq("id",o.id).select().single());
        if(file&&o.photo&&o.photo!==photo)dropPhoto(o.photo);S.outfits=S.outfits.map(x=>x.id===o.id?mapOutfit(r):x);}
      else{const r=await q(sb.from("outfits").insert(row).select().single());S.outfits.push(mapOutfit(r));}
      closeSheet();toast(o?"已更新":"搭配已存好");}catch(e){toast(errMsg(e));save.disabled=false;save.textContent="儲存";}});
  sheet(o?"編輯搭配":"新增搭配",body,actions);
}

/* ---------- auth ---------- */
let mode="login";
function setMode(m){mode=m;$("auth-submit").textContent=m==="login"?"登入":"建立帳號";
  $("auth-switch").textContent=m==="login"?"第一次使用？建立帳號":"已經有帳號？登入";
  $("auth-pass").autocomplete=m==="login"?"current-password":"new-password";authMsg("");}
function authMsg(t,ok){const m=$("auth-msg");m.textContent=t;m.className="msg"+(ok?" ok":"");}
function authErr(e){const m=String(e&&e.message||"");
  if(/Invalid login/i.test(m))return "Email 或密碼不對。";
  if(/not confirmed/i.test(m))return "還沒點確認信裡的連結，點完再回來登入。";
  if(/already registered/i.test(m))return "這個 Email 已經註冊過，直接登入就好。";
  if(/Password/i.test(m))return "密碼至少要 6 個字。";
  if(/Signups not allowed/i.test(m))return "目前不開放註冊。";
  if(/rate limit/i.test(m))return "嘗試太多次了，等幾分鐘再試。";
  return "沒有成功，請檢查網路後再試一次。";}
$("auth-switch").addEventListener("click",()=>setMode(mode==="login"?"signup":"login"));
$("auth-form").addEventListener("submit",async e=>{e.preventDefault();const email=$("auth-email").value.trim(),password=$("auth-pass").value;
  const b=$("auth-submit");b.disabled=true;authMsg("");
  try{if(mode==="login"){await q(sb.auth.signInWithPassword({email,password}));}
    else{const data=await q(sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}));
      if(!data.session){setMode("login");authMsg("確認信已寄到 "+email+"，點信裡的連結之後回來登入。",true);}}}
  catch(err){authMsg(authErr(err));}
  b.disabled=false;});
$("logout").addEventListener("click",async()=>{await sb.auth.signOut();});

function showSignedIn(session){
  const was=uid;uid=session.user.id;$("auth").hidden=true;$("app").hidden=false;
  if(was!==uid){S.loaded=false;S.items=[];S.outfits=[];S.wish=[];S.urls={};route();loadAll();}
}
function showSignedOut(){uid=null;$("app").hidden=true;$("fab").hidden=true;closeSheet();$("auth").hidden=false;}

/* ---------- routing & boot ---------- */
function route(){const t=(location.hash||"").slice(1);S.tab=TABS.includes(t)?t:"closet";if(uid)render();}
window.addEventListener("hashchange",route);
$("fab").addEventListener("click",()=>S.tab==="outfits"?openOutfit(null):openItem(null));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&uid&&Date.now()-S.lastLoad>30000)loadAll();});

(function boot(){
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseAnonKey){$("setup").hidden=false;return;}
  sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  sb.auth.onAuthStateChange((_evt,session)=>{if(session)showSignedIn(session);else showSignedOut();});
  sb.auth.getSession().then(({data})=>{if(data&&data.session)showSignedIn(data.session);else showSignedOut();});
  loadTrends();
})();
