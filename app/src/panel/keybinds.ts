import { Editor } from "./editor";
import { Mode } from "./mode";
import { Modeling } from "./modeling";
import { Tool } from "./tool";
import { getElement } from "./util";
import { Viewport } from "./viewport";
import * as Vertex from './modeling/vertex';

export const Keybinds = {
  init() {
    document.addEventListener("keydown", (e) => {
      const active = document.activeElement;
      if (active?.getAttribute("contenteditable") === "true") {
        // ESC: blur the editable field
        if (e.key === "Escape") {
          (active as HTMLElement).blur();
          e.preventDefault();
        }

        // ENTER: blur instead of insert newline
        if (e.key === "Enter") {
          (active as HTMLElement).blur();
          e.preventDefault();
        }

        // prevent rest of keybinds while editing
        return;
      }
      
      const modifier = e.ctrlKey || e.metaKey; // support Mac too

      if (modifier) {
        switch (e.key) {
          case '1': Mode.set(0); break;
          case '2': Mode.set(1); break;
          case '3': Mode.set(2); break;
          case '4': Mode.set(3); break;
          case '5': Mode.set(4); break;
          case '6': Mode.set(5); break;
          case '7': Mode.set(6); break;
          case '8': Mode.set(7); break;
          case '9': Mode.set(8); break;
        }
        return;
      }
      if(e.shiftKey) {
        switch(Mode.current) {
          case "modeling": switch(e.key) {
            case '!': Modeling.inwardScaling(); break;
          }
        }
        return;
      }
      switch(Mode.current) {
        case "layout": switch (e.key) {
          case 'Backspace': Editor.delete(); break;
          case '4': Viewport.focus(); break;
          case '1': Tool.translate(); break;
          case '2': Tool.rotate(); break;
          case '3': Tool.scale(); break;

          case '=': getElement("#add-object-dropdown > .dropdown-selected").click()
        } break;
        case "animation": switch (e.key) {
          case 'Backspace': Editor.delete(); break;
          case 'f': Viewport.focus(); break;
          case 't': Tool.translate(); break;
          case 'r': Tool.rotate(); break;
          case 's': Tool.scale(); break;

          case '=': getElement("#add-object-dropdown > .dropdown-selected").click()
        } break;
        case "modeling": switch (e.key) {
          case 'f': { Viewport.focus(); Vertex.update()} break;
          case 'e': Modeling.extrude(); break;
          case 'i': Modeling.inset(); break;
          case 'b': Modeling.bevel(); break;
          case 'k': Modeling.knife(); break;
          case 'm': Modeling.merge(); break;

          case '1': Modeling.vertex(); break;
          case '2': Modeling.edge(); break;
          case '3': Modeling.face(); break;
        } break;
      }
    });
  }
}