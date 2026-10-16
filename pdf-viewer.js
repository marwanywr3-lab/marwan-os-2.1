import {esc} from './domain.js';
export async function openPDF({blob, attachment, dialog}) {
  const url = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], {type:'application/pdf'}));
  dialog.innerHTML = `<h2>${esc(attachment.name)}</h2><p class="muted">عارض المتصفح للقراءة. إذا لم تظهر الصفحات، نزّل الملف وافتحه على جهازك. التعليقات على PDF غير متاحة في هذه النسخة.</p><div class="toolbar"><a href="${url}" download="${esc(attachment.name)}">تنزيل PDF</a><button type="button" id="pdf-close">إغلاق</button></div><iframe title="معاينة PDF" src="${url}" style="width:100%;height:65vh;border:0"></iframe>`;
  if (!dialog.open) dialog.showModal();
  const clean = () => { URL.revokeObjectURL(url); dialog.removeEventListener('close', clean); };
  dialog.addEventListener('close', clean);
  dialog.querySelector('#pdf-close').onclick = () => dialog.close();
}
