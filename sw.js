self.addEventListener("push", (event) => {
  let data = { title: "にこぽけ", body: "新しい写真です", url: "/#/feed" };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch {
    /* keep default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "にこぽけ", {
      body: data.body || "",
      data: { url: data.url || "/#/feed" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/#/feed";
  event.waitUntil(self.clients.openWindow(url));
});
