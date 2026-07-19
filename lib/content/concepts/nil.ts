import { Concept } from "../../content"

export const nilConcept: Concept = {
	slug: "nil",
	name: "The many nils",
	tagline:
		"nil is not one thing: it is the typed zero of pointers, slices, maps, channels, functions, and interfaces, and each kind answers a different set of operations.",
	summary:
		"The single word <code>nil</code> is the zero value of six different kinds of type: pointers, slices, maps, channels, functions, and interfaces. That is why \"just check for nil\" is not one rule but several. nil is a <em>typed</em> zero, and which operations are legal on it depends entirely on the type. A nil map reads fine and panics on write. A nil slice appends fine and ranges to nothing. A nil channel blocks forever, which a <code>select</code> turns into a feature. A nil function value panics when you call it. A method can run on a nil pointer receiver as long as it never dereferences the receiver. And the interface case hides a second trap: an interface holding a nil pointer is itself <em>not</em> nil, which is common enough and surprising enough to have its own page, <code>typed-nil</code>.",
	mentalModel:
		"One sentence predicts almost every case: a nil value is a usable, empty version of its type for any operation that only reads or measures, and a panic only when the operation needs storage that a nil never allocated. Read a nil map, range a nil slice, take <code>len</code> of either, and you get zeros and empty loops, because those questions can be answered from nothing. Write to a nil map and it panics, because the write needs a hash table that was never created. Call a nil function and it panics, because there is no code address to jump to. Two shapes break the pattern and are worth memorizing on their own: a nil slice <em>append</em> succeeds even though it looks like a write, because append is allowed to allocate a fresh array and hand it back, so it needs nothing beforehand; and a nil channel does not panic at all, it blocks forever, which is a deadlock on its own and a switch you can flip inside a <code>select</code>. Hold the read-is-fine, write-needs-storage rule plus those two exceptions, and you rarely have to guess.",
	retrievalPrompts: [
		"You read a value out of a nil map and it works, so you assume the map is usable, then a write to it panics. Why does read succeed but write fail? || A map variable is a pointer to a runtime hash table, and a nil map has no table. A read, `len`, or `range` can answer from nothing (the key is simply absent, so you get the zero value), but a write needs a table to put the entry in, and rather than silently allocate one the runtime panics with `assignment to entry in nil map`. The safe reads are exactly what hide the missing `make`.",
		"Append to a nil slice works, but writing to a nil map panics. Both look like writes. Why does one allocate for you and the other refuse? || `append` returns a new slice and is permitted to allocate a fresh backing array when it needs one, so a nil slice (a zero pointer, zero len, zero cap header) is a fine starting point: nothing has to exist first. A map write mutates the hash table in place, and a nil map has no table to mutate; allocating one behind your back would make the map's identity depend on write order, so the runtime panics instead. The rule is which operation needs pre-existing storage.",
		"A receive on a nil channel does not panic and does not error. What does it do, and when is that useful rather than a bug? || It blocks forever. A nil channel is never ready, so `<-ch` or `ch <- v` parks the goroutine permanently, and if it is the only channel involved you get `fatal error: all goroutines are asleep - deadlock!`. The same never-ready property is the idiom inside a `select`: setting a case's channel to nil disables that case, letting you stop selecting on a finished source while the other cases keep running. Bug when it is your only channel, feature when it is one of several.",
	],
	codeExample: `package main

import (
	"encoding/json"
	"fmt"
)

type Tree struct {
	Val         int
	Left, Right *Tree
}

// A method on a nil pointer receiver is legal: it just never dereferences t
// until it has checked t for nil.
func (t *Tree) Sum() int {
	if t == nil {
		return 0
	}
	return t.Val + t.Left.Sum() + t.Right.Sum()
}

func main() {
	// 1. nil map: reads (and len, range) return the zero value; a write panics.
	var m map[string]int
	fmt.Println("read nil map:", m["missing"], "len:", len(m))
	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("write nil map panicked:", r)
			}
		}()
		m["k"] = 1 // panics: the hash table was never allocated
	}()

	// 2. nil slice: len/range are fine, and append allocates a backing array.
	var s []int
	fmt.Println("len nil slice:", len(s), "is nil:", s == nil)
	s = append(s, 42)
	fmt.Println("after append:", s)

	// 3. nil function value: calling it panics.
	var fn func()
	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("call nil func panicked:", r)
			}
		}()
		fn() // panics: nil pointer dereference on the code pointer
	}()

	// 4. method on a nil pointer receiver: safe because Sum checks first.
	var root *Tree
	fmt.Println("nil *Tree Sum():", root.Sum())

	// 5. nil channel in a select WITH default: never ready, so we take default
	// instead of blocking forever. (A bare <-ch on a nil channel deadlocks.)
	var ch chan int
	select {
	case <-ch:
		fmt.Println("received")
	default:
		fmt.Println("nil channel not ready, took default")
	}

	// 6. JSON: a nil slice encodes as null, an empty non-nil slice as [].
	var nilSlice []int
	emptySlice := []int{}
	a, _ := json.Marshal(nilSlice)
	b, _ := json.Marshal(emptySlice)
	fmt.Printf("nil slice JSON: %s, empty slice JSON: %s\\n", a, b)
}`,
	codeExplanation:
		"The program runs to completion and prints eight lines, and it finishes only because two <code>recover</code> calls catch the panics that would otherwise stop it. <code>read nil map: 0 len: 0</code>: reading a missing key from the nil map <code>m</code> returns the zero value and <code>len</code> is 0, both legal. <code>write nil map panicked: assignment to entry in nil map</code>: the very next statement, <code>m[\"k\"] = 1</code>, panics, because there is no hash table to store the entry in. <code>len nil slice: 0 is nil: true</code> then <code>after append: [42]</code>: the nil slice measures as empty and is genuinely <code>== nil</code>, yet <code>append</code> turns it into <code>[42]</code> by allocating a backing array, no initialization required. <code>call nil func panicked: runtime error: invalid memory address or nil pointer dereference</code>: a nil <code>func()</code> value has no code to run, so calling it is a nil pointer dereference. <code>nil *Tree Sum(): 0</code>: <code>Sum</code> is called on a nil <code>*Tree</code> and returns 0 without crashing, because its first act is <code>if t == nil</code>; the method is in the type's method set whether or not the receiver is nil, and nothing forces a dereference. <code>nil channel not ready, took default</code>: the receive on the nil channel <code>ch</code> is never ready, so the <code>select</code> falls to its <code>default</code> instead of blocking, which is the only reason this line prints rather than deadlocking. And <code>nil slice JSON: null, empty slice JSON: []</code> confirms the distinction that trips up API authors: <code>encoding/json</code> marshals a nil slice as <code>null</code> and an empty but non-nil <code>[]int{}</code> as <code>[]</code>. Same length, same behavior under <code>range</code> and <code>append</code>, different bytes on the wire.",
	designRationale:
		"Every type in Go has a zero value, and for pointers, slices, maps, channels, functions, and interfaces that zero is spelled <code>nil</code>. The decision that makes <code>nil</code> feel inconsistent is actually one consistent choice applied to six different data structures: the zero value should be immediately useful wherever it safely can be, and should fail loudly rather than silently do something surprising where it cannot. A slice header of all zeros is a valid empty slice, so ranging and appending just work. A nil map pointer can answer reads from nothing, so reads work; but a write would have to conjure a hash table, and auto-allocating one would make the map's identity depend on the order of writes, so the runtime refuses and panics instead. A nil channel blocking forever is not a bug the designers tolerated, it is a property they used: it is what lets <code>select</code> switch a case off by nilling its channel. A nil function has nowhere to jump, so calling it can only fault. The one case that is genuinely a trap rather than a feature is an interface holding a nil pointer, and that falls out of interfaces needing to carry their dynamic type for method dispatch and type assertions to work at all; it has its own page, <code>typed-nil</code>, because the fix there is a discipline about return types, not a nil check. Taken together, <code>nil</code> is not one feature behaving inconsistently, it is the zero-value rule meeting six data structures that can and cannot answer different questions from empty.",
	commonMistakes: [
		{
			title: "Treating a nil map as ready because reads work",
			body: "<code>var m map[string]int</code> is nil, and <code>m[k]</code>, <code>len(m)</code>, and <code>range m</code> all work, which makes the map feel initialized. The first <code>m[k] = v</code> panics with <code>assignment to entry in nil map</code>. The usual source is a map-typed struct field that no constructor set, written on a code path that runs before any initialization. Create it with <code>make</code> or a literal before the first write; the harmless reads are precisely what hide the missing initialization.",
		},
		{
			title: "Returning a nil slice where the caller expects an empty array",
			body: "A nil slice and an empty <code>[]int{}</code> behave identically under <code>len</code>, <code>range</code>, and <code>append</code>, so the difference is invisible until the value is serialized. <code>encoding/json</code> encodes a nil slice as <code>null</code> and an empty non-nil slice as <code>[]</code>, confirmed by running the example above. A JavaScript client that does <code>data.items.map(...)</code> throws on <code>null</code> and is happy with <code>[]</code>. If your API contract promises an array, return <code>[]T{}</code>, not a nil slice.",
		},
		{
			title: "Expecting a nil channel to panic or error, when it deadlocks",
			body: "An uninitialized channel, <code>var ch chan int</code>, is nil, and unlike a nil map or nil func it does not panic: a send or receive on it blocks forever. If it is the goroutine's only way forward you get <code>fatal error: all goroutines are asleep - deadlock!</code>; if other goroutines keep running, you get a silent goroutine leak instead, which is worse because nothing crashes. The tell is a channel you declared but a constructor never <code>make</code>d. It is the one nil that fails by hanging, not by faulting.",
		},
		{
			title: "Dereferencing a nil pointer, or assuming a method never can",
			body: "The plain case is <code>var p *T; _ = p.Field</code>, which faults with <code>runtime error: invalid memory address or nil pointer dereference</code>. The subtle case is methods: a method on a nil pointer receiver is legal and even useful when it checks the receiver first (a nil <code>*Tree</code> can return <code>Sum() == 0</code>), but a method that touches a field before checking panics the same way. Whether <code>p.M()</code> is safe depends entirely on what <code>M</code> does before its first dereference, not on <code>p</code> being nil.",
		},
		{
			title: "Treating nil as one thing with one rule",
			body: "Because the same keyword covers pointers, slices, maps, channels, functions, and interfaces, it is tempting to reason about <code>nil</code> uniformly, and that is exactly where the bugs are: a nil slice is safe to append, a nil map is not safe to write, a nil channel hangs, a nil func faults, and a nil pointer inside an interface is not even <code>== nil</code>. Before you write <code>if x != nil</code>, know which of the six x is, because the guarantee you are leaning on is different for each. The typed-nil interface case in particular defeats the check entirely; that is <code>typed-nil</code>.",
		},
	],
	relatedSlugs: ["typed-nil", "maps", "slices", "channels"],
}
