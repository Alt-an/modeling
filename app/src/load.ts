fetch('/template/panels.html')
.then(r => r.text())
.then(async html => {
    const now = performance.now();
    const Notification = (await import("./panel/notif.ts")).Notification;
    Notification.announce("Loading", "Please wait...");
    window.onerror = function(message, source, lineno, colno, error) {
        const desc = message.toString();
        Notification.error(error?.constructor.name ?? "UnknownError", desc);
        throw error;
    };
    const orgWarn = console.warn;
    console.warn = (...data:any[]) => {
        data.forEach(e => {
            Notification.warn(e.toString());
        });
        orgWarn(...data);
    }
    const panel = document.getElementById('unused-panels')!;
    panel.innerHTML = html;
    panel.hidden = true;
    await import("./script.ts");
    await import("./panel/spawn.ts");
    await import("./panel/mode.ts");
    import("./component/dropdown.ts").then(e => {
        e.Dropdown.attachAllIn(document.body);
        document.body.addEventListener("click", () => e.Dropdown.closeAll(document.body));
    });
    import("./component/radio.ts").then(e => e.Radio.attachAllIn(document.body));
    import("./component/expandable.ts").then(e => e.Expandable.attachAllIn(document.body));
    import("./component/toggleable.ts").then(e => e.Toggleable.attachAllIn(document.body));
    Notification.success(`Loaded in ${performance.now() - now}ms`, "Thanks for waiting, enjoy!");
});