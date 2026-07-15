// Command observability runs the deliberately slow report service this
// project profiles. Every request to /process renders a 1000-entry report
// through svc.Optimized, so a CPU profile of this process points straight at
// the code you are supposed to fix.
//
// The blank import of net/http/pprof is load-bearing: its init registers the
// /debug/pprof/ handlers on http.DefaultServeMux. The admin listener serves
// that default mux on a separate port, so the profiling endpoints never face
// the public interface.
//
// Run it, load it, profile it:
//
//	go run .
//	go run ./loadgen -n 10000 -c 50
//	go tool pprof -http=:8081 "http://127.0.0.1:6060/debug/pprof/profile?seconds=30"
package main

import (
	"flag"
	"io"
	"log"
	"net/http"
	_ "net/http/pprof"

	"gopath.dev/labs/observability/svc"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "public listen address")
	admin := flag.String("admin", "127.0.0.1:6060", "admin listen address, serves pprof")
	n := flag.Int("n", 1000, "entries rendered per request")
	flag.Parse()
	if *n < 0 {
		log.Fatalf("-n must be >= 0, got %d", *n)
	}

	entries := svc.GenEntries(*n)

	go func() {
		// nil handler means http.DefaultServeMux, which carries pprof.
		log.Fatal(http.ListenAndServe(*admin, nil))
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/process", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		io.WriteString(w, svc.Optimized(entries))
	})

	log.Printf("report service on http://%s/process, pprof on http://%s/debug/pprof/", *addr, *admin)
	log.Fatal(http.ListenAndServe(*addr, mux))
}
