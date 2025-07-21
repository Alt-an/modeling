export function button(label: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "button";
  btn.onclick = onClick;
  return btn;
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void) {
  const wrapper = document.createElement("label");
  wrapper.className = "toggle";
  
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.onchange = () => onChange(input.checked);

  wrapper.append(input, label);
  return wrapper;
}

export function slider(label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void) {
  const wrapper = document.createElement("label");
  wrapper.className = "slider";

  const title = document.createElement("span");
  title.textContent = label;

  const display = document.createElement("input");
  display.value = `${value}`;

  const input = document.createElement("input");
  input.type = "range";
  input.value = value.toString();
  input.min = min.toString();
  input.max = max.toString();
  input.step = step.toString();
  input.oninput = () => {
    onChange(parseFloat(input.value));
    display.value = `${parseFloat(input.value)}`;
  }
  display.oninput = () => {
    onChange(parseFloat(display.value));
    input.value = `${parseFloat(display.value)}`;
  }

  wrapper.append(title, display, input);
  return wrapper;
}

export function number(label: string, value: number, step: number, onChange: (v: number) => void) {
  const wrapper = document.createElement("label");
  wrapper.className = "number";

  const title = document.createElement("span");
  title.textContent = label;

  const input = document.createElement("input");
  input.type = "number";
  input.value = value.toString();
  input.step = step.toString();
  input.oninput = () => onChange(parseFloat(input.value));

  wrapper.append(title, input);
  return wrapper;
}

export function dropdown<T extends string>(
  label: string,
  options: T[],
  selected: T,
  onChange: (v: T) => void
) {
  const wrapper = document.createElement("label");
  wrapper.className = "dropdown";

  const title = document.createElement("span");
  title.textContent = label;

  const select = document.createElement("select");
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt;
    option.text = opt;
    if (opt === selected) option.selected = true;
    select.appendChild(option);
  }

  select.onchange = () => onChange(select.value as T);

  wrapper.append(title, select);
  return wrapper;
}