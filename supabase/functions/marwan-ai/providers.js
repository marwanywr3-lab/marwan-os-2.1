export const MODELS=['claude-haiku-5-5','gemini-3.5-flash-lite','gemini-3.8-flash'];
export function detectProvider(key){return typeof key==='string'&&key.startsWith('sk-ant-')?'claude':typeof key==='string'&&key.startsWith('AIza')?'gemini':null;}
export function resolveModels(provider,entries){
 const result={};
 for(const model of MODELS.filter(m=>provider==='claude'?m.startsWith('claude'):m.startsWith('gemini'))){
  const list=entries.filter(e=>provider==='claude'||e.supportedGenerationMethods?.includes('generateContent'));
  const ids=list.map(e=>provider==='claude'?e.id:e.name?.replace(/^models\//,''));
  const id=ids.find(id=>id===model)||ids.find(id=>typeof id==='string'&&new RegExp('^'+model.replaceAll('.','\\.')+'-\\d{8}$').test(id));
  if(id)result[model]=id;
 }
 return result;
}
export async function inspectKey(key,fetcher=fetch){
 key=typeof key==='string'?key.trim():'';
 const provider=detectProvider(key);
 if(!provider||key.length<20||key.length>512||/\s/.test(key))throw new Error('UNSUPPORTED_API_KEY');
 const entries=[];let page='';
 for(let i=0;i<5;i++){
  const url=provider==='claude'?'https://api.anthropic.com/v1/models?limit=100'+(page?'&after_id='+encodeURIComponent(page):''):'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'+(page?'&pageToken='+encodeURIComponent(page):'');
  const headers=provider==='claude'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{'x-goog-api-key':key};
  let response;try{response=await fetcher(url,{headers,signal:AbortSignal.timeout(12000)})}catch{throw new Error('API_KEY_CHECK_TIMEOUT')}
  if(!response.ok)throw new Error(response.status===401||response.status===403||response.status===400?'INVALID_API_KEY':response.status===429?'PROVIDER_RATE_LIMIT':'PROVIDER_UNAVAILABLE');
  const data=await response.json();entries.push(...(provider==='claude'?data.data||[]:data.models||[]));
  page=provider==='claude'?(data.has_more?data.last_id:''):data.nextPageToken||'';
  if(!page)break;
 }
 const modelMap=resolveModels(provider,entries);
 return {provider,key,modelMap};
}
