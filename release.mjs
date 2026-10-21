import { execFileSync } from "child_process";
import { readFileSync } from "fs";

// usage: npm run release -- <patch|minor|major>
const bump = process.argv[2];
if (!["patch", "minor", "major"].includes(bump)) {
	console.error("Usage: npm run release -- <patch|minor|major>");
	process.exit(1);
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const read = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (msg) => {
	console.error(msg);
	process.exit(1);
};

// the community directory reads manifest.json from the default branch
if (read("git", ["branch", "--show-current"]) !== "master") {
	fail("Releases must be made from master.");
}
if (read("git", ["status", "--porcelain"])) {
	fail("Working tree is not clean.");
}
run("git", ["fetch", "origin", "master"]);
if (read("git", ["rev-parse", "HEAD"]) !== read("git", ["rev-parse", "origin/master"])) {
	fail("Local master is not in sync with origin/master.");
}

// the remote may use an SSH host alias, which gh can't resolve, so pass owner/repo explicitly
const remote = read("git", ["remote", "get-url", "origin"]);
const repo = remote.match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/)?.[1];
if (!repo) fail(`Can't parse owner/repo from remote: ${remote}`);

run("npm", ["run", "lint"]);
run("npm", ["test"]);
run("npm", ["run", "build"]);

// bumps package.json, syncs manifest.json/versions.json via the "version" hook, commits and tags
run("npm", ["version", bump]);
const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));

run("git", ["push", "origin", "master", "--follow-tags"]);
run("gh", [
	"release", "create", version,
	"main.js", "manifest.json",
	"--repo", repo,
	"--title", version,
	"--generate-notes",
]);
