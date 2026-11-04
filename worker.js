// Alya's — standalone Cloudflare Worker for Yapin'.
// Character metadata is fetched on demand; only player assets are persisted.
const API = 'https://bots.yapper.website/api/bot/v1';
const ANI = 'https://graphql.anilist.co';
const RARITIES = [
 ['common','55'],['uncommon','25'],['rare','15'],['epic','4.5'],
 ['mythic','0.49'],['legendary','0.019'],['godly','0.0019'],
 ['astral','0.00019'],['perplexed','0.000019'],['blessed','0.0000019'],
 ['peak','0.00000019'],['insane','0.000000019'],['fury','0.0000000019'],
 ['honoured','0.00000000019'],['truthful','0.000000000019']
];
const BASE = {common:20,uncommon:60,rare:150,epic:500,mythic:1500,legendary:6000,
 godly:30000,astral:120000,perplexed:500000,blessed:1500000,peak:4500000,
 insane:12000000,fury:30000000,honoured:70000000,truthful:150000000};
const COMMANDS = [
 ['roll','Roll anime characters. Add an anime name for a targeted roll.'],
 ['credits','Show your credits balance.'],['collection','See your latest cards.'],
 ['card','Inspect a card by UID.'],['sell','Sell a card instantly or list it on the market.'],
 ['buy','Buy a card by UID (listed price or 4x reference value).'],
 ['market','Browse the player marketplace.'],['boosts','See or apply your boosts.'],
 ['open','Open a crate for credits, boosts, or a card.']
].map(([name,description])=>({name,description}));
const nfmt = x => Number(x).toLocaleString('en-GB');
const uid = x => '#' + String(x).padStart(4,'0');
const now = () => Math.floor(Date.now()/1000);
const intId = x => /^\#?[1-9]\d{0,12}$/.test(String(x||'')) ? Number(String(x).replace('#','')) : null;
const rand = max => { // uniform secure integer, max <= 2^32
 if (!Number.isSafeInteger(max)||max<1||max>4294967296) throw new Error('Invalid random range');
 const m=4294967296, cutoff=m-(m%max), a=new Uint32Array(1);
 do {crypto.getRandomValues(a);} while(a[0]>=cutoff);
 return a[0]%max;
};
const choose = arr => arr[rand(arr.length)];
function randomBigInt(max) {
 const bits=max.toString(2).length, length=Math.ceil(bits/8), range=1n<<BigInt(8*length), cutoff=range-range%max;
 while(true){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);
  let r=0n;for(const b of bytes)r=(r<<8n)+BigInt(b);if(r<cutoff)return r%max;}
}
function rarity(boosted=false) {
 const scale=1000000000000n;
 const data=RARITIES.map(([name,p],idx)=>{
  const [w,f='']=p.split('.');
  return {name, weight:(BigInt(w)*scale+BigInt(f.padEnd(12,'0')))*(boosted && idx>=2 ? 2n:1n)};
 });
 const total=data.reduce((a,b)=>a+b.weight,0n);
 let pick=randomBigInt(total);
 for(const x of data){if(pick<x.weight)return x.name;pick-=x.weight;}
 return 'common';
}
const imageSafe = u => typeof u==='string' && /^https:\/\/s4\.anilist\.co\//i.test(u) ? u : null;
async function anilist(query,variables,env){
 const key='https://alyas-cache.invalid/v1/'+encodeURIComponent(JSON.stringify({query,variables}));
 const cache=caches.default, req=new Request(key);
 const hit=await cache.match(req);
 if(hit)return hit.json();
 const r=await fetch(ANI,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({query,variables})});
 if(!r.ok)throw new Error('AniList is unavailable ('+r.status+'). Try again later.');
 const data=await r.json();
 if(data.errors?.length)throw new Error('AniList could not find that anime.');
 const res=data.data;
 await cache.put(req,new Response(JSON.stringify(res),{headers:{'Cache-Control':'public,max-age=900','Content-Type':'application/json'}}));
 return res;
}
async function randomCharacter(anime,env){
 const search=(anime||'').trim();
 const Q1='query($page:Int,$search:String){Page(page:$page,perPage:20){pageInfo{lastPage}media(type:ANIME,search:$search,sort:POPULARITY_DESC){id title{romaji english}}}}';
 const Q2='query($id:Int,$page:Int){Media(id:$id,type:ANIME){characters(page:$page,perPage:25,sort:ROLE){pageInfo{lastPage}nodes{id name{full}image{large}}}}}';
 const start=await anilist(Q1,{page:1,search:search||null},env);
 const first=start.Page, maxPage=Math.max(1,first?.pageInfo?.lastPage||1);
 if(!first?.media?.length)throw new Error('No anime found by that name.');
 for(let i=0;i<5;i++){
  const listing=search ? first : await anilist(Q1,{page:1+rand(maxPage),search:null},env).then(x=>x.Page);
  if(!listing?.media?.length)continue;
  const show=search ? (listing.media.find(m=>[m.title.english,m.title.romaji].some(n=>n?.toLowerCase()===search.toLowerCase()))||listing.media[0]) : choose(listing.media);
  const initial=await anilist(Q2,{id:show.id,page:1},env);
  const connection=initial.Media?.characters, last=connection?.pageInfo?.lastPage||1;
  const picked=last>1 ? await anilist(Q2,{id:show.id,page:1+rand(last)},env) : initial;
  const chars=(picked.Media?.characters?.nodes||[]).filter(c=>c?.id&&c.name?.full&&imageSafe(c.image?.large));
  if(!chars.length)continue;
  const ch=choose(chars);
  return {characterId:ch.id,mediaId:show.id,name:ch.name.full,anime:show.title.english||show.title.romaji,image:imageSafe(ch.image.large)};
 }
 throw new Error('Could not find an illustrated character. Try again.');
}
async function api(env,method,path,payload){
 if(!env.YAPIN_BOT_TOKEN)throw new Error('Yapin bot token is not configured.');
 const r=await fetch(API+path,{method,headers:{Authorization:'Bot '+env.YAPIN_BOT_TOKEN,'Content-Type':'application/json'},
  body:payload===undefined?undefined:JSON.stringify(payload)});
 const raw=await r.text();
 let data={};try{data=raw?JSON.parse(raw):{}}catch{data={error:raw.slice(0,180)}}
 if(!r.ok)throw new Error('Yapin API '+r.status+': '+(data.error||data.message||'request failed'));
 return data;
}
async function verifySignature(secret,body,sig){
 if(!secret||!/^sha256=[0-9a-f]{64}$/i.test(sig||''))return false;
 const bytes=new TextEncoder().encode(body);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const h=(sig.slice(7).match(/.{2}/g)||[]).map(x=>parseInt(x,16));
 return crypto.subtle.verify('HMAC',key,new Uint8Array(h),bytes);
}
async function ensurePlayer(db,id){
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO players(user_id) VALUES(?)').bind(id),
  db.prepare("INSERT OR IGNORE INTO crates(owner_id,crate_type,quantity) VALUES(?,'basic',1)").bind(id)
 ]);
 return db.prepare('SELECT * FROM players WHERE user_id=?').bind(id).first();
}
async function hasBoost(db,id,type){
 return !!await db.prepare('SELECT 1 FROM active_boosts WHERE owner_id=? AND boost_type=? AND expires_at>unixepoch()').bind(id,type).first();
}
function cardEmbed(card,footer){
 const rr=card.rarity||'common';
 const color=({common:'#888da3',uncommon:'#54bf82',rare:'#438aff',epic:'#aa70ff',mythic:'#ff64b4',
 legendary:'#ffd65a',godly:'#ff6a55',astral:'#67eff8',perplexed:'#f566e6',
 blessed:'#ffdb83',peak:'#ff3f8f',insane:'#ee3131',fury:'#a61735',
 honoured:'#ffffff',truthful:'#a5ffd2'})[rr]||'#b0b0b0';
 return {title:'✦ '+(card.name||card.character_name||'Unknown character'),
  description:'**'+rr.toUpperCase()+'** · '+(card.anime||card.media_name||'Unknown anime'),
  color,fields:[
   {name:'Card UID',value:card.uid&&String(card.uid).startsWith('#')?card.uid:uid(card.uid),inline:true},
   {name:'Mint',value:uid(card.mint||card.mint_number),inline:true},
   {name:'Edition',value:card.edition||'Standard',inline:true}
  ],...(imageSafe(card.image||card.image_url)?{image:{url:card.image||card.image_url}}:{}),
  footer:{text:footer||"Alya's • character metadata by AniList"}};
}
async function reply(ev,env,body){
 const data=ev.data, type=ev.event||ev.type;
 if(type==='command'||type==='interaction'){
  const payload={type:body.ephemeral?'ephemeral':'reply',content:body.content||'',embeds:body.embeds||[],components:body.components||[]};
  return api(env,'POST','/interactions/'+encodeURIComponent(data.id)+'/'+encodeURIComponent(data.token)+'/callback',payload);
 }
 return api(env,'POST','/channels/'+encodeURIComponent(data.channel_id)+'/messages',
  {...body,reply_to:data.id});
}
async function send(env,ch,body){
 return api(env,'POST','/channels/'+encodeURIComponent(ch)+'/messages',body);
}
async function editOrSend(env,ch,id,body){
 if(id)try{return await api(env,'PATCH','/channels/'+encodeURIComponent(ch)+'/messages/'+encodeURIComponent(id),body)}catch(e){console.warn('Edit failed',String(e))}
 return send(env,ch,body);
}
function errMsg(e){
 const s=String(e?.message||e||'Unknown error');
 if(/CHECK constraint failed/.test(s))return 'Not enough credits or items to complete that action.';
 if(/UNIQUE constraint failed/.test(s))return 'This action was already completed, or this card is already listed.';
 return s.slice(0,380);
}
async function reserveRoll(db,id,anime,env){
 const player=await ensurePlayer(db,id);
 const cost=anime?1000:10;
 if(player.credits<cost&&!anime)throw new Error('You need 10 credits to roll. Sell a card to earn more.');
 const time=now();
 const lock=await db.prepare('UPDATE players SET last_roll_at=? WHERE user_id=? AND last_roll_at<=? RETURNING user_id')
   .bind(time,id,time-30).first();
 if(!lock)throw new Error('Roll cooldown: try again in about 30 seconds.');
 let ch;
 try{ch=await randomCharacter(anime,env)}catch(e){
  await db.prepare('UPDATE players SET last_roll_at=0 WHERE user_id=? AND last_roll_at=?').bind(id,time).run();
  throw e;
 }
 const isLucky=await hasBoost(db,id,'luck'), r=rarity(isLucky), pid=crypto.randomUUID();
 await db.prepare('INSERT INTO pending_rolls(id,owner_id,character_id,media_id,name,anime,image,rarity,cost,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .bind(pid,id,ch.characterId,ch.mediaId,ch.name,ch.anime,ch.image,r,cost,time+900).run();
 return {id:pid,...ch,rarity:r,cost};
}
async function claim(db,rollId,userId){
 const p=await db.prepare('SELECT * FROM pending_rolls WHERE id=? AND owner_id=? AND expires_at>unixepoch()').bind(rollId,userId).first();
 if(!p)throw new Error('This roll has expired or has already been claimed.');
 await ensurePlayer(db,userId);
 const statements=[
  db.prepare('UPDATE players SET credits=credits-? WHERE user_id=? AND EXISTS(SELECT 1 FROM pending_rolls WHERE id=? AND owner_id=? AND expires_at>unixepoch())').bind(p.cost,userId,rollId,userId),
  db.prepare('INSERT INTO character_mints(character_id,last_mint) SELECT character_id,1 FROM pending_rolls WHERE id=? AND owner_id=? AND expires_at>unixepoch() ON CONFLICT(character_id) DO UPDATE SET last_mint=last_mint+1').bind(rollId,userId),
  db.prepare("INSERT INTO cards(anilist_character_id,anilist_media_id,character_name,media_name,image_url,owner_id,rarity,mint_number) SELECT p.character_id,p.media_id,p.name,p.anime,p.image,p.owner_id,p.rarity,m.last_mint FROM pending_rolls p JOIN character_mints m ON m.character_id=p.character_id WHERE p.id=? AND p.owner_id=? AND p.expires_at>unixepoch() RETURNING uid,mint_number").bind(rollId,userId),
  db.prepare("INSERT INTO ledger(user_id,delta,reason,card_uid) SELECT ?,-?,'roll',last_insert_rowid() WHERE changes()>0").bind(userId,p.cost),
  db.prepare('DELETE FROM pending_rolls WHERE id=? AND owner_id=?').bind(rollId,userId)
 ];
 const rs=await db.batch(statements);
 const card=rs[2].results?.[0];
 if(!card)throw new Error('This card was already claimed.');
 // Small free-crate chance after a completed claim.
 if(rand(50)===0)await db.prepare("INSERT INTO crates(owner_id,crate_type,quantity) VALUES(?,'basic',1) ON CONFLICT(owner_id,crate_type) DO UPDATE SET quantity=quantity+1").bind(userId).run();
 return {uid:uid(card.uid),mint:card.mint_number,name:p.name,anime:p.anime,image:p.image,rarity:p.rarity,edition:'Standard',cost:p.cost};
}
async function sell(db,userId,id,priceArg){
 await ensurePlayer(db,userId);
 const old=await db.prepare('SELECT * FROM cards WHERE uid=? AND owner_id=?').bind(id,userId).first();
 if(!old)throw new Error('You do not own '+uid(id)+'.');
 if(priceArg?.toLowerCase()==='cancel'){
  await db.prepare('DELETE FROM listings WHERE card_uid=? AND seller_id=?').bind(id,userId).run();
  return 'Listing cancelled for '+uid(id)+'.';
 }
 if(priceArg){
  const price=Number(priceArg);
  if(!Number.isSafeInteger(price)||price<1||price>1000000000)throw new Error('Price must be 1–1,000,000,000 credits.');
  const rs=await db.prepare('INSERT INTO listings(card_uid,seller_id,price) SELECT uid,owner_id,? FROM cards WHERE uid=? AND owner_id=? ON CONFLICT(card_uid) DO UPDATE SET price=excluded.price,listed_at=unixepoch() RETURNING card_uid')
    .bind(price,id,userId).all();
  if(!rs.results?.length)throw new Error('Card is not yours.');
  return 'Listed '+uid(id)+' for **'+nfmt(price)+' credits**. Use /sell '+uid(id)+' cancel to unlist.';
 }
 const multiplier=await hasBoost(db,userId,'credits')?2:1;
 const payout=Math.max(1,Math.floor((BASE[old.rarity]||20)/4))*multiplier;
 const rs=await db.batch([
  db.prepare('UPDATE players SET credits=credits+? WHERE user_id=? AND EXISTS(SELECT 1 FROM cards WHERE uid=? AND owner_id=?)').bind(payout,userId,id,userId),
  db.prepare('DELETE FROM cards WHERE uid=? AND owner_id=? RETURNING uid').bind(id,userId),
  db.prepare("INSERT INTO ledger(user_id,delta,reason,card_uid) SELECT ?,?,'system_sell',? WHERE changes()>0").bind(userId,payout,id)
 ]);
 if(!rs[1].results?.length)throw new Error('Card has already moved or been sold.');
 return 'Sold '+uid(id)+' to Alya’s for **'+nfmt(payout)+' credits**.';
}
async function purchase(db,userId,id){
 await ensurePlayer(db,userId);
 const listed=await db.prepare('SELECT * FROM listings WHERE card_uid=?').bind(id).first();
 if(listed){
  if(listed.seller_id===userId)throw new Error('You already own this listing.');
  const rs=await db.batch([
   db.prepare('UPDATE players SET credits=credits-(SELECT price FROM listings WHERE card_uid=?) WHERE user_id=? AND EXISTS(SELECT 1 FROM listings WHERE card_uid=? AND seller_id<>?)').bind(id,userId,id,userId),
   db.prepare('UPDATE players SET credits=credits+(SELECT price FROM listings WHERE card_uid=?) WHERE user_id=(SELECT seller_id FROM listings WHERE card_uid=?)').bind(id,id),
   db.prepare('UPDATE cards SET owner_id=? WHERE uid=? AND EXISTS(SELECT 1 FROM listings WHERE card_uid=? AND seller_id=cards.owner_id) RETURNING uid').bind(userId,id,id),
   db.prepare("INSERT INTO ledger(user_id,delta,reason,card_uid) SELECT ?,-price,'market_buy',card_uid FROM listings WHERE card_uid=?").bind(userId,id),
   db.prepare("INSERT INTO ledger(user_id,delta,reason,card_uid) SELECT seller_id,price,'market_sell',card_uid FROM listings WHERE card_uid=?").bind(id),
   db.prepare('DELETE FROM listings WHERE card_uid=?').bind(id)
  ]);
  if(!rs[2].results?.length)throw new Error('That listing was already sold.');
  return 'Bought '+uid(id)+' for **'+nfmt(listed.price)+' credits**! Check /collection.';
 }
 const source=await db.prepare('SELECT * FROM cards WHERE uid=?').bind(id).first();
 if(!source)throw new Error('That UID does not exist.');
 const minPrice=BASE[source.rarity]||20;
 const ref=await db.prepare('SELECT price FROM listings l JOIN cards c ON c.uid=l.card_uid WHERE c.anilist_character_id=? AND c.rarity=? ORDER BY l.price LIMIT 5')
  .bind(source.anilist_character_id,source.rarity).all();
 const prices=(ref.results||[]).map(x=>x.price).filter(x=>x>0).sort((a,b)=>a-b);
 const reference=Math.max(minPrice,prices.length?prices[Math.floor(prices.length/2)]:0);
 const price=reference*4;
 const rs=await db.batch([
  db.prepare('UPDATE players SET credits=credits-? WHERE user_id=?').bind(price,userId),
  db.prepare('INSERT INTO character_mints(character_id,last_mint) VALUES(?,1) ON CONFLICT(character_id) DO UPDATE SET last_mint=last_mint+1').bind(source.anilist_character_id),
  db.prepare("INSERT INTO cards(anilist_character_id,anilist_media_id,character_name,media_name,image_url,owner_id,rarity,mint_number) SELECT ?,?,?,?,?,?,?,last_mint FROM character_mints WHERE character_id=? RETURNING uid,mint_number").bind(source.anilist_character_id,source.anilist_media_id,source.character_name,source.media_name,source.image_url,userId,source.rarity,source.anilist_character_id),
  db.prepare("INSERT INTO ledger(user_id,delta,reason,card_uid) SELECT ?,-?,'system_buy',last_insert_rowid() WHERE changes()>0").bind(userId,price)
 ]);
 const result=rs[2].results?.[0];
 if(!result)throw new Error('Purchase did not complete.');
 return 'Bought a new **'+source.rarity+'** copy of '+source.character_name+' from Alya’s for **'+nfmt(price)+' credits**. New UID: **'+uid(result.uid)+'**, mint '+uid(result.mint_number)+'.';
}
async function openCrate(db,userId,env){
 await ensurePlayer(db,userId);
 const crate=await db.prepare("SELECT quantity FROM crates WHERE owner_id=? AND crate_type='basic'").bind(userId).first();
 if(!crate?.quantity)throw new Error('No basic crates. Rolls have a 2% chance to award one.');
 const ticket=rand(100);
 let text;
 if(ticket<25){ // card
  const c=await randomCharacter('',env), tier=rarity(await hasBoost(db,userId,'luck'));
  const rs=await db.batch([
   db.prepare("UPDATE crates SET quantity=quantity-1 WHERE owner_id=? AND crate_type='basic'").bind(userId),
   db.prepare('INSERT INTO character_mints(character_id,last_mint) VALUES(?,1) ON CONFLICT(character_id) DO UPDATE SET last_mint=last_mint+1').bind(c.characterId),
   db.prepare("INSERT INTO cards(anilist_character_id,anilist_media_id,character_name,media_name,image_url,owner_id,rarity,mint_number) SELECT ?,?,?,?,?,?,?,last_mint FROM character_mints WHERE character_id=? RETURNING uid,mint_number").bind(c.characterId,c.mediaId,c.name,c.anime,c.image,userId,tier,c.characterId)
  ]);
  const card=rs[2].results?.[0];
  text='🎁 **Card reward!** '+c.name+' ('+tier+') · '+uid(card.uid)+' · Mint '+uid(card.mint_number);
 }else if(ticket<60){
  const type=rand(2)?'luck':'credits';
  await db.batch([
   db.prepare("UPDATE crates SET quantity=quantity-1 WHERE owner_id=? AND crate_type='basic'").bind(userId),
   db.prepare('INSERT INTO boosts(owner_id,boost_type,quantity) VALUES(?,?,1) ON CONFLICT(owner_id,boost_type) DO UPDATE SET quantity=quantity+1').bind(userId,type)
  ]);
  text='🎁 **'+type+' boost!** Added to inventory. Use /boosts apply '+type+'.';
 }else{
  const prize=50+rand(451);
  await db.batch([
   db.prepare("UPDATE crates SET quantity=quantity-1 WHERE owner_id=? AND crate_type='basic'").bind(userId),
   db.prepare('UPDATE players SET credits=credits+? WHERE user_id=?').bind(prize,userId),
   db.prepare("INSERT INTO ledger(user_id,delta,reason) VALUES(?,?,'crate')").bind(userId,prize)
  ]);
  text='🎁 You won **'+nfmt(prize)+' credits!**';
 }
 return text;
}
async function boostCommand(db,id,args){
 await ensurePlayer(db,id);
 const bits=args.trim().split(/\s+/);
 if(bits[0]?.toLowerCase()==='apply'){
  const type=bits[1]?.toLowerCase();
  if(!['luck','credits'].includes(type))throw new Error('Use /boosts apply luck or /boosts apply credits.');
  const stock=await db.prepare('SELECT quantity FROM boosts WHERE owner_id=? AND boost_type=?').bind(id,type).first();
  if(!stock?.quantity)throw new Error('You do not own that boost.');
  await db.batch([
   db.prepare('UPDATE boosts SET quantity=quantity-1 WHERE owner_id=? AND boost_type=?').bind(id,type),
   db.prepare('INSERT INTO active_boosts(owner_id,boost_type,expires_at) VALUES(?,?,?) ON CONFLICT(owner_id,boost_type) DO UPDATE SET expires_at=excluded.expires_at')
    .bind(id,type,now()+3600)
  ]);
  return '**'+type+' boost activated for 1 hour.** Luck doubles Rare+ tier weights; credits doubles instant-sell payouts.';
 }
 const [stock,active,crates]=await Promise.all([
  db.prepare('SELECT boost_type,quantity FROM boosts WHERE owner_id=?').bind(id).all(),
  db.prepare('SELECT boost_type,expires_at FROM active_boosts WHERE owner_id=? AND expires_at>unixepoch()').bind(id).all(),
  db.prepare('SELECT crate_type,quantity FROM crates WHERE owner_id=?').bind(id).all()
 ]);
 return '**Boost inventory:** '+((stock.results||[]).map(x=>x.boost_type+' ×'+x.quantity).join(', ')||'empty')+
 '\n**Active:** '+((active.results||[]).map(x=>x.boost_type+' ('+Math.ceil((x.expires_at-now())/60)+'min left)').join(', ')||'none')+
 '\n**Crates:** '+((crates.results||[]).map(x=>x.crate_type+' ×'+x.quantity).join(', ')||'none');
}
async function syncCommands(db,env){
 const cfg=await db.prepare("SELECT value FROM config WHERE key='commands_synced'").first();
 if(cfg && now()-Number(cfg.value)<86400)return;
 await api(env,'PUT','/commands',{commands:COMMANDS,interactions:true});
 await db.prepare("INSERT INTO config(key,value) VALUES('commands_synced',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(now())).run();
}
async function handleCommand(ev,env){
 const data=ev.data, db=env.DB, id=String(data.user_id||data.author_id||''), ch=data.channel_id;
 if(!id||!ch)return;
 const name=String(data.command||'').replace(/^\//,'').toLowerCase();
 const args=String(data.args||'').trim();
 try{
  let result, embeds, components;
  if(name==='roll'){
   const animation=await reply(ev,env,{content:'🎲 **Alya’s is shuffling the cards...** ✦'});
   const msgId=animation?.message?.id||animation?.id||null;
   if(msgId){
    await new Promise(done=>setTimeout(done,420));
    try{await api(env,'PATCH','/channels/'+encodeURIComponent(ch)+'/messages/'+encodeURIComponent(msgId),{content:'✨ **A card is emerging from the deck...** 🌌'})}catch{}
   }
   try{
    const candidate=await reserveRoll(db,id,args,env);
    if(msgId){
     try{await api(env,'PATCH','/channels/'+encodeURIComponent(ch)+'/messages/'+encodeURIComponent(msgId),{content:'💫 **Revealing the card and its rarity...**'})}catch{}
     await new Promise(done=>setTimeout(done,500));
    }
    if(args){
     const fields={...candidate,uid:'UNMINTED',mint:0};
     embeds=[cardEmbed(fields,'Preview • '+nfmt(candidate.cost)+' credits to keep • expires in 15 min')];
     // Preview cards have no UID or mint until the user pays.
     embeds[0].fields=[{name:'Status',value:'Preview only',inline:true},
      {name:'Rarity',value:candidate.rarity,inline:true},{name:'Keep price',value:nfmt(candidate.cost)+' credits',inline:true}];
     components=[{type:'row',components:[
      {type:'button',style:'success',label:'Keep (100× cost)',custom_id:'keep:'+candidate.id},
      {type:'button',style:'secondary',label:'Discard',custom_id:'discard:'+candidate.id}
     ]}];
     result='✨ **You rolled from '+candidate.anime+'!** Keep it for '+nfmt(candidate.cost)+' credits.';
    }else{
     const card=await claim(db,candidate.id,id);
     embeds=[cardEmbed(card,'Automatically added to your collection • Cost: 10 credits')];
     result='✨ **New card!** '+card.name+' · '+card.rarity.toUpperCase()+' · '+card.uid;
    }
   }catch(e){result='❌ '+errMsg(e);embeds=[];components=[];}
   await editOrSend(env,ch,msgId,{content:result,embeds,components});return;
  }
  if(name==='credits'){
   const p=await ensurePlayer(db,id);
   result='💳 You have **'+nfmt(p.credits)+' credits**.';
  }else if(name==='collection'){
   await ensurePlayer(db,id);
   const rs=await db.prepare('SELECT uid,character_name,rarity,mint_number FROM cards WHERE owner_id=? ORDER BY uid DESC LIMIT 20').bind(id).all();
   result='📚 **Your collection**\n'+((rs.results||[]).map(c=>uid(c.uid)+' · '+c.character_name+' · '+c.rarity+' · mint '+uid(c.mint_number)).join('\n')||'Empty! Try /roll.');
  }else if(name==='card'){
   const c=await db.prepare('SELECT * FROM cards WHERE uid=?').bind(intId(args)).first();
   if(!c)throw new Error('Card not found.');
   embeds=[cardEmbed(c,'Card details • Owned by '+c.owner_id)];
   result='**'+uid(c.uid)+'** • '+c.character_name;
  }else if(name==='market'){
   const rs=await db.prepare('SELECT l.card_uid,l.price,c.character_name,c.rarity FROM listings l JOIN cards c ON c.uid=l.card_uid ORDER BY l.listed_at DESC LIMIT 20').all();
   result='🛒 **Market listings**\n'+((rs.results||[]).map(c=>uid(c.card_uid)+' · '+c.character_name+' ('+c.rarity+') · **'+nfmt(c.price)+' credits**').join('\n')||'No listings yet.')+'\nBuy with /buy UID.';
  }else if(name==='sell'){
   const [idText,priceText]=args.split(/\s+/);
   const cardId=intId(idText);if(!cardId)throw new Error('Use /sell UID [PRICE] or /sell UID cancel.');
   result=await sell(db,id,cardId,priceText);
  }else if(name==='buy'){
   const cardId=intId(args.split(/\s+/)[0]);if(!cardId)throw new Error('Use /buy UID.');
   result=await purchase(db,id,cardId);
  }else if(name==='boosts'){
   result=await boostCommand(db,id,args);
  }else if(name==='open'){
   result=await openCrate(db,id,env);
  }else return;
  await reply(ev,env,{content:result,embeds,components});
 }catch(e){
  try{await reply(ev,env,{content:'❌ '+errMsg(e),ephemeral:true})}
  catch(err){console.error('Yapin reply failure',String(err))}
 }
}
async function handleButton(ev,env){
 const data=ev.data, custom=String(data.custom_id||''), id=String(data.user_id||'');
 const [action,pid]=custom.split(':');
 if(!['keep','discard'].includes(action)||!pid)return;
 const p=await env.DB.prepare('SELECT owner_id,expires_at FROM pending_rolls WHERE id=?').bind(pid).first();
 if(!p||p.expires_at<now()){
  await reply(ev,env,{content:'This roll has already expired or been claimed.',ephemeral:true});return;
 }
 if(p.owner_id!==id){await reply(ev,env,{content:'Only the roller can keep or discard this card.',ephemeral:true});return;}
 if(action==='discard'){
  await env.DB.prepare('DELETE FROM pending_rolls WHERE id=? AND owner_id=?').bind(pid,id).run();
  await reply(ev,env,{content:'Card discarded. No credits spent.',ephemeral:true});return;
 }
 // Button interaction must be acknowledged within three seconds.
 await api(env,'POST','/interactions/'+encodeURIComponent(data.id)+'/'+encodeURIComponent(data.token)+'/callback',
  {type:'ack'});
 try{
  const card=await claim(env.DB,pid,id);
  await send(env,data.channel_id,{content:'✅ <@'+id+'> kept their card! **'+card.uid+'**',
   embeds:[cardEmbed(card,'Added to collection • '+nfmt(card.cost)+' credits spent')]});
 }catch(e){await send(env,data.channel_id,{content:'❌ <@'+id+'> '+errMsg(e)})}
}
async function processEvent(ev,env){
 try{
  await syncCommands(env.DB,env);
  const type=ev.event||ev.type, data=ev.data||{};
  if(type==='command')return await handleCommand(ev,env);
  if(type==='message'&&data.command&&(!data.command_for||data.command_for===env.YAPIN_BOT_ID))
   return await handleCommand(ev,env);
  if(type==='interaction'&&data.type==='button')return await handleButton(ev,env);
 }catch(e){console.error('Event processing failed',String(e))}
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/health'))
   return Response.json({name:"Alya's",service:'Yapin bot',status:'running',
    configured:!!(env.YAPIN_BOT_TOKEN&&env.YAPIN_WEBHOOK_SECRET),commands:COMMANDS.map(x=>x.name)});
  if(url.pathname!=='/webhook'||request.method!=='POST')return new Response('Not found',{status:404});
  if(!env.YAPIN_WEBHOOK_SECRET||!env.YAPIN_BOT_TOKEN)return new Response('Bot credentials not configured',{status:503});
  const raw=await request.text();
  if(raw.length>128000)return new Response('Too large',{status:413});
  if(!await verifySignature(env.YAPIN_WEBHOOK_SECRET,raw,request.headers.get('X-Yapper-Signature')))
   return new Response('Invalid signature',{status:401});
  if(env.YAPIN_BOT_ID && request.headers.get('X-Yapper-Bot')!==env.YAPIN_BOT_ID)
   return new Response('Wrong bot',{status:403});
  let event;try{event=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400})}
  if(event?.id===undefined||!event?.event)return new Response('Invalid event',{status:400});
  const saved=await env.DB.prepare("INSERT OR IGNORE INTO events(event_id,status) VALUES(?,'received') RETURNING event_id")
   .bind(String(event.id)).first();
  if(saved)ctx.waitUntil(processEvent(event,env).then(()=>env.DB.prepare("UPDATE events SET status='completed' WHERE event_id=?").bind(String(event.id)).run())
   .catch(async e=>{console.error(e);await env.DB.prepare("UPDATE events SET status='failed' WHERE event_id=?").bind(String(event.id)).run()}));
  return new Response('ok',{status:200});
 }
};
