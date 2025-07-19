fetch('/template/panels.html')
.then(r => r.text())
.then(async html => {
    const now = performance.now();
    const Notification = (await import("./panel/notif.ts")).Notification;
    Notification.announce("Loading", "Please wait...", 2000);
    window.onerror = function (message, source, lineno, colno, error) {
        const desc = message.toString();
        const name = error?.constructor?.name ?? "UnknownError";

        // Extract just the filename from the source URL
        const shortSource = source ? source.split('/').pop() : "unknown";

        // Clean stack: remove full URL paths, keep just filename:line:col
        let cleanStack = error?.stack ?? "";
        if (cleanStack) {
            cleanStack = cleanStack
            .split('\n')
            .map(line => line.replace(/^.*\/([^\/]+:\d+:\d+)$/, '    at $1'))
            .join('\n');
        }

        Notification.error(name, desc);

        if (cleanStack) {
            console.error(`${desc}\n\tat ${shortSource}:${lineno}:${colno}\n`+"Stack trace:\n" + cleanStack);
        } else console.error(`$${desc}\n\tat ${shortSource}:${lineno}:${colno}`);
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
    Notification.success(`Loaded in ${performance.now() - now}ms`, "Thanks for waiting, enjoy!", 2000);
});