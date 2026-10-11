/** Output-time motion; the native renderer uses the same bounded curves. */
export const motionPresets = [
 {id:'none',name:'Original',description:'Keep the camera still.'},
 {id:'opening',name:'Hook focus',description:'A gentle punch-in during the first three seconds, then settle.'},
 {id:'subtle',name:'Slow drift',description:'A smooth eight-second push and release.'},
 {id:'rhythm',name:'Editorial rhythm',description:'Alternate close and wide framing every four seconds.'},
];
export function motionScale(mode,time,amount=.1){
 const t=Math.max(0,time),a=Math.max(.04,Math.min(.16,Number.isFinite(amount)?amount:.1));
 if(mode==='opening')return 1+a*Math.max(0,1-t/3);
 if(mode==='subtle')return 1+a*(1-Math.cos(t*Math.PI/4))/2;
 if(mode==='rhythm')return 1+a*(Math.floor(t/4)%2);
 return 1;
}
