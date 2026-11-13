/* Service worker CRM Sales Dekoruma — shell aplikasi saja.
   Data Firestore & panggilan eksternal tidak pernah di-cache di sini. */
const CACHE = "crm-sales-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        return r;
      }).catch(function () { return caches.match("./index.html"); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (hit) { return hit || fetch(e.request); })
  );
});

/* ---------- Notifikasi push (Firebase Cloud Messaging) ----------
   Pengirim terjadwal mengirim pesan data-only; service worker ini
   yang menampilkan notifikasinya. Bentuk payload dipertahankan
   defensif: dukung pesan data-only maupun notification. */
function pushContent(e) {
  var raw = null;
  try { raw = e.data ? e.data.json() : null; } catch (err) { raw = null; }
  if (!raw && e.data) {
    try { raw = { body: e.data.text() }; } catch (err2) { raw = null; }
  }
  raw = raw || {};
  var d = raw.data || {};
  var n = raw.notification || {};
  return {
    title: d.title || n.title || raw.title || "CRM Sales Dekoruma",
    body: d.body || n.body || raw.body || "Ada follow-up yang perlu dihubungi.",
    url: d.url || n.click_action || "./index.html",
    tag: d.tag || "crm-followup"
  };
}
function resolvePushUrl(u) {
  try { return new URL(u, self.location.href).href; }
  catch (err) { return new URL("./index.html", self.location.href).href; }
}

self.addEventListener("push", function (e) {
  var c = pushContent(e);
  e.waitUntil(
    self.registration.showNotification(c.title, {
      body: c.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: c.tag,
      renotify: true,
      data: { url: resolvePushUrl(c.url) }
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || resolvePushUrl("./index.html");
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.location.origin) === 0 && "focus" in list[i]) {
          if (list[i].navigate) { try { list[i].navigate(url); } catch (err) {} }
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
