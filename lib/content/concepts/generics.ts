import { Concept } from "../../content"

export const generics: Concept = {
	slug: "generics",
	name: "Generics",
	tagline:
		"What type parameters buy is the allocation an interface{} costs and the panic it ships. Speed is not on the list.",
	summary:
		"A type parameter is a hole the compiler fills at the call site. <code>any</code> is a hole the runtime fills at every use, and it charges you for it twice: once in allocations, because an interface value holds a <em>pointer</em> to your value and that pointer needs something on the heap to point at, and once in safety, because the type assertion that gets the value back out is a runtime check that can fail at 3am instead of at compile time. Generics delete both costs for containers. What they do not reliably do is make code faster: Go implements them with GC shape stenciling, so a generic function over pointer types shares one body with every other pointer type and reaches its type information through a dictionary, which is an indirection the concrete function you replaced did not pay.",
	mentalModel:
		"Ask where the type information lives. With <code>any</code> it lives in the value, at runtime, one word of it per box, and every use has to consult it: that is what a type assertion is. With a type parameter it lives in the program, at compile time, and by the time the code runs there is nothing left to consult, because the compiler already generated a version of the function that knows the answer. That single difference is where the allocation goes and where the type error moves from a panic to a build failure. It also tells you when generics are the wrong tool: if you want <em>any thing that reads</em>, the type genuinely is not known until runtime and an interface is the honest answer. An interface says what a value can do. A type parameter says what a value is.",
	retrievalPrompts: [
		"You swap a []interface{} container for a generic one and benchmark both with payloads 0 to 127. Both report 0 allocs/op, so you conclude the type parameters bought nothing. What did you actually measure? || The runtime's small-integer cache, not your container. The runtime keeps a static [256]uint64 array, and converting an int below 256 to an interface points the value word at an entry in that array instead of allocating, so the box already exists and always did. Your payloads never left the cache. Submit values above 255 and the boxed container reports 1 allocs/op while the generic one stays at 0. A micro-benchmark measures the inputs you gave it and will confidently report whatever those inputs happen to make true.",
		"Your function is func Index[T comparable](xs []T, want T) int and the body does x == want. It compiles. In production it panics with \"comparing uncomparable type []int\". How, when T is constrained to comparable? || Because since Go 1.20 comparable is <em>satisfied</em> by ordinary interface types even though they do not <em>implement</em> it. So Index[any] is a legal instantiation, and then == on two interface values is a runtime operation that panics when the dynamic types are uncomparable, which []int is. comparable means \"== is spelled legally here\", not \"== cannot panic\". If you need the stronger promise, do not instantiate at an interface type, because the compiler stopped checking that for you in 1.20.",
		"You rewrite func(*User) *User as func[T any](T) T expecting monomorphisation and peak speed. You build with -gcflags=-m to admire the specialised code. What do you find? || One instantiation named go.shape.*uint8, shared with every other pointer type in the program, taking a hidden dictionary argument: First[go.shape.*uint8](&.dict.First[*main.A], ...). Go stencils per GC shape, not per type, so all pointers collapse into one body and reach their type information through the dictionary. That indirection is a cost the concrete function did not pay, which is why generic code over pointer types can be slower than what you replaced. Value shapes like int and float64 do get their own bodies, and that is where the boxing goes away.",
	],
	codeExample: `package main

import (
	"cmp"
	"fmt"
	"testing"
)

// cmp.Ordered (Go 1.21+, standard library) is a union of approximation
// elements: ~int | ~int8 | ... | ~string. The ~ is load-bearing: it reads
// "any type whose UNDERLYING type is this", so Celsius fits with no conversion.
func Max[T cmp.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}

type Celsius float64

// One generic container. Below, the ONLY thing that varies is the type
// argument, so the only thing the numbers can be measuring is the boxing.
type Slot[T any] struct{ v T }

var boxed = new(Slot[any]) // .v is two words: a type pointer and a POINTER to the value
var typed = new(Slot[int]) // .v is an int, stored inline

func main() {
	// Inference: T comes from the arguments, so no explicit [int].
	fmt.Println(Max(3, 5), Max("go", "rust"), Max(Celsius(21.5), Celsius(19)))

	// Counters start at 1000 on purpose. See the explanation.
	i := 1000
	fmt.Printf("Slot[any].v = i      %.0f allocs/op\\n", testing.AllocsPerRun(1000, func() {
		i++
		boxed.v = i
	}))
	j := 1000
	fmt.Printf("Slot[any].v = j%%128  %.0f allocs/op\\n", testing.AllocsPerRun(1000, func() {
		j++
		boxed.v = j % 128
	}))
	k := 1000
	fmt.Printf("Slot[int].v = k      %.0f allocs/op\\n", testing.AllocsPerRun(1000, func() {
		k++
		typed.v = k
	}))
}`,
	codeExplanation:
		"This prints <code>5 rust 21.5</code>, then <code>Slot[any].v = i      1 allocs/op</code>, <code>Slot[any].v = j%128  0 allocs/op</code>, and <code>Slot[int].v = k      0 allocs/op</code>. Three numbers, and the middle one is a trap. <code>Slot[any]</code> and <code>Slot[int]</code> are the same seven characters of source instantiated at two type arguments, so the difference between 1 and 0 is the boxing and nothing else. It costs an allocation because an interface value is two words, a type pointer and a pointer to the value, and that second word has to point <em>at</em> something: an <code>int</code> living in a register cannot be pointed at, so it is copied to the heap first. <code>Slot[int]</code> has no such indirection, because the compiler generated a version of the struct whose <code>v</code> field is an <code>int</code>, eight bytes stored inline, and nothing needs a pointer to point at. The middle line is the same boxed container reporting zero, because the runtime keeps a static <code>[256]uint64</code> array and converting a small int to an interface points at an entry in it rather than allocating. Payloads of 0 to 127 never leave that cache, so the measurement inverts on a one-character change. The counters start at 1000 for a related reason worth knowing before you trust any number from this harness: <code>testing.AllocsPerRun</code> divides <em>as integers</em>, so a counter starting at 0 would spend its first 255 iterations in the cache, average 0.746, and report <code>0</code>. The same code, an honest harness, and a false result. <code>Max</code> is the other half of the page: <code>cmp.Ordered</code> supersedes <code>golang.org/x/exp/constraints.Ordered</code>, which is where everyone learned this and which is no longer the answer, and <code>Max(Celsius(21.5), Celsius(19))</code> compiles only because those union terms carry <code>~</code>.",
	designRationale:
		"Go shipped without generics in 2009 and added them in Go 1.18 in March 2022, and the delay was never about whether people wanted them. It was about the fact that all three known implementations cost something Go had already decided it cared about. C++ style monomorphisation emits a full copy of the code per type argument, which gives the fastest possible result and multiplies compile time and binary size, and fast compiles are close to the top of Go's list of reasons to exist. Java style erasure emits one copy and boxes everything, which keeps the code small and reintroduces exactly the allocation you reached for generics to delete. Go 1.18 shipped a third thing: GC shape stenciling with dictionaries. The compiler emits one instantiation per <em>GC shape</em>, meaning types that look identical to the garbage collector share one body, and passes a hidden dictionary argument carrying the parts that differ. This is visible rather than theoretical. Build the example above with <code>-gcflags=-m</code> and the compiler names its instantiations out loud: <code>Max[go.shape.int]</code>, <code>Max[go.shape.string]</code>, <code>Max[go.shape.float64]</code>. <code>Max[main.Celsius]</code> gets no body of its own; it is a wrapper that calls <code>Max[go.shape.float64]</code>, because <code>Celsius</code> and <code>float64</code> are the same shape. Do the same over pointers and both <code>*A</code> and <code>*B</code> compile to one shared <code>First[go.shape.*uint8]</code>, distinguished only by the dictionary handed to them: <code>&.dict.First[*main.A]</code> against <code>&.dict.First[*main.B]</code>. That is the whole trade in one line of compiler output. Every pointer-shaped type in your program collapses into a single instantiation and pays an indirection to find out what it is, which is why generic code over pointers is not automatically faster than the concrete function you deleted and is sometimes slower. Value shapes get real layout, which is where the boxing genuinely disappears, and that is a property of the code rather than the machine: the same source allocates the same number of times on a Raspberry Pi and a 64-core server. So the honest reason to reach for a type parameter is a container that holds a caller's type and hands it back untouched, or a compile error you would rather have than a panic. It is not a performance tactic, and the compiler will tell you so if you ask it.",
	commonMistakes: [
		{
			title: "Benchmarking the small-integer cache and drawing a conclusion",
			body: "A payload of <code>i % 128</code> makes a boxed container report <code>0 allocs/op</code>, identical to the generic one, because the runtime's static 256-entry integer array means the box already exists. Change one character to <code>i</code> and the boxed version reports 1 while the generic version stays at 0. Anything below 256 measures the cache. This is not a generics fact, it is a benchmarking fact, and it is the reason to be suspicious of any micro-benchmark whose inputs you chose for convenience.",
		},
		{
			title: "Reading `comparable` as a promise that `==` will not panic",
			body: "Since Go 1.20, ordinary interface types <em>satisfy</em> <code>comparable</code> without <em>implementing</em> it, so <code>Index[any]</code> is a legal instantiation of <code>Index[T comparable]</code>. Put a <code>[]int</code> in it and <code>x == want</code> panics with <code>comparing uncomparable type []int</code>. The constraint got you the compile-time right to write <code>==</code>, not the runtime guarantee that it works. Before 1.20 the compiler rejected the instantiation and this bug could not exist.",
		},
		{
			title: "Trying to give a method its own type parameters",
			body: "<code>func (s *Set[T]) Map[R any](f func(T) R) []R</code> does not compile: <code>syntax error: method must have no type parameters</code>. Methods may use the receiver's type parameters and may not introduce their own, because a method set has to be finite for interface satisfaction to be decidable. The fix is a package-level function, <code>func Map[T, R any](s *Set[T], f func(T) R) []R</code>, which is why the standard library's generic helpers are functions rather than methods. This one reliably forces an API redesign after you have already written the type.",
		},
		{
			title: "Omitting `~` and rejecting every named type",
			body: "<code>type StrictInt interface{ int }</code> matches the type <code>int</code> exactly and nothing else, so <code>type ID int</code> fails with <code>ID does not satisfy StrictInt (possibly missing ~ for int in StrictInt)</code>. Since real codebases are full of named types over builtins, a constraint without <code>~</code> is almost always a typo. The compiler's error text names the fix, which is worth reading rather than skipping.",
		},
		{
			title: "Generic because you might need it later",
			body: "The new version of abstract-because-I-might-need-it, and it fails the same way: a type parameter used at exactly one type costs a denser signature, worse error messages when a constraint does not match, and a reader who now has to carry a type variable in their head, in exchange for nothing. The tell is a function generic over <code>T any</code> whose body only calls methods, because that was an interface all along. Reach for a type parameter when you have a container, or a second real instantiation, and write the concrete function until then.",
		},
	],
	relatedSlugs: ["interfaces", "escape-analysis", "benchmarks", "typed-nil", "structs"],
}
