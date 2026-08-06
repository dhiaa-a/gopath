// Package harness builds a capstone submission and drives the resulting binary
// over HTTP.
//
// Nothing in here reads the target's source. It compiles the package, runs it,
// and speaks to the port it announces, which is the same access a reviewer or
// an on-call engineer would have. That constraint is the point: it keeps the
// suite honest about what can actually be observed from outside, and it means
// any package layout that meets the spec passes.
package harness

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// ErrNoSignal is returned by Interrupt on platforms that cannot deliver one.
// Callers announce the skip rather than passing quietly.
var ErrNoSignal = errors.New("this platform cannot deliver an interrupt to a child process")

// Target is a compiled submission.
type Target struct {
	Bin string
	dir string
}

// Build compiles targetDir into a temporary binary.
func Build(targetDir string) (*Target, error) {
	abs, err := filepath.Abs(targetDir)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(abs); err != nil {
		return nil, fmt.Errorf("target %s: %w", targetDir, err)
	}

	tmp, err := os.MkdirTemp("", "linkd-build-*")
	if err != nil {
		return nil, err
	}
	bin := filepath.Join(tmp, "linkd")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}

	cmd := exec.Command("go", "build", "-o", bin, ".")
	cmd.Dir = abs
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("go build %s failed:\n%s", targetDir, strings.TrimSpace(out.String()))
	}
	return &Target{Bin: bin, dir: abs}, nil
}

// Options are the flags a run is started with.
type Options struct {
	Addr   string  // default 127.0.0.1:0
	Data   string  // required
	Tokens string  // required
	Rate   float64 // default 100
}

// Proc is a running submission.
type Proc struct {
	Addr string // host:port it announced
	Base string // http://host:port

	cmd    *exec.Cmd
	stderr *lockedBuffer
	client *http.Client

	waitOnce sync.Once
	waitErr  error
	exitCode int
	done     chan struct{}
}

// Start runs the binary and waits for it to announce its address. It returns
// an error if the process exits first, or says nothing within the timeout,
// because both mean there is no service to talk to.
func (t *Target) Start(opts Options) (*Proc, error) {
	if opts.Addr == "" {
		opts.Addr = "127.0.0.1:0"
	}
	if opts.Rate == 0 {
		opts.Rate = 100
	}

	args := []string{
		"-addr", opts.Addr,
		"-data", opts.Data,
		"-rate", fmt.Sprintf("%g", opts.Rate),
	}
	if opts.Tokens != "" {
		args = append(args, "-tokens", opts.Tokens)
	}

	cmd := exec.Command(t.Bin, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	errBuf := &lockedBuffer{}
	cmd.Stderr = errBuf

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	p := &Proc{cmd: cmd, stderr: errBuf, done: make(chan struct{})}

	// One goroutine owns Wait. Anything else racing on it gets the recorded
	// answer instead of "wait: no child processes".
	go func() {
		err := cmd.Wait()
		p.waitErr = err
		p.exitCode = cmd.ProcessState.ExitCode()
		close(p.done)
	}()

	line := make(chan string, 1)
	readErr := make(chan error, 1)
	go func() {
		sc := bufio.NewScanner(stdout)
		if sc.Scan() {
			line <- sc.Text()
			io.Copy(io.Discard, stdout) //nolint:errcheck // drained so the child never blocks on a full pipe
			return
		}
		if err := sc.Err(); err != nil {
			readErr <- err
			return
		}
		readErr <- io.EOF
	}()

	select {
	case l := <-line:
		addr, ok := strings.CutPrefix(strings.TrimSpace(l), "listening on ")
		if !ok || addr == "" {
			p.Kill()
			return nil, fmt.Errorf("first stdout line was %q, want %q", l, "listening on <host:port>")
		}
		p.Addr = addr
		p.Base = "http://" + addr
	case <-readErr:
		// Stdout closed with nothing on it. Give the process a moment to
		// finish exiting so the exit code is real, then give up on it.
		select {
		case <-p.done:
		case <-time.After(5 * time.Second):
			p.Kill()
		}
		return nil, fmt.Errorf("process exited before announcing an address (exit %d)\nstderr: %s",
			p.exitCode, strings.TrimSpace(p.stderr.String()))
	case <-time.After(20 * time.Second):
		p.Kill()
		return nil, errors.New("process never printed \"listening on <host:port>\" to stdout")
	case <-p.done:
		return nil, fmt.Errorf("process exited before announcing an address (exit %d)\nstderr: %s",
			p.exitCode, strings.TrimSpace(p.stderr.String()))
	}

	p.client = &http.Client{
		Timeout: 10 * time.Second,
		// Redirects are the product here, so never follow one.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		Transport: &http.Transport{
			MaxIdleConns:        512,
			MaxIdleConnsPerHost: 512,
			MaxConnsPerHost:     512,
			DisableCompression:  true,
		},
	}
	return p, nil
}

// StartExpectingFailure runs the binary and requires it to exit non-zero
// without serving. It returns the stderr it produced.
func (t *Target) StartExpectingFailure(opts Options) (string, error) {
	p, err := t.Start(opts)
	if err == nil {
		p.Kill()
		return "", errors.New("process started and served; it should have refused")
	}
	return err.Error(), nil
}

// Kill stops the process outright: no signal, no chance to flush. This is the
// power-cable test, and it is the only stop that works on every platform.
func (p *Proc) Kill() {
	if p.cmd.Process != nil {
		_ = p.cmd.Process.Kill()
	}
	select {
	case <-p.done:
	case <-time.After(5 * time.Second):
	}
	// Kill runs on the failure paths inside Start too, before there is a
	// client to close.
	if p.client != nil {
		p.client.CloseIdleConnections()
	}
}

// Interrupt asks the process to shut down gracefully.
func (p *Proc) Interrupt() error {
	if runtime.GOOS == "windows" {
		return ErrNoSignal
	}
	return p.cmd.Process.Signal(os.Interrupt)
}

// WaitExit blocks for the process to exit and reports its code.
func (p *Proc) WaitExit(d time.Duration) (int, error) {
	select {
	case <-p.done:
		return p.exitCode, nil
	case <-time.After(d):
		return -1, fmt.Errorf("process still running after %s", d)
	}
}

// Stderr is everything the process has written to stderr so far.
func (p *Proc) Stderr() string { return strings.TrimSpace(p.stderr.String()) }

// HTTP is the client bound to this process. Exposed for load generation.
func (p *Proc) HTTP() *http.Client { return p.client }

// Resp is one response, already drained.
type Resp struct {
	Status int
	Header http.Header
	Body   []byte
}

// JSON decodes the body, reporting what it actually got when it will not
// decode. "cannot unmarshal" with no sight of the body is a bad afternoon.
func (r *Resp) JSON(v any) error {
	if err := json.Unmarshal(r.Body, v); err != nil {
		return fmt.Errorf("decoding body %q: %w", truncate(string(r.Body), 200), err)
	}
	return nil
}

// Do sends one request. A nil body sends none; anything else is JSON encoded.
// An empty token sends no Authorization header.
func (p *Proc) Do(method, path, token string, body any) (*Resp, error) {
	var rdr io.Reader
	if body != nil {
		switch b := body.(type) {
		case string:
			rdr = strings.NewReader(b)
		default:
			raw, err := json.Marshal(b)
			if err != nil {
				return nil, err
			}
			rdr = bytes.NewReader(raw)
		}
	}

	req, err := http.NewRequest(method, p.Base+path, rdr)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &Resp{Status: resp.StatusCode, Header: resp.Header, Body: raw}, nil
}

// DoRaw sends a request with an Authorization header written verbatim, so the
// malformed-header cases can be exercised.
func (p *Proc) DoRaw(method, path, authHeader string) (*Resp, error) {
	req, err := http.NewRequest(method, p.Base+path, nil)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &Resp{Status: resp.StatusCode, Header: resp.Header, Body: raw}, nil
}

// Link is the wire shape of a link, as the spec defines it.
type Link struct {
	Code      string     `json:"code"`
	ShortURL  string     `json:"short_url"`
	URL       string     `json:"url"`
	Owner     string     `json:"owner"`
	Clicks    int64      `json:"clicks"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

// Metrics is the wire shape of /metrics.
type Metrics struct {
	Goroutines       int     `json:"goroutines"`
	RequestsTotal    int64   `json:"requests_total"`
	RequestsInFlight int64   `json:"requests_in_flight"`
	RedirectsTotal   int64   `json:"redirects_total"`
	RateLimitedTotal int64   `json:"rate_limited_total"`
	LinksTotal       int     `json:"links_total"`
	UptimeSeconds    float64 `json:"uptime_seconds"`
}

// Metrics fetches and decodes /metrics.
func (p *Proc) Metrics() (Metrics, error) {
	var m Metrics
	r, err := p.Do("GET", "/metrics", "", nil)
	if err != nil {
		return m, err
	}
	if r.Status != http.StatusOK {
		return m, fmt.Errorf("GET /metrics: status %d", r.Status)
	}
	return m, r.JSON(&m)
}

// WriteTokens writes a token file and returns its path.
func WriteTokens(dir string, tokens map[string]string) (string, error) {
	path := filepath.Join(dir, "tokens.json")
	raw, err := json.Marshal(tokens)
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, raw, 0o600)
}

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
