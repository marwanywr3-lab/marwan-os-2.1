// Access codes are bearer credentials. Never persist or log their plaintext.
export function createAuthUI({db,root,onReady,setHold,onError}) {
 const messages={RATE_LIMITED:'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',INVALID_CODE:'رمز الدخول غير صحيح أو تم استبداله.',SIGNUP_UNAVAILABLE:'تعذر إنشاء الحساب. إذا سجلت بهذا البريد سابقًا، استخدم الدخول بالبريد وكلمة المرور.',INVALID_SIGNUP:'أدخل بريدًا صحيحًا وكلمة مرور بين 12 و128 حرفًا.',UNAUTHORIZED:'أعد تسجيل الدخول أولًا.',SERVER_ERROR:'تعذر الاتصال بخدمة الحسابات. أعد المحاولة.'};
 async function request(body,token){
  const cfg=window.MARWAN_CONFIG;
  const response=await fetch(cfg.supabaseUrl+'/functions/v1/access-code-auth',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>({error:'SERVER_ERROR'}));
  if(!response.ok||data.error)throw new Error(messages[data.error]||messages.SERVER_ERROR);
  return data;
 }
 function savedCode(code,complete){
  root.innerHTML=`<main class="auth card"><div class="brand">Marwan OS</div><h1>احفظ رمز دخولك</h1><p>ستدخل لاحقًا بهذا الرمز وحده، دون بريد أو رسالة تحقق. يظهر هنا مرة واحدة؛ احفظه في مكان خاص. من يملك الرمز يستطيع دخول حسابك.</p><label>رمز الدخول<textarea id="access-code" dir="ltr" readonly spellcheck="false" autocomplete="off"></textarea></label><div class="toolbar"><button type="button" id="copy-code">نسخ الرمز</button><button type="button" id="download-code">تنزيل الرمز</button></div><label><input id="saved-code" type="checkbox"> حفظت رمز الدخول في مكان آمن</label><p id="code-error" role="status"></p><button type="button" class="primary" id="continue-code" disabled>دخول مساحتي</button></main>`;
  const box=root.querySelector('#access-code');box.value=code;
  root.querySelector('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(code);root.querySelector('#code-error').textContent='تم نسخ الرمز';}catch{box.select();root.querySelector('#code-error').textContent='حدد الرمز وانسخه يدويًا.';}};
  root.querySelector('#download-code').onclick=()=>{const url=URL.createObjectURL(new Blob(['Marwan OS — private login code\n'+code+'\n'],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='marwan-os-access-code.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const go=root.querySelector('#continue-code');root.querySelector('#saved-code').onchange=e=>{go.disabled=!e.target.checked;};
  go.onclick=async()=>{go.disabled=true;try{await complete();code='';box.value='';}catch(e){root.querySelector('#code-error').textContent=e.message;go.disabled=false;}};
 }
 async function accept(session){
  const result=await db.auth.setSession(session);if(result.error)throw result.error;
  setHold(false);await onReady();
 }
 function authView(mode='login'){
  if(!['login','signup','password-login','password'].includes(mode))mode='login';
  const codeMode=mode==='login',signup=mode==='signup',changePassword=mode==='password';
  root.innerHTML=`<main class="auth card"><div class="brand">Marwan OS</div><div class="eyebrow" style="text-align:center">مساحة للحياة التي تختارها</div><h1>${codeMode?'الدخول برمزك':signup?'إنشاء حساب دون رسالة تحقق':changePassword?'كلمة مرور جديدة':'الدخول بالبريد وكلمة المرور'}</h1><p class="muted">${codeMode?'ألصق رمز الدخول الذي حفظته عند إنشاء حسابك.':signup?'بعد إنشاء الحساب سيظهر رمز طويل تستخدمه وحده في مرات الدخول القادمة.':'استخدم بيانات حسابك لإصدار رمز دخول جديد.'}</p><form id="auth-form">${codeMode?'<label>رمز الدخول<input name="code" type="password" required dir="ltr" autocomplete="off" spellcheck="false" maxlength="60" placeholder="MW-…"></label>':`${changePassword?'':'<label>البريد الإلكتروني<input name="email" type="email" autocomplete="email" required dir="ltr"></label>'}<label>كلمة المرور<input name="password" type="password" ${signup||changePassword?'minlength="12" maxlength="128"':''} autocomplete="${signup||changePassword?'new-password':'current-password'}" required dir="ltr"></label>`}<p id="auth-error" class="danger" role="alert"></p><button class="primary" type="submit">${signup?'إنشاء الحساب':changePassword?'حفظ كلمة المرور':codeMode?'دخول مساحتي':'الدخول وإصدار رمز جديد'}</button></form><div class="toolbar">${codeMode?'<button type="button" id="show-signup">إنشاء حساب</button><button type="button" id="show-password">الدخول بالبريد وكلمة المرور</button>':'<button type="button" id="show-code">العودة للدخول بالرمز</button>'}</div><small>${signup?'لا يُرسل بريد تحقق. كلمة المرور وسيلة احتياطية إذا فقدت رمزك.':'بياناتك محفوظة في حسابك؛ اتصال الإنترنت مطلوب للمزامنة.'}</small></main>`;
  root.querySelector('#show-signup')?.addEventListener('click',()=>authView('signup'));
  root.querySelector('#show-password')?.addEventListener('click',()=>authView('password-login'));
  root.querySelector('#show-code')?.addEventListener('click',()=>authView());
  root.querySelector('#auth-form').onsubmit=async e=>{
   e.preventDefault();const form=e.target,submit=form.querySelector('button[type=submit]'),f=new FormData(form);submit.disabled=true;setHold(true);
   try{
    if(codeMode){const data=await request({action:'login',code:String(f.get('code')).trim()});form.reset();await accept(data.session);}
    else if(signup){const data=await request({action:'register',email:f.get('email'),password:f.get('password')});form.reset();savedCode(data.code,()=>accept(data.session));}
    else if(changePassword){const r=await db.auth.updateUser({password:f.get('password')});if(r.error)throw r.error;setHold(false);await onReady();}
    else{
     const signed=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(signed.error)throw signed.error;
     const data=await request({action:'issue'},signed.data.session.access_token);form.reset();savedCode(data.code,async()=>{setHold(false);await onReady();});
    }
   }catch(e){setHold(false);const target=form.querySelector('#auth-error');target.textContent=e.code==='email_not_confirmed'?'هذا حساب سابق لم يُؤكد بعد. يلزم تأكيده مرة واحدة أو التواصل مع مالك المشروع؛ لن ننشئ حسابًا بديلًا فوق بياناتك.':e.message||'تعذر الدخول';}
   finally{submit.disabled=false;}
  };
 }
 async function issueAccessCode(){
  if(!confirm('سيُلغى رمز الدخول السابق ويصدر رمز جديد. متابعة؟'))return;
  try{const r=await db.auth.getSession();if(r.error||!r.data.session)throw new Error(messages.UNAUTHORIZED);const data=await request({action:'issue'},r.data.session.access_token);setHold(true);savedCode(data.code,async()=>{setHold(false);await onReady();});}catch(e){setHold(false);onError(e);}
 }
 return {authView,issueAccessCode};
}
