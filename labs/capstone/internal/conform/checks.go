package conform

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"gopath.dev/labs/capstone/internal/harness"
)

// All returns every conformance check, in the order they are run. Names are
// stable identifiers: seeds.go refers to them, so renaming one means updating
// that table in the same commit.
func All() []Check {
	return []Check{
		{"startup/announces-bound-port", "1. Process contract", checkAnnouncesPort},
		{"startup/requires-tokens", "1. Process contract", checkRequiresTokens},
		{"startup/refuses-corrupt-store", "5. Durability", checkRefusesCorruptStore},
		{"health/ok", "3. Routes", checkHealth},

		{"auth/missing-header-401", "2. Authentication", checkMissingAuth},
		{"auth/malformed-header-401", "2. Authentication", checkMalformedAuth},
		{"auth/unknown-token-401", "2. Authentication", checkUnknownToken},
		{"auth/owner-isolation", "2. Authentication", checkOwnerIsolation},

		{"create/rejects-bad-url", "3. Routes", checkRejectsBadURL},
		{"create/rejects-bad-alias", "3. Routes", checkRejectsBadAlias},
		{"create/alias-length-counts-runes", "3. Routes", checkAliasCountsRunes},
		{"create/duplicate-alias-409", "3. Routes", checkDuplicateAlias},
		{"create/expires-in-honoured", "3. Routes", checkExpiresIn},
		{"create/generated-code-shape", "3. Routes", checkGeneratedCode},

		{"redirect/found-with-location", "3. Routes", checkRedirect},
		{"redirect/unknown-404", "3. Routes", checkRedirectUnknown},
		{"redirect/expired-410", "3. Routes", checkRedirectExpired},

		{"list/empty-is-array", "3. Routes", checkListEmpty},
		{"list/only-owner-links", "3. Routes", checkListOwnerOnly},
		{"list/newest-first", "3. Routes", checkListOrder},
		{"delete/removes-link", "3. Routes", checkDelete},

		{"ratelimit/429-with-retry-after", "4. Rate limiting", checkRateLimit},
		{"ratelimit/buckets-are-per-token", "4. Rate limiting", checkRateLimitPerToken},
		{"ratelimit/redirects-not-limited", "4. Rate limiting", checkRedirectsNotLimited},
		{"metrics/counters", "3. Routes", checkMetrics},

		{"concurrency/mixed-load-stays-up", "6. Concurrency", checkMixedLoad},
		{"concurrency/no-goroutine-leak", "6. Concurrency", checkNoGoroutineLeak},
		{"concurrency/click-count-exact", "6. Concurrency", checkClicksExact},
		{"concurrency/one-winner-per-alias", "6. Concurrency", checkAliasRace},
		{"concurrency/generated-codes-unique", "6. Concurrency", checkGeneratedUnique},

		{"durability/writes-survive-kill", "5. Durability", checkDurableWrites},
		{"durability/clicks-flushed", "5. Durability", checkDurableClicks},
		{"durability/deletes-survive-kill", "5. Durability", checkDurableDeletes},
		{"shutdown/drains-and-exits-zero", "1. Process contract", checkGracefulShutdown},
	}
}

const (
	alice = "tok_alice"
	bob   = "tok_bob"
)

// create posts a link and returns the response. Body is a map so a check can
// send fields the spec says are optional, or omit them.
func create(t *T, p *harness.Proc, token string, body map[string]any) (harness.Link, *harness.Resp) {
	r, err := p.Do("POST", "/api/links", token, body)
	if err != nil {
		t.Fatalf("POST /api/links: %v", err)
	}
	var l harness.Link
	if r.Status == http.StatusCreated {
		if err := r.JSON(&l); err != nil {
			t.Fatalf("POST /api/links returned 201 with a body that will not decode: %v", err)
		}
	}
	return l, r
}

// mustCreate posts a link and insists on 201.
func mustCreate(t *T, p *harness.Proc, token string, body map[string]any) harness.Link {
	l, r := create(t, p, token, body)
	if r.Status != http.StatusCreated {
		t.Fatalf("POST /api/links %v: status %d, want 201\nbody: %s", body, r.Status, r.Body)
	}
	return l
}

func statusOf(t *T, p *harness.Proc, method, path, token string) int {
	r, err := p.Do(method, path, token, nil)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	return r.Status
}

// ---- startup -------------------------------------------------------------

func checkAnnouncesPort(e *Env, t *T) {
	p := e.StartWith(harness.Options{Addr: "127.0.0.1:0", Data: e.Data(), Tokens: e.Tokens, Rate: 100})

	_, port, found := strings.Cut(p.Addr, ":")
	if !found {
		t.Fatalf("announced address %q is not host:port", p.Addr)
	}
	if port == "0" || port == "" {
		t.Errorf("announced port %q; -addr asked for 0, so the real bound port was expected", port)
	}
	if got := statusOf(t, p, "GET", "/healthz", ""); got != http.StatusOK {
		t.Errorf("GET /healthz on the announced address: status %d, want 200", got)
	}
}

// positiveControl proves the target can start at all before a check goes on to
// require that it refuses something. Without this, a binary that exits 1 no
// matter what would pass every "must refuse" check on the board, and a check
// that cannot tell correct refusal from total failure is not evidence.
func positiveControl(e *Env, t *T) {
	p := e.StartWith(harness.Options{Data: e.Data(), Tokens: e.Tokens})
	if got := statusOf(t, p, "GET", "/healthz", ""); got != http.StatusOK {
		t.Fatalf("control run: GET /healthz returned %d, want 200", got)
	}
	p.Kill()
}

func checkRequiresTokens(e *Env, t *T) {
	positiveControl(e, t)

	// Tokens empty means the flag is left off entirely.
	out, err := e.Target.StartExpectingFailure(harness.Options{Data: e.Data()})
	if err != nil {
		t.Errorf("started with no -tokens: %v", err)
		return
	}
	t.Logf("refused, as it should: %s", firstLine(out))
}

func checkRefusesCorruptStore(e *Env, t *T) {
	positiveControl(e, t)

	if err := os.WriteFile(e.Data(), []byte(`{"version":1,"links":[{"code":"a`), 0o600); err != nil {
		t.Fatalf("writing a truncated store: %v", err)
	}
	out, err := e.Target.StartExpectingFailure(harness.Options{Data: e.Data(), Tokens: e.Tokens})
	if err != nil {
		t.Errorf("started on a truncated store file: %v", err)
		t.Errorf("starting empty here silently discards every link the service ever handed out")
		return
	}
	t.Logf("refused, as it should: %s", firstLine(out))
}

func checkHealth(e *Env, t *T) {
	p := e.Start()
	r, err := p.Do("GET", "/healthz", "", nil)
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	if r.Status != http.StatusOK {
		t.Errorf("GET /healthz: status %d, want 200", r.Status)
	}
	var body map[string]string
	if err := r.JSON(&body); err != nil {
		t.Fatalf("GET /healthz body: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf(`GET /healthz body was %s, want {"status":"ok"}`, r.Body)
	}
}

// ---- auth ----------------------------------------------------------------

func checkMissingAuth(e *Env, t *T) {
	p := e.Start()
	for _, tc := range []struct{ method, path string }{
		{"POST", "/api/links"},
		{"GET", "/api/links"},
		{"GET", "/api/links/anything"},
		{"DELETE", "/api/links/anything"},
	} {
		r, err := p.Do(tc.method, tc.path, "", nil)
		if err != nil {
			t.Fatalf("%s %s: %v", tc.method, tc.path, err)
		}
		if r.Status != http.StatusUnauthorized {
			t.Errorf("%s %s with no Authorization header: status %d, want 401", tc.method, tc.path, r.Status)
		}
		if got := r.Header.Get("WWW-Authenticate"); !strings.Contains(got, "Bearer") {
			t.Errorf("%s %s 401 carried WWW-Authenticate %q, want it to mention Bearer", tc.method, tc.path, got)
		}
	}
}

func checkMalformedAuth(e *Env, t *T) {
	p := e.Start()
	for _, header := range []string{"tok_alice", "Basic tok_alice", "Bearer", "Bearerpaste"} {
		r, err := p.DoRaw("GET", "/api/links", header)
		if err != nil {
			t.Fatalf("GET /api/links: %v", err)
		}
		if r.Status != http.StatusUnauthorized {
			t.Errorf("Authorization: %q: status %d, want 401", header, r.Status)
		}
	}
}

func checkUnknownToken(e *Env, t *T) {
	p := e.Start()
	if got := statusOf(t, p, "GET", "/api/links", "tok_nobody"); got != http.StatusUnauthorized {
		t.Errorf("GET /api/links with an unknown token: status %d, want 401", got)
	}
}

func checkOwnerIsolation(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com/alice"})

	if got := statusOf(t, p, "GET", "/api/links/"+l.Code, bob); got != http.StatusNotFound {
		t.Errorf("bob reading alice's link: status %d, want 404 (403 would confirm the code exists)", got)
	}
	if got := statusOf(t, p, "DELETE", "/api/links/"+l.Code, bob); got != http.StatusNotFound {
		t.Errorf("bob deleting alice's link: status %d, want 404", got)
	}
	if got := statusOf(t, p, "GET", "/api/links/"+l.Code, alice); got != http.StatusOK {
		t.Errorf("alice reading her own link after bob's attempt: status %d, want 200", got)
	}
	if got := statusOf(t, p, "GET", "/"+l.Code, ""); got != http.StatusFound {
		t.Errorf("redirect after bob's delete attempt: status %d, want 302 (bob must not have deleted it)", got)
	}
}

// ---- create --------------------------------------------------------------

func checkRejectsBadURL(e *Env, t *T) {
	p := e.Start()
	for _, bad := range []map[string]any{
		{},
		{"url": ""},
		{"url": "notaurl"},
		{"url": "ftp://example.com"},
		{"url": "javascript:alert(1)"},
		{"url": "/relative/path"},
	} {
		_, r := create(t, p, alice, bad)
		if r.Status != http.StatusBadRequest {
			t.Errorf("POST %v: status %d, want 400", bad, r.Status)
		}
	}
	if _, r := create(t, p, alice, map[string]any{"url": "https://example.com", "expires_in": -5}); r.Status != http.StatusBadRequest {
		t.Errorf("POST with expires_in -5: status %d, want 400", r.Status)
	}
}

func checkRejectsBadAlias(e *Env, t *T) {
	p := e.Start()
	for _, bad := range []string{"has space", "has/slash", "has.dot", "has?q", strings.Repeat("a", 33)} {
		_, r := create(t, p, alice, map[string]any{"url": "https://example.com", "alias": bad})
		if r.Status != http.StatusBadRequest {
			t.Errorf("POST with alias %q: status %d, want 400", bad, r.Status)
		}
	}
	for _, good := range []string{"a", "A1", "with-dash", "with_underscore", strings.Repeat("a", 32)} {
		_, r := create(t, p, alice, map[string]any{"url": "https://example.com", "alias": good})
		if r.Status != http.StatusCreated {
			t.Errorf("POST with alias %q: status %d, want 201", good, r.Status)
		}
	}
}

func checkAliasCountsRunes(e *Env, t *T) {
	p := e.Start()

	// 32 characters, 64 bytes. The limit is in characters, so this fits.
	fits := strings.Repeat("é", 32)
	_, r := create(t, p, alice, map[string]any{"url": "https://example.com", "alias": fits})
	if r.Status != http.StatusCreated {
		t.Errorf("alias of 32 multibyte characters (%d bytes): status %d, want 201", len(fits), r.Status)
		t.Errorf("len() on a string counts bytes; the spec counts characters")
	}

	// 33 characters is over the limit however you count.
	over := strings.Repeat("é", 33)
	if _, r := create(t, p, alice, map[string]any{"url": "https://example.com", "alias": over}); r.Status != http.StatusBadRequest {
		t.Errorf("alias of 33 characters: status %d, want 400", r.Status)
	}
}

func checkDuplicateAlias(e *Env, t *T) {
	p := e.Start()
	mustCreate(t, p, alice, map[string]any{"url": "https://example.com/one", "alias": "taken"})

	_, r := create(t, p, alice, map[string]any{"url": "https://example.com/two", "alias": "taken"})
	if r.Status != http.StatusConflict {
		t.Errorf("reusing an alias: status %d, want 409", r.Status)
	}
	// Another owner cannot claim it either: codes are global.
	if _, r := create(t, p, bob, map[string]any{"url": "https://example.com/three", "alias": "taken"}); r.Status != http.StatusConflict {
		t.Errorf("another owner reusing an alias: status %d, want 409", r.Status)
	}
}

func checkExpiresIn(e *Env, t *T) {
	p := e.Start()

	before := time.Now().UTC()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "expires_in": 3600})
	if l.ExpiresAt == nil {
		t.Fatalf("expires_in 3600 produced expires_at null; the field was ignored")
	}
	want := before.Add(time.Hour)
	if d := l.ExpiresAt.Sub(want); d < -30*time.Second || d > 30*time.Second {
		t.Errorf("expires_at is %s, want within 30s of %s", l.ExpiresAt.Format(time.RFC3339), want.Format(time.RFC3339))
	}

	never := mustCreate(t, p, alice, map[string]any{"url": "https://example.com"})
	if never.ExpiresAt != nil {
		t.Errorf("no expires_in given, but expires_at is %v; it should be null", never.ExpiresAt)
	}
}

func checkGeneratedCode(e *Env, t *T) {
	p := e.Start()
	for i := 0; i < 5; i++ {
		l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com"})
		if n := len([]rune(l.Code)); n != 7 {
			t.Errorf("generated code %q is %d characters, want 7", l.Code, n)
		}
		for _, r := range l.Code {
			if !unicode.IsLetter(r) && !unicode.IsDigit(r) || r > unicode.MaxASCII {
				t.Errorf("generated code %q contains %q, want only [A-Za-z0-9]", l.Code, r)
				break
			}
		}
		if l.Clicks != 0 {
			t.Errorf("a new link reports %d clicks, want 0", l.Clicks)
		}
		if !strings.HasSuffix(l.ShortURL, "/"+l.Code) {
			t.Errorf("short_url %q does not end in /%s", l.ShortURL, l.Code)
		}
	}
}

// ---- redirect ------------------------------------------------------------

func checkRedirect(e *Env, t *T) {
	p := e.Start()
	const target = "https://example.com/deep/path?q=1&r=2"
	l := mustCreate(t, p, alice, map[string]any{"url": target, "alias": "go1"})

	r, err := p.Do("GET", "/"+l.Code, "", nil)
	if err != nil {
		t.Fatalf("GET /%s: %v", l.Code, err)
	}
	if r.Status != http.StatusFound {
		t.Fatalf("GET /%s: status %d, want 302", l.Code, r.Status)
	}
	if got := r.Header.Get("Location"); got != target {
		t.Errorf("Location is %q, want %q", got, target)
	}

	after, r2 := fetchLink(t, p, alice, l.Code)
	if r2.Status != http.StatusOK {
		t.Fatalf("GET /api/links/%s after a redirect: status %d, want 200", l.Code, r2.Status)
	}
	if after.Clicks != 1 {
		t.Errorf("one redirect recorded %d clicks, want 1", after.Clicks)
	}
}

func checkRedirectUnknown(e *Env, t *T) {
	p := e.Start()
	if got := statusOf(t, p, "GET", "/nosuchcode", ""); got != http.StatusNotFound {
		t.Errorf("GET /nosuchcode: status %d, want 404", got)
	}
}

func checkRedirectExpired(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "soon", "expires_in": 1})

	m0, err := p.Metrics()
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}

	time.Sleep(1200 * time.Millisecond)

	if got := statusOf(t, p, "GET", "/"+l.Code, ""); got != http.StatusGone {
		t.Errorf("GET /%s after it expired: status %d, want 410 (404 loses the difference between a typo and being too late)", l.Code, got)
	}
	if got := statusOf(t, p, "GET", "/api/links/"+l.Code, alice); got != http.StatusNotFound {
		t.Errorf("GET /api/links/%s after it expired: status %d, want 404", l.Code, got)
	}

	m1, err := p.Metrics()
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}
	if m1.RedirectsTotal != m0.RedirectsTotal {
		t.Errorf("an expired link recorded %d redirect(s); it should record none", m1.RedirectsTotal-m0.RedirectsTotal)
	}
}

// ---- list and delete -----------------------------------------------------

func checkListEmpty(e *Env, t *T) {
	p := e.Start()
	r, err := p.Do("GET", "/api/links", alice, nil)
	if err != nil {
		t.Fatalf("GET /api/links: %v", err)
	}
	if r.Status != http.StatusOK {
		t.Fatalf("GET /api/links: status %d, want 200", r.Status)
	}
	if got := strings.TrimSpace(string(r.Body)); got == "null" {
		t.Errorf("an owner with no links got %q, want []", got)
		t.Errorf("a nil slice marshals to null, and every client then has to special-case it")
	}
	var links []harness.Link
	if err := r.JSON(&links); err != nil {
		t.Fatalf("GET /api/links body: %v", err)
	}
	if len(links) != 0 {
		t.Errorf("an owner with no links got %d of them", len(links))
	}
}

func checkListOwnerOnly(e *Env, t *T) {
	p := e.Start()
	aliceCodes := map[string]bool{}
	for i := 0; i < 3; i++ {
		aliceCodes[mustCreate(t, p, alice, map[string]any{"url": fmt.Sprintf("https://example.com/a/%d", i)}).Code] = true
	}
	for i := 0; i < 3; i++ {
		mustCreate(t, p, bob, map[string]any{"url": fmt.Sprintf("https://example.com/b/%d", i)})
	}

	links := listLinks(t, p, alice)
	if len(links) != 3 {
		t.Errorf("alice has 3 links but her list has %d", len(links))
	}
	for _, l := range links {
		if !aliceCodes[l.Code] {
			t.Errorf("alice's list contains %q, which is not hers", l.Code)
		}
		if l.Owner != "alice" {
			t.Errorf("alice's list contains a link owned by %q", l.Owner)
		}
	}
	if n := len(listLinks(t, p, bob)); n != 3 {
		t.Errorf("bob has 3 links but his list has %d", n)
	}
}

func checkListOrder(e *Env, t *T) {
	p := e.Start()
	var codes []string
	for i := 0; i < 4; i++ {
		codes = append(codes, mustCreate(t, p, alice, map[string]any{"url": fmt.Sprintf("https://example.com/%d", i)}).Code)
		time.Sleep(10 * time.Millisecond)
	}

	links := listLinks(t, p, alice)
	if len(links) != 4 {
		t.Fatalf("expected 4 links, got %d", len(links))
	}
	for i := 0; i < len(links)-1; i++ {
		if links[i].CreatedAt.Before(links[i+1].CreatedAt) {
			t.Errorf("list is not newest first: %s (%s) came before %s (%s)",
				links[i].Code, links[i].CreatedAt.Format(time.RFC3339Nano),
				links[i+1].Code, links[i+1].CreatedAt.Format(time.RFC3339Nano))
			break
		}
	}
	if links[0].Code != codes[len(codes)-1] {
		t.Errorf("first in the list is %q, want the newest, %q", links[0].Code, codes[len(codes)-1])
	}
}

func checkDelete(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "bye"})

	if got := statusOf(t, p, "DELETE", "/api/links/"+l.Code, alice); got != http.StatusNoContent {
		t.Errorf("DELETE /api/links/%s: status %d, want 204", l.Code, got)
	}
	if got := statusOf(t, p, "GET", "/"+l.Code, ""); got != http.StatusNotFound {
		t.Errorf("redirect after delete: status %d, want 404", got)
	}
	if got := statusOf(t, p, "GET", "/api/links/"+l.Code, alice); got != http.StatusNotFound {
		t.Errorf("GET /api/links/%s after delete: status %d, want 404", l.Code, got)
	}
	if got := statusOf(t, p, "DELETE", "/api/links/"+l.Code, alice); got != http.StatusNotFound {
		t.Errorf("deleting twice: status %d the second time, want 404", got)
	}
	if got := statusOf(t, p, "DELETE", "/api/links/neverexisted", alice); got != http.StatusNotFound {
		t.Errorf("deleting a code that never existed: status %d, want 404", got)
	}
}

// ---- rate limiting -------------------------------------------------------

func checkRateLimit(e *Env, t *T) {
	p := e.StartRate(5)

	limited, ok := 0, 0
	var retryAfter string
	for i := 0; i < 25; i++ {
		r, err := p.Do("GET", "/api/links", alice, nil)
		if err != nil {
			t.Fatalf("GET /api/links: %v", err)
		}
		switch r.Status {
		case http.StatusOK:
			ok++
		case http.StatusTooManyRequests:
			limited++
			if retryAfter == "" {
				retryAfter = r.Header.Get("Retry-After")
			}
		default:
			t.Errorf("GET /api/links: unexpected status %d", r.Status)
		}
	}

	if limited == 0 {
		t.Errorf("25 requests against a -rate of 5 produced no 429 at all (%d succeeded)", ok)
	}
	if ok == 0 {
		t.Errorf("25 requests against a -rate of 5 produced no successes; the bucket should start full")
	}
	if limited > 0 {
		n, err := strconv.Atoi(retryAfter)
		if err != nil {
			t.Errorf("Retry-After on a 429 was %q, want whole seconds", retryAfter)
		} else if n < 1 {
			t.Errorf("Retry-After was %d, want at least 1", n)
		}
	}
}

func checkRateLimitPerToken(e *Env, t *T) {
	p := e.StartRate(5)

	drained := false
	for i := 0; i < 25; i++ {
		if statusOf(t, p, "GET", "/api/links", alice) == http.StatusTooManyRequests {
			drained = true
			break
		}
	}
	if !drained {
		t.Fatalf("could not drain alice's bucket in 25 requests at -rate 5")
	}

	if got := statusOf(t, p, "GET", "/api/links", bob); got == http.StatusTooManyRequests {
		t.Errorf("bob was rate limited because alice drained her bucket; buckets are per token")
	} else if got != http.StatusOK {
		t.Errorf("GET /api/links as bob: status %d, want 200", got)
	}
}

func checkRedirectsNotLimited(e *Env, t *T) {
	p := e.StartRate(2)
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "hot"})

	for i := 0; i < 40; i++ {
		got := statusOf(t, p, "GET", "/"+l.Code, "")
		if got == http.StatusTooManyRequests {
			t.Fatalf("redirect %d of 40 was rate limited; the limit applies to /api/ only", i+1)
		}
		if got != http.StatusFound {
			t.Fatalf("redirect %d of 40: status %d, want 302", i+1, got)
		}
	}
}

func checkMetrics(e *Env, t *T) {
	p := e.StartRate(4)

	m0, err := p.Metrics()
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}
	if m0.Goroutines < 1 {
		t.Errorf("goroutines is %d; report runtime.NumGoroutine()", m0.Goroutines)
	}
	if m0.RequestsInFlight != 1 {
		t.Errorf("requests_in_flight is %d while serving that very request, want 1", m0.RequestsInFlight)
	}

	// A known number of requests: 1 create, 3 redirects, then enough API
	// calls to run the bucket dry.
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "m"})
	requests := 1
	for i := 0; i < 3; i++ {
		if got := statusOf(t, p, "GET", "/"+l.Code, ""); got != http.StatusFound {
			t.Fatalf("redirect: status %d, want 302", got)
		}
		requests++
	}
	limited := 0
	for i := 0; i < 12; i++ {
		if statusOf(t, p, "GET", "/api/links", alice) == http.StatusTooManyRequests {
			limited++
		}
		requests++
	}

	m1, err := p.Metrics()
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}

	// m1 counts itself, so the delta is the requests we made plus one.
	if got, want := m1.RequestsTotal-m0.RequestsTotal, int64(requests+1); got != want {
		t.Errorf("requests_total went up by %d, want %d (every request counts, this one included)", got, want)
	}
	if got, want := m1.RedirectsTotal-m0.RedirectsTotal, int64(3); got != want {
		t.Errorf("redirects_total went up by %d, want %d (302 responses only)", got, want)
	}
	if got, want := m1.RateLimitedTotal-m0.RateLimitedTotal, int64(limited); got != want {
		t.Errorf("rate_limited_total went up by %d, want %d (429 responses only)", got, want)
	}
	if m1.LinksTotal != 1 {
		t.Errorf("links_total is %d, want 1", m1.LinksTotal)
	}
	if m1.RequestsInFlight != 1 {
		t.Errorf("requests_in_flight is %d with nothing else running, want 1", m1.RequestsInFlight)
	}
	if m1.UptimeSeconds <= m0.UptimeSeconds {
		t.Errorf("uptime_seconds went from %g to %g; it should increase", m0.UptimeSeconds, m1.UptimeSeconds)
	}
}

// ---- concurrency ---------------------------------------------------------

// checkMixedLoad runs reads and writes against the store at the same time and
// requires the process to still be there afterwards.
//
// This is the check that catches an unguarded map. Go's runtime watches for a
// map being read while it is being written and stops the program dead when it
// sees one, which from out here looks like every connection dropping at once.
// That is a much louder symptom than a lost counter increment, and it is the
// one an unsynchronised service actually dies of.
func checkMixedLoad(e *Env, t *T) {
	p := e.StartRate(1e6) // the limiter is not what is under test here

	var codes []string
	for i := 0; i < 10; i++ {
		codes = append(codes, mustCreate(t, p, alice, map[string]any{
			"url": fmt.Sprintf("https://example.com/seed/%d", i),
		}).Code)
	}

	const workers, each = 24, 40
	var wg sync.WaitGroup
	var mu sync.Mutex
	dropped := 0
	var firstErr error

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < each; i++ {
				var err error
				switch (w + i) % 4 {
				case 0: // a write into the map
					_, err = p.Do("POST", "/api/links", alice, map[string]any{
						"url": fmt.Sprintf("https://example.com/%d/%d", w, i),
					})
				case 1, 3: // reads of the map
					_, err = p.Do("GET", "/"+codes[i%len(codes)], "", nil)
				case 2:
					_, err = p.Do("GET", "/api/links", alice, nil)
				}
				if err != nil {
					mu.Lock()
					dropped++
					if firstErr == nil {
						firstErr = err
					}
					mu.Unlock()
				}
			}
		}(w)
	}
	wg.Wait()

	if dropped > 0 {
		t.Errorf("%d of %d requests never got a response: %v", dropped, workers*each, firstErr)
	}
	if got := statusOf(t, p, "GET", "/healthz", ""); got != http.StatusOK {
		t.Errorf("GET /healthz after mixed load: status %d, want 200; the process did not survive its own traffic", got)
	}
	if stderr := p.Stderr(); strings.Contains(stderr, "concurrent map") || strings.Contains(stderr, "fatal error") {
		t.Errorf("the runtime stopped the process:\n%s", firstLine(stderr))
	}
}

// goroutineSlack is how much growth is treated as noise. The runtime starts
// and stops goroutines of its own, and connection handling is not instant, so
// a tight bound would flake. A leak of one goroutine per request clears this
// by an order of magnitude, which is the only resolution needed.
const goroutineSlack = 25

func checkNoGoroutineLeak(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "leak"})

	hammer := func(n int) {
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				p.Do("GET", "/"+l.Code, "", nil) //nolint:errcheck // a failed request is not what this check is about
			}()
		}
		wg.Wait()
	}

	// Warm up first, so the baseline is taken with connection pools and lazy
	// runtime machinery already up. Measuring from a cold start would charge
	// the target for goroutines that were always going to exist.
	hammer(40)
	p.HTTP().CloseIdleConnections()
	base, ok := settledGoroutines(t, p)
	if !ok {
		t.Fatalf("goroutine count never settled before the load; nothing can be measured against it")
	}

	hammer(250)
	p.HTTP().CloseIdleConnections()

	after, ok := settledGoroutines(t, p)
	if !ok {
		t.Errorf("goroutine count never settled after 250 requests; it was still moving after 10s")
	}
	if after > base+goroutineSlack {
		t.Errorf("goroutines went from %d to %d across 250 requests, want no more than %d",
			base, after, base+goroutineSlack)
		t.Errorf("something started per request is never finishing; the count on /metrics is how this is seen from outside")
	}
	t.Logf("goroutines: %d before, %d after 250 requests", base, after)
}

// settledGoroutines polls /metrics until the count stops moving, so the
// measurement is of what stayed rather than what happened to be in flight.
func settledGoroutines(t *T, p *harness.Proc) (int, bool) {
	last, stable := -1, 0
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		m, err := p.Metrics()
		if err != nil {
			t.Fatalf("GET /metrics: %v", err)
		}
		if m.Goroutines == last {
			if stable++; stable >= 3 {
				return m.Goroutines, true
			}
		} else {
			last, stable = m.Goroutines, 0
		}
		time.Sleep(150 * time.Millisecond)
	}
	return last, false
}

func checkClicksExact(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "race"})

	const n = 250
	var wg sync.WaitGroup
	var mu sync.Mutex
	bad := 0
	start := make(chan struct{})

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start // release them together, so they actually collide
			r, err := p.Do("GET", "/"+l.Code, "", nil)
			if err != nil || r.Status != http.StatusFound {
				mu.Lock()
				bad++
				mu.Unlock()
			}
		}()
	}
	close(start)
	wg.Wait()

	if bad > 0 {
		t.Errorf("%d of %d concurrent redirects did not return 302", bad, n)
	}

	after, r := fetchLink(t, p, alice, l.Code)
	if r.Status != http.StatusOK {
		t.Fatalf("GET /api/links/%s: status %d, want 200", l.Code, r.Status)
	}
	if after.Clicks != int64(n-bad) {
		t.Errorf("%d concurrent redirects recorded %d clicks, want %d", n, after.Clicks, n-bad)
		t.Errorf("lost increments are what a race looks like from outside; run your own tests with -race")
	}
}

func checkAliasRace(e *Env, t *T) {
	p := e.StartRate(500)

	const n = 40
	var wg sync.WaitGroup
	var mu sync.Mutex
	statuses := map[int]int{}
	start := make(chan struct{})

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			r, err := p.Do("POST", "/api/links", alice, map[string]any{
				"url":   fmt.Sprintf("https://example.com/%d", i),
				"alias": "contested",
			})
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				statuses[-1]++
				return
			}
			statuses[r.Status]++
		}(i)
	}
	close(start)
	wg.Wait()

	if statuses[http.StatusCreated] != 1 {
		t.Errorf("%d concurrent POSTs for the same alias produced %d 201s, want exactly 1", n, statuses[http.StatusCreated])
	}
	if got, want := statuses[http.StatusConflict], n-1; got != want {
		t.Errorf("got %d 409s, want %d", got, want)
	}
	for status, count := range statuses {
		if status != http.StatusCreated && status != http.StatusConflict {
			t.Errorf("%d request(s) returned %d, want only 201 and 409", count, status)
		}
	}
}

func checkGeneratedUnique(e *Env, t *T) {
	p := e.StartRate(500)

	const n = 80
	var wg sync.WaitGroup
	var mu sync.Mutex
	codes := map[string]int{}
	failures := 0
	start := make(chan struct{})

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			r, err := p.Do("POST", "/api/links", alice, map[string]any{"url": fmt.Sprintf("https://example.com/%d", i)})
			mu.Lock()
			defer mu.Unlock()
			if err != nil || r.Status != http.StatusCreated {
				failures++
				return
			}
			var l harness.Link
			if err := r.JSON(&l); err != nil {
				failures++
				return
			}
			codes[l.Code]++
		}(i)
	}
	close(start)
	wg.Wait()

	if failures > 0 {
		t.Errorf("%d of %d concurrent creates failed", failures, n)
	}
	for code, count := range codes {
		if count > 1 {
			t.Errorf("code %q was handed out %d times; generated codes must be unique", code, count)
		}
	}
	if len(codes) != n-failures {
		t.Errorf("%d creates succeeded but only %d distinct codes came back", n-failures, len(codes))
	}
}

// ---- durability ----------------------------------------------------------

func checkDurableWrites(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com/keep", "alias": "keepme"})

	// No signal, no grace. A 201 that has been sent is a promise already made.
	p.Kill()

	p2 := e.Start()
	got, r := fetchLink(t, p2, alice, l.Code)
	if r.Status != http.StatusOK {
		t.Fatalf("after a kill and restart, GET /api/links/%s: status %d, want 200", l.Code, r.Status)
	}
	if got.URL != "https://example.com/keep" {
		t.Errorf("url after restart is %q, want %q", got.URL, "https://example.com/keep")
	}
	if got.Owner != "alice" {
		t.Errorf("owner after restart is %q, want alice", got.Owner)
	}
	if statusOf(t, p2, "GET", "/"+l.Code, "") != http.StatusFound {
		t.Errorf("the link does not redirect after restart")
	}
}

func checkDurableClicks(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "counted"})

	const clicks = 12
	for i := 0; i < clicks; i++ {
		if got := statusOf(t, p, "GET", "/"+l.Code, ""); got != http.StatusFound {
			t.Fatalf("redirect %d: status %d, want 302", i+1, got)
		}
	}

	// The spec allows batching, and allows losing up to a second of clicks.
	// Wait that second out before pulling the plug, then hold them to it.
	time.Sleep(1500 * time.Millisecond)
	p.Kill()

	p2 := e.Start()
	got, r := fetchLink(t, p2, alice, l.Code)
	if r.Status != http.StatusOK {
		t.Fatalf("after restart, GET /api/links/%s: status %d, want 200", l.Code, r.Status)
	}
	if got.Clicks != clicks {
		t.Errorf("after restart the link reports %d clicks, want %d", got.Clicks, clicks)
		t.Errorf("clicks may be batched, but they must be flushed at least once a second")
	}
}

func checkDurableDeletes(e *Env, t *T) {
	p := e.Start()
	keep := mustCreate(t, p, alice, map[string]any{"url": "https://example.com/keep", "alias": "stays"})
	gone := mustCreate(t, p, alice, map[string]any{"url": "https://example.com/gone", "alias": "goes"})

	if got := statusOf(t, p, "DELETE", "/api/links/"+gone.Code, alice); got != http.StatusNoContent {
		t.Fatalf("DELETE: status %d, want 204", got)
	}
	p.Kill()

	p2 := e.Start()
	if got := statusOf(t, p2, "GET", "/api/links/"+gone.Code, alice); got != http.StatusNotFound {
		t.Errorf("a deleted link came back after restart: status %d, want 404", got)
	}
	if got := statusOf(t, p2, "GET", "/api/links/"+keep.Code, alice); got != http.StatusOK {
		t.Errorf("a link that was not deleted is missing after restart: status %d, want 200", got)
	}
}

func checkGracefulShutdown(e *Env, t *T) {
	p := e.Start()
	l := mustCreate(t, p, alice, map[string]any{"url": "https://example.com", "alias": "drain"})
	for i := 0; i < 5; i++ {
		statusOf(t, p, "GET", "/"+l.Code, "")
	}

	if err := p.Interrupt(); err != nil {
		// Announced, never silent. A skipped check that says nothing reads
		// exactly like a check that passed.
		t.Skipf("%v", err)
	}

	code, err := p.WaitExit(6 * time.Second)
	if err != nil {
		t.Fatalf("after an interrupt: %v (the spec allows 5 seconds)", err)
	}
	if code != 0 {
		t.Errorf("exited %d after an interrupt, want 0\nstderr: %s", code, p.Stderr())
	}

	p2 := e.Start()
	got, r := fetchLink(t, p2, alice, l.Code)
	if r.Status != http.StatusOK {
		t.Fatalf("after a graceful shutdown, GET /api/links/%s: status %d, want 200", l.Code, r.Status)
	}
	if got.Clicks != 5 {
		t.Errorf("a graceful shutdown kept %d clicks, want 5; shutdown flushes everything", got.Clicks)
	}
}

// ---- shared helpers ------------------------------------------------------

func fetchLink(t *T, p *harness.Proc, token, code string) (harness.Link, *harness.Resp) {
	r, err := p.Do("GET", "/api/links/"+code, token, nil)
	if err != nil {
		t.Fatalf("GET /api/links/%s: %v", code, err)
	}
	var l harness.Link
	if r.Status == http.StatusOK {
		if err := r.JSON(&l); err != nil {
			t.Fatalf("GET /api/links/%s body: %v", code, err)
		}
	}
	return l, r
}

func listLinks(t *T, p *harness.Proc, token string) []harness.Link {
	r, err := p.Do("GET", "/api/links", token, nil)
	if err != nil {
		t.Fatalf("GET /api/links: %v", err)
	}
	if r.Status != http.StatusOK {
		t.Fatalf("GET /api/links: status %d, want 200", r.Status)
	}
	var links []harness.Link
	if err := r.JSON(&links); err != nil {
		t.Fatalf("GET /api/links body: %v", err)
	}
	return links
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
