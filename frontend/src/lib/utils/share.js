let isShareInProgress = false;

const FLUTTER_CHANNEL_NAMES = [
  "ShareChannel",
  "FlutterShareChannel",
  "ZapooShareChannel",
  "NativeShareChannel",
];

const FLUTTER_HANDLER_NAMES = ["share", "nativeShare"];

const normalizeSharePayload = ({ title = "", text = "", url = "" } = {}) => {
  const safeTitle = String(title || "").trim();
  const safeText = String(text || "").trim();
  const safeUrl = String(url || "").trim();
  const message = [safeTitle, safeText, safeUrl]
    .filter(Boolean)
    .join("\n");
  return {
    title: safeTitle,
    text: safeText,
    url: safeUrl,
    message,
    type: "share",
  };
};

export const isFlutterShareBridgeAvailable = () => {
  if (typeof window === "undefined") return false;

  // webview_flutter: window.<channelName>.postMessage(payload)
  const channelBridgeExists = FLUTTER_CHANNEL_NAMES.some((channelName) => {
    const channel = window[channelName];
    return !!channel && typeof channel.postMessage === "function";
  });
  if (channelBridgeExists) return true;

  // iOS WKWebView handlers
  const iosHandlers = window.webkit?.messageHandlers;
  if (iosHandlers) {
    const hasIOSBridge = FLUTTER_CHANNEL_NAMES.some((channelName) => {
      return typeof iosHandlers?.[channelName]?.postMessage === "function";
    });
    if (hasIOSBridge) return true;
  }

  // flutter_inappwebview handler bridge
  return typeof window.flutter_inappwebview?.callHandler === "function";
};

const shareViaFlutterBridge = async (payload) => {
  // 1) webview_flutter JS channels
  for (const channelName of FLUTTER_CHANNEL_NAMES) {
    const channel = window[channelName];
    if (channel && typeof channel.postMessage === "function") {
      channel.postMessage(JSON.stringify(payload));
      return true;
    }
  }

  // 2) iOS WKWebView message handlers
  const iosHandlers = window.webkit?.messageHandlers;
  if (iosHandlers) {
    for (const channelName of FLUTTER_CHANNEL_NAMES) {
      const handler = iosHandlers?.[channelName];
      if (handler && typeof handler.postMessage === "function") {
        handler.postMessage(payload);
        return true;
      }
    }
  }

  // 3) flutter_inappwebview bridge
  if (typeof window.flutter_inappwebview?.callHandler === "function") {
    for (const handlerName of FLUTTER_HANDLER_NAMES) {
      const response = await window.flutter_inappwebview.callHandler(handlerName, payload);
      if (response?.success !== false) {
        return true;
      }
    }
  }

  return false;
};

const canUseWebShare = (payload) => {
  const webPayload = {
    title: payload?.title || "",
    text: payload?.text || "",
    url: payload?.url || "",
  };

  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }

  // canShare is optional. If present and returns false, skip navigator.share.
  if (typeof navigator.canShare === "function") {
    try {
      return navigator.canShare(webPayload);
    } catch {
      // If canShare throws for payload shape, still allow share attempt.
      return true;
    }
  }
  return true;
};

const copyToClipboard = async (value) => {
  const text = String(value || "").trim();
  if (!text) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
};

/**
 * Share utility with strict fallback priority:
 * 1) Flutter native bridge
 * 2) Web Share API
 * 3) Clipboard copy
 */
export const handleShare = async ({ title = "", text = "", url = "" } = {}) => {
  if (isShareInProgress) {
    return { status: "in_progress" };
  }

  isShareInProgress = true;
  const payload = normalizeSharePayload({ title, text, url });
  let webShareError = null;

  try {
    if (isFlutterShareBridgeAvailable()) {
      try {
        const shared = await shareViaFlutterBridge(payload);
        if (shared) {
          return { status: "shared_flutter" };
        }
      } catch (error) {
        webShareError = error;
      }
    }

    if (canUseWebShare(payload)) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        return { status: "shared_web" };
      } catch (error) {
        if (error?.name === "AbortError") {
          return { status: "cancelled" };
        }
        webShareError = error;
      }
    }

    const fallbackText = payload.url || payload.text || payload.title;
    const copied = await copyToClipboard(fallbackText);
    if (copied) {
      return { status: "copied" };
    }

    return { status: "error", error: webShareError || new Error("Share failed") };
  } catch (error) {
    return { status: "error", error };
  } finally {
    // Tiny cooldown prevents rapid double taps from opening multiple sheets.
    setTimeout(() => {
      isShareInProgress = false;
    }, 250);
  }
};
