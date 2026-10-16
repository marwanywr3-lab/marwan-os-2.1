const names={'claude-haiku-5-5':'Claude Haiku 5.5','gemini-3.5-flash-lite':'Gemini 3.5 Flash-Lite','gemini-3.8-flash':'Gemini 3.8 Flash'};
const errors={UNSUPPORTED_API_KEY:'لم نتعرف على المفتاح. أدخل مفتاح Gemini الذي يبدأ بـ AIza أو Claude الذي يبدأ بـ sk-ant-.',INVALID_API_KEY:'المفتاح غير صحيح أو غير مسموح له بالوصول إلى واجهة المزوّد.',API_KEY_CHECK_TIMEOUT:'تأخر التحقق لدى المزوّد. أعد المحاولة.',PROVIDER_RATE_LIMIT:'بلغت حد الطلبات لدى المزوّد. حاول لاحقًا.',KEY_CHECK_RATE_LIMIT:'تحققت من مفاتيح كثيرة. حاول لاحقًا.',PROVIDER_UNAVAILABLE:'خدمة المزوّد غير متاحة الآن.',PROVIDER_NOT_CONFIGURED:'أضف مفتاح API من الإعدادات أولًا.',MODEL_NOT_AVAILABLE_FOR_KEY:'هذا النموذج غير متاح للمفتاح الحالي. راجع الإعدادات.',SELECT_CONFIGURED_MODEL:'اختر نموذجًا من الإعدادات.',DATABASE_ERROR:'تعذر حفظ إعدادات المساعد. أعد المحاولة.',UNAUTHORIZED:'أعد تسجيل الدخول.',PROVIDER_ERROR:'تعذر توليد الإجابة لدى المزوّد. تحقق من صلاحية المفتاح والرصيد.',DAILY_LIMIT_REACHED:'وصلت إلى حد الطلبات اليومي.',TIMEOUT:'استغرق الطلب وقتًا طويلًا. حاول لاحقًا.'};
export function detectKeyProvider(key){return key.startsWith('sk-ant-')?'claude':key.startsWith('AIza')?'gemini':null;}
export async function invokeAI(db,body){
 const r=await db.functions.invoke('marwan-ai',{body});
 if(r.error){let code;try{code=(await r.error.context?.json())?.error}catch{}throw new Error(errors[code]||'تعذر الاتصال بخدمة المساعد. أعد المحاولة.');}
 if(r.data?.error)throw new Error(errors[r.data.error]||'تعذر إتمام طلب المساعد.');
 return r.data;
}
export async function mountAIKeySettings({db,container,select,status,onChanged}){
 container.innerHTML='<h2>مفتاح الذكاء الاصطناعي</h2><p class="muted">ألصق مفتاحك؛ نكتشف المزوّد ونتحقق منه تلقائيًا عند الحفظ. يُحفظ مشفّرًا في حسابك، ولا يظهر كاملًا بعد الحفظ.</p><form id="api-key-form"><label>مفتاح API<input id="api-key" type="password" dir="ltr" autocomplete="off" spellcheck="false" maxlength="512" required placeholder="AIza… أو sk-ant-…"></label><p id="detected-provider" role="status" class="muted"></p><button type="submit" class="primary">التحقق وحفظ المفتاح</button></form><p id="saved-provider" class="muted"></p><p id="api-key-result" role="status"></p><button id="delete-api-key" type="button" class="danger" hidden>حذف المفتاح المحفوظ</button>';
 const form=container.querySelector('form'),input=container.querySelector('#api-key'),result=container.querySelector('#api-key-result'),remove=container.querySelector('#delete-api-key'),submit=form.querySelector('button'),saved=container.querySelector('#saved-provider');
 let busy=false;
 function paint(caps){
  if(!container.isConnected)return;
  const options=caps.provider==='claude'?['claude-haiku-5-5']:caps.provider==='gemini'?['gemini-3.5-flash-lite','gemini-3.8-flash']:[];
  select.replaceChildren();
  if(!options.length)select.add(new Option('أضف مفتاح API أولًا',''));
  for(const id of options){const option=new Option(names[id]+(caps.available.includes(id)?'':' — غير متاح لهذا المفتاح'),id);option.disabled=!caps.available.includes(id);select.add(option);}
  select.value=caps.selected&&caps.available.includes(caps.selected)?caps.selected:caps.available[0]||'';
  select.disabled=caps.provider==='claude'||!caps.available.length;
  select.dataset.ready='true';
  status.textContent=!caps.provider?'أضف المفتاح للتحقق من النماذج.':caps.available.length?(caps.provider==='claude'?'اختير Claude Haiku 5.5 تلقائيًا.':'اختر Gemini 3.5 Flash-Lite أو Gemini 3.8 Flash من النماذج المتاحة، ثم احفظ الإعدادات.'):'المفتاح صحيح، لكن النماذج المطلوبة غير متاحة له حاليًا. لن نستخدم نموذجًا آخر تلقائيًا.';
  saved.textContent=caps.provider?'المزوّد المحفوظ: '+(caps.provider==='claude'?'Claude':'Gemini')+' · المفتاح: ••••'+caps.keyHint:'';
  remove.hidden=!caps.provider;
 }
 input.addEventListener('input',()=>{const provider=detectKeyProvider(input.value.trim());container.querySelector('#detected-provider').textContent=provider?'المزوّد المكتشف: '+(provider==='claude'?'Claude · Haiku 5.5 تلقائيًا':'Gemini · اختيار بين 3.5 Flash-Lite و3.8 Flash'):input.value?'لم نتعرف على نوع المفتاح بعد.':'';});
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;submit.disabled=true;remove.disabled=true;result.textContent='جارٍ التحقق من المفتاح والنماذج لدى المزوّد…';try{const caps=await invokeAI(db,{action:'set_api_key',api_key:input.value.trim()});input.value='';container.querySelector('#detected-provider').textContent='';await onChanged();paint(caps);result.textContent=caps.available.length?'تم التحقق وحفظ المفتاح.':'حُفظ المفتاح، لكن النماذج المطلوبة غير متاحة له.';}catch(e){result.textContent=e.message;}finally{busy=false;submit.disabled=false;remove.disabled=false;}};
 remove.onclick=async()=>{if(busy||!confirm('حذف مفتاح API من حسابك؟'))return;busy=true;submit.disabled=true;remove.disabled=true;try{const caps=await invokeAI(db,{action:'delete_api_key'});await onChanged();paint(caps);result.textContent='تم حذف المفتاح.';}catch(e){result.textContent=e.message;}finally{busy=false;submit.disabled=false;remove.disabled=false;}};
 submit.disabled=true;
 try{paint(await invokeAI(db,{action:'capabilities'}));}catch(e){if(!container.isConnected)return;status.textContent=e.message;select.dataset.ready='false';}
 finally{submit.disabled=false;}
}
