// Stage 1, Floor 1 maze generation ported from the original browser game.
// Coordinates are tile-based; 0 = walkable, 1 = wall.
export const TILE = 32;
export const COLS = 31;
export const ROWS = 21;
export function buildMaze(seed = 1709, extraLoops = 0.16) {
  let value = seed | 0;
  const rand = () => { value = (Math.imul(1664525,value)+1013904223)|0; return (value>>>0)/4294967296; };
  const grid = Array.from({length:ROWS},()=>Array(COLS).fill(1));
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const shuffle = arr => {
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  };
  const carve=(x,y)=>{
    if(x<1||y<1||x>=COLS-1||y>=ROWS-1)return;
    grid[y][x]=0;
  };
  const stack=[[1,1]];carve(1,1);
  while(stack.length){
    const [x,y]=stack[stack.length-1];
    const options=shuffle(dirs.map(([dx,dy])=>({x:x+2*dx,y:y+2*dy,mx:x+dx,my:y+dy})))
      .filter(p=>p.x>0&&p.y>0&&p.x<COLS-1&&p.y<ROWS-1&&grid[p.y][p.x]===1);
    if(!options.length){stack.pop();continue;}
    const n=options[0];carve(n.mx,n.my);carve(n.x,n.y);stack.push([n.x,n.y]);
  }
  for(let y=2;y<ROWS-2;y++)for(let x=2;x<COLS-2;x++){
    if(grid[y][x]!==1)continue;
    const horizontal=grid[y][x-1]===0&&grid[y][x+1]===0;
    const vertical=grid[y-1][x]===0&&grid[y+1][x]===0;
    if((horizontal||vertical)&&rand()<extraLoops*.65)carve(x,y);
  }
  const roomCount=3+Math.floor(rand()*3),rooms=[];
  for(let attempt=0;attempt<85&&rooms.length<roomCount;attempt++){
    const w=3+Math.floor(rand()*2),h=3+Math.floor(rand()*2);
    const x=2+Math.floor(rand()*(COLS-w-4));
    const y=2+Math.floor(rand()*(ROWS-h-4));
    if(x<5&&y<5)continue;
    if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
    rooms.push({x,y,w,h});
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)carve(xx,yy);
    if(rand()<.55){
      const side=Math.floor(rand()*4);
      const ax=side===0?x-1:side===1?x+w:x+Math.floor(w/2);
      const ay=side===2?y-1:side===3?y+h:y+Math.floor(h/2);
      carve(ax,ay);
    }
  }
  for(let i=0;i<12;i++){
    const x=2+Math.floor(rand()*(COLS-4)),y=2+Math.floor(rand()*(ROWS-4));
    if(grid[y][x]!==1)continue;
    const open=dirs.filter(([dx,dy])=>grid[y+dy][x+dx]===0).length;
    if(open>=2&&rand()<.45)carve(x,y);
  }
  for(let pass=0;pass<2;pass++){
    const singles=[];
    for(let y=2;y<ROWS-2;y++)for(let x=2;x<COLS-2;x++){
      if(grid[y][x]!==1)continue;
      if(dirs.every(([dx,dy])=>grid[y+dy][x+dx]===0))singles.push([x,y]);
    }
    for(const [x,y] of singles)carve(x,y);
  }
  return grid;
}
export function canOccupy(grid,x,y,radius=10) {
  // A circle must not intersect a neighboring wall tile.
  for(let row=Math.floor((y-radius)/TILE);row<=Math.floor((y+radius)/TILE);row++){
    for(let col=Math.floor((x-radius)/TILE);col<=Math.floor((x+radius)/TILE);col++){
      if(grid[row]?.[col] === 0)continue;
      const nearestX=Math.max(col*TILE,Math.min(x,(col+1)*TILE));
      const nearestY=Math.max(row*TILE,Math.min(y,(row+1)*TILE));
      if((x-nearestX)**2+(y-nearestY)**2<radius**2)return false;
    }
  }
  return true;
}
