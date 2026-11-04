const ENDPOINT='https://graphql.anilist.co';
const QUERY=`query($page:Int,$search:String,$id:Int){ Page(page:$page,perPage:25){pageInfo{lastPage} media(type:ANIME,search:$search,id:$id,sort:POPULARITY_DESC){id title{romaji english} characters(perPage:25,sort:ROLE){nodes{id name{full} image{large}}}}}}`;
async function graphql(variables) {
  const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables})});
  if(!r.ok)throw new Error('AniList temporarily unavailable ('+r.status+')');
  const data=await r.json();
  if(data.errors?.length)throw new Error('AniList rejected the query');
  return data.data.Page;
}
export async function randomCharacter(anime='') {
  // Sampling across popular anime pages, not uniform across the entire AniList catalogue.
  // This intentionally avoids expensive catalogue imports and respects upstream API limits.
  const search=anime.trim()||undefined;
  const first=await graphql({page:1,search});
  const last=Math.max(1,Math.min(first.pageInfo?.lastPage||1,search?4:100));
  for(let attempt=0;attempt<4;attempt++){
    const page=attempt===0?first:await graphql({page:1+Math.floor(Math.random()*last),search});
    const media=(page.media||[]).filter(x=>x.characters?.nodes?.some(y=>y?.image?.large));
    if(!media.length)continue;
    const show=media[Math.floor(Math.random()*media.length)];
    const characters=show.characters.nodes.filter(y=>y?.id&&y.image?.large);
    const character=characters[Math.floor(Math.random()*characters.length)];
    return {characterId:character.id,mediaId:show.id,name:character.name.full,anime:show.title.english||show.title.romaji,image:character.image.large};
  }
  throw new Error('No eligible anime characters found. Try another anime name.');
}
