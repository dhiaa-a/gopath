import { Concept } from "../../content"

export const jsonDecode: Concept = {
	slug: "json-decode",
	name: "JSON encoding/decoding",
	tagline:
		"Encode structs to JSON and decode JSON into typed structs using struct tags.",
	summary:
		'Go\'s <code>encoding/json</code> package serialises Go values to JSON and back. You map JSON field names to struct fields using struct tags like <code>json:"user_name"</code>. Unexported fields are always ignored. Two approaches: <code>json.Marshal/Unmarshal</code> for bytes, and <code>json.NewEncoder/NewDecoder</code> for streams.',
	mentalModel:
		"JSON decoding is like filling out a form from a dictionary. The dictionary has arbitrary keys; your form has fixed fields. Struct tags tell the decoder which dictionary key maps to which form field. Keys in the dictionary with no matching field are silently ignored.",
	retrievalPrompts: [
		"A struct field is name string (lowercase). Will json.Marshal include it? What must you change? || No. Unexported fields are always silently skipped. Change to Name string (uppercase). To keep the JSON key lowercase, add a struct tag: json:\"name\".",
		"You call json.Unmarshal(data, user) where user is a value, not a pointer. What happens to your struct? || The call silently does nothing useful. Unmarshal needs an addressable value to write into. It may return nil error but the struct in your variable is unchanged. Always pass a pointer: json.Unmarshal(data, &user).",
		"What is the difference between json:\"field,omitempty\" and json:\"-\"? Give a concrete use case for each. || omitempty omits the field only when it is the zero value; use it for optional fields like a timestamp that may not be set. json:\"-\" always omits regardless of value; use it for sensitive fields like passwords that should never appear in JSON output.",
	],
	codeExample: `package main

import (
	"encoding/json"
	"fmt"
	"log"
)

type User struct {
	ID        int    \`json:"id"\`
	Name      string \`json:"name"\`
	Email     string \`json:"email"\`
	Password  string \`json:"-"\`          // always omitted
	CreatedAt string \`json:"created_at,omitempty"\` // omit if empty
}

func main() {
	// Decode
	raw := \`{"id":1,"name":"Alice","email":"alice@example.com"}\`
	var u User
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%+v\n", u) // {ID:1 Name:Alice Email:alice@...}

	// Encode
	u.Password = "secret" // won't appear in output
	out, err := json.MarshalIndent(u, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(out))
}`,
	codeExplanation:
		'Struct tags control serialisation. <code>json:"-"</code> always excludes a field. <code>omitempty</code> excludes it when it\'s a zero value. Pass a pointer to <code>Unmarshal</code> (<code>&u</code>); it needs to write to your struct. Use <code>json.NewDecoder(r.Body)</code> in HTTP handlers instead of reading the body into a byte slice first.',
	designRationale:
		"Go's JSON package uses struct tags (backtick string metadata on field declarations) because they keep the mapping between Go fields and JSON keys visible at the declaration site without code generation. The designers chose runtime reflection over compile-time codegen to keep the user-facing API simple: one package, two functions, no schema files. Unexported fields are always silently ignored because the package respects Go's visibility rules: if a field is not exported, it is not part of the type's public contract.",
	commonMistakes: [
		{
			title: "Unexported fields silently ignored",
			body: "Fields starting with a lowercase letter are unexported and always ignored by encoding/json; no error is given. If your JSON isn't serialising, check field names start with uppercase.",
		},
		{
			title: "Decoding into value vs pointer",
			body: "<code>json.Unmarshal(data, u)</code> silently does nothing useful. You must pass a pointer: <code>json.Unmarshal(data, &u)</code>.",
		},
	],
	relatedSlugs: ["structs", "error-handling", "http-handler"],
}
