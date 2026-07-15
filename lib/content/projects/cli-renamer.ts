import { Project } from "../../content"

export const cliRenamer: Project = {
	slug: "cli-renamer",
	name: "File renamer CLI",
	tagline: "Batch-rename files with patterns, flags, and dry-run mode.",
	code: "CLI",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "2–3 hours",
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
			heading: { en: "Parse flags into a Config" },
			uses: ["error-handling", "pointers"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "The flag package registers named flags and writes their values into pointers. After flag.Parse() the pointers hold what the user typed. Go's convention is to validate all input at the boundary (early, explicitly, before any work begins) and return a descriptive error rather than panicking or silently using bad values.",
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
					],
				},
			],
		},
		{
			n: "02",
			heading: { en: "Write a pure name transform" },
			uses: [],
			blocks: [
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
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "Walk the directory and apply renames" },
			uses: ["error-handling"],
			blocks: [
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
						en: 'Implement run(*Config) error. Skip directories and files where transformName produces the same name. In dry-run mode print "[DRY RUN] old → new" without calling os.Rename. Return the first error encountered, wrapped with the filename.',
					},
					hints: [
						{
							label: "the skip-if-unchanged guard never fires here",
							value: "Worth knowing, because the self-check cannot show you this: while --pattern is required, transformName always returns pattern + \"_\" + base + ext, which is strictly longer than the name it was given, so newName == e.Name() is never true. The guard is dead code today. Write it anyway. It costs one comparison, it is the line that keeps run correct the moment the prefix becomes optional, and os.Rename(x, x) is a syscall you have no reason to make. Cheap guards at the top of a loop are how you stop a later change from turning a no-op into a bug.",
						},
					],
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You separated concerns into three explicit layers (parsing, transformation, execution) keeping the transform pure and the I/O isolated. This structure appears in every subsequent project. The pattern of validating at the boundary and propagating errors with context is Go's most important idiom.",
			},
		},
	],
}
