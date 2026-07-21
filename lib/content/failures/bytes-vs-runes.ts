import { Failure } from "../../content"

export const bytesVsRunes: Failure = {
	slug: "bytes-vs-runes",
	name: "Bytes when you meant runes: the truncation that eats characters",
	category: "Language semantics",
	tagline:
		"Slicing a string counts bytes, and byte 12 of a French title is the front half of a character, so the cut ships half a letter and exits 0.",
	symptom:
		"French users keep screenshotting a garbled pickup notification: <code>Commande pr</code>, then a replacement-character diamond, then the ellipsis. English notifications are perfect, every time. Nothing crashes and nothing logs an error; the sender exits 0 on every run. The payload log deepens the mystery instead of solving it: the garbled push logs as <code>payload: \"Commande pr\\xc3…\"</code>, with a backslash escape nobody typed, and grepping the code for <code>xc3</code> finds nothing. Grepping the logs for the diamond in the screenshots finds nothing either.",
	labPath: "labs/failures/bytes-vs-runes",
	runCommand: "go run .",
	tools: [
		"the %q verb, which spells out the exact bytes your terminal is politely hiding",
		"len versus utf8.RuneCountInString, the two honest answers to how long is this string",
		"a range loop over the string, which reports where each character starts and therefore how wide it is",
	],
	diagnosis: [
		{
			title: "Believe %q, not your eyes",
			body: "The evidence was already in the log, waiting to be read as evidence. <code>%q</code> prints what a string actually contains, spelling anything unprintable or invalid as escapes, and <code>\\xc3</code> is <code>%q</code> saying: at this position sits a raw byte, 0xC3, that is not part of any validly encoded character. The healthy lines around it sharpen the claim. Both English titles truncate cleanly, and the corruption sits exactly at the cut point of the one French title, where <code>title[:12]</code> ended and the ellipsis was glued on. So the cut itself manufactured an invalid byte sequence out of a valid one. And nothing crashed because no string operation in Go validates UTF-8: bytes in, bytes out, exit 0.",
			command: "go run .",
			output: `display: Order ready
payload: "Order ready"
display: Your table i…
payload: "Your table i…"
display: Commande pr�…
payload: "Commande pr\\xc3…"
sent 3 notifications`,
		},
		{
			title: "Count both ways, then find the victim",
			body: "Two probes turn suspicion into arithmetic. First, measure every title twice: <code>len</code> counts bytes, <code>utf8.RuneCountInString</code> counts characters (runes). The English titles agree with themselves, 11 and 11, 19 and 19. The French title splits: 26 bytes, 24 runes, so two of its characters are two bytes wide. Second, ask where each character starts: a <code>range</code> loop over a string decodes UTF-8 and reports each rune's starting byte offset. Read the offsets: <code>11:'ê' 13:'t'</code>. The <code>ê</code> starts at byte 11 and the next character starts at byte 13, so <code>ê</code> occupies bytes 11 and 12. The cut at <code>[:12]</code> kept byte 11, the first half of <code>ê</code>, and dropped byte 12, the second half. The 0xC3 in the log is that orphaned first half.",
			command: "go run .   # a scratch copy of main.go with the two probes added",
			output: `len=11 runes=11  Order ready
len=19 runes=19  Your table is ready
len=26 runes=24  Commande prête à retirer
0:'C' 1:'o' 2:'m' 3:'m' 4:'a' 5:'n' 6:'d' 7:'e' 8:' ' 9:'p' 10:'r' 11:'ê' 13:'t' 14:'e' 15:' ' 16:'à' 18:' ' 19:'r' 20:'e' 21:'t' 22:'i' 23:'r' 24:'e' 25:'r'`,
		},
		{
			title: "The asymmetry that wrote the bug",
			body: "Everything in <code>shorten</code> is consistent, in the wrong unit. <code>len(title)</code> is a byte count, <code>title[:12]</code> is a byte slice, and both work exactly as specified, because a Go string is a sequence of bytes and indexing and slicing address those bytes directly. Only <code>range</code> decodes. The strings-bytes-runes concept owns the full model; the operational rule a diagnosis needs is one line: every bracket you put on a string counts bytes, and only a range loop counts characters. The bug shipped because ASCII hides the difference, one byte per character, so every English test passed while the guard and the slice both silently measured storage instead of characters. The type system offers no friction anywhere: string in, string out, valid program, invalid text.",
		},
		{
			title: "Where the diamond comes from",
			body: "The string does not contain a replacement character; it contains the orphaned byte 0xC3 followed by the three bytes of the ellipsis. The diamond, U+FFFD, is manufactured later, by whatever display tries to decode those bytes and fails: the terminal here, the lock screen on the user's phone. That is why the wreckage can look different on different screens, and why grepping the logs for the screenshot's diamond finds nothing, since the diamond exists only on displays, never in the data. Keep that split: <code>%q</code> shows what is stored, the diamond shows one renderer's reaction to it. When a user reports a diamond and your logs show escapes, both are describing the same bytes from opposite sides of a failed decode.",
		},
	],
	fix: "Cut in the unit the screen counts. Decode once with <code>[]rune</code>, slice the runes, re-encode: <code>r := []rune(title)</code>, and when <code>len(r) &gt; 12</code>, ship <code>string(r[:12]) + \"…\"</code>. Guard and slice now measure the same thing, and the cut can no longer land inside a character. Prove it: <code>go run -tags fixed .</code> logs <code>payload: \"Commande prê…\"</code>, the <code>ê</code> intact, exit 0. The tempting non-fix is to scrub after cutting: <code>strings.ToValidUTF8(short, \"\")</code> deletes the orphan byte and ships a clean-looking <code>Commande pr…</code>. That launders the symptom and keeps the disease: the budget still counts bytes, so accented titles silently get fewer visible characters than English ones. One honesty box remains even for the real fix: runes are code points, and what a reader calls one character can be several of them, an e followed by a combining accent, an emoji family joined by zero-width joiners. Budgets like that need grapheme clusters, which the standard library does not provide (<code>golang.org/x/text</code> does; the strings-bytes-runes concept draws this boundary). For this title stream, precomposed French text, runes and characters coincide, which makes <code>[]rune</code> the correct fix here and an approximation everywhere.",
	production:
		"This bug's production signature is that it has none: exit 0, no error, no log line calling anything wrong, just a slow accumulation of support tickets from exactly the locales the team does not read. It also compounds at boundaries. <code>encoding/json</code> will not ship invalid UTF-8: <code>Marshal</code> replaces the orphan byte with U+FFFD, so the diamond gets baked into the payload for real, and no downstream code can ever recover the <code>ê</code> from it. Postgres refuses the bytes outright, failing the insert with <code>invalid byte sequence for encoding \"UTF8\"</code>, which means the analytics row for exactly the corrupted sends is the row that never lands, hiding the damaged cohort from the funnel you would use to notice it. The audit is cheap and worth running on any codebase that touches human text: find every slice bracket and <code>len</code> comparison on a string that came from a person, and ask each one which unit it means. Bytes are correct for storage limits and wire protocols; characters are what displays and humans count.",
	scar: "String indexing and slicing count bytes, not characters, and the twelfth byte of human text can be the front half of a letter.",
	relatedSlugs: ["strings-bytes-runes", "slice-internals", "value-semantics"],
	unlockTier: 1,
}
