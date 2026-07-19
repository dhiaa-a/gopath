// Command check is the self-check for the file renamer lab (Tier 1,
// Project 1).
//
// It builds the package named by -target (./starter by default), runs the
// binary against fresh copies of the folders in testdata/, and prints,
// scenario by scenario, what your program did next to what the project steps
// describe. Any difference makes it exit 1 so scripts can rely on it, but it
// is a mirror, not a grader: the differences are simply the work left.
//
// Run it from the lab root:
//
//	go run ./check
//	go run ./check -target ./solution
package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"
)

// scenario describes one run of your binary and the directory state (plus
// stdout, where the project promises exact output) expected afterwards.
type scenario struct {
	about   string // one line: what this scenario demonstrates
	fixture string // subdirectory of testdata/, copied fresh for every run
	pattern string // value for --pattern; empty means the flag is left out on purpose
	dryRun  bool   // pass --dry-run
	badDir  bool   // point --dir at a subpath of the copy that does not exist
	fileDir string // point --dir at this regular file inside the copy, not a directory
	wantErr bool   // the program must refuse: non-zero exit, directory untouched

	// wantFiles maps every file expected after the run to the fixture file
	// that must hold the same bytes. A rename moves a file; it never rewrites
	// its contents. Keys and values are slash-separated relative paths.
	wantFiles map[string]string
	// wantDirs lists directories that must still exist, untouched.
	wantDirs []string
	// wantStdout, when non-nil, is the exact stdout, line by line. The
	// project promises exact dry-run output, so the check holds you to it.
	wantStdout []string
}

// basicUntouched is testdata/basic exactly as it started, for the scenarios
// where the program must change nothing.
var basicUntouched = map[string]string{
	"My File.TXT":           "My File.TXT",
	"Summer Photo 2024.JPG": "Summer Photo 2024.JPG",
	"notes.txt":             "notes.txt",
}

var scenarios = []scenario{
	{
		about:   "a typical run: spaces to underscores, lowercase, prefix",
		fixture: "basic",
		pattern: "backup",
		wantFiles: map[string]string{
			"backup_my_file.TXT":           "My File.TXT",
			"backup_notes.txt":             "notes.txt",
			"backup_summer_photo_2024.JPG": "Summer Photo 2024.JPG",
		},
	},
	{
		about:     "--dry-run prints the plan and changes nothing",
		fixture:   "basic",
		pattern:   "backup",
		dryRun:    true,
		wantFiles: basicUntouched,
		wantStdout: []string{
			"[DRY RUN] My File.TXT → backup_my_file.TXT",
			"[DRY RUN] Summer Photo 2024.JPG → backup_summer_photo_2024.JPG",
			"[DRY RUN] notes.txt → backup_notes.txt",
		},
	},
	{
		about:   "directories are skipped: never renamed, never entered",
		fixture: "nested",
		pattern: "backup",
		wantFiles: map[string]string{
			"backup_trip_notes.md":     "Trip Notes.md",
			"backup_invoice_march.pdf": "invoice March.pdf",
			"Old Photos/Beach Day.png": "Old Photos/Beach Day.png",
		},
		wantDirs: []string{"Old Photos"},
	},
	{
		about:   "extensions survive exactly as they were, or stay absent",
		fixture: "extensions",
		pattern: "backup",
		wantFiles: map[string]string{
			"backup_q3_report.final.PDF": "Q3 Report.Final.PDF",
			"backup_family_photo.png":    "Family Photo.png",
			"backup_readme":              "README",
		},
	},
	{
		about:     "missing --pattern: refuse before touching anything",
		fixture:   "basic",
		pattern:   "",
		wantErr:   true,
		wantFiles: basicUntouched,
	},
	{
		about:     "a --dir that does not exist: refuse with an error",
		fixture:   "basic",
		pattern:   "backup",
		badDir:    true,
		wantErr:   true,
		wantFiles: basicUntouched,
	},
	{
		// os.ReadDir fails on a regular file too, so a program that never
		// validates --dir still exits non-zero here by accident. The
		// difference is where it fails: parseFlags rejects it before any
		// work starts, which is the boundary the steps are about.
		about:     "a --dir that is a file, not a directory: refuse with an error",
		fixture:   "basic",
		pattern:   "backup",
		fileDir:   "notes.txt",
		wantErr:   true,
		wantFiles: basicUntouched,
	},
}

func main() {
	os.Exit(run())
}

func run() int {
	target := flag.String("target", "./starter", "package to build and check")
	flag.Parse()

	if _, err := os.Stat("testdata"); err != nil {
		fmt.Println("cannot find testdata/ in the current directory.")
		fmt.Println("run the check from the lab root: cd labs/cli-renamer && go run ./check")
		return 1
	}

	fmt.Printf("building %s ...\n", *target)
	bin, cleanup, err := buildTarget(*target)
	if err != nil {
		fmt.Println(err)
		return 1
	}
	defer cleanup()

	mismatched := 0
	for i, sc := range scenarios {
		if !runScenario(i+1, sc, bin) {
			mismatched++
		}
	}
	fmt.Println()
	if mismatched > 0 {
		fmt.Printf("%d of %d scenarios do not match yet. The differences above are the remaining work.\n", mismatched, len(scenarios))
		return 1
	}
	fmt.Printf("all %d scenarios match. Your renamer does what the steps describe.\n", len(scenarios))
	fmt.Println("solution/main.go is fair game now: compare decisions, not just output.")
	return 0
}

// buildTarget compiles the target package into a temp directory and returns
// the binary path. The .exe suffix is required on Windows and harmless
// everywhere else.
func buildTarget(target string) (string, func(), error) {
	tmp, err := os.MkdirTemp("", "cli-renamer-check-")
	if err != nil {
		return "", nil, err
	}
	bin := filepath.Join(tmp, "renamer.exe")
	out, err := exec.Command("go", "build", "-o", bin, target).CombinedOutput()
	if err != nil {
		os.RemoveAll(tmp)
		return "", nil, fmt.Errorf("go build %s did not compile:\n\n%s\nthe check needs a compiling program; fix the errors above and rerun", target, indent(string(out)))
	}
	return bin, func() { os.RemoveAll(tmp) }, nil
}

func runScenario(n int, sc scenario, bin string) bool {
	fmt.Printf("\n── %d. %s\n", n, sc.about)

	work, err := os.MkdirTemp("", "cli-renamer-scenario-")
	if err != nil {
		return internalErr(err)
	}
	defer os.RemoveAll(work)

	src := filepath.Join("testdata", sc.fixture)
	if err := copyTree(src, work); err != nil {
		return internalErr(err)
	}

	dir := work
	if sc.badDir {
		dir = filepath.Join(work, "no-such-folder")
	}
	if sc.fileDir != "" {
		dir = filepath.Join(work, filepath.FromSlash(sc.fileDir))
	}
	args := []string{"--dir", dir}
	if sc.pattern != "" {
		args = append(args, "--pattern", sc.pattern)
	}
	if sc.dryRun {
		args = append(args, "--dry-run")
	}
	display := strings.ReplaceAll(strings.Join(args, " "), work, "<copy of testdata/"+sc.fixture+">")
	fmt.Println("   $ renamer " + display)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	runErr := cmd.Run()
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		fmt.Println("   your program was still running after 20 seconds; expected: exit almost instantly.")
		return false
	}
	exitCode := 0
	if runErr != nil {
		var ee *exec.ExitError
		if !errors.As(runErr, &ee) {
			return internalErr(fmt.Errorf("could not run your binary: %w", runErr))
		}
		exitCode = ee.ExitCode()
	}

	ok := true
	switch {
	case sc.wantErr && exitCode == 0:
		fmt.Println("   your program exited 0, as if this run were fine.")
		fmt.Println("   expected: a non-zero exit; this input is invalid and must be refused.")
		ok = false
	case sc.wantErr:
		fmt.Printf("   your program refused (exit code %d), as expected.\n", exitCode)
	case exitCode != 0:
		fmt.Printf("   your program exited with code %d; expected a clean exit (0).\n", exitCode)
		ok = false
	}

	// Directory state afterwards.
	wantFiles := make(map[string]string, len(sc.wantFiles))
	for name, from := range sc.wantFiles {
		b, err := os.ReadFile(filepath.Join(src, filepath.FromSlash(from)))
		if err != nil {
			return internalErr(err)
		}
		wantFiles[name] = string(b)
	}
	gotFiles, gotDirs, err := snapshot(work)
	if err != nil {
		return internalErr(err)
	}
	problems := compareState(gotFiles, gotDirs, wantFiles, sc.wantDirs)
	if len(problems) == 0 {
		fmt.Println("   the directory ends up exactly as the steps describe:")
		printBlock(names(wantFiles, sc.wantDirs))
	} else {
		ok = false
		printSideBySide(names(gotFiles, gotDirs), names(wantFiles, sc.wantDirs))
		fmt.Println("   differences:")
		for _, p := range problems {
			fmt.Println("     - " + p)
		}
	}

	// Promised stdout (the dry-run listing).
	if sc.wantStdout != nil {
		got := lines(stdout.String())
		if slices.Equal(got, sc.wantStdout) {
			fmt.Println("   stdout matches the promised dry-run listing.")
		} else {
			ok = false
			fmt.Println("   your stdout:")
			printBlock(got)
			fmt.Println("   expected stdout (one line per rename, in os.ReadDir order):")
			printBlock(sc.wantStdout)
		}
	}

	if !ok {
		if s := strings.TrimSpace(stderr.String()); s != "" {
			fmt.Println("   your program's stderr, in case it helps:")
			printBlock(lines(s))
		}
		fmt.Println("   result: does not match yet.")
		return false
	}
	fmt.Println("   result: matches.")
	return true
}

// copyTree copies the fixture into a scratch directory so a run can never
// damage testdata/ and every scenario starts from the same state.
func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		out := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(out, 0o755)
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(out, b, 0o644)
	})
}

// snapshot records the directory as it stands: file contents by relative
// path, plus the list of subdirectories.
func snapshot(root string) (map[string]string, []string, error) {
	files := map[string]string{}
	var dirs []string
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, p)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if d.IsDir() {
			dirs = append(dirs, rel)
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		files[rel] = string(b)
		return nil
	})
	sort.Strings(dirs)
	return files, dirs, err
}

// compareState explains every way the directory differs from the expected
// state, in plain words.
func compareState(gotFiles map[string]string, gotDirs []string, wantFiles map[string]string, wantDirs []string) []string {
	var problems []string
	for _, name := range sortedKeys(wantFiles) {
		got, exists := gotFiles[name]
		switch {
		case !exists && slices.Contains(gotDirs, name):
			problems = append(problems, name+" is a directory; expected a regular file")
		case !exists:
			problems = append(problems, "missing: "+name)
		case got != wantFiles[name]:
			problems = append(problems, "contents of "+name+" changed; a rename moves a file, it never rewrites its bytes")
		}
	}
	for _, name := range sortedKeys(gotFiles) {
		if _, expected := wantFiles[name]; !expected {
			problems = append(problems, "not expected: "+name)
		}
	}
	for _, d := range wantDirs {
		if !slices.Contains(gotDirs, d) {
			problems = append(problems, "missing directory: "+d+"/")
		}
	}
	for _, d := range gotDirs {
		if !slices.Contains(wantDirs, d) {
			problems = append(problems, "not expected: "+d+"/")
		}
	}
	return problems
}

// names merges files and directories into one sorted display list;
// directories carry a trailing slash.
func names(files map[string]string, dirs []string) []string {
	out := make([]string, 0, len(files)+len(dirs))
	out = append(out, sortedKeys(files)...)
	for _, d := range dirs {
		out = append(out, d+"/")
	}
	sort.Strings(out)
	return out
}

// printSideBySide shows the directory your program produced next to the one
// the steps describe. Rows pair up by position, so read it with the
// differences list underneath.
func printSideBySide(got, want []string) {
	if len(got) == 0 {
		got = []string{"(nothing)"}
	}
	if len(want) == 0 {
		want = []string{"(nothing)"}
	}
	left := "your directory now holds"
	width := len(left)
	for _, g := range got {
		if len(g) > width {
			width = len(g)
		}
	}
	fmt.Printf("   %-*s    %s\n", width, left, "expected")
	for i := 0; i < len(got) || i < len(want); i++ {
		l, r := "", ""
		if i < len(got) {
			l = got[i]
		}
		if i < len(want) {
			r = want[i]
		}
		fmt.Printf("   %-*s    %s\n", width, l, r)
	}
}

func printBlock(ls []string) {
	if len(ls) == 0 {
		fmt.Println("     (nothing)")
		return
	}
	for _, l := range ls {
		fmt.Println("     " + l)
	}
}

// lines splits captured output into lines, tolerating \r\n and a trailing
// newline so the comparison is about content, not line-ending trivia.
func lines(s string) []string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.TrimRight(s, "\n")
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

func indent(s string) string {
	var b strings.Builder
	for _, l := range lines(s) {
		b.WriteString("  " + l + "\n")
	}
	return b.String()
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func internalErr(err error) bool {
	fmt.Println("   self-check internal error (not your program):", err)
	return false
}
