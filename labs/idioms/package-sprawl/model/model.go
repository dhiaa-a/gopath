//go:build !solution

package model

// MaxBodyRunes is the largest snippet body the store accepts. It lives
// with the entity and is exported because validate is the layer that
// enforces it.
const MaxBodyRunes = 4096

// ModelSnippet is one stored snippet: an id and the text filed under it.
type ModelSnippet struct {
	ID   string
	Body string
}

// SnippetStore is the storage contract the service layer satisfies. It is
// declared next to the entity so a future HTTP or CLI layer can depend on
// the model package and nothing else.
type SnippetStore interface {
	Add(id, body string) error
	Get(id string) (string, error)
	Preview(id string) (string, error)
	List() []string
}
