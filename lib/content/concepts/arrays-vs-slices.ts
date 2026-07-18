import { Concept } from "../../content"

export const arraysVsSlices: Concept = {
	slug: "arrays-vs-slices",
	name: "Arrays vs slices",
	tagline:
		"An array is a value with its length welded into the type. That is why you never use one, until suddenly you must.",
	summary:
		"<code>[4]byte</code> is an array: a value, four bytes wide, whose length is part of its type. <code>[]byte</code> is a slice: a three-word header pointing at somebody else's array. The consequences run in opposite directions. Arrays copy on assignment and on every function call, so a function that mutates its array parameter mutates nothing and the compiler says not one word about it. In exchange arrays are comparable with <code>==</code> and usable as map keys, which slices are not, at all, ever. <code>[3]int</code> and <code>[4]int</code> are unrelated types.",
	mentalModel:
		"An array is a value in exactly the way an int is a value: assigning it copies it, passing it copies it, and two of them are equal when their contents are equal. A slice is a reference dressed up as a value. The length being part of the array's type is not a quirk, it is the enabling condition for all of the above: the compiler knows the exact width, so it can put the thing on the stack, sit it inline in a struct, compare it field by field, and hash it. The price is that a three-element array and a four-element array have as much in common as an int and a string, which is why nearly every API you will ever write takes a slice instead.",
	retrievalPrompts: [
		"func clear(buf [32]byte) zeroes every element and your buffer is untouched afterwards. The same function taking []byte works. No compiler warning either way. Why? || An array is a value, so the call copied all 32 bytes and the function zeroed the copy. A slice is a three-word header, so the call copied the header and the function wrote through the shared pointer into your array. Both are consistent with Go's one rule, that every argument is passed by value: what differs is what the value is. Take *[32]byte or []byte if you want the writes to land.",
		"You need to count how many times each 16-byte checksum appears. Why does map[[16]byte]int compile and map[[]byte]int not? || Map keys must be comparable, and arrays are: the length is in the type, so == is a fixed-width, element-by-element comparison the runtime can also hash. Slices are not comparable, so map[[]byte]int is a compile error, invalid map key type []byte. This is the one situation where the fixed-size array is not a nuisance but the only thing that works. Convert with [16]byte(sum) or use a string key.",
		"s1 := []int{1,2} and s2 := []int{1,2}. What does s1 == s2 give you, and what is the fix? || A compile error: invalid operation: s1 == s2 (slice can only be compared to nil). Comparing to nil is the only legal use of == on a slice. The fix is slices.Equal(s1, s2), or bytes.Equal for []byte. Go refuses to guess whether you meant identity (same backing array) or element-wise equality, because one is useless and the other is O(n) hiding behind an operator everyone reads as cheap.",
	],
	codeExample: `package main

import "fmt"

// These two look identical. One of them does nothing.
func zeroArray(buf [4]byte) {
	for i := range buf {
		buf[i] = 0
	}
}

func zeroSlice(buf []byte) {
	for i := range buf {
		buf[i] = 0
	}
}

func main() {
	arr := [4]byte{1, 2, 3, 4}
	sl := []byte{1, 2, 3, 4}

	zeroArray(arr) // passes a COPY of all 4 bytes
	zeroSlice(sl)  // passes a copy of the header, which points at the data

	fmt.Println("array after zeroArray:", arr) // untouched
	fmt.Println("slice after zeroSlice:", sl)  // zeroed

	// Assignment copies the whole array too. No aliasing, ever.
	b := arr
	b[0] = 99
	fmt.Println("arr[0]:", arr[0], "b[0]:", b[0])

	// The payoff for all that copying: arrays are values, so == is real
	// equality and they work as map keys. Slices can do neither.
	fmt.Println("arr == b?", arr == b)
	fmt.Println("arr == [4]byte{1,2,3,4}?", arr == [4]byte{1, 2, 3, 4})

	seen := map[[4]byte]int{}
	seen[arr]++
	seen[[4]byte{1, 2, 3, 4}]++
	fmt.Println("distinct keys:", len(seen), "count for arr:", seen[arr])

	// The length is part of the type: [4]byte and [5]byte are unrelated.
	fmt.Printf("%T vs %T\\n", arr, [5]byte{})
}`,
	codeExplanation:
		"This prints:<br><br><code>array after zeroArray: [1 2 3 4]</code><br><code>slice after zeroSlice: [0 0 0 0]</code><br><code>arr[0]: 1 b[0]: 99</code><br><code>arr == b? false</code><br><code>arr == [4]byte{1,2,3,4}? true</code><br><code>distinct keys: 1 count for arr: 2</code><br><code>[4]uint8 vs [5]uint8</code><br><br>The first two lines are the failure worth remembering: two functions with the same body, the same loop, the same assignment, and <code>zeroArray</code> accomplished nothing. It compiles, <code>go vet</code> is silent, and a unit test that only checks the slice path passes forever. Nothing marks the call site. Then the payoff: <code>arr == b</code> is <code>false</code> because <code>b[0]</code> really is 99 and the comparison really is element-wise, and <code>arr</code> equals a fresh literal with the same contents because equality is about the value, not the address. The map lines are the reason arrays exist in your codebase at all: two separately-constructed <code>[4]byte</code> values land on the same key, giving one distinct key and a count of 2. Try that with <code>map[[]byte]int</code> and the compiler rejects it outright with <code>invalid map key type []byte</code>. The last line is <code>%T</code> reporting <code>[4]uint8 vs [5]uint8</code>: different types, no conversion between them, and also a reminder that <code>byte</code> is an alias for <code>uint8</code> rather than a distinct type.",
	designRationale:
		"Go took arrays from the Pascal and Algol lineage rather than the C one, and the difference is the whole page. In C an array decays to a pointer at the first opportunity, <code>==</code> on two arrays compares addresses, and the length is a fact you carry around separately and get wrong. In Go an array is a value like a struct is a value: it copies, it compares element-wise, and its size is in its type. That last part is what buys everything else. A type of known width can live on the stack, sit inline in a struct with no indirection and no second allocation, be compared without a loop written by you, and be hashed, which is precisely the list of requirements for a map key. Comparability is not a bonus feature bolted on, it is what falls out of being a fixed-width value. Slices then exist because that same fixed width is intolerable for an API: a function that takes <code>[4]byte</code> cannot accept <code>[5]byte</code>, and before generics there was no way to write it once. So Go's real design is a layered one. The array is the memory, and it is almost always unnamed, allocated implicitly by <code>make</code> and never referred to again. The slice is the view, and it is what every signature takes. You reach past the slice to the array exactly when you need the properties that only a value has: a key, a fixed-size buffer with the size checked at compile time, a comparison. Slices are excluded from <code>==</code> for a reason worth internalising: the operator would have to mean either identity (same backing array), which is nearly useless, or deep equality, which is O(n) wearing the costume of an O(1) operator. Go declined to pick, made it a compile error, and put the honest version in the standard library as <code>slices.Equal</code> (Go 1.21) and <code>bytes.Equal</code>, where the cost is visible in the call.",
	commonMistakes: [
		{
			title: "Mutating an array parameter and wondering why nothing happened",
			body: "<code>func fill(buf [256]byte)</code> receives a copy of all 256 bytes and every write lands in it. The caller sees nothing, the compiler warns about nothing, and <code>go vet</code> says nothing. Switch the parameter to <code>[]byte</code> or <code>*[256]byte</code>. If a function takes an array by value and mutates it, that is nearly always the bug.",
		},
		{
			title: "Writing [...]T{...} when you meant []T{...}",
			body: "<code>x := [...]int{1, 2, 3}</code> is an array of type <code>[3]int</code>; <code>x := []int{1, 2, 3}</code> is a slice. Three characters apart, and every downstream assignment and call switches between copying the data and sharing it. If you did not deliberately want a value, you wanted the slice.",
		},
		{
			title: "Comparing slices with ==",
			body: "<code>s1 == s2</code> does not compile: <code>invalid operation: s1 == s2 (slice can only be compared to nil)</code>. It is a compile error rather than a surprise at runtime, which is the good outcome, but reaching for it means you wanted <code>slices.Equal</code> or <code>bytes.Equal</code>. The only legal <code>==</code> on a slice is against <code>nil</code>.",
		},
		{
			title: "Putting a big array in a struct that gets passed around",
			body: "<code>type Buf struct { data [4096]byte }</code> makes <code>unsafe.Sizeof(Buf{})</code> exactly 4096, and every assignment, every call, every channel send copies all of it. The <code>[]byte</code> version is 24 bytes, three words, regardless of how much data it points at. Inline arrays in a struct are a deliberate choice for locality, not a default.",
		},
		{
			title: "Assuming a fixed-size function signature will generalise",
			body: "Write <code>func hash(b [16]byte)</code> and the day a 32-byte digest arrives you cannot call it: <code>cannot use x (variable of type [32]byte) as [16]byte value in argument to hash</code>. The length is in the type, so there is no widening, no implicit conversion, and no subtyping. Take <code>[]byte</code> at the boundary and convert inward when you need the array's properties.",
		},
	],
	relatedSlugs: ["slice-internals", "slices", "maps", "structs", "generics"],
}
