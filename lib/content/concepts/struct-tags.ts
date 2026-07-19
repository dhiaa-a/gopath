import { Concept } from "../../content"

export const structTags: Concept = {
	slug: "struct-tags",
	name: "Struct tags",
	tagline:
		"A backtick string the compiler never reads. A typo in it is a bug that ships.",
	summary:
		"A struct tag is a plain string literal attached to a field. Go has no annotations, so this one string carries all the field metadata that libraries like <code>encoding/json</code> read at runtime through reflection. The compiler checks that it is a well-formed string and nothing more: it does not know <code>json</code> from <code>josn</code>, or <code>omitempty</code> from <code>omitEmpty</code>. Get the content wrong and the field silently serialises under the wrong name, or fails to be omitted, with no error at compile time and no error at run time. <code>go vet</code> catches malformed <em>syntax</em>, but is blind to a perfectly-formed tag that says the wrong thing.",
	mentalModel:
		"The tag is a sticky note the compiler staples to a field without reading it. Down the line some library peels the note off with reflection and tries to follow it. If the note is legible but wrong, the library does exactly what it says, which is the wrong thing, and nobody who could have known better was ever consulted. The convention (key, colon, double-quoted value, space, next key) is enforced by nothing except a vet check you have to actually run, and even that check only proves the note is legible, not that it is correct. So a struct tag is the one place in a statically typed language where you are writing untyped, unchecked configuration, in a string, next to code that looks type-safe.",
	retrievalPrompts: [
		"A field is Email string with tag jsonn:\"email\" (note the extra n). Your API starts returning \"Email\" as the key instead of \"email\". Compiler and vet are both silent. Why? || The tag key is jsonn, not json, so encoding/json looks for a json tag, finds none, and falls back to the Go field name Email. The tag is not ignored because it is invalid; it is a valid tag for a package called jsonn that does not exist. vet checks that the tag is well-formed, which it is, not that json is spelled correctly, which is a fact only the reader of the tag could know. The fix is one character, and nothing will point you at it.",
		"You write json:\"created,omitEmpty\" so a zero timestamp disappears from the output. It never disappears. What went wrong, and would vet have caught it? || omitempty is all lowercase; omitEmpty is treated as an unknown option and silently ignored, so the field is always emitted. vet would not catch it: the tag is syntactically perfect, and the ,omitempty sub-format is encoding/json's own invention, not something reflect or vet understands. The only tools that would catch it are a test that marshals a zero value and asserts the key is absent, or reading the output.",
		"A struct has a field password string with tag json:\"password\", and it never appears in the JSON no matter what you set the tag to. Why, and what does vet say? || The field is unexported (lowercase p). encoding/json works through reflection, and reflection cannot read unexported fields from another package, so the field is skipped regardless of any tag. This is a language-level visibility rule, not a JSON decision, which is why no tag can override it. vet does flag this specific case: struct field password has json tag but is not exported. Capitalise the field and use the tag to keep the lowercase key.",
	],
	codeExample: `package main

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// A tag is a string literal. The compiler checks that it is a well-formed
// string and stops there. Two of the three tags below are wrong, and
// nothing in the toolchain will tell you so.
type User struct {
	ID   int    \`json:"id"\`
	Name string \`jsonn:"name"\`         // typo in the KEY
	Bio  string \`json:"bio,omitEmpty"\` // wrong case in the OPTION
	pw   string // unexported: no tag could rescue this field
}

func main() {
	u := User{ID: 7, pw: "hunter2"}

	// Everything but ID is the zero value. Exactly one field should vanish.
	out, err := json.Marshal(u)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))

	// What encoding/json actually saw. Lookup is the whole contract:
	// no key, no tag, no error.
	t := reflect.TypeOf(u)
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		v, ok := f.Tag.Lookup("json")
		fmt.Printf("%-4s raw=%-26q json=%-16q found=%v\\n",
			f.Name, string(f.Tag), v, ok)
	}
}`,
	codeExplanation:
		"This compiles clean, <code>go vet</code> is clean, and it prints:<br><br><code>{\"id\":7,\"Name\":\"\",\"bio\":\"\"}</code><br><code>ID   raw=\"json:\\\"id\\\"\"              json=\"id\"             found=true</code><br><code>Name raw=\"jsonn:\\\"name\\\"\"           json=\"\"               found=false</code><br><code>Bio  raw=\"json:\\\"bio,omitEmpty\\\"\"   json=\"bio,omitEmpty\"  found=true</code><br><code>pw   raw=\"\"                         json=\"\"               found=false</code><br><br>The first line is three bugs in one object. <code>\"Name\":\"\"</code>: the <code>jsonn</code> typo meant no <code>json</code> tag was found (the reflect dump confirms <code>found=false</code>), so the field fell back to its Go name <code>Name</code> with a capital N. <code>\"bio\":\"\"</code> is present despite being the zero value, because <code>omitEmpty</code> is not <code>omitempty</code> and the misspelled option was silently discarded (the tag itself parsed fine, <code>found=true</code>, value <code>bio,omitEmpty</code> and all). And <code>pw</code> is absent entirely: it is unexported, so reflection could not touch it and no tag could have changed that. Every one of these is a live production bug, and the toolchain reported nothing, because a tag is a string and the string was well-formed. The reflect table is the point: <code>Tag.Lookup(\"json\")</code> is exactly what <code>encoding/json</code> calls, and it answers \"is there a json key here\" with no notion of whether the key you wanted was spelled right.",
	designRationale:
		"Java has annotations, C# has attributes, Python has decorators: first-class, type-checked metadata with their own declarations. Go deliberately has none of that. Rob Pike's line is that Go optimises for reading code, and a general annotation system is a second language bolted onto the first. So instead of annotations Go gives every struct field exactly one string of freeform metadata, with a loose documented convention (<code>key:\"value\"</code> pairs separated by spaces) parsed at runtime by <code>reflect.StructTag</code>. That is the whole mechanism, and every property on this page follows from it. The tag is untyped because it is a string literal, and the compiler's entire responsibility for a string literal is that it is a valid string. The mapping from tag to behaviour is resolved by reflection at run time rather than by code generation at build time, which is what lets <code>encoding/json</code> be a single import with two functions and no schema files and no build step, the trade being that the mapping is invisible to the compiler. The <code>,omitempty</code> sub-syntax inside the value is not part of the tag convention at all; it is a private format that <code>encoding/json</code> invented and parses itself, which is why a different package's tag can use a completely different value grammar and why nothing central can validate <code>omitempty</code> for you. Because the compiler structurally cannot check tags, the check went where Go puts checks that are not type errors: <code>go vet</code>, specifically its <code>structtag</code> analyzer. It validates the conventional syntax and flags the tagged-but-unexported case, and that is the ceiling of what it can do, because whether <code>json</code> is misspelled or <code>omitempty</code> is miscased are facts about a specific library's semantics, not about the tag's syntax. The unexported-field rule is the one piece that comes from outside the tag system: <code>encoding/json</code> cannot see <code>pw</code> because reflection cannot read unexported fields across a package boundary, which is Go's visibility rule enforced at the reflect layer, and no tag exists that can grant access the language forbids.",
	commonMistakes: [
		{
			title: "A typo in the tag key, serialising under the Go field name",
			body: "<code>jsonn:\"email\"</code> or <code>josn:\"email\"</code> is a valid tag for a package that does not exist, so <code>encoding/json</code> finds no <code>json</code> key and falls back to the exported field name (<code>Email</code>, capital E). The output is wrong, the compiler is silent, and <code>vet</code> is silent because the tag is well-formed. Only a round-trip test or reading the JSON catches it.",
		},
		{
			title: "Miscasing or misspelling an option like omitempty",
			body: "<code>omitEmpty</code>, <code>OmitEmpty</code>, and <code>omit_empty</code> are all silently ignored, so the field is never omitted. The <code>,omitempty</code> format is <code>encoding/json</code>'s own, parsed only by it, so nothing else can validate it. The tag parses fine (<code>Lookup</code> returns the whole string); the option inside it is just unrecognised and dropped.",
		},
		{
			title: "Assuming malformed tags are also silent (they are not)",
			body: "Structural mistakes <em>are</em> caught, but only by <code>go vet</code>, not the compiler. A space after the colon (<code>json: \"a\"</code>) or single quotes (<code>json:'b'</code>) both yield <code>struct field tag ... not compatible with reflect.StructTag.Get: bad syntax for struct tag value</code>, and a tag on an unexported field yields <code>struct field c has json tag but is not exported</code>. If <code>vet</code> is not in your pipeline, even these become silent, and <code>Lookup</code> quietly returns not-found.",
		},
		{
			title: "Tagging an unexported field and expecting it to serialise",
			body: "<code>password string \\`json:\"password\"\\`</code> never appears in the output: reflection cannot read unexported fields, so <code>encoding/json</code> skips it whatever the tag says. This is why \"my field is missing from the JSON\" is, nine times out of ten, a lowercase first letter. Export the field (<code>Password</code>) and use the tag to keep the wire name lowercase.",
		},
		{
			title: "Reading tags with Get instead of Lookup",
			body: "If you write your own reflection over tags, <code>f.Tag.Get(\"json\")</code> returns <code>\"\"</code> both when the key is absent and when it is present but empty (<code>json:\"\"</code>), collapsing two different cases into one. <code>f.Tag.Lookup(\"json\")</code> returns <code>(value, ok)</code> so you can tell them apart. Use <code>Lookup</code> whenever \"absent\" and \"empty\" should behave differently.",
		},
	],
	relatedSlugs: ["json-decode", "encoding-json", "structs", "tooling"],
}
