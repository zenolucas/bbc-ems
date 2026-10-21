import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { RotateCw, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Button, EmptyState, Loading, SignInPrompt, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { API_URL, WEBVIEW_UA_SUFFIX } from "@/lib/config";
import { useSession } from "@/lib/session";
import { space, useTheme } from "@/theme";

const ORIGIN = new URL(API_URL).origin;

// The typings default the props generic to `undefined`, and `Props & undefined` is `never`
// under TypeScript 6; instantiating it with `object` keeps the real props.
const AdminWebView = WebView<object>;
type AdminWebViewRef = WebView<object>;
/** Web paths the WebView may load itself; everything else is handed to native screens or the browser. */
const WEB_PATHS = /^\/(admin|app|api|login|no-access|_next)(\/|$|\?)/;

type Phase = { kind: "connecting" } | { kind: "ready"; uri: string } | { kind: "error"; message: string };

/**
 * The web admin inside the app. The app holds a bearer token, not a cookie, so
 * it swaps a one-time token for the session cookie at /app/handoff (see the web's
 * src/app/app/handoff/route.ts). The BBCApp/ user agent hides the web's own
 * account menu and theme toggle.
 */
export default function Organiser() {
  const { status, isAdmin } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const start = typeof next === "string" && next.startsWith("/admin") && !next.startsWith("/admin/scan") ? next : "/admin";
  const { c } = useTheme();
  const web = useRef<AdminWebViewRef>(null);
  const canGoBack = useRef(false);
  const relogins = useRef(0);
  const [phase, setPhase] = useState<Phase>({ kind: "connecting" });
  const [progress, setProgress] = useState(0);

  const connect = useCallback(
    // Starts in "connecting"; callers that retry set it first, so the first run doesn't setState in an effect
    async (path: string) => {
      try {
        const { token } = await api<{ token: string }>("/api/auth/one-time-token/generate");
        setPhase({ kind: "ready", uri: `${API_URL}/app/handoff?ott=${encodeURIComponent(token)}&next=${encodeURIComponent(path)}` });
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't open organiser tools" });
      }
    },
    [],
  );

  useEffect(() => {
    // connect() only sets state after awaiting the token request; the rule can't see through the callback
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "signedIn" && isAdmin) connect(start);
  }, [status, isAdmin, connect, start]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile");
  }, []);

  // Android back walks the WebView's history first, then closes
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (canGoBack.current) web.current?.goBack();
        else close();
        return true;
      });
      return () => sub.remove();
    }, [close]),
  );

  /** Leaves the WebView for a native screen. */
  const goNative = useCallback(
    (href: string) => {
      close();
      setTimeout(() => router.push(href as Href), 0);
    },
    [close],
  );

  /** Decides where a link goes. Returns true only for pages the WebView should load. */
  const route = useCallback(
    (url: string): boolean => {
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return false;
      }
      if (u.protocol === "about:" || u.protocol === "blob:" || u.protocol === "data:") return true;
      if (u.origin !== ORIGIN) {
        // Maps, mail, GCash links: the phone's own apps handle them
        Linking.openURL(url).catch(() => {});
        return false;
      }
      const path = u.pathname;
      const scan = path.match(/^\/admin\/scan(?:\/([^/?#]+))?/);
      if (scan) {
        // Door crew use the native scanner: faster camera, works offline
        goNative(scan[1] ? `/door/${scan[1]}` : "/door");
        return false;
      }
      if (WEB_PATHS.test(path)) return true;
      const ev = path.match(/^\/events\/([^/?#]+)\/?$/);
      if (ev) return goNative(`/events/${ev[1]}`), false;
      const bk = path.match(/^\/bookings\/([^/?#]+)\/?$/);
      if (bk) return goNative(`/bookings/${bk[1]}`), false;
      const tk = path.match(/^\/tickets\/([^/?#]+)\/?$/);
      if (tk) return goNative(`/tickets/${tk[1]}`), false;
      if (path === "/" || path === "") return goNative("/"), false;
      if (path === "/me" || path.startsWith("/me/")) return goNative("/tickets"), false;
      WebBrowser.openBrowserAsync(url).catch(() => {});
      return false;
    },
    [goNative],
  );

  const onNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      canGoBack.current = nav.canGoBack;
      if (nav.loading) return;
      let path = "";
      try {
        path = new URL(nav.url).pathname;
      } catch {}
      if (path === "/login") {
        // The cookie expired or was cleared: hand off again, once
        if (relogins.current < 1) {
          relogins.current += 1;
          setPhase({ kind: "connecting" });
          connect(start);
        } else {
          setPhase({ kind: "error", message: "Couldn't sign the organiser tools in. Try again, or sign out and back in." });
        }
      } else if (path.startsWith("/admin")) {
        relogins.current = 0;
      }
    },
    [connect, start],
  );

  if (status !== "signedIn") {
    return (
      <Shell onClose={close}>
        <SignInPrompt title="Sign in first">Organiser tools open with your Base Camp account.</SignInPrompt>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell onClose={close}>
        <EmptyState title="For organisers only" action={<Button title="Close" variant="secondary" onPress={close} />}>
          Door crew can scan tickets from the Door tab.
        </EmptyState>
      </Shell>
    );
  }

  return (
    <Shell onClose={close} onReload={phase.kind === "ready" ? () => web.current?.reload() : undefined} progress={phase.kind === "ready" ? progress : 0}>
      {phase.kind === "connecting" && <Loading label="Opening organiser tools…" />}
      {phase.kind === "error" && (
        <EmptyState title="Couldn't open organiser tools" action={<Button title="Try again" onPress={() => { relogins.current = 0; setPhase({ kind: "connecting" }); connect(start); }} />}>
          {phase.message}
        </EmptyState>
      )}
      {phase.kind === "ready" && (
        <AdminWebView
          ref={web}
          source={{ uri: phase.uri }}
          applicationNameForUserAgent={WEBVIEW_UA_SUFFIX}
          sharedCookiesEnabled
          domStorageEnabled
          originWhitelist={["https://*", "http://*", "about:*", "blob:*", "data:*"]}
          onShouldStartLoadWithRequest={(req) => (req.isTopFrame === false ? true : route(req.url))}
          onOpenWindow={(e) => {
            // target=_blank links: same rules, but never a second WebView
            if (route(e.nativeEvent.targetUrl)) web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(e.nativeEvent.targetUrl)}; true;`);
          }}
          onNavigationStateChange={onNavigationStateChange}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onError={(e) => setPhase({ kind: "error", message: e.nativeEvent.description || "The page didn't load. Check your connection." })}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) setPhase({ kind: "error", message: "The site had a problem loading this page." });
          }}
          onRenderProcessGone={() => web.current?.reload()}
          onContentProcessDidTerminate={() => web.current?.reload()}
          allowsBackForwardNavigationGestures
          style={{ flex: 1, backgroundColor: c.background }}
        />
      )}
    </Shell>
  );
}

function Shell({ children, onClose, onReload, progress = 0 }: { children: React.ReactNode; onClose: () => void; onReload?: () => void; progress?: number }) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close organiser tools" style={styles.icon}>
          <X color={c.foreground} size={22} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1, textAlign: "center" }}>Organiser tools</Text>
        <Pressable onPress={onReload} disabled={!onReload} hitSlop={12} accessibilityRole="button" accessibilityLabel="Reload" style={[styles.icon, { opacity: onReload ? 1 : 0 }]}>
          <RotateCw color={c.foreground} size={20} />
        </Pressable>
      </View>
      <View style={[styles.progress, { width: `${progress > 0 && progress < 1 ? progress * 100 : 0}%`, backgroundColor: c.primary }]} />
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progress: { height: 2 },
});
