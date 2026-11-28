package dev.keel.capacitor;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Keel's HTTP client for a Capacitor shell. Each request runs on a background thread over {@link HttpURLConnection},
 * which keeps cookies in the default {@code CookieHandler} (the store {@code CapacitorHttp} uses). {@code request}
 * resolves with the status and headers, {@code set-cookie} left out; the body follows as {@code chunk} events of at
 * most 16 KiB (base64), then {@code end}, or {@code fail} on an error. A URL is sent only when its origin is in the
 * plugin's {@code allow} configuration ({@code plugins.KeelHttp.allow} of {@code capacitor.config.json}, exact
 * {@code http:} or {@code https:} origins); any other, and every URL when there is no list, is rejected before a
 * connection opens. No redirect is followed: a 3xx resolves as it came, its cookies kept. {@code cancel} disconnects
 * the request.
 */
@CapacitorPlugin(name = "KeelHttp")
public class KeelHttpPlugin extends Plugin {

    private static final int CHUNK = 16 * 1024;
    private final Map<String, HttpURLConnection> open = new ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newCachedThreadPool();

    @PluginMethod
    public void request(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        pool.execute(() -> run(call, id));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        HttpURLConnection c = open.remove(call.getString("id", ""));
        if (c != null) pool.execute(c::disconnect);
        call.resolve();
    }

    /** The origin of {@code url} as the page writes one: scheme, host and a port that is not the scheme's own; null when it is not http(s). */
    static String originOf(URL url) {
        String scheme = url.getProtocol().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) return null;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        if (host.isEmpty()) return null;
        int port = url.getPort();
        return scheme + "://" + host + (port == -1 || port == url.getDefaultPort() ? "" : ":" + port);
    }

    /** Whether the {@code allow} configuration lists the origin of {@code url}. */
    private boolean allowed(URL url) {
        String origin = originOf(url);
        String[] allow = getConfig().getArray("allow");
        return origin != null && allow != null && Arrays.asList(allow).contains(origin);
    }

    @Override
    protected void handleOnDestroy() {
        for (HttpURLConnection c : open.values()) c.disconnect();
        open.clear();
        pool.shutdownNow();
    }

    private void run(PluginCall call, String id) {
        HttpURLConnection c = null;
        boolean headed = false;
        try {
            URL url = new URL(call.getString("url", ""));
            if (!allowed(url)) {
                call.reject("network request failed");
                return;
            }
            c = (HttpURLConnection) url.openConnection();
            open.put(id, c);
            c.setRequestMethod(call.getString("method", "GET"));
            c.setInstanceFollowRedirects(false);
            JSObject headers = call.getObject("headers", new JSObject());
            for (Iterator<String> keys = headers.keys(); keys.hasNext(); ) {
                String k = keys.next();
                c.setRequestProperty(k, headers.getString(k));
            }
            String data = call.getString("data");
            if (data != null) {
                c.setDoOutput(true);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(data.getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            JSObject shown = new JSObject();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() != null && !e.getKey().equalsIgnoreCase("set-cookie")) shown.put(e.getKey(), String.join(", ", e.getValue()));
            }
            JSObject res = new JSObject();
            res.put("status", status);
            res.put("headers", shown);
            call.resolve(res);
            headed = true;
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in != null) {
                try (InputStream body = in) {
                    byte[] buf = new byte[CHUNK];
                    for (int n; (n = body.read(buf)) != -1; ) {
                        JSObject chunk = event(id);
                        chunk.put("data", Base64.encodeToString(buf, 0, n, Base64.NO_WRAP));
                        notifyListeners("chunk", chunk);
                    }
                }
            }
            if (open.remove(id) != null) notifyListeners("end", event(id));
        } catch (Exception e) {
            boolean live = open.remove(id) != null;
            if (!headed) call.reject("network request failed");
            else if (live) {
                JSObject fail = event(id);
                fail.put("message", String.valueOf(e.getMessage()));
                notifyListeners("fail", fail);
            }
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static JSObject event(String id) {
        JSObject o = new JSObject();
        o.put("id", id);
        return o;
    }
}
