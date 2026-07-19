import { Tier0Lesson } from "../../content"

export const stringsBytesRunes: Tier0Lesson = {
	slug: "strings-bytes-runes",
	order: 11,
	title: "Strings, bytes, runes",
	tagline: "len is bytes, range is characters, and why both are correct.",
	estimatedMinutes: 15,
	intro: [
		{
			type: "text",
			value: {
				en: "A Go string is an immutable sequence of bytes, and the bytes are UTF-8. That one sentence explains every string surprise you're about to hit. UTF-8 encodes ASCII characters in one byte, but most other characters take two to four bytes: <code>é</code> is two bytes, <code>世</code> is three. So \"how long is this string\" has two honest answers, and Go makes you pick which one you're asking.",
			},
		},
		{
			type: "text",
			value: {
				en: "The vocabulary: a <code>byte</code> is a raw 8-bit unit. A <code>rune</code> is a Unicode code point, what you'd casually call a character, stored as an <code>int32</code>. <code>len(s)</code> counts bytes, because that's the string's actual size in memory. Indexing <code>s[i]</code> gives you the byte at position i. Ranging <code>for i, r := range s</code> decodes runes. Python 3 hides all this by making strings sequences of characters and re-encoding at the edges; Go shows you the actual bytes and gives you tools for both views.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	s := "héllo"

	// Bytes: the string's real size in memory.
	fmt.Println("len:", len(s))

	// Indexing gives a single byte (a number).
	fmt.Println("s[1] is byte:", s[1])

	// range decodes UTF-8: i is the BYTE offset, r is the rune.
	for i, r := range s {
		fmt.Printf("byte %d: %c\\n", i, r)
	}

	// Rune count, when "how many characters" is the real question.
	fmt.Println("runes:", len([]rune(s)))

	// Strings are immutable; building a new one is the only way.
	shout := s + "!"
	fmt.Println(shout)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Run it and read the output slowly. <code>len(s)</code> is 6, not 5: <code>é</code> occupies two bytes. <code>s[1]</code> prints <code>195</code>, the first byte of é's two-byte encoding, because indexing is byte access and bytes are numbers. The range loop prints byte offsets 0, 1, 3, 4, 5: offset 2 never appears, because the rune at offset 1 is two bytes wide and range jumped past it. Every piece of that output is UTF-8 being shown to you rather than hidden.",
			},
		},
		{
			type: "text",
			value: {
				en: "When you need a character count (rare: think cursor positions in a text editor, not most string handling), convert: <code>len([]rune(s))</code> decodes the whole string into code points and counts those. And immutability means <code>s[0] = 'H'</code> is a compile error; you build modified strings with concatenation or the standard <code>strings</code> package, which you'll meet in the packages lesson.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "The bug this lesson inoculates against: chopping a string at a byte index, <code>s[:5]</code>, can cut a multi-byte character in half and produce invalid UTF-8. If you're slicing human text by position, you almost always want runes, not bytes. Log lines and protocol tokens in ASCII? Bytes are fine, and faster.",
			},
		},
	],
	retrievalPrompts: [
		"len(\"héllo\") returns 6. Why, and how do you get 5? || Strings are UTF-8 bytes and é encodes as two bytes, so len counts 6 bytes. For the character count, decode to code points: len([]rune(\"héllo\")) is 5. Which one you want depends on whether you're measuring memory or characters.",
		"In for i, r := range s over a string, what are i and r, and why can i skip numbers? || r is the decoded rune (Unicode code point); i is the byte offset where that rune starts. Multi-byte runes make offsets jump: after a two-byte rune at offset 1, the next i is 3. Range decodes UTF-8; plain indexing s[i] reads single bytes.",
		"What's the difference between a byte and a rune? || A byte is a raw 8-bit unit (alias for uint8); a rune is a whole Unicode code point (alias for int32), one to four bytes in UTF-8. Bytes measure storage; runes measure code points. (Some on-screen characters, like emoji sequences and accented pairs, combine several runes.)",
	],
}
