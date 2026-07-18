import { Concept } from "../../content"

export const sliceInternals: Concept = {
	slug: "slice-internals",
	name: "Slice internals",
	tagline:
		"Three words: pointer, length, capacity. The third one is the one that bites.",
	summary:
		"A slice value is exactly three machine words: a pointer to a backing array, a length, and a capacity. Passing a slice copies those three words and nothing else, which is why a callee's element writes reach you and its <code>append</code> does not. The sharp edge is <code>cap</code>: it measures the backing array from your slice's <em>start</em>, not from your slice's end, so <code>append</code> can find room in memory your view does not cover and quietly overwrite data another slice is still reading.",
	mentalModel:
		"A slice is a sticky note describing somebody else's array: where to start, how many elements you are claiming, and how many actually exist past that start. Copying the sticky note is free and copies nothing about the array, which is the whole point of the design. Append reads that third number to decide whether it can scribble on the existing array or has to buy a new one, and the decision is invisible at the call site: same syntax, same types, and the answer depends on a number you probably never looked at. Two sticky notes can describe overlapping regions of one array, and neither one mentions the other.",
	retrievalPrompts: [
		"A helper takes []byte, appends a footer, and returns nothing. Your data is unchanged. The same helper does b[0] = 0 and your data does change. Explain both halves. || The three-word header is copied; the array is not. append rebinds the callee's local header (new len, possibly a whole new array), and your three words never move, so the append is invisible. b[0] = 0 writes through the copied pointer into the array both headers share, so it is visible. Element writes cross the call boundary, length changes do not. That asymmetry is exactly why append's result has to be returned and assigned.",
		"b := a[:2], where a has len 3. You append one element to b. Is a[2] safe? What changes if b came from a[:2:2]? || Not safe: slicing inherits capacity to the end of the backing array, so b has cap 3 or more, append finds room, writes in place, and a[2] is now your new element. With the full slice expression a[:2:2] the cap is 2, append has no room, so it allocates a fresh array and copies, and a is untouched. The trap is that nothing at b's declaration mentions capacity: b := a[:2] looks like a read-only view and is not.",
		"You need a slice of exactly 1024 ints, so you append 513 elements to a nil slice and assume cap doubled its way to 1024. Name the two separate things wrong with that. || First, the runtime stops doubling above a threshold (256 elements) and switches to a gentler ramp. Second, whatever the formula returns is rounded up to an allocator size class, so it is not a power of two either. Measured on go1.22.1 the capacity after 512 is 848, and appending one element to a full cap=100 slice gives 224 rather than 200. If you need an exact capacity, ask for it: make([]int, 0, 1024). Never encode a growth number.",
	],
	codeExample: `package main

import "fmt"

// A slice value is three words: pointer, len, cap. Passing one copies the
// three words, never the elements. So this function's element write reaches
// the caller and its append does not.
func touch(entries []string) {
	entries[0] = "MUTATED"
	entries = append(entries, "unseen")
	_ = entries
}

func main() {
	a := make([]string, 3, 4)
	copy(a, []string{"boot", "listen", "serve"})

	touch(a)
	fmt.Println("after touch:", a, "len:", len(a))

	// b reads like a read-only view of the first two elements. It is not:
	// its cap runs to the end of a's array, and that is the whole bug.
	b := a[:2]
	fmt.Println("b len/cap:", len(b), cap(b))

	b = append(b, "CLOBBER") // cap has room, so append writes IN PLACE
	fmt.Println("a:", a, "<- a[2] is gone")

	// Full slice expression a[low:high:max]: cap stops at the view's end,
	// so append has no room and must allocate a fresh array first.
	c := a[:2:2]
	fmt.Println("c len/cap:", len(c), cap(c))
	c = append(c, "safe")
	fmt.Println("a:", a)
	fmt.Println("c:", c, "shares a's array?", &a[0] == &c[0])

	// Growth is not "doubles until 1024". Print it instead of trusting that.
	var g []int
	prev := -1
	for i := 0; i < 3000; i++ {
		g = append(g, i)
		if cap(g) != prev {
			fmt.Print(cap(g), " ")
			prev = cap(g)
		}
	}
	fmt.Println()
}`,
	codeExplanation:
		"On go1.22.1 this prints:<br><br><code>after touch: [MUTATED listen serve] len: 3</code><br><code>b len/cap: 2 4</code><br><code>a: [MUTATED listen CLOBBER] &lt;- a[2] is gone</code><br><code>c len/cap: 2 2</code><br><code>a: [MUTATED listen CLOBBER]</code><br><code>c: [MUTATED listen safe] shares a's array? false</code><br><code>1 2 4 8 16 32 64 128 256 512 848 1280 1792 2560 3408</code><br><br>Read it in three beats. <strong>One:</strong> <code>touch</code> proves the header is a copy and the array is not. <code>MUTATED</code> survived the return; the appended <code>\"unseen\"</code> did not, and <code>len</code> is still 3. <strong>Two:</strong> <code>b := a[:2]</code> reports <code>cap 4</code>, not 2. That single number is the bug: <code>append</code> asks \"is there room\" and gets \"yes\", so it writes into <code>a[2]</code> instead of allocating, and <code>\"serve\"</code> is destroyed by a line that never mentions <code>a</code>. Changing one character to <code>a[:2:2]</code> caps the view at its own end, <code>append</code> is forced to allocate, and <code>&a[0] == &c[0]</code> is <code>false</code>: different arrays, no aliasing possible. <strong>Three:</strong> the growth line. Folklore says capacity doubles until 1024, which predicts <code>512 1024 2048</code>. What actually happens is <code>512 848 1280</code>. Nothing here is a rounding error in the printout, and none of it is guessable: that is the point of printing it.",
	designRationale:
		"C decays an array to a bare pointer and throws the length away, which is why every C API that takes a buffer also takes a separate count, and why getting that count wrong is the most productive bug class in the history of the language. Go's answer is to keep the length inside the value. Three words is small enough to pass by value everywhere (no allocation, no ownership question) and complete enough that the runtime can bounds-check every index, because it has something to check against. The third word, <code>cap</code>, exists so <code>append</code> can answer \"can I grow in place\" without touching the allocator, which is what makes appending amortised O(1) rather than a copy per element. Every sharp edge on this page is the bill for that third word: capacity is a fact about the <em>array</em>, measured from your start, so it can describe memory that you have no other reference to and that somebody else is still using. The designers understood the cost and shipped the fix early: full slice expressions (<code>a[low:high:max]</code>) were added in Go 1.2 precisely so a package could hand out a sub-slice that is incapable of growing into the parent's data. Before 1.2 the only safe answer was to copy. The growth numbers, by contrast, were deliberately never specified: the spec promises that <code>append</code> works, not what <code>cap</code> becomes. That freedom has already been spent once (the doubling threshold moved from 1024 to 256 elements in Go 1.18, to stop large slices from doubling their memory footprint in one step), and it is spent again on every allocation, because the runtime rounds the formula's answer up to an allocator size class. Both mechanisms are visible in the output above: <code>512 -> 848</code> is the ramp, and appending one element to a full <code>cap=100</code> slice returning 224 rather than 200 is the size-class rounding. Code that depends on a specific capacity is depending on an implementation detail that has changed before and is free to change again.",
	commonMistakes: [
		{
			title: "Handing out a sub-slice without capping it",
			body: "<code>func (b *Buf) Head() []byte { return b.data[:2] }</code> hands the caller a slice whose capacity runs to the end of your buffer. One <code>append</code> on their side silently rewrites your data, and the stack trace points at their code. Any slice that leaves your package should be <code>b.data[:2:2]</code> or a <code>copy</code>. This is the bug full slice expressions were added to fix.",
		},
		{
			title: "copy(dst, src) where dst has capacity but no length",
			body: "<code>c := make([]int, 0, len(s)); copy(c, s)</code> copies nothing and returns 0, because <code>copy</code> is bounded by <code>min(len(dst), len(src))</code> and <code>len(c)</code> is zero. It fails silently: you get an empty slice, not an error. Either <code>make([]int, len(s))</code> and copy, or <code>append([]int(nil), s...)</code>.",
		},
		{
			title: "Assuming append's result is visible to the caller",
			body: "Pass a slice to a function that appends, and the caller sees nothing, because the callee grew its own copy of the header. Element writes do cross the boundary, which makes this worse: the function looks like it works right up until it needs to grow. Return the slice (<code>s = grow(s)</code>) or take a <code>*[]T</code>.",
		},
		{
			title: "Hardcoding a growth number",
			body: "\"Capacity doubles\" is wrong twice over: the runtime abandons doubling above 256 elements, and rounds every result up to an allocator size class. Measured on go1.22.1, cap goes <code>512 -> 848</code>, and a full <code>cap=100</code> slice grows to 224, not 200. If a size matters, state it with <code>make([]T, 0, n)</code>.",
		},
		{
			title: "Keeping a small slice of a huge array alive",
			body: "Read 1 MiB, keep <code>data[:10]</code>, and you have kept all 1 MiB: the header's pointer pins the entire backing array, and <code>cap</code> reports <code>1048576</code> to prove it. The garbage collector frees arrays, not slice views. Copy the part you want out: <code>append([]byte(nil), data[:10]...)</code>, whose cap comes back as 16.",
		},
	],
	relatedSlugs: [
		"slices",
		"arrays-vs-slices",
		"strings-bytes-runes",
		"escape-analysis",
		"pointers",
	],
}
