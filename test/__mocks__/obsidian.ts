/**
 * Minimal runtime stand-in for the `obsidian` module (aliased in
 * vitest.config.mts). Only what the plugin uses is implemented. Tests are
 * type-checked against the real `obsidian` typings, so keep signatures
 * compatible with them.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export class Plugin {
	app: any;
	manifest: any;
	private intervals: number[] = [];

	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	onunload(): void {}

	/** Like Obsidian's Component: clears registered intervals, then onunload. */
	unload(): void {
		this.intervals.forEach((id) => window.clearInterval(id));
		this.intervals = [];
		this.onunload();
	}

	registerInterval(id: number): number {
		this.intervals.push(id);
		return id;
	}

	async loadData(): Promise<any> {
		return null;
	}

	async saveData(data: any): Promise<void> {}

	addSettingTab(settingTab: PluginSettingTab): void {}

	addCommand(command: any): any {
		return command;
	}
}

/** Tests have no network; mock this (or ../src/locate) to answer. */
export function requestUrl(request: any): any {
	return Promise.reject(new Error(`No network in tests: ${request?.url ?? request}`));
}

export class Notice {
	constructor(message: string | DocumentFragment, duration?: number) {}
}

export class PluginSettingTab {
	app: any;
	plugin: Plugin;
	containerEl: HTMLElement;

	constructor(app: any, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}
}

class TextComponent {
	inputEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement("input");
		this.inputEl.type = "text";
		containerEl.appendChild(this.inputEl);
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	onChange(callback: (value: string) => any): this {
		this.inputEl.addEventListener("input", () => callback(this.getValue()));
		return this;
	}
}

class DropdownComponent {
	selectEl: HTMLSelectElement;

	constructor(containerEl: HTMLElement) {
		this.selectEl = document.createElement("select");
		containerEl.appendChild(this.selectEl);
	}

	addOption(value: string, display: string): this {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = display;
		this.selectEl.appendChild(option);
		return this;
	}

	addOptions(options: Record<string, string>): this {
		for (const [value, display] of Object.entries(options)) {
			this.addOption(value, display);
		}
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	getValue(): string {
		return this.selectEl.value;
	}

	onChange(callback: (value: string) => any): this {
		this.selectEl.addEventListener("change", () => callback(this.getValue()));
		return this;
	}
}

export class ButtonComponent {
	buttonEl: HTMLButtonElement;

	constructor(containerEl: HTMLElement) {
		this.buttonEl = document.createElement("button");
		containerEl.appendChild(this.buttonEl);
	}

	setButtonText(name: string): this {
		this.buttonEl.textContent = name;
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		return this;
	}

	setTooltip(tooltip: string): this {
		this.buttonEl.setAttribute("aria-label", tooltip);
		return this;
	}

	onClick(callback: (evt: MouseEvent) => any): this {
		this.buttonEl.addEventListener("click", callback);
		return this;
	}
}

export class ToggleComponent {
	toggleEl: HTMLInputElement;

	constructor(containerEl: HTMLElement) {
		this.toggleEl = document.createElement("input");
		this.toggleEl.type = "checkbox";
		containerEl.appendChild(this.toggleEl);
	}

	setValue(on: boolean): this {
		this.toggleEl.checked = on;
		return this;
	}

	getValue(): boolean {
		return this.toggleEl.checked;
	}

	onChange(callback: (value: boolean) => any): this {
		this.toggleEl.addEventListener("change", () => callback(this.getValue()));
		return this;
	}
}

/** Mirrors Obsidian's `.setting-item` markup so tests can query by class. */
export class Setting {
	settingEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		const div = (cls: string, parent: HTMLElement) => {
			const el = document.createElement("div");
			el.className = cls;
			parent.appendChild(el);
			return el;
		};
		this.settingEl = div("setting-item", containerEl);
		const infoEl = div("setting-item-info", this.settingEl);
		this.nameEl = div("setting-item-name", infoEl);
		this.descEl = div("setting-item-description", infoEl);
		this.controlEl = div("setting-item-control", this.settingEl);
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string): this {
		this.descEl.textContent = desc;
		return this;
	}

	setHeading(): this {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}

	addText(cb: (component: TextComponent) => any): this {
		cb(new TextComponent(this.controlEl));
		return this;
	}

	addToggle(cb: (component: ToggleComponent) => any): this {
		cb(new ToggleComponent(this.controlEl));
		return this;
	}

	addButton(cb: (component: ButtonComponent) => any): this {
		cb(new ButtonComponent(this.controlEl));
		return this;
	}

	addDropdown(cb: (component: DropdownComponent) => any): this {
		cb(new DropdownComponent(this.controlEl));
		return this;
	}
}

export function debounce<T extends unknown[], V>(
	cb: (...args: [...T]) => V,
	timeout = 0,
	resetTimer = false
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pendingArgs: T | null = null;

	const run = () => {
		timer = null;
		if (pendingArgs === null) return;
		const args = pendingArgs;
		pendingArgs = null;
		return cb(...args);
	};

	const debounced = (...args: [...T]) => {
		pendingArgs = args;
		if (timer !== null) {
			if (!resetTimer) return debounced;
			clearTimeout(timer);
		}
		timer = setTimeout(run, timeout);
		return debounced;
	};
	debounced.cancel = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		pendingArgs = null;
		return debounced;
	};
	debounced.run = run;

	return debounced;
}
