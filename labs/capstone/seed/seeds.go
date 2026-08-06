package main

// A seed is one deliberate bug, applied to a copy of the reference
// implementation, that the conformance suite must catch.
//
// This is the other half of the harness. A suite that has only ever been run
// against correct code has not been tested, it has been agreed with. Each seed
// below breaks the reference in a specific, named way and names the checks
// that must go red because of it. If a seed applies cleanly, compiles, and the
// suite still passes, that is a hole in the suite and the run fails.
//
// Class names match the failure labs at labs/failures, so a learner whose
// submission trips one of these has somewhere to go and read about it.
type seed struct {
	Name  string
	Class string // failure-lab slug, or "" for bugs specific to this spec
	Why   string
	Edits []edit
	// Catches names the checks that must fail. Every one of them, not any of
	// them: a seed that trips only some of the checks it should is a seed that
	// has stopped meaning what it says.
	Catches []string
}

type edit struct {
	File    string
	Find    string
	Replace string
}

func seeds() []seed {
	return []seed{
		{
			Name:  "data-race",
			Class: "data-race",
			Why:   "the store's map written with no lock held at all",
			Edits: []edit{{
				File: "store.go",
				Find: "func (s *Store) put(l *Link) error {\n" +
					"\ts.mu.Lock()\n" +
					"\tif _, taken := s.links[l.Code]; taken {\n" +
					"\t\ts.mu.Unlock()\n" +
					"\t\treturn errCodeTaken\n" +
					"\t}\n" +
					"\tc := *l\n" +
					"\ts.links[l.Code] = &c\n" +
					"\ts.seq++\n" +
					"\tseq := s.seq\n" +
					"\ts.mu.Unlock()",
				Replace: "func (s *Store) put(l *Link) error {\n" +
					"\tif _, taken := s.links[l.Code]; taken {\n" +
					"\t\treturn errCodeTaken\n" +
					"\t}\n" +
					"\tc := *l\n" +
					"\ts.links[l.Code] = &c\n" +
					"\ts.seq++\n" +
					"\tseq := s.seq",
			}},
			// Only the mixed-load check. The alias race trips on this too, but
			// only about half the time: its window is the few instructions
			// between "is this code taken" and the assignment, while a map
			// being iterated for a snapshot is wide open for as long as the
			// iteration takes. A seed is only worth having if it fires every
			// time, so this one names the check that does.
			Catches: []string{"concurrency/mixed-load-stays-up"},
		},
		{
			Name:  "goroutine-leak",
			Class: "goroutine-leak",
			Why:   "a goroutine started per request that nothing ever wakes",
			Edits: []edit{{
				File:    "server.go",
				Find:    "\t\ts.metrics.requestsTotal.Add(1)\n\t\ts.metrics.requestsInFlight.Add(1)",
				Replace: "\t\ts.metrics.requestsTotal.Add(1)\n\t\tgo func() { <-make(chan struct{}) }()\n\t\ts.metrics.requestsInFlight.Add(1)",
			}},
			Catches: []string{"concurrency/no-goroutine-leak"},
		},
		{
			Name:  "time-after-leak",
			Class: "time-after-leak",
			Why:   "time.After per request holds a goroutine and a timer until it fires",
			Edits: []edit{{
				File:    "server.go",
				Find:    "\t\tdefer s.metrics.requestsInFlight.Add(-1)\n\t\tnext.ServeHTTP(w, r)",
				Replace: "\t\tdefer s.metrics.requestsInFlight.Add(-1)\n\t\tgo func() { <-time.After(time.Hour) }()\n\t\tnext.ServeHTTP(w, r)",
			}},
			Catches: []string{"concurrency/no-goroutine-leak"},
		},
		{
			Name:  "nil-map-write",
			Class: "nil-map-write",
			Why:   "a map that was never made reads fine and panics on the first write",
			Edits: []edit{{
				File:    "store.go",
				Find:    "\ts := &Store{path: path, links: map[string]*Link{}}",
				Replace: "\ts := &Store{path: path}",
			}},
			Catches: []string{"create/generated-code-shape"},
		},
		{
			Name:  "json-silent-zero",
			Class: "json-silent-zero",
			Why:   "a tag that does not match the wire field: the value arrives and is dropped",
			Edits: []edit{{
				File:    "server.go",
				Find:    "\tExpiresIn int64  `json:\"expires_in\"`",
				Replace: "\tExpiresIn int64  `json:\"expiresIn\"`",
			}},
			Catches: []string{"create/expires-in-honoured", "redirect/expired-410"},
		},
		{
			Name:  "typed-nil",
			Class: "typed-nil",
			Why:   "a nil *T in an error interface is not nil, so the happy path reports failure",
			Edits: []edit{{
				File: "server.go",
				Find: "\tok, err := s.store.del(r.PathValue(\"code\"), owner)\n\tif err != nil {",
				Replace: "\ttype storeErr struct{ error }\n" +
					"\tvar perr *storeErr\n" +
					"\tok, _ := s.store.del(r.PathValue(\"code\"), owner)\n" +
					"\tvar err error = perr\n" +
					"\tif err != nil {",
			}},
			Catches: []string{"delete/removes-link"},
		},
		{
			Name:  "deadlock",
			Class: "deadlock",
			Why:   "sync.Mutex is not reentrant, so taking it twice parks the request forever",
			Edits: []edit{{
				File: "store.go",
				Find: "func (s *Store) count() int {\n\ts.mu.Lock()\n\tdefer s.mu.Unlock()\n\treturn len(s.links)",
				Replace: "func (s *Store) count() int {\n\ts.mu.Lock()\n\tdefer s.mu.Unlock()\n" +
					"\ts.mu.Lock()\n\tdefer s.mu.Unlock()\n\treturn len(s.links)",
			}},
			Catches: []string{"metrics/counters"},
		},
		{
			Name:  "bytes-vs-runes",
			Class: "bytes-vs-runes",
			Why:   "indexing a string walks bytes, so a limit meant for characters rejects valid input",
			Edits: []edit{{
				File:    "server.go",
				Find:    "\tn := 0\n\tfor _, r := range alias {\n\t\tn++",
				Replace: "\tn := 0\n\tfor i := 0; i < len(alias); i++ {\n\t\tr := rune(alias[i])\n\t\tn++",
			}},
			Catches: []string{"create/alias-length-counts-runes"},
		},
		{
			Name:  "append-sharing",
			Class: "append-sharing",
			Why:   "appending into a buffer shared between calls leaks one caller's rows into the next",
			Edits: []edit{
				{
					File: "store.go",
					Find: "func (s *Store) listOwned(owner string) []*Link {\n" +
						"\ts.mu.Lock()\n" +
						"\tout := make([]*Link, 0, len(s.links))",
					Replace: "var sharedScratch []*Link\n\n" +
						"func (s *Store) listOwned(owner string) []*Link {\n" +
						"\ts.mu.Lock()\n" +
						"\tout := sharedScratch",
				},
				{
					File:    "store.go",
					Find:    "\t\tout = append(out, &c)\n\t}\n\ts.mu.Unlock()",
					Replace: "\t\tout = append(out, &c)\n\t}\n\tsharedScratch = out\n\ts.mu.Unlock()",
				},
			},
			Catches: []string{"list/only-owner-links"},
		},
		{
			Name:  "no-write-through",
			Class: "",
			Why:   "acknowledging a write before it is durable, then losing it to a kill",
			Edits: []edit{{
				File:    "store.go",
				Find:    "\treturn s.durable(seq)\n}\n\n// del removes a link",
				Replace: "\t_ = seq\n\treturn nil\n}\n\n// del removes a link",
			}},
			Catches: []string{"durability/writes-survive-kill"},
		},
		{
			Name:  "shared-rate-bucket",
			Class: "",
			Why:   "one bucket for every token, so a busy customer throttles everybody else",
			Edits: []edit{{
				File:    "limit.go",
				Find:    "\tb, ok := l.buckets[key]",
				Replace: "\tkey = \"\"\n\tb, ok := l.buckets[key]",
			}},
			Catches: []string{"ratelimit/buckets-are-per-token"},
		},
	}
}
