import { Concept } from "../../content"

export const stringsBytesRunes: Concept = {
	slug: "strings-bytes-runes",
	name: "Strings, bytes, and runes",
	tagline:
		"A string is an immutable byte header. Indexing gives you a byte, and len counts bytes, and both are correct.",
	summary:
		"A string is two words: a pointer to bytes and a length. No capacity, and no writing: the bytes are immutable, which is what lets strings be shared, used as map keys, and sliced without copying. Those bytes are UTF-8, so <code>len(s)</code> is a byte count, <code>s[i]</code> is a <code>byte</code> (a number), and <code>for i, r := range s</code> decodes runes while reporting <em>byte</em> offsets, which means the index skips. Every string bug in Go is one of those three sentences arriving at a bad moment.",
	mentalModel:
		"A string is what came off the socket, kept exactly as it arrived. Go does not decode text on the way in and re-encode it on the way out; the wire format is the memory format, and a string is a read-only window onto those bytes. So there are two honest answers to \"how long is this\" and Go makes you say which one you mean: len answers the storage question, because that is the number I/O needs, and range answers the character question, because that is the number humans need. A byte is a uint8 and a rune is an int32, and neither one is a character in the sense you actually care about, because the thing a reader calls a single character can be several runes.",
	retrievalPrompts: [
		"You reverse a string by swapping bytes. Every test passes. A French user reports garbage. You switch to []rune and ship. Which bug did you fix and which one is still there? || You fixed multi-byte code points: swapping bytes splits a two-byte é into two invalid bytes, and the result is not even valid UTF-8. You did not fix combining sequences. \"e\" followed by U+0301 renders as one character but is two runes, so a rune-wise reverse detaches the accent and drops it on a different letter. []rune is correct about code points and code points are not characters. Correct reversal needs grapheme clusters, which the standard library does not do.",
		"n := 65; fmt.Println(string(n)) prints A, not 65. What is the conversion actually doing, and what catches it? || string(n) on an integer means \"encode this Unicode code point as UTF-8\", and code point 65 is A. It is not a stringify. go vet catches it: conversion from int to string yields a string of one rune, not a string of digits (did you mean fmt.Sprint(x)?). If you wanted the digits, that is strconv.Itoa(n) or fmt.Sprint(n). If you wanted the character, say so: string(rune(n)).",
		"for i, r := range \"naïve\" prints i as 0, 1, 2, 4, 5. Where did 3 go, and what would s[3] give you? || i is the byte offset of each rune, not a counter. ï starts at offset 2 and occupies two bytes, so the next rune starts at 4 and offset 3 never appears as a starting position. s[3] is legal and returns 175, the second byte of ï's encoding: a number, not a character, and meaningless on its own. Indexing a string is byte access; range is the only built-in thing that decodes.",
	],
	codeExample: `package main

import "fmt"

// The bug: reverse the bytes. Passes every ASCII test you will ever write.
func reverseBytes(s string) string {
	b := []byte(s)
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return string(b)
}

// The fix, for most text: reverse code points. []rune decodes and allocates.
func reverseRunes(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

func main() {
	const s = "naïve"

	// len is bytes. It is not the number of characters.
	fmt.Println("len:", len(s), "runes:", len([]rune(s)))

	// Indexing is byte access: s[2] is the first half of ï, and it is a number.
	fmt.Printf("s[2] = %d (a byte, not a character)\\n", s[2])

	fmt.Printf("reverseBytes: %q\\n", reverseBytes(s))
	fmt.Printf("reverseRunes: %q\\n", reverseRunes(s))

	// range decodes UTF-8 and reports BYTE offsets. Watch 3 never appear.
	for i, r := range s {
		fmt.Printf("%d:%c ", i, r)
	}
	fmt.Println()

	// Rune-correct is still not character-correct. "e" + combining acute
	// renders as one character but is two runes, so reversing detaches the
	// accent and drops it on the wrong letter.
	const comb = "cafe\\u0301" // "e" + combining acute U+0301
	fmt.Printf("%q len=%d runes=%d -> reverseRunes %q\\n",
		comb, len(comb), len([]rune(comb)), reverseRunes(comb))
}`,
	codeExplanation:
		"This prints:<br><br><code>len: 6 runes: 5</code><br><code>s[2] = 195 (a byte, not a character)</code><br><code>reverseBytes: \"ev\\xaf\\xc3an\"</code><br><code>reverseRunes: \"evïan\"</code><br><code>0:n 1:a 2:ï 4:v 5:e</code><br><code>\"café\" len=6 runes=5 -> reverseRunes \"́efac\"</code><br><br><code>len</code> is 6 for five visible characters, because <code>ï</code> is two bytes. <code>s[2]</code> is <code>195</code>: that is <code>0xC3</code>, the lead byte of <code>ï</code>, and printing it as a character would be meaningless. <code>reverseBytes</code> is the failure the whole page is about: <code>%q</code> renders it as <code>\"ev\\xaf\\xc3an\"</code>, and those escapes are <code>%q</code> telling you the result is <strong>not valid UTF-8</strong>. The two bytes of <code>ï</code> were swapped into a sequence that decodes to nothing. <code>reverseRunes</code> gives <code>\"evïan\"</code>, correct. The range line is the one to stare at: offsets go <code>0 1 2 4 5</code>. Three is missing, because <code>ï</code> starts at 2 and is two bytes wide, so the loop counter is a position, not a count. The last line is the trap under the trap. That literal is <code>\"cafe\\u0301\"</code>, an <code>e</code> followed by a combining acute, which renders identically to <code>café</code> and is not the same string: <code>len=6 runes=5</code>, where precomposed <code>café</code> would report <code>len=5 runes=4</code>. Reversing it by rune moves the accent off the <code>e</code> and onto the front of the string, which is why the output opens with a floating accent. Rune-correct is not character-correct, and no amount of <code>[]rune</code> fixes it.",
	designRationale:
		"Ken Thompson and Rob Pike designed UTF-8 in 1992. Both of them were on the team that designed Go. That is not trivia, it is the reason the language looks like this: Go's strings are UTF-8 bytes out of conviction, from the people who chose the encoding's properties in the first place, and the language spec goes as far as defining Go source files to be UTF-8. The decision underneath is that a string is a byte sequence rather than a character sequence, which is the opposite of Python 3, where <code>str</code> is a sequence of code points and every I/O boundary is an encode or a decode. Python's choice buys O(1) indexing by character and pays for it with a three-way internal representation and an encoding error on every boundary you forgot about. Go's choice buys the wire format and the memory format being the same object: no decode when you read, no encode when you write, and <code>len</code> is already the number that <code>io.Writer</code> wants. The bill arrives as <code>s[i]</code> being a byte, which is honest and constantly surprising. Immutability is the second half. Because the bytes cannot change, a string can be a map key, can be shared across goroutines with no synchronisation, and can be sliced (<code>s[2:5]</code>) with no copy at all, since the result just points into the same bytes. That is also why there is no capacity: nothing can ever grow, so there is nothing to grow into. And it is why <code>string(65)</code> is <code>\"A\"</code>: a <code>rune</code> is an <code>int32</code>, so <code>string(someInteger)</code> has always meant \"encode this code point\", which reads as a stringify to anyone arriving from Java or Python and is not one. That conversion turned out to be such a productive source of bugs that the tooling was changed rather than the language: breaking it outright would have violated the Go 1 compatibility promise, so it became a <code>go vet</code> check (<code>stringintconv</code>, Go 1.15) that flags the integer cases while leaving the code compiling.",
	commonMistakes: [
		{
			title: "Slicing or reversing human text by byte",
			body: "<code>s[:20]</code> to truncate, or a byte-wise reverse, will cut a multi-byte rune in half and produce invalid UTF-8: the output above renders as <code>\"ev\\xaf\\xc3an\"</code>, escapes and all. It passes every ASCII test you write. If the text is human, work in runes; if it is an ASCII protocol token or a log line, bytes are correct and faster.",
		},
		{
			title: "string(n) on an integer",
			body: "<code>string(65)</code> is <code>\"A\"</code>, not <code>\"65\"</code>, because the conversion encodes a code point. <code>go vet</code> catches it: <code>conversion from int to string yields a string of one rune, not a string of digits (did you mean fmt.Sprint(x)?)</code>. Use <code>strconv.Itoa</code> for digits, and <code>string(rune(n))</code> when you really did mean the character.",
		},
		{
			title: "Treating len(s) as a character count",
			body: "<code>len(\"naïve\")</code> is 6, not 5, and a validator that enforces <code>len(name) <= 20</code> is enforcing a storage limit that silently tightens for anyone whose name is not ASCII. Decide which you meant: <code>len</code> for bytes and buffers, <code>utf8.RuneCountInString</code> or <code>len([]rune(s))</code> for characters.",
		},
		{
			title: "Converting to []rune just to iterate",
			body: "<code>for _, r := range []rune(s)</code> allocates the whole rune slice first: measured on a ~50-character string, 208 B/op and 1 alloc/op, roughly 4x slower than <code>for _, r := range s</code>, which decodes lazily at 0 allocs. <code>range</code> over the string already gives you runes. Reach for <code>[]rune</code> only when you need random access or to mutate.",
		},
		{
			title: "Assuming one rune is one character",
			body: "It is not, and this is the mistake that survives the other four. <code>\"e\" + U+0301</code> is one character and two runes; emoji with a zero-width joiner are one character and three or more. Rune-wise reversal, truncation, and cursor movement are all still wrong on that input. The standard library has no grapheme clustering, so if you genuinely need it, that is <code>golang.org/x/text</code>, and most code should simply not be doing these operations on human text.",
		},
	],
	relatedSlugs: [
		"slice-internals",
		"arrays-vs-slices",
		"bufio",
		"io-reader-writer",
		"tooling",
	],
}
