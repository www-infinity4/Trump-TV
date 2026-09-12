(function(root){
  "use strict";
  const TIME_ZONE=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
  const SLOT_SECONDS=1800;
  function parts(date){
    const p=new Intl.DateTimeFormat("en-US",{timeZone:TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
    return Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));
  }
  function zonedToUtc(year,month,day,hour=0,minute=0,second=0){
    const target=Date.UTC(year,month-1,day,hour,minute,second);let guess=target;
    for(let i=0;i<4;i++){const p=parts(new Date(guess));const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);guess+=target-represented;}
    return guess;
  }
  function dateKey(ms){const p=parts(new Date(ms));return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;}
  function hash(text){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0;}
  function rotate(items,seed){if(!items.length)return[];const offset=hash(seed)%items.length;return [...items.slice(offset),...items.slice(0,offset)];}
  function blockForHour(hour,blocks){return blocks.find(b=>hour>=b.startHour&&hour<b.endHour)||blocks[0];}
  function createDaySchedule(nowMs,catalog,blocks){
    const p=parts(new Date(nowMs));const midnightMs=zonedToUtc(p.year,p.month,p.day);const key=dateKey(nowMs);const schedule=[];
    for(const block of blocks){
      const pool=(catalog[block.pool]||[]).filter(item=>item.videoId||item.sourceUrl);if(!pool.length)continue;
      const ordered=rotate(pool,`${key}:${block.id}`);const startSec=block.startHour*3600;const endSec=block.endHour*3600;
      let slotIndex=0;
      for(let sec=startSec;sec<endSec;sec+=SLOT_SECONDS){
        const program=ordered[slotIndex%ordered.length];
        schedule.push({id:`${key}-${block.id}-${slotIndex}`,block,program,startsAtMs:midnightMs+sec*1000,endsAtMs:midnightMs+Math.min(sec+SLOT_SECONDS,endSec)*1000,slotSeconds:Math.min(SLOT_SECONDS,endSec-sec)});
        slotIndex++;
      }
    }
    return schedule;
  }
  function resolve(nowMs,schedule){
    const item=schedule.find(x=>nowMs>=x.startsAtMs&&nowMs<x.endsAtMs)||schedule[0];
    const elapsed=Math.max(0,Math.floor((nowMs-item.startsAtMs)/1000));
    const runtime=Math.max(1,item.program.runtimeSeconds||item.slotSeconds);
    return {item,elapsed,mediaSeconds:elapsed%runtime,remaining:Math.max(0,item.slotSeconds-elapsed)};
  }
  root.TrumpTvEngine={TIME_ZONE,SLOT_SECONDS,parts,zonedToUtc,dateKey,createDaySchedule,resolve,blockForHour};
})(window);