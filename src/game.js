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
  // Do not mint until credit deduction, mint allocation and ownership insertion
  // can be committed atomically with an idempotent Yapin interaction ID.
  // A multi-query implementation without a transaction could charge users
  // without issuing a card or duplicate mints under concurrent rolls.
  throw new Error('Roll persistence is not enabled until atomic purchase handling is configured');

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
