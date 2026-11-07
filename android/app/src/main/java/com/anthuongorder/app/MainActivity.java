package com.anthuongorder.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * An Thuong Order — Android wrapper around the web app (app.anthuongorder.com).
 * Adds: persistent login, external links opened in their apps (WhatsApp, Shopee, Maps),
 * and a JS bridge (window.AndroidBridge) to share / save quote images.
 */
public class MainActivity extends Activity {

    static final String HOME = "https://app.anthuongorder.com/";
    static final String HOST = "anthuongorder.com";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#2E5E4E"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F3F6F4"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " ATOrderApp/" + BuildConfig.VERSION_NAME);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient()); // enables alert/confirm dialogs
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutside(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> openOutside(Uri.parse(url)));

        Uri data = getIntent() != null ? getIntent().getData() : null;
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(data != null ? data.toString() : HOME);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) web.loadUrl(intent.getData().toString());
    }

    /** Keep our own pages inside the app; open everything else (wa.me, shopee, maps…) in its app. */
    private boolean openOutside(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        String host = u.getHost() == null ? "" : u.getHost();
        String path = u.getPath() == null ? "" : u.getPath();
        if (scheme.equals("file")) return false;
        if ((scheme.equals("https") || scheme.equals("http")) && (host.equals(HOST) || host.endsWith("." + HOST))
                && !path.startsWith("/download/")) {
            return false;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Không có ứng dụng để mở liên kết này", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    // ---------------- JS bridge ----------------

    private ArrayList<Uri> writePngs(String jsonArrayOfBase64, String baseName) throws Exception {
        JSONArray arr = new JSONArray(jsonArrayOfBase64);
        File dir = new File(getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cache");
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
            f.delete();
        ArrayList<Uri> uris = new ArrayList<>();
        String safe = baseName.replaceAll("[^A-Za-z0-9._-]", "_");
        for (int k = 0; k < arr.length(); k++) {
            String b64 = arr.getString(k);
            int comma = b64.indexOf(',');
            if (comma >= 0) b64 = b64.substring(comma + 1);
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            File f = new File(dir, safe + (arr.length() > 1 ? "-" + (k + 1) : "") + ".png");
            try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
            uris.add(FileProvider.getUriForFile(this, getPackageName() + ".files", f));
        }
        return uris;
    }

    private Intent sendIntent(ArrayList<Uri> uris, String text) {
        Intent i;
        if (uris.size() == 1) {
            i = new Intent(Intent.ACTION_SEND);
            i.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
            i = new Intent(Intent.ACTION_SEND_MULTIPLE);
            i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }
        i.setType("image/png");
        if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return i;
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    class Bridge {
        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
        }

        /** Share images straight into a WhatsApp chat (phone in international digits); falls back to the share sheet. */
        @JavascriptInterface
        public void shareToWhatsApp(String images, String text, String phoneDigits, String name) {
            runOnUiThread(() -> {
                try {
                    ArrayList<Uri> uris = writePngs(images, name == null ? "quote" : name);
                    for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                        Intent i = sendIntent(uris, text);
                        i.setPackage(pkg);
                        if (phoneDigits != null && !phoneDigits.isEmpty()) i.putExtra("jid", phoneDigits + "@s.whatsapp.net");
                        try {
                            startActivity(i);
                            return;
                        } catch (ActivityNotFoundException ignored) { }
                    }
                    startActivity(Intent.createChooser(sendIntent(uris, text), "Gửi báo giá"));
                } catch (Exception e) {
                    toast("Không chia sẻ được ảnh: " + e.getMessage());
                }
            });
        }

        /** Open the Android share sheet with the images. */
        @JavascriptInterface
        public void shareImages(String images, String text, String name) {
            runOnUiThread(() -> {
                try {
                    startActivity(Intent.createChooser(sendIntent(writePngs(images, name == null ? "quote" : name), text), "Chia sẻ báo giá"));
                } catch (Exception e) {
                    toast("Không chia sẻ được ảnh: " + e.getMessage());
                }
            });
        }

        /** Save one PNG (data URL or base64) into Pictures/AnThuongOrder. */
        @JavascriptInterface
        public void saveImage(String dataUrl, String fileName) {
            try {
                String b64 = dataUrl;
                int comma = b64.indexOf(',');
                if (comma >= 0) b64 = b64.substring(comma + 1);
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String name = (fileName == null || fileName.isEmpty()) ? "quote.png" : fileName;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/AnThuongOrder");
                    Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("MediaStore");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new Exception("stream");
                        out.write(bytes);
                    }
                    toast("Đã lưu ảnh vào Thư viện (Pictures/AnThuongOrder)");
                } else {
                    JSONArray arr = new JSONArray();
                    arr.put(b64);
                    shareImages(arr.toString(), "", name.replace(".png", ""));
                }
            } catch (Exception e) {
                toast("Không lưu được ảnh: " + e.getMessage());
            }
        }
    }
}
