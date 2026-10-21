// Stop hook: run type-check and lint; if either fails, block the stop so Claude fixes it.
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = raw ? JSON.parse(raw) : {};

// Already continuing because of this hook once — don't loop forever.
if (input.stop_hook_active) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const checks = [
	{ name: "TypeScript check", args: ["tsc", "-noEmit", "-skipLibCheck"] },
	{ name: "ESLint", args: ["eslint", "src"] },
];

const failures = [];
for (const { name, args } of checks) {
	const res = spawnSync("npx", args, { cwd, encoding: "utf8" });
	if (res.status !== 0) {
		failures.push(`${name} failed:\n${res.stdout}${res.stderr}`);
	}
}

if (failures.length) {
	console.error(failures.join("\n"));
	process.exit(2);
}
