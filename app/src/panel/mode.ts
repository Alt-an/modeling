import { Dropdown } from "../component/dropdown";

const container = document.getElementById("mode-selector")!;
const unused = document.getElementById("unused-panels")!;

export const Mode = {
    current: "",
    modes: [] as string[],
    panels: [] as string[][],
    buttons: [] as HTMLButtonElement[],
    clear() {
        (document.querySelectorAll(".panel") as NodeListOf<HTMLElement>).forEach(panel => {
            if(panel.id === "mode") return;
            unused.appendChild(panel);
        });
    },
    set(index:number) {
        if(index > this.modes.length - 1) return;
        this.buttons[index].click();
    },
    setMode(mode: string, panels: string[]) {
        this.current = mode;
        this.clear();
        panels.forEach(id => {
            const panel = document.getElementById(`${id}`)!;
            if(!panel) throw new Error("Undefined panel: "+id)
            this.show(panel);
        });
        document.dispatchEvent(new CustomEvent("modechange", { detail: { mode } }));
        Dropdown.closeAll(document.body);
    },
    show(panel: HTMLElement) {
        const column = panel.getAttribute("data-column")!;
        const target = document.querySelector(`.column[data-column="${column}"]`)!;
        target.appendChild(panel);
    },
    add(icon: string, name: string, panels: string[]) {
        this.modes.push(name);
        this.panels.push(panels);
        const html = /*html*/`
            <div>
                <span></span>
                <div class="icon">${icon}</div>
                ${name}
            </div>
            <div>⌘+${this.modes.length}</div>
        `;
        const button = document.createElement("button");
        button.innerHTML = html;
        button.addEventListener("click", () => this.setMode(name.toLowerCase(), panels));
        container.appendChild(button);
        this.buttons.push(button);
        return button;
    }
}
Mode.add("widgets", "Layout", ["inspector", "hierarchy", "assets", "tool"]).click();
Mode.add("edit", "Modeling", ["inspector", "modeling-option", "modeling"]);
Mode.add("brush", "Material", ["material"]);
Mode.add("texture", "Textures", []);
Mode.add("animation", "Animation", ["inspector", "hierarchy", "tool", "timeline-tool", "timeline-edit", "timeline-hierarchy"]);
Mode.add("add_a_photo", "Shaders", []);
Mode.add("store", "Browses", []);
Mode.add("files", "Files", []);