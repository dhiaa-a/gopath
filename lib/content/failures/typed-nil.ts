import { Failure } from "../../content"

export const typedNil: Failure = {
	slug: "typed-nil",
	name: "The nil that isn't: a typed nil in an interface",
	category: "Language semantics",
	tagline:
		"A nil pointer assigned into an error interface stamps the type word, and err != nil judges the pair, not the pointer inside.",
	symptom:
		"The service refuses to start. Every deploy aborts immediately with <code>startup aborted: &lt;nil&gt;</code> and exit code 1, and the config it is rejecting is byte-identical to the one the previous build boots happily. The message is the disturbing part: it names no field and no reason, just <code>&lt;nil&gt;</code>, an abort blamed on nothing. The only change in the build is a validation refactor that introduced a structured <code>ValidationError</code> so the log could name the offending field. Reverting the refactor fixes startup.",
	labPath: "labs/failures/typed-nil",
	runCommand: "go run .",
	tools: [
		"the log line read literally: the abort branch ran, and the error it printed reads as nil",
		"fmt's %T verb, which prints the type word that %v hides",
		"the helper's signature, read as a type rather than as logic: a concrete pointer return converts at every call site",
	],
	diagnosis: [
		{
			title: "Take the absurd line at face value",
			body: "The line is a contradiction with a claim in each half, and both halves are true. <code>startup aborted</code> means the branch guarded by <code>err != nil</code> ran, so that comparison answered true. <code>&lt;nil&gt;</code> is what printing <code>err</code> produced, which is <code>fmt</code>'s spelling for a nil pointer it was handed. So the program is holding something that compares as non-nil and prints as nil. Do not reread the validation logic hunting for the config mistake; the config is fine, and the program said so in its own confusing way. When a log line disagrees with itself, the two halves measured different things, and the diagnosis is finding out what each one actually measured.",
			command: "go run .",
			output: `startup aborted: <nil>
exit status 1`,
		},
		{
			title: "Ask for the type, not the value",
			body: "<code>%v</code> collapses this bug into <code>&lt;nil&gt;</code>; <code>%T</code> is the probe that ends it. Add one line above the check, <code>fmt.Printf(\"err = %v, type = %T\\n\", err, err)</code>, and run again. The value prints as <code>&lt;nil&gt;</code> and the type prints as <code>*main.ValidationError</code>: the variable is not empty, it is a live interface value carrying a concrete type whose pointer happens to be nil. That one line of output is the whole reveal, and it generalises: any time an error prints as nil while behaving as non-nil, print <code>%T</code> before touching anything else.",
			command: "go run .   # after adding the %T probe above the nil check",
			output: `err = <nil>, type = *main.ValidationError
startup aborted: <nil>
exit status 1`,
		},
		{
			title: "err != nil compares a pair of words",
			body: "An interface variable is two words, a concrete type and a value, and it equals nil only when <em>both</em> words are nil. The typed-nil concept teaches the machinery; this lab is the machinery caught in the act. <code>validate</code> declares its result as <code>*ValidationError</code>, and on a valid config it returns a nil pointer. The line <code>var err error = validate(cfg)</code> is where the damage happens: assigning that pointer into the <code>error</code> interface builds an interface value and stamps its type word with <code>*ValidationError</code>. The value word is nil, the type word is not, so the pair is not <code>(nil, nil)</code> and <code>err != nil</code> is true. Nothing malfunctioned. The comparison answered exactly the question interfaces answer, about the pair, never about the pointer inside. And the conversion that set the trap is invisible at the call site: no cast, no conversion syntax, an ordinary assignment did it.",
		},
		{
			title: "Name the misconception, then check where the tests were standing",
			body: "The refactor read as good practice: return the concrete <code>*ValidationError</code>, because it carries structured fields. Every test agreed. A test that calls <code>validate</code> directly compares a <code>*ValidationError</code> against nil, pointer against pointer, and passes honestly. Production compares after the assignment into <code>error</code>, interface against nil, and fails just as honestly. The bug lives only in the conversion between those two worlds, so any test standing on one side of it can never see it. The standard library does not rescue the call site either: <code>errors.Is(err, nil)</code> reduces to <code>err == nil</code>, the same pair comparison, and <code>go vet</code> has no check for any of this. There is no smarter nil check waiting to be found; the signature is the bug.",
		},
	],
	fix: "Change the one word that lies: declare <code>validate</code> to return <code>error</code>, and its <code>return nil</code> becomes a genuinely nil interface. The call site does not change at all, which is the point: with an <code>error</code> return type, the concrete-to-interface conversion happens inside <code>validate</code> on the non-nil paths only, not silently at every caller. Callers that need the structured <code>Field</code> recover it with <code>errors.As</code>. Prove it: <code>go run -tags fixed .</code> prints <code>startup ok: listening on 127.0.0.1:8080</code> and exits 0. The tempting non-fix is to keep the signature and outsmart it at the call site, assigning to a concrete variable first (<code>if ve := validate(cfg); ve != nil</code>) or reaching for reflection to ask whether the pointer inside the interface is nil. Both make this program print the right thing, and both leave the gun loaded: the signature keeps offering the silent conversion to every future caller, and the first one who forgets the dance recreates this page. The durable rule is the typed-nil concept's rule: a function whose result is used as an error is declared to return <code>error</code>, always.",
	production:
		"The startup version of this bug is the merciful one, loud and immediate. The request-path version is the one that pages you: a helper declared to return <code>*AppError</code> feeds a middleware's <code>err != nil</code>, and every successful request becomes a logged failure. The error-rate graph pins at 100 percent while users see nothing wrong, and every log line says <code>&lt;nil&gt;</code>, so the grep that opens every incident has nothing to hold on to. A log full of errors that name nothing is this bug's production signature; treat the string <code>&lt;nil&gt;</code> in an error position as radioactive. Know also that <code>fmt</code> was the only thing keeping the lab polite: it detects the nil pointer and prints <code>&lt;nil&gt;</code> rather than calling its <code>Error</code> method. The moment something calls <code>err.Error()</code> directly, the way <code>log.Fatal(err.Error())</code> does, the nil pointer is dereferenced and the mystery abort becomes a panic. Same bug, two costumes, one signature to fix.",
	scar: "An interface is nil only when both its type word and its value word are nil, so declare error returns as error, never as a concrete pointer type.",
	relatedSlugs: ["typed-nil", "nil", "interfaces", "error-handling"],
	unlockTier: 1,
}
