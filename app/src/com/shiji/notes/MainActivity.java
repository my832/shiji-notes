package com.shiji.notes;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.AtomicFile;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.*;

public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Object stateLock = new Object();
    private AtomicFile stateFile;
    private int attachmentSlots = 8;
    private volatile boolean darkTheme = false;
    private int systemBarsMode = 0;
    private int appliedWebBackground = 0;
    private final SystemBarsBackground barsBackground = new SystemBarsBackground();
    private AlertDialog importDialog;
    private static final int PICK=100, EXPORT=101, IMPORT=102;
    private static final long MAX_FILE=20L*1024*1024, MAX_BACKUP=500L*1024*1024, MAX_STATE=32L*1024*1024;
    private File attachmentDir() { return new File(getFilesDir(), "attachments"); }

    @Override public void onCreate(Bundle saved) {
        stateFile = new AtomicFile(new File(getFilesDir(), "notes.json"));
        darkTheme=(getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
        try {
            String raw=readState();
            if(!raw.isEmpty()){
                String choice=new JSONObject(raw).optString("theme","system");
                if("dark".equals(choice))darkTheme=true;else if("light".equals(choice))darkTheme=false;
            }
        }catch(Exception ignored){}
        int themeId=getResources().getIdentifier(darkTheme?"AppThemeDark":"AppThemeLight","style",getPackageName());
        if(themeId!=0)setTheme(themeId);
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams params=getWindow().getAttributes();
            params.layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        attachmentDir().mkdirs();
        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        root.setBackground(barsBackground);
        barsBackground.setAppearance(darkTheme,systemBarsMode);
        setContentView(root);
        updateSystemBars();
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));
                barsBackground.setInsets(bars.top,Math.max(bars.bottom,ime.bottom));
                return WindowInsets.CONSUMED;
            } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            barsBackground.setInsets(insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        if (Build.VERSION.SDK_INT >= 29) settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !"app.local".equals(uri.getHost())) return emptyResponse();
                String path = uri.getPath();
                try {
                    if (path != null && path.startsWith("/attachments/")) {
                        String id = path.substring(13);
                        if (!id.matches("[a-zA-Z0-9_-]{1,90}")) return emptyResponse();
                        return new WebResourceResponse("application/octet-stream", null, new FileInputStream(new File(attachmentDir(), id)));
                    }
                    String asset = "/".equals(path) ? "index.html" : path.substring(1);
                    String mime;
                    if (asset.equals("index.html")) mime="text/html";
                    else if (asset.equals("style.css") || asset.equals("large.css") || asset.equals("glass.css")) mime="text/css";
                    else if (asset.equals("app.js") || asset.equals("init.js")) mime="application/javascript";
                    else return emptyResponse();
                    return new WebResourceResponse(mime,"UTF-8",getAssets().open(asset));
                } catch (Exception e) { return emptyResponse(); }
            }
        });
        web.loadUrl("https://app.local/index.html");
    }
    private WebResourceResponse emptyResponse() { return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0])); }
    private void javascript(String script) { runOnUiThread(() -> { if (!isFinishing() && web != null) web.evaluateJavascript(script,null); }); }
    private void message(String text) { javascript("window.nativeMessage("+JSONObject.quote(text)+")"); }
    private String readState() throws IOException {
        synchronized (stateLock) { if (!stateFile.getBaseFile().exists()) return ""; return new String(stateFile.readFully(),StandardCharsets.UTF_8); }
    }
    private boolean writeState(String value) {
        synchronized (stateLock) {
            FileOutputStream out=null;
            try {
                if (value.getBytes(StandardCharsets.UTF_8).length>MAX_STATE) return false;
                JSONObject incoming = new JSONObject(value);
                validateState(incoming, false);
                Set<String> previous = new HashSet<>();
                try { String raw=readState();if(!raw.isEmpty())previous=referenced(new JSONObject(raw)); } catch(Exception ignored) {}
                Set<String> next=referenced(incoming);
                out=stateFile.startWrite();out.write(value.getBytes(StandardCharsets.UTF_8));stateFile.finishWrite(out);
                for(String id:previous)if(!next.contains(id))new File(attachmentDir(),id).delete();
                return true;
            } catch (Exception e) { if (out != null) stateFile.failWrite(out); return false; }
        }
    }
    private void updateSystemBars() {
        barsBackground.setAppearance(darkTheme,systemBarsMode);
        int background=darkTheme?Color.rgb(23,33,30):Color.rgb(245,246,242);
        if(web!=null && appliedWebBackground!=background){web.setBackgroundColor(background);appliedWebBackground=background;}
        boolean lightIcons=darkTheme || systemBarsMode==2;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c=getWindow().getInsetsController();
            int flags=WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if(c!=null && (c.getSystemBarsAppearance()&flags)!=(lightIcons?0:flags))c.setSystemBarsAppearance(lightIcons?0:flags,flags);
        } else {
            int layout=View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            int wanted=layout|(lightIcons?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            if(getWindow().getDecorView().getSystemUiVisibility()!=wanted)getWindow().getDecorView().setSystemUiVisibility(wanted);
        }
    }
    public class Bridge {
        @JavascriptInterface public String loadState() { try { return readState(); } catch (Exception e) { return "{\"error\":\"read\"}"; } }
        @JavascriptInterface public boolean saveState(String value) { return writeState(value); }
        @JavascriptInterface public boolean isSystemDark() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES; }
        @JavascriptInterface public boolean isDarkTheme() { return darkTheme; }
        @JavascriptInterface public void setSystemBarsMode(int mode) { runOnUiThread(()->{int next=Math.max(0,Math.min(2,mode));if(systemBarsMode==next)return;systemBarsMode=next;updateSystemBars();}); }
        @JavascriptInterface public void setTheme(boolean dark) {
            runOnUiThread(() -> {
                if(darkTheme==dark)return;
                darkTheme=dark;
                updateSystemBars();
            });
        }
        @JavascriptInterface public void haptic() { runOnUiThread(() -> web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)); }
        @JavascriptInterface public void exitApp() { runOnUiThread(() -> finish()); }
        @JavascriptInterface public void pickAttachment(int slots) {
            runOnUiThread(() -> { attachmentSlots=Math.max(0,Math.min(8,slots));if(attachmentSlots==0)return;
                Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                try {startActivityForResult(i,PICK);}catch(Exception e){message("手机没有可用的文件选择器");}
            });
        }
        @JavascriptInterface public void openAttachment(String id, String mime, String name) {
            runOnUiThread(() -> {
                if(!id.matches("[a-zA-Z0-9_-]{1,90}") || !new File(attachmentDir(),id).isFile()){message("附件不存在，请从备份恢复");return;}
                String type=mime.matches("[a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+")?mime:"application/octet-stream";
                Uri uri=new Uri.Builder().scheme("content").authority("com.shiji.notes.files").appendPath(id).appendPath(name).appendQueryParameter("mime",type).build();
                Intent i=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                i.setClipData(ClipData.newRawUri(name,uri));
                try{startActivity(Intent.createChooser(i,"打开附件"));}catch(Exception e){message("没有可打开此文件的应用");}
            });
        }
        @JavascriptInterface public void shareText(String text) { runOnUiThread(() -> {Intent i=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text);try{startActivity(Intent.createChooser(i,"分享便签"));}catch(Exception e){message("暂时无法分享");}}); }
        @JavascriptInterface public void exportBackup() { runOnUiThread(() -> { Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/zip").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"拾记备份-"+new java.text.SimpleDateFormat("yyyy-MM-dd",java.util.Locale.CHINA).format(new java.util.Date())+".shiji");try{startActivityForResult(i,EXPORT);}catch(Exception e){message("手机没有可用的文件保存器");} }); }
        @JavascriptInterface public void importBackup() { runOnUiThread(() -> { Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(i,IMPORT);}catch(Exception e){message("手机没有可用的文件选择器");} }); }
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code,result,data);
        if(result!=RESULT_OK || data==null)return;
        if(code==PICK) {
            java.util.List<Uri> uris=new java.util.ArrayList<>();
            if(data.getClipData()!=null){for(int n=0;n<data.getClipData().getItemCount();n++)uris.add(data.getClipData().getItemAt(n).getUri());}else if(data.getData()!=null)uris.add(data.getData());
            int max=attachmentSlots;
            if(uris.size()>max)message("本次最多添加 "+max+" 个附件");
            worker.execute(() -> {for(int n=0;n<Math.min(max,uris.size());n++)copyAttachment(uris.get(n));});
        } else if(data.getData()!=null) {
            Uri uri=data.getData();
            if(code==EXPORT){message("正在导出完整备份…");worker.execute(() -> exportTo(uri));}
            else if(code==IMPORT){message("正在检查备份…");worker.execute(() -> prepareImport(uri));}
        }
    }
    private void copyAttachment(Uri uri) {
        String id="a"+UUID.randomUUID().toString().replace("-",""); File out=new File(attachmentDir(),id);
        try {
            String name="附件",mime=getContentResolver().getType(uri);long declared=-1;
            try(Cursor c=getContentResolver().query(uri,null,null,null,null)){if(c!=null&&c.moveToFirst()){int ni=c.getColumnIndex(OpenableColumns.DISPLAY_NAME),si=c.getColumnIndex(OpenableColumns.SIZE);if(ni>=0)name=c.getString(ni);if(si>=0&&!c.isNull(si))declared=c.getLong(si);}}
            if(declared>MAX_FILE)throw new IOException("单个附件不能超过 20 MB");
            if(name==null || name.isEmpty())name="附件";if(name.length()>250)name=name.substring(0,250);
            if(mime==null||!mime.matches("[a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+"))mime="application/octet-stream";
            long bytes;
            try(InputStream in=getContentResolver().openInputStream(uri);OutputStream os=new FileOutputStream(out)){bytes=copyLimited(in,os,MAX_FILE);}
            JSONObject a=new JSONObject().put("id",id).put("name",name).put("mime",mime).put("size",bytes);
            javascript("window.onNativeAttachment("+a.toString()+")");
        }catch(Exception e){out.delete();message(e.getMessage()!=null&&e.getMessage().contains("20 MB")?e.getMessage():"附件读取失败，请换一个文件重试");}
    }
    private long copyLimited(InputStream in,OutputStream out,long max) throws IOException {
        if(in==null)throw new IOException("Cannot read file");byte[] buf=new byte[32768];long count=0;int n;
        while((n=in.read(buf))!=-1){count+=n;if(count>max)throw new IOException("文件超过允许大小（单附件 20 MB）");out.write(buf,0,n);}return count;
    }
    private Set<String> referenced(JSONObject state) throws Exception {
        Set<String> ids=new HashSet<>();JSONArray notes=state.getJSONArray("notes");
        for(int i=0;i<notes.length();i++)collectIds(notes.getJSONObject(i).optJSONArray("attachments"),ids);
        JSONObject draft=state.optJSONObject("draft");if(draft!=null)collectIds(draft.optJSONArray("attachments"),ids);return ids;
    }
    private void collectIds(JSONArray attachments,Set<String> ids) throws Exception {
        if(attachments==null)return;for(int i=0;i<attachments.length();i++){JSONObject a=attachments.getJSONObject(i);String id=a.getString("id");if(!id.matches("[a-zA-Z0-9_-]{1,90}"))throw new IOException("无效的附件路径");ids.add(id);}
    }
    private void validateState(JSONObject obj, boolean importing) throws Exception {
        if(obj.getInt("version")!=1)throw new IOException("不支持的备份版本");
        JSONArray notes=obj.getJSONArray("notes");if(notes.length()>1000)throw new IOException("便签数量过多");
        int flow=0,resident=0;Set<String> unique=new HashSet<>();
        for(int i=0;i<notes.length();i++){
            JSONObject n=notes.getJSONObject(i);String id=n.getString("id"),col=n.getString("column"),location=n.getString("location"),status=n.getString("status");
            if(!id.matches("[a-zA-Z0-9_-]{1,90}")||!unique.add(id)||!(col.equals("flow")||col.equals("resident"))||!(location.equals("active")||location.equals("archive")||location.equals("trash"))||!(status.equals("normal")||status.equals("important")||status.equals("urgent")||status.equals("done")))throw new IOException("便签格式错误");
            if(n.getString("title").length()>80||n.getString("body").length()>20000)throw new IOException("便签内容过长");
            n.getLong("created");n.getLong("updated");
            JSONArray tags=n.getJSONArray("tags");if(tags.length()>12)throw new IOException("标签过多");for(int t=0;t<tags.length();t++)if(tags.getString(t).length()>30)throw new IOException("标签过长");
            checkAttachments(n.getJSONArray("attachments"),importing);
            if(location.equals("active")){if(col.equals("flow"))flow++;else resident++;}
        }
        if(flow>10||resident>5)throw new IOException("超过便签栏位上限");
        JSONObject draft=obj.optJSONObject("draft");if(draft!=null)checkAttachments(draft.getJSONArray("attachments"),importing);
    }
    private void checkAttachments(JSONArray list, boolean importing) throws Exception {
        if(list.length()>8)throw new IOException("附件数量超出限制");
        for(int i=0;i<list.length();i++){
            JSONObject a=list.getJSONObject(i);if(!a.getString("id").matches("[a-zA-Z0-9_-]{1,90}")||a.getString("name").length()>250||!a.getString("mime").matches("[a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+")||a.getLong("size")<0||a.getLong("size")>MAX_FILE)throw new IOException("附件格式错误");
            if(importing&&a.has("data"))throw new IOException("请选择本应用导出的 .shiji 备份");
        }
    }
    private void exportTo(Uri uri) {
        try {
            String json=readState();JSONObject data=new JSONObject(json);Set<String> ids=referenced(data);
            long total=json.getBytes(StandardCharsets.UTF_8).length;
            for(String id:ids){File f=new File(attachmentDir(),id);if(!f.isFile())throw new IOException("附件缺失，请先检查便签中的文件");total+=f.length();}
            if(total>MAX_BACKUP)throw new IOException("备份超过 500 MB，请先整理较大的附件");
            try(OutputStream os=getContentResolver().openOutputStream(uri,"wt");ZipOutputStream zip=new ZipOutputStream(os)){
                zip.putNextEntry(new ZipEntry("notes.json"));zip.write(json.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
                for(String id:ids){File f=new File(attachmentDir(),id);if(!f.isFile())throw new IOException("missing");zip.putNextEntry(new ZipEntry("attachments/"+id));try(InputStream in=new FileInputStream(f)){copyLimited(in,zip,MAX_FILE);}zip.closeEntry();}
            }
            message("完整备份已导出，请妥善保管");
        }catch(Exception e){String detail=e.getMessage();message(detail!=null&&(detail.contains("500 MB")||detail.contains("附件缺失"))?detail:"备份导出失败，请检查存储空间和附件是否存在");}
    }
    private void prepareImport(Uri uri) {
        File staging=new File(getCacheDir(),"import-"+UUID.randomUUID());staging.mkdirs();File attachments=new File(staging,"attachments");attachments.mkdirs();
        try {
            long total=0;int entries=0;Set<String> paths=new HashSet<>();
            try(InputStream input=getContentResolver().openInputStream(uri);ZipInputStream zip=new ZipInputStream(input)){
                ZipEntry entry;
                while((entry=zip.getNextEntry())!=null){
                    if(++entries>8100)throw new IOException("备份文件过多");String p=entry.getName();
                    if(entry.isDirectory())continue;
                    if(!paths.add(p))throw new IOException("备份有重复文件");
                    if(!(p.equals("notes.json")||p.matches("attachments/[a-zA-Z0-9_-]{1,90}")))throw new IOException("备份文件结构不正确");
                    long limit=p.equals("notes.json")?MAX_STATE:MAX_FILE;long size;
                    try(OutputStream out=new FileOutputStream(new File(staging,p))){size=copyLimited(zip,out,Math.min(limit,MAX_BACKUP-total));}
                    total+=size;if(total>MAX_BACKUP)throw new IOException("备份超过 500 MB");zip.closeEntry();
                }
            }
            File state=new File(staging,"notes.json");if(!state.isFile())throw new IOException("缺少便签数据");
            String json=new String(Files.readAllBytes(state.toPath()),StandardCharsets.UTF_8);JSONObject parsed=new JSONObject(json);validateState(parsed,true);
            for(String id:referenced(parsed))if(!new File(attachments,id).isFile())throw new IOException("备份缺少附件");
            JSONArray importedNotes=parsed.getJSONArray("notes");
            for(int n=0;n<importedNotes.length();n++)checkAttachmentSizes(importedNotes.getJSONObject(n).getJSONArray("attachments"),attachments);
            if(parsed.optJSONObject("draft")!=null)checkAttachmentSizes(parsed.getJSONObject("draft").getJSONArray("attachments"),attachments);
            int count=parsed.getJSONArray("notes").length();
            runOnUiThread(() -> {
                if(isFinishing()){deleteTree(staging);return;}
                importDialog = new AlertDialog.Builder(this,darkTheme?android.R.style.Theme_Material_Dialog_Alert:android.R.style.Theme_Material_Light_Dialog_Alert).setTitle("恢复这份备份？").setMessage("包含 "+count+" 张便签。\n当前便签、附件和主题将被替换。建议先导出当前备份。")
                    .setNegativeButton("取消",(d,w)->worker.execute(()->deleteTree(staging)))
                    .setPositiveButton("恢复备份",(d,w)->worker.execute(()->commitImport(staging,json)))
                    .setOnCancelListener(d->worker.execute(()->deleteTree(staging))).create();
                importDialog.show();
            });
        }catch(Exception e){deleteTree(staging);message("无法恢复："+(e.getMessage()!=null?e.getMessage():"备份格式不正确"));}
    }
    private void checkAttachmentSizes(JSONArray items,File dir) throws Exception {
        for(int i=0;i<items.length();i++){JSONObject a=items.getJSONObject(i);if(new File(dir,a.getString("id")).length()!=a.getLong("size"))throw new IOException("备份附件大小不一致");}
    }
    private void commitImport(File staging,String json) {
        File current=attachmentDir(),old=new File(getFilesDir(),"previous-attachments"),incoming=new File(staging,"attachments");
        synchronized(stateLock){
            try{
                deleteTree(old);if(!current.renameTo(old))throw new IOException();
                if(!incoming.renameTo(current)){old.renameTo(current);throw new IOException();}
                if(!writeState(json)){deleteTree(current);old.renameTo(current);throw new IOException();}
                deleteTree(old);deleteTree(staging);javascript("window.onNativeImport()");
            }catch(Exception e){deleteTree(staging);message("恢复失败，当前数据已保留");}
        }
    }
    private void deleteTree(File f) { if(f.isDirectory()){File[] children=f.listFiles();if(children!=null)for(File c:children)deleteTree(c);}f.delete(); }
    @Override public void onBackPressed() { javascript("window.onNativeBack()"); }
    @Override public void onConfigurationChanged(Configuration config) { super.onConfigurationChanged(config);javascript("window.onNativeThemeChanged && window.onNativeThemeChanged()"); }
    @Override protected void onDestroy() { if(importDialog!=null&&importDialog.isShowing())importDialog.dismiss();if(web!=null){web.removeJavascriptInterface("Native");web.destroy();web=null;}worker.shutdown();super.onDestroy(); }
}
