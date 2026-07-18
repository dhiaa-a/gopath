import { Concept } from "../../content"

export const typedNil: Concept = {
	slug: "typed-nil",
	name: "Typed nil",
	tagline:
		"An interface is a (type, value) pair, so an interface holding a nil pointer is not nil, and err != nil fires when the error is nil.",
	summary:
		"An interface value is two words, a type and a value, and it is nil only when <em>both</em> are nil. Assign a nil pointer of some concrete type to an interface and the type word is stamped with that type, so the interface is not nil even though it points at nothing. This is the typed-nil trap, and its worst form is an error: a function that returns a concrete <code>*MyError</code> as an <code>error</code> hands back a non-nil error on success, so every <code>if err != nil</code> up the call chain fires on a request that succeeded. nil has other shapes too, each with its own rule: a nil map reads but cannot be written, a nil slice appends fine, a nil channel blocks forever, and a nil pointer can carry a perfectly good method.",
	mentalModel:
		"A nil check on an interface asks whether both of its words are empty, not whether it points at nothing. The instant a typed nil pointer enters an interface, the type word is filled in, and the interface stops being the zero interface while its value word stays nil, so <code>== nil</code> is false. For the concrete nils the rule is gentler and worth holding as one sentence: a nil value is the usable zero value for everything that only reads, and a panic only for an operation that needs storage a nil never allocated. Read a nil map, get zeros; range a nil slice, get nothing; select on a nil channel, wait forever. Write to a nil map and it panics, because the hash table it would write into was never created. Append to a nil slice and it works, because append is allowed to allocate a new array and hand it back.",
	retrievalPrompts: [
		"A helper returns *ValidationError and returns nil on success. Up the call chain it is used as an error, and the caller's `if err != nil` fires on valid input. Why, and where is the fix? || Assigning a nil *ValidationError to an error fills the interface's type word with *ValidationError and leaves the value word nil, and an interface is nil only when both words are nil, so err != nil is true. errors.Is(err, nil) does not rescue you: it reduces to err == nil, the exact broken comparison. The fix is at the source, not the call site. The function's return type must be error and it must return a bare nil, never a typed nil pointer. go vet stays silent on this, so nothing warns you before it ships.",
		"You range a nil map and it works, you append to a nil slice and it works, so you treat nil collections as safe. Then a write to the nil map panics. Why does append survive but the map write not? || A nil slice append may allocate a fresh backing array and return it, so it needs nothing to exist beforehand. A map variable is a pointer to a runtime hash table, and a nil map's table was never allocated, so `m[k] = v` panics with \"assignment to entry in nil map\" while reads, len, and range of that same nil map are all fine because they can answer from nothing. The reads lull you into thinking it is initialised, and the first write bites.",
		"In a select loop you keep a channel in the cases after it closes, and the loop pins a CPU. What is happening, and what does setting that channel to nil do? || A closed channel is always ready to receive, yielding the zero value immediately, so its case is selected on every iteration and the loop spins hot. Setting the channel variable to nil disables that case, because a nil channel is never ready: a send or receive on nil blocks forever. That is the one nil shape that is a feature. Nilling a channel to switch off a select case is the idiom for finishing with one source and letting the others continue.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
)

type ValidationError struct{ Field string }

func (e *ValidationError) Error() string { return "invalid field: " + e.Field }

// The bug is the return type. It looks like good practice: be specific.
func validate(name string) *ValidationError {
	if name == "" {
		return &ValidationError{Field: "name"}
	}
	return nil // a nil *ValidationError, which is not a nil error
}

func check(name string) error {
	return validate(name) // *ValidationError -> error: the TYPE comes along
}

func main() {
	err := check("alice") // nothing is wrong with alice
	fmt.Println("err == nil        :", err == nil)
	fmt.Printf("value and type     : %v, %T\\n", err, err)
	fmt.Println("errors.Is(err, nil):", errors.Is(err, nil))

	if err != nil {
		fmt.Println("caller reports failure:", err) // the 3am log line
	}
}`,
	codeExplanation:
		"This prints <code>err == nil        : false</code>, then <code>value and type     : &lt;nil&gt;, *main.ValidationError</code>, then <code>errors.Is(err, nil): false</code>, and finally <code>caller reports failure: &lt;nil&gt;</code>. Nothing was wrong with <code>alice</code>, and the program reports a failure whose text is <code>&lt;nil&gt;</code>: a failure that names nothing, which is the exact shape of the 3am log line this bug produces. The mechanism is the return types. <code>validate</code> returns <code>*ValidationError</code>, and <code>return nil</code> there is a nil <em>pointer</em>: the value is absent but the pointer still has the type <code>*ValidationError</code>. When <code>check</code> returns that pointer as an <code>error</code>, the interface is built from it, and an interface records the concrete type, so the type word is <code>*ValidationError</code> while the value word is nil. <code>== nil</code> compares both words against the empty interface's two nil words, they differ in the type word, and the result is false. The <code>%T</code> line makes it visible: the value prints as <code>&lt;nil&gt;</code> and the type is very much present. <code>errors.Is(err, nil)</code> is false because, when its target is nil, <code>errors.Is</code> is just <code>err == nil</code> under the hood, so it inherits the same broken comparison rather than fixing it. The last line prints <code>&lt;nil&gt;</code> rather than crashing only because <code>fmt</code> is defensive: it detects the nil pointer and substitutes <code>&lt;nil&gt;</code> instead of calling <code>Error()</code> on it. Call <code>err.Error()</code> directly, the way <code>log.Fatal(err.Error())</code> would, and it dereferences the nil pointer and panics. And <code>go vet</code> reports nothing on any of this, which is what lets it reach production. The fix is one word in one signature: make <code>validate</code> return <code>error</code>, and its <code>return nil</code> becomes a genuine nil interface.",
	designRationale:
		"An interface has to carry its dynamic type, because that is what makes method dispatch, type assertions, and reflection possible: the type word points at an itab holding the concrete type and its method set, and the value word holds the data or a pointer to it. The genuinely nil interface has both words zero, meaning no type and no method table to dispatch through. A nil pointer stored in an interface still has a concrete type, so the itab is present and the interface is a live value that happens to point at nothing, and <code>== nil</code>, which compares both words, is correctly false. This is not an oversight; it is documented in the Go FAQ under \"Why is my nil error value not equal to nil?\", and it is the unavoidable price of interfaces knowing their type. The alternative, silently collapsing a typed nil pointer into the nil interface, would mean the interface forgot which concrete type it held, which would break a type assertion or a reflect call on exactly the nil values you might need to inspect. So the language keeps the type and pushes the discipline onto you: a function used as an <code>error</code> must be declared to return <code>error</code> and must <code>return nil</code>, never a typed nil pointer, because the conversion that stamps the type word happens at the <code>return</code>, silently, with no diagnostic. The other nils come from a friendlier decision, that zero values should be useful. A nil slice is a valid empty slice, a nil map is a valid empty map to read, a nil channel is a valid channel that blocks, and a method can run on a nil pointer receiver as long as it checks before dereferencing, which is what makes recursive structures like a nil <code>*Tree</code> answer <code>Sum()</code> with 0 instead of crashing. The one asymmetry that catches everyone, a nil map write panicking while a nil slice append succeeds, falls straight out of the data structures. A slice is a (pointer, len, cap) header and append is permitted to swap the pointer for a newly allocated array, so it needs nothing to exist first. A map variable is a pointer to a runtime hash table, and a write must mutate that table in place; a nil map has no table, and rather than silently allocate one behind your back and make the map's identity nondeterministic, the runtime panics. The skill is knowing which nil you are holding and which operation you are about to perform on it, because the word <code>nil</code> is doing at least five different jobs.",
	commonMistakes: [
		{
			title: "Returning a concrete pointer type where an error is expected",
			body: "The canonical typed-nil bug. Declare a function <code>func validate(...) *MyError</code> and use it as an <code>error</code> anywhere, and its <code>return nil</code> becomes a non-nil error, so every <code>err != nil</code> fires on success. A single function in the chain declared with the concrete pointer return type poisons every caller above it. The fix is never a smarter nil check; it is declaring the return type <code>error</code> and returning a bare <code>nil</code>. <code>go vet</code> does not flag it, so the discipline has to be yours.",
		},
		{
			title: "Papering over typed nil with reflect",
			body: "<code>reflect.ValueOf(err).IsNil()</code> looks like a fix and works for pointer-shaped errors, returning true for a typed nil pointer. It panics on value-shaped ones: a <code>syscall.Errno</code> is a <code>uintptr</code>, and <code>IsNil</code> on it gives <code>panic: reflect: call of reflect.Value.IsNil on uintptr Value</code>. You have traded a wrong answer for a crash on inputs you did not test. Reflection cannot rescue a design that put the concrete type in the return signature; fix the signature.",
		},
		{
			title: "Writing to a nil map",
			body: "<code>var m map[string]int</code> is nil, and reads, <code>len</code>, and <code>range</code> all work on it, which makes it feel initialised. The first <code>m[k] = v</code> panics with <code>assignment to entry in nil map</code>. The usual culprit is a map-typed struct field, nil until something assigns it, that one code path writes to before any constructor ran. Initialise with <code>make</code> or a literal before the first write; the safe reads are exactly what hide the missing initialisation.",
		},
		{
			title: "Assuming methods on a nil pointer are safe, or that they always panic",
			body: "Both halves bite. A method on a nil pointer receiver is legal and useful when it checks the receiver first, which is how a nil <code>*Tree</code> can return <code>Sum() == 0</code>; a method that dereferences a field before the nil check panics. The subtle version hides behind <code>fmt</code>'s kindness: <code>fmt.Println(err)</code> on a typed-nil error prints <code>&lt;nil&gt;</code> because <code>fmt</code> guards nil pointers, but <code>log.Fatal(err.Error())</code> calls <code>Error()</code> directly on the nil pointer and dereferences it. The reassuring log line and the crashing one differ only in whether <code>fmt</code> was between you and the method.",
		},
		{
			title: "Forgetting that a nil channel blocks forever",
			body: "An uninitialised channel, <code>var ch chan int</code>, is nil, and a send or receive on it does not error, it deadlocks: <code>fatal error: all goroutines are asleep - deadlock!</code> with the goroutine parked in <code>[chan send (nil chan)]</code>. The same property is a feature inside a <code>select</code>, where nilling a channel disables its case, and a bug when the nil channel is your only one. The tell is a channel you declared but a constructor never assigned; <code>make</code> it before anyone sends or receives.",
		},
	],
	relatedSlugs: ["error-handling", "interfaces", "maps", "channels", "pointers"],
}
