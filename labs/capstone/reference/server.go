package main

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	codeLen      = 7
	codeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	aliasMaxLen  = 32
)

type server struct {
	store   *Store
	tokens  map[string]string // token -> owner
	limiter *limiter
	metrics *metrics
	now     func() time.Time
}

// linkResponse is the wire shape. It is deliberately not Link: short_url is
// built per request from the Host header, and the store has no business
// knowing what hostname a client used to reach us.
type linkResponse struct {
	Code      string     `json:"code"`
	ShortURL  string     `json:"short_url"`
	URL       string     `json:"url"`
	Owner     string     `json:"owner"`
	Clicks    int64      `json:"clicks"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

func (s *server) view(l *Link, r *http.Request) linkResponse {
	return linkResponse{
		Code:      l.Code,
		ShortURL:  "http://" + r.Host + "/" + l.Code,
		URL:       l.URL,
		Owner:     l.Owner,
		Clicks:    l.Clicks,
		CreatedAt: l.CreatedAt.UTC(),
		ExpiresAt: l.ExpiresAt,
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()

	// Public.
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /metrics", s.handleMetrics)
	mux.HandleFunc("GET /{code}", s.handleRedirect)

	// Authenticated. A literal segment beats a wildcard in ServeMux, so
	// /api/... never reaches the redirect handler.
	mux.Handle("POST /api/links", s.authed(s.handleCreate))
	mux.Handle("GET /api/links", s.authed(s.handleList))
	mux.Handle("GET /api/links/{code}", s.authed(s.handleGet))
	mux.Handle("DELETE /api/links/{code}", s.authed(s.handleDelete))

	return s.instrument(mux)
}

// instrument counts every request, including the one asking for the counts.
// in-flight is incremented before the handler and decremented after it, so the
// smallest number /metrics can honestly report about itself is 1.
func (s *server) instrument(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.metrics.requestsTotal.Add(1)
		s.metrics.requestsInFlight.Add(1)
		defer s.metrics.requestsInFlight.Add(-1)
		next.ServeHTTP(w, r)
	})
}

type ownerHandler func(w http.ResponseWriter, r *http.Request, owner string)

// authed resolves the bearer token, then spends a rate limit token for it.
// Order matters: an unknown token must not be able to fill a bucket, and a
// rate limited request must not reach a handler.
func (s *server) authed(h ownerHandler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		owner, ok := s.authenticate(r)
		if !ok {
			w.Header().Set("WWW-Authenticate", "Bearer")
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if allowed, retry := s.limiter.allow(tokenOf(r)); !allowed {
			s.metrics.rateLimitedTotal.Add(1)
			w.Header().Set("Retry-After", strconv.Itoa(retry))
			writeErr(w, http.StatusTooManyRequests, "rate limited")
			return
		}
		h(w, r, owner)
	})
}

func tokenOf(r *http.Request) string {
	h := r.Header.Get("Authorization")
	scheme, tok, found := strings.Cut(h, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(tok)
}

func (s *server) authenticate(r *http.Request) (string, bool) {
	tok := tokenOf(r)
	if tok == "" {
		return "", false
	}
	owner, ok := s.tokens[tok]
	return owner, ok
}

func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.metrics.snapshot(s.store.count()))
}

func (s *server) handleRedirect(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	now := s.now()

	l := s.store.get(code)
	if l == nil {
		writeErr(w, http.StatusNotFound, "no such link")
		return
	}
	if l.expired(now) {
		// Gone, not missing. The client asked about something that did exist,
		// and telling it so is the difference between "you typo'd" and "you
		// are too late".
		writeErr(w, http.StatusGone, "link expired")
		return
	}
	if s.store.click(code, now) == nil {
		writeErr(w, http.StatusNotFound, "no such link")
		return
	}
	s.metrics.redirectsTotal.Add(1)
	http.Redirect(w, r, l.URL, http.StatusFound)
}

type createRequest struct {
	URL       string `json:"url"`
	Alias     string `json:"alias"`
	ExpiresIn int64  `json:"expires_in"`
}

func (s *server) handleCreate(w http.ResponseWriter, r *http.Request, owner string) {
	var req createRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "malformed JSON body")
		return
	}
	if !validTarget(req.URL) {
		writeErr(w, http.StatusBadRequest, "url must be an absolute http or https URL")
		return
	}
	if req.ExpiresIn < 0 {
		writeErr(w, http.StatusBadRequest, "expires_in must not be negative")
		return
	}
	if req.Alias != "" && !validAlias(req.Alias) {
		writeErr(w, http.StatusBadRequest, "alias must be 1 to 32 letters, digits, - or _")
		return
	}

	now := s.now().UTC()
	l := &Link{URL: req.URL, Owner: owner, CreatedAt: now}
	if req.ExpiresIn > 0 {
		exp := now.Add(time.Duration(req.ExpiresIn) * time.Second)
		l.ExpiresAt = &exp
	}

	if req.Alias != "" {
		l.Code = req.Alias
		if err := s.store.put(l); errors.Is(err, errCodeTaken) {
			writeErr(w, http.StatusConflict, "alias already in use")
			return
		} else if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not save link")
			return
		}
	} else {
		if err := s.createGenerated(l); err != nil {
			writeErr(w, http.StatusInternalServerError, "could not save link")
			return
		}
	}

	writeJSON(w, http.StatusCreated, s.view(l, r))
}

// createGenerated picks a free code and stores the link. put is the arbiter:
// checking "is this code taken" and then storing is two operations, and
// between them another request can take it, so the collision is settled inside
// the one lock that can settle it.
func (s *server) createGenerated(l *Link) error {
	for attempt := 0; attempt < 10; attempt++ {
		code, err := newCode()
		if err != nil {
			return err
		}
		l.Code = code
		err = s.store.put(l)
		if errors.Is(err, errCodeTaken) {
			continue
		}
		return err
	}
	return errors.New("could not find a free code in 10 attempts")
}

func (s *server) handleList(w http.ResponseWriter, r *http.Request, owner string) {
	links := s.store.listOwned(owner)
	// Never nil: an owner with no links gets [], and a client that has to
	// special-case null is a client we broke on purpose.
	out := make([]linkResponse, 0, len(links))
	for _, l := range links {
		out = append(out, s.view(l, r))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) handleGet(w http.ResponseWriter, r *http.Request, owner string) {
	l := s.store.get(r.PathValue("code"))
	// Not yours is indistinguishable from not there, deliberately. A 403 here
	// would let anyone enumerate which codes exist.
	if l == nil || l.Owner != owner || l.expired(s.now()) {
		writeErr(w, http.StatusNotFound, "no such link")
		return
	}
	writeJSON(w, http.StatusOK, s.view(l, r))
}

func (s *server) handleDelete(w http.ResponseWriter, r *http.Request, owner string) {
	ok, err := s.store.del(r.PathValue("code"), owner)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not delete link")
		return
	}
	if !ok {
		writeErr(w, http.StatusNotFound, "no such link")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validTarget(raw string) bool {
	if raw == "" {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

// validAlias counts characters, not bytes. Ranging a string yields runes, so
// this counts what a person would count.
func validAlias(alias string) bool {
	n := 0
	for _, r := range alias {
		n++
		if n > aliasMaxLen {
			return false
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_' {
			return false
		}
	}
	return n > 0
}

// newCode returns a random code. crypto/rand rather than math/rand: codes are
// guessable capability tokens, and "nobody will bother" is not a threat model.
func newCode() (string, error) {
	buf := make([]byte, codeLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, codeLen)
	for i, b := range buf {
		out[i] = codeAlphabet[int(b)%len(codeAlphabet)]
	}
	return string(out), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// The status line is already out; all that is left is to say so.
		logf("write response: %v", err)
	}
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
