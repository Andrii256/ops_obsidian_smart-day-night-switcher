/**
 * Obsidian augments `HTMLElement.prototype` with DOM helpers at runtime.
 * Recreate the subset the plugin uses so code under test can call them.
 */

interface ElInfo {
	text?: string;
	cls?: string | string[];
	href?: string;
	attr?: Record<string, string | number | boolean | null>;
}

function createEl<K extends keyof HTMLElementTagNameMap>(
	this: HTMLElement,
	tag: K,
	o?: ElInfo | string
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	const info: ElInfo = typeof o === "string" ? { cls: o } : o ?? {};

	if (info.text !== undefined) el.textContent = info.text;
	if (info.cls !== undefined) {
		el.classList.add(...(Array.isArray(info.cls) ? info.cls : [info.cls]));
	}
	if (info.href !== undefined) el.setAttribute("href", info.href);
	for (const [name, value] of Object.entries(info.attr ?? {})) {
		if (value !== null && value !== false) {
			el.setAttribute(name, String(value));
		}
	}

	this.appendChild(el);
	return el;
}

function empty(this: HTMLElement) {
	this.replaceChildren();
}

function setCssStyles(this: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
	Object.assign(this.style, styles);
}

Object.assign(HTMLElement.prototype, { createEl, empty, setCssStyles });

export {};
