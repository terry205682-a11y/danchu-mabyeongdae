import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lookupSoopProfile, safeSoopImageUrl } from './soop.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'db.json');
const PORT = Number(process.env.PORT || 3000);
const SETUP_KEY = process.env.SETUP_KEY || crypto.randomBytes(18).toString('hex');
const sessions = new Map();
const loginAttempts = new Map();
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const dateKST = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const okString = (value, max=120) => typeof value === 'string' ? value.trim().slice(0,max) : '';
function slots() {
  const out = [{ id:'hq-commander', group:'중대 본부', title:'중대장', name:'', rank:'', insignia:'', soopUrl:'', photoUrl:'', note:'' }];
  for(let p=1;p<=6;p++) for(const title of ['소대장','부소대장']) out.push({id:`p${p}-${title==='소대장'?'lead':'vice'}`,group:`${p}소대`,title,name:'',rank:'',insignia:'',soopUrl:'',photoUrl:'',note:''});
  for(let i=1;i<=5;i++) out.push({id:`admin-${i}`,group:'행정반',title:`행정반 간부 ${i}`,name:'',rank:'',insignia:'',soopUrl:'',photoUrl:'',note:''});
  return out;
}
const fresh = () => ({version:1,createdAt:now(),admins:[],soldiers:[],scores:[],eliminations:[],officers:slots(),reports:[],activity:[],settings:{unitName:'단츄의 마병대 통합사령부',assignedPlatoon:'',platoonNames:{}}});
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
catch(e) { if(e.code !== 'ENOENT') throw e; db=fresh(); }
for(const key of ['admins','soldiers','scores','eliminations','officers','reports','activity']) if(!Array.isArray(db[key])) db[key] = fresh()[key];
if(!db.settings||typeof db.settings!=='object')db.settings=fresh().settings;
if(typeof db.settings.assignedPlatoon!=='string')db.settings.assignedPlatoon='';
if(!db.settings.platoonNames||typeof db.settings.platoonNames!=='object'||Array.isArray(db.settings.platoonNames))db.settings.platoonNames={};
const hashPass = password => { const salt=crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.pbkdf2Sync(password,salt,180000,32,'sha256').toString('hex')}`; };
function checkPass(password, digest) { try{const [salt,hash]=digest.split(':');const a=Buffer.from(hash,'hex'),b=crypto.pbkdf2Sync(password,salt,180000,a.length,'sha256');return crypto.timingSafeEqual(a,b);}catch{return false;} }
let writeQueue=Promise.resolve();
function persist() {
  const snapshot=JSON.stringify(db,null,2);
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{await fsp.mkdir(path.dirname(DB_FILE),{recursive:true});const t=`${DB_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;await fsp.writeFile(t,snapshot,{mode:0o600});await fsp.rename(t,DB_FILE);});
  return writeQueue;
}
function activity(type, detail, actor='SYSTEM') { db.activity.unshift({id:id(),type,detail,actor,createdAt:now()});db.activity=db.activity.slice(0,500); }
function userFrom(req){const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)danchu_session=([\w-]+)/);if(!cookie)return null;const rec=sessions.get(crypto.createHash('sha256').update(cookie[1]).digest('hex'));if(!rec||rec.until<Date.now())return null;return db.admins.find(u=>u.id===rec.userId)||null;}
function userSafe(u){return u?{id:u.id,username:u.username,role:u.role}:null;}
function scoreFor(s){const items=db.scores.filter(x=>x.soldierId===s.id);const merit=items.filter(x=>x.kind==='merit').reduce((n,x)=>n+x.points,0),penalty=items.filter(x=>x.kind==='penalty').reduce((n,x)=>n+x.points,0);return {...s,merit,penalty,total:merit-penalty};}
function ranked(){const list=db.soldiers.map(s=>scoreFor({...s,platoon:db.settings.assignedPlatoon||'배정 대기'})).sort((a,b)=>Number(a.eliminated)-Number(b.eliminated)||b.total-a.total||a.name.localeCompare(b.name,'ko'));let last=null,rank=0,aliveIndex=0;return list.map((s)=>{if(!s.eliminated){aliveIndex++;if(last!==s.total){rank=aliveIndex;last=s.total;}}return {...s,rank:s.eliminated?null:rank};});}
const FORCE_LOG_TYPES = new Set(['상점 부여','벌점 부여','점수 기록 취소','탈락 지정','탈락 취소']);
function publicState(user){const soldiers=ranked(),active=soldiers.filter(s=>!s.eliminated),all=db.scores;return {ready:db.admins.length>0,user:userSafe(user),summary:{current:active.length,eliminated:soldiers.length-active.length,merit:all.filter(x=>x.kind==='merit').reduce((n,x)=>n+x.points,0),penalty:all.filter(x=>x.kind==='penalty').reduce((n,x)=>n+x.points,0),officers:db.officers.filter(x=>x.name).length,updatedAt:db.activity[0]?.createdAt||null},soldiers,officers:db.officers,reports:db.reports.slice(0,100),scores:all.slice(0,300).map(s=>({...s,soldierName:db.soldiers.find(x=>x.id===s.soldierId)?.name||'삭제된 병사'})),activity:db.activity.slice(0,100),forceActivity:db.activity.filter(a=>FORCE_LOG_TYPES.has(a.type)).slice(0,100),eliminations:db.eliminations,settings:db.settings,users:user?.role==='owner'?db.admins.map(userSafe):[]};}
function send(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
function problem(res,status,message){send(res,status,{error:message});}
function validUrl(value){if(!value)return '';try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw 0;return url.toString().slice(0,400);}catch{throw new Error('방송국/프로필 주소는 http(s) 링크여야 합니다.');}}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>150000)throw new Error('요청 데이터가 너무 큽니다.');}try{return JSON.parse(s||'{}');}catch{throw new Error('올바른 JSON 형식이 아닙니다.');}}
function requireAdmin(req,res,owner=false){const u=userFrom(req);if(!u||u.role==='viewer'||(owner&&u.role!=='owner')){problem(res,403,'접근 권한이 없습니다.');return null;}return u;}
function expectName(x,key='이름',max=60){const s=okString(x,max);if(!s)throw new Error(`${key}을(를) 입력해 주세요.`);return s;}
function expectPoints(x){const n=Number(x);if(!Number.isInteger(n)||n<1||n>1000)throw new Error('점수는 1~1000의 정수여야 합니다.');return n;}
function expectDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()))throw new Error('날짜 형식이 올바르지 않습니다.');return s;}
function logIn(res, user,req){const token=crypto.randomBytes(32).toString('hex');sessions.set(crypto.createHash('sha256').update(token).digest('hex'),{userId:user.id,until:Date.now()+7*86400000});const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';send(res,200,{user:userSafe(user)},{'Set-Cookie':`danchu_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure?'; Secure':''}`});}
async function action(res,actor,a){const p=a.payload||{};let result={};switch(a.type){
  case 'soldier.add': {const profile=p.soopUrl&&!p.name?await lookupSoopProfile(p.soopUrl).catch(e=>{if(!p.name)throw new Error(`${e.message} (병사 이름을 직접 입력하면 수동 등록 가능합니다.)`);return null;}):null;const name=expectName(p.name||profile?.nickname);if(db.soldiers.some(s=>s.name===name))throw new Error('같은 이름의 병사가 이미 있습니다.');const s={id:id(),name,soopUrl:validUrl(profile?.soopUrl||p.soopUrl),photoUrl:validUrl(p.photoUrl||profile?.photoUrl),platoon:db.settings.assignedPlatoon||'배정 대기',note:okString(p.note,300),eliminated:false,eliminatedAt:null,createdAt:now()};db.soldiers.push(s);activity('병사 등록',name,actor.username);result={id:s.id};break;}
  case 'soldier.update': {const s=db.soldiers.find(x=>x.id===p.id);if(!s)throw new Error('병사를 찾을 수 없습니다.');const profile=p.soopUrl&&!p.name?await lookupSoopProfile(p.soopUrl).catch(e=>{if(!p.name)throw new Error(`${e.message} (이름을 직접 입력하면 수동 저장 가능합니다.)`);return null;}):null;const name=expectName(p.name||profile?.nickname);if(db.soldiers.some(x=>x.id!==s.id&&x.name===name))throw new Error('같은 이름의 병사가 이미 있습니다.');Object.assign(s,{name,soopUrl:validUrl(profile?.soopUrl||p.soopUrl),photoUrl:validUrl(p.photoUrl||profile?.photoUrl),platoon:db.settings.assignedPlatoon||'배정 대기',note:okString(p.note,300)});activity('병사 수정',name,actor.username);break;}
  case 'soldier.remove': {const s=db.soldiers.find(x=>x.id===p.id);if(!s)throw new Error('병사를 찾을 수 없습니다.');db.soldiers=db.soldiers.filter(x=>x.id!==s.id);db.scores=db.scores.filter(x=>x.soldierId!==s.id);activity('병사 삭제',s.name,actor.username);break;}
  case 'score.add': {const s=db.soldiers.find(x=>x.id===p.soldierId);if(!s)throw new Error('병사를 선택해 주세요.');if(!['merit','penalty'].includes(p.kind))throw new Error('상점 또는 벌점을 선택해 주세요.');const entry={id:id(),soldierId:s.id,kind:p.kind,points:expectPoints(p.points),reason:expectName(p.reason,'사유'),createdAt:now(),actor:actor.username};db.scores.unshift(entry);activity(p.kind==='merit'?'상점 부여':'벌점 부여',`${s.name} ${entry.points}점 · ${entry.reason}`,actor.username);break;}
  case 'score.remove': {const old=db.scores.find(x=>x.id===p.id);if(!old)throw new Error('점수 기록을 찾을 수 없습니다.');db.scores=db.scores.filter(x=>x.id!==old.id);activity('점수 기록 취소',`${db.soldiers.find(s=>s.id===old.soldierId)?.name||'병사'} ${old.points}점`,actor.username);break;}
  case 'soldier.eliminate': {const s=db.soldiers.find(x=>x.id===p.id);if(!s)throw new Error('병사를 찾을 수 없습니다.');if(s.eliminated)throw new Error('이미 탈락한 병사입니다.');const day=expectDate(p.date||dateKST());s.eliminated=true;s.eliminatedAt=now();db.eliminations.unshift({id:id(),soldierId:s.id,name:s.name,date:day,actor:actor.username,createdAt:now()});activity('탈락 지정',`${s.name} · ${day}`,actor.username);break;}
  case 'soldier.revive': {const s=db.soldiers.find(x=>x.id===p.id);if(!s)throw new Error('병사를 찾을 수 없습니다.');s.eliminated=false;s.eliminatedAt=null;db.eliminations=db.eliminations.filter(e=>e.soldierId!==s.id);activity('탈락 취소',s.name,actor.username);break;}
  case 'officer.save': {const o=db.officers.find(x=>x.id===p.id);if(!o)throw new Error('간부 슬롯을 찾을 수 없습니다.');const insignia=okString(p.insignia||p.rank,30); // 구버전 계급 전송도 호환
    if(insignia&&!['소령','대위','중위','소위','상사','중사','하사'].includes(insignia))throw new Error('선택할 수 없는 계급장입니다.');
    const rank=insignia; // 계급장 선택만으로 계급을 동일하게 설정
    const profile=p.soopUrl&&!p.name?await lookupSoopProfile(p.soopUrl).catch(()=>null):null;Object.assign(o,{name:okString(p.name||profile?.nickname,60),position:p.position===undefined?okString(o.position,40):okString(p.position,40),rank,insignia,soopUrl:validUrl(profile?.soopUrl||p.soopUrl),photoUrl:validUrl(p.photoUrl||profile?.photoUrl),note:okString(p.note,400)});activity('간부 편제 수정',`${o.title}${o.position?' · '+o.position:''}: ${o.name||'미등록'}`,actor.username);break;}
  case 'report.save': {if(!['rollcall','inspection'].includes(p.kind))throw new Error('대사 종류를 선택해 주세요.');const old=p.id?db.reports.find(r=>r.id===p.id):null;if(p.id&&!old)throw new Error('수정할 대본을 찾을 수 없습니다.');const report={id:old?.id||id(),kind:p.kind,date:old?.date||dateKST(),title:expectName(p.title,'대본 제목'),content:expectName(p.content,'대사',10000),actor:actor.username,updatedAt:now()};if(old)db.reports[db.reports.indexOf(old)]=report;else db.reports.unshift(report);activity('대본 저장',report.title,actor.username);break;}
  case 'report.remove': {const r=db.reports.find(x=>x.id===p.id);if(!r)throw new Error('보고를 찾을 수 없습니다.');db.reports=db.reports.filter(x=>x.id!==r.id);activity('보고 삭제',r.title,actor.username);break;}
  case 'platoon.rename': {
    const platoon=okString(p.platoon,30);
    if(!/^[1-6]소대$/.test(platoon))throw new Error('1~6소대 중에서 선택해 주세요.');
    const name=okString(p.name,30);
    if(!db.settings.platoonNames||typeof db.settings.platoonNames!=='object')db.settings.platoonNames={};
    if(name)db.settings.platoonNames[platoon]=name;
    else delete db.settings.platoonNames[platoon];
    activity('소대 이름 수정',`${platoon}: ${name||'기본 이름'}`,actor.username);
    result={platoon,name};break;
  }
  case 'settings.platoon': {if(actor.role!=='owner')throw new Error('최고 관리자만 담당 소대를 설정할 수 있습니다.');const platoon=okString(p.platoon,30);if(platoon&&!/^[1-6]소대$/.test(platoon))throw new Error('1~6소대 중에서 선택해 주세요.');db.settings.assignedPlatoon=platoon;for(const soldier of db.soldiers)soldier.platoon=platoon||'배정 대기';activity('담당 소대 설정',platoon||'미지정',actor.username);break;}
  case 'records.reset': {
    if(actor.role!=='owner')throw new Error('초기화는 최고 관리자만 실행할 수 있습니다.');
    if(p.confirm!=='초기화')throw new Error('확인란에 초기화를 정확히 입력해 주세요.');
    const scope=p.scope,allowed=['soldiers','scores','eliminations','activity','officers','reports','all'];
    if(!allowed.includes(scope))throw new Error('초기화 항목이 올바르지 않습니다.');
    if(scope==='soldiers'||scope==='all'){db.soldiers=[];db.scores=[];db.eliminations=[];db.activity=db.activity.filter(a=>!FORCE_LOG_TYPES.has(a.type));}
    if(scope==='scores'){db.scores=[];db.activity=db.activity.filter(a=>!['상점 부여','벌점 부여','점수 기록 취소'].includes(a.type));}
    if(scope==='eliminations'){db.eliminations=[];for(const soldier of db.soldiers){soldier.eliminated=false;soldier.eliminatedAt=null;}db.activity=db.activity.filter(a=>!['탈락 지정','탈락 취소'].includes(a.type));}
    if(scope==='officers'||scope==='all')db.officers=slots();
    if(scope==='reports'||scope==='all')db.reports=[];
    if(scope==='activity'||scope==='all')db.activity=[];
    result={scope,reset:true};break;
  }
  case 'user.add': {if(actor.role!=='owner')throw new Error('최고 관리자만 계정을 추가할 수 있습니다.');const username=expectName(p.username,'아이디').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(username))throw new Error('아이디는 영문 소문자·숫자·밑줄 3~24자만 가능합니다.');if(db.admins.some(u=>u.username===username))throw new Error('이미 존재하는 아이디입니다.');if(!['admin','viewer'].includes(p.role))throw new Error('역할을 선택해 주세요.');if(p.role==='admin'&&db.admins.filter(u=>u.role!=='viewer').length>=2)throw new Error('관리자 계정은 총 2명까지만 등록할 수 있습니다.');if(typeof p.password!=='string'||p.password.length<10)throw new Error('비밀번호는 10자 이상으로 설정해 주세요.');db.admins.push({id:id(),username,pass:hashPass(p.password),role:p.role,createdAt:now()});activity('계정 추가',`${username} (${p.role})`,actor.username);break;}
  case 'user.remove': {if(actor.role!=='owner')throw new Error('최고 관리자만 계정을 삭제할 수 있습니다.');const u=db.admins.find(x=>x.id===p.id);if(!u||u.id===actor.id)throw new Error('본인 또는 없는 계정은 삭제할 수 없습니다.');db.admins=db.admins.filter(x=>x.id!==u.id);for(const [token,sess] of sessions)if(sess.userId===u.id)sessions.delete(token);activity('계정 삭제',u.username,actor.username);break;}
  case 'password.change': {if(!checkPass(p.oldPassword||'',actor.pass))throw new Error('현재 비밀번호가 올바르지 않습니다.');if(typeof p.newPassword!=='string'||p.newPassword.length<10)throw new Error('새 비밀번호는 10자 이상이어야 합니다.');actor.pass=hashPass(p.newPassword);for(const [token,sess] of sessions)if(sess.userId===actor.id)sessions.delete(token);activity('비밀번호 변경',actor.username,actor.username);break;}
  default:throw new Error('지원하지 않는 작업입니다.');
}await persist();send(res,200,{success:true,result});}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const url=new URL(req.url,'http://localhost');const route=url.pathname;
  try {
    if(route==='/api/bootstrap'&&req.method==='GET')return send(res,200,publicState(userFrom(req)));
    if(route==='/api/setup'&&req.method==='POST'){if(db.admins.length)return problem(res,409,'이미 최초 관리자가 설정되었습니다.');const p=await body(req);const a=Buffer.from(String(p.setupKey||'')),b=Buffer.from(SETUP_KEY);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return problem(res,403,'설치 키가 올바르지 않습니다.');const username=expectName(p.username,'아이디').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(username))throw new Error('아이디는 영문 소문자·숫자·밑줄 3~24자만 가능합니다.');if(typeof p.password!=='string'||p.password.length<10)throw new Error('비밀번호는 10자 이상이어야 합니다.');const user={id:id(),username,pass:hashPass(p.password),role:'owner',createdAt:now()};db.admins.push(user);activity('시스템 설치','최고 관리자 등록',username);await persist();return logIn(res,user,req);}
    if(route==='/api/login'&&req.method==='POST'){const ip=req.socket.remoteAddress||'unknown',attempt=loginAttempts.get(ip)||{count:0,until:0};if(attempt.until>Date.now()&&attempt.count>=8)return problem(res,429,'로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');const p=await body(req);const user=db.admins.find(u=>u.username===okString(p.username,60).toLowerCase());if(!user||!checkPass(p.password||'',user.pass)){const t=Date.now();loginAttempts.set(ip,{count:attempt.until>t?attempt.count+1:1,until:attempt.until>t?attempt.until:t+15*60000});return problem(res,401,'아이디 또는 비밀번호가 일치하지 않습니다.');}loginAttempts.delete(ip);return logIn(res,user,req);}
    if(route==='/api/logout'&&req.method==='POST'){const t=(req.headers.cookie||'').match(/(?:^|;\s*)danchu_session=([\w-]+)/);if(t)sessions.delete(crypto.createHash('sha256').update(t[1]).digest('hex'));return send(res,200,{success:true},{'Set-Cookie':'danchu_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});}
    if(route==='/api/soop-image'&&req.method==='GET'){
      const target=safeSoopImageUrl(url.searchParams.get('url'));
      if(!target)return problem(res,400,'허용되지 않은 SOOP 이미지 주소입니다.');
      let upstream;
      try{upstream=await fetch(target,{headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'},redirect:'error',signal:AbortSignal.timeout(6000)});}catch{return problem(res,502,'SOOP 이미지 서버에 연결할 수 없습니다.');}
      if(!upstream.ok)return problem(res,upstream.status===404?404:502,'SOOP 프로필 사진을 가져오지 못했습니다.');
      const type=String(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type))return problem(res,502,'SOOP 서버가 이미지가 아닌 데이터를 반환했습니다.');
      const len=Number(upstream.headers.get('content-length')||0);
      if(len>2097152)return problem(res,413,'프로필 사진 크기가 너무 큽니다.');
      let bytes;try{bytes=Buffer.from(await upstream.arrayBuffer());}catch{return problem(res,502,'이미지를 받지 못했습니다.');}
      if(bytes.length>2097152)return problem(res,413,'프로필 사진 크기가 너무 큽니다.');
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'public,max-age=3600','Content-Length':String(bytes.length)});
      return res.end(bytes);
    }
    if(route==='/api/admin/soop/lookup'&&req.method==='POST'){const actor=requireAdmin(req,res);if(!actor)return;const p=await body(req);try{return send(res,200,await lookupSoopProfile(p.soopUrl));}catch(e){return problem(res,e.status||502,e.message||'SOOP 프로필을 가져올 수 없습니다.');}}
    if(route==='/api/admin/action'&&req.method==='POST'){const actor=requireAdmin(req,res);if(!actor)return;const a=await body(req);return await action(res,actor,a);}
    if(route==='/api/admin/export'&&req.method==='GET'){const actor=requireAdmin(req,res);if(!actor)return;const dump={exportedAt:now(),soldiers:db.soldiers,scores:db.scores,officers:db.officers,reports:db.reports,eliminations:db.eliminations,activity:db.activity,settings:db.settings};res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="mabyeongdae-backup.json"','Cache-Control':'no-store'});return res.end(JSON.stringify(dump,null,2));}
    if(route.startsWith('/api/'))return problem(res,404,'존재하지 않는 API입니다.');
    if(req.method!=='GET'&&req.method!=='HEAD')return problem(res,405,'지원하지 않는 요청입니다.');
    const known=['/','/force','/officers','/admin'];let rel=known.includes(route)?'index.html':route.replace(/^\//,'');if(rel.includes('..')||rel.includes('\\'))return problem(res,400,'올바르지 않은 경로입니다.');const filepath=path.resolve(PUBLIC,rel);if(!filepath.startsWith(PUBLIC+path.sep))return problem(res,403,'허용되지 않은 접근입니다.');let file;try{file=await fsp.readFile(filepath);}catch{return problem(res,404,'파일을 찾을 수 없습니다.');}res.writeHead(200,{'Content-Type':mime[path.extname(filepath)]||'application/octet-stream','Cache-Control':'public,max-age=300'});return res.end(req.method==='HEAD'?undefined:file);
  }catch(e){console.error('Request error:',e.message);return problem(res,e.message.includes('EACCES')?500:400,e.message||'요청 처리 중 오류가 발생했습니다.');}
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 server.listen(PORT,()=>{console.log(`\n단츄의 마병대 통합사령부: http://localhost:${PORT}`);if(!db.admins.length)console.log(`최초 관리자 설치 키: ${SETUP_KEY}\n(설치 화면에서 입력하세요. 서버 비밀번호를 외부에 공개하지 마세요.)`);console.log(`데이터 파일: ${DB_FILE}\n`);});
}
export {server};
