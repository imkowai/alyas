import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnimeTitle,resolveAnimeQuery,rankAnimeMatches} from '../worker.js';

const show=(canonicalTitle,english=canonicalTitle,abbreviatedTitles=[])=>({
 attributes:{canonicalTitle,titles:{en:english},abbreviatedTitles}
});
const alya='Alya Sometimes Hides Her Feelings in Russian';

test('recognizes Alya, Roshidere and title punctuation',()=>{
 assert.equal(resolveAnimeQuery('Alya').query,alya);
 assert.equal(resolveAnimeQuery('Roshidere').query,alya);
 assert.equal(resolveAnimeQuery('"Alya"').query,alya);
 assert.equal(resolveAnimeQuery('alya anime').query,alya);
 assert.equal(normalizeAnimeTitle('Re:ZERO – Starting Life!'),'re zero starting life');
});

test('maps popular abbreviations to the correct anime',()=>{
 const values={
  JJK:'Jujutsu Kaisen',MHA:'My Hero Academia',AOT:'Attack on Titan',
  KNY:'Demon Slayer: Kimetsu no Yaiba',FMAB:'Fullmetal Alchemist: Brotherhood',
  COTE:'Classroom of the Elite',Bocchi:'Bocchi the Rock!',
  ReZero:'Re:Zero',Kaguya:'Kaguya-sama: Love is War',
  OPM:'One Punch Man',NGNL:'No Game No Life',SAO:'Sword Art Online'
 };
 for(const [short,long] of Object.entries(values))
  assert.equal(resolveAnimeQuery(short).query,long,short);
});

test('supports sequel seasons without overriding the original',()=>{
 assert.equal(resolveAnimeQuery('Alya Season 2').query,alya+' Season 2');
 assert.equal(resolveAnimeQuery('Alya S2').query,alya+' Season 2');
 assert.equal(resolveAnimeQuery('Alya2').query,alya+' Season 2');
 assert.equal(resolveAnimeQuery('JJK2').query,'Jujutsu Kaisen Season 2');
 const candidates=[
  show('Tokidoki Bosotto Russia-go de Dereru Tonari no Alya-san Season 2',alya+' Season 2'),
  show('Tokidoki Bosotto Russia-go de Dereru Tonari no Alya-san',alya)
 ];
 assert.equal(rankAnimeMatches(candidates,resolveAnimeQuery('Alya'))[0],candidates[1]);
 assert.equal(rankAnimeMatches(candidates,resolveAnimeQuery('Alya Season 2'))[0],candidates[0]);
});

test('does not select unrelated anime when Kitsu full-text search goes wrong',()=>{
 const unrelated=[show('Zoids Genesis'),show('Pokemon'),show('Dragon Ball')];
 assert.deepEqual(rankAnimeMatches(unrelated,resolveAnimeQuery('ReZero')),[]);
});

test('matches English and Japanese catalogue titles and abbreviations',()=>{
 const shows=[
  show('Jujutsu Kaisen Season 2','Jujutsu Kaisen Season 2',['JJK2']),
  show('Jujutsu Kaisen','Jujutsu Kaisen',['Sorcery Fight']),
  show('Tokidoki Bosotto Russiago de Dereru Tonari no Alya-san',alya,['Roshidere'])
 ];
 assert.equal(rankAnimeMatches(shows,resolveAnimeQuery('JJK'))[0],shows[1]);
 assert.equal(rankAnimeMatches(shows,resolveAnimeQuery('Roshidere'))[0],shows[2]);
});
