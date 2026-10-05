export function validateUgcDraft(value){
 if(!value||typeof value!=='object')throw Error('Enter your campaign details.');
 const data={};
 for(const [key,max] of [['title',100],['product',120],['script',3000]]){
  if(typeof value[key]!=='string'||value[key].length>max)throw Error(`Check the ${key} field.`);
  data[key]=value[key].trim();
 }
 if(!data.title)throw Error('Give your draft a name.');
 for(const [key,values] of Object.entries({mode:['product','presenter'],language:['id','en'],style:['natural','cinematic','studio'],ratio:['9:16','1:1','16:9']})){
  if(!values.includes(value[key]))throw Error(`Choose a supported ${key}.`);data[key]=value[key];
 }
 if(![5,10,15].includes(value.duration))throw Error('Choose a target duration.');data.duration=value.duration;
 if(typeof value.rights!=='boolean')throw Error('Check the image permission setting.');data.rights=value.rights;
 const image=value.image??'';
 if(typeof image!=='string'||image.length>220000||(image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)))throw Error('Choose a JPEG or PNG image using the upload control.');
 if(image&&!image.startsWith('data:image/jpeg;base64,/9j/'))throw Error('Invalid image reference.');
 data.image=image;
 if(value.scenes!==undefined){
  if(!Array.isArray(value.scenes)||value.scenes.length>8)throw Error('Use up to eight storyboard scenes.');
  data.scenes=value.scenes.map(scene=>{
   if(!scene||typeof scene!=='object')throw Error('Check the storyboard scene.');
   const clean={};for(const [key,max] of [['title',60],['visual',300],['narration',350]]){if(typeof scene[key]!=='string'||scene[key].length>max)throw Error('Check the scene '+key+'.');clean[key]=scene[key].trim();}
   if(!Number.isInteger(scene.seconds)||scene.seconds<1||scene.seconds>15)throw Error('Scene duration must be 1 to 15 seconds.');
   return {...clean,seconds:scene.seconds};
  });
  if(data.scenes.reduce((sum,scene)=>sum+scene.seconds,0)>60)throw Error('Keep the storyboard within 60 seconds.');
 }

 if(JSON.stringify(data).length>225000)throw Error('The draft is too large. Use a smaller reference image or shorter script.');
 return data;
}
