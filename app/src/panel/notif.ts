const panel = document.getElementById("notif-container")!;

const Config = {
    intro: 1.0,
    outro: 1.25,
    delete: 0.5,
    timingFunction: `cubic-bezier(0.900, -0.700, 1.000, 1.000)`
}

export const Notification = {
    send: (head:string, desc?:string, duration:number = 7500, color:string = "#ffffff", icon:string = "info") => {
        const container = document.createElement("div");
        container.innerHTML = /*html*/`
            <div class="content">
                <div class="icon">${icon}</div>
                <div class="text">
                    <div class="title">${head}</div>
                    ${desc !== undefined ? `<div class="description">${desc}</div>` : ``}
                </div>
                <div style="transition: width ${Config.intro / 2}s" class="cover"></div>
            </div>
            <div style="transition: width ${duration}ms linear" class="bar"></div>
        `; // May reconsider..
        container.style.transform = `translateX(100%)`;
        container.style.transition = `transform ${Config.intro / 2}s ease-out`;
        container.style.setProperty('--color', color);
        panel.appendChild(container);
        const cover = container.querySelector(".cover")! as HTMLElement;
        const bar = container.querySelector(".bar")! as HTMLElement;
        setTimeout(() => {
            container.style.transform = `translateX(0)`;
        });
        const height = container.getBoundingClientRect().height;
        setTimeout(() => {
            cover.style.width = `5%`;
            bar.style.width = `0`;
            container.style.transition = `transform ${Config.outro}s ${Config.timingFunction}`;
            setTimeout(() => {
                cover.style.width = `100%`;
                setTimeout(() => {
                    container.style.transform = `translateX(100%)`;
                    container.style.height = `${height}px`;
                    setTimeout(() => {
                        container.style.transition = `height ${Config.delete}s`;
                        container.style.height = `0`;
                        setTimeout(() => {panel.removeChild(container)}, Config.delete * 1000);
                    }, Config.outro * 1000);
                }, Config.intro * 500);
            }, duration);
        }, Config.intro / 2 * 1000);
    },
    log: (head:string, desc?:string, duration?:number) => { Notification.send(head, desc, duration, "#ffffff", "info") },
    announce: (head:string, desc?:string, duration?:number) => { Notification.send(head, desc, duration, "#00afdf", "brightness_alert") },
    warn: (head:string, desc?:string, duration?:number) => { Notification.send(head, desc, duration, "#efcf10", "warning") },
    error: (head:string, desc?:string, duration?:number) => { Notification.send(head, desc, duration, "#ef3010", "bug_report") },
    success: (head:string, desc?:string, duration?:number) => { Notification.send(head, desc, duration, "#20df3f", "check_circle") },
}
