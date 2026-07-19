import { Concept } from "../../content"

export const valueSemantics: Concept = {
	slug: "value-semantics",
	name: "Value semantics and copies",
	tagline:
		"Assignment, function calls, and range all copy the value. Every \"my change didn't stick\" bug lives in that one sentence.",
	summary:
		"Go's default is copy. <code>b = a</code> copies the value, passing an argument copies it, and <code>for _, v := range xs</code> copies each element into <code>v</code>. This is a machine fact about what the compiler emits, and it is the root of a whole class of writes that silently go nowhere. The exceptions that make it subtle are <code>slice</code>, <code>map</code>, and <code>channel</code>: their value is a small header holding a pointer, so copying the header still shares the backing store. The rule never bends, everything copies its value; what changes is whether that value is the data or a reference to it.",
	mentalModel:
		"Every <code>=</code>, every argument, every <code>for _, v := range</code> makes a bitwise copy of a value's representation. For an <code>int</code>, a <code>struct</code>, or an array, the representation <em>is</em> the data, so the copy is independent storage and a write to it never reaches the original. For a slice, map, or channel, the representation is a small fixed-size header around a pointer, so the copy duplicates the header and shares the data it points at. A mutation \"sticks\" only when you write through a pointer: an explicit <code>*T</code>, or the shared pointer hiding inside a slice or map header. The compiler's word for \"I can take the address of this\" is <em>addressable</em>: a slice element <code>xs[i]</code> is addressable and a map value <code>m[k]</code> is not, which is exactly why <code>xs[i].F = x</code> compiles and <code>m[k].F = x</code> does not.",
	retrievalPrompts: [
		"for _, v := range users { v.Active = true } runs clean, and afterwards every user's Active is still false. Where did the writes go, and what are the two fixes? || Into v, which is a fresh copy of each element. range assigns users[i] into the loop variable by value, so v holds a bitwise copy of the struct; setting v.Active writes the copy, and the next iteration overwrites v with the next element, discarding it. The slice's own memory was never touched. Fix one: index the real element, for i := range users { users[i].Active = true }, because users[i] is addressable and names the actual storage. Fix two: make the elements pointers, []*User, so the copied value is an address and the write goes through it. Go 1.22 making the loop variable per-iteration does not change this: that fixed closure capture, it did not make v alias the slice.",
		"b := a then b[0] = 99. If a is [3]int the original is untouched; if a is []int the original changes too. Same syntax, opposite result. Why? || Because assignment copies the value, and the two types have different values. An array's value is its elements laid out inline, so copying [3]int copies all three ints and b is independent storage. A slice's value is a three-word header (pointer, len, cap); copying it duplicates the header but not the backing array, so b's pointer still aims at a's data and b[0] = 99 writes through it. Nothing about b := a tells you which you got; the type does. This is the whole reason slices, maps, and channels feel like references: their value is a small header around a pointer, so copying the value shares the store.",
		"m[k].X = 5 where m is map[string]Point does not compile: cannot assign to struct field m[\"a\"].X in map. Indexing a slice the same way is fine. What is different about a map value? || A map value is not addressable, so you cannot take &m[k] and therefore cannot assign to a field of it. The reason is that a map grows and rehashes as you insert, relocating its entries in memory, so any address it handed out could dangle after the next insert. A slice's backing array does not move under you, so &s[i] is stable and s[i].X = 5 is legal. The map fix is read-modify-write the whole value: p := m[k]; p.X = 5; m[k] = p, or store *Point so the addressable thing lives outside the map and the map holds only the pointer.",
	],
	codeExample: `package main

import "fmt"

type Point struct {
	X, Y int
}

// Value receiver: the method operates on a COPY of the receiver, so a caller's
// Point is never changed by it.
func (p Point) MoveBy(dx int) { p.X += dx }

func main() {
	// 1. range copies each element into v. Mutating v mutates the copy, which
	//    is discarded at the end of every iteration.
	pts := []Point{{1, 1}, {2, 2}}
	for _, v := range pts {
		v.X = 99 // writes to the loop's private copy
	}
	fmt.Println("after range-by-value:", pts)

	// The fix is to index the real element. pts[i] is addressable.
	for i := range pts {
		pts[i].X = 99
	}
	fmt.Println("after index write   :", pts)

	// 2. A value-receiver method mutates its own copy of the receiver.
	q := Point{X: 10}
	q.MoveBy(5)
	fmt.Println("after value receiver:", q)

	// 3. An array is a value: copying it copies every element, so the copy is
	//    independent. A slice is a header: copying it shares the backing array.
	arr := [3]int{1, 2, 3}
	arrCopy := arr
	arrCopy[0] = 99
	fmt.Println("array orig / copy   :", arr, arrCopy)

	sl := []int{1, 2, 3}
	slCopy := sl
	slCopy[0] = 99
	fmt.Println("slice orig / copy   :", sl, slCopy)

	// 4. A map value is NOT addressable, so this line does not compile:
	//        m["a"].X = 5
	//    cannot assign to struct field m["a"].X in map
	//    You copy the value out, modify it, and put the whole value back.
	m := map[string]Point{"a": {1, 1}}
	p := m["a"] // copy OUT
	p.X = 5
	m["a"] = p // whole value back IN
	fmt.Println("map after put-back  :", m)
}`,
	codeExplanation:
		"On go1.22.1 this prints:<br><br><code>after range-by-value: [{1 1} {2 2}]</code><br><code>after index write   : [{99 1} {99 2}]</code><br><code>after value receiver: {10 0}</code><br><code>array orig / copy   : [1 2 3] [99 2 3]</code><br><code>slice orig / copy   : [99 2 3] [99 2 3]</code><br><code>map after put-back  : map[a:{5 1}]</code><br><br>Six lines, one rule. <strong>Line 1:</strong> the range loop set <code>v.X = 99</code> twice and the slice is still <code>{1 1} {2 2}</code>, because <code>v</code> was a copy of each element and each copy was discarded at the bottom of the loop. <strong>Line 2:</strong> the same write through <code>pts[i]</code> lands, because <code>pts[i]</code> names the actual element rather than a copy. <strong>Line 3:</strong> the value-receiver <code>MoveBy(5)</code> added 5 to its own copy of the receiver, so <code>q</code> is still <code>{10 0}</code>: a method receiver is passed by value exactly like an argument. <strong>Line 4:</strong> <code>arrCopy[0] = 99</code> changed only the copy, <code>arr</code> is <code>[1 2 3]</code>, because an array's value is its elements and <code>:=</code> copied all of them. <strong>Line 5:</strong> the identical operation on a slice changed <em>both</em>, <code>[99 2 3]</code> and <code>[99 2 3]</code>, because a slice's value is a header and the copy shares the backing array. <strong>Line 6</strong> is the map: <code>m[\"a\"].X = 5</code> would not compile at all (<code>cannot assign to struct field m[\"a\"].X in map</code>), so the working code copies the value out, edits it, and writes the whole value back, giving <code>map[a:{5 1}]</code>. Every line is the same sentence: <code>=</code>, a call, and range all copy the value, and whether that copy is independent depends on whether the value is the data or a header pointing at it.",
	designRationale:
		"Go's default is C's, not Java's: a variable holds the value, and <code>=</code> and function calls copy that value. Java handed you a reference to every object and made aliasing the silent default, where two names can point at one object and a change through one is visible through the other without anything at the call site saying so. Go inverted that so you can reason about a function locally: a callee cannot change your struct unless you passed a <code>*T</code>, and the <code>&amp;</code> is visible where you called it. The cost is real bytes moved on every copy, which is why the language also gives you pointers to opt out, and why passing a large struct by value in a hot loop shows up in a profile (this is where value semantics meets <a>pointers</a> and <a>escape-analysis</a>). The exceptions are pragmatic, not a second rule. Deep-copying a slice, a map, or a channel on every call would be absurd, a slice can front gigabytes, so their value is a small fixed-size header: three words for a slice, a single pointer for a map and a channel. Copying the header is cheap and shares the store it points at, which is why they read as references while still obeying the one rule that everything copies its value. Map values being non-addressable falls straight out of the implementation: a map rehashes and relocates its entries as it grows, so it cannot promise a stable <code>&amp;m[k]</code>, and the compiler forbids <code>m[k].field = x</code> rather than hand out an address the next insert could invalidate. A slice's backing array does not relocate under you, so <code>&amp;s[i]</code> is stable and <code>s[i].field = x</code> compiles. One modern footnote worth keeping straight: Go 1.22 made the range loop variable a fresh variable each iteration, which fixed the old closure-capture surprise where every captured <code>v</code> saw the last element. It did not touch value semantics: <code>v</code> is still a copy of the element, and writing to it still does not reach the slice.",
	commonMistakes: [
		{
			title: "Mutating the range variable and losing the write",
			body: "<code>for _, v := range xs { v.Field = ... }</code> writes to a copy. range assigns each <code>xs[i]</code> into <code>v</code> by value, so the field write hits the copy and the next iteration discards it; the slice is untouched and nothing warns you. Index the real element with <code>xs[i].Field = ...</code> (addressable), or hold pointers in a <code>[]*T</code>. Go 1.22's per-iteration loop variable does not change this, <code>v</code> is still a copy.",
		},
		{
			title: "Copying a big struct in a hot loop or an argument",
			body: "<code>for _, v := range bigStructs</code> copies the whole struct every iteration, and <code>func f(x BigStruct)</code> copies it on every call. The copy is a byte-for-byte move whose cost scales with <code>unsafe.Sizeof</code>, not with how much of the struct you read. Range with an index (<code>for i := range xs</code>) or take a <code>*BigStruct</code>. This is the point where value semantics turns into a real number in a profile, and where it ties to <a>escape-analysis</a>.",
		},
		{
			title: "Passing an array by value and expecting mutation",
			body: "<code>func zero(buf [1024]byte)</code> receives a copy of all 1024 bytes; every write lands in the copy and the caller sees nothing, with no compiler warning. An array's value is its elements laid out inline, so the call duplicated them. Take a <code>[]byte</code> or a <code>*[1024]byte</code>. Contrast a slice parameter, whose header copy still shares the data, which is the whole distinction on <a>arrays-vs-slices</a>.",
		},
		{
			title: "Assigning to a field of a map value",
			body: "<code>m[k].Field = x</code> does not compile: <code>cannot assign to struct field m[k].Field in map</code>. Map values are not addressable because the map may rehash and relocate them, so there is no stable address to write through. Read-modify-write the whole value (<code>p := m[k]; p.Field = x; m[k] = p</code>), or store a <code>*T</code> so the addressable value lives outside the map. This is a compile error rather than a silent bug, but people meet it as a surprise because the same syntax works on a slice.",
		},
		{
			title: "A value-receiver method that tries to mutate the receiver",
			body: "<code>func (c Counter) Inc() { c.n++ }</code> changes nothing: the receiver is passed by value like any argument, so <code>Inc</code> increments a copy that is thrown away at return. Use a pointer receiver, <code>func (c *Counter) Inc()</code>. And once one method needs a pointer receiver, give them all pointer receivers so the method set is consistent, which is where this meets interface satisfaction (see <a>pointers</a>).",
		},
	],
	relatedSlugs: ["pointers", "arrays-vs-slices", "slice-internals", "maps"],
}
