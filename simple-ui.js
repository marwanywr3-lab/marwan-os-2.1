export const APP_INFO={
 calendar:['مواعيدك، في مكان واضح.','موعد جديد'],tasks:['اكتب ما تريد إنجازه.','مهمة جديدة'],notes:['فكرة، ملاحظة، أو صفحة جديدة.','ملاحظة جديدة'],ai:['اسأل، رتّب أفكارك، وابدأ.','محادثة جديدة'],school:['موادك وواجباتك في مكان واحد.','إضافة مادة'],study:['اختر وقتًا وابدأ التركيز.','إضافة جلسة'],projects:['مشروع واحد، وخطوة تلو الأخرى.','مشروع جديد'],goals:['ما الذي تريد الوصول إليه؟','هدف جديد'],habits:['خطوة صغيرة لهذا اليوم.','عادة جديدة'],wellness:['سجّل نومك ونشاطك ببساطة.','سجل جديد'],wallet:['اعرف ما دخل وما خرج.','تسجيل مبلغ'],worship:['متابعة هادئة ليومك.','إضافة عبادة'],insights:['نظرة بسيطة على تقدمك.',''],ideas:['لا تترك فكرتك تضيع.','فكرة جديدة'],automation:['إذا حدث هذا، افعل ذاك.','قاعدة جديدة']
};
export function simplifyEditor(dialog,kind){
 const fields=dialog.querySelector('.fields');if(!fields)return;
 const keep=new Set(['title']);
 if(['task','assignment','step','milestone'].includes(kind))keep.add('due_at');
 if(['event','exam','lesson'].includes(kind)){keep.add('starts_at');keep.add('ends_at');}
 if(['transaction','budget','wellness','study'].includes(kind))keep.add('amount');
 if(['note','idea','project','goal','subject','flashcard','quiz'].includes(kind))keep.add('body');
 if(['flashcard','quiz'].includes(kind))keep.add('answer');
 const extra=document.createElement('details');extra.className='editor-extra';extra.innerHTML='<summary>خيارات إضافية</summary><div class="fields"></div>';
 for(const label of [...fields.children]){
  const control=label.querySelector('[name]');
  if(label.querySelector('#rich')||control&&keep.has(control.name))continue;
  extra.querySelector('.fields').append(label);
 }
 if(extra.querySelector('.fields').children.length)fields.after(extra);
 // Attachments and links remain available without crowding the editor.
 const section=dialog.querySelector(':scope > section');
 if(section){const details=document.createElement('details');details.className='editor-extra';details.innerHTML='<summary>المرفقات والروابط وأدوات أخرى</summary>';section.before(details);details.append(section);}
 const hint=dialog.querySelector(':scope > p.muted');if(hint)hint.remove();
 const title=fields.querySelector('[name=title]');if(title)title.placeholder=kind==='note'?'عنوان الملاحظة':kind==='task'?'ما الذي تريد إنجازه؟':'اكتب العنوان';
 for(const name of ['starts_at','ends_at']){const input=dialog.querySelector('[name='+name+']');if(input)input.required=['event','exam','lesson'].includes(kind);}
 if(kind==='transaction'){
  const amount=fields.querySelector('[name=amount]');
  if(amount){const negative=Number(amount.value||0)<0;const hasValue=amount.value!=='';amount.value=hasValue?String(Math.abs(Number(amount.value))):'';amount.min='0';amount.required=true;amount.closest('label').firstChild.textContent='المبلغ بالريال';const label=document.createElement('label');label.innerHTML='<span>العملية</span><select name="money_direction"><option value="expense">مصروف</option><option value="income">دخل</option></select>';label.querySelector('select').value=hasValue&&!negative?'income':'expense';amount.closest('label').before(label);}
 }
 const first=fields.querySelector('input,textarea,[contenteditable=true]');queueMicrotask(()=>first?.focus());
}
export function simplifySettings(view){
 const form=view.querySelector('#prefs-form');if(!form)return;
 const group=(title,nodes)=>{const d=document.createElement('details');d.className='settings-extra';const summary=document.createElement('summary');summary.textContent=title;d.append(summary);nodes.filter(Boolean).forEach(n=>d.append(n));form.append(d);};
 group('الاسم والمظهر',[form.querySelector('[name=display_name]')?.closest('label'),form.querySelector('[name=theme]')?.closest('label')]);
 group('صلاحيات المساعد',[form.querySelector('[name=ai_mode]')?.closest('label'),form.querySelector('.warning'),form.querySelector('fieldset')]);
 const save=form.querySelector('button.primary');if(save)form.append(save);
 const toolbar=view.querySelector(':scope > .toolbar');
 if(toolbar){const d=document.createElement('details');d.className='settings-extra card';d.innerHTML='<summary>الحساب والتخصيص</summary>';toolbar.before(d);d.append(toolbar);}
 const footer=view.querySelector(':scope > p.muted');if(footer)footer.remove();
}
