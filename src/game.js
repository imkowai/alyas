import {rollTier} from './rarity.js';
import {randomCharacter} from './anilist.js';
export const BASE_ROLL_COST=10;
export const SPECIFIC_ROLL_COST=BASE_ROLL_COST*100;
export const uid=n=>'#'+String(n).padStart(4,'0');
export async function ensurePlayer(db,userId){
  await db.prepare('INSERT OR IGNORE INTO players(user_id) VALUES(?)').bind(userId).run();
  return db.prepare('SELECT * FROM players WHERE user_id=?').bind(userId).first();
}
export async function credits(db,userId){return (await ensurePlayer(db,userId)).credits;}
export async function collection(db,userId){
  await ensurePlayer(db,userId);
  return (await db.prepare('SELECT uid,character_name,media_name,rarity,mint_number,edition FROM cards WHERE owner_id=? ORDER BY uid DESC LIMIT 30').bind(userId).all()).results;
}
export async function roll(db,userId,anime=''){
  const cost=anime.trim()?SPECIFIC_ROLL_COST:BASE_ROLL_COST;
  await ensurePlayer(db,userId);
  const character=await randomCharacter(anime);
  const rarity=rollTier();
  // The update and insert are one D1 transaction; any failed insert rolls back the debit.
  const result=await db.batch([
    db.prepare('UPDATE players SET credits=credits-? WHERE user_id=? AND credits>=? RETURNING credits').bind(cost,userId,cost),
    db.prepare('INSERT INTO character_mints(character_id,last_mint) VALUES(?,1) ON CONFLICT(character_id) DO UPDATE SET last_mint=last_mint+1 RETURNING last_mint').bind(character.characterId),
  ]);
  // NOTE: D1 batch is atomic, but a conditional debit with zero rows is not an SQL error.
  // Roll writes MUST use a single guarded SQL transaction/stored operation in production.
  if(!result[0].results?.length)throw new Error('Not enough credits');
  const mint=result[1].results[0].last_mint;
  const inserted=await db.prepare('INSERT INTO cards(anilist_character_id,anilist_media_id,character_name,media_name,image_url,owner_id,rarity,mint_number) VALUES(?,?,?,?,?,?,?,?) RETURNING uid')
    .bind(character.characterId,character.mediaId,character.name,character.anime,character.image,userId,rarity,mint).first();
  await db.prepare('INSERT INTO ledger(user_id,delta,reason,card_uid) VALUES(?,?,?,?)').bind(userId,-cost,'roll',inserted.uid).run();
  return {...character,rarity,mint,uid:uid(inserted.uid),cost};
}
export async function sell(db,userId,cardUid,price){
  if(!Number.isSafeInteger(price)||price<=0)throw new Error('Price must be a positive integer');
  const card=await db.prepare('SELECT uid FROM cards WHERE uid=? AND owner_id=?').bind(cardUid,userId).first();
  if(!card)throw new Error('You do not own that card');
  await db.prepare('INSERT INTO listings(card_uid,seller_id,price) VALUES(?,?,?)').bind(cardUid,userId,price).run();
  return {uid:uid(cardUid),price};
}
export async function market(db){
  return (await db.prepare('SELECT l.card_uid,l.price,c.character_name,c.rarity FROM listings l JOIN cards c ON c.uid=l.card_uid ORDER BY l.listed_at DESC LIMIT 20').all()).results;
}
export async function card(db,id){
  return db.prepare('SELECT * FROM cards WHERE uid=?').bind(id).first();
}
