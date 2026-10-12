'use strict';
// Resolve appearance before styles can paint the first WebView frame.
if (typeof Native !== 'undefined') {
 document.documentElement.dataset.theme=Native.isDarkTheme()?'dark':'light';
} else {
 let appearance='system';
 try { const raw=localStorage.getItem('shiji-v1');if(raw)appearance=JSON.parse(raw).theme; } catch(ignored){}
 const dark=appearance==='dark'||(appearance==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.dataset.theme=dark?'dark':'light';
}
