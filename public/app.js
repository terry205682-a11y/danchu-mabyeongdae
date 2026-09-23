import {startGlobe} from './globe.js';

const app=document.querySelector('#app');
const modalRoot=document.querySelector('#modal-root');
const toastRoot=document.querySelector('#toast-root');
const globe=startGlobe(document.querySelector('#earth'));
const nowKST=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt=(n)=>Number(n||0).toLocaleString('ko-KR');
const esc=(s='')=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=(value)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const empty=(text='등록된 내용이 없습니다.')=>`<div class="empty"><div class="empty-symbol">◎</div><strong>${esc(text)}</strong><span>관리자 화면에서 데이터를 등록할 수 있습니다.</span></div>`;
const svg=(name)=>{const p={
 users:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2ZM13 14a6 6 0 0 1 9 5v1h-5"/>',
 officer:'<path d="m12 2 3 2 4 .6-.6 4L20 12l-3 3-.6 4-4.4-.7-4.4.7L7 15l-3-3 1.6-3.4L5 4.6 9 4Z"/><path d="m12 7 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4Z"/>',
 lock:'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
 arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
 shield:'<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/>',
 refresh:'<path d="M21 3v6h-6M3 21v-6h6"/><path d="M4.5 9a8 8 0 0 1 13.4-3.1L21 9M3 15l3.1 3.1A8 8 0 0 0 19.5 15"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
 edit:'<path d="m4 16-.7 4.7L8 20l12-12-4-4L4 16ZM14 6l4 4"/>',
 trash:'<path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.shield}</svg>`};

const INSIGNIA_OPTIONS=['소령','대위','중위','소위','상사','중사','하사'];
function rankInsigniaSvg(rank=''){
  const common='viewBox="0 0 54 28" aria-hidden="true" focusable="false"';
  const diamond=(x)=>`<polygon points="${x},14 ${x+6},4 ${x+12},14 ${x+6},24"/>`;
  if(rank==='소위') return `<svg ${common} class="rank-insignia-svg officer-mark"><g>${diamond(21)}</g></svg>`;
  if(rank==='중위') return `<svg ${common} class="rank-insignia-svg officer-mark"><g>${diamond(12)}${diamond(30)}</g></svg>`;
  if(rank==='대위') return `<svg ${common} class="rank-insignia-svg officer-mark"><g>${diamond(3)}${diamond(21)}${diamond(39)}</g></svg>`;
  if(rank==='소령') return `<svg ${common} class="rank-insignia-svg field-mark"><g transform="translate(27 14)"><path d="M0-11 3-5 9-8 7-2 13 0 7 2 9 8 3 5 0 11-3 5-9 8-7 2-13 0-7-2-9-8-3-5Z"/><circle r="3.4" class="rank-core"/></g></svg>`;
  const chev=(y)=>`<path d="M10 ${y} 27 ${y+8} 44 ${y}" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="square" stroke-linejoin="miter"/>`;
  if(rank==='하사') return `<svg ${common} class="rank-insignia-svg nco-mark"><g>${chev(8)}<path d="M22 18h10l-5 6Z"/></g></svg>`;
  if(rank==='중사') return `<svg ${common} class="rank-insignia-svg nco-mark"><g>${chev(4)}${chev(11)}<path d="M22 20h10l-5 6Z"/></g></svg>`;
  if(rank==='상사') return `<svg ${common} class="rank-insignia-svg nco-mark"><g>${chev(1)}${chev(8)}${chev(15)}</g></svg>`;
  return '';
}
function insigniaBadge(name=''){
  if(!name) return '';
  return `<span class="insignia-badge" aria-label="${esc(name)} 계급장" title="${esc(name)} 계급장">${rankInsigniaSvg(name)}</span>`;
}
function officerRankLine(o){
  return `<span class="rank-line">${insigniaBadge(o.insignia||o.rank)}<em>${esc(o.rank||'계급 미입력')}</em></span>`;
}
function rankInsigniaPicker(value=''){
  return `<div class="insignia-picker-preview" data-insignia-preview>${value?`${insigniaBadge(value)}<span>${esc(value)} · 계급 자동 적용</span>`:'<span class="muted">계급장을 선택하면 계급이 자동 적용됩니다.</span>'}</div>`;
}
let data={ready:false,user:null,summary:{},soldiers:[],officers:[],reports:[],scores:[],activity:[],forceActivity:[],eliminations:[],users:[],settings:{assignedPlatoon:'',platoonNames:{}}};
// 첫 접속과 새로고침은 언제나 지휘 포털로 시작합니다. 미리보기는 파일:// 해시 경로를 사용합니다.
const previewMode=Boolean(window.__PREVIEW_DATA);
function setRouteUrl(path,replace=false){
 const target=previewMode?location.pathname+location.search+'#'+path:path;
 history[replace?'replaceState':'pushState']({},'',target);
}
setRouteUrl('/',true);
let route='/',tab='overview',filter='all',query='',reportKind='rollcall';
let entryIntroPlayed=false,transitioning=false,entryIntroPromise=Promise.resolve();
const prefersReduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function playScan(){if(prefersReduced())return;const scan=document.createElement('div');scan.className='screen-scan';document.body.append(scan);setTimeout(()=>scan.remove(),550);}
function startEntryIntro(){
 if(entryIntroPlayed)return;
 entryIntroPlayed=true;
 if(prefersReduced())return;
 app.classList.add('entry-intro');
 entryIntroPromise=globe.intro().then(()=>{app.classList.remove('entry-intro');app.querySelector('.portal')?.classList.add('intro-reveal');});
}

const admin=()=>data.user&&['owner','admin'].includes(data.user.role);
const owner=()=>data.user?.role==='owner';
const platoonDisplay=(id)=>{if(!id)return '담당 소대 미설정';const name=data.settings?.platoonNames?.[id]||'';return name?`${id} · ${name}`:id;};
const reportTitleFor=(r)=>{if(!r)return '';const raw=(r.title||'').trim();if(!raw)return '기본 멘트';if(['아침 점호 기본 대사','점호 기본 대사','아침 점호 대사'].includes(raw)&&r.kind==='rollcall')return '기본 멘트';if(['야간 순검 기본 대사','순검 기본 대사','순검 대사'].includes(raw)&&r.kind==='inspection')return '기본 멘트';return raw;};
const assigned=()=>platoonDisplay(data.settings?.assignedPlatoon||'');
const personLink=(u,label)=>u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="link-profile">${esc(label||'방송국 ↗')}</a>`:'';
async function api(url,options={}){const res=await fetch(url,{credentials:'same-origin',...options});const json=await res.json().catch(()=>({error:'서버 응답을 읽을 수 없습니다.'}));if(!res.ok)throw Error(json.error||'작업에 실패했습니다.');return json;}
async function load(render=true){data=await api('/api/bootstrap');if(render)draw();}
function toast(msg,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=msg;toastRoot.append(node);setTimeout(()=>node.remove(),4200);}
function setClock(){document.querySelector('#clock').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());}
setClock();setInterval(setClock,30000);
async function go(path){
 if(!['/force','/officers','/admin'].includes(path)||transitioning)return;
 if(path==='/admin'&&!admin()){
  if(!data.user)return showLogin();
  return showDenied();
 }
 if(route===path)return;
 const leavingPortal=route==='/';
 if(leavingPortal){
  await entryIntroPromise; // 입장 영상이 끝나기 전 연속 클릭하더라도 확대 모션을 생략하지 않습니다.
  transitioning=true;
  app.classList.add('portal-exit');
  try{await globe.zoomIntoSection();}finally{app.classList.remove('portal-exit');transitioning=false;}
 }
 setRouteUrl(path,leavingPortal); // 포털은 브라우저 뒤로가기로 재진입하지 않습니다.
 route=path;
 document.querySelector('.global-nav')?.classList.remove('open');
 document.querySelector('#mobile-menu')?.setAttribute('aria-expanded','false');
 draw();
 window.scrollTo({top:0,behavior:prefersReduced()?'instant':'smooth'});
 if(!leavingPortal)playScan();
}
function routeFromUrl(){const path=previewMode?location.hash.slice(1):location.pathname;return ['/force','/officers','/admin'].includes(path)?path:null;}
window.addEventListener('popstate',()=>{
 const requested=routeFromUrl();
 if(requested){route=requested;draw();}else if(route!=='/')setRouteUrl(route,true);
});
window.addEventListener('hashchange',()=>{
 if(!previewMode)return;
 const requested=routeFromUrl();
 if(requested&&requested!==route){route=requested;draw();}
 else if(!requested&&route!=='/')setRouteUrl(route,true);
});
function draw(){
 if(route==='/admin'&&!admin()){route='/force';setRouteUrl(route,true);}
 document.body.classList.toggle('portal-active',route==='/');
 app.innerHTML=route==='/force'?force():route==='/officers'?officers():route==='/admin'?administrator():portal();
 globe.setMode(route==='/'?'home':'section');
 for(const link of document.querySelectorAll('[data-route]'))link.classList.toggle('active',link.dataset.route===route);
 document.querySelector('#profile-button').textContent=data.user?`${data.user.username} · ${data.user.role==='owner'?'총괄':data.user.role==='admin'?'관리자':'열람'}`:'관리자 로그인';
}
function portal(){return `<section class="portal"><div class="portal-top"><div class="portal-insignia"><img src="/logo-v14.png" alt="마병대 마크"></div><div class="portal-overline">DANCHU MILITARY COMMAND CENTER</div><h1><em>단츄의</em> 마병대 통합사령부</h1><div class="portal-english">MABYEONGDAE COMMAND PORTAL</div><p class="portal-caption">모든 전력이 하나의 지휘 아래</p></div><div class="sector-grid">
 ${sector('01','FORCE STATUS','병력 현황','담당 소대의 병력과 순위, 상벌점 및 탈락 현황을 확인합니다.','users','/force')}
 ${sector('02','OFFICER DIRECTORY','간부 수첩',admin()?'부대 편제도와 간부 정보, 점호 및 순검 대사를 확인합니다.':'부대 편제도와 간부 정보를 확인합니다.','officer','/officers')}
 ${sector('03','RESTRICTED AREA','관리자 관리','병사·간부·상벌점 및 시스템을 관리하는 보안 구역입니다.','lock','/admin',true)}
 </div><div class="portal-meta">ALL UNITS READY <span>·</span> COMMAND SYSTEM ONLINE</div></section>`;}
function sector(no,code,label,desc,ico,path,restricted=false){return `<article class="sector${restricted?' restricted':''}"><div class="sector-heading"><span class="sector-no">${no}</span><span class="sector-tag">${code}</span></div><div class="sector-symbol">${svg(ico)}</div><h2>${label}</h2><div class="sector-dash"></div><p>${desc}</p><a class="sector-enter" href="${path}" data-route="${path}">ENTER <span class="arrow">→</span></a></article>`}
function banner(code,title,description,buttons=''){return `<div class="section-banner"><div><p class="section-code">${code}</p><h1 class="section-title">${title}</h1><p class="section-description">${description}</p></div><div class="section-actions">${buttons}</div></div>`}
function stat(label,n,unit='명',color=''){return `<article class="stat ${color}"><span class="stat-name">${label}</span><div><strong class="stat-number" data-count="${n}">${fmt(n)}</strong><small>${unit}</small></div><div class="stat-foot">LIVE DATABASE / VERIFIED</div></article>`}
function avatarSrc(url=''){
 try{const u=new URL(url,location.origin);if(u.protocol==='https:'&&/(^|\.)(sooplive\.(com|co\.kr)|afreecatv\.com)$/.test(u.hostname.toLowerCase()))return '/api/soop-image?url='+encodeURIComponent(u.toString());}catch{}
 return url;
}
function soldierAvatar(s){return s.photoUrl?`<img class="avatar" data-profile-img src="${esc(avatarSrc(s.photoUrl))}" referrerpolicy="no-referrer" alt="" onerror="this.style.display='none'">`:'<span class="avatar">◆</span>'}
function rankTable(items,editable=false,quickScore=false){
 if(!items.length)return empty('표시할 병사가 없습니다.');
 return `<div class="table-wrap"><table><thead><tr><th>순위</th><th>병사</th><th>상점</th><th>벌점</th><th>총점</th><th>상태</th>${editable||quickScore?'<th>관리</th>':''}</tr></thead><tbody>${items.map(s=>`<tr><td><span class="rank ${s.rank===1?'gold':s.rank===2?'silver':s.rank===3?'bronze':''}">${s.rank?s.rank+'위':'—'}</span></td><td><div class="soldier-name">${soldierAvatar(s)} <span>${s.soopUrl?personLink(s.soopUrl,s.name):esc(s.name)}</span> <button type="button" class="mini-link-btn" data-action="view-score-log" data-id="${esc(s.id)}">기록</button></div></td><td class="num-pos number">+${fmt(s.merit)}</td><td class="num-neg number">-${fmt(s.penalty)}</td><td class="number">${fmt(s.total)}</td><td><span class="pill ${s.eliminated?'negative':'positive'}">${s.eliminated?'탈락':'생존'}</span></td>${editable?`<td><div class="row-wrap"><button class="small-btn ghost-btn" data-action="edit-soldier" data-id="${esc(s.id)}">수정</button><button class="small-btn ghost-btn" data-action="score-soldier" data-id="${esc(s.id)}">점수</button></div></td>`:quickScore?`<td><div class="quick-score-actions"><button type="button" class="small-btn quick-score-merit" data-action="quick-score" data-kind="merit" data-id="${esc(s.id)}" aria-label="${esc(s.name)} 상점 부여">상점 +</button><button type="button" class="small-btn quick-score-penalty" data-action="quick-score" data-kind="penalty" data-id="${esc(s.id)}" aria-label="${esc(s.name)} 벌점 부여">벌점 −</button><button type="button" class="small-btn ghost-btn" data-action="view-score-log" data-id="${esc(s.id)}">기록</button></div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function logs(items){return items.length?`<ul class="logs">${items.slice(0,14).map(a=>`<li><span class="log-time">${time(a.createdAt)} · ${esc(a.actor||'SYSTEM')}</span><div class="log-head"><span class="log-title">${esc(a.type)}</span></div><div class="log-detail">${esc(a.detail)}</div></li>`).join('')}</ul>`:empty('아직 기록이 없습니다.')}
// 병력 현황에는 상·벌점과 탈락 관련 기록만 표시하며 일반 관리자 활동은 제외합니다.
function forceLogs(items){
 if(!items.length)return empty('아직 상벌점 또는 탈락 기록이 없습니다.');
 const kind={ '상점 부여':['상점','merit'], '벌점 부여':['벌점','penalty'], '점수 기록 취소':['점수 취소','cancel'], '탈락 지정':['탈락','eliminated'], '탈락 취소':['탈락 취소','cancel'] };
 return `<ul class="logs force-logs">${items.slice(0,20).map(a=>{
  const [label,cls]=kind[a.type]||[a.type,'cancel'];
  return `<li class="force-log-${cls}"><span class="log-time">${time(a.createdAt)} · ${esc(a.actor||'SYSTEM')}</span><div class="log-head"><span class="log-title">${esc(label)}</span></div><div class="log-detail">${esc(a.detail)}</div></li>`;
 }).join('')}</ul>`;
}

function force(){
 const soldiers=data.soldiers.filter(s=>(filter==='alive'?!s.eliminated:filter==='out'?s.eliminated:true)&&(!query||s.name.toLowerCase().includes(query.toLowerCase())));
 const stats=data.summary;
 return `<section class="section-page">${banner('01 / FORCE STATUS','병력 현황',`${esc(assigned())} · 우리 소대 병사 상벌점 및 탈락 관리`,admin()?'<button class="primary-btn" data-action="new-score">+ 상벌점 입력</button><button class="action-btn" data-action="add-soldier">+ 병사 등록</button>':'')}
 <div class="single-platoon-strip"><span class="small-label">ASSIGNED PLATOON</span><strong>${esc(assigned())}</strong><span>이 사이트는 지정된 한 소대의 병력만 관리합니다.</span>${owner()?'<button class="small-btn ghost-btn" data-route="/admin" data-go-tab="settings">소대 설정 ↗</button>':''}</div>
 <div class="stats">${stat('현재 병력',stats.current,'명')}${stat('탈락 병력',stats.eliminated,'명','red')}${stat('누적 상점',stats.merit,'점')}${stat('누적 벌점',stats.penalty,'점','red')}</div>
 <div class="dashboard-grid"><div class="panel"><div class="panel-head"><h2>${esc(assigned())} 병사 명부 · 순위</h2><span class="panel-note">총 ${data.soldiers.length}명 / 총점 = 상점 − 벌점</span></div><div class="panel-body"><div class="search-row"><input id="soldier-search" class="search-input" placeholder="병사 이름 검색" value="${esc(query)}" aria-label="병사 검색"/><div class="tab-buttons">${[['all','전체'],['alive','생존'],['out','탈락']].map(([k,label])=>`<button class="tab-btn ${filter===k?'active':''}" data-filter="${k}">${label}</button>`).join('')}</div></div></div><div id="rank-list">${rankTable(soldiers,false,admin())}</div><div class="split-bottom"><span>동점 공동 순위 · 탈락 병력 하단</span><span>${soldiers.length}명 표시</span></div></div>
 <div class="panel"><div class="panel-head"><h2>작전 활동 로그</h2><span class="small-label">SCORE / ELIMINATION ONLY</span></div>${forceLogs(data.forceActivity||[])}</div></div></section>`;
}
function scoreTable(items,editable=false){if(!items.length)return empty('상벌점 기록이 없습니다.');return `<div class="table-wrap"><table><thead><tr><th>일시</th><th>병사</th><th>구분</th><th>점수</th><th>사유</th><th>입력자</th>${editable?'<th>관리</th>':''}</tr></thead><tbody>${items.map(x=>`<tr><td>${time(x.createdAt)}</td><td>${esc(x.soldierName||data.soldiers.find(s=>s.id===x.soldierId)?.name||'삭제된 병사')}</td><td><span class="pill ${x.kind==='merit'?'positive':'negative'}">${x.kind==='merit'?'상점':'벌점'}</span></td><td class="number ${x.kind==='merit'?'num-pos':'num-neg'}">${x.kind==='merit'?'+':'−'}${fmt(x.points)}</td><td>${esc(x.reason)}</td><td>${esc(x.actor)}</td>${editable?`<td><button class="small-btn danger-btn" data-action="delete-score" data-id="${x.id}">취소</button></td>`:''}</tr>`).join('')}</tbody></table></div>`}
function showSoldierLog(id){
 const soldier=data.soldiers.find(s=>s.id===id);
 if(!soldier)return toast('병사를 찾을 수 없습니다.',true);
 const records=data.scores.filter(x=>x.soldierId===id);
 const totals=`<div class="mini-stat-grid soldier-log-stats"><div class="mini-stat"><span>상점</span><strong class="num-pos">+${fmt(soldier.merit)}</strong></div><div class="mini-stat"><span>벌점</span><strong class="num-neg">-${fmt(soldier.penalty)}</strong></div><div class="mini-stat"><span>총점</span><strong>${fmt(soldier.total)}</strong></div><div class="mini-stat"><span>상태</span><strong>${soldier.eliminated?'탈락':'생존'}</strong></div></div>`;
 modal(`${esc(soldier.name)} 상벌점 기록`, `${totals}<div class="panel mt-20"><div class="panel-head"><h2>기록 ${records.length}건</h2><span class="panel-note">최신순 표시</span></div>${scoreTable(records,false)}</div>`);
}

// 본부 → 소대 → 행정반의 지휘 연결선이 보이는 계층형 편제도.
function officerNode(o,editable=false){const label=o.position||o.title;return `<button type="button" class="formation-person ${o.name?'assigned':''}" data-action="${editable?'edit-officer':'view-officer'}" data-id="${esc(o.id)}"><span class="formation-avatar">${o.photoUrl?`<img src="${esc(avatarSrc(o.photoUrl))}" data-profile-img alt="" referrerpolicy="no-referrer">`:svg('officer')}</span><span class="formation-person-text"><small>${esc(label)}</small><strong>${esc(o.name||'미등록')}</strong>${officerRankLine(o)}</span>${editable?'<span class="formation-edit">편집 ↗</span>':''}</button>`;}
function formation(editable=false){
 const group=name=>data.officers.filter(o=>o.group===name);
 const selected=data.settings?.assignedPlatoon||'';
 const platoons=Array.from({length:6},(_,i)=>`${i+1}소대`);
 return `<div class="formation"><div class="formation-legend"><span><i class="legend-dot cyan"></i> 지휘 계통</span><span><i class="legend-dot green"></i> 담당 소대</span><span>간부 카드를 눌러 ${editable?'등록·수정':'정보 확인'}</span></div>
 <div class="formation-hq"><span class="formation-overline">COMPANY COMMAND / 중대 본부</span>${group('중대 본부').map(o=>officerNode(o,editable)).join('')}</div>
 <div class="formation-tree"><span class="formation-trunk"></span><div class="formation-platoons">${platoons.map(name=>`<section class="formation-branch ${name===selected?'our-platoon':''}"><div class="formation-unit-header"><h3>${esc(data.settings?.platoonNames?.[name]||name)}</h3>${name===selected?'<span class="our-badge">우리 소대</span>':''}${editable?`<button type="button" class="small-btn ghost-btn platoon-rename" data-action="rename-platoon" data-group="${name}" aria-label="${name} 이름 수정">소대 이름 수정 ↗</button>`:''}</div><div class="formation-people">${group(name).map(o=>officerNode(o,editable)).join('')}</div></section>`).join('')}</div></div>
 <div class="formation-support"><div class="formation-support-line"></div><section class="formation-branch support-branch"><div class="formation-unit-header"><span class="small-label">SUPPORT / ADMINISTRATION</span><h3>행정반</h3></div><div class="formation-support-people">${group('행정반').map(o=>officerNode(o,editable)).join('')}</div></section></div></div>`;
}
function officers(){return `<section class="section-page">${banner('02 / OFFICER DIRECTORY','간부 수첩',admin()?'중대 지휘 계통 · 간부 편제 · 아침 점호 및 순검 대사':'중대 지휘 계통 · 간부 편제')}
 <div class="panel formation-panel"><div class="panel-head"><h2>부대 편제도</h2><span class="panel-note">지휘 계통도 / ${data.summary.officers} / ${data.officers.length}명 등록</span></div><div class="panel-body">${formation(admin())}</div></div>
 ${admin()?`<div class="report-layout">${reportsPanel('rollcall','아침 점호 대사')}${reportsPanel('inspection','순검 대사')}</div>`:''}</section>`;}
function reportsPanel(kind,label){if(!admin())return '';const list=data.reports.filter(r=>r.kind===kind);return `<section class="panel script-panel"><div class="panel-head"><h2>${label}</h2>${admin()?`<button class="small-btn action-btn" data-action="new-report" data-kind="${kind}">+ 대사 작성</button>`:`<span class="small-label">SCRIPTS / ${list.length}</span>`}</div><div class="panel-body"><p class="script-intro">${kind==='rollcall'?'아침 점호 때 실제로 읽을 멘트를 기록해 두는 공간입니다.':'순검 진행 시 사용할 멘트와 순서를 기록하는 공간입니다.'}</p><div class="report-items">${list.length?list.slice(0,20).map(r=>`<article class="report-card script-card"><div class="report-meta"><span>마지막 수정 ${time(r.updatedAt)} · ${esc(r.actor)}</span>${admin()?`<span><button class="small-btn ghost-btn" data-action="edit-report" data-id="${r.id}">대사 편집</button> <button class="small-btn ghost-btn" data-action="delete-report" data-id="${r.id}">삭제</button></span>`:''}</div><strong>${esc(reportTitleFor(r))}</strong><div class="script-text">${esc(r.content)}</div></article>`).join(''):empty('등록된 대사가 없습니다. 관리자 계정으로 직접 작성할 수 있습니다.')}</div></div></section>`;}

function administrator(){if(!admin())return portal();const tabs=[['overview','◈','관리 개요'],['soldiers','♟','병사 관리'],['scores','✚','상벌점 관리'],['elimination','⊗','탈락 관리'],['officers','♜','간부 편제 관리'],['reports','▤','점호·순검 대사'],...(owner()?[['accounts','⚿','관리자 계정']]:[]),['settings','⚙','소대 설정·초기화']];return `<section class="section-page">${banner('03 / RESTRICTED ACCESS','관리자 관리','관리자 초대·해제 · 단일 소대 관리 · 탈락 및 기록 초기화')}<div class="admin-layout"><aside class="panel admin-sidebar"><span class="small-label">ADMINISTRATION</span>${tabs.map(([key,icon,label])=>`<button class="admin-tab ${tab===key?'active':''}" data-admin-tab="${key}"><i>${icon}</i>${label}</button>`).join('')}</aside><div class="admin-contents" id="admin-content">${adminTab()}</div></div></section>`}
function adminTab(){const s=data.summary;if(tab==='overview')return `<div class="admin-header"><h2>${esc(assigned())} 관리 현황</h2><span class="small-label">SECURE ADMIN SESSION</span></div><div class="admin-card-grid"><div class="mini-stat"><span>현재 병력</span><strong>${fmt(s.current)}명</strong><button class="action-btn small-btn" data-admin-tab="soldiers">병사 관리 →</button></div><div class="mini-stat"><span>등록 간부</span><strong>${fmt(s.officers)} / ${data.officers.length}명</strong><button class="action-btn small-btn" data-admin-tab="officers">간부 편제 →</button></div><div class="mini-stat"><span>상점 / 벌점</span><strong>${fmt(s.merit)} / ${fmt(s.penalty)}</strong><button class="action-btn small-btn" data-admin-tab="scores">상벌점 관리 →</button></div><div class="mini-stat"><span>탈락 병력</span><strong>${fmt(s.eliminated)}명</strong><button class="action-btn small-btn" data-admin-tab="elimination">탈락 관리 →</button></div></div><div class="panel mt-20"><div class="panel-head"><h2>관리 활동 기록</h2></div>${logs(data.activity)}</div>`;
if(tab==='soldiers')return `<div class="admin-header"><h2>병사 관리</h2><button class="primary-btn" data-action="add-soldier">${svg('plus')} 병사 등록</button></div><div class="panel"><div class="panel-head"><h2>${esc(assigned())} 병사 ${data.soldiers.length}명</h2><span class="panel-note">SOOP 링크로 자동 등록하거나 직접 입력할 수 있습니다.</span></div>${rankTable(data.soldiers,true)}</div>`;
if(tab==='scores')return `<div class="admin-header"><h2>상벌점 관리</h2><button class="primary-btn" data-action="new-score">+ 상점 / 벌점 입력</button></div><div class="panel"><div class="panel-head"><h2>전체 상벌점 기록</h2><span class="panel-note">${data.scores.length}건</span></div>${scoreTable(data.scores,true)}</div>`;
if(tab==='elimination'){const live=data.soldiers.filter(x=>!x.eliminated);return `<div class="admin-header"><h2>탈락 관리</h2><button class="danger-btn" data-action="new-elimination">탈락자 지정</button></div><div class="alert-box mb-20">하루마다 탈락 인원 수는 자유롭게 지정할 수 있습니다. 탈락자는 순위표 하단으로 이동하며, 관리자는 언제든 탈락 지정을 취소할 수 있습니다.</div><div class="panel"><div class="panel-head"><h2>생존 병력 ${live.length}명</h2></div>${rankTable(live,true)}</div><div class="panel mt-20"><div class="panel-head"><h2>탈락 이력</h2></div>${data.eliminations.length?`<div class="table-wrap"><table><thead><tr><th>날짜</th><th>병사</th><th>관리자</th><th>작업</th></tr></thead><tbody>${data.eliminations.map(e=>`<tr><td>${e.date}</td><td>${esc(e.name)}</td><td>${esc(e.actor)}</td><td>${data.soldiers.some(s=>s.id===e.soldierId&&s.eliminated)?`<button class="small-btn ghost-btn" data-action="revive" data-id="${e.soldierId}">탈락 취소</button>`:'완료'}</td></tr>`).join('')}</tbody></table></div>`:empty('탈락 기록이 없습니다.')}</div>`}
if(tab==='officers')return `<div class="admin-header"><h2>간부 편제 관리</h2><span class="small-label">${data.summary.officers} / ${data.officers.length} ASSIGNED</span></div><div class="panel formation-panel"><div class="panel-head"><h2>부대 편제도</h2><span class="panel-note">계층형 지휘 계통 · 카드 선택 시 간부 편집</span></div><div class="panel-body">${formation(true)}</div></div>`;
if(tab==='reports')return `<div class="admin-header"><h2>점호 및 순검 대사 관리</h2></div><div class="info-box mb-20">실제 점호·순검 때 사용할 대사를 직접 작성하고 수정할 수 있어요. 날짜별 수행 보고가 아니라 재사용 가능한 대본입니다.</div><div class="report-layout">${reportsPanel('rollcall','아침 점호 대사')}${reportsPanel('inspection','순검 대사')}</div>`;
if(tab==='accounts'&&owner())return `<div class="admin-header"><h2>공동 관리자 관리</h2><button class="primary-btn" data-action="add-user">+ 공동 관리자 추가</button></div><div class="info-box mb-20">총괄 관리자와 공동 관리자 각 1명(총 2명)이 데이터를 관리합니다. 총괄 관리자는 공동 관리자를 언제든 해제할 수 있습니다.</div><div class="panel"><div class="table-wrap"><table><thead><tr><th>아이디</th><th>권한</th><th>관리</th></tr></thead><tbody>${data.users.map(u=>`<tr><td>${esc(u.username)}</td><td><span class="pill ${u.role==='owner'?'positive':''}">${u.role==='owner'?'최고 관리자':u.role==='admin'?'관리자':'열람 전용'}</span></td><td>${u.id!==data.user.id?`<button class="small-btn danger-btn" data-action="delete-user" data-id="${u.id}">권한 해제</button>`:'현재 계정'}</td></tr>`).join('')}</tbody></table></div></div>`;
return `<div class="admin-header"><h2>담당 소대 · 백업 · 초기화</h2></div>
 <div class="panel mb-20"><div class="panel-head"><h2>담당 소대 지정</h2><span class="small-label">ONE PLATOON / ONE ROSTER</span></div><div class="panel-body"><p class="settings-note">마병대 전체 6개 소대의 상벌점을 관리하는 사이트가 아닙니다. 이 방송에서 단츄가 맡은 한 소대를 지정하면 병사 명부 전체가 그 소대에 속합니다.</p>${owner()?`<form id="platoon-form">${selectField('단츄 담당 소대','platoon',[['','배정 대기'],...Array.from({length:6},(_,i)=>[`${i+1}소대`,platoonDisplay(`${i+1}소대`)])],data.settings?.assignedPlatoon||'')}${formButtons('담당 소대 저장')}</form>`:`<div class="info-box">현재 담당 소대: ${esc(assigned())} (총괄 관리자만 변경 가능)</div>`}</div></div>
 <div class="panel mb-20"><div class="panel-head"><h2>데이터 백업</h2></div><div class="panel-body"><p class="settings-note">초기화나 재배포 전에 병사·상벌점·탈락·간부·대사·로그를 JSON 파일로 백업하세요.</p><a class="action-btn" href="/api/admin/export">${svg('download')} 전체 기록 백업 다운로드</a></div></div>
 ${owner()?`<div class="panel danger-panel mb-20"><div class="panel-head"><h2>기록 선택 초기화</h2><span class="small-label">OWNER ONLY · IRREVERSIBLE</span></div><div class="panel-body"><div class="alert-box mb-20">초기화된 데이터는 이 사이트에서 복구할 수 없습니다. 먼저 위의 백업 파일을 다운로드해 주세요. 관리자 계정은 전체 초기화 후에도 유지됩니다.</div><form id="reset-form">${selectField('초기화할 기록','scope',[['','초기화 항목 선택'],['soldiers','병사 명부 (연결된 상벌점·탈락 기록 포함)'],['scores','상벌점 기록 및 관련 활동 로그'],['eliminations','탈락 기록 및 관련 활동 로그'],['activity','작전·관리 활동 로그 전체'],['officers','간부 편제 입력 내용'],['reports','점호·순검 대사'],['all','전체 운영 기록 (관리자 계정·담당 소대 유지)']],'')}${field('확인 문구: 초기화','confirm','',true,'text','초기화')}${formButtons('선택한 기록 영구 초기화',true)}</form></div></div>`:''}
 <div class="panel"><div class="panel-head"><h2>관리자 비밀번호 변경</h2></div><div class="panel-body"><form id="password-form"><label class="field"><span>현재 비밀번호</span><input name="oldPassword" type="password" class="field-input" required autocomplete="current-password"></label><label class="field"><span>새 비밀번호 (10자 이상)</span><input name="newPassword" type="password" class="field-input" minlength="10" required autocomplete="new-password"></label><div class="form-actions"><button class="primary-btn" type="submit">비밀번호 변경</button></div></form></div></div>`;}

function field(label,name,value='',required=false,type='text',placeholder=''){return `<label class="field"><span>${label}</span><input class="field-input" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required?'required':''}></label>`}
function selectField(label,name,options,value){return `<label class="field"><span>${label}</span><select class="field-input" name="${name}">${options.map(([k,v])=>`<option value="${esc(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`}
function textarea(label,name,value='',required=false){return `<label class="field"><span>${label}</span><textarea class="field-input" name="${name}" style="height:102px;resize:vertical" ${required?'required':''}>${esc(value)}</textarea></label>`}
let modalScrollState=null;
function lockPageScroll(){
 if(modalScrollState)return;
 const body=document.body,bodyStyle=body?.style;
 if(!bodyStyle)return;
 // 스크롤바를 숨길 때 사라지는 폭만큼만 보정합니다. CSS scrollbar-gutter와 중복 보정하지 않습니다.
 const gap=Math.max(0,(window.innerWidth||0)-(document.documentElement?.clientWidth||window.innerWidth||0));
 modalScrollState={overflow:bodyStyle.overflow||'',paddingRight:bodyStyle.paddingRight||''};
 bodyStyle.overflow='hidden';
 if(gap>0)bodyStyle.paddingRight=`${gap}px`;
}
function unlockPageScroll(){
 if(!modalScrollState)return;
 const bodyStyle=document.body?.style;
 if(bodyStyle){bodyStyle.overflow=modalScrollState.overflow;bodyStyle.paddingRight=modalScrollState.paddingRight;}
 modalScrollState=null;
}
function modal(title,content,opts={}){lockPageScroll();modalRoot.innerHTML=`<div class="modal-scrim"><section class="modal ${opts.large?'large':''} ${opts.danger?'danger':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><div class="modal-body">${content.replace(/<form\b/g,'<form onsubmit=\"return false\"')}</div></section></div>`;modalRoot.querySelector('input,button,select')?.focus()}
function closeModal(){modalRoot.innerHTML='';unlockPageScroll();}
function formButtons(text='저장',danger=false){return `<p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button type="button" class="ghost-btn" data-action="close-modal">취소</button><button class="${danger?'danger-btn':'primary-btn'}" type="submit">${text}</button></div>`}
function showLogin(){if(!data.ready)return showSetup();modal('관리자 보안 인증',`<p class="small-label">SECURE LOGIN / AUTHENTICATION REQUIRED</p><p class="settings-note">관리자 계정으로 로그인하면 제한 구역에 접근할 수 있습니다.</p><form id="login-form">${field('아이디','username','',true,'text','관리자 아이디')}${field('비밀번호','password','',true,'password','비밀번호')}${formButtons('보안 인증')}</form>`)}
function showSetup(){modal('최초 관리자 설정',`<div class="info-box mb-20">최초 실행 시 서버 터미널에 표시된 <strong>설치 키</strong>로 최고 관리자 계정을 한 번만 생성합니다. 서버가 출력한 키를 확인해 주세요.</div><form id="setup-form">${field('최초 설치 키','setupKey','',true,'text','서버 실행 화면에 표시된 키')}${field('관리자 아이디 (영문 소문자·숫자 3~24자)','username','',true)}${field('비밀번호 (10자 이상)','password','',true,'password')}${formButtons('시스템 활성화')}</form>`)}
function showDenied(){modal('SECURITY ALERT',`<div class="security-mark">${svg('lock')}</div><h3 class="security-heading">ACCESS DENIED</h3><p class="security-copy">접근 권한이 없습니다.<br>해당 구역은 인증된 마병대 관리자만 접근할 수 있습니다.</p><div class="security-code">CLEARANCE: RESTRICTED / AUTHORIZATION FAILED</div><button class="action-btn full" data-action="close-modal">지휘 포털로 돌아가기</button>`,{danger:true})}
function soopFields(url=''){return `<div class="soop-lookup"><div>${field('SOOP 방송국 링크 또는 BJ 아이디','soopUrl',url,false,'text','https://www.sooplive.com/station/아이디')}</div><button type="button" class="action-btn soop-lookup-btn" data-action="lookup-soop">${svg('search')} 방송국 조회</button></div><div class="soop-lookup-status" aria-live="polite">방송국 주소를 붙여넣으면 닉네임과 프로필 사진을 자동으로 조회합니다. 실패하면 직접 입력할 수 있어요.</div><div class="soop-profile-preview" hidden></div>`;}
function showSoldier(s){modal(s?'병사 정보 수정':'신규 병사 등록',`<form id="soldier-form"><input type="hidden" name="id" value="${esc(s?.id||'')}">${soopFields(s?.soopUrl||'')}<div class="field-grid">${field('병사 이름 (닉네임)','name',s?.name||'',false)}<div class="info-box mb-10">담당 소대: ${esc(assigned())} · 등록된 모든 병사는 이 한 소대에 속합니다.</div></div>${field('프로필 사진 주소 (자동 입력 또는 직접 입력)','photoUrl',s?.photoUrl||'',false,'url','https://...')}${textarea('메모','note',s?.note||'')}${formButtons(s?'수정 저장':'병사 등록')}</form>`)}
function showScore(sid='',kind='merit'){
 if(!admin())return showDenied();
 if(!data.soldiers.length)return toast('먼저 병사를 등록해 주세요.',true);
 const chosenKind=kind==='penalty'?'penalty':'merit';
 modal('상벌점 입력',`<form id="score-form">${selectField('병사','soldierId',data.soldiers.map(s=>[s.id,`${s.name}`]),sid)}${selectField('구분','kind',[['merit','상점 +'],['penalty','벌점 −']],chosenKind)}${field('점수 (1~1000)','points','1',true,'number')}${field('사유','reason','',true,'text',chosenKind==='merit'?'예: 작전 수행 우수':'예: 지각')}${formButtons('점수 부여')}</form>`);
}
function showOfficer(o,readOnly=false){const body=`<div class="info-box mb-20"><strong>${esc(o.group)} / ${esc(o.title)}</strong><br>편제 번호는 고정이며 직위는 별도로 입력할 수 있습니다.</div>${readOnly?`<h3>${esc(o.name||'미등록')}</h3>${o.position?`<p class="officer-position-detail"><strong>직위:</strong> ${esc(o.position)}</p>`:''}<p class="officer-rank-detail">${officerRankLine(o)}</p><p>${esc(o.note||'등록된 소개가 없습니다.')}</p>${personLink(o.soopUrl,'SOOP 방송국 방문 ↗')}`:`<form id="officer-form"><input type="hidden" name="id" value="${o.id}">${soopFields(o.soopUrl)}<div class="field-grid">${field('간부 이름 (닉네임)','name',o.name)}${selectField('계급장 선택','insignia',[['','선택 안 함'],...INSIGNIA_OPTIONS.map(x=>[x,x])],o.insignia||o.rank||'')}</div>${field('직위 (자유 입력)','position',o.position||'',false,'text','예: 행정보급관, 인사담당관')}${rankInsigniaPicker(o.insignia||o.rank||'')}${field('프로필 사진 주소 (자동 입력 또는 직접 입력)','photoUrl',o.photoUrl,false,'url')}${textarea('소개 및 특이사항','note',o.note)}${formButtons('편제 저장')}</form>`}`;modal(`${o.group} · ${o.title}`,body)}
async function lookupSoop(form,force=false){
 const input=form?.elements?.namedItem('soopUrl'),status=form?.querySelector('.soop-lookup-status'),preview=form?.querySelector('.soop-profile-preview');
 if(!input||!input.value.trim())return;
 const value=input.value.trim(),seq=Number(form.dataset.soopSeq||0)+1;
 form.dataset.soopSeq=String(seq);status.textContent='SOOP 방송국 조회 중…';status.classList.remove('lookup-error');
 const btn=form.querySelector('.soop-lookup-btn');if(btn)btn.disabled=true;
 try{
  const result=await api('/api/admin/soop/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({soopUrl:value})});
  if(form.dataset.soopSeq!==String(seq)||!form.isConnected||input.value.trim()!==value)return;
  const name=form.elements.namedItem('name'),photo=form.elements.namedItem('photoUrl');
  if(name&&(force||!name.value.trim()||name.value.trim()===form.dataset.autoNick))name.value=result.nickname;
  if(photo&&(force||!photo.value.trim()||photo.value.trim()===form.dataset.autoPhoto))photo.value=result.photoUrl;
  form.dataset.autoNick=result.nickname;form.dataset.autoPhoto=result.photoUrl;
  input.value=result.soopUrl;
  status.textContent=result.isMock?'미리보기 모의 조회입니다. 표시된 닉네임과 사진은 테스트용이며 실제 SOOP 정보가 아닙니다.':result.photoVerified?'실제 SOOP 닉네임과 프로필 사진을 가져왔습니다.':result.photoUrl?'SOOP 닉네임을 가져왔습니다. 사진은 기본 이미지 후보이므로 확인해 주세요.':'SOOP 닉네임을 가져왔지만 사진은 제공되지 않았습니다. 필요하면 사진 주소를 직접 입력해 주세요.';
  preview.hidden=false;preview.innerHTML=`${result.photoUrl?`<img src="${esc(avatarSrc(result.photoUrl))}" data-profile-img alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">`:`<span class="avatar" aria-hidden="true">◆</span>`}<div><strong>${esc(result.nickname)}</strong><span>${result.isMock?"모의 데이터 · 실제 조회 아님":"SOOP ID: "+esc(result.bjId)}</span></div>`;
 }catch(e){if(form.dataset.soopSeq!==String(seq)||!form.isConnected)return;status.textContent=`${e.message} 직접 입력해도 저장할 수 있습니다.`;status.classList.add('lookup-error');preview.hidden=true;if(force)toast(e.message,true)}
 finally{if(form.dataset.soopSeq===String(seq)&&form.isConnected&&btn)btn.disabled=false;}
}
let soopLookupTimer;
document.addEventListener('change',e=>{
 const form=e.target.closest('#officer-form');
 if(!form||e.target.name!=='insignia')return;
 const value=e.target.value;
 const box=form.querySelector('[data-insignia-preview]');
 if(box)box.innerHTML=value?`${insigniaBadge(value)}<span>${esc(value)} · 계급 자동 적용</span>`:'<span class="muted">계급장을 선택하면 계급이 자동 적용됩니다.</span>';
});
document.addEventListener('input',e=>{if(e.target.name!=='soopUrl')return;const form=e.target.closest('#soldier-form,#officer-form');if(!form)return;clearTimeout(soopLookupTimer);form.dataset.soopSeq=String(Number(form.dataset.soopSeq||0)+1);const value=e.target.value.trim();if(value.length<7)return;soopLookupTimer=setTimeout(()=>lookupSoop(form),650);});
function showReport(r=null,kind='rollcall'){modal(r?'대사 편집':'대사 작성',`<form id="report-form"><input type="hidden" name="id" value="${esc(r?.id||'')}">${selectField('대사 종류','kind',[['rollcall','아침 점호 대사'],['inspection','순검 대사']],r?.kind||kind)}${field('대본 제목','title',r?.title||'기본 멘트',true)}<label class="field"><span>실제로 읽을 대사 (줄바꿈 가능)</span><textarea class="field-input script-editor" name="content" placeholder="대사를 직접 작성하세요.\n예: 충성! 아침 점호 보고 시작하겠습니다…" required maxlength="10000">${esc(r?.content||'')}</textarea><small>날짜별 보고서가 아닌 재사용할 대본입니다. 수정한 내용은 저장 즉시 반영됩니다.</small></label>${formButtons(r?'대사 수정 저장':'대사 등록')}</form>`,{large:true})}
function showPlatoonName(group){
 if(!admin())return showDenied();
 if(!/^[1-6]소대$/.test(group))return toast('소대 번호가 올바르지 않습니다.',true);
 const current=data.settings?.platoonNames?.[group]||'';
 modal(`${group} 이름 수정`,`<form id="platoon-name-form"><input type="hidden" name="platoon" value="${group}">${field('소대 별칭','name',current,false,'text','예: 청룡 소대')}<p class="notice">번호(${group})와 간부 편제는 그대로 유지돼요. 빈칸으로 저장하면 기본 소대 이름으로 돌아갑니다.</p>${formButtons('소대 이름 저장')}</form>`);
}
function showEliminate(){const alive=data.soldiers.filter(s=>!s.eliminated);if(!alive.length)return toast('생존 병력이 없습니다.',true);modal('탈락자 지정',`<div class="alert-box mb-20">탈락 인원 수 제한 없이 기록할 수 있습니다. 지정 후 병력 현황에서 탈락자로 표시됩니다.</div><form id="eliminate-form">${selectField('탈락 대상','id',alive.map(s=>[s.id,s.name]))}${field('탈락 날짜','date',nowKST(),true,'date')}${formButtons('탈락 지정',true)}</form>`,{danger:true})}
function showAddUser(){modal('공동 관리자 추가',`<form id="user-form">${field('로그인 아이디','username','',true)}${field('비밀번호 (10자 이상)','password','',true,'password')}${selectField('계정 권한','role',[['admin','공동 관리자 (편집 가능)'],['viewer','열람용 (관리 권한 없음)']],'admin')}${formButtons('계정 생성')}</form>`)}
async function mutate(type,payload){await api('/api/admin/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload})});await load(false);draw();toast('성공적으로 저장했습니다.');}
function formPayload(form){return Object.fromEntries(new FormData(form).entries())}
async function submit(event){const form=event.target;const formId=form.getAttribute('id');if(!['login-form','setup-form','soldier-form','score-form','officer-form','report-form','eliminate-form','user-form','password-form','platoon-form','platoon-name-form','reset-form'].includes(formId))return;event.preventDefault();const b=form.querySelector('[type="submit"]');if(b)b.disabled=true;let p=formPayload(form);try{if((formId==='soldier-form'||formId==='officer-form')&&p.soopUrl&&!p.name?.trim()){clearTimeout(soopLookupTimer);await lookupSoop(form,true);p=formPayload(form);if(!p.name?.trim())throw Error('SOOP 닉네임을 확인하지 못했습니다. 닉네임을 직접 입력한 뒤 저장해 주세요.');}if(formId==='soldier-form'&&!p.name?.trim())throw Error('병사 닉네임을 입력해 주세요.');if(formId==='login-form'||formId==='setup-form'){await api(formId==='login-form'?'/api/login':'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});closeModal();await load();if(route==='/')go('/admin');toast('관리자 인증 완료');return;}
let type;if(formId==='soldier-form')type=p.id?'soldier.update':'soldier.add';if(formId==='score-form')type='score.add';if(formId==='officer-form')type='officer.save';if(formId==='report-form')type='report.save';if(formId==='eliminate-form')type='soldier.eliminate';if(formId==='user-form')type='user.add';if(formId==='password-form')type='password.change';if(formId==='platoon-form')type='settings.platoon';if(formId==='platoon-name-form')type='platoon.rename';if(formId==='reset-form'){if(!p.scope||p.confirm!=='초기화')throw Error('초기화 항목을 선택하고 확인란에 초기화를 입력해 주세요.');if(!window.confirm('선택한 기록을 영구 삭제합니다. 백업 파일을 받았는지 확인했나요?'))return;type='records.reset';}await mutate(type,p);closeModal();if(formId==='password-form'){await api('/api/logout',{method:'POST'}).catch(()=>{});await load();showLogin();toast('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');}}
catch(e){let box=form.querySelector('.form-error');if(!box){box=document.createElement('p');box.className='form-error';form.append(box)}box.textContent=e.message;toast(e.message,true)}finally{if(b)b.disabled=false}}
async function confirmMutate(message,type,payload){if(!window.confirm(message))return;try{await mutate(type,payload)}catch(e){toast(e.message,true)}}
document.addEventListener('error',e=>{
  if(e.target?.matches?.('img[data-profile-img]')){
   const fallback=document.createElement('span');fallback.className='avatar profile-image-fallback';
   fallback.textContent='◆';fallback.title='프로필 사진을 불러오지 못했습니다.';
   e.target.replaceWith(fallback);
  }
},true);
document.addEventListener('submit',submit,true);
document.addEventListener('click',async e=>{if(e.target.classList.contains('modal-scrim'))return closeModal();const link=e.target.closest('[data-route]');if(link){e.preventDefault();if(link.dataset.goTab)tab=link.dataset.goTab;return go(link.dataset.route)}const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;return draw()}const tb=e.target.closest('[data-admin-tab]');if(tb){tab=tb.dataset.adminTab;return draw()}const a=e.target.closest('[data-action]');if(!a)return;const id=a.dataset.id;try{switch(a.dataset.action){case 'lookup-soop':clearTimeout(soopLookupTimer);await lookupSoop(a.closest('form'),true);break;case 'close-modal':closeModal();break;case 'add-soldier':showSoldier();break;case 'edit-soldier':showSoldier(data.soldiers.find(x=>x.id===id));break;case 'quick-score':if(!admin())return showDenied();showScore(id,a.dataset.kind);break;case 'view-score-log':showSoldierLog(id);break;case 'score-soldier':showScore(id);break;case 'new-score':showScore();break;case 'view-officer':{const o=data.officers.find(x=>x.id===id);showOfficer(o,!admin());break}case 'edit-officer':showOfficer(data.officers.find(x=>x.id===id));break;case 'rename-platoon':showPlatoonName(a.dataset.group);break;case 'new-report':showReport(null,a.dataset.kind||'rollcall');break;case 'edit-report':showReport(data.reports.find(x=>x.id===id));break;case 'delete-report':await confirmMutate('이 보고서를 삭제할까요?','report.remove',{id});break;case 'delete-score':await confirmMutate('이 점수 기록을 취소할까요?','score.remove',{id});break;case 'new-elimination':showEliminate();break;case 'revive':await confirmMutate('이 병사의 탈락을 취소할까요?','soldier.revive',{id});break;case 'add-user':showAddUser();break;case 'delete-user':await confirmMutate('이 관리자의 접근 권한을 해제할까요? 현재 로그인 중이어도 즉시 로그아웃됩니다.','user.remove',{id});break;case 'delete-soldier':await confirmMutate('병사와 모든 점수 기록을 영구 삭제할까요?','soldier.remove',{id});break;}}catch(err){toast(err.message,true)}});
document.querySelector('#profile-button').addEventListener('click',async()=>{if(!data.user)return showLogin();if(window.confirm(`${data.user.username} 계정에서 로그아웃할까요?`)){await api('/api/logout',{method:'POST'});await load();go('/');toast('로그아웃되었습니다.')}});
document.querySelector('#mobile-menu').addEventListener('click',e=>{const nav=document.querySelector('.global-nav');nav.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(nav.classList.contains('open')))});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalRoot.innerHTML)closeModal()});
document.addEventListener('input',e=>{if(e.target.id==='soldier-search'){query=e.target.value;const list=document.querySelector('#rank-list');if(list){list.innerHTML=rankTable(data.soldiers.filter(s=>(filter==='alive'?!s.eliminated:filter==='out'?s.eliminated:true)&&s.name.toLowerCase().includes(query.toLowerCase())),false,admin());}}});
load().then(startEntryIntro).catch(e=>{app.innerHTML=`<div class="loading-frame"><h2>시스템 연결 실패</h2><p>${esc(e.message)}</p><button class="primary-btn" onclick="location.reload()">다시 시도</button></div>`});
