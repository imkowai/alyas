// Integer weights in units of 10^-11 percentage points.
// Sampling uses rejection sampling over secure random 32-bit chunks.
export const TIERS = Object.freeze([
  ['common', '55'],
  ['uncommon', '25'],
  ['rare', '15'],
  ['epic', '4.5'],
  ['mythic', '0.49'],
  ['legendary', '0.019'],
  ['godly', '0.0019'],
  ['astral', '0.00019'],
  ['perplexed', '0.000019'],
  ['blessed', '0.0000019'],
  ['peak', '0.00000019'],
  ['insane', '0.000000019'],
  ['fury', '0.0000000019'],
  ['honoured', '0.00000000019'],
  ['truthful', '0.000000000019'],
]);
const SCALE=100000000000000n; // 10^12 per percentage point
export function weights() {
  return TIERS.map(([name, percent]) => {
    const [whole, frac=''] = percent.split('.');
    return {name, weight:BigInt(whole)*SCALE+BigInt(frac.padEnd(12,'0'))};
  });
}
function randomBelow(max) {
  const bits=max.toString(2).length;
  const bytes=Math.ceil(bits/8);
  const range=1n<<BigInt(bytes*8);
  const cutoff=range-range%max;
  for (;;) {
    const data=new Uint8Array(bytes);
    crypto.getRandomValues(data);
    let n=0n;
    for (const b of data) n=(n<<8n)|BigInt(b);
    if(n<cutoff) return n%max;
  }
}
export function rollTier() {
  const ws=weights(), total=ws.reduce((a,b)=>a+b.weight,0n);
  const ticket=randomBelow(total);
  let cumulative=0n;
  for(const item of ws){ cumulative+=item.weight; if(ticket<cumulative)return item.name; }
  throw new Error('Invalid tier weights');
}
