//go:build solution

// Reference implementation of the HTTP layer. Do not open this until your
// own run is green; it exists so the repo's checks can prove the suite
// passes against a real implementation.
package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

type server struct {
	repo TaskRepository
}

// NewServer wires the routes and returns the root handler.
func NewServer(repo TaskRepository) http.Handler {
	s := &server{repo: repo}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /tasks", s.create)
	mux.HandleFunc("GET /tasks", s.list)
	mux.HandleFunc("GET /tasks/{id}", s.get)
	mux.HandleFunc("PUT /tasks/{id}", s.update)
	mux.HandleFunc("DELETE /tasks/{id}", s.delete)
	return mux
}

// writeJSON is the single funnel for success bodies, so Content-Type is set
// exactly once, before WriteHeader locks the header map.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError keeps every failure the same shape: {"error":"message"}.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// repoError maps repository sentinels to statuses in one place. errors.Is,
// not ==, because repositories wrap their errors with context.
func repoError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "task not found")
	case errors.Is(err, ErrDuplicate):
		writeError(w, http.StatusConflict, "title already exists")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

// pathID parses the {id} segment. A non-numeric ID is the client's mistake,
// so it gets 400, not 404: the resource was never named correctly.
func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}

func (s *server) create(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Title == "" {
		writeError(w, http.StatusBadRequest, "title required")
		return
	}
	task, err := s.repo.Create(r.Context(), in.Title)
	if err != nil {
		repoError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (s *server) list(w http.ResponseWriter, r *http.Request) {
	limit, offset := 50, 0
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = n
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			writeError(w, http.StatusBadRequest, "invalid offset")
			return
		}
		offset = n
	}
	tasks, err := s.repo.List(r.Context(), limit, offset)
	if err != nil {
		repoError(w, err)
		return
	}
	if tasks == nil {
		// Encode a real empty array, not null. A nil slice marshals to
		// null and breaks clients that iterate the result.
		tasks = []Task{}
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (s *server) get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	task, err := s.repo.GetByID(r.Context(), id)
	if err != nil {
		repoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *server) update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in struct {
		Title string `json:"title"`
		Done  bool   `json:"done"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Title == "" {
		writeError(w, http.StatusBadRequest, "title required")
		return
	}
	task := &Task{ID: id, Title: in.Title, Done: in.Done}
	if err := s.repo.Update(r.Context(), task); err != nil {
		repoError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *server) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	if err := s.repo.Delete(r.Context(), id); err != nil {
		repoError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
