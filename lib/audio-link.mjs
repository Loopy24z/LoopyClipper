export function audioLink(value){
 let u;try{u=new URL(value)}catch{throw Error('Paste a valid HTTPS link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2000)throw Error('Use a public HTTPS link without credentials or a custom port.');
 const host=u.hostname.toLowerCase();
 const sites=['youtube.com','youtu.be','tiktok.com','instagram.com','facebook.com','fb.watch','x.com','twitter.com','soundcloud.com'];
 if(sites.some(h=>host===h||host.endsWith('.'+h)))return {kind:'social',url:u.href};
 if(/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(u.pathname)&&!['localhost','localhost.localdomain'].includes(host)&&!/^\[|^\d+(?:\.\d+)*$/.test(host))return {kind:'direct',url:u.href};
 throw Error('Use YouTube, TikTok, Instagram, Facebook, X, SoundCloud, or a direct audio-file URL.');
}
