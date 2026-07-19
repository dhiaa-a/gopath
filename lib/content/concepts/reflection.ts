import { Concept } from "../../content"

export const reflection: Concept = {
	slug: "reflection",
	name: "Reflection",
	tagline:
		"Reflection reads any field and sets almost none of them. Settability wants a value reached through a pointer and an exported field, and the compiler that used to guarantee both is no longer in the room.",
	summary:
		"Reflection is how a Go program inspects and changes values whose types it did not know when it was compiled. Two functions open the door: <code>reflect.TypeOf</code> hands you the type and <code>reflect.ValueOf</code> hands you the value, both taking an <code>interface{}</code> so any value can be passed. It is the machinery under <code>encoding/json</code>, <code>database/sql</code> row scanning, and <code>text/template</code>: each receives a value of a type it has never seen and must walk its fields by name. The power comes with two prices the type system normally pays for you. Errors that would have been a compile failure become a run-time panic, because the compiler cannot see what a reflected call will do, and the operations allocate and are slow next to a direct field access. So reflection is a last resort: correct when you genuinely cannot know the type in advance, and a mistake when an interface or a generic would have done the same job with the compiler still watching.",
	mentalModel:
		"Hold Rob Pike's three laws, because they are the whole model. One: reflection goes from an interface value to a reflect object. Every value in Go can be stored in an <code>interface{}</code>, which carries a (type, value) pair, and <code>reflect.TypeOf</code> and <code>reflect.ValueOf</code> pull those two halves out into a <code>reflect.Type</code> and a <code>reflect.Value</code> you can examine at run time. Two: reflection goes back, from a reflect object to an interface value, via <code>v.Interface()</code>, which reboxes the value so you can type-assert it to something concrete. Those two are a round trip, and together they are what lets <code>encoding/json</code> take your <code>interface{}</code>, discover it is a struct with three fields, read each one, and hand values back. The third law is the sharp one: to modify a value through reflection, the <code>reflect.Value</code> must be settable, and settability requires that the Value is addressable and was not obtained from an unexported field. Addressable means it names real storage rather than a copy, which is why you must reflect a pointer and call <code>Elem()</code> to reach the thing it points at; a value passed by value was copied into the interface and has no address you are allowed to write. The unexported half is a separate rule with the same spirit: reflection will not do what the language forbids in source, so a lowercase field stays sealed even when you hold its address. Read the three laws as one sentence: you can look at anything, you can hand it back, and you can change it only when you are holding real, exported storage.",
	retrievalPrompts: [
		"You reflect a struct with reflect.ValueOf(s), find the field you want, call SetString, and it panics with 'using unaddressable value'. You did not touch the field name or the type. What is wrong? || You passed the struct by value. reflect.ValueOf takes an interface{}, so s was copied into an interface and the reflect.Value points at that copy, which has no address you may write; CanSet is false and Set panics. Even if it did not panic you would be mutating a throwaway copy, not s. The fix is to reflect a pointer and step through it: reflect.ValueOf(&s).Elem() is the addressable pointee, and its exported fields are settable. The error is complaining about addressability, not about the field.",
		"reflect.ValueOf(&s).Elem() is addressable, and CanAddr() on its unexported field returns true, yet CanSet() is false and SetInt panics. If it is addressable, why can it not be set? || Because settability has a second requirement beyond addressability: the Value must not have been obtained through an unexported field. reflect enforces the language's own visibility rule at the reflect layer, refusing to let you write another package's unexported state through a door the compiler would have shut. The field carries a read-only flag the moment you reach it by a lowercase name, and that flag survives even though the storage is addressable. It is deliberate: if reflection could set unexported fields, the export rule would mean nothing, and every invariant a package protects with unexported state would be one reflect call from being violated.",
		"A colleague defends a reflection-heavy decoder by saying the tests pass. Why is 'the tests pass' a weaker guarantee here than for the same code written with a type switch or a generic? || Because reflection moves the error from compile time to run time, so 'passes' only covers the type combinations the tests actually exercised. A SetString on an int field, a Field index past the end, an Interface() on an unexported field: each type-checks fine and panics only when that exact path runs with that exact type. A type switch or a generic function would have made the same mistakes a compile error the whole team saw, before any test ran. Reflection trades the compiler's total coverage for a run-time check that fires only on the inputs you remembered to test, which is why it belongs where you truly cannot know the type, not where you simply did not reach for the typed tool.",
	],
	codeExample: `package main

import (
	"fmt"
	"reflect"
)

type User struct {
	Name  string \`json:"name" validate:"required"\`
	Age   int    \`json:"age"\`
	admin bool   // unexported: reflection can see it but never set it
}

func main() {
	u := User{Name: "Ada", Age: 36, admin: true}

	// First law: interface value -> reflect object. ValueOf's parameter is
	// interface{}, so u is boxed into an interface before reflect ever sees it.
	// That copy is why nothing reached through ValueOf(u) is settable.
	t := reflect.TypeOf(u)
	v := reflect.ValueOf(u)
	fmt.Printf("walking %s (%d fields), from a COPY:\\n", t.Name(), t.NumField())
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		fmt.Printf("  %-6s %-6s = %-5v  json=%-6q canset=%v\\n",
			f.Name, f.Type, v.Field(i), f.Tag.Get("json"), v.Field(i).CanSet())
	}

	// Second law: reflect object -> interface value, via Interface(). Legal only
	// on an exported field; the round trip hands back an interface{} you assert.
	// This is exactly the move encoding/json makes per field.
	back := v.Field(0).Interface().(string)
	fmt.Printf("law two round trip: Field(0).Interface() = %q\\n", back)

	// Third law: to MODIFY, the Value must be settable, which needs
	// addressability. ValueOf(&u).Elem() is the addressable pointee, so its
	// exported fields are settable and SetString/SetInt mutate the real u.
	pv := reflect.ValueOf(&u).Elem()
	pv.FieldByName("Name").SetString("Grace")
	pv.FieldByName("Age").SetInt(37)
	fmt.Printf("after Set via &u: %+v\\n", u)

	// The unexported field is now ADDRESSABLE (u is), yet still not settable:
	// reflect will not grant through reflection the access the language forbids
	// in source, so another package's unexported state stays sealed.
	admin := pv.FieldByName("admin")
	fmt.Printf("admin: canaddr=%v canset=%v\\n", admin.CanAddr(), admin.CanSet())

	// Proving it: Set on a non-settable Value is a run-time panic, not a compile
	// error. The type system waved this program through; reflect stops it here.
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("recovered from SetBool:", r)
		}
	}()
	admin.SetBool(false)
	fmt.Println("this line never runs")
}`,
	codeExplanation:
		"This compiles, <code>go vet</code> is clean, and it prints:<br><br><code>walking User (3 fields), from a COPY:</code><br><code>&nbsp;&nbsp;Name&nbsp;&nbsp;&nbsp;string = Ada&nbsp;&nbsp;&nbsp;&nbsp;json=\"name\" canset=false</code><br><code>&nbsp;&nbsp;Age&nbsp;&nbsp;&nbsp;&nbsp;int&nbsp;&nbsp;&nbsp;&nbsp;= 36&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;json=\"age\"&nbsp;&nbsp;canset=false</code><br><code>&nbsp;&nbsp;admin&nbsp;&nbsp;bool&nbsp;&nbsp;&nbsp;= true&nbsp;&nbsp;&nbsp;json=\"\"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;canset=false</code><br><code>law two round trip: Field(0).Interface() = \"Ada\"</code><br><code>after Set via &u: {Name:Grace Age:37 admin:true}</code><br><code>admin: canaddr=true canset=false</code><br><code>recovered from SetBool: reflect: reflect.Value.SetBool using value obtained using unexported field</code><br><br>Read it top to bottom. The walk is the first law and a struct-tag read in one loop: <code>reflect.TypeOf(u)</code> gives the field names, types, and tags (<code>f.Tag.Get(\"json\")</code> is the exact call <code>encoding/json</code> makes), and <code>reflect.ValueOf(u)</code> gives the values. Notice the unexported <code>admin</code> field prints its value <code>true</code> perfectly: reflection can read it, because the read methods do not check the export flag. Notice also that <code>canset=false</code> on every field, including the exported ones, because <code>u</code> was passed by value into <code>ValueOf</code>'s <code>interface{}</code> parameter and a copy has no writable address. The second line is the second law: <code>Field(0).Interface()</code> reboxes the field into an <code>interface{}</code> and the <code>.(string)</code> assertion pulls <code>\"Ada\"</code> back out, the round trip that lets a decoder hand you concrete values. The third block is the third law working: <code>reflect.ValueOf(&u).Elem()</code> is addressable because it is the pointee of a real pointer, so <code>SetString</code> and <code>SetInt</code> actually mutate <code>u</code>, and the struct comes back <code>{Name:Grace Age:37 admin:true}</code>. Look at what did not change: <code>admin</code> is still <code>true</code>. The line <code>admin: canaddr=true canset=false</code> is the reason, and it is the subtle one: the unexported field is addressable now, because <code>u</code> is, but it is still not settable, because reflection honours the language's visibility rule and refuses to write a lowercase field. The last line proves the cost that defines reflection: <code>SetBool</code> on that field is not a compile error, it is a run-time panic, recovered here so the program can print it. The message names the exact rule, <code>using value obtained using unexported field</code>. Change <code>ValueOf(&u).Elem()</code> back to <code>ValueOf(u)</code> and every <code>SetString</code> above panics the same way, because the whole thing hinges on addressability. On the Go Playground the output is byte-for-byte identical; nothing here depends on timing or platform.",
	designRationale:
		"Reflection exists because a statically typed language still has to solve problems where the type is genuinely unknown until run time, and before generics there was no other tool for them. <code>encoding/json</code> is the clearest case: it is one package that must serialise a type it has never seen and will never see the source of, so it cannot be written against any concrete struct, and it cannot be written with an interface either, because there is no method set that means 'has whatever fields you happen to have'. The only way in is to receive the value as an <code>interface{}</code> and ask, at run time, what it actually is. That is why <code>reflect.TypeOf</code> and <code>reflect.ValueOf</code> take <code>interface{}</code>: an interface value is already a (type, value) pair in memory, and reflection is not doing anything exotic, it is exposing the two words the interface was already carrying. Pike's three laws are just the shape of that pair made into an API: out of the interface, back into it, and, if you hold real storage, into the memory it names. The settability rule falls out of how the language already works. You can only take the address of an addressable value in ordinary Go too, and an interface holds a copy, so a value pulled from an interface has no address you may write. Requiring a pointer and an <code>Elem()</code> is not a reflect quirk, it is the same rule the compiler applies to <code>&x</code>, enforced one level down. The unexported-field seal is the visibility rule enforced at that same layer: reflection can read an unexported field's value, which is why <code>admin</code> printed, but it cannot hand it out through <code>Interface()</code> or write it through <code>Set</code>, because if it could, the difference between an exported and an unexported field would evaporate and every package's invariants would be writable by any caller with a <code>reflect</code> import. The costs are not incidental either. A <code>reflect.Value</code> is a fat struct carrying a type pointer and flags, every <code>Set</code> and <code>Field</code> does run-time type and bounds checks the compiler would have done for free, and <code>Interface()</code> boxes the value back into an <code>interface{}</code>, which forces it to the heap: reflection is one of the reliable ways to turn a stack value into a heap allocation, which is why it shows up in <code>escape-analysis</code> output and in a <code>pprof</code> allocation profile. All of this is why the standard advice is that reflection is a last resort. It moves the compiler's guarantees to run time and it is slow, and since Go 1.18 a large fraction of the code that used to need it (containers, and helpers parametric over a set of types you actually know) should be a generic function instead, where the compiler is back in the room. Reflection is correct exactly where the type is unknowable in principle, a decoder facing arbitrary JSON, a template facing arbitrary data, and a mistake everywhere the typed tool still exists.",
	commonMistakes: [
		{
			title: "Reflecting a value when you meant to change it",
			body: "<code>reflect.ValueOf(s)</code> copies <code>s</code> into an <code>interface{}</code>, so the <code>reflect.Value</code> points at a copy with no writable address; <code>CanSet</code> is false and <code>Set</code> panics with <code>using unaddressable value</code>. Reading is fine, writing is not. To mutate the original you must reflect a pointer and descend: <code>reflect.ValueOf(&s).Elem()</code> is the addressable pointee whose exported fields are settable. The tell is that <code>Set</code> panics while the field name and type are obviously correct, because the complaint is about addressability, not the field.",
		},
		{
			title: "Expecting to set an unexported field once you hold its address",
			body: "Even through a pointer, a lowercase field has <code>CanSet() == false</code> and <code>Set</code> panics with <code>using value obtained using unexported field</code>. Addressability is necessary but not sufficient; the Value must also not carry the read-only flag reflection stamps on any field reached by an unexported name. This is not a limitation to route around, it is reflection refusing to break the language's visibility guarantee, because if it let you, unexported state would protect nothing. You may read the value (the read methods allow it), but treat writing it as forbidden, because it is.",
		},
		{
			title: "Forgetting that every reflect call is a run-time check",
			body: "<code>SetString</code> on an int field, <code>Field(9)</code> on a three-field struct, <code>Interface()</code> on an unexported field: all compile cleanly and all panic at run time, only on the path that reaches them with that type. Reflection replaces the compiler's exhaustive, before-you-run checking with per-call checks that fire only when exercised, so a reflected path is only as correct as your test coverage of the exact types it meets. Wrap reflective code that handles outside input in <code>recover</code> if a panic must not crash the process, and prefer a typed alternative wherever one exists so the check moves back to build time.",
		},
		{
			title: "Using reflection where an interface or generic was the tool",
			body: "If the behaviour you need is 'call a method these types share', that is an interface, and the compiler verifies every type satisfies it. If it is 'do the same operation over a set of types you know', that is a generic function since Go 1.18, and again the compiler checks it. Reflection is the tool only when the type is unknowable at compile time, a decoder facing arbitrary JSON or a template facing arbitrary data. Reaching for <code>reflect</code> because it feels powerful trades away the whole benefit of a static type system to solve a problem the type system was ready to solve, usually with more code and worse errors.",
		},
		{
			title: "Assuming reflection is as cheap as a field access",
			body: "It is not close. A <code>reflect.Value</code> carries a type pointer and flags, each <code>Field</code> and <code>Set</code> performs run-time type and bounds checks, and <code>Interface()</code> boxes the value into an <code>interface{}</code>, which forces it onto the heap: reflection is a reliable way to turn a would-be stack value into an allocation, visible in <code>escape-analysis</code> output and in a <code>pprof</code> allocation profile. On a hot path this is the difference between a decoder that keeps up and one that dominates your CPU graph. When reflection is unavoidable but repeated, cache what you can (the <code>reflect.Type</code>, the field indices, a built plan) so you pay the inspection cost once rather than per call, which is exactly what the faster JSON libraries do.",
		},
	],
	relatedSlugs: ["struct-tags", "interfaces", "encoding-json", "escape-analysis"],
}
