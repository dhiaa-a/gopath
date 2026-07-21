import { Failure } from "../../content"

export const jsonSilentZero: Failure = {
	slug: "json-silent-zero",
	name: "The unmarshal that succeeded and lost your data",
	category: "Standard library",
	tagline:
		"One struct tag disagrees with the wire by a naming convention, Unmarshal reports success, and the money imports as zero.",
	symptom:
		"Finance reconciles the month and finds partner invoices posted to the ledger at 0.00. The importer's logs for every one of those runs are green: <code>imported invoice: acme 0 EUR</code>, then <code>import ok (0 errors)</code>, exit code 0. There is nothing to roll back, because it has been like this since the day the importer shipped. The payload, pulled straight off the feed, plainly contains <code>\"amount_cents\":12500</code>, the JSON validates, and <code>json.Unmarshal</code> returns <code>nil</code>. Customer and currency import perfectly. The only field that arrives as zero is the one that is money.",
	labPath: "labs/failures/json-silent-zero",
	runCommand: "go run .",
	tools: [
		"the suspicious zero itself: a zero in a field the wire was supposed to fill",
		"two print lines: the raw payload next to the decoded struct",
		"json.Decoder with DisallowUnknownFields, the tripwire that names the dropped key",
		"the struct tags, audited against the API spec instead of the style guide",
	],
	diagnosis: [
		{
			title: "Treat the zero as an unanswered question",
			body: "The output makes two claims that cannot both be honest: an amount of 0, and a summary of 0 errors. The instinct is to reread the decoding code, but it is four lines and identical to every working importer you have ever written, so staring at it confirms nothing. A zero in Go is suspicious in a specific way: it is indistinguishable from \"nobody ever assigned this field\", because zero is what a field holds before anything writes it. So the first question for a suspicious zero is never \"what computed this\", it is \"did anything write this field at all\", and that question is answered with data, not by rereading code.",
			command: "go run .",
			output: `imported invoice: acme 0 EUR
import ok (0 errors)`,
		},
		{
			title: "Put the wire next to the struct",
			body: "Two temporary prints, the raw payload with <code>%s</code> and the decoded value with <code>%+v</code>, turn the mystery into a diff you can read character by character. The wire sent <code>\"amount_cents\":12500</code>; the struct holds <code>AmountCents:0</code>; the fields on either side arrived intact. So the decoder did not fail, it matched two fields and skipped one, which is exactly the contract the encoding-json concept spells out: a wire key that matches no field is dropped without comment, a struct field that matches no key keeps its zero value, and neither event is an error, because <code>err == nil</code> means the bytes were valid JSON, never that your struct is complete. Now read the two names the diff hands you: the tag says <code>amountCents</code>, the wire says <code>amount_cents</code>. Unmarshal does have a case-insensitive fallback, and it is worth knowing its exact reach: a wire key of <code>AMOUNTCENTS</code> would land in this field (verified: it decodes 12500), because case folding is the whole fallback. Nothing bridges an underscore. To the matcher these are simply two different strings, so the field was never written, and what the ledger is charging is the struct's own zero.",
			command: "go run .",
			output: `raw payload: {"customer":"acme","amount_cents":12500,"currency":"EUR"}
decoded:     {Customer:acme AmountCents:0 Currency:EUR} (err=<nil>)`,
		},
		{
			title: "Make the decoder name the field it dropped",
			body: "The side-by-side worked because this payload is one line; against a four-hundred-line feed object you want the decoder to find the mismatch for you. That switch exists: route the same bytes through a <code>json.Decoder</code> and call <code>DisallowUnknownFields()</code> before decoding, with the struct still broken. The silent drop becomes an error, and look at what the error names: <code>amount_cents</code>, the wire's spelling, which is the correct one. The decoder is pointing at the exact key it had nowhere to put, so it has done the tag audit for you. Note where the strictness lives, because it is easy to reach for and miss: only <code>Decoder</code> has this switch. <code>json.Unmarshal</code> cannot be made strict at all, which is a standing reason to parse boundary data through a <code>Decoder</code> even when the bytes are already in memory.",
			command: "go run .",
			output: `import failed: json: unknown field "amount_cents"
import finished (1 errors)
exit status 1`,
		},
		{
			title: "Fix the instance, then trap the class",
			body: "Before making the one-character edit, notice what this bug was structurally: a string literal the compiler never checks, disagreeing with a remote spec, in the one place where agreement is everything. The wire owns those names. Tags at an integration boundary get transcribed from the API spec byte for byte and audited against the spec, never against the team style guide that produced <code>amountCents</code> here. Then harden, because an audit only catches the mismatches you already have, and strictness alone is not enough either. The lab proves the gap: strict-decode a payload that simply omits <code>amount_cents</code> and there is no unknown field to reject, so it returns <code>err == nil</code> and the amount is zero again (verified: <code>{Customer:acme AmountCents:0 Currency:EUR} err=&lt;nil&gt;</code>). <code>DisallowUnknownFields</code> fires when the wire sends what you did not claim; it stays silent when the wire withholds what you require. Those are different failures, so the importer needs both tripwires: strict decoding against name drift, and post-decode validation for every field the business cannot run without, which for an invoice means a positive amount and a non-empty customer and currency.",
		},
	],
	fix: "Correct the tag to <code>json:\"amount_cents\"</code> and make the decode strict and validated, which is the shape in <code>fixed.go</code>: a <code>json.Decoder</code> with <code>DisallowUnknownFields()</code>, so the next tag that drifts from the feed fails loudly and names the field, plus a required-fields check after decode, so an absent or nonsense amount can never reach the ledger. Prove it: <code>go run -tags fixed .</code> prints <code>imported invoice: acme 12500 EUR</code> and exits 0. The tempting non-fix is the tag edit alone. It makes this invoice import, and it teaches the program nothing: the next misspelled tag, or the feed's next renamed field, is another silent zero discovered by finance instead of by the decoder. The one character closes the bug; the two tripwires close the class.",
	production:
		"The classic casualty is exactly this shape: money and quantity fields arriving as zero across an integration boundary. What keeps it alive for weeks is that every test passes, because test fixtures are usually produced by calling <code>json.Marshal</code> on the same struct the test then decodes, and a round trip through your own tags agrees with itself no matter how wrong the tags are. The mismatch only exists against bytes your code did not produce, so the first system to notice is reconciliation, an ageing report, or a customer asking why their invoice is free. The same mechanics bite with no typo anywhere: a partner renames a field, deprecates one, or changes case convention between API versions, and every consumer decoding tolerantly gets zeros instead of errors. Config is the quieter variant: a misspelled option key in a production config decodes cleanly, the default silently wins, and the fleet runs for months with the setting everyone believes is on. The defenses are boring and layered: strict decoding at every boundary you do not control, validation for every field the business requires, and fixtures pasted from a captured real payload, never round-tripped through the code under test.",
	scar: "A nil error from Unmarshal promises the bytes were valid JSON, never that your fields were filled; only strict decoding plus your own validation promises that.",
	relatedSlugs: [
		"encoding-json",
		"struct-tags",
		"json-decode",
		"error-handling",
	],
	unlockTier: 1,
}
