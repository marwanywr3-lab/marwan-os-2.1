const root = document.querySelector('#app');
function failed(message) {
  if (!root.querySelector('.loading')) return;
  const panel = document.createElement('main');
  panel.className = 'auth card';
  const heading = document.createElement('h1');
  heading.textContent = 'تعذر فتح Marwan OS';
  const detail = document.createElement('p');
  detail.textContent = message;
  const retry = document.createElement('button');
  retry.textContent = 'إعادة المحاولة';
  retry.onclick = () => location.reload();
  panel.append(heading, detail, retry);
  root.replaceChildren(panel);
}
try {
  if (!window.MARWAN_CONFIG?.supabaseUrl || !window.MARWAN_CONFIG?.publishableKey)
    throw new Error('ملف config.js مفقود أو إعدادات الاتصال ناقصة.');
  if (!window.supabase?.createClient)
    throw new Error('تعذر تحميل supabase.js. تأكد من رفع ملفات التطبيق كاملةً.');
  await import('./app.js');
} catch (error) {
  console.error('Marwan OS startup:', error);
  failed(error.message || 'تعذر تحميل ملفات التطبيق.');
}
