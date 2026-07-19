import { Project } from "../../content"

export const cliRenamer: Project = {
	slug: "cli-renamer",
	name: "File renamer CLI",
	tagline: "Batch-rename files with patterns, flags, and dry-run mode.",
	code: "CLI",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "5–7 hours",
	tags: ["os", "flag", "filepath", "error-handling"],
	lab: {
		path: "labs/cli-renamer",
		command: "go run ./check",
		summary: {
			en: "A runnable self-check, not a test suite: it builds your renamer, runs it against fixture folders, and shows what your program did next to what was expected.",
		},
	},
	mentalModels: [
		"input parsing boundary",
		"stateless transformation",
		"separation of config and execution",
		"explicit error propagation",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "You could write this program in twenty minutes as one function. Do not. The point of the first project is not the renaming, it is the shape: input is validated at one boundary and never re-checked after, the transformation is a pure function that never touches a disk, and execution is the only layer allowed to change anything. Every later project on this site, up to the Tier 3 services, is that same shape with more machinery bolted on. Getting it into your hands now is why this takes an evening instead of twenty minutes.",
			},
		},
		{
			type: "text",
			value: {
				en: "A CLI reads flags from the user, validates them into a Config struct, walks a directory, applies a pure name transform to each file, then either prints a preview or executes the renames. Nothing is done until input is fully validated.",
			},
		},
		{
			type: "code",
			value: `os.Args → flag.Parse → *Config → os.ReadDir → transformName → rename / print`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `main.go
 ├── parseFlags() (*Config, error)
 ├── run(cfg *Config) error
 │    ├── os.ReadDir(cfg.Dir)
 │    ├── transformName(name, pattern string) string
 │    └── os.Rename / fmt.Println (dry-run)
 └── os.Exit(1) on any error`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Refuse bad input at the boundary" },
			uses: ["error-handling", "pointers"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A renamer that starts work before it checks its arguments is a renamer that renames half a directory and then dies. There is no undo. The reason to validate everything up front is not tidiness, it is that a partial rename is unrecoverable: you no longer know which files were the originals.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The flag package registers named flags and writes their values into pointers. After flag.Parse() the pointers hold what the user typed. Go's convention is to validate all input at the boundary (early, explicitly, before any work begins) and return a descriptive error rather than panicking or silently using bad values. Once a *Config exists, the rest of the program trusts it and never re-checks.",
					},
					pattern: `// register → parse → validate
dir     := flag.String("dir", ".", "directory to scan")
verbose := flag.Bool("verbose", false, "print each rename")
flag.Parse()

if *dir == "" {
    return nil, fmt.Errorf("--dir is required")
}
info, err := os.Stat(*dir)
if err != nil {
    return nil, fmt.Errorf("invalid --dir: %w", err)
}
if !info.IsDir() {
    return nil, fmt.Errorf("%s is not a directory", *dir)
}`,
					example: {
						en: "An image compressor registers --input (path), --quality (int, 1–100), and --output. It validates that the input file exists, that quality is in range, and that the output directory is writable, all before touching any image data.",
					},
					task: {
						en: 'Define --dir (default "."), --pattern (required string), and --dry-run (bool). After flag.Parse, validate that --dir exists and is a directory using os.Stat. Collect all flag and validation errors into a single descriptive message. Return a *Config on success.',
					},
					hints: [
						{
							label: "os.Stat",
							value: "Returns (fs.FileInfo, error). Call .IsDir() on the FileInfo to distinguish files from directories.",
						},
						{
							label: "error wrapping",
							value: 'fmt.Errorf("invalid dir: %w", err) preserves the original error for callers that need to inspect it with errors.Is or errors.As.',
						},
						{
							label: "why one message, not three",
							value: "Collecting problems into a single error means the user fixes the whole command line in one round trip instead of rerunning three times to discover three mistakes. strings.Join on a []string of problems is enough; you do not need errors.Join for this.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command: "go run ./check",
					expect: {
						en: 'The last three scenarios (missing --pattern, a --dir that does not exist, a --dir that is a file) should now say "your program refused (exit code 1), as expected" and "result: matches". The first four still will not match: you have not written the transform yet, so nothing gets renamed. That is the expected shape of progress here, not a failure.',
					},
					labPath: "labs/cli-renamer/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the os.Stat check from parseFlags, keeping only the --pattern check. Rerun the check.",
					},
					observe: {
						en: "The two bad-directory scenarios still pass. Your program still exits 1 on both.",
					},
					why: {
						en: "os.ReadDir fails on a missing path and on a regular file too, so the program still errors out, just later and with a message written by the standard library instead of by you. This is worth seeing because it is the reason boundary validation feels optional at this size: the failure happens either way. It stops feeling optional when run() has already renamed four files before hitting the bad path. The boundary is not there to catch the error, it is there to catch it before anything has changed on disk.",
					},
				},
			],
			retrievalPrompt:
				"Why validate --dir at the boundary when os.ReadDir would fail on a bad path anyway? || Because ReadDir fails partway through, after the program may already have renamed files, and there is no undo. Validating first means a bad argument costs you nothing. It also puts the error message in your voice rather than the standard library's.",
		},
		{
			n: "02",
			heading: { en: "Write a pure name transform" },
			uses: ["strings-bytes-runes"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The naming rules are where the bugs live: an extension eaten, a double prefix on rerun, a capital letter that survives when it should not. If that logic is tangled with os.Rename you can only test it by renaming real files and looking at them. Pull it out and it becomes a function you can reason about by reading, and check by calling.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A pure function has no side effects and always returns the same output for the same input. Transformation logic should be pure: it takes a string in, returns a string out, never touches the filesystem. Pure functions are trivially testable: just call them with inputs and compare outputs.",
					},
					pattern: `// pure: input in, output out, no I/O
func slugify(s string) string {
    s = strings.TrimSpace(s)
    s = strings.ToLower(s)
    return strings.ReplaceAll(s, " ", "-")
}`,
					example: {
						en: "A URL shortener's slug generator takes a blog post title, strips leading/trailing whitespace, lowercases it, replaces spaces with hyphens, and removes non-alphanumeric characters, all without touching a database or filesystem.",
					},
					task: {
						en: 'Write transformName(name, pattern string) string. It must: replace spaces with underscores, convert the base name to lowercase, and prepend pattern + "_" when pattern is non-empty. The file extension must be preserved exactly as-is. "My File.TXT" with pattern "backup" → "backup_my_file.TXT".',
					},
					hints: [
						{
							label: "extension",
							value: "filepath.Ext(name) returns the extension including the dot. strings.TrimSuffix(name, ext) gives you the base.",
						},
						{
							label: "last dot, not first",
							value: 'filepath.Ext("Q3 Report.Final.PDF") returns ".PDF", not ".Final.PDF". It scans from the end. If you split on the first dot instead, that fixture is where you will find out.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command:
						'// temporarily, at the top of main():\nfmt.Println(transformName("My File.TXT", "backup"))\nfmt.Println(transformName("Q3 Report.Final.PDF", "backup"))\n\n// then:\ngo run ./starter --dir . --pattern backup',
					expect: {
						en: "backup_my_file.TXT and backup_q3_report.final.PDF, printed before anything else happens. Note what survived: .TXT keeps its capitals because it is the extension, while Final became final because it is part of the base name. Delete the two lines once you have seen them.",
					},
					note: {
						en: "A pure function is the one thing you can check without the rest of the program existing. That is the whole argument for keeping it pure.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: 'Lowercase the whole name instead of just the base: return strings.ToLower(pattern + "_" + name). Rerun the two prints.',
					},
					observe: {
						en: "backup_my_file.txt. The extension is now lowercase too, and the check's scenarios 1 and 4 would reject it.",
					},
					why: {
						en: "On Windows and macOS the filesystem is usually case-insensitive, so the rename would appear to work on your machine and produce a different filename on a Linux server, where .TXT and .txt are two distinct files. This is the single most common way a rename script that passed locally corrupts a deploy. Splitting the extension off before touching case is not a style preference, it is the line that keeps the program portable.",
					},
				},
			],
			retrievalPrompt:
				'What does filepath.Ext("archive.tar.gz") return, and why does it matter here? || ".gz". It scans backwards to the last dot, so the base is "archive.tar". If you had split on the first dot you would get base "archive" and extension ".tar.gz", and the lowercasing would then eat the .tar. The fixture Q3 Report.Final.PDF exists in the lab to catch exactly this.',
		},
		{
			n: "03",
			heading: { en: "Read the directory and decide what to rename" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A directory is not a list of files. It holds subdirectories, and on a bad day it holds a subdirectory whose name looks exactly like a file. Deciding what you will touch, before you touch it, is what separates this from a script that recursively renames someone's photo library.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "os.ReadDir returns a sorted []fs.DirEntry, no recursion. For each entry: skip directories, compute the new name, skip if unchanged, then either print (dry-run) or call os.Rename. Errors from Rename should be wrapped with context and returned immediately; do not silently continue past a failed rename.",
					},
					pattern: `entries, err := os.ReadDir(dir)
if err != nil {
    return fmt.Errorf("read %s: %w", dir, err)
}
for _, e := range entries {
    if e.IsDir() { continue }
    oldPath := filepath.Join(dir, e.Name())
    newPath := filepath.Join(dir, newName)
    if err := os.Rename(oldPath, newPath); err != nil {
        return fmt.Errorf("rename %s: %w", e.Name(), err)
    }
}`,
					example: {
						en: "A photo organiser reads a directory, skips subdirectories, constructs a date-prefixed name from EXIF metadata, and calls os.Rename only when the new name differs from the old one, skipping already-renamed files on reruns.",
					},
					task: {
						en: "Implement the loop inside run(*Config) error: read the directory, skip directories, and compute each new name. Leave the actual renaming for the next step; for now just collect or print the pairs.",
					},
					hints: [
						{
							label: "ReadDir is not Walk",
							value: "os.ReadDir reads one level. filepath.WalkDir recurses. This program wants ReadDir: recursing into subdirectories is how a rename script becomes an incident.",
						},
						{
							label: "the skip-if-unchanged guard never fires here",
							value: 'Worth knowing, because the self-check cannot show you this: while --pattern is required, transformName always returns pattern + "_" + base + ext, which is strictly longer than the name it was given, so newName == e.Name() is never true. The guard is dead code today. Write it anyway. It costs one comparison, it is the line that keeps run correct the moment the prefix becomes optional, and os.Rename(x, x) is a syscall you have no reason to make. Cheap guards at the top of a loop are how you stop a later change from turning a no-op into a bug.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command: "go run ./check",
					expect: {
						en: 'Scenario 3 ("directories are skipped") should show the "Old Photos/" directory and its Beach Day.png still present and untouched in the side-by-side listing.',
					},
					labPath: "labs/cli-renamer/testdata/nested",
				},
				{
					type: "breakIt",
					change: {
						en: "Remove the if e.IsDir() { continue } guard and rerun the check.",
					},
					observe: {
						en: 'Scenario 3 fails: the directory itself gets renamed to backup_old_photos, and the check reports "not expected: backup_old_photos/" alongside "missing directory: Old Photos/".',
					},
					why: {
						en: "os.Rename does not care what is on the other end of the path; a directory is just an inode with a name, and renaming one is as cheap and as silent as renaming a file. Nothing errors. The whole subtree moves. This is why the guard is a guard and not an optimisation: the failure it prevents is not a crash, it is a quiet, successful, wrong result. Those are the ones you find out about in a week.",
					},
				},
			],
			retrievalPrompt:
				"os.ReadDir gives you []fs.DirEntry. Why check IsDir() when you already asked for the directory's contents? || Because the contents include subdirectories, and os.Rename renames a directory just as happily as a file, silently and without error. Skipping them is the difference between renaming three files and moving someone's whole photo folder.",
		},
		{
			n: "04",
			heading: { en: "Print the plan before you touch anything" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "Dry-run is not a nicety bolted on for the demo. It is the feature that makes a destructive tool usable by someone who is not certain, which is everyone, the first time. A tool with no dry-run gets run once on a copy of the directory, because that is the only safe way to find out what it does.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The dry-run branch and the execute branch must compute the same plan and differ only in the last statement. If dry-run recomputes names its own way, it stops being a preview and becomes a second implementation that can disagree with the real one, which is worse than having no preview at all.",
					},
					pattern: `newName := transformName(e.Name(), cfg.Pattern)
if newName == e.Name() {
    continue
}
if cfg.DryRun {
    fmt.Printf("[DRY RUN] %s → %s\\n", e.Name(), newName)
    continue
}
// ... the real rename, on the same newName`,
					example: {
						en: "terraform plan and terraform apply walk the same graph with the same diff logic; apply is plan plus the write. That is why the plan output can be trusted as a description of what apply will do.",
					},
					task: {
						en: 'Add the dry-run branch to your loop. When cfg.DryRun is set, print "[DRY RUN] old → new" for each file that would change and rename nothing. The arrow is a literal → (U+2192). Print to stdout, one line per rename, in os.ReadDir order.',
					},
					hints: [
						{
							label: "why stdout",
							value: "The plan is the program's output, so it belongs on stdout where a user can pipe it into grep or a file. Errors go to stderr. Step 06 is about that split; the check holds you to it here already.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command: "go run ./check",
					expect: {
						en: 'Scenario 2 should now report "stdout matches the promised dry-run listing" and show the directory unchanged. The check compares your stdout line by line, so a stray debug print will fail it.',
					},
					labPath: "labs/cli-renamer/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In the dry-run branch, print the plan but delete the continue, so it falls through to os.Rename.",
					},
					observe: {
						en: 'Scenario 2 fails: the listing prints correctly, and then the check reports the files were renamed anyway. "changes nothing" is the half that broke.',
					},
					why: {
						en: "The output looked perfect. That is the point. A dry-run bug cannot be caught by reading the dry-run output, because the output is generated by the correct half of the code; the damage is done by the line after it. This is why the check asserts the directory state as well as stdout: a preview that is right about what it would do and then does it anyway is the most dangerous version of this program.",
					},
				},
			],
			retrievalPrompt:
				"Why must the dry-run branch and the rename branch share the same newName computation? || Because a preview is only worth anything if it is generated by the same code that does the work. Two implementations drift, and then the plan says one thing and apply does another, which is worse than no plan at all.",
		},
		{
			n: "05",
			heading: { en: "Rename, and carry the filename in the error" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: 'This is the first step that changes the disk. Everything before it was reversible. The question a failure has to answer is not "did it work" but "how far did it get, and which file stopped it", because that is what someone has to know to clean up.',
					},
				},
				{
					type: "pattern",
					concept: {
						en: 'A bare error from os.Rename tells you a syscall failed and nothing about your program: "rename /tmp/x/a /tmp/x/b: file exists" at best. Wrapping with %w adds your context (which file, which operation) while keeping the original error intact underneath, so callers can still match it with errors.Is. Wrap once, at the point where you know something the caller does not.',
					},
					pattern: `if err := os.Rename(oldPath, newPath); err != nil {
    return fmt.Errorf("rename %s: %w", e.Name(), err)
}`,
					example: {
						en: 'A database migration runner wraps each failing statement with the migration filename and line, so the operator reading the log at 3am knows which file to fix rather than being told only "syntax error near FROM".',
					},
					task: {
						en: "Add the os.Rename call. On the first error, wrap it with the filename that caused it and return immediately. Do not continue the loop, and do not collect errors: stop at the first one.",
					},
					hints: [
						{
							label: "why stop at the first error",
							value: "Because you are mutating a directory you no longer fully understand. If rename 4 of 10 failed, the safe move is to stop and report, leaving 1 to 3 renamed and 5 to 10 untouched, which is a state the user can inspect. Ploughing on turns a small mess into a large one.",
						},
						{
							label: "%w vs %v",
							value: "%w wraps: errors.Is and errors.As can still see the original underneath. %v flattens it to a string and the original is gone. Default to %w unless you are deliberately hiding the cause.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command: "go run ./check",
					expect: {
						en: 'All 7 scenarios say "result: matches", and the run ends with "all 7 scenarios match. Your renamer does what the steps describe."',
					},
					labPath: "labs/cli-renamer/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Change the wrap to fmt.Errorf("rename failed: %v", err), dropping both the filename and the %w. Then create two files in a scratch directory that transform to the same name and run your renamer on it.',
					},
					observe: {
						en: 'The program exits 1 with "rename failed: rename /long/tmp/path/a.txt /long/tmp/path/backup_a.txt: file exists" and no indication of which of your files is the problem, or how many were already renamed before it stopped.',
					},
					why: {
						en: "The standard library error names the paths it was given, which are absolute and mid-operation; it cannot name the thing you care about, which is the entry in the directory listing you were iterating. That context exists only in your loop, which is exactly why the wrap belongs there and not higher up. And %v means a caller can no longer ask errors.Is(err, fs.ErrExist) to distinguish a collision from a permission problem: you have thrown away the type to gain nothing.",
					},
				},
			],
			retrievalPrompt:
				"os.Rename already returns an error naming both paths. What does wrapping it with the filename add? || The paths in the syscall error are absolute and mid-operation. Your loop knows the thing the user recognises: the entry as it appeared in the directory. Wrapping adds the context only your layer has, and %w keeps the original underneath so errors.Is still works.",
		},
		{
			n: "06",
			heading: { en: "Exit like a command-line tool" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Your program is going to be called by a shell script one day, possibly by you, possibly in a loop over forty directories. A tool that prints its errors to stdout and exits 0 when it failed is a tool that silently corrupts that loop's output and reports success. This step costs five lines and is the difference between a script and a utility.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The convention is not decoration: stdout is the program's result, stderr is commentary about the run, and the exit code is the only part a shell can branch on. main's job in Go is to translate a returned error into that convention. Note the shape below: run returns an error, main decides what to do about it. That split is why run stays testable.",
					},
					pattern: `func main() {
    cfg, err := parseFlags()
    if err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
    if err := run(cfg); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}`,
					example: {
						en: "grep exits 0 when it found something, 1 when it did not, and 2 on a real error, which is why `if grep -q foo file; then` works at all. The exit code is an API.",
					},
					task: {
						en: "Wire main: call parseFlags, then run. On any error print it to os.Stderr and exit 1. Nothing else goes to stderr; the dry-run plan stays on stdout. Then run your program with --help and read what you got for free.",
					},
					hints: [
						{
							label: "why not log.Fatal",
							value: "log.Fatal writes to stderr and exits 1, which is almost right, but it also stamps every line with a date and time by default. For a user-facing CLI that is noise. log.Fatal is for daemons; fmt.Fprintln(os.Stderr, err) is for tools.",
						},
						{
							label: "os.Exit skips defers",
							value: "os.Exit terminates immediately: deferred functions do not run. That is fine in main here because nothing is deferred, but it is why you keep os.Exit in main and never bury it inside run, where a defer f.Close() would be silently skipped.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command:
						"go run ./starter --dir . --pattern backup --dry-run > /dev/null\n# nothing should appear: the plan went to stdout, which you just discarded\n\ngo run ./starter --dir /nope --pattern backup > /dev/null\n# the error should still appear: it went to stderr\n\ngo run ./starter --help",
					expect: {
						en: "The first command prints nothing, because the plan is on stdout. The second still shows its error, because errors are on stderr and redirecting stdout does not touch it. --help prints the flag list with defaults, which you never wrote: the flag package generates it from the flags you registered.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Change the error path in main to fmt.Println(err) (stdout) and drop the os.Exit(1). Then run: go run ./starter --dir /nope --pattern backup > out.txt; echo $?",
					},
					observe: {
						en: "The shell reports exit code 0, and the error message is sitting inside out.txt where the plan was supposed to be.",
					},
					why: {
						en: "A shell only knows what happened through the exit code, and every wrapper (make, CI, a for loop, xargs) branches on it. Exit 0 means success, so the caller carries on and treats your error text as data. This is the mechanism behind an entire genre of production incident: the pipeline that kept running because the failing step said it was fine. Two lines, fmt.Fprintln(os.Stderr, err) and os.Exit(1), are what make your program legible to everything that will ever call it.",
					},
				},
			],
			retrievalPrompt:
				"Your program prints its error and stops. Why is that not enough? || Because stopping is not the same as reporting failure. Without os.Exit(1) the shell sees exit code 0 and treats the run as a success, and if the error went to stdout it lands in whatever file or pipe was capturing the real output. The exit code is the only part a caller can branch on.",
		},
		{
			n: "07",
			heading: { en: "Run the whole self-check, then read the reference" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been running the check a scenario at a time. Now run it as the thing it is: a description of a working program, written before you started. When it is green, the interesting part begins, which is comparing your decisions against someone else's for the same spec.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "Reading a reference solution after your own is green is worth more than reading it before, and the difference is not willpower. Once you have made the decisions yourself, you have a question for every line: not what does this do, but why did they do it there and I did it here. Before you have written it, the same file is just prose that looks obvious.",
					},
					pattern: `go run ./check              # checks ./starter, which is your code
go run ./check -target ./solution   # proves the check itself is passable`,
					example: {
						en: "Code review works the same way and for the same reason: the reviewer who has already thought about the problem catches design decisions, and the one who has not catches typos.",
					},
					task: {
						en: "Get all 7 scenarios to match. Then open labs/cli-renamer/solution/main.go and compare three specific things against your version: where validation happens, whether transformName touches the filesystem, and where the os.Exit calls live. Where you differ, decide which you prefer and why. Some of your choices will be better.",
					},
				},
				{
					type: "verify",
					where: "labs/cli-renamer",
					command: "go run ./check\ngo run ./check -target ./solution",
					expect: {
						en: 'Both runs end with "all 7 scenarios match." The second is not grading you; it is the check proving it is passable, which is the only reason you should trust it when it says your program is wrong.',
					},
					labPath: "labs/cli-renamer/solution/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Run go run ./check -target ./solution, then edit solution/main.go to break one thing, for instance make transformName skip the lowercasing. Rerun. Then restore it with git checkout.",
					},
					observe: {
						en: "The reference fails the same scenarios your code would have. The check does not know or care which file it is looking at.",
					},
					why: {
						en: "The check builds whatever package -target names and compares observable behaviour. It has no privileged knowledge of the solution, which is what makes it a fair description of the spec rather than a diff against one answer. This is also why the lab ships the reference behind the same check rather than as prose: an unverified reference is just an opinion, and this one is held to the same 7 scenarios you are.",
					},
				},
			],
			retrievalPrompt:
				"Why does the lab run the same check against the reference solution, when the reference is known to be correct? || Because that is what proves the check is passable. A suite nobody has ever passed is not evidence, it is a guess. When it tells you your program is wrong, you can trust it precisely because it goes green against a real implementation.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You separated concerns into three explicit layers (parsing, transformation, execution) keeping the transform pure and the I/O isolated. This structure appears in every subsequent project. The pattern of validating at the boundary and propagating errors with context is Go's most important idiom.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-it steps were the point as much as the build steps. A directory renamed because a guard was missing, a dry-run that previewed correctly and then did the work anyway, a failed run that reported success: none of those crash, and none of them are caught by reading the code. You now know what they look like from the outside, which is the only way you will recognise them at 3am in something bigger.",
			},
		},
	],
}
