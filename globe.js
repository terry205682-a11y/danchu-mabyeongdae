import { COASTS, LAND } from './world-data.js';
const rad=Math.PI/180;
export function startGlobe(canvas) {
  const ctx=canvas.getContext('2d',{alpha:true}); let W=0,H=0,dpr=1,ring=0,last=0,frame=0,visible=true,mode='home',phase=null,settleStart=0,spinCarry=0,introFinished=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const resize=()=>{const rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(W*dpr));canvas.height=Math.max(1,Math.round(H*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);};
  function point(lon,lat,centerLon,centerLat,cx,cy,r){const a=lon*rad-centerLon,b=lat*rad,s=Math.sin(b),c=Math.cos(b),v=Math.sin(centerLat)*s+Math.cos(centerLat)*c*Math.cos(a); if(v<0)return null;return [cx+r*c*Math.sin(a),cy-r*(Math.cos(centerLat)*s-Math.sin(centerLat)*c*Math.cos(a)),v];}
  function gridCurve(centerLon,centerLat,cx,cy,r,isLat,val){ctx.beginPath();let started=false;for(let n=0;n<=180;n++){const lon=isLat?-180+n*2:val,lat=isLat?val:-85+n*170/180;const p=point(lon,lat,centerLon,centerLat,cx,cy,r);if(!p){started=false;continue;}if(!started)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);started=true;}ctx.stroke();}
  function draw(time){if(!W||!H)return;ctx.clearRect(0,0,W,H);const mobile=W<650,cx=W*(mobile?.51:.50),cy=mode==='home'?Math.min(350,H*.29):Math.min(370,H*.28);
    let zoom=!introFinished&&mode==='home'&&!reduced.matches?3.15:1,spin=spinCarry;
    if(phase){
      const p=Math.min(1,Math.max(0,(time-phase.start)/phase.duration));
      const ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      spin+=phase.kind==='intro'?1260*ease:900*ease;
      zoom=phase.kind==='intro'?3.15-2.15*ease:1+1.15*ease;
      if(p===1){
        spinCarry+=phase.kind==='intro'?1260:900;
        const ended=phase;phase=null;
        if(ended.kind==='enter')settleStart=time;
        if(ended.kind==='intro')introFinished=true;
        ended.resolve();
      }
    }else if(settleStart){
      const p=Math.min(1,(time-settleStart)/620);
      zoom=1+1.15*Math.pow(1-p,3);
      if(p===1)settleStart=0;
    }
    const r=Math.min(W*(mobile?.57:.37),H*(mode==='home'?.45:.42),550)*zoom;
    if(r<15)return;
    let lon=((-52+(reduced.matches?0:time*.00048)+spin)*rad),lat=19*rad;
    const halo=ctx.createRadialGradient(cx,cy,r*.1,cx,cy,r*1.38);halo.addColorStop(0,'rgba(23,101,169,.05)');halo.addColorStop(.7,'rgba(0,134,213,.08)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*1.4,0,Math.PI*2);ctx.fill();
    const orb=ctx.createRadialGradient(cx-r*.33,cy-r*.4,r*.05,cx,cy,r);orb.addColorStop(0,'rgba(22,108,162,.09)');orb.addColorStop(.78,'rgba(3,33,56,.30)');orb.addColorStop(1,'rgba(7,31,50,.65)');ctx.fillStyle=orb;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle='rgba(39,162,225,.17)';ctx.lineWidth=.7;for(let a=-75;a<=75;a+=15)gridCurve(lon,lat,cx,cy,r,true,a);for(let a=-180;a<180;a+=15)gridCurve(lon,lat,cx,cy,r,false,a);
    // Subtle landmass coastline traced from local, bundled coastline geometry.
    ctx.strokeStyle='rgba(71,180,241,.48)';ctx.lineWidth=.85;
    for(const line of COASTS){ctx.beginPath();let start=false,lastP=null;for(const [a,b] of line){const p=point(a,b,lon,lat,cx,cy,r);if(!p){start=false;lastP=null;continue;}if(lastP&&Math.hypot(p[0]-lastP[0],p[1]-lastP[1])>r*.15)start=false;if(!start)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);lastP=p;start=true;}ctx.stroke();}
    // Land contours are faint fill shapes; coastline remains dominant.
    for(const poly of LAND){if(poly.length<8)continue;let p=poly[Math.floor(poly.length/2)],v=point(p[0],p[1],lon,lat,cx,cy,r);if(!v)continue;ctx.beginPath();let good=0;for(const xy of poly){const pt=point(xy[0],xy[1],lon,lat,cx,cy,r);if(pt){if(good===0)ctx.moveTo(pt[0],pt[1]);else ctx.lineTo(pt[0],pt[1]);good++;}else{good=0;}}ctx.strokeStyle='rgba(34,137,194,.085)';ctx.stroke();}
    const shade=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);shade.addColorStop(0,'rgba(2,14,27,.06)');shade.addColorStop(.42,'rgba(2,14,27,.08)');shade.addColorStop(1,'rgba(2,14,27,.65)');ctx.fillStyle=shade;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.restore();
    ctx.strokeStyle='rgba(44,174,255,.36)';ctx.lineWidth=1;ctx.shadowBlur=13;ctx.shadowColor='rgba(33,182,255,.5)';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(41,160,220,.20)';ctx.setLineDash([4,12]);ctx.beginPath();ctx.arc(cx,cy,r+18,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    const angle=ring*.00019;for(let k=0;k<3;k++){ctx.strokeStyle=k===0?'rgba(63,197,255,.52)':'rgba(47,145,218,.25)';ctx.lineWidth=k===0?2:1;ctx.beginPath();ctx.arc(cx,cy,r+24+k*22,angle+k*1.4,angle+k*1.4+(.25+k*.13)*Math.PI);ctx.stroke();}
    for(let k=0;k<30;k++){const a=k*2.39996,dist=r*(1.13+(k%3)*.02),x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist;if(x<0||y<0||x>W||y>H)continue;ctx.fillStyle=k%5===0?'rgba(118,226,255,.62)':'rgba(32,144,203,.28)';ctx.fillRect(x,y,k%5===0?2:1,k%5===0?2:1);}
  }
  function loop(time){frame=requestAnimationFrame(loop);if(document.hidden||!visible||!W)return;if(reduced.matches){if(last===0){draw(0);last=1;}return;}if(time-last<38)return;last=time;ring=time;draw(time);}
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();frame=requestAnimationFrame(loop);const vis=()=>{if(!document.hidden){last=0;draw(performance.now());}};document.addEventListener('visibilitychange',vis);function startPhase(kind){
   if(reduced.matches)return Promise.resolve();
   // 두 애니메이션이 동시에 실행되지 않도록 합니다.
   if(phase)return Promise.resolve();
   return new Promise(resolve=>{phase={kind,start:performance.now(),duration:kind==='intro'?1950:680,resolve};draw(performance.now());});
  }
  return {setMode(m){mode=m;draw(performance.now());},intro(){return startPhase('intro');},zoomIntoSection(){return startPhase('enter');},stop(){cancelAnimationFrame(frame);ro.disconnect();document.removeEventListener('visibilitychange',vis);}};
}
