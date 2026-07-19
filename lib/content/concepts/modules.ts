import { Concept } from "../../content"

export const modules: Concept = {
	slug: "modules",
	name: "Modules, go.mod, and the toolchain",
	tagline:
		"MVS picks the minimum version that satisfies everyone, not the latest, and GOTOOLCHAIN=local makes a dependency that needs a newer Go fail loudly instead of downloading one behind your back.",
	summary:
		"A module is a tree of packages versioned as a unit, defined by <code>go.mod</code>. Three things about it routinely surprise people coming from npm or Maven. Version selection is <b>minimal</b>: Go picks the lowest version that satisfies all requirements, so builds do not drift when a new release lands. <code>go.sum</code> is a <b>tamper check, not a lockfile</b>: it records hashes to detect a changed download, but it does not decide which versions you get. And since Go 1.21 the <code>go.mod</code> can pin a <b>toolchain</b>, so the version of Go that builds your code is itself a dependency, which is why this repo runs everything with <code>GOTOOLCHAIN=local</code>.",
	mentalModel:
		"Separate three questions that npm answers with one file. <b>Which versions?</b> is answered by <code>go.mod</code> plus Minimal Version Selection: each module states a minimum, and the build takes the maximum of those minimums, per dependency. That is not \"latest\", it is \"the oldest version that makes everyone's floor\", and it is deterministic without a lockfile because nothing consults the network for a newer release. <b>Are the bits authentic?</b> is answered by <code>go.sum</code>, which is a set of expected hashes: it cannot change your version, it can only shout if the code behind a version you already chose is not the code you first downloaded. <b>Which compiler?</b> is answered by the <code>go</code> and <code>toolchain</code> lines plus <code>GOTOOLCHAIN</code>, and the honest default will silently fetch a newer Go if a dependency demands one, which <code>GOTOOLCHAIN=local</code> switches off.",
	retrievalPrompts: [
		"Your app requires foo v1.2.0. You add a dependency bar, and bar requires foo v1.5.0. Latest foo is v1.9.0. After go mod tidy, which foo do you build against, and why not v1.9.0? || v1.5.0. Minimal Version Selection takes the maximum of the required minimums, which are v1.2.0 (yours) and v1.5.0 (bar's), so it picks v1.5.0. It does not jump to v1.9.0 even though v1.9.0 exists, because MVS never selects a version nobody asked for: 'latest' is a thing you opt into with go get, not the default the build reaches for. go list -m -u foo will show 'v1.5.0 [v1.9.0]', reporting the available upgrade without taking it. This is why a Go build is reproducible from go.mod alone: adding a dependency can only ever raise a version, never surprise you with whatever shipped this morning.",
		"A teammate says 'delete go.sum, it's just a lockfile, go.mod already pins the versions.' What breaks, and what did they misunderstand? || go.sum is not a lockfile, it is a checksum database. go.mod already fully determines which versions you build (that is what MVS reads), so go.sum does not pin anything. What it does is record the expected hash of each module's zip and go.mod, so if the code behind v1.5.0 is ever replaced (a hijacked tag, a compromised proxy, a man-in-the-middle), the next download fails with a SECURITY ERROR: 'does NOT match an earlier download recorded in go.sum'. Delete it and you lose tamper detection, not version pinning. The two jobs npm fuses into package-lock.json, Go splits: go.mod selects, go.sum verifies.",
		"go install golang.org/x/perf/cmd/benchstat@latest fails on your machine with 'requires go >= 1.25.0 (running go 1.22.1; GOTOOLCHAIN=local)'. Your coworker runs the same command and it succeeds. Neither of you upgraded Go. What differs? || GOTOOLCHAIN. This repo sets GOTOOLCHAIN=local, which tells the go command to use only the Go installed on the machine (1.22.1) and to refuse when a module's go directive demands newer. The coworker is on the default (GOTOOLCHAIN=auto), so when benchstat's module said it needed go 1.25.0, their go command silently downloaded a go1.25 toolchain from the module mirror and used it. Same command, opposite outcome, because one machine treats the compiler version as a hard local constraint and the other treats it as just another dependency to fetch. 'local' is the setting that makes 'why is there a second Go on my disk' never happen.",
	],
	codeExample: `package main

import (
	"fmt"
	"runtime"
	"runtime/debug"
)

func main() {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		fmt.Println("no build info: not built in module mode")
		return
	}

	// Both of these report the toolchain that compiled the binary. Neither one
	// reports the ` + "`go`" + ` directive in go.mod, which is a different number.
	fmt.Println("toolchain:", runtime.Version(), "| bi.GoVersion:", bi.GoVersion)

	fmt.Println("module:", bi.Main.Path)
	// "(devel)" for anything you built yourself. It is a real version only when
	// the binary came from ` + "`go install <module>@<version>`" + `.
	fmt.Printf("version: %q\\n", bi.Main.Version)

	for _, d := range bi.Deps {
		if d.Replace != nil {
			fmt.Printf("dep: %s %s => %s %s\\n", d.Path, d.Version, d.Replace.Path, d.Replace.Version)
			continue
		}
		fmt.Printf("dep: %s %s\\n", d.Path, d.Version)
	}

	// The go command stamps VCS data into ` + "`go build`" + ` output on its own. You do
	// not need -ldflags to get the commit into your binary.
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision", "vcs.modified", "GOOS", "GOARCH":
			fmt.Printf("%s = %s\\n", s.Key, s.Value)
		}
	}
}`,
	codeExplanation:
		"A <code>package main</code> cannot demonstrate MVS or <code>go.sum</code>, those live in the tooling, so this example does the real thing a module lets you do at runtime: read your own build metadata. Built with <code>go build</code> inside a git repo, it printed <code>toolchain: go1.22.1 | bi.GoVersion: go1.22.1</code>, then <code>module: vcsdemo</code>, <code>version: \"(devel)\"</code>, and crucially <code>vcs.revision = bc81133...</code> with <code>vcs.modified = true</code>. Two things are worth pulling out. First, <code>bi.GoVersion</code> is the <b>toolchain</b> that compiled the binary, not the <code>go</code> directive in <code>go.mod</code>: I confirmed this by building the identical source with go1.24.10 against a <code>go.mod</code> that said <code>go 1.22</code>, and <code>bi.GoVersion</code> printed <code>go1.24.10</code>, following the compiler, not the file. Second, the <code>vcs.revision</code> and <code>vcs.modified</code> lines appeared with no <code>-ldflags</code> and no build script: the go command stamps the commit and the dirty flag into <code>go build</code> output automatically. Run the same program with <code>go run</code> instead and those two lines vanish, because <code>go run</code> does not stamp VCS data. That is your version endpoint for free from a real build, and a reminder that <code>go run</code> is not <code>go build</code> plus execute. On the Go Playground this prints its own <code>(devel)</code> build info with no VCS settings, since there is no repo.",
	designRationale:
		"Every surprising thing here is Go optimising for reproducibility and supply-chain safety over convenience, usually in reaction to a specific pain the ecosystem had already felt. <b>MVS</b> is the deep one. npm and Cargo solve version selection with a SAT-style solver that finds a satisfying assignment and, left alone, drifts toward the newest compatible release, which is why a lockfile is mandatory: without it, two <code>install</code>s a week apart give different trees. Go's designer Russ Cox argued the opposite: make the algorithm pick the <b>minimum</b> that satisfies the constraints, and the build is reproducible from <code>go.mod</code> alone, no lockfile required, because upgrading is always an explicit act (<code>go get</code>) rather than a passive consequence of time passing. The cost is that you do not automatically get bug fixes; the benefit is that you never get a surprise regression either, and CI today matches CI last month. <b><code>go.sum</code></b> then covers the gap MVS leaves: knowing which version is not the same as knowing the bits behind that version are unchanged, so <code>go.sum</code> records hashes and the <code>sum.golang.org</code> transparency log makes those hashes globally consistent, which is how Go detects a retroactively edited tag. <b>Semantic import versioning</b> (the <code>/v2</code> in the import path for major version 2+) exists so that v1 and v2 of a library are different packages that can coexist in one build, dodging the diamond-dependency deadlock where two dependencies need incompatible majors of a third. And the <b><code>toolchain</code> line with <code>GOTOOLCHAIN</code></b>, added in Go 1.21, finishes the thought: if the compiler version can change your program's behaviour (it can, as the Go 1.23 timer semantics show, gated on the <code>go</code> directive), then the compiler is a dependency and should be declared. The default <code>GOTOOLCHAIN=auto</code> will fetch the required Go for you, which is friendly for a laptop and alarming for a build server, so a reproducible environment sets <code>GOTOOLCHAIN=local</code> and accepts a loud failure (<code>requires go >= 1.25.0 (running go 1.22.1; GOTOOLCHAIN=local)</code>) over a silent second compiler appearing on disk. This repo made that exact choice.",
	commonMistakes: [
		{
			title: "Thinking go get pulls the latest of everything",
			body: "Adding or building a dependency selects the minimum version that satisfies the requirements, not the newest published. A build stays put until you deliberately raise a version with <code>go get pkg@latest</code> or <code>go get -u</code>. This is a feature, but it bites people who expect <code>npm install</code> semantics and wonder why a bug fix released this morning is not in their build: it is not, and it will not be until someone asks for it.",
		},
		{
			title: "Treating go.sum as a lockfile",
			body: "<code>go.sum</code> does not pin versions, <code>go.mod</code> does that through MVS. <code>go.sum</code> stores hashes to detect tampering, so deleting it does not float your versions, it removes your only signal that a module's contents changed under a tag you already trusted. Committing it is not optional, and a <code>go.sum</code> conflict in a merge is telling you two branches pulled different bits for some version, which is worth reading rather than blindly regenerating.",
		},
		{
			title: "Publishing v2 without changing the module path",
			body: "Go encodes the major version into the import path for v2 and up: the module must be <code>example.com/foo/v2</code> in <code>go.mod</code> and imported as such. Tag <code>v2.0.0</code> while the path still says <code>example.com/foo</code> and consumers get baffling errors, because from Go's view v2 without the <code>/v2</code> is not a new major, it is a broken v1. The path suffix is the whole mechanism that lets v1 and v2 coexist in one build.",
		},
		{
			title: "Leaving a replace directive in a published module",
			body: "<code>replace example.com/foo => ../foo</code> is the right tool for local development against an unpublished change, but <code>replace</code> directives in your <code>go.mod</code> are ignored by anyone who imports your module: they only apply to the main module being built. Ship a library that secretly depends on a local <code>replace</code> and it builds for you and fails for everyone else, because the replacement they never see is doing load-bearing work. Use it to develop, remove it before you tag.",
		},
		{
			title: "Relying on GOTOOLCHAIN=auto on a build server",
			body: "The default will silently download and run a newer Go when a dependency's <code>go</code> directive requires one, so a routine <code>go mod tidy</code> can pull a toolchain your build server never vetted and produce a binary compiled by a compiler you did not choose. On any machine where reproducibility or supply-chain control matters, set <code>GOTOOLCHAIN=local</code> and let it fail loudly, then decide deliberately whether to upgrade Go rather than having the decision made for you at build time.",
		},
	],
	relatedSlugs: ["packages", "init-lifecycle", "time", "error-handling"],
}
